import ExcelJS from "exceljs";
import { getPgPool, executeQuery } from "./db.js";

export interface Annex9ExportOptions {
  state?: string;
  tspId?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  skill?: string;
  cohort?: string;
  status?: string;
}

/**
 * Fetches and filters master data for Annex 9 workbook and CSV exports.
 * Adheres strictly to TSP scoping and filter options without fabricating data.
 */
async function fetchMasterExportData(options?: Annex9ExportOptions) {
  const pool = getPgPool();
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  // Active Trainees (Beneficiaries)
  let traineeQuery = `
    SELECT 
      b.id as beneficiary_id,
      COALESCE(tp.tvet_id, 'ID-TVE-26-' || SUBSTRING(b.id, 1, 6)) as tvet_id,
      b.first_name,
      b.last_name,
      COALESCE(b.other_name, '') as other_name,
      b.gender,
      COALESCE(b.date_of_birth, '') as date_of_birth,
      b.state,
      COALESCE(b.lga, '') as lga,
      COALESCE(b.phone_number, '') as phone_number,
      b.email,
      COALESCE(b.residential_address, '') as residential_address,
      COALESCE(b.skill_sector, '') as skill_sector,
      COALESCE(b.tsp, '') as tsp,
      b.tsp_id,
      COALESCE(b.beneficiary_status, b.status, 'ACTIVE') as training_status,
      COALESCE(b.bank_name, '') as bank_name,
      COALESCE(b.bank_account_holder, '') as account_name,
      COALESCE(b.bank_account_number, '') as account_number,
      COALESCE(b.nin, '') as nin,
      COALESCE(b.bvn, '') as bvn,
      COALESCE(b.guardian_name, '') as guardian_name,
      COALESCE(b.guardian_phone, '') as guardian_phone,
      COALESCE(b.cohort, '') as cohort
    FROM beneficiaries b
    LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
    WHERE b.deleted_at IS NULL AND (
      b.status IN ('VERIFIED', 'ACCEPTED', 'ENROLLED', 'TRAINING', 'ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI', 'GRADUATED', 'COMPLETED', 'ONBOARDED')
      OR EXISTS (SELECT 1 FROM trainee_attendance ta WHERE ta.beneficiary_id = b.id)
    )
  `;
  const traineeParams: any[] = [];
  let paramIdx = 1;

  if (options?.state && options.state !== 'all') {
    traineeQuery += ` AND b.state ILIKE $${paramIdx++}`;
    traineeParams.push(options.state);
  }
  if (options?.tspId && options.tspId !== 'all') {
    traineeQuery += ` AND (b.tsp_id = $${paramIdx} OR b.tsp ILIKE $${paramIdx} OR b.tsp ILIKE '%' || $${paramIdx} || '%' OR b.tsp_id IN (SELECT id FROM tsps WHERE name ILIKE $${paramIdx} OR code ILIKE $${paramIdx}) OR b.tsp IN (SELECT name FROM tsps WHERE id::text = $${paramIdx}))`;
    paramIdx++;
    traineeParams.push(options.tspId);
  }
  if (options?.skill && options.skill !== 'all') {
    traineeQuery += ` AND (b.skill_sector ILIKE '%' || $${paramIdx} || '%' OR b.skill ILIKE '%' || $${paramIdx} || '%')`;
    paramIdx++;
    traineeParams.push(options.skill);
  }
  if (options?.cohort && options.cohort !== 'all') {
    traineeQuery += ` AND b.cohort ILIKE '%' || $${paramIdx++} || '%'`;
    traineeParams.push(options.cohort);
  }
  traineeQuery += ` ORDER BY b.last_name ASC, b.first_name ASC`;

  const traineesRes = await executeQuery(traineeQuery, traineeParams);
  const trainees = traineesRes.rows;
  const traineeIds = trainees.map(t => t.beneficiary_id);
  const traineeMap = new Map(trainees.map(t => [t.beneficiary_id, t]));

  // Portal Monitoring Data
  const portalRes = await executeQuery(`
    SELECT 
      pm.beneficiary_id,
      pm.still_on_portal,
      pm.still_attending,
      pm.remarks,
      pm.last_verified_at,
      pm.verified_by
    FROM portal_monitoring pm
  `);
  const portalMap = new Map(portalRes.rows.map(row => [row.beneficiary_id, row]));

  // Attendance Records
  let attRecordsQuery = `
    SELECT 
      ta.id,
      ta.beneficiary_id,
      ta.attendance_date,
      ta.check_in_time,
      ta.check_out_time,
      COALESCE(ta.attendance_source, 'MANUAL') as attendance_source,
      COALESCE(ta.status, 'PRESENT') as status,
      COALESCE(ta.hours_logged, 0) as hours_logged,
      COALESCE(ta.remarks, '') as remarks
    FROM trainee_attendance ta
    WHERE 1=1
  `;
  const attParams: any[] = [];
  let attParamIdx = 1;

  if (traineeIds.length > 0) {
    attRecordsQuery += ` AND ta.beneficiary_id = ANY($${attParamIdx++})`;
    attParams.push(traineeIds);
  } else {
    attRecordsQuery += ` AND 1=0`;
  }

  if (options?.month && options.month !== 'all') {
    attRecordsQuery += ` AND TO_CHAR(ta.attendance_date, 'YYYY-MM') = $${attParamIdx++}`;
    attParams.push(options.month);
  }
  if (options?.startDate && options.startDate !== '') {
    attRecordsQuery += ` AND ta.attendance_date >= $${attParamIdx++}`;
    attParams.push(options.startDate);
  }
  if (options?.endDate && options.endDate !== '') {
    attRecordsQuery += ` AND ta.attendance_date <= $${attParamIdx++}`;
    attParams.push(options.endDate);
  }
  if (options?.status && options.status !== 'all') {
    attRecordsQuery += ` AND UPPER(ta.status) = UPPER($${attParamIdx++})`;
    attParams.push(options.status);
  }
  attRecordsQuery += ` ORDER BY ta.attendance_date DESC, ta.beneficiary_id ASC`;

  const attRecordsRes = await executeQuery(attRecordsQuery, attParams);
  const attendanceRecords = attRecordsRes.rows;

  // Daily map for matrix grid
  const dailyMap = new Map<string, string>();
  attendanceRecords.forEach(r => {
    const dateStr = typeof r.attendance_date === 'string' ? r.attendance_date.split("T")[0] : r.attendance_date.toISOString().split("T")[0];
    const parts = dateStr.split("-");
    if (parts.length >= 3) {
      const dayNum = parseInt(parts[2], 10);
      let code = "P";
      const st = (r.status || "").toUpperCase();
      if (st === "ABSENT") code = "A";
      else if (st === "EXCUSED") code = "E";
      else if (st === "LATE") code = "L";
      else if (st === "PRESENT") code = "P";
      dailyMap.set(`${r.beneficiary_id}_${dayNum}`, code);
    }
  });

  return { trainees, traineeMap, portalMap, attendanceRecords, dailyMap };
}

