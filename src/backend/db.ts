/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { Beneficiary, ProgramStatus, AuditLog, CustomField, OrganizationSettings, TrainingProgram, WorkflowHistory } from "../types";

const { Pool } = pg;
const DB_FILE = path.join(process.cwd(), "database_ideas_tvet.json");

// Pool instance. Created lazily to avoid immediate connection errors if CONFIG is not yet specified.
let pgPool: pg.Pool | null = null;
let isPgActive = false;
let healthCheckTimer: NodeJS.Timeout | null = null;

function triggerBackgroundHealthCheck() {
  if (healthCheckTimer) return;
  
  console.log("[DB] Connection issue detected. Scheduling background health checks to reconnect to PostgreSQL...");
  healthCheckTimer = setInterval(async () => {
    console.log("[DB Background Health Check] Attempting to test PostgreSQL connectivity...");
    const active = await checkPgStatusSilent();
    if (active) {
      console.log("[DB Background Health Check] PostgreSQL connectivity restored! Re-activating PostgreSQL mode.");
      isPgActive = true;
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
      }
    } else {
      console.log("[DB Background Health Check] PostgreSQL is still offline. Keeping local filesystem fallback active.");
    }
  }, 20000); // Retries every 20 seconds
  
  if (healthCheckTimer && typeof healthCheckTimer.unref === "function") {
    healthCheckTimer.unref();
  }
}

