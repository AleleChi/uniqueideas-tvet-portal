/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from "express";
import { DbRepo } from "./db";
import { DocumentService } from "./document.service";
import { CertificationEligibilityService } from "./certificationEligibility.service";
import { CertificateNumberService } from "./certificateNumber.service";
import { Beneficiary, ProgramStatus, DocumentType } from "../types";

export class CertificationController {
  /**
   * GET /api/certification/stats
   * Retrieves executive metrics and KPI trends for the Certification & Alumni Ecosystem
   */
  static async getCertificationStats(req: Request, res: Response) {
    try {
      const beneficiaries = await DbRepo.getBeneficiaries({ includePhoto: false });

      let eligibleCount = 0;
      let pendingCount = 0;
      let certifiedCount = 0;
      let issuedCount = 0;
      let alumniCount = 0;

      for (const b of beneficiaries) {
        const isEligible = CertificationEligibilityService.isEligibleForCertification(b);
        const certStatus = (b.certificationStatus as any) || "NONE";
        
        // Count active eligible candidates that have NOT entered the flow yet
        if (isEligible && certStatus === "NONE") {
          eligibleCount++;
        }

        if (certStatus === "CERTIFICATION_PENDING") {
          pendingCount++;
        } else if (certStatus === "CERTIFIED") {
          certifiedCount++;
        } else if (certStatus === "CERTIFICATE_ISSUED") {
          issuedCount++;
        } else if (b.alumniStatus || certStatus === "ALUMNI") {
          alumniCount++;
        }
      }

      // Compute certification completion rate: % of candidates certified/issued/alumni relative to all who entered flow
      const totalInFlow = pendingCount + certifiedCount + issuedCount + alumniCount;
      const totalCandidates = eligibleCount + totalInFlow;
      const certificationRate = totalCandidates > 0 
        ? Math.round(((certifiedCount + issuedCount + alumniCount) / totalCandidates) * 100) 
        : 0;

      return res.status(200).json({
        eligibleCount,
        pendingCount,
        certifiedCount,
        issuedCount,
        alumniCount,
        certificationRate
      });
    } catch (err: any) {
      console.error("[CertificationController] Failed loading analytics stats:", err);
      return res.status(500).json({ error: err.message || "Could not retrieve certification statistics." });
    }
  }

  /**
   * GET /api/certification/list
   * Returns a filtered queue of candidates matching certification workflow requirements
   */
  static async getCertificationList(req: Request, res: Response) {
    try {
      const list = await DbRepo.getBeneficiaries({ includePhoto: false });
      
      const enriched = list.map(b => {
        const isEligible = CertificationEligibilityService.isEligibleForCertification(b);
        return {
          ...b,
          isEligibleForCert: isEligible
        };
      });

      return res.status(200).json(enriched);
    } catch (err: any) {
      console.error("[CertificationController] Failed getting candidate queues:", err);
      return res.status(500).json({ error: err.message || "Failed loading certification registry." });
    }
  }