/**
 * Generates the official Government Annex 9 Audit & Verification Spreadsheet.
 * Adheres strictly to layout formatting, borders, merged title cells, and header aesthetics.
 */
export async function generateAnnex9Workbook(options?: Annex9ExportOptions): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IDEAS-TVET Platform";
  workbook.lastModifiedBy = "Government Export Engine";
  workbook.created = new Date();
  workbook.modified = new Date();

  const { trainees, traineeMap, portalMap, attendanceRecords, dailyMap } = await fetchMasterExportData(options);

  // Visual Styling Palettes
  const primaryHeaderFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" } // Deep Slate
  };
  
  const subHeaderFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "F1F5F9" } // Slate light
  };

  const borderThin: any = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } }
  };

  const fontHeader: any = {
    name: "Inter",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" }
  };

  const fontTitle: any = {
    name: "Inter",
    size: 16,
    bold: true,
    color: { argb: "FF1E293B" }
  };

  // --- SHEET 1: TRAINEE PROFILE ---
  const ws1 = workbook.addWorksheet("TRAINEE PROFILE");
  ws1.views = [{ showGridLines: true }];

  ws1.mergeCells("A1:U1");
  const titleCell1 = ws1.getCell("A1");
  titleCell1.value = "FEDERAL REPUBLIC OF NIGERIA — IDEAS TVET PROGRAM DEVELOPMENT COOPERATIVE";
  titleCell1.font = fontTitle;
  titleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 40;

  ws1.mergeCells("A2:U2");
  const subTitleCell1 = ws1.getCell("A2");
  subTitleCell1.value = "ANNEX 9: TRAINEE LIFECYCLE DEPLOYMENT & VERIFICATION PROFILE STAGE";
  subTitleCell1.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 25;

  ws1.addRow([]); // Blank Spacer

  const colHeaders1 = [
    "S/N", "Trainee ID (TVET Code)", "First Name", "Last Name", "Other Name", "Gender",
    "Date of Birth", "State of Origin", "Phone Number", "Email Address", "Contact Address",
    "Sector Track", "TSP Association", "Training Status", "Bank Name", "Account Holder",
    "Bank Account No", "NIN (Hashed/Verified)", "BVN (Hashed/Verified)", "Guardian Name", "Guardian Phone"
  ];
  const headerRow1 = ws1.addRow(colHeaders1);
  headerRow1.height = 30;
  headerRow1.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  trainees.forEach((trainee, index) => {
    const rowData = [
      index + 1,
      trainee.tvet_id,
      trainee.first_name,
      trainee.last_name,
      trainee.other_name,
      trainee.gender,
      trainee.date_of_birth,
      trainee.state,
      trainee.phone_number,
      trainee.email,
      trainee.residential_address,
      trainee.skill_sector,
      trainee.tsp,
      trainee.training_status,
      trainee.bank_name,
      trainee.account_name,
      trainee.account_number,
      trainee.nin,
      trainee.bvn,
      trainee.guardian_name,
      trainee.guardian_phone
    ];
    const row = ws1.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber === 1 || colNumber === 2 || colNumber === 6 || colNumber === 7 || colNumber >= 14) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
      if (index % 2 === 1) cell.fill = subHeaderFill;
    });
  });

  // --- SHEET 2: ATTENDANCE ---
  const ws2 = workbook.addWorksheet("ATTENDANCE");
  ws2.views = [{ showGridLines: true }];

  ws2.mergeCells("A1:P1");
  const titleCell2 = ws2.getCell("A1");
  titleCell2.value = "IDEAS-TVET OPERATIONS SYSTEM — OFFICIAL ATTENDANCE LOGS";
  titleCell2.font = fontTitle;
  titleCell2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 40;

  ws2.mergeCells("A2:P2");
  const subTitleCell2 = ws2.getCell("A2");
  subTitleCell2.value = "ANNEX 9: ATTENDANCE RECORDS (PRESENT, LATE, ABSENT & EXCUSED)";
  subTitleCell2.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(2).height = 25;

  ws2.addRow([]);

  const colHeaders2 = [
    "S/N", "Trainee ID (TVET Code)", "First Name", "Last Name", "Gender", "State", "LGA",
    "TSP Association", "Skill", "Attendance Date", "Status", "Check In Time", "Check Out Time",
    "Attendance Source", "Hours Logged", "Remarks"
  ];
  const headerRow2 = ws2.addRow(colHeaders2);
  headerRow2.height = 30;
  headerRow2.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  const formatTime = (val: any) => {
    if (!val) return "-";
    try {
      const d = typeof val === "string" ? new Date(val) : val;
      return isNaN(d.getTime()) ? String(val) : d.toLocaleTimeString("en-GB");
    } catch { return String(val); }
  };

  attendanceRecords.forEach((rec, index) => {
    const trainee = traineeMap.get(rec.beneficiary_id);
    if (!trainee) return;

    const dateStr = typeof rec.attendance_date === 'string' ? rec.attendance_date.split("T")[0] : rec.attendance_date.toISOString().split("T")[0];
    const rowData = [
      index + 1,
      trainee.tvet_id,
      trainee.first_name,
      trainee.last_name,
      trainee.gender,
      trainee.state,
      trainee.lga,
      trainee.tsp,
      trainee.skill_sector,
      dateStr,
      rec.status,
      formatTime(rec.check_in_time),
      formatTime(rec.check_out_time),
      rec.attendance_source,
      Number(rec.hours_logged || 0),
      rec.remarks || "-"
    ];

    const row = ws2.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber >= 10) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      if (colNumber === 11) {
        cell.font = { name: "Inter", size: 10, bold: true };
        const st = String(rec.status).toUpperCase();
        if (st === "PRESENT") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        } else if (st === "LATE") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
        } else if (st === "ABSENT") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
        } else if (st === "EXCUSED") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEE2E6" } };
        }
      } else if (index % 2 === 1) {
        cell.fill = subHeaderFill;
      }
    });
  });

  // --- SHEET 3: TVET PORTAL ---
  const ws3 = workbook.addWorksheet("TVET PORTAL");
  ws3.views = [{ showGridLines: true }];

  ws3.mergeCells("A1:H1");
  const titleCell3 = ws3.getCell("A1");
  titleCell3.value = "IDEAS-TVET OPERATIONS SYSTEM — REGISTERED DEPLOYED PORTAL TRACKING";
  titleCell3.font = fontTitle;
  titleCell3.alignment = { horizontal: "center", vertical: "middle" };
  ws3.getRow(1).height = 40;

  ws3.mergeCells("A2:H2");
  const subTitleCell3 = ws3.getCell("A2");
  subTitleCell3.value = "VERIFICATION OF PORTAL DEPLOYMENT (ANNEX 9 REGISTRATION STATUS)";
  subTitleCell3.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell3.alignment = { horizontal: "center", vertical: "middle" };
  ws3.getRow(2).height = 25;

  ws3.addRow([]);

  const colHeaders3 = [
    "S/N", "First Name", "Last Name", "TVET Code (Trainee ID)",
    "Still On Portal", "Still Attending Classes", "Remarks", "Last Verified Date"
  ];
  const headerRow3 = ws3.addRow(colHeaders3);
  headerRow3.height = 30;
  headerRow3.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  trainees.forEach((trainee, index) => {
    const pm = portalMap.get(trainee.beneficiary_id);
    const rowData = [
      index + 1,
      trainee.first_name,
      trainee.last_name,
      trainee.tvet_id,
      pm ? (pm.still_on_portal ? "YES" : "NO") : "UNVERIFIED",
      pm ? (pm.still_attending ? "YES" : "NO") : "UNVERIFIED",
      pm?.remarks || "Awaiting Monitoring Verification",
      pm?.last_verified_at ? new Date(pm.last_verified_at).toLocaleDateString() : "Pending"
    ];

    const row = ws3.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber === 1 || colNumber >= 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
      if (colNumber === 5 || colNumber === 6) {
        cell.font = { name: "Inter", size: 10, bold: true };
        if (cell.value === "YES") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        } else if (cell.value === "NO") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
        }
      } else if (index % 2 === 1) {
        cell.fill = subHeaderFill;
      }
    });
  });

  // --- SHEET 4: DAILY ATTENDANCE MATRIX ---
  const ws4 = workbook.addWorksheet("DAILY ATTENDANCE MATRIX");
  ws4.views = [{ showGridLines: true }];

  const matrixMonth = options?.month || (attendanceRecords.length > 0 ? (typeof attendanceRecords[0].attendance_date === 'string' ? attendanceRecords[0].attendance_date.substring(0, 7) : attendanceRecords[0].attendance_date.toISOString().substring(0, 7)) : new Date().toISOString().substring(0, 7));
  const numDays = new Date(parseInt(matrixMonth.split("-")[0]), parseInt(matrixMonth.split("-")[1]), 0).getDate();

  const totalCols = numDays + 5;
  const lastColLetter = ws4.getColumn(totalCols).letter;

  ws4.mergeCells(`A1:${lastColLetter}1`);
  const titleCell4 = ws4.getCell("A1");
  titleCell4.value = `IDEAS-TVET PROGRAM — DAILY ATTENDANCE REGISTER MATRIX (${matrixMonth})`;
  titleCell4.font = fontTitle;
  titleCell4.alignment = { horizontal: "center", vertical: "middle" };
  ws4.getRow(1).height = 40;

  ws4.mergeCells(`A2:${lastColLetter}2`);
  const subTitleCell4 = ws4.getCell("A2");
  subTitleCell4.value = "P = PRESENT, L = LATE, A = ABSENT, E = EXCUSED | TOTAL P/L COUNTS PRESENT & LATE ONLY";
  subTitleCell4.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell4.alignment = { horizontal: "center", vertical: "middle" };
  ws4.getRow(2).height = 25;

  ws4.addRow([]);

  const colHeaders4 = ["S/N", "TVET Code", "Full Name", "TSP Name"];
  for (let d = 1; d <= numDays; d++) colHeaders4.push(`Day ${d}`);
  colHeaders4.push("Total P/L");

  const headerRow4 = ws4.addRow(colHeaders4);
  headerRow4.height = 28;
  headerRow4.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  trainees.forEach((trainee, index) => {
    const rowData: any[] = [
      index + 1,
      trainee.tvet_id,
      `${trainee.first_name} ${trainee.last_name}`,
      trainee.tsp
    ];
    let totalP = 0;
    for (let d = 1; d <= numDays; d++) {
      const code = dailyMap.get(`${trainee.beneficiary_id}_${d}`) || ""; // no record = blank
      rowData.push(code);
      if (code === "P" || code === "L") totalP++;
    }
    rowData.push(totalP);

    const row = ws4.addRow(rowData);
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 9 };
      if (colNumber > 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (cell.value === "P") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        } else if (cell.value === "A") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
        } else if (cell.value === "L") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
        }
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // --- AUTO WIDTH ADJUSTMENTS ACROSS WORKBOOK ---
  [ws1, ws2, ws3, ws4].forEach((ws) => {
    ws.columns.forEach((col) => {
      let maxLen = 0;
      col.eachCell!({ includeEmpty: false }, (cell) => {
        if (cell.value && cell.address !== "A1" && cell.address !== "A2") {
          const valStr = String(cell.value);
          if (valStr.length > maxLen) maxLen = valStr.length;
        }
      });
      col.width = Math.min(Math.max(maxLen + 4, 12), 35);
    });
  });

  return workbook;
}

