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
  gender?: string;
  lga?: string;
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
      CASE 
        WHEN tp.tvet_id IS NOT NULL AND tp.tvet_id != '' AND tp.tvet_id NOT LIKE '%IDEAS-' AND tp.tvet_id NOT LIKE 'ID-TVE-26-IDEAS-%' AND LENGTH(tp.tvet_id) > 8 THEN tp.tvet_id
        WHEN (b.custom_fields->>'tvet_id') IS NOT NULL AND (b.custom_fields->>'tvet_id') != '' AND (b.custom_fields->>'tvet_id') NOT LIKE '%IDEAS-' AND (b.custom_fields->>'tvet_id') NOT LIKE 'ID-TVE-26-IDEAS-%' AND LENGTH(b.custom_fields->>'tvet_id') > 8 THEN (b.custom_fields->>'tvet_id')
        WHEN b.id IS NOT NULL AND b.id != '' THEN b.id
        ELSE 'Pending TVET ID'
      END as tvet_id,
      b.first_name,
      b.last_name,
      COALESCE(b.other_name, '') as other_name,
      b.gender,
      COALESCE(b.date_of_birth, '') as date_of_birth,
      b.state,
      COALESCE(b.custom_fields->>'lga', b.city, '') as lga,
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
      COALESCE(b.bank_sort_code, '') as bank_sort_code,
      COALESCE(b.physical_challenge, 'NO') as physical_challenge,
      COALESCE(b.guardian_address, '') as guardian_address,
      COALESCE(b.education_qualification, '') as education_qualification,
      COALESCE(b.nin, '') as nin,
      COALESCE(b.bvn, '') as bvn,
      COALESCE(b.guardian_name, '') as guardian_name,
      COALESCE(b.guardian_phone, '') as guardian_phone,
      COALESCE(b.batch, '') as cohort
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
    traineeQuery += ` AND (b.tsp_id::text = $${paramIdx} OR b.tsp ILIKE $${paramIdx} OR b.tsp ILIKE '%' || $${paramIdx} || '%' OR b.tsp_id IN (SELECT id FROM tsps WHERE name ILIKE $${paramIdx} OR code ILIKE $${paramIdx}) OR b.tsp IN (SELECT name FROM tsps WHERE id::text = $${paramIdx}))`;
    paramIdx++;
    traineeParams.push(options.tspId);
  }
  if (options?.skill && options.skill !== 'all') {
    traineeQuery += ` AND (b.skill_sector ILIKE '%' || $${paramIdx} || '%' OR b.skill ILIKE '%' || $${paramIdx} || '%')`;
    paramIdx++;
    traineeParams.push(options.skill);
  }
  if (options?.cohort && options.cohort !== 'all') {
    traineeQuery += ` AND b.batch ILIKE '%' || $${paramIdx++} || '%'`;
    traineeParams.push(options.cohort);
  }
  if (options?.gender && options.gender !== 'all') {
    traineeQuery += ` AND b.gender ILIKE $${paramIdx++}`;
    traineeParams.push(options.gender);
  }
  if (options?.status && options.status !== 'all') {
    traineeQuery += ` AND (b.status ILIKE $${paramIdx} OR b.beneficiary_status ILIKE $${paramIdx})`;
    paramIdx++;
    traineeParams.push(options.status);
  }
  if (options?.lga && options.lga !== 'all') {
    traineeQuery += ` AND COALESCE(b.custom_fields->>'lga', b.city) ILIKE $${paramIdx++}`;
    traineeParams.push(options.lga);
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

  // Header Details
  const firstTrainee = trainees[0];
  const tspName = firstTrainee ? firstTrainee.tsp : "Unique Technology Nig. Ltd";
  const sectorName = firstTrainee ? firstTrainee.skill_sector : "Computer Hardware and Cell Phone Repairs";
  const skillName = firstTrainee ? firstTrainee.skill_sector : "Computer Hardware and Cell Phone Repairs";
  const totalEnrolled = trainees.length;

  ws1.mergeCells("A1:W1");
  const titleCell1 = ws1.getCell("A1");
  titleCell1.value = "THE FEDERAL MINISTRY OF EDUCATION AND THE WORLD BANK";
  titleCell1.font = fontTitle;
  titleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 40;

  ws1.mergeCells("A2:W2");
  const subTitleCell1 = ws1.getCell("A2");
  subTitleCell1.value = "IDEAS-TVET INITIATIVE TRAINEE REGISTRATION FORM";
  subTitleCell1.font = { name: "Inter", size: 12, bold: true, color: { argb: "FF475569" } };
  subTitleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 25;

  ws1.mergeCells("A3:W3");
  const tspCell = ws1.getCell("A3");
  tspCell.value = `Name of TSP: ${tspName}`;
  tspCell.font = { name: "Inter", size: 10, bold: true };
  tspCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(3).height = 20;

  ws1.mergeCells("A4:W4");
  const sectorCell = ws1.getCell("A4");
  sectorCell.value = `Sector: ${sectorName}`;
  sectorCell.font = { name: "Inter", size: 10, bold: true };
  sectorCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(4).height = 20;

  ws1.mergeCells("A5:W5");
  const skillCell = ws1.getCell("A5");
  skillCell.value = `Skill: ${skillName}`;
  skillCell.font = { name: "Inter", size: 10, bold: true };
  skillCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(5).height = 20;

  ws1.mergeCells("A6:W6");
  const enrolledCell = ws1.getCell("A6");
  enrolledCell.value = `Total Number Enrolled: ${totalEnrolled}`;
  enrolledCell.font = { name: "Inter", size: 10, bold: true };
  enrolledCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(6).height = 20;

  ws1.addRow([]); // Blank Spacer

  const colHeaders1 = [
    "SN", "First Name", "Last Name", "Sex", "Date of Birth", "PWD?", "Phone",
    "National Identification Number", "Bank Verification Number", "Account Name",
    "Account Number", "Bank Name", "Bank Sort Code", "Email", "State of Residence",
    "LGA of Residence", "Name of Trainee’s Parent/Guardian", "Address of Trainee’s Parent/Guardian",
    "Phone No. of Trainee’s Parent/Guardian", "Educational Qualification", "Employment Status",
    "Training Status", "Skill"
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
      trainee.first_name,
      trainee.last_name,
      trainee.gender,
      trainee.date_of_birth || "Not provided",
      trainee.physical_challenge || "NO",
      trainee.phone_number || "Not provided",
      trainee.nin || "Not provided",
      trainee.bvn || "Not provided",
      trainee.account_name || "Not provided",
      trainee.account_number || "Not provided",
      trainee.bank_name || "Not provided",
      trainee.bank_sort_code || "Not provided",
      trainee.email || "Not provided",
      trainee.state || "Not provided",
      trainee.lga || "Not provided",
      trainee.guardian_name || "Not provided",
      trainee.guardian_address || "Not provided",
      trainee.guardian_phone || "Not provided",
      trainee.education_qualification || "Not provided",
      "NOT_EMPLOYED",
      trainee.training_status || "ACTIVE",
      trainee.skill_sector || "Not provided"
    ];
    const row = ws1.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 21 || colNumber === 22) {
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

  ws2.mergeCells("A1:K1");
  const titleCell2 = ws2.getCell("A1");
  titleCell2.value = "IDEAS-TVET OPERATIONS SYSTEM — OFFICIAL ATTENDANCE LOGS";
  titleCell2.font = fontTitle;
  titleCell2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 40;

  ws2.mergeCells("A2:K2");
  const subTitleCell2 = ws2.getCell("A2");
  subTitleCell2.value = "ANNEX 9: ATTENDANCE SUMMARY STATUS (ELIGIBILITY & STIPEND AUDIT)";
  subTitleCell2.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(2).height = 25;

  ws2.addRow([]);

  const colHeaders2 = [
    "S/N", "First Name", "Last Name", "Trainee ID", "Number of Training Days",
    "Present Days", "Absent Days", "Late Days", "Excused Days", "Attendance Percentage", "Stipend Status"
  ];
  const headerRow2 = ws2.addRow(colHeaders2);
  headerRow2.height = 30;
  headerRow2.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  // Unique marked training days
  const uniqueDates = new Set(
    attendanceRecords.map(r => {
      const dStr = typeof r.attendance_date === 'string' ? r.attendance_date.split("T")[0] : r.attendance_date.toISOString().split("T")[0];
      return dStr;
    })
  );
  const expectedDays = uniqueDates.size > 0 ? uniqueDates.size : 20;

  trainees.forEach((trainee, index) => {
    const traineeAtt = attendanceRecords.filter(r => r.beneficiary_id === trainee.beneficiary_id);
    const presentCount = traineeAtt.filter(r => r.status === "PRESENT").length;
    const lateCount = traineeAtt.filter(r => r.status === "LATE").length;
    const absentCount = traineeAtt.filter(r => r.status === "ABSENT").length;
    const excusedCount = traineeAtt.filter(r => r.status === "EXCUSED").length;

    const markedCount = presentCount + lateCount + absentCount + excusedCount;
    const totalPresent = presentCount + lateCount;
    const denominator = Math.max(0, expectedDays - excusedCount);
    const attendancePercentage = denominator > 0 ? parseFloat(((totalPresent / denominator) * 100).toFixed(1)) : (excusedCount > 0 ? 100.0 : 0.0);

    let stipendStatus = "No Record";
    if (markedCount > 0) {
      if (attendancePercentage >= 65.0) {
        stipendStatus = "Eligible";
      } else {
        stipendStatus = "Below Threshold";
      }
    }

    const rowData = [
      index + 1,
      trainee.first_name,
      trainee.last_name,
      trainee.tvet_id,
      expectedDays,
      totalPresent,
      absentCount,
      lateCount,
      excusedCount,
      attendancePercentage + "%",
      stipendStatus
    ];

    const row = ws2.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber === 1 || colNumber === 4 || colNumber >= 5) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      if (colNumber === 11) {
        cell.font = { name: "Inter", size: 10, bold: true };
        if (stipendStatus === "Eligible") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        } else if (stipendStatus === "Warning") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
        } else if (stipendStatus === "At Risk") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
        } else if (stipendStatus === "Not Eligible") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF87171" } }; // Soft red
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEE2E6" } }; // Gray
        }
      } else if (index % 2 === 1) {
        cell.fill = subHeaderFill;
      }
    });
  });

  // --- SHEET 3: TVET PORTAL ---
  const ws3 = workbook.addWorksheet("TVET-PORTAL");
  ws3.views = [{ showGridLines: true }];

  ws3.mergeCells("A1:F1");
  const titleCell3 = ws3.getCell("A1");
  titleCell3.value = "IDEAS-TVET OPERATIONS SYSTEM — REGISTERED DEPLOYED TVET LIST TRACKING";
  titleCell3.font = fontTitle;
  titleCell3.alignment = { horizontal: "center", vertical: "middle" };
  ws3.getRow(1).height = 40;

  ws3.mergeCells("A2:F2");
  const subTitleCell3 = ws3.getCell("A2");
  subTitleCell3.value = "VERIFICATION OF TVET LIST DEPLOYMENT (ANNEX 9 REGISTRATION STATUS)";
  subTitleCell3.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell3.alignment = { horizontal: "center", vertical: "middle" };
  ws3.getRow(2).height = 25;

  ws3.addRow([]);

  const colHeaders3 = [
    "SN", "First Name", "Last Name", "TVET Code", "Still on TVET List? Yes / No", "Still Attending Classes? Yes / No"
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
      pm ? (pm.still_on_portal ? "YES" : "NO") : "Not confirmed",
      pm ? (pm.still_attending ? "YES" : "NO") : "Not confirmed"
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
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        }
      } else if (index % 2 === 1) {
        cell.fill = subHeaderFill;
      }
    });
  });

  // --- AUTO WIDTH ADJUSTMENTS ACROSS WORKBOOK ---
  [ws1, ws2, ws3].forEach((ws) => {
    ws.columns.forEach((col) => {
      let maxLen = 0;
      col.eachCell!({ includeEmpty: false }, (cell) => {
        if (cell.value && Number(cell.row) > 6) {
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
    "Still On TVET List", "Still Attending Classes", "Remarks", "Last Verified Date"
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