  /**
   * POST /api/certification/transition
   * Performs an official, structured lifecycle state update for a single trainee
   */
  static async transitionStatus(req: Request, res: Response) {
    try {
      const { id, nextStatus, remark, graduationBatch, trackingData } = req.body;
      const operatorEmail = (req as any).user?.email || "system_operator";
      const operatorRole = (req as any).user?.role || "SYSTEM";

      if (!id || !nextStatus) {
        return res.status(400).json({ error: "Missing candidate ID (id) or destination status (nextStatus)." });
      }

      const b = await DbRepo.getBeneficiaryById(id);
      if (!b) {
        return res.status(404).json({ error: "Trainee profile not found inside registry." });
      }

      const currentStatus = b.certificationStatus || "NONE";

      // Enforce sequential lifecycle flow check
      // NONE -> CERTIFICATION_PENDING -> CERTIFIED -> CERTIFICATE_ISSUED -> ALUMNI
      let isAllowed = false;
      if (currentStatus === "NONE") {
        const isEligibleCheck = CertificationEligibilityService.isEligibleForCertification(b);
        if (!isEligibleCheck) {
          return res.status(400).json({ 
            error: "Trainee is disqualified from entering certification. Verify age eligibility parameters and program status represent ACTIVE/COMPLETED baseline." 
          });
        }
        if (nextStatus === "CERTIFICATION_PENDING") {
          isAllowed = true;
        }
      } else if (currentStatus === "CERTIFICATION_PENDING") {
        if (nextStatus === "CERTIFIED") isAllowed = true;
      } else if (currentStatus === "CERTIFIED") {
        if (nextStatus === "CERTIFICATE_ISSUED") isAllowed = true;
      } else if (currentStatus === "CERTIFICATE_ISSUED") {
        if (nextStatus === "ALUMNI") isAllowed = true;
      } else if (currentStatus === "ALUMNI") {
        // Allow updates of demographic employment files
        if (nextStatus === "ALUMNI") isAllowed = true;
      }

      if (!isAllowed) {
        return res.status(400).json({ 
          error: `Staged lifecycle jump from status '${currentStatus}' to '${nextStatus}' violates official sequence guidelines.` 
        });
      }

      // Perform state modifications
      if (nextStatus === "CERTIFICATION_PENDING") {
        b.certificationStatus = "CERTIFICATION_PENDING";
        b.status = ProgramStatus.CERTIFICATION_PENDING;
        if (graduationBatch) {
          b.graduationBatch = graduationBatch;
        }
      } else if (nextStatus === "CERTIFIED") {
        // Check if certificate number is already generated
        if (!b.certificateNumber) {
          const year = new Date().getFullYear();
          b.certificateNumber = await CertificateNumberService.generateCertificateNumber(year);
        }
        
        // Generate unique cryptographic search reference if empty
        if (!b.certificateReference) {
          b.certificateReference = "REF-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 1000).toString(36).toUpperCase();
        }

        b.certificateIssuedAt = new Date().toISOString();
        b.certificateIssuedBy = operatorEmail;
        b.certificationStatus = "CERTIFIED";
        b.status = ProgramStatus.CERTIFIED;

        // Perform active document compiler rendering and upload
        console.log(`[Certification] Compiling completion certificate for candidate ${b.id}...`);
        const { document } = await DocumentService.generateDocumentWithBuffer(b.id, DocumentType.COMPLETION_CERTIFICATE, operatorEmail, true);
        b.certificateUrl = document.pdfUrl;
        b.certificateVerificationCode = document.verificationCode;

      } else if (nextStatus === "CERTIFICATE_ISSUED") {
        b.certificationStatus = "CERTIFICATE_ISSUED";
        b.status = ProgramStatus.CERTIFICATE_ISSUED;

        // Auto dispatch certificate to verified emails
        const documents = await DbRepo.getGeneratedDocuments(b.id);
        const certDoc = documents.find(d => d.documentType === DocumentType.COMPLETION_CERTIFICATE);
        
        if (certDoc) {
          console.log(`[Dispatch Hub] Dispatching certificate document ${certDoc.id} to trainee email...`);
          try {
            await DocumentService.sendDocumentEmail(certDoc.id);
          } catch (issueErr: any) {
            console.error(`[Dispatch Hub] Automated email dispatch failed for doc: ${certDoc.id}`, issueErr);
            // Save state even if mail server fails to prevent double-charging sequence blocks
          }
        } else {
          console.warn(`[Dispatch Hub] Missing COMPLETION_CERTIFICATE generated document file for Candidate ${b.id}`);
        }

      } else if (nextStatus === "ALUMNI") {
        b.certificationStatus = "ALUMNI" as any;
        b.status = ProgramStatus.ALUMNI;
        b.alumniStatus = true;

        if (trackingData) {
          b.alumniEmploymentStatus = trackingData.employmentStatus || "";
          b.alumniEntrepreneurStatus = trackingData.entrepreneurStatus || "";
          b.alumniBusinessName = trackingData.businessName || "";
          b.alumniCurrentEmployer = trackingData.currentEmployer || "";
        }
      }

      b.updatedAt = new Date().toISOString();

      // Persist results inside storage repository
      await DbRepo.upsertBeneficiary(b);

      // Save to Workflow History
      try {
        await DbRepo.saveWorkflowHistory({
          beneficiaryId: b.id,
          oldStatus: currentStatus,
          newStatus: nextStatus,
          changedBy: operatorEmail,
          changedAt: new Date().toISOString(),
          remarks: remark || `Promoted candidate to next lifecycle milestone: ${nextStatus}`
        });
      } catch (err) {}

      // Secure cryptographic audit trails
      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorEmail,
        role: operatorRole,
        action: "CERTIFICATION_LIFECYCLE_TRANSITION",
        details: `Trainee ID: ${b.id}, Name: ${b.firstName} ${b.lastName}, Transitioned: '${currentStatus}' -> '${nextStatus}', Remarks: ${remark || "none"}`
      });

