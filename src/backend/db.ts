/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { Beneficiary, ProgramStatus, AuditLog, CustomField } from "../types";

const { Pool } = pg;
const DB_FILE = path.join(process.cwd(), "database_ideas_tvet.json");

// Pool instance. Created lazily to avoid immediate connection errors if CONFIG is not yet specified.
let pgPool: pg.Pool | null = null;
let isPgActive = false;

export function getPgPool(): pg.Pool | null {
  if (pgPool) return pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[DB] DATABASE_URL is not set. Falling back to filesystem JSON storage.");
    isPgActive = false;
    return null;
  }

  try {
    pgPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    isPgActive = true;
    console.log("[DB] PostgreSQL Pool initialized with DATABASE_URL.");
    return pgPool;
  } catch (err) {
    console.error("[DB] Failed to initialize PostgreSQL pool:", err);
    isPgActive = false;
    return null;
  }
}

/**
 * Checks if PG is active and responding
 */
export async function checkPgStatus(): Promise<boolean> {
  const pool = getPgPool();
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    isPgActive = true;
    return true;
  } catch (e) {
    console.warn("[DB] PostgreSQL exists in config but is offline/unreachable:", (e as Error).message);
    isPgActive = false;
    return false;
  }
}

/**
 * PostgreSQL Table Definitions Schema DDL
 */
const SCHEMA_DDL = `
  -- Custom dynamic fields definition table
  CREATE TABLE IF NOT EXISTS custom_fields (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    options JSONB,
    required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Core Beneficiaries table
  CREATE TABLE IF NOT EXISTS beneficiaries (
    id VARCHAR(50) PRIMARY KEY,
    photo TEXT,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    other_name VARCHAR(150),
    gender VARCHAR(50) NOT NULL,
    bvn VARCHAR(50) UNIQUE NOT NULL,
    nin VARCHAR(50) UNIQUE NOT NULL,
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone_number VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    residential_address TEXT,
    batch VARCHAR(100) DEFAULT 'Batch 2026-C',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    tsp VARCHAR(255) DEFAULT 'Unique Technology Nig. Ltd',
    program VARCHAR(255) DEFAULT 'IDEAS-TVET',
    skill_sector VARCHAR(255) DEFAULT 'Computer Hardware and Cell Phone Repairs',
    status VARCHAR(50) DEFAULT 'DRAFT',
    admission_letter_url TEXT,
    acceptance_letter_url TEXT,
    enrollment_letter_url TEXT,
    certificate_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Admissions details (extends lifecycle parameters of a beneficiary)
  CREATE TABLE IF NOT EXISTS admissions (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE UNIQUE,
    admission_status VARCHAR(100) DEFAULT 'Pending',
    admission_ref VARCHAR(100) UNIQUE,
    admission_letter_generated_at TIMESTAMP WITH TIME ZONE,
    admission_letter_sent_at TIMESTAMP WITH TIME ZONE,
    admission_form_completed BOOLEAN DEFAULT false,
    admission_form_status VARCHAR(50) DEFAULT 'Pending',
    admission_form_data JSONB DEFAULT '{}'::jsonb,
    admission_letter_versions JSONB DEFAULT '[]'::jsonb,
    admission_form_versions JSONB DEFAULT '[]'::jsonb,
    training_progress JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Acceptance declarations versions table
  CREATE TABLE IF NOT EXISTS acceptance_letters (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    version INT DEFAULT 1,
    url TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Dynamic Candidate Uploaded Documents list table
  CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(100) PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    version INT DEFAULT 1,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Attendance tracker log table
  CREATE TABLE IF NOT EXISTS attendance_logs (
    id VARCHAR(100) PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    hours_logged NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Audit Trails table
  CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Email dispatches delivery & tracking metadata logs table
  CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    date_sent TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recipient_email VARCHAR(255) NOT NULL,
    delivery_result VARCHAR(50) NOT NULL,
    smtp_response TEXT,
    tracking_status VARCHAR(50) DEFAULT 'Sent',
    sender_emailStatus VARCHAR(50) DEFAULT 'Not Sent',
    smtp_error_details TEXT,
    tracking_history JSONB DEFAULT '[]'::jsonb,
    delivery_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Public session link authorization tokens
  CREATE TABLE IF NOT EXISTS public_response_tokens (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Roles definitions table
  CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Permissions definitions table
  CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Role permissions join table
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
  );

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) REFERENCES roles(id),
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    failed_login_attempts INT DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Active session tracking table
  CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- DATABASE INDEXES (As required)
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_bvn ON beneficiaries(bvn) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_nin ON beneficiaries(nin) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_email ON beneficiaries(email) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_admissions_beneficiary_id ON admissions(beneficiary_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_documents_beneficiary_id ON documents(beneficiary_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary_id ON attendance_logs(beneficiary_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_acceptance_beneficiary_id ON acceptance_letters(beneficiary_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_email_logs_beneficiary_id ON email_logs(beneficiary_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_tokens_token ON public_response_tokens(token) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
`;

/**
 * Seed roles, permissions and baseline users in PG DB
 */
