import { getPgPool, loadJsonState, isPgActive, DbRepo } from "./db";

interface CacheEntry {
  timestamp: number;
  result: Annex9ReportResult;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds cache TTL for scalable search indexing

export function normalizeSex(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "M" || s === "MALE") return "Male";
  if (s === "F" || s === "FEMALE") return "Female";
  return "";
}

export function normalizePwd(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "NONE" || s === "NONE (NO DISABILITY)" || s === "NO DISABILITY (NONE)" || s === "NO DISABILITY" || s === "NULL" || s === "UNDEFINED" || s === "N/A" || s === "") {
    return "";
  }
  if (s === "TRUE" || s === "1" || s === "YES") return "Yes";
  if (s === "FALSE" || s === "0" || s === "NO") return "No";
  return "Yes";
}

export function normalizeEducation(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "" || s === "NONE" || s === "NO FORMAL EDUCATION" || s === "NULL" || s === "UNDEFINED" || s === "N/A") {
    return "";
  }
  
  const tertiaryKeywords = ["BSC", "HND", "ND", "NCE", "UNIVERSITY", "POLYTECHNIC", "COLLEGE", "B.SC", "B.A", "BA", "PGD", "MASTERS", "B.TECH", "BTECH", "H.N.D", "B.CS", "B.ED", "BSC ED.", "BENG", "OND", "TERTIARY"];
  const secondaryKeywords = ["SSCE", "WAEC", "NECO", "SECONDARY", "SCCE"];
  const primaryKeywords = ["PRIMARY", "FLSC"];
  
  if (tertiaryKeywords.some(kw => s.includes(kw))) return "Tertiary";
  if (secondaryKeywords.some(kw => s.includes(kw))) return "Secondary";
  if (primaryKeywords.some(kw => s.includes(kw))) return "Primary";
  
  return ""; 
}

export function normalizeEmployment(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "EMPLOYED" || s === "EMPLOY") return "Employed";
  if (s === "SELF EMPLOYED" || s === "SELF_EMPLOYED" || s === "SELF-EMPLOYED" || s === "SELF") return "Self-employed";
  if (s === "UNEMPLOYED" || s === "UNEMPLOY") return "Unemployed";
  return "";
}

export function normalizeTrainingStatus(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "ONGOING" || s === "IN TRAINING" || s === "ON GOING" || s === "ON-GOING" || s === "ACTIVE" || s === "ACTIVE_TRAINING") return "On-going";
  if (s === "COMPLETED" || s === "COMPLETE" || s === "GRADUATED" || s === "CERTIFIED") return "Completed";
  if (s === "DROPOUT" || s === "DROPPED OUT" || s === "DROPPEDOUT" || s === "DROPED OUT") return "Droped out";
  return "";
}

export function clearAnnex9ReportCache(): void {
  queryCache.clear();
  console.log("[SEARCH INDEX] Query cache invalidated.");
}

export interface Annex9ReportOptions {
  month?: string; // YYYY-MM
  tspId?: string;
  state?: string;
  lga?: string;
  skill?: string;
  cohort?: string;
  gender?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  stipendStatus?: string;
  rosterId?: string;
  useActiveRoster?: boolean;
}

export interface Annex9Record {
  id: string; // Beneficiary ID
  tvet_id: string;
  first_name: string;
  last_name: string;
  other_name: string;
  gender: string;
  date_of_birth: string;
  physical_challenge: string;
  phone_number: string;
  nin: string;
  bvn: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_sort_code: string;
  email: string;
  state: string;
  lga: string;
  guardian_name: string;
  guardian_address: string;
  guardian_phone: string;
  education_qualification: string;
  employment_status: string;
  tsp_id: string;
  tsp_name: string;
  training_status: string;
  skill_sector: string;
  cohort: string;
  expected_days: number;
  present_days: number; // present + late + fieldwork
  absent_days: number; // expected_days - present_days - excused_days
  late_days: number;
  excused_days: number;
  attendance_percentage: number;
  stipend_status: string;
  still_on_portal: boolean;
  still_attending: boolean;
  last_verified_at?: string;
  verified_by?: string;
  remarks: string;
}

export interface Annex9MonthOption {
  value: string; // YYYY-MM
  label: string;
  count: number;
}