      return res.status(200).json({ success: true, beneficiary: b });
    } catch (err: any) {
      console.error("[CertificationController] State transition error:", err);
      return res.status(500).json({ error: err.message || "Failed executing certification workflow mutation." });
    }
  }

  /**
   * POST /api/certification/bulk-transition
   * Executes batch transition operations with chunked, non-blocking execution frames
   */
  static async bulkTransition(req: Request, res: Response) {
    try {
      const { ids, nextStatus, remark, graduationBatch } = req.body;
      const operatorEmail = (req as any).user?.email || "system_operator";
      const operatorRole = (req as any).user?.role || "SYSTEM";

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Missing or invalid trainee recipient selection parameter (ids)." });
      }
      if (!nextStatus) {
        return res.status(400).json({ error: "Missing target status state parameter." });
      }

      const results = {
        successCount: 0,
        failedCount: 0,
        failures: [] as Array<{ id: string; error: string }>
      };

      // Process in small non-blocking chunks of 10 to protect memory allocation bounds
      const CHUNK_SIZE = 10;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async (id) => {
            try {
              const b = await DbRepo.getBeneficiaryById(id);
              if (!b) throw new Error("Trainee search failed: index key missing");

              const currentStatus = b.certificationStatus || "NONE";

              // Verify eligibility or state path validation
              let allowed = false;
              if (currentStatus === "NONE") {
                if (CertificationEligibilityService.isEligibleForCertification(b) && nextStatus === "CERTIFICATION_PENDING") {
                  allowed = true;
                }
              } else if (currentStatus === "CERTIFICATION_PENDING" && nextStatus === "CERTIFIED") {
                allowed = true;
              } else if (currentStatus === "CERTIFIED" && nextStatus === "CERTIFICATE_ISSUED") {
                allowed = true;
              } else if (currentStatus === "CERTIFICATE_ISSUED" && nextStatus === "ALUMNI") {
                allowed = true;
              }

              if (!allowed) {
                throw new Error(`State jump from '${currentStatus}' to '${nextStatus}' is mathematically out of bounds for sequence.`);
              }

              // Update parameters matching status
              if (nextStatus === "CERTIFICATION_PENDING") {
                b.certificationStatus = "CERTIFICATION_PENDING";
                b.status = ProgramStatus.CERTIFICATION_PENDING;
                if (graduationBatch) {
                  b.graduationBatch = graduationBatch;
                }
              } else if (nextStatus === "CERTIFIED") {
                if (!b.certificateNumber) {
                  b.certificateNumber = await CertificateNumberService.generateCertificateNumber(new Date().getFullYear());
                }
                if (!b.certificateReference) {
                  b.certificateReference = "REF-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 1000).toString(36).toUpperCase();
                }
                b.certificateIssuedAt = new Date().toISOString();
                b.certificateIssuedBy = operatorEmail;
                b.certificationStatus = "CERTIFIED";
                b.status = ProgramStatus.CERTIFIED;

                const { document } = await DocumentService.generateDocumentWithBuffer(b.id, DocumentType.COMPLETION_CERTIFICATE, operatorEmail, true);
                b.certificateUrl = document.pdfUrl;
                b.certificateVerificationCode = document.verificationCode;
              } else if (nextStatus === "CERTIFICATE_ISSUED") {
                b.certificationStatus = "CERTIFICATE_ISSUED";
                b.status = ProgramStatus.CERTIFICATE_ISSUED;

                const documents = await DbRepo.getGeneratedDocuments(b.id);
                const certDoc = documents.find(d => d.documentType === DocumentType.COMPLETION_CERTIFICATE);
                if (certDoc) {
                  try {
                    await DocumentService.sendDocumentEmail(certDoc.id);
                  } catch (e: any) {
                    console.error(`[Bulk Dispatch] Failed mailing doc ${certDoc.id}`, e);
                  }
                }
              } else if (nextStatus === "ALUMNI") {
                b.certificationStatus = "ALUMNI" as any;
                b.status = ProgramStatus.ALUMNI;
                b.alumniStatus = true;
              }

              b.updatedAt = new Date().toISOString();
              await DbRepo.upsertBeneficiary(b);

              // Maintain audit lines and change matrices
              await DbRepo.saveWorkflowHistory({
                beneficiaryId: b.id,
                oldStatus: currentStatus,
                newStatus: nextStatus,
                changedBy: operatorEmail,
                changedAt: new Date().toISOString(),
                remarks: remark || "Bulk operations queue processing"
              });

              await DbRepo.saveAuditLog({
                id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                timestamp: new Date().toISOString(),
                username: operatorEmail,
                role: operatorRole,
                action: "CERTIFICATION_BULK_RUN",
                details: `Trainee ID: ${b.id}, State updated: '${currentStatus}' -> '${nextStatus}'`
              });

              results.successCount++;
            } catch (err: any) {
              results.failedCount++;
              results.failures.push({ id, error: err.message || "Execution block error" });
            }
          })
        );

        // Sleep briefly between chunk execution loops to release Node.js tick locks
        if (i + CHUNK_SIZE < ids.length) {
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      }

      return res.status(200).json({ success: true, results });
    } catch (err: any) {
      console.error("[CertificationController] Bulk execution failure:", err);
      return res.status(500).json({ error: err.message || "Failed running batch certification routines." });
    }
  }

  /**
   * POST /api/certification/alumni-update
   * Saves post-graduation tracking and employment variables
   */
  static async updateAlumniProfile(req: Request, res: Response) {
    try {
      const { id, employmentStatus, entrepreneurStatus, businessName, currentEmployer } = req.body;
      const operatorEmail = (req as any).user?.email || "anonymous";

      if (!id) {
        return res.status(400).json({ error: "Missing candidate trainee reference ID." });
      }

      const b = await DbRepo.getBeneficiaryById(id);
      if (!b) {
        return res.status(404).json({ error: "Alumni profile not found inside registry." });
      }

      b.alumniEmploymentStatus = employmentStatus || "";
      b.alumniEntrepreneurStatus = entrepreneurStatus || "";
      b.alumniBusinessName = businessName || "";
      b.alumniCurrentEmployer = currentEmployer || "";
      b.updatedAt = new Date().toISOString();

      await DbRepo.upsertBeneficiary(b);

      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorEmail,
        role: (req as any).user?.role || "System Admin",
        action: "ALUMNI_PROFILE_UPDATE",
        details: `Saved demographic and careers tracking file for Alumni ID ${b.id}. Name: ${b.firstName} ${b.lastName}`
      });

      return res.status(200).json({ success: true, beneficiary: b });
    } catch (err: any) {
      console.error("[CertificationController] Alumni career profile save error:", err);
      return res.status(500).json({ error: err.message || "Failed saving alumni career tracking metadata." });
    }
  }
}
