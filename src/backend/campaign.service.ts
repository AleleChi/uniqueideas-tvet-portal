import { getPgPool, DbRepo, executeQuery } from "./db";

export interface CampaignFilters {
  status?: string;
  cohort?: string;
  program?: string;
  state?: string;
  lga?: string;
  intakeYear?: string;
  lifecycleStage?: string;
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  blocked: number;
}

export class CampaignAudienceService {
  /**
   * Builds the SQL query dynamically based on targeting filters and retrieves recipients.
   */
  static async buildAudience(filters: CampaignFilters): Promise<any[]> {
    const pool = getPgPool();
    if (!pool) return [];

    let query = `
      SELECT b.id, b.first_name as "firstName", b.last_name as "lastName", b.email, b.state, b.city,
             b.batch, b.program, b.status as "beneficiaryStatus", b.beneficiary_status as "activeStatus",
             b.certification_status as "certificationStatus", b.token_version as "tokenVersion",
             adm.admission_status as "admissionStatus", adm.acceptance_letter_status as "acceptanceLetterStatus"
      FROM beneficiaries b
      LEFT JOIN admissions adm ON b.id = adm.beneficiary_id
      WHERE b.deleted_at IS NULL AND b.is_archived = FALSE
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND b.status = $${paramIndex++}`;
      values.push(filters.status);
    }
    if (filters.cohort) {
      query += ` AND b.batch = $${paramIndex++}`;
      values.push(filters.cohort);
    }
    if (filters.program) {
      query += ` AND b.program = $${paramIndex++}`;
      values.push(filters.program);
    }
    if (filters.state) {
      query += ` AND LOWER(b.state) = LOWER($${paramIndex++})`;
      values.push(filters.state);
    }
    if (filters.lga) {
      query += ` AND LOWER(b.city) = LOWER($${paramIndex++})`;
      values.push(filters.lga);
    }
    if (filters.intakeYear) {
      query += ` AND b.batch LIKE $${paramIndex++}`;
      values.push(`%${filters.intakeYear}%`);
    }

    if (filters.lifecycleStage) {
      switch (filters.lifecycleStage.toUpperCase()) {
        case "ALL_DRAFT":
          query += " AND b.status = 'DRAFT'";
          break;
        case "ALL_ACCEPTED":
          query += " AND (adm.admission_status = 'Accepted' OR adm.acceptance_letter_status = 'ACCEPTED')";
          break;
        case "ALL_CERTIFIED":
          query += " AND b.certification_status = 'CERTIFIED'";
          break;
        case "UNSIGNED_OFFERS":
          query += " AND COALESCE(adm.admission_status, 'Pending') = 'Offered' AND (adm.acceptance_letter_status IS NULL OR adm.acceptance_letter_status = 'Pending')";
          break;
        case "ACCEPTED_NOT_CERTIFIED":
          query += " AND (adm.admission_status = 'Accepted' OR adm.acceptance_letter_status = 'ACCEPTED') AND b.certification_status <> 'CERTIFIED'";
          break;
        default:
          break;
      }
    }

    query += " ORDER BY b.id ASC";

    try {
      const res = await executeQuery(query, values);
      return res.rows;
    } catch (e) {
      console.error("[CampaignAudienceService] buildAudience failed:", e);
      return [];
    }
  }

  /**
   * Helper function to count the recipients that match current filtering.
   */
  static async countRecipients(filters: CampaignFilters): Promise<number> {
    const audience = await this.buildAudience(filters);
    return audience.length;
  }

  /**
   * Pre-campaign recipient validation logic.
   * Checks for: email exists, syntax correctness, duplicates, active/blocked status.
   */
  static async validateRecipients(recipients: any[]): Promise<ValidationSummary> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seenEmails = new Set<string>();

    let total = recipients.length;
    let valid = 0;
    let invalid = 0;
    let duplicates = 0;
    let blocked = 0;

    for (const r of recipients) {
      const email = (r.email || "").trim().toLowerCase();

      // Check active / blocked status
      if (r.activeStatus && r.activeStatus !== "ACTIVE") {
        blocked++;
        continue;
      }

      // Check email presence & format
      if (!email || !emailRegex.test(email)) {
        invalid++;
        continue;
      }

      // Check duplicates
      if (seenEmails.has(email)) {
        duplicates++;
        continue;
      }

      // If it passes all criteria, it's a valid and deliverable recipient
      seenEmails.add(email);
      valid++;
    }

    return {
      total,
      valid,
      invalid,
      duplicates,
      blocked
    };
  }

  /**
   * Compiles filter results to preview lists.
   */
  static async previewRecipients(filters: CampaignFilters): Promise<{
    audience: any[];
    validation: ValidationSummary;
  }> {
    const audience = await this.buildAudience(filters);
    const validation = await this.validateRecipients(audience);
    return {
      audience,
      validation
    };
  }
}