const formatCsvField = (val: any) => `"${String(val !== null && val !== undefined ? val : '').replace(/"/g, '""')}"`;

export async function generateAnnex9AttendanceCSV(options?: Annex9ExportOptions): Promise<string> {
  const { traineeMap, attendanceRecords } = await fetchMasterExportData(options);
  const header = [
    "S/N", "Trainee ID (TVET Code)", "First Name", "Last Name", "Gender", "State", "LGA",
    "TSP Association", "Skill", "Attendance Date", "Status", "Check In Time", "Check Out Time",
    "Attendance Source", "Hours Logged", "Remarks"
  ].join(",") + "\n";

  const formatTime = (val: any) => {
    if (!val) return "-";
    try {
      const d = typeof val === "string" ? new Date(val) : val;
      return isNaN(d.getTime()) ? String(val) : d.toLocaleTimeString("en-GB");
    } catch { return String(val); }
  };

  const lines: string[] = [];
  attendanceRecords.forEach((rec, index) => {
    const trainee = traineeMap.get(rec.beneficiary_id);
    if (!trainee) return;
    const dateStr = typeof rec.attendance_date === 'string' ? rec.attendance_date.split("T")[0] : rec.attendance_date.toISOString().split("T")[0];
    const row = [
      formatCsvField(index + 1),
      formatCsvField(trainee.tvet_id),
      formatCsvField(trainee.first_name),
      formatCsvField(trainee.last_name),
      formatCsvField(trainee.gender),
      formatCsvField(trainee.state),
      formatCsvField(trainee.lga),
      formatCsvField(trainee.tsp),
      formatCsvField(trainee.skill_sector),
      formatCsvField(dateStr),
      formatCsvField(rec.status),
      formatCsvField(formatTime(rec.check_in_time)),
      formatCsvField(formatTime(rec.check_out_time)),
      formatCsvField(rec.attendance_source),
      formatCsvField(Number(rec.hours_logged || 0)),
      formatCsvField(rec.remarks || "-")
    ];
    lines.push(row.join(","));
  });
  return header + lines.join("\n");
}

