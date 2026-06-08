/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { Beneficiary, ProgramStatus, AuditLog, CustomField, OrganizationSettings, TrainingProgram, WorkflowHistory, InstitutionLetterhead, AdmissionFormTemplate } from "../types";

const { Pool } = pg;
const DB_FILE = path.join(process.cwd(), "database_ideas_tvet.json");

export function calculateAge(dob: string | undefined | null): number | null {
  if (!dob) return null;
  const cleanDob = dob.trim();
  if (!cleanDob) return null;
  
  const parsed = Date.parse(cleanDob);
  let date: Date;
  if (!isNaN(parsed)) {
    date = new Date(parsed);
  } else {
    // If Date.parse fails, try splitting by common formats
    const parts = cleanDob.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY or MM-DD-YYYY or DD/MM/YYYY
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  if (isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age;
}

export function getDynamicEligibility(b: any): { age: number | null; eligibilityStatus: "ELIGIBLE" | "OVER_AGE" | "UNKNOWN_DOB" | "OVERRIDDEN" } {
  if (b.eligibilityOverride || b.eligibility_override) {
    return {
      age: calculateAge(b.dateOfBirth || b.date_of_birth),
      eligibilityStatus: "OVERRIDDEN"
    };
  }
  const dob = b.dateOfBirth || b.date_of_birth;
  if (!dob) {
    return {
      age: null,
      eligibilityStatus: "UNKNOWN_DOB"
    };
  }
  const age = calculateAge(dob);
  if (age === null) {
    return {
      age: null,
      eligibilityStatus: "UNKNOWN_DOB"
    };
  }
  if (age <= 35) {
    return {
      age,
      eligibilityStatus: "ELIGIBLE"
    };
  } else {
    return {
      age,
      eligibilityStatus: "OVER_AGE"
    };
  }
}

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
    beneficiary_status VARCHAR(50) DEFAULT 'ACTIVE',
    status_reason TEXT,
    status_changed_at TIMESTAMP WITH TIME ZONE,
    status_changed_by VARCHAR(100),
    is_archived BOOLEAN DEFAULT FALSE,
    eligibility_override BOOLEAN DEFAULT FALSE,
    eligibility_override_reason TEXT,
    eligibility_override_by VARCHAR(255),
    eligibility_override_at TIMESTAMP WITH TIME ZONE,
    certification_status VARCHAR(50) DEFAULT 'NONE',
    certificate_number VARCHAR(100),
    certificate_issued_at TIMESTAMP WITH TIME ZONE,
    certificate_issued_by VARCHAR(255),
    graduation_batch VARCHAR(100),
    alumni_status BOOLEAN DEFAULT FALSE,
    certificate_reference VARCHAR(255),
    certificate_verification_code VARCHAR(255),
    certificate_download_count INTEGER DEFAULT 0,
    certificate_last_downloaded_at TIMESTAMP WITH TIME ZONE,
    alumni_employment_status VARCHAR(100),
    alumni_entrepreneur_status VARCHAR(100),
    alumni_business_name VARCHAR(255),
    alumni_current_employer VARCHAR(255),
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
    admission_form_ref VARCHAR(100) UNIQUE,
    admission_letter_generated_at TIMESTAMP WITH TIME ZONE,
    admission_letter_sent_at TIMESTAMP WITH TIME ZONE,
    admission_form_completed BOOLEAN DEFAULT false,
    admission_form_status VARCHAR(50) DEFAULT 'Pending',
    admission_form_data JSONB DEFAULT '{}'::jsonb,
    admission_form_generated_at TIMESTAMP WITH TIME ZONE,
    admission_form_confirmed_at TIMESTAMP WITH TIME ZONE,
    admission_form_viewed_at TIMESTAMP WITH TIME ZONE,
    admission_form_pdf_url TEXT,
    admission_letter_versions JSONB DEFAULT '[]'::jsonb,
    admission_form_versions JSONB DEFAULT '[]'::jsonb,
    training_progress JSONB DEFAULT '{}'::jsonb,
    acceptance_letter_uploaded_at TIMESTAMP WITH TIME ZONE,
    acceptance_letter_status VARCHAR(100) DEFAULT 'Pending',
    acceptance_letter_url TEXT,
    acceptance_letter_checked_by VARCHAR(255),
    acceptance_letter_checked_at TIMESTAMP WITH TIME ZONE,
    acceptance_letter_remarks TEXT,
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
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_state ON beneficiaries(state) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_tsp ON beneficiaries(tsp) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_skill_sector ON beneficiaries(skill_sector) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(admission_status) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_admissions_acceptance_status ON admissions(acceptance_letter_status) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_state_status ON beneficiaries(state, status) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_tsp_status ON beneficiaries(tsp, status) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_skill_sector_status ON beneficiaries(skill_sector, status) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_admissions_benefic_delat ON admissions(beneficiary_id) WHERE deleted_at IS NULL;

  -- Status history timeline table
  CREATE TABLE IF NOT EXISTS workflow_history (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    reason TEXT,
    ip_address VARCHAR(100)
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_history_beneficiary_id ON workflow_history(beneficiary_id);

  -- Institution letterheads library table
  CREATE TABLE IF NOT EXISTS institution_letterheads (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_type VARCHAR(20) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    uploaded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_institution_letterheads_default ON institution_letterheads(is_default) WHERE is_default = TRUE;

  -- Document dispatches log & tracking table
  CREATE TABLE IF NOT EXISTS document_dispatches (
    id UUID PRIMARY KEY,
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_reference VARCHAR(100),
    email_address VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    downloaded_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    delivery_provider VARCHAR(100),
    message_id VARCHAR(255),
    secure_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_dispatch_status ON document_dispatches(status);
  CREATE INDEX IF NOT EXISTS idx_dispatch_beneficiary ON document_dispatches(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_dispatch_token ON document_dispatches(secure_token);
  CREATE INDEX IF NOT EXISTS idx_dispatch_document ON document_dispatches(document_type);

  -- Email templates table
  CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Trainee Profiles table (Annex 9)
  CREATE TABLE IF NOT EXISTS trainee_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id VARCHAR(50) NOT NULL UNIQUE REFERENCES beneficiaries(id) ON DELETE CASCADE,
    tvet_id VARCHAR(100),
    nin VARCHAR(50),
    bvn VARCHAR(50),
    bank_name VARCHAR(255),
    account_name VARCHAR(255),
    account_number VARCHAR(50),
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(50),
    education_level VARCHAR(255),
    employment_status VARCHAR(255),
    training_status VARCHAR(255),
    sector VARCHAR(255),
    skill VARCHAR(255),
    state VARCHAR(255),
    tsp VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_trainee_profiles_beneficiary ON trainee_profiles(beneficiary_id);

  -- Trainee Attendance table (Annex 9)
  CREATE TABLE IF NOT EXISTS trainee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id VARCHAR(50) NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    attendance_source VARCHAR(50) DEFAULT 'MANUAL',
    status VARCHAR(50) DEFAULT 'PRESENT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (beneficiary_id, attendance_date)
  );
  CREATE INDEX IF NOT EXISTS idx_trainee_attendance_beneficiary ON trainee_attendance(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_trainee_attendance_date ON trainee_attendance(attendance_date);

  -- Portal Monitoring table (Annex 9)
  CREATE TABLE IF NOT EXISTS portal_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id VARCHAR(50) NOT NULL UNIQUE REFERENCES beneficiaries(id) ON DELETE CASCADE,
    still_on_portal BOOLEAN DEFAULT TRUE,
    still_attending BOOLEAN DEFAULT TRUE,
    last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_portal_monitoring_beneficiary ON portal_monitoring(beneficiary_id);
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
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS beneficiary_status VARCHAR(50) DEFAULT 'ACTIVE';
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS status_reason TEXT;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR(100);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS eligibility_override BOOLEAN DEFAULT FALSE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS eligibility_override_reason TEXT;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS eligibility_override_by VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS eligibility_override_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certification_status VARCHAR(50) DEFAULT 'NONE';
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(100);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_issued_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_issued_by VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS graduation_batch VARCHAR(100);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS alumni_status BOOLEAN DEFAULT FALSE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_reference VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_verification_code VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_download_count INTEGER DEFAULT 0;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS certificate_last_downloaded_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS alumni_employment_status VARCHAR(100);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS alumni_entrepreneur_status VARCHAR(100);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS alumni_business_name VARCHAR(255);
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS alumni_current_employer VARCHAR(255);
      
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

      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS acceptance_letter_uploaded_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS acceptance_letter_status VARCHAR(100) DEFAULT 'Pending';
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS acceptance_letter_url TEXT;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS acceptance_letter_checked_by VARCHAR(255);
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS acceptance_letter_checked_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS acceptance_letter_remarks TEXT;
      
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_completed BOOLEAN DEFAULT false;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_status VARCHAR(50) DEFAULT 'Pending';
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_data JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_generated_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_confirmed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_viewed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_pdf_url TEXT;
      ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_form_ref VARCHAR(100) UNIQUE;
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
        remarks TEXT,
        reason TEXT,
        ip_address VARCHAR(100)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_history_beneficiary_id ON workflow_history(beneficiary_id);
      
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS reason TEXT;
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
    `);

    // Ensure admission_form_templates table is bootstrapped independently
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admission_form_templates (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        file_type VARCHAR(20) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        uploaded_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_admission_form_templates_default ON admission_form_templates(is_default) WHERE is_default = TRUE;
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

    // Bootstrap Annex 9 tables and columns
    await pool.query(`
      -- 1. Create readiness_metrics
      CREATE TABLE IF NOT EXISTS readiness_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiary_id VARCHAR(50) NOT NULL UNIQUE REFERENCES beneficiaries(id) ON DELETE CASCADE,
        attendance_percentage NUMERIC(5, 2) DEFAULT 0.00,
        portal_active VARCHAR(10) DEFAULT 'YES',
        training_status VARCHAR(50) DEFAULT 'ACTIVE',
        readiness_status VARCHAR(50) DEFAULT 'NOT_READY',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Create biometric_devices
      CREATE TABLE IF NOT EXISTS biometric_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_name VARCHAR(255) NOT NULL,
        serial_number VARCHAR(100) UNIQUE NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'ONLINE',
        last_sync_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 3. Create biometric_import_logs
      CREATE TABLE IF NOT EXISTS biometric_import_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id VARCHAR(100),
        records_imported INT DEFAULT 0,
        records_failed INT DEFAULT 0,
        imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. Alter trainee_attendance for enterprise fields
      ALTER TABLE trainee_attendance ADD COLUMN IF NOT EXISTS captured_by VARCHAR(100);
      ALTER TABLE trainee_attendance ADD COLUMN IF NOT EXISTS remarks TEXT;
      
      -- 5. Alter portal_monitoring for verified_by
      ALTER TABLE portal_monitoring ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255);
      
      -- 6. Seed sample biometric devices if none exist
      INSERT INTO biometric_devices (device_name, serial_number, location, status, last_sync_at)
      VALUES 
        ('ZKAccess 3.5 Terminal A', 'SN-ZKT-90821-X', 'Main Lab Computer Lab 1', 'ONLINE', NOW() - INTERVAL '2 hours'),
        ('ZKAccess 3.5 Terminal B', 'SN-ZKT-90822-Y', 'Workshop Repairs Annex B', 'OFFLINE', NOW() - INTERVAL '1 day')
      ON CONFLICT (serial_number) DO NOTHING;

      -- 7. Create training_outcomes table
      CREATE TABLE IF NOT EXISTS training_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiary_id VARCHAR(50) NOT NULL UNIQUE REFERENCES beneficiaries(id) ON DELETE CASCADE,
        outcome_status VARCHAR(50) NOT NULL,
        employment_type VARCHAR(50),
        employer_name TEXT,
        job_title TEXT,
        business_name TEXT,
        business_type TEXT,
        employment_date DATE,
        monthly_income NUMERIC(12, 2) DEFAULT 0.00,
        business_revenue NUMERIC(12, 2) DEFAULT 0.00,
        location TEXT,
        verified BOOLEAN DEFAULT FALSE,
        verified_by TEXT,
        verified_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_outcomes_beneficiary ON training_outcomes(beneficiary_id);
      CREATE INDEX IF NOT EXISTS idx_training_outcomes_status ON training_outcomes(outcome_status);

      -- 8. Create tracer_studies table
      CREATE TABLE IF NOT EXISTS tracer_studies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiary_id VARCHAR(50) NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
        follow_up_period VARCHAR(20) NOT NULL,
        is_employed BOOLEAN DEFAULT FALSE,
        is_self_employed BOOLEAN DEFAULT FALSE,
        owns_business BOOLEAN DEFAULT FALSE,
        is_business_active BOOLEAN DEFAULT FALSE,
        income_improved BOOLEAN DEFAULT FALSE,
        needs_support TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (beneficiary_id, follow_up_period)
      );
      CREATE INDEX IF NOT EXISTS idx_tracer_studies_beneficiary ON tracer_studies(beneficiary_id);

      -- 9. Create impact_evidence table
      CREATE TABLE IF NOT EXISTS impact_evidence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiary_id VARCHAR(50) NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
        evidence_type VARCHAR(100) NOT NULL,
        outcome_type VARCHAR(100) NOT NULL,
        file_url TEXT NOT NULL,
        file_name TEXT,
        file_size BIGINT,
        file_type VARCHAR(50),
        description TEXT,
        verification_status VARCHAR(50) DEFAULT 'PENDING',
        verified_by VARCHAR(255),
        verified_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        uploaded_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_impact_evidence_beneficiary ON impact_evidence(beneficiary_id);
      CREATE INDEX IF NOT EXISTS idx_impact_evidence_ver_status ON impact_evidence(verification_status);

      -- 10. Create field_verifications table
      CREATE TABLE IF NOT EXISTS field_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiary_id VARCHAR(50) NOT NULL UNIQUE REFERENCES beneficiaries(id) ON DELETE CASCADE,
        visited BOOLEAN DEFAULT FALSE,
        visit_date DATE,
        officer_name VARCHAR(255),
        gps_coordinates VARCHAR(100),
        remarks TEXT,
        photos TEXT,
        verification_result VARCHAR(100),
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_field_verifications_beneficiary ON field_verifications(beneficiary_id);

      -- 11. Create toolkit_assets table
      CREATE TABLE IF NOT EXISTS toolkit_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_code VARCHAR(100) NOT NULL UNIQUE,
        asset_name VARCHAR(255) NOT NULL,
        asset_category VARCHAR(100) NOT NULL,
        training_track VARCHAR(100) NOT NULL,
        description TEXT,
        unit_cost NUMERIC(12,2) DEFAULT 0.00,
        quantity INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_toolkit_assets_track ON toolkit_assets(training_track);
      CREATE INDEX IF NOT EXISTS idx_toolkit_assets_status ON toolkit_assets(status);

      -- 12. Create graduate_toolkits table
      CREATE TABLE IF NOT EXISTS graduate_toolkits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiary_id VARCHAR(50) NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES toolkit_assets(id) ON DELETE CASCADE,
        issue_date TIMESTAMP WITH TIME ZONE,
        issued_by VARCHAR(255),
        verification_status VARCHAR(50) DEFAULT 'ALLOCATED',
        utilization_status VARCHAR(50) DEFAULT 'NOT_IN_USE',
        condition_status VARCHAR(50) DEFAULT 'NEW',
        replacement_requested BOOLEAN DEFAULT FALSE,
        replacement_reason TEXT,
        last_verified_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (beneficiary_id, asset_id)
      );
      CREATE INDEX IF NOT EXISTS idx_graduate_toolkits_beneficiary ON graduate_toolkits(beneficiary_id);
      CREATE INDEX IF NOT EXISTS idx_graduate_toolkits_asset ON graduate_toolkits(asset_id);
    `);

    console.log("[DB] PostgreSQL schema verified and migration performed.");

    // Seed default toolkits and assets if empty
    try {
      const taCheck = await pool.query("SELECT COUNT(*)::int as count FROM toolkit_assets");
      if (taCheck.rows[0].count === 0) {
        console.log("[DB] Seeding default toolkit assets for Computer and Mobile Repairs...");
        const defaultAssets = [
          // Computer Hardware Repairs
          { code: "NWA-COMP-HW-01", name: "Laptop Repair Toolkit", cat: "Laptop Repair Toolkit", track: "Computer Hardware Repairs", cost: 15400.00, qty: 50 },
          { code: "NWA-COMP-HW-02", name: "Digital Multimeter (Pro)", cat: "Digital Multimeter", track: "Computer Hardware Repairs", cost: 8500.00, qty: 50 },
          { code: "NWA-COMP-HW-03", name: "Soldering Station (Adjustable)", cat: "Soldering Station", track: "Computer Hardware Repairs", cost: 18000.00, qty: 50 },
          { code: "NWA-COMP-HW-04", name: "Precision Screwdriver Set", cat: "Screwdriver Set", track: "Computer Hardware Repairs", cost: 4500.00, qty: 50 },
          { code: "NWA-COMP-HW-05", name: "ATX Power Supply Tester", cat: "Power Supply Tester", track: "Computer Hardware Repairs", cost: 6200.00, qty: 50 },
          { code: "NWA-COMP-HW-06", name: "Anti-Static ESD Wrist Strap & Mat", cat: "ESD Kit", track: "Computer Hardware Repairs", cost: 3500.00, qty: 50 },
          { code: "NWA-COMP-HW-07", name: "POST Diagnostic Card Tester", cat: "Diagnostic Tools", track: "Computer Hardware Repairs", cost: 7800.00, qty: 50 },
          { code: "NWA-COMP-HW-08", name: "Integrated Motherboard Reflow Kit", cat: "Motherboard Toolkit", track: "Computer Hardware Repairs", cost: 24500.00, qty: 50 },

          // Mobile Phone Repairs
          { code: "NWA-MOBL-PH-01", name: "Advanced Mobile Repair Toolkit", cat: "Mobile Repair Toolkit", track: "Mobile Phone Repairs", cost: 12500.00, qty: 50 },
          { code: "NWA-MOBL-PH-02", name: "SMD Rework Station (Heat Gun)", cat: "Heat Gun", track: "Mobile Phone Repairs", cost: 21000.00, qty: 50 },
          { code: "NWA-MOBL-PH-03", name: "Stereo Zoom Repair Microscope", cat: "Microscope", track: "Mobile Phone Repairs", cost: 35000.00, qty: 50 },
          { code: "NWA-MOBL-PH-04", name: "Fine Tip Soldering Iron", cat: "Soldering Iron", track: "Mobile Phone Repairs", cost: 5800.00, qty: 50 },
          { code: "NWA-MOBL-PH-05", name: "S2 Steel Precision Screwdriver Set", cat: "Precision Screwdriver Set", track: "Mobile Phone Repairs", cost: 4800.00, qty: 50 },
          { code: "NWA-MOBL-PH-06", name: "Plastic & Metal Opening Tool Kit", cat: "Opening Tool Kit", track: "Mobile Phone Repairs", cost: 2200.00, qty: 50 },
          { code: "NWA-MOBL-PH-07", name: "Regulated DC Power Supply Unit", cat: "Power Supply Unit", track: "Mobile Phone Repairs", cost: 16500.00, qty: 50 },
          { code: "NWA-MOBL-PH-08", name: "Automatic LCD Screen Separator", cat: "Screen Separation Tools", track: "Mobile Phone Repairs", cost: 28000.00, qty: 50 }
        ];

        for (const asset of defaultAssets) {
          await pool.query(`
            INSERT INTO toolkit_assets (asset_code, asset_name, asset_category, training_track, unit_cost, quantity, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
            ON CONFLICT (asset_code) DO NOTHING
          `, [asset.code, asset.name, asset.cat, asset.track, asset.cost, asset.qty]);
        }
        console.log("[DB] Seeding default toolkit assets completed.");
      }
    } catch (taErr: any) {
      console.error("[DB Error] Failed to seed default toolkit assets:", taErr.message);
    }

    // Check if dynamic seed or JSON migration is required
    const checkResult = await pool.query("SELECT COUNT(*) as count FROM beneficiaries");
    const count = parseInt(checkResult.rows[0].count, 10);
    
    if (count === 0) {
      console.log("[DB] PostgreSQL database is empty. Performing initial data migration from JSON file...");
      await migrateJsonToPostgres();
    } else {
      console.log(`[DB] Database already initialized with ${count} records. Skipping CSV/JSON migration.`);
    }

    // Backfill trainee profiles and portal monitoring from beneficiaries
    try {
      console.log("[DB] Backfilling trainee profiles and portal monitoring systems...");
      await pool.query(`
        INSERT INTO trainee_profiles (
          beneficiary_id,
          tvet_id,
          nin,
          bvn,
          bank_name,
          account_name,
          account_number,
          guardian_name,
          guardian_phone,
          education_level,
          employment_status,
          training_status,
          sector,
          skill,
          state,
          tsp
        )
        SELECT 
          id,
          'ID-TVE-26-' || SUBSTRING(id, 1, 6),
          COALESCE(nin, ''),
          COALESCE(bvn, ''),
          COALESCE(bank_name, ''),
          COALESCE(bank_account_holder, ''),
          COALESCE(bank_account_number, ''),
          COALESCE(guardian_name, ''),
          COALESCE(guardian_phone, ''),
          COALESCE(education_qualification, ''),
          'NOT_EMPLOYED',
          'ACTIVE_TRAINING',
          COALESCE(skill_sector, ''),
          COALESCE(skill_sector, ''),
          state,
          COALESCE(tsp, '')
        FROM beneficiaries
        WHERE status IN ('ADMITTED', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI')
        ON CONFLICT (beneficiary_id) DO NOTHING;
      `);

      await pool.query(`
        INSERT INTO portal_monitoring (
          beneficiary_id,
          still_on_portal,
          still_attending,
          remarks
        )
        SELECT 
          id,
          TRUE,
          TRUE,
          'Auto-initialized'
        FROM beneficiaries
        WHERE status IN ('ADMITTED', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI')
        ON CONFLICT (beneficiary_id) DO NOTHING;
      `);
      console.log("[DB] Backfill of trainee profiles completed successfully.");
    } catch (err: any) {
      console.error("[DB] Trainee backfill error:", err.message || err);
    }

    // Automatically recover and check template URLs on server startup/bootstrap
    try {
      await DbRepo.recoverTemplateUrls();
    } catch (recErr: any) {
      console.error("[DB Init Cache] Silent block of automatic template validation on start up:", recErr.message || recErr);
    }
  } catch (err) {
    console.error("[DB] Failed to initialize PostgreSQL tables/relations:", err);
  }
}

/**
 * Helper to load JSON file state (to back up operations and map schemas)
 */
function loadJsonState(): { 
  customFields: CustomField[]; 
  beneficiaries: Beneficiary[]; 
  auditLogs: AuditLog[]; 
  institutionLetterheads?: InstitutionLetterhead[];
  admissionFormTemplates?: AdmissionFormTemplate[];
  documentDispatches?: any[];
  emailTemplates?: any[];
  toolkitAssets?: any[];
  graduateToolkits?: any[];
} {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (!data.institutionLetterheads) {
        data.institutionLetterheads = [];
      }
      if (!data.admissionFormTemplates) {
        data.admissionFormTemplates = [];
      }
      if (!data.documentDispatches) {
        data.documentDispatches = [];
      }
      if (!data.emailTemplates) {
        data.emailTemplates = [];
      }
      if (!data.toolkitAssets || data.toolkitAssets.length === 0) {
        const defaultAssets = [
          { id: "ta_1", assetCode: "NWA-COMP-HW-01", assetName: "Laptop Repair Toolkit", assetCategory: "Laptop Repair Toolkit", trainingTrack: "Computer Hardware Repairs", unitCost: 15400.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_2", assetCode: "NWA-COMP-HW-02", assetName: "Digital Multimeter (Pro)", assetCategory: "Digital Multimeter", trainingTrack: "Computer Hardware Repairs", unitCost: 8500.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_3", assetCode: "NWA-COMP-HW-03", assetName: "Soldering Station (Adjustable)", assetCategory: "Soldering Station", trainingTrack: "Computer Hardware Repairs", unitCost: 18000.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_4", assetCode: "NWA-COMP-HW-04", assetName: "Precision Screwdriver Set", assetCategory: "Screwdriver Set", trainingTrack: "Computer Hardware Repairs", unitCost: 4500.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_5", assetCode: "NWA-COMP-HW-05", assetName: "ATX Power Supply Tester", assetCategory: "Power Supply Tester", trainingTrack: "Computer Hardware Repairs", unitCost: 6200.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_6", assetCode: "NWA-COMP-HW-06", assetName: "Anti-Static ESD Wrist Strap & Mat", assetCategory: "ESD Kit", trainingTrack: "Computer Hardware Repairs", unitCost: 3500.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_7", assetCode: "NWA-COMP-HW-07", assetName: "POST Diagnostic Card Tester", assetCategory: "Diagnostic Tools", trainingTrack: "Computer Hardware Repairs", unitCost: 7800.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_8", assetCode: "NWA-COMP-HW-08", assetName: "Integrated Motherboard Reflow Kit", assetCategory: "Motherboard Toolkit", trainingTrack: "Computer Hardware Repairs", unitCost: 24500.00, quantity: 50, status: "ACTIVE" },

          { id: "ta_9", assetCode: "NWA-MOBL-PH-01", assetName: "Advanced Mobile Repair Toolkit", assetCategory: "Mobile Repair Toolkit", trainingTrack: "Mobile Phone Repairs", unitCost: 12500.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_10", assetCode: "NWA-MOBL-PH-02", assetName: "SMD Rework Station (Heat Gun)", assetCategory: "Heat Gun", trainingTrack: "Mobile Phone Repairs", unitCost: 21000.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_11", assetCode: "NWA-MOBL-PH-03", assetName: "Stereo Zoom Repair Microscope", assetCategory: "Microscope", trainingTrack: "Mobile Phone Repairs", unitCost: 35000.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_12", assetCode: "NWA-MOBL-PH-04", assetName: "Fine Tip Soldering Iron", assetCategory: "Soldering Iron", trainingTrack: "Mobile Phone Repairs", unitCost: 5800.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_13", assetCode: "NWA-MOBL-PH-05", assetName: "S2 Steel Precision Screwdriver Set", assetCategory: "Precision Screwdriver Set", trainingTrack: "Mobile Phone Repairs", unitCost: 4800.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_14", assetCode: "NWA-MOBL-PH-06", assetName: "Plastic & Metal Opening Tool Kit", assetCategory: "Opening Tool Kit", trainingTrack: "Mobile Phone Repairs", unitCost: 2200.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_15", assetCode: "NWA-MOBL-PH-07", assetName: "Regulated DC Power Supply Unit", assetCategory: "Power Supply Unit", trainingTrack: "Mobile Phone Repairs", unitCost: 16500.00, quantity: 50, status: "ACTIVE" },
          { id: "ta_16", assetCode: "NWA-MOBL-PH-08", assetName: "Automatic LCD Screen Separator", assetCategory: "Screen Separation Tools", trainingTrack: "Mobile Phone Repairs", unitCost: 28000.00, quantity: 50, status: "ACTIVE" }
        ];
        data.toolkitAssets = defaultAssets;
      }
      if (!data.graduateToolkits) {
        data.graduateToolkits = [];
      }
      return data;
    }
  } catch (e) {
    console.error("[DB] Failed to read JSON file fallback state:", e);
  }
  return { 
    customFields: [], 
    beneficiaries: [], 
    auditLogs: [], 
    institutionLetterheads: [],
    admissionFormTemplates: [],
    documentDispatches: [],
    emailTemplates: [],
    toolkitAssets: [],
    graduateToolkits: []
  };
}

/**
 * Helper to save JSON file state
 */
function saveJsonState(state: { 
  customFields: CustomField[]; 
  beneficiaries: Beneficiary[]; 
  auditLogs: AuditLog[]; 
  institutionLetterheads?: InstitutionLetterhead[];
  admissionFormTemplates?: AdmissionFormTemplate[];
  documentDispatches?: any[];
  emailTemplates?: any[];
  toolkitAssets?: any[];
  graduateToolkits?: any[];
}) {
  try {
    if (!state.institutionLetterheads) {
      state.institutionLetterheads = [];
    }
    if (!state.admissionFormTemplates) {
      state.admissionFormTemplates = [];
    }
    if (!state.documentDispatches) {
      state.documentDispatches = [];
    }
    if (!state.emailTemplates) {
      state.emailTemplates = [];
    }
    if (!state.toolkitAssets) {
      state.toolkitAssets = [];
    }
    if (!state.graduateToolkits) {
      state.graduateToolkits = [];
    }
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
      return state.map(b => {
        const dynamic = getDynamicEligibility(b);
        return {
          ...b,
          photo: includePhoto ? (b.photo || "") : "",
          hasPhoto: !!b.photo,
          age: dynamic.age,
          eligibilityStatus: dynamic.eligibilityStatus
        };
      });
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
               b.beneficiary_status, b.status_reason, b.status_changed_at, b.status_changed_by, b.is_archived,
               b.eligibility_override, b.eligibility_override_reason, b.eligibility_override_by, b.eligibility_override_at,
               b.certification_status, b.certificate_number, b.certificate_issued_at, b.certificate_issued_by, b.graduation_batch, b.alumni_status, b.certificate_reference, b.certificate_verification_code, b.certificate_download_count, b.certificate_last_downloaded_at, b.alumni_employment_status, b.alumni_entrepreneur_status, b.alumni_business_name, b.alumni_current_employer,
               b.created_at, b.updated_at,
               adm.admission_status, adm.admission_ref, adm.admission_form_ref, adm.admission_letter_generated_at, 
               adm.admission_letter_sent_at, adm.admission_form_completed, adm.admission_form_status, 
               adm.training_progress, adm.admission_form_generated_at, adm.admission_form_confirmed_at,
               adm.admission_form_viewed_at, adm.admission_form_pdf_url
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
          beneficiaryStatus: row.beneficiary_status || "ACTIVE",
          statusReason: row.status_reason || "",
          statusChangedAt: row.status_changed_at ? row.status_changed_at.toISOString() : undefined,
          statusChangedBy: row.status_changed_by || "",
          isArchived: !!row.is_archived,
          eligibilityOverride: !!row.eligibility_override,
          eligibilityOverrideReason: row.eligibility_override_reason || "",
          eligibilityOverrideBy: row.eligibility_override_by || "",
          eligibilityOverrideAt: row.eligibility_override_at ? row.eligibility_override_at.toISOString() : undefined,

          admissionStatus: row.admission_status || "Draft",
          admissionRef: row.admission_ref || "",
          admissionFormRef: row.admission_form_ref || "",
          admissionLetterGeneratedAt: row.admission_letter_generated_at ? row.admission_letter_generated_at.toISOString() : undefined,
          admissionLetterSentAt: row.admission_letter_sent_at ? row.admission_letter_sent_at.toISOString() : undefined,
          admissionFormCompleted: !!row.admission_form_completed,
          admissionFormStatus: row.admission_form_status || "Pending",
          admissionFormGeneratedAt: row.admission_form_generated_at ? row.admission_form_generated_at.toISOString() : undefined,
          admissionFormConfirmedAt: row.admission_form_confirmed_at ? row.admission_form_confirmed_at.toISOString() : undefined,
          admissionFormViewedAt: row.admission_form_viewed_at ? row.admission_form_viewed_at.toISOString() : undefined,
          admissionFormPdfUrl: row.admission_form_pdf_url || "",
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
          dateOfBirth: row.date_of_birth ? (row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split("T")[0] : row.date_of_birth) : "",
          certificationStatus: row.certification_status || "NONE",
          certificateNumber: row.certificate_number || "",
          certificateIssuedAt: row.certificate_issued_at ? (row.certificate_issued_at instanceof Date ? row.certificate_issued_at.toISOString() : row.certificate_issued_at) : undefined,
          certificateIssuedBy: row.certificate_issued_by || "",
          graduationBatch: row.graduation_batch || "",
          alumniStatus: !!row.alumni_status,
          certificateReference: row.certificate_reference || "",
          certificateVerificationCode: row.certificate_verification_code || "",
          certificateDownloadCount: parseInt(row.certificate_download_count, 10) || 0,
          certificateLastDownloadedAt: row.certificate_last_downloaded_at ? (row.certificate_last_downloaded_at instanceof Date ? row.certificate_last_downloaded_at.toISOString() : row.certificate_last_downloaded_at) : undefined,
          alumniEmploymentStatus: row.alumni_employment_status || "",
          alumniEntrepreneurStatus: row.alumni_entrepreneur_status || "",
          alumniBusinessName: row.alumni_business_name || "",
          alumniCurrentEmployer: row.alumni_current_employer || ""
        };

        const bDynamic = getDynamicEligibility(beneficiary);
        beneficiary.age = bDynamic.age;
        beneficiary.eligibilityStatus = bDynamic.eligibilityStatus;

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
      const b = state.beneficiaries.find(b => b.id === id) || null;
      if (b) {
        const dynamic = getDynamicEligibility(b);
        b.age = dynamic.age;
        b.eligibilityStatus = dynamic.eligibilityStatus;
      }
      return b;
    }

    try {
      const bRes = await pool.query(
        `SELECT id, photo, first_name, last_name, other_name, gender, bvn, nin, 
                state, city, phone_number, email, residential_address, batch, 
                custom_fields, tsp, program, skill_sector, status, 
                admission_letter_url, acceptance_letter_url, enrollment_letter_url, certificate_url,
                guardian_name, guardian_address, guardian_phone, physical_challenge,
                bank_account_holder, bank_name, bank_sort_code, bank_account_number, education_qualification, date_of_birth,
                beneficiary_status, status_reason, status_changed_at, status_changed_by, is_archived,
                eligibility_override, eligibility_override_reason, eligibility_override_by, eligibility_override_at,
                certification_status, certificate_number, certificate_issued_at, certificate_issued_by, graduation_batch, alumni_status, certificate_reference, certificate_verification_code, certificate_download_count, certificate_last_downloaded_at, alumni_employment_status, alumni_entrepreneur_status, alumni_business_name, alumni_current_employer,
                created_at, updated_at
         FROM beneficiaries
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (bRes.rows.length === 0) return null;
      const row = bRes.rows[0];

      // Hydrate Admissions
      const admRes = await pool.query(
        `SELECT admission_status, admission_ref, admission_form_ref, admission_letter_generated_at, 
                admission_letter_sent_at, admission_form_completed, admission_form_status, 
                admission_form_data, admission_letter_versions, admission_form_versions, training_progress,
                acceptance_letter_uploaded_at, acceptance_letter_status, acceptance_letter_url,
                acceptance_letter_checked_by, acceptance_letter_checked_at, acceptance_letter_remarks,
                admission_form_generated_at, admission_form_confirmed_at, admission_form_viewed_at, admission_form_pdf_url
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
        beneficiaryStatus: row.beneficiary_status || "ACTIVE",
        statusReason: row.status_reason || "",
        statusChangedAt: row.status_changed_at ? row.status_changed_at.toISOString() : undefined,
        statusChangedBy: row.status_changed_by || "",
        isArchived: !!row.is_archived,
        eligibilityOverride: !!row.eligibility_override,
        eligibilityOverrideReason: row.eligibility_override_reason || "",
        eligibilityOverrideBy: row.eligibility_override_by || "",
        eligibilityOverrideAt: row.eligibility_override_at ? row.eligibility_override_at.toISOString() : undefined,

        admissionStatus: adm.admission_status || "Draft",
        admissionRef: adm.admission_ref || "",
        admissionFormRef: adm.admission_form_ref || "",
        admissionLetterGeneratedAt: adm.admission_letter_generated_at ? adm.admission_letter_generated_at.toISOString() : undefined,
        admissionLetterSentAt: adm.admission_letter_sent_at ? adm.admission_letter_sent_at.toISOString() : undefined,
        admissionFormCompleted: !!adm.admission_form_completed,
        admissionFormStatus: adm.admission_form_status || "Pending",
        admissionFormGeneratedAt: adm.admission_form_generated_at ? adm.admission_form_generated_at.toISOString() : undefined,
        admissionFormConfirmedAt: adm.admission_form_confirmed_at ? adm.admission_form_confirmed_at.toISOString() : undefined,
        admissionFormViewedAt: adm.admission_form_viewed_at ? adm.admission_form_viewed_at.toISOString() : undefined,
        admissionFormPdfUrl: adm.admission_form_pdf_url || "",
        admissionFormData: adm.admission_form_data || {},
        admissionLetterVersions: adm.admission_letter_versions || [],
        admissionFormVersions: adm.admission_form_versions || [],
        trainingProgress: adm.training_progress || {},

        acceptanceLetterUploaded: accVersions.length > 0,
        acceptanceLetterUrl: adm.acceptance_letter_url || row.acceptance_letter_url || (accVersions.length > 0 ? accVersions[accVersions.length - 1].url : undefined),
        acceptanceLetterUploadedAt: adm.acceptance_letter_uploaded_at ? adm.acceptance_letter_uploaded_at.toISOString() : (accVersions.length > 0 ? accVersions[accVersions.length - 1].uploadedAt : undefined),
        acceptanceLetterStatus: adm.acceptance_letter_status || "NOT_SUBMITTED",
        acceptanceLetterCheckedBy: adm.acceptance_letter_checked_by || undefined,
        acceptanceLetterCheckedAt: adm.acceptance_letter_checked_at ? adm.acceptance_letter_checked_at.toISOString() : undefined,
        acceptanceLetterRemarks: adm.acceptance_letter_remarks || undefined,
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
        dateOfBirth: row.date_of_birth ? (row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split("T")[0] : row.date_of_birth) : "",
        certificationStatus: row.certification_status || "NONE",
        certificateNumber: row.certificate_number || "",
        certificateIssuedAt: row.certificate_issued_at ? (row.certificate_issued_at instanceof Date ? row.certificate_issued_at.toISOString() : row.certificate_issued_at) : undefined,
        certificateIssuedBy: row.certificate_issued_by || "",
        graduationBatch: row.graduation_batch || "",
        alumniStatus: !!row.alumni_status,
        certificateReference: row.certificate_reference || "",
        certificateVerificationCode: row.certificate_verification_code || "",
        certificateDownloadCount: parseInt(row.certificate_download_count, 10) || 0,
        certificateLastDownloadedAt: row.certificate_last_downloaded_at ? (row.certificate_last_downloaded_at instanceof Date ? row.certificate_last_downloaded_at.toISOString() : row.certificate_last_downloaded_at) : undefined,
        alumniEmploymentStatus: row.alumni_employment_status || "",
        alumniEntrepreneurStatus: row.alumni_entrepreneur_status || "",
        alumniBusinessName: row.alumni_business_name || "",
        alumniCurrentEmployer: row.alumni_current_employer || ""
      };

      const bDynamic = getDynamicEligibility(beneficiary);
      beneficiary.age = bDynamic.age;
      beneficiary.eligibilityStatus = bDynamic.eligibilityStatus;

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
   * Generates or retrieves an official unique sequential Form Reference Number: IDEAS-AF-YYYY-000001
   */
  static async getOrGenerateAdmissionFormRef(id: string, force: boolean = false): Promise<string> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const bIdx = state.beneficiaries.findIndex(b => b.id === id);
      if (bIdx === -1) {
        return `IDEAS-AF-${new Date().getFullYear()}-000001`;
      }
      const existing = state.beneficiaries[bIdx].admissionFormRef;
      if (existing && !force) {
        return existing;
      }
      const withRef = state.beneficiaries.filter(b => b.admissionFormRef && b.admissionFormRef.startsWith("IDEAS-AF-"));
      const nextSeq = withRef.length + 1;
      const year = new Date().getFullYear();
      const newRef = `IDEAS-AF-${year}-${String(nextSeq).padStart(6, "0")}`;
      state.beneficiaries[bIdx].admissionFormRef = newRef;
      saveJsonState(state);
      return newRef;
    }

    try {
      if (!force) {
        const existingRes = await pool.query(
          "SELECT admission_form_ref FROM admissions WHERE beneficiary_id = $1",
          [id]
        );
        if (existingRes.rows.length > 0 && existingRes.rows[0].admission_form_ref) {
          return existingRes.rows[0].admission_form_ref;
        }
      }

      // Generate a new sequential reference
      const countRes = await pool.query(
        "SELECT count(*) as total FROM admissions WHERE admission_form_ref IS NOT NULL AND admission_form_ref LIKE 'IDEAS-AF-%'"
      );
      const nextSeq = Number(countRes.rows[0]?.total || 0) + 1;
      const year = new Date().getFullYear();
      const newRef = `IDEAS-AF-${year}-${String(nextSeq).padStart(6, "0")}`;

      // Insert/Update admissions record with this reference
      await pool.query(
        "INSERT INTO admissions (beneficiary_id, admission_form_ref) VALUES ($1, $2) ON CONFLICT (beneficiary_id) DO UPDATE SET admission_form_ref = $2",
        [id, newRef]
      );

      return newRef;
    } catch (e) {
      console.error("[DB Repo] Failed to get or generate admission form reference:", e);
      // Safe fallback counter
      const year = new Date().getFullYear();
      return `IDEAS-AF-${year}-000099`;
    }
  }

  /**
   * Generates or retrieves a unique sequential Certificate Number: IDEAS-CERT-YYYY-000001
   * Sequential, Unique, Immutable.
   */
  static async getOrGenerateCertificateNumber(id: string): Promise<{ certNumber: string; reference: string; verificationCode: string }> {
    const pool = getPgPool();
    const year = new Date().getFullYear();
    const reference = "REF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    const verificationCode = "VER-SEC-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + year;

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const bIdx = state.beneficiaries.findIndex(b => b.id === id);
      if (bIdx === -1) {
        return { certNumber: `IDEAS-CERT-${year}-000001`, reference, verificationCode };
      }
      const b = state.beneficiaries[bIdx];
      if (b.certificateNumber) {
        return {
          certNumber: b.certificateNumber,
          reference: b.certificateReference || reference,
          verificationCode: b.certificateVerificationCode || verificationCode
        };
      }
      const withCert = state.beneficiaries.filter(x => x.certificateNumber && x.certificateNumber.startsWith("IDEAS-CERT-"));
      const nextSeq = withCert.length + 1;
      const certNumber = `IDEAS-CERT-${year}-${String(nextSeq).padStart(6, "0")}`;
      
      b.certificateNumber = certNumber;
      b.certificateReference = reference;
      b.certificateVerificationCode = verificationCode;
      saveJsonState(state);
      return { certNumber, reference, verificationCode };
    }

    try {
      // Check if already has one
      const existRes = await pool.query(
        "SELECT certificate_number, certificate_reference, certificate_verification_code FROM beneficiaries WHERE id = $1",
        [id]
      );
      if (existRes.rows.length > 0 && existRes.rows[0].certificate_number) {
        return {
          certNumber: existRes.rows[0].certificate_number,
          reference: existRes.rows[0].certificate_reference || reference,
          verificationCode: existRes.rows[0].certificate_verification_code || verificationCode
        };
      }

      // Sequential generation
      const countRes = await pool.query(
        "SELECT count(*) as total FROM beneficiaries WHERE certificate_number IS NOT NULL AND certificate_number LIKE 'IDEAS-CERT-%'"
      );
      const nextSeq = Number(countRes.rows[0]?.total || 0) + 1;
      const certNumber = `IDEAS-CERT-${year}-${String(nextSeq).padStart(6, "0")}`;

      return { certNumber, reference, verificationCode };
    } catch (e) {
      console.error("[DB Repo] Failed to generate certificate details:", e);
      return { certNumber: `IDEAS-CERT-${year}-000099`, reference, verificationCode };
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
           beneficiary_status, status_reason, status_changed_at, status_changed_by, is_archived,
           eligibility_override, eligibility_override_reason, eligibility_override_by, eligibility_override_at,
           certification_status, certificate_number, certificate_issued_at, certificate_issued_by, graduation_batch,
           alumni_status, certificate_reference, certificate_verification_code, certificate_download_count, certificate_last_downloaded_at,
           alumni_employment_status, alumni_entrepreneur_status, alumni_business_name, alumni_current_employer,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58)
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
           beneficiary_status = EXCLUDED.beneficiary_status,
           status_reason = EXCLUDED.status_reason,
           status_changed_at = EXCLUDED.status_changed_at,
           status_changed_by = EXCLUDED.status_changed_by,
           is_archived = EXCLUDED.is_archived,
           eligibility_override = EXCLUDED.eligibility_override,
           eligibility_override_reason = EXCLUDED.eligibility_override_reason,
           eligibility_override_by = EXCLUDED.eligibility_override_by,
           eligibility_override_at = EXCLUDED.eligibility_override_at,
           certification_status = EXCLUDED.certification_status,
           certificate_number = EXCLUDED.certificate_number,
           certificate_issued_at = EXCLUDED.certificate_issued_at,
           certificate_issued_by = EXCLUDED.certificate_issued_by,
           graduation_batch = EXCLUDED.graduation_batch,
           alumni_status = EXCLUDED.alumni_status,
           certificate_reference = EXCLUDED.certificate_reference,
           certificate_verification_code = EXCLUDED.certificate_verification_code,
           certificate_download_count = EXCLUDED.certificate_download_count,
           certificate_last_downloaded_at = EXCLUDED.certificate_last_downloaded_at,
           alumni_employment_status = EXCLUDED.alumni_employment_status,
           alumni_entrepreneur_status = EXCLUDED.alumni_entrepreneur_status,
           alumni_business_name = EXCLUDED.alumni_business_name,
           alumni_current_employer = EXCLUDED.alumni_current_employer,
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
          b.beneficiaryStatus || "ACTIVE", b.statusReason || "", b.statusChangedAt ? new Date(b.statusChangedAt) : null, b.statusChangedBy || "", !!b.isArchived,
          !!b.eligibilityOverride, b.eligibilityOverrideReason || "", b.eligibilityOverrideBy || "", b.eligibilityOverrideAt ? new Date(b.eligibilityOverrideAt) : null,
          b.certificationStatus || "NONE", b.certificateNumber || "", b.certificateIssuedAt ? new Date(b.certificateIssuedAt) : null, b.certificateIssuedBy || "", b.graduationBatch || "",
          !!b.alumniStatus, b.certificateReference || "", b.certificateVerificationCode || "", b.certificateDownloadCount || 0, b.certificateLastDownloadedAt ? new Date(b.certificateLastDownloadedAt) : null,
          b.alumniEmploymentStatus || "", b.alumniEntrepreneurStatus || "", b.alumniBusinessName || "", b.alumniCurrentEmployer || "",
          new Date(b.createdAt || Date.now()), new Date()
        ]
      );

      // 2. Upsert admission extending metrics
      await client.query(
        `INSERT INTO admissions (
           beneficiary_id, admission_status, admission_ref, admission_form_ref, admission_letter_generated_at, 
           admission_letter_sent_at, admission_form_completed, admission_form_status, 
           admission_form_data, admission_letter_versions, admission_form_versions, 
           training_progress, admission_form_generated_at, admission_form_confirmed_at,
           admission_form_viewed_at, admission_form_pdf_url, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
         ON CONFLICT (beneficiary_id) DO UPDATE SET
           admission_status = EXCLUDED.admission_status,
           admission_ref = EXCLUDED.admission_ref,
           admission_form_ref = EXCLUDED.admission_form_ref,
           admission_letter_generated_at = EXCLUDED.admission_letter_generated_at,
           admission_letter_sent_at = EXCLUDED.admission_letter_sent_at,
           admission_form_completed = EXCLUDED.admission_form_completed,
           admission_form_status = EXCLUDED.admission_form_status,
           admission_form_data = EXCLUDED.admission_form_data,
           admission_letter_versions = EXCLUDED.admission_letter_versions,
           admission_form_versions = EXCLUDED.admission_form_versions,
           training_progress = EXCLUDED.training_progress,
           admission_form_generated_at = EXCLUDED.admission_form_generated_at,
           admission_form_confirmed_at = EXCLUDED.admission_form_confirmed_at,
           admission_form_viewed_at = EXCLUDED.admission_form_viewed_at,
           admission_form_pdf_url = EXCLUDED.admission_form_pdf_url,
           updated_at = NOW()`,
        [
          b.id,
          b.admissionStatus || "Pending",
          b.admissionRef || null,
          b.admissionFormRef || null,
          b.admissionLetterGeneratedAt ? new Date(b.admissionLetterGeneratedAt) : null,
          b.admissionLetterSentAt ? new Date(b.admissionLetterSentAt) : null,
          !!b.admissionFormCompleted,
          b.admissionFormStatus || "Pending",
          JSON.stringify(b.admissionFormData || {}),
          JSON.stringify(b.admissionLetterVersions || []),
          JSON.stringify(b.admissionFormVersions || []),
          JSON.stringify(b.trainingProgress || {}),
          b.admissionFormGeneratedAt ? new Date(b.admissionFormGeneratedAt) : null,
          b.admissionFormConfirmedAt ? new Date(b.admissionFormConfirmedAt) : null,
          b.admissionFormViewedAt ? new Date(b.admissionFormViewedAt) : null,
          b.admissionFormPdfUrl || null
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
        const oldStatus = target.beneficiaryStatus || "ACTIVE";
        target.beneficiaryStatus = "REMOVED";
        target.isArchived = true;
        target.statusReason = "Requested profile removal";
        target.statusChangedBy = "SUPER_ADMIN";
        target.statusChangedAt = new Date().toISOString();
        saveJsonState(state);

        await DbRepo.saveWorkflowHistory({
          beneficiaryId: id,
          oldStatus: oldStatus,
          newStatus: "REMOVED",
          changedBy: "SUPER_ADMIN",
          changedAt: new Date().toISOString(),
          remarks: "Requested profile removal (Soft Delete)",
          reason: "Soft Deleted",
          ipAddress: "127.0.0.1"
        });
        return true;
      }
      return false;
    }

    try {
      const curRes = await pool.query("SELECT beneficiary_status FROM beneficiaries WHERE id = $1 AND deleted_at IS NULL", [id]);
      const oldStatus = curRes.rows[0]?.beneficiary_status || "ACTIVE";

      const res = await pool.query(
        `UPDATE beneficiaries SET 
           beneficiary_status = 'REMOVED', 
           is_archived = TRUE, 
           status_reason = 'Requested profile removal',
           status_changed_by = 'SUPER_ADMIN',
           status_changed_at = NOW(),
           updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      await DbRepo.saveWorkflowHistory({
        beneficiaryId: id,
        oldStatus: oldStatus,
        newStatus: "REMOVED",
        changedBy: "SUPER_ADMIN",
        changedAt: new Date().toISOString(),
        remarks: "Requested profile removal (Soft-Delete Policy)",
        reason: "Soft Deleted",
        ipAddress: "127.0.0.1"
      });

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
          beneficiary_id, old_status, new_status, changed_by, changed_at, remarks, reason, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          h.beneficiaryId,
          h.oldStatus,
          h.newStatus,
          h.changedBy,
          h.changedAt ? new Date(h.changedAt) : new Date(),
          h.remarks || "",
          h.reason || "",
          h.ipAddress || ""
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
        "SELECT id, beneficiary_id, old_status, new_status, changed_by, changed_at, remarks, reason, ip_address FROM workflow_history WHERE beneficiary_id = $1 ORDER BY id ASC, changed_at ASC",
        [beneficiaryId]
      );
      return res.rows.map(row => ({
        id: row.id,
        beneficiaryId: row.beneficiary_id,
        oldStatus: row.old_status,
        newStatus: row.new_status,
        changedBy: row.changed_by,
        changedAt: row.changed_at ? row.changed_at.toISOString() : new Date().toISOString(),
        remarks: row.remarks || "",
        reason: row.reason || "",
        ipAddress: row.ip_address || ""
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
    recentActivities?: any[];
    acceptanceSummary?: any;
    admissionFormSummary?: {
      generated: number;
      viewed: number;
      confirmed: number;
      pendingConfirmation: number;
    };
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
      const admissionFormSummary = { generated: 0, viewed: 0, confirmed: 0, pendingConfirmation: 0 };

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

        if (b.admissionFormPdfUrl || b.admissionFormGeneratedAt) {
          admissionFormSummary.generated++;
          if (b.admissionFormConfirmedAt) {
            admissionFormSummary.confirmed++;
          } else {
            admissionFormSummary.pendingConfirmation++;
          }
        }
        if (b.admissionFormViewedAt) {
          admissionFormSummary.viewed++;
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

      return { summary, bySector, byProgram, byTsp, byState, byLga, admissionFormSummary };
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

      // Fetch acceptance letter statuses count
      const accLetterRes = await pool.query(`
        SELECT COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') as status, COUNT(*) as count
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        WHERE b.deleted_at IS NULL
        GROUP BY COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED')
      `);
      const acceptanceSummary = { NOT_SUBMITTED: 0, SUBMITTED: 0, UNDER_VERIFICATION: 0, ACCEPTED: 0, REJECTED: 0 } as any;
      for (const r of accLetterRes.rows) {
        const rawStatus = String(r.status || "NOT_SUBMITTED").toUpperCase().replace(" ", "_");
        const mappedStatus = acceptanceSummary.hasOwnProperty(rawStatus) ? rawStatus : "NOT_SUBMITTED";
        acceptanceSummary[mappedStatus] = (acceptanceSummary[mappedStatus] || 0) + parseInt(r.count, 10);
      }

      // Fetch recentActivities
      const recentActivities = await DbRepo.getRecentAdmissionsActivities();

      // Fetch admission form stats
      const formStatsRes = await pool.query(`
        SELECT 
          COUNT(CASE WHEN admission_form_pdf_url IS NOT NULL OR admission_form_generated_at IS NOT NULL THEN 1 END) as generated,
          COUNT(CASE WHEN admission_form_viewed_at IS NOT NULL THEN 1 END) as viewed,
          COUNT(CASE WHEN admission_form_confirmed_at IS NOT NULL THEN 1 END) as confirmed,
          COUNT(CASE WHEN (admission_form_pdf_url IS NOT NULL OR admission_form_generated_at IS NOT NULL) AND admission_form_confirmed_at IS NULL THEN 1 END) as pending
        FROM admissions
        WHERE deleted_at IS NULL
      `);
      const formRow = formStatsRes.rows[0] || {};
      const admissionFormSummary = {
        generated: parseInt(formRow.generated || "0", 10),
        viewed: parseInt(formRow.viewed || "0", 10),
        confirmed: parseInt(formRow.confirmed || "0", 10),
        pendingConfirmation: parseInt(formRow.pending || "0", 10)
      };

      return { summary, bySector, byProgram, byTsp, byState, byLga, recentActivities, acceptanceSummary, admissionFormSummary };
    } catch (e) {
      console.error("[DB Repo] Failed to load admissions stats:", e);
      return {
        summary: { total: 0, pending: 0, underReview: 0, admitted: 0, rejected: 0 },
        bySector: {}, byProgram: {}, byTsp: {}, byState: {}, byLga: {},
        recentActivities: [],
        acceptanceSummary: { NOT_SUBMITTED: 0, SUBMITTED: 0, UNDER_VERIFICATION: 0, ACCEPTED: 0, REJECTED: 0 },
        admissionFormSummary: { generated: 0, viewed: 0, confirmed: 0, pendingConfirmation: 0 }
      };
    }
  }

  /**
   * Fetch recent workflows across toda the beneficiary pool (limit 10)
   */
  static async getRecentAdmissionsActivities(): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      const history = state.workflowHistory || [];
      const sorted = [...history].sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()).slice(0, 10);
      return sorted.map((h: any) => {
        const b = state.beneficiaries?.find((x: any) => x.id === h.beneficiaryId);
        return {
          id: h.id,
          beneficiaryId: h.beneficiaryId,
          beneficiaryName: b ? `${b.lastName}, ${b.firstName}` : "Unknown Applicant",
          oldStatus: h.oldStatus,
          newStatus: h.newStatus,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
          remarks: h.remarks
        };
      });
    }
    try {
      const res = await pool.query(`
        SELECT h.id, h.beneficiary_id, h.old_status, h.new_status, h.changed_by, h.changed_at, h.remarks,
               b.first_name, b.last_name
        FROM workflow_history h
        LEFT JOIN beneficiaries b ON h.beneficiary_id = b.id
        ORDER BY h.changed_at DESC, h.id DESC
        LIMIT 10
      `);
      return res.rows.map(row => ({
        id: row.id,
        beneficiaryId: row.beneficiary_id,
        beneficiaryName: row.last_name ? `${row.last_name}, ${row.first_name}` : "Unknown Applicant",
        oldStatus: row.old_status,
        newStatus: row.new_status,
        changedBy: row.changed_by,
        changedAt: row.changed_at ? row.changed_at.toISOString() : new Date().toISOString(),
        remarks: row.remarks || ""
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to get recent admissions activities:", e);
      return [];
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
        if (["GENERATED", "VIEWED", "IN_PROGRESS", "CONFIRMED", "LOCKED", "NOT_GENERATED"].includes(status.toUpperCase())) {
          if (status === "NOT_GENERATED") {
            list = list.filter(b => !b.admissionFormStatus || b.admissionFormStatus === "NOT_GENERATED" || b.admissionFormStatus === "Pending");
          } else {
            list = list.filter(b => (b.admissionFormStatus || "").toUpperCase() === status.toUpperCase());
          }
        } else {
          list = list.filter(b => (b.admissionStatus || "Pending").toLowerCase() === status.toLowerCase());
        }
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
        referenceNumber: b.admissionFormRef || b.admissionRef || "DRAFT",
        name: `${b.lastName}, ${b.firstName}`,
        sector: b.skillSector,
        tsp: b.tsp,
        admissionStatus: b.admissionStatus || "Pending",
        hasPhoto: b.photo ? (b.photo.length > 5) : false,
        state: b.state,
        batch: b.batch,
        createdAt: b.createdAt,
        admissionFormRef: b.admissionFormRef || b.admissionRef || "",
        admissionFormStatus: b.admissionFormStatus || "NOT_GENERATED",
        admissionFormGeneratedAt: b.admissionFormGeneratedAt || null,
        admissionFormViewedAt: b.admissionFormViewedAt || null,
        admissionFormConfirmedAt: b.admissionFormConfirmedAt || null,
        gender: b.gender || "Male",
        bvn: b.bvn || "",
        guardianName: b.guardianName || "",
        guardianPhone: b.guardianPhone || "",
        address: b.residentialAddress || "",
        bankName: b.bankName || "",
        accountNumber: b.bankAccountNumber || "",
        nin: b.nin || "",
        dateOfBirth: b.dateOfBirth || "",
        photo: b.photo || ""
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
        "b.created_at",
        "adm.admission_form_status",
        "adm.admission_form_ref",
        "adm.admission_form_generated_at",
        "adm.admission_form_viewed_at",
        "adm.admission_form_confirmed_at",
        "b.gender",
        "b.bvn",
        "b.guardian_name",
        "b.guardian_phone",
        "b.address",
        "b.bank_name",
        "b.account_number",
        "b.nin",
        "b.date_of_birth",
        "b.photo"
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
        if (["GENERATED", "VIEWED", "IN_PROGRESS", "CONFIRMED", "LOCKED", "NOT_GENERATED"].includes(status.toUpperCase())) {
          if (status === "NOT_GENERATED") {
            queryWhere += `AND (adm.admission_form_status IS NULL OR adm.admission_form_status = 'Pending' OR adm.admission_form_status = 'NOT_GENERATED') `;
          } else {
            queryWhere += `AND adm.admission_form_status = $${paramCount} `;
            params.push(status);
            paramCount++;
          }
        } else {
          queryWhere += `AND COALESCE(adm.admission_status, 'Pending') = $${paramCount} `;
          params.push(status);
          paramCount++;
        }
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
      let sortColumn = "b.created_at";
      const userSortBy = options.sortBy || "createdAt";
      if (userSortBy === "name" || userSortBy === "lastName") {
        sortColumn = "b.last_name";
      } else if (userSortBy === "id" || userSortBy === "admissionId") {
        sortColumn = "b.id";
      } else if (userSortBy === "referenceNumber") {
        sortColumn = "COALESCE(adm.admission_ref, 'DRAFT')";
      } else if (userSortBy === "sector" || userSortBy === "skillSector" || userSortBy === "skill") {
        sortColumn = "b.skill_sector";
      } else if (userSortBy === "tsp") {
        sortColumn = "b.tsp";
      } else if (userSortBy === "state") {
        sortColumn = "b.state";
      } else if (userSortBy === "admissionStatus" || userSortBy === "status" || userSortBy === "currentStatus") {
        sortColumn = "COALESCE(adm.admission_status, 'Pending')";
      }

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
        createdAt: r.created_at.toISOString(),
        admissionFormRef: r.admission_form_ref || r.reference_number || "",
        admissionFormStatus: r.admission_form_status || "NOT_GENERATED",
        admissionFormGeneratedAt: r.admission_form_generated_at ? r.admission_form_generated_at.toISOString() : null,
        admissionFormViewedAt: r.admission_form_viewed_at ? r.admission_form_viewed_at.toISOString() : null,
        admissionFormConfirmedAt: r.admission_form_confirmed_at ? r.admission_form_confirmed_at.toISOString() : null,
        gender: r.gender || "Male",
        bvn: r.bvn || "",
        guardianName: r.guardian_name || "",
        guardianPhone: r.guardian_phone || "",
        address: r.address || "",
        bankName: r.bank_name || "",
        accountNumber: r.account_number || "",
        nin: r.nin || "",
        dateOfBirth: r.date_of_birth || "",
        photo: r.photo || ""
      }));

      return { rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DB Repo] Failed to get paginated admissions records:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 1 };
    }
  }

  /**
   * Update acceptance letter review details in admissions table
   */
  static async updateAcceptanceLetterStatus(
    beneficiaryId: string,
    status: string,
    checkedBy: string,
    remarks: string,
    url?: string
  ): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // JSON State Update
      const state = loadJsonState() as any;
      const b = state.beneficiaries?.find((x: any) => x.id === beneficiaryId);
      if (b) {
        b.acceptanceLetterStatus = status;
        b.acceptanceLetterCheckedBy = checkedBy;
        b.acceptanceLetterCheckedAt = new Date().toISOString();
        b.acceptanceLetterRemarks = remarks;
        if (url) {
          b.acceptanceLetterUrl = url;
          b.acceptanceLetterUploaded = true;
          b.acceptanceLetterUploadedAt = new Date().toISOString();
        }
        b.updatedAt = new Date().toISOString();
        saveJsonState(state);
        return true;
      }
      return false;
    }
    try {
      const parts = [
        "acceptance_letter_status = $1",
        "acceptance_letter_checked_by = $2",
        "acceptance_letter_checked_at = NOW()",
        "acceptance_letter_remarks = $3",
        "updated_at = NOW()"
      ];
      const params = [status, checkedBy, remarks, beneficiaryId];
      if (url) {
        parts.push("acceptance_letter_url = $5");
        parts.push("acceptance_letter_uploaded_at = NOW()");
        params.push(url);
      }
      const queryStr = `
        UPDATE admissions
        SET ${parts.join(", ")}
        WHERE beneficiary_id = $4 AND deleted_at IS NULL
      `;
      const res = await pool.query(queryStr, params);
      return res.rowCount !== null && res.rowCount > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to update acceptance letter status:", e);
      return false;
    }
  }

  /**
   * Aggregate funnel steps count
   */
  static async getAdmissionsFunnelReport(): Promise<{
    totalRegistered: number;
    generated: number;
    sent: number;
    viewed: number;
    uploaded: number;
    accepted: number;
  }> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const list = (state.beneficiaries || []) as Beneficiary[];
      
      const totalRegistered = list.length;
      let generated = 0;
      let sent = 0;
      let viewed = 0;
      let uploaded = 0;
      let accepted = 0;

      list.forEach((b: any) => {
        const s = (b.admissionStatus || "Pending").toLowerCase();
        const lStatus = b.acceptanceLetterStatus || "NOT_SUBMITTED";
        
        if (["admission generated", "admission sent", "offer viewed", "acceptance uploaded", "accepted"].includes(s)) {
          generated++;
        }
        if (["admission sent", "offer viewed", "acceptance uploaded", "accepted"].includes(s)) {
          sent++;
        }
        if (["offer viewed", "acceptance uploaded", "accepted"].includes(s)) {
          viewed++;
        }
        if (["acceptance uploaded", "accepted"].includes(s) || ["SUBMITTED", "UNDER_VERIFICATION", "ACCEPTED"].includes(lStatus)) {
          uploaded++;
        }
        if (s === "accepted" || lStatus === "ACCEPTED") {
          accepted++;
        }
      });

      return { totalRegistered, generated, sent, viewed, uploaded, accepted };
    }

    try {
      const q = `
        SELECT 
          COUNT(*) as total_registered,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') IN ('Admission Generated', 'Admission Sent', 'Offer Viewed', 'Acceptance Uploaded', 'Accepted') THEN 1 END) as generated,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') IN ('Admission Sent', 'Offer Viewed', 'Acceptance Uploaded', 'Accepted') THEN 1 END) as sent,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') IN ('Offer Viewed', 'Acceptance Uploaded', 'Accepted') THEN 1 END) as viewed,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') IN ('Acceptance Uploaded', 'Accepted') OR COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') IN ('SUBMITTED', 'UNDER_VERIFICATION', 'ACCEPTED') THEN 1 END) as uploaded,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') = 'Accepted' OR COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'ACCEPTED' THEN 1 END) as accepted
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        WHERE b.deleted_at IS NULL
      `;
      const res = await pool.query(q);
      const row = res.rows[0];
      return {
        totalRegistered: parseInt(row.total_registered || "0", 10),
        generated: parseInt(row.generated || "0", 10),
        sent: parseInt(row.sent || "0", 10),
        viewed: parseInt(row.viewed || "0", 10),
        uploaded: parseInt(row.uploaded || "0", 10),
        accepted: parseInt(row.accepted || "0", 10)
      };
    } catch (e) {
      console.error("[DB Repo] Funnel SQL compilation failed:", e);
      return { totalRegistered: 0, generated: 0, sent: 0, viewed: 0, uploaded: 0, accepted: 0 };
    }
  }

  /**
   * Pull grouped TSP center performance metrics
   */
  static async getTspPerformanceReport(): Promise<Array<{
    tsp: string;
    total: number;
    admitted: number;
    submitted: number;
    underReview: number;
    verified: number;
  }>> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const list = (state.beneficiaries || []) as Beneficiary[];
      
      const map: { [key: string]: any } = {};
      list.forEach((b: any) => {
        const tspName = b.tsp || "Unique Technology Nig. Ltd";
        if (!map[tspName]) {
          map[tspName] = { tsp: tspName, total: 0, admitted: 0, submitted: 0, underReview: 0, verified: 0 };
        }
        const m = map[tspName];
        m.total++;
        const s = (b.admissionStatus || "Pending").toLowerCase();
        const lStatus = b.acceptanceLetterStatus || "NOT_SUBMITTED";
        if (s === "accepted" || lStatus === "ACCEPTED") {
          m.admitted++;
        }
        if (lStatus === "SUBMITTED") {
          m.submitted++;
        }
        if (lStatus === "UNDER_VERIFICATION") {
          m.underReview++;
        }
        if (lStatus === "ACCEPTED") {
          m.verified++;
        }
      });

      return Object.values(map).sort((a, b) => b.total - a.total);
    }

    try {
      const q = `
        SELECT 
          COALESCE(b.tsp, 'Unique Technology Nig. Ltd') as tsp,
          COUNT(*) as total,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') = 'Accepted' OR COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'ACCEPTED' THEN 1 END) as admitted,
          COUNT(CASE WHEN COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'SUBMITTED' THEN 1 END) as submitted,
          COUNT(CASE WHEN COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'UNDER_VERIFICATION' THEN 1 END) as under_review,
          COUNT(CASE WHEN COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'ACCEPTED' THEN 1 END) as verified
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        WHERE b.deleted_at IS NULL
        GROUP BY b.tsp
        ORDER BY total DESC
      `;
      const res = await pool.query(q);
      return res.rows.map(r => ({
        tsp: r.tsp,
        total: parseInt(r.total || "0", 10),
        admitted: parseInt(r.admitted || "0", 10),
        submitted: parseInt(r.submitted || "0", 10),
        underReview: parseInt(r.under_review || "0", 10),
        verified: parseInt(r.verified || "0", 10)
      }));
    } catch (e) {
      console.error("[DB Repo] TSP SQL aggregates failed:", e);
      return [];
    }
  }

  /**
   * Pull geographical state boundaries metrics
   */
  static async getStatePerformanceReport(): Promise<Array<{
    state: string;
    total: number;
    admitted: number;
    pending: number;
  }>> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const stateData = loadJsonState();
      const list = (stateData.beneficiaries || []) as Beneficiary[];
      
      const map: { [key: string]: any } = {};
      list.forEach((b: any) => {
        const stateName = b.state || "Imo";
        if (!map[stateName]) {
          map[stateName] = { state: stateName, total: 0, admitted: 0, pending: 0 };
        }
        const m = map[stateName];
        m.total++;
        const s = (b.admissionStatus || "Pending").toLowerCase();
        const lStatus = b.acceptanceLetterStatus || "NOT_SUBMITTED";
        if (s === "accepted" || lStatus === "ACCEPTED") {
          m.admitted++;
        } else {
          m.pending++;
        }
      });

      return Object.values(map).sort((a, b) => b.total - a.total);
    }

    try {
      const q = `
        SELECT 
          COALESCE(b.state, 'Imo') as state,
          COUNT(*) as total,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') = 'Accepted' OR COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'ACCEPTED' THEN 1 END) as admitted,
          COUNT(CASE WHEN COALESCE(adm.admission_status, 'Pending') != 'Accepted' AND COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') != 'ACCEPTED' THEN 1 END) as pending
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        WHERE b.deleted_at IS NULL
        GROUP BY b.state
        ORDER BY total DESC
      `;
      const res = await pool.query(q);
      return res.rows.map(r => ({
        state: r.state,
        total: parseInt(r.total || "0", 10),
        admitted: parseInt(r.admitted || "0", 10),
        pending: parseInt(r.pending || "0", 10)
      }));
    } catch (e) {
      console.error("[DB Repo] State Performance compilation failed:", e);
      return [];
    }
  }

  /**
   * Paged query engine for list-based sub-reports
   */
  static async getAdmissionsReportPaged(options: {
    page: number;
    pageSize: number;
    search?: string;
    reportType: "admitted" | "rejected" | "acceptance_status";
    acceptanceLetterStatus?: string;
    state?: string;
    sector?: string;
    tsp?: string;
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
      acceptanceLetterStatus: string;
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
    const reportType = options.reportType;
    const letterStatus = options.acceptanceLetterStatus || "all";
    const stateFilter = options.state || "all";
    const sectorFilter = options.sector || "all";
    const tspFilter = options.tsp || "all";

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const stateData = loadJsonState();
      let list = (stateData.beneficiaries || []) as Beneficiary[];

      // Filter in memory matching base query criteria
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

      // Filter by reportType constraints safely
      if (reportType === "admitted") {
        list = list.filter(b => 
          (b.admissionStatus || "Pending").toLowerCase() === "accepted" || 
          b.acceptanceLetterStatus === "ACCEPTED"
        );
      } else if (reportType === "rejected") {
        list = list.filter(b => 
          ["acceptance rejected", "rejected", "declined"].includes((b.admissionStatus || "").toLowerCase()) ||
          b.acceptanceLetterStatus === "REJECTED"
        );
      } else if (reportType === "acceptance_status" && letterStatus !== "all") {
        list = list.filter(b => (b.acceptanceLetterStatus || "NOT_SUBMITTED") === letterStatus);
      }

      if (stateFilter !== "all") {
        list = list.filter(b => b.state === stateFilter);
      }
      if (sectorFilter !== "all") {
        list = list.filter(b => b.skillSector === sectorFilter);
      }
      if (tspFilter !== "all") {
        list = list.filter(b => b.tsp === tspFilter);
      }

      // Sort
      const sortBy = options.sortBy || "createdAt";
      const sortOrder = options.sortOrder || "DESC";
      list = list.sort((a: any, b: any) => {
        const valA = a[sortBy] || "";
        const valB = b[sortBy] || "";
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
        referenceNumber: b.id ? `A-${b.id.substring(b.id.length - 8).toUpperCase()}` : "DRAFT",
        name: `${b.lastName || ""}, ${b.firstName || ""}`,
        sector: b.skillSector || "General Skill Program",
        tsp: b.tsp || "Unique Technology Nig. Ltd",
        admissionStatus: b.admissionStatus || "Pending",
        acceptanceLetterStatus: b.acceptanceLetterStatus || "NOT_SUBMITTED",
        state: b.state || "Imo",
        batch: b.batch || "Batch 2026-C",
        createdAt: b.createdAt || new Date().toISOString()
      }));

      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      const selectParts = [
        "b.id",
        "COALESCE(adm.admission_ref, 'DRAFT') as reference_number",
        "b.first_name",
        "b.last_name",
        "b.skill_sector",
        "b.tsp",
        "COALESCE(adm.admission_status, 'Pending') as admission_status",
        "COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') as acceptance_letter_status",
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

      if (reportType === "admitted") {
        queryWhere += `AND (COALESCE(adm.admission_status, 'Pending') = 'Accepted' OR COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'ACCEPTED') `;
      } else if (reportType === "rejected") {
        queryWhere += `AND (LOWER(COALESCE(adm.admission_status, 'Pending')) IN ('acceptance rejected', 'rejected', 'declined') OR COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = 'REJECTED') `;
      } else if (reportType === "acceptance_status" && letterStatus !== "all") {
        queryWhere += `AND COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') = $${paramCount} `;
        params.push(letterStatus);
        paramCount++;
      }

      if (stateFilter !== "all") {
        queryWhere += `AND b.state = $${paramCount} `;
        params.push(stateFilter);
        paramCount++;
      }

      if (sectorFilter !== "all") {
        queryWhere += `AND b.skill_sector = $${paramCount} `;
        params.push(sectorFilter);
        paramCount++;
      }

      if (tspFilter !== "all") {
        queryWhere += `AND b.tsp = $${paramCount} `;
        params.push(tspFilter);
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
      const totalCount = parseInt(countRes.rows[0]?.count || "0", 10);
      const totalPages = Math.ceil(totalCount / pageSize) || 1;

      // Sort
      const sortBy = options.sortBy || "createdAt";
      const sortOrder = options.sortOrder || "DESC";
      let oCol = "b.created_at";
      if (sortBy === "id") oCol = "b.id";
      else if (sortBy === "name") oCol = "b.last_name";
      else if (sortBy === "tsp") oCol = "b.tsp";
      else if (sortBy === "state") oCol = "b.state";
      else if (sortBy === "status" || sortBy === "admissionStatus") oCol = "adm.admission_status";
      else if (sortBy === "acceptanceLetterStatus") oCol = "adm.acceptance_letter_status";

      // Append Limit and Offset parameters
      const dataParams = [...params];
      dataParams.push(pageSize);
      const lIndex = paramCount;
      dataParams.push(offset);
      const oIndex = paramCount + 1;

      const itemsQuery = `
        SELECT ${selectParts.join(", ")}
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
         ${queryWhere}
        ORDER BY ${oCol} ${sortOrder}
        LIMIT $${lIndex} OFFSET $${oIndex}
      `;

      const dataRes = await pool.query(itemsQuery, dataParams);
      const rows = dataRes.rows.map(r => ({
        id: r.id,
        referenceNumber: r.reference_number || "DRAFT",
        name: `${r.last_name || ""}, ${r.first_name || ""}`,
        sector: r.skill_sector || "General Skill Program",
        tsp: r.tsp || "Unique Technology Nig. Ltd",
        admissionStatus: r.admission_status || "Pending",
        acceptanceLetterStatus: r.acceptance_letter_status || "NOT_SUBMITTED",
        state: r.state || "Imo",
        batch: r.batch || "Batch 2026-C",
        createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString()
      }));

      return { rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DB Repo] admissions paged list aggregates fail:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 1 };
    }
  }

  /**
   * Retrieves all registered institution letterhead templates in the workspace
   */
  static async getLetterheads(): Promise<InstitutionLetterhead[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // JSON File fallback
      return loadJsonState().institutionLetterheads || [];
    }

    try {
      const res = await pool.query(
        "SELECT id, name, description, file_url, thumbnail_url, file_type, is_default, is_active, uploaded_by, created_at, updated_at FROM institution_letterheads ORDER BY created_at DESC"
      );
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || undefined,
        fileUrl: r.file_url,
        thumbnailUrl: r.thumbnail_url || undefined,
        fileType: r.file_type as "PDF" | "PNG" | "JPG" | "JPEG",
        isDefault: !!r.is_default,
        isActive: !!r.is_active,
        uploadedBy: r.uploaded_by,
        createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString()
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to load letterheads from PG, falling back to JSON:", e);
      return loadJsonState().institutionLetterheads || [];
    }
  }

  /**
   * Retrieves the current default, active institutional document letterhead template
   */
  static async getActiveLetterhead(): Promise<InstitutionLetterhead | null> {
    const list = await this.getLetterheads();
    const activeDefault = list.find(l => l.isActive && l.isDefault);
    if (activeDefault) return activeDefault;
    // Fallback to first active one if no default is selected
    const activeFirst = list.find(l => l.isActive);
    return activeFirst || null;
  }

  /**
   * Saves or updates a letterhead. Ensures that if the letterhead is set as default,
   * any other default letterhead is cleared/deactivated as default.
   */
  static async saveLetterhead(lh: InstitutionLetterhead): Promise<InstitutionLetterhead> {
    const pool = getPgPool();
    const listInFallback = async () => {
      const state = loadJsonState();
      if (!state.institutionLetterheads) state.institutionLetterheads = [];
      
      // If setting this one to default, reset others in JSON state
      if (lh.isDefault && lh.isActive) {
        state.institutionLetterheads.forEach(item => {
          if (item.id !== lh.id) {
            item.isDefault = false;
          }
        });
      }
      const index = state.institutionLetterheads.findIndex(item => item.id === lh.id);
      if (index >= 0) {
        state.institutionLetterheads[index] = lh;
      } else {
        state.institutionLetterheads.push(lh);
      }
      saveJsonState(state);
      return lh;
    };

    if (!pool || !isPgActive) {
      return await listInFallback();
    }

    try {
      // If setting this one as default, run transactional reset of others
      if (lh.isDefault && lh.isActive) {
        await pool.query(
          "UPDATE institution_letterheads SET is_default = FALSE WHERE id <> $1",
          [lh.id]
        );
      }

      await pool.query(
        `INSERT INTO institution_letterheads (
          id, name, description, file_url, thumbnail_url, file_type, 
          is_default, is_active, uploaded_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           file_url = EXCLUDED.file_url,
           thumbnail_url = EXCLUDED.thumbnail_url,
           file_type = EXCLUDED.file_type,
           is_default = EXCLUDED.is_default,
           is_active = EXCLUDED.is_active,
           uploaded_by = EXCLUDED.uploaded_by,
           updated_at = NOW()`,
        [
          lh.id, lh.name, lh.description || null, lh.fileUrl, lh.thumbnailUrl || null, 
          lh.fileType, lh.isDefault, lh.isActive, lh.uploadedBy, 
          lh.createdAt ? new Date(lh.createdAt) : new Date(), 
          lh.updatedAt ? new Date(lh.updatedAt) : new Date()
        ]
      );
      return lh;
    } catch (e) {
      console.error("[DB Repo] Failed to save letterhead to Postgres, committing fallback:", e);
      return await listInFallback();
    }
  }

  /**
   * Deletes a registered letterhead background from the database list.
   */
  static async deleteLetterhead(id: string): Promise<boolean> {
    const pool = getPgPool();
    const fallbackDelete = () => {
      const state = loadJsonState();
      if (!state.institutionLetterheads) state.institutionLetterheads = [];
      const updated = state.institutionLetterheads.filter(item => item.id !== id);
      const isDeleted = updated.length < state.institutionLetterheads.length;
      state.institutionLetterheads = updated;
      saveJsonState(state);
      return isDeleted;
    };

    if (!pool || !isPgActive) {
      return fallbackDelete();
    }

    try {
      const res = await pool.query(
        "DELETE FROM institution_letterheads WHERE id = $1",
        [id]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to delete letterhead from Postgres, committing fallback:", e);
      return fallbackDelete();
    }
  }

  /**
   * Retrieves all registered admission form templates in the workspace
   */
  static async getAdmissionFormTemplates(): Promise<AdmissionFormTemplate[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // JSON File fallback
      return loadJsonState().admissionFormTemplates || [];
    }

    try {
      const res = await pool.query(
        "SELECT id, name, description, file_url, file_type, is_default, is_active, uploaded_by, created_at, updated_at FROM admission_form_templates ORDER BY created_at DESC"
      );
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || undefined,
        fileUrl: r.file_url,
        fileType: r.file_type as "PDF" | "PNG" | "JPG" | "JPEG",
        isDefault: !!r.is_default,
        isActive: !!r.is_active,
        uploadedBy: r.uploaded_by,
        createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString()
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to load admission form templates from PG, falling back to JSON:", e);
      return loadJsonState().admissionFormTemplates || [];
    }
  }

  /**
   * Retrieves the current default, active admission form template
   */
  static async getActiveAdmissionFormTemplate(): Promise<AdmissionFormTemplate | null> {
    const list = await this.getAdmissionFormTemplates();
    const activeDefault = list.find(l => l.isActive && l.isDefault);
    if (activeDefault) return activeDefault;
    // Fallback to first active one if no default is selected
    const activeFirst = list.find(l => l.isActive);
    return activeFirst || null;
  }

  /**
   * Saves or updates an admission form template. Ensures that if set as default,
   * other defaults are cleared. In case of multiple active ones, only one default may exist.
   */
  static async saveAdmissionFormTemplate(t: AdmissionFormTemplate): Promise<AdmissionFormTemplate> {
    const pool = getPgPool();
    const saveFallback = async () => {
      const state = loadJsonState();
      if (!state.admissionFormTemplates) state.admissionFormTemplates = [];

      // If setting this one to default, reset others in JSON state
      if (t.isDefault && t.isActive) {
        state.admissionFormTemplates.forEach(item => {
          if (item.id !== t.id) {
            item.isDefault = false;
          }
        });
      }
      const index = state.admissionFormTemplates.findIndex(item => item.id === t.id);
      if (index >= 0) {
        state.admissionFormTemplates[index] = t;
      } else {
        state.admissionFormTemplates.push(t);
      }
      saveJsonState(state);
      return t;
    };

    if (!pool || !isPgActive) {
      return await saveFallback();
    }

    try {
      // If setting this one as default, run transactional reset of others
      if (t.isDefault && t.isActive) {
        await pool.query(
          "UPDATE admission_form_templates SET is_default = FALSE WHERE id <> $1",
          [t.id]
        );
      }

      await pool.query(
        `INSERT INTO admission_form_templates (
          id, name, description, file_url, file_type, 
          is_default, is_active, uploaded_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           file_url = EXCLUDED.file_url,
           file_type = EXCLUDED.file_type,
           is_default = EXCLUDED.is_default,
           is_active = EXCLUDED.is_active,
           uploaded_by = EXCLUDED.uploaded_by,
           updated_at = NOW()`,
        [
          t.id, t.name, t.description || null, t.fileUrl, 
          t.fileType, t.isDefault, t.isActive, t.uploadedBy, 
          t.createdAt ? new Date(t.createdAt) : new Date(), 
          t.updatedAt ? new Date(t.updatedAt) : new Date()
        ]
      );
      return t;
    } catch (e) {
      console.error("[DB Repo] Failed to save admission form template to Postgres, committing fallback:", e);
      return await saveFallback();
    }
  }

  /**
   * Deletes a registered admission form template from the database list.
   */
  static async deleteAdmissionFormTemplate(id: string): Promise<boolean> {
    const pool = getPgPool();
    const fallbackDelete = () => {
      const state = loadJsonState();
      if (!state.admissionFormTemplates) state.admissionFormTemplates = [];
      const updated = state.admissionFormTemplates.filter(item => item.id !== id);
      const isDeleted = updated.length < state.admissionFormTemplates.length;
      state.admissionFormTemplates = updated;
      saveJsonState(state);
      return isDeleted;
    };

    if (!pool || !isPgActive) {
      return fallbackDelete();
    }

    try {
      const res = await pool.query(
        "DELETE FROM admission_form_templates WHERE id = $1",
        [id]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to delete admission form template from Postgres, committing fallback:", e);
      return fallbackDelete();
    }
  }

  /**
   * Parse a Cloudinary URL into its constituent parts for reconstruction or repair.
   */
  static parseCloudinaryUrl(url: string) {
    if (!url) return null;
    const match = url.match(/https:\/\/res\.cloudinary\.com\/([^/]+)\/([^/]+)\/upload\/(?:[^/]+\/)*(v\d+\/)?(.+?)(?:\.([^/.]+))?$/);
    if (!match) return null;
    return {
      cloudName: match[1],
      resourceType: match[2],
      version: match[3] || "",
      folderAndPublicId: match[4],
      extension: match[5] || "pdf"
    };
  }

  /**
   * Automatically repair broken Cloudinary URLs for templates.
   */
  static async recoverTemplateUrls(): Promise<void> {
    console.log("[Recovery] Running recoverTemplateUrls() audit...");
    
    // 1. Recover Institutional Letterheads
    try {
      const letterheads = await this.getLetterheads();
      for (const lh of letterheads) {
        const urlToTest = lh.fileUrl;
        if (!urlToTest) continue;

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        const isCloudinaryConfigured = !!((process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.startsWith("cloudinary://")) || (cloudName && apiKey && apiSecret));

        if (!isCloudinaryConfigured && urlToTest.includes("res.cloudinary.com/ideas-tvet")) {
          console.log(`[Recovery] Skipping simulation URL check in offline mode: ${lh.name}`);
          continue;
        }

        let isReachable = false;
        try {
          const testRes = await fetch(urlToTest, { method: "HEAD" });
          if (testRes.status === 200) {
            isReachable = true;
          }
        } catch (err: any) {
          console.warn(`[Recovery] HEAD check failed for letterhead ${lh.name}:`, err.message);
        }

        if (!isReachable) {
          console.log(`[Recovery] Letterhead template '${lh.name}' (URL: ${urlToTest}) is broken. Attempting reconstruction...`);
          const parsed = this.parseCloudinaryUrl(urlToTest);
          if (parsed) {
            const { cloudName, version, folderAndPublicId, extension } = parsed;
            const prefix = `https://res.cloudinary.com/${cloudName}`;
            const variations = [
              `${prefix}/raw/upload/${version}${folderAndPublicId}.${extension}`,
              `${prefix}/image/upload/${version}${folderAndPublicId}.${extension}`,
              `${prefix}/raw/upload/${version}${folderAndPublicId}`,
              `${prefix}/image/upload/${version}${folderAndPublicId}`,
            ];

            let foundUrl: string | null = null;
            for (const variant of variations) {
              if (variant === urlToTest) continue;
              try {
                const variantRes = await fetch(variant, { method: "HEAD" });
                if (variantRes.status === 200) {
                  foundUrl = variant;
                  break;
                }
              } catch (e: any) {}
            }

            if (foundUrl) {
              console.log(`[Recovery] Successfully repaired letterhead '${lh.name}'! New URL: ${foundUrl}`);
              lh.fileUrl = foundUrl;
              if (lh.name.includes("[BROKEN_TEMPLATE]")) {
                lh.name = lh.name.replace(/\s*\[BROKEN_TEMPLATE\]/g, "").trim();
              }
              await this.saveLetterhead(lh);
            } else {
              console.error(`[Recovery] Repair failed for letterhead '${lh.name}'. Flagging as BROKEN_TEMPLATE.`);
              if (!lh.name.includes("[BROKEN_TEMPLATE]")) {
                lh.name = `${lh.name} [BROKEN_TEMPLATE]`;
              }
              await this.saveLetterhead(lh);
            }
          } else {
            console.error(`[Recovery] Cannot parse non-Cloudinary template URL for letterhead '${lh.name}'. Flagging as BROKEN_TEMPLATE.`);
            if (!lh.name.includes("[BROKEN_TEMPLATE]")) {
              lh.name = `${lh.name} [BROKEN_TEMPLATE]`;
            }
            await this.saveLetterhead(lh);
          }
        } else {
          if (lh.name.includes("[BROKEN_TEMPLATE]")) {
            lh.name = lh.name.replace(/\s*\[BROKEN_TEMPLATE\]/g, "").trim();
            await this.saveLetterhead(lh);
          }
        }
      }
    } catch (e: any) {
      console.error("[Recovery] Failed letterheads recovery process:", e.message || e);
    }

    // 2. Recover Admission Form Templates
    try {
      const templates = await this.getAdmissionFormTemplates();
      for (const t of templates) {
        const urlToTest = t.fileUrl;
        if (!urlToTest) continue;

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        const isCloudinaryConfigured = !!((process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.startsWith("cloudinary://")) || (cloudName && apiKey && apiSecret));

        if (!isCloudinaryConfigured && urlToTest.includes("res.cloudinary.com/ideas-tvet")) {
          console.log(`[Recovery] Skipping simulation URL check in offline mode: ${t.name}`);
          continue;
        }

        let isReachable = false;
        try {
          const testRes = await fetch(urlToTest, { method: "HEAD" });
          if (testRes.status === 200) {
            isReachable = true;
          }
        } catch (err: any) {
          console.warn(`[Recovery] HEAD check failed for admission template ${t.name}:`, err.message);
        }

        if (!isReachable) {
          console.log(`[Recovery] Admission template '${t.name}' (URL: ${urlToTest}) is broken. Attempting reconstruction...`);
          const parsed = this.parseCloudinaryUrl(urlToTest);
          if (parsed) {
            const { cloudName, version, folderAndPublicId, extension } = parsed;
            const prefix = `https://res.cloudinary.com/${cloudName}`;
            const variations = [
              `${prefix}/raw/upload/${version}${folderAndPublicId}.${extension}`,
              `${prefix}/image/upload/${version}${folderAndPublicId}.${extension}`,
              `${prefix}/raw/upload/${version}${folderAndPublicId}`,
              `${prefix}/image/upload/${version}${folderAndPublicId}`,
            ];

            let foundUrl: string | null = null;
            for (const variant of variations) {
              if (variant === urlToTest) continue;
              try {
                const variantRes = await fetch(variant, { method: "HEAD" });
                if (variantRes.status === 200) {
                  foundUrl = variant;
                  break;
                }
              } catch (e: any) {}
            }

            if (foundUrl) {
              console.log(`[Recovery] Successfully repaired template '${t.name}'! New URL: ${foundUrl}`);
              t.fileUrl = foundUrl;
              if (t.name.includes("[BROKEN_TEMPLATE]")) {
                t.name = t.name.replace(/\s*\[BROKEN_TEMPLATE\]/g, "").trim();
              }
              await this.saveAdmissionFormTemplate(t);
            } else {
              console.error(`[Recovery] Repair failed for template '${t.name}'. Flagging as BROKEN_TEMPLATE.`);
              if (!t.name.includes("[BROKEN_TEMPLATE]")) {
                t.name = `${t.name} [BROKEN_TEMPLATE]`;
              }
              await this.saveAdmissionFormTemplate(t);
            }
          } else {
            console.error(`[Recovery] Cannot parse non-Cloudinary template URL for admission template '${t.name}'. Flagging as BROKEN_TEMPLATE.`);
            if (!t.name.includes("[BROKEN_TEMPLATE]")) {
              t.name = `${t.name} [BROKEN_TEMPLATE]`;
            }
            await this.saveAdmissionFormTemplate(t);
          }
        } else {
          if (t.name.includes("[BROKEN_TEMPLATE]")) {
            t.name = t.name.replace(/\s*\[BROKEN_TEMPLATE\]/g, "").trim();
            await this.saveAdmissionFormTemplate(t);
          }
        }
      }
    } catch (e: any) {
      console.error("[Recovery] Failed admission templates recovery process:", e.message || e);
    }
  }

  // --- TRAINEE operations ECOSYSTEM METHODS ---

  static async getTraineeProfiles(params: {
    search?: string;
    state?: string;
    skill?: string;
    tsp?: string;
    page?: number;
    limit?: number;
  }): Promise<{ profiles: any[]; total: number }> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return { profiles: [], total: 0 };
    }

    const { search, state, skill, tsp, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE b.deleted_at IS NULL AND b.status IN ('ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI')";
    const values: any[] = [];
    let valIndex = 1;

    if (search) {
      whereClause += ` AND (
        b.first_name ILIKE $${valIndex} OR 
        b.last_name ILIKE $${valIndex} OR 
        b.nin ILIKE $${valIndex} OR 
        b.bvn ILIKE $${valIndex} OR 
        b.skill_sector ILIKE $${valIndex} OR 
        b.guardian_name ILIKE $${valIndex} OR
        tp.tvet_id ILIKE $${valIndex}
      )`;
      values.push(`%${search}%`);
      valIndex++;
    }

    if (state) {
      whereClause += ` AND b.state = $${valIndex}`;
      values.push(state);
      valIndex++;
    }

    if (skill) {
      whereClause += ` AND b.skill_sector = $${valIndex}`;
      values.push(skill);
      valIndex++;
    }

    if (tsp) {
      whereClause += ` AND b.tsp = $${valIndex}`;
      values.push(tsp);
      valIndex++;
    }

    try {
      // count query
      const countRes = await pool.query(
        `SELECT COUNT(*) as count 
         FROM beneficiaries b
         LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
         ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0].count, 10);

      // fetch query
      const queryStr = `
        SELECT 
          COALESCE(tp.id, gen_random_uuid()) as id,
          b.id as beneficiary_id,
          COALESCE(tp.tvet_id, 'ID-TVE-26-' || SUBSTRING(b.id, 1, 6)) as tvet_id,
          b.photo,
          b.first_name,
          b.last_name,
          COALESCE(b.other_name, '') as other_name,
          b.email,
          b.phone_number,
          COALESCE(b.residential_address, '') as residential_address,
          COALESCE(b.certification_status, 'NONE') as certification_status,
          COALESCE(b.beneficiary_status, 'ACTIVE') as beneficiary_status,
          b.gender,
          b.nin,
          b.bvn,
          b.bank_name,
          b.bank_account_holder as account_name,
          b.bank_account_number as account_number,
          b.guardian_name,
          b.guardian_phone,
          b.education_qualification as education_level,
          'NOT_EMPLOYED' as employment_status,
          COALESCE(b.beneficiary_status, 'ACTIVE') as training_status,
          b.skill_sector as sector,
          b.skill_sector as skill,
          b.state,
          b.tsp,
          pm.still_on_portal,
          pm.still_attending,
          pm.last_verified_at,
          pm.remarks as portal_remarks,
          rm.readiness_status,
          rm.attendance_percentage
        FROM beneficiaries b
        LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
        LEFT JOIN portal_monitoring pm ON b.id = pm.beneficiary_id
        LEFT JOIN readiness_metrics rm ON b.id = rm.beneficiary_id
        ${whereClause}
        ORDER BY b.last_name ASC, b.first_name ASC
        LIMIT $${valIndex} OFFSET $${valIndex + 1}
      `;
      
      const fetchValues = [...values, limit, offset];
      const res = await pool.query(queryStr, fetchValues);

      return {
        profiles: res.rows,
        total
      };
    } catch (err: any) {
      console.error("[DB Repo] getTraineeProfiles error:", err);
      return { profiles: [], total: 0 };
    }
  }

  static async getTraineeProfileByBeneficiaryId(beneficiaryId: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      const res = await pool.query(`
        SELECT 
          COALESCE(tp.id, gen_random_uuid()) as id,
          b.id as beneficiary_id,
          COALESCE(tp.tvet_id, 'ID-TVE-26-' || SUBSTRING(b.id, 1, 6)) as tvet_id,
          b.photo,
          b.first_name,
          b.last_name,
          COALESCE(b.other_name, '') as other_name,
          b.email,
          b.phone_number,
          COALESCE(b.residential_address, '') as residential_address,
          COALESCE(b.certification_status, 'NONE') as certification_status,
          COALESCE(b.beneficiary_status, 'ACTIVE') as beneficiary_status,
          b.gender,
          b.nin,
          b.bvn,
          b.bank_name,
          b.bank_account_holder as account_name,
          b.bank_account_number as account_number,
          b.guardian_name,
          b.guardian_phone,
          b.education_qualification as education_level,
          'NOT_EMPLOYED' as employment_status,
          COALESCE(b.beneficiary_status, 'ACTIVE') as training_status,
          b.skill_sector as sector,
          b.skill_sector as skill,
          b.state,
          b.tsp,
          pm.still_on_portal,
          pm.still_attending,
          pm.last_verified_at,
          pm.remarks as portal_remarks
        FROM beneficiaries b
        LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
        LEFT JOIN portal_monitoring pm ON b.id = pm.beneficiary_id
        WHERE b.id = $1
      `, [beneficiaryId]);
      return res.rows[0] || null;
    } catch (e) {
      console.error("[DB Repo] getTraineeProfileByBeneficiaryId error:", e);
      return null;
    }
  }

  static async updateTraineeProfile(beneficiaryId: string, updates: any): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      // 1. Update master record in beneficiaries
      await pool.query(`
        UPDATE beneficiaries
        SET 
          nin = COALESCE($1, nin),
          bvn = COALESCE($2, bvn),
          bank_name = COALESCE($3, bank_name),
          bank_account_holder = COALESCE($4, bank_account_holder),
          bank_account_number = COALESCE($5, bank_account_number),
          guardian_name = COALESCE($6, guardian_name),
          guardian_phone = COALESCE($7, guardian_phone),
          education_qualification = COALESCE($8, education_qualification),
          skill_sector = COALESCE($9, skill_sector),
          state = COALESCE($10, state),
          tsp = COALESCE($11, tsp),
          beneficiary_status = COALESCE($12, beneficiary_status),
          updated_at = NOW()
        WHERE id = $13
      `, [
        updates.nin,
        updates.bvn,
        updates.bank_name,
        updates.account_name,
        updates.account_number,
        updates.guardian_name,
        updates.guardian_phone,
        updates.education_level || updates.education_qualification,
        updates.skill || updates.sector || updates.skill_sector,
        updates.state,
        updates.tsp,
        updates.training_status || updates.beneficiary_status,
        beneficiaryId
      ]);

      // 2. Insert or update thin pointer in trainee_profiles to maintain TVET ID
      await pool.query(`
        INSERT INTO trainee_profiles (beneficiary_id, tvet_id, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (beneficiary_id) DO UPDATE SET
          tvet_id = COALESCE($2, trainee_profiles.tvet_id),
          updated_at = NOW()
      `, [
        beneficiaryId,
        updates.tvet_id || ('ID-TVE-26-' + beneficiaryId.substring(0, 6))
      ]);

      // Fetch the updated complete view to return
      return await DbRepo.getTraineeProfileByBeneficiaryId(beneficiaryId);
    } catch (e) {
      console.error("[DB Repo] updateTraineeProfile error:", e);
      return null;
    }
  }

  static async getTraineeAttendance(params: {
    search?: string;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<{ attendance: any[]; total: number }> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return { attendance: [], total: 0 };

    const { search, date, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE b.deleted_at IS NULL AND b.status IN ('ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI')";
    const values: any[] = [];
    let valIndex = 1;

    if (search) {
      whereClause += ` AND (
        b.first_name ILIKE $${valIndex} OR 
        b.last_name ILIKE $${valIndex} OR 
        b.skill_sector ILIKE $${valIndex}
      )`;
      values.push(`%${search}%`);
      valIndex++;
    }

    if (date) {
      whereClause += ` AND ta.attendance_date = $${valIndex}`;
      values.push(date);
      valIndex++;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*) as count 
         FROM trainee_attendance ta
         JOIN beneficiaries b ON ta.beneficiary_id = b.id
         ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const queryStr = `
        SELECT 
          ta.*,
          b.first_name,
          b.last_name,
          COALESCE(tp.tvet_id, 'ID-TVE-26-' || SUBSTRING(b.id, 1, 6)) as tvet_id,
          b.skill_sector as skill,
          b.state,
          b.tsp
        FROM trainee_attendance ta
        JOIN beneficiaries b ON ta.beneficiary_id = b.id
        LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
        ${whereClause}
        ORDER BY ta.attendance_date DESC, b.last_name ASC, b.first_name ASC
        LIMIT $${valIndex} OFFSET $${valIndex + 1}
      `;

      const fetchValues = [...values, limit, offset];
      const res = await pool.query(queryStr, fetchValues);

      return {
        attendance: res.rows,
        total
      };
    } catch (e) {
      console.error("[DB Repo] getTraineeAttendance error:", e);
      return { attendance: [], total: 0 };
    }
  }

  static async saveTraineeAttendance(record: {
    beneficiary_id: string;
    attendance_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    attendance_source?: string;
    status: string;
    captured_by?: string;
    remarks?: string;
  }): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      const res = await pool.query(`
        INSERT INTO trainee_attendance (
          beneficiary_id,
          attendance_date,
          check_in_time,
          check_out_time,
          attendance_source,
          status,
          captured_by,
          remarks,
          updated_at
        ) VALUES ($1, $2, $3, $4, COALESCE($5, 'MANUAL'), COALESCE($6, 'PRESENT'), $7, $8, NOW())
        ON CONFLICT (beneficiary_id, attendance_date) DO UPDATE SET
          check_in_time = EXCLUDED.check_in_time,
          check_out_time = EXCLUDED.check_out_time,
          attendance_source = EXCLUDED.attendance_source,
          status = EXCLUDED.status,
          captured_by = EXCLUDED.captured_by,
          remarks = EXCLUDED.remarks,
          updated_at = NOW()
        RETURNING *
      `, [
        record.beneficiary_id,
        record.attendance_date,
        record.check_in_time,
        record.check_out_time,
        record.attendance_source,
        record.status,
        record.captured_by || null,
        record.remarks || null
      ]);
      return res.rows[0];
    } catch (e) {
      console.error("[DB Repo] saveTraineeAttendance error:", e);
      return null;
    }
  }

  static async getAttendanceStats(dateStr?: string): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return {
        totalTrainees: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        biometricCount: 0,
        portalActive: 0,
        certificationReady: 0,
        date: dateStr || new Date().toISOString().split("T")[0]
      };
    }
    const targetDate = dateStr || new Date().toISOString().split("T")[0];
    try {
      const activeTraineesRes = await pool.query(`
        SELECT COUNT(*) as count FROM beneficiaries WHERE status IN ('ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI') AND deleted_at IS NULL
      `);
      const totalTrainees = parseInt(activeTraineesRes.rows[0].count, 10);

      const statsRes = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM trainee_attendance
        WHERE attendance_date = $1
        GROUP BY status
      `, [targetDate]);

      let presentNum = 0;
      let absentNum = 0;
      let lateNum = 0;
      let excusedNum = 0;

      for (const row of statsRes.rows) {
        if (row.status === "PRESENT") presentNum = parseInt(row.count, 10);
        else if (row.status === "ABSENT") absentNum = parseInt(row.count, 10);
        else if (row.status === "LATE") lateNum = parseInt(row.count, 10);
        else if (row.status === "EXCUSED") excusedNum = parseInt(row.count, 10);
      }

      const bioRes = await pool.query(`
        SELECT COUNT(*) as count
        FROM trainee_attendance
        WHERE attendance_date = $1 AND attendance_source = 'BIOMETRIC'
      `, [targetDate]);
      const biometricCount = parseInt(bioRes.rows[0].count, 10);

      // Fetch portal active count
      const portalRes = await pool.query(`
        SELECT COUNT(*) as count FROM portal_monitoring WHERE still_on_portal = true
      `);
      const portalActive = parseInt(portalRes.rows[0].count, 10);

      // Fetch certification ready count
      const readyRes = await pool.query(`
        SELECT COUNT(*) as count FROM readiness_metrics WHERE readiness_status = 'READY_FOR_CERTIFICATION'
      `);
      const certificationReady = readyRes.rows.length > 0 ? parseInt(readyRes.rows[0].count, 10) : 0;

      return {
        totalTrainees,
        present: presentNum + lateNum,
        absent: absentNum,
        late: lateNum,
        excused: excusedNum,
        biometricCount,
        portalActive,
        certificationReady,
        date: targetDate
      };
    } catch (e) {
      console.error("[DB Repo] getAttendanceStats error:", e);
      return {
        totalTrainees: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        biometricCount: 0,
        portalActive: 0,
        certificationReady: 0,
        date: targetDate
      };
    }
  }

  static async savePortalMonitoring(beneficiaryId: string, updates: {
    still_on_portal?: boolean;
    still_attending?: boolean;
    remarks?: string;
    verified_by?: string;
  }): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      const res = await pool.query(`
        INSERT INTO portal_monitoring (
          beneficiary_id,
          still_on_portal,
          still_attending,
          remarks,
          verified_by,
          last_verified_at,
          updated_at
        ) VALUES ($1, COALESCE($2, TRUE), COALESCE($3, TRUE), COALESCE($4, ''), COALESCE($5, 'System'), NOW(), NOW())
        ON CONFLICT (beneficiary_id) DO UPDATE SET
          still_on_portal = COALESCE($2, portal_monitoring.still_on_portal),
          still_attending = COALESCE($3, portal_monitoring.still_attending),
          remarks = COALESCE($4, portal_monitoring.remarks),
          verified_by = COALESCE($5, portal_monitoring.verified_by),
          last_verified_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `, [
        beneficiaryId,
        updates.still_on_portal,
        updates.still_attending,
        updates.remarks,
        updates.verified_by
      ]);
      return res.rows[0];
    } catch (e) {
      console.error("[DB Repo] savePortalMonitoring error:", e);
      return null;
    }
  }

  static async getPortalMonitoringList(params: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ list: any[]; total: number }> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return { list: [], total: 0 };

    const { search, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE b.deleted_at IS NULL AND b.status IN ('ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI')";
    const values: any[] = [];
    let valIndex = 1;

    if (search) {
      whereClause += ` AND (
        b.first_name ILIKE $${valIndex} OR 
        b.last_name ILIKE $${valIndex} OR 
        b.skill_sector ILIKE $${valIndex}
      )`;
      values.push(`%${search}%`);
      valIndex++;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*) as count 
         FROM beneficiaries b
         ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const queryStr = `
        SELECT 
          pm.id,
          b.id as beneficiary_id,
          COALESCE(pm.still_on_portal, TRUE) as still_on_portal,
          COALESCE(pm.still_attending, TRUE) as still_attending,
          COALESCE(pm.last_verified_at, b.created_at) as last_verified_at,
          COALESCE(pm.remarks, 'Auto-initialized') as remarks,
          COALESCE(pm.verified_by, 'System') as verified_by,
          b.first_name,
          b.last_name,
          COALESCE(tp.tvet_id, 'ID-TVE-26-' || SUBSTRING(b.id, 1, 6)) as tvet_id,
          b.skill_sector as skill,
          b.state,
          b.tsp
        FROM beneficiaries b
        LEFT JOIN portal_monitoring pm ON pm.beneficiary_id = b.id
        LEFT JOIN trainee_profiles tp ON b.id = tp.beneficiary_id
        ${whereClause}
        ORDER BY pm.last_verified_at DESC NULLS LAST, b.last_name ASC
        LIMIT $${valIndex} OFFSET $${valIndex + 1}
      `;

      const fetchValues = [...values, limit, offset];
      const res = await pool.query(queryStr, fetchValues);

      return {
        list: res.rows,
        total
      };
    } catch (e) {
      console.error("[DB Repo] getPortalMonitoringList error:", e);
      return { list: [], total: 0 };
    }
  }

  // --- DOCUMENT DISPATCH METHODS ---

  static async getDocumentDispatches(): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return loadJsonState().documentDispatches || [];
    }
    try {
      const res = await pool.query(
        `SELECT id, beneficiary_id as "beneficiaryId", document_type as "documentType", 
                document_reference as "documentReference", email_address as "emailAddress", 
                status, sent_at as "sentAt", opened_at as "openedAt", downloaded_at as "downloadedAt", 
                failed_at as "failedAt", failure_reason as "failureReason", delivery_provider as "deliveryProvider", 
                message_id as "messageId", secure_token as "secureToken", expires_at as "expiresAt", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM document_dispatches 
         ORDER BY created_at DESC`
      );
      return res.rows;
    } catch (e) {
      console.error("[DB Repo] Failed to get document dispatches from PG, falling back to JSON:", e);
      return loadJsonState().documentDispatches || [];
    }
  }

  static async getDocumentDispatchByToken(token: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      return (state.documentDispatches || []).find(d => d.secureToken === token) || null;
    }
    try {
      const res = await pool.query(
        `SELECT id, beneficiary_id as "beneficiaryId", document_type as "documentType", 
                document_reference as "documentReference", email_address as "emailAddress", 
                status, sent_at as "sentAt", opened_at as "openedAt", downloaded_at as "downloadedAt", 
                failed_at as "failedAt", failure_reason as "failureReason", delivery_provider as "deliveryProvider", 
                message_id as "messageId", secure_token as "secureToken", expires_at as "expiresAt", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM document_dispatches 
         WHERE secure_token = $1`,
        [token]
      );
      return res.rows[0] || null;
    } catch (e) {
      console.error("[DB Repo] Failed to get document dispatch by token from PG, falling back to JSON:", e);
      const state = loadJsonState();
      return (state.documentDispatches || []).find(d => d.secureToken === token) || null;
    }
  }

  static async getDocumentDispatchById(id: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      return (state.documentDispatches || []).find(d => d.id === id) || null;
    }
    try {
      const res = await pool.query(
        `SELECT id, beneficiary_id as "beneficiaryId", document_type as "documentType", 
                document_reference as "documentReference", email_address as "emailAddress", 
                status, sent_at as "sentAt", opened_at as "openedAt", downloaded_at as "downloadedAt", 
                failed_at as "failedAt", failure_reason as "failureReason", delivery_provider as "deliveryProvider", 
                message_id as "messageId", secure_token as "secureToken", expires_at as "expiresAt", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM document_dispatches 
         WHERE id = $1`,
        [id]
      );
      return res.rows[0] || null;
    } catch (e) {
      console.error("[DB Repo] Failed to get document dispatch by ID from PG, falling back to JSON:", e);
      const state = loadJsonState();
      return (state.documentDispatches || []).find(d => d.id === id) || null;
    }
  }

  static async getDocumentDispatchesByBeneficiary(beneficiaryId: string): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      return (state.documentDispatches || []).filter(d => d.beneficiaryId === beneficiaryId);
    }
    try {
      const res = await pool.query(
        `SELECT id, beneficiary_id as "beneficiaryId", document_type as "documentType", 
                document_reference as "documentReference", email_address as "emailAddress", 
                status, sent_at as "sentAt", opened_at as "openedAt", downloaded_at as "downloadedAt", 
                failed_at as "failedAt", failure_reason as "failureReason", delivery_provider as "deliveryProvider", 
                message_id as "messageId", secure_token as "secureToken", expires_at as "expiresAt", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM document_dispatches 
         WHERE beneficiary_id = $1 
         ORDER BY created_at DESC`,
        [beneficiaryId]
      );
      return res.rows;
    } catch (e) {
      console.error("[DB Repo] Failed to get dispatches by beneficiary from PG, falling back to JSON:", e);
      const state = loadJsonState();
      return (state.documentDispatches || []).filter(d => d.beneficiaryId === beneficiaryId);
    }
  }

  static async saveDocumentDispatch(d: any): Promise<any> {
    const pool = getPgPool();
    const saveFallback = () => {
      const state = loadJsonState();
      if (!state.documentDispatches) state.documentDispatches = [];
      const index = state.documentDispatches.findIndex(item => item.id === d.id);
      if (index >= 0) {
        state.documentDispatches[index] = { ...state.documentDispatches[index], ...d, updatedAt: new Date().toISOString() };
      } else {
        state.documentDispatches.push({ ...d, createdAt: d.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      saveJsonState(state);
      return d;
    };

    if (!pool || !isPgActive) {
      return saveFallback();
    }

    try {
      await pool.query(
        `INSERT INTO document_dispatches (
          id, beneficiary_id, document_type, document_reference, email_address, status,
          sent_at, opened_at, downloaded_at, failed_at, failure_reason,
          delivery_provider, message_id, secure_token, expires_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET
           beneficiary_id = EXCLUDED.beneficiary_id,
           document_type = EXCLUDED.document_type,
           document_reference = EXCLUDED.document_reference,
           email_address = EXCLUDED.email_address,
           status = EXCLUDED.status,
           sent_at = EXCLUDED.sent_at,
           opened_at = EXCLUDED.opened_at,
           downloaded_at = EXCLUDED.downloaded_at,
           failed_at = EXCLUDED.failed_at,
           failure_reason = EXCLUDED.failure_reason,
           delivery_provider = EXCLUDED.delivery_provider,
           message_id = EXCLUDED.message_id,
           secure_token = EXCLUDED.secure_token,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
        [
          d.id, d.beneficiaryId, d.documentType, d.documentReference || null, d.emailAddress, d.status,
          d.sentAt ? new Date(d.sentAt) : null,
          d.openedAt ? new Date(d.openedAt) : null,
          d.downloadedAt ? new Date(d.downloadedAt) : null,
          d.failedAt ? new Date(d.failedAt) : null,
          d.failureReason || null, d.deliveryProvider || null, d.messageId || null,
          d.secureToken || null,
          d.expiresAt ? new Date(d.expiresAt) : null,
          d.createdAt ? new Date(d.createdAt) : new Date(),
          d.updatedAt ? new Date(d.updatedAt) : new Date()
        ]
      );
      return d;
    } catch (e) {
      console.error("[DB Repo] Failed to save document dispatch to PG, falling back to JSON:", e);
      return saveFallback();
    }
  }

  // --- EMAIL TEMPLATES ENGINE METHODS ---

  static async getEmailTemplates(): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return loadJsonState().emailTemplates || [];
    }
    try {
      const res = await pool.query(
        `SELECT id, name, template_type as "templateType", subject, body_html as "bodyHtml", 
                body_text as "bodyText", is_default as "isDefault", is_active as "isActive", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM email_templates 
         ORDER BY created_at DESC`
      );
      return res.rows.map(r => ({ ...r, isDefault: !!r.isDefault, isActive: !!r.isActive }));
    } catch (e) {
      console.error("[DB Repo] Failed to get email templates from PG, falling back to JSON:", e);
      return loadJsonState().emailTemplates || [];
    }
  }

  static async getEmailTemplateById(id: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      return (state.emailTemplates || []).find(t => t.id === id) || null;
    }
    try {
      const res = await pool.query(
        `SELECT id, name, template_type as "templateType", subject, body_html as "bodyHtml", 
                body_text as "bodyText", is_default as "isDefault", is_active as "isActive", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM email_templates 
         WHERE id = $1`,
        [id]
      );
      if (!res.rows[0]) return null;
      return { ...res.rows[0], isDefault: !!res.rows[0].isDefault, isActive: !!res.rows[0].isActive };
    } catch (e) {
      console.error("[DB Repo] Failed to get email template by ID from PG, falling back to JSON:", e);
      const state = loadJsonState();
      return (state.emailTemplates || []).find(t => t.id === id) || null;
    }
  }

  static async getEmailTemplateByType(type: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const items = state.emailTemplates || [];
      const match = items.find(t => t.templateType === type && t.isDefault && t.isActive) ||
                    items.find(t => t.templateType === type && t.isActive) ||
                    items.find(t => t.templateType === type);
      return match || null;
    }
    try {
      const res = await pool.query(
        `SELECT id, name, template_type as "templateType", subject, body_html as "bodyHtml", 
                body_text as "bodyText", is_default as "isDefault", is_active as "isActive", 
                created_at as "createdAt", updated_at as "updatedAt" 
         FROM email_templates 
         WHERE template_type = $1 
         ORDER BY is_default DESC, created_at DESC`,
        [type]
      );
      if (!res.rows[0]) return null;
      return { ...res.rows[0], isDefault: !!res.rows[0].isDefault, isActive: !!res.rows[0].isActive };
    } catch (e) {
      console.error("[DB Repo] Failed to get email template by Type from PG, falling back to JSON:", e);
      const state = loadJsonState();
      const items = state.emailTemplates || [];
      const match = items.find(t => t.templateType === type && t.isDefault && t.isActive) ||
                    items.find(t => t.templateType === type && t.isActive) ||
                    items.find(t => t.templateType === type);
      return match || null;
    }
  }

  static async saveEmailTemplate(t: any): Promise<any> {
    const pool = getPgPool();
    const saveFallback = () => {
      const state = loadJsonState();
      if (!state.emailTemplates) state.emailTemplates = [];
      if (t.isDefault && t.isActive) {
        state.emailTemplates.forEach(item => {
          if (item.templateType === t.templateType && item.id !== t.id) {
            item.isDefault = false;
          }
        });
      }
      const index = state.emailTemplates.findIndex(item => item.id === t.id);
      if (index >= 0) {
        state.emailTemplates[index] = { ...state.emailTemplates[index], ...t, updatedAt: new Date().toISOString() };
      } else {
        state.emailTemplates.push({ ...t, createdAt: t.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      saveJsonState(state);
      return t;
    };

    if (!pool || !isPgActive) {
      return saveFallback();
    }

    try {
      if (t.isDefault && t.isActive) {
        await pool.query(
          "UPDATE email_templates SET is_default = FALSE WHERE template_type = $1 AND id <> $2",
          [t.templateType, t.id]
        );
      }
      await pool.query(
        `INSERT INTO email_templates (
          id, name, template_type, subject, body_html, body_text, is_default, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           template_type = EXCLUDED.template_type,
           subject = EXCLUDED.subject,
           body_html = EXCLUDED.body_html,
           body_text = EXCLUDED.body_text,
           is_default = EXCLUDED.is_default,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          t.id, t.name, t.templateType, t.subject, t.bodyHtml, t.bodyText || null,
          !!t.isDefault, !!t.isActive,
          t.createdAt ? new Date(t.createdAt) : new Date(),
          t.updatedAt ? new Date(t.updatedAt) : new Date()
        ]
      );
      return t;
    } catch (e) {
      console.error("[DB Repo] Failed to save email template to PG, falling back to JSON:", e);
      return saveFallback();
    }
  }

  static async deleteEmailTemplate(id: string): Promise<boolean> {
    const pool = getPgPool();
    const fallbackDelete = () => {
      const state = loadJsonState();
      if (!state.emailTemplates) state.emailTemplates = [];
      const updated = state.emailTemplates.filter(item => item.id !== id);
      const isDeleted = updated.length < state.emailTemplates.length;
      state.emailTemplates = updated;
      saveJsonState(state);
      return isDeleted;
    };

    if (!pool || !isPgActive) {
      return fallbackDelete();
    }

    try {
      const res = await pool.query(
        "DELETE FROM email_templates WHERE id = $1",
        [id]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to delete email template from PG, falling back to JSON:", e);
      return fallbackDelete();
    }
  }

  // --- TOOLKITS & ASSET MANAGEMENT DB REPO METHODS (ADDITIVE) ---

  static async getToolkitAssets(): Promise<any[]> {
    const pool = getPgPool();
    const fallbackGet = () => {
      const state = loadJsonState();
      return state.toolkitAssets || [];
    };

    if (!pool || !isPgActive) {
      return fallbackGet();
    }

    try {
      const res = await pool.query(
        `SELECT id, asset_code AS "assetCode", asset_name AS "assetName", 
                asset_category AS "assetCategory", training_track AS "trainingTrack", 
                description, unit_cost::float AS "unitCost", quantity, status, 
                created_at AS "createdAt", updated_at AS "updatedAt" 
         FROM toolkit_assets 
         ORDER BY created_at DESC`
      );
      return res.rows;
    } catch (e) {
      console.error("[DB Repo] Failed to get toolkit assets from PG, falling back:", e);
      return fallbackGet();
    }
  }

  static async saveToolkitAsset(asset: any): Promise<any> {
    const pool = getPgPool();
    const fallbackSave = () => {
      const state = loadJsonState();
      if (!state.toolkitAssets) state.toolkitAssets = [];
      const id = asset.id || "ta_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      const toSave = {
        ...asset,
        id,
        createdAt: asset.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const idx = state.toolkitAssets.findIndex((item: any) => item.id === id);
      if (idx !== -1) {
        state.toolkitAssets[idx] = toSave;
      } else {
        state.toolkitAssets.push(toSave);
      }
      saveJsonState(state);
      return toSave;
    };

    if (!pool || !isPgActive) {
      return fallbackSave();
    }

    try {
      const id = asset.id || "ta_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      const res = await pool.query(
        `INSERT INTO toolkit_assets (
          id, asset_code, asset_name, asset_category, training_track, description, unit_cost, quantity, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), NOW())
        ON CONFLICT (id) DO UPDATE SET
          asset_code = EXCLUDED.asset_code,
          asset_name = EXCLUDED.asset_name,
          asset_category = EXCLUDED.asset_category,
          training_track = EXCLUDED.training_track,
          description = EXCLUDED.description,
          unit_cost = EXCLUDED.unit_cost,
          quantity = EXCLUDED.quantity,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING id, asset_code AS "assetCode", asset_name AS "assetName", 
                  asset_category AS "assetCategory", training_track AS "trainingTrack", 
                  description, unit_cost::float AS "unitCost", quantity, status, 
                  created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          id, asset.assetCode, asset.assetName, asset.assetCategory, asset.trainingTrack, asset.description || null,
          parseFloat(asset.unitCost) || 0, parseInt(asset.quantity) || 0, asset.status || "ACTIVE",
          asset.createdAt ? new Date(asset.createdAt) : null
        ]
      );
      return res.rows[0];
    } catch (e: any) {
      console.error("[DB Repo] Failed to save toolkit asset to PG, falling back:", e);
      return fallbackSave();
    }
  }

  static async deleteToolkitAsset(id: string): Promise<boolean> {
    const pool = getPgPool();
    const fallbackDelete = () => {
      const state = loadJsonState();
      if (!state.toolkitAssets) state.toolkitAssets = [];
      const updated = state.toolkitAssets.filter((item: any) => item.id !== id);
      const isDeleted = updated.length < state.toolkitAssets.length;
      state.toolkitAssets = updated;
      saveJsonState(state);
      return isDeleted;
    };

    if (!pool || !isPgActive) {
      return fallbackDelete();
    }

    try {
      const res = await pool.query("UPDATE toolkit_assets SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to archive toolkit asset in PG:", e);
      return fallbackDelete();
    }
  }

  static async getGraduateToolkits(): Promise<any[]> {
    const pool = getPgPool();
    const fallbackGet = () => {
      const state = loadJsonState();
      const graduates = state.graduateToolkits || [];
      const beneficiaries = state.beneficiaries || [];
      const assets = state.toolkitAssets || [];

      return graduates.map((g: any) => {
        const b: any = beneficiaries.find((item: any) => item.id === g.beneficiaryId) || {};
        const a: any = assets.find((item: any) => item.id === g.assetId) || {};
        return {
          ...g,
          beneficiaryName: `${b.firstName || ""} ${b.lastName || ""}`.trim() || "Unknown Graduate",
          trainingTrack: b.skillSector || a.trainingTrack || "Digital Skills",
          assetName: a.assetName || "Unknown Asset",
          assetCode: a.assetCode || "",
          assetCategory: a.assetCategory || ""
        };
      });
    };

    if (!pool || !isPgActive) {
      return fallbackGet();
    }

    try {
      const res = await pool.query(`
        SELECT 
          gt.id,
          gt.beneficiary_id AS "beneficiaryId",
          gt.asset_id AS "assetId",
          gt.issue_date AS "issueDate",
          gt.issued_by AS "issuedBy",
          gt.verification_status AS "verificationStatus",
          gt.utilization_status AS "utilizationStatus",
          gt.condition_status AS "conditionStatus",
          gt.replacement_requested AS "replacementRequested",
          gt.replacement_reason AS "replacementReason",
          gt.last_verified_at AS "lastVerifiedAt",
          gt.created_at AS "createdAt",
          gt.updated_at AS "updatedAt",
          CONCAT(b.first_name, ' ', b.last_name) AS "beneficiaryName",
          b.skill_sector AS "trainingTrack",
          ta.asset_name AS "assetName",
          ta.asset_code AS "assetCode",
          ta.asset_category AS "assetCategory"
        FROM graduate_toolkits gt
        JOIN beneficiaries b ON gt.beneficiary_id = b.id
        JOIN toolkit_assets ta ON gt.asset_id = ta.id
        ORDER BY gt.created_at DESC
      `);
      return res.rows;
    } catch (e) {
      console.error("[DB Repo] Failed to get graduate toolkits from PG:", e);
      return fallbackGet();
    }
  }

  static async assignToolkit(beneficiaryId: string, assetId: string, operator: string): Promise<any> {
    const pool = getPgPool();
    const id = "gt_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    const fallbackAssign = () => {
      const state = loadJsonState();
      if (!state.graduateToolkits) state.graduateToolkits = [];
      const duplicate = state.graduateToolkits.find((g: any) => g.beneficiaryId === beneficiaryId && g.assetId === assetId);
      if (duplicate) {
        return duplicate;
      }
      const newAssign = {
        id,
        beneficiaryId,
        assetId,
        verificationStatus: "ALLOCATED",
        utilizationStatus: "NOT_IN_USE",
        conditionStatus: "NEW",
        replacementRequested: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.graduateToolkits.push(newAssign);
      saveJsonState(state);
      return newAssign;
    };

    if (!pool || !isPgActive) {
      return fallbackAssign();
    }

    try {
      const checkRes = await pool.query(
        "SELECT id, beneficiary_id AS \"beneficiaryId\", asset_id AS \"assetId\" FROM graduate_toolkits WHERE beneficiary_id = $1 AND asset_id = $2",
        [beneficiaryId, assetId]
      );
      if (checkRes.rows.length > 0) {
        return checkRes.rows[0];
      }

      const res = await pool.query(
        `INSERT INTO graduate_toolkits (
          id, beneficiary_id, asset_id, verification_status, utilization_status, condition_status, replacement_requested, created_at, updated_at
        ) VALUES ($1, $2, $3, 'ALLOCATED', 'NOT_IN_USE', 'NEW', FALSE, NOW(), NOW())
        RETURNING id, beneficiary_id AS "beneficiaryId", asset_id AS "assetId", 
                  verification_status AS "verificationStatus", utilization_status AS "utilizationStatus"`,
        [id, beneficiaryId, assetId]
      );
      return res.rows[0];
    } catch (e) {
      console.error("[DB Repo] Failed to assign toolkit to PG:", e);
      return fallbackAssign();
    }
  }

  static async updateToolkitStatus(id: string, fields: any, operator: string): Promise<any> {
    const pool = getPgPool();
    const fallbackUpdate = () => {
      const state = loadJsonState();
      if (!state.graduateToolkits) state.graduateToolkits = [];
      const idx = state.graduateToolkits.findIndex((g: any) => g.id === id);
      if (idx !== -1) {
        const item = state.graduateToolkits[idx];
        const updated = {
          ...item,
          ...fields,
          updatedAt: new Date().toISOString()
        };
        state.graduateToolkits[idx] = updated;
        saveJsonState(state);
        return updated;
      }
      return null;
    };

    if (!pool || !isPgActive) {
      return fallbackUpdate();
    }

    try {
      const setClauses: string[] = [];
      const values: any[] = [id];
      let pIdx = 2;

      for (const key of Object.keys(fields)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        setClauses.push(`${snakeKey} = ${pIdx}`);
        values.push(fields[key]);
        pIdx++;
      }

      if (setClauses.length === 0) return null;

      const query = `
        UPDATE graduate_toolkits
        SET ${setClauses.join(", ")}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, beneficiary_id AS "beneficiaryId", asset_id AS "assetId"
      `;
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (e) {
      console.error("[DB Repo] Failed to update graduate toolkit status in PG:", e);
      return fallbackUpdate();
    }
  }
}