export interface Annex9ReportResult {
  records: Annex9Record[];
  expectedDays: number;
  month: string;
  total?: number;
}

/**
 * Normalizes an raw attendance status value to one of the canonical uppercase status values.
 */
export function normalizeAttendanceStatus(rawStatus: string): "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "HOLIDAY" {
  const s = String(rawStatus || "").trim().toUpperCase();
  if (s === "PRESENT" || s === "FIELDWORK") return "PRESENT";
  if (s === "LATE") return "LATE";
  if (s === "EXCUSED") return "EXCUSED";
  if (s === "HOLIDAY") return "HOLIDAY";
  return "ABSENT";
}

/**
 * Fetches the list of available months that have attendance records, and identifies the latest month.
 */
export async function getAvailableAttendanceMonths(): Promise<{ months: Annex9MonthOption[]; latestMonth: string }> {
  const pool = getPgPool();
  if (!pool || !isPgActive) {
    const state = loadJsonState();
    const monthsMap = new Map<string, number>();
    (state.beneficiaries || []).forEach(b => {
      (b.attendanceLogs || []).forEach((att: any) => {
        if (att.date) {
          const month = String(att.date).substring(0, 7); // YYYY-MM
          monthsMap.set(month, (monthsMap.get(month) || 0) + 1);
        }
      });
    });

    const months: Annex9MonthOption[] = Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, count]) => ({
        value: month,
        label: new Date(month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        count
      }));

    const currentYearMonth = new Date().toISOString().substring(0, 7);
    const latestMonth = months.length > 0 ? months[0].value : "2026-06"; // Default to June 2026 for training records

    return { months, latestMonth };
  }

  const query = `
    SELECT TO_CHAR(attendance_date, 'YYYY-MM') AS month, COUNT(*)::int AS count
    FROM trainee_attendance
    GROUP BY 1
    ORDER BY 1 DESC;
  `;
  const result = await pool.query(query);

  const months: Annex9MonthOption[] = result.rows.map(row => ({
    value: row.month,
    label: new Date(row.month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    count: row.count
  }));

  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const latestMonth = months.length > 0 ? months[0].value : currentYearMonth;

  return { months, latestMonth };
}

/**
 * Executes a unified, high-performance database query to fetch beneficiaries and their attendance metrics
 * with a standardized status and absent counting policy.
 */
