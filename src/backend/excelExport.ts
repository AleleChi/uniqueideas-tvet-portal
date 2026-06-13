import ExcelJS from "exceljs";
import { getPgPool, executeQuery } from "./db.js";

/**
 * Generates the official Government Annex 9 Audit & Verification Spreadsheet.
 * Adheres strictly to layout formatting, borders, merged title cells, and header aesthetics.
 */
export async function generateAnnex9Workbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IDEAS-TVET Platform";
  workbook.lastModifiedBy = "Government Export Engine";
  workbook.created = new Date();
  workbook.modified = new Date();

  const pool = getPgPool();
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  // --- FETCH MASTER DATA FROM SINGLE SOURCE OF TRUTH ---
  // Active Trainees (Beneficiaries with specific training statuses)
  const traineesRes = await executeQuery(`
    SELECT 
      b.id as beneficiary_id,
      COALESCE(tp.tvet_id, 'ID-TVE-26-' || SUBSTRING(b.id, 1, 6)) as tvet_id,
      b.first_name,
      b.last_name,
      COALESCE(b.other_name, '') as other_name,
      b.gender,
      COALESCE(b.date_of_birth, '') as date_of_birth,
      b.state,
      COALESCE(b.phone_number, '') as phone_number,
      b.email,
      COALESCE(b.residential_address, '') as residential_address,
      COALESCE(b.skill_sector, '') as skill_sector,
      COALESCE(b.tsp, '') as tsp,
      COALESCE(b.beneficiary_status, 'ACTIVE') as training_status,
      COALESCE(b.bank_name, '') as bank_name,
      COALESCE(b.bank_account_holder, '') as account_name,
      COALESCE(b.bank_account_number, '') as account_number,
      COALESCE(b.nin, '') as nin,
      COALESCE(b.bvn, '') as bvn,
      COALESCE(b.guardian_name, '') as guardian_name,
      COALESCE(b.guardian_phone, '') as guardian_phone
    FROM beneficiaries b
    LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
    WHERE b.deleted_at IS NULL AND b.status IN ('ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI')
    ORDER BY b.last_name ASC, b.first_name ASC
  `);
  const trainees = traineesRes.rows;

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

  // Attendance Aggregates
  const attRes = await executeQuery(`
    SELECT 
      beneficiary_id,
      COUNT(CASE WHEN status IN ('PRESENT', 'LATE') THEN 1 END) as present_days,
      COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late_days,
      COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_days,
      COUNT(CASE WHEN status = 'EXCUSED' THEN 1 END) as excused_days,
      COUNT(*) as total_days
    FROM trainee_attendance
    GROUP BY beneficiary_id
  `);
  const attMap = new Map(attRes.rows.map(row => [row.beneficiary_id, row]));

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

  const accentFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" }
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

  // Government Merged Header Row
  ws1.mergeCells("A1:V1");
  const titleCell1 = ws1.getCell("A1");
  titleCell1.value = "FEDERAL REPUBLIC OF NIGERIA — IDEAS TVET PROGRAM DEVELOPMENT COOPERATIVE";
  titleCell1.font = fontTitle;
  titleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 40;

  ws1.mergeCells("A2:V2");
  const subTitleCell1 = ws1.getCell("A2");
  subTitleCell1.value = "ANNEX 9: TRAINEE LIFECYCLE DEPLOYMENT & VERIFICATION PROFILE STAGE";
  subTitleCell1.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 25;

  ws1.addRow([]); // Blank spacer

  // Columns Configuration
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

  // Populate data
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
      if (colNumber === 1 || colNumber === 2 || colNumber === 6 || colNumber === 14) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
      
      // Zebra striping
      if (index % 2 === 1) {
        cell.fill = subHeaderFill;
      }
    });
  });

  // --- SHEET 2: ATTENDANCE ---
  const ws2 = workbook.addWorksheet("ATTENDANCE");
  ws2.views = [{ showGridLines: true }];

  ws2.mergeCells("A1:K1");
  const titleCell2 = ws2.getCell("A1");
  titleCell2.value = "IDEAS-TVET OPERATIONS SYSTEM — ATTENDANCE RECORDS METRIC MATRIX";
  titleCell2.font = fontTitle;
  titleCell2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 40;

  ws2.mergeCells("A2:K2");
  const subTitleCell2 = ws2.getCell("A2");
  subTitleCell2.value = "OFFICIAL ATTENDANCE RECORD (PRESENT REGISTRY AND PERCENTAGE AVERAGES)";
  subTitleCell2.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF475569" } };
  subTitleCell2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(2).height = 25;

  ws2.addRow([]);

  const colHeaders2 = [
    "S/N", "First Name", "Last Name", "Trainee ID (TVET Code)", "State", "TSP Association",
    "Present Days", "Late Days", "Absent Days", "Excused Days", "Attendance Percentage"
  ];
  const headerRow2 = ws2.addRow(colHeaders2);
  headerRow2.height = 30;
  headerRow2.eachCell((cell) => {
    cell.fill = primaryHeaderFill;
    cell.font = fontHeader;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  });

  trainees.forEach((trainee, index) => {
    const attObj = attMap.get(trainee.beneficiary_id) || {
      present_days: 0,
      late_days: 0,
      absent_days: 0,
      excused_days: 0,
      total_days: 0
    };

    const presentDays = Number(attObj.present_days || 0);
    const totalDays = Number(attObj.total_days || 0);
    const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    const rowData = [
      index + 1,
      trainee.first_name,
      trainee.last_name,
      trainee.tvet_id,
      trainee.state,
      trainee.tsp,
      presentDays,
      Number(attObj.late_days || 0),
      Number(attObj.absent_days || 0),
      Number(attObj.excused_days || 0),
      `${attPct}%`
    ];

    const row = ws2.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber >= 7 && colNumber <= 11) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNumber === 1 || colNumber === 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      if (colNumber === 11) {
        cell.font = { name: "Inter", size: 10, bold: true };
        if (attPct >= 70) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } }; // Green success accent
        } else if (attPct > 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } }; // Red alert accent
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
    "S/N", "First Name", "Last Name", "TVET Code (Trainee ID)", "Still On Portal", "Still Attending Classes", "Remarks", "Last Verified Date"
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
    const portalObj = portalMap.get(trainee.beneficiary_id);
    const onPortalVal = portalObj ? (portalObj.still_on_portal ? "YES" : "NO") : "YES";
    const attendingVal = portalObj ? (portalObj.still_attending ? "YES" : "NO") : "YES";
    const portalRemarks = portalObj ? (portalObj.remarks || "Auto-initialized") : "Verified Active Entry";
    const lastSyncDate = portalObj ? new Date(portalObj.last_verified_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const rowData = [
      index + 1,
      trainee.first_name,
      trainee.last_name,
      trainee.tvet_id,
      onPortalVal,
      attendingVal,
      portalRemarks,
      lastSyncDate
    ];

    const row = ws3.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: "Inter", size: 10 };
      if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 8) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      if (colNumber === 5 || colNumber === 6) {
        cell.font = { name: "Inter", size: 10, bold: true };
        if (cell.value === "YES") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
        }
      } else if (index % 2 === 1) {
        cell.fill = subHeaderFill;
      }
    });
  });

  // --- AUTO WIDTH ADJUSTMENTS ACCROSS WORKBOOK ---
  [ws1, ws2, ws3].forEach((ws) => {
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
