/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPgPool, loadJsonState, executeQuery } from "./db";

export interface DependencyAnalysisResult {
  beneficiaryId: string;
  currentStatus: string;
  workflowVersion: number;
  tokenVersion: number;

  documentsAffected: {
    active: number;
    archived: number;
    superseded: number;
    revoked: number;
    total: number;
  };
  certificationsAffected: {
    certificationsAffected: boolean;
    certifiedStatus: string;
    certificateCount: number;
  };
  toolkitsAffected: {
    toolkitsAffected: number;
    toolkitsIssued: number;
    toolkitsVerified: number;
    toolkitsLost: number;
    toolkitsDamaged: number;
  };
  dispatchesAffected: {
    dispatchesAffected: number;
    dispatchCount: number;
    lastDispatchDate: string | null;
  };
  evidenceAffected: {
    impactRecordsAffected: number;
    employmentRecords: number;
    businessRecords: number;
    verificationRecords: number;
  };
  financialRecordsAffected: {
    financialRecordsAffected: number;
    fundingLinked: number;
    roiLinked: number;
    costLinked: number;
  };
  auditReferencesAffected: {
    auditReferencesAffected: number;
    workflowHistoryCount: number;
    auditCount: number;
    governanceEventCount: number;
  };

  governanceRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rollbackAllowed: boolean;
}