async function checkPgStatusSilent(): Promise<boolean> {
  const pool = getPgPool();
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (e) {
    return false;
  }
}

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
      connectionTimeoutMillis: 20000, // Increased to 20 seconds to survive serverless/Neon database coldstarts
      max: 15, // Keep connection count reasonable
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    });
    isPgActive = true;
    
    // Intercept idle client errors
    pgPool.on("error", (err) => {
      console.error("[DB Pool] Unexpected error on idle client:", err);
      const msg = err.message || "";
      if (msg.includes("timeout") || msg.includes("connect") || msg.includes("connection") || msg.includes("ECONN") || msg.includes("closed")) {
        isPgActive = false;
        triggerBackgroundHealthCheck();
      }
    });

    // Centralized safe proxy query interface to automatically fallback to JSON storage on connection loss
    const originalQuery = pgPool.query.bind(pgPool);
    pgPool.query = async function(this: any, ...args: any[]) {
      try {
        return await originalQuery(...args);
      } catch (err: any) {
        const msg = err.message || "";
        if (
          msg.includes("timeout") ||
          msg.includes("connect") ||
          msg.includes("connection") ||
          msg.includes("ECONN") ||
          msg.includes("closed")
        ) {
          console.warn("[DB] PostgreSQL connection failure detected on query execution. Engaging filesystem JSON storage fallback.", msg);
          isPgActive = false;
          triggerBackgroundHealthCheck();
        }
        throw err;
      }
    } as any;

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
    triggerBackgroundHealthCheck();
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
    bvn VARCHAR(50) UNIQUE,
    nin VARCHAR(50) UNIQUE,
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
    guardian_name VARCHAR(255),
    guardian_address TEXT,
    guardian_phone VARCHAR(50),
    physical_challenge VARCHAR(255),
    bank_account_holder VARCHAR(255),
    bank_name VARCHAR(150),
    bank_sort_code VARCHAR(50),
    bank_account_number VARCHAR(50),
    education_qualification VARCHAR(255),
    date_of_birth VARCHAR(100),
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

  -- Organization settings table
  CREATE TABLE IF NOT EXISTS organization_settings (
    id VARCHAR(50) PRIMARY KEY,
    organization_name VARCHAR(255) NOT NULL,
    tpm_name VARCHAR(255),
    tpm_title VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_address TEXT,
    letterhead_url TEXT,
    signature_url TEXT,
    stamp_url TEXT,
    watermark_text VARCHAR(255) DEFAULT 'SECURED REGISTRY DOCUMENT',
    watermark_enabled BOOLEAN DEFAULT TRUE,
    admission_letterhead_url TEXT,
    acceptance_letterhead_url TEXT,
    enrollment_letterhead_url TEXT,
    certificate_background_url TEXT,
    photo_album_header_url TEXT,
    training_venue TEXT,
    training_start_date VARCHAR(100),
    training_end_date VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Training Programs table
  CREATE TABLE IF NOT EXISTS training_programs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    sector VARCHAR(255),
    code VARCHAR(50),
    total_hours VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Certificates table
  CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(100) PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE UNIQUE,
    certificate_no VARCHAR(100) UNIQUE NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verify_stamp_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

  -- Centered archive for versioned generated documents
  CREATE TABLE IF NOT EXISTS generated_documents (
    id VARCHAR(100) PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    pdf_url TEXT NOT NULL,
    docx_url TEXT,
    generated_by VARCHAR(255),
    verification_code VARCHAR(100),
    verification_status VARCHAR(50) DEFAULT 'VALID',
    verification_date TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    email_delivery_status VARCHAR(50) DEFAULT 'Pending',
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
  CREATE INDEX IF NOT EXISTS idx_generated_documents_beneficiary_id ON generated_documents(beneficiary_id);

  -- Status history timeline table
  CREATE TABLE IF NOT EXISTS workflow_history (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_history_beneficiary_id ON workflow_history(beneficiary_id);
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
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS guardian_address TEXT;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS physical_challenge VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS bank_sort_code VARCHAR(50);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS education_qualification VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(100);
      
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS watermark_text VARCHAR(255) DEFAULT 'SECURED REGISTRY DOCUMENT';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT TRUE;
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS fme_logo_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS ideas_logo_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS world_bank_logo_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS nbte_logo_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS custom_logo_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS admission_letterhead_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS acceptance_letterhead_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS enrollment_letterhead_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS certificate_background_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS photo_album_header_url TEXT DEFAULT '';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS training_venue TEXT DEFAULT 'Government Technical College (GTC), Kano';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS training_start_date VARCHAR(100) DEFAULT 'October 12, 2026';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS training_end_date VARCHAR(100) DEFAULT 'December 18, 2026';
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS attendance_threshold INT DEFAULT 80;
      ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS completion_threshold INT DEFAULT 75;
    `);

    // Ensure document_delivery_logs is bootstrapped independently
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_delivery_logs (
        id VARCHAR(100) PRIMARY KEY,
        document_id VARCHAR(100),
        beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
        delivery_type VARCHAR(100) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        sent_by VARCHAR(255),
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(100) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_beneficiary_id ON document_delivery_logs(beneficiary_id);
    `);

    // Ensure generated_documents is bootstrapped independently
    await pool.query(`
      CREATE TABLE IF NOT EXISTS generated_documents (
        id VARCHAR(100) PRIMARY KEY,
        beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
        document_type VARCHAR(100) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        pdf_url TEXT NOT NULL,
        docx_url TEXT,
        generated_by VARCHAR(255),
        verification_code VARCHAR(100) UNIQUE,
        verification_status VARCHAR(50) DEFAULT 'VALID',
        verification_date TIMESTAMP WITH TIME ZONE,
        verified_at TIMESTAMP WITH TIME ZONE,
        email_delivery_status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_generated_documents_beneficiary_id ON generated_documents(beneficiary_id);
      
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_code VARCHAR(100);
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'VALID';
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS email_delivery_status VARCHAR(50) DEFAULT 'Pending';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'generated_documents_verification_code_unique'
        ) THEN
          ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_verification_code_unique UNIQUE (verification_code);
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END $$;
    `);

    // Ensure workflow_history is bootstrapped independently
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_history (
        id SERIAL PRIMARY KEY,
        beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        changed_by VARCHAR(255),
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_history_beneficiary_id ON workflow_history(beneficiary_id);
    `);

    // Bootstrap default system settings
    await pool.query(`
      INSERT INTO organization_settings (
        id, organization_name, tpm_name, tpm_title, contact_email, contact_phone, contact_address, letterhead_url, signature_url, stamp_url
      ) VALUES (
        'ideas_default',
        'State TVET Board, Kano',
        'Engr. Kabiru Mohammed',
        'Technical Project Manager (TPM)',
        'kano-tvet@ideas-initiative.org',
        '+234 803 123 4567',
        'No. 45 Gwarzo Road, Kano State, Nigeria',
        '', '', ''
      ) ON CONFLICT (id) DO NOTHING;
    `);

    // Bootstrap default training programs
    await pool.query(`
      INSERT INTO training_programs (id, name, sector, code, total_hours) VALUES
      ('prog_ch_repair', 'Computer Hardware and Cell Phone Repairs', 'ICT & digital skills', 'TP-ICT-001', '350'),
      ('prog_sol_inst', 'Solar Panel Installation and Maintenance', 'Energy & solar Tech', 'TP-ENG-002', '420')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Bootstrap secure user systems
    await seedAuthAndRoles(pool);

    // Ensure the ID generation sequence exists and is synchronized
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS ideas_beneficiary_id_seq START WITH 1;
      SELECT setval('ideas_beneficiary_id_seq', COALESCE((
        SELECT MAX(CAST(substring(id from '\\d+$') AS INTEGER)) 
        FROM beneficiaries 
        WHERE id ~ '-\\d+$'
      ), 0) + 1, false);
    `);

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
           custom_fields, tsp, program, skill_sector, status,
           admission_letter_url, acceptance_letter_url, enrollment_letter_url, certificate_url,
           guardian_name, guardian_address, guardian_phone, physical_challenge,
           bank_account_holder, bank_name, bank_sort_code, bank_account_number, education_qualification, date_of_birth,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
         ON CONFLICT (id) DO UPDATE SET 
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, other_name = EXCLUDED.other_name,
           gender = EXCLUDED.gender, bvn = EXCLUDED.bvn, nin = EXCLUDED.nin, state = EXCLUDED.state,
           city = EXCLUDED.city, phone_number = EXCLUDED.phone_number, email = EXCLUDED.email,
           residential_address = EXCLUDED.residential_address, batch = EXCLUDED.batch,
           custom_fields = EXCLUDED.custom_fields, status = EXCLUDED.status,
           admission_letter_url = EXCLUDED.admission_letter_url,
           acceptance_letter_url = EXCLUDED.acceptance_letter_url,
           enrollment_letter_url = EXCLUDED.enrollment_letter_url,
           certificate_url = EXCLUDED.certificate_url,
           guardian_name = EXCLUDED.guardian_name,
           guardian_address = EXCLUDED.guardian_address,
           guardian_phone = EXCLUDED.guardian_phone,
           physical_challenge = EXCLUDED.physical_challenge,
           bank_account_holder = EXCLUDED.bank_account_holder,
           bank_name = EXCLUDED.bank_name,
           bank_sort_code = EXCLUDED.bank_sort_code,
           bank_account_number = EXCLUDED.bank_account_number,
           education_qualification = EXCLUDED.education_qualification,
           date_of_birth = EXCLUDED.date_of_birth,
           updated_at = NOW()`,
        [
          b.id, b.photo || "", b.firstName, b.lastName, b.otherName || "", b.gender, b.bvn, b.nin,
          b.state, b.city, b.phoneNumber, b.email, b.residentialAddress, b.batch || `Batch ${new Date().getFullYear()}-C`,
          JSON.stringify(b.customFields || {}), b.tsp || "Unique Technology Nig. Ltd",
          b.program || "IDEAS-TVET", b.skillSector || "Computer Hardware and Cell Phone Repairs",
          b.status,
          b.admissionLetterUrl || "", b.acceptanceLetterUrl || "", b.enrollmentLetterUrl || "", b.certificateUrl || "",
          b.guardianName || "", b.guardianAddress || "", b.guardianPhone || "", b.physicalChallenge || "",
          b.bankAccountHolder || "", b.bankName || "", b.bankSortCode || "", b.bankAccountNumber || "", b.educationQualification || "", b.dateOfBirth || "",
          b.createdAt ? new Date(b.createdAt) : new Date(), b.updatedAt ? new Date(b.updatedAt) : new Date()
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
   * Queries and returns a list of active beneficiaries with pre-mapped joined records.
   * Leverages options to omit massive Base64 payloads and detail relations unless requested.
   */
  static async getBeneficiaries(options?: { includePhoto?: boolean; includeDetails?: boolean }): Promise<Beneficiary[]> {
    const includePhoto = options?.includePhoto ?? false;
    const includeDetails = options?.includeDetails ?? false;

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState().beneficiaries as Beneficiary[];
      return state.map(b => ({
        ...b,
        photo: includePhoto ? (b.photo || "") : "",
        hasPhoto: !!b.photo
      }));
    }

    try {
      const photoCol = includePhoto ? "b.photo" : "'' as photo";
      const queryStr = `
        SELECT b.id, ${photoCol}, (b.photo IS NOT NULL AND b.photo != '') as has_photo, b.first_name, b.last_name, b.other_name, b.gender, b.bvn, b.nin, 
               b.state, b.city, b.phone_number, b.email, b.residential_address, b.batch, 
               b.custom_fields, b.tsp, b.program, b.skill_sector, b.status, 
               b.admission_letter_url, b.acceptance_letter_url, b.enrollment_letter_url, b.certificate_url,
               b.guardian_name, b.guardian_address, b.guardian_phone, b.physical_challenge,
               b.bank_account_holder, b.bank_name, b.bank_sort_code, b.bank_account_number, b.education_qualification, b.date_of_birth,
               b.created_at, b.updated_at,
               adm.admission_status, adm.admission_ref, adm.admission_letter_generated_at, 
               adm.admission_letter_sent_at, adm.admission_form_completed, adm.admission_form_status, 
               adm.training_progress
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        WHERE b.deleted_at IS NULL
        ORDER BY b.created_at DESC
      `;
      
      const bRes = await pool.query(queryStr);
      if (bRes.rows.length === 0) return [];

      const payloadList: Beneficiary[] = [];

      for (const row of bRes.rows) {
        const bId = row.id;

        let docsList: any[] = [];
        let accVersions: any[] = [];
        let attendanceLogs: any[] = [];
        let eml: any = {};

        if (includeDetails) {
          // A. Documents List
          const docRes = await pool.query(
            "SELECT id, name, type, url, version, uploaded_at FROM documents WHERE beneficiary_id = $1 AND deleted_at IS NULL",
            [bId]
          );
          docsList = docRes.rows.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type,
            url: d.url,
            uploadedAt: d.uploaded_at.toISOString(),
            version: d.version || 1
          }));

          // B. Acceptance versions
          const accRes = await pool.query(
            "SELECT version, url, name, uploaded_at FROM acceptance_letters WHERE beneficiary_id = $1 AND deleted_at IS NULL ORDER BY version ASC",
            [bId]
          );
          accVersions = accRes.rows.map(ac => ({
            version: ac.version,
            url: ac.url,
            name: ac.name,
            uploadedAt: ac.uploaded_at.toISOString()
          }));

          // C. Attendance
          const attRes = await pool.query(
            "SELECT id, date, status, hours_logged FROM attendance_logs WHERE beneficiary_id = $1 AND deleted_at IS NULL ORDER BY date ASC",
            [bId]
          );
          attendanceLogs = attRes.rows.map(a => ({
            id: a.id,
            date: a.date.toISOString().split("T")[0],
            status: a.status as "Present" | "Absent" | "Excused",
            hoursLogged: parseFloat(a.hours_logged) || 0
          }));

          // D. Latest email logs
          const emailRes = await pool.query(
            `SELECT tracking_status, sender_emailstatus, smtp_error_details, tracking_history, delivery_history
             FROM email_logs
             WHERE beneficiary_id = $1 AND deleted_at IS NULL
             ORDER BY date_sent DESC LIMIT 1`,
            [bId]
          );
          eml = emailRes.rows[0] || {};
        }

        const beneficiary: Beneficiary = {
          id: row.id,
          photo: row.photo || "",
          hasPhoto: row.has_photo,
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

          admissionStatus: row.admission_status || "Draft",
          admissionRef: row.admission_ref || "",
          admissionLetterGeneratedAt: row.admission_letter_generated_at ? row.admission_letter_generated_at.toISOString() : undefined,
          admissionLetterSentAt: row.admission_letter_sent_at ? row.admission_letter_sent_at.toISOString() : undefined,
          admissionFormCompleted: !!row.admission_form_completed,
          admissionFormStatus: row.admission_form_status || "Pending",
          trainingProgress: row.training_progress || {},

          acceptanceLetterUploaded: accVersions.length > 0,
          acceptanceLetterUrl: row.acceptance_letter_url || (accVersions.length > 0 ? accVersions[accVersions.length - 1].url : undefined),
          acceptanceLetterUploadedAt: accVersions.length > 0 ? accVersions[accVersions.length - 1].uploadedAt : undefined,
          acceptanceLetterVersions: accVersions,
          documentsList: docsList,
          attendanceLogs,

          emailStatus: eml.tracking_status || "Not Sent",
          emailTrackingStatus: eml.sender_emailstatus || undefined,
          emailTrackingHistory: eml.tracking_history || [],
          smtpErrorDetails: eml.smtp_error_details || undefined,
          emailDeliveryHistory: eml.delivery_history || [],

          guardianName: row.guardian_name || "",
          guardianAddress: row.guardian_address || "",
          guardianPhone: row.guardian_phone || "",
          physicalChallenge: row.physical_challenge || "",
          bankAccountHolder: row.bank_account_holder || "",
          bankName: row.bank_name || "",
          bankSortCode: row.bank_sort_code || "",
          bankAccountNumber: row.bank_account_number || "",
          educationQualification: row.education_qualification || "",
          dateOfBirth: row.date_of_birth ? (row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split("T")[0] : row.date_of_birth) : ""
        };

        payloadList.push(beneficiary);
      }

      return payloadList;
    } catch (e) {
      console.error("[DB Repo] Failed to load beneficiaries from PG:", e);
      if (isPgActive) {
        throw e;
      }
      return loadJsonState().beneficiaries;
    }
  }

  /**
   * Retrieves a single beneficiary profile using its unique identifier.
   * Performs an optimized single query with child record hydration.
   */
  static async getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      return state.beneficiaries.find(b => b.id === id) || null;
    }

    try {
      const bRes = await pool.query(
        `SELECT id, photo, first_name, last_name, other_name, gender, bvn, nin, 
                state, city, phone_number, email, residential_address, batch, 
                custom_fields, tsp, program, skill_sector, status, 
                admission_letter_url, acceptance_letter_url, enrollment_letter_url, certificate_url,
                guardian_name, guardian_address, guardian_phone, physical_challenge,
                bank_account_holder, bank_name, bank_sort_code, bank_account_number, education_qualification, date_of_birth,
                created_at, updated_at
         FROM beneficiaries
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (bRes.rows.length === 0) return null;
      const row = bRes.rows[0];

      // Hydrate Admissions
      const admRes = await pool.query(
        `SELECT admission_status, admission_ref, admission_letter_generated_at, 
                admission_letter_sent_at, admission_form_completed, admission_form_status, 
                admission_form_data, admission_letter_versions, admission_form_versions, training_progress
         FROM admissions
         WHERE beneficiary_id = $1 AND deleted_at IS NULL`,
        [id]
      );
      const adm = admRes.rows[0] || {};

      // Hydrate Documents
      const docRes = await pool.query(
        "SELECT id, name, type, url, version, uploaded_at FROM documents WHERE beneficiary_id = $1 AND deleted_at IS NULL",
        [id]
      );
      const docsList = docRes.rows.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        url: d.url,
        uploadedAt: d.uploaded_at.toISOString(),
        version: d.version || 1
      }));

      // Hydrate Acceptance Letter versions
      const accRes = await pool.query(
        "SELECT version, url, name, uploaded_at FROM acceptance_letters WHERE beneficiary_id = $1 AND deleted_at IS NULL ORDER BY version ASC",
        [id]
      );
      const accVersions = accRes.rows.map(ac => ({
        version: ac.version,
        url: ac.url,
        name: ac.name,
        uploadedAt: ac.uploaded_at.toISOString()
      }));

      // Hydrate Attendance logs
      const attRes = await pool.query(
        "SELECT id, date, status, hours_logged FROM attendance_logs WHERE beneficiary_id = $1 AND deleted_at IS NULL ORDER BY date ASC",
        [id]
      );
      const attendanceLogs = attRes.rows.map(a => ({
        id: a.id,
        date: a.date.toISOString().split("T")[0],
        status: a.status as "Present" | "Absent" | "Excused",
        hoursLogged: parseFloat(a.hours_logged) || 0
      }));

      // Hydrate Email logs
      const emailRes = await pool.query(
        `SELECT tracking_status, sender_emailstatus, smtp_error_details, tracking_history, delivery_history
         FROM email_logs
         WHERE beneficiary_id = $1 AND deleted_at IS NULL
         ORDER BY date_sent DESC LIMIT 1`,
        [id]
      );
      const eml = emailRes.rows[0] || {};

      const beneficiary: Beneficiary = {
        id: row.id,
        photo: row.photo || "",
        hasPhoto: !!row.photo,
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

        admissionStatus: adm.admission_status || "Draft",
        admissionRef: adm.admission_ref || "",
        admissionLetterGeneratedAt: adm.admission_letter_generated_at ? adm.admission_letter_generated_at.toISOString() : undefined,
        admissionLetterSentAt: adm.admission_letter_sent_at ? adm.admission_letter_sent_at.toISOString() : undefined,
        admissionFormCompleted: !!adm.admission_form_completed,
        admissionFormStatus: adm.admission_form_status || "Pending",
        admissionFormData: adm.admission_form_data || {},
        admissionLetterVersions: adm.admission_letter_versions || [],
        admissionFormVersions: adm.admission_form_versions || [],
        trainingProgress: adm.training_progress || {},

        acceptanceLetterUploaded: accVersions.length > 0,
        acceptanceLetterUrl: row.acceptance_letter_url || (accVersions.length > 0 ? accVersions[accVersions.length - 1].url : undefined),
        acceptanceLetterUploadedAt: accVersions.length > 0 ? accVersions[accVersions.length - 1].uploadedAt : undefined,
        acceptanceLetterVersions: accVersions,
        documentsList: docsList,
        attendanceLogs,

        emailStatus: eml.tracking_status || "Not Sent",
        emailTrackingStatus: eml.sender_emailstatus || undefined,
        emailTrackingHistory: eml.tracking_history || [],
        smtpErrorDetails: eml.smtp_error_details || undefined,
        emailDeliveryHistory: eml.delivery_history || [],

        guardianName: row.guardian_name || "",
        guardianAddress: row.guardian_address || "",
        guardianPhone: row.guardian_phone || "",
        physicalChallenge: row.physical_challenge || "",
        bankAccountHolder: row.bank_account_holder || "",
        bankName: row.bank_name || "",
        bankSortCode: row.bank_sort_code || "",
        bankAccountNumber: row.bank_account_number || "",
        educationQualification: row.education_qualification || "",
        dateOfBirth: row.date_of_birth ? (row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split("T")[0] : row.date_of_birth) : ""
      };

      return beneficiary;
    } catch (e) {
      console.error("[DB Repo] Failed to get beneficiary by ID from PG:", e);
      if (isPgActive) {
        throw e;
      }
      const state = loadJsonState();
      return state.beneficiaries.find(b => b.id === id) || null;
    }
  }

  /**
   * Retrieves only the photo field of a specific beneficiary profile.
   * This is a critical performance optimization to avoid Neon payload overflow.
   */
  static async getBeneficiaryPhotoOnly(id: string): Promise<string> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const found = state.beneficiaries.find(b => b.id === id);
      return found ? (found.photo || "") : "";
    }
    try {
      const res = await pool.query(
        "SELECT photo FROM beneficiaries WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (res.rows.length === 0) return "";
      return res.rows[0].photo || "";
    } catch (e) {
      console.error("[DB Repo] Failed to get beneficiary photo only:", e);
      return "";
    }
  }

  /**
   * Retrieves photos of multiple beneficiaries in a single batch query.
   * Leverages options to omit massive Base64 payloads from list/all APIs.
   */
  static async getBeneficiaryPhotosBatch(ids: string[]): Promise<{ [id: string]: string }> {
    if (ids.length === 0) return {};
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const map: { [id: string]: string } = {};
      for (const id of ids) {
        const found = state.beneficiaries.find(b => b.id === id);
        map[id] = found ? (found.photo || "") : "";
      }
      return map;
    }
    try {
      const res = await pool.query(
        "SELECT id, photo FROM beneficiaries WHERE id = ANY($1) AND deleted_at IS NULL",
        [ids]
      );
      const map: { [id: string]: string } = {};
      for (const row of res.rows) {
        map[row.id] = row.photo || "";
      }
      return map;
    } catch (e) {
      console.error("[DB Repo] Failed to get database photos in batch:", e);
      return {};
    }
  }

  /**
   * Generates a bulletproof sequential ID, concurrent-safe using PG sequence or JSON state search
   */
  static async selectNextBeneficiaryId(year: number): Promise<string> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const ids = state.beneficiaries
        .map(b => {
          const match = b.id.match(/-(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        });
      const maxId = ids.length > 0 ? Math.max(...ids) : 0;
      const nextId = maxId + 1;
      const pad = String(nextId).padStart(3, "0");
      return `IDEAS-${year}-${pad}`;
    }

    try {
      const seqRes = await pool.query("SELECT nextval('ideas_beneficiary_id_seq') as val");
      const nextVal = seqRes.rows[0].val;
      const pad = String(nextVal).padStart(3, "0");
      return `IDEAS-${year}-${pad}`;
    } catch (e) {
      console.error("[DB Repo] Failed to get nextval for beneficiary ID sequence:", e);
      const countRes = await pool.query("SELECT count(*) as count FROM beneficiaries");
      const nextVal = parseInt(countRes.rows[0].count, 10) + 1;
      const pad = String(nextVal).padStart(3, "0");
      return `IDEAS-${year}-${pad}`;
    }
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
           guardian_name, guardian_address, guardian_phone, physical_challenge,
           bank_account_holder, bank_name, bank_sort_code, bank_account_number, education_qualification, date_of_birth,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
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
           guardian_name = EXCLUDED.guardian_name,
           guardian_address = EXCLUDED.guardian_address,
           guardian_phone = EXCLUDED.guardian_phone,
           physical_challenge = EXCLUDED.physical_challenge,
           bank_account_holder = EXCLUDED.bank_account_holder,
           bank_name = EXCLUDED.bank_name,
           bank_sort_code = EXCLUDED.bank_sort_code,
           bank_account_number = EXCLUDED.bank_account_number,
           education_qualification = EXCLUDED.education_qualification,
           date_of_birth = EXCLUDED.date_of_birth,
           updated_at = NOW()`,
        [
          b.id, b.photo || "", b.firstName, b.lastName, b.otherName || "", b.gender, b.bvn, b.nin,
          b.state, b.city, b.phoneNumber, b.email, b.residentialAddress, b.batch || `Batch ${new Date().getFullYear()}-C`,
          JSON.stringify(b.customFields || {}), b.tsp || "Unique Technology Nig. Ltd",
          b.program || "IDEAS-TVET", b.skillSector || "Computer Hardware and Cell Phone Repairs",
          b.status,
          b.admissionLetterUrl || "", b.acceptanceLetterUrl || "", b.enrollmentLetterUrl || "", b.certificateUrl || "",
          b.guardianName || "", b.guardianAddress || "", b.guardianPhone || "", b.physicalChallenge || "",
          b.bankAccountHolder || "", b.bankName || "", b.bankSortCode || "", b.bankAccountNumber || "", b.educationQualification || "", b.dateOfBirth || "",
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

  /**
   * Organization Settings Retrieval
   */
  static async getOrganizationSettings(): Promise<OrganizationSettings> {
    const defaultSettings: OrganizationSettings = {
      id: "ideas_default",
      organizationName: "State TVET Board, Kano",
      tpmName: "Engr. Kabiru Mohammed",
      tpmTitle: "Technical Project Manager (TPM)",
      contactEmail: "kano-tvet@ideas-initiative.org",
      contactPhone: "+234 803 123 4567",
      contactAddress: "No. 45 Gwarzo Road, Kano State, Nigeria",
      letterheadUrl: "",
      signatureUrl: "",
      stampUrl: "",
      fmeLogoUrl: "",
      ideasLogoUrl: "",
      worldBankLogoUrl: "",
      nbteLogoUrl: "",
      customLogoUrl: "",
      watermarkText: "SECURED REGISTRY DOCUMENT",
      watermarkEnabled: true,
      admissionLetterheadUrl: "",
      acceptanceLetterheadUrl: "",
      enrollmentLetterheadUrl: "",
      certificateBackgroundUrl: "",
      photoAlbumHeaderUrl: "",
      trainingVenue: "Government Technical College (GTC), Kano",
      trainingStartDate: "October 12, 2026",
      trainingEndDate: "December 18, 2026",
      attendanceThreshold: 80,
      completionThreshold: 75
    };

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return defaultSettings;
    }

    try {
      const res = await pool.query("SELECT id, organization_name, tpm_name, tpm_title, contact_email, contact_phone, contact_address, letterhead_url, signature_url, stamp_url, watermark_text, watermark_enabled, fme_logo_url, ideas_logo_url, world_bank_logo_url, nbte_logo_url, custom_logo_url, admission_letterhead_url, acceptance_letterhead_url, enrollment_letterhead_url, certificate_background_url, photo_album_header_url, training_venue, training_start_date, training_end_date, attendance_threshold, completion_threshold FROM organization_settings ORDER BY updated_at DESC LIMIT 1");
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          organizationName: row.organization_name,
          tpmName: row.tpm_name,
          tpmTitle: row.tpm_title,
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone,
          contactAddress: row.contact_address,
          letterheadUrl: row.letterhead_url || "",
          signatureUrl: row.signature_url || "",
          stampUrl: row.stamp_url || "",
          fmeLogoUrl: row.fme_logo_url || "",
          ideasLogoUrl: row.ideas_logo_url || "",
          worldBankLogoUrl: row.world_bank_logo_url || "",
          nbteLogoUrl: row.nbte_logo_url || "",
          customLogoUrl: row.custom_logo_url || "",
          watermarkText: row.watermark_text || "SECURED REGISTRY DOCUMENT",
          watermarkEnabled: row.watermark_enabled !== false,
          admissionLetterheadUrl: row.admission_letterhead_url || "",
          acceptanceLetterheadUrl: row.acceptance_letterhead_url || "",
          enrollmentLetterheadUrl: row.enrollment_letterhead_url || "",
          certificateBackgroundUrl: row.certificate_background_url || "",
          photoAlbumHeaderUrl: row.photo_album_header_url || "",
          trainingVenue: row.training_venue || "Government Technical College (GTC), Kano",
          trainingStartDate: row.training_start_date || "October 12, 2026",
          trainingEndDate: row.training_end_date || "December 18, 2026",
          attendanceThreshold: row.attendance_threshold !== null && row.attendance_threshold !== undefined ? parseInt(row.attendance_threshold) : 80,
          completionThreshold: row.completion_threshold !== null && row.completion_threshold !== undefined ? parseInt(row.completion_threshold) : 75
        };
      }
      return defaultSettings;
    } catch (e) {
      console.error("[DB Repo] Failed to load organization settings:", e);
      return defaultSettings;
    }
  }

  /**
   * Organization Settings Updates
   */
  static async updateOrganizationSettings(s: OrganizationSettings): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return true;
    }

    try {
      await pool.query(
        `INSERT INTO organization_settings (
          id, organization_name, tpm_name, tpm_title, contact_email, contact_phone, contact_address, letterhead_url, signature_url, stamp_url, watermark_text, watermark_enabled, fme_logo_url, ideas_logo_url, world_bank_logo_url, nbte_logo_url, custom_logo_url, admission_letterhead_url, acceptance_letterhead_url, enrollment_letterhead_url, certificate_background_url, photo_album_header_url, training_venue, training_start_date, training_end_date, attendance_threshold, completion_threshold, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
         ON CONFLICT (id) DO UPDATE SET
           organization_name = EXCLUDED.organization_name,
           tpm_name = EXCLUDED.tpm_name,
           tpm_title = EXCLUDED.tpm_title,
           contact_email = EXCLUDED.contact_email,
           contact_phone = EXCLUDED.contact_phone,
           contact_address = EXCLUDED.contact_address,
           letterhead_url = EXCLUDED.letterhead_url,
           signature_url = EXCLUDED.signature_url,
           stamp_url = EXCLUDED.stamp_url,
           watermark_text = EXCLUDED.watermark_text,
           watermark_enabled = EXCLUDED.watermark_enabled,
           fme_logo_url = EXCLUDED.fme_logo_url,
           ideas_logo_url = EXCLUDED.ideas_logo_url,
           world_bank_logo_url = EXCLUDED.world_bank_logo_url,
           nbte_logo_url = EXCLUDED.nbte_logo_url,
           custom_logo_url = EXCLUDED.custom_logo_url,
           admission_letterhead_url = EXCLUDED.admission_letterhead_url,
           acceptance_letterhead_url = EXCLUDED.acceptance_letterhead_url,
           enrollment_letterhead_url = EXCLUDED.enrollment_letterhead_url,
           certificate_background_url = EXCLUDED.certificate_background_url,
           photo_album_header_url = EXCLUDED.photo_album_header_url,
           training_venue = EXCLUDED.training_venue,
           training_start_date = EXCLUDED.training_start_date,
           training_end_date = EXCLUDED.training_end_date,
           attendance_threshold = EXCLUDED.attendance_threshold,
           completion_threshold = EXCLUDED.completion_threshold,
           updated_at = NOW()`,
        [
          s.id || "ideas_default", s.organizationName, s.tpmName, s.tpmTitle,
          s.contactEmail, s.contactPhone, s.contactAddress,
          s.letterheadUrl, s.signatureUrl, s.stampUrl,
          s.watermarkText || "SECURED REGISTRY DOCUMENT", s.watermarkEnabled !== false,
          s.fmeLogoUrl || "", s.ideasLogoUrl || "", s.worldBankLogoUrl || "", s.nbteLogoUrl || "", s.customLogoUrl || "",
          s.admissionLetterheadUrl || "", s.acceptanceLetterheadUrl || "", s.enrollmentLetterheadUrl || "", s.certificateBackgroundUrl || "", s.photoAlbumHeaderUrl || "",
          s.trainingVenue || "Government Technical College (GTC), Kano", s.trainingStartDate || "October 12, 2026", s.trainingEndDate || "December 18, 2026",
          s.attendanceThreshold !== undefined ? s.attendanceThreshold : 80,
          s.completionThreshold !== undefined ? s.completionThreshold : 75
        ]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to save organization settings:", e);
      return false;
    }
  }

  /**
   * Training Programs Retrieval
   */
  static async getTrainingPrograms(): Promise<TrainingProgram[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return [
        { id: "prog_ch_repair", name: "Computer Hardware and Cell Phone Repairs", sector: "ICT & digital skills", code: "TP-ICT-001", totalHours: "350" },
        { id: "prog_sol_inst", name: "Solar Panel Installation and Maintenance", sector: "Energy & solar Tech", code: "TP-ENG-002", totalHours: "420" }
      ];
    }

    try {
      const res = await pool.query("SELECT id, name, sector, code, total_hours FROM training_programs ORDER BY name ASC");
      return res.rows.map(row => ({
        id: row.id,
        name: row.name,
        sector: row.sector || "",
        code: row.code || "",
        totalHours: row.total_hours || ""
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to fetch training programs:", e);
      return [];
    }
  }

  /**
   * Save a training program/batch
   */
  static async saveTrainingProgram(tp: TrainingProgram): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return true;
    }
    try {
      await pool.query(
        `INSERT INTO training_programs (id, name, sector, code, total_hours)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           sector = EXCLUDED.sector,
           code = EXCLUDED.code,
           total_hours = EXCLUDED.total_hours`,
        [tp.id, tp.name, tp.sector, tp.code, tp.totalHours]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to save training program:", e);
      return false;
    }
  }

  /**
   * Delete a training program
   */
  static async deleteTrainingProgram(id: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return true;
    }
    try {
      await pool.query("DELETE FROM training_programs WHERE id = $1", [id]);
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to delete training program:", e);
      return false;
    }
  }

  /**
   * Save a generated document version to the centralized database
   */
  static async saveGeneratedDocument(doc: any): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // In simulation fallback mode, write to state and persist
      const state = loadJsonState() as any;
      if (!state.generatedDocuments) {
        state.generatedDocuments = [];
      }
      state.generatedDocuments.push(doc);
      saveJsonState(state);
      return true;
    }
    try {
      await pool.query(
        `INSERT INTO generated_documents (
          id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at,
          verification_code, verification_status, verification_date, verified_at, email_delivery_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           pdf_url = EXCLUDED.pdf_url,
           docx_url = EXCLUDED.docx_url,
           generated_by = EXCLUDED.generated_by,
           created_at = EXCLUDED.created_at,
           verification_code = EXCLUDED.verification_code,
           verification_status = EXCLUDED.verification_status,
           verification_date = EXCLUDED.verification_date,
           verified_at = EXCLUDED.verified_at,
           email_delivery_status = EXCLUDED.email_delivery_status`,
        [
          doc.id, doc.beneficiaryId, doc.documentType, doc.version, doc.pdfUrl, doc.docxUrl || null, doc.generatedBy, new Date(doc.createdAt),
          doc.verificationCode || null, doc.verificationStatus || "VALID",
          doc.verificationDate ? new Date(doc.verificationDate) : null,
          doc.verifiedAt ? new Date(doc.verifiedAt) : null,
          doc.emailDeliveryStatus || "Pending"
        ]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to save generated document:", e);
      return false;
    }
  }

  /**
   * Get the latest version number for a document type and beneficiary
   */
  static async getLatestDocumentVersion(beneficiaryId: string, documentType: string): Promise<number> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      const docs = (state.generatedDocuments || []).filter(
        (d: any) => d.beneficiaryId === beneficiaryId && d.documentType === documentType
      );
      if (docs.length === 0) return 0;
      return Math.max(...docs.map((d: any) => d.version));
    }
    try {
      const res = await pool.query(
        "SELECT COALESCE(MAX(version), 0) as max_version FROM generated_documents WHERE beneficiary_id = $1 AND document_type = $2",
        [beneficiaryId, documentType]
      );
      return parseInt(res.rows[0].max_version || '0');
    } catch (e) {
      console.error("[DB Repo] Failed to get latest document version:", e);
      return 0;
    }
  }

  /**
   * Fetch all generated documents for a specific beneficiary
   */
  static async getGeneratedDocuments(beneficiaryId: string): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      return (state.generatedDocuments || []).filter((d: any) => d.beneficiaryId === beneficiaryId);
    }
    try {
      const res = await pool.query(
        "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, verified_at, email_delivery_status FROM generated_documents WHERE beneficiary_id = $1 ORDER BY created_at DESC",
        [beneficiaryId]
      );
      return res.rows.map(row => ({
        id: row.id,
        beneficiaryId: row.beneficiary_id,
        documentType: row.document_type,
        version: row.version,
        pdfUrl: row.pdf_url,
        docxUrl: row.docx_url || undefined,
        generatedBy: row.generated_by,
        createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
        verificationCode: row.verification_code || undefined,
        verificationStatus: row.verification_status || undefined,
        verificationDate: row.verification_date ? row.verification_date.toISOString() : undefined,
        verifiedAt: row.verified_at ? row.verified_at.toISOString() : undefined,
        emailDeliveryStatus: row.email_delivery_status || undefined
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to get generated documents:", e);
      return [];
    }
  }

  /**
   * Save a workflow status history record
   */
  static async saveWorkflowHistory(h: WorkflowHistory): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // In simulation fallback mode, write to state and persist
      const state = loadJsonState() as any;
      if (!state.workflowHistory) {
        state.workflowHistory = [];
      }
      state.workflowHistory.push({
        id: "wf_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        ...h,
        changedAt: h.changedAt || new Date().toISOString()
      });
      saveJsonState(state);
      return true;
    }
    try {
      await pool.query(
        `INSERT INTO workflow_history (
          beneficiary_id, old_status, new_status, changed_by, changed_at, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          h.beneficiaryId,
          h.oldStatus,
          h.newStatus,
          h.changedBy,
          h.changedAt ? new Date(h.changedAt) : new Date(),
          h.remarks || ""
        ]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to save workflow history:", e);
      return false;
    }
  }

  /**
   * Fetch workflow status history for a beneficiary, sorted chronologically ascending
   */
  static async getWorkflowHistory(beneficiaryId: string): Promise<WorkflowHistory[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      return (state.workflowHistory || [])
        .filter((h: any) => h.beneficiaryId === beneficiaryId)
        .sort((a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
    }
    try {
      const res = await pool.query(
        "SELECT id, beneficiary_id, old_status, new_status, changed_by, changed_at, remarks FROM workflow_history WHERE beneficiary_id = $1 ORDER BY id ASC, changed_at ASC",
        [beneficiaryId]
      );
      return res.rows.map(row => ({
        id: row.id,
        beneficiaryId: row.beneficiary_id,
        oldStatus: row.old_status,
        newStatus: row.new_status,
        changedBy: row.changed_by,
        changedAt: row.changed_at ? row.changed_at.toISOString() : new Date().toISOString(),
        remarks: row.remarks || ""
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to get workflow history:", e);
      return [];
    }
  }

  /**
   * Fetch a generated document by verification code
   */
  static async getGeneratedDocumentByCode(code: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      return (state.generatedDocuments || []).find((d: any) => d.verificationCode?.toLowerCase() === code.toLowerCase()) || null;
    }
    try {
      const res = await pool.query(
        "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, verified_at, email_delivery_status FROM generated_documents WHERE LOWER(verification_code) = LOWER($1)",
        [code]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        beneficiaryId: row.beneficiary_id,
        documentType: row.document_type,
        version: row.version,
        pdfUrl: row.pdf_url,
        docxUrl: row.docx_url || undefined,
        generatedBy: row.generated_by,
        createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
        verificationCode: row.verification_code,
        verificationStatus: row.verification_status,
        verificationDate: row.verification_date ? row.verification_date.toISOString() : undefined,
        verifiedAt: row.verified_at ? row.verified_at.toISOString() : undefined,
        emailDeliveryStatus: row.email_delivery_status
      };
    } catch (e) {
      console.error("[DB Repo] Failed to get document by code:", e);
      return null;
    }
  }

  /**
   * Fetch a generated document by dynamic document ID
   */
  static async getGeneratedDocumentById(id: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      return (state.generatedDocuments || []).find((d: any) => d.id === id) || null;
    }
    try {
      const res = await pool.query(
        "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, verified_at, email_delivery_status FROM generated_documents WHERE id = $1",
        [id]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        beneficiaryId: row.beneficiary_id,
        documentType: row.document_type,
        version: row.version,
        pdfUrl: row.pdf_url,
        docxUrl: row.docx_url || undefined,
        generatedBy: row.generated_by,
        createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
        verificationCode: row.verification_code,
        verificationStatus: row.verification_status,
        verificationDate: row.verification_date ? row.verification_date.toISOString() : undefined,
        verifiedAt: row.verified_at ? row.verified_at.toISOString() : undefined,
        emailDeliveryStatus: row.email_delivery_status
      };
    } catch (e) {
      console.error("[DB Repo] Failed to get document by id:", e);
      return null;
    }
  }

  /**
   * Update generated document verification status
   */
  static async updateGeneratedDocumentVerificationStatus(id: string, status: string, date: Date | null): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      const doc = (state.generatedDocuments || []).find((d: any) => d.id === id);
      if (doc) {
        doc.verificationStatus = status;
        doc.verificationDate = date ? date.toISOString() : undefined;
        doc.verifiedAt = date ? date.toISOString() : undefined;
        saveJsonState(state);
        return true;
      }
      return false;
    }
    try {
      await pool.query(
        "UPDATE generated_documents SET verification_status = $1, verification_date = $2, verified_at = $2 WHERE id = $3",
        [status, date, id]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to update document verification status:", e);
      return false;
    }
  }

  /**
   * Update generated document email status
   */
  static async updateGeneratedDocumentEmailStatus(id: string, emailStatus: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      const doc = (state.generatedDocuments || []).find((d: any) => d.id === id);
      if (doc) {
        doc.emailDeliveryStatus = emailStatus;
        saveJsonState(state);
        return true;
      }
      return false;
    }
    try {
      await pool.query(
        "UPDATE generated_documents SET email_delivery_status = $1 WHERE id = $2",
        [emailStatus, id]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to update document email status:", e);
      return false;
    }
  }

  /**
   * Save a document delivery tracking log
   */
  static async saveDeliveryLog(log: {
    id?: string;
    documentId?: string;
    beneficiaryId: string;
    deliveryType: string;
    recipient: string;
    sentBy: string;
    sentAt?: string;
    status: string;
  }): Promise<boolean> {
    const pool = getPgPool();
    const id = log.id || "dl_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const sentAt = log.sentAt ? new Date(log.sentAt) : new Date();

    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      if (!state.deliveryLogs) {
        state.deliveryLogs = [];
      }
      state.deliveryLogs.push({
        id,
        documentId: log.documentId || null,
        beneficiaryId: log.beneficiaryId,
        deliveryType: log.deliveryType,
        recipient: log.recipient,
        sentBy: log.sentBy,
        sentAt: sentAt.toISOString(),
        status: log.status
      });
      saveJsonState(state);
      return true;
    }
    try {
      await pool.query(
        `INSERT INTO document_delivery_logs (
          id, document_id, beneficiary_id, delivery_type, recipient, sent_by, sent_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           sent_at = EXCLUDED.sent_at`,
        [
          id,
          log.documentId || null,
          log.beneficiaryId,
          log.deliveryType,
          log.recipient,
          log.sentBy,
          sentAt,
          log.status
        ]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to save document delivery log:", e);
      return false;
    }
  }

  /**
   * Fetch document delivery tracking logs for a beneficiary
   */
  static async getDeliveryLogs(beneficiaryId: string): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      return (state.deliveryLogs || []).filter((l: any) => l.beneficiaryId === beneficiaryId);
    }
    try {
      const res = await pool.query(
        `SELECT id, document_id as "documentId", beneficiary_id as "beneficiaryId",
                delivery_type as "deliveryType", recipient, sent_by as "sentBy",
                sent_at as "sentAt", status
         FROM document_delivery_logs
         WHERE beneficiary_id = $1
         ORDER BY sent_at DESC`,
        [beneficiaryId]
      );
      return res.rows;
    } catch (e) {
      console.error("[DB Repo] Failed to get delivery logs:", e);
      return [];
    }
  }

  /**
   * Fetch aggregated statistics for admissions
   */
  static async getAdmissionsStats(): Promise<{
    summary: { total: number; pending: number; underReview: number; admitted: number; rejected: number };
    bySector: { [key: string]: number };
    byProgram: { [key: string]: number };
    byTsp: { [key: string]: number };
    byState: { [key: string]: number };
    byLga: { [key: string]: number };
  }> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // In JSON simulation, scan in memory
      const state = loadJsonState();
      const beneficiariesList = state.beneficiaries as Beneficiary[];
      
      const summary = { total: 0, pending: 0, underReview: 0, admitted: 0, rejected: 0 };
      const bySector: { [key: string]: number } = {};
      const byProgram: { [key: string]: number } = {};
      const byTsp: { [key: string]: number } = {};
      const byState: { [key: string]: number } = {};
      const byLga: { [key: string]: number } = {};

      for (const b of beneficiariesList) {
        summary.total++;
        const statusStr = (b.admissionStatus || "Pending").toLowerCase();

        if (statusStr === "accepted" || statusStr === "admitted" || statusStr === "enrolled" || statusStr === "training in progress" || statusStr === "training completed" || statusStr === "certified" || statusStr === "alumni") {
          summary.admitted++;
        } else if (statusStr === "acceptance rejected" || statusStr === "rejected") {
          summary.rejected++;
        } else if (statusStr === "under review" || statusStr === "acceptance uploaded") {
          summary.underReview++;
        } else {
          summary.pending++;
        }

        const sector = b.skillSector || "Computer Repairs";
        bySector[sector] = (bySector[sector] || 0) + 1;

        const program = b.program || "IDEAS-TVET";
        byProgram[program] = (byProgram[program] || 0) + 1;

        const tsp = b.tsp || "Unique Technology Nig. Ltd";
        byTsp[tsp] = (byTsp[tsp] || 0) + 1;

        const stateName = (b.state || "Unassigned").replace(" State", "");
        byState[stateName] = (byState[stateName] || 0) + 1;

        const city = b.city || "Owerri Central";
        byLga[city] = (byLga[city] || 0) + 1;
      }

      return { summary, bySector, byProgram, byTsp, byState, byLga };
    }

    try {
      // Direct high-efficiency groupings in Postgres
      const summaryRes = await pool.query(`
        SELECT COALESCE(adm.admission_status, 'Pending') as status, COUNT(*) as count
         FROM beneficiaries b
         LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
         WHERE b.deleted_at IS NULL
         GROUP BY COALESCE(adm.admission_status, 'Pending')
      `);

      const summary = { total: 0, pending: 0, underReview: 0, admitted: 0, rejected: 0 };
      for (const r of summaryRes.rows) {
        const val = parseInt(r.count, 10);
        summary.total += val;
        const statusStr = r.status.toLowerCase();

        if (statusStr === "accepted" || statusStr === "admitted" || statusStr === "enrolled" || statusStr === "training in progress" || statusStr === "training completed" || statusStr === "certified" || statusStr === "alumni") {
          summary.admitted += val;
        } else if (statusStr === "acceptance rejected" || statusStr === "rejected") {
          summary.rejected += val;
        } else if (statusStr === "under review" || statusStr === "acceptance uploaded") {
          summary.underReview += val;
        } else {
          summary.pending += val;
        }
      }

      const sectorRes = await pool.query(`
        SELECT b.skill_sector, COUNT(*) as count 
         FROM beneficiaries b WHERE b.deleted_at IS NULL GROUP BY b.skill_sector
      `);
      const bySector: { [key: string]: number } = {};
      for (const r of sectorRes.rows) {
        bySector[r.skill_sector || "Computer Repairs"] = parseInt(r.count, 10);
      }

      const programRes = await pool.query(`
        SELECT b.program, COUNT(*) as count 
         FROM beneficiaries b WHERE b.deleted_at IS NULL GROUP BY b.program
      `);
      const byProgram: { [key: string]: number } = {};
      for (const r of programRes.rows) {
        byProgram[r.program || "IDEAS-TVET"] = parseInt(r.count, 10);
      }

      const tspRes = await pool.query(`
        SELECT b.tsp, COUNT(*) as count 
         FROM beneficiaries b WHERE b.deleted_at IS NULL GROUP BY b.tsp
      `);
      const byTsp: { [key: string]: number } = {};
      for (const r of tspRes.rows) {
        byTsp[r.tsp || "Unique Tech"] = parseInt(r.count, 10);
      }

      const stateRes = await pool.query(`
        SELECT b.state, COUNT(*) as count 
         FROM beneficiaries b WHERE b.deleted_at IS NULL GROUP BY b.state
      `);
      const byState: { [key: string]: number } = {};
      for (const r of stateRes.rows) {
        const name = (r.state || "Unassigned").replace(" State", "");
        byState[name] = parseInt(r.count, 10);
      }

      const lgaRes = await pool.query(`
        SELECT b.city, COUNT(*) as count 
         FROM beneficiaries b WHERE b.deleted_at IS NULL GROUP BY b.city
      `);
      const byLga: { [key: string]: number } = {};
      for (const r of lgaRes.rows) {
        byLga[r.city || "Owerri Central"] = parseInt(r.count, 10);
      }

      return { summary, bySector, byProgram, byTsp, byState, byLga };
    } catch (e) {
      console.error("[DB Repo] Failed to load admissions stats:", e);
      return {
        summary: { total: 0, pending: 0, underReview: 0, admitted: 0, rejected: 0 },
        bySector: {}, byProgram: {}, byTsp: {}, byState: {}, byLga: {}
      };
    }
  }

  /**
   * Fetch paginated list of admissions with selective non-photo column projections
   */
  static async getAdmissionsPaged(options: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    sector?: string;
    tsp?: string;
    state?: string;
    dateApplied?: string;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
  }): Promise<{
    rows: Array<{
      id: string;
      referenceNumber: string;
      name: string;
      sector: string;
      tsp: string;
      admissionStatus: string;
      hasPhoto: boolean;
      state: string;
      batch: string;
      createdAt: string;
    }>;
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(100, Math.max(1, options.pageSize));
    const offset = (page - 1) * pageSize;
    const search = options.search || "";
    const status = options.status || "all";
    const sector = options.sector || "all";
    const tsp = options.tsp || "all";
    const state = options.state || "all";
    
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // In JSON simulation, read list on the fly
      const stateData = loadJsonState();
      let list = stateData.beneficiaries as Beneficiary[];

      // Filter in memory
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(b => 
          (b.firstName || "").toLowerCase().includes(q) ||
          (b.lastName || "").toLowerCase().includes(q) ||
          (b.id || "").toLowerCase().includes(q) ||
          (b.nin || "").includes(q) ||
          (b.bvn || "").includes(q)
        );
      }

      if (status !== "all") {
        list = list.filter(b => (b.admissionStatus || "Pending").toLowerCase() === status.toLowerCase());
      }
      if (sector !== "all") {
        list = list.filter(b => b.skillSector === sector);
      }
      if (tsp !== "all") {
        list = list.filter(b => b.tsp === tsp);
      }
      if (state !== "all") {
        list = list.filter(b => b.state === state);
      }

      // Sort in memory
      const sortBy = options.sortBy || "createdAt";
      const sortOrder = options.sortOrder || "DESC";
      list = list.sort((a: any, b: any) => {
        let valA = a[sortBy] || "";
        let valB = b[sortBy] || "";
        if (sortOrder === "ASC") {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });

      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / pageSize) || 1;
      const sliced = list.slice(offset, offset + pageSize);

      const rows = sliced.map(b => ({
        id: b.id,
        referenceNumber: b.admissionRef || "DRAFT",
        name: `${b.lastName}, ${b.firstName}`,
        sector: b.skillSector,
        tsp: b.tsp,
        admissionStatus: b.admissionStatus || "Pending",
        hasPhoto: b.photo ? (b.photo.length > 5) : false,
        state: b.state,
        batch: b.batch,
        createdAt: b.createdAt
      }));

      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      // 1. Build dynamic parameterized SQL search conditions
      const selectParts = [
        "b.id",
        "COALESCE(adm.admission_ref, 'DRAFT') as reference_number",
        "b.first_name",
        "b.last_name",
        "b.skill_sector",
        "b.tsp",
        "COALESCE(adm.admission_status, 'Pending') as admission_status",
        "(b.photo IS NOT NULL AND b.photo != '') as has_photo",
        "b.state",
        "b.batch",
        "b.created_at"
      ];

      let queryWhere = "WHERE b.deleted_at IS NULL ";
      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        const searchPattern = `%${search.toLowerCase()}%`;
        queryWhere += `AND (LOWER(b.first_name) LIKE $${paramCount} OR LOWER(b.last_name) LIKE $${paramCount} OR LOWER(b.id) LIKE $${paramCount} OR LOWER(b.nin) LIKE $${paramCount} OR LOWER(b.bvn) LIKE $${paramCount}) `;
        params.push(searchPattern);
        paramCount++;
      }

      if (status !== "all") {
        queryWhere += `AND COALESCE(adm.admission_status, 'Pending') = $${paramCount} `;
        params.push(status);
        paramCount++;
      }

      if (sector !== "all") {
        queryWhere += `AND b.skill_sector = $${paramCount} `;
        params.push(sector);
        paramCount++;
      }

      if (tsp !== "all") {
        queryWhere += `AND b.tsp = $${paramCount} `;
        params.push(tsp);
        paramCount++;
      }

      if (state !== "all") {
        queryWhere += `AND b.state = $${paramCount} `;
        params.push(state);
        paramCount++;
      }

      // Count Query
      const countRes = await pool.query(
        `SELECT COUNT(*) as count 
         FROM beneficiaries b
         LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
         ${queryWhere}`,
        params
      );
      const totalCount = parseInt(countRes.rows[0].count || "0", 10);
      const totalPages = Math.ceil(totalCount / pageSize) || 1;

      // sorting
      const sortColumn = options.sortBy === "name" ? "b.last_name" : "b.created_at";
      const sortDirection = options.sortOrder === "ASC" ? "ASC" : "DESC";

      // Append limits/offset parameters for safe retrieval block
      const paginationParams = [...params, pageSize, offset];
      const limitParamIndex = paramCount;
      const offsetParamIndex = paramCount + 1;

      const pagedStr = `
        SELECT ${selectParts.join(", ")}
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        ${queryWhere}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `;

      const rowsRes = await pool.query(pagedStr, paginationParams);
      const rows = rowsRes.rows.map(r => ({
        id: r.id,
        referenceNumber: r.reference_number,
        name: `${r.last_name}, ${r.first_name}`,
        sector: r.skill_sector,
        tsp: r.tsp,
        admissionStatus: r.admission_status,
        hasPhoto: !!r.has_photo,
        state: r.state,
        batch: r.batch,
        createdAt: r.created_at.toISOString()
      }));

      return { rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DB Repo] Failed to get paginated admissions records:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 1 };
    }
  }
}