async function seedAuthAndRoles(pool: pg.Pool): Promise<void> {
  try {
    console.log("[DB] Seeding roles, permissions, and default accounts...");
    
    // 1. Insert Roles
    const roles = [
      { id: "SUPER_ADMIN", name: "Super Administrator", description: "Full system administration and user management" },
      { id: "ADMIN_OFFICER", name: "Admin Officer", description: "Manage admissions, generate letters, send emails" },
      { id: "REVIEW_OFFICER", name: "Review Officer", description: "Review submissions, approve acceptance letters" },
      { id: "TRAINEE", name: "Trainee Candidate", description: "View profile, submit acceptance, track application" }
    ];
    for (const r of roles) {
      await pool.query(
        "INSERT INTO roles (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description",
        [r.id, r.name, r.description]
      );
    }

    // 2. Insert Permissions
    const permissions = [
      { id: "all_access", name: "All Access", description: "Unrestricted system actions" },
      { id: "manage_admissions", name: "Manage Admissions", description: "Ability to generate offers and send emails" },
      { id: "review_submissions", name: "Review Submissions", description: "Ability to audit candidate acceptance documents" },
      { id: "trainee_access", name: "Trainee Access", description: "Access own student profile and form response submission" }
    ];
    for (const p of permissions) {
      await pool.query(
        "INSERT INTO permissions (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description",
        [p.id, p.name, p.description]
      );
    }

    // 3. Map Roles and Permissions
    const mappings = [
      { role_id: "SUPER_ADMIN", permission_id: "all_access" },
      { role_id: "ADMIN_OFFICER", permission_id: "manage_admissions" },
      { role_id: "REVIEW_OFFICER", permission_id: "review_submissions" },
      { role_id: "TRAINEE", permission_id: "trainee_access" }
    ];
    for (const m of mappings) {
      await pool.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [m.role_id, m.permission_id]
      );
    }

    // 4. Seed Default App Users
    const defaultUsers = [
      { id: "user_sa", email: "superadmin@ideas-tvet.ng", role: "SUPER_ADMIN", pass: "Password123" },
      { id: "user_ao", email: "admin@ideas-tvet.ng", role: "ADMIN_OFFICER", pass: "Password123" },
      { id: "user_ro", email: "reviewer@ideas-tvet.ng", role: "REVIEW_OFFICER", pass: "Password123" }
    ];
    
    for (const u of defaultUsers) {
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [u.email]);
      if (existing.rows.length === 0) {
        const hashedPassword = bcrypt.hashSync(u.pass, 10);
        await pool.query(
          "INSERT INTO users (id, email, password_hash, role, failed_login_attempts) VALUES ($1, $2, $3, $4, 0)",
          [u.id, u.email, hashedPassword, u.role]
        );
        console.log(`[DB] Seeded default user: ${u.email} (${u.role})`);
      }
    }
  } catch (err) {
    console.error("[DB] Failed to seed auth system:", err);
  }
}

/**
 * Initializes schema and runs any pending JSON database records migration to PostgreSQL
 */
export async function initDb(): Promise<void> {
  const active = await checkPgStatus();
  if (!active) {
    console.log("[DB] PostgreSQL is inactive. Working in file-system fallback mode.");
    return;
  }

  const pool = getPgPool()!;
  
  try {
    console.log("[DB] Creating PostgreSQL schema tables and indexes...");
    await pool.query(SCHEMA_DDL);
    
    // Auto-migrate columns if the table already existed historically
    await pool.query(`
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS admission_letter_url TEXT;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS acceptance_letter_url TEXT;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS enrollment_letter_url TEXT;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_url TEXT;
    `);

    // Bootstrap secure user systems
    await seedAuthAndRoles(pool);

    console.log("[DB] PostgreSQL schema verified and migration performed.");

    // Check if dynamic seed or JSON migration is required
    const checkResult = await pool.query("SELECT COUNT(*) as count FROM beneficiaries");
    const count = parseInt(checkResult.rows[0].count, 10);
    
    if (count === 0) {
      console.log("[DB] PostgreSQL database is empty. Performing initial data migration from JSON file...");
      await migrateJsonToPostgres();
    } else {
      console.log(`[DB] Database already initialized with ${count} records. Skipping CSV/JSON migration.`);
    }
  } catch (err) {
    console.error("[DB] Failed to initialize PostgreSQL tables/relations:", err);
  }
}

/**
 * Helper to load JSON file state (to back up operations and map schemas)
 */
function loadJsonState(): { customFields: CustomField[]; beneficiaries: Beneficiary[]; auditLogs: AuditLog[] } {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[DB] Failed to read JSON file fallback state:", e);
  }
  return { customFields: [], beneficiaries: [], auditLogs: [] };
}

/**
 * Helper to save JSON file state
 */
function saveJsonState(state: { customFields: CustomField[]; beneficiaries: Beneficiary[]; auditLogs: AuditLog[] }) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("[DB] Failed to write JSON file fallback state:", e);
  }
}

/**
 * Converts JSON records in database_ideas_tvet.json into PostgreSQL tables
 */
