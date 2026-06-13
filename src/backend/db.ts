/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Beneficiary, ProgramStatus, AuditLog, CustomField, OrganizationSettings, TrainingProgram, WorkflowHistory, InstitutionLetterhead, AdmissionFormTemplate } from "../types";
import { requestStorage } from "./request-storage";
import { NIGERIAN_STATES_AND_LGAS } from "../utils/nigerianLgasData";

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
export let isPgActive = false;
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

export async function executeQuery(
  sql: string,
  params: any[] = []
): Promise<pg.QueryResult<any>> {
  const store = requestStorage.getStore();
  const activeClient = store?.dbClient;

  if (activeClient) {
    return activeClient.query(sql, params);
  }

  const pool = getPgPool();
  if (!pool) {
    throw new Error("Database pool unavailable");
  }

  return pool.query(sql, params);
}

export async function assertTenantContext(options?: { systemContext?: boolean }) {
  if (options?.systemContext === true) {
    return;
  }
  const res = await executeQuery(`
    SELECT
      current_setting('app.current_tenant_tier', true) AS tier,
      current_setting('app.current_user_role', true) AS role
  `);

  const row = res.rows[0];

  if (!row || !row.role) {
    throw new Error(
      "Tenant security context missing. Query execution blocked."
    );
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
  -- Create enum type if not exists
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_tier') THEN
      CREATE TYPE tenant_tier AS ENUM ('FED', 'STA', 'TSP', 'BEN');
    END IF;
  END $$;

  -- Create tenants table
  CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    tier tenant_tier NOT NULL DEFAULT 'FED',
    parent_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Create states table
  CREATE TABLE IF NOT EXISTS states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) UNIQUE NOT NULL,
    state_code VARCHAR(10) UNIQUE NOT NULL,
    code VARCHAR(10),
    geopolitical_zone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  -- Create local_governments table
  CREATE TABLE IF NOT EXISTS local_governments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id UUID REFERENCES states(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create lgas reference table
  CREATE TABLE IF NOT EXISTS lgas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    UNIQUE(state_name, name)
  );

  -- Create training_centers table
  CREATE TABLE IF NOT EXISTS training_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    state_id UUID REFERENCES states(id) ON DELETE CASCADE,
    lga_id UUID REFERENCES local_governments(id) ON DELETE CASCADE,
    center_name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create tsps table
  CREATE TABLE IF NOT EXISTS tsps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    state_id UUID REFERENCES states(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );

  CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);
  CREATE INDEX IF NOT EXISTS idx_tenants_parent ON tenants(parent_id);
  CREATE INDEX IF NOT EXISTS idx_states_tenant_id ON states(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tsps_tenant_id ON tsps(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tsps_state_id ON tsps(state_id);
  CREATE INDEX IF NOT EXISTS idx_lg_state_id ON local_governments(state_id);
  CREATE INDEX IF NOT EXISTS idx_tc_tenant_id ON training_centers(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tc_state_id ON training_centers(state_id);
  CREATE INDEX IF NOT EXISTS idx_tc_lga_id ON training_centers(lga_id);

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
    token_version INT DEFAULT 1,
    workflow_version INT DEFAULT 1,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    state_id UUID REFERENCES states(id) ON DELETE SET NULL,
    tsp_id UUID REFERENCES tsps(id) ON DELETE SET NULL,
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
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
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
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    state_id UUID REFERENCES states(id) ON DELETE SET NULL,
    tsp_id UUID REFERENCES tsps(id) ON DELETE SET NULL,
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
    document_status VARCHAR(50) DEFAULT 'ACTIVE',
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
    ip_address VARCHAR(100),
    token_version_before INT DEFAULT 1,
    token_version_after INT DEFAULT 1,
    workflow_version_before INT DEFAULT 1,
    workflow_version_after INT DEFAULT 1
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
    hours_logged NUMERIC(5, 2) DEFAULT 0.00,
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

  -- Communication Templates table
  CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Communication Campaigns table
  CREATE TABLE IF NOT EXISTS communication_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_by VARCHAR(100),
    total_recipients INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    audience_filter TEXT, -- Saved filters as JSON string
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Communication Recipients table
  CREATE TABLE IF NOT EXISTS communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES communication_campaigns(id) ON DELETE CASCADE,
    beneficiary_id VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_comm_recipients_campaign ON communication_recipients(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_comm_recipients_beneficiary ON communication_recipients(beneficiary_id);

  -- Cohorts table
  CREATE TABLE IF NOT EXISTS cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    cohort_year INT NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_by VARCHAR(100) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
  );
  CREATE INDEX IF NOT EXISTS idx_cohorts_tenant ON cohorts(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_cohorts_year ON cohorts(cohort_year);
  CREATE INDEX IF NOT EXISTS idx_cohorts_status_deleted_at ON cohorts(status, deleted_at);

  -- Training Batches table
  CREATE TABLE IF NOT EXISTS training_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    tsp_id UUID REFERENCES tsps(id),
    cohort_id UUID REFERENCES cohorts(id),
    training_program_id VARCHAR(50) REFERENCES training_programs(id),
    batch_number VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    capacity INT DEFAULT 30,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_by VARCHAR(100) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_batches_tsp ON training_batches(tsp_id);
  CREATE INDEX IF NOT EXISTS idx_batches_cohort ON training_batches(cohort_id);
  CREATE INDEX IF NOT EXISTS idx_batches_status ON training_batches(status);

  -- Trainers table
  CREATE TABLE IF NOT EXISTS trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    tsp_id UUID REFERENCES tsps(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    accreditation_details TEXT,
    is_nbte_certified BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_by VARCHAR(100) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_trainers_tsp ON trainers(tsp_id);
  CREATE INDEX IF NOT EXISTS idx_trainers_status ON trainers(status);
  CREATE INDEX IF NOT EXISTS idx_trainers_is_nbte_certified ON trainers(is_nbte_certified);

  -- Assessments table
  CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id),
    trainer_id UUID REFERENCES trainers(id),
    assessment_name VARCHAR(150) NOT NULL,
    continuous_assessment_score NUMERIC(5,2),
    practical_score NUMERIC(5,2),
    exam_score NUMERIC(5,2),
    final_score NUMERIC(5,2),
    final_grade VARCHAR(10),
    examiner_comments TEXT,
    exam_date DATE,
    status VARCHAR(30) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_assessments_beneficiary ON assessments(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_trainer ON assessments(trainer_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_status_score ON assessments(status, final_score);

  -- Graduation clearances table
  CREATE TABLE IF NOT EXISTS graduation_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    beneficiary_id VARCHAR(50) UNIQUE REFERENCES beneficiaries(id),
    is_cleared_attendance BOOLEAN DEFAULT FALSE,
    is_cleared_assessment BOOLEAN DEFAULT FALSE,
    is_cleared_toolkit BOOLEAN DEFAULT FALSE,
    cleared_by VARCHAR(100) REFERENCES users(id),
    cleared_at TIMESTAMP WITH TIME ZONE,
    ceremony_event_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_graduation_beneficiary ON graduation_clearances(beneficiary_id);

  -- Stipend Compliance Snapshots Table (Phase 4)
  CREATE TABLE IF NOT EXISTS stipend_compliance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id VARCHAR(50) NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
    attendance_percentage NUMERIC(5, 2) NOT NULL,
    present_days INT NOT NULL,
    absent_days INT NOT NULL,
    late_days INT NOT NULL,
    total_hours NUMERIC(6, 2) NOT NULL,
    expected_days INT NOT NULL,
    stipend_status VARCHAR(50) NOT NULL,
    stipend_reason TEXT,
    month_identifier VARCHAR(20) NOT NULL,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (beneficiary_id, month_identifier)
  );
  CREATE INDEX IF NOT EXISTS idx_stipend_compliance_beneficiary ON stipend_compliance_snapshots(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_stipend_compliance_month ON stipend_compliance_snapshots(month_identifier);

  -- Training batch assignments table
  CREATE TABLE IF NOT EXISTS training_batch_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    batch_id UUID NOT NULL REFERENCES training_batches(id),
    beneficiary_id VARCHAR(50) NOT NULL REFERENCES beneficiaries(id),
    assigned_by VARCHAR(100) REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(batch_id, beneficiary_id)
  );
  CREATE INDEX IF NOT EXISTS idx_batch_assignments_batch ON training_batch_assignments(batch_id);
  CREATE INDEX IF NOT EXISTS idx_batch_assignments_beneficiary ON training_batch_assignments(beneficiary_id);

  -- National Sectors table
  CREATE TABLE IF NOT EXISTS sectors (
    id VARCHAR(50) PRIMARY KEY,
    sector_code VARCHAR(50) UNIQUE NOT NULL,
    sector_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- National Skills table
  CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(50) PRIMARY KEY,
    skill_code VARCHAR(50) UNIQUE NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    sector_id VARCHAR(50) REFERENCES sectors(id) ON DELETE CASCADE,
    description TEXT,
    duration_weeks INT DEFAULT 12,
    certification_type VARCHAR(100),
    assessment_method VARCHAR(255),
    equipment_requirements TEXT,
    curriculum_version VARCHAR(50) DEFAULT '1.0',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- EOI Applications table
  CREATE TABLE IF NOT EXISTS eoi_applications (
    id VARCHAR(50) PRIMARY KEY,
    application_code VARCHAR(100) UNIQUE NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    state VARCHAR(100) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    skill_area VARCHAR(255) NOT NULL,
    years_of_experience INT DEFAULT 0,
    nbte_status VARCHAR(100) DEFAULT 'NOT_ACCREDITED',
    application_status VARCHAR(50) DEFAULT 'SUBMITTED',
    submission_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    review_date TIMESTAMP WITH TIME ZONE,
    evaluation_score NUMERIC(5,2) DEFAULT 0.00,
    recommendation TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_eoi_status ON eoi_applications(application_status);
  CREATE INDEX IF NOT EXISTS idx_skills_sector ON skills(sector_id);
`;

/**
 * Seed roles, permissions and baseline users in PG DB
 */
async function seedAuthAndRoles(pool: pg.Pool): Promise<void> {
  try {
    console.log("[DB] Seeding roles, permissions, and default accounts (National RBAC - Task 008)...");
    
    let rolesSeeded = false;
    let permissionsSeeded = false;
    let mappingsSeeded = false;
    
    try {
      const checkRoles = await pool.query("SELECT COUNT(*)::int as count FROM roles");
      const checkPermissions = await pool.query("SELECT COUNT(*)::int as count FROM permissions");
      const checkMappings = await pool.query("SELECT COUNT(*)::int as count FROM role_permissions");
      rolesSeeded = (checkRoles.rows[0]?.count || 0) > 0;
      permissionsSeeded = (checkPermissions.rows[0]?.count || 0) > 0;
      mappingsSeeded = (checkMappings.rows[0]?.count || 0) > 0;
    } catch (e: any) {
      console.warn("[DB] Failed to pre-check seeded counts, will perform full seeding:", e.message);
    }
    
    if (process.env.SAFE_MODE === "true") {
      console.log("[DB] SAFE_MODE is active. Skipping explicit roles/permissions/mappings seeding.");
      return;
    }

    if (rolesSeeded && permissionsSeeded && mappingsSeeded) {
      console.log("[DB] Roles, permissions, and mappings already seeded. Skipping full insert runs (saves 90+ roundtrips).");
    } else {
    
    // 1. Insert Roles (Legacy and Target National Roles)
    const roles = [
      // Legacy Roles
      { id: "SUPER_ADMIN", name: "Super Administrator", description: "Full system administration and user management" },
      { id: "ADMIN_OFFICER", name: "Admin Officer", description: "Manage admissions, generate letters, send emails" },
      { id: "REVIEW_OFFICER", name: "Review Officer", description: "Review submissions, approve acceptance letters" },
      { id: "TRAINEE", name: "Trainee Candidate", description: "View profile, submit acceptance, track application" },

      // Federal Roles
      { id: "FEDERAL_SUPER_ADMIN", name: "Federal Super Administrator", description: "National platform administration, organization management, global configuration, schema migrations" },
      { id: "FEDERAL_PROGRAM_MANAGER", name: "Federal Program Manager", description: "Manage national-level trainees, review Annex 9 submissions, global reports and dashboards" },
      { id: "FEDERAL_REVIEW_MANAGER", name: "Federal Review Manager", description: "Highest authority for approving/rejecting beneficiary admissions, managing audit trails, system logs" },

      // State Roles
      { id: "STATE_COORDINATOR", name: "State Coordinator", description: "State-wide beneficiary monitoring, Annex 9 data validation, programmatic overview" },
      { id: "STATE_REVIEW_OFFICER", name: "State Review Officer", description: "Perform direct audits and approve/reject admissions within state borders, prepare evaluation stats" },
      { id: "STATE_M_E_OFFICER", name: "State Monitoring & Evaluation Officer", description: "Access state-wide analytical dashboards, system audit logs, and diagnostic reports" },

      // TSP Roles
      { id: "TSP_ADMIN", name: "TSP Administrator", description: "Manage local training center activities, roster changes, Annex 9 compliance declarations" },
      { id: "TSP_TRAINING_MANAGER", name: "TSP Training Manager", description: "Enroll and monitor local trainee progress, record details, update lesson progress" },
      { id: "TSP_REVIEW_OFFICER", name: "TSP Review Officer", description: "Assess local candidate entrance criteria, coordinate evaluations with external auditors" },

      // Beneficiary Role
      { id: "BENEFICIARY", name: "Beneficiary", description: "Access self-service portals, review training checklists, receive secure documentation letters" },

      // Governance Roles
      { id: "SYSTEM_AUDITOR", name: "System Auditor", description: "ReadOnly access to security records, transaction trails, database logs, baseline settings" },
      { id: "REPORT_VIEWER", name: "Report Viewer", description: "ReadOnly access to standard reports, tables, graphical charts, data exports" },
      { id: "HELPDESK_AGENT", name: "Helpdesk Agent", description: "Access basic diagnostics, view trainee rosters, resolve portal access credentials" },
      { id: "MIGRATION_ADMIN", name: "Migration Administrator", description: "Execute bulk schema scripts, import seed lists, manipulate metadata definitions" },
      { id: "FED", name: "Federal Governance Administrator", description: "Federal admin control and release certificate management" },
      { id: "STA", name: "State Governance Administrator", description: "State-wide administrative coordinator and program oversight" },
      { id: "TSP", name: "Training Provider Operating Agent", description: "Training service provider group representative" }
    ];

    for (const r of roles) {
      await pool.query(
        "INSERT INTO roles (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description",
        [r.id, r.name, r.description]
      );
    }

    // 2. Insert Permissions (Legacy and target National Permissions)
    const permissions = [
      // Legacy Permissions
      { id: "all_access", name: "All Access", description: "Unrestricted system actions" },
      { id: "manage_admissions", name: "Manage Admissions", description: "Ability to generate offers and send emails" },
      { id: "review_submissions", name: "Review Submissions", description: "Ability to audit candidate acceptance documents" },
      { id: "trainee_access", name: "Trainee Access", description: "Access own student profile and form response submission" },

      // System Permissions
      { id: "manage_users", name: "Manage Users", description: "Create, view, modify or disable user accounts" },
      { id: "manage_roles", name: "Manage Roles", description: "Define custom platform roles, scopes, and hierarchies" },
      { id: "manage_permissions", name: "Manage Permissions", description: "Configure system permissions and role assignments" },
      { id: "execute_migrations", name: "Execute Migrations", description: "Trigger bulk SQL migrations, table audits, data schema upgrades" },

      // Organizational Permissions
      { id: "manage_tenants", name: "Manage Tenants", description: "Provision other federal/state/TSP tenants within platform bounds" },
      { id: "manage_states", name: "Manage States", description: "Configure state registration details, boundaries, coordinates" },
      { id: "manage_tsps", name: "Manage TSPs", description: "Configure Training Provider registration profiles, program catalogs" },

      // Admissions/Beneficiary Permissions
      { id: "review_admissions", name: "Review Admissions", description: "Perform administrative review on trainee applications, verify background" },
      { id: "approve_admissions", name: "Approve Admissions", description: "Approve candidate acceptance letters, grant enrollment" },
      { id: "reject_admissions", name: "Reject Admissions", description: "Reject unqualified applicants, file reasons for rejection" },
      { id: "manage_beneficiaries", name: "Manage Beneficiaries", description: "Modify candidate rosters, update bio profiles, check milestones" },
      { id: "manage_annex9", name: "Manage Annex 9", description: "Handle training readiness checklists and institutional declarations" },

      // Reporting/Audit Permissions
      { id: "view_reports", name: "View Reports", description: "Read programmatic summaries, dashboards, and trainee metrics" },
      { id: "export_reports", name: "Export Reports", description: "Export telemetry, reports, spreadsheets, PDFs, or spreadsheet charts" },
      { id: "audit_logs_access", name: "Audit Logs Access", description: "Inspect database session history, API transaction streams, administrative trace logs" },

      // Dynamic National/Federal Permissions (Task 016C)
      { id: "manage_cohorts", name: "Manage Cohorts", description: "Manage education cohorts" },
      { id: "manage_batches", name: "Manage Batches", description: "Manage training batches" },
      { id: "manage_trainers", name: "Manage Trainers", description: "Manage local and national instructors and trainers" },
      { id: "manage_assessments", name: "Manage Assessments", description: "Manage exam and ca scores and assessments" },
      { id: "manage_graduation", name: "Manage Graduation", description: "Clear and release official graduation certificates" }
    ];

    for (const p of permissions) {
      await pool.query(
        "INSERT INTO permissions (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description",
        [p.id, p.name, p.description]
      );
    }

    // 3. Map Roles and Permissions
    const mappings = [
      // Legacy basic mappings
      { role_id: "SUPER_ADMIN", permission_id: "all_access" },
      { role_id: "ADMIN_OFFICER", permission_id: "manage_admissions" },
      { role_id: "REVIEW_OFFICER", permission_id: "review_submissions" },
      { role_id: "TRAINEE", permission_id: "trainee_access" },

      // FEDERAL_SUPER_ADMIN
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_users" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_roles" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_permissions" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "execute_migrations" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_tenants" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_states" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_tsps" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "review_admissions" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "approve_admissions" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "reject_admissions" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_beneficiaries" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "manage_annex9" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "view_reports" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "export_reports" },
      { role_id: "FEDERAL_SUPER_ADMIN", permission_id: "audit_logs_access" },

      // SUPER_ADMIN (Legacy role bridging - receives all FEDERAL_SUPER_ADMIN access explicitly as well)
      { role_id: "SUPER_ADMIN", permission_id: "manage_users" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_roles" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_permissions" },
      { role_id: "SUPER_ADMIN", permission_id: "execute_migrations" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_tenants" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_states" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_tsps" },
      { role_id: "SUPER_ADMIN", permission_id: "review_admissions" },
      { role_id: "SUPER_ADMIN", permission_id: "approve_admissions" },
      { role_id: "SUPER_ADMIN", permission_id: "reject_admissions" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_beneficiaries" },
      { role_id: "SUPER_ADMIN", permission_id: "manage_annex9" },
      { role_id: "SUPER_ADMIN", permission_id: "view_reports" },
      { role_id: "SUPER_ADMIN", permission_id: "export_reports" },
      { role_id: "SUPER_ADMIN", permission_id: "audit_logs_access" },

      // FEDERAL_PROGRAM_MANAGER
      { role_id: "FEDERAL_PROGRAM_MANAGER", permission_id: "manage_beneficiaries" },
      { role_id: "FEDERAL_PROGRAM_MANAGER", permission_id: "manage_annex9" },
      { role_id: "FEDERAL_PROGRAM_MANAGER", permission_id: "view_reports" },
      { role_id: "FEDERAL_PROGRAM_MANAGER", permission_id: "export_reports" },

      // FEDERAL_REVIEW_MANAGER
      { role_id: "FEDERAL_REVIEW_MANAGER", permission_id: "review_admissions" },
      { role_id: "FEDERAL_REVIEW_MANAGER", permission_id: "approve_admissions" },
      { role_id: "FEDERAL_REVIEW_MANAGER", permission_id: "reject_admissions" },
      { role_id: "FEDERAL_REVIEW_MANAGER", permission_id: "audit_logs_access" },
      { role_id: "FEDERAL_REVIEW_MANAGER", permission_id: "view_reports" },
      { role_id: "FEDERAL_REVIEW_MANAGER", permission_id: "export_reports" },

      // STATE_COORDINATOR
      { role_id: "STATE_COORDINATOR", permission_id: "manage_beneficiaries" },
      { role_id: "STATE_COORDINATOR", permission_id: "manage_annex9" },
      { role_id: "STATE_COORDINATOR", permission_id: "view_reports" },
      { role_id: "STATE_COORDINATOR", permission_id: "export_reports" },

      // ADMIN_OFFICER (Legacy role bridging - additionally receives STATE_COORDINATOR equivalent and view/export reports)
      { role_id: "ADMIN_OFFICER", permission_id: "manage_beneficiaries" },
      { role_id: "ADMIN_OFFICER", permission_id: "manage_annex9" },
      { role_id: "ADMIN_OFFICER", permission_id: "view_reports" },
      { role_id: "ADMIN_OFFICER", permission_id: "export_reports" },

      // STATE_REVIEW_OFFICER
      { role_id: "STATE_REVIEW_OFFICER", permission_id: "review_admissions" },
      { role_id: "STATE_REVIEW_OFFICER", permission_id: "approve_admissions" },
      { role_id: "STATE_REVIEW_OFFICER", permission_id: "reject_admissions" },
      { role_id: "STATE_REVIEW_OFFICER", permission_id: "view_reports" },

      // REVIEW_OFFICER (Legacy role bridging - additionally receives STATE_REVIEW_OFFICER equivalent)
      { role_id: "REVIEW_OFFICER", permission_id: "review_admissions" },
      { role_id: "REVIEW_OFFICER", permission_id: "approve_admissions" },
      { role_id: "REVIEW_OFFICER", permission_id: "reject_admissions" },
      { role_id: "REVIEW_OFFICER", permission_id: "view_reports" },

      // STATE_M_E_OFFICER
      { role_id: "STATE_M_E_OFFICER", permission_id: "view_reports" },
      { role_id: "STATE_M_E_OFFICER", permission_id: "export_reports" },

      // TSP_ADMIN
      { role_id: "TSP_ADMIN", permission_id: "manage_beneficiaries" },
      { role_id: "TSP_ADMIN", permission_id: "manage_annex9" },
      { role_id: "TSP_ADMIN", permission_id: "view_reports" },

      // TSP_TRAINING_MANAGER
      { role_id: "TSP_TRAINING_MANAGER", permission_id: "manage_beneficiaries" },
      { role_id: "TSP_TRAINING_MANAGER", permission_id: "view_reports" },

      // TSP_REVIEW_OFFICER
      { role_id: "TSP_REVIEW_OFFICER", permission_id: "review_admissions" },
      { role_id: "TSP_REVIEW_OFFICER", permission_id: "view_reports" },

      // BENEFICIARY
      { role_id: "BENEFICIARY", permission_id: "trainee_access" },

      // SYSTEM_AUDITOR
      { role_id: "SYSTEM_AUDITOR", permission_id: "audit_logs_access" },
      { role_id: "SYSTEM_AUDITOR", permission_id: "view_reports" },

      // REPORT_VIEWER
      { role_id: "REPORT_VIEWER", permission_id: "view_reports" },
      { role_id: "REPORT_VIEWER", permission_id: "export_reports" },

      // HELPDESK_AGENT
      { role_id: "HELPDESK_AGENT", permission_id: "view_reports" },

      // MIGRATION_ADMIN
      { role_id: "MIGRATION_ADMIN", permission_id: "execute_migrations" },
      { role_id: "MIGRATION_ADMIN", permission_id: "manage_permissions" },
      { role_id: "MIGRATION_ADMIN", permission_id: "manage_roles" },

      // FED Permissions Mapping (Task 016C)
      { role_id: "FED", permission_id: "view_reports" },
      { role_id: "FED", permission_id: "audit_logs_access" },
      { role_id: "FED", permission_id: "manage_cohorts" },
      { role_id: "FED", permission_id: "manage_batches" },
      { role_id: "FED", permission_id: "manage_trainers" },
      { role_id: "FED", permission_id: "manage_assessments" },
      { role_id: "FED", permission_id: "manage_graduation" }
    ];

    for (const m of mappings) {
      await pool.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [m.role_id, m.permission_id]
      );
    }
    }

    const isDevSeedingEnabled = process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_SEEDS === "true";

    if (isDevSeedingEnabled) {
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

      // 5. Seed Federal Tenant & dedicated FED admin user (Task 016C)
      let fedTenantId: string | null = null;
      const fedTenantRes = await pool.query("SELECT id FROM tenants WHERE tier = 'FED' AND deleted_at IS NULL LIMIT 1");
      if (fedTenantRes.rows.length > 0) {
        fedTenantId = fedTenantRes.rows[0].id;
      } else {
        const insertTenantRes = await pool.query(
          "INSERT INTO tenants (name, domain, tier, is_active) VALUES ($1, $2, 'FED', true) RETURNING id",
          ["Federal TVET Ministry", "federal.tvet.local"]
        );
        fedTenantId = insertTenantRes.rows[0].id;
        console.log(`[DB] Seeded default Federal Tenant: ${fedTenantId}`);
      }

      const existingFed = await pool.query("SELECT id FROM users WHERE email = $1", ["fed.admin@tvet.local"]);
      if (existingFed.rows.length === 0) {
        const fedHash = bcrypt.hashSync("ChangeMe123!", 10);
        await pool.query(
          "INSERT INTO users (id, email, password_hash, role, tenant_id, failed_login_attempts) VALUES ($1, $2, $3, $4, $5, 0)",
          ["user_fed", "fed.admin@tvet.local", fedHash, "FED", fedTenantId]
        );
        console.log(`[DB] Seeded Federal user fed.admin@tvet.local connected to tenant: ${fedTenantId}`);
      }
    } else {
      console.log("[DB] Skipping default mock/sandbox users seeding on production.");
      
      // We should still seed the Federal Tenant as it's structural
      let fedTenantId: string | null = null;
      const fedTenantRes = await pool.query("SELECT id FROM tenants WHERE tier = 'FED' AND deleted_at IS NULL LIMIT 1");
      if (fedTenantRes.rows.length === 0) {
        const insertTenantRes = await pool.query(
          "INSERT INTO tenants (name, domain, tier, is_active) VALUES ($1, $2, 'FED', true) RETURNING id",
          ["Federal TVET Ministry", "federal.tvet.local"]
        );
        fedTenantId = insertTenantRes.rows[0].id;
        console.log(`[DB] Seeded default Federal Tenant (structural): ${fedTenantId}`);
      }
    }
  } catch (err) {
    console.error("[DB] Failed to seed auth system:", err);
  }
}

export const startupWarnings: string[] = [];

/**
 * Initializes schema and runs any pending JSON database records migration to PostgreSQL
 */
export async function initDb(): Promise<void> {
  console.log("[BOOT] PostgreSQL check starting");
  const active = await checkPgStatus();
  console.log("[BOOT] PostgreSQL check completed. Active status: " + active);
  if (!active) {
    console.log("[DB] PostgreSQL is inactive. Working in file-system fallback mode.");
    return;
  }

  const pool = getPgPool()!;
  console.log("[BOOT] Database Connected");
  
  try {
    console.log("[BOOT] Schema migrations starting...");
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
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS workflow_version INTEGER DEFAULT 1;
      
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
      
      -- Tenancy Columns
      ALTER TABLE states ADD COLUMN IF NOT EXISTS code VARCHAR(10);
      ALTER TABLE states ADD COLUMN IF NOT EXISTS geopolitical_zone VARCHAR(50);

      CREATE TABLE IF NOT EXISTS local_governments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state_id UUID REFERENCES states(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS lgas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state_name VARCHAR(100) NOT NULL,
        name VARCHAR(150) NOT NULL,
        UNIQUE(state_name, name)
      );

      CREATE TABLE IF NOT EXISTS training_centers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        state_id UUID REFERENCES states(id) ON DELETE CASCADE,
        lga_id UUID REFERENCES local_governments(id) ON DELETE CASCADE,
        center_name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC,
        longitude NUMERIC,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_lg_state_id ON local_governments(state_id);
      CREATE INDEX IF NOT EXISTS idx_tc_tenant_id ON training_centers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tc_state_id ON training_centers(state_id);
      CREATE INDEX IF NOT EXISTS idx_tc_lga_id ON training_centers(lga_id);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES states(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tsp_id UUID REFERENCES tsps(id) ON DELETE SET NULL;
      
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES states(id) ON DELETE SET NULL;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS lga_id UUID REFERENCES local_governments(id) ON DELETE SET NULL;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS training_center_id UUID REFERENCES training_centers(id) ON DELETE SET NULL;
      ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS tsp_id UUID REFERENCES tsps(id) ON DELETE SET NULL;
      
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS permission_used VARCHAR(150);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS effective_role VARCHAR(150);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES states(id) ON DELETE SET NULL;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tsp_id UUID REFERENCES tsps(id) ON DELETE SET NULL;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS beneficiary_id UUID;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;

      -- User Sessions Tenancy columns (Task 006)
      ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
      ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS tenant_tier tenant_tier;
      ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES states(id) ON DELETE SET NULL;
      ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS tsp_id UUID REFERENCES tsps(id) ON DELETE SET NULL;

      -- Add TSP profile columns (Task 017A-B)
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS state TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS lga TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS physical_address TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS registration_number TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS accreditation_status VARCHAR(50);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS accreditation_number VARCHAR(100);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS accreditation_expiry VARCHAR(50);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS is_nbte_accredited BOOLEAN DEFAULT TRUE;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS nbte_accreditation_number VARCHAR(155);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS accreditation_date VARCHAR(100);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS accreditation_expiry_date VARCHAR(100);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;
      
      -- Add TSP identity and provisioning columns (Task 017B)
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS tsp_code VARCHAR(50) UNIQUE;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS activation_token_hash TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS activation_token_raw TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMP;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS account_status VARCHAR(30);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(50);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS organization_status VARCHAR(50);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS website VARCHAR(255);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS secondary_contact VARCHAR(255);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS invitation_email VARCHAR(255);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(255);
      ALTER TABLE tsps ADD COLUMN IF NOT EXISTS programme_manager VARCHAR(255);

      -- Ensure uniqueideasproject@gmail.com is registered as the official testing contact email for the existing Unique TSP record if not already registered
      UPDATE tsps 
      SET contact_email = 'uniqueideasproject@gmail.com' 
      WHERE id = '00000000-0000-0000-0000-000000000001' AND (contact_email IS NULL OR contact_email = '' OR contact_email = 'moh.yusuf@tvet.local');

      UPDATE tsps
      SET contact_person = 'Tom Okwa'
      WHERE id = '00000000-0000-0000-0000-000000000001' AND (contact_person IS NULL OR contact_person = '' OR contact_person = 'Engr. Yusuf Mohammed');

      UPDATE tsps
      SET programme_manager = 'Tom Okwa'
      WHERE id = '00000000-0000-0000-0000-000000000001' AND (programme_manager IS NULL OR programme_manager = '');

      -- Add user provisioning columns (Task 017B)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_contact BOOLEAN DEFAULT FALSE;

      -- Central restoration center ledger
      CREATE TABLE IF NOT EXISTS restoration_center (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_id VARCHAR(100) NOT NULL UNIQUE,
        original_module VARCHAR(150) NOT NULL,
        deleted_by VARCHAR(255) NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_reason TEXT NOT NULL,
        payload JSONB NOT NULL
      );

      -- TSP profile changes approval queue and audit history
      CREATE TABLE IF NOT EXISTS tsp_profile_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tsp_id UUID REFERENCES tsps(id) ON DELETE CASCADE,
        requested_by VARCHAR(255) NOT NULL,
        requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'PENDING',
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reject_reason TEXT,
        changes JSONB NOT NULL
      );

      -- Activation Audit Logs for the complete audit ledger
      CREATE TABLE IF NOT EXISTS activation_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tsp_id UUID,
        tsp_name VARCHAR(255),
        contact_email VARCHAR(255),
        action VARCHAR(150),
        token_truncated VARCHAR(50),
        token_hash VARCHAR(100),
        status VARCHAR(50),
        ip_address VARCHAR(100),
        user_agent TEXT,
        sandbox_mode BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Tenancy Indexes
      CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_tenant_id ON beneficiaries(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant ON user_sessions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_state ON user_sessions(state_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_tsp ON user_sessions(tsp_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_permission ON audit_logs(permission_used);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);

      -- Task 012 Performance hardening indexes
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_state_id ON beneficiaries(state_id);
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_tsp_id ON beneficiaries(tsp_id);
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_created_at ON beneficiaries(created_at);
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_status ON beneficiaries(status);
      
      CREATE INDEX IF NOT EXISTS idx_admissions_created_at ON admissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_admissions_form_status ON admissions(admission_form_status);

      CREATE INDEX IF NOT EXISTS idx_users_state_id ON users(state_id);
      CREATE INDEX IF NOT EXISTS idx_users_tsp_id ON users(tsp_id);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_state ON audit_logs(state_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tsp ON audit_logs(tsp_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_beneficiary ON audit_logs(beneficiary_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(timestamp);

      CREATE INDEX IF NOT EXISTS idx_trainee_profiles_created_at ON trainee_profiles(created_at);

      CREATE INDEX IF NOT EXISTS idx_delivery_logs_sent_at ON document_delivery_logs(sent_at);

      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON communication_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON communication_campaigns(created_at);

      CREATE INDEX IF NOT EXISTS idx_comm_recipients_status ON communication_recipients(status);
      CREATE INDEX IF NOT EXISTS idx_comm_recipients_sent_at ON communication_recipients(sent_at);

      CREATE INDEX IF NOT EXISTS idx_email_logs_tracking_status ON email_logs(tracking_status);
      CREATE INDEX IF NOT EXISTS idx_email_logs_date_sent ON email_logs(date_sent);
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
        document_status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_generated_documents_beneficiary_id ON generated_documents(beneficiary_id);
      
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_code VARCHAR(100);
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'VALID';
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS email_delivery_status VARCHAR(50) DEFAULT 'Pending';
      ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS document_status VARCHAR(50) DEFAULT 'ACTIVE';

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
        ip_address VARCHAR(100),
        token_version_before INTEGER DEFAULT 1,
        token_version_after INTEGER DEFAULT 1,
        workflow_version_before INTEGER DEFAULT 1,
        workflow_version_after INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_history_beneficiary_id ON workflow_history(beneficiary_id);
      
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS reason TEXT;
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS token_version_before INTEGER DEFAULT 1;
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS token_version_after INTEGER DEFAULT 1;
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS workflow_version_before INTEGER DEFAULT 1;
      ALTER TABLE workflow_history ADD COLUMN IF NOT EXISTS workflow_version_after INTEGER DEFAULT 1;
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

    // Bootstrap national sectors
    await pool.query(`
      INSERT INTO sectors (id, sector_code, sector_name, description, status) VALUES
      ('s1', 'AGR', 'AGRICULTURE', 'Agricultural and farming skill development', 'ACTIVE'),
      ('s2', 'CON', 'BUILDING CONSTRUCTION', 'Civil work, masonry and modern construction infrastructure', 'ACTIVE'),
      ('s3', 'ICT', 'DIGITAL SKILLS', 'Information and communications technology, digital systems', 'ACTIVE'),
      ('s4', 'ENG', 'ENGINEERING SERVICES', 'Furniture, upholstery, woodwork, and metal fabrication services', 'ACTIVE'),
      ('s5', 'CRE', 'HOSPITALITY, LEISURE, TOURISM & CREATIVE SERVICES', 'Catering, culinary, fashion design and leather works', 'ACTIVE'),
      ('s6', 'AUT', 'AUTOMOBILE SKILLS', 'Automobile diagnostics, repairs and mechanics', 'ACTIVE'),
      ('s7', 'REN', 'RENEWABLE ENERGY', 'Solar installation, wind systems and clean technologies', 'ACTIVE'),
      ('s8', 'COS', 'BEAUTY COSMETOLOGY', 'Cosmetology, beauty, makeup and wig making', 'ACTIVE'),
      ('s9', 'CHD', 'CHILDCARE', 'Early child education and baby care support', 'ACTIVE'),
      ('s10', 'EDU', 'EDUCATION', 'Technical teachers training and pedagogy', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET
        sector_code = EXCLUDED.sector_code,
        sector_name = EXCLUDED.sector_name,
        description = EXCLUDED.description;
    `);

    // Bootstrap standard skills
    await pool.query(`
      INSERT INTO skills (id, skill_code, skill_name, sector_id, description, duration_weeks, lot_number, duration_months, status) VALUES
      ('sk_agr_1', 'SK-AGR-01', 'Fisheries / Aquaculture', 's1', 'Fish breeding, pond management and harvesting', 24, 'LOT 1', 6, 'ACTIVE'),
      ('sk_agr_2', 'SK-AGR-02', 'Livestock Farming (Poultry)', 's1', 'Poultry management, feed production and disease control', 24, 'LOT 2', 6, 'ACTIVE'),
      ('sk_agr_3', 'SK-AGR-03', 'Livestock Farming (Bee Keeping)', 's1', 'Beekeeping, apiary set up and honey extraction', 24, 'LOT 2', 6, 'ACTIVE'),
      ('sk_agr_4', 'SK-AGR-04', 'Livestock Farming (Animal Husbandry)', 's1', 'Ruminant breeding, animal healthcare and housing', 24, 'LOT 2', 6, 'ACTIVE'),
      ('sk_agr_5', 'SK-AGR-05', 'Crop Production & Processing', 's1', 'Land cultivation, crop planting, preservation and processing', 24, 'LOT 3', 6, 'ACTIVE'),
      ('sk_agr_6', 'SK-AGR-06', 'Mechanized Agriculture (Operations)', 's1', 'Tractor operation, implement calibration and farming machinery usage', 24, 'LOT 3', 6, 'ACTIVE'),
      ('sk_agr_7', 'SK-AGR-07', 'Mechanized Agriculture (Mechanics)', 's1', 'Advanced repair of tractors, generators and agricultural equipment', 48, 'LOT 3A', 12, 'ACTIVE'),
      ('sk1', 'SK-COM-REP', 'Computer Hardware & Cell Phone Repairs', 's3', 'Micro-soldering, circuits diagnostic and operating system installation', 24, 'LOT 4', 6, 'ACTIVE'),
      ('sk_ict_2', 'SK-ICT-02', 'Network System Installation', 's3', 'Cabling, routing, switch setup and signal configurations', 24, 'LOT 4', 6, 'ACTIVE'),
      ('sk_ict_3', 'SK-ICT-03', 'Creative Media (Digital Media Production)', 's3', 'Photography, videography, lighting and audio post-processing', 24, 'LOT 5', 6, 'ACTIVE'),
      ('sk_cre_1', 'SK-CRE-01', 'Baking & Confectionery', 's5', 'Oven operations, pastry dough management, decorating and confectioneries', 24, 'LOT 6', 6, 'ACTIVE'),
      ('sk_cre_2', 'SK-CRE-02', 'Catering / Hospitality Management', 's5', 'Food preparation, hygiene standards, lodging and catering systems', 24, 'LOT 6', 6, 'ACTIVE'),
      ('sk_cre_3', 'SK-CRE-03', 'Leather Works', 's5', 'Shoe, bag and belt design, tanning and stitching craft', 24, 'LOT 7', 6, 'ACTIVE'),
      ('sk_cre_4', 'SK-CRE-04', 'Fashion Design & Garment Making', 's5', 'Apparel sketch, fabric cutting, industrial stitching and tailoring', 48, 'LOT 8', 12, 'ACTIVE'),
      ('sk_con_1', 'SK-CON-01', 'Painting, Decoration & Interior Finishes', 's2', 'Surface preparation, texturing, wallpaper application and interior styling', 24, 'LOT 9', 6, 'ACTIVE'),
      ('sk_con_2', 'SK-CON-02', 'Floor Cladding, Tiling & Interlocking', 's2', 'Levelling, tile layout selection, interlocking paving blocks installation', 24, 'LOT 9', 6, 'ACTIVE'),
      ('sk_con_3', 'SK-CON-03', 'Plumbing & Pipe Fittings', 's2', 'Water distribution layouts, sanitary fixtures and drainage flow plumbing', 24, 'LOT 9', 6, 'ACTIVE'),
      ('sk_con_4', 'SK-CON-04', 'Bricklaying, Blocklaying & Concreting (BBC)', 's2', 'Masonry blocks routing, bonding mixtures and concrete casting', 24, 'LOT 9', 6, 'ACTIVE'),
      ('sk2', 'SK-SOL-INS', 'Solar Panel / Inverter Installation & Maintenance', 's7', 'Photovoltaic cells routing, inverter battery chemistry, panel diagnostics', 24, 'LOT 10', 6, 'ACTIVE'),
      ('sk_ren_2', 'SK-REN-02', 'Automobile CNG Conversion & Maintenance', 's7', 'CNG fuel kits extraction, pressure systems, calibration and safety', 24, 'LOT 11', 6, 'ACTIVE'),
      ('sk_eng_1', 'SK-ENG-01', 'Furniture & Upholstery', 's4', 'Ergonomic foam padding, leather fabrics, spring assembly and carpentry', 24, 'LOT 12', 6, 'ACTIVE'),
      ('sk_eng_2', 'SK-ENG-02', 'Woodwork, Carpentry & Joinery', 's4', 'Structural timber layouts, joints, roof carcass and cabinetry', 24, 'LOT 12', 6, 'ACTIVE'),
      ('sk_eng_3', 'SK-ENG-03', 'Welding & Fabrication', 's4', 'Arc welding, gas cutting, structural iron welding and metal fabrication', 24, 'LOT 13', 6, 'ACTIVE'),
      ('sk_eng_4', 'SK-ENG-04', 'Electrical Installation & Maintenance', 's4', 'Conduit wiring, circuit breaker layouts and industrial phase maintenance', 24, 'LOT 14', 6, 'ACTIVE'),
      ('sk_eng_5', 'SK-ENG-05', 'Refrigeration & Air Conditioning', 's4', 'Compressor systems, refrigerant flow, AC repair and thermodynamic maintenance', 24, 'LOT 14', 6, 'ACTIVE'),
      ('sk_aut_1', 'SK-AUT-01', 'Motorcycle & Tricycle Repairs', 's6', 'Two/three wheeler engine diagnostics, gear transmissions, and brakes', 24, 'LOT 15', 6, 'ACTIVE'),
      ('sk_aut_2', 'SK-AUT-02', 'Vulcanizing & Tire Repairs', 's6', 'Tire balancing, alignment, pneumatic chamber seals and vulcanizing', 24, 'LOT 15', 6, 'ACTIVE'),
      ('sk_aut_3', 'SK-AUT-03', 'Automobile Mechanics', 's6', 'Engine overhaul, transmission system assembly and hydraulic brakes', 24, 'LOT 15', 6, 'ACTIVE'),
      ('sk_aut_4', 'SK-AUT-04', 'Auto Body Works (Panel Beating)', 's6', 'Dent pulling, gas cutting welding, metal chassis alignment and auto spray painting', 48, 'LOT 15A', 12, 'ACTIVE'),
      ('sk_cos_1', 'SK-COS-01', 'Hair Styling', 's8', 'Braiding, relaxing, texturing, hair weaving and custom hair styling', 24, 'LOT 16', 6, 'ACTIVE'),
      ('sk_cos_2', 'SK-COS-02', 'Make-Up', 's8', 'Cosmetics matching, contouring, bridal makeups and facial treatment', 24, 'LOT 16', 6, 'ACTIVE'),
      ('sk_cos_3', 'SK-COS-03', 'Gele Tying', 's8', 'Traditional head-ties, layered pleating and customizable gele art', 24, 'LOT 16', 6, 'ACTIVE'),
      ('sk_cos_4', 'SK-COS-04', 'Bead Making', 's8', 'Bead threading, jewelry designs, wireworks and souvenir accessory designs', 24, 'LOT 17', 6, 'ACTIVE'),
      ('sk_cos_5', 'SK-COS-05', 'Wig Making', 's8', 'Weft creation, closure ventilation, custom ventilating and wig care', 24, 'LOT 17', 6, 'ACTIVE'),
      ('sk_cos_6', 'SK-COS-06', 'Perfume Making', 's8', 'Fragrance extraction, essential oil formulations and perfume bottling', 24, 'LOT 17', 6, 'ACTIVE'),
      ('sk_chd_1', 'SK-CHD-01', 'Early Child Education & Development', 's9', 'Pedagogical play, child nursing safety, cognitive growth development support', 24, 'LOT 18', 6, 'ACTIVE'),
      ('sk_edu_1', 'SK-EDU-01', 'Technical Teachers Training', 's10', 'Vocational instruction modeling, syllabus formulation and technical pedagogy', 24, 'LOT 19', 6, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET
        skill_code = EXCLUDED.skill_code,
        skill_name = EXCLUDED.skill_name,
        sector_id = EXCLUDED.sector_id,
        description = EXCLUDED.description,
        duration_weeks = EXCLUDED.duration_weeks,
        lot_number = EXCLUDED.lot_number,
        duration_months = EXCLUDED.duration_months;
    `);

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
      ALTER TABLE trainee_attendance ADD COLUMN IF NOT EXISTS hours_logged NUMERIC(5, 2) DEFAULT 0.00;
      
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

      -- Perform manual table migrations for toolkits & assets (Phase 2)
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS latitude VARCHAR(100);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS longitude VARCHAR(100);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS location_accuracy VARCHAR(100);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS business_name VARCHAR(100);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS business_address TEXT;
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS workshop_type VARCHAR(100);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS photo TEXT;
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS workshop_verification_status VARCHAR(50);
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP WITH TIME ZONE;
      ALTER TABLE graduate_toolkits ADD COLUMN IF NOT EXISTS utilization_score INTEGER DEFAULT 0;

      -- 13. Create program_costs table
      CREATE TABLE IF NOT EXISTS program_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cost_category VARCHAR(100) NOT NULL,
        amount NUMERIC(12,2) DEFAULT 0.00,
        description TEXT,
        training_track VARCHAR(255),
        cohort VARCHAR(100),
        batch VARCHAR(100),
        recorded_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_program_costs_category ON program_costs(cost_category);
    `);

    console.log("[DB] PostgreSQL schema verified and migration performed.");
    console.log("[BOOT] Core Migrations Complete");

    // Optional and Reference Seeding Isolation
    const isDevSeeding = process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_SEEDS === "true";
    if (isDevSeeding) {
      console.log("[BOOT] Optional Seeds Started");
    } else {
      console.log("[BOOT] Optional Seeds Skipped (Production environment detected)");
    }

    // A. Seed default toolkits and assets if empty
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
      console.error("[BOOT] Optional Seeds Failed (toolkitAssets):", taErr.message);
      startupWarnings.push(`Failed to seed toolkit assets: ${taErr.message}`);
    }

    // B. Check if dynamic seed or JSON migration is required (Skip entirely in production)
    if (isDevSeeding) {
      try {
        const checkResult = await pool.query("SELECT COUNT(*) as count FROM beneficiaries");
        const count = parseInt(checkResult.rows[0].count, 10);
        
        if (count === 0) {
          console.log("[DB] PostgreSQL database is empty. Performing initial data migration from JSON file...");
          await migrateJsonToPostgres();
        } else {
          console.log(`[DB] Database already initialized with ${count} records. Skipping CSV/JSON migration.`);
        }
      } catch (checkErr: any) {
        console.error("[BOOT] Optional Seeds Failed (migrateJsonToPostgres):", checkErr.message);
        startupWarnings.push(`Failed JSON migration: ${checkErr.message}`);
      }
    }

    // C. Core Location Infrastructure seeding (Always run to seed structure like States/LGAs, but seeder itself will skip mock TSPs/users if isDevSeeding is false)
    try {
      await seedLocationInfrastructure(pool);
    } catch (locErr: any) {
      console.error("[BOOT] Optional Seeds Failed (seedLocationInfrastructure):", locErr.message);
      startupWarnings.push(`Failed to seed location infrastructure: ${locErr.message}`);
    }

    // D. Backfill trainee profiles and portal monitoring from beneficiaries (Only run when isDevSeeding is enabled)
    if (isDevSeeding) {
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
        console.error("[BOOT] Optional Seeds Failed (trainee backfill):", err.message || err);
        startupWarnings.push(`Failed trainee profiles backfill: ${err.message || err}`);
      }
    }


    // Bootstrap Row-Level Security (RLS) policies for multi-tenancy context
    try {
      console.log("[BOOT] Transitioning to RLS Verification");
      console.log("[DB] Setting up Row-Level Security (RLS) policies...");
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_centers') THEN
            ALTER TABLE training_centers ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_training_centers_fed ON training_centers;
            CREATE POLICY policy_training_centers_fed ON training_centers
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED' OR
                current_setting('app.current_user_role', true) = 'SUPER_ADMIN' OR
                current_setting('app.current_user_role', true) = 'ADMIN_OFFICER' OR
                current_setting('app.current_user_role', true) = 'REVIEW_OFFICER'
              );

            DROP POLICY IF EXISTS policy_training_centers_sta ON training_centers;
            CREATE POLICY policy_training_centers_sta ON training_centers
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                training_centers.state_id = NULLIF(current_setting('app.current_state_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_training_centers_tsp ON training_centers;
            CREATE POLICY policy_training_centers_tsp ON training_centers
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                training_centers.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beneficiaries') THEN
            ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_beneficiaries_fed ON beneficiaries;
            CREATE POLICY policy_beneficiaries_fed ON beneficiaries
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_beneficiaries_sta ON beneficiaries;
            CREATE POLICY policy_beneficiaries_sta ON beneficiaries
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                beneficiaries.state_id = NULLIF(current_setting('app.current_state_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_beneficiaries_tsp ON beneficiaries;
            CREATE POLICY policy_beneficiaries_tsp ON beneficiaries
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                beneficiaries.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_beneficiaries_ben ON beneficiaries;
            CREATE POLICY policy_beneficiaries_ben ON beneficiaries
              USING (
                current_setting('app.current_user_role', true) = 'TRAINEE' AND
                beneficiaries.id::text = current_setting('app.current_beneficiary_id', true)
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admissions') THEN
            ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_admissions_fed ON admissions;
            CREATE POLICY policy_admissions_fed ON admissions
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_admissions_sta ON admissions;
            CREATE POLICY policy_admissions_sta ON admissions
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                EXISTS (
                  SELECT 1 FROM beneficiaries b
                  WHERE b.id = admissions.beneficiary_id
                    AND b.state_id = NULLIF(current_setting('app.current_state_id', true), '')::uuid
                )
              );

            DROP POLICY IF EXISTS policy_admissions_tsp ON admissions;
            CREATE POLICY policy_admissions_tsp ON admissions
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                EXISTS (
                  SELECT 1 FROM beneficiaries b
                  WHERE b.id = admissions.beneficiary_id
                    AND b.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
                )
              );

            DROP POLICY IF EXISTS policy_admissions_ben ON admissions;
            CREATE POLICY policy_admissions_ben ON admissions
              USING (
                current_setting('app.current_user_role', true) = 'TRAINEE' AND
                admissions.beneficiary_id = current_setting('app.current_beneficiary_id', true)
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trainee_profiles') THEN
            ALTER TABLE trainee_profiles ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_trainee_profiles_fed ON trainee_profiles;
            CREATE POLICY policy_trainee_profiles_fed ON trainee_profiles
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_trainee_profiles_sta ON trainee_profiles;
            CREATE POLICY policy_trainee_profiles_sta ON trainee_profiles
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                EXISTS (
                  SELECT 1 FROM beneficiaries b
                  WHERE b.id = trainee_profiles.beneficiary_id
                    AND b.state_id = NULLIF(current_setting('app.current_state_id', true), '')::uuid
                )
              );

            DROP POLICY IF EXISTS policy_trainee_profiles_tsp ON trainee_profiles;
            CREATE POLICY policy_trainee_profiles_tsp ON trainee_profiles
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                EXISTS (
                  SELECT 1 FROM beneficiaries b
                  WHERE b.id = trainee_profiles.beneficiary_id
                    AND b.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
                )
              );

            DROP POLICY IF EXISTS policy_trainee_profiles_ben ON trainee_profiles;
            CREATE POLICY policy_trainee_profiles_ben ON trainee_profiles
              USING (
                current_setting('app.current_user_role', true) = 'TRAINEE' AND
                trainee_profiles.beneficiary_id = current_setting('app.current_beneficiary_id', true)
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
            ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_audit_logs_fed ON audit_logs;
            CREATE POLICY policy_audit_logs_fed ON audit_logs
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_audit_logs_tenant ON audit_logs;
            CREATE POLICY policy_audit_logs_tenant ON audit_logs
              USING (
                NULLIF(current_setting('app.current_user_role', true), '') IS NOT NULL AND
                current_setting('app.current_tenant_tier', true) <> 'FED' AND
                audit_logs.tenant_id::text = current_setting('app.current_tenant_id', true)
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cohorts') THEN
            ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_cohorts_fed ON cohorts;
            CREATE POLICY policy_cohorts_fed ON cohorts
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_cohorts_tenant ON cohorts;
            CREATE POLICY policy_cohorts_tenant ON cohorts
              USING (
                current_setting('app.current_tenant_tier', true) IN ('STA', 'TSP') AND
                cohorts.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_batches') THEN
            ALTER TABLE training_batches ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_training_batches_fed ON training_batches;
            CREATE POLICY policy_training_batches_fed ON training_batches
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_training_batches_tenant ON training_batches;
            CREATE POLICY policy_training_batches_tenant ON training_batches
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                training_batches.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_training_batches_tsp ON training_batches;
            CREATE POLICY policy_training_batches_tsp ON training_batches
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                training_batches.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trainers') THEN
            ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_trainers_fed ON trainers;
            CREATE POLICY policy_trainers_fed ON trainers
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_trainers_tenant ON trainers;
            CREATE POLICY policy_trainers_tenant ON trainers
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                trainers.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_trainers_tsp ON trainers;
            CREATE POLICY policy_trainers_tsp ON trainers
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                trainers.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assessments') THEN
            ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_assessments_fed ON assessments;
            CREATE POLICY policy_assessments_fed ON assessments
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_assessments_tenant ON assessments;
            CREATE POLICY policy_assessments_tenant ON assessments
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                assessments.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_assessments_tsp ON assessments;
            CREATE POLICY policy_assessments_tsp ON assessments
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                EXISTS (
                  SELECT 1 FROM beneficiaries b
                  WHERE b.id = assessments.beneficiary_id
                    AND b.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
                )
              );

            DROP POLICY IF EXISTS policy_assessments_ben ON assessments;
            CREATE POLICY policy_assessments_ben ON assessments
              USING (
                current_setting('app.current_user_role', true) = 'TRAINEE' AND
                assessments.beneficiary_id = current_setting('app.current_beneficiary_id', true)
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'graduation_clearances') THEN
            ALTER TABLE graduation_clearances ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_graduation_clearances_fed ON graduation_clearances;
            CREATE POLICY policy_graduation_clearances_fed ON graduation_clearances
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_graduation_clearances_tenant ON graduation_clearances;
            CREATE POLICY policy_graduation_clearances_tenant ON graduation_clearances
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                graduation_clearances.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_graduation_clearances_tsp ON graduation_clearances;
            CREATE POLICY policy_graduation_clearances_tsp ON graduation_clearances
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                EXISTS (
                  SELECT 1 FROM beneficiaries b
                  WHERE b.id = graduation_clearances.beneficiary_id
                    AND b.tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
                )
              );

            DROP POLICY IF EXISTS policy_graduation_clearances_ben ON graduation_clearances;
            CREATE POLICY policy_graduation_clearances_ben ON graduation_clearances
              USING (
                current_setting('app.current_user_role', true) = 'TRAINEE' AND
                graduation_clearances.beneficiary_id = current_setting('app.current_beneficiary_id', true)
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_batch_assignments') THEN
            ALTER TABLE training_batch_assignments ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_batch_assignments_fed ON training_batch_assignments;
            CREATE POLICY policy_batch_assignments_fed ON training_batch_assignments
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED'
              );

            DROP POLICY IF EXISTS policy_batch_assignments_tenant ON training_batch_assignments;
            CREATE POLICY policy_batch_assignments_tenant ON training_batch_assignments
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                training_batch_assignments.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_batch_assignments_tsp ON training_batch_assignments;
            CREATE POLICY policy_batch_assignments_tsp ON training_batch_assignments
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                training_batch_assignments.batch_id IN (SELECT id FROM training_batches WHERE tsp_id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid)
              );
          END IF;

          -- Add RLS on tsps table
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tsps') THEN
            ALTER TABLE tsps ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS policy_tsps_fed ON tsps;
            CREATE POLICY policy_tsps_fed ON tsps
              USING (
                current_setting('app.current_tenant_tier', true) = 'FED' OR
                current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'ADMIN_OFFICER', 'REVIEW_OFFICER', 'FEDERAL_SUPER_ADMIN', 'FEDERAL_PROGRAM_MANAGER', 'FEDERAL_REVIEW_MANAGER')
              );

            DROP POLICY IF EXISTS policy_tsps_sta ON tsps;
            CREATE POLICY policy_tsps_sta ON tsps
              USING (
                current_setting('app.current_tenant_tier', true) = 'STA' AND
                tsps.state_id = NULLIF(current_setting('app.current_state_id', true), '')::uuid
              );

            DROP POLICY IF EXISTS policy_tsps_tsp ON tsps;
            CREATE POLICY policy_tsps_tsp ON tsps
              USING (
                current_setting('app.current_tenant_tier', true) = 'TSP' AND
                tsps.id = NULLIF(current_setting('app.current_tsp_id', true), '')::uuid
              );
          END IF;
        END $$;
      `);
      console.log("[DB] Row-Level Security (RLS) policies bootstrapped successfully.");
      console.log("[BOOT] RLS Policies Verified");
    } catch (rlsErr: any) {
      console.error("[DB] Failed to bootstrap RLS policies:", rlsErr.message || rlsErr);
      startupWarnings.push(`RLS policies error: ${rlsErr.message || rlsErr}`);
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
export function loadJsonState(): { 
  customFields: CustomField[]; 
  beneficiaries: Beneficiary[]; 
  auditLogs: AuditLog[]; 
  institutionLetterheads?: InstitutionLetterhead[];
  admissionFormTemplates?: AdmissionFormTemplate[];
  documentDispatches?: any[];
  emailTemplates?: any[];
  toolkitAssets?: any[];
  graduateToolkits?: any[];
  programCosts?: any[];
  sectors?: any[];
  skills?: any[];
  eoiApplications?: any[];
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
      if (!data.programCosts) {
        data.programCosts = [];
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
      // Maintain state consistency: Upgrade the sectors/skills automatically if they don't match the 10 sectors and 37 skills
      const hasLegacySectors = !data.sectors || data.sectors.length !== 10 || data.sectors.some((s: any) => s.sectorName === "Agriculture" || s.sectorName === "ICT");
      const hasLegacySkills = !data.skills || data.skills.length !== 37;

      if (hasLegacySectors) {
        data.sectors = [
          { id: "s1", sectorCode: "AGR", sector_code: "AGR", sectorName: "AGRICULTURE", sector_name: "AGRICULTURE", description: "Agricultural and farming skill development", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s2", sectorCode: "CON", sector_code: "CON", sectorName: "BUILDING CONSTRUCTION", sector_name: "BUILDING CONSTRUCTION", description: "Civil work, masonry and modern construction infrastructure", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s3", sectorCode: "ICT", sector_code: "ICT", sectorName: "DIGITAL SKILLS", sector_name: "DIGITAL SKILLS", description: "Information and communications technology, digital systems", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s4", sectorCode: "ENG", sector_code: "ENG", sectorName: "ENGINEERING SERVICES", sector_name: "ENGINEERING SERVICES", description: "Furniture, upholstery, woodwork, and metal fabrication services", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s5", sectorCode: "CRE", sector_code: "CRE", sectorName: "HOSPITALITY, LEISURE, TOURISM & CREATIVE SERVICES", sector_name: "HOSPITALITY, LEISURE, TOURISM & CREATIVE SERVICES", description: "Catering, culinary, fashion design and leather works", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s6", sectorCode: "AUT", sector_code: "AUT", sectorName: "AUTOMOBILE SKILLS", sector_name: "AUTOMOBILE SKILLS", description: "Automobile diagnostics, repairs and mechanics", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s7", sectorCode: "REN", sector_code: "REN", sectorName: "RENEWABLE ENERGY", sector_name: "RENEWABLE ENERGY", description: "Solar installation, wind systems and clean technologies", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s8", sectorCode: "COS", sector_code: "COS", sectorName: "BEAUTY COSMETOLOGY", sector_name: "BEAUTY COSMETOLOGY", description: "Cosmetology, beauty, makeup and wig making", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s9", sectorCode: "CHD", sector_code: "CHD", sectorName: "CHILDCARE", sector_name: "CHILDCARE", description: "Early child education and baby care support", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "s10", sectorCode: "EDU", sector_code: "EDU", sectorName: "EDUCATION", sector_name: "EDUCATION", description: "Technical teachers training and pedagogy", status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ];
      }
      if (hasLegacySkills) {
        data.skills = [
          // s1: AGRICULTURE
          { id: "sk_agr_1", skillCode: "SK-AGR-01", skill_code: "SK-AGR-01", skillName: "Fisheries / Aquaculture", skill_name: "Fisheries / Aquaculture", sectorId: "s1", sector_id: "s1", description: "Fish breeding, pond management and harvesting", lotNumber: "LOT 1", lot_number: "LOT 1", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_agr_2", skillCode: "SK-AGR-02", skill_code: "SK-AGR-02", skillName: "Livestock Farming (Poultry)", skill_name: "Livestock Farming (Poultry)", sectorId: "s1", sector_id: "s1", description: "Poultry management, feed production and disease control", lotNumber: "LOT 2", lot_number: "LOT 2", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_agr_3", skillCode: "SK-AGR-03", skill_code: "SK-AGR-03", skillName: "Livestock Farming (Bee Keeping)", skill_name: "Livestock Farming (Bee Keeping)", sectorId: "s1", sector_id: "s1", description: "Beekeeping, apiary set up and honey extraction", lotNumber: "LOT 2", lot_number: "LOT 2", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_agr_4", skillCode: "SK-AGR-04", skill_code: "SK-AGR-04", skillName: "Livestock Farming (Animal Husbandry)", skill_name: "Livestock Farming (Animal Husbandry)", sectorId: "s1", sector_id: "s1", description: "Ruminant breeding, animal healthcare and housing", lotNumber: "LOT 2", lot_number: "LOT 2", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_agr_5", skillCode: "SK-AGR-05", skill_code: "SK-AGR-05", skillName: "Crop Production & Processing", skill_name: "Crop Production & Processing", sectorId: "s1", sector_id: "s1", description: "Land cultivation, crop planting, preservation and processing", lotNumber: "LOT 3", lot_number: "LOT 3", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_agr_6", skillCode: "SK-AGR-06", skill_code: "SK-AGR-06", skillName: "Mechanized Agriculture (Operations)", skill_name: "Mechanized Agriculture (Operations)", sectorId: "s1", sector_id: "s1", description: "Tractor operation, implement calibration and farming machinery usage", lotNumber: "LOT 3", lot_number: "LOT 3", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_agr_7", skillCode: "SK-AGR-07", skill_code: "SK-AGR-07", skillName: "Mechanized Agriculture (Mechanics)", skill_name: "Mechanized Agriculture (Mechanics)", sectorId: "s1", sector_id: "s1", description: "Advanced repair of tractors, generators and agricultural equipment", lotNumber: "LOT 3A", lot_number: "LOT 3A", durationMonths: 12, duration_months: 12, durationWeeks: 48, duration_weeks: 48, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s3: DIGITAL SKILLS (sk1 preserves Computer Hardware and Cell Phone Repairs)
          { id: "sk1", skillCode: "SK-COM-REP", skill_code: "SK-COM-REP", skillName: "Computer Hardware & Cell Phone Repairs", skill_name: "Computer Hardware & Cell Phone Repairs", sectorId: "s3", sector_id: "s3", description: "Micro-soldering, circuits diagnostic and operating system installation", lotNumber: "LOT 4", lot_number: "LOT 4", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_ict_2", skillCode: "SK-ICT-02", skill_code: "SK-ICT-02", skillName: "Network System Installation", skill_name: "Network System Installation", sectorId: "s3", sector_id: "s3", description: "Cabling, routing, switch setup and signal configurations", lotNumber: "LOT 4", lot_number: "LOT 4", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_ict_3", skillCode: "SK-ICT-03", skill_code: "SK-ICT-03", skillName: "Creative Media (Digital Media Production)", skill_name: "Creative Media (Digital Media Production)", sectorId: "s3", sector_id: "s3", description: "Photography, videography, lighting and audio post-processing", lotNumber: "LOT 5", lot_number: "LOT 5", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s5: HOSPITALITY, LEISURE, TOURISM & CREATIVE SERVICES
          { id: "sk_cre_1", skillCode: "SK-CRE-01", skill_code: "SK-CRE-01", skillName: "Baking & Confectionery", skill_name: "Baking & Confectionery", sectorId: "s5", sector_id: "s5", description: "Oven operations, pastry dough management, decorating and confectioneries", lotNumber: "LOT 6", lot_number: "LOT 6", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cre_2", skillCode: "SK-CRE-02", skill_code: "SK-CRE-02", skillName: "Catering / Hospitality Management", skill_name: "Catering / Hospitality Management", sectorId: "s5", sector_id: "s5", description: "Food preparation, hygiene standards, lodging and catering systems", lotNumber: "LOT 6", lot_number: "LOT 6", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cre_3", skillCode: "SK-CRE-03", skill_code: "SK-CRE-03", skillName: "Leather Works", skill_name: "Leather Works", sectorId: "s5", sector_id: "s5", description: "Shoe, bag and belt design, tanning and stitching craft", lotNumber: "LOT 7", lot_number: "LOT 7", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cre_4", skillCode: "SK-CRE-04", skill_code: "SK-CRE-04", skillName: "Fashion Design & Garment Making", skill_name: "Fashion Design & Garment Making", sectorId: "s5", sector_id: "s5", description: "Apparel sketch, fabric cutting, industrial stitching and tailoring", lotNumber: "LOT 8", lot_number: "LOT 8", durationMonths: 12, duration_months: 12, durationWeeks: 48, duration_weeks: 48, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s2: BUILDING CONSTRUCTION
          { id: "sk_con_1", skillCode: "SK-CON-01", skill_code: "SK-CON-01", skillName: "Painting, Decoration & Interior Finishes", skill_name: "Painting, Decoration & Interior Finishes", sectorId: "s2", sector_id: "s2", description: "Surface preparation, texturing, wallpaper application and interior styling", lotNumber: "LOT 9", lot_number: "LOT 9", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_con_2", skillCode: "SK-CON-02", skill_code: "SK-CON-02", skillName: "Floor Cladding, Tiling & Interlocking", skill_name: "Floor Cladding, Tiling & Interlocking", sectorId: "s2", sector_id: "s2", description: "Levelling, tile layout selection, interlocking paving blocks installation", lotNumber: "LOT 9", lot_number: "LOT 9", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_con_3", skillCode: "SK-CON-03", skill_code: "SK-CON-03", skillName: "Plumbing & Pipe Fittings", skill_name: "Plumbing & Pipe Fittings", sectorId: "s2", sector_id: "s2", description: "Water distribution layouts, sanitary fixtures and drainage flow plumbing", lotNumber: "LOT 9", lot_number: "LOT 9", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_con_4", skillCode: "SK-CON-04", skill_code: "SK-CON-04", skillName: "Bricklaying, Blocklaying & Concreting (BBC)", skill_name: "Bricklaying, Blocklaying & Concreting (BBC)", sectorId: "s2", sector_id: "s2", description: "Masonry blocks routing, bonding mixtures and concrete casting", lotNumber: "LOT 9", lot_number: "LOT 9", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s7: RENEWABLE ENERGY (sk2 preserves Solar Photovoltaic Panel Installation)
          { id: "sk2", skillCode: "SK-SOL-INS", skill_code: "SK-SOL-INS", skillName: "Solar Panel / Inverter Installation & Maintenance", skill_name: "Solar Panel / Inverter Installation & Maintenance", sectorId: "s7", sector_id: "s7", description: "Photovoltaic cells routing, inverter battery chemistry, panel diagnostics", lotNumber: "LOT 10", lot_number: "LOT 10", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_ren_2", skillCode: "SK-REN-02", skill_code: "SK-REN-02", skillName: "Automobile CNG Conversion & Maintenance", skill_name: "Automobile CNG Conversion & Maintenance", sectorId: "s7", sector_id: "s7", description: "CNG fuel kits extraction, pressure systems, calibration and safety", lotNumber: "LOT 11", lot_number: "LOT 11", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s4: ENGINEERING SERVICES
          { id: "sk_eng_1", skillCode: "SK-ENG-01", skill_code: "SK-ENG-01", skillName: "Furniture & Upholstery", skill_name: "Furniture & Upholstery", sectorId: "s4", sector_id: "s4", description: "Ergonomic foam padding, leather fabrics, spring assembly and carpentry", lotNumber: "LOT 12", lot_number: "LOT 12", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_eng_2", skillCode: "SK-ENG-02", skill_code: "SK-ENG-02", skillName: "Woodwork, Carpentry & Joinery", skill_name: "Woodwork, Carpentry & Joinery", sectorId: "s4", sector_id: "s4", description: "Structural timber layouts, joints, roof carcass and cabinetry", lotNumber: "LOT 12", lot_number: "LOT 12", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_eng_3", skillCode: "SK-ENG-03", skill_code: "SK-ENG-03", skillName: "Welding & Fabrication", skill_name: "Welding & Fabrication", sectorId: "s4", sector_id: "s4", description: "Arc welding, gas cutting, structural iron welding and metal fabrication", lotNumber: "LOT 13", lot_number: "LOT 13", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_eng_4", skillCode: "SK-ENG-04", skill_code: "SK-ENG-04", skillName: "Electrical Installation & Maintenance", skill_name: "Electrical Installation & Maintenance", sectorId: "s4", sector_id: "s4", description: "Conduit wiring, circuit breaker layouts and industrial phase maintenance", lotNumber: "LOT 14", lot_number: "LOT 14", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_eng_5", skillCode: "SK-ENG-05", skill_code: "SK-ENG-05", skillName: "Refrigeration & Air Conditioning", skill_name: "Refrigeration & Air Conditioning", sectorId: "s4", sector_id: "s4", description: "Compressor systems, refrigerant flow, AC repair and thermodynamic maintenance", lotNumber: "LOT 14", lot_number: "LOT 14", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s6: AUTOMOBILE SKILLS
          { id: "sk_aut_1", skillCode: "SK-AUT-01", skill_code: "SK-AUT-01", skillName: "Motorcycle & Tricycle Repairs", skill_name: "Motorcycle & Tricycle Repairs", sectorId: "s6", sector_id: "s6", description: "Two/three wheeler engine diagnostics, gear transmissions, and brakes", lotNumber: "LOT 15", lot_number: "LOT 15", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_aut_2", skillCode: "SK-AUT-02", skill_code: "SK-AUT-02", skillName: "Vulcanizing & Tire Repairs", skill_name: "Vulcanizing & Tire Repairs", sectorId: "s6", sector_id: "s6", description: "Tire balancing, alignment, pneumatic chamber seals and vulcanizing", lotNumber: "LOT 15", lot_number: "LOT 15", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_aut_3", skillCode: "SK-AUT-03", skill_code: "SK-AUT-03", skillName: "Automobile Mechanics", skill_name: "Automobile Mechanics", sectorId: "s6", sector_id: "s6", description: "Engine overhaul, transmission system assembly and hydraulic brakes", lotNumber: "LOT 15", lot_number: "LOT 15", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_aut_4", skillCode: "SK-AUT-04", skill_code: "SK-AUT-04", skillName: "Auto Body Works (Panel Beating)", skill_name: "Auto Body Works (Panel Beating)", sectorId: "s6", sector_id: "s6", description: "Dent pulling, gas cutting welding, metal chassis alignment and auto spray painting", lotNumber: "LOT 15A", lot_number: "LOT 15A", durationMonths: 12, duration_months: 12, durationWeeks: 48, duration_weeks: 48, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s8: BEAUTY COSMETOLOGY
          { id: "sk_cos_1", skillCode: "SK-COS-01", skill_code: "SK-COS-01", skillName: "Hair Styling", skill_name: "Hair Styling", sectorId: "s8", sector_id: "s8", description: "Braiding, relaxing, texturing, hair weaving and custom hair styling", lotNumber: "LOT 16", lot_number: "LOT 16", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cos_2", skillCode: "SK-COS-02", skill_code: "SK-COS-02", skillName: "Make-Up", skill_name: "Make-Up", sectorId: "s8", sector_id: "s8", description: "Cosmetics matching, contouring, bridal makeups and facial treatment", lotNumber: "LOT 16", lot_number: "LOT 16", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cos_3", skillCode: "SK-COS-03", skill_code: "SK-COS-03", skillName: "Gele Tying", skill_name: "Gele Tying", sectorId: "s8", sector_id: "s8", description: "Traditional head-ties, layered pleating and customizable gele art", lotNumber: "LOT 16", lot_number: "LOT 16", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cos_4", skillCode: "SK-COS-04", skill_code: "SK-COS-04", skillName: "Bead Making", skill_name: "Bead Making", sectorId: "s8", sector_id: "s8", description: "Bead threading, jewelry designs, wireworks and souvenir accessory designs", lotNumber: "LOT 17", lot_number: "LOT 17", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cos_5", skillCode: "SK-COS-05", skill_code: "SK-COS-05", skillName: "Wig Making", skill_name: "Wig Making", sectorId: "s8", sector_id: "s8", description: "Weft creation, closure ventilation, custom ventilating and wig care", lotNumber: "LOT 17", lot_number: "LOT 17", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "sk_cos_6", skillCode: "SK-COS-06", skill_code: "SK-COS-06", skillName: "Perfume Making", skill_name: "Perfume Making", sectorId: "s8", sector_id: "s8", description: "Fragrance extraction, essential oil formulations and perfume bottling", lotNumber: "LOT 17", lot_number: "LOT 17", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s9: CHILDCARE
          { id: "sk_chd_1", skillCode: "SK-CHD-01", skill_code: "SK-CHD-01", skillName: "Early Child Education & Development", skill_name: "Early Child Education & Development", sectorId: "s9", sector_id: "s9", description: "Pedagogical play, child nursing safety, cognitive growth development support", lotNumber: "LOT 18", lot_number: "LOT 18", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

          // s10: EDUCATION
          { id: "sk_edu_1", skillCode: "SK-EDU-01", skill_code: "SK-EDU-01", skillName: "Technical Teachers Training", skill_name: "Technical Teachers Training", sectorId: "s10", sector_id: "s10", description: "Vocational instruction modeling, syllabus formulation and technical pedagogy", lotNumber: "LOT 19", lot_number: "LOT 19", durationMonths: 6, duration_months: 6, durationWeeks: 24, duration_weeks: 24, status: "ACTIVE", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ];
      }

      if (hasLegacySectors || hasLegacySkills) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
      }
      if (!data.eoiApplications) {
        data.eoiApplications = [];
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
    graduateToolkits: [],
    programCosts: [],
    sectors: [],
    skills: [],
    eoiApplications: []
  };
}

/**
 * Helper to save JSON file state
 */
export function saveJsonState(state: { 
  customFields: CustomField[]; 
  beneficiaries: Beneficiary[]; 
  auditLogs: AuditLog[]; 
  institutionLetterheads?: InstitutionLetterhead[];
  admissionFormTemplates?: AdmissionFormTemplate[];
  documentDispatches?: any[];
  emailTemplates?: any[];
  toolkitAssets?: any[];
  graduateToolkits?: any[];
  programCosts?: any[];
  sectors?: any[];
  skills?: any[];
  eoiApplications?: any[];
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
    if (!state.programCosts) {
      state.programCosts = [];
    }
    if (!state.sectors) {
      state.sectors = [];
    }
    if (!state.skills) {
      state.skills = [];
    }
    if (!state.eoiApplications) {
      state.eoiApplications = [];
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("[DB] Failed to write JSON file fallback state:", e);
  }
}

/**
 * Seeds the 36 Nigerian States + FCT and their corresponding 774 Local Government Areas.
 * Also configures Kano State Admin login to be backed by real UUIDs.
 * Finally migrates legacy free-text location states/cities to real local_governments/states DB IDs.
 */
export async function seedLocationInfrastructure(pool: pg.Pool): Promise<void> {
  try {
    console.log("[DB] Checking location infrastructure baseline...");
    
    // 1. Seed geopolitical zones and states
    const statesData = [
      { name: "Abia", code: "AB", zone: "South East" },
      { name: "Adamawa", code: "AD", zone: "North East" },
      { name: "Akwa Ibom", code: "AK", zone: "South South" },
      { name: "Anambra", code: "AN", zone: "South East" },
      { name: "Bauchi", code: "BA", zone: "North East" },
      { name: "Bayelsa", code: "BY", zone: "South South" },
      { name: "Benue", code: "BE", zone: "North Central" },
      { name: "Borno", code: "BO", zone: "North East" },
      { name: "Cross River", code: "CR", zone: "South South" },
      { name: "Delta", code: "DE", zone: "South South" },
      { name: "Ebonyi", code: "EB", zone: "South East" },
      { name: "Edo", code: "ED", zone: "South South" },
      { name: "Ekiti", code: "EK", zone: "South West" },
      { name: "Enugu", code: "EN", zone: "South East" },
      { name: "FCT", code: "FC", zone: "North Central" },
      { name: "Gombe", code: "GO", zone: "North East" },
      { name: "Imo", code: "IM", zone: "South East" },
      { name: "Jigawa", code: "JI", zone: "North West" },
      { name: "Kaduna", code: "KD", zone: "North West" },
      { name: "Kano", code: "KN", zone: "North West" },
      { name: "Katsina", code: "KT", zone: "North West" },
      { name: "Kebbi", code: "KE", zone: "North West" },
      { name: "Kogi", code: "KO", zone: "North Central" },
      { name: "Kwara", code: "KW", zone: "North Central" },
      { name: "Lagos", code: "LA", zone: "South West" },
      { name: "Nasarawa", code: "NA", zone: "North Central" },
      { name: "Niger", code: "NI", zone: "North Central" },
      { name: "Ogun", code: "OG", zone: "South West" },
      { name: "Ondo", code: "ON", zone: "South West" },
      { name: "Osun", code: "OS", zone: "South West" },
      { name: "Oyo", code: "OY", zone: "South West" },
      { name: "Plateau", code: "PL", zone: "North Central" },
      { name: "Rivers", code: "RI", zone: "South South" },
      { name: "Sokoto", code: "SO", zone: "North West" },
      { name: "Taraba", code: "TA", zone: "North East" },
      { name: "Yobe", code: "YO", zone: "North East" },
      { name: "Zamfara", code: "ZA", zone: "North West" }
    ];

    // Check if we need to seed states
    const statesCountRes = await pool.query("SELECT COUNT(*) as count FROM states");
    const statesCount = parseInt(statesCountRes.rows[0].count, 10);
    
    if (statesCount < 37) {
      console.log(`[DB] States table has ${statesCount} records. Seeding 37 states and default state tenants...`);
      for (const s of statesData) {
        // Find or create associated state tenant
        const tenantDomain = `state-${s.name.toLowerCase().replace(/\s+/g, "")}.tvet.local`;
        let stateTenantId: string;
        
        const existingTenant = await pool.query("SELECT id FROM tenants WHERE tier = 'STA' AND domain = $1", [tenantDomain]);
        if (existingTenant.rows.length > 0) {
          stateTenantId = existingTenant.rows[0].id;
        } else {
          const insertTenant = await pool.query(
            "INSERT INTO tenants (name, domain, tier, is_active) VALUES ($1, $2, 'STA', true) RETURNING id",
            [`${s.name} State TVET Department`, tenantDomain]
          );
          stateTenantId = insertTenant.rows[0].id;
        }

        // Insert or update state with tenant association, name, state_code and geopolitical_zone
        await pool.query(`
          INSERT INTO states (tenant_id, name, state_code, code, geopolitical_zone, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (name) DO UPDATE SET 
            tenant_id = EXCLUDED.tenant_id,
            state_code = EXCLUDED.state_code,
            code = EXCLUDED.code,
            geopolitical_zone = EXCLUDED.geopolitical_zone
        `, [stateTenantId, s.name, s.code, s.code, s.zone]);
      }
      console.log("[DB] States and their associated STA tenants successfully seeded.");
    }

    // Now seed LGAs and reference lgas
    const lgaCountRes = await pool.query("SELECT COUNT(*) as count FROM local_governments");
    const lgaCount = parseInt(lgaCountRes.rows[0].count, 10);

    const hasPlaceholdersRes = await pool.query("SELECT EXISTS(SELECT 1 FROM local_governments WHERE name LIKE '% LGA %' OR name LIKE '% Extra %')");
    const hasPlaceholders = hasPlaceholdersRes.rows[0].exists;

    if (hasPlaceholders || lgaCount < 770) {
      console.log("[DB] Placeholders elements detected or index incomplete. Sanitizing and seeding official Nigerian 774 LGAs...");
      await pool.query("DELETE FROM local_governments WHERE name LIKE '% LGA %' OR name LIKE '% Extra %' OR name LIKE 'Abia %' OR name LIKE 'Adama%' OR name LIKE 'Anam%'");

      // Let's first load states mappings so we have the state_id
      const statesMapRes = await pool.query("SELECT id, name FROM states");
      const statesMap: { [key: string]: string } = {};
      for (const row of statesMapRes.rows) {
        statesMap[row.name.toLowerCase().trim()] = row.id;
      }

      // Seed official reference tables mapping
      for (const [stateName, lgaList] of Object.entries(NIGERIAN_STATES_AND_LGAS)) {
        // Direct state mapped search. Normalizes names ("fct abuja" vs "fct")
        let matchedStateKey = stateName.toLowerCase().trim();
        if (matchedStateKey.includes("fct")) matchedStateKey = "fct";

        const stateUuid = statesMap[matchedStateKey];

        for (let idx = 0; idx < lgaList.length; idx++) {
          const lgaName = lgaList[idx];

          // 1. Seed official lgas reference table
          await pool.query(`
            INSERT INTO lgas (state_name, name)
            VALUES ($1, $2)
            ON CONFLICT (state_name, name) DO NOTHING
          `, [stateName, lgaName]);

          // 2. Seed traditional local_governments table
          if (stateUuid) {
            const lgaCode = `${stateName.toUpperCase().slice(0, 3).replace(/ /g, "")}-LGA-${String(idx + 1).padStart(3, "0")}`;
            await pool.query(`
              INSERT INTO local_governments (state_id, name, code)
              VALUES ($1, $2, $3)
              ON CONFLICT DO NOTHING
            `, [stateUuid, lgaName, lgaCode]);
          }
        }
      }
    } else {
      console.log(`[DB] LGAs are already seeded (${lgaCount} LGAs). Skipping LGA insertion loop (saves 1500+ roundtrips).`);
    }

    const seededLgaCountRes = await pool.query("SELECT COUNT(*)::int as count FROM local_governments");
    console.log(`[DB] Official LGAs successfully seeded: ${seededLgaCountRes.rows[0].count} LGAs are in database.`);

    const isDevSeedingEnabled = process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_SEEDS === "true";

    if (isDevSeedingEnabled) {
      // Now seed/ensure Kano State Admin user with UUID-backed tenant and state ids
      console.log("[DB] Resolving Kano State Admin User and credentials...");
      const kanoRes = await pool.query("SELECT id, tenant_id FROM states WHERE name = 'Kano' LIMIT 1");
      if (kanoRes.rows.length > 0) {
        const kanoUuid = kanoRes.rows[0].id;
        const kanoTenantUuid = kanoRes.rows[0].tenant_id;

        // Ensure user_sta is linked to this real tenant and state
        const kanoAdminHash = bcrypt.hashSync("ChangeMe123!", 10);
        
        // Update/Ensure record in users table
        await pool.query(`
          INSERT INTO users (id, email, password_hash, role, tenant_id, state_id, failed_login_attempts)
          VALUES ('user_sta', 'state.admin@tvet.local', $1, 'STA', $2, $3, 0)
          ON CONFLICT (email) DO UPDATE SET 
            tenant_id = EXCLUDED.tenant_id,
            state_id = EXCLUDED.state_id,
            role = 'STA'
        `, [kanoAdminHash, kanoTenantUuid, kanoUuid]);
        console.log(`[DB Seeder] Kano State Admin user is successfully seeded: user_sta connected to real Kano State UUID: ${kanoUuid} and Tenant UUID: ${kanoTenantUuid}`);
      }

      // Ensure default TSP exists (Phase 8 Production Bootstrapping)
      const tspCountRes = await pool.query("SELECT COUNT(*) as count FROM tsps");
      if (parseInt(tspCountRes.rows[0].count, 10) === 0) {
        console.log("[DB] Seeding official default TSPs with Profile fields...");
        
        const imoTenantRes = await pool.query("SELECT id FROM tenants WHERE domain = 'imo.tvet.local' OR name LIKE '%Imo%' LIMIT 1");
        let imoTenantId = imoTenantRes.rows.length > 0 ? imoTenantRes.rows[0].id : null;
        if (!imoTenantId) {
          const anyStaRes = await pool.query("SELECT id FROM tenants WHERE tier = 'STA' LIMIT 1");
          imoTenantId = anyStaRes.rows.length > 0 ? anyStaRes.rows[0].id : null;
        }

        const stateImoRes = await pool.query("SELECT id FROM states WHERE name = 'Imo' LIMIT 1");
        const stateImoId = stateImoRes.rows.length > 0 ? stateImoRes.rows[0].id : null;

        const tspId = "00000000-0000-0000-0000-000000000001";
        await pool.query(`
          INSERT INTO tsps (id, tenant_id, state_id, name, code, tsp_code, contact_person, contact_email, contact_phone, is_active, state, lga, physical_address, latitude, longitude, registration_number, accreditation_status, accreditation_number, accreditation_expiry, account_status, profile_completed)
          VALUES ($1, $2, $3, $4, $5, 'TVET-TSP-IMO-0001', $6, $7, $8, true, 'Imo', 'Owerri Municipal', 'Unique Technology Complex, Owerri Municipal, Imo State', 5.4851, 7.0346, 'RC-199201', 'ACTIVE', 'NBTE/TVET/UT-001/2024', '2026-12-31', 'ACTIVE', true)
        `, [tspId, imoTenantId, stateImoId, "Unique Technology Nig. Ltd", "UT-001", "Tom Okwa", "moh.yusuf@tvet.local", "+234 803 123 4567"]);

        // Seed a TSP tenant and a TSP Admin user connected to this TSP
        const tspTenantRes = await pool.query("INSERT INTO tenants (name, domain, tier, is_active) VALUES ($1, $2, 'TSP', true) RETURNING id");
        const tspTenantId = tspTenantRes.rows[0].id;

        const tspAdminHash = bcrypt.hashSync("ChangeMe123!", 10);
        await pool.query(`
          INSERT INTO users (id, email, password_hash, role, tenant_id, state_id, tsp_id, failed_login_attempts, must_change_password, is_primary_contact)
          VALUES ('user_tsp', 'tsp.admin@tvet.local', $1, 'TSP_ADMIN', $2, $3, $4, 0, false, true)
          ON CONFLICT (email) DO NOTHING
        `, [tspAdminHash, tspTenantId, stateImoId, tspId]);
        
        console.log("[DB] Seeded default TSP: Unique Technology Nig. Ltd and registered User tsp.admin@tvet.local (ChangeMe123!) linked to Imo.");
      } else {
        // Check and migrate existing default TSP_01 if needed
        console.log("[DB] Migrating/verifying default TSP Unique Technology Nig. Ltd state references...");
        const stateImoRes = await pool.query("SELECT id FROM states WHERE name = 'Imo' LIMIT 1");
        const stateImoId = stateImoRes.rows.length > 0 ? stateImoRes.rows[0].id : null;
        if (stateImoId) {
          await pool.query(`
            UPDATE tsps
            SET 
              state_id = COALESCE(state_id, $1),
              state = 'Imo',
              lga = 'Owerri Municipal',
              tsp_code = 'TVET-TSP-IMO-0001',
              account_status = 'ACTIVE',
              profile_completed = true
            WHERE id = '00000000-0000-0000-0000-000000000001'
          `, [stateImoId]);
          
          await pool.query(`
            UPDATE users
            SET state_id = $1
            WHERE id = 'user_tsp' OR email = 'tsp.admin@tvet.local'
          `, [stateImoId]);
        }
      }
    } else {
      console.log("[DB] Skipping mock sandbox TSP and Kano/TSP admin users seeding on production.");
    }

    // Migrate any other legacy TSPs that don't have tsp_code
    console.log("[DB Migration] Performing schema migration matching for legacy TSPs...");
    const legacyTspsRes = await pool.query(`
      SELECT t.id, t.name, t.state, s.code AS state_code
      FROM tsps t
      LEFT JOIN states s ON t.state_id = s.id
      WHERE t.tsp_code IS NULL
    `);
    
    for (const legacyTsp of legacyTspsRes.rows) {
      let tCode = (legacyTsp.state_code || legacyTsp.state || "NIG").toUpperCase().substring(0, 3).replace(/ /g, "");
      if (tCode.includes("FCT")) tCode = "FCT";
      
      const countRes = await pool.query("SELECT COUNT(*) as count FROM tsps WHERE tsp_code LIKE $1", [`TVET-TSP-${tCode}-%`]);
      const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
      const computedTspCode = `TVET-TSP-${tCode}-${String(nextSeq).padStart(4, "0")}`;
      
      await pool.query(`
        UPDATE tsps
        SET 
          tsp_code = $1,
          account_status = COALESCE(account_status, 'ACTIVE'),
          profile_completed = COALESCE(profile_completed, true)
        WHERE id = $2
      `, [computedTspCode, legacyTsp.id]);
    }

    // Part 5: Perform backward compatibility displacement for beneficiaries free-text state and LGA
    console.log("[DB Migration] Performing backward compatibility placement for beneficiaries free-text state and LGA...");
    
    // Map state string to state_id
    await pool.query(`
      UPDATE beneficiaries b
      SET state_id = s.id
      FROM states s
      WHERE b.state_id IS NULL AND (
        LOWER(TRIM(b.state)) = LOWER(TRIM(s.name)) OR
        LOWER(TRIM(b.state)) = LOWER(TRIM(s.code))
      )
    `);

    // Let's also see if we can resolve LGA strings
    await pool.query(`
      UPDATE beneficiaries b
      SET lga_id = lg.id
      FROM local_governments lg
      WHERE b.lga_id IS NULL AND b.state_id = lg.state_id AND (
        LOWER(TRIM(b.city)) = LOWER(TRIM(lg.name)) OR
        LOWER(TRIM(b.custom_fields->>'Local Government Area (LGA)')) = LOWER(TRIM(lg.name)) OR
        LOWER(TRIM(b.custom_fields->>'lga')) = LOWER(TRIM(lg.name)) OR
        LOWER(TRIM(b.custom_fields->>'LGA')) = LOWER(TRIM(lg.name))
      )
    `);
    console.log("[DB Migration] Backward compatibility location displacement completed.");

    // PHASE 3 - UNIQUE DATA RELATIONSHIP AUDIT & REPAIR
    console.log("[DB Audit] Auditing and repairing Unique Technology Nig. Ltd database relationships...");
    
    // Find Imo state ID
    const imoStateRes = await pool.query("SELECT id FROM states WHERE name = 'Imo' LIMIT 1");
    const imoStateId = imoStateRes.rows.length > 0 ? imoStateRes.rows[0].id : null;
    
    // Find Imo tenant ID
    const imoTenantRes = await pool.query("SELECT id FROM tenants WHERE domain = 'imo.tvet.local' OR name LIKE '%Imo%' LIMIT 1");
    let imoTenantId = imoTenantRes.rows.length > 0 ? imoTenantRes.rows[0].id : null;
    if (!imoTenantId && imoStateId) {
      const stateRow = await pool.query("SELECT tenant_id FROM states WHERE id = $1", [imoStateId]);
      imoTenantId = stateRow.rows.length > 0 ? stateRow.rows[0].tenant_id : null;
    }

    const uniqueTspId = '00000000-0000-0000-0000-000000000001';

    if (imoStateId && imoTenantId) {
      // 1. Repair TSP central record in case tenant_id or state_id is null/missing
      await pool.query(`
        UPDATE tsps
        SET 
          tenant_id = COALESCE(tenant_id, $1::uuid),
          state_id = COALESCE(state_id, $2::uuid),
          state = 'Imo',
          lga = COALESCE(lga, 'Owerri Municipal')
        WHERE id = $3::uuid
      `, [imoTenantId, imoStateId, uniqueTspId]);

      // 2. Repair and align user maps (TSP admin and any other associated accounts)
      await pool.query(`
        UPDATE users
        SET 
          tenant_id = COALESCE(tenant_id, $1::uuid),
          state_id = COALESCE(state_id, $2::uuid),
          tsp_id = COALESCE(tsp_id, $3::uuid)
        WHERE (email = 'tsp.admin@tvet.local' OR tsp_id = $3::uuid OR id = 'user_tsp')
          AND (tenant_id IS NULL OR state_id IS NULL OR tsp_id IS NULL)
      `, [imoTenantId, imoStateId, uniqueTspId]);

      // 3. Audit and align Beneficiaries to ensure no orphaned Unique records exist
      const orphanedBensBefore = await pool.query(`
        SELECT COUNT(*)::int as count FROM beneficiaries
        WHERE (tsp = 'Unique Technology Nig. Ltd' OR tsp_id = $1::uuid OR state = 'Imo')
          AND (tsp_id IS NULL OR state_id IS NULL OR tenant_id IS NULL)
      `, [uniqueTspId]);
      console.log(`[DB Audit] Found ${orphanedBensBefore.rows[0].count} unaligned/orphaned Unique beneficiary records.`);

      await pool.query(`
        UPDATE beneficiaries
        SET 
          tsp_id = COALESCE(tsp_id, $1::uuid),
          state_id = COALESCE(state_id, $2::uuid),
          tenant_id = COALESCE(tenant_id, $3::uuid),
          state = 'Imo'
        WHERE (tsp = 'Unique Technology Nig. Ltd' OR tsp_id = $1::uuid OR state = 'Imo')
          AND (tsp_id IS NULL OR state_id IS NULL OR tenant_id IS NULL)
      `, [uniqueTspId, imoStateId, imoTenantId]);

      // 4. Align training batches and assignments
      let cohortId: string | null = null;
      const cohortRes = await pool.query("SELECT id FROM cohorts LIMIT 1");
      if (cohortRes.rows.length > 0) {
        cohortId = cohortRes.rows[0].id;
      } else {
        const defaultCohortId = "c0c0c0c0-0000-0000-0000-000000000001";
        await pool.query(`
          INSERT INTO cohorts (id, tenant_id, name, cohort_year, start_date, end_date, status)
          VALUES ($1, $2, 'Cohort-2026-A', 2026, '2026-01-01', '2026-12-31', 'ACTIVE')
          ON CONFLICT (id) DO NOTHING
        `, [defaultCohortId, imoTenantId]);
        cohortId = defaultCohortId;
      }

      await pool.query(`
        UPDATE training_batches
        SET 
          tenant_id = COALESCE(tenant_id, $1::uuid),
          cohort_id = COALESCE(cohort_id, $3::uuid)
        WHERE tsp_id = $2::uuid AND (tenant_id IS NULL OR cohort_id IS NULL)
      `, [imoTenantId, uniqueTspId, cohortId]);

      // 5. Align continuous assessments mapping
      await pool.query(`
        UPDATE assessments a
        SET tenant_id = b.tenant_id
        FROM beneficiaries b
        WHERE a.beneficiary_id = b.id AND b.tsp_id = $1::uuid AND a.tenant_id IS NULL
      `, [uniqueTspId]);

      // 6. Align graduation clearances maps
      await pool.query(`
        UPDATE graduation_clearances g
        SET tenant_id = b.tenant_id
        FROM beneficiaries b
        WHERE g.beneficiary_id = b.id AND b.tsp_id = $1::uuid AND g.tenant_id IS NULL
      `, [uniqueTspId]);

      console.log("[DB Audit] Database relationship audit and repair completed successfully.");
    }

  } catch (err: any) {
    console.error("[DB Seeding Error] Location Infrastructure Seeder failed:", err.message || err);
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
      const res = await executeQuery(
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
      await executeQuery(
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
      const res = await executeQuery("UPDATE custom_fields SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[DB Repo] Failed to soft-delete custom field in PG:", e);
      return false;
    }
  }

  /**
   * Loads all historical system-wide audit activity logs with optional pagination and filters
   */
  static async getAuditLogs(options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    tenantId?: string;
    stateId?: string;
    tspId?: string;
    permissionUsed?: string;
    systemContext?: boolean;
  }): Promise<AuditLog[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      let list = loadJsonState().auditLogs as any[];
      if (options?.tenantId) {
        list = list.filter(item => item.tenantId === options.tenantId || item.tenant_id === options.tenantId);
      }
      if (options?.stateId) {
        list = list.filter(item => item.stateId === options.stateId || item.state_id === options.stateId);
      }
      if (options?.tspId) {
        list = list.filter(item => item.tspId === options.tspId || item.tsp_id === options.tspId);
      }
      if (options?.permissionUsed) {
        list = list.filter(item => item.permissionUsed === options.permissionUsed || item.permission_used === options.permissionUsed);
      }
      if (options?.startDate) {
        const start = new Date(options.startDate).getTime();
        list = list.filter(item => new Date(item.timestamp).getTime() >= start);
      }
      if (options?.endDate) {
        const end = new Date(options.endDate).getTime();
        list = list.filter(item => new Date(item.timestamp).getTime() <= end);
      }
      if (options?.offset !== undefined) {
        list = list.slice(options.offset);
      }
      if (options?.limit !== undefined) {
        list = list.slice(0, options.limit);
      }
      return list;
    }

    try {
      await assertTenantContext(options);
      const conditions: string[] = ["deleted_at IS NULL"];
      const params: any[] = [];

      if (options?.tenantId) {
        params.push(options.tenantId);
        conditions.push(`tenant_id = $${params.length}`);
      }
      if (options?.stateId) {
        params.push(options.stateId);
        conditions.push(`state_id = $${params.length}`);
      }
      if (options?.tspId) {
        params.push(options.tspId);
        conditions.push(`tsp_id = $${params.length}`);
      }
      if (options?.permissionUsed) {
        params.push(options.permissionUsed);
        conditions.push(`permission_used = $${params.length}`);
      }
      if (options?.startDate) {
        params.push(new Date(options.startDate));
        conditions.push(`timestamp >= $${params.length}`);
      }
      if (options?.endDate) {
        params.push(new Date(options.endDate));
        conditions.push(`timestamp <= $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
      
      let queryStr = `
        SELECT id, timestamp, username, role, action, details, ip_address, 
               permission_used, effective_role, tenant_id, state_id, tsp_id, beneficiary_id, user_id
        FROM audit_logs 
        ${whereClause} 
        ORDER BY timestamp DESC
      `;

      if (options?.limit !== undefined) {
        params.push(options.limit);
        queryStr += ` LIMIT $${params.length}`;
      }
      if (options?.offset !== undefined) {
        params.push(options.offset);
        queryStr += ` OFFSET $${params.length}`;
      }

      const res = await executeQuery(queryStr, params);
      return res.rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : new Date(r.timestamp).toISOString(),
        username: r.username,
        role: r.role,
        action: r.action,
        details: r.details || "",
        ipAddress: r.ip_address || undefined,
        permissionUsed: r.permission_used || undefined,
        effectiveRole: r.effective_role || undefined,
        tenantId: r.tenant_id || undefined,
        stateId: r.state_id || undefined,
        tspId: r.tsp_id || undefined,
        beneficiaryId: r.beneficiary_id || undefined,
        userId: r.user_id || undefined
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to query audit logs from PG:", e);
      return loadJsonState().auditLogs;
    }
  }

  static isValidUuid(id: any): boolean {
    if (typeof id !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Writes a new system security context logs entry
   */
  static async saveAuditLog(logOrUsername: any, maybeAction?: string, maybeDetails?: string): Promise<any> {
    let logObj: any = {};

    if (typeof logOrUsername === "string") {
      // Legacy style: saveAuditLog(username, action, details)
      logObj = {
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: logOrUsername,
        action: maybeAction || "",
        details: maybeDetails || "",
        role: "Operations Manager"
      };
    } else if (typeof logOrUsername === "object" && logOrUsername !== null) {
      logObj = { ...logOrUsername };
      if (!logObj.id) {
        logObj.id = "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      }
      if (!logObj.timestamp) {
        logObj.timestamp = new Date().toISOString();
      }
      if (!logObj.role) {
        logObj.role = logObj.effectiveRole || "Operations Manager";
      }
    } else {
      console.error("[DB Repo] Invalid parameters to saveAuditLog:", logOrUsername);
      return {};
    }

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      state.auditLogs.unshift({
        id: logObj.id,
        timestamp: logObj.timestamp,
        username: logObj.username,
        role: logObj.role || logObj.effectiveRole || "Operations Manager",
        action: logObj.action,
        details: logObj.details,
        ipAddress: logObj.ipAddress || logObj.ip_address || undefined
      });
      saveJsonState(state);
      return logObj;
    }

    try {
      const id = logObj.id;
      const ts = new Date(logObj.timestamp);
      const username = logObj.username;
      const role = logObj.role || logObj.effectiveRole || "Operations Manager";
      const act = logObj.action;
      const det = logObj.details || "";
      const ip = logObj.ipAddress || logObj.ip_address || null;

      // Modern attributes, default to null if missing
      const permissionUsed = logObj.permissionUsed || logObj.permission_used || null;
      const effectiveRole = logObj.effectiveRole || logObj.effective_role || role || null;

      const tenantId = DbRepo.isValidUuid(logObj.tenantId || logObj.tenant_id) ? (logObj.tenantId || logObj.tenant_id) : null;
      const stateId = DbRepo.isValidUuid(logObj.stateId || logObj.state_id) ? (logObj.stateId || logObj.state_id) : null;
      const tspId = DbRepo.isValidUuid(logObj.tspId || logObj.tsp_id) ? (logObj.tspId || logObj.tsp_id) : null;
      const beneficiaryId = DbRepo.isValidUuid(logObj.beneficiaryId || logObj.beneficiary_id) ? (logObj.beneficiaryId || logObj.beneficiary_id) : null;
      const userId = DbRepo.isValidUuid(logObj.userId || logObj.user_id) ? (logObj.userId || logObj.user_id) : null;

      await executeQuery(
        `INSERT INTO audit_logs (
          id, timestamp, username, role, action, details, ip_address,
          permission_used, effective_role, tenant_id, state_id, tsp_id, beneficiary_id, user_id,
          created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
        [
          id, ts, username, role, act, det, ip,
          permissionUsed, effectiveRole, tenantId, stateId, tspId, beneficiaryId, userId
        ]
      );
      return logObj;
    } catch (e: any) {
      console.error("[DB Repo] Failed to append audit log to PG:", e.message || e);
      try {
        const state = loadJsonState();
        state.auditLogs.unshift({
          id: logObj.id,
          timestamp: logObj.timestamp,
          username: logObj.username,
          role: logObj.role || logObj.effectiveRole || "Operations Manager",
          action: logObj.action,
          details: logObj.details,
          ipAddress: logObj.ipAddress || logObj.ip_address || undefined
        });
        saveJsonState(state);
      } catch (fallbackErr) {
        console.error("[DB Repo] Fallback JSON state save failed:", fallbackErr);
      }
      return logObj;
    }
  }

  /**
   * Queries and returns a list of active beneficiaries with pre-mapped joined records.
   * Leverages options to omit massive Base64 payloads and detail relations unless requested.
   */
  static async getBeneficiaries(options?: { 
    includePhoto?: boolean; 
    includeDetails?: boolean;
    tenantId?: string;
    stateId?: string;
    tspId?: string;
    beneficiaryId?: string;
    systemContext?: boolean;
  }): Promise<Beneficiary[]> {
    const includePhoto = options?.includePhoto ?? false;
    const includeDetails = options?.includeDetails ?? false;

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      let state = loadJsonState().beneficiaries as Beneficiary[];
      
      // Auto-map empty fields for Unique Technology Nig. Ltd beneficiaries in JSON fallback
      state = state.map(b => {
        const mapped = { ...b };
        if (!mapped.tsp) {
          mapped.tsp = "Unique Technology Nig. Ltd";
        }
        if (mapped.tsp === "Unique Technology Nig. Ltd") {
          if (!mapped.tspId) mapped.tspId = "00000000-0000-0000-0000-000000000001";
          if (!mapped.stateId) mapped.stateId = "state_imo_id_default";
          if (!mapped.tenantId) mapped.tenantId = "tsp_tenant_default";
          if (!mapped.state) mapped.state = "Imo";
          if (!mapped.city) mapped.city = "Owerri Municipal";
        }
        return mapped;
      });

      if (options?.tenantId) {
        state = state.filter(b => b.tenantId === options.tenantId);
      }
      if (options?.stateId) {
        state = state.filter(b => b.stateId === options.stateId);
      }
      if (options?.tspId) {
        state = state.filter(b => b.tspId === options.tspId);
      }
      if (options?.beneficiaryId) {
        state = state.filter(b => b.id === options.beneficiaryId);
      }
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
      await assertTenantContext(options);
      const photoCol = includePhoto ? "b.photo" : "'' as photo";
      const conditions: string[] = ["b.deleted_at IS NULL"];
      const params: any[] = [];

      if (options?.tenantId) {
        params.push(options.tenantId);
        conditions.push(`b.tenant_id = $${params.length}`);
      }
      if (options?.stateId) {
        params.push(options.stateId);
        conditions.push(`b.state_id = $${params.length}`);
      }
      if (options?.tspId) {
        params.push(options.tspId);
        conditions.push(`b.tsp_id = $${params.length}`);
      }
      if (options?.beneficiaryId) {
        params.push(options.beneficiaryId);
        conditions.push(`b.id = $${params.length}`);
      }

      const whereStr = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

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
               b.tenant_id as "tenantId", b.state_id as "stateId", b.tsp_id as "tspId",
               adm.admission_status, adm.admission_ref, adm.admission_form_ref, adm.admission_letter_generated_at, 
               adm.admission_letter_sent_at, adm.admission_form_completed, adm.admission_form_status, 
               adm.training_progress, adm.admission_form_generated_at, adm.admission_form_confirmed_at,
               adm.admission_form_viewed_at, adm.admission_form_pdf_url
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        ${whereStr}
        ORDER BY b.created_at DESC
        LIMIT 2000
      `;
      
      const bRes = await executeQuery(queryStr, params);
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
          const docRes = await executeQuery(
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
          const accRes = await executeQuery(
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
          const attRes = await executeQuery(
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
          const emailRes = await executeQuery(
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
          tenantId: row.tenantId || undefined,
          stateId: row.stateId || undefined,
          tspId: row.tspId || undefined,
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
  static async getBeneficiaryById(id: string, options?: { systemContext?: boolean }): Promise<Beneficiary | null> {
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
      await assertTenantContext(options);
      const bRes = await executeQuery(
        `SELECT id, photo, first_name, last_name, other_name, gender, bvn, nin, 
                state, city, phone_number, email, residential_address, batch, 
                custom_fields, tsp, program, skill_sector, status, 
                admission_letter_url, acceptance_letter_url, enrollment_letter_url, certificate_url,
                guardian_name, guardian_address, guardian_phone, physical_challenge,
                bank_account_holder, bank_name, bank_sort_code, bank_account_number, education_qualification, date_of_birth,
                beneficiary_status, status_reason, status_changed_at, status_changed_by, is_archived,
                eligibility_override, eligibility_override_reason, eligibility_override_by, eligibility_override_at,
                certification_status, certificate_number, certificate_issued_at, certificate_issued_by, graduation_batch, alumni_status, certificate_reference, certificate_verification_code, certificate_download_count, certificate_last_downloaded_at, alumni_employment_status, alumni_entrepreneur_status, alumni_business_name, alumni_current_employer,
                created_at, updated_at, token_version, workflow_version,
                tenant_id as "tenantId", state_id as "stateId", tsp_id as "tspId"
         FROM beneficiaries
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (bRes.rows.length === 0) return null;
      const row = bRes.rows[0];

      // Hydrate Admissions
      const admRes = await executeQuery(
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
      const docRes = await executeQuery(
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
      const accRes = await executeQuery(
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
      const attRes = await executeQuery(
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
      const emailRes = await executeQuery(
        `SELECT tracking_status, sender_emailstatus, smtp_error_details, tracking_history, delivery_history
         FROM email_logs
         WHERE beneficiary_id = $1 AND deleted_at IS NULL
         ORDER BY date_sent DESC LIMIT 1`,
        [id]
      );
      const eml = emailRes.rows[0] || {};

      const beneficiary: Beneficiary = {
        id: row.id,
        tenantId: row.tenantId || undefined,
        stateId: row.stateId || undefined,
        tspId: row.tspId || undefined,
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
        alumniCurrentEmployer: row.alumni_current_employer || "",
        tokenVersion: row.token_version !== undefined && row.token_version !== null ? parseInt(row.token_version, 10) : 1,
        workflowVersion: row.workflow_version !== undefined && row.workflow_version !== null ? parseInt(row.workflow_version, 10) : 1
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
        const existingRes = await executeQuery(
          "SELECT admission_form_ref FROM admissions WHERE beneficiary_id = $1",
          [id]
        );
        if (existingRes.rows.length > 0 && existingRes.rows[0].admission_form_ref) {
          return existingRes.rows[0].admission_form_ref;
        }
      }

      // Generate a new sequential reference
      const countRes = await executeQuery(
        "SELECT count(*) as total FROM admissions WHERE admission_form_ref IS NOT NULL AND admission_form_ref LIKE 'IDEAS-AF-%'"
      );
      const nextSeq = Number(countRes.rows[0]?.total || 0) + 1;
      const year = new Date().getFullYear();
      const newRef = `IDEAS-AF-${year}-${String(nextSeq).padStart(6, "0")}`;

      // Insert/Update admissions record with this reference
      await executeQuery(
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
      const existRes = await executeQuery(
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
      const countRes = await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      const seqRes = await executeQuery("SELECT nextval('ideas_beneficiary_id_seq') as val");
      const nextVal = seqRes.rows[0].val;
      const pad = String(nextVal).padStart(3, "0");
      return `IDEAS-${year}-${pad}`;
    } catch (e) {
      console.error("[DB Repo] Failed to get nextval for beneficiary ID sequence:", e);
      const countRes = await executeQuery("SELECT count(*) as count FROM beneficiaries");
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
           created_at, updated_at, token_version, workflow_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60)
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
           alumni_current_employer = EXCLUDED.alumni_current_employer, token_version = EXCLUDED.token_version, workflow_version = EXCLUDED.workflow_version,
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
          b.alumniEmploymentStatus || "", b.alumniEntrepreneurStatus || "", b.alumniBusinessName || "", b.alumniCurrentEmployer || "", b.tokenVersion || 1, b.workflowVersion || 1,
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

      // 4. Reconcile acceptance declarations cascade without deleting older entries to preserve history (Phase 3)
      if (b.acceptanceLetterVersions && b.acceptanceLetterVersions.length > 0) {
        for (const accl of b.acceptanceLetterVersions) {
          const existsRes = await client.query(
            "SELECT id FROM acceptance_letters WHERE beneficiary_id = $1 AND version = $2",
            [b.id, accl.version]
          );
          if (existsRes.rows.length === 0) {
            await client.query(
              `INSERT INTO acceptance_letters (beneficiary_id, version, url, name, uploaded_at, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
              [
                b.id, accl.version, accl.url, accl.name,
                accl.uploadedAt ? new Date(accl.uploadedAt) : new Date()
              ]
            );
          } else {
            await client.query(
              `UPDATE acceptance_letters SET url = $1, name = $2, uploaded_at = $3, updated_at = NOW() 
               WHERE beneficiary_id = $4 AND version = $5`,
              [
                accl.url, accl.name, accl.uploadedAt ? new Date(accl.uploadedAt) : new Date(),
                b.id, accl.version
              ]
            );
          }
        }
      } else if (b.acceptanceLetterUploaded && b.acceptanceLetterUrl) {
        const existsRes = await client.query(
          "SELECT id FROM acceptance_letters WHERE beneficiary_id = $1 AND version = $2",
          [b.id, 1]
        );
        if (existsRes.rows.length === 0) {
          await client.query(
            `INSERT INTO acceptance_letters (beneficiary_id, version, url, name, uploaded_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              b.id, 1, b.acceptanceLetterUrl, "Official Signed Acceptance.html",
              b.acceptanceLetterUploadedAt ? new Date(b.acceptanceLetterUploadedAt) : new Date()
            ]
          );
        } else {
          await client.query(
            `UPDATE acceptance_letters SET url = $1, name = $2, uploaded_at = $3, updated_at = NOW() 
             WHERE beneficiary_id = $4 AND version = $5`,
            [
              b.acceptanceLetterUrl, "Official Signed Acceptance.html",
              b.acceptanceLetterUploadedAt ? new Date(b.acceptanceLetterUploadedAt) : new Date(),
              b.id, 1
            ]
          );
        }
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
      const curRes = await executeQuery("SELECT beneficiary_status FROM beneficiaries WHERE id = $1 AND deleted_at IS NULL", [id]);
      const oldStatus = curRes.rows[0]?.beneficiary_status || "ACTIVE";

      const res = await executeQuery(
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
      if (normalizedEmail === "fed.admin@tvet.local") {
        return {
          id: "user_fed",
          email: normalizedEmail,
          password_hash: bcrypt.hashSync("ChangeMe123!", 10),
          role: "FED",
          tenant_id: "fed_tenant_default",
          tenant_tier: "FED",
          failed_login_attempts: 0
        };
      }
      if (normalizedEmail === "state.admin@tvet.local") {
        return {
          id: "user_sta",
          email: normalizedEmail,
          password_hash: bcrypt.hashSync("ChangeMe123!", 10),
          role: "STA",
          tenant_id: "55555555-5555-5555-5555-555555555555",
          tenant_tier: "STA",
          state_id: "66666666-6666-6666-6666-666666666666",
          failed_login_attempts: 0
        };
      }
      if (normalizedEmail === "tsp.admin@tvet.local") {
        return {
          id: "user_tsp",
          email: normalizedEmail,
          password_hash: bcrypt.hashSync("ChangeMe123!", 10),
          role: "TSP_ADMIN",
          tenant_id: "tsp_tenant_default",
          tenant_tier: "TSP",
          state_id: "state_imo_id_default",
          tsp_id: "00000000-0000-0000-0000-000000000001",
          failed_login_attempts: 0
        };
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
      const res = await executeQuery(
        "SELECT u.id, u.email, u.password_hash, u.role, u.beneficiary_id, u.failed_login_attempts, u.lockout_until, u.reset_token, u.reset_token_expires, u.created_at, u.updated_at, u.tenant_id, u.state_id, u.tsp_id, t.tier as tenant_tier FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email = $1 AND u.deleted_at IS NULL",
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
          updated_at: res.rows[0].updated_at ? res.rows[0].updated_at.toISOString() : new Date().toISOString(),
          tenant_id: res.rows[0].tenant_id,
          state_id: res.rows[0].state_id,
          tsp_id: res.rows[0].tsp_id,
          tenant_tier: res.rows[0].tenant_tier
        };
      }

      // If user not found, dynamically provision the Trainee account if they already exist in beneficiaries
      const bRes = await executeQuery("SELECT id, first_name, last_name, nin, bvn, tenant_id, state_id, tsp_id FROM beneficiaries WHERE email = $1 AND deleted_at IS NULL LIMIT 1", [email.toLowerCase().trim()]);
      if (bRes.rows.length > 0) {
        const b = bRes.rows[0];
        const defaultTraineePassword = b.nin ? b.nin : (b.bvn ? b.bvn : "Password123");
        const defaultHash = bcrypt.hashSync(defaultTraineePassword, 10);
        const newUid = `usr_tr_${b.id}`;
        await executeQuery(
          "INSERT INTO users (id, email, password_hash, role, beneficiary_id, failed_login_attempts, tenant_id, state_id, tsp_id) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8) ON CONFLICT (email) DO NOTHING",
          [newUid, email.toLowerCase().trim(), defaultHash, "TRAINEE", b.id, b.tenant_id, b.state_id, b.tsp_id]
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
          updated_at: new Date().toISOString(),
          tenant_id: b.tenant_id,
          state_id: b.state_id,
          tsp_id: b.tsp_id,
          tenant_tier: "BEN"
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
      if (id === "user_fed") return { id: "user_fed", email: "fed.admin@tvet.local", role: "FED", tenant_id: "fed_tenant_default", tenant_tier: "FED" };
      if (id === "user_sta") return { id: "user_sta", email: "state.admin@tvet.local", role: "STA", tenant_id: "55555555-5555-5555-5555-555555555555", tenant_tier: "STA", state_id: "66666666-6666-6666-6666-666666666666" };
      return null;
    }

    try {
      const res = await executeQuery(
        "SELECT u.id, u.email, u.role, u.beneficiary_id, u.failed_login_attempts, u.lockout_until, u.created_at, u.tenant_id, u.state_id, u.tsp_id, t.tier as tenant_tier FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1 AND u.deleted_at IS NULL",
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

      await executeQuery(
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
   * Save user session with token (Task 006 - Modernized & Backward-compatible overloaded signature)
   */
  static async saveUserSession(
    idOrParams: string | {
      id?: string;
      user_id: string;
      token: string;
      expires_at: string;
      tenant_id?: string;
      tenant_tier?: string;
      state_id?: string;
      tsp_id?: string;
    },
    user_id?: string,
    token?: string,
    expires_at?: string,
    tenant_id?: string,
    tenant_tier?: string,
    state_id?: string,
    tsp_id?: string
  ): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return true;

    let finalId = "";
    let finalUserId = "";
    let finalToken = "";
    let finalExpiresAt: Date;
    let finalTenantId: string | null = null;
    let finalTenantTier: string | null = null;
    let finalStateId: string | null = null;
    let finalTspId: string | null = null;

    if (idOrParams && typeof idOrParams === "object") {
      finalId = idOrParams.id || "sess_" + require("crypto").randomBytes(16).toString("hex");
      finalUserId = idOrParams.user_id;
      finalToken = idOrParams.token;
      finalExpiresAt = new Date(idOrParams.expires_at);
      finalTenantId = idOrParams.tenant_id || null;
      finalTenantTier = idOrParams.tenant_tier || null;
      finalStateId = idOrParams.state_id || null;
      finalTspId = idOrParams.tsp_id || null;
    } else {
      finalId = typeof idOrParams === "string" ? idOrParams : "";
      finalUserId = user_id || "";
      finalToken = token || "";
      finalExpiresAt = expires_at ? new Date(expires_at) : new Date();
      finalTenantId = tenant_id || null;
      finalTenantTier = tenant_tier || null;
      finalStateId = state_id || null;
      finalTspId = tsp_id || null;
    }

    try {
      await executeQuery(
        `INSERT INTO user_sessions (id, user_id, token, expires_at, tenant_id, tenant_tier, state_id, tsp_id) 
         VALUES ($1, $2, $3, $4, $5, $6::tenant_tier, $7, $8) 
         ON CONFLICT (id) DO UPDATE SET 
           token = EXCLUDED.token, 
           expires_at = EXCLUDED.expires_at,
           tenant_id = EXCLUDED.tenant_id,
           tenant_tier = EXCLUDED.tenant_tier,
           state_id = EXCLUDED.state_id,
           tsp_id = EXCLUDED.tsp_id`,
        [finalId, finalUserId, finalToken, finalExpiresAt, finalTenantId, finalTenantTier, finalStateId, finalTspId]
      );
      return true;
    } catch (e: any) {
      console.error("[DB Repo] Failed to save session:", e.message || e);
      return false;
    }
  }

  /**
   * Retrieve session by token (Task 006 - Strengthening Database Resolution)
   */
  static async getUserSessionByToken(token: string): Promise<any | null> {
    const JWT_SECRET = process.env.JWT_SECRET || "ideas-tvet-system-secret-authority-token-1995";
    
    // Attempt to verify/decode the JWT token to see if it has valid claims
    let decoded: any = null;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      console.log(`[DB Repo] Session JWT is verified invalid: ${err.message}`);
    }

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // B. Database unavailable
      console.warn("[DB Repo] Database is currently unavailable (no active pool or pg flag is inactive).");
      if (decoded) {
        console.warn(`[DB Repo] DANGER/OUTAGE: Differentiating database offline status. Restoring offline session from valid JWT for user: ${decoded.email}`);
        return {
          session_id: "offline_session_" + decoded.id,
          user_id: decoded.id,
          token: token,
          expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          email: decoded.email,
          role: decoded.role,
          beneficiary_id: decoded.beneficiaryId || null,
          tenant_id: decoded.tenantId || null,
          tenant_tier: decoded.tenantTier || null,
          state_id: decoded.stateId || null,
          tsp_id: decoded.tspId || null
        };
      }
      return null;
    }

    try {
      const res = await executeQuery(
        `SELECT us.id as session_id, us.user_id, us.token, us.expires_at, u.email, u.role, u.beneficiary_id, 
                COALESCE(us.tenant_id, u.tenant_id) AS tenant_id, 
                COALESCE(us.state_id, u.state_id) AS state_id, 
                COALESCE(us.tsp_id, u.tsp_id) AS tsp_id, 
                COALESCE(us.tenant_tier, t.tier) AS tenant_tier 
         FROM user_sessions us
         INNER JOIN users u ON u.id = us.user_id
         LEFT JOIN tenants t ON t.id = u.tenant_id
         WHERE us.token = $1 AND us.expires_at > NOW() AND u.deleted_at IS NULL`,
        [token]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
      
      // A. Session not found
      console.log(`[DB Repo] Session look-up completed: No active session row found for token in database (Session not found or revoked).`);
      return null;
    } catch (e: any) {
      // B. Database unavailable
      console.error("[DB Repo] Database query failed during session Lookup (Differentiating database offline status):", e.message || e);
      if (decoded) {
        console.warn(`[DB Repo] DANGER/OUTAGE: Session lookup database error, but token JWT is valid. Restoring fallback data session for user: ${decoded.email}`);
        return {
          session_id: "offline_session_" + decoded.id,
          user_id: decoded.id,
          token: token,
          expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          email: decoded.email,
          role: decoded.role,
          beneficiary_id: decoded.beneficiaryId || null,
          tenant_id: decoded.tenantId || null,
          tenant_tier: decoded.tenantTier || null,
          state_id: decoded.stateId || null,
          tsp_id: decoded.tspId || null
        };
      }
      return null;
    }
  }

  /**
   * Get user permissions (Task 009 - Dynamic Permission Authorization Engine implementation)
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // JSON/SQLite local file database offline fallback compatibility
      if (userId === "user_sa") {
        return [
          "all_access", "manage_users", "manage_roles", "manage_permissions", "execute_migrations",
          "manage_tenants", "manage_states", "manage_tsps", "review_admissions", "approve_admissions",
          "reject_admissions", "manage_beneficiaries", "manage_annex9", "view_reports", "export_reports",
          "audit_logs_access"
        ];
      }
      if (userId === "user_ao") {
        return [
          "manage_admissions", "manage_beneficiaries", "manage_annex9", "view_reports", "export_reports"
        ];
      }
      if (userId === "user_ro") {
        return [
          "review_submissions", "review_admissions", "approve_admissions", "reject_admissions", "view_reports"
        ];
      }
      if (userId === "user_fed") {
        return [
          "view_reports", "audit_logs_access", "manage_cohorts", "manage_batches", "manage_trainers", "manage_assessments", "manage_graduation"
        ];
      }
      if (userId === "user_sta") {
        return [
          "view_reports", "manage_cohorts", "manage_batches", "manage_trainers", "manage_assessments", "manage_graduation"
        ];
      }
      if (userId && (userId.startsWith("usr_tr_") || userId === "user_tr")) {
        return ["trainee_access"];
      }
      return [];
    }

    try {
      // Use query resolving over both roles.id (standard matching for role names inside users.role)
      // and permissions.id (the snake_case keys used by permission-based checking)
      const res = await executeQuery(
        `SELECT DISTINCT p.id AS permission_id
         FROM users u
         JOIN roles r ON r.id = u.role OR r.name = u.role
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE u.id = $1`,
        [userId]
      );
      
      const permissions: string[] = [];
      for (const row of res.rows) {
        if (row.permission_id) {
          permissions.push(row.permission_id);
        }
      }
      return permissions;
    } catch (e: any) {
      console.error("[DB Repo] Failed to get user permissions:", e.message || e);
      return [];
    }
  }

  /**
   * Delete session by token (log out)
   */
  static async deleteUserSessionByToken(token: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return true;

    try {
      await executeQuery("DELETE FROM user_sessions WHERE token = $1", [token]);
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
      const res = await executeQuery(
        "SELECT u.id, u.email, u.password_hash, u.role, u.failed_login_attempts, u.lockout_until, u.reset_token, u.reset_token_expires, u.tenant_id, u.state_id, u.tsp_id, t.tier as tenant_tier FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.reset_token = $1 AND u.reset_token_expires > NOW() AND u.deleted_at IS NULL",
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
      const res = await executeQuery("SELECT id, organization_name, tpm_name, tpm_title, contact_email, contact_phone, contact_address, letterhead_url, signature_url, stamp_url, watermark_text, watermark_enabled, fme_logo_url, ideas_logo_url, world_bank_logo_url, nbte_logo_url, custom_logo_url, admission_letterhead_url, acceptance_letterhead_url, enrollment_letterhead_url, certificate_background_url, photo_album_header_url, training_venue, training_start_date, training_end_date, attendance_threshold, completion_threshold FROM organization_settings ORDER BY updated_at DESC LIMIT 1");
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
      await executeQuery(
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
      const res = await executeQuery("SELECT id, name, sector, code, total_hours FROM training_programs ORDER BY name ASC");
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
      await executeQuery(
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
      await executeQuery("DELETE FROM training_programs WHERE id = $1", [id]);
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to delete training program:", e);
      return false;
    }
  }

  /**
   * Save a generated document version to the centralized database, marking previous active docs of same type as SUPERSEDED (Phase 3)
   */
  static async saveGeneratedDocument(doc: any): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      // In simulation fallback mode, write to state and persist
      const state = loadJsonState() as any;
      if (!state.generatedDocuments) {
        state.generatedDocuments = [];
      }
      // Supercede any existing ACTIVE docs of same type and beneficiary
      state.generatedDocuments.forEach((d: any) => {
        if (d.beneficiaryId === doc.beneficiaryId && d.documentType === doc.documentType && d.id !== doc.id && d.documentStatus === "ACTIVE") {
          d.documentStatus = "SUPERSEDED";
        }
      });
      // Set current status to ACTIVE
      doc.documentStatus = doc.documentStatus || "ACTIVE";
      const idx = state.generatedDocuments.findIndex((x: any) => x.id === doc.id);
      if (idx !== -1) {
        state.generatedDocuments[idx] = doc;
      } else {
        state.generatedDocuments.push(doc);
      }
      saveJsonState(state);
      return true;
    }
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        // Phase 3 - Set any previous ACTIVE docs of this type for this beneficiary to SUPERSEDED
        await client.query(
          "UPDATE generated_documents SET document_status = 'SUPERSEDED' WHERE beneficiary_id = $1 AND document_type = $2 AND document_status = 'ACTIVE'",
          [doc.beneficiaryId, doc.documentType]
        );

        await client.query(
          `INSERT INTO generated_documents (
            id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at,
            verification_code, verification_status, verification_date, verified_at, email_delivery_status, document_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             pdf_url = EXCLUDED.pdf_url,
             docx_url = EXCLUDED.docx_url,
             generated_by = EXCLUDED.generated_by,
             created_at = EXCLUDED.created_at,
             verification_code = EXCLUDED.verification_code,
             verification_status = EXCLUDED.verification_status,
             verification_date = EXCLUDED.verification_date,
             verified_at = EXCLUDED.verified_at,
             email_delivery_status = EXCLUDED.email_delivery_status,
             document_status = EXCLUDED.document_status`,
          [
            doc.id, doc.beneficiaryId, doc.documentType, doc.version, doc.pdfUrl, doc.docxUrl || null, doc.generatedBy, new Date(doc.createdAt),
            doc.verificationCode || null, doc.verificationStatus || "VALID",
            doc.verificationDate ? new Date(doc.verificationDate) : null,
            doc.verifiedAt ? new Date(doc.verifiedAt) : null,
            doc.emailDeliveryStatus || "Pending",
            doc.documentStatus || "ACTIVE"
          ]
        );
        await client.query("COMMIT");
        client.release();
        return true;
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    } catch (e) {
      console.error("[DB Repo] Failed to save generated document:", e);
      return false;
    }
  }

  /**
   * Phase 3 / 4 / 5 - Archive all ACTIVE documents of a beneficiary on rollback/unlock (ACTIVE -> ARCHIVED)
   */
  static async archiveActiveDocuments(beneficiaryId: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState() as any;
      const docsArr = state.generated_documents || state.generatedDocuments || [];
      docsArr.forEach((d: any) => {
        const matchesB = d.beneficiaryId === beneficiaryId || d.beneficiary_id === beneficiaryId;
        const isActive = (d.documentStatus || d.document_status || "").toUpperCase() === "ACTIVE";
        if (matchesB && isActive) {
          if (d.documentStatus !== undefined) d.documentStatus = "ARCHIVED";
          if (d.document_status !== undefined) d.document_status = "ARCHIVED";
        }
      });
      // Save arrays under whichever key exists
      if (state.generated_documents) state.generated_documents = docsArr;
      if (state.generatedDocuments) state.generatedDocuments = docsArr;
      saveJsonState(state);
      return true;
    }
    try {
      await executeQuery(
        "UPDATE generated_documents SET document_status = 'ARCHIVED' WHERE beneficiary_id = $1 AND document_status = 'ACTIVE'",
        [beneficiaryId]
      );
      return true;
    } catch (e) {
      console.error("[DB Repo] Failed to archive active documents:", e);
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
      const res = await executeQuery(
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
      const res = await executeQuery(
        "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, verified_at, email_delivery_status, document_status FROM generated_documents WHERE beneficiary_id = $1 ORDER BY created_at DESC",
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
        emailDeliveryStatus: row.email_delivery_status || undefined,
        documentStatus: row.document_status || "ACTIVE"
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
      await executeQuery(
        `INSERT INTO workflow_history (
          beneficiary_id, old_status, new_status, changed_by, changed_at, remarks, reason, ip_address,
          token_version_before, token_version_after, workflow_version_before, workflow_version_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          h.beneficiaryId,
          h.oldStatus,
          h.newStatus,
          h.changedBy,
          h.changedAt ? new Date(h.changedAt) : new Date(),
          h.remarks || "",
          h.reason || "",
          h.ipAddress || "",
          h.tokenVersionBefore || 1,
          h.tokenVersionAfter || 1,
          h.workflowVersionBefore || 1,
          h.workflowVersionAfter || 1
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
      const res = await executeQuery(
        "SELECT id, beneficiary_id, old_status, new_status, changed_by, changed_at, remarks, reason, ip_address, token_version_before, token_version_after, workflow_version_before, workflow_version_after FROM workflow_history WHERE beneficiary_id = $1 ORDER BY id ASC, changed_at ASC",
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
        ipAddress: row.ip_address || "",
        tokenVersionBefore: row.token_version_before !== undefined && row.token_version_before !== null ? row.token_version_before : 1,
        tokenVersionAfter: row.token_version_after !== undefined && row.token_version_after !== null ? row.token_version_after : 1,
        workflowVersionBefore: row.workflow_version_before !== undefined && row.workflow_version_before !== null ? row.workflow_version_before : 1,
        workflowVersionAfter: row.workflow_version_after !== undefined && row.workflow_version_after !== null ? row.workflow_version_after : 1
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
      const res = await executeQuery(
        "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, verified_at, email_delivery_status, document_status FROM generated_documents WHERE LOWER(verification_code) = LOWER($1)",
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
        emailDeliveryStatus: row.email_delivery_status,
        documentStatus: row.document_status || "ACTIVE"
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
      const res = await executeQuery(
        "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, verified_at, email_delivery_status, document_status FROM generated_documents WHERE id = $1",
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
        emailDeliveryStatus: row.email_delivery_status,
        documentStatus: row.document_status || "ACTIVE"
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
      await executeQuery(
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
      await executeQuery(
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
      await executeQuery(
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
      const res = await executeQuery(
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
  static async getAdmissionsStats(options?: {
    tenantId?: string;
    stateId?: string;
    tspId?: string;
  }): Promise<{
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
      let beneficiariesList = state.beneficiaries as Beneficiary[];
      
      if (options?.tenantId) {
        beneficiariesList = beneficiariesList.filter(b => b.tenantId === options.tenantId);
      }
      if (options?.stateId) {
        beneficiariesList = beneficiariesList.filter(b => b.stateId === options.stateId);
      }
      if (options?.tspId) {
        beneficiariesList = beneficiariesList.filter(b => b.tspId === options.tspId);
      }
      
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
      let whereClause = "WHERE b.deleted_at IS NULL ";
      const params: any[] = [];
      let paramCount = 1;

      if (options?.tenantId) {
        whereClause += `AND b.tenant_id = $${paramCount} `;
        params.push(options.tenantId);
        paramCount++;
      }
      if (options?.stateId) {
        whereClause += `AND b.state_id = $${paramCount} `;
        params.push(options.stateId);
        paramCount++;
      }
      if (options?.tspId) {
        whereClause += `AND b.tsp_id = $${paramCount} `;
        params.push(options.tspId);
        paramCount++;
      }

      // Direct high-efficiency groupings in Postgres
      const summaryRes = await executeQuery(`
        SELECT COALESCE(adm.admission_status, 'Pending') as status, COUNT(*) as count
         FROM beneficiaries b
         LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
         ${whereClause}
         GROUP BY COALESCE(adm.admission_status, 'Pending')
      `, params);

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

      const sectorRes = await executeQuery(`
        SELECT b.skill_sector, COUNT(*) as count 
         FROM beneficiaries b 
         ${whereClause} 
         GROUP BY b.skill_sector
      `, params);
      const bySector: { [key: string]: number } = {};
      for (const r of sectorRes.rows) {
        bySector[r.skill_sector || "Computer Repairs"] = parseInt(r.count, 10);
      }

      const programRes = await executeQuery(`
        SELECT b.program, COUNT(*) as count 
         FROM beneficiaries b 
         ${whereClause} 
         GROUP BY b.program
      `, params);
      const byProgram: { [key: string]: number } = {};
      for (const r of programRes.rows) {
        byProgram[r.program || "IDEAS-TVET"] = parseInt(r.count, 10);
      }

      const tspRes = await executeQuery(`
        SELECT b.tsp, COUNT(*) as count 
         FROM beneficiaries b 
         ${whereClause} 
         GROUP BY b.tsp
      `, params);
      const byTsp: { [key: string]: number } = {};
      for (const r of tspRes.rows) {
        byTsp[r.tsp || "Unique Tech"] = parseInt(r.count, 10);
      }

      const stateRes = await executeQuery(`
        SELECT b.state, COUNT(*) as count 
         FROM beneficiaries b 
         ${whereClause} 
         GROUP BY b.state
      `, params);
      const byState: { [key: string]: number } = {};
      for (const r of stateRes.rows) {
        const name = (r.state || "Unassigned").replace(" State", "");
        byState[name] = parseInt(r.count, 10);
      }

      const lgaRes = await executeQuery(`
        SELECT b.city, COUNT(*) as count 
         FROM beneficiaries b 
         ${whereClause} 
         GROUP BY b.city
      `, params);
      const byLga: { [key: string]: number } = {};
      for (const r of lgaRes.rows) {
        byLga[r.city || "Owerri Central"] = parseInt(r.count, 10);
      }

      // Fetch acceptance letter statuses count
      const accLetterRes = await executeQuery(`
        SELECT COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED') as status, COUNT(*) as count
        FROM beneficiaries b
        LEFT JOIN admissions adm ON b.id = adm.beneficiary_id AND adm.deleted_at IS NULL
        ${whereClause}
        GROUP BY COALESCE(adm.acceptance_letter_status, 'NOT_SUBMITTED')
      `, params);
      const acceptanceSummary = { NOT_SUBMITTED: 0, SUBMITTED: 0, UNDER_VERIFICATION: 0, ACCEPTED: 0, REJECTED: 0 } as any;
      for (const r of accLetterRes.rows) {
        const rawStatus = String(r.status || "NOT_SUBMITTED").toUpperCase().replace(" ", "_");
        const mappedStatus = acceptanceSummary.hasOwnProperty(rawStatus) ? rawStatus : "NOT_SUBMITTED";
        acceptanceSummary[mappedStatus] = (acceptanceSummary[mappedStatus] || 0) + parseInt(r.count, 10);
      }

      // Fetch recentActivities
      const recentActivities = await DbRepo.getRecentAdmissionsActivities();

      // Fetch admission form stats
      const formStatsRes = await executeQuery(`
        SELECT 
          COUNT(CASE WHEN adm.admission_form_pdf_url IS NOT NULL OR adm.admission_form_generated_at IS NOT NULL THEN 1 END) as generated,
          COUNT(CASE WHEN adm.admission_form_viewed_at IS NOT NULL THEN 1 END) as viewed,
          COUNT(CASE WHEN adm.admission_form_confirmed_at IS NOT NULL THEN 1 END) as confirmed,
          COUNT(CASE WHEN (adm.admission_form_pdf_url IS NOT NULL OR adm.admission_form_generated_at IS NOT NULL) AND adm.admission_form_confirmed_at IS NULL THEN 1 END) as pending
        FROM admissions adm
        JOIN beneficiaries b ON adm.beneficiary_id = b.id
        ${whereClause} AND adm.deleted_at IS NULL
      `, params);
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
      const res = await executeQuery(`
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
   * Fetch paginated list of admissions with selective non-photo column projections and role/tenancy filters
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
    tenantId?: string;
    stateId?: string;
    tspId?: string;
    beneficiaryId?: string;
    systemContext?: boolean;
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

      if (options.tenantId) {
        list = list.filter(b => b.tenantId === options.tenantId);
      }
      if (options.stateId) {
        list = list.filter(b => b.stateId === options.stateId);
      }
      if (options.tspId) {
        list = list.filter(b => b.tspId === options.tspId);
      }
      if (options.beneficiaryId) {
        list = list.filter(b => b.id === options.beneficiaryId);
      }

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
      await assertTenantContext(options);
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
        "b.residential_address as address",
        "b.bank_name",
        "b.bank_account_number as account_number",
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

      // Append optional role/tenancy isolation filters (Task 012)
      if (options.tenantId) {
        queryWhere += `AND b.tenant_id = $${paramCount} `;
        params.push(options.tenantId);
        paramCount++;
      }
      if (options.stateId) {
        queryWhere += `AND b.state_id = $${paramCount} `;
        params.push(options.stateId);
        paramCount++;
      }
      if (options.tspId) {
        queryWhere += `AND b.tsp_id = $${paramCount} `;
        params.push(options.tspId);
        paramCount++;
      }
      if (options.beneficiaryId) {
        queryWhere += `AND b.id = $${paramCount} `;
        params.push(options.beneficiaryId);
        paramCount++;
      }

      // Count Query
      const countRes = await executeQuery(
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

      const rowsRes = await executeQuery(pagedStr, paginationParams);
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
      const res = await executeQuery(queryStr, params);
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
      const res = await executeQuery(q);
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
      const res = await executeQuery(q);
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
      const res = await executeQuery(q);
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
    systemContext?: boolean;
    tenantId?: string;
    stateId?: string;
    tspId?: string;
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

      if (options.tenantId) {
        list = list.filter(b => b.tenantId === options.tenantId);
      }
      if (options.stateId) {
        list = list.filter(b => b.stateId === options.stateId);
      }
      if (options.tspId) {
        list = list.filter(b => b.tspId === options.tspId);
      }

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
      await assertTenantContext(options);
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

      if (options?.tenantId) {
        queryWhere += `AND b.tenant_id = $${paramCount} `;
        params.push(options.tenantId);
        paramCount++;
      }

      if (options?.stateId) {
        queryWhere += `AND b.state_id = $${paramCount} `;
        params.push(options.stateId);
        paramCount++;
      }

      if (options?.tspId) {
        queryWhere += `AND b.tsp_id = $${paramCount} `;
        params.push(options.tspId);
        paramCount++;
      }

      // Count Query
      const countRes = await executeQuery(
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

      const dataRes = await executeQuery(itemsQuery, dataParams);
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
      const res = await executeQuery(
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
        await executeQuery(
          "UPDATE institution_letterheads SET is_default = FALSE WHERE id <> $1",
          [lh.id]
        );
      }

      await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
        await executeQuery(
          "UPDATE admission_form_templates SET is_default = FALSE WHERE id <> $1",
          [t.id]
        );
      }

      await executeQuery(
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
      const res = await executeQuery(
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

        const isRelative = urlToTest.startsWith("/") || !urlToTest.startsWith("http");
        const isMockOrPlaceholder = urlToTest.includes("example.com") || urlToTest.includes("placeholder") || urlToTest.includes("mock") || urlToTest.includes("picsum.photos") || urlToTest.includes("ideas_tvet_templates");
        const isCloudinaryUrl = urlToTest.includes("res.cloudinary.com");

        if (isRelative || isMockOrPlaceholder || (!isCloudinaryConfigured && isCloudinaryUrl)) {
          console.log(`[Recovery] Skipping reachability check for mock/relative/Cloudinary template: ${lh.name}`);
          if (lh.name.includes("[BROKEN_TEMPLATE]")) {
            lh.name = lh.name.replace(/\s*\[BROKEN_TEMPLATE\]/g, "").trim();
            await this.saveLetterhead(lh);
          }
          continue;
        }

        let isReachable = false;
        try {
          const testRes = await fetch(urlToTest, { method: "HEAD" });
          if (testRes.status === 200 || (isCloudinaryUrl && testRes.status === 404)) {
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

        const isRelative = urlToTest.startsWith("/") || !urlToTest.startsWith("http");
        const isMockOrPlaceholder = urlToTest.includes("example.com") || urlToTest.includes("placeholder") || urlToTest.includes("mock") || urlToTest.includes("picsum.photos") || urlToTest.includes("ideas_tvet_templates");
        const isCloudinaryUrl = urlToTest.includes("res.cloudinary.com");

        if (isRelative || isMockOrPlaceholder || (!isCloudinaryConfigured && isCloudinaryUrl)) {
          console.log(`[Recovery] Skipping reachability check for mock/relative/Cloudinary template: ${t.name}`);
          if (t.name.includes("[BROKEN_TEMPLATE]")) {
            t.name = t.name.replace(/\s*\[BROKEN_TEMPLATE\]/g, "").trim();
            await this.saveAdmissionFormTemplate(t);
          }
          continue;
        }

        let isReachable = false;
        try {
          const testRes = await fetch(urlToTest, { method: "HEAD" });
          if (testRes.status === 200 || (isCloudinaryUrl && testRes.status === 404)) {
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
    systemContext?: boolean;
  }): Promise<{ profiles: any[]; total: number }> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return { profiles: [], total: 0 };
    }

    const { search, state, skill, tsp, page = 1, limit = 20 } = params;
    await assertTenantContext(params);
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
      const countRes = await executeQuery(
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
      const res = await executeQuery(queryStr, fetchValues);

      return {
        profiles: res.rows,
        total
      };
    } catch (err: any) {
      console.error("[DB Repo] getTraineeProfiles error:", err);
      return { profiles: [], total: 0 };
    }
  }

  static async getTraineeProfileByBeneficiaryId(beneficiaryId: string, options?: { systemContext?: boolean }): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      await assertTenantContext(options);
      const res = await executeQuery(`
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
      await executeQuery(`
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
      await executeQuery(`
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
    tenantId?: string;
    stateId?: string;
    tspId?: string;
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

    if (params.tenantId) {
      whereClause += ` AND b.tenant_id = $${valIndex}`;
      values.push(params.tenantId);
      valIndex++;
    }

    if (params.stateId) {
      whereClause += ` AND b.state_id = $${valIndex}`;
      values.push(params.stateId);
      valIndex++;
    }

    if (params.tspId) {
      whereClause += ` AND b.tsp_id = $${valIndex}`;
      values.push(params.tspId);
      valIndex++;
    }

    try {
      const countRes = await executeQuery(
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
      const res = await executeQuery(queryStr, fetchValues);

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
      let hours_logged = 0;
      const cleanStatus = (record.status || "").toUpperCase();
      if (cleanStatus === "PRESENT" || cleanStatus === "LATE") {
        hours_logged = 6.00;
        if (record.check_in_time && record.check_out_time) {
          try {
            const checkIn = new Date(record.check_in_time).getTime();
            const checkOut = new Date(record.check_out_time).getTime();
            if (checkOut > checkIn) {
              hours_logged = parseFloat(((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2));
            }
          } catch (e) {
            // standard day fallback
          }
        }
      }

      const res = await executeQuery(`
        INSERT INTO trainee_attendance (
          beneficiary_id,
          attendance_date,
          check_in_time,
          check_out_time,
          attendance_source,
          status,
          captured_by,
          remarks,
          hours_logged,
          updated_at
        ) VALUES ($1, $2, $3, $4, COALESCE($5, 'MANUAL'), COALESCE($6, 'PRESENT'), $7, $8, $9, NOW())
        ON CONFLICT (beneficiary_id, attendance_date) DO UPDATE SET
          check_in_time = EXCLUDED.check_in_time,
          check_out_time = EXCLUDED.check_out_time,
          attendance_source = EXCLUDED.attendance_source,
          status = EXCLUDED.status,
          captured_by = EXCLUDED.captured_by,
          remarks = EXCLUDED.remarks,
          hours_logged = EXCLUDED.hours_logged,
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
        record.remarks || null,
        hours_logged
      ]);
      return res.rows[0];
    } catch (e) {
      console.error("[DB Repo] saveTraineeAttendance error:", e);
      return null;
    }
  }

  static async getAttendanceStats(dateStr?: string, options?: { tenantId?: string, stateId?: string, tspId?: string }): Promise<any> {
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
      let activeQuery = `SELECT COUNT(*) as count FROM beneficiaries WHERE status IN ('ADMITTED', 'ACTIVE', 'ELIGIBLE', 'CERTIFIED', 'ALUMNI') AND deleted_at IS NULL`;
      const activeParams: any[] = [];
      let activeIndex = 1;

      if (options?.tenantId) {
        activeQuery += ` AND tenant_id = $${activeIndex++}`;
        activeParams.push(options.tenantId);
      }
      if (options?.stateId) {
        activeQuery += ` AND state_id = $${activeIndex++}`;
        activeParams.push(options.stateId);
      }
      if (options?.tspId) {
        activeQuery += ` AND tsp_id = $${activeIndex++}`;
        activeParams.push(options.tspId);
      }

      const activeTraineesRes = await executeQuery(activeQuery, activeParams);
      const totalTrainees = parseInt(activeTraineesRes.rows[0].count, 10);

      let statsQuery = `
        SELECT ta.status, COUNT(*) as count
        FROM trainee_attendance ta
        JOIN beneficiaries b ON ta.beneficiary_id = b.id
        WHERE ta.attendance_date = $1 AND b.deleted_at IS NULL
      `;
      const statsParams: any[] = [targetDate];
      let statsIndex = 2;

      if (options?.tenantId) {
        statsQuery += ` AND b.tenant_id = $${statsIndex++}`;
        statsParams.push(options.tenantId);
      }
      if (options?.stateId) {
        statsQuery += ` AND b.state_id = $${statsIndex++}`;
        statsParams.push(options.stateId);
      }
      if (options?.tspId) {
        statsQuery += ` AND b.tsp_id = $${statsIndex++}`;
        statsParams.push(options.tspId);
      }

      statsQuery += ` GROUP BY ta.status`;

      const statsRes = await executeQuery(statsQuery, statsParams);

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

      let bioQuery = `
        SELECT COUNT(*) as count
        FROM trainee_attendance ta
        JOIN beneficiaries b ON ta.beneficiary_id = b.id
        WHERE ta.attendance_date = $1 AND ta.attendance_source = 'BIOMETRIC' AND b.deleted_at IS NULL
      `;
      const bioParams: any[] = [targetDate];
      let bioIndex = 2;

      if (options?.tenantId) {
        bioQuery += ` AND b.tenant_id = $${bioIndex++}`;
        bioParams.push(options.tenantId);
      }
      if (options?.stateId) {
        bioQuery += ` AND b.state_id = $${bioIndex++}`;
        bioParams.push(options.stateId);
      }
      if (options?.tspId) {
        bioQuery += ` AND b.tsp_id = $${bioIndex++}`;
        bioParams.push(options.tspId);
      }

      const bioRes = await executeQuery(bioQuery, bioParams);
      const biometricCount = parseInt(bioRes.rows[0].count, 10);

      // Fetch portal active count
      const portalRes = await executeQuery(`
        SELECT COUNT(*) as count FROM portal_monitoring WHERE still_on_portal = true
      `);
      const portalActive = parseInt(portalRes.rows[0].count, 10);

      // Fetch certification ready count
      const readyRes = await executeQuery(`
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
      const res = await executeQuery(`
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
      const countRes = await executeQuery(
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
      const res = await executeQuery(queryStr, fetchValues);

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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
        await executeQuery(
          "UPDATE email_templates SET is_default = FALSE WHERE template_type = $1 AND id <> $2",
          [t.templateType, t.id]
        );
      }
      await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery(
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
      const res = await executeQuery("UPDATE toolkit_assets SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1", [id]);
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
      const res = await executeQuery(`
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
          gt.latitude,
          gt.longitude,
          gt.location_accuracy AS "locationAccuracy",
          gt.business_name AS "businessName",
          gt.business_address AS "businessAddress",
          gt.workshop_type AS "workshopType",
          gt.phone AS "phone",
          gt.photo AS "photo",
          gt.workshop_verification_status AS "workshopVerificationStatus",
          gt.last_visit AS "lastVisit",
          gt.utilization_score AS "utilizationScore",
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
      const checkRes = await executeQuery(
        "SELECT id, beneficiary_id AS \"beneficiaryId\", asset_id AS \"assetId\" FROM graduate_toolkits WHERE beneficiary_id = $1 AND asset_id = $2",
        [beneficiaryId, assetId]
      );
      if (checkRes.rows.length > 0) {
        return checkRes.rows[0];
      }

      const res = await executeQuery(
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
      const res = await executeQuery(query, values);
      return res.rows[0];
    } catch (e) {
      console.error("[DB Repo] Failed to update graduate toolkit status in PG:", e);
      return fallbackUpdate();
    }
  }

  static async getProgramCosts(): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return loadJsonState().programCosts || [];
    }
    try {
      const res = await executeQuery(
        `SELECT id, cost_category AS "costCategory", amount, description, 
                training_track AS "trainingTrack", cohort, batch, recorded_by AS "recordedBy", 
                created_at AS "createdAt", updated_at AS "updatedAt" 
         FROM program_costs 
         ORDER BY created_at DESC`
      );
      return res.rows.map(r => ({
        ...r,
        amount: parseFloat(r.amount || 0)
      }));
    } catch (e) {
      console.error("[DB Repo] Failed to load program costs from PG:", e);
      return loadJsonState().programCosts || [];
    }
  }

  static async saveProgramCost(cost: any): Promise<any> {
    const pool = getPgPool();
    const fallbackSave = () => {
      const state = loadJsonState();
      if (!state.programCosts) state.programCosts = [];
      const index = state.programCosts.findIndex((item: any) => item.id === cost.id);
      const now = new Date().toISOString();
      const newCost = {
        ...cost,
        amount: parseFloat(cost.amount || 0),
        id: cost.id || `cost-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: cost.createdAt || now,
        updatedAt: now
      };
      if (index !== -1) {
        state.programCosts[index] = newCost;
      } else {
        state.programCosts.push(newCost);
      }
      saveJsonState(state);
      return newCost;
    };

    if (!pool || !isPgActive) {
      return fallbackSave();
    }

    try {
      const id = cost.id || "gen_random_uuid()";
      const isNew = !cost.id;
      const { costCategory, amount, description, trainingTrack, cohort, batch, recordedBy } = cost;
      
      let res;
      if (!isNew) {
        const checkRes = await executeQuery("SELECT id FROM program_costs WHERE id = $1", [id]);
        if (checkRes.rows.length > 0) {
          res = await executeQuery(
            `UPDATE program_costs 
             SET cost_category = $2, amount = $3, description = $4, training_track = $5, cohort = $6, batch = $7, recorded_by = $8, updated_at = NOW() 
             WHERE id = $1 
             RETURNING id, cost_category AS "costCategory", amount, description, training_track AS "trainingTrack", cohort, batch, recorded_by AS "recordedBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
            [id, costCategory, amount, description, trainingTrack, cohort, batch, recordedBy]
          );
          return {
            ...res.rows[0],
            amount: parseFloat(res.rows[0].amount || 0)
          };
        }
      }
      
      const insertId = isNew ? require("crypto").randomUUID() : id;
      res = await executeQuery(
        `INSERT INTO program_costs (
          id, cost_category, amount, description, training_track, cohort, batch, recorded_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, cost_category AS "costCategory", amount, description, training_track AS "trainingTrack", cohort, batch, recorded_by AS "recordedBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [insertId, costCategory, amount, description, trainingTrack, cohort, batch, recordedBy]
      );
      return {
        ...res.rows[0],
        amount: parseFloat(res.rows[0].amount || 0)
      };
    } catch (e) {
      console.error("[DB Repo] Failed to save program cost to PG:", e);
      return fallbackSave();
    }
  }

  // ==========================================================
  // BULK COMMUNICATION & CAMPAIGN ENGINE METHODS
  // ==========================================================

  static async getCommunicationTemplates(): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return [];
    try {
      const res = await executeQuery(
        `SELECT id, name, subject, html_body as "htmlBody", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
         FROM communication_templates
         ORDER BY name ASC`
      );
      return res.rows.map(r => ({ ...r, isActive: !!r.isActive }));
    } catch (e) {
      console.error("[DbRepo] Failed to get communication templates:", e);
      return [];
    }
  }

  static async saveCommunicationTemplate(tpl: any): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return tpl;
    const isNew = !tpl.id;
    const id = tpl.id || require("crypto").randomUUID();
    try {
      if (!isNew) {
        await executeQuery(
          `UPDATE communication_templates
           SET name = $2, subject = $3, html_body = $4, is_active = $5, updated_at = NOW()
           WHERE id = $1`,
          [id, tpl.name, tpl.subject, tpl.htmlBody, tpl.isActive !== false]
        );
      } else {
        await executeQuery(
          `INSERT INTO communication_templates (id, name, subject, html_body, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [id, tpl.name, tpl.subject, tpl.htmlBody, tpl.isActive !== false]
        );
      }
      return { ...tpl, id };
    } catch (e) {
      console.error("[DbRepo] Failed to save communication template:", e);
      return tpl;
    }
  }

  static async getCommunicationCampaigns(): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return [];
    try {
      const res = await executeQuery(
        `SELECT id, campaign_name as "campaignName", campaign_type as "campaignType", status, created_by as "createdBy",
                total_recipients as "totalRecipients", success_count as "successCount", failed_count as "failedCount",
                audience_filter as "audienceFilter", started_at as "startedAt", completed_at as "completedAt",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM communication_campaigns
         ORDER BY created_at DESC`
      );
      return res.rows;
    } catch (e) {
      console.error("[DbRepo] Failed to get communication campaigns:", e);
      return [];
    }
  }

  static async getCommunicationCampaignById(id: string): Promise<any | null> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      const res = await executeQuery(
        `SELECT id, campaign_name as "campaignName", campaign_type as "campaignType", status, created_by as "createdBy",
                total_recipients as "totalRecipients", success_count as "successCount", failed_count as "failedCount",
                audience_filter as "audienceFilter", started_at as "startedAt", completed_at as "completedAt",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM communication_campaigns
         WHERE id = $1`,
        [id]
      );
      return res.rows[0] || null;
    } catch (e) {
      console.error("[DbRepo] Failed to get communication campaign by ID:", e);
      return null;
    }
  }

  static async saveCommunicationCampaign(camp: any): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return camp;
    const id = camp.id || require("crypto").randomUUID();
    const isNew = !camp.id;
    try {
      if (!isNew) {
        await executeQuery(
          `UPDATE communication_campaigns
           SET campaign_name = $2, campaign_type = $3, status = $4, total_recipients = $5,
               success_count = $6, failed_count = $7, audience_filter = $8,
               started_at = $9, completed_at = $10, updated_at = NOW()
           WHERE id = $1`,
          [
            id,
            camp.campaignName,
            camp.campaignType,
            camp.status,
            camp.totalRecipients || 0,
            camp.successCount || 0,
            camp.failedCount || 0,
            camp.audienceFilter ? JSON.stringify(camp.audienceFilter) : null,
            camp.startedAt || null,
            camp.completedAt || null,
          ]
        );
      } else {
        await executeQuery(
          `INSERT INTO communication_campaigns (
            id, campaign_name, campaign_type, status, created_by, total_recipients,
            success_count, failed_count, audience_filter, started_at, completed_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
          [
            id,
            camp.campaignName,
            camp.campaignType,
            camp.status,
            camp.createdBy,
            camp.totalRecipients || 0,
            camp.successCount || 0,
            camp.failedCount || 0,
            camp.audienceFilter ? JSON.stringify(camp.audienceFilter) : null,
            camp.startedAt || null,
            camp.completedAt || null,
          ]
        );
      }
      return { ...camp, id };
    } catch (e) {
      console.error("[DbRepo] Failed to save communication campaign:", e);
      return camp;
    }
  }

  static async updateCampaignCounts(id: string, success: number, failed: number, status: string, completed: boolean = false): Promise<void> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return;
    try {
      if (completed) {
        await executeQuery(
          `UPDATE communication_campaigns
           SET success_count = $2, failed_count = $3, status = $4, completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [id, success, failed, status]
        );
      } else {
        await executeQuery(
          `UPDATE communication_campaigns
           SET success_count = $2, failed_count = $3, status = $4, updated_at = NOW()
           WHERE id = $1`,
          [id, success, failed, status]
        );
      }
    } catch (e) {
      console.error("[DbRepo] Failed to update campaign counts:", e);
    }
  }

  static async addCommunicationRecipients(recipients: any[]): Promise<void> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return;
    try {
      for (const r of recipients) {
        const id = r.id || require("crypto").randomUUID();
        await executeQuery(
          `INSERT INTO communication_recipients (id, campaign_id, beneficiary_id, email, status, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [id, r.campaignId, r.beneficiaryId || null, r.email, r.status || "PENDING"]
        );
      }
    } catch (e) {
      console.error("[DbRepo] Failed to add communication recipients:", e);
    }
  }

  static async getCommunicationRecipients(campaignId: string): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return [];
    try {
      const res = await executeQuery(
        `SELECT cr.id, cr.campaign_id as "campaignId", cr.beneficiary_id as "beneficiaryId",
                cr.email, cr.status, cr.error_message as "errorMessage", cr.sent_at as "sentAt",
                b.first_name as "firstName", b.last_name as "lastName"
         FROM communication_recipients cr
         LEFT JOIN beneficiaries b ON cr.beneficiary_id = b.id
         WHERE cr.campaign_id = $1
         ORDER BY cr.created_at ASC`,
        [campaignId]
      );
      return res.rows;
    } catch (e) {
      console.error("[DbRepo] Failed to get communication recipients:", e);
      return [];
    }
  }

  static async updateRecipientStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return;
    try {
      if (status === "SENT") {
        await executeQuery(
          `UPDATE communication_recipients
           SET status = $2, sent_at = NOW()
           WHERE id = $1`,
          [id, status]
        );
      } else {
        await executeQuery(
          `UPDATE communication_recipients
           SET status = $2, error_message = $3, sent_at = NOW()
           WHERE id = $1`,
          [id, status, errorMessage || null]
        );
      }
    } catch (e) {
      console.error("[DbRepo] Failed to update recipient status:", e);
    }
  }

  // --- COHORTS METHODS ---
  static async getCohorts(options?: {
    tenantId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: any[]; totalCount: number; page: number; pageSize: number; totalPages: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const pool = getPgPool();

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      let list = (state as any).cohorts || [];
      if (options?.tenantId) {
        list = list.filter((c: any) => c.tenantId === options.tenantId);
      }
      if (options?.search) {
        const s = options.search.toLowerCase();
        list = list.filter((c: any) => c.name?.toLowerCase().includes(s));
      }
      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const rows = list.slice(offset, offset + pageSize);
      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      const params: any[] = [];
      let whereClause = "WHERE deleted_at IS NULL";

      if (options?.tenantId) {
        params.push(options.tenantId);
        whereClause += ` AND tenant_id = $${params.length}`;
      }
      if (options?.search) {
        params.push(`%${options.search}%`);
        whereClause += ` AND name ILIKE $${params.length}`;
      }

      const countRes = await executeQuery(`SELECT COUNT(*)::int as count FROM cohorts ${whereClause}`, params);
      const totalCount = countRes.rows[0]?.count || 0;

      const rowsParams = [...params];
      rowsParams.push(pageSize, offset);
      const rowsRes = await executeQuery(
        `SELECT id, tenant_id as "tenantId", name, cohort_year as "cohortYear", 
                start_date as "startDate", end_date as "endDate", status, 
                created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
         FROM cohorts 
         ${whereClause} 
         ORDER BY cohort_year DESC, created_at DESC 
         LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
        rowsParams
      );

      const totalPages = Math.ceil(totalCount / pageSize);
      return { rows: rowsRes.rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DbRepo] Failed to get cohorts:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  static async saveCohort(cohort: any): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).cohorts) (state as any).cohorts = [];
      const newCohort = {
        id: cohort.id || require("crypto").randomUUID(),
        tenantId: cohort.tenantId || null,
        name: cohort.name,
        cohortYear: parseInt(cohort.cohortYear || cohort.cohort_year || new Date().getFullYear()),
        startDate: cohort.startDate || cohort.start_date || null,
        endDate: cohort.endDate || cohort.end_date || null,
        status: cohort.status || "ACTIVE",
        createdBy: cohort.createdBy || cohort.created_by || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      (state as any).cohorts.push(newCohort);
      saveJsonState(state);
      return newCohort;
    }

    try {
      const id = cohort.id || require("crypto").randomUUID();
      const tenantId = cohort.tenantId || cohort.tenant_id || null;
      const name = cohort.name;
      const cohortYear = parseInt(cohort.cohortYear || cohort.cohort_year || new Date().getFullYear());
      const startDate = cohort.startDate || cohort.start_date || null;
      const endDate = cohort.endDate || cohort.end_date || null;
      const status = cohort.status || "ACTIVE";
      const createdBy = cohort.createdBy || cohort.created_by || null;

      const res = await executeQuery(
        `INSERT INTO cohorts (id, tenant_id, name, cohort_year, start_date, end_date, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id, tenant_id as "tenantId", name, cohort_year as "cohortYear", start_date as "startDate", end_date as "endDate", status, created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`,
        [id, tenantId, name, cohortYear, startDate, endDate, status, createdBy]
      );

      const saved = res.rows[0];
      await DbRepo.saveAuditLog(createdBy || "system", "CREATE_COHORT", `Created cohort ${name} (ID: ${id})`);
      return saved;
    } catch (e) {
      console.error("[DbRepo] Failed to save cohort:", e);
      throw e;
    }
  }

  static async updateCohort(id: string, cohort: any): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).cohorts) (state as any).cohorts = [];
      const index = (state as any).cohorts.findIndex((c: any) => c.id === id);
      if (index === -1) throw new Error("Cohort not found");
      const updated = {
        ...(state as any).cohorts[index],
        name: cohort.name !== undefined ? cohort.name : (state as any).cohorts[index].name,
        cohortYear: cohort.cohortYear !== undefined ? parseInt(cohort.cohortYear) : (state as any).cohorts[index].cohortYear,
        startDate: cohort.startDate !== undefined ? cohort.startDate : (state as any).cohorts[index].startDate,
        endDate: cohort.endDate !== undefined ? cohort.endDate : (state as any).cohorts[index].endDate,
        status: cohort.status !== undefined ? cohort.status : (state as any).cohorts[index].status,
        updatedAt: new Date().toISOString()
      };
      (state as any).cohorts[index] = updated;
      saveJsonState(state);
      return updated;
    }

    try {
      const name = cohort.name;
      const cohortYear = cohort.cohortYear !== undefined ? parseInt(cohort.cohortYear) : undefined;
      const startDate = cohort.startDate;
      const endDate = cohort.endDate;
      const status = cohort.status;

      const updateFields: string[] = [];
      const params: any[] = [id];

      if (name !== undefined) {
        params.push(name);
        updateFields.push(`name = $${params.length}`);
      }
      if (cohortYear !== undefined) {
        params.push(cohortYear);
        updateFields.push(`cohort_year = $${params.length}`);
      }
      if (startDate !== undefined) {
        params.push(startDate);
        updateFields.push(`start_date = $${params.length}`);
      }
      if (endDate !== undefined) {
        params.push(endDate);
        updateFields.push(`end_date = $${params.length}`);
      }
      if (status !== undefined) {
        params.push(status);
        updateFields.push(`status = $${params.length}`);
      }

      if (updateFields.length === 0) {
        const getRes = await executeQuery(`SELECT id, tenant_id as "tenantId", name, cohort_year as "cohortYear", start_date as "startDate", end_date as "endDate", status FROM cohorts WHERE id = $1`, [id]);
        return getRes.rows[0];
      }

      updateFields.push(`updated_at = NOW()`);
      const query = `UPDATE cohorts SET ${updateFields.join(", ")} WHERE id = $1 RETURNING id, tenant_id as "tenantId", name, cohort_year as "cohortYear", start_date as "startDate", end_date as "endDate", status, created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`;
      const res = await executeQuery(query, params);

      const updated = res.rows[0];
      await DbRepo.saveAuditLog(cohort.updatedBy || cohort.created_by || "system", "UPDATE_COHORT", `Updated cohort ${updated?.name || id} (ID: ${id})`);
      return updated;
    } catch (e) {
      console.error("[DbRepo] Failed to update cohort:", e);
      throw e;
    }
  }

  static async deleteCohort(id: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).cohorts) return false;
      const index = (state as any).cohorts.findIndex((c: any) => c.id === id);
      if (index === -1) return false;
      (state as any).cohorts[index].deletedAt = new Date().toISOString();
      saveJsonState(state);
      return true;
    }

    try {
      await executeQuery(`UPDATE cohorts SET deleted_at = NOW(), status = 'DELETED' WHERE id = $1`, [id]);
      await DbRepo.saveAuditLog("system", "DELETE_COHORT", `Soft deleted cohort ID: ${id}`);
      return true;
    } catch (e) {
      console.error("[DbRepo] Failed to delete cohort:", e);
      return false;
    }
  }

  // --- TRAINING BATCHES METHODS ---
  static async getTrainingBatches(options?: {
    tenantId?: string;
    tspId?: string;
    cohortId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: any[]; totalCount: number; page: number; pageSize: number; totalPages: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const pool = getPgPool();

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      let list = (state as any).trainingBatches || [];
      if (options?.tenantId) {
        list = list.filter((b: any) => b.tenantId === options.tenantId);
      }
      if (options?.tspId) {
        list = list.filter((b: any) => b.tspId === options.tspId);
      }
      if (options?.cohortId) {
        list = list.filter((b: any) => b.cohortId === options.cohortId);
      }
      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const rows = list.slice(offset, offset + pageSize);
      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      const params: any[] = [];
      let whereClause = "WHERE tb.status != 'DELETED'";

      if (options?.tenantId) {
        params.push(options.tenantId);
        whereClause += ` AND tb.tenant_id = $${params.length}`;
      }
      if (options?.tspId) {
        params.push(options.tspId);
        whereClause += ` AND tb.tsp_id = $${params.length}`;
      }
      if (options?.cohortId) {
        params.push(options.cohortId);
        whereClause += ` AND tb.cohort_id = $${params.length}`;
      }

      const countRes = await executeQuery(`SELECT COUNT(*)::int as count FROM training_batches tb ${whereClause}`, params);
      const totalCount = countRes.rows[0]?.count || 0;

      const rowsParams = [...params];
      rowsParams.push(pageSize, offset);
      const rowsRes = await executeQuery(
        `SELECT tb.id, tb.tenant_id as "tenantId", tb.tsp_id as "tspId", tb.cohort_id as "cohortId", 
                tb.training_program_id as "trainingProgramId", tb.batch_number as "batchNumber", 
                tb.start_date as "startDate", tb.end_date as "endDate", tb.capacity, tb.status, 
                c.name as "cohortName", tp.name as "programName", tsp.name as "tspName"
         FROM training_batches tb
         LEFT JOIN cohorts c ON tb.cohort_id = c.id
         LEFT JOIN training_programs tp ON tb.training_program_id = tp.id
         LEFT JOIN tsps tsp ON tb.tsp_id = tsp.id
         ${whereClause} 
         ORDER BY tb.created_at DESC 
         LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
        rowsParams
      );

      const totalPages = Math.ceil(totalCount / pageSize);
      return { rows: rowsRes.rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DbRepo] Failed to get training batches:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  static async saveTrainingBatch(batch: any): Promise<any> {
    const pool = getPgPool();
    const tspId = batch.tspId || batch.tsp_id;
    const startDate = batch.startDate || batch.start_date;
    const endDate = batch.endDate || batch.end_date;
    const id = batch.id || null;

    if (pool && isPgActive) {
      let overlapCheck;
      if (id) {
        overlapCheck = await executeQuery(
          `SELECT id, batch_number FROM training_batches 
           WHERE tsp_id = $1 AND status = 'ACTIVE' AND id != $2 
             AND NOT (end_date < $3 OR start_date > $4)`,
          [tspId, id, startDate, endDate]
        );
      } else {
        overlapCheck = await executeQuery(
          `SELECT id, batch_number FROM training_batches 
           WHERE tsp_id = $1 AND status = 'ACTIVE'
             AND NOT (end_date < $2 OR start_date > $3)`,
          [tspId, startDate, endDate]
        );
      }

      if (overlapCheck.rows.length > 0) {
        throw new Error(`Schedule overlap error: Batch ${overlapCheck.rows[0].batch_number} is already scheduled within the same timeframe for this TSP.`);
      }
    }

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).trainingBatches) (state as any).trainingBatches = [];
      const newBatch = {
        id: batch.id || require("crypto").randomUUID(),
        tenantId: batch.tenantId || null,
        tspId: batch.tspId || null,
        cohortId: batch.cohortId || null,
        trainingProgramId: batch.trainingProgramId || null,
        batchNumber: batch.batchNumber,
        startDate: batch.startDate,
        endDate: batch.endDate,
        capacity: batch.capacity !== undefined ? parseInt(batch.capacity) : 30,
        status: batch.status || "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      (state as any).trainingBatches.push(newBatch);
      saveJsonState(state);
      return newBatch;
    }

    try {
      const insertId = batch.id || require("crypto").randomUUID();
      const tenantId = batch.tenantId || batch.tenant_id || null;
      const cohortId = batch.cohortId || batch.cohort_id || null;
      const trainingProgramId = batch.trainingProgramId || batch.training_program_id || null;
      const batchNumber = batch.batchNumber || batch.batch_number;
      const capacity = batch.capacity !== undefined ? parseInt(batch.capacity) : 30;
      const status = batch.status || "ACTIVE";
      const createdBy = batch.createdBy || batch.created_by || null;

      const res = await executeQuery(
        `INSERT INTO training_batches (id, tenant_id, tsp_id, cohort_id, training_program_id, batch_number, start_date, end_date, capacity, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id, tsp_id = EXCLUDED.tsp_id, cohort_id = EXCLUDED.cohort_id,
           training_program_id = EXCLUDED.training_program_id, batch_number = EXCLUDED.batch_number,
           start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, capacity = EXCLUDED.capacity,
           status = EXCLUDED.status, updated_at = NOW()
         RETURNING id, tenant_id as "tenantId", tsp_id as "tspId", cohort_id as "cohortId", training_program_id as "trainingProgramId", batch_number as "batchNumber", start_date as "startDate", end_date as "endDate", capacity, status, created_by as "createdBy"`,
        [insertId, tenantId, tspId, cohortId, trainingProgramId, batchNumber, startDate, endDate, capacity, status, createdBy]
      );

      const saved = res.rows[0];
      await DbRepo.saveAuditLog(createdBy || "system", "SAVE_BATCH", `Saved training batch ${batchNumber} (ID: ${insertId})`);
      return saved;
    } catch (e) {
      console.error("[DbRepo] Failed to save training batch:", e);
      throw e;
    }
  }

  static async assignTraineesToBatch(batchId: string, traineeIds: string[], assignedByUserId?: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if ((state as any).beneficiaries) {
        (state as any).beneficiaries.forEach((b: any) => {
          if (traineeIds.includes(b.id)) {
            b.training_batch_id = batchId;
          }
        });
        saveJsonState(state);
      }
      return true;
    }

    try {
      if (traineeIds.length === 0) return true;

      const batchRes = await executeQuery(`SELECT id, tenant_id, batch_number, capacity FROM training_batches WHERE id = $1`, [batchId]);
      if (batchRes.rows.length === 0) {
        throw new Error("Batch not found");
      }
      const batch = batchRes.rows[0];

      const currentRes = await executeQuery(`SELECT COUNT(*)::int as count FROM beneficiaries WHERE training_batch_id = $1 AND deleted_at IS NULL`, [batchId]);
      const currentAssigned = currentRes.rows[0]?.count || 0;
      if (currentAssigned + traineeIds.length > batch.capacity) {
        throw new Error(`Batch capacity exceeded: Batch ${batch.batch_number} has a maximum capacity of ${batch.capacity}. Currently assigned: ${currentAssigned}, attempting to add: ${traineeIds.length}.`);
      }

      // Populate assignment in the mapping table
      for (const tId of traineeIds) {
        await executeQuery(`
          INSERT INTO training_batch_assignments (id, tenant_id, batch_id, beneficiary_id, assigned_by, assigned_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
          ON CONFLICT (batch_id, beneficiary_id) DO NOTHING
        `, [batch.tenant_id, batchId, tId, assignedByUserId || null]);
      }

      await executeQuery(
        `UPDATE beneficiaries 
         SET training_batch_id = $1, batch = (SELECT 'Batch ' || batch_number FROM training_batches WHERE id = $1)
         WHERE id = ANY($2)`,
        [batchId, traineeIds]
      );

      await DbRepo.saveAuditLog(assignedByUserId || "system", "ASSIGN_TRAINEES", `Assigned ${traineeIds.length} trainees to batch ID: ${batchId}`);
      return true;
    } catch (e) {
      console.error("[DbRepo] Failed to assign trainees to batch:", e);
      throw e;
    }
  }

  static async removeTraineesFromBatch(batchId: string, traineeIds: string[], removedByUserId?: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return true;
    }

    try {
      if (traineeIds.length === 0) return true;

      await executeQuery(
        `DELETE FROM training_batch_assignments WHERE batch_id = $1 AND beneficiary_id = ANY($2)`,
        [batchId, traineeIds]
      );

      await executeQuery(
        `UPDATE beneficiaries 
         SET training_batch_id = NULL, batch = NULL
         WHERE id = ANY($1) AND training_batch_id = $2`,
        [traineeIds, batchId]
      );

      await DbRepo.saveAuditLog(removedByUserId || "system", "REMOVE_TRAINEES", `Removed ${traineeIds.length} trainees from batch ID: ${batchId}`);
      return true;
    } catch (e) {
      console.error("[DbRepo] Failed to remove trainees from batch:", e);
      throw e;
    }
  }

  static async deleteTrainingBatch(id: string): Promise<boolean> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return true;
    }
    const assignedRes = await executeQuery(`SELECT COUNT(*)::int as count FROM beneficiaries WHERE training_batch_id = $1 AND deleted_at IS NULL`, [id]);
    const tblAssignedRes = await executeQuery(`SELECT COUNT(*)::int as count FROM training_batch_assignments WHERE batch_id = $1`, [id]);
    if ((assignedRes.rows[0]?.count || 0) > 0 || (tblAssignedRes.rows[0]?.count || 0) > 0) {
      throw new Error(`Cannot delete batch: Active assignments exist for this batch.`);
    }

    try {
      await executeQuery(`UPDATE training_batches SET status = 'DELETED' WHERE id = $1`, [id]);
      await DbRepo.saveAuditLog("system", "DELETE_BATCH", `Deleted batch ID: ${id}`);
      return true;
    } catch (e) {
      console.error("[DbRepo] Failed to delete training batch:", e);
      throw e;
    }
  }

  // --- TRAINERS METHODS ---
  static async getTrainers(options?: {
    tenantId?: string;
    tspId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: any[]; totalCount: number; page: number; pageSize: number; totalPages: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const pool = getPgPool();

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      let list = (state as any).trainers || [];
      if (options?.tenantId) {
        list = list.filter((t: any) => t.tenantId === options.tenantId);
      }
      if (options?.tspId) {
        list = list.filter((t: any) => t.tspId === options.tspId);
      }
      if (options?.status) {
        list = list.filter((t: any) => t.status === options.status);
      }
      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const rows = list.slice(offset, offset + pageSize);
      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      const params: any[] = [];
      let whereClause = "WHERE status != 'DELETED'";

      if (options?.tenantId) {
        params.push(options.tenantId);
        whereClause += ` AND tenant_id = $${params.length}`;
      }
      if (options?.tspId) {
        params.push(options.tspId);
        whereClause += ` AND tsp_id = $${params.length}`;
      }
      if (options?.status) {
        params.push(options.status);
        whereClause += ` AND status = $${params.length}`;
      }

      const countRes = await executeQuery(`SELECT COUNT(*)::int as count FROM trainers ${whereClause}`, params);
      const totalCount = countRes.rows[0]?.count || 0;

      const rowsParams = [...params];
      rowsParams.push(pageSize, offset);
      const rowsRes = await executeQuery(
        `SELECT id, tenant_id as "tenantId", tsp_id as "tspId", first_name as "firstName", 
                last_name as "lastName", email, phone, accreditation_details as "accreditationDetails", 
                is_nbte_certified as "isNbteCertified", status, created_by as "createdBy", 
                created_at as "createdAt", updated_at as "updatedAt"
         FROM trainers 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
        rowsParams
      );

      const totalPages = Math.ceil(totalCount / pageSize);
      return { rows: rowsRes.rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DbRepo] Failed to get trainers:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  static async saveTrainer(trainer: any): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).trainers) (state as any).trainers = [];
      const newTrainer = {
        id: trainer.id || require("crypto").randomUUID(),
        tenantId: trainer.tenantId || null,
        tspId: trainer.tspId || null,
        firstName: trainer.firstName,
        lastName: trainer.lastName,
        email: trainer.email || null,
        phone: trainer.phone || null,
        accreditationDetails: trainer.accreditationDetails || null,
        isNbteCertified: !!trainer.isNbteCertified,
        status: trainer.status || "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      (state as any).trainers.push(newTrainer);
      saveJsonState(state);
      return newTrainer;
    }

    try {
      const id = trainer.id || require("crypto").randomUUID();
      const tenantId = trainer.tenantId || trainer.tenant_id || null;
      const tspId = trainer.tspId || trainer.tsp_id || null;
      const firstName = trainer.firstName || trainer.first_name;
      const lastName = trainer.lastName || trainer.last_name;
      const email = trainer.email || null;
      const phone = trainer.phone || null;
      const accreditationDetails = trainer.accreditationDetails || trainer.accreditation_details || null;
      const isNbteCertified = !!(trainer.isNbteCertified || trainer.is_nbte_certified);
      const status = trainer.status || "ACTIVE";
      const createdBy = trainer.createdBy || trainer.created_by || null;

      const res = await executeQuery(
        `INSERT INTO trainers (id, tenant_id, tsp_id, first_name, last_name, email, phone, accreditation_details, is_nbte_certified, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING id, tenant_id as "tenantId", tsp_id as "tspId", first_name as "firstName", last_name as "lastName", email, phone, accreditation_details as "accreditationDetails", is_nbte_certified as "isNbteCertified", status, created_by as "createdBy"`,
        [id, tenantId, tspId, firstName, lastName, email, phone, accreditationDetails, isNbteCertified, status, createdBy]
      );

      const saved = res.rows[0];
      await DbRepo.saveAuditLog(createdBy || "system", "CREATE_TRAINER", `Created trainer ${firstName} ${lastName}`);
      return saved;
    } catch (e) {
      console.error("[DbRepo] Failed to save trainer:", e);
      throw e;
    }
  }

  static async updateTrainer(id: string, trainer: any): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).trainers) (state as any).trainers = [];
      const index = (state as any).trainers.findIndex((t: any) => t.id === id);
      if (index === -1) throw new Error("Trainer not found");
      const updated = {
        ...(state as any).trainers[index],
        firstName: trainer.firstName !== undefined ? trainer.firstName : (state as any).trainers[index].firstName,
        lastName: trainer.lastName !== undefined ? trainer.lastName : (state as any).trainers[index].lastName,
        email: trainer.email !== undefined ? trainer.email : (state as any).trainers[index].email,
        phone: trainer.phone !== undefined ? trainer.phone : (state as any).trainers[index].phone,
        accreditationDetails: trainer.accreditationDetails !== undefined ? trainer.accreditationDetails : (state as any).trainers[index].accreditationDetails,
        isNbteCertified: trainer.isNbteCertified !== undefined ? !!trainer.isNbteCertified : (state as any).trainers[index].isNbteCertified,
        status: trainer.status !== undefined ? trainer.status : (state as any).trainers[index].status,
        updatedAt: new Date().toISOString()
      };
      (state as any).trainers[index] = updated;
      saveJsonState(state);
      return updated;
    }

    try {
      const firstName = trainer.firstName !== undefined ? trainer.firstName : trainer.first_name;
      const lastName = trainer.lastName !== undefined ? trainer.lastName : trainer.last_name;
      const email = trainer.email;
      const phone = trainer.phone;
      const accreditationDetails = trainer.accreditationDetails !== undefined ? trainer.accreditationDetails : trainer.accreditation_details;
      const isNbteCertified = trainer.isNbteCertified !== undefined ? !!trainer.isNbteCertified : (trainer.is_nbte_certified !== undefined ? !!trainer.is_nbte_certified : undefined);
      const status = trainer.status;

      const updateFields: string[] = [];
      const params: any[] = [id];

      if (firstName !== undefined) {
        params.push(firstName);
        updateFields.push(`first_name = $${params.length}`);
      }
      if (lastName !== undefined) {
        params.push(lastName);
        updateFields.push(`last_name = $${params.length}`);
      }
      if (email !== undefined) {
        params.push(email);
        updateFields.push(`email = $${params.length}`);
      }
      if (phone !== undefined) {
        params.push(phone);
        updateFields.push(`phone = $${params.length}`);
      }
      if (accreditationDetails !== undefined) {
        params.push(accreditationDetails);
        updateFields.push(`accreditation_details = $${params.length}`);
      }
      if (isNbteCertified !== undefined) {
        params.push(isNbteCertified);
        updateFields.push(`is_nbte_certified = $${params.length}`);
      }
      if (status !== undefined) {
        params.push(status);
        updateFields.push(`status = $${params.length}`);
      }

      if (updateFields.length === 0) {
        const getRes = await executeQuery(`SELECT id, first_name as "firstName", last_name as "lastName" FROM trainers WHERE id = $1`, [id]);
        return getRes.rows[0];
      }

      updateFields.push(`updated_at = NOW()`);
      const query = `UPDATE trainers SET ${updateFields.join(", ")} WHERE id = $1 RETURNING id, tenant_id as "tenantId", tsp_id as "tspId", first_name as "firstName", last_name as "lastName", email, phone, accreditation_details as "accreditationDetails", is_nbte_certified as "isNbteCertified", status`;
      const res = await executeQuery(query, params);
      const updated = res.rows[0];
      await DbRepo.saveAuditLog("system", "UPDATE_TRAINER", `Updated trainer ${firstName} ${lastName} (ID: ${id})`);
      return updated;
    } catch (e) {
      console.error("[DbRepo] Failed to update trainer:", e);
      throw e;
    }
  }

  // --- ASSESSMENTS METHODS ---
  static calculateFinalScoreAndGrade(ca: number, practical: number, exam: number): { finalScore: number; finalGrade: string } {
    if (ca < 0 || ca > 100 || practical < 0 || practical > 100 || exam < 0 || exam > 100) {
      throw new Error("Validation error: Scores must be between 0 and 100.");
    }
    const finalScore = (ca * 0.3) + (practical * 0.4) + (exam * 0.3);
    let finalGrade = "F";
    if (finalScore >= 70) finalGrade = "A";
    else if (finalScore >= 60) finalGrade = "B";
    else if (finalScore >= 50) finalGrade = "C";
    else if (finalScore >= 45) finalGrade = "D";

    return { finalScore: parseFloat(finalScore.toFixed(2)), finalGrade };
  }

  static async getAssessments(options?: {
    tenantId?: string;
    beneficiaryId?: string;
    trainerId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: any[]; totalCount: number; page: number; pageSize: number; totalPages: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const pool = getPgPool();

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      let list = (state as any).assessments || [];
      if (options?.tenantId) {
        list = list.filter((a: any) => a.tenantId === options.tenantId);
      }
      if (options?.beneficiaryId) {
        list = list.filter((b: any) => b.beneficiaryId === options.beneficiaryId);
      }
      if (options?.trainerId) {
        list = list.filter((a: any) => a.trainerId === options.trainerId);
      }
      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const rows = list.slice(offset, offset + pageSize);
      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      const params: any[] = [];
      let whereClause = "WHERE 1=1";

      if (options?.tenantId) {
        params.push(options.tenantId);
        whereClause += ` AND a.tenant_id = $${params.length}`;
      }
      if (options?.beneficiaryId) {
        params.push(options.beneficiaryId);
        whereClause += ` AND a.beneficiary_id = $${params.length}`;
      }
      if (options?.trainerId) {
        params.push(options.trainerId);
        whereClause += ` AND a.trainer_id = $${params.length}`;
      }

      const countRes = await executeQuery(`SELECT COUNT(*)::int as count FROM assessments a ${whereClause}`, params);
      const totalCount = countRes.rows[0]?.count || 0;

      const rowsParams = [...params];
      rowsParams.push(pageSize, offset);
      const rowsRes = await executeQuery(
        `SELECT a.id, a.tenant_id as "tenantId", a.beneficiary_id as "beneficiaryId", a.trainer_id as "trainerId", 
                a.assessment_name as "assessmentName", a.continuous_assessment_score as "continuousAssessmentScore", 
                a.practical_score as "practicalScore", a.exam_score as "examScore", a.final_score as "finalScore", 
                a.final_grade as "finalGrade", a.examiner_comments as "examinerComments", a.exam_date as "examDate", 
                a.status, a.created_at as "createdAt",
                b.first_name as "beneficiaryFirstName", b.last_name as "beneficiaryLastName",
                t.first_name as "trainerFirstName", t.last_name as "trainerLastName"
         FROM assessments a
         LEFT JOIN beneficiaries b ON a.beneficiary_id = b.id
         LEFT JOIN trainers t ON a.trainer_id = t.id
         ${whereClause} 
         ORDER BY a.created_at DESC 
         LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
        rowsParams
      );

      const totalPages = Math.ceil(totalCount / pageSize);
      return { rows: rowsRes.rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DbRepo] Failed to get assessments:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  static async saveAssessment(assessment: any): Promise<any> {
    const ca = parseFloat(assessment.continuousAssessmentScore || assessment.continuous_assessment_score || 0);
    const practical = parseFloat(assessment.practicalScore || assessment.practical_score || 0);
    const exam = parseFloat(assessment.examScore || assessment.exam_score || 0);

    const { finalScore, finalGrade } = DbRepo.calculateFinalScoreAndGrade(ca, practical, exam);

    const pool = getPgPool();
    if (!pool || !isPgActive) {
      const state = loadJsonState();
      if (!(state as any).assessments) (state as any).assessments = [];
      const newAss = {
        id: assessment.id || require("crypto").randomUUID(),
        tenantId: assessment.tenantId || null,
        beneficiaryId: assessment.beneficiaryId || null,
        trainerId: assessment.trainerId || null,
        assessmentName: assessment.assessmentName || "",
        continuousAssessmentScore: ca,
        practicalScore: practical,
        examScore: exam,
        finalScore,
        finalGrade,
        examinerComments: assessment.examinerComments || null,
        examDate: assessment.examDate || null,
        status: assessment.status || "PENDING",
        createdAt: new Date().toISOString()
      };
      (state as any).assessments.push(newAss);
      saveJsonState(state);
      return newAss;
    }

    try {
      const id = assessment.id || require("crypto").randomUUID();
      const tenantId = assessment.tenantId || assessment.tenant_id || null;
      const beneficiaryId = assessment.beneficiaryId || assessment.beneficiary_id || null;
      const trainerId = assessment.trainerId || assessment.trainer_id || null;
      const assessmentName = assessment.assessmentName || assessment.assessment_name || "";
      const examinerComments = assessment.examinerComments || assessment.examiner_comments || null;
      const examDate = assessment.examDate || assessment.exam_date || null;
      const status = assessment.status || "PENDING";

      const res = await executeQuery(
        `INSERT INTO assessments (id, tenant_id, beneficiary_id, trainer_id, assessment_name, continuous_assessment_score, practical_score, exam_score, final_score, final_grade, examiner_comments, exam_date, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         RETURNING id, tenant_id as "tenantId", beneficiary_id as "beneficiaryId", trainer_id as "trainerId", assessment_name as "assessmentName", continuous_assessment_score as "continuousAssessmentScore", practical_score as "practicalScore", exam_score as "examScore", final_score as "finalScore", final_grade as "finalGrade", examiner_comments as "examinerComments", exam_date as "examDate", status`,
        [id, tenantId, beneficiaryId, trainerId, assessmentName, ca, practical, exam, finalScore, finalGrade, examinerComments, examDate, status]
      );
      const saved = res.rows[0];
      await DbRepo.saveAuditLog("system", "CREATE_ASSESSMENT", `Created assessment record for beneficiary ID: ${beneficiaryId}`);
      return saved;
    } catch (e) {
      console.error("[DbRepo] Failed to save assessment:", e);
      throw e;
    }
  }

  static async updateAssessment(id: string, assessment: any): Promise<any> {
    const pool = getPgPool();
    let original: any;
    if (pool && isPgActive) {
      const origRes = await executeQuery(`SELECT * FROM assessments WHERE id = $1`, [id]);
      if (origRes.rows.length === 0) throw new Error("Assessment not found");
      original = origRes.rows[0];
    } else {
      const state = loadJsonState();
      original = ((state as any).assessments || []).find((a: any) => a.id === id);
      if (!original) throw new Error("Assessment not found");
    }

    const ca = assessment.continuousAssessmentScore !== undefined ? parseFloat(assessment.continuousAssessmentScore) : parseFloat(original.continuous_assessment_score || original.continuousAssessmentScore || 0);
    const practical = assessment.practicalScore !== undefined ? parseFloat(assessment.practicalScore) : parseFloat(original.practical_score || original.practicalScore || 0);
    const exam = assessment.examScore !== undefined ? parseFloat(assessment.examScore) : parseFloat(original.exam_score || original.examScore || 0);

    const { finalScore, finalGrade } = DbRepo.calculateFinalScoreAndGrade(ca, practical, exam);

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      const index = (state as any).assessments.findIndex((a: any) => a.id === id);
      const updated = {
        ...(state as any).assessments[index],
        assessmentName: assessment.assessmentName !== undefined ? assessment.assessmentName : original.assessmentName,
        continuousAssessmentScore: ca,
        practicalScore: practical,
        examScore: exam,
        finalScore,
        finalGrade,
        examinerComments: assessment.examinerComments !== undefined ? assessment.examinerComments : original.examinerComments,
        examDate: assessment.examDate !== undefined ? assessment.examDate : original.examDate,
        status: assessment.status !== undefined ? assessment.status : original.status
      };
      (state as any).assessments[index] = updated;
      saveJsonState(state);
      return updated;
    }

    try {
      const assessmentName = assessment.assessmentName !== undefined ? assessment.assessmentName : assessment.assessment_name;
      const examinerComments = assessment.examinerComments !== undefined ? assessment.examinerComments : assessment.examiner_comments;
      const examDate = assessment.examDate !== undefined ? assessment.examDate : assessment.exam_date;
      const status = assessment.status;

      const updateFields: string[] = [];
      const params: any[] = [id];

      params.push(ca, practical, exam, finalScore, finalGrade);
      updateFields.push(`continuous_assessment_score = $2`, `practical_score = $3`, `exam_score = $4`, `final_score = $5`, `final_grade = $6`);

      if (assessmentName !== undefined) {
        params.push(assessmentName);
        updateFields.push(`assessment_name = $${params.length}`);
      }
      if (examinerComments !== undefined) {
        params.push(examinerComments);
        updateFields.push(`examiner_comments = $${params.length}`);
      }
      if (examDate !== undefined) {
        params.push(examDate);
        updateFields.push(`exam_date = $${params.length}`);
      }
      if (status !== undefined) {
        params.push(status);
        updateFields.push(`status = $${params.length}`);
      }

      const query = `UPDATE assessments SET ${updateFields.join(", ")} WHERE id = $1 RETURNING id, tenant_id as "tenantId", beneficiary_id as "beneficiaryId", trainer_id as "trainerId", assessment_name as "assessmentName", continuous_assessment_score as "continuousAssessmentScore", practical_score as "practicalScore", exam_score as "examScore", final_score as "finalScore", final_grade as "finalGrade", examiner_comments as "examinerComments", exam_date as "examDate", status`;
      const res = await executeQuery(query, params);
      const updated = res.rows[0];
      await DbRepo.saveAuditLog("system", "UPDATE_ASSESSMENT", `Updated assessment ID: ${id}`);
      return updated;
    } catch (e) {
      console.error("[DbRepo] Failed to update assessment:", e);
      throw e;
    }
  }

  // --- GRADUATION METHODS ---
  static async getGraduationClearances(options?: {
    tenantId?: string;
    beneficiaryId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: any[]; totalCount: number; page: number; pageSize: number; totalPages: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const pool = getPgPool();

    if (!pool || !isPgActive) {
      const state = loadJsonState();
      let list = (state as any).graduationClearances || [];
      if (options?.tenantId) {
        list = list.filter((g: any) => g.tenantId === options.tenantId);
      }
      if (options?.beneficiaryId) {
        list = list.filter((g: any) => g.beneficiaryId === options.beneficiaryId);
      }
      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const rows = list.slice(offset, offset + pageSize);
      return { rows, totalCount, page, pageSize, totalPages };
    }

    try {
      const params: any[] = [];
      let whereClause = "WHERE 1=1";

      if (options?.tenantId) {
        params.push(options.tenantId);
        whereClause += ` AND gc.tenant_id = $${params.length}`;
      }
      if (options?.beneficiaryId) {
        params.push(options.beneficiaryId);
        whereClause += ` AND gc.beneficiary_id = $${params.length}`;
      }

      const countRes = await executeQuery(`SELECT COUNT(*)::int as count FROM graduation_clearances gc ${whereClause}`, params);
      const totalCount = countRes.rows[0]?.count || 0;

      const rowsParams = [...params];
      rowsParams.push(pageSize, offset);
      const rowsRes = await executeQuery(
        `SELECT gc.id, gc.tenant_id as "tenantId", gc.beneficiary_id as "beneficiaryId", 
                gc.is_cleared_attendance as "isClearedAttendance", gc.is_cleared_assessment as "isClearedAssessment", 
                gc.is_cleared_toolkit as "isClearedToolkit", gc.cleared_by as "clearedBy", gc.cleared_at as "clearedAt", 
                gc.ceremony_event_name as "ceremonyEventName", gc.created_at as "createdAt",
                b.first_name as "beneficiaryFirstName", b.last_name as "beneficiaryLastName", b.state as "beneficiaryState", b.tsp as "beneficiaryTsp"
         FROM graduation_clearances gc
         LEFT JOIN beneficiaries b ON gc.beneficiary_id = b.id
         ${whereClause} 
         ORDER BY gc.created_at DESC 
         LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
        rowsParams
      );

      const totalPages = Math.ceil(totalCount / pageSize);
      return { rows: rowsRes.rows, totalCount, page, pageSize, totalPages };
    } catch (e) {
      console.error("[DbRepo] Failed to get graduation clearances:", e);
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  static async evaluateAndClearTrainee(beneficiaryId: string, clearedBy: string, ceremonyEventName?: string, tenantId?: string): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return { beneficiaryId, success: true };
    }

    const attendanceRes = await executeQuery(
      `SELECT COUNT(*)::int as total, SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END)::int as present FROM trainee_attendance WHERE beneficiary_id = $1`,
      [beneficiaryId]
    );
    const attTotal = attendanceRes.rows[0]?.total || 0;
    const attPresent = attendanceRes.rows[0]?.present || 0;
    const attRate = attTotal > 0 ? (attPresent / attTotal) : 0;
    const attendanceSatisfied = attTotal > 0 && attRate >= 0.80;

    if (!attendanceSatisfied) {
      throw new Error(`Graduation clearance blocked: Candidate does not satisfy the training attendance requirement (Attendance rate: ${Math.round(attRate * 100)}%, minimum required: 80%).`);
    }

    const assessmentRes = await executeQuery(
      `SELECT COUNT(*)::int as count, MAX(final_score)::numeric as max_score FROM assessments WHERE beneficiary_id = $1 AND status = 'COMPLETED'`,
      [beneficiaryId]
    );
    const assCount = assessmentRes.rows[0]?.count || 0;
    const maxScore = parseFloat(assessmentRes.rows[0]?.max_score || 0);
    const assessmentSatisfied = assCount > 0 && maxScore >= 45.00;

    if (!assessmentSatisfied) {
      throw new Error(`Graduation clearance blocked: Candidate does not satisfy the assessment results requirement (Top final score: ${maxScore}/100, passing grade minimum: 45/100).`);
    }

    const toolkitRes = await executeQuery(
      `SELECT COUNT(*)::int as count FROM graduate_toolkits WHERE beneficiary_id = $1`,
      [beneficiaryId]
    );
    const toolkitCount = toolkitRes.rows[0]?.count || 0;
    const toolkitSatisfied = toolkitCount > 0;

    if (!toolkitSatisfied) {
      throw new Error(`Graduation clearance blocked: Candidate has not been issued a graduate startup toolkit.`);
    }

    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const benRes = await executeQuery(`SELECT tenant_id FROM beneficiaries WHERE id = $1`, [beneficiaryId]);
      finalTenantId = benRes.rows[0]?.tenant_id || null;
    }

    const id = require("crypto").randomUUID();
    const res = await executeQuery(
      `INSERT INTO graduation_clearances (id, tenant_id, beneficiary_id, is_cleared_attendance, is_cleared_assessment, is_cleared_toolkit, cleared_by, cleared_at, ceremony_event_name)
       VALUES ($1, $2, $3, TRUE, TRUE, TRUE, $4, NOW(), $5)
       ON CONFLICT (beneficiary_id) DO UPDATE SET
         is_cleared_attendance = TRUE, is_cleared_assessment = TRUE, is_cleared_toolkit = TRUE,
         cleared_by = EXCLUDED.cleared_by, cleared_at = NOW(), ceremony_event_name = EXCLUDED.ceremony_event_name
       RETURNING id, tenant_id as "tenantId", beneficiary_id as "beneficiaryId", is_cleared_attendance as "isClearedAttendance", is_cleared_assessment as "isClearedAssessment", is_cleared_toolkit as "isClearedToolkit", cleared_by as "clearedBy", cleared_at as "clearedAt", ceremony_event_name as "ceremonyEventName"`,
      [id, finalTenantId, beneficiaryId, clearedBy, ceremonyEventName || "Annual TVET Graduation Ceremony"]
    );

    await executeQuery(`UPDATE beneficiaries SET beneficiary_status = 'ALUMNI', certification_status = 'CERTIFIED', certificate_issued_at = NOW(), certificate_issued_by = $2 WHERE id = $1`, [beneficiaryId, clearedBy]);

    await DbRepo.saveAuditLog(clearedBy, "GRADUATION_CLEAR", `Issued graduation clearance and certified trainee ID: ${beneficiaryId}`);
    return res.rows[0];
  }

  static async saveGraduationClearance(clearance: any): Promise<any> {
    const beneficiaryId = clearance.beneficiaryId || clearance.beneficiary_id;
    const clearedBy = clearance.clearedBy || clearance.cleared_by || "system";
    const ceremonyEventName = clearance.ceremonyEventName || clearance.ceremony_event_name || null;
    const tenantId = clearance.tenantId || clearance.tenant_id || null;

    return DbRepo.evaluateAndClearTrainee(beneficiaryId, clearedBy, ceremonyEventName, tenantId);
  }

  static async bulkGraduationClearance(beneficiaryIds: string[], clearedBy: string, ceremonyEventName?: string): Promise<boolean> {
    if (beneficiaryIds.length === 0) return true;

    const errors: string[] = [];
    for (const id of beneficiaryIds) {
      try {
        await DbRepo.evaluateAndClearTrainee(id, clearedBy, ceremonyEventName);
      } catch (err: any) {
        errors.push(`Beneficiary ${id}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Bulk clearance completed with errors:\n${errors.join("\n")}`);
    }
    return true;
  }

  static async getCohortDashboardStats(options?: { systemContext?: boolean }): Promise<any> {
    await assertTenantContext(options);
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return {
        totalCohorts: 0,
        activeCohorts: 0,
        completedCohorts: 0,
        cohortsByYear: []
      };
    }
    const totalCohortsRes = await executeQuery(`SELECT COUNT(*)::int as count FROM cohorts WHERE deleted_at IS NULL`);
    const activeCohortsRes = await executeQuery(`SELECT COUNT(*)::int as count FROM cohorts WHERE status = 'ACTIVE' AND deleted_at IS NULL`);
    const completedCohortsRes = await executeQuery(`SELECT COUNT(*)::int as count FROM cohorts WHERE status = 'COMPLETED' AND deleted_at IS NULL`);
    const cohortsByYearRes = await executeQuery(`
      SELECT cohort_year as "cohortYear", COUNT(*)::int as count 
      FROM cohorts 
      WHERE deleted_at IS NULL 
      GROUP BY cohort_year 
      ORDER BY cohort_year DESC
    `);

    return {
      totalCohorts: totalCohortsRes.rows[0]?.count || 0,
      activeCohorts: activeCohortsRes.rows[0]?.count || 0,
      completedCohorts: completedCohortsRes.rows[0]?.count || 0,
      cohortsByYear: cohortsByYearRes.rows.map(r => ({ cohortYear: r.cohortYear, count: r.count }))
    };
  }

  static async getBatchDashboardStats(options?: { systemContext?: boolean }): Promise<any> {
    await assertTenantContext(options);
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return {
        totalBatches: 0,
        activeBatches: 0,
        completedBatches: 0,
        traineesAssigned: 0
      };
    }
    const totalBatchesRes = await executeQuery(`SELECT COUNT(*)::int as count FROM training_batches WHERE status != 'DELETED'`);
    const activeBatchesRes = await executeQuery(`SELECT COUNT(*)::int as count FROM training_batches WHERE status = 'ACTIVE'`);
    const completedBatchesRes = await executeQuery(`SELECT COUNT(*)::int as count FROM training_batches WHERE status = 'COMPLETED'`);
    const traineesAssignedRes = await executeQuery(`SELECT COUNT(DISTINCT beneficiary_id)::int as count FROM training_batch_assignments`);

    return {
      totalBatches: totalBatchesRes.rows[0]?.count || 0,
      activeBatches: activeBatchesRes.rows[0]?.count || 0,
      completedBatches: completedBatchesRes.rows[0]?.count || 0,
      traineesAssigned: traineesAssignedRes.rows[0]?.count || 0
    };
  }

  static async getTrainerDashboardStats(options?: { systemContext?: boolean }): Promise<any> {
    await assertTenantContext(options);
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return {
        totalTrainers: 0,
        nbteCertified: 0,
        active: 0,
        inactive: 0
      };
    }
    const totalTrainersRes = await executeQuery(`SELECT COUNT(*)::int as count FROM trainers`);
    const nbteCertifiedRes = await executeQuery(`SELECT COUNT(*)::int as count FROM trainers WHERE is_nbte_certified = TRUE`);
    const activeRes = await executeQuery(`SELECT COUNT(*)::int as count FROM trainers WHERE status = 'ACTIVE'`);
    const inactiveRes = await executeQuery(`SELECT COUNT(*)::int as count FROM trainers WHERE status = 'INACTIVE'`);

    return {
      totalTrainers: totalTrainersRes.rows[0]?.count || 0,
      nbteCertified: nbteCertifiedRes.rows[0]?.count || 0,
      active: activeRes.rows[0]?.count || 0,
      inactive: inactiveRes.rows[0]?.count || 0
    };
  }

  static async getAssessmentDashboardStats(options?: { systemContext?: boolean }): Promise<any> {
    await assertTenantContext(options);
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return {
        totalAssessments: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        averageScore: 0
      };
    }
    const totalAssessmentsRes = await executeQuery(`SELECT COUNT(*)::int as count FROM assessments`);
    const passedRes = await executeQuery(`SELECT COUNT(*)::int as count FROM assessments WHERE final_score >= 45 AND status = 'COMPLETED'`);
    const failedRes = await executeQuery(`SELECT COUNT(*)::int as count FROM assessments WHERE final_score < 45 AND status = 'COMPLETED'`);
    const pendingRes = await executeQuery(`SELECT COUNT(*)::int as count FROM assessments WHERE status = 'PENDING'`);
    const avgScoreRes = await executeQuery(`SELECT AVG(final_score)::numeric as avg FROM assessments WHERE final_score IS NOT NULL`);

    return {
      totalAssessments: totalAssessmentsRes.rows[0]?.count || 0,
      passed: passedRes.rows[0]?.count || 0,
      failed: failedRes.rows[0]?.count || 0,
      pending: pendingRes.rows[0]?.count || 0,
      averageScore: parseFloat(parseFloat(avgScoreRes.rows[0]?.avg || "0").toFixed(1))
    };
  }

  static async getGraduationDashboardStats(options?: { systemContext?: boolean }): Promise<any> {
    await assertTenantContext(options);
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return {
        eligible: 0,
        cleared: 0,
        pending: 0
      };
    }
    const clearedRes = await executeQuery(`SELECT COUNT(*)::int as count FROM graduation_clearances`);
    const pendingRes = await executeQuery(`
      SELECT COUNT(DISTINCT b.id)::int as count 
      FROM beneficiaries b
      JOIN (
        SELECT beneficiary_id 
        FROM trainee_attendance 
        WHERE status = 'PRESENT' 
        GROUP BY beneficiary_id 
        HAVING COUNT(*) >= 10
      ) att ON att.beneficiary_id = b.id
      JOIN (
        SELECT DISTINCT beneficiary_id 
        FROM assessments 
        WHERE status = 'COMPLETED' AND final_score >= 45
      ) ass ON ass.beneficiary_id = b.id
      JOIN (
        SELECT DISTINCT beneficiary_id 
        FROM graduate_toolkits
      ) tk ON tk.beneficiary_id = b.id
      LEFT JOIN graduation_clearances gc ON gc.beneficiary_id = b.id
      WHERE gc.beneficiary_id IS NULL
    `);

    const cleared = clearedRes.rows[0]?.count || 0;
    const pending = pendingRes.rows[0]?.count || 0;
    const eligible = cleared + pending;

    return {
      eligible,
      cleared,
      pending
    };
  }

  static async computeAndSaveStipendCompliance(beneficiaryId: string, monthStr: string): Promise<any> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return null;
    try {
      const attRes = await executeQuery(
        `SELECT status, hours_logged, attendance_date 
         FROM trainee_attendance 
         WHERE beneficiary_id = $1 AND TO_CHAR(attendance_date, 'YYYY-MM') = $2`,
        [beneficiaryId, monthStr]
      );
      
      const rows = attRes.rows;
      let present_days = 0;
      let late_days = 0;
      let absent_days = 0;
      let total_hours = 0;
      
      for (const r of rows) {
        const status = (r.status || "").toUpperCase();
        total_hours += parseFloat(r.hours_logged) || 0;
        if (status === "PRESENT" || status === "HOLIDAY" || status === "FIELDWORK") {
          present_days++;
        } else if (status === "LATE") {
          late_days++;
          present_days++;
        } else if (status === "ABSENT") {
          absent_days++;
        }
      }
      
      // Compute expected training days in month
      const totalTrainingDaysRes = await executeQuery(
        `SELECT COUNT(DISTINCT attendance_date)::int as count 
         FROM trainee_attendance 
         WHERE TO_CHAR(attendance_date, 'YYYY-MM') = $1`,
        [monthStr]
      );
      let expected_days = totalTrainingDaysRes.rows[0]?.count || 0;
      if (expected_days === 0) {
        expected_days = Math.max(rows.length, 20);
      }
      
      const attendance_percentage = expected_days > 0 
        ? parseFloat(((present_days / expected_days) * 100).toFixed(1)) 
        : 0.0;
        
      let stipend_status = "ELIGIBLE";
      let stipend_reason = "Compliant class attendance logged.";
      
      if (attendance_percentage < 30) {
        stipend_status = "ESCALATED";
        stipend_reason = "Critical: Attendance is below 30%. Immediate escalation active.";
      } else if (attendance_percentage < 50) {
        stipend_status = "SUSPENDED";
        stipend_reason = "Non-compliant: Attendance is below 50%. Stipend suspended.";
      } else if (attendance_percentage < 65) {
        stipend_status = "AT_RISK";
        stipend_reason = "Warning: Attendance is below 65%. Candidate is currently at risk.";
      }
      
      await executeQuery(
        `INSERT INTO stipend_compliance_snapshots (
          beneficiary_id, attendance_percentage, present_days, absent_days, late_days, 
          total_hours, expected_days, stipend_status, stipend_reason, month_identifier
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (beneficiary_id, month_identifier) DO UPDATE SET
          attendance_percentage = EXCLUDED.attendance_percentage,
          present_days = EXCLUDED.present_days,
          absent_days = EXCLUDED.absent_days,
          late_days = EXCLUDED.late_days,
          total_hours = EXCLUDED.total_hours,
          expected_days = EXCLUDED.expected_days,
          stipend_status = EXCLUDED.stipend_status,
          stipend_reason = EXCLUDED.stipend_reason,
          evaluated_at = CURRENT_TIMESTAMP`,
        [
          beneficiaryId, attendance_percentage, present_days, absent_days, late_days,
          total_hours, expected_days, stipend_status, stipend_reason, monthStr
        ]
      );
      
      return {
        attendance_percentage,
        present_days,
        absent_days,
        late_days,
        total_hours,
        expected_days,
        stipend_status,
        stipend_reason
      };
    } catch (err) {
      console.error("[DB Repo] computeAndSaveStipendCompliance error:", err);
      return null;
    }
  }

  static async getComplianceHistory(beneficiaryId: string): Promise<any[]> {
    const pool = getPgPool();
    if (!pool || !isPgActive) return [];
    try {
      const res = await executeQuery(
        `SELECT * FROM stipend_compliance_snapshots WHERE beneficiary_id = $1 ORDER BY month_identifier DESC`,
        [beneficiaryId]
      );
      return res.rows;
    } catch (err) {
      console.error("[DB Repo] getComplianceHistory error:", err);
      return [];
    }
  }
}