export class LifecycleDependencyService {
  static async analyze(beneficiaryId: string): Promise<DependencyAnalysisResult> {
    const pool = getPgPool();
    const isPg = !!pool;

    // Retrieve beneficiary details
    let beneficiary: any = null;
    if (isPg) {
      try {
        const bRes = await executeQuery("SELECT * FROM beneficiaries WHERE id = $1", [beneficiaryId]);
        if (bRes.rows.length > 0) {
          beneficiary = bRes.rows[0];
        }
      } catch (err) {
        console.warn("[Dependency Analysis] Primary PG beneficiary lookup failed, falling back to JSON:", err);
      }
    }

    if (!beneficiary) {
      const state = loadJsonState();
      beneficiary = state.beneficiaries?.find(b => b.id === beneficiaryId);
    }

    if (!beneficiary) {
      throw new Error(`Beneficiary with ID ${beneficiaryId} not found.`);
    }

    // Normalize field naming between snake_case (PG) and camelCase (JSON/Interface)
    const status = beneficiary.status || "DRAFT";
    const workflowVersion = beneficiary.workflow_version ?? beneficiary.workflowVersion ?? 1;
    const tokenVersion = beneficiary.token_version ?? beneficiary.tokenVersion ?? 1;
    const skillSector = beneficiary.skill_sector ?? beneficiary.skillSector ?? "";
    const batch = beneficiary.batch ?? "";
    
    const isAdmissionFormCompleted = beneficiary.admission_form_completed ?? beneficiary.admissionFormCompleted ?? false;
    const admissionLetterUrl = beneficiary.admission_letter_url ?? beneficiary.admissionLetterUrl ?? null;
    const acceptanceLetterUploadedAt = beneficiary.acceptance_letter_uploaded_at ?? beneficiary.acceptanceLetterUploadedAt ?? null;
    const certificateIssuedAt = beneficiary.certificate_issued_at ?? beneficiary.certificateIssuedAt ?? null;

    // Document variables states
    let docsActive = 0;
    let docsArchived = 0;
    let docsSuperseded = 0;
    let docsRevoked = 0;

    // Certification variables states
    let certifiedStatus = beneficiary.certification_status ?? beneficiary.certificationStatus ?? "NONE";
    let certificateCount = 0;

    // Toolkit variables states
    let toolkitsAffected = 0;
    let toolkitsIssued = 0;
    let toolkitsVerified = 0;
    let toolkitsLost = 0;
    let toolkitsDamaged = 0;

    // Dispatch variables states
    let dispatchesAffected = 0;
    let dispatchCount = 0;
    let lastDispatchDate: string | null = null;

    // Evidence & Impact variables states
    let impactRecordsAffected = 0;
    let employmentRecords = 0;
    let businessRecords = 0;
    let verificationRecords = 0;

    // Financial variables states
    let financialRecordsAffected = 0;
    let fundingLinked = 0;
    let roiLinked = 0;
    let costLinked = 0;

    // Audit trace variables states
    let auditReferencesAffected = 0;
    let workflowHistoryCount = 0;
    let auditCount = 0;
    let governanceEventCount = 0;

    let scanSuccessful = false;

    if (isPg) {
      try {
        // Phase 2: Document Scan
        const docRes = await executeQuery(
          "SELECT document_status FROM generated_documents WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        docRes.rows.forEach(row => {
          const docStat = (row.document_status || "ACTIVE").toUpperCase();
          if (docStat === "ACTIVE") docsActive++;
          else if (docStat === "ARCHIVED") docsArchived++;
          else if (docStat === "SUPERSEDED") docsSuperseded++;
          else if (docStat === "REVOKED") docsRevoked++;
        });

        // Phase 3: Certification Scan
        const certRes = await executeQuery(
          "SELECT COUNT(*)::int as count FROM certificates WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        certificateCount = certRes.rows[0]?.count || 0;

        // Phase 4: Toolkit Scan
        const toolkitRes = await executeQuery(
          "SELECT issue_date, verification_status, condition_status, replacement_requested FROM graduate_toolkits WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        toolkitsAffected = toolkitRes.rows.length;
        toolkitRes.rows.forEach(row => {
          if (row.issue_date) toolkitsIssued++;
          if (row.verification_status === "VERIFIED") toolkitsVerified++;
          if (row.replacement_requested) toolkitsLost++;
          if (row.condition_status === "DAMAGED") toolkitsDamaged++;
        });

        // Phase 5: Dispatch Scan
        const dispatchRes = await executeQuery(
          "SELECT COUNT(*)::int as count, MAX(sent_at) as last_sent FROM document_dispatches WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        dispatchCount = dispatchRes.rows[0]?.count || 0;
        dispatchesAffected = dispatchCount;
        if (dispatchRes.rows[0]?.last_sent) {
          lastDispatchDate = new Date(dispatchRes.rows[0].last_sent).toISOString();
        }

        // Phase 6: Impact Evidence Scan
        const fieldRes = await executeQuery(
          "SELECT visited FROM field_verifications WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        verificationRecords = fieldRes.rows.length;

        const evidenceRes = await executeQuery(
          "SELECT outcome_type FROM impact_evidence WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        const evidenceCount = evidenceRes.rows.length;
        evidenceRes.rows.forEach(row => {
          const type = (row.outcome_type || "").toUpperCase();
          if (type.includes("EMPLOYMENT") || type.includes("JOB")) employmentRecords++;
          if (type.includes("BUSINESS") || type.includes("SETUP") || type.includes("ENTREPRENEUR")) businessRecords++;
        });

        const tracerRes = await executeQuery(
          "SELECT COUNT(*)::int as count FROM tracer_studies WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        const tracerCount = tracerRes.rows[0]?.count || 0;
        employmentRecords += tracerCount;

        const outcomeRes = await executeQuery(
          "SELECT outcome_status, employment_type FROM training_outcomes WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        const outcomeCount = outcomeRes.rows.length;
        outcomeRes.rows.forEach(row => {
          if (row.employment_type) employmentRecords++;
          if (row.outcome_status === "EMPLOYED" || row.outcome_status === "ENTREPRENEUR") {
            if (row.outcome_status === "EMPLOYED") employmentRecords++;
            else businessRecords++;
          }
        });

        impactRecordsAffected = evidenceCount + verificationRecords + tracerCount + outcomeCount;

        // Phase 7: Financial Scan
        const financialRes = await executeQuery(
          "SELECT cost_category, amount FROM program_costs WHERE training_track = $1 AND batch = $2",
          [skillSector, batch]
        );
        financialRecordsAffected = financialRes.rows.length;
        financialRes.rows.forEach(row => {
          const cat = (row.cost_category || "").toUpperCase();
          if (cat.includes("FUND") || cat.includes("TUITION") || cat.includes("GRANT")) fundingLinked++;
          else if (cat.includes("ROI") || cat.includes("OUTCOME") || cat.includes("BENEFIT")) roiLinked++;
          else costLinked++;
        });

        // Phase 8: Audit Scan
        const workflowRes = await executeQuery(
          "SELECT COUNT(*)::int as count FROM workflow_history WHERE beneficiary_id = $1",
          [beneficiaryId]
        );
        workflowHistoryCount = workflowRes.rows[0]?.count || 0;

        const auditRes = await executeQuery(
          "SELECT action FROM audit_logs WHERE beneficiary_id = $1 OR details LIKE $2",
          [beneficiaryId, `%${beneficiaryId}%`]
        );
        auditCount = auditRes.rows.length;
        auditRes.rows.forEach(row => {
          const act = (row.action || "").toUpperCase();
          if (
            act.includes("ROLLBACK") ||
            act.includes("GOVERNANCE") ||
            act.includes("RESET") ||
            act.includes("UNLOCK") ||
            act.includes("REOPEN")
          ) {
            governanceEventCount++;
          }
        });

        auditReferencesAffected = workflowHistoryCount + auditCount;
        scanSuccessful = true;

      } catch (err) {
        console.error("[Dependency Analysis Scan primary SQL query failure]", err);
        scanSuccessful = false;
      }
    }

    // Failover to Local JSON State engine
    if (!scanSuccessful) {
      const state = loadJsonState();

      // Generated documents
      const docs = (state as any).generated_documents || [];
      const beneficiaryDocs = docs.filter((d: any) => d.beneficiary_id === beneficiaryId || d.beneficiaryId === beneficiaryId);
      beneficiaryDocs.forEach((d: any) => {
        const docStat = (d.document_status || d.documentStatus || "ACTIVE").toUpperCase();
        if (docStat === "ACTIVE") docsActive++;
        else if (docStat === "ARCHIVED") docsArchived++;
        else if (docStat === "SUPERSEDED") docsSuperseded++;
        else if (docStat === "REVOKED") docsRevoked++;
      });

      // Certificates
      const certs = (state as any).certificates || [];
      const beneficiaryCerts = certs.filter((c: any) => c.beneficiary_id === beneficiaryId || c.beneficiaryId === beneficiaryId);
      certificateCount = beneficiaryCerts.length;

      // Toolkits
      const toolkits = state.graduateToolkits || [];
      const beneficiaryToolkits = toolkits.filter((t: any) => t.beneficiary_id === beneficiaryId || t.beneficiaryId === beneficiaryId);
      toolkitsAffected = beneficiaryToolkits.length;
      beneficiaryToolkits.forEach((t: any) => {
        if (t.issue_date || t.issueDate) toolkitsIssued++;
        if (t.verification_status === "VERIFIED" || t.verificationStatus === "VERIFIED") toolkitsVerified++;
        if (t.replacement_requested || t.replacementRequested) toolkitsLost++;
        if (t.condition_status === "DAMAGED" || t.conditionStatus === "DAMAGED") toolkitsDamaged++;
      });

      // Dispatches
      const dispatches = state.documentDispatches || [];
      const beneficiaryDispatches = dispatches.filter((d: any) => d.beneficiary_id === beneficiaryId || d.beneficiaryId === beneficiaryId);
      dispatchCount = beneficiaryDispatches.length;
      dispatchesAffected = dispatchCount;
      if (beneficiaryDispatches.length > 0) {
        const dates = beneficiaryDispatches
          .map((d: any) => new Date(d.sent_at || d.sentAt || d.created_at || d.createdAt).getTime())
          .filter(t => !isNaN(t));
        if (dates.length > 0) {
          lastDispatchDate = new Date(Math.max(...dates)).toISOString();
        }
      }

      // Evidences
      const evidence = (state as any).impact_evidence || (state as any).impactEvidence || [];
      const beneficiaryEvidence = evidence.filter((e: any) => e.beneficiary_id === beneficiaryId || e.beneficiaryId === beneficiaryId);
      const evidenceCount = beneficiaryEvidence.length;
      beneficiaryEvidence.forEach((row: any) => {
        const type = (row.outcome_type || row.outcomeType || "").toUpperCase();
        if (type.includes("EMPLOYMENT") || type.includes("JOB")) employmentRecords++;
        if (type.includes("BUSINESS") || type.includes("SETUP") || type.includes("ENTREPRENEUR")) businessRecords++;
      });

      // Tracer Studies
      const tracer = (state as any).tracer_studies || (state as any).tracerStudies || [];
      const beneficiaryTracer = tracer.filter((t: any) => t.beneficiary_id === beneficiaryId || t.beneficiaryId === beneficiaryId);
      const tracerCount = beneficiaryTracer.length;
      employmentRecords += tracerCount;

      // Outcomes
      const trainingOutcomes = (state as any).training_outcomes || (state as any).trainingOutcomes || [];
      const beneficiaryOutcomes = trainingOutcomes.filter((o: any) => o.beneficiary_id === beneficiaryId || o.beneficiaryId === beneficiaryId);
      const outcomeCount = beneficiaryOutcomes.length;
      beneficiaryOutcomes.forEach((row: any) => {
        const oStatus = (row.outcome_status || row.outcomeStatus || "").toUpperCase();
        if (row.employment_type || row.employmentType) employmentRecords++;
        if (oStatus === "EMPLOYED" || oStatus === "ENTREPRENEUR") {
          if (oStatus === "EMPLOYED") employmentRecords++;
          else businessRecords++;
        }
      });

      // Verification Visits
      const verifications = (state as any).field_verifications || (state as any).fieldVerifications || [];
      const beneficiaryVerifications = verifications.filter((v: any) => v.beneficiary_id === beneficiaryId || v.beneficiaryId === beneficiaryId);
      verificationRecords = beneficiaryVerifications.length;

      impactRecordsAffected = evidenceCount + tracerCount + outcomeCount + verificationRecords;

      // Financials
      const programCosts = state.programCosts || [];
      const matchingCosts = programCosts.filter((c: any) => 
        (c.training_track || c.trainingTrack) === skillSector && 
        c.batch === batch
      );
      financialRecordsAffected = matchingCosts.length;
      matchingCosts.forEach((c: any) => {
        const cat = (c.cost_category || c.costCategory || "").toUpperCase();
        if (cat.includes("FUND") || cat.includes("TUITION") || cat.includes("GRANT")) fundingLinked++;
        else if (cat.includes("ROI") || cat.includes("OUTCOME") || cat.includes("BENEFIT")) roiLinked++;
        else costLinked++;
      });

      // Audit logs
      const auditLogs = state.auditLogs || [];
      const beneficiaryAuditLogs = auditLogs.filter((a: any) => 
        a.beneficiary_id === beneficiaryId || 
        a.beneficiaryId === beneficiaryId || 
        (a.details && a.details.includes(beneficiaryId))
      );
      auditCount = beneficiaryAuditLogs.length;
      beneficiaryAuditLogs.forEach((row: any) => {
        const act = (row.action || "").toUpperCase();
        if (
          act.includes("ROLLBACK") ||
          act.includes("GOVERNANCE") ||
          act.includes("RESET") ||
          act.includes("UNLOCK") ||
          act.includes("REOPEN")
        ) {
          governanceEventCount++;
        }
      });

      // Workflow History
      const wfHist = (state as any).workflow_history || (state as any).workflowHistory || [];
      const beneficiaryWf = wfHist.filter((w: any) => w.beneficiary_id === beneficiaryId || w.beneficiaryId === beneficiaryId);
      workflowHistoryCount = beneficiaryWf.length;

      auditReferencesAffected = workflowHistoryCount + auditCount;
    }

    // Phase 9: Governance Risk Engine Rules Mapping
    let governanceRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

    const isCertificationIssuedStatus = status === "CERTIFICATE_ISSUED" || status === "CERTIFIED" || status === "ALUMNI";
    const hasCertificateIssued = certificateCount > 0 || isCertificationIssuedStatus || !!certificateIssuedAt;
    const hasToolkitIssued = toolkitsIssued > 0;
    const hasImpactEvidence = impactRecordsAffected > 0;
    const hasFinancials = financialRecordsAffected > 0;

    const hasSignedForm = isAdmissionFormCompleted || !!acceptanceLetterUploadedAt;

    if (hasCertificateIssued || hasToolkitIssued || hasImpactEvidence || hasFinancials) {
      governanceRiskLevel = "CRITICAL";
    } else if (hasSignedForm || toolkitsAffected > 0 || certificateCount > 0) {
      governanceRiskLevel = "HIGH";
    } else if (admissionLetterUrl || status !== "DRAFT") {
      governanceRiskLevel = "MEDIUM";
    } else {
      governanceRiskLevel = "LOW";
    }

    return {
      beneficiaryId,
      currentStatus: status,
      workflowVersion,
      tokenVersion,

      documentsAffected: {
        active: docsActive,
        archived: docsArchived,
        superseded: docsSuperseded,
        revoked: docsRevoked,
        total: docsActive + docsArchived + docsSuperseded + docsRevoked
      },
      certificationsAffected: {
        certificationsAffected: certificateCount > 0 || isCertificationIssuedStatus,
        certifiedStatus,
        certificateCount
      },
      toolkitsAffected: {
        toolkitsAffected,
        toolkitsIssued,
        toolkitsVerified,
        toolkitsLost,
        toolkitsDamaged
      },
      dispatchesAffected: {
        dispatchesAffected,
        dispatchCount,
        lastDispatchDate
      },
      evidenceAffected: {
        impactRecordsAffected,
        employmentRecords,
        businessRecords,
        verificationRecords
      },
      financialRecordsAffected: {
        financialRecordsAffected,
        fundingLinked,
        roiLinked,
        costLinked
      },
      auditReferencesAffected: {
        auditReferencesAffected,
        workflowHistoryCount,
        auditCount,
        governanceEventCount
      },

      governanceRiskLevel,
      rollbackAllowed: true
    };
  }
}