export async function migrateJsonToPostgres(): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;

  const state = loadJsonState();
  console.log(`[Migration] Starting migration of ${state.customFields.length} custom fields, ${state.beneficiaries.length} beneficiaries, and ${state.auditLogs.length} audit logs into Postgres...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Migrate custom_fields
    for (const cf of state.customFields) {
      await client.query(
        `INSERT INTO custom_fields (id, name, label, type, options, required, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name, label = EXCLUDED.label, type = EXCLUDED.type, 
           options = EXCLUDED.options, required = EXCLUDED.required, updated_at = NOW()`,
        [cf.id, cf.name, cf.label, cf.type, JSON.stringify(cf.options || []), cf.required]
      );
    }

    // 2. Migrate beneficiaries, admissions, documents, acceptance_letters, attendance_logs, email_logs
    for (const b of state.beneficiaries) {
      // 2.1 Main table insert
      await client.query(
        `INSERT INTO beneficiaries (
           id, photo, first_name, last_name, other_name, gender, bvn, nin, 
           state, city, phone_number, email, residential_address, batch, 
           custom_fields, tsp, program, skill_sector, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         ON CONFLICT (id) DO UPDATE SET 
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, other_name = EXCLUDED.other_name,
           gender = EXCLUDED.gender, bvn = EXCLUDED.bvn, nin = EXCLUDED.nin, state = EXCLUDED.state,
           city = EXCLUDED.city, phone_number = EXCLUDED.phone_number, email = EXCLUDED.email,
           residential_address = EXCLUDED.residential_address, batch = EXCLUDED.batch,
           custom_fields = EXCLUDED.custom_fields, status = EXCLUDED.status, updated_at = NOW()`,
        [
          b.id, b.photo, b.firstName, b.lastName, b.otherName || "", b.gender, b.bvn, b.nin,
          b.state, b.city, b.phoneNumber, b.email, b.residentialAddress, b.batch || `Batch ${new Date().getFullYear()}-C`,
          JSON.stringify(b.customFields || {}), b.tsp || "Unique Technology Nig. Ltd",
          b.program || "IDEAS-TVET", b.skillSector || "Computer Hardware and Cell Phone Repairs",
          b.status, b.createdAt || new Date().toISOString(), b.updatedAt || new Date().toISOString()
        ]
      );

      // 2.2 Admissions Table insert
      await client.query(
        `INSERT INTO admissions (
           beneficiary_id, admission_status, admission_ref, admission_letter_generated_at, 
           admission_letter_sent_at, admission_form_completed, admission_form_status, 
           admission_form_data, admission_letter_versions, admission_form_versions, 
           training_progress, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (beneficiary_id) DO UPDATE SET
           admission_status = EXCLUDED.admission_status,
           admission_ref = EXCLUDED.admission_ref,
           admission_letter_generated_at = EXCLUDED.admission_letter_generated_at,
           admission_letter_sent_at = EXCLUDED.admission_letter_sent_at,
           admission_form_completed = EXCLUDED.admission_form_completed,
           admission_form_status = EXCLUDED.admission_form_status,
           admission_form_data = EXCLUDED.admission_form_data,
           admission_letter_versions = EXCLUDED.admission_letter_versions,
           admission_form_versions = EXCLUDED.admission_form_versions,
           training_progress = EXCLUDED.training_progress,
           updated_at = NOW()`,
        [
          b.id,
          b.admissionStatus || "Pending",
          b.admissionRef || null,
          b.admissionLetterGeneratedAt ? new Date(b.admissionLetterGeneratedAt) : null,
          b.admissionLetterSentAt ? new Date(b.admissionLetterSentAt) : null,
          !!b.admissionFormCompleted,
          b.admissionFormStatus || "Pending",
          JSON.stringify(b.admissionFormData || {}),
          JSON.stringify(b.admissionLetterVersions || []),
          JSON.stringify(b.admissionFormVersions || []),
          JSON.stringify(b.trainingProgress || {})
        ]
      );

      // 2.3 Documents List insert
      if (b.documentsList && b.documentsList.length > 0) {
        for (const doc of b.documentsList) {
          await client.query(
            `INSERT INTO documents (id, beneficiary_id, name, type, url, version, uploaded_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              doc.id, b.id, doc.name, doc.type, doc.url, doc.version || 1,
              doc.uploadedAt ? new Date(doc.uploadedAt) : new Date()
            ]
          );
        }
      }

      // 2.4 Acceptance Letters insert (cascade versions)
      if (b.acceptanceLetterVersions && b.acceptanceLetterVersions.length > 0) {
        for (const accl of b.acceptanceLetterVersions) {
          await client.query(
            `INSERT INTO acceptance_letters (beneficiary_id, version, url, name, uploaded_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              b.id, accl.version, accl.url, accl.name,
              accl.uploadedAt ? new Date(accl.uploadedAt) : new Date()
            ]
          );
        }
      } else if (b.acceptanceLetterUploaded && b.acceptanceLetterUrl) {
        // Fallback placeholder
        await client.query(
          `INSERT INTO acceptance_letters (beneficiary_id, version, url, name, uploaded_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            b.id, 1, b.acceptanceLetterUrl, "Official Signed Acceptance.html",
            b.acceptanceLetterUploadedAt ? new Date(b.acceptanceLetterUploadedAt) : new Date()
          ]
        );
      }

      // 2.5 Attendance logs insert
      if (b.attendanceLogs && b.attendanceLogs.length > 0) {
        for (const att of b.attendanceLogs) {
          await client.query(
            `INSERT INTO attendance_logs (id, beneficiary_id, date, status, hours_logged, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            [att.id, b.id, att.date, att.status, att.hoursLogged]
          );
        }
      }

      // 2.6 Email logs insert & history
      if (b.emailDeliveryHistory && b.emailDeliveryHistory.length > 0) {
        // Find last element for current state
        const lastDeliv = b.emailDeliveryHistory[b.emailDeliveryHistory.length - 1];
        await client.query(
          `INSERT INTO email_logs (
             beneficiary_id, date_sent, recipient_email, delivery_result, smtp_response, 
             tracking_status, sender_emailstatus, smtp_error_details, tracking_history, 
             delivery_history, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            b.id,
            lastDeliv.dateSent ? new Date(lastDeliv.dateSent) : new Date(),
            lastDeliv.recipientEmail,
            lastDeliv.deliveryResult,
            lastDeliv.smtpResponse || "",
            b.emailTrackingStatus || "Sent",
            b.emailStatus || "Not Sent",
            b.smtpErrorDetails || null,
            JSON.stringify(b.emailTrackingHistory || []),
            JSON.stringify(b.emailDeliveryHistory || [])
          ]
        );
      }
    }

    // 3. Migrate audit logs
    for (const log of state.auditLogs) {
      await client.query(
        `INSERT INTO audit_logs (id, timestamp, username, role, action, details, ip_address, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          log.id, new Date(log.timestamp), log.username, log.role, log.action, log.details, log.ipAddress || null
        ]
      );
    }

    await client.query("COMMIT");
    console.log("[Migration] SQLite/JSON fallback records successfully cloned into PostgreSQL!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Migration] Transaction aborted. PostgreSQL migration failed:", err);
  } finally {
    client.release();
  }
}

// ==========================================
// DB SERVICE REPOSITORY OPERATIONS (Surgical Replacement of Sync Filesystem Ops)
// ==========================================

export class DbRepo {
  /**
   * Retrieves all registered dynamic custom fields
   */
  static async getCustomFields(): Promise<CustomField[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // JSON File fallback
      return loadJsonState().customFields;
    }

    try {
      const res = await pool.query(
        "SELECT id, name, label, type, options, required FROM custom_fields WHERE deleted_at IS NULL ORDER BY created_at ASC"
      );
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        label: r.label,
        type: r.type as "text" | "number" | "select",
        options: r.options || [],
        required: !!r.required
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to load custom fields from PG:", e);
      return loadJsonState().customFields;
    }
  }

  /**
   * Persists a newly created custom field schema
   */
  static async saveCustomField(cf: CustomField): Promise<CustomField> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      state.customFields.push(cf);
      saveJsonState(state);
      return cf;
    }

    try {
      await pool.query(
        `INSERT INTO custom_fields (id, name, label, type, options, required, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name, label = EXCLUDED.label, type = EXCLUDED.type, 
           options = EXCLUDED.options, required = EXCLUDED.required, updated_at = NOW()`,
        [cf.id, cf.name, cf.label, cf.type, JSON.stringify(cf.options || []), cf.required]
      );
      return cf;
    } catch (e) {
      console.error("[DB Repo] Failed to save custom field to PG:", e);
      // Fallback
      const state = loadJsonState();
      state.customFields.push(cf);
      saveJsonState(state);
      return cf;
    }
  }

  /**
   * Soft-deletes custom schema field template
   */
  static async deleteCustomField(id: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const idx = state.customFields.findIndex(f => f.id === id);
      if (idx !== -1) {
        state.customFields.splice(idx, 1);
        saveJsonState(state);
        return true;
      }
      return false;
    }

    try {
      const res = await pool.query("UPDATE custom_fields SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to soft-delete custom field in PG:", e);
      return false;
    }
  }

  /**
   * Loads all historical system-wide audit activity logs
   */
  static async getAuditLogs(): Promise<AuditLog[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return loadJsonState().auditLogs;
    }

    try {
      const res = await pool.query(
        "SELECT id, timestamp, username, role, action, details, ip_address FROM audit_logs WHERE deleted_at IS NULL ORDER BY timestamp DESC"
      );
      return res.rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        username: r.username,
        role: r.role,
        action: r.action,
        details: r.details || "",
        ipAddress: r.ip_address || undefined
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to query audit logs from PG:", e);
      return loadJsonState().auditLogs;
    }
  }

  /**
   * Writes a new system security context logs entry
   */
  static async saveAuditLog(log: AuditLog): Promise<AuditLog> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      state.auditLogs.unshift(log);
      saveJsonState(state);
      return log;
    }

    try {
      await pool.query(
        `INSERT INTO audit_logs (id, timestamp, username, role, action, details, ip_address, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [log.id, new Date(log.timestamp), log.username, log.role, log.action, log.details, log.ipAddress || null]
      );
      return log;
    } catch (e) {
      console.error("[DB Repo] Failed to append audit log to PG:", e);
      // Fallback save
      const state = loadJsonState();
      state.auditLogs.unshift(log);
      saveJsonState(state);
      return log;
    }
  }

  /**
   * Queries and returns a list of active beneficiaries with pre-mapped joined records
   */
  static async getBeneficiaries(): Promise<Beneficiary[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return loadJsonState().beneficiaries;
    }

    try {
      // 1. Get raw beneficiaries
      const bRes = await pool.query(
        `SELECT id, photo, first_name, last_name, other_name, gender, bvn, nin, 
                state, city, phone_number, email, residential_address, batch, 
                custom_fields, tsp, program, skill_sector, status, 
                admission_letter_url, acceptance_letter_url, enrollment_letter_url, certificate_url,
                created_at, updated_at
         FROM beneficiaries
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC`
      );

      if (bRes.rows.length === 0) return [];

      const payloadList: Beneficiary[] = [];

      // 2. Retrieve relationship payloads for cascading mapping
      for (const row of bRes.rows) {
        const bId = row.id;

        // A. Admissions
        const admRes = await pool.query(
          `SELECT admission_status, admission_ref, admission_letter_generated_at, 
                  admission_letter_sent_at, admission_form_completed, admission_form_status, 
                  admission_form_data, admission_letter_versions, admission_form_versions, training_progress
           FROM admissions
           WHERE beneficiary_id = $1 AND deleted_at IS NULL`,
          [bId]
        );
        const adm = admRes.rows[0] || {};

        // B. Documents List
        const docRes = await pool.query(
          "SELECT id, name, type, url, version, uploaded_at FROM documents WHERE beneficiary_id = $1 AND deleted_at IS NULL",
          [bId]
        );
        const docsList = docRes.rows.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          url: d.url,
          uploadedAt: d.uploaded_at.toISOString(),
          version: d.version || 1
        }));

        // C. Acceptance versions
        const accRes = await pool.query(
          "SELECT version, url, name, uploaded_at FROM acceptance_letters WHERE beneficiary_id = $1 AND deleted_at IS NULL ORDER BY version ASC",
          [bId]
        );
        const accVersions = accRes.rows.map(ac => ({
          version: ac.version,
          url: ac.url,
          name: ac.name,
          uploadedAt: ac.uploaded_at.toISOString()
        }));

        // D. Attendance
        const attRes = await pool.query(
          "SELECT id, date, status, hours_logged FROM attendance_logs WHERE beneficiary_id = $1 AND deleted_at IS NULL ORDER BY date ASC",
          [bId]
        );
        const attendanceLogs = attRes.rows.map(a => ({
          id: a.id,
          date: a.date.toISOString().split("T")[0],
          status: a.status as "Present" | "Absent" | "Excused",
          hoursLogged: parseFloat(a.hours_logged) || 0
        }));

        // E. Latest email logs (recipient history metrics)
        const emailRes = await pool.query(
          `SELECT tracking_status, sender_emailstatus, smtp_error_details, tracking_history, delivery_history
           FROM email_logs
           WHERE beneficiary_id = $1 AND deleted_at IS NULL
           ORDER BY date_sent DESC LIMIT 1`,
          [bId]
        );
        const eml = emailRes.rows[0] || {};

        // 3. Compile structural Beneficiary mapping
        const beneficiary: Beneficiary = {
          id: row.id,
          photo: row.photo || "",
          firstName: row.first_name,
          lastName: row.last_name,
          otherName: row.other_name || "",
          gender: row.gender,
          bvn: row.bvn,
          nin: row.nin,
          state: row.state,
          city: row.city,
          phoneNumber: row.phone_number || "",
          email: row.email || "",
          residentialAddress: row.residential_address || "",
          batch: row.batch || `Batch ${new Date().getFullYear()}-C`,
          customFields: row.custom_fields || {},
          tsp: row.tsp || "Unique Technology Nig. Ltd",
          program: row.program || "IDEAS-TVET",
          skillSector: row.skill_sector || "Computer Hardware and Cell Phone Repairs",
          status: row.status as ProgramStatus,
          admissionLetterUrl: row.admission_letter_url || "",
          enrollmentLetterUrl: row.enrollment_letter_url || "",
          certificateUrl: row.certificate_url || "",
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),

          // Nested Adm structures
          admissionStatus: adm.admission_status || "Pending",
          admissionRef: adm.admission_ref || undefined,
          admissionLetterGeneratedAt: adm.admission_letter_generated_at ? adm.admission_letter_generated_at.toISOString() : undefined,
          admissionLetterSentAt: adm.admission_letter_sent_at ? adm.admission_letter_sent_at.toISOString() : undefined,
          admissionFormCompleted: !!adm.admission_form_completed,
          admissionFormStatus: adm.admission_form_status || "Pending",
          admissionFormData: adm.admission_form_data || {},
          admissionLetterVersions: adm.admission_letter_versions || [],
          admissionFormVersions: adm.admission_form_versions || [],
          trainingProgress: adm.training_progress || {},

          // Documents mapping
          documentsList: docsList,

          // Acceptance Letters mapping
          acceptanceLetterUploaded: accVersions.length > 0,
          acceptanceLetterUrl: row.acceptance_letter_url || (accVersions.length > 0 ? accVersions[accVersions.length - 1].url : undefined),
          acceptanceLetterUploadedAt: accVersions.length > 0 ? accVersions[accVersions.length - 1].uploadedAt : undefined,
          acceptanceLetterVersions: accVersions,

          // Attendance logs
          attendanceLogs: attendanceLogs,

          // Email delivery tracking analytics details
          emailTrackingStatus: eml.tracking_status || undefined,
          emailTrackingHistory: eml.tracking_history || [],
          emailStatus: eml.sender_emailstatus || undefined,
          smtpErrorDetails: eml.smtp_error_details || undefined,
          emailDeliveryHistory: eml.delivery_history || []
        };

        payloadList.push(beneficiary);
      }

      return payloadList;
    } catch (e) {
      console.error("[DB Repo] Failed to load beneficiaries from PG:", e);
      return loadJsonState().beneficiaries;
    }
  }

  /**
   * Retrieves a single beneficiary profile using its unique identifier
   */
  static async getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    const list = await this.getBeneficiaries();
    return list.find(b => b.id === id) || null;
  }

  /**
   * Deep performs cascading inserts or updates for high-fidelity relational schema mapping
   */
  static async upsertBeneficiary(b: Beneficiary): Promise<Beneficiary> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // JSON File fallback sync writing
      const state = loadJsonState();
      const idx = state.beneficiaries.findIndex(x => x.id === b.id);
      if (idx !== -1) {
        state.beneficiaries[idx] = b;
      } else {
        state.beneficiaries.unshift(b);
      }
      saveJsonState(state);
      return b;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Upsert core beneficiary parameters
      await client.query(
        `INSERT INTO beneficiaries (
           id, photo, first_name, last_name, other_name, gender, bvn, nin, 
           state, city, phone_number, email, residential_address, batch, 
           custom_fields, tsp, program, skill_sector, status,
           admission_letter_url, acceptance_letter_url, enrollment_letter_url, certificate_url,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
         ON CONFLICT (id) DO UPDATE SET 
           photo = EXCLUDED.photo,
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, other_name = EXCLUDED.other_name,
           gender = EXCLUDED.gender, bvn = EXCLUDED.bvn, nin = EXCLUDED.nin, state = EXCLUDED.state,
           city = EXCLUDED.city, phone_number = EXCLUDED.phone_number, email = EXCLUDED.email,
           residential_address = EXCLUDED.residential_address, batch = EXCLUDED.batch,
           custom_fields = EXCLUDED.custom_fields, status = EXCLUDED.status,
           admission_letter_url = EXCLUDED.admission_letter_url,
           acceptance_letter_url = EXCLUDED.acceptance_letter_url,
           enrollment_letter_url = EXCLUDED.enrollment_letter_url,
           certificate_url = EXCLUDED.certificate_url,
           updated_at = NOW()`,
        [
          b.id, b.photo || "", b.firstName, b.lastName, b.otherName || "", b.gender, b.bvn, b.nin,
          b.state, b.city, b.phoneNumber, b.email, b.residentialAddress, b.batch || `Batch ${new Date().getFullYear()}-C`,
          JSON.stringify(b.customFields || {}), b.tsp || "Unique Technology Nig. Ltd",
          b.program || "IDEAS-TVET", b.skillSector || "Computer Hardware and Cell Phone Repairs",
          b.status,
          b.admissionLetterUrl || "", b.acceptanceLetterUrl || "", b.enrollmentLetterUrl || "", b.certificateUrl || "",
          new Date(b.createdAt || Date.now()), new Date()
        ]
      );

      // 2. Upsert admission extending metrics
      await client.query(
        `INSERT INTO admissions (
           beneficiary_id, admission_status, admission_ref, admission_letter_generated_at, 
           admission_letter_sent_at, admission_form_completed, admission_form_status, 
           admission_form_data, admission_letter_versions, admission_form_versions, 
           training_progress, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (beneficiary_id) DO UPDATE SET
           admission_status = EXCLUDED.admission_status,
           admission_ref = EXCLUDED.admission_ref,
           admission_letter_generated_at = EXCLUDED.admission_letter_generated_at,
           admission_letter_sent_at = EXCLUDED.admission_letter_sent_at,
           admission_form_completed = EXCLUDED.admission_form_completed,
           admission_form_status = EXCLUDED.admission_form_status,
           admission_form_data = EXCLUDED.admission_form_data,
           admission_letter_versions = EXCLUDED.admission_letter_versions,
           admission_form_versions = EXCLUDED.admission_form_versions,
           training_progress = EXCLUDED.training_progress,
           updated_at = NOW()`,
        [
          b.id,
          b.admissionStatus || "Pending",
          b.admissionRef || null,
          b.admissionLetterGeneratedAt ? new Date(b.admissionLetterGeneratedAt) : null,
          b.admissionLetterSentAt ? new Date(b.admissionLetterSentAt) : null,
          !!b.admissionFormCompleted,
          b.admissionFormStatus || "Pending",
          JSON.stringify(b.admissionFormData || {}),
          JSON.stringify(b.admissionLetterVersions || []),
          JSON.stringify(b.admissionFormVersions || []),
          JSON.stringify(b.trainingProgress || {})
        ]
      );

      // 3. Reconcile documents list (matching items cascade)
      if (b.documentsList && b.documentsList.length > 0) {
        for (const doc of b.documentsList) {
          await client.query(
            `INSERT INTO documents (id, beneficiary_id, name, type, url, version, uploaded_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name, type = EXCLUDED.type, url = EXCLUDED.url, 
               version = EXCLUDED.version, uploaded_at = EXCLUDED.uploaded_at, updated_at = NOW()`,
            [
              doc.id, b.id, doc.name, doc.type, doc.url, doc.version || 1,
              doc.uploadedAt ? new Date(doc.uploadedAt) : new Date()
            ]
          );
        }
      }

      // 4. Reconcile acceptance declarations cascade
      if (b.acceptanceLetterVersions && b.acceptanceLetterVersions.length > 0) {
        // Delete older entries first and reconstruct from authoritative state
        await client.query("DELETE FROM acceptance_letters WHERE beneficiary_id = $1", [b.id]);
        for (const accl of b.acceptanceLetterVersions) {
          await client.query(
            `INSERT INTO acceptance_letters (beneficiary_id, version, url, name, uploaded_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              b.id, accl.version, accl.url, accl.name,
              accl.uploadedAt ? new Date(accl.uploadedAt) : new Date()
            ]
          );
        }
      } else if (b.acceptanceLetterUploaded && b.acceptanceLetterUrl) {
        await client.query("DELETE FROM acceptance_letters WHERE beneficiary_id = $1", [b.id]);
        await client.query(
          `INSERT INTO acceptance_letters (beneficiary_id, version, url, name, uploaded_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            b.id, 1, b.acceptanceLetterUrl, "Official Signed Acceptance.html",
            b.acceptanceLetterUploadedAt ? new Date(b.acceptanceLetterUploadedAt) : new Date()
          ]
        );
      }

      // 5. Reconcile attendance records log
      if (b.attendanceLogs && b.attendanceLogs.length > 0) {
        for (const att of b.attendanceLogs) {
          await client.query(
            `INSERT INTO attendance_logs (id, beneficiary_id, date, status, hours_logged, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               date = EXCLUDED.date, status = EXCLUDED.status, 
               hours_logged = EXCLUDED.hours_logged, updated_at = NOW()`,
            [att.id, b.id, att.date, att.status, att.hoursLogged]
          );
        }
      }

      // 6. Append email tracking metrics & logs
      if (b.emailDeliveryHistory && b.emailDeliveryHistory.length > 0) {
        const lastRecord = b.emailDeliveryHistory[b.emailDeliveryHistory.length - 1];
        await client.query(
          `INSERT INTO email_logs (
             beneficiary_id, date_sent, recipient_email, delivery_result, smtp_response, 
             tracking_status, sender_emailstatus, smtp_error_details, tracking_history, 
             delivery_history, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            b.id,
            lastRecord.dateSent ? new Date(lastRecord.dateSent) : new Date(),
            lastRecord.recipientEmail,
            lastRecord.deliveryResult,
            lastRecord.smtpResponse || "",
            b.emailTrackingStatus || "Sent",
            b.emailStatus || "Not Sent",
            b.smtpErrorDetails || null,
            JSON.stringify(b.emailTrackingHistory || []),
            JSON.stringify(b.emailDeliveryHistory || [])
          ]
        );
      }

      await client.query("COMMIT");
      return b;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[DB Repo] Failed cascading upsert for beneficiary in PG:", err);
      // Fallback update on failure
      const state = loadJsonState();
      const idx = state.beneficiaries.findIndex(x => x.id === b.id);
      if (idx !== -1) {
        state.beneficiaries[idx] = b;
      } else {
        state.beneficiaries.unshift(b);
      }
      saveJsonState(state);
      return b;
    } finally {
      client.release();
    }
  }

  /**
   * soft deletes profile registration
   */
  static async deleteBeneficiary(id: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const idx = state.beneficiaries.findIndex(x => x.id === id);
      if (idx !== -1) {
        const target = state.beneficiaries[idx];
        state.beneficiaries.splice(idx, 1);
        saveJsonState(state);
        return true;
      }
      return false;
    }

    try {
      const res = await pool.query("UPDATE beneficiaries SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL", [id]);
      await pool.query("UPDATE admissions SET deleted_at = NOW() WHERE beneficiary_id = $1 AND deleted_at IS NULL", [id]);
      await pool.query("UPDATE documents SET deleted_at = NOW() WHERE beneficiary_id = $1 AND deleted_at IS NULL", [id]);
      await pool.query("UPDATE attendance_logs SET deleted_at = NOW() WHERE beneficiary_id = $1 AND deleted_at IS NULL", [id]);
      await pool.query("UPDATE email_logs SET deleted_at = NOW() WHERE beneficiary_id = $1 AND deleted_at IS NULL", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to soft-delete beneficiary in PG:", e);
      return false;
    }
  }

  /**
   * Fetch a user by email from PostgreSQL
   */
  static async getUserByEmail(email: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      console.log("[DB Repo] JSON fallback mode: authenticating default seed users");
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail === "superadmin@ideas-tvet.ng") {
        return { id: "user_sa", email: normalizedEmail, password_hash: bcrypt.hashSync("Password123", 10), role: "SUPER_ADMIN", failed_login_attempts: 0 };
      }
      if (normalizedEmail === "admin@ideas-tvet.ng") {
        return { id: "user_ao", email: normalizedEmail, password_hash: bcrypt.hashSync("Password123", 10), role: "ADMIN_OFFICER", failed_login_attempts: 0 };
      }
      if (normalizedEmail === "reviewer@ideas-tvet.ng") {
        return { id: "user_ro", email: normalizedEmail, password_hash: bcrypt.hashSync("Password123", 10), role: "REVIEW_OFFICER", failed_login_attempts: 0 };
      }
      // Trainee fallback search
      const state = loadJsonState();
      const b = state.beneficiaries.find(x => x.email.toLowerCase() === normalizedEmail);
      if (b) {
        return {
          id: `usr_tr_${b.id}`,
          email: b.email,
          password_hash: bcrypt.hashSync(b.nin || b.bvn || "Password123", 10),
          role: "TRAINEE",
          beneficiary_id: b.id,
          failed_login_attempts: 0
        };
      }
      return null;
    }

    try {
      const res = await pool.query(
        "SELECT id, email, password_hash, role, beneficiary_id, failed_login_attempts, lockout_until, reset_token, reset_token_expires, created_at, updated_at FROM users WHERE email = $1 AND deleted_at IS NULL",
        [email.toLowerCase().trim()]
      );
      if (res.rows.length > 0) {
        return {
          id: res.rows[0].id,
          email: res.rows[0].email,
          password_hash: res.rows[0].password_hash,
          role: res.rows[0].role,
          beneficiary_id: res.rows[0].beneficiary_id,
          failed_login_attempts: res.rows[0].failed_login_attempts,
          lockout_until: res.rows[0].lockout_until ? res.rows[0].lockout_until.toISOString() : null,
          reset_token: res.rows[0].reset_token,
          reset_token_expires: res.rows[0].reset_token_expires ? res.rows[0].reset_token_expires.toISOString() : null,
          created_at: res.rows[0].created_at ? res.rows[0].created_at.toISOString() : new Date().toISOString(),
          updated_at: res.rows[0].updated_at ? res.rows[0].updated_at.toISOString() : new Date().toISOString()
        };
      }

      // If user not found, dynamically provision the Trainee account if they already exist in beneficiaries
      const bRes = await pool.query("SELECT id, first_name, last_name, nin, bvn FROM beneficiaries WHERE email = $1 AND deleted_at IS NULL LIMIT 1", [email.toLowerCase().trim()]);
      if (bRes.rows.length > 0) {
        const b = bRes.rows[0];
        const defaultTraineePassword = b.nin ? b.nin : (b.bvn ? b.bvn : "Password123");
        const defaultHash = bcrypt.hashSync(defaultTraineePassword, 10);
        const newUid = `usr_tr_${b.id}`;
        await pool.query(
          "INSERT INTO users (id, email, password_hash, role, beneficiary_id, failed_login_attempts) VALUES ($1, $2, $3, $4, $5, 0) ON CONFLICT (email) DO NOTHING",
          [newUid, email.toLowerCase().trim(), defaultHash, "TRAINEE", b.id]
        );
        return {
          id: newUid,
          email: email.toLowerCase().trim(),
          password_hash: defaultHash,
          role: "TRAINEE",
          beneficiary_id: b.id,
          failed_login_attempts: 0,
          lockout_until: null,
          reset_token: null,
          reset_token_expires: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return null;
    } catch (e) {
      console.error("[DB Repo] Failed to get user by email in PG:", e);
      return null;
    }
  }

  /**
   * Fetch a user by ID
   */
  static async getUserById(id: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      if (id === "user_sa") return { id: "user_sa", email: "superadmin@ideas-tvet.ng", role: "SUPER_ADMIN" };
      if (id === "user_ao") return { id: "user_ao", email: "admin@ideas-tvet.ng", role: "ADMIN_OFFICER" };
      if (id === "user_ro") return { id: "user_ro", email: "reviewer@ideas-tvet.ng", role: "REVIEW_OFFICER" };
      return null;
    }

    try {
      const res = await pool.query(
        "SELECT id, email, role, beneficiary_id, failed_login_attempts, lockout_until, created_at FROM users WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
      return null;
    } catch (e) {
      console.error("[DB Repo] Failed to get user by ID:", e);
      return null;
    }
  }

  /**
   * Update User parameters (for failed attempts, lockout, reset tokens, password change)
   */
  static async updateUser(user: any): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return true;

    try {
      const lockoutTimestamp = user.lockout_until ? new Date(user.lockout_until) : null;
      const resetTokenExpires = user.reset_token_expires ? new Date(user.reset_token_expires) : null;

      await pool.query(
        `UPDATE users SET 
           password_hash = $1, 
           failed_login_attempts = $2, 
           lockout_until = $3, 
           reset_token = $4, 
           reset_token_expires = $5,
           updated_at = NOW()
         WHERE id = $6`,
        [
          user.password_hash,
          user.failed_login_attempts,
          lockoutTimestamp,
          user.reset_token || null,
          resetTokenExpires,
          user.id
        ]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed updating user settings:", e);
      return false;
    }
  }

  /**
   * Save user session with token
   */
  static async saveUserSession(id: string, user_id: string, token: string, expires_at: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return true;

    try {
      await pool.query(
        `INSERT INTO user_sessions (id, user_id, token, expires_at) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
        [id, user_id, token, new Date(expires_at)]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to save session:", e);
      return false;
    }
  }

  /**
   * Retrieve session by token
   */
  static async getUserSessionByToken(token: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;

    try {
      const res = await pool.query(
        `SELECT us.id as session_id, us.user_id, us.token, us.expires_at, u.email, u.role, u.beneficiary_id 
         FROM user_sessions us
         INNER JOIN users u ON u.id = us.user_id
         WHERE us.token = $1 AND us.expires_at > NOW() AND u.deleted_at IS NULL`,
        [token]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
      return null;
    } catch (e) {
      console.error("[DB Repo] Failed to get user session by token:", e);
      return null;
    }
  }

  /**
   * Delete session by token (log out)
   */
  static async deleteUserSessionByToken(token: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return true;

    try {
      await pool.query("DELETE FROM user_sessions WHERE token = $1", [token]);
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to delete session:", e);
      return false;
    }
  }

  /**
   * Fetch a user by their associated reset token (Forgot / Reset Password use case)
   */
  static async getUserByResetToken(token: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;

    try {
      const res = await pool.query(
        "SELECT id, email, password_hash, role, failed_login_attempts, lockout_until, reset_token, reset_token_expires FROM users WHERE reset_token = $1 AND reset_token_expires > NOW() AND deleted_at IS NULL",
        [token]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
      return null;
    } catch (e) {
      console.error("[DB Repo] Failed to get user by reset token:", e);
      return null;
    }
  }
}