export async function getAnnex9ReportData(options: Annex9ReportOptions): Promise<Annex9ReportResult> {
  const targetMonth = options.month || new Date().toISOString().substring(0, 7);
  const cacheKey = JSON.stringify({ ...options, targetMonth, isPgActive });
  const cached = queryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[SEARCH INDEX] Sub-millisecond cache hit for query: "${options.search || "none"}", page: ${options.page || 1}`);
    return cached.result;
  }

  const pool = getPgPool();
  const startOfMonth = `${targetMonth}-01`;

  // Roster-based filtering integration
  let rosterMemberIds: string[] | null = null;
  if (options.rosterId) {
    const members = await DbRepo.getRosterMembers(options.rosterId, { active_only: true });
    rosterMemberIds = members.slice(0, 100).map(m => m.beneficiary_id);
  } else if (options.useActiveRoster && options.tspId && options.tspId !== "all") {
    const members = await DbRepo.getActiveOfficialReportingRosterMembers(options.tspId);
    rosterMemberIds = members.slice(0, 100).map(m => m.id);
  }

  if (!pool || !isPgActive) {
    const state = loadJsonState();
    let traineesList = state.beneficiaries || [];

    // Filter by roster
    if (rosterMemberIds) {
      traineesList = traineesList.filter((b: any) => rosterMemberIds!.includes(b.id));
    }

    // Filter by active statuses
    const validStatuses = ['VERIFIED', 'ACCEPTED', 'ENROLLED', 'TRAINING', 'IN_TRAINING', 'PENDING_PHOTO', 'ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI', 'GRADUATED', 'COMPLETED', 'ONBOARDED'];
    traineesList = traineesList.filter((b: any) => {
      const status = (b.status || 'ACTIVE').toUpperCase();
      return validStatuses.includes(status);
    });

    // Apply scoping filters
    if (options.tspId && options.tspId !== "all") {
      traineesList = traineesList.filter((b: any) => b.tsp_id === options.tspId || b.tsp === options.tspId);
    }
    if (options.state && options.state !== "all") {
      traineesList = traineesList.filter((b: any) => String(b.state || "").toLowerCase() === options.state!.toLowerCase());
    }
    if (options.lga && options.lga !== "all") {
      traineesList = traineesList.filter((b: any) => {
        const lgaVal = b.customFields?.lga || b.city || "";
        return String(lgaVal).toLowerCase() === options.lga!.toLowerCase();
      });
    }
    if (options.skill && options.skill !== "all") {
      traineesList = traineesList.filter((b: any) => 
        String(b.skillSector || "").toLowerCase().includes(options.skill!.toLowerCase()) || 
        String(b.program || "").toLowerCase().includes(options.skill!.toLowerCase())
      );
    }
    if (options.cohort && options.cohort !== "all") {
      traineesList = traineesList.filter((b: any) => b.batch === options.cohort);
    }
    if (options.gender && options.gender !== "all") {
      traineesList = traineesList.filter((b: any) => String(b.gender || "").toLowerCase() === options.gender!.toLowerCase());
    }
    if (options.status && options.status !== "all") {
      traineesList = traineesList.filter((b: any) => String(b.status || "").toLowerCase() === options.status!.toLowerCase());
    }
    if (options.search) {
      const s = options.search.toLowerCase();
      traineesList = traineesList.filter((b: any) => 
        String(b.id || "").toLowerCase().includes(s) ||
        String(b.firstName || b.first_name || "").toLowerCase().includes(s) ||
        String(b.lastName || b.last_name || "").toLowerCase().includes(s) ||
        String(b.email || "").toLowerCase().includes(s) ||
        String(b.nin || "").toLowerCase().includes(s) ||
        String(b.bvn || "").toLowerCase().includes(s) ||
        String(b.phoneNumber || b.phone_number || "").toLowerCase().includes(s)
      );
    }

    // Determine expected days in target month by counting unique marked dates for ANY beneficiary in that month
    const uniqueDates = new Set<string>();
    traineesList.forEach((b: any) => {
      (b.attendanceLogs || []).forEach((att: any) => {
        if (att.date && String(att.date).startsWith(targetMonth)) {
          uniqueDates.add(String(att.date));
        }
      });
    });
    const expectedDays = Math.max(uniqueDates.size, 20); // Default to standard 20 days if no marked ones

    // Map to Annex9Record
    let records: Annex9Record[] = traineesList.map((b: any) => {
      const attLogs = (b.attendanceLogs || []).filter((att: any) => att.date && String(att.date).startsWith(targetMonth));
      
      let present = 0;
      let late = 0;
      let excused = 0;
      let holiday = 0;

      attLogs.forEach((att: any) => {
        const norm = normalizeAttendanceStatus(att.status);
        if (norm === "PRESENT") present++;
        else if (norm === "LATE") late++;
        else if (norm === "EXCUSED") excused++;
        else if (norm === "HOLIDAY") holiday++;
      });

      const totalPresent = present + late;
      const totalMarked = present + late + excused + holiday;
      const absent = Math.max(0, expectedDays - totalPresent - excused - holiday);
      const denominator = Math.max(0, expectedDays - excused - holiday);
      const attendance_percentage = denominator > 0 ? parseFloat(((totalPresent / denominator) * 100).toFixed(1)) : (excused > 0 ? 100.0 : 0.0);

      let stipend_status = "No Record";
      if (totalMarked > 0 || totalPresent > 0) {
        if (attendance_percentage >= 65.0) {
          stipend_status = "Eligible";
        } else {
          stipend_status = "Below Threshold";
        }
      }

      return {
        id: b.id,
        tvet_id: b.customFields?.tvet_id || b.id,
        first_name: b.firstName || b.first_name || "",
        last_name: b.lastName || b.last_name || "",
        other_name: b.otherName || b.other_name || "",
        gender: normalizeSex(b.gender),
        date_of_birth: b.dateOfBirth || b.date_of_birth || "",
        physical_challenge: normalizePwd(b.physicalChallenge || b.physical_challenge),
        phone_number: b.phoneNumber || b.phone_number || "",
        nin: b.nin || "",
        bvn: b.bvn || "",
        account_name: b.bankAccountHolder || b.bank_account_holder || "",
        account_number: b.bankAccountNumber || b.bank_account_number || "",
        bank_name: b.bankName || b.bank_name || "",
        bank_sort_code: b.bankSortCode || b.bank_sort_code || "",
        email: b.email || "",
        state: b.state || "",
        lga: b.customFields?.lga || b.city || "",
        guardian_name: b.guardianName || b.guardian_name || "",
        guardian_address: b.guardianAddress || b.guardian_address || "",
        guardian_phone: b.guardianPhone || b.guardian_phone || "",
        education_qualification: normalizeEducation(b.educationQualification || b.education_qualification),
        employment_status: normalizeEmployment(b.alumniEmploymentStatus || b.employment_status),
        tsp_id: b.tsp_id || "00000000-0000-0000-0000-000000000001",
        tsp_name: b.tsp || b.tsp_name || "Unique Technology Nig. Ltd",
        training_status: normalizeTrainingStatus(b.status || "ACTIVE"),
        skill_sector: b.skillSector || b.skill_sector || "Computer Hardware and Cell Phone Repairs",
        cohort: b.batch || "Batch 2026-C",
        expected_days: expectedDays,
        present_days: totalPresent,
        absent_days: absent,
        late_days: late,
        excused_days: excused,
        attendance_percentage,
        stipend_status,
        still_on_portal: b.still_on_portal !== undefined ? b.still_on_portal : true,
        still_attending: b.still_attending !== undefined ? b.still_attending : true,
        remarks: b.remarks || (totalMarked > 0 ? `Attendance rate ${attendance_percentage}%.` : "No Record")
      };
    });

    // Apply memory-level filtering and pagination if stipendStatus is specified
    if (options.stipendStatus && options.stipendStatus !== "all") {
      records = records.filter(r => r.stipend_status.toLowerCase() === options.stipendStatus?.toLowerCase());
    }

    const totalMatching = records.length;

    if (options.page && options.limit) {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const offset = (page - 1) * limit;
      records = records.slice(offset, offset + limit);
    }

    const resultVal = { records, expectedDays, month: targetMonth, total: totalMatching };
    queryCache.set(cacheKey, { timestamp: Date.now(), result: resultVal });
    return resultVal;
  }

  // 1. Determine expected days in target month by counting unique marked dates for ANY beneficiary in that month.
  let expDaysQuery = `
    SELECT COUNT(DISTINCT ta.attendance_date)::int as count 
    FROM trainee_attendance ta
    JOIN beneficiaries b ON ta.beneficiary_id = b.id
    WHERE ta.attendance_date >= $1::date 
      AND ta.attendance_date < ($1::date + INTERVAL '1 month')
      AND b.deleted_at IS NULL
  `;
  const expDaysParams: any[] = [startOfMonth];
  
  if (options.tspId && options.tspId !== "all") {
    expDaysQuery += ` AND b.tsp_id = $2`;
    expDaysParams.push(options.tspId);
  }
  
  const expectedDaysRes = await pool.query(expDaysQuery, expDaysParams);
  const expectedDays = Math.max(expectedDaysRes.rows[0]?.count || 0, 20); // Default to standard 20 days if no marked ones yet

  // 2. Fetch the active beneficiaries and join with their portal monitoring details and their attendance breakdown for that month.
  let queryStr = `
    SELECT 
      b.id,
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
      COALESCE(b.skill_sector, tp.skill, '') as skill_sector,
      COALESCE(b.tsp, '') as tsp_name,
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
      COALESCE(b.batch, '') as cohort,
      COALESCE(b.alumni_employment_status, '') as employment_status,
      CASE 
        WHEN tp.tvet_id IS NOT NULL AND tp.tvet_id != '' AND tp.tvet_id NOT LIKE '%IDEAS-' AND tp.tvet_id NOT LIKE 'ID-TVE-26-IDEAS-%' AND LENGTH(tp.tvet_id) > 8 THEN tp.tvet_id
        WHEN (b.custom_fields->>'tvet_id') IS NOT NULL AND (b.custom_fields->>'tvet_id') != '' AND (b.custom_fields->>'tvet_id') NOT LIKE '%IDEAS-' AND (b.custom_fields->>'tvet_id') NOT LIKE 'ID-TVE-26-IDEAS-%' AND LENGTH(b.custom_fields->>'tvet_id') > 8 THEN (b.custom_fields->>'tvet_id')
        WHEN b.id IS NOT NULL AND b.id != '' THEN b.id
        ELSE 'Pending TVET ID'
      END as tvet_id,
      COALESCE(pm.still_on_portal, TRUE) as still_on_portal,
      COALESCE(pm.still_attending, TRUE) as still_attending,
      pm.last_verified_at,
      pm.verified_by,
      pm.remarks as monitoring_remarks,
      COUNT(*) OVER() as total_count
    FROM beneficiaries b
    LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
    LEFT JOIN portal_monitoring pm ON b.id = pm.beneficiary_id
    WHERE b.deleted_at IS NULL AND b.status IN ('VERIFIED', 'ACCEPTED', 'ENROLLED', 'TRAINING', 'IN_TRAINING', 'PENDING_PHOTO', 'ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI', 'GRADUATED', 'COMPLETED', 'ONBOARDED')
  `;

  const params: any[] = [];
  let paramIdx = 1;

  if (rosterMemberIds) {
    queryStr += ` AND b.id = ANY($${paramIdx++})`;
    params.push(rosterMemberIds);
  }

  if (options.tspId && options.tspId !== "all") {
    queryStr += ` AND b.tsp_id = $${paramIdx++}`;
    params.push(options.tspId);
  }
  if (options.state && options.state !== "all") {
    queryStr += ` AND b.state ILIKE $${paramIdx++}`;
    params.push(options.state);
  }
  if (options.lga && options.lga !== "all") {
    queryStr += ` AND COALESCE(b.custom_fields->>'lga', b.city) ILIKE $${paramIdx++}`;
    params.push(options.lga);
  }
  if (options.skill && options.skill !== "all") {
    queryStr += ` AND (b.skill_sector ILIKE $${paramIdx} OR b.program ILIKE $${paramIdx})`;
    params.push(`%${options.skill}%`);
    paramIdx++;
  }
  if (options.cohort && options.cohort !== "all") {
    queryStr += ` AND b.batch ILIKE $${paramIdx++}`;
    params.push(options.cohort);
  }
  if (options.gender && options.gender !== "all") {
    queryStr += ` AND b.gender ILIKE $${paramIdx++}`;
    params.push(options.gender);
  }
  if (options.status && options.status !== "all") {
    queryStr += ` AND b.status ILIKE $${paramIdx++}`;
    params.push(options.status);
  }
  if (options.search) {
    const searchVal = `%${options.search}%`;
    queryStr += ` AND (
      b.id ILIKE $${paramIdx} OR 
      tp.tvet_id ILIKE $${paramIdx} OR 
      (b.custom_fields->>'tvet_id') ILIKE $${paramIdx} OR
      b.first_name ILIKE $${paramIdx} OR 
      b.last_name ILIKE $${paramIdx} OR 
      COALESCE(b.other_name, '') ILIKE $${paramIdx} OR 
      b.email ILIKE $${paramIdx} OR 
      b.nin ILIKE $${paramIdx} OR 
      b.bvn ILIKE $${paramIdx} OR 
      b.phone_number ILIKE $${paramIdx}
    )`;
    params.push(searchVal);
    paramIdx++;
  }

  queryStr += " ORDER BY b.last_name ASC, b.first_name ASC";

  const useDbPagination = options.page && options.limit && !options.stipendStatus;
  let totalMatching = 0;

  if (useDbPagination) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    queryStr += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);
  }

  const result = await pool.query(queryStr, params);

  if (result.rows.length > 0) {
    totalMatching = parseInt(result.rows[0].total_count || "0");
  }

  // 3. Fetch raw attendance logs for all these beneficiaries in this month, to normalize and map them accurately
  const traineeIds = result.rows.map(row => row.id);
  
  let attendanceMap = new Map<string, { present: number; late: number; excused: number; holiday: number }>();
  
  if (traineeIds.length > 0) {
    const attQuery = `
      SELECT beneficiary_id, status, attendance_date
      FROM trainee_attendance
      WHERE beneficiary_id = ANY($1)
        AND attendance_date >= $2::date
        AND attendance_date < ($2::date + INTERVAL '1 month')
    `;
    const attResult = await pool.query(attQuery, [traineeIds, startOfMonth]);
    
    attResult.rows.forEach(row => {
      const bId = row.beneficiary_id;
      const normalized = normalizeAttendanceStatus(row.status);
      
      if (!attendanceMap.has(bId)) {
        attendanceMap.set(bId, { present: 0, late: 0, excused: 0, holiday: 0 });
      }
      
      const stats = attendanceMap.get(bId)!;
      if (normalized === "PRESENT") stats.present++;
      else if (normalized === "LATE") stats.late++;
      else if (normalized === "EXCUSED") stats.excused++;
      else if (normalized === "HOLIDAY") stats.holiday++;
    });
  }

  // 4. Map the results, applying our strict attendance and missing-record calculation formula.
  let records: Annex9Record[] = result.rows.map(row => {
    const stats = attendanceMap.get(row.id) || { present: 0, late: 0, excused: 0, holiday: 0 };
    
    const present = stats.present;
    const late = stats.late;
    const excused = stats.excused;
    const holiday = stats.holiday;

    // PRESENT, LATE, FIELDWORK = Attended (totalPresent)
    const totalPresent = present + late;
    
    // Strict absent counting rule: absent_days = expected_days - totalPresent - excused_days
    const totalMarked = present + late + excused + holiday;
    const absent = Math.max(0, expectedDays - totalPresent - excused - holiday);

    // Stipend calculation denominator & rate
    const denominator = Math.max(0, expectedDays - excused - holiday);
    const attendance_percentage = denominator > 0 ? parseFloat(((totalPresent / denominator) * 100).toFixed(1)) : (excused > 0 ? 100.0 : 0.0);

    let stipend_status = "No Record";
    if (totalMarked > 0 || totalPresent > 0) {
      if (attendance_percentage >= 65.0) {
        stipend_status = "Eligible";
      } else {
        stipend_status = "Below Threshold";
      }
    }

    return {
      id: row.id,
      tvet_id: row.tvet_id,
      first_name: row.first_name,
      last_name: row.last_name,
      other_name: row.other_name,
      gender: normalizeSex(row.gender),
      date_of_birth: row.date_of_birth,
      physical_challenge: normalizePwd(row.physical_challenge),
      phone_number: row.phone_number,
      nin: row.nin,
      bvn: row.bvn,
      account_name: row.account_name,
      account_number: row.account_number,
      bank_name: row.bank_name,
      bank_sort_code: row.bank_sort_code,
      email: row.email,
      state: row.state,
      lga: row.lga,
      guardian_name: row.guardian_name,
      guardian_address: row.guardian_address,
      guardian_phone: row.guardian_phone,
      education_qualification: normalizeEducation(row.education_qualification),
      employment_status: normalizeEmployment(row.employment_status),
      tsp_id: row.tsp_id,
      tsp_name: row.tsp_name,
      training_status: normalizeTrainingStatus(row.training_status),
      skill_sector: row.skill_sector,
      cohort: row.cohort,
      expected_days: expectedDays,
      present_days: totalPresent,
      absent_days: absent,
      late_days: late,
      excused_days: excused,
      attendance_percentage,
      stipend_status,
      still_on_portal: row.still_on_portal,
      still_attending: row.still_attending,
      last_verified_at: row.last_verified_at,
      verified_by: row.verified_by,
      remarks: row.monitoring_remarks || (totalMarked > 0 ? `Attendance rate ${attendance_percentage}%.` : "No Record")
    };
  });

  // Apply memory-level filtering and pagination if stipendStatus is specified
  if (options.stipendStatus && options.stipendStatus !== "all") {
    records = records.filter(r => r.stipend_status.toLowerCase() === options.stipendStatus?.toLowerCase());
    totalMatching = records.length;

    if (options.page && options.limit) {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const offset = (page - 1) * limit;
      records = records.slice(offset, offset + limit);
    }
  } else if (!useDbPagination) {
    totalMatching = records.length;
  }

  const resultVal = { records, expectedDays, month: targetMonth, total: totalMatching };
  queryCache.set(cacheKey, { timestamp: Date.now(), result: resultVal });
  return resultVal;
}
