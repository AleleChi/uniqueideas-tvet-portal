import { getPgPool } from "./db";

export interface BankDirectoryEntry {
  id: string;
  canonical_bank_name: string;
  approved_sort_code: string;
  source_name: string;
  source_version: string;
}

export interface BankReconciliationAudit {
  id: string;
  operation_id: string;
  beneficiary_id: string;
  tvet_id: string;
  tsp_id: string;
  current_bank_name: string;
  matched_canonical_bank_id: string;
  old_sort_code: string;
  new_sort_code: string;
  source_document: string;
  source_version: string;
  match_method: string;
  changed_by: string;
  changed_at: string;
  reason: string;
}

/**
 * Initializes the database tables for the bank directory, bank aliases, and reconciliation audit logs.
 * Then seeds the tables if they are empty.
 */
export async function initBankDirectoryTable(pool: any): Promise<void> {
  console.log("[BANK_RECONCILIATION] Checking and initializing database tables...");

  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS bank_directory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      canonical_bank_name VARCHAR(255) NOT NULL UNIQUE,
      approved_sort_code VARCHAR(50) NOT NULL UNIQUE,
      source_name VARCHAR(100) DEFAULT 'BANK_DIRECTORY_MAPPING',
      source_version VARCHAR(50) DEFAULT '2026-07-21',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_aliases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alias VARCHAR(255) NOT NULL UNIQUE,
      bank_directory_id UUID REFERENCES bank_directory(id) ON DELETE CASCADE,
      source VARCHAR(100) DEFAULT 'INITIAL_SEED',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_reconciliation_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_id UUID NOT NULL,
      beneficiary_id VARCHAR(255) REFERENCES beneficiaries(id) ON DELETE CASCADE,
      tvet_id VARCHAR(100),
      tsp_id UUID,
      current_bank_name VARCHAR(255),
      matched_canonical_bank_id UUID REFERENCES bank_directory(id) ON DELETE SET NULL,
      old_sort_code VARCHAR(50),
      new_sort_code VARCHAR(50),
      source_document VARCHAR(100) DEFAULT 'BANK_DIRECTORY_MAPPING',
      source_version VARCHAR(50) DEFAULT '2026-07-21',
      match_method VARCHAR(50), -- 'CANONICAL', 'ALIAS', 'MANUAL'
      changed_by VARCHAR(255) NOT NULL,
      changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_op ON bank_reconciliation_audit(operation_id);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_ben ON bank_reconciliation_audit(beneficiary_id);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_tsp ON bank_reconciliation_audit(tsp_id);
  `;

  await pool.query(createTablesQuery);

  // Check if bank_directory needs seeding
  const checkCount = await pool.query("SELECT COUNT(*)::int as count FROM bank_directory");
  if (checkCount.rows[0].count === 0) {
    console.log("[BANK_RECONCILIATION] Seeding canonical approved banks...");
    
    const canonicalBanks = [
      { name: "Access Bank", sortCode: "044150149" },
      { name: "Zenith Bank", sortCode: "057150143" },
      { name: "Guaranty Trust Bank", sortCode: "058150125" },
      { name: "United Bank for Africa", sortCode: "033150111" },
      { name: "First Bank of Nigeria", sortCode: "011150148" },
      { name: "Fidelity Bank", sortCode: "070150003" },
      { name: "Union Bank of Nigeria", sortCode: "032150007" },
      { name: "Stanbic IBTC Bank", sortCode: "039150002" },
      { name: "Sterling Bank", sortCode: "232150008" },
      { name: "Wema Bank", sortCode: "035150103" },
      { name: "Ecobank Nigeria", sortCode: "050150010" },
      { name: "Keystone Bank", sortCode: "082150017" },
      { name: "Polaris Bank", sortCode: "076150001" },
      { name: "First City Monument Bank", sortCode: "214150018" },
      { name: "Providus Bank", sortCode: "101150001" },
      { name: "Jaiz Bank", sortCode: "301150001" },
      { name: "Taj Bank", sortCode: "302150001" },
      { name: "Globus Bank", sortCode: "103150001" },
      { name: "SunTrust Bank", sortCode: "100150001" },
      { name: "Signature Bank", sortCode: "107150001" }
    ];

    for (const bank of canonicalBanks) {
      await pool.query(`
        INSERT INTO bank_directory (canonical_bank_name, approved_sort_code)
        VALUES ($1, $2)
        ON CONFLICT (canonical_bank_name) DO NOTHING
      `, [bank.name, bank.sortCode]);
    }

    // Seed standard bank aliases
    console.log("[BANK_RECONCILIATION] Seeding standard bank aliases...");
    const aliases = [
      { canonical: "Guaranty Trust Bank", alias: "GTB" },
      { canonical: "Guaranty Trust Bank", alias: "GTBank" },
      { canonical: "Guaranty Trust Bank", alias: "Guaranty Trust Bank PLC" },
      { canonical: "Guaranty Trust Bank", alias: "Guaranty Trust Bank Plc" },
      
      { canonical: "United Bank for Africa", alias: "UBA" },
      { canonical: "United Bank for Africa", alias: "United Bank For Africa Plc" },
      { canonical: "United Bank for Africa", alias: "United Bank of Africa" },
      { canonical: "United Bank for Africa", alias: "United Bank For Africa" },

      { canonical: "First Bank of Nigeria", alias: "First Bank" },
      { canonical: "First Bank of Nigeria", alias: "FBN" },
      { canonical: "First Bank of Nigeria", alias: "First Bank of Nigeria Plc" },
      { canonical: "First Bank of Nigeria", alias: "First Bank of Nigeria PLC" },

      { canonical: "First City Monument Bank", alias: "FCMB" },
      { canonical: "First City Monument Bank", alias: "First City Monument Bank Plc" },
      { canonical: "First City Monument Bank", alias: "First City Monument Bank PLC" },

      { canonical: "Stanbic IBTC Bank", alias: "Stanbic" },
      { canonical: "Stanbic IBTC Bank", alias: "Stanbic IBTC" },
      { canonical: "Stanbic IBTC Bank", alias: "Stanbic IBTC Bank Plc" },

      { canonical: "Ecobank Nigeria", alias: "Ecobank" },
      { canonical: "Ecobank Nigeria", alias: "Eco Bank" },
      { canonical: "Ecobank Nigeria", alias: "Ecobank Plc" },

      { canonical: "Union Bank of Nigeria", alias: "Union Bank" },
      { canonical: "Union Bank of Nigeria", alias: "UBN" },
      { canonical: "Union Bank of Nigeria", alias: "Union Bank of Nigeria Plc" },

      { canonical: "Zenith Bank", alias: "Zenith Bank Plc" },
      { canonical: "Zenith Bank", alias: "Zenith" },
      { canonical: "Zenith Bank", alias: "Zenith Bank PLC" },

      { canonical: "Access Bank", alias: "Access Bank Plc" },
      { canonical: "Access Bank", alias: "Access" },
      { canonical: "Access Bank", alias: "Access Bank PLC" }
    ];

    for (const entry of aliases) {
      const bankIdResult = await pool.query(
        "SELECT id FROM bank_directory WHERE canonical_bank_name = $1",
        [entry.canonical]
      );
      if (bankIdResult.rows.length > 0) {
        const bankId = bankIdResult.rows[0].id;
        await pool.query(`
          INSERT INTO bank_aliases (alias, bank_directory_id)
          VALUES ($1, $2)
          ON CONFLICT (alias) DO NOTHING
        `, [entry.alias, bankId]);
      }
    }
  }

  console.log("[BANK_RECONCILIATION] Database check and initialization completed successfully.");
}

/**
 * Normalizes a bank name to find matches regardless of casing or extra spacing.
 */
export function normalizeBankName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // strip punctuation and spaces
}

export const CANONICAL_BANKS = [
  { name: "Access Bank", sortCode: "044150149" },
  { name: "Zenith Bank", sortCode: "057150143" },
  { name: "Guaranty Trust Bank", sortCode: "058150125" },
  { name: "United Bank for Africa", sortCode: "033150111" },
  { name: "First Bank of Nigeria", sortCode: "011150148" },
  { name: "Fidelity Bank", sortCode: "070150003" },
  { name: "Union Bank of Nigeria", sortCode: "032150007" },
  { name: "Stanbic IBTC Bank", sortCode: "039150002" },
  { name: "Sterling Bank", sortCode: "232150008" },
  { name: "Wema Bank", sortCode: "035150103" },
  { name: "Ecobank Nigeria", sortCode: "050150010" },
  { name: "Keystone Bank", sortCode: "082150017" },
  { name: "Polaris Bank", sortCode: "076150001" },
  { name: "First City Monument Bank", sortCode: "214150018" },
  { name: "Providus Bank", sortCode: "101150001" },
  { name: "Jaiz Bank", sortCode: "301150001" },
  { name: "Taj Bank", sortCode: "302150001" },
  { name: "Globus Bank", sortCode: "103150001" },
  { name: "SunTrust Bank", sortCode: "100150001" },
  { name: "Signature Bank", sortCode: "107150001" }
];

export const STANDARD_ALIASES = [
  { canonical: "Guaranty Trust Bank", alias: "GTB" },
  { canonical: "Guaranty Trust Bank", alias: "GTBank" },
  { canonical: "Guaranty Trust Bank", alias: "Guaranty Trust Bank PLC" },
  { canonical: "Guaranty Trust Bank", alias: "Guaranty Trust Bank Plc" },
  { canonical: "United Bank for Africa", alias: "UBA" },
  { canonical: "United Bank for Africa", alias: "UBA PLC" },
  { canonical: "United Bank for Africa", alias: "UBA Plc" },
  { canonical: "United Bank for Africa", alias: "United Bank For Africa Plc" },
  { canonical: "United Bank for Africa", alias: "United Bank For Africa PLC" },
  { canonical: "United Bank for Africa", alias: "United Bank Of Africa" },
  { canonical: "United Bank for Africa", alias: "United Bank of Africa" },
  { canonical: "United Bank for Africa", alias: "United Bank of Africa Plc" },
  { canonical: "United Bank for Africa", alias: "United Bank of Africa PLC" },
  { canonical: "United Bank for Africa", alias: "United Bank For Africa" },
  { canonical: "First Bank of Nigeria", alias: "First Bank" },
  { canonical: "First Bank of Nigeria", alias: "FBN" },
  { canonical: "First Bank of Nigeria", alias: "First Bank of Nigeria Plc" },
  { canonical: "First Bank of Nigeria", alias: "First Bank of Nigeria PLC" },
  { canonical: "First City Monument Bank", alias: "FCMB" },
  { canonical: "First City Monument Bank", alias: "First City Monument Bank Plc" },
  { canonical: "First City Monument Bank", alias: "First City Monument Bank PLC" },
  { canonical: "Stanbic IBTC Bank", alias: "Stanbic" },
  { canonical: "Stanbic IBTC Bank", alias: "Stanbic IBTC" },
  { canonical: "Stanbic IBTC Bank", alias: "Stanbic IBTC Bank Plc" },
  { canonical: "Ecobank Nigeria", alias: "Ecobank" },
  { canonical: "Ecobank Nigeria", alias: "Eco Bank" },
  { canonical: "Ecobank Nigeria", alias: "Ecobank Plc" },
  { canonical: "Union Bank of Nigeria", alias: "Union Bank" },
  { canonical: "Union Bank of Nigeria", alias: "UBN" },
  { canonical: "Union Bank of Nigeria", alias: "Union Bank of Nigeria Plc" },
  { canonical: "Zenith Bank", alias: "Zenith Bank Plc" },
  { canonical: "Zenith Bank", alias: "Zenith" },
  { canonical: "Zenith Bank", alias: "Zenith Bank PLC" },
  { canonical: "Access Bank", alias: "Access Bank Plc" },
  { canonical: "Access Bank", alias: "Access" },
  { canonical: "Access Bank", alias: "Access Bank PLC" }
];

export interface BankMatchResult {
  canonicalBankId: string | null;
  canonicalBankName: string;
  savedBankName: string;
  savedSortCode: string;
  approvedSortCode: string;
  normalizedSavedSortCode: string;
  matchType: "CANONICAL" | "ALIAS" | "FUZZY" | "NONE";
  status: "MATCHED" | "MISMATCH" | "MISSING" | "REVIEW_REQUIRED" | "BANK_NOT_FOUND" | "INVALID_FORMAT";
  reason: string;
  canAutofill: boolean;
}

export const APPROVED_MAPPINGS: Record<string, { name: string; code: string }> = {
  "accessbank": { name: "ACCESS BANK PLC", code: "044150149" },
  "access": { name: "ACCESS BANK PLC", code: "044150149" },
  "accessbankplc": { name: "ACCESS BANK PLC", code: "044150149" },

  "ecobanknigeria": { name: "ECOBANK NIGERIA", code: "050150010" },
  "ecobank": { name: "ECOBANK NIGERIA", code: "050150010" },
  "ecobankplc": { name: "ECOBANK NIGERIA", code: "050150010" },
  "ecobanknigplc": { name: "ECOBANK NIGERIA", code: "050150010" },

  "fidelitybank": { name: "FIDELITY BANK PLC", code: "070150003" },
  "fidelitybankplc": { name: "FIDELITY BANK PLC", code: "070150003" },

  "firstbankofnigeria": { name: "FIRST BANK OF NIGERIA PLC", code: "011150148" },
  "firstbank": { name: "FIRST BANK OF NIGERIA PLC", code: "011150148" },
  "fbn": { name: "FIRST BANK OF NIGERIA PLC", code: "011150148" },
  "firstbankofnigeriaplc": { name: "FIRST BANK OF NIGERIA PLC", code: "011150148" },

  "firstcitymonumentbank": { name: "FIRST CITY MONUMENT BANK PLC", code: "214150018" },
  "fcmb": { name: "FIRST CITY MONUMENT BANK PLC", code: "214150018" },
  "firstcitymonumentbankplc": { name: "FIRST CITY MONUMENT BANK PLC", code: "214150018" },

  "guarantytrustbank": { name: "GUARANTY TRUST BANK PLC", code: "058150125" },
  "gtbank": { name: "GUARANTY TRUST BANK PLC", code: "058150125" },
  "gtb": { name: "GUARANTY TRUST BANK PLC", code: "058150125" },
  "guarantytrustbankplc": { name: "GUARANTY TRUST BANK PLC", code: "058150125" },

  "stanbicibtcbank": { name: "STANBIC IBTC BANK PLC", code: "039150002" },
  "stanbicibtc": { name: "STANBIC IBTC BANK PLC", code: "039150002" },
  "stanbic": { name: "STANBIC IBTC BANK PLC", code: "039150002" },
  "stanbicibtcbankplc": { name: "STANBIC IBTC BANK PLC", code: "039150002" },

  "standardcharteredbank": { name: "STANDARD CHARTERED BANK PLC", code: "068150015" },
  "standardchartered": { name: "STANDARD CHARTERED BANK PLC", code: "068150015" },

  "sterlingbank": { name: "STERLING BANK PLC", code: "232150008" },
  "sterling": { name: "STERLING BANK PLC", code: "232150008" },
  "sterlingbankplc": { name: "STERLING BANK PLC", code: "232150008" },

  "unitedbankforafrica": { name: "UNITED BANK FOR AFRICA PLC", code: "033150111" },
  "uba": { name: "UNITED BANK FOR AFRICA PLC", code: "033150111" },
  "ubaplc": { name: "UNITED BANK FOR AFRICA PLC", code: "033150111" },
  "unitedbankofafrica": { name: "UNITED BANK FOR AFRICA PLC", code: "033150111" },
  "unitedbankofafricaplc": { name: "UNITED BANK FOR AFRICA PLC", code: "033150111" },
  "unitedbankforafricaplc": { name: "UNITED BANK FOR AFRICA PLC", code: "033150111" },

  "unionbankofnigeria": { name: "UNION BANK OF NIG. PLC", code: "032150007" },
  "unionbank": { name: "UNION BANK OF NIG. PLC", code: "032150007" },
  "ubn": { name: "UNION BANK OF NIG. PLC", code: "032150007" },
  "unionbankofnigeriaplc": { name: "UNION BANK OF NIG. PLC", code: "032150007" },
  "unionbankofnigplc": { name: "UNION BANK OF NIG. PLC", code: "032150007" },

  "unitybank": { name: "UNITY BANK PLC", code: "215150115" },
  "unity": { name: "UNITY BANK PLC", code: "215150115" },
  "unitybankplc": { name: "UNITY BANK PLC", code: "215150115" },

  "wemabank": { name: "WEMA BANK PLC", code: "035150103" },
  "wema": { name: "WEMA BANK PLC", code: "035150103" },
  "wemabankplc": { name: "WEMA BANK PLC", code: "035150103" },

  "zenithbank": { name: "ZENITH BANK PLC", code: "057150143" },
  "zenith": { name: "ZENITH BANK PLC", code: "057150143" },
  "zenithbankplc": { name: "ZENITH BANK PLC", code: "057150143" }
};

export function normalizeSortCode(value: any): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  
  if (/\D/.test(trimmed)) {
    return "INVALID_FORMAT";
  }
  
  if (trimmed.length === 9) {
    return trimmed;
  }
  
  if (trimmed.length >= 1 && trimmed.length <= 3) {
    return trimmed.padStart(3, "0");
  }
  
  return "INVALID_FORMAT";
}

/**
 * Single authoritative bank matching and sort code validation logic.
 */
export function resolveOfficialBankMatch(
  bankName: string,
  savedSortCode: string,
  dbBanks?: any[],
  dbAliases?: any[]
): BankMatchResult {
  const rawBankName = String(bankName || "").trim();
  const rawSavedSort = String(savedSortCode || "").trim();

  // Normalize bank name
  const cleanBankName = normalizeBankName(rawBankName);

  // 1. Resolve canonical bank name and approved sort code
  let resolvedBankName = "N/A";
  let approvedSortCode = "N/A";
  let matchType: "CANONICAL" | "ALIAS" | "FUZZY" | "NONE" = "NONE";

  if (cleanBankName) {
    const foundMapping = APPROVED_MAPPINGS[cleanBankName];
    if (foundMapping) {
      resolvedBankName = foundMapping.name;
      approvedSortCode = foundMapping.code;
      matchType = "ALIAS";
    } else {
      // Fallback check in CANONICAL_BANKS
      for (const b of CANONICAL_BANKS) {
        const canonName = b.name;
        const normCanon = normalizeBankName(canonName);
        if (cleanBankName.includes(normCanon) || normCanon.includes(cleanBankName)) {
          // Map to standard names we expect
          let mappedName = canonName;
          if (canonName === "Fidelity Bank") mappedName = "FIDELITY BANK PLC";
          else if (canonName === "Union Bank of Nigeria") mappedName = "UNION BANK OF NIG. PLC";
          else if (canonName === "United Bank for Africa") mappedName = "UNITED BANK FOR AFRICA PLC";
          else if (canonName === "First Bank of Nigeria") mappedName = "FIRST BANK OF NIGERIA PLC";
          else if (canonName === "First City Monument Bank") mappedName = "FIRST CITY MONUMENT BANK PLC";
          else if (canonName === "Guaranty Trust Bank") mappedName = "GUARANTY TRUST BANK PLC";
          else if (canonName === "Stanbic IBTC Bank") mappedName = "STANBIC IBTC BANK PLC";
          else if (canonName === "Sterling Bank") mappedName = "STERLING BANK PLC";
          else if (canonName === "Wema Bank") mappedName = "WEMA BANK PLC";
          else if (canonName === "Zenith Bank") mappedName = "ZENITH BANK PLC";
          else if (canonName === "Ecobank Nigeria") mappedName = "ECOBANK NIGERIA";
          else if (canonName === "Access Bank") mappedName = "ACCESS BANK PLC";

          resolvedBankName = mappedName;
          approvedSortCode = b.sortCode;
          matchType = "FUZZY";
          break;
        }
      }
    }
  }

  // 2. Normalize saved sort code
  const normalizedSavedSortCode = normalizeSortCode(rawSavedSort);

  // 3. Determine status, reason, canAutofill
  let status: BankMatchResult["status"];
  let reason = "";
  let canAutofill = false;

  if (!cleanBankName || rawBankName.toLowerCase() === "n/a") {
    status = "BANK_NOT_FOUND";
    reason = "Trainee bank name is empty or not provided.";
  } else if (resolvedBankName === "N/A") {
    status = "REVIEW_REQUIRED";
    reason = `The saved Bank Name '${rawBankName}' could not be matched safely to the approved official bank directory. Manual review required.`;
  } else if (!rawSavedSort) {
    status = "MISSING";
    reason = "Bank sort code is missing.";
    canAutofill = approvedSortCode !== "N/A";
  } else if (normalizedSavedSortCode === "INVALID_FORMAT" || !normalizedSavedSortCode) {
    status = "INVALID_FORMAT";
    reason = "Sort code format is invalid (must be a 3-digit number).";
    canAutofill = approvedSortCode !== "N/A";
  } else {
    const isMatched = normalizedSavedSortCode === approvedSortCode ||
                    (normalizedSavedSortCode.length === 9 && approvedSortCode.length === 3 && normalizedSavedSortCode.startsWith(approvedSortCode)) ||
                    (normalizedSavedSortCode.length === 3 && approvedSortCode.length === 9 && approvedSortCode.startsWith(normalizedSavedSortCode)) ||
                    (normalizedSavedSortCode.length === 9 && approvedSortCode.length === 9 && normalizedSavedSortCode.substring(0, 3) === approvedSortCode.substring(0, 3));
    if (isMatched) {
      status = "MATCHED";
      reason = "SAVED_CODE_EQUALS_APPROVED_CODE";
      canAutofill = false;
    } else {
      status = "MISMATCH";
      reason = `Sort code does not match official bank sort code '${approvedSortCode}'.`;
      canAutofill = approvedSortCode !== "N/A";
    }
  }

  return {
    canonicalBankId: resolvedBankName !== "N/A" ? resolvedBankName : null,
    canonicalBankName: resolvedBankName,
    savedBankName: rawBankName,
    savedSortCode: rawSavedSort,
    approvedSortCode,
    normalizedSavedSortCode: normalizedSavedSortCode || rawSavedSort,
    matchType,
    status,
    reason,
    canAutofill
  };
}

/**
 * Matches a raw bank name against the canonical database directory or known aliases.
 */
export async function matchBankName(rawName: string, pool: any): Promise<{
  id: string;
  canonical_bank_name: string;
  approved_sort_code: string;
  match_method: "CANONICAL" | "ALIAS" | "FUZZY" | "NONE";
} | null> {
  // Fetch from database
  let dbBanks: any[] = [];
  let dbAliases: any[] = [];
  try {
    const allBanks = await pool.query("SELECT id, canonical_bank_name, approved_sort_code FROM bank_directory WHERE is_active = TRUE");
    dbBanks = allBanks.rows;
    const allAliases = await pool.query(`
      SELECT ba.alias, bd.id, bd.canonical_bank_name, bd.approved_sort_code 
      FROM bank_aliases ba
      JOIN bank_directory bd ON ba.bank_directory_id = bd.id
      WHERE ba.is_active = TRUE AND bd.is_active = TRUE
    `);
    dbAliases = allAliases.rows;
  } catch (err) {
    // fallback to static
  }

  const match = resolveOfficialBankMatch(rawName, "000", dbBanks, dbAliases); // dummy sort code to find the bank
  if (match.status !== "BANK_NOT_FOUND" && match.canonicalBankName !== "N/A") {
    return {
      id: match.canonicalBankId || "",
      canonical_bank_name: match.canonicalBankName,
      approved_sort_code: match.approvedSortCode,
      match_method: match.matchType === "NONE" ? "NONE" : match.matchType
    };
  }
  return null;
}

export interface ReconciliationPreviewItem {
  beneficiary_id: string;
  first_name: string;
  last_name: string;
  tvet_id: string;
  current_bank_name: string;
  matched_canonical_bank_name: string;
  matched_canonical_bank_id: string | null;
  current_sort_code: string;
  approved_sort_code: string;
  status: "MATCHED" | "MISMATCH" | "UNMATCHED";
  proposed_action: string;
  is_verified: boolean;
}

/**
 * Prepares reconciliation preview list of trainees.
 */
export async function getReconciliationPreview(
  pool: any,
  options: { tspId?: string; search?: string; status?: string }
): Promise<ReconciliationPreviewItem[]> {
  let query = `
    SELECT 
      b.id as beneficiary_id,
      b.first_name,
      b.last_name,
      b.bank_name,
      b.bank_sort_code,
      b.status as training_status,
      CASE 
        WHEN tp.tvet_id IS NOT NULL AND tp.tvet_id != '' THEN tp.tvet_id
        ELSE b.id
      END as tvet_id
    FROM beneficiaries b
    LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
    WHERE b.deleted_at IS NULL AND b.status IN ('VERIFIED', 'ACCEPTED', 'ENROLLED', 'TRAINING', 'IN_TRAINING', 'PENDING_PHOTO', 'ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI', 'GRADUATED', 'COMPLETED', 'ONBOARDED')
  `;

  const params: any[] = [];
  let paramIdx = 1;

  if (options.tspId && options.tspId !== "all") {
    query += ` AND b.tsp_id = $${paramIdx++}`;
    params.push(options.tspId);
  }

  if (options.search) {
    query += ` AND (b.first_name ILIKE $${paramIdx} OR b.last_name ILIKE $${paramIdx} OR b.id ILIKE $${paramIdx})`;
    params.push(`%${options.search}%`);
    paramIdx++;
  }

  query += " ORDER BY b.last_name ASC, b.first_name ASC";

  const result = await pool.query(query, params);
  const previewItems: ReconciliationPreviewItem[] = [];

  // Get cache of canonical bank directory
  const banksRes = await pool.query("SELECT id, canonical_bank_name, approved_sort_code FROM bank_directory WHERE is_active = TRUE");
  const canonicalBanks = banksRes.rows;

  const aliasesRes = await pool.query(`
    SELECT ba.alias, bd.id, bd.canonical_bank_name, bd.approved_sort_code 
    FROM bank_aliases ba
    JOIN bank_directory bd ON ba.bank_directory_id = bd.id
    WHERE ba.is_active = TRUE AND bd.is_active = TRUE
  `);
  const aliases = aliasesRes.rows;

  for (const row of result.rows) {
    const rawBank = row.bank_name || "";
    const currentSort = row.bank_sort_code || "";
    const match = resolveOfficialBankMatch(rawBank, currentSort, canonicalBanks, aliases);

    let status: "MATCHED" | "MISMATCH" | "UNMATCHED" = "UNMATCHED";
    let proposedAction = "Manual Mapping Required";

    if (match.status === "MATCHED") {
      status = "MATCHED";
      proposedAction = "No action needed (Fully Reconciled)";
    } else if (match.status === "MISMATCH" || match.status === "MISSING") {
      status = "MISMATCH";
      proposedAction = `Update Sort Code to '${match.approvedSortCode}'`;
    } else if (match.status === "INVALID_FORMAT") {
      status = "MISMATCH";
      proposedAction = `Update Sort Code to '${match.approvedSortCode}' (Current format is invalid)`;
    } else {
      proposedAction = "No matched canonical bank found. Correct bank name first.";
    }

    const is_verified = status === "MATCHED" || (status === "MISMATCH" && match.approvedSortCode !== "N/A");

    previewItems.push({
      beneficiary_id: row.beneficiary_id,
      first_name: row.first_name,
      last_name: row.last_name,
      tvet_id: row.tvet_id,
      current_bank_name: rawBank,
      matched_canonical_bank_name: match.canonicalBankName,
      matched_canonical_bank_id: match.canonicalBankId,
      current_sort_code: currentSort,
      approved_sort_code: match.approvedSortCode,
      status,
      proposed_action: proposedAction,
      is_verified
    });
  }

  if (options.status && options.status !== "all") {
    return previewItems.filter(item => item.status.toLowerCase() === options.status?.toLowerCase());
  }

  return previewItems;
}

/**
 * Commits bank reconciliation updates in a single atomic transaction.
 */
export async function commitReconciliation(
  pool: any,
  beneficiaryIds: string[],
  tspId: string | null, // scope validation
  changedBy: string,
  reason: string
): Promise<{ success: boolean; reconciledCount: number; errors: string[] }> {
  const errors: string[] = [];
  let reconciledCount = 0;

  const client = await pool.connect();
  const operationId = crypto.randomUUID();

  try {
    await client.query("BEGIN");

    // Fetch canonical banks & aliases for verification in tx
    const banksRes = await client.query("SELECT id, canonical_bank_name, approved_sort_code FROM bank_directory WHERE is_active = TRUE");
    const canonicalBanks = banksRes.rows;

    const aliasesRes = await client.query(`
      SELECT ba.alias, bd.id, bd.canonical_bank_name, bd.approved_sort_code 
      FROM bank_aliases ba
      JOIN bank_directory bd ON ba.bank_directory_id = bd.id
      WHERE ba.is_active = TRUE AND bd.is_active = TRUE
    `);
    const aliases = aliasesRes.rows;

    const localMatch = (rawName: string) => {
      const cleanRaw = normalizeBankName(rawName);
      if (!cleanRaw) return null;

      for (const b of canonicalBanks) {
        if (normalizeBankName(b.canonical_bank_name) === cleanRaw) {
          return { ...b, method: "CANONICAL" };
        }
      }

      for (const a of aliases) {
        if (normalizeBankName(a.alias) === cleanRaw) {
          return { id: a.id, canonical_bank_name: a.canonical_bank_name, approved_sort_code: a.approved_sort_code, method: "ALIAS" };
        }
      }

      for (const b of canonicalBanks) {
        const normCanonical = normalizeBankName(b.canonical_bank_name);
        if (cleanRaw.includes(normCanonical) || normCanonical.includes(cleanRaw)) {
          return { ...b, method: "FUZZY" };
        }
      }

      return null;
    };

    for (const bId of beneficiaryIds) {
      // 1. Get trainee profile details and confirm ownership scope
      const traineeRes = await client.query(`
        SELECT b.id, b.first_name, b.last_name, b.bank_name, b.bank_sort_code, b.tsp_id,
               tp.tvet_id
        FROM beneficiaries b
        LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
        WHERE b.id = $1 AND b.deleted_at IS NULL
      `, [bId]);

      if (traineeRes.rows.length === 0) {
        errors.push(`Trainee ID '${bId}' not found or has been deleted.`);
        continue;
      }

      const trainee = traineeRes.rows[0];

      // Scope restriction check
      if (tspId && trainee.tsp_id !== tspId) {
        errors.push(`Unauthorized scope access for Trainee '${trainee.first_name} ${trainee.last_name}' (expected TSP ${tspId}, got ${trainee.tsp_id}).`);
        continue;
      }

      // Match the current bank name to see if we can perform auto-correct
      const match = localMatch(trainee.bank_name || "");
      if (!match) {
        errors.push(`Cannot reconcile Trainee '${trainee.first_name} ${trainee.last_name}': Current Bank Name '${trainee.bank_name}' does not match any approved bank in directory.`);
        continue;
      }

      const approvedSort = match.approved_sort_code;
      const oldSort = trainee.bank_sort_code || "";

      // Only perform update if sort code is actually different or need canonical update
      if (oldSort !== approvedSort) {
        // Update beneficiaries table
        await client.query(`
          UPDATE beneficiaries 
          SET bank_sort_code = $1, bank_name = $2, updated_at = NOW()
          WHERE id = $3
        `, [approvedSort, match.canonical_bank_name, bId]);

        // Also update trainee_profiles for consistency
        await client.query(`
          UPDATE trainee_profiles
          SET bank_sort_code = $1, bank_name = $2, updated_at = NOW()
          WHERE beneficiary_id = $3
        `, [approvedSort, match.canonical_bank_name, bId]);

        // Write Audit log
        await client.query(`
          INSERT INTO bank_reconciliation_audit (
            operation_id, beneficiary_id, tvet_id, tsp_id, current_bank_name,
            matched_canonical_bank_id, old_sort_code, new_sort_code,
            match_method, changed_by, reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          operationId,
          bId,
          trainee.tvet_id || trainee.id,
          trainee.tsp_id,
          trainee.bank_name,
          match.id,
          oldSort,
          approvedSort,
          match.method,
          changedBy,
          reason
        ]);

        reconciledCount++;
      } else {
        // If sort code is already canonical, but name is not, still update name
        if (trainee.bank_name !== match.canonical_bank_name) {
          await client.query(`
            UPDATE beneficiaries 
            SET bank_name = $1, updated_at = NOW()
            WHERE id = $2
          `, [match.canonical_bank_name, bId]);

          await client.query(`
            UPDATE trainee_profiles
            SET bank_name = $1, updated_at = NOW()
            WHERE beneficiary_id = $2
          `, [match.canonical_bank_name, bId]);

          reconciledCount++;
        }
      }
    }

    if (errors.length > 0 && reconciledCount === 0) {
      // Rollback if NO updates could be successfully executed
      await client.query("ROLLBACK");
      return { success: false, reconciledCount: 0, errors };
    }

    await client.query("COMMIT");
    return { success: true, reconciledCount, errors };

  } catch (txErr: any) {
    await client.query("ROLLBACK");
    console.error("[BANK_RECONCILIATION] Bulk transaction failed, rolled back:", txErr);
    return { success: false, reconciledCount: 0, errors: [txErr.message || String(txErr)] };
  } finally {
    client.release();
  }
}