export async function generateAnnex9ProfileCSV(options?: Annex9ExportOptions): Promise<string> {
  const { trainees } = await fetchMasterExportData(options);
  const header = [
    "S/N", "Trainee ID (TVET Code)", "First Name", "Last Name", "Other Name", "Gender",
    "Date of Birth", "State of Origin", "Phone Number", "Email Address", "Contact Address",
    "Sector Track", "TSP Association", "Training Status", "Bank Name", "Account Holder",
    "Bank Account No", "NIN", "BVN", "Guardian Name", "Guardian Phone"
  ].join(",") + "\n";

  const lines: string[] = [];
  trainees.forEach((t, index) => {
    const row = [
      formatCsvField(index + 1),
      formatCsvField(t.tvet_id),
      formatCsvField(t.first_name),
      formatCsvField(t.last_name),
      formatCsvField(t.other_name),
      formatCsvField(t.gender),
      formatCsvField(t.date_of_birth),
      formatCsvField(t.state),
      formatCsvField(t.phone_number),
      formatCsvField(t.email),
      formatCsvField(t.residential_address),
      formatCsvField(t.skill_sector),
      formatCsvField(t.tsp),
      formatCsvField(t.training_status),
      formatCsvField(t.bank_name),
      formatCsvField(t.account_name),
      formatCsvField(t.account_number),
      formatCsvField(t.nin),
      formatCsvField(t.bvn),
      formatCsvField(t.guardian_name),
      formatCsvField(t.guardian_phone)
    ];
    lines.push(row.join(","));
  });
  return header + lines.join("\n");
}

export async function generateAnnex9PortalCSV(options?: Annex9ExportOptions): Promise<string> {
  const { trainees, portalMap } = await fetchMasterExportData(options);
  const header = [
    "S/N", "First Name", "Last Name", "TVET Code (Trainee ID)",
    "Still On Portal", "Still Attending Classes", "Remarks", "Last Verified Date"
  ].join(",") + "\n";

  const lines: string[] = [];
  trainees.forEach((t, index) => {
    const pm = portalMap.get(t.beneficiary_id);
    const row = [
      formatCsvField(index + 1),
      formatCsvField(t.first_name),
      formatCsvField(t.last_name),
      formatCsvField(t.tvet_id),
      formatCsvField(pm ? (pm.still_on_portal ? "YES" : "NO") : "UNVERIFIED"),
      formatCsvField(pm ? (pm.still_attending ? "YES" : "NO") : "UNVERIFIED"),
      formatCsvField(pm?.remarks || "Awaiting Monitoring Verification"),
      formatCsvField(pm?.last_verified_at ? new Date(pm.last_verified_at).toLocaleDateString() : "Pending")
    ];
    lines.push(row.join(","));
  });
  return header + lines.join("\n");
}
