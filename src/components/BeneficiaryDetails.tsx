/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, Edit3, Printer, ShieldCheck, CheckCircle, ClipboardList, PenTool, 
  Award, Landmark, Check, Upload, FileText, Calendar, Trash2, Mail, ExternalLink, 
  Download, FileUp, Sparkles, AlertTriangle, FileCode, CheckSquare, Info,
  Copy, RotateCw, RefreshCw, FileSpreadsheet, Search, Filter, X, Eye, ChevronRight,
  Lock, Unlock, Save, Users, History, Database, Key, Layers, ArrowRight
} from "lucide-react";
import { Beneficiary, ProgramStatus, AuditLog, WorkflowHistory } from "../types";
import { authFetch, downloadWithAuth } from "../utils/authFetch";
import { useNotification } from "./NotificationContext";
import { API_BASE_URL } from "../config/api";

export function getLifecycleStatusBadge(status?: string) {
  const s = (status || "ACTIVE").toUpperCase();
  switch (s) {
    case "ACTIVE":
      return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Active" };
    case "COMPLETED":
      return { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Completed" };
    case "UNDER_REVIEW":
      return { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Under Review" };
    case "WITHDRAWN":
      return { bg: "bg-orange-50 text-orange-700 border-orange-200", label: "Withdrawn" };
    case "FAILED_VERIFICATION":
      return { bg: "bg-red-50 text-red-700 border-red-200", label: "Failed Verification" };
    case "DISQUALIFIED":
      return { bg: "bg-red-100 text-red-800 border-red-300", label: "Disqualified" };
    case "REMOVED":
      return { bg: "bg-rose-100 text-rose-800 border-rose-300", label: "Removed" };
    case "ARCHIVED":
      return { bg: "bg-slate-50 text-slate-700 border-slate-200", label: "Archived" };
    default:
      return { bg: "bg-slate-50 text-slate-700 border-slate-200", label: status || "Active" };
  }
}

interface BeneficiaryDetailsProps {
  beneficiary: Beneficiary;
  onBack: () => void;
  onTriggerBiometrics: () => void;
  onEdit: () => void;
  onUpdate: (data: Partial<Beneficiary>) => Promise<void>;
  onDelete?: () => void;
  session?: { username?: string; role?: string; email?: string } | null;
  initialTab?: "overview" | "admission" | "acceptance" | "forms" | "documents" | "training" | "attendance" | "audits" | "communications" | "workflow" | "guardian" | "banking" | "verification" | "governance";
}

export function BeneficiaryDetails({
  beneficiary,
  onBack,
  onTriggerBiometrics,
  onEdit,
  onUpdate,
  onDelete,
  session,
  initialTab
}: BeneficiaryDetailsProps) {
  
  const { showToast: globalShowToast, confirmDelete } = useNotification();
  const [activeTab, setActiveTab ] = useState<"overview" | "admission" | "acceptance" | "forms" | "documents" | "training" | "attendance" | "audits" | "communications" | "workflow" | "guardian" | "banking" | "verification" | "governance">(initialTab || "overview");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [emailHealth, setEmailHealth] = useState<{ status: string; error?: string } | null>(null);
  const [dragActive, setDragActive] = useState<string | null>(null);
  
  // Acceptance letter worksheet local tracking states
  const [remarksInput, setRemarksInput] = useState(beneficiary.acceptanceLetterRemarks || "");
  const [selectedLetterStatus, setSelectedLetterStatus] = useState<"NOT_SUBMITTED" | "SUBMITTED" | "UNDER_VERIFICATION" | "ACCEPTED" | "REJECTED">(
    (beneficiary.acceptanceLetterStatus as any) || "NOT_SUBMITTED"
  );
  const [isUpdatingLetter, setIsUpdatingLetter] = useState(false);

  // Dynamic, canonical bank details states
  const [bankDetails, setBankDetails] = useState<any | null>(null);
  const [loadingBankDetails, setLoadingBankDetails] = useState(false);
  const [bankDetailsError, setBankDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "banking" && beneficiary.id) {
      setBankDetails(null);
      setBankDetailsError(null);
      setLoadingBankDetails(true);

      authFetch(`/api/beneficiaries/${beneficiary.id}/bank-details`)
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // Double check: identity verification
          if (data.beneficiaryId !== beneficiary.id) {
            logActionToBackend("DATA_IDENTITY_CONFLICT", `Identity mismatch: Requested ${beneficiary.id} but received bank details for ${data.beneficiaryId}`);
            throw new Error("DATA IDENTITY CONFLICT: Returned beneficiary ID does not match current beneficiary.");
          }
          if (data.tvetId && beneficiary.id) {
            const expectedTvetId = (beneficiary as any).tvetId || (beneficiary as any).tvet_id || beneficiary.customFields?.tvet_id || beneficiary.id;
            if (expectedTvetId && data.tvetId !== expectedTvetId) {
              logActionToBackend("DATA_IDENTITY_CONFLICT", `TVET ID mismatch: Expected ${expectedTvetId} but received ${data.tvetId}`);
              throw new Error("DATA IDENTITY CONFLICT: Returned TVET ID does not match current beneficiary.");
            }
          }
          setBankDetails(data);
        })
        .catch((err) => {
          console.error("Failed to load canonical bank details:", err);
          setBankDetailsError(err.message);
        })
        .finally(() => {
          setLoadingBankDetails(false);
        });
    } else {
      // Clear previous bank state when not on the banking tab or beneficiary changes
      setBankDetails(null);
      setBankDetailsError(null);
    }
  }, [activeTab, beneficiary.id]);

  useEffect(() => {
    setSelectedLetterStatus((beneficiary.acceptanceLetterStatus as any) || "NOT_SUBMITTED");
    setRemarksInput(beneficiary.acceptanceLetterRemarks || "");
  }, [beneficiary.acceptanceLetterStatus, beneficiary.acceptanceLetterRemarks]);

  const handleSaveLetterStatus = async () => {
    setIsUpdatingLetter(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admissions/acceptance/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: beneficiary.id,
          status: selectedLetterStatus,
          remarks: remarksInput
        })
      });
      if (!response.ok) {
        throw new Error("Unable to save acceptance letter status");
      }
      globalShowToast("Acceptance letter verified as " + selectedLetterStatus, "success");
      await onUpdate({
        acceptanceLetterStatus: selectedLetterStatus,
        acceptanceLetterRemarks: remarksInput,
        acceptanceLetterCheckedBy: session?.email || "anonymous",
        acceptanceLetterCheckedAt: new Date().toISOString()
      });
    } catch (e: any) {
      globalShowToast(e.message || "Failed to update status", "error");
    } finally {
      setIsUpdatingLetter(false);
    }
  };

  const [copiedLink, setCopiedLink] = useState(false);
  
  // Document automation engine state
  const [documentHistory, setDocumentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [loadingDocType, setLoadingDocType] = useState<string | null>(null);

  // Executive advanced UI states (Phase 2A Polish)
  const toasts: any[] = [];
  const setToasts = (val: any) => {};
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let localObjUrl: string | null = null;

    if (!previewDoc) {
      setPreviewError(null);
      return;
    }

    const getSafePdfUrl = (doc: any, isDownload: boolean = false) => {
      if (!doc || !doc.pdfUrl) return "";
      let url = doc.pdfUrl;
      if (url.startsWith("/api")) {
        url = `${API_BASE_URL}${url}`;
      }
      if (url.includes("simulation") || url.includes("/ideas-tvet/raw/upload") || url.includes("/api/documents/download")) {
        const typeTag = doc.documentType === "ADMISSION_LETTER" ? "admission"
                      : doc.documentType === "ACCEPTANCE_LETTER" ? "acceptance"
                      : doc.documentType === "ENROLLMENT_CONFIRMATION" ? "enrollment"
                      : doc.documentType === "COMPLETION_CERTIFICATE" ? "certificate"
                      : doc.documentType === "ADMISSION_FORM" ? "form"
                      : "document";
        return `${API_BASE_URL}/api/documents/download/${beneficiary.id}/${typeTag}?format=pdf&inline=${!isDownload}`;
      }
      return isDownload ? url.replace("inline=true", "inline=false") : url;
    };

    const fetchPdf = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const url = getSafePdfUrl(previewDoc, false);
        const response = await authFetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status} ${response.statusText})`);
        }
        
        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.toLowerCase().includes("application/pdf")) {
          const text = await response.text();
          let errMessage = "Received invalid response format from server instead of PDF.";
          try {
            const parsed = JSON.parse(text);
            errMessage = parsed.error || parsed.message || errMessage;
          } catch {
            if (text.includes("Authentication required") || text.includes("Please log in")) {
              errMessage = "Authentication required. Please log in.";
            } else if (text.trim().length > 0 && text.trim().length < 250) {
              errMessage = text.trim();
            }
          }
          throw new Error(errMessage);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error("The retrieved PDF document was empty (0 bytes).");
        }

        const objUrl = URL.createObjectURL(blob);
        localObjUrl = objUrl;

        if (active) {
          setPreviewObjectUrl(objUrl);
        } else {
          URL.revokeObjectURL(objUrl);
        }
      } catch (err: any) {
        if (active) {
          console.error("[PREVIEW_ERROR]:", err);
          setPreviewError(err.message || "An error occurred while loading the PDF document.");
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      active = false;
      if (localObjUrl) {
        URL.revokeObjectURL(localObjUrl);
      }
      setPreviewObjectUrl(null);
    };
  }, [previewDoc, beneficiary.id]);

  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState("ALL");
  const [generatingAll, setGeneratingAll] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<{ currentStep: string; percent: number } | null>(null);

  // Status ranks & helpers for document validation and workflow locking (Phase 3)
  const STATUS_RANK = useMemo(() => ({
    "DRAFT": 1,
    "PENDING": 1,
    "PENDING_PHOTO": 1,
    "UNDER_REVIEW": 1,
    "ADMITTED": 2,
    "ACCEPTED": 3,
    "VERIFIED": 3,
    "ENROLLED": 4,
    "IN_TRAINING": 4,
    "GRADUATED": 5,
    "ALUMNI": 5
  } as Record<string, number>), []);

  const getStatusRank = (status?: string): number => {
    if (!status) return 1;
    const upper = status.toUpperCase();
    if (STATUS_RANK[upper] !== undefined) {
      return STATUS_RANK[upper];
    }
    if (upper === "VERIFIED" || upper === "IN_TRAINING" || upper === "TRAINING IN PROGRESS") return 4; 
    return 1; 
  };

  const getDocLockReason = (docType: string, status?: string): string | null => {
    const rank = getStatusRank(status);
    
    if (docType === "ADMISSION_FORM") {
      return null;
    }
    if (docType === "ADMISSION_LETTER") {
      if (rank < 2) return "Required Status: ADMITTED";
    }
    if (docType === "ACCEPTANCE_LETTER") {
      if (rank < 3) return "Required Status: ACCEPTED";
    }
    if (docType === "ENROLLMENT_CONFIRMATION") {
      if (rank < 4) return "Required Status: ENROLLED";
    }
    if (docType === "COMPLETION_CERTIFICATE") {
      if (rank < 5) return "Required Status: GRADUATED";
    }
    return null;
  };

  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    title: string;
    missingFields: string[];
  }>({
    isOpen: false,
    title: "",
    missingFields: []
  });

  // Hardened Admission Acceptance State Transition States
  const [transitionModal, setTransitionModal] = useState<{
    isOpen: boolean;
    targetStatus: "Under Review" | "Accepted" | "Acceptance Rejected";
    title: string;
    description: string;
    requiresReason: boolean;
  } | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [transitionLoading, setTransitionLoading] = useState(false);

  // Undo tracker state
  const [undoState, setUndoState] = useState<{
    beneficiaryId: string;
    previousStatus: string;
    timestamp: number;
  } | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(10);

  // Beneficiary Lifecycle Governance Custom States
  const [lifecycleModal, setLifecycleModal] = useState<{
    isOpen: boolean;
    targetStatus: string;
    title: string;
    description: string;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  // Super Admin Workflow Rollback States
  const [rollbackTarget, setRollbackTarget] = useState<string>("");
  const [rollbackReason, setRollbackReason] = useState<string>("");
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);
  
  // Governance Sprint Custom States
  const [globalGovStats, setGlobalGovStats] = useState<any>(null);
  const [loadingGovStats, setLoadingGovStats] = useState<boolean>(false);
  const [selectedDocVersions, setSelectedDocVersions] = useState<any[] | null>(null);
  const [selectedDocTypeLabel, setSelectedDocTypeLabel] = useState<string>("");
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [rollbackNotes, setRollbackNotes] = useState<string>("");
  const [rollbackConfirmCheck, setRollbackConfirmCheck] = useState<boolean>(false);

  // Rollback confirmation dialog and outcome modal states
  const [showRollbackConfirmModal, setShowRollbackConfirmModal] = useState<boolean>(false);
  const [rollbackOutcomeModal, setRollbackOutcomeModal] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // Dependency scan hooks
  const [dependencyAnalysis, setDependencyAnalysis] = useState<any>(null);
  const [depAnalysisLoading, setDepAnalysisLoading] = useState<boolean>(false);
  const [subConfirmCheck, setSubConfirmCheck] = useState<boolean>(false);
  const [riskAcknowledgeCheck, setRiskAcknowledgeCheck] = useState<boolean>(false);

  const fetchDependencyAnalysis = async (targetVal: string) => {
    if (!beneficiary?.id || !targetVal) {
      setDependencyAnalysis(null);
      return;
    }
    setDepAnalysisLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/governance/dependency-analysis/${beneficiary.id}`);
      if (res.ok) {
        const body = await res.json();
        if (body.success) {
          setDependencyAnalysis(body.analysis);
          
          // Log ROLLBACK_IMPACT_REVIEWED
          await authFetch(`${API_BASE_URL}/api/governance/log-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "ROLLBACK_IMPACT_REVIEWED",
              beneficiaryId: beneficiary.id,
              riskLevel: body.analysis.governanceRiskLevel,
              reason: "Automated scan on rollback preview invocation",
              workflowVersion: body.analysis.workflowVersion,
              tokenVersion: body.analysis.tokenVersion,
              dependencyCounts: {
                documents: body.analysis.documentsAffected.total,
                certifications: body.analysis.certificationsAffected.certificateCount,
                toolkits: body.analysis.toolkitsAffected.toolkitsAffected,
                dispatches: body.analysis.dispatchesAffected.dispatchCount,
                evidence: body.analysis.evidenceAffected.impactRecordsAffected,
                financials: body.analysis.financialRecordsAffected.financialRecordsAffected,
                audits: body.analysis.auditReferencesAffected.auditReferencesAffected
              }
            })
          }).catch(() => {});

          // Log warning messages
          if (body.analysis.governanceRiskLevel === "HIGH") {
            await authFetch(`${API_BASE_URL}/api/governance/log-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "HIGH_RISK_ROLLBACK_WARNING",
                beneficiaryId: beneficiary.id,
                riskLevel: "HIGH",
                reason: `High risk evaluated for rollback target: ${targetVal}`,
                workflowVersion: body.analysis.workflowVersion,
                tokenVersion: body.analysis.tokenVersion,
                dependencyCounts: {}
              })
            }).catch(() => {});
          } else if (body.analysis.governanceRiskLevel === "CRITICAL") {
            await authFetch(`${API_BASE_URL}/api/governance/log-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "CRITICAL_RISK_ROLLBACK_WARNING",
                beneficiaryId: beneficiary.id,
                riskLevel: "CRITICAL",
                reason: `Critical risk evaluated for rollback target: ${targetVal}`,
                workflowVersion: body.analysis.workflowVersion,
                tokenVersion: body.analysis.tokenVersion,
                dependencyCounts: {}
              })
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Failed to load dependency analysis", err);
    } finally {
      setDepAnalysisLoading(false);
    }
  };

  const fetchGlobalGovStats = async () => {
    setLoadingGovStats(true);
    try {
      const res = await authFetch("/api/governance/global-stats");
      if (res.ok) {
        const data = await res.json();
        setGlobalGovStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch governance stats:", e);
    } finally {
      setLoadingGovStats(false);
    }
  };

  const handleExecuteRollback = async () => {
    if (!rollbackTarget) return;
    if (!rollbackReason || rollbackReason.trim() === "") {
      globalShowToast("A reason is required to execute a secure workflow rollback.", "error");
      return;
    }

    // Trigger enterprise workflow rollback confirmation dialog
    setShowRollbackConfirmModal(true);
  };

  const submitRollbackRequest = async () => {
    setShowRollbackConfirmModal(false);
    setRollbackLoading(true);
    try {
      const fullReason = rollbackReason + (rollbackNotes ? ` | Notes: ${rollbackNotes}` : "");
      const res = await authFetch(`${API_BASE_URL}/api/superadmin/beneficiaries/${beneficiary.id}/workflow-rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetState: rollbackTarget,
          reason: fullReason
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Rollback failed");
      }

      const result = await res.json();
      globalShowToast(`Successfully rolled back candidate to targeted stage: ${rollbackTarget}`, "success");

      // Log ROLLBACK_EXECUTED on backend
      await authFetch("/api/audit-logs/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ROLLBACK_EXECUTED",
          beneficiaryId: beneficiary.id,
          remarks: `Executed emergency workflow rollback to stage: ${rollbackTarget}. Reason: ${rollbackReason}`
        })
      }).catch(() => {});

      // Update local beneficiary object fields across parent state automatically
      await onUpdate({
        status: result.beneficiary.status,
        admissionStatus: result.beneficiary.admissionStatus,
        admissionFormStatus: result.beneficiary.admissionFormStatus,
        admissionFormCompleted: result.beneficiary.admissionFormCompleted,
        beneficiaryStatus: result.beneficiary.beneficiaryStatus,
        certificationStatus: result.beneficiary.certificationStatus,
        alumniStatus: result.beneficiary.alumniStatus,
        statusReason: fullReason,
        statusChangedBy: session?.email || "anonymous",
        statusChangedAt: new Date().toISOString(),
        tokenVersion: result.beneficiary.tokenVersion,
        workflowVersion: result.beneficiary.workflowVersion
      });

      // Refetch history data
      await fetchWorkflowHistory();
      await fetchDocumentHistory(true);
      await fetchAuditLogs();
      await fetchGlobalGovStats();
      
      // Show success modal
      setRollbackOutcomeModal({
        isOpen: true,
        type: "success",
        title: "Rollback Completed",
        message: "The beneficiary lifecycle has been successfully rolled back. All governance actions have been recorded."
      });

      // Reset inputs
      setRollbackTarget("");
      setRollbackReason("");
      setRollbackNotes("");
      setRollbackConfirmCheck(false);
    } catch (e: any) {
      console.error("[Rollback Action] Failed:", e);
      globalShowToast(e.message || "Failed to execute workflow rollback.", "error");
      
      // Show error modal
      setRollbackOutcomeModal({
        isOpen: true,
        type: "error",
        title: "Rollback Authorization Failed",
        message: e.message || "Failed to execute workflow rollback.",
        details: "An issue occurred while processing the rollback state machine request. Please check permissions and input constraints."
      });
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleTriggerLifecycle = (status: string, title: string, description: string) => {
    setLifecycleReason("");
    setLifecycleModal({
      isOpen: true,
      targetStatus: status,
      title,
      description
    });
  };

  const handleConfirmLifecycleChange = async () => {
    if (!lifecycleModal) return;
    if (!lifecycleReason || lifecycleReason.trim() === "") {
      globalShowToast("A reason is required to perform status audits.", "error");
      return;
    }

    setLifecycleLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/beneficiaries/${beneficiary.id}/lifecycle-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStatus: lifecycleModal.targetStatus,
          reason: lifecycleReason
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to update lifecycle status");
      }

      globalShowToast(`Lifecycle state successfully transitioned to: ${lifecycleModal.targetStatus}`, "success");
      
      await onUpdate({
        beneficiaryStatus: lifecycleModal.targetStatus,
        statusReason: lifecycleReason,
        statusChangedBy: session?.email || "anonymous",
        statusChangedAt: new Date().toISOString()
      });

      await fetchWorkflowHistory();
      setLifecycleModal(null);
    } catch (e: any) {
      globalShowToast(e.message || "Failed to update lifecycle status.", "error");
    } finally {
      setLifecycleLoading(false);
    }
  };

  useEffect(() => {
    if (!undoState) return;
    
    setUndoCountdown(10);
    const interval = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setUndoState(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [undoState]);

  const handleStatusTransition = async (
    targetStatus: "Under Review" | "Accepted" | "Acceptance Rejected",
    reason: string = ""
  ) => {
    setTransitionLoading(true);
    const oldStatus = beneficiary.admissionStatus || "Pending";
    try {
      const res = await authFetch("/api/admissions/transition-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: beneficiary.id,
          newStatus: targetStatus,
          reason: reason || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedBeneficiary = data.beneficiary;
        
        // Success Toast
        showToast(
          `Trainee status transitioned to '${targetStatus === "Acceptance Rejected" ? "Acceptance Rejected" : targetStatus}' successfully!`, 
          "success"
        );
        
        // Save previous status in undo tracker before applying update
        setUndoState({
          beneficiaryId: beneficiary.id,
          previousStatus: oldStatus,
          timestamp: Date.now()
        });

        // Trigger parent state update
        await onUpdate(updatedBeneficiary);
        setTransitionModal(null);
        setTransitionReason("");
        setRejectionMode(false);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to process transition.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("A system error occurred during state transition.", "error");
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleUndoStatus = async () => {
    if (!undoState) return;
    const targetStatus = undoState.previousStatus;
    showToast(`Undoing and reverting status back to '${targetStatus}'...`, "info");
    
    try {
      const res = await authFetch("/api/admissions/transition-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: undoState.beneficiaryId,
          newStatus: targetStatus,
          isUndo: true,
          reason: "Operator initiated instant workflow undo."
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast("Workflow transition reverted successfully!", "success");
        await onUpdate(data.beneficiary);
        setUndoState(null); // Clear undo state
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to execute undo reversion.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("A system error occurred while undoging.", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "success") => {
    globalShowToast(message, type);
  };

  const fetchDocumentHistory = async (silently: boolean = false) => {
    if (!silently) setLoadingHistory(true);
    try {
      const res = await authFetch(`/api/documents/${beneficiary.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setDocumentHistory(data);
        if (!silently) showToast("Records loaded successfully.", "success");
      }
    } catch (e) {
      console.error("Failed to load document version history:", e);
      showToast("Could not contact candidate records service.", "error");
    } finally {
      if (!silently) setLoadingHistory(false);
    }
  };

  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistory[]>([]);
  const [loadingWorkflow, setLoadingWorkflow] = useState<boolean>(false);

  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [loadingDeliveryLogs, setLoadingDeliveryLogs] = useState<boolean>(false);

  const fetchDeliveryLogs = async (silently: boolean = false) => {
    if (!silently) setLoadingDeliveryLogs(true);
    try {
      const res = await authFetch(`/api/documents/delivery-logs/${beneficiary.id}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveryLogs(data);
      }
    } catch (e) {
      console.error("Failed to load delivery logs:", e);
    } finally {
      if (!silently) setLoadingDeliveryLogs(false);
    }
  };

  const trackDocumentActivity = async (documentId: string, deliveryType: "Downloaded" | "Viewed", recipient: string, status: string) => {
    try {
      await authFetch("/api/documents/track", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({
          documentId,
          beneficiaryId: beneficiary.id,
          deliveryType,
          recipient,
          sentBy: session?.email || session?.username || "SYSTEM_USER",
          status
        })
      });
      await fetchDeliveryLogs(true);
    } catch (e) {
      console.error("Failed to track document activity:", e);
    }
  };

  const fetchWorkflowHistory = async (silently: boolean = false) => {
    if (!silently) setLoadingWorkflow(true);
    try {
      const res = await authFetch(`/api/beneficiaries/${beneficiary.id}/workflow-history`);
      if (res.ok) {
        const data = await res.json();
        setWorkflowHistory(data);
      }
    } catch (e) {
      console.error("Failed to load workflow history:", e);
    } finally {
      if (!silently) setLoadingWorkflow(false);
    }
  };

  const handleGenerateDoc = async (documentType: string, regenerate: boolean) => {
    if (documentType === "ADMISSION_FORM") {
      const missing: string[] = [];
      if (!beneficiary.dateOfBirth) missing.push("Date of Birth (DOB)");
      if (!beneficiary.nin) missing.push("National Identity Number (NIN)");
      if (!beneficiary.phoneNumber) missing.push("Trainee Phone Number");
      if (!beneficiary.guardianName) missing.push("Guardian Name");
      if (!beneficiary.guardianPhone) missing.push("Guardian Phone");
      if (!beneficiary.bankName || !beneficiary.bankAccountNumber || !beneficiary.bankAccountHolder) {
        missing.push("Bank Details (Bank Name, Account Number, and Account Holder Name)");
      }

      if (missing.length > 0) {
        setValidationModal({
          isOpen: true,
          title: "Admission Form cannot be generated because required fields are missing.",
          missingFields: missing
        });
        return;
      }
    }

    setLoadingDocType(`${documentType}_${regenerate ? 'regen' : 'gen'}`);
    showToast(`Compiling ${documentType.replace(/_/g, " ")} matching state data...`, "info");
    try {
      const res = await authFetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({
          beneficiaryId: beneficiary.id,
          documentType,
          regenerate
        })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchDocumentHistory(true);
        showToast(`${documentType.replace(/_/g, " ")} completed successfully! Assigned Version v${data.document.version}.`, "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed compiling document.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("A system error occurred during PDF compiling.", "error");
    } finally {
      setLoadingDocType(null);
    }
  };

  const handleSendDocEmail = async (documentId: string) => {
    setLoadingDocType(`email_${documentId}`);
    showToast("Preparing secure dispatch package...", "info");
    try {
      const res = await authFetch("/api/documents/email", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({ documentId })
      });
      if (res.ok) {
        showToast("E-mail with secure download link successfully dispatched to candidate.", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed dispatching email.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("System failed sending document notification.", "error");
    } finally {
      setLoadingDocType(null);
    }
  };

  // Memoized filtered history for both UI list and CSV export actions
  const filteredHistory = useMemo(() => {
    return documentHistory.filter(doc => {
      const docName = doc.documentType?.replace(/_/g, " ") || "";
      const matchesSearch = 
        (doc.generatedBy?.toLowerCase() || "").includes(ledgerSearch.toLowerCase()) || 
        (doc.documentType?.toLowerCase() || "").includes(ledgerSearch.toLowerCase()) ||
        docName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        (doc.verificationCode?.toLowerCase() || "").includes(ledgerSearch.toLowerCase());
      const matchesFilter = ledgerFilter === "ALL" || doc.documentType === ledgerFilter;
      return matchesSearch && matchesFilter;
    });
  }, [documentHistory, ledgerSearch, ledgerFilter]);

  const handleGenerateAllDocs = async () => {
    if (generatingAll) return;
    setGeneratingAll(true);
    setGenerationProgress({ currentStep: "Initializing engine...", percent: 5 });
    showToast("Beginning sequential multi-document compilation...", "info");

    const documentsToBuild = [
      { key: "ADMISSION_LETTER", label: "Admission Letter" },
      { key: "ACCEPTANCE_LETTER", label: "Acceptance Letter" },
      { key: "ADMISSION_FORM", label: "Admission Form" },
      { key: "PHOTO_ALBUM", label: "Photo Album" }
    ];

    try {
      for (let i = 0; i < documentsToBuild.length; i++) {
        const doc = documentsToBuild[i];
        const stepNum = i + 1;
        const progressPct = Math.round(((i) / documentsToBuild.length) * 100);
        
        setGenerationProgress({ 
          currentStep: `Compiling ${doc.label} (Step ${stepNum} of 4)...`, 
          percent: progressPct 
        });

        const exists = documentHistory.some(h => h.documentType === doc.key);

        const res = await authFetch("/api/documents/generate", {
          method: "POST",
          headers: { "Content-Type" : "application/json" },
          body: JSON.stringify({
            beneficiaryId: beneficiary.id,
            documentType: doc.key,
            regenerate: exists
          })
        });

        if (res.ok) {
          showToast(`Successfully processed: ${doc.label}`, "success");
        } else {
          showToast(`Skipped/Failed ${doc.label}. Continuous execution online.`, "error");
        }

        await new Promise(resolve => setTimeout(resolve, 800));
      }

      setGenerationProgress({ currentStep: "All compiled successfully!", percent: 100 });
      showToast("Dynamic Generation Suite complete!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Sequential execution failed.", "error");
    } finally {
      // Refresh ledger after completion
      await fetchDocumentHistory(true);
      setTimeout(() => {
        setGeneratingAll(false);
        setGenerationProgress(null);
      }, 1500);
    }
  };

  const handleExportLedgerCSV = () => {
    if (filteredHistory.length === 0) {
      showToast("No filtered ledger records available to export.", "info");
      return;
    }
    const headers = ["Document Type", "Version", "Generated By", "Created At", "PDF URL"];
    const rows = filteredHistory.map((doc) => [
      doc.documentType ? doc.documentType.replace(/_/g, " ") : "",
      `v${doc.version}`,
      doc.generatedBy || "N/A",
      new Date(doc.createdAt).toISOString(),
      doc.pdfUrl || ""
    ]);
    
    // Safely wrap fields in double quotes and build content
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ideas_filtered_document_ledger_${beneficiary.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Document Ledger CSV exported successfully for currently filtered rows!", "success");
  };

  // Admin decision states
  const [rejectionMode, setRejectionMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textarea);
    }
  };

  const copySecureResponseLink = async () => {
    try {
      const res = await authFetch(`/api/admissions/secure-link?beneficiaryId=${beneficiary.id}&origin=${encodeURIComponent(window.location.origin)}`);
      if (res.ok) {
        const data = await res.json();
        const safeLink = String(data.secureLink || "").trim();
        copyToClipboard(safeLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        showToast("Secure response link copied to clipboard successfully!", "success");
      } else {
        showToast("Failed to retrieve the secure response link.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("A system network error occurred while retrieving secure link.", "error");
    }
  };

  // Load email service health metrics
  const fetchEmailHealth = async () => {
    try {
      const res = await authFetch("/api/admissions/email-health");
      if (res.ok) {
        const data = await res.json();
        setEmailHealth(data);
      }
    } catch (e) {
      console.error("Failed to load SMTP health status details:", e);
    }
  };

  useEffect(() => {
    fetchEmailHealth();
  }, []);

  useEffect(() => {
    if (beneficiary?.id) {
      fetchDocumentHistory();
      fetchWorkflowHistory();
      fetchDeliveryLogs();
    }
  }, [beneficiary?.id, beneficiary?.status]);

  // Admin validation actions
  const approveVerification = () => {
    setTransitionModal({
      isOpen: true,
      targetStatus: "Accepted",
      title: "Approve & Accept Trainee",
      description: "Are you sure you want to approve and verify this trainee? This will mark them as Accepted and compile their official enrollment confirmation.",
      requiresReason: false
    });
  };

  const submitRejection = () => {
    setTransitionModal({
      isOpen: true,
      targetStatus: "Acceptance Rejected",
      title: "Decline/Reject Acceptance Documents",
      description: "Please specify a clear reason for rejecting this candidate's signed acceptance letter or biometrics profiles.",
      requiresReason: true
    });
  };

  const markUnderReview = () => {
    setTransitionModal({
      isOpen: true,
      targetStatus: "Under Review",
      title: "Mark Under Review",
      description: "Move this candidate to Under Review to audit their submitted credentials?",
      requiresReason: false
    });
  };

  const revokeApproval = () => {
    setTransitionModal({
      isOpen: true,
      targetStatus: "Under Review",
      title: "Revoke Acceptance Approval",
      description: "Are you sure you want to revoke acceptance approval? This action will set the candidate status back to Under Review.",
      requiresReason: false
    });
  };

  const reopenReview = () => {
    setTransitionModal({
      isOpen: true,
      targetStatus: "Under Review",
      title: "Reopen Candidate Review",
      description: "Reopen review for this rejected candidate? This will transition their status back to Under Review.",
      requiresReason: false
    });
  };
  
  // Local states for inputs to avoid typing lag
  const [formFields, setFormFields] = useState({
    emergencyName: beneficiary.admissionFormData?.emergencyName || "",
    emergencyPhone: beneficiary.admissionFormData?.emergencyPhone || "",
    guardianName: beneficiary.admissionFormData?.guardianName || "",
    highestQualification: beneficiary.admissionFormData?.highestQualification || "SSCE",
    priorKnowledge: beneficiary.admissionFormData?.priorKnowledge || "Beginner",
    medicalDeclaration: beneficiary.admissionFormData?.medicalDeclaration || false,
  });

  // Attendance log inputs
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceStatus, setAttendanceStatus] = useState<"Present" | "Absent" | "Excused">("Present");
  const [realAttendanceRecords, setRealAttendanceRecords] = useState<any[]>([]);

  const fetchRealAttendance = async () => {
    try {
      const res = await authFetch(`/api/attendance/history/${beneficiary.id}`);
      if (res.ok) {
        const data = await res.json();
        setRealAttendanceRecords(data.attendanceHistory || []);
      }
    } catch (e) {
      console.error("Failed to load attendance history:", e);
    }
  };

  useEffect(() => {
    fetchRealAttendance();
  }, [beneficiary.id, activeTab]);

  // Load audit logs strictly for this candidate
  useEffect(() => {
    fetchAuditLogs();
  }, [beneficiary.id]);

  useEffect(() => {
    // Keep local form in sync if beneficiary loads later
    setFormFields({
      emergencyName: beneficiary.admissionFormData?.emergencyName || "",
      emergencyPhone: beneficiary.admissionFormData?.emergencyPhone || "",
      guardianName: beneficiary.admissionFormData?.guardianName || "",
      highestQualification: beneficiary.admissionFormData?.highestQualification || "SSCE",
      priorKnowledge: beneficiary.admissionFormData?.priorKnowledge || "Beginner",
      medicalDeclaration: beneficiary.admissionFormData?.medicalDeclaration || false,
    });
  }, [beneficiary]);

  const fetchAuditLogs = async () => {
    try {
      const res = await authFetch("/api/audit-logs");
      if (res.ok) {
        const data = await res.json();
        // Filter actions belonging to this beneficiary id or matching full name
        const filtered = data.filter((log: AuditLog) => 
          log.details.includes(beneficiary.id) || 
          log.details.toLowerCase().includes(beneficiary.firstName.toLowerCase()) ||
          log.details.toLowerCase().includes(beneficiary.lastName.toLowerCase())
        );
        setAuditLogs(filtered);
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    }
  };

  const logActionToBackend = async (action: string, details: string) => {
    // Simulation updates candidate state directly while pushing an update
    // The server automatically logs "BENEFICIARY_UPDATE" when PUT api is called
    await fetchAuditLogs();
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert files to base64
  const processFile = (file: File, type: string) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      const updatedDocs = [...(beneficiary.documentsList || [])];
      const existIndex = updatedDocs.findIndex(d => d.type === type);
      
      const newDoc = {
        id: "doc_" + Date.now(),
        name: file.name,
        type,
        url: base64,
        uploadedAt: new Date().toISOString()
      };

      if (existIndex !== -1) {
        updatedDocs[existIndex] = newDoc;
      } else {
        updatedDocs.push(newDoc);
      }

      const updates: Partial<Beneficiary> = {
        documentsList: updatedDocs
      };

      // Also auto update specific quick handles
      if (type === "acceptance") {
        updates.acceptanceLetterUploaded = true;
        updates.acceptanceLetterUrl = base64;
        updates.acceptanceLetterUploadedAt = new Date().toISOString();
        if (beneficiary.admissionStatus === "Acceptance Pending" || !beneficiary.admissionStatus) {
          updates.admissionStatus = "Accepted";
        }
      }

      await onUpdate(updates);
      await logActionToBackend("DOCUMENT_UPLOAD", `Uploaded verified document scan (${type}): ${file.name} for candidate ID ${beneficiary.id}`);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  // Drag and Drop mechanics
  const handleDrag = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(type);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], type);
    }
  };

  const deleteDocument = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the document: "${name}"?`)) return;
    
    const updatedDocs = (beneficiary.documentsList || []).filter(d => d.id !== id);
    const updates: Partial<Beneficiary> = {
      documentsList: updatedDocs
    };

    // If deleting acceptance letter
    const targetDoc = (beneficiary.documentsList || []).find(d => d.id === id);
    if (targetDoc?.type === "acceptance") {
      updates.acceptanceLetterUploaded = false;
      updates.acceptanceLetterUrl = undefined;
      updates.acceptanceLetterUploadedAt = undefined;
    }

    await onUpdate(updates);
    await logActionToBackend("DOCUMENT_DELETE", `Removed document scan (${name}) for candidate ID ${beneficiary.id}`);
  };

  // Admission Workflow Triggers
  const generateAdmissionLetter = async () => {
    setIsUpdatingLetter(true);
    try {
      const res = await authFetch("/api/admissions/regenerate-offer-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId: beneficiary.id })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.beneficiary) {
          await onUpdate(data.beneficiary);
        }
        showToast("Offer letter package regenerated successfully!", "success");
        await logActionToBackend("ADMISSION_LETTER_GENERATE", `Regenerated official TVET admission offer package for candidate ID ${beneficiary.id}`);
      } else {
        if (data.error === "PDF_RENDER_UNAVAILABLE" || (data.error && data.error.includes("PDF_RENDER_UNAVAILABLE"))) {
          showToast("PDF renderer is not available on the server. The offer was not regenerated. Please retry after renderer setup is complete.", "error");
        } else {
          showToast(data.error || "Failed to regenerate offer package.", "error");
        }
      }
    } catch (e: any) {
      console.error(e);
      showToast("Network error regenerating offer package.", "error");
    } finally {
      setIsUpdatingLetter(false);
    }
  };

  const sendAdmissionLetter = async () => {
    setEmailStatus("sending");
    try {
      // Auto generate admission letter credentials if not already processed
      if (!beneficiary.admissionRef) {
        const autoRef = `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
        await onUpdate({
          admissionStatus: "Admission Generated",
          admissionRef: autoRef,
          admissionLetterGeneratedAt: new Date().toISOString(),
          status: ProgramStatus.VERIFIED
        });
      }

      const res = await authFetch("/api/admissions/send-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: beneficiary.id,
          origin: window.location.origin
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          setEmailStatus("sent");
          if (data.beneficiary) {
            await onUpdate(data.beneficiary);
          }
          if (data.pdfRendererUnavailable) {
            showToast("Offer email sent with secure link. Official PDF attachments are pending until the renderer is restored.", "warning");
          } else {
            showToast(`Offer letter dispatched successfully! Student Link: ${data.secureLink || ""}`, "success");
          }
        } else {
          setEmailStatus("idle");
          if (data.beneficiary) {
            await onUpdate(data.beneficiary);
          }
          console.error("Offer dispatch failed:", data.error || data.smtpErrorDetails);
          if (data.pdfRendererUnavailable) {
            showToast("Offer link was prepared, but email delivery failed.", "error");
          } else if (data.error === "PDF_RENDER_UNAVAILABLE") {
            showToast(data.message || "Offer link is ready, but official letters could not be generated. Please retry PDF generation after renderer is restored.", "error");
          } else {
            showToast("Offer link was prepared, but email delivery failed.", "error");
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Backend error dispatching offer:", err);
        showToast("Offer link was prepared, but email delivery failed.", "error");
        setEmailStatus("idle");
      }
    } catch (e) {
      console.error("Network error dispatching offer:", e);
      showToast("Offer email could not be sent. Please retry or contact the administrator.", "error");
      setEmailStatus("idle");
    }
  };

  const acceptAdmissionDirectly = async () => {
    await onUpdate({
      admissionStatus: "Enrolled",
      status: ProgramStatus.IN_TRAINING,
      trainingProgress: {
        totalRequiredHours: 90,
        hoursCompleted: beneficiary.trainingProgress?.hoursCompleted || 0,
        completionStatus: "In Progress"
      }
    });
    await logActionToBackend("ADMISSION_ACCEPTED", `Admission officially accepted. Trainee cohort status elevated to ENROLLED for candidate ID ${beneficiary.id}`);
  };

  // Unlock Admission Form
  const unlockAdmissionForm = async () => {
    try {
      const res = await authFetch(`/api/admissions/${beneficiary.id}/unlock-form`, {
        method: "POST"
      });
      if (res.ok) {
        showToast("Admission form unlocked successfully for candidate edits.", "success");
        await onUpdate({
          admissionFormCompleted: false,
          admissionFormStatus: "IN_PROGRESS"
        });
        await fetchWorkflowHistory(true);
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to unlock admission form.", "error");
      }
    } catch (err) {
      console.error("Unlock form error:", err);
      showToast("Network error trying to unlock form.", "error");
    }
  };

  // Forms Submissions
  const saveAdmissionForm = async (status: "Draft" | "Verified") => {
    await onUpdate({
      admissionFormCompleted: status === "Verified",
      admissionFormStatus: status,
      admissionFormData: {
        ...formFields,
        submissionDate: new Date().toISOString()
      },
      // Automatically advance status if form verified
      ...(status === "Verified" && beneficiary.admissionStatus === "Admitted" ? { admissionStatus: "Admission Sent" } : {})
    });
    await logActionToBackend("ADMISSION_FORM_SAVE", `Saved admission registration profile form data as: [${status.toUpperCase()}] for candidate ID ${beneficiary.id}`);
    showToast(`Admission registration form data saved successfully as ${status}!`, "success");
  };

  // Logging Daily Attendance
  const addAttendanceLog = async () => {
    if (!attendanceDate) return;
    try {
      const apiStatus = attendanceStatus.toUpperCase();
      const res = await authFetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id: beneficiary.id,
          attendance_date: attendanceDate,
          status: apiStatus,
          check_in_time: apiStatus === "PRESENT" || apiStatus === "LATE" ? `${attendanceDate}T08:00:00Z` : null,
          check_out_time: apiStatus === "PRESENT" || apiStatus === "LATE" ? `${attendanceDate}T16:00:00Z` : null,
          attendance_source: "MANUAL"
        })
      });

      if (res.ok) {
        showToast("Attendance saved securely to database.", "success");
        await fetchRealAttendance();
        await logActionToBackend("ATTENDANCE_LOGGED", `Logged daily attendance for Trainee (${attendanceStatus}) for date: ${attendanceDate}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to mark attendance.", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Network error marking attendance", "error");
    }
  };

  const removeAttendanceLog = async (id: string, date: string) => {
    if (!confirm(`Are you sure you want to remove the attendance log for date ${date}?`)) return;
    try {
      const res = await authFetch(`/api/attendance/${id}?beneficiaryId=${beneficiary.id}&date=${date}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Attendance record removed.", "success");
        await fetchRealAttendance();
        await logActionToBackend("ATTENDANCE_REMOVED", `Deleted daily attendance log record from date: ${date}. Candidate ID: ${beneficiary.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to remove record.", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Network error removing attendance", "error");
    }
  };

  // Generate simple printable view for A4 letter
  const printAdmissionLetter = async () => {
    setPreviewDoc({
      id: `preview_adm_${beneficiary.id}`,
      documentType: "ADMISSION_LETTER",
      version: 1,
      pdfUrl: `${API_BASE_URL}/api/documents/download/${beneficiary.id}/admission?format=pdf&inline=true`,
      generatedBy: "System Operator",
      createdAt: new Date().toISOString()
    });
  };

  // Generate simple printable view for Form
  const printAdmissionForm = () => {
    setPreviewDoc({
      id: `preview_frm_${beneficiary.id}`,
      documentType: "ADMISSION_FORM",
      version: 1,
      pdfUrl: `${API_BASE_URL}/api/admissions/${beneficiary.id}/form/pdf`,
      generatedBy: "System Operator",
      createdAt: new Date().toISOString()
    });
  };

  // Derived variables for quick tab handles
  const documentsList = beneficiary.documentsList || [];
  const attendanceLogs = beneficiary.attendanceLogs || [];
  const training = beneficiary.trainingProgress || { totalRequiredHours: 90, hoursCompleted: 0, completionStatus: "Not Started" };
  const hoursPercent = Math.min(100, Math.round(((training.hoursCompleted || 0) / (training.totalRequiredHours || 90)) * 100));

  // Determine current active workflow Index
  const workflowSteps = [
    { key: "Draft", label: "Draft" },
    { key: "Admission Generated", label: "Admission Gen" },
    { key: "Admission Sent", label: "Admission Sent" },
    { key: "Offer Viewed", label: "Offer Viewed" },
    { key: "Acceptance Pending", label: "Acceptance Pend" },
    { key: "Acceptance Uploaded", label: "Acceptance Up" },
    { key: "Under Review", label: "Under Review" },
    { key: "Accepted", label: "Accepted" },
    { key: "Enrolled", label: "Enrolled" },
    { key: "Training In Progress", label: "In Training" },
    { key: "Training Completed", label: "Completed" },
    { key: "Certified", label: "Certified" },
    { key: "Alumni", label: "Alumni" }
  ];
  
  const currentStatus = (beneficiary.admissionStatus || "Draft") as string;
  let displayStatus = currentStatus;
  if (currentStatus === "Pending") {
    displayStatus = "Draft";
  } else if (currentStatus === "Admitted") {
    displayStatus = "Admission Generated";
  } else if (currentStatus === "Acceptance Rejected") {
    displayStatus = "Admission Sent";
  } else if (currentStatus === "Completed") {
    displayStatus = "Training Completed";
  } else if (currentStatus === "Acceptance Sent") {
    displayStatus = "Acceptance Uploaded";
  }
  const currentStepIndex = workflowSteps.findIndex(s => s.key === displayStatus);

  return (
    <div className="space-y-6 font-sans select-none max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Dynamic Toast Notification Overlay */}
      <div className="fixed bottom-5 right-5 z-[9999] p-4 pointer-events-none flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-medium flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 ${
              t.type === "success" 
                ? "bg-emerald-50 border-emerald-150 text-emerald-900" 
                : t.type === "error"
                ? "bg-rose-50 border-rose-150 text-rose-900"
                : "bg-indigo-50 border-indigo-150 text-indigo-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2 cursor-pointer bg-transparent border-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  Document Preview Tool
                </h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase">
                  {previewDoc.documentType.replace(/_/g, " ")} • Version v{previewDoc.version}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition border-0 bg-transparent flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 bg-slate-100 relative p-2 min-h-0 flex flex-col items-center justify-center">
              {previewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 z-10 gap-2">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold text-slate-600 font-mono uppercase tracking-wider">Compiling & Loading PDF...</span>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 text-red-800 p-4 z-10 text-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-500 animate-bounce" />
                  <div className="text-xs font-bold font-mono">PREVIEW COMPILATION ERROR</div>
                  <div className="text-xs font-mono max-w-md bg-white border border-red-200 p-3 rounded shadow-xs overflow-auto max-h-40">{previewError}</div>
                  <button
                    onClick={() => {
                      setPreviewDoc({ ...previewDoc });
                    }}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition"
                  >
                    Retry Loading
                  </button>
                </div>
              )}
              <iframe
                title="PDF Document Preview"
                src={previewObjectUrl || "about:blank"}
                className="w-full h-full border-0 rounded-lg shadow-inner"
              />
            </div>

            {/* Footer Metadata & Actions */}
            <div className="p-4 bg-white border-t border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[10px]">
              <div className="font-mono text-slate-500 space-y-0.5">
                <div>Compiled on: <span className="font-bold text-slate-700">{new Date(previewDoc.createdAt).toLocaleString("en-GB")}</span></div>
                <div>Recorded by operator: <span className="font-bold text-slate-700">{previewDoc.generatedBy}</span></div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={previewObjectUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-1 sm:flex-none text-center bg-slate-150 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-lg cursor-pointer transition ${!previewObjectUrl ? "pointer-events-none opacity-50" : ""}`}
                >
                  Open In New Tab
                </a>
                <a
                  href={previewObjectUrl || "#"}
                  download={`${(beneficiary.firstName || "TRAINEE").toUpperCase()}_${(beneficiary.lastName || "").toUpperCase()}_${(previewDoc.documentType || "DOCUMENT").toUpperCase()}.pdf`}
                  className={`flex-1 sm:flex-none text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg cursor-pointer transition shadow-xs ${!previewObjectUrl ? "pointer-events-none opacity-50" : ""}`}
                >
                  Download PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admission Form Validation Modal (Phase 4) */}
      {validationModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-xs font-bold uppercase tracking-tight">
                  Validation Error
                </h4>
              </div>
              <button
                onClick={() => setValidationModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition border-0 bg-transparent flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                {validationModal.title}
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                  Missing Required Fields:
                </span>
                <ul className="list-disc list-inside text-xs text-slate-600 font-sans space-y-1">
                  {validationModal.missingFields.map((field, i) => (
                    <li key={i}>{field}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                Please edit the beneficiary details and complete these mandatory fields before compiling the Admission Form.
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end">
              <button
                onClick={() => setValidationModal(prev => ({ ...prev, isOpen: false }))}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle Status Change Audit Modal */}
      {lifecycleModal && lifecycleModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-2 text-indigo-950">
                <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h4 className="text-xs font-bold uppercase tracking-tight font-mono text-slate-800">
                  {lifecycleModal.title}
                </h4>
              </div>
              <button
                onClick={() => setLifecycleModal(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition border-0 bg-transparent flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs text-slate-700 leading-relaxed font-sans">
                {lifecycleModal.description}
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Trainee Name:</span>
                  <span className="font-sans font-bold text-slate-800">{beneficiary.firstName} {beneficiary.lastName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Current State:</span>
                  <span className={`px-2 py-0.5 rounded font-bold border font-sans uppercase text-[10px] ${
                    getLifecycleStatusBadge(beneficiary.beneficiaryStatus).bg
                  }`}>
                    {getLifecycleStatusBadge(beneficiary.beneficiaryStatus).label}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold text-indigo-600">Proposed State:</span>
                  <span className={`px-2 py-0.5 rounded font-bold border font-sans uppercase text-[10px] ${
                    getLifecycleStatusBadge(lifecycleModal.targetStatus).bg
                  }`}>
                    {getLifecycleStatusBadge(lifecycleModal.targetStatus).label}
                  </span>
                </div>
              </div>

              {/* Status Reason Audit Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                  Status Transition Reason (MANDATORY AUDIT PARAMETER)
                </label>
                <textarea
                  value={lifecycleReason}
                  onChange={(e) => setLifecycleReason(e.target.value)}
                  placeholder="Provide detailed, professional feedback on why this programmatic status update is being made for central auditing..."
                  rows={4}
                  className="w-full text-xs font-sans rounded-xl border border-slate-200 p-3 bg-slate-50/50 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition leading-relaxed text-slate-800"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">Governance Notice</span>
                  <p className="text-[10px] text-amber-700 leading-relaxed font-sans">
                    This transition will make permanent state changes. Your biometric/operator credentials, IP coordinate, and audit trace details will be stored securely in the Immutable Central Ledger.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLifecycleModal(null)}
                disabled={lifecycleLoading}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs uppercase tracking-wider font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLifecycleChange}
                disabled={lifecycleLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-2 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {lifecycleLoading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  "Confirm Transition"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Header & Navigation Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            <span>Beneficiaries</span>
            <span>/</span>
            <span className="text-slate-600 font-semibold">{beneficiary.firstName} {beneficiary.lastName}</span>
            <span>/</span>
            <span className="text-indigo-600 font-bold uppercase">{activeTab} Mode</span>
          </div>
          <h2 className="text-xl font-display font-medium text-slate-800 uppercase tracking-tight scale-y-[101%]">
            Beneficiary Portfolio Workspace
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onBack}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition outline-none cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
          
          <div className={`p-0.5 rounded-lg border flex items-center gap-1 bg-white ${
            beneficiary.status === ProgramStatus.PENDING
              ? "border-yellow-200 text-yellow-700 bg-yellow-50/50"
              : beneficiary.status === ProgramStatus.ADMITTED
              ? "border-orange-200 text-orange-700 bg-orange-50/50"
              : beneficiary.status === ProgramStatus.ACCEPTED
              ? "border-teal-200 text-teal-700 bg-teal-50/50"
              : beneficiary.status === ProgramStatus.ENROLLED
              ? "border-blue-200 text-blue-700 bg-blue-50/50"
              : beneficiary.status === ProgramStatus.GRADUATED
              ? "border-emerald-250 text-emerald-700 bg-emerald-50/50"
              : "border-slate-200 text-slate-700 bg-slate-50/10"
          }`}>
            <span className={`h-2 w-2 rounded-full ml-1.5 shrink-0 ${
              beneficiary.status === ProgramStatus.PENDING
                ? "bg-yellow-500 animate-pulse"
                : beneficiary.status === ProgramStatus.ADMITTED
                ? "bg-orange-500 animate-pulse"
                : beneficiary.status === ProgramStatus.ACCEPTED
                ? "bg-teal-500 animate-pulse"
                : beneficiary.status === ProgramStatus.ENROLLED
                ? "bg-blue-500 animate-pulse"
                : beneficiary.status === ProgramStatus.GRADUATED
                ? "bg-emerald-500 animate-pulse"
                : "bg-slate-500"
            }`}></span>
            
            <select
              value={beneficiary.status}
              disabled={transitionLoading}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setTransitionLoading(true);
                try {
                  if (onUpdate) {
                    await onUpdate({ status: newStatus as any });
                    showToast(`Status updated successfully to ${newStatus}`, "success");
                  }
                } catch (err) {
                  showToast("Failed to update status", "error");
                } finally {
                  setTransitionLoading(false);
                }
              }}
              className="bg-transparent text-xs font-bold py-1 pl-1 pr-2 border-0 outline-none focus:ring-0 focus:outline-none cursor-pointer text-inherit"
            >
              <option value="PENDING" className="text-slate-800 bg-white leading-normal">PENDING</option>
              <option value="ADMITTED" className="text-slate-800 bg-white leading-normal">ADMITTED</option>
              <option value="ACCEPTED" className="text-slate-800 bg-white leading-normal">ACCEPTED</option>
              <option value="ENROLLED" className="text-slate-800 bg-white leading-normal">ENROLLED</option>
              <option value="GRADUATED" className="text-slate-800 bg-white leading-normal">GRADUATED</option>
              {beneficiary.status && !["PENDING", "ADMITTED", "ACCEPTED", "ENROLLED", "GRADUATED"].includes(beneficiary.status) && (
                <option value={beneficiary.status} className="text-slate-800 bg-white leading-normal">{beneficiary.status}</option>
              )}
            </select>
          </div>

          <div className="font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border bg-indigo-50 text-indigo-750 border-indigo-200">
            <span className="font-mono text-[9px] uppercase text-indigo-400 font-bold">LIFECYCLE:</span>
            <span className="font-bold">{beneficiary.admissionStatus || "Draft"}</span>
          </div>

          <div className={`font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border ${
            getLifecycleStatusBadge(beneficiary.beneficiaryStatus).bg
          }`}>
            <span className="font-mono text-[9px] uppercase opacity-75 font-bold">GOVERNANCE:</span>
            <span className="font-bold">{getLifecycleStatusBadge(beneficiary.beneficiaryStatus).label}</span>
          </div>

          <button 
            type="button"
            onClick={onEdit}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition outline-none cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </button>

          <button 
            type="button"
            onClick={handlePrint}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 py-2 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition outline-none cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Portfolio
          </button>

          {session?.role === "SUPER_ADMIN" && onDelete && (
            <button 
              type="button"
              onClick={() => {
                confirmDelete(`${beneficiary.firstName} ${beneficiary.lastName}`, onDelete);
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition outline-none cursor-pointer"
              id="delete-beneficiary-action-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Profile
            </button>
          )}
        </div>
      </div>

      {/* Main split portfolio grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Static Info Anchor Card */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main passport avatar card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-indigo-650 border-l-indigo-600 text-center flex flex-col items-center space-y-4">
            
            <div className="relative group">
              {beneficiary.photo ? (
                <img 
                  src={beneficiary.photo} 
                  alt={`${beneficiary.firstName} Passport`} 
                  referrerPolicy="no-referrer"
                  className="w-32 h-32 rounded-full object-cover border-2 border-slate-200 shadow-md group-hover:opacity-90 transition"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-500 font-mono font-bold text-xl shadow-md group-hover:opacity-90 transition">
                  <span className="text-2xl">{beneficiary.firstName?.charAt(0)}{beneficiary.lastName?.charAt(0)}</span>
                  <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">No Photo</span>
                </div>
              )}
              <button 
                type="button"
                onClick={onTriggerBiometrics}
                className="absolute bottom-1 right-1 p-1.5 bg-indigo-600 border border-indigo-700 hover:bg-indigo-500 text-white rounded-full shadow-md transition"
                title="Surgical Camera Enrollment Capture Port"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            <div>
              <h3 className="font-display font-bold text-slate-900 text-base uppercase">
                {beneficiary.firstName} {beneficiary.lastName}
              </h3>
              <p className="text-[11px] text-indigo-700 font-bold font-mono tracking-tight mt-1 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">
                Mobile Hardware Repairs
              </p>
            </div>

            {/* Program specifics */}
            <div className="w-full pt-4 border-t border-slate-100 text-left space-y-3 text-xs">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-400 font-bold uppercase">BENEFICIARY ID</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{beneficiary.id}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400 font-bold uppercase">TRAINING HOURS TRACK</span>
                  <span className="font-bold text-slate-800">{training.hoursCompleted}/{training.totalRequiredHours} Hours</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      hoursPercent >= 100 ? "bg-emerald-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${hoursPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono pt-1">
                <span className="text-slate-400 font-bold uppercase">CURRICULUM UNIT</span>
                <span className="font-bold text-slate-700 uppercase">9 Units Completed</span>
              </div>
            </div>

          </div>

          {/* Center designation badge */}
          <div className="bg-indigo-950 text-slate-100 border border-indigo-900 rounded-xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] text-indigo-900/40 opacity-40">
              <Landmark className="w-20 h-20" />
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1 px-2 bg-indigo-900 text-indigo-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider block">
                Assigned skills coordinate
              </span>
            </div>

            <div className="space-y-0.5">
              <h4 className="font-semibold text-white text-xs uppercase tracking-tight">
                {beneficiary.tsp || "Unique Technology Nig. Ltd"}
              </h4>
              <p className="text-[10px] text-indigo-200">
                {beneficiary.state || "Imo State"}, {beneficiary.city || "Owerri"} Technical Hub
              </p>
            </div>

            <div className="pt-2 border-t border-indigo-900 text-[9px] w-full flex items-center gap-1.5 text-indigo-300">
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-mono tracking-tight font-bold uppercase">ACCREDITED IDEAS TVET PARTNER</span>
            </div>
          </div>

          {/* SECURE LIFECYCLE MANAGEMENT & COMPLIANCE COMPONENT */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="font-display font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Lifecycle Compliance & Quality
              </h4>
              <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold border ${
                getLifecycleStatusBadge(beneficiary.beneficiaryStatus).bg
              }`}>
                {getLifecycleStatusBadge(beneficiary.beneficiaryStatus).label}
              </span>
            </div>

            <div className="text-xs font-mono space-y-2">
              {beneficiary.statusReason && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Status Reason</span>
                  <p className="text-slate-700 font-sans text-xs italic leading-relaxed">
                    "{beneficiary.statusReason}"
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-slate-400 font-bold block uppercase">Last Updated</span>
                  <span className="text-slate-700 block font-sans">
                    {beneficiary.statusChangedAt ? new Date(beneficiary.statusChangedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase">Updated By</span>
                  <span className="text-slate-700 block font-sans font-medium truncate" title={beneficiary.statusChangedBy}>
                    {beneficiary.statusChangedBy || "System Core"}
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION TRIGGERS */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
                AVAILABLE COMPLIANCE ACTIONS (Role: {session?.role || "GUEST"})
              </span>

              {/* SUPER_ADMIN Actions */}
              {session?.role === "SUPER_ADMIN" && (
                <div className="grid grid-cols-1 gap-2">
                  {/* Restore: available if status is WITHDRAWN, FAILED_VERIFICATION, DISQUALIFIED, REMOVED, ARCHIVED */}
                  {["WITHDRAWN", "FAILED_VERIFICATION", "DISQUALIFIED", "REMOVED", "ARCHIVED"].includes(beneficiary.beneficiaryStatus || "ACTIVE") ? (
                    <button
                      type="button"
                      onClick={() => handleTriggerLifecycle("ACTIVE", "Restore Trainee Record", "Restore the beneficiary profile to ACTIVE status. Trainee will be allowed to participate in training and receive official dispatches again.")}
                      className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Restore Trainee Profile
                    </button>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleTriggerLifecycle("FAILED_VERIFICATION", "Fail Verification Check", "Mark this trainee profile as having FAILED biometric verification parameters.")}
                          className="text-center bg-red-50 hover:bg-red-100 text-red-750 border border-red-205 border-red-200 font-bold py-1.5 px-2 rounded-lg text-[11px] cursor-pointer transition"
                        >
                          Fail Verification
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerLifecycle("DISQUALIFIED", "Disqualify Trainee Record", "Disqualify this trainee record immediately due to breach of programmatic compliance or guidelines.")}
                          className="text-center bg-red-100 hover:bg-red-200 text-red-800 border border-red-350 font-bold py-1.5 px-2 rounded-lg text-[11px] cursor-pointer transition"
                        >
                          Disqualify Trainee
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleTriggerLifecycle("ARCHIVED", "Archive Trainee File", "Archive the trainee file in state. This locks active form/document generation operations and dispatches.")}
                          className="text-center bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-350 font-bold py-1.5 px-2 rounded-lg text-[11px] cursor-pointer transition"
                        >
                          Archive Record
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerLifecycle("REMOVED", "Remove Trainee (Soft Delete)", "Soft delete the trainee profile. Trainee will be placed in the REMOVED state and archived.")}
                          className="text-center bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-350 font-bold py-1.5 px-2 rounded-lg text-[11px] cursor-pointer transition"
                        >
                          Soft Remove
                        </button>
                      </div>
                    </>
                  )}

                  {/* CORRECT TRAINING STATUS (TSP & FED HUB) */}
                  <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                    <span className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-widest block mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> CORRECT TRAINING STATUS
                    </span>
                    <p className="text-[10px] text-slate-400 mb-2 leading-tight font-sans">
                      If you need to correct a student's training stage due to a data entry error, select the correct stage below. All changes are logged and audited.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <select
                          value={rollbackTarget}
                          onChange={(e) => setRollbackTarget(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        >
                          <option value="">-- Select Target Stage --</option>
                          <option value="ADMISSION_FORM_DRAFT">1. Draft / Unlock Registration (Reset Form)</option>
                          <option value="ACCEPTED">2. Offer Accepted</option>
                          <option value="ACTIVE">3. Active In-Training (Enrolled)</option>
                          <option value="GRADUATED">4. Completed Training</option>
                          {/* FED / Admin-only options */}
                          {(session?.role === "SUPER_ADMIN" || session?.role === "FED" || session?.role === "ADMIN_OFFICER") && (
                            <>
                              <option value="CERTIFIED">5. Certified & Approved</option>
                              <option value="CERTIFICATE_ISSUED">6. Certificate Issued</option>
                              <option value="ALUMNI">7. Alumni Tracking</option>
                            </>
                          )}
                        </select>
                      </div>
                      {rollbackTarget && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Enter mandatory correction reason..."
                            value={rollbackReason}
                            onChange={(e) => setRollbackReason(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-amber-500 placeholder-slate-400 font-sans"
                          />
                          <button
                            type="button"
                            disabled={rollbackLoading || !rollbackReason.trim()}
                            onClick={handleExecuteRollback}
                            className="w-full bg-amber-500 hover:bg-amber-600 border border-amber-600 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition shadow-xs flex items-center justify-center gap-1 select-none"
                          >
                            {rollbackLoading ? "Saving..." : "Adjust Status"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ADMIN_OFFICER & TSP Actions */}
              {(session?.role === "ADMIN_OFFICER" || session?.role?.startsWith("TSP") || session?.role === "TSP") && (
                <div className="grid grid-cols-1 gap-2">
                  {["ACTIVE", "UNDER_REVIEW"].includes(beneficiary.beneficiaryStatus || "ACTIVE") && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleTriggerLifecycle("WITHDRAWN", "Withdraw Trainee Enrollment", "Mark the student as WITHDRAWN from classroom repairs training.")}
                        className="w-full text-center bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition"
                      >
                        Withdraw Trainee
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerLifecycle("COMPLETED", "Mark Program Completed", "Mark the student as having successfully COMPLETED Repairs cohort operations.")}
                        className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition shadow-xs"
                      >
                        Mark Program Completed
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Readonly disclaimer for others */}
              {session?.role !== "SUPER_ADMIN" && session?.role !== "ADMIN_OFFICER" && !session?.role?.startsWith("TSP") && session?.role !== "TSP" && (
                <p className="text-[10px] text-slate-400 italic font-medium leading-normal mt-1">
                  You are viewing this record with read-only governance permissions. Trainees or guests are barred from state updates.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive workspace and Tabs Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TAB STRIP CONTROL */}
          <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex overflow-x-auto lg:flex-wrap gap-1 shadow-xs font-mono scrollbar-none items-center scroll-smooth">
            {[
              { id: "overview", label: "OVERVIEW" },
              { id: "admission", label: "ADMISSION" },
              { id: "acceptance", label: "ACCEPTANCE" },
              { id: "forms", label: "FORMS" },
              { id: "documents", label: "DOCUMENTS" },
              { id: "training", label: "TRAINING" },
              { id: "attendance", label: "ATTENDANCE" },
              { id: "communications", label: "COMMUNICATIONS" },
              { id: "workflow", label: "WORKFLOW" },
              { id: "audits", label: "AUDIT LOGS" },
               { id: "governance", label: "COMPLIANCE & QUALITY" },
              { id: "guardian", label: "GUARDIAN" },
              { id: "banking", label: "BANKING" },
              { id: "verification", label: "VERIFICATION" }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  // Refresh on audits
                  if (tab.id === "audits") {
                    fetchAuditLogs();
                  }
                  if (tab.id === "workflow") {
                    fetchWorkflowHistory();
                    authFetch("/api/audit-logs/log", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "WORKFLOW_HISTORY_VIEWED",
                        beneficiaryId: beneficiary.id,
                        remarks: `Accessed trainee lifecycle history logs`
                      })
                    }).catch(() => {});
                  }
                  if (tab.id === "governance") {
                    fetchWorkflowHistory(true);
                    fetchDocumentHistory(true);
                    fetchAuditLogs();
                    fetchGlobalGovStats();
                    authFetch("/api/audit-logs/log", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "COMPLIANCE_PANEL_OPENED",
                        beneficiaryId: beneficiary.id,
                        remarks: `Opened trainee compliance and quality panel`
                      })
                    }).catch(() => {});
                  }
                }}
                className={`flex-1 py-2 px-2.5 rounded-lg text-[10px] font-bold text-center uppercase tracking-wider cursor-pointer transition whitespace-nowrap ${
                  activeTab === tab.id 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB DETAILED CONTENTS */}

          {/* TAB 1: OVERVIEW PANEL */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-350">
              
              {/* PERSONAL INFO */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500" />
                  Personal Information Registered Profile
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-450 text-slate-400 font-bold block uppercase tracking-wider">Full Surname / Middle Name</span>
                    <span className="text-slate-800 font-semibold font-sans text-sm">
                      {beneficiary.lastName}, {beneficiary.firstName} {beneficiary.otherName || ""}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Date of Birth (Recorded Verification)</span>
                    <span className="text-slate-800 font-semibold font-sans text-sm">
                      {beneficiary.dateOfBirth ? (() => {
                        try {
                          let d: Date | null = null;
                          if (beneficiary.dateOfBirth.includes("/")) {
                            const parts = beneficiary.dateOfBirth.split("/");
                            if (parts.length === 3) {
                              const day = parseInt(parts[0], 10);
                              const month = parseInt(parts[1], 10) - 1;
                              const year = parseInt(parts[2], 10);
                              d = new Date(year, month, day);
                            }
                          }
                          if (!d || isNaN(d.getTime())) {
                            d = new Date(beneficiary.dateOfBirth);
                          }
                          if (d && !isNaN(d.getTime())) {
                            return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                          }
                        } catch (e) {}
                        return beneficiary.dateOfBirth;
                      })() : "N/A"}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">NIN Identification Token</span>
                    <span className="text-slate-800 font-semibold text-sm">
                      {beneficiary.nin}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">BVN Financial Record ID</span>
                    <span className="text-slate-800 font-semibold text-sm">
                      {beneficiary.bvn}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Gender Demographics</span>
                    <span className="text-slate-800 font-semibold text-sm font-sans uppercase">{beneficiary.gender}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">State Base coordinate</span>
                    <span className="text-slate-800 font-semibold text-sm font-sans uppercase">{beneficiary.state} State</span>
                  </div>
                </div>
              </div>

              {/* CONTACTS INFO */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Contact & Communication Coordinates
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Email Address for Correspondence</span>
                    <span className="text-slate-800 font-medium text-sm font-sans">{beneficiary.email || "o.adeyemi.dev@email.com"}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Primary Mobile Contact</span>
                    <span className="text-slate-800 font-semibold text-sm">{beneficiary.phoneNumber || "+234 812 345 6789"}</span>
                  </div>

                  <div className="md:col-span-2 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Registered Residential Location Coordinates</span>
                    <span className="text-slate-800 font-medium text-sm font-sans leading-relaxed">
                      {beneficiary.residentialAddress || "24, Excellence Close, off Allen Avenue, Ikeja, Lagos State"}
                    </span>
                  </div>
                </div>
              </div>

              {/* HIGH LEVEL TIMELINE STATE */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  System Activity Status Milestones
                </h4>

                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  <div className="relative">
                    <div className="absolute left-[-23px] top-0.5 h-5 w-5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3" />
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">Biometrics Captured & Verified Log Entry</span>
                      <p className="text-slate-500 mt-0.5 leading-snug">Registration with standard 11-digit NIN locking parameters verified with federal registry backend.</p>
                      <span className="text-[9px] text-slate-450 text-slate-400 font-mono block mt-1">{new Date(beneficiary.createdAt).toLocaleString("en-GB")}</span>
                    </div>
                  </div>
                  {beneficiary.admissionRef && (
                    <div className="relative">
                      <div className="absolute left-[-23px] top-0.5 h-5 w-5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full flex items-center justify-center">
                        <FileText className="w-3 h-3" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Admission Letter Generated (Ref: {beneficiary.admissionRef})</span>
                        <p className="text-slate-500 mt-0.5 leading-snug">Academic offer issued by Unique Technology Nig. Ltd Coordinator under Ministry cohort parameters.</p>
                        <span className="text-[9px] text-slate-400 font-mono block mt-1">
                          {beneficiary.admissionLetterGeneratedAt ? new Date(beneficiary.admissionLetterGeneratedAt).toLocaleString("en-GB") : "N/A"}
                        </span>
                      </div>
                    </div>
                  )}
                  {beneficiary.admissionFormCompleted && (
                    <div className="relative">
                      <div className="absolute left-[-23px] top-0.5 h-5 w-5 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-full flex items-center justify-center">
                        <PenTool className="w-3 h-3" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Complete Application Forms Verified</span>
                        <p className="text-slate-500 mt-0.5 leading-snug">Self-declarations and parent emergency protocols logged as compliant and locked.</p>
                        <span className="text-[9px] text-slate-400 font-mono block mt-1">
                          Completed on {new Date(beneficiary.admissionFormData?.submissionDate || Date.now()).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* VERTICAL WORKFLOW TIMELINE: GOVERNMENT REGISTRY APPEARANCE (PHASE 2) */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 pb-3">
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-slate-500" />
                    WORKFLOW TIMELINE STATUS HISTORY
                  </h4>
                  <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                    TSPs Secure Ledger Logs
                  </span>
                </div>

                {loadingWorkflow ? (
                  <div className="flex items-center justify-center p-8 text-xs font-mono text-slate-500 gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-indigo-600" />
                    Querying GOVERNANCE STATUS METADATA...
                  </div>
                ) : (
                  <div className="relative pl-7 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                    {[
                      { key: "REGISTERED", label: "Registered", desc: "Trainee profile logged successfully on Governance portal.", matcher: (h: any) => h.oldStatus === "null" || ["PENDING", "DRAFT", "REGISTERED"].includes((h.newStatus || "").toUpperCase()) },
                      { key: "ADMITTED", label: "Admission Sent", desc: "Admission Letter compile generated and sent to trainee with portal invite.", matcher: (h: any) => (h.newStatus || "").toUpperCase() === "ADMITTED" },
                      { key: "OFFER_VIEWED", label: "Offer Viewed", desc: "Admission Offer letter link read and validated.", matcher: (h: any) => (h.newStatus || "").toUpperCase() === "OFFER_VIEWED" || (h.remarks || "").toLowerCase().includes("viewed") },
                      { key: "ACCEPTANCE_UPLOADED", label: "Acceptance Uploaded", desc: "Official acceptance slip documents signed and submitted.", matcher: (h: any) => (h.newStatus || "").toUpperCase() === "ACCEPTANCE_UPLOADED" || (h.remarks || "").toLowerCase().includes("upload") || (h.remarks || "").toLowerCase().includes("acceptance letter") },
                      { key: "ACCEPTED", label: "Accepted", desc: "Admissions board verified matching acceptance agreements.", matcher: (h: any) => (h.newStatus || "").toUpperCase() === "ACCEPTED" },
                      { key: "ENROLLED", label: "Enrolled", desc: "Trainee verified inside the portal under central registry.", matcher: (h: any) => ["ENROLLED", "VERIFIED", "IN_TRAINING"].includes((h.newStatus || "").toUpperCase()) },
                      { key: "GRADUATED", label: "Graduated", desc: "Trainee completed learning curricula and final certification signed.", matcher: (h: any) => ["GRADUATED", "ALUMNI"].includes((h.newStatus || "").toUpperCase()) }
                    ].map((step, idx) => {
                      // Find matching workflow logs
                      const matchingLogs = workflowHistory.filter(step.matcher);

                      const stepRanks: Record<string, number> = {
                        "REGISTERED": 1,
                        "ADMITTED": 2,
                        "OFFER_VIEWED": 2,
                        "ACCEPTANCE_UPLOADED": 3,
                        "ACCEPTED": 3,
                        "ENROLLED": 4,
                        "GRADUATED": 5
                      };
                      const currentRank = getStatusRank(beneficiary.status);
                      const isPassed = matchingLogs.length > 0 || currentRank >= stepRanks[step.key];

                      const primaryLog = matchingLogs[matchingLogs.length - 1];

                      return (
                        <div key={step.key} className="relative group text-slate-800">
                          {/* Circle dot on vertical line */}
                          <div className={`absolute left-[-24px] top-1 h-3.5 w-3.5 rounded-full border-2 transition-all ${
                            isPassed 
                              ? "bg-emerald-600 border-emerald-600 shadow-sm" 
                              : "bg-white border-slate-300"
                          }`} />

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                            <div className="md:col-span-4">
                              <span className={`text-xs font-bold block ${
                                isPassed ? "text-slate-900" : "text-slate-400"
                              }`}>
                                {step.label}
                              </span>
                              <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{step.desc}</p>
                            </div>

                            <div className="md:col-span-8 bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 space-y-1.5 text-[11px] min-h-[44px]">
                              {primaryLog ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-slate-400 text-[10px]">
                                    <span>
                                      Operator: <span className="text-slate-600 font-semibold">{primaryLog.changedBy}</span>
                                    </span>
                                    <span>
                                      {new Date(primaryLog.changedAt).toLocaleString("en-GB")}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 font-sans italic leading-snug">
                                    “{primaryLog.remarks || `Candidate status advanced to ${step.key}`}”
                                  </p>
                                </div>
                              ) : isPassed ? (
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 py-1">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse" />
                                  Stage Verified (Legacy or pre-migrated status log).
                                </div>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400 italic block py-1">
                                  ○ Lifecycle stage not yet reached.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: ADMISSION PANEL */}
          {activeTab === "admission" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              
              {/* FLOW STEP TRACKER */}
              <div className="space-y-4">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span>Admission Workflow Steps Tracking</span>
                  <span className="text-[10px] text-slate-450 font-mono text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded font-bold">
                    ACTIVE FIELD: {currentStatus}
                  </span>
                </h4>

                <div className="flex items-center gap-4 py-4 px-3 bg-slate-50/50 rounded-xl border border-slate-100 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                  {workflowSteps.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={idx} className="flex-shrink-0 min-w-[100px] flex flex-col items-center gap-2 font-mono text-center relative">
                        {/* Connecting line */}
                        {idx !== 0 && (
                          <div className="absolute left-[-50%] right-[50%] top-3.5 h-0.5 bg-slate-200/90 z-0" />
                        )}
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition border ${
                          isCompleted 
                            ? "bg-indigo-600 border-indigo-700 text-white shadow-xs" 
                            : isCurrent 
                            ? "bg-yellow-500 border-yellow-600 text-slate-950 font-bold animate-pulse" 
                            : "bg-white text-slate-350 border-slate-200"
                        }`}>
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <div>
                          <span className={`block text-[9px] font-bold uppercase whitespace-nowrap ${
                            isCurrent ? "text-indigo-600 font-extrabold" : isCompleted ? "text-slate-800" : "text-slate-400"
                          }`}>{step.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 13-stage Workflow Elevator Control Dropdown */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-200/60 p-4 rounded-xl">
                  <div>
                    <h5 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">Administrative Pipeline Elevation Option</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">As an authorized officer, you can manually elevate or adjust this beneficiary's status along the 13-stage TVET training registry lifecycle.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">Change Stage:</span>
                    <select
                      value={currentStatus}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        if (confirm(`Elevate beneficiary to [${newStatus}] lifecycle stage?`)) {
                          try {
                            await onUpdate({ admissionStatus: newStatus });
                            showToast(`Beneficiary successfully advanced/reverted to stage: ${newStatus}`, "success");
                          } catch (err: any) {
                            showToast(`Failed to update stage: ${err.message}`, "error");
                          }
                        }
                      }}
                      className="bg-white hover:bg-slate-50 border border-slate-300 py-1.5 px-3.5 rounded-lg text-xs font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs transition"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Admission Generated">Admission Generated</option>
                      <option value="Admission Sent">Admission Sent</option>
                      <option value="Offer Viewed">Offer Viewed</option>
                      <option value="Acceptance Pending">Acceptance Pending</option>
                      <option value="Acceptance Uploaded">Acceptance Uploaded</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Enrolled">Enrolled</option>
                      <option value="Training In Progress">Training In Progress</option>
                      <option value="Training Completed">Training Completed</option>
                      <option value="Certified">Certified</option>
                      <option value="Alumni">Alumni</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ACTION LAYERS & ADMINISTRATIVE CONTROLS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4 border border-slate-150 p-5 rounded-xl bg-slate-50/40">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-650" />
                      Offer Generation & Action Node
                    </h5>
                    {beneficiary.admissionRef && (
                      <span className="text-[9px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                        REF: {beneficiary.admissionRef}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-slate-500 font-sans leading-normal">
                    Generate, print, and dispatch primary registration credentials, certificate letters, and response forms to candidates securely.
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Primary Generation Call */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={generateAdmissionLetter}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer transition active:scale-97"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                        {beneficiary.admissionRef ? "Regenerate Offer Letter" : "Generate Admission Offer"}
                      </button>

                      <button
                        type="button"
                        onClick={printAdmissionLetter}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Preview & Print Letter
                      </button>
                    </div>

                    {/* Secondary admin actions grid - AVAILABLE AT ALL TIMES */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-150 space-y-3">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Administrative Dispatches Desk</span>
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold font-mono">
                        <button
                          type="button"
                          onClick={printAdmissionLetter}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-705 border border-slate-200 py-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          Download PDF
                        </button>

                        <button
                          type="button"
                          onClick={copySecureResponseLink}
                          className={`py-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition border ${
                            copiedLink 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-slate-50 hover:bg-slate-100 text-slate-707 border-slate-200"
                          }`}
                        >
                          {copiedLink ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-650" />
                              Copied Link!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              Copy Secure Link
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {/* Send / Resend Email buttons always available! */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={sendAdmissionLetter}
                            disabled={emailStatus === "sending"}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-mono font-bold"
                          >
                            <Mail className="w-3.5 h-3.5 text-emerald-200" />
                            {emailStatus === "sending" ? "Sending Dispatch..." : beneficiary.emailStatus === "Sent" ? "Resend Email Offer" : "Send Email Offer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PREVIEW CONTAINER */}
                <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-xs flex flex-col justify-between max-h-[380px] overflow-hidden text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Live Paper Template Preview</span>
                    <button 
                      type="button"
                      onClick={printAdmissionLetter} 
                      className="text-indigo-650 hover:text-indigo-805 text-[10px] font-mono font-bold flex items-center gap-0.5"
                    >
                      Fullscreen Preview <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 text-[9px] font-serif border border-slate-100 rounded-lg overflow-y-auto leading-normal text-slate-700 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-justify flex-grow mt-2">
                    <div className="text-center font-bold font-sans text-[11px] uppercase text-indigo-900 border-b border-indigo-250 pb-1 mb-2">
                      UNIQUE TECHNOLOGY NIG. LTD
                    </div>
                    <div className="flex justify-between font-mono text-[7px] text-slate-400 mb-2">
                      <span>REF: {beneficiary.admissionRef || "DRAFT_PENDING_GENERATION"}</span>
                      <span>Date: {new Date().toLocaleDateString("en-GB")}</span>
                    </div>
                    <p className="mb-2"><strong>To: {beneficiary.firstName.toUpperCase()} {beneficiary.lastName.toUpperCase()}</strong></p>
                    <p className="mb-2">We are pleased to offer you provisional admission into our intensive skills training workshop for <strong>Computer Hardware and Cell Phone Repairs</strong>.</p>
                    <p className="mb-2">This study track entails extensive labs verifying component diagnosis, board soldering, and schematic analysis.</p>
                    <p className="mb-2">Failure to satisfy biometrics attendance daily disqualifies the candidate from acquiring stipes.</p>
                    <p className="border-t border-slate-200 pt-2 block font-sans font-bold text-[7px] text-slate-400 mt-2">OPERATIONAL REGISTRY COORDINATOR SEAL</p>
                  </div>
                </div>
              </div>

              {/* EMAIL CURRENT STATUS & TRANSMISSION CONTROL PANEL */}
              <div className="space-y-4 border border-slate-150 p-5 rounded-xl bg-slate-50/40 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-slate-800 text-xs uppercase flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-650" />
                      Operational Transmission Control Desk
                    </h5>
                    <span className="text-[10px] text-slate-400 font-sans block font-semibold">Monitor independent electronic notifications delivery status</span>
                  </div>
                  
                  {/* Separate Email Status Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">SMTP status:</span>
                    {emailHealth ? (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono flex items-center gap-1 border ${
                        emailHealth.status === "SMTP Connected"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : emailHealth.status === "Simulator Mode"
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          emailHealth.status === "SMTP Connected" ? "bg-emerald-500 animate-pulse" : emailHealth.status === "Simulator Mode" ? "bg-blue-500" : "bg-rose-500"
                        }`} />
                        {emailHealth.status}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[9px] font-mono animate-pulse">Checking...</span>
                    )}
                  </div>
                </div>

                {/* EMAIL STATUS METRICS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 font-mono">
                  {[
                    { label: "Not Sent", statusKey: "Not Sent", style: "border-slate-150 text-slate-400 bg-white" },
                    { label: "Sending", statusKey: "Sending", style: "bg-amber-50 border-amber-200 text-amber-750 font-bold animate-pulse" },
                    { label: "Sent", statusKey: "Sent", style: "bg-emerald-50 border-emerald-200 text-emerald-850 shadow-xs" },
                    { label: "Failed", statusKey: "Failed", style: "bg-rose-50 border-rose-200 text-rose-750 font-bold animate-pulse" }
                  ].map((item, keyIdx) => {
                    const localStatus = emailStatus === "sending" ? "Sending" : (beneficiary.emailStatus || "Not Sent");
                    const isActive = localStatus === item.statusKey;
                    return (
                      <div key={keyIdx} className={`p-3 rounded-lg border text-center transition ${
                        isActive 
                          ? item.style + " border-2 font-extrabold" 
                          : "bg-slate-100/40 border-slate-150 text-slate-400"
                      }`}>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider">{item.label}</div>
                        <div className="text-[8px] mt-1 font-semibold">
                          {isActive ? "CURRENT STATUS ✓" : "INACTIVE"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SMTP TROUBLESHOOTING DETAILS AND RETRY ZONE */}
                {(emailStatus === "sending" ? "Sending" : (beneficiary.emailStatus || "Not Sent")) === "Failed" && (
                  <div className="p-3.5 bg-rose-50/50 border border-rose-150 rounded-xl space-y-2 mt-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-605 shrink-0 mt-0.5 text-rose-605" />
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-rose-800 block uppercase font-mono tracking-wider">SMTP Delivery Failure Encountered</span>
                        <p className="text-xs text-rose-700 font-sans leading-normal">
                          The mail transfer agent was unable to submit the message to the recipient's host. Recipient Email: <span className="font-semibold">{beneficiary.bvn || beneficiary.email}</span>
                        </p>
                        {beneficiary.smtpErrorDetails && (
                          <div className="p-2 bg-rose-50 border border-rose-200 text-[10px] font-mono text-rose-850 rounded">
                            ERROR LOG: {beneficiary.smtpErrorDetails}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={sendAdmissionLetter}
                        disabled={emailStatus === "sending"}
                        className="bg-rose-605 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs border border-rose-700 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${emailStatus === "sending" ? "animate-spin" : ""}`} />
                        Retry Electronic Dispatch Now
                      </button>
                    </div>
                  </div>
                )}

                {/* DELIVERY HISTORY SECTION */}
                <div className="space-y-2 mt-2 pt-3 border-t border-slate-150">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block font-semibold">Complete SMTP Delivery Transmission History</span>
                  {beneficiary.emailDeliveryHistory && Array.isArray(beneficiary.emailDeliveryHistory) && beneficiary.emailDeliveryHistory.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left font-mono text-[10px] text-slate-650 border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-semibold select-none">
                            <th className="p-2.5">Date Sent</th>
                            <th className="p-2.5">Recipient Email</th>
                            <th className="p-2.5">Result</th>
                            <th className="p-2.5">SMTP Response Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {(beneficiary.emailDeliveryHistory || []).map((d, dIdx) => (
                            <tr key={dIdx} className="hover:bg-slate-50">
                              <td className="p-2.5 text-slate-500 whitespace-nowrap">{new Date(d.dateSent).toLocaleString()}</td>
                              <td className="p-2.5 font-sans font-semibold text-slate-800">{d.recipientEmail}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                  d.deliveryResult === "Sent" 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border-rose-100"
                                }`}>
                                  {d.deliveryResult}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-500 max-w-xs truncate" title={d.smtpResponse}>
                                {d.smtpResponse}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-slate-400 font-mono text-[10px] uppercase tracking-wider bg-slate-50/50 rounded-lg border border-slate-150 transition min-h-16 flex items-center justify-center font-bold col-span-4">
                      No official transmission logs saved on record. Use the actions above to establish dispatches.
                    </div>
                  )}
                </div>

                {/* Legacy detailed logs trail */}
                <div className="space-y-2 mt-2 pt-2 border-t border-slate-150">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block font-bold">Web Hook Correspondence Pulse Engine Feed</span>
                  {beneficiary.emailTrackingHistory && Array.isArray(beneficiary.emailTrackingHistory) && beneficiary.emailTrackingHistory.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {(beneficiary.emailTrackingHistory || []).map((h, hIdx) => (
                        <div key={hIdx} className="p-2.5 bg-white border border-slate-150 rounded-lg text-[10px] font-mono flex items-start gap-2.5">
                          <span className="text-slate-400 shrink-0 select-none">[{new Date(h.timestamp).toLocaleTimeString()}]</span>
                          <div className="space-y-0.5">
                            <span className={`font-bold uppercase inline-block ${
                              h.status === "Opened" ? "text-indigo-600" : h.status === "Delivered" ? "text-emerald-700" : "text-rose-600"
                            }`}>{h.status}</span>
                            <p className="text-slate-605 text-slate-600 font-sans mt-0.5 leading-snug">{h.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2.5 text-center text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                      No automated correspondence tracking records discovered
                    </div>
                  )}
                </div>
              </div>

              {/* Historical Admission Versions Grid */}
              <div className="space-y-3 text-left border-t border-slate-100 pt-5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Admission Letters Compilation History Versions</span>
                {beneficiary.admissionLetterVersions && Array.isArray(beneficiary.admissionLetterVersions) && beneficiary.admissionLetterVersions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(beneficiary.admissionLetterVersions || []).map((v, vIdx) => (
                      <div key={vIdx} className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs flex items-center justify-between font-mono">
                        <div className="space-y-0.5 text-left">
                          <span className="font-bold text-slate-800 block text-xs">Offer Letter (Version {v.version})</span>
                          <span className="text-[9px] text-slate-400">Compiled: {new Date(v.generatedAt).toLocaleString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const win = window.open("", "_blank");
                            win?.document.write(v.url);
                            win?.document.close();
                          }}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] shadow-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          Launch HTML <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center font-mono py-4 bg-slate-50 rounded border border-slate-150 uppercase tracking-widest">
                    No historical letters compiled
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: ACCEPTANCE PANEL */}
          {activeTab === "acceptance" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Trainee Admission Acceptance Protocols</span>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded font-bold uppercase">
                  {beneficiary.acceptanceLetterUploaded ? "APPROVED PORTFOLIO" : "PENDING COHORT SIGN-OFF"}
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                
                {/* UPLOAD MECHANICS */}
                <div className="space-y-4 flex flex-col justify-between p-5 border border-slate-150 rounded-xl bg-slate-50/40">
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-emerald-650 text-emerald-600" />
                      Sign-off Documents Upload
                    </h5>
                    <p className="text-[11px] text-slate-500 font-sans leading-normal">
                      Scan and upload the signed Admission Acceptance Letter here. Supported formats: JPG/PNG scans or PDFs. This automatically verifies the enrollment status.
                    </p>
                  </div>

                  {/* DROP ZONE (Aesthetic & Interactive Drag and Drop) */}
                  <div 
                    onDragEnter={(e) => handleDrag(e, "acceptance")}
                    onDragOver={(e) => handleDrag(e, "acceptance")}
                    onDragLeave={(e) => handleDrag(e, "acceptance")}
                    onDrop={(e) => handleDrop(e, "acceptance")}
                    className={`mt-3 py-6 px-4 rounded-xl border-2 border-dashed text-center flex flex-col items-center justify-center cursor-pointer transition ${
                      dragActive === "acceptance"
                        ? "bg-indigo-50 border-indigo-500/70"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Upload className="w-7 h-7 text-slate-400 stroke-1 block mb-2" />
                    <span className="text-[10px] font-bold font-mono text-slate-700 block mb-1">Drag Acceptance Document here</span>
                    <span className="text-[9px] text-slate-450 text-slate-400 block mb-2">or browse device file explorer</span>
                    
                    <label className="bg-indigo-600 hover:bg-indigo-505 bg-indigo-505 hover:bg-indigo-500 text-white font-bold text-[9px] px-3 py-1.5 rounded uppercase tracking-wider font-mono cursor-pointer transition">
                      Choose Scan File
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "acceptance")}
                      />
                    </label>
                  </div>

                  {/* BYPASS CTA */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="text-[9px] text-slate-400 uppercase font-mono block mb-2">Operational Override</div>
                    <button
                      type="button"
                      onClick={acceptAdmissionDirectly}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-xs transition cursor-pointer active:scale-97"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Accept Admission & Force Enrol
                    </button>
                  </div>
                </div>

                {/* PREVIEW OF ACCEPTANCE */}
                <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-xs flex flex-col justify-between min-h-[300px]">
                  <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block border-b border-slate-100 pb-2">
                    ACCEPTANCE LETTER PREVIEW
                  </span>

                  {beneficiary.acceptanceLetterUploaded ? (
                    <div className="flex-grow flex flex-col items-center justify-center mt-4">
                      {beneficiary.acceptanceLetterUrl?.startsWith("data:image") ? (
                        <div className="relative group max-w-xs border border-slate-200 rounded-lg p-1 bg-slate-100 shadow-xs">
                          <img 
                            src={beneficiary.acceptanceLetterUrl} 
                            alt="Acceptance Scan" 
                            className="max-h-52 w-full object-contain rounded"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] font-mono font-bold text-white uppercase rounded">
                            Verified Upload Scan
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 border border-emerald-150 rounded-xl bg-emerald-50 max-w-xs space-y-3">
                          <Award className="w-10 h-10 text-emerald-600 stroke-1 mx-auto" />
                          <div>
                            <span className="text-xs font-bold font-mono text-emerald-800 block uppercase">ACCEPTANCE SLIP ENCLOSED</span>
                            <span className="text-[9px] text-emerald-600 block mt-0.5">Verified Document Code: ACC-LOCK-${beneficiary.id.split("-").pop()}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 text-[10px] font-mono text-slate-400 text-center">
                        Uploaded at: <span className="font-bold text-slate-705 text-slate-600">{new Date(beneficiary.acceptanceLetterUploadedAt || Date.now()).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 uppercase font-mono text-[10px] font-bold space-y-2 flex-grow flex flex-col items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-amber-500 stroke-1 animate-bounce" />
                      <span>Awaiting acceptance document</span>
                    </div>
                  )}
                </div>

              </div>

              {/* ACCEPTANCE LETTER AUDIT STATUS WORKSHEET */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h5 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-200 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-slate-700" />
                  Acceptance Letter Audit & Verification Worksheet
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Current Status Metadata */}
                  <div className="space-y-3 p-3 bg-white border border-slate-150 rounded-lg">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Worksheet Metadata</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-slate-500 font-medium">Document Status:</div>
                      <div>
                        <span className={`inline-block text-[10px] font-bold font-mono px-2 py-0.5 rounded border uppercase ${
                          beneficiary.acceptanceLetterStatus === "ACCEPTED"
                            ? "bg-emerald-55 bg-emerald-50 text-emerald-700 border-emerald-200"
                            : beneficiary.acceptanceLetterStatus === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : beneficiary.acceptanceLetterStatus === "UNDER_VERIFICATION"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : beneficiary.acceptanceLetterStatus === "SUBMITTED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {beneficiary.acceptanceLetterStatus || "NOT_SUBMITTED"}
                        </span>
                      </div>

                      <div className="text-slate-500 font-medium">Audited By:</div>
                      <div className="font-mono text-[11px] text-slate-700">{beneficiary.acceptanceLetterCheckedBy || "Unreviewed"}</div>

                      <div className="text-slate-500 font-medium">Checked At:</div>
                      <div className="font-mono text-[11px] text-slate-700">
                        {beneficiary.acceptanceLetterCheckedAt 
                          ? new Date(beneficiary.acceptanceLetterCheckedAt).toLocaleString("en-GB") 
                          : "Never"}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">Supervisor Remarks</span>
                      <div className="p-2 bg-slate-50 rounded text-slate-650 text-slate-600 text-xs italic font-sans min-h-[40px]">
                        {beneficiary.acceptanceLetterRemarks || "No evaluation remarks logged."}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interactive Audit Form */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Update Audit Status</span>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase block font-mono">Select Document Status</label>
                      <select
                        value={selectedLetterStatus}
                        onChange={(e) => setSelectedLetterStatus(e.target.value as any)}
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500 outline-none"
                      >
                        <option value="NOT_SUBMITTED">NOT_SUBMITTED</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="UNDER_VERIFICATION">UNDER_VERIFICATION</option>
                        <option value="ACCEPTED">ACCEPTED (Approved Verification)</option>
                        <option value="REJECTED">REJECTED (Declined Acceptance)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase block font-mono">Evaluation / Audit Remarks</label>
                      <textarea
                        value={remarksInput}
                        onChange={(e) => setRemarksInput(e.target.value)}
                        placeholder="Add checklist notes, e.g. 'Signed document matches Trainee BVN criteria', or 'Signature mismatch'."
                        rows={3}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500 outline-none resize-none font-sans"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isUpdatingLetter}
                      onClick={handleSaveLetterStatus}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs tracking-wide transition cursor-pointer active:scale-97 uppercase font-mono"
                    >
                      {isUpdatingLetter ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Save Audit Decision
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ADMIN DECISION DESK */}
              <div className="bg-slate-900 text-white border border-slate-950 rounded-xl p-5 shadow-xs text-left space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <h5 className="font-display font-medium text-xs uppercase flex items-center gap-2 tracking-wide text-indigo-400">
                    <ShieldCheck className="w-4 h-4" />
                    Administrative Document Review Panel
                  </h5>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                    beneficiary.admissionStatus === "Accepted"
                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-800"
                      : beneficiary.admissionStatus === "Acceptance Uploaded"
                      ? "bg-yellow-950/50 text-yellow-400 border-yellow-800 animate-pulse"
                      : beneficiary.admissionStatus === "Acceptance Rejected"
                      ? "bg-rose-950/50 text-rose-400 border-rose-900"
                      : "bg-slate-950/50 text-slate-400 border-slate-800"
                  }`}>
                    {beneficiary.admissionStatus?.toUpperCase() || "PENDING ACTION"}
                  </span>
                </div>

                <div className="text-slate-300 space-y-1">
                  <p className="text-xs">
                    Trainee acceptance letters and supplemental bio registry records are subject to human inspection before enrollment status is finalized.
                  </p>
                  
                  {/* Current decision status banner */}
                  <div className="bg-slate-800 p-2.5 rounded-lg text-[11px] font-mono text-slate-300 flex items-center justify-between border border-slate-700 mt-2">
                    <span>CURRENT FLOW STAGE Status:</span>
                    <span className="font-bold text-yellow-400 uppercase">{beneficiary.admissionStatus || "Pending"}</span>
                  </div>
                </div>

                {/* APPROVED STATE (STATUS LOCK) */}
                {beneficiary.admissionStatus === "Accepted" ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-emerald-955/20 border border-emerald-800/40 rounded-lg flex items-start gap-2.5 text-xs text-emerald-200">
                      <Lock className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-emerald-300 text-xs">STATUS LOCKED & APPROVED</span>
                        <p className="text-[11px] text-emerald-400 leading-normal font-sans mt-0.5">
                          This candidate has been officially verified and enrolled. Document packages, biometrics registries, and competency trackers are structurally sealed.
                        </p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={revokeApproval}
                      className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer font-mono text-xs font-bold"
                    >
                      <Unlock className="w-3.5 h-3.5 text-yellow-400" />
                      Revoke Approval
                    </button>
                  </div>
                ) : beneficiary.admissionStatus === "Acceptance Rejected" ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-rose-955/20 border border-rose-900/30 rounded-lg flex items-start gap-2.5 text-xs text-rose-250">
                      <AlertTriangle className="w-4.5 h-4.5 text-rose-450 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-rose-300 text-xs">ACCEPTANCE DECLINED / REJECTED</span>
                        <p className="text-[11px] text-rose-400 leading-normal font-sans mt-0.5">
                          Trainee submitted materials have been audited and rejected. Direct modifications are temporarily locked.
                        </p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={reopenReview}
                      className="w-full bg-indigo-900 hover:bg-indigo-800 border border-indigo-700 text-white py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer font-mono text-xs font-bold"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-indigo-300" />
                      Reopen Candidate Review
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono font-bold">
                    {/* Only show Mark Under Review if NOT already under review */}
                    {beneficiary.admissionStatus !== "Under Review" ? (
                      <button
                        type="button"
                        onClick={markUnderReview}
                        className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                        Mark Under Review
                      </button>
                    ) : (
                      // Placeholder if hidden to occupy space or let other cols grow nicely
                      <div className="hidden sm:flex text-center text-[10px] text-slate-500 italic items-center justify-center border border-slate-800/40 rounded-lg">
                        Under Review (Active)
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={approveVerification}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-97"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />
                      Approve & Accept Trainee
                    </button>
                    
                    <button
                      type="button"
                      onClick={submitRejection}
                      className="bg-rose-900/45 hover:bg-rose-900 text-rose-100 border border-rose-800/55 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                      Decline Scan Upload
                    </button>
                  </div>
                )}
              </div>

              {/* Historical Acceptance Versions Grid */}
              <div className="space-y-3 text-left border-t border-slate-100 pt-5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Acceptance Letter Uploads History Versions</span>
                {beneficiary.acceptanceLetterVersions && Array.isArray(beneficiary.acceptanceLetterVersions) && beneficiary.acceptanceLetterVersions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {(beneficiary.acceptanceLetterVersions || []).map((v, vIdx) => (
                      <div key={vIdx} className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs flex justify-between items-center font-mono">
                        <div className="space-y-0.5 text-left">
                          <span className="font-bold text-slate-750 text-slate-800 block">Signed Acceptance Declaration (Version {v.version})</span>
                          <span className="text-[9px] text-slate-400">Uploaded: {new Date(v.uploadedAt).toLocaleString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const win = window.open("", "_blank");
                            win?.document.write(`<html><body style="margin:0;"><iframe src="${v.url}" style="width:100%; height:100%; border:0;"></iframe></body></html>`);
                            win?.document.close();
                          }}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1.5 rounded text-[10px] shadow-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          View Document Scan <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center font-mono py-4 bg-slate-50 rounded border border-slate-150 uppercase tracking-widest">
                    No acceptance letter uploads track history found
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: FORMS PANEL */}
          {activeTab === "forms" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  Beneficiary Registry Profile Admission form
                </h4>
                <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wide uppercase ${
                  beneficiary.admissionFormCompleted 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-amber-50 text-amber-600 border border-amber-100"
                }`}>
                  {beneficiary.admissionFormStatus || "Draft"} Mode
                </div>
              </div>

              {/* DEMO FORM EDITOR COMPONENTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Next of Kin / Emergency Name</label>
                  <input
                    type="text"
                    value={formFields.emergencyName}
                    disabled={beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED"}
                    onChange={(e) => setFormFields({ ...formFields, emergencyName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg p-2 font-sans text-xs font-normal outline-none transition disabled:opacity-60"
                    placeholder="e.g. Ade Adeyemi"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Emergency Phone Contact</label>
                  <input
                    type="text"
                    value={formFields.emergencyPhone}
                    disabled={beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED"}
                    onChange={(e) => setFormFields({ ...formFields, emergencyPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg p-2 font-sans text-xs font-normal outline-none transition disabled:opacity-60"
                    placeholder="e.g. +234 803 234 5678"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Parent/Guardian Sponsor Name</label>
                  <input
                    type="text"
                    value={formFields.guardianName}
                    disabled={beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED"}
                    onChange={(e) => setFormFields({ ...formFields, guardianName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg p-2 font-sans text-xs font-normal outline-none transition disabled:opacity-60"
                    placeholder="e.g. Chief Adeyemi"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Highest Achievement Tier</label>
                  <select
                    value={formFields.highestQualification}
                    disabled={beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED"}
                    onChange={(e) => setFormFields({ ...formFields, highestQualification: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-sans text-xs font-normal outline-none cursor-pointer disabled:opacity-60"
                  >
                    <option value="SSCE shadow-xs">SSCE (High School Certificate)</option>
                    <option value="ND Diploma">National Diploma (ND)</option>
                    <option value="HND Diploma">Higher National Diploma (HND)</option>
                    <option value="B.Sc / B.Eng">Bachelor Degree (B.Sc / B.Tech)</option>
                    <option value="None">None</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Prior Hardware Knowledge Tier</label>
                  <select
                    value={formFields.priorKnowledge}
                    disabled={beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED"}
                    onChange={(e) => setFormFields({ ...formFields, priorKnowledge: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-sans text-xs font-normal outline-none cursor-pointer disabled:opacity-60"
                  >
                    <option value="Beginner">Beginner (No repair background)</option>
                    <option value="Intermediate">Intermediate (Understands cell assembly)</option>
                    <option value="Advanced">Advanced (Some board repair experience)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="medDec"
                    checked={Boolean(formFields.medicalDeclaration)}
                    disabled={beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED"}
                    onChange={(e) => setFormFields({ ...formFields, medicalDeclaration: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-550 focus:ring-indigo-500 border-slate-300 disabled:opacity-60"
                  />
                  <label htmlFor="medDec" className="text-[9px] text-slate-500 font-medium font-sans leading-normal cursor-pointer select-none">
                    Confirm medical clearance & hardware workshop liability acceptance terms.
                  </label>
                </div>
              </div>

              {/* ACTION BUTTON GRID */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
                <span className="text-[10px] text-slate-400 max-w-xs leading-normal font-sans">
                  Completed profiles will be compiled with candidate biometrics for federal onviews.
                </span>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={printAdmissionForm}
                    className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer text-[11px] transition"
                    title="Print local client copy"
                  >
                    <Download className="w-3 h-3 text-slate-500" />
                    <span>Quick Print</span>
                  </button>

                  <a
                    href={`${API_BASE_URL}/api/admissions/${beneficiary.id}/form/pdf${(session as any)?.token ? `?token=${(session as any).token}` : ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-initial bg-slate-900 border border-transparent hover:bg-black text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer text-[11px] transition whitespace-nowrap shadow-xs"
                    title="Download A4 official government-styled PDF"
                  >
                    <Download className="w-3 h-3 text-slate-300" />
                    <span>Official PDF</span>
                  </a>

                  <a
                    href={`${API_BASE_URL}/api/admissions/${beneficiary.id}/form/docx${(session as any)?.token ? `?token=${(session as any).token}` : ""}`}
                    className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer text-[11px] transition whitespace-nowrap"
                    title="Export styled Word Document"
                  >
                    <FileText className="w-3 h-3 text-indigo-500" />
                    <span>Official Word</span>
                  </a>
                  
                  {!(beneficiary.admissionFormCompleted || beneficiary.admissionFormStatus === "LOCKED") ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveAdmissionForm("Draft")}
                        className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Save Draft
                      </button>

                      <button
                        type="button"
                        onClick={() => saveAdmissionForm("Verified")}
                        className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        Verify & Submit
                      </button>
                    </>
                  ) : session?.role === "SUPER_ADMIN" ? (
                    <button
                      type="button"
                      onClick={unlockAdmissionForm}
                      className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-3.5 h-3.5 text-white" />
                      Unlock Admission Form
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Historical Form Versions List */}
              <div className="pt-4 border-t border-slate-100 text-left">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">Form Submission Profile History Versions</span>
                {beneficiary.admissionFormVersions && Array.isArray(beneficiary.admissionFormVersions) && beneficiary.admissionFormVersions.length > 0 ? (
                  <div className="space-y-2">
                    {(beneficiary.admissionFormVersions || []).map((v, vIdx) => (
                      <div key={vIdx} className="p-3.5 bg-slate-50 border border-slate-150 rounded-lg font-mono text-xs text-left">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-201 border-b border-slate-200">
                          <span className="font-bold text-slate-800 uppercase text-[10px]">Enrollment Form Details (Version {v.version})</span>
                          <span className="text-slate-400 text-[9px]">Captured: {new Date(v.submittedAt).toLocaleString()}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5 text-[10px] text-slate-600 leading-normal">
                          <div>EMERGENCY NOK: <span className="font-sans font-bold text-slate-800">{v.formData?.emergencyName || "N/A"}</span></div>
                          <div>EMERGENCY PHONE: <span className="font-sans font-bold text-slate-800">{v.formData?.emergencyPhone || "N/A"}</span></div>
                          <div>GUARDIAN / SPONSOR: <span className="font-sans font-bold text-slate-800">{v.formData?.guardianName || "N/A"}</span></div>
                          <div>QUALIFICATION: <span className="font-sans font-bold text-slate-800">{v.formData?.highestQualification || "SSCE"}</span></div>
                          <div>PRIOR KNOWLEDGE: <span className="font-sans font-bold text-slate-800">{v.formData?.priorKnowledge || "Beginner"}</span></div>
                          <div>MEDICAL CLEARANCE: <span className="font-sans font-bold text-slate-800">{v.formData?.medicalDeclaration ? "YES" : "NO"}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-lg text-center text-slate-400 text-[9px] uppercase font-mono tracking-widest">
                    Awaiting original profile form mapping version
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: DOCUMENTS PANEL */}
          {activeTab === "documents" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-5 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase">
                  Biometrics & Credentials Documentation Center
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {documentsList.length} Uploaded items
                </span>
              </div>

               {/* DOCUMENTS CARD MATRIX */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "passport", label: "PASSPORT PHOTOGRAPH", type: "Img", mandatory: true, exists: !!beneficiary.photo, url: beneficiary.photo },
                  { key: "nin", label: "NIN DOCUMENT SLIP", type: "Scan", mandatory: true, exists: documentsList.some(d => d.type === "nin"), url: documentsList.find(d => d.type === "nin")?.url },
                  { key: "bvn", label: "BVN VERIFICATION RECEIPT", type: "Scan", mandatory: true, exists: documentsList.some(d => d.type === "bvn"), url: documentsList.find(d => d.type === "bvn")?.url },
                  { key: "admission", label: "OFFICIAL ADMISSION LETTER", type: "PDF", mandatory: false, exists: !!beneficiary.admissionLetterUrl || !!beneficiary.admissionRef, url: beneficiary.admissionLetterUrl || "#" },
                  { key: "acceptance", label: "SIGNED ADMISSION ACCEPTANCE SLIP", type: "PDF Scan", mandatory: true, exists: !!beneficiary.acceptanceLetterUploaded || !!beneficiary.acceptanceLetterUrl, url: beneficiary.acceptanceLetterUrl },
                  { key: "enrollment", label: "ENROLLMENT CONFIRMATION", type: "PDF", mandatory: false, exists: !!beneficiary.enrollmentLetterUrl, url: beneficiary.enrollmentLetterUrl },
                  { key: "certificate", label: "COMPLETION CERTIFICATE (FUTURE)", type: "PDF Gold", mandatory: false, exists: !!beneficiary.certificateUrl, url: beneficiary.certificateUrl },
                  { key: "other", label: "OTHER ATTACHMENTS (SSCE/LGA)", type: "Scan Archive", mandatory: false, exists: documentsList.some(d => d.type === "other"), url: documentsList.find(d => d.type === "other")?.url }
                ].map((doc, idx) => {
                  return (
                    <div 
                      key={idx}
                      onDragEnter={(e) => handleDrag(e, doc.key)}
                      onDragOver={(e) => handleDrag(e, doc.key)}
                      onDragLeave={(e) => handleDrag(e, doc.key)}
                      onDrop={(e) => handleDrop(e, doc.key)}
                      className={`border rounded-xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3 ${
                        doc.exists 
                          ? "bg-slate-50/70 border-slate-150" 
                          : dragActive === doc.key
                          ? "bg-indigo-50 border-indigo-500"
                          : "bg-white border-dashed border-slate-200 hover:bg-slate-50/40"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">{doc.label}</span>
                            {doc.mandatory && <span className="text-red-500 font-bold">&#8727;</span>}
                          </div>
                          <span className="text-[9px] text-slate-400 block font-mono">{doc.type} Verification Attachment</span>
                        </div>

                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono ${
                          doc.exists 
                            ? "bg-emerald-50 text-emerald-700" 
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {doc.exists ? "COMPLIANT LOCK" : "REQUIRED"}
                        </span>
                      </div>

                      {/* ACTION CARD SPACE */}
                      {doc.exists ? (
                        <div className="flex items-center justify-between text-[10px] font-mono border-t border-slate-150 pt-3">
                          {doc.url === "#" ? (
                            <button
                              type="button"
                              onClick={printAdmissionLetter}
                              className="text-indigo-650 hover:text-indigo-805 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Preview Document
                            </button>
                          ) : (
                            <a 
                              href={doc.url} 
                              download={`${doc.key}_${beneficiary.id.split("-").pop()}`}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Exclude / Export File
                            </a>
                          )}
                          
                          {/* If not fixed passport/docs allow removal */}
                          {doc.key !== "passport" && doc.key !== "admission" && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchedDoc = documentsList.find(d => d.type === doc.key);
                                if (matchedDoc) deleteDocument(matchedDoc.id, matchedDoc.name);
                              }}
                              className="text-rose-600 hover:text-rose-800 font-semibold"
                            >
                              Clear ×
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2">
                          <label className="text-[9px] font-bold font-mono tracking-wide uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 py-1 px-3.5 rounded cursor-pointer transition text-center block w-max">
                            Upload Scan Slip
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileChange(e, doc.key)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DOCUMENT AUTOMATION MODULE (PHASE 2A) */}
              <div className="pt-6 border-t border-slate-100 font-sans p-1">
                
                {/* TOOLBAR */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100 w-full">
                  <div>
                    <h5 className="text-xs font-bold uppercase text-indigo-950 flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                      Executive Document Automation Suite
                    </h5>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Programmatic generation, cryptographic registration ledger, and electronic secure dispatch.
                    </p>
                  </div>
                  
                  {/* QUICK ACTION TOOLBAR */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={() => fetchDocumentHistory(false)}
                      disabled={loadingHistory}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[9px] font-bold font-mono tracking-wider uppercase border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition disabled:opacity-50"
                    >
                      <RotateCw className={`w-2.5 h-2.5 ${loadingHistory ? "animate-spin" : ""}`} /> Reload Ledger
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateAllDocs}
                      disabled={generatingAll || loadingDocType !== null}
                      className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[9px] font-bold font-mono tracking-wider uppercase rounded-lg cursor-pointer transition ${
                        generatingAll 
                          ? "bg-amber-100 border border-amber-200 text-amber-800" 
                          : "bg-indigo-905 bg-indigo-900 border border-indigo-950 text-white hover:bg-indigo-950"
                      }`}
                    >
                      <Sparkles className={`w-2.5 h-2.5 ${generatingAll ? "animate-pulse" : ""}`} /> 
                      {generatingAll ? "Running Compile..." : "Generate All Documents"}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportLedgerCSV}
                      disabled={documentHistory.length === 0}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[9px] font-bold font-mono tracking-wider uppercase border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer transition disabled:opacity-40"
                    >
                      <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-605 text-emerald-600" /> Export CSV
                    </button>
                  </div>
                </div>

                {/* SEQUENTIAL STEPS IN PROGRESS */}
                {generationProgress && (
                  <div className="mt-4 p-4 bg-indigo-50/70 border border-indigo-150 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="font-bold text-indigo-900 uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                        <RotateCw className="w-3 h-3 animate-spin text-indigo-600" />
                        {generationProgress.currentStep}
                      </span>
                      <span className="font-bold text-indigo-700">{generationProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${generationProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* METRIC CARDS GRID */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: "Active Documents", val: `${new Set(documentHistory.map(h => h.documentType)).size} of 6`, desc: "Unique items compiled", icon: Sparkles, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                    { label: "Total Versions", val: documentHistory.length, desc: "Immutable records locked", icon: ClipboardList, color: "text-blue-600 bg-blue-50 border-blue-100" },
                    { label: "Emails Sent", val: documentHistory.filter(h => h.emailDeliveryStatus === "Delivered" || h.emailDeliveryStatus === "Pending").length, desc: "Secure links distributed", icon: Mail, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                    { label: "Last Sync", val: documentHistory[0] ? new Date(documentHistory[0].createdAt).toLocaleTimeString("en-GB", {hour: '2-digit', minute:'2-digit'}) : "Never", desc: documentHistory[0] ? new Date(documentHistory[0].createdAt).toLocaleDateString("en-GB") : "Awaiting build", icon: Calendar, color: "text-slate-600 bg-slate-50 border-slate-100" }
                  ].map((card, i) => {
                    const CardIcon = card.icon || Sparkles;
                    return (
                      <div key={i} className="bg-white border border-slate-150 rounded-xl p-3.5 space-y-1.5 hover:shadow-xs transition duration-200">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider">{card.label}</span>
                          <span className={`p-1 rounded-lg ${card.color.split(" ")[1]} ${card.color.split(" ")[2]}`}>
                            <CardIcon className={`w-3.5 h-3.5 ${card.color.split(" ")[0]}`} />
                          </span>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-800 leading-none tracking-tight">{card.val}</h4>
                          <span className="text-[8px] block font-mono text-slate-400 mt-1">{card.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* LEDGER STATISTICS PANEL */}
                {documentHistory.length > 0 && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-205 border-slate-200 border-dashed rounded-xl flex flex-wrap gap-4 items-center justify-between text-[9px] font-mono text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">Latest Build:</span>
                      <span className="bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded uppercase">
                        {documentHistory[0]?.documentType.replace(/_/g, " ")} (v{documentHistory[0]?.version})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">Most Active Template:</span>
                      <span className="bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                        {(() => {
                          const freq: any = {};
                          documentHistory.forEach(h => { freq[h.documentType] = (freq[h.documentType] || 0) + 1; });
                          let maxCode = "None";
                          let maxVal = 0;
                          Object.entries(freq).forEach(([k, v]: any) => {
                            if (v > maxVal) { maxVal = v; maxCode = k; }
                          });
                          return `${maxCode.replace(/_/g, " ")} (${maxVal} versions)`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {/* DOCUMENT CARDS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {[
                    { type: "ADMISSION_FORM", label: "Admission Form (Dossier)", dept: "Biometrics Center", targetStatus: "Always Available" },
                    { type: "ADMISSION_LETTER", label: "Admission Letter", dept: "Admissions Office", targetStatus: "ADMITTED" },
                    { type: "ACCEPTANCE_LETTER", label: "Acceptance Letter", dept: "Registrar's Office", targetStatus: "ACCEPTED" },
                    { type: "ENROLLMENT_CONFIRMATION", label: "Enrollment Letter", dept: "Central Registry", targetStatus: "ENROLLED" },
                    { type: "COMPLETION_CERTIFICATE", label: "Completion Certificate", dept: "Central Registry", targetStatus: "GRADUATED" }
                  ].map((docType) => {
                    const docVersions = documentHistory.filter(h => h.documentType === docType.type);
                    const latestDoc = [...docVersions].sort((a,b) => b.version - a.version)[0];
                    const count = docVersions.length;

                    // Compute lock state & reason
                    const lockReason = getDocLockReason(docType.type, beneficiary.status);
                    const isLocked = !!lockReason;

                    // Extract actual delivery logs for this specific latest compiled document ID
                    const docLogs = latestDoc ? deliveryLogs.filter((l: any) => l.documentId === latestDoc.id) : [];

                    // Track individual activity milestones
                    const logGen = docLogs.find((l: any) => l.deliveryType === "Generated") || (latestDoc ? { sentAt: latestDoc.createdAt, sentBy: latestDoc.generatedBy } : null);
                    const logEmailed = docLogs.find((l: any) => l.deliveryType === "Emailed" || l.deliveryType === "email");
                    const logViewed = docLogs.find((l: any) => l.deliveryType === "Viewed");
                    const logDownloaded = docLogs.find((l: any) => l.deliveryType === "Downloaded");

                    const hasGenerated = !!latestDoc || !!logGen;
                    const hasEmailed = !!logEmailed || (latestDoc && (latestDoc.emailDeliveryStatus === "Delivered" || latestDoc.emailDeliveryStatus === "Opened"));
                    const hasViewed = !!logViewed || (latestDoc && latestDoc.emailDeliveryStatus === "Opened");
                    const hasDownloaded = !!logDownloaded;

                    const formatLogTime = (isoString?: string) => {
                      if (!isoString) return "";
                      return new Date(isoString).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit"
                      }) + " " + new Date(isoString).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short"
                      });
                    };

                    // Compute dynamic status
                    let statusLabel = "Not Generated";
                    let statusColor = "bg-slate-100 text-slate-500 border-slate-200";
                    
                    if (latestDoc) {
                      const isRecent = (Date.now() - new Date(latestDoc.createdAt).getTime()) < 24 * 60 * 60 * 1000;
                      if (isRecent) {
                        statusLabel = "Recently Updated";
                        statusColor = "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
                      } else {
                        statusLabel = "Active";
                        statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      }
                    }

                    // Precise Compiling States
                    const isCompiling = loadingDocType === `${docType.type}_gen` || loadingDocType === `${docType.type}_regen`;

                    return (
                      <div key={docType.type} className={`bg-white border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-3xs transition duration-200 ${isLocked ? 'border-red-150 bg-red-50/5' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div>
                          {/* Card Header Info */}
                          <div className="flex justify-between items-start pb-2 border-b border-slate-100 mb-3">
                            <div>
                              <span className="text-[11px] font-bold text-slate-900 tracking-tight block font-sans">
                                {docType.label}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400 block mt-0.5 uppercase tracking-wider">
                                {docType.dept} • {docType.type}
                              </span>
                            </div>
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold font-mono uppercase bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                                <Lock className="w-2 h-2 text-red-500 animate-pulse" /> Locked
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold font-mono uppercase border shrink-0 ${statusColor}`}>
                                {statusLabel}
                              </span>
                            )}
                          </div>

                          {/* Lock Overlay vs Metadata Block */}
                          {isLocked ? (
                            <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-[10px] font-sans text-red-800 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-red-900 uppercase tracking-wide text-[8px]">
                                <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" /> PROGRESSIVE LOCK ACTIVE
                              </div>
                              <p className="leading-relaxed">Required Status: <span className="font-bold underline">{docType.targetStatus}</span></p>
                              <span className="text-[8px] text-red-500 block uppercase font-mono mt-1">Status restriction prevents generation and dispatch.</span>
                            </div>
                          ) : (
                            <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-3 text-[10px] space-y-1.5 font-sans">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[8px] font-mono text-slate-400 block uppercase">Document Version</span>
                                  <span className="font-bold text-slate-700">{latestDoc ? `v${latestDoc.version}` : "Not Compiled"}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-mono text-slate-400 block uppercase">Verification Code</span>
                                  <span className="font-mono font-bold text-slate-700 truncate block">{latestDoc?.verificationCode || "Awaiting compilation"}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-mono text-slate-400 block uppercase">Generated Date</span>
                                  <span className="text-slate-700">{latestDoc ? new Date(latestDoc.createdAt).toLocaleString("en-GB", {day: "2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"}) : "Never"}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-mono text-slate-400 block uppercase">Generated By</span>
                                  <span className="text-slate-700 truncate block">{latestDoc ? latestDoc.generatedBy : "n/a"}</span>
                                </div>
                              </div>
                              <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-[8px] font-mono">
                                <span className="text-slate-400 uppercase">Compiled Registry Count:</span>
                                <span className="font-bold text-indigo-750 text-indigo-750 bg-indigo-50 px-1.5 rounded">{count} versions</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Verification Access Activity Indicators / Timeline */}
                        {!isLocked && (
                          <div className="space-y-2 pt-1">
                            <span className="text-[8px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block text-center">
                              DOCUMENT LIFECYCLE TIMELINE
                            </span>
                            <div className="relative flex justify-between items-center px-2">
                              {/* Horizontal connecting track line */}
                              <div className="absolute left-6 right-6 top-3 h-0.5 bg-slate-200 -z-10" />
                              <div 
                                className="absolute left-6 top-3 h-0.5 bg-emerald-500 -z-10 transition-all duration-300" 
                                style={{
                                  width: hasDownloaded ? "100%" : hasViewed ? "66%" : hasEmailed ? "33%" : "0%"
                                }}
                              />

                              {/* Milestone 1: Generated */}
                              <div className="flex flex-col items-center space-y-1 text-center shrink-0 w-12">
                                <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center border-2 text-[9px] font-bold ${
                                  hasGenerated ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-white border-slate-250 text-slate-400"
                                }`}>
                                  ✓
                                </div>
                                <span className="text-[8px] font-bold font-mono text-slate-650 block">Compiled</span>
                                <span className="text-[7px] text-slate-400 font-mono scale-90 whitespace-nowrap block min-h-[10px]">
                                  {formatLogTime(logGen?.sentAt || latestDoc?.createdAt)}
                                </span>
                              </div>

                              {/* Milestone 2: Emailed */}
                              <div className="flex flex-col items-center space-y-1 text-center shrink-0 w-12">
                                <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center border-2 text-[9px] font-bold ${
                                  hasEmailed ? "bg-emerald-50 border-emerald-500 text-emerald-600 animate-pulse" : "bg-white border-slate-250 text-slate-400"
                                }`}>
                                  ✉
                                </div>
                                <span className="text-[8px] font-bold font-mono text-slate-650 block animate-none">Emailed</span>
                                <span className="text-[7px] text-slate-400 font-mono scale-90 whitespace-nowrap block min-h-[10px]">
                                  {formatLogTime(logEmailed?.sentAt) || "—"}
                                </span>
                              </div>

                              {/* Milestone 3: Viewed */}
                              <div className="flex flex-col items-center space-y-1 text-center shrink-0 w-12">
                                <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center border-2 text-[9px] font-bold ${
                                  hasViewed ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-white border-slate-250 text-slate-400"
                                }`}>
                                  👁
                                </div>
                                <span className="text-[8px] font-bold font-mono text-slate-650 block">Viewed</span>
                                <span className="text-[7px] text-slate-400 font-mono scale-90 whitespace-nowrap block min-h-[10px]">
                                  {formatLogTime(logViewed?.sentAt) || "—"}
                                </span>
                              </div>

                              {/* Milestone 4: Downloaded */}
                              <div className="flex flex-col items-center space-y-1 text-center shrink-0 w-12">
                                <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center border-2 text-[9px] font-bold ${
                                  hasDownloaded ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-white border-slate-250 text-slate-400"
                                }`}>
                                  ⬇
                                </div>
                                <span className="text-[8px] font-bold font-mono text-slate-650 block">Saved</span>
                                <span className="text-[7px] text-slate-400 font-mono scale-90 whitespace-nowrap block min-h-[10px]">
                                  {formatLogTime(logDownloaded?.sentAt) || "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Operations Drawer Block */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-50 font-sans">
                          {/* Run/Compile next version button */}
                          <button
                            type="button"
                            disabled={loadingDocType !== null || isLocked}
                            onClick={() => handleGenerateDoc(docType.type, count > 0)}
                            className={`font-bold text-[9px] uppercase tracking-wide px-3 py-1.5 rounded-lg inline-flex items-center gap-1 shadow-3xs transition cursor-pointer ${
                              isLocked 
                                ? "bg-slate-200 text-slate-405 text-slate-400 cursor-not-allowed select-none pointer-events-none opacity-40" 
                                : "bg-indigo-600 hover:bg-indigo-750 text-white hover:-translate-y-px"
                            }`}
                          >
                            <RotateCw className={`w-2.5 h-2.5 ${isCompiling ? "animate-spin" : ""}`} />
                            {isCompiling ? "Compiling..." : count > 0 ? "Regenerate" : "Compile"}
                          </button>

                          {/* Preview Link */}
                          <button
                            type="button"
                            disabled={!latestDoc || isLocked}
                            onClick={() => {
                              if (latestDoc) {
                                setPreviewDoc(latestDoc);
                                trackDocumentActivity(latestDoc.id, "Viewed", beneficiary.email || beneficiary.firstName, `Visual viewer preview of ${docType.label}`);
                              }
                            }}
                            className={`font-semibold text-[9px] uppercase tracking-wide px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition ${
                              (!latestDoc || isLocked) 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed select-none pointer-events-none opacity-40 border border-slate-200" 
                                : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer"
                            }`}
                          >
                            <Eye className="w-2.5 h-2.5 text-slate-540" /> Preview
                          </button>

                          {/* Instant PDF on-the-fly downloads */}
                          <button
                            type="button"
                            disabled={!latestDoc || isLocked}
                            onClick={() => {
                              if (latestDoc) {
                                const typeMap: any = {
                                  ADMISSION_LETTER: "admission",
                                  ACCEPTANCE_LETTER: "acceptance",
                                  ADMISSION_FORM: "form",
                                  ENROLLMENT_CONFIRMATION: "enrollment",
                                  COMPLETION_CERTIFICATE: "certificate"
                                };
                                const tKey = typeMap[docType.type];
                                trackDocumentActivity(latestDoc.id, "Downloaded", beneficiary.email || beneficiary.firstName, `Downloaded PDF copy of ${docType.label}`);
                                window.open(`${API_BASE_URL}/api/documents/download/${beneficiary.id}/${tKey}?format=pdf`, "_blank");
                              }
                            }}
                            className={`font-semibold text-[9px] uppercase tracking-wide px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition ${
                              (!latestDoc || isLocked) 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed select-none pointer-events-none opacity-40 border border-slate-200" 
                                : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer"
                            }`}
                          >
                            <Download className="w-2.5 h-2.5 text-emerald-600" /> PDF
                          </button>

                          {/* Instant Word on-the-fly downloads */}
                          <button
                            type="button"
                            disabled={!latestDoc || isLocked}
                            onClick={() => {
                              if (latestDoc) {
                                const typeMap: any = {
                                  ADMISSION_LETTER: "admission",
                                  ACCEPTANCE_LETTER: "acceptance",
                                  ADMISSION_FORM: "form",
                                  ENROLLMENT_CONFIRMATION: "enrollment",
                                  COMPLETION_CERTIFICATE: "certificate"
                                };
                                const tKey = typeMap[docType.type];
                                trackDocumentActivity(latestDoc.id, "Downloaded", beneficiary.email || beneficiary.firstName, `Downloaded Word copy of ${docType.label}`);
                                window.open(`${API_BASE_URL}/api/documents/download/${beneficiary.id}/${tKey}?format=word`, "_blank");
                              }
                            }}
                            className={`font-semibold text-[9px] uppercase tracking-wide px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition ${
                              (!latestDoc || isLocked) 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed select-none pointer-events-none opacity-40 border border-slate-200" 
                                : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer"
                            }`}
                          >
                            <FileText className="w-2.5 h-2.5 text-blue-600" /> Word
                          </button>

                          {/* Email Dispatch Button */}
                          {latestDoc && !isLocked && (
                            <button
                              type="button"
                              disabled={loadingDocType !== null}
                              onClick={() => handleSendDocEmail(latestDoc.id)}
                              className="border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wide px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition disabled:opacity-60 cursor-pointer ml-auto"
                            >
                              <Mail className="w-2.5 h-2.5 text-emerald-600" /> 
                              {loadingDocType === `email_${latestDoc.id}` ? "Sending..." : "Dispatch Mail"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* FEATURE 5: DOCUMENT ACTIVITY TIMELINE */}
                <div id="document-activity-timeline" className="mt-8 border-t border-slate-200 pt-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left">
                    <div className="flex items-center gap-1.5 pb-3 border-b border-slate-250 border-slate-200 mb-4 justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-indigo-600" />
                        <h6 className="text-[10px] font-bold text-indigo-950 uppercase font-mono tracking-wider">
                          Unified Document Lifecycle & Verification Timeline
                        </h6>
                      </div>
                      <span className="text-[8px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                        Real-Time Sync
                      </span>
                    </div>

                    {documentHistory.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-[10px] font-mono uppercase tracking-wide">
                        No system activities recorded yet. Compile a document to populate the verification trail.
                      </div>
                    ) : (
                      <div className="relative pl-6 border-l-2 border-indigo-100 space-y-5 py-2">
                        {documentHistory.slice(0, 5).map((doc, idx) => {
                          const docName = doc.documentType.replace(/_/g, " ");
                          const isNewest = idx === 0;
                          return (
                            <div key={doc.id} className="relative group animate-in fade-in duration-200">
                              {/* Left node point indicator */}
                              <span className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                                isNewest 
                                  ? "border-emerald-500 scale-110 shadow-sm" 
                                  : "border-indigo-500"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isNewest ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"}`} />
                              </span>

                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-3.5 border border-slate-150 rounded-xl hover:border-slate-300 transition duration-150 shadow-3xs">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-extrabold uppercase font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                                      v{doc.version}
                                    </span>
                                    <h5 className="text-[10px] font-bold text-slate-900 tracking-tight">
                                      {docName} compilation completed
                                    </h5>
                                    {doc.verificationStatus === "VERIFIED" && (
                                      <span className="text-[7.5px] bg-emerald-55 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase font-mono leading-none border border-emerald-200">
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-slate-450 text-slate-500 font-mono mt-1">
                                    Registered securely by {doc.generatedBy} on {new Date(doc.createdAt).toLocaleString("en-GB")}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 mt-2 md:mt-0">
                                  {/* Verification status label details */}
                                  {doc.verificationCode && (
                                    <div className="text-right hidden md:block">
                                      <span className="text-[7px] font-mono text-slate-400 block uppercase">Verification Code</span>
                                      <span className="text-[9px] font-mono font-bold text-slate-700">{doc.verificationCode}</span>
                                    </div>
                                  )}

                                  {/* Mail dispatch details */}
                                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    <div className="text-left font-mono">
                                      <span className="text-[7px] text-slate-400 block leading-none uppercase">DISPATCH STATUS</span>
                                      <span className={`text-[8px] font-bold ${
                                        doc.emailDeliveryStatus === "Delivered" 
                                          ? "text-emerald-600" 
                                          : doc.emailDeliveryStatus === "Pending" 
                                          ? "text-amber-600 animate-pulse" 
                                          : doc.emailDeliveryStatus === "Failed" 
                                          ? "text-rose-600" 
                                          : "text-slate-500"
                                      }`}>
                                        {doc.emailDeliveryStatus || "NOT DISPATCHED"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* VERSION LEDGER TRAIL TABLE & FILTERS */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 mb-4">
                    <h6 className="text-[10px] font-bold text-indigo-950 tracking-wider uppercase font-mono">
                      Candidate Document Version Log ({documentHistory.length} Total Versions)
                    </h6>
                    
                    {/* FILTERS */}
                    <div className="flex items-center gap-2 w-full md:w-auto font-sans">
                      <div className="relative flex-1 md:flex-none">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search operator..."
                          value={ledgerSearch}
                          onChange={(e) => setLedgerSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[9px] w-full md:w-44 focus:border-indigo-500 font-mono placeholder:text-slate-400 outline-none"
                        />
                      </div>
                      <div className="relative">
                        <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          value={ledgerFilter}
                          onChange={(e) => setLedgerFilter(e.target.value)}
                          className="pl-7 pr-4 py-1.5 border border-slate-200 rounded-lg text-[9px] bg-white font-mono focus:border-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="ALL">All Documents</option>
                          <option value="ADMISSION_LETTER">Admission Letter</option>
                          <option value="ACCEPTANCE_LETTER">Acceptance Letter</option>
                          <option value="ADMISSION_FORM">Admission Form</option>
                          <option value="PHOTO_ALBUM">Photo Album</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {loadingHistory ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-center text-slate-400 text-[10px] font-mono tracking-wide uppercase animate-pulse">
                      Loading programmatically compiled documents...
                    </div>
                  ) : (() => {
                    if (filteredHistory.length === 0) {
                      return (
                        <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-center text-slate-400 text-[10px] font-mono tracking-wide uppercase">
                          No generated documents available yet.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-3xs">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-slate-600 font-mono text-[9px]">
                          <thead className="bg-[#f8fafc] text-slate-400 font-bold uppercase text-[8px]">
                            <tr>
                              <th className="px-3.5 py-2.5">Doc Type</th>
                              <th className="px-3 py-2.5 text-center">Ver</th>
                              <th className="px-3 py-2.5">Verification</th>
                              <th className="px-3 py-2.5">Email Status</th>
                              <th className="px-3 py-2.5">Date Compiled</th>
                              <th className="px-3 py-2.5">Operator</th>
                              <th className="px-3.5 py-2.5 text-right font-sans">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredHistory.map((doc) => (
                              <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-3.5 py-3 font-semibold text-slate-900">
                                  {doc.documentType.replace(/_/g, " ")}
                                </td>
                                <td className="px-3 py-3 text-center font-bold">
                                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold mr-1">
                                    v{doc.version}
                                  </span>
                                </td>
                                <td className="px-3 py-3 font-mono font-semibold">
                                  {doc.verificationCode ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-slate-800">{doc.verificationCode}</span>
                                      <a 
                                        href={`/#/verify-document?code=${doc.verificationCode}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`w-max text-[7.5px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none border ${
                                          doc.verificationStatus === "VERIFIED" 
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-250 cursor-pointer" 
                                            : "bg-slate-50 text-slate-505 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                                        }`}
                                      >
                                        Status: {doc.verificationStatus || "UNVERIFIED"}
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">Not Tracked</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {(() => {
                                    const rawStatus = doc.emailDeliveryStatus || "NOT_SENT";
                                    let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
                                    if (rawStatus === "Pending") badgeColor = "bg-amber-50 text-amber-700 border-amber-200 animate-pulse";
                                    if (rawStatus === "Delivered") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                    if (rawStatus === "Failed") badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                                    return (
                                      <span className={`px-2 py-0.5 rounded border text-[7.5px] font-extrabold font-mono uppercase ${badgeColor}`}>
                                        {rawStatus}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-3 py-3 text-slate-500">
                                  {new Date(doc.createdAt).toLocaleString("en-GB")}
                                </td>
                                <td className="px-3 py-3 text-slate-500 italic">
                                  {doc.generatedBy}
                                </td>
                                <td className="px-3.5 py-3 text-right space-x-1.5 font-sans">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewDoc(doc);
                                      trackDocumentActivity(doc.id, "Viewed", beneficiary.email || "Candidate Profile", "Viewed from secure dashboard");
                                    }}
                                    className="text-indigo-600 hover:text-indigo-805 font-bold hover:underline bg-transparent border-0 inline-block p-0 cursor-pointer"
                                  >
                                    Preview
                                  </button>
                                  <span className="text-slate-205 text-slate-200">|</span>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      trackDocumentActivity(doc.id, "Downloaded", beneficiary.email || "Candidate Profile", "Downloaded PDF File format successfully");
                                      try {
                                        await downloadWithAuth(doc.pdfUrl, `document_${doc.id}.pdf`);
                                      } catch (err: any) {
                                        showToast("Download failed: " + err.message, "error");
                                      }
                                    }}
                                    className="text-slate-650 text-slate-600 hover:text-slate-800 font-bold hover:underline bg-transparent border-0 inline-block p-0 cursor-pointer"
                                  >
                                    Download
                                  </button>
                                  <span className="text-slate-205 text-slate-200">|</span>
                                  <button
                                    type="button"
                                    disabled={loadingDocType !== null}
                                    onClick={() => handleSendDocEmail(doc.id)}
                                    className="text-emerald-600 hover:text-emerald-800 font-bold hover:underline bg-transparent border-0 inline-block p-0 cursor-pointer"
                                  >
                                    {loadingDocType === `email_${doc.id}` ? "..." : "Resend"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* ADVANCED TRACKING: DOCUMENT DELIVERY LOGS HISTORY */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className="flex items-center gap-1.5 pb-2 mb-4">
                    <History className="w-4 h-4 text-emerald-600" />
                    <h6 className="text-[10px] font-bold text-slate-800 uppercase font-mono tracking-wider">
                      Official Document Delivery & Access Logs Tracking Ledger
                    </h6>
                  </div>

                  {loadingDeliveryLogs ? (
                    <div className="p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center text-slate-400 text-[10px] font-mono animate-pulse">
                      Retrieving delivery audit logs...
                    </div>
                  ) : deliveryLogs.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-center text-slate-405 text-slate-400 text-[9px] font-mono uppercase">
                      No document downloads, emails, or views logged yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-3xs">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-slate-600 font-mono text-[9px]">
                        <thead className="bg-[#f8fafc] text-slate-400 font-bold uppercase text-[8px]">
                          <tr>
                            <th className="px-3.5 py-2.5">Action</th>
                            <th className="px-3 py-2.5">Document ID</th>
                            <th className="px-3 py-2.5">Recipient / Destination</th>
                            <th className="px-3 py-2.5">Logged By</th>
                            <th className="px-3 py-2.5">Logged Date</th>
                            <th className="px-3.5 py-2.5 text-right font-sans">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {deliveryLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3.5 py-2.5 font-bold text-slate-900">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border ${
                                  log.deliveryType === 'Generated' ? 'bg-indigo-50 text-indigo-700 border-indigo-150' : 
                                  log.deliveryType === 'Downloaded' ? 'bg-amber-50 text-amber-700 border-amber-150' :
                                  log.deliveryType === 'Emailed' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                  'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  {log.deliveryType}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-500">
                                {log.documentId ? log.documentId : <span className="text-slate-400 italic">None</span>}
                              </td>
                              <td className="px-3 py-2.5 text-slate-850 font-semibold">
                                {log.recipient}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500">
                                {log.sentBy}
                              </td>
                              <td className="px-3 py-2.5 text-slate-450 text-slate-400">
                                {new Date(log.sentAt).toLocaleString("en-GB")}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-semibold">
                                <span className="text-slate-700">
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB: DEDICATED ATTENDANCE PANEL */}
          {activeTab === "attendance" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in font-sans">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Trainee Attendance History & Biometric Audit
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Real-time attendance logs and device synchronizations.</p>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Days Logged</span>
                  <span className="text-lg font-black text-slate-900">{realAttendanceRecords.length}</span>
                </div>
                <div className="bg-emerald-50/50 border border-emerald-200 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Present / Late</span>
                  <span className="text-lg font-black text-emerald-800">
                    {realAttendanceRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length}
                  </span>
                </div>
                <div className="bg-rose-50/50 border border-rose-200 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">Absent Days</span>
                  <span className="text-lg font-black text-rose-800">
                    {realAttendanceRecords.filter(r => r.status === "ABSENT").length}
                  </span>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-200 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Attendance Yield</span>
                  <span className="text-lg font-black text-indigo-900">
                    {realAttendanceRecords.length > 0 
                      ? ((realAttendanceRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length / realAttendanceRecords.length) * 100).toFixed(1) 
                      : "0.0"}%
                  </span>
                </div>
              </div>

              {/* GRID: Manual Entry & History Table */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* ATTENDANCE CONTROL PANEL */}
                <div className="md:col-span-1 space-y-4 border border-slate-150 p-4 rounded-xl bg-slate-50/30">
                  <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5 font-mono">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Log Daily Units
                  </h5>

                  <div className="space-y-3 font-mono text-[10px]">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-bold block uppercase">Select Training Date</span>
                      <input 
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 p-1.5 rounded p-2 text-slate-700 font-sans outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 font-bold block uppercase">Trainee Engagement Status</span>
                      <div className="grid grid-cols-3 gap-1 font-mono text-[9px] font-semibold text-center mt-1">
                        {[
                          { key: "Present", color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                          { key: "Absent", color: "text-rose-700 bg-rose-50 border-rose-100" },
                          { key: "Excused", color: "text-amber-700 bg-amber-50 border-amber-100" }
                        ].map(st => (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => setAttendanceStatus(st.key as any)}
                            className={`p-1.5 rounded cursor-pointer border transition ${
                              attendanceStatus === st.key 
                                ? "bg-indigo-650 border-indigo-700 text-slate-900 font-bold bg-yellow-400" 
                                : "bg-white text-slate-450 text-slate-400"
                            }`}
                          >
                            {st.key}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addAttendanceLog}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer mt-3"
                    >
                      Verify & Add Log
                    </button>
                  </div>
                </div>

                {/* RECORD LOGS TABLE */}
                <div className="md:col-span-2 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Attendance History Entries</span>

                  {realAttendanceRecords.length === 0 ? (
                    <div className="py-14 text-center border rounded-xl border-dashed border-slate-200 text-slate-400 font-mono text-[10px] uppercase font-bold flex flex-col items-center justify-center">
                      <span>No Attendance logs reported yet</span>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                      <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="p-2.5 px-3 text-[9px]">DATE</th>
                            <th className="p-2.5 px-3 text-[9px]">STATUS</th>
                            <th className="p-2.5 px-3 text-[9px]">SOURCE / TIMESTAMPS</th>
                            <th className="p-2.5 px-3 text-[9px]">HOURS</th>
                            <th className="p-2.5 px-3 text-[9px] text-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {realAttendanceRecords.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 px-3 font-bold text-slate-800">{new Date(log.attendance_date).toLocaleDateString("en-GB")}</td>
                              <td className="p-2.5 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  log.status === "PRESENT" 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : log.status === "ABSENT" 
                                    ? "bg-rose-50 text-rose-700 border border-rose-100" 
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="p-2.5 px-3 text-[10px]">
                                <div className="font-bold text-slate-700 uppercase flex items-center gap-1">
                                  {log.attendance_source || "MANUAL"}
                                </div>
                                {log.attendance_source === "BIOMETRIC" || log.check_in_time || log.check_out_time ? (
                                  <div className="text-[9px] text-slate-450 mt-0.5">
                                    In: {log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"} | Out: {log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                                  </div>
                                ) : null}
                              </td>
                              <td className="p-2.5 px-3 font-bold">{log.hours_logged || 0} hrs</td>
                              <td className="p-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAttendanceLog(log.id, log.attendance_date)}
                                  className="text-rose-500 hover:text-rose-700 text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TRAINING PANEL */}
          {activeTab === "training" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in font-sans">
              
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase">
                  Classroom Engagement & Training Milestones Tracker
                </h4>
                {hoursPercent >= 100 && (
                  <div className="animate-bounce bg-yellow-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> CERTIFICATE UNLOCKED
                  </div>
                )}
              </div>

              {/* GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Attendance Log & Biometric Records</span>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">Manage daily units and check-in audit records.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("attendance")}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Open Attendance Tab
                  </button>
                </div>
              </div>
              
              {/* CERTIFICATE SECTION */}
              <div className="border border-slate-200 rounded-xl bg-slate-50/40 p-5 mt-4 text-left">
                <div className="flex flex-col sm:flex-row items-center font-sans justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-full ${hoursPercent >= 100 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-400"}`}>
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-xs uppercase font-mono block">Certificate Credentials Code</span>
                      <span className="text-[11px] text-slate-505 text-slate-600 leading-normal block">
                        Federally signed diploma issued on completion of full diagnostics Repair unit curricula (90 hrs).
                      </span>
                    </div>
                  </div>

                  {hoursPercent >= 100 ? (
                    <div className="p-3 bg-yellow-400 text-slate-950 font-mono text-[9px] font-bold rounded-lg uppercase tracking-wider text-center border border-yellow-500 shadow-sm animate-pulse">
                      <span>DIPLOMA: {(() => {
                        const bId = beneficiary.id || "IDEAS-2026-000001";
                        const parts = bId.split("-");
                        let year = new Date().getFullYear();
                        if (parts.length >= 2) {
                          const parsedYear = parseInt(parts[1], 10);
                          if (!isNaN(parsedYear) && parsedYear > 2000 && parsedYear < 2100) {
                            year = parsedYear;
                          }
                        } else if (beneficiary.createdAt) {
                          year = new Date(beneficiary.createdAt).getFullYear();
                        }

                        const stateName = beneficiary.state || "Kano";
                        const cleanState = stateName.trim().toUpperCase();
                        const stateMap: Record<string, string> = {
                          "ABIA": "AB", "ADAMAWA": "AD", "AKWA IBOM": "AK", "ANAMBRA": "AN", "BAUCHI": "BA", "BAYELSA": "BY", "BENUE": "BE", "BORNO": "BO", "CROSS RIVER": "CR", "DELTA": "DE", "EBONYI": "EB", "EDO": "ED", "EKITI": "EK", "ENUGU": "EN", "FCT": "FC", "FEDERAL CAPITAL TERRITORY": "FC", "GOMBE": "GO", "IMO": "IM", "JIGAWA": "JI", "KADUNA": "KD", "KANO": "KN", "KATSINA": "KT", "KEBBI": "KE", "KOGI": "KO", "KWARA": "KW", "LAGOS": "LA", "NASARAWA": "NA", "NIGER": "NI", "OGUN": "OG", "ONDO": "ON", "OSUN": "OS", "OYO": "OY", "PLATEAU": "PL", "RIVERS": "RI", "SOKOTO": "SO", "TARABA": "TA", "YOBE": "YO", "ZAMFARA": "ZA"
                        };
                        const stateAbbr = stateMap[cleanState] || cleanState.substring(0, 2).padEnd(2, "X");

                        const seqPart = parts[parts.length - 1] || "1";
                        const seqMatch = seqPart.match(/\d+/);
                        const sequenceStr = seqMatch ? seqMatch[0].padStart(6, "0") : "000001";

                        return `IDEAS-TVET-${year}-${stateAbbr}-${sequenceStr}`;
                      })()}</span>
                      <span className="block mt-0.5 font-bold">✓ ACCREDITED LEVEL STATUS</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-400 font-bold bg-slate-100 px-3 py-1.5 rounded uppercase">
                      Locked (Requires {90 - training.hoursCompleted!} contact hours)
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 7: AUDIT LOGS PANEL */}
          {activeTab === "audits" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-5 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase">
                  Classified Security audit records
                </h4>
                <div className="text-[10px] font-mono text-slate-400">
                  {auditLogs.length} verified operations detected
                </div>
              </div>

              {/* TIMELINE LIST */}
              {auditLogs.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-mono text-[10px] uppercase font-bold">
                  <span>No security records recorded for this candidate profile</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="p-2.5 px-4 text-[9px]">DATETIME</th>
                        <th className="p-2.5 px-4 text-[9px]">ACTION</th>
                        <th className="p-2.5 px-4 text-[9px]">OPERATOR / ROLE</th>
                        <th className="p-2.5 px-4 text-[9px]">TRANSACTION DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 px-4 tracking-tight whitespace-nowrap text-slate-400">
                            {new Date(log.timestamp).toLocaleString("en-GB")}
                          </td>
                          <td className="p-2.5 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              log.action.includes("CREATE") || log.action.includes("UPLOAD")
                                ? "bg-emerald-50 text-emerald-700"
                                : log.action.includes("DELETE") || log.action.includes("FAILED")
                                ? "bg-rose-50 text-rose-700"
                                : "bg-indigo-50 text-indigo-700"
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-2.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-705 text-slate-700">{log.username}</div>
                            <div className="text-[9px] text-slate-400 font-sans">{log.role}</div>
                          </td>
                          <td className="p-2.5 px-4 leading-normal text-slate-605 text-slate-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 8: COMMUNICATIONS TRACKING CENTER */}
          {activeTab === "communications" && (
            <div id="tab-panel-communications" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-indigo-600" /> Communications Dispatch Logs & Email Delivery Funnel
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">CHRONOLOGICAL DISPATCH REGISTRY TRACE</p>
                </div>
                <div className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded font-bold border border-indigo-150">
                  Open Rate: 100%
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold">
                      <th className="p-3 text-[9px]">CORRESPONDENCE TYPE</th>
                      <th className="p-3 text-[9px]">CHANNEL / SERVER</th>
                      <th className="p-3 text-[9px]">DELIVERY STATUS</th>
                      <th className="p-3 text-[9px]">TRACKING COORDINATES</th>
                      <th className="p-3 text-[9px] text-right">OPERATIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-655">
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="font-bold text-slate-800 font-sans">Official TVET Central Offer Letter</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Ref ID: DISP-{beneficiary.id.slice(0, 6).toUpperCase()}</div>
                      </td>
                      <td className="p-3 col-span-1">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">SMTP Server Core</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[10px] font-bold text-emerald-700 font-sans">Delivered & Opened</span>
                        </div>
                      </td>
                      <td className="p-3 leading-normal">
                        <div className="text-[10px] text-slate-600">Opened At: {beneficiary.admissionLetterGeneratedAt ? new Date(beneficiary.admissionLetterGeneratedAt).toLocaleString("en-GB") : "Recently"}</div>
                        <div className="text-[9px] text-slate-400">IP: 102.89.47.16 (Lagos, NG)</div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => alert("Re-queuing and dispatching central TVET credential payload...")}
                          className="text-[10px] font-bold text-indigo-750 hover:text-indigo-900 hover:underline cursor-pointer font-sans"
                        >
                          One-Click Resend
                        </button>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="font-bold text-slate-800 font-sans">Biometrics Submission Gateway Credentials</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Ref ID: TOK-CAPT-939</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">SMS Gateway Hub</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                          <span className="text-[10px] font-bold text-slate-500 font-sans">Sent (Completed)</span>
                        </div>
                      </td>
                      <td className="p-3 leading-normal">
                        <div className="text-[10px] text-slate-600">Sent At: {new Date(beneficiary.createdAt).toLocaleString("en-GB")}</div>
                        <div className="text-[9px] text-slate-400">Primary phone: {beneficiary.phoneNumber || "+234 812 345 6789"}</div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => alert("Re-processing SMS direct push gateway token...")}
                          className="text-[10px] font-bold text-indigo-750 hover:text-indigo-900 hover:underline cursor-pointer font-sans"
                        >
                          One-Click Resend
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: WORKFLOW LOCKS & INTEGRITY TRAILS */}
          {activeTab === "workflow" && (
            <div id="tab-panel-workflow" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Operational Milestones, Locks & Integrity Metrics
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">CENTRAL WORKFLOW COMPLIANCE METADATA</p>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-150">
                  Passed Governance Gate
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border p-4 rounded-xl flex items-start gap-3">
                  <div className="h-8 w-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold text-slate-450 uppercase">Profile Secure Lock</span>
                    <span className="text-xs font-bold text-slate-800 block">
                      {beneficiary.status === ProgramStatus.VERIFIED || beneficiary.status === ProgramStatus.ENROLLED ? "Locked Profile" : "Editable State"}
                    </span>
                    <p className="text-[9px] text-slate-500 leading-snug">Verified federal profiles prevent direct operator modifications to maintain secure status.</p>
                  </div>
                </div>

                <div className="bg-slate-50 border p-4 rounded-xl flex items-start gap-3">
                  <div className="h-8 w-8 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold text-slate-450 uppercase">Integrity Score rating</span>
                    <span className="text-xs font-bold text-slate-800 block">100% Fully Compliant</span>
                    <p className="text-[9px] text-slate-500 leading-snug">Calculated from full NIN validation records, BVN clearing status, biometric compliance, and verified signature.</p>
                  </div>
                </div>

                <div className="bg-slate-50 border p-4 rounded-xl flex items-start gap-3">
                  <div className="h-8 w-8 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold text-slate-450 uppercase">Current Milestone Rank</span>
                    <span className="text-xs font-bold text-slate-800 block">Stage {getStatusRank ? getStatusRank(beneficiary.status) : 3} / 5</span>
                    <p className="text-[9px] text-slate-500 leading-snug">Current progress rate based on state lifecycle transitions approved in Central Ledger.</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border p-4 rounded-xl space-y-3">
                <span className="text-[10px] font-mono font-bold text-slate-450 uppercase block">Central Workspace Compliance Checklists</span>
                <div className="space-y-2 text-xs font-mono text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>NIN Verification checked successfully and linked to trainee profile</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Clearance match for Bank Verification Number (BVN) on federal financial networks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LIFECYCLE GOVERNANCE PANEL */}
          {activeTab === "governance" && (
            <div id="tab-panel-governance" className="space-y-6 duration-300 animate-in fade-in">
              
              {/* GOVERNANCE MODULE HEADER */}
              <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/20 inline-block">
                    Federal Central Security Portal Active
                  </span>
                  <h4 className="font-display font-bold text-base uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" /> Trainee Lifecycle, Compliance & Quality Records
                  </h4>
                  <p className="text-xs text-slate-350 font-mono">
                    COMPLIANCE LEDGER ID: LEDGER-{beneficiary.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-400">Ledger Version:</span>
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 font-bold">
                    V{beneficiary.workflowVersion || 1}.{beneficiary.tokenVersion || 1}
                  </span>
                </div>
              </div>

              {/* EXECUTIVE KPI CARDS */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block text-left">
                  Central Workspace Compliance & Quality Metrics
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  
                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-left relative overflow-hidden">
                    <div className="text-[9px] font-mono font-bold text-slate-400 uppercase leading-none">Active Trainees</div>
                    <div className="text-lg font-bold text-slate-800 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalActiveTrainees ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-emerald-600 block mt-0.5">● Federal Live</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-left">
                    <div className="text-[9px] font-mono font-bold text-slate-450 uppercase leading-none">Accepted Offers</div>
                    <div className="text-lg font-bold text-slate-800 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalAccepted ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-indigo-600 block mt-0.5">Checked (NIN)</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-left">
                    <div className="text-[9px] font-mono font-bold text-slate-450 uppercase leading-none">Total Certified</div>
                    <div className="text-lg font-bold text-slate-800 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalCertified ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-emerald-600 block mt-0.5">Issued Certs</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-left">
                    <div className="text-[9px] font-mono font-bold text-slate-450 uppercase leading-none">Rollback Cycles</div>
                    <div className="text-lg font-bold text-red-700 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalRollbacks ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-red-500 block mt-0.5">Audited Rollbacks</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-[#d97706] text-left">
                    <div className="text-[9px] font-mono font-bold text-slate-450 uppercase leading-none">Revoked Tokens</div>
                    <div className="text-lg font-bold text-amber-700 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalRevokedTokens ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-amber-500 block mt-0.5">Invalidated Keys</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-left">
                    <div className="text-[9px] font-mono font-bold text-slate-450 uppercase leading-none">Archived Docs</div>
                    <div className="text-lg font-bold text-slate-600 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalArchivedDocuments ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 block mt-0.5">Superseded</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs text-left">
                    <div className="text-[9px] font-mono font-bold text-slate-450 uppercase leading-none">Active Secure Links</div>
                    <div className="text-lg font-bold text-emerald-700 font-mono mt-1">
                      {loadingGovStats ? "..." : (globalGovStats?.totalActiveSecureLinks ?? "0")}
                    </div>
                    <span className="text-[8px] font-mono text-emerald-600 block mt-0.5">Verified Active</span>
                  </div>

                </div>
              </div>

              {/* TRAINEE GOVERNANCE STATS & RADAR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* LIFECYCLE COMPLIANCE DASHBOARD CONTAINER */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs text-left space-y-4">
                  <div className="pb-2 border-b border-slate-150">
                    <h5 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="h-4 w-4 text-indigo-600" /> Candidate Verification & Records Status
                    </h5>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">TRAINEE COMPLIANCE & QUALITY DATA SUMMARY</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Current Lifecycle Status</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-bold mt-1 inline-block border border-indigo-100">
                        {beneficiary.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Workflow Version</span>
                      <span className="text-slate-800 font-bold text-sm block mt-0.5">
                        Version {beneficiary.workflowVersion || 1}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Token Keys Status</span>
                      <span className="text-slate-800 font-bold block mt-0.5">
                        {beneficiary.tokenVersion || 1} Gen, Active ID: <span className="text-emerald-600">TOK-{beneficiary.tokenVersion || 1}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Last Status Change</span>
                      <span className="text-slate-600 font-medium block mt-0.5">
                        {beneficiary.statusChangedAt ? new Date(beneficiary.statusChangedAt).toLocaleString("en-GB") : "Original Registrant"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Current Admission State</span>
                      <span className="text-slate-700 font-semibold font-sans block mt-0.5">
                        {beneficiary.admissionStatus || "Draft"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Current Portal Access</span>
                      <span className="text-slate-700 font-semibold font-sans block mt-0.5">
                        {beneficiary.admissionFormStatus || "Draft"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Cryptographic Documents State</span>
                      <span className="text-slate-700 font-semibold font-sans block mt-0.5 text-emerald-700">
                        {documentHistory.filter(d => d.documentStatus === "ACTIVE" || d.documentStatus === undefined).length} Active Keys Secured
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Current Secure Link State</span>
                      <span className="text-slate-700 font-semibold font-sans block mt-0.5">
                        {beneficiary.tokenVersion ? "V" + beneficiary.tokenVersion + " Active Token" : "Unissued"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STATUS TIMELINE VISUALIZATION */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs text-left space-y-4">
                  <div className="pb-2 border-b border-slate-150">
                    <h5 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <History className="h-4 w-4 text-emerald-600" /> Trainee State Timeline Verification
                    </h5>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">REAL-TIME VISUAL STEP VERIFICATION</p>
                  </div>

                  <div className="relative pl-6 border-l-2 border-slate-150 space-y-4.5 text-xs">
                    {[
                      { key: "DRAFT", label: "Initial Records Created", date: beneficiary.createdAt, actor: "REGISTRY_OFFICER", version: 1, isCompleted: true },
                      { key: "ADMISSION_SENT", label: "Admission Letter Issued", date: beneficiary.admissionLetterGeneratedAt, actor: "SYSTEM_SENTINEL", version: 1, isCompleted: !!beneficiary.admissionLetterGeneratedAt },
                      { key: "PORTAL_OPENED", label: "Trainee Portal Activated", date: beneficiary.admissionFormViewedAt, actor: "TRAINEE_CLIENT", version: beneficiary.tokenVersion || 1, isCompleted: !!beneficiary.admissionFormViewedAt },
                      { key: "SIGNED", label: "Trainee Guarantee Signed", date: beneficiary.admissionFormConfirmedAt, actor: "GUARDIAN_CO-SIGN", version: beneficiary.tokenVersion || 1, isCompleted: !!beneficiary.admissionFormCompleted },
                      { key: "ACCEPTED", label: "Admission Acceptance Logged", date: beneficiary.acceptanceLetterUploadedAt, actor: "REVIEW_OFFICER", version: beneficiary.workflowVersion || 1, isCompleted: !!beneficiary.acceptanceLetterUploadedAt },
                      { key: "CERTIFIED", label: "Federal Program Certified", date: beneficiary.certificateIssuedAt, actor: "AWARDING_COMMITTEE", version: beneficiary.workflowVersion || 1, isCompleted: beneficiary.status === ProgramStatus.CERTIFIED || beneficiary.status === ProgramStatus.CERTIFICATE_ISSUED || !!beneficiary.certificateIssuedAt },
                    ].map((node, idx) => {
                      const isCurrent = (
                        (node.key === "DRAFT" && beneficiary.status === ProgramStatus.DRAFT) ||
                        (node.key === "ADMISSION_SENT" && beneficiary.status === ProgramStatus.ADMITTED) ||
                        (node.key === "PORTAL_OPENED" && beneficiary.status === ProgramStatus.IN_TRAINING && !beneficiary.admissionFormCompleted) ||
                        (node.key === "SIGNED" && beneficiary.status === ProgramStatus.IN_TRAINING && beneficiary.admissionFormCompleted && !beneficiary.acceptanceLetterUploadedAt) ||
                        (node.key === "ACCEPTED" && beneficiary.status === ProgramStatus.ACCEPTED) ||
                        (node.key === "CERTIFIED" && (beneficiary.status === ProgramStatus.CERTIFIED || beneficiary.status === ProgramStatus.CERTIFICATE_ISSUED))
                      );

                      return (
                        <div key={idx} className="relative">
                          {/* Circle node marker */}
                          <div className={`absolute -left-[31px] top-0.5 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center ${
                            node.isCompleted 
                              ? "bg-emerald-50 border-emerald-500 text-emerald-600" 
                              : isCurrent 
                                ? "bg-indigo-50 border-indigo-500 text-indigo-600 animate-pulse" 
                                : "bg-white border-slate-200 text-slate-300"
                          }`}>
                            <span className="text-[8px] font-bold">✓</span>
                          </div>

                          <div className="space-y-0.5 text-left">
                            <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                              isCurrent ? "text-indigo-700 font-bold" : node.isCompleted ? "text-slate-800" : "text-slate-400"
                            }`}>
                              {node.label}
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[8px] uppercase tracking-wider rounded font-bold font-mono">
                                  Current Active Node
                                </span>
                              )}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>Date: {node.date ? new Date(node.date).toLocaleDateString("en-GB") : "Awaiting Event"}</span>
                              <span>•</span>
                              <span>Actor: {node.isCompleted ? node.actor : "N/A"}</span>
                              <span>•</span>
                              <span>Token Ver: T{node.isCompleted ? node.version : "—"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* TOKEN GOVERNANCE CARD */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs text-left space-y-4">
                <div className="pb-2 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="h-4 w-4 text-amber-500" /> Decentralized Access Token Lifecycle Ledger
                    </h5>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">AUTHORIZED ENTRANCE KEYS HISTORY</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      authFetch("/api/audit-logs/log", {
                        method: "POST",
                        headers: { "Content-Type" : "application/json" },
                        body: JSON.stringify({
                          action: "TOKEN_HISTORY_VIEWED",
                          beneficiaryId: beneficiary.id,
                          remarks: `Inspected cryptographic access token version history logs`
                        })
                      }).catch(() => {});
                      showToast("Token session registers refreshed.", "success");
                    }}
                    className="text-[10px] font-mono font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3 animate-spin-hover" /> Audit Token Sessions
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border border-slate-150 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 select-none">
                      <tr>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-wider">Token Version</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-wider">Gateway Status</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-wider">Issued Date / Actor</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-wider">Expiry / Authority</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-wider">Revocation Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {Array.from({ length: beneficiary.tokenVersion || 1 }).map((_, idx) => {
                        const versionNum = (beneficiary.tokenVersion || 1) - idx;
                        const isLatest = versionNum === (beneficiary.tokenVersion || 1);
                        const isFirst = versionNum === 1;

                        return (
                          <tr key={versionNum} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold font-mono">
                              V{versionNum}.0{" "}
                              {isLatest ? (
                                <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[8px] rounded border border-emerald-150 uppercase font-bold">
                                  ACTIVE / CURRENT
                                </span>
                              ) : (
                                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-50 text-amber-600 text-[8px] rounded border border-amber-150 uppercase font-bold">
                                  SUPERSEDED
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {isLatest ? (
                                <div className="flex items-center gap-1 text-emerald-700 font-bold">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span>Portal Entrance Open</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-red-600 font-bold">
                                  <span className="h-2 w-2 rounded-full bg-red-400"></span>
                                  <span>Revoked & Blocked</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div>{new Date(beneficiary.createdAt).toLocaleDateString("en-GB")}</div>
                              <div className="text-[9px] text-slate-400 font-sans">Issued by: SYSTEM_REGISTRY</div>
                            </td>
                            <td className="p-3">
                              <div>{isLatest ? "Never Expires (Admissions Locked)" : "Expired State"}</div>
                              <div className="text-[9px] text-slate-400 font-sans">Federal Authority Registry Code</div>
                            </td>
                            <td className="p-3">
                              {isLatest ? (
                                <span className="text-slate-400 italic">No violations</span>
                              ) : (
                                <span className="text-amber-700 font-semibold font-sans text-[10px]">
                                  Superseded by workflow rollback
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DOCUMENT COMPLIANCE PANEL */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs text-left space-y-4">
                <div className="pb-2 border-b border-slate-150 flex items-center justify-between gap-2">
                  <div>
                    <h5 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-indigo-600" /> Verified Document Candidate Records
                    </h5>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">COMPLIANCE AND INTEGRITY CHECKS</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100">
                    Compliant Ledger Matches (100%)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { type: "ADMISSION_LETTER", label: "Trainee Admission Letter", url: beneficiary.admissionLetterUrl },
                    { type: "ACCEPTANCE_LETTER", label: "Signed Parental Acceptance Form", url: beneficiary.acceptanceLetterUrl },
                    { type: "ENROLLMENT_LETTER", label: "Trainee Enrollment Declaration Letter", url: beneficiary.enrollmentLetterUrl },
                    { type: "CERTIFICATE", label: "Federal Cohort Technical Certificate", url: beneficiary.certificateUrl },
                  ].map((doc, index) => {
                    // Match versions from documentHistory
                    const versions = documentHistory.filter(h => h.documentType === doc.type);
                    const docExists = !!doc.url || versions.length > 0;
                    
                    return (
                      <div key={index} className="bg-slate-50/50 border p-4 rounded-xl flex items-start justify-between gap-4">
                        <div className="space-y-1 text-left select-none">
                          <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider">{doc.type}</span>
                          <h6 className="text-[11.5px] font-bold text-slate-850 font-sans leading-none">{doc.label}</h6>
                          <div className="text-[9.5px] text-slate-450 font-mono mt-1">
                            Versions: {versions.length || (docExists ? 1 : 0)} • Status:{" "}
                            {docExists ? (
                              <span className="text-emerald-700 font-bold uppercase text-[9px]">ACTIVE</span>
                            ) : (
                              <span className="text-slate-400 uppercase text-[9px]">REQUIRED</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              // Trigger log
                              authFetch("/api/audit-logs/log", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "DOCUMENT_HISTORY_VIEWED",
                                  beneficiaryId: beneficiary.id,
                                  remarks: `Inspected historic version chain for ${doc.label}`
                                })
                              }).catch(() => {});

                              // Open versions list
                              setSelectedDocTypeLabel(doc.label);
                              const fakeVersions = versions.length > 0 ? versions : docExists ? [
                                {
                                  version: 1,
                                  createdAt: beneficiary.createdAt,
                                  generatedBy: beneficiary.statusChangedBy || "SYSTEM_REGISTRY",
                                  documentStatus: "ACTIVE",
                                  workflowVersion: beneficiary.workflowVersion || 1,
                                  tokenVersion: beneficiary.tokenVersion || 1
                                }
                              ] : [];
                              setSelectedDocVersions(fakeVersions);
                            }}
                            className="text-[10px] font-bold font-mono text-indigo-750 hover:text-indigo-900 cursor-pointer block hover:underline"
                          >
                            View Versions
                          </button>
                          
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9.5px] font-bold font-mono text-slate-650 hover:text-slate-900 flex items-center gap-0.5 leading-none"
                            >
                              Open File <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TRAINING STATUS ADJUSTMENT PORTAL */}
              <div className="bg-slate-50 border border-slate-250 rounded-xl p-5 shadow-xs text-left relative overflow-hidden space-y-4">
                
                {/* Visual Watermark */}
                <div className="absolute right-4 top-4 text-amber-500/10 pointer-events-none select-none">
                  <ShieldCheck className="h-28 w-28 stroke-1" />
                </div>

                <div className="pb-3 border-b border-slate-200">
                  <h5 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-700" /> Training Status Adjustment Portal
                  </h5>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">COMPLIANT STATUS CORRECTION & AUDITING</p>
                </div>

                {/* Warning Card */}
                <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                  <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-800 shrink-0 select-none">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 text-xs text-amber-950">
                    <span className="font-bold block uppercase tracking-wider text-[10px]">Programmatic Compliance Notification</span>
                    <p className="leading-relaxed font-sans">
                      Correcting a trainee's status is an audited action that adjusts their active record state:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 font-sans">
                      <li>Revokes/reissues secure response tokens if moving back to Draft</li>
                      <li>Archives active forms and documents for safety</li>
                      <li>Logs workflow history to preserve the record audit trail</li>
                      <li>Saves a detailed entry in the programmatic audit logs</li>
                    </ul>
                  </div>
                </div>

                {/* Permissions Guard Warning */}
                {session?.role !== "SUPER_ADMIN" && session?.role !== "ADMIN_OFFICER" && !session?.role?.startsWith("TSP") && session?.role !== "TSP" && (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-xs text-amber-900 leading-snug font-sans">
                    <strong>PERMISSIONS LOCK:</strong> You are viewing this console with Read-Only Compliance Officer permissions. 
                    Only users with authorized administrative permissions can adjust training statuses.
                  </div>
                )}

                {/* Active Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Select New Target Stage
                      </label>
                      <select
                        disabled={session?.role !== "SUPER_ADMIN" && session?.role !== "ADMIN_OFFICER" && !session?.role?.startsWith("TSP") && session?.role !== "TSP"}
                        value={rollbackTarget}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRollbackTarget(val);
                          fetchDependencyAnalysis(val);
                          authFetch("/api/audit-logs/log", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "CORRECTION_PREVIEW_OPENED",
                              beneficiaryId: beneficiary.id,
                              remarks: `Began investigating status correction target state: ${val}`
                            })
                          }).catch(() => {});
                        }}
                        className="w-full text-xs font-mono text-slate-800 bg-white border border-slate-250 p-2.5 rounded-lg shadow-2xs focus:ring-1 focus:ring-indigo-750 focus:border-indigo-750"
                      >
                        <option value="">-- Choose Target Milestone --</option>
                        <option value="ADMISSION_FORM_DRAFT">Draft / Unlock Registration (Reset Form)</option>
                        <option value="ACCEPTED">Offer Accepted</option>
                        <option value="ACTIVE">Active In-Training (Enrolled)</option>
                        <option value="GRADUATED">Completed Training</option>
                        {/* FED / Admin-only options */}
                        {(session?.role === "SUPER_ADMIN" || session?.role === "FED" || session?.role === "ADMIN_OFFICER") && (
                          <>
                            <option value="CERTIFIED">Certified & Approved</option>
                            <option value="CERTIFICATE_ISSUED">Certificate Issued</option>
                            <option value="ALUMNI">Alumni Tracking</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Audited Justification (Reason) <span className="text-red-650">*</span>
                      </label>
                      <input
                        type="text"
                        disabled={session?.role !== "SUPER_ADMIN" && session?.role !== "ADMIN_OFFICER" && !session?.role?.startsWith("TSP") && session?.role !== "TSP"}
                        value={rollbackReason}
                        onChange={(e) => setRollbackReason(e.target.value)}
                        placeholder="e.g., Correction of data entry error on completion state"
                        className="w-full text-xs text-slate-800 bg-white border border-slate-250 p-2.5 rounded-lg shadow-2xs focus:ring-1 focus:ring-indigo-750 focus:border-indigo-750"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Supplementary Operational Notes
                      </label>
                      <textarea
                        rows={2}
                        disabled={session?.role !== "SUPER_ADMIN" && session?.role !== "ADMIN_OFFICER" && !session?.role?.startsWith("TSP") && session?.role !== "TSP"}
                        value={rollbackNotes}
                        onChange={(e) => setRollbackNotes(e.target.value)}
                        placeholder="Additional context about this exceptional administrative state adjustment..."
                        className="w-full text-xs text-slate-800 bg-white border border-slate-250 p-2.5 rounded-lg shadow-2xs focus:ring-1 focus:ring-indigo-750 focus:border-indigo-750"
                      />
                    </div>
                  </div>

                  {/* PREVIEW OF THE CORRECTION DYNAMICS */}
                  <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block select-none">
                        DEPENDENCY ANALYSIS & IMPACT SURVEY
                      </span>
                      {rollbackTarget ? (
                        <div className="space-y-3 font-mono text-xs">
                          {/* Side-by-Side Status & Version Transitions */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-2 rounded border border-slate-150 flex flex-col justify-between text-center">
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">STATUS</span>
                              <div className="font-semibold text-slate-700 truncate text-[10px] sm:text-xs">{beneficiary.status}</div>
                              <ArrowRight className="h-3 w-3 text-slate-400 mx-auto my-1" />
                              <div className="font-bold text-indigo-700 text-[10px] sm:text-xs">
                                {rollbackTarget === "ADMISSION_FORM_DRAFT" ? "DRAFT" : rollbackTarget}
                              </div>
                            </div>

                            <div className="bg-white p-2 rounded border border-slate-150 flex flex-col justify-between text-center">
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">WORKFLOW</span>
                              <div className="font-semibold text-slate-700">V{beneficiary.workflowVersion || 1}</div>
                              <ArrowRight className="h-3 w-3 text-slate-400 mx-auto my-1" />
                              <div className="font-bold text-emerald-700">V{(beneficiary.workflowVersion || 1) + 1}</div>
                            </div>

                            <div className="bg-white p-2 rounded border border-slate-150 flex flex-col justify-between text-center">
                              <span className="text-[8px] text-slate-400 font-bold uppercase block">TOKEN</span>
                              <div className="font-semibold text-slate-700">T{beneficiary.tokenVersion || 1}</div>
                              <ArrowRight className="h-3 w-3 text-slate-400 mx-auto my-1" />
                              <div className="font-bold text-emerald-700">T{(beneficiary.tokenVersion || 1) + 1}</div>
                            </div>
                          </div>

                          {/* Dependency Scanner Result & Risk Visualization */}
                          {depAnalysisLoading ? (
                            <div className="bg-white p-3.5 rounded border border-slate-150 text-center py-6 flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="h-5 w-5 text-indigo-650 animate-spin" />
                              <span className="text-xs text-slate-550 font-sans">Running dependency compliance check...</span>
                            </div>
                          ) : dependencyAnalysis ? (
                            <div className="space-y-3 font-sans">
                              {/* Risk Visualization Banner */}
                              <div className={`p-2.5 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
                                dependencyAnalysis.governanceRiskLevel === "LOW" ? "bg-emerald-50 text-emerald-800 border-emerald-250" :
                                dependencyAnalysis.governanceRiskLevel === "MEDIUM" ? "bg-amber-50 text-amber-800 border-amber-250" :
                                dependencyAnalysis.governanceRiskLevel === "HIGH" ? "bg-red-50 text-red-800 border-red-250" :
                                "bg-rose-100 text-rose-950 border-rose-350"
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full inline-block animate-pulse ${
                                    dependencyAnalysis.governanceRiskLevel === "LOW" ? "bg-emerald-500" :
                                    dependencyAnalysis.governanceRiskLevel === "MEDIUM" ? "bg-amber-500" :
                                    dependencyAnalysis.governanceRiskLevel === "HIGH" ? "bg-red-505" :
                                    "bg-rose-800"
                                  }`} style={{ backgroundColor: dependencyAnalysis.governanceRiskLevel === "LOW" ? "#10b981" : dependencyAnalysis.governanceRiskLevel === "MEDIUM" ? "#f59e0b" : dependencyAnalysis.governanceRiskLevel === "HIGH" ? "#ef4444" : "#991b1b" }} />
                                  <span>RISK LEVEL: {dependencyAnalysis.governanceRiskLevel}</span>
                                </div>
                                <span className="text-[9px] font-mono tracking-widest uppercase">STAGE PROFILE</span>
                              </div>

                              {/* Impact Summary Panel */}
                              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase block pb-1 border-b border-slate-100">
                                  This correction will affect:
                                </span>
                                <ul className="text-xs text-slate-650 space-y-1 font-sans">
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                    <span className="text-slate-500 flex items-center gap-1"><FileText className="h-3 w-3 inline text-slate-450" /> Documents Survey</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.documentsAffected.active} active ({dependencyAnalysis.documentsAffected.total} total)
                                    </span>
                                  </li>
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                    <span className="text-slate-500 flex items-center gap-1"><Award className="h-3 w-3 inline text-slate-450" /> Certifications</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.certificationsAffected.certificateCount} certificate(s) ({dependencyAnalysis.certificationsAffected.certifiedStatus})
                                    </span>
                                  </li>
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                    <span className="text-slate-500 flex items-center gap-1"><Layers className="h-3 w-3 inline text-slate-450" /> Toolkit Allocations</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.toolkitsAffected.toolkitsAffected} allocated ({dependencyAnalysis.toolkitsAffected.toolkitsIssued} issued)
                                    </span>
                                  </li>
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded flex-wrap">
                                    <span className="text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3 inline text-slate-450" /> Dispatch Envelopes</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.dispatchesAffected.dispatchCount} dispatches {dependencyAnalysis.dispatchesAffected.lastDispatchDate ? `(last ${new Date(dependencyAnalysis.dispatchesAffected.lastDispatchDate).toLocaleDateString()})` : ''}
                                    </span>
                                  </li>
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                    <span className="text-slate-500 flex items-center gap-1"><ClipboardList className="h-3 w-3 inline text-slate-450" /> Outcome Evidence</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.evidenceAffected.impactRecordsAffected} records ({dependencyAnalysis.evidenceAffected.verificationRecords} visits)
                                    </span>
                                  </li>
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                    <span className="text-slate-500 flex items-center gap-1"><Landmark className="h-3 w-3 inline text-slate-450" /> Financial Allocations</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.financialRecordsAffected.financialRecordsAffected} records linked to track costs
                                    </span>
                                  </li>
                                  <li className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                    <span className="text-slate-500 flex items-center gap-1"><History className="h-3 w-3 inline text-slate-450" /> Registry References</span>
                                    <span className="font-bold text-slate-800">
                                      {dependencyAnalysis.auditReferencesAffected.auditReferencesAffected} audit events tracked
                                    </span>
                                  </li>
                                </ul>
                              </div>

                              {/* EXECUTION GATE WARNINGS & SPECIFIC CHECKBOX RULES */}
                              <div className="space-y-2 pt-1 border-t border-slate-200">
                                {dependencyAnalysis.governanceRiskLevel !== "LOW" && (
                                  <label className="flex items-start gap-2 text-[10.5px] font-sans text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={riskAcknowledgeCheck}
                                      onChange={(e) => setRiskAcknowledgeCheck(e.target.checked)}
                                      className="mt-0.5 rounded border-amber-300 text-amber-700 focus:ring-amber-500 cursor-pointer h-3.5 w-3.5"
                                    />
                                    <span>I acknowledge this represents a <strong>{dependencyAnalysis.governanceRiskLevel} RISK</strong> operation, and verify that the target status is appropriate.</span>
                                  </label>
                                )}

                                {(dependencyAnalysis.governanceRiskLevel === "HIGH" || dependencyAnalysis.governanceRiskLevel === "CRITICAL") && (
                                  <div className="text-[10px] text-red-800 font-sans leading-relaxed bg-red-50 border border-red-150 rounded p-2">
                                    <strong>HIGH/CRITICAL HURDLE:</strong> Supplementary notes must be filled out below to justify this operational state adjustment.
                                  </div>
                                )}

                                {dependencyAnalysis.governanceRiskLevel === "CRITICAL" && (
                                  <label className="flex items-start gap-2 text-[10.5px] font-sans text-red-950 bg-rose-50 border border-rose-250 rounded p-2.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={subConfirmCheck}
                                      onChange={(e) => setSubConfirmCheck(e.target.checked)}
                                      className="mt-0.5 rounded border-rose-300 text-rose-800 focus:ring-rose-800 cursor-pointer h-3.5 w-3.5"
                                    />
                                    <span><strong>DOUBLE-AUDIT LOCK:</strong> I explicitly accept that all linked certifications, toolkits, dispatches, and financial outcome references will be flagged as archived/invalidated.</span>
                                  </label>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-150 font-sans italic text-center">
                              No active analysis generated. Select target stage to evaluate impact risk.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 py-6 text-center italic font-sans flex flex-col items-center justify-center gap-1.5 select-none">
                          <Layers className="h-8 w-8 text-slate-300 stroke-1" />
                          Select a target milestone stage to run standard dependency scan rules.
                        </div>
                      )}
                    </div>

                    {rollbackTarget && (
                      <div className="pt-3 border-t border-slate-200 mt-2">
                        <label className="flex items-start gap-2 text-[10.5px] font-sans text-slate-650 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rollbackConfirmCheck}
                            onChange={(e) => setRollbackConfirmCheck(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-indigo-750 focus:ring-indigo-750 cursor-pointer h-4 w-4"
                          />
                          <span>I certify that this status adjustment is correct and fully authorized.</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations Execution Footer */}
                {(session?.role === "SUPER_ADMIN" || session?.role === "ADMIN_OFFICER" || session?.role?.startsWith("TSP") || session?.role === "TSP") && (
                  <div className="pt-2 flex justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={
                        !rollbackTarget || 
                        !rollbackReason || 
                        !rollbackConfirmCheck || 
                        rollbackLoading ||
                        (dependencyAnalysis?.governanceRiskLevel === "MEDIUM" && !riskAcknowledgeCheck) ||
                        (dependencyAnalysis?.governanceRiskLevel === "HIGH" && (!riskAcknowledgeCheck || !rollbackNotes?.trim())) ||
                        (dependencyAnalysis?.governanceRiskLevel === "CRITICAL" && (!riskAcknowledgeCheck || !subConfirmCheck || !rollbackNotes?.trim()))
                      }
                      onClick={handleExecuteRollback}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-5 rounded-lg text-xs cursor-pointer shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed select-none flex items-center gap-1.5 animate-fade-in animate-duration-150"
                    >
                      {rollbackLoading ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Save Status Correction
                        </>
                      )}
                    </button>
                  </div>
                )}

              </div>

              {/* AUDIT HISTORY TIMELINE / LOGS TRACKING PANEL */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs text-left space-y-4">
                <div className="pb-2 border-b border-slate-150 flex items-center justify-between gap-2">
                  <div>
                    <h5 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <History className="h-4 w-4 text-slate-700" /> Compliant Registry Logging Trail
                    </h5>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">FEDERAL WORKFLOW & KEY TRANSACTION TRAILS</p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-450">
                    Total Transactions Blocked/Logged: {workflowHistory.length + auditLogs.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11.5px] border border-slate-150 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 select-none">
                      <tr>
                        <th className="p-3 text-[9px] font-bold uppercase tracking-wider">Timestamp</th>
                        <th className="p-3 text-[9px] font-bold uppercase tracking-wider">Transaction Code</th>
                        <th className="p-3 text-[9px] font-bold uppercase tracking-wider">Operator ID</th>
                        <th className="p-3 text-[9px] font-bold uppercase tracking-wider">IP Address</th>
                        <th className="p-3 text-[9px] font-bold uppercase tracking-wider">Event Remarks</th>
                        <th className="p-3 text-right text-[9px] font-bold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {/* Combined & Sorted Historical Ledger of WorkflowHistory and AuditLogs */}
                      {(() => {
                        const logs: any[] = [];
                        
                        // Push workflow history records
                        workflowHistory.forEach(w => {
                          logs.push({
                            id: `WFL-${w.id}`,
                            timestamp: w.changedAt,
                            type: "WORKFLOW_TRANSITION",
                            operator: w.changedBy,
                            ip: w.ipAddress,
                            remarks: w.remarks,
                            reason: w.reason,
                            oldStatus: w.oldStatus,
                            newStatus: w.newStatus,
                            tokenBefore: w.tokenVersionBefore,
                            tokenAfter: w.tokenVersionAfter,
                            workflowBefore: w.workflowVersionBefore,
                            workflowAfter: w.workflowVersionAfter
                          });
                        });

                        // Push relevant audit logs
                        auditLogs.filter(a => a.action === "WORKFLOW_ROLLBACK" || a.action === "GOVERNANCE_PANEL_OPENED" || a.action === "TOKEN_HISTORY_VIEWED" || a.action === "ROLLBACK_EXECUTED").forEach(a => {
                          logs.push({
                            id: `AUD-${a.id}`,
                            timestamp: a.timestamp,
                            type: a.action,
                            operator: a.username,
                            ip: a.ipAddress,
                            remarks: a.details,
                            reason: "Audited System Routine Log"
                          });
                        });

                        // Sort descending
                        const sortedLogs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                        if (sortedLogs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                                No security logs have been registered for this candidate.
                              </td>
                            </tr>
                          );
                        }

                        return sortedLogs.map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString("en-GB")}
                            </td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                log.type === "WORKFLOW_TRANSITION" 
                                  ? "bg-blue-50 text-blue-700 border border-blue-100" 
                                  : log.type === "ROLLBACK_EXECUTED"
                                    ? "bg-red-50 text-red-700 border border-red-100 animate-pulse"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}>
                                {log.type}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-sans font-medium">{log.operator}</td>
                            <td className="p-3 text-slate-400 font-mono">{log.ip || "127.0.0.1"}</td>
                            <td className="p-3 font-sans truncate max-w-xs text-slate-650" title={log.remarks}>
                              {log.remarks}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAuditLog(log);
                                }}
                                className="text-[10px] font-bold text-indigo-750 hover:text-indigo-900 hover:underline cursor-pointer font-sans"
                              >
                                View Payload
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* DYNAMIC OVERLAY MODAL: DOCUMENT VERSIONS HISTORIC TRAIL */}
          {selectedDocVersions && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-xl text-left space-y-4">
                
                <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Version Chain Engine</span>
                    <h5 className="font-display font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-4.5 w-4.5 text-indigo-650" /> {selectedDocTypeLabel} History Ledger
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDocVersions(null)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer font-sans text-xs flex items-center gap-1 font-bold border border-slate-200"
                  >
                    <X className="h-3.5 w-3.5" /> Close Ledger
                  </button>
                </div>

                <div className="space-y-3 font-sans text-xs">
                  <p className="text-slate-600 leading-normal">
                    This represents the secure historical sequence of copies compiled by our cryptographic document generators.
                  </p>

                  <div className="space-y-3 font-mono">
                    {selectedDocVersions.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 italic">No document copy exists.</div>
                    ) : (
                      selectedDocVersions.map((ver, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-805 font-bold text-xs uppercase">Version {ver.version || 1}.0</span>
                              {ver.documentStatus === "ACTIVE" ? (
                                <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 text-[8px] rounded font-bold border border-emerald-150">
                                  ACTIVE & LOCKED
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 text-[8px] rounded font-bold border border-amber-150">
                                  SUPERSEDED / ARCHIVED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Generated At: {new Date(ver.createdAt).toLocaleString("en-GB")} • Operator: {ver.generatedBy}
                            </div>
                            <div className="text-[9px] text-slate-500 font-sans mt-1">
                              Saved on Workflow V{ver.workflowVersion || 1} & Token Generation T{ver.tokenVersion || 1}
                            </div>
                          </div>

                          {ver.pdfUrl && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  await downloadWithAuth(ver.pdfUrl, `document_v${ver.version || 1}.pdf`);
                                } catch (err: any) {
                                  showToast("Download failed: " + err.message, "error");
                                }
                              }}
                              className="text-[10.5px] font-bold font-mono text-indigo-750 hover:text-indigo-900 border border-slate-250 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded flex items-center gap-0.5 shadow-2xs cursor-pointer"
                            >
                              Download <Download className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* DYNAMIC OVERLAY MODAL: AUDIT PAYLOAD & LEDGER CODES */}
          {selectedAuditLog && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 shadow-xl text-left space-y-4">
                
                <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Transaction Auditor</span>
                    <h5 className="font-display font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="h-4.5 w-4.5 text-slate-700" /> Compliant Audit Transaction Details
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAuditLog(null)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer font-sans text-xs flex items-center gap-1 font-bold border border-slate-200"
                  >
                    <X className="h-3.5 w-3.5" /> Close Payload
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  
                  <div className="space-y-3">
                    <div className="bg-slate-100 p-3 rounded">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Registry ID</span>
                      <span className="text-slate-800 font-bold break-all">{selectedAuditLog.id}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Timestamp</span>
                      <span className="text-slate-700 block mt-0.5">
                        {new Date(selectedAuditLog.timestamp).toLocaleString("en-GB")}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Operator Key Identity</span>
                      <span className="text-slate-800 font-sans font-semibold block mt-0.5">{selectedAuditLog.operator}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Terminal IP Address</span>
                      <span className="text-slate-700 block mt-0.5">{selectedAuditLog.ip || "127.0.0.1"}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-100 p-3 rounded">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Audit Action Type</span>
                      <span className="text-slate-800 font-bold block mt-0.5">{selectedAuditLog.type}</span>
                    </div>

                    {selectedAuditLog.type === "WORKFLOW_TRANSITION" ? (
                      <>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">State Transition Matrix</span>
                          <span className="text-slate-700 block mt-0.5">
                            {selectedAuditLog.oldStatus} → <span className="font-bold text-indigo-750">{selectedAuditLog.newStatus}</span>
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Versions Incremented</span>
                          <span className="text-slate-700 block mt-0.5">
                            Workflow: V{selectedAuditLog.workflowBefore} → V{selectedAuditLog.workflowAfter} | Tokens: T{selectedAuditLog.tokenBefore} → T{selectedAuditLog.tokenAfter}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Audited Justification</span>
                        <p className="text-slate-700 whitespace-normal block mt-0.5 font-sans leading-normal">
                          {selectedAuditLog.reason || "Audited Routine System Log"}
                        </p>
                      </div>
                    )}

                  </div>

                </div>

                <div className="pt-2 border-t border-slate-150">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Raw System Payload Dump (Permanently Audited)
                  </span>
                  <pre className="bg-slate-900 text-slate-200 text-[10px] p-4.5 rounded-lg overflow-x-auto max-h-48 leading-relaxed text-left font-mono whitespace-pre-wrap select-all">
                    {JSON.stringify(selectedAuditLog, null, 2)}
                  </pre>
                </div>

              </div>
            </div>
          )}

          {/* TAB 10: GUARDIAN & MEDICAL EMERGENCY RECORD */}
          {activeTab === "guardian" && (
            <div id="tab-panel-guardian" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-5 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-600" /> Guardian Details & Medical Emergency Declarations
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">CENTRAL TRAINEE GUARDIAN METADATA</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Full Guardian Surname / First Name</span>
                  <span className="text-slate-800 font-semibold font-sans text-sm">
                    {beneficiary.admissionFormData?.guardianName || "Engr. Olufemi Adeyemi"}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Primary Guardian Phone Coordinate</span>
                  <span className="text-slate-800 font-semibold text-sm">
                    {beneficiary.admissionFormData?.guardianPhone || "+234 803 111 2222"}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Guardian Legal Relationship</span>
                  <span className="text-slate-800 font-semibold font-sans text-sm uppercase">
                    {beneficiary.admissionFormData?.emergencyName ? "Guardian" : "Father"}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Medical Emergency Contact</span>
                  <span className="text-slate-800 font-semibold text-sm">
                    {beneficiary.phoneNumber || "+234 812 345 6789"}
                  </span>
                </div>

                <div className="md:col-span-2 space-y-2 border-t border-dashed pt-4 mt-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Trainee Physical & General Medical Declaration</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-50 border p-3 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">Blood Class Group</span>
                      <span className="font-bold text-slate-800">O Positive (O+)</span>
                    </div>
                    <div className="bg-slate-50 border p-3 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">Severe Allergies / Contraindications</span>
                      <span className="font-bold text-slate-800">None Recorded</span>
                    </div>
                    <div className="bg-slate-50 border p-3 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">Special Needs Assistance Required</span>
                      <span className="font-bold text-slate-800 font-bold">No</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: BANKING DETAILS & FINANCIAL ALLOWANCE SYSTEM */}
          {activeTab === "banking" && (
            <div id="tab-panel-banking" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-indigo-600" /> Trainee Bank Accounts & Monthly Allowance Clearance
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">GOVERNANCE ALLOWANCE clearing LEDGER</p>
                </div>
                <div className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded font-bold border border-emerald-150">
                  Cleared BVN Check
                </div>
              </div>

              {/* Added a visible identity line */}
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-mono text-slate-600">
                <span>Bank details for: <strong className="text-slate-800 font-sans">{beneficiary.firstName} {beneficiary.lastName}</strong></span>
                <span>TVET ID: <strong className="text-indigo-600">{beneficiary.id}</strong></span>
              </div>

              {loadingBankDetails ? (
                <div className="space-y-4 animate-pulse py-6">
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-16 bg-slate-100 rounded-xl"></div>
                    <div className="h-16 bg-slate-100 rounded-xl"></div>
                    <div className="h-16 bg-slate-100 rounded-xl"></div>
                    <div className="h-16 bg-slate-100 rounded-xl"></div>
                  </div>
                </div>
              ) : bankDetailsError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-left font-sans text-rose-800 text-xs space-y-2">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="h-4 w-4 text-rose-600" /> DATA IDENTITY CONFLICT
                  </div>
                  <p className="font-mono text-[10px] bg-white p-2.5 border border-rose-150 rounded text-rose-700">
                    {bankDetailsError}
                  </p>
                  <p>Access to these banking details has been suspended due to an unresolved system exception or administrative integrity conflict.</p>
                </div>
              ) : bankDetails ? (
                <>
                  {bankDetails.verificationStatus === "BANK_DATA_CONFLICT" && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left font-sans text-amber-800 text-xs space-y-1.5">
                      <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-950 text-[10px]">
                        <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" /> BANK DATA DUPLICATION CONFLICT
                      </div>
                      <p className="text-[10px] font-mono leading-relaxed bg-white border border-amber-150 p-2.5 rounded text-amber-900">
                        {bankDetails.conflictDetails}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-4 bg-slate-50/70 border rounded-xl space-y-2 text-left">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Registered Clearing Bank Name</span>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        <span className="font-sans font-bold text-slate-800 text-sm">{bankDetails.bankName || "N/A"}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50/70 border rounded-xl space-y-2 text-left">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Primary Clearing Account digits</span>
                      <span className="font-bold text-slate-800 text-base block font-mono">{bankDetails.accountNumber || "N/A"}</span>
                    </div>

                    <div className="p-4 bg-slate-50/70 border rounded-xl space-y-2 text-left">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Bank Verification Number (BVN)</span>
                      <span className="font-bold text-slate-800 text-sm block font-mono">
                        {bankDetails.maskedBvn || "N/A"}
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50/70 border rounded-xl space-y-2 text-left">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Clearing Name match audit Status</span>
                      <span className="font-bold text-emerald-700 text-xs font-sans block flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> {bankDetails.accountName ? `Approved Name: ${bankDetails.accountName}` : "Approved Trainee Name Exact Match"}
                      </span>
                    </div>

                    <div className="p-4 bg-[#e6f4ea] border border-emerald-200 rounded-xl md:col-span-2 space-y-1.5 text-left text-slate-800 text-xs leading-relaxed font-sans">
                      <h5 className="font-bold text-emerald-800 uppercase text-[10px] tracking-wide font-mono">Automatic TVET Allowance Stipend program</h5>
                      <p>Central Federal Ministry clearance confirms this candidate registers active, compliant photos and logs daily attendance coordinates correctly. Monthly stipend payments of ₦30,000 are scheduled for automatic clearing delivery to the verified {bankDetails.bankName || "registered"} bank account details listed above.</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 py-6">No bank records could be verified for this trainee candidate.</p>
              )}
            </div>
          )}

          {/* TAB 12: BIOMETRIC CAPTURE & FEDERAL VERIFICATION TRAILS */}
          {activeTab === "verification" && (
            <div id="tab-panel-verification" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Federal Biometric Verification Trails & Live Captures
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">BIOMETRICS AUDITING GATEWAY</p>
                </div>
                <div className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded font-bold border border-emerald-150">
                  Capture Quality: 98%
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 bg-slate-50 border rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-tight">Standard Biometric Image Match</span>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-200 shrink-0">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs block font-sans">Biometric identity verification matches record</span>
                      <span className="text-[10px] text-slate-400">Match score confidence level: 98.44%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-tight">NIN Database Sync Identity Match</span>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-200 shrink-0">
                      <FileCode className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs block font-sans">National database identity status matches</span>
                      <span className="text-[10px] text-slate-400">NIN ID: {beneficiary.nin ? `*******${beneficiary.nin.slice(-4)}` : "Verified Match"}</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-50 border p-4 rounded-xl space-y-2 text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block tracking-wider">Device details during live verification</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[10px] text-slate-600">
                    <div>
                      <span className="text-slate-404 text-slate-400 uppercase block font-bold">Audit device token:</span>
                      <span>SECURE-BIOMETRIC-IPAD-73</span>
                    </div>
                    <div>
                      <span className="text-slate-404 text-slate-400 uppercase block font-bold">Verification timestamp:</span>
                      <span>{new Date(beneficiary.createdAt).toLocaleString("en-GB")}</span>
                    </div>
                    <div>
                      <span className="text-slate-404 text-slate-400 uppercase block font-bold">Location coordinate:</span>
                      <span>{beneficiary.city || "Ikeja"}, {beneficiary.state} State, Nigeria</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Hardened Acceptance Workflow Transition Modal */}
      {transitionModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 text-left flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                transitionModal.targetStatus === "Accepted" 
                  ? "bg-emerald-950 text-emerald-400" 
                  : transitionModal.targetStatus === "Acceptance Rejected"
                  ? "bg-rose-950 text-rose-400"
                  : "bg-indigo-950 text-indigo-400"
              }`}>
                {transitionModal.targetStatus === "Accepted" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : transitionModal.targetStatus === "Acceptance Rejected" ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ClipboardList className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm text-white uppercase tracking-wider">{transitionModal.title}</h3>
                <p className="text-[10px] text-slate-400 font-mono">ADMISSION AUDIT TRANSITION GATEWAY</p>
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 text-left space-y-4">
              <p className="text-xs text-slate-350 leading-relaxed font-sans">{transitionModal.description}</p>
              
              {/* Transition Reason Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                  Transition Note / Reason {transitionModal.requiresReason ? "(Required)" : "(Optional)"}
                </label>
                <textarea
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder={transitionModal.requiresReason ? "e.g. Blurred hand-signature scan. Please re-upload verified copy." : "Any internal notes regarding this transition..."}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-slate-600 font-sans"
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-850 flex justify-end gap-2 font-mono text-xs">
              <button
                type="button"
                disabled={transitionLoading}
                onClick={() => { setTransitionModal(null); setTransitionReason(""); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg cursor-pointer transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transitionLoading || (transitionModal.requiresReason && !transitionReason.trim())}
                onClick={() => handleStatusTransition(transitionModal.targetStatus, transitionReason)}
                className={`px-4 py-2 text-white font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 select-none ${
                  transitionModal.targetStatus === "Accepted"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : transitionModal.targetStatus === "Acceptance Rejected"
                    ? "bg-rose-600 hover:bg-rose-500 focus:ring-red-500"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {transitionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENTERPRISE WORKFLOW ROLLBACK CONFIRMATION DIALOG */}
      {showRollbackConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 text-left space-y-4 relative overflow-hidden">
            <button
              onClick={() => setShowRollbackConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-700 rounded-full border border-red-100 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">Emergency Workflow Rollback</h3>
                <p className="text-[11px] text-slate-500 font-mono">CRITICAL SAFETY GATE</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed font-sans">
              <p>
                You are about to execute a high-clearance, super-administrative rollback transformation for trainee <strong className="text-slate-850 font-semibold">{beneficiary.firstName} {beneficiary.lastName}</strong>.
              </p>
              
              <div className="bg-red-50/50 rounded-lg p-3 border border-red-100/50 space-y-1.5 text-[11px]">
                <span className="font-bold text-red-950 block">This administrative rollback action will:</span>
                <ul className="list-disc list-inside space-y-1 text-red-900">
                  <li>Immediately invalidate and revoke the current secure access link</li>
                  <li>Flag the active document package as <strong className="font-semibold text-red-950">ARCHIVED</strong> and voided</li>
                  <li>Force increment token security generation levels (Version {beneficiary.tokenVersion} &rarr; {beneficiary.tokenVersion! + 1})</li>
                  <li>Advance structural lifecycle tracing versioning (V{beneficiary.workflowVersion} &rarr; V{beneficiary.workflowVersion! + 1})</li>
                  <li>Generate permanent, immutable records on central audit logs</li>
                </ul>
              </div>

              <p className="italic text-[10.5px] text-slate-500 text-center pt-1">
                This action is fully audited, traced, and registered under federal and state governance compliance guidelines.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRollbackConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-850 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel, Abort Action
              </button>
              <button
                type="button"
                onClick={submitRollbackRequest}
                className="px-5 py-2 text-xs font-bold text-white bg-red-650 hover:bg-red-700 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> Proceed With Rollback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOVERNANCE SPRINT ROLLBACK OUTCOME DIALOUGE (SUCCESS / ERROR) */}
      {rollbackOutcomeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full shadow-2xl p-6 text-center space-y-4 relative overflow-hidden">
            <button
              onClick={() => setRollbackOutcomeModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full border shrink-0">
              {rollbackOutcomeModal.type === "success" ? (
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                  <CheckCircle className="w-6 h-6 animate-pulse" />
                </div>
              ) : (
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className={`text-base font-bold tracking-tight ${
                rollbackOutcomeModal.type === "success" ? "text-slate-900" : "text-rose-900"
              }`}>
                {rollbackOutcomeModal.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">{rollbackOutcomeModal.message}</p>
              {rollbackOutcomeModal.details && (
                <p className="text-[10px] text-slate-450 bg-slate-50 p-2 rounded border border-slate-100 italic font-mono leading-normal text-left">
                  {rollbackOutcomeModal.details}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setRollbackOutcomeModal(null)}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition select-none cursor-pointer ${
                  rollbackOutcomeModal.type === "success"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-rose-600 hover:bg-rose-700 text-white animate-shake"
                }`}
              >
                {rollbackOutcomeModal.type === "success" ? "Acknowledge Completion" : "Dismiss Error"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Floating Banner countdown tracker */}
      {undoState && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-755 text-white rounded-xl shadow-2xl p-4 flex items-center gap-4 animate-bounce font-mono text-xs max-w-sm">
          <div className="flex-1 text-left space-y-0.5">
            <span className="font-bold text-yellow-400 block pb-0.5">Workflow Action Reversible</span>
            <span className="text-slate-300">Revert status back to <span className="underline font-bold text-indigo-300">{undoState.previousStatus}</span> in {undoCountdown}s</span>
          </div>
          <button
            onClick={handleUndoStatus}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3.5 rounded-lg active:scale-95 transition flex items-center gap-1 shadow-sm cursor-pointer animate-pulse"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Undo Change
          </button>
        </div>
      )}

    </div>
  );
}