/**
 * Returns audit trail logs of bank reconciliations.
 */
export async function getAuditTrail(
  pool: any,
  options: { tspId?: string; beneficiaryId?: string; limit?: number }
): Promise<any[]> {
  let query = `
    SELECT 
      bra.id,
      bra.operation_id,
      bra.beneficiary_id,
      bra.tvet_id,
      bra.current_bank_name,
      bd.canonical_bank_name as matched_canonical_bank_name,
      bra.old_sort_code,
      bra.new_sort_code,
      bra.match_method,
      bra.changed_by,
      bra.changed_at,
      bra.reason,
      b.first_name,
      b.last_name,
      t.name as tsp_name
    FROM bank_reconciliation_audit bra
    JOIN beneficiaries b ON bra.beneficiary_id = b.id
    LEFT JOIN bank_directory bd ON bra.matched_canonical_bank_id = bd.id
    LEFT JOIN tsps t ON bra.tsp_id = t.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIdx = 1;

  if (options.tspId && options.tspId !== "all") {
    query += ` AND bra.tsp_id = $${paramIdx++}`;
    params.push(options.tspId);
  }

  if (options.beneficiaryId) {
    query += ` AND bra.beneficiary_id = $${paramIdx++}`;
    params.push(options.beneficiaryId);
  }

  query += ` ORDER BY bra.changed_at DESC LIMIT $${paramIdx++}`;
  params.push(options.limit || 100);

  const result = await pool.query(query, params);
  return result.rows;
}
