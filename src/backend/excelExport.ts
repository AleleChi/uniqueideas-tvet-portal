import ExcelJS from "exceljs";
import { getPgPool, executeQuery, isPgActive, loadJsonState, DbRepo } from "./db.js";
import { getAnnex9ReportData, normalizeAttendanceStatus } from "./annex9Report.service.js";

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
  rosterId?: string;
  useActiveRoster?: boolean;
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

  let rosterMemberIds: string[] | null = null;
  if (isPgActive) {
    if (options?.rosterId) {
      const members = await DbRepo.getRosterMembers(options.rosterId, { active_only: true });
      rosterMemberIds = members.slice(0, 100).map(m => m.beneficiary_id);
    } else if (options?.useActiveRoster && options.tspId && options.tspId !== "all") {
      const rosters = await DbRepo.getRosters({ tsp_id: options.tspId });
      const activeRoster = rosters.find(r => r.is_active !== false);
      if (activeRoster) {
        const members = await DbRepo.getRosterMembers(activeRoster.id, { active_only: true });
        rosterMemberIds = members.slice(0, 100).map(m => m.beneficiary_id);
      } else {
        rosterMemberIds = []; // empty roster, return none
      }
    }
  } else {
    const state = loadJsonState() as any;
    if (options?.rosterId) {
      const members = (state.reporting_roster_members || []).filter((m: any) => m.roster_id === options.rosterId && !m.removed_at);
      rosterMemberIds = members.slice(0, 100).map((m: any) => m.beneficiary_id);
    } else if (options?.useActiveRoster && options.tspId && options.tspId !== "all") {
      const rosters = (state.reporting_rosters || []).filter((r: any) => r.tsp_id === options.tspId);
      const activeRoster = rosters.find((r: any) => r.is_active !== false);
      if (activeRoster) {
        const members = (state.reporting_roster_members || []).filter((m: any) => m.roster_id === activeRoster.id && !m.removed_at);
        rosterMemberIds = members.slice(0, 100).map((m: any) => m.beneficiary_id);
      } else {
        rosterMemberIds = [];
      }
    }
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
    traineeQuery += ` AND (b.skill_sector ILIKE '%' || $${paramIdx} || '%' OR tp.skill ILIKE '%' || $${paramIdx} || '%')`;
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
  if (rosterMemberIds && isPgActive) {
    traineeQuery += ` AND b.id::text = ANY($${paramIdx++})`;
    traineeParams.push(rosterMemberIds);
  }
  traineeQuery += ` ORDER BY b.last_name ASC, b.first_name ASC`;

  const traineesRes = await executeQuery(traineeQuery, traineeParams);
  let trainees = traineesRes.rows;
  if (rosterMemberIds && !isPgActive) {
    trainees = trainees.filter(t => rosterMemberIds!.includes(t.beneficiary_id));
  }
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
 * Wraps generateOfficialAnnex9Workbook to ensure exactly the official two-sheet workbook is returned.
 */
export async function generateAnnex9Workbook(options?: Annex9ExportOptions): Promise<ExcelJS.Workbook> {
  return generateOfficialAnnex9Workbook(options);
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

/**
 * Generates the Official Government Annex 9 Workbook containing exactly two tabs:
 * "TRAINEE PROFILE" and "ATTENDANCE".
 * Reconciled perfectly with the canonical database and business rules.
 */
export async function generateOfficialAnnex9Workbook(options?: Annex9ExportOptions): Promise<ExcelJS.Workbook> {
  const targetMonth = options?.month || new Date().toISOString().substring(0, 7);
  const result = await getAnnex9ReportData({
    month: targetMonth,
    tspId: options?.tspId,
    state: options?.state,
    lga: options?.lga,
    skill: options?.skill,
    cohort: options?.cohort,
    gender: options?.gender,
    status: options?.status,
    rosterId: options?.rosterId,
    useActiveRoster: options?.useActiveRoster
  });

  const trainees = result.records;
  const expectedDays = result.expectedDays;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IDEAS-TVET Platform";
  workbook.lastModifiedBy = "Official Annex 9 Export Engine";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Styling helpers
  const primaryHeaderFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" } // Deep Slate
  };
  
  const subHeaderFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFAFAFA" } // Off-white
  };

  const borderThin: any = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } }
  };

  const fontHeader: any = {
    name: "Inter",
    size: 10,
    bold: true,
    color: { argb: "FFFFFFFF" }
  };

  const fontTitle: any = {
    name: "Inter",
    size: 14,
    bold: true,
    color: { argb: "FF1E293B" }
  };

  // --- SHEET 1: TRAINEE PROFILE ---
  const ws1 = workbook.addWorksheet("TRAINEE PROFILE");
  ws1.views = [{ showGridLines: true }];

  const firstTrainee = trainees[0];
  const tspName = firstTrainee ? firstTrainee.tsp_name : "Not provided";
  const sectorName = firstTrainee ? firstTrainee.skill_sector : "Not provided";
  const totalEnrolled = trainees.length;

  ws1.mergeCells("A1:W1");
  const titleCell1 = ws1.getCell("A1");
  titleCell1.value = "THE FEDERAL MINISTRY OF EDUCATION AND THE WORLD BANK";
  titleCell1.font = fontTitle;
  titleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 35;

  ws1.mergeCells("A2:W2");
  const subTitleCell1 = ws1.getCell("A2");
  subTitleCell1.value = "IDEAS-TVET INITIATIVE TRAINEE REGISTRATION FORM";
  subTitleCell1.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 25;

  ws1.mergeCells("A3:W3");
  const tspCell = ws1.getCell("A3");
  tspCell.value = `Name of TSP: ${tspName}`;
  tspCell.font = { name: "Inter", size: 9, bold: true };
  tspCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(3).height = 18;

  ws1.mergeCells("A4:W4");
  const sectorCell = ws1.getCell("A4");
  sectorCell.value = `Sector: ${sectorName}`;
  sectorCell.font = { name: "Inter", size: 9, bold: true };
  sectorCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(4).height = 18;

  ws1.mergeCells("A5:W5");
  const enrolledCell = ws1.getCell("A5");
  enrolledCell.value = `Total Number Enrolled: ${totalEnrolled}`;
  enrolledCell.font = { name: "Inter", size: 9, bold: true };
  enrolledCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(5).height = 18;

  ws1.addRow([]); // Blank Spacer

  const colHeaders1 = [
    "SN", "First Name", "Last Name", "Sex", "Date of Birth", "PWD?", "Phone",
    "National Identification Number", "Bank Verification Number", "Account Name",
    "Account Number", "Bank Name", "Bank Sort Code", "Email", "State of Residence",
    "L. G. of Residence", "Name of Trainee’s Parents/Guardian", "Address of Trainee’s Parents/Guardian",
    "Phone No. of Trainee’s Parent/Guardian", "Educational Qualification", "Employment Status",
    "Training Status", "Skill"
  ];
  const headerRow1 = ws1.addRow(colHeaders1);
  headerRow1.height = 25;
  headerRow1.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  const cleanField = (val: any, fallback: string = ""): string => {
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim();
    const lower = s.toLowerCase();
    if (lower === "none" || lower === "null" || lower === "undefined" || lower === "n/a" || lower === "") {
      return fallback;
    }
    return s;
  };

  trainees.forEach((trainee, index) => {
    const rowData = [
      index + 1,
      cleanField(trainee.first_name),
      cleanField(trainee.last_name),
      cleanField(trainee.gender),
      cleanField(trainee.date_of_birth),
      cleanField(trainee.physical_challenge),
      cleanField(trainee.phone_number),
      cleanField(trainee.nin),
      cleanField(trainee.bvn),
      cleanField(trainee.account_name),
      cleanField(trainee.account_number),
      cleanField(trainee.bank_name),
      cleanField(trainee.bank_sort_code),
      cleanField(trainee.email),
      cleanField(trainee.state),
      cleanField(trainee.lga),
      cleanField(trainee.guardian_name),
      cleanField(trainee.guardian_address),
      cleanField(trainee.guardian_phone),
      cleanField(trainee.education_qualification),
      cleanField(trainee.employment_status),
      cleanField(trainee.training_status),
      cleanField(trainee.skill_sector)
    ];
    const row = ws1.addRow(rowData);
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 9 };
      if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 21 || colNumber === 22) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
      if (index % 2 === 1) cell.fill = subHeaderFill;

      // Text format for numbers with leading zeroes
      if (colNumber === 8 || colNumber === 9 || colNumber === 11 || colNumber === 13) {
        cell.numFmt = "@";
      }

      // Add Data Validations / Dropdowns
      if (colNumber === 4) { // Sex (col 4, D)
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Male,Female"']
        };
      } else if (colNumber === 6) { // PWD? (col 6, F)
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Yes,No"']
        };
      } else if (colNumber === 20) { // Educational Qualification (col 20, T)
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Primary,Secondary,Tertiary"']
        };
      } else if (colNumber === 21) { // Employment Status (col 21, U)
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Employed,Self-employed,Unemployed"']
        };
      } else if (colNumber === 22) { // Training Status (col 22, V)
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"On-going,Completed,Droped out"']
        };
      }
    });
  });

  // --- SHEET 2: ATTENDANCE ---
  const ws2 = workbook.addWorksheet("ATTENDANCE");
  
  // Configure freeze panes: freeze the first 4 columns (A-D) and first 4 rows
  ws2.views = [{ state: "frozen", xSplit: 4, ySplit: 4, activeCell: "E5", showGridLines: true }];

  // Fetch the configured training days per week and raw attendance dates
  let tspTrainingDaysPerWeek = 3;
  let attendanceRows: any[] = [];
  let schedules: any[] = [];
  const pool = getPgPool();
  const tspId = options?.tspId;

  if (pool && isPgActive) {
    if (tspId && tspId !== "all") {
      try {
        const tspRes = await pool.query("SELECT training_days_per_week FROM tsps WHERE id = $1", [tspId]);
        if (tspRes.rows.length > 0 && tspRes.rows[0].training_days_per_week !== null) {
          tspTrainingDaysPerWeek = tspRes.rows[0].training_days_per_week;
        }
        const schedsRes = await pool.query(
          "SELECT start_date, end_date, days_per_week, selected_weekdays FROM training_schedules WHERE tsp_id = $1 AND active = TRUE",
          [tspId]
        );
        schedules = schedsRes.rows;
      } catch (err) {
        console.error("Error fetching training_days_per_week and schedules:", err);
      }
    } else {
      const firstTspId = trainees[0]?.tsp_id;
      if (firstTspId) {
        try {
          const tspRes = await pool.query("SELECT training_days_per_week FROM tsps WHERE id = $1", [firstTspId]);
          if (tspRes.rows.length > 0 && tspRes.rows[0].training_days_per_week !== null) {
            tspTrainingDaysPerWeek = tspRes.rows[0].training_days_per_week;
          }
          const schedsRes = await pool.query(
            "SELECT start_date, end_date, days_per_week, selected_weekdays FROM training_schedules WHERE tsp_id = $1 AND active = TRUE",
            [firstTspId]
          );
          schedules = schedsRes.rows;
        } catch (err) {
          console.error("Error fetching first TSP training_days_per_week and schedules:", err);
        }
      }
    }

    const traineeIds = trainees.map(t => t.id);
    if (traineeIds.length > 0) {
      try {
        const attResult = await pool.query(
          `SELECT beneficiary_id, status, TO_CHAR(attendance_date, 'YYYY-MM-DD') as attendance_date
           FROM trainee_attendance
           WHERE beneficiary_id = ANY($1)
             AND attendance_date >= '2026-06-15'::date
             AND attendance_date <= '2026-12-31'::date`,
          [traineeIds]
        );
        attendanceRows = attResult.rows;
      } catch (err) {
        console.error("Error fetching horizontal attendance:", err);
      }
    }
  } else {
    const state = loadJsonState();
    tspTrainingDaysPerWeek = 3; // Default for Unique Technology
    
    trainees.forEach((t: any) => {
      const bState = state.beneficiaries?.find((x: any) => x.id === t.id);
      if (bState && bState.attendanceLogs) {
        bState.attendanceLogs.forEach((log: any) => {
          if (log.date >= "2026-06-15" && log.date <= "2026-12-31") {
            attendanceRows.push({
              beneficiary_id: t.id,
              status: log.status,
              attendance_date: log.date
            });
          }
        });
      }
    });
  }

  // --- MAP ATTENDANCE TO WEEKS AND DAYS CHRONOLOGICALLY ---
  const baseDate = new Date("2026-06-15");
  const systemActiveDates = Array.from(new Set(attendanceRows.map(r => r.attendance_date)));
  
  // Group system-wide active training dates by week index (0 to 30)
  const weekDatesMap = new Map<number, string[]>();
  systemActiveDates.forEach(dateStr => {
    const curDate = new Date(dateStr);
    const diffDays = Math.floor((curDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 214) {
      const weekIdx = Math.floor(diffDays / 7);
      if (!weekDatesMap.has(weekIdx)) {
        weekDatesMap.set(weekIdx, []);
      }
      weekDatesMap.get(weekIdx)!.push(dateStr);
    }
  });

  // Sort dates within each week chronologically and build lookup map
  const dateToWeekAndDay = new Map<string, { weekNum: number, dayNum: number }>();
  const weekScheduledDates = new Map<number, string[]>();

  for (let w = 0; w < 31; w++) {
    const datesInWeek = weekDatesMap.get(w) || [];
    datesInWeek.sort(); // Sort chronologically
    
    // Cap at 5 days per week format
    const finalDates = datesInWeek.slice(0, 5);
    weekScheduledDates.set(w, finalDates);
    
    finalDates.forEach((dateStr, idx) => {
      dateToWeekAndDay.set(dateStr, {
        weekNum: w + 1,
        dayNum: idx + 1
      });
    });
  }

  // Helper to convert index to Excel column letter
  function getColLetter(colIdx: number): string {
    let temp = colIdx;
    let letter = "";
    while (temp > 0) {
      let modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  }

  const getWeekDateStr = (weekIdx: number, dayIdx: number): string => {
    const d = new Date("2026-06-15");
    d.setDate(d.getDate() + weekIdx * 7 + dayIdx);
    return d.toISOString().split("T")[0];
  };

  const isFiveDayWeek = (w: number): boolean => {
    const monStr = getWeekDateStr(w, 0);
    const friStr = getWeekDateStr(w, 4);
    if (schedules && schedules.length > 0) {
      const overlap = schedules.find((s: any) => {
        const sStart = new Date(s.start_date).toISOString().split("T")[0];
        const sEnd = new Date(s.end_date).toISOString().split("T")[0];
        const isFive = s.days_per_week === 5 || (s.selected_weekdays && s.selected_weekdays.length === 5);
        if (!isFive) return false;
        return sStart <= friStr && sEnd >= monStr;
      });
      if (overlap) return true;
    }
    return false;
  };

  const isTrainingDay = (w: number, d: number): boolean => {
    if (isFiveDayWeek(w)) return true;
    return [0, 2, 4].includes(d); // Mon, Wed, Fri
  };

  // Build a map of trainee -> date -> status
  const traineeAttendanceMap = new Map<string, Map<string, string>>();
  attendanceRows.forEach(row => {
    const bId = row.beneficiary_id;
    if (!traineeAttendanceMap.has(bId)) {
      traineeAttendanceMap.set(bId, new Map<string, string>());
    }
    traineeAttendanceMap.get(bId)!.set(row.attendance_date, row.status);
  });

  // --- ROW 1: NUMBER OF TRAINING DAYS IN A WEEK ---
  ws2.getRow(1).height = 25;
  ws2.mergeCells(1, 1, 1, 3); // Merge A1:C1
  const labelCell = ws2.getCell(1, 1);
  labelCell.value = "NUMBER OF TRAINING DAYS IN A WEEK";
  labelCell.font = { name: "Inter", size: 10, bold: true, color: { argb: "FF0F172A" } };
  labelCell.alignment = { horizontal: "right", vertical: "middle" };
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } }; // Soft yellow
  labelCell.border = borderThin;

  const valCell = ws2.getCell(1, 4); // Cell D1
  valCell.value = tspTrainingDaysPerWeek;
  valCell.font = { name: "Inter", size: 10, bold: true, color: { argb: "FF0F172A" } };
  valCell.alignment = { horizontal: "center", vertical: "middle" };
  valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } }; // Soft yellow
  valCell.border = borderThin;

  // --- ROW 2: MONTH HEADINGS (JUNE to DECEMBER) ---
  ws2.getRow(2).height = 25;
  // Initialize standard borders on cells in Row 2 columns A to D
  for (let c = 1; c <= 4; c++) {
    ws2.getCell(2, c).border = borderThin;
  }

  const monthDefinitions = [
    { name: "JUNE", startWeek: 1, endWeek: 4, isGreen: true },
    { name: "JULY", startWeek: 5, endWeek: 9, isGreen: false },
    { name: "AUGUST", startWeek: 10, endWeek: 13, isGreen: true },
    { name: "SEPTEMBER", startWeek: 14, endWeek: 18, isGreen: false },
    { name: "OCTOBER", startWeek: 19, endWeek: 22, isGreen: true },
    { name: "NOVEMBER", startWeek: 23, endWeek: 27, isGreen: false },
    { name: "DECEMBER", startWeek: 28, endWeek: 31, isGreen: true }
  ];

  monthDefinitions.forEach(m => {
    const colStart = 5 + (m.startWeek - 1) * 6;
    const colEnd = 5 + (m.endWeek - 1) * 6 + 5;
    
    ws2.mergeCells(2, colStart, 2, colEnd);
    const mCell = ws2.getCell(2, colStart);
    mCell.value = m.name;
    mCell.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF1E293B" } };
    mCell.alignment = { horizontal: "center", vertical: "middle" };
    
    // Exact month colors from template: June Green, July Blue, alternate for remainder
    const bgColor = m.isGreen ? "FFE2F0D9" : "FFDDEBF7";
    mCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    
    // Apply borders to all columns in this merged range
    for (let c = colStart; c <= colEnd; c++) {
      ws2.getCell(2, c).border = borderThin;
    }
  });

  // --- ROW 3: WEEK HEADINGS (WEEK 1 to WEEK 31) ---
  ws2.getRow(3).height = 20;
  for (let c = 1; c <= 4; c++) {
    ws2.getCell(3, c).border = borderThin;
  }

  for (let w = 1; w <= 31; w++) {
    const colStart = 5 + (w - 1) * 6;
    const colEnd = colStart + 5;
    
    ws2.mergeCells(3, colStart, 3, colEnd);
    const wCell = ws2.getCell(3, colStart);
    wCell.value = `WEEK ${w}`;
    wCell.font = { name: "Inter", size: 9, bold: true, color: { argb: "FF334155" } };
    wCell.alignment = { horizontal: "center", vertical: "middle" };
    wCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
    
    for (let c = colStart; c <= colEnd; c++) {
      ws2.getCell(3, c).border = borderThin;
    }
  }

  // --- ROW 4: COLUMN HEADINGS ---
  ws2.getRow(4).height = 25;
  const colHeaders2 = ["S/N", "FIRST NAME", "LAST NAME (SURNAME)", "TRAINEE I.D (Optional)"];
  colHeaders2.forEach((h, idx) => {
    const cell = ws2.getCell(4, idx + 1);
    cell.value = h;
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderThin;
  });

  for (let w = 1; w <= 31; w++) {
    const colStart = 5 + (w - 1) * 6;
    const subHeaders = ["DAY 1", "DAY 2", "DAY 3", "DAY 4", "DAY 5", "% RATE"];
    subHeaders.forEach((sh, idx) => {
      const cell = ws2.getCell(4, colStart + idx);
      cell.value = sh;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }; // Light slate gray
      cell.font = { name: "Inter", size: 9, bold: true, color: { argb: "FF0F172A" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = borderThin;
    });
  }

  // --- ROW 5+: TRAINEE ATTENDANCE DATA MATRIX ---
  trainees.forEach((trainee, idx) => {
    const rowNum = 5 + idx;
    const row = ws2.getRow(rowNum);
    row.height = 20;

    // A: S/N
    const cellSN = ws2.getCell(rowNum, 1);
    cellSN.value = idx + 1;
    cellSN.alignment = { horizontal: "center", vertical: "middle" };
    cellSN.border = borderThin;
    cellSN.font = { name: "Inter", size: 9 };

    // B: FIRST NAME
    const cellFN = ws2.getCell(rowNum, 2);
    cellFN.value = trainee.first_name || "";
    cellFN.alignment = { horizontal: "left", vertical: "middle" };
    cellFN.border = borderThin;
    cellFN.font = { name: "Inter", size: 9 };

    // C: LAST NAME (SURNAME)
    const cellLN = ws2.getCell(rowNum, 3);
    cellLN.value = trainee.last_name || "";
    cellLN.alignment = { horizontal: "left", vertical: "middle" };
    cellLN.border = borderThin;
    cellLN.font = { name: "Inter", size: 9 };

    // D: TRAINEE I.D
    const cellID = ws2.getCell(rowNum, 4);
    cellID.value = trainee.tvet_id || "";
    cellID.alignment = { horizontal: "center", vertical: "middle" };
    cellID.border = borderThin;
    cellID.font = { name: "Inter", size: 9 };

    const tMap = traineeAttendanceMap.get(trainee.id) || new Map<string, string>();

    // Populating weekly data blocks
    for (let w = 0; w < 31; w++) {
      const colStart = 5 + w * 6;

      // Day 1 to Day 5
      for (let d = 0; d < 5; d++) {
        const cell = ws2.getCell(rowNum, colStart + d);
        cell.border = borderThin;
        cell.font = { name: "Inter", size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };

        const dateStr = getWeekDateStr(w, d);
        if (isTrainingDay(w, d)) {
          const rawStatus = tMap.get(dateStr);
          if (rawStatus !== undefined) {
            const norm = normalizeAttendanceStatus(rawStatus);
            if (norm === "PRESENT" || norm === "LATE") {
              cell.value = true; // Excel Boolean TRUE
            } else {
              cell.value = false; // Excel Boolean FALSE
            }
          } else {
            cell.value = false; // Excel Boolean FALSE (No Record on scheduled training day)
          }
        } else {
          cell.value = false; // Excel Boolean FALSE (Non-scheduled weekday, e.g. Tuesday/Thursday)
        }
      }

      // % RATE Cell (using exact formula as defined in template)
      const cellRate = ws2.getCell(rowNum, colStart + 5);
      cellRate.border = borderThin;
      cellRate.font = { name: "Inter", size: 9, bold: true };
      cellRate.alignment = { horizontal: "center", vertical: "middle" };
      cellRate.numFmt = "0.00%";

      const day1Let = getColLetter(colStart);
      const day5Let = getColLetter(colStart + 4);
      
      if (isFiveDayWeek(w)) {
        cellRate.value = {
          formula: `IF(COUNTIF(${day1Let}${rowNum}:${day5Let}${rowNum}, TRUE) + COUNTIF(${day1Let}${rowNum}:${day5Let}${rowNum}, FALSE) > 0, COUNTIF(${day1Let}${rowNum}:${day5Let}${rowNum}, TRUE) / (COUNTIF(${day1Let}${rowNum}:${day5Let}${rowNum}, TRUE) + COUNTIF(${day1Let}${rowNum}:${day5Let}${rowNum}, FALSE)), "")`
        };
      } else {
        const day3Let = getColLetter(colStart + 2);
        cellRate.value = {
          formula: `IF((COUNTIF(${day1Let}${rowNum}, TRUE) + COUNTIF(${day1Let}${rowNum}, FALSE) + COUNTIF(${day3Let}${rowNum}, TRUE) + COUNTIF(${day3Let}${rowNum}, FALSE) + COUNTIF(${day5Let}${rowNum}, TRUE) + COUNTIF(${day5Let}${rowNum}, FALSE)) > 0, (COUNTIF(${day1Let}${rowNum}, TRUE) + COUNTIF(${day3Let}${rowNum}, TRUE) + COUNTIF(${day5Let}${rowNum}, TRUE)) / (COUNTIF(${day1Let}${rowNum}, TRUE) + COUNTIF(${day1Let}${rowNum}, FALSE) + COUNTIF(${day3Let}${rowNum}, TRUE) + COUNTIF(${day3Let}${rowNum}, FALSE) + COUNTIF(${day5Let}${rowNum}, TRUE) + COUNTIF(${day5Let}${rowNum}, FALSE)), "")`
        };
      }
    }
  });

  // --- SET EXPLICIT COLUMN WIDTHS FOR SHEET 2 ---
  ws2.getColumn(1).width = 6;   // S/N
  ws2.getColumn(2).width = 16;  // FIRST NAME
  ws2.getColumn(3).width = 20;  // LAST NAME
  ws2.getColumn(4).width = 16;  // TRAINEE ID
  for (let col = 5; col <= 190; col++) {
    if ((col - 5) % 6 === 5) {
      ws2.getColumn(col).width = 10; // % RATE
    } else {
      ws2.getColumn(col).width = 8;  // DAY 1 - 5
    }
  }

  // Auto column widths for SHEET 1 ONLY
  ws1.columns.forEach((col) => {
    let maxLen = 0;
    col.eachCell!({ includeEmpty: false }, (cell) => {
      if (cell.value && Number(cell.row) > 5) {
        const valStr = String(cell.value);
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
    });
    col.width = Math.min(Math.max(maxLen + 3, 10), 32);
  });

  return workbook;
}
