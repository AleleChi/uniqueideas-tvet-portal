import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Users, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Clock,
  Search, Filter, ArrowUpDown, ChevronDown, Check, Info, HelpCircle, 
  X, ChevronRight, Calendar, User, Layers, RefreshCw, Plus, Trash2, 
  Lock, Unlock, ArrowUp, ArrowDown, Shuffle, ClipboardList, Sparkles, 
  UserCheck, AlertCircle, Upload, FileText, CheckCircle, AlertOctagon,
  ArrowRight, Eye, Edit3, Mail, ArrowLeft
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { TraineeAdmissionDetailsModal } from "./TraineeAdmissionDetailsModal";
import { BeneficiaryDetails } from "./BeneficiaryDetails";
import { NewEnrollmentForm } from "./NewEnrollmentForm";
import { Beneficiary } from "../types";

interface AllocatedTraineeRosterProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

interface TraineeRow {
  beneficiaryId: string;
  fullName: string;
  tvetId: string;
  skill: string;
  batch: string;
  trainingStatus: string;
  photoAvailable: boolean;
  attendanceRecordCount: number;
  isSelected: boolean;
  selectedAt: string | null;
  selectedBy: string | null;
}

interface RosterSummary {
  rosterId?: string;
  allocationLimit: number;
  selectedCount: number;
  remainingSlots: number;
  totalEligible: number;
}

export default function AllocatedTraineeRoster({ session, showToast }: AllocatedTraineeRosterProps) {
  // Authentication scope
  const user = session?.user || session;
  const userRole = user?.role || "TSP_ADMIN";
  const isTsp = ["TSP", "TSP_ADMIN", "TSP_TRAINING_MANAGER", "TSP_REVIEW_OFFICER"].includes(userRole);
  const userTspId = user?.tspId || user?.tsp_id || "00000000-0000-0000-0000-000000000001";

  // State Management
  const [trainees, setTrainees] = useState<TraineeRow[]>([]);
  const [summary, setSummary] = useState<RosterSummary>({
    allocationLimit: 100,
    selectedCount: 0,
    remainingSlots: 100,
    totalEligible: 0
  });

  // Table Page / Pagination / Load states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedAdmissionCandidate, setSelectedAdmissionCandidate] = useState<any | null>(null);

  // Dynamic filter lists (populated once from bg fetch)
  const [allBeneficiaries, setAllBeneficiaries] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [availableCohorts, setAvailableCohorts] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

  // Filtering / Search input states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [photoFilter, setPhotoFilter] = useState("all"); // "all", "available", "missing"
  const [selectionFilter, setSelectionFilter] = useState("all"); // "all", "selected", "not_selected"

  // Checkbox Selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const hasLoadedFromStorage = useRef(false);

  // Deep dive actions and canonical overlays
  const [activeBeneficiary, setActiveBeneficiary] = useState<any | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<string>("overview");
  const [viewMode, setViewMode] = useState<"roster" | "view_details" | "edit_details">("roster");
  const [openDropdownRowId, setOpenDropdownRowId] = useState<string | null>(null);

  const fetchAndOpenBeneficiary = async (beneficiaryId: string, nextMode: "view_details" | "edit_details", tab = "overview") => {
    setActionLoadingId(beneficiaryId);
    setOpenDropdownRowId(null);
    try {
      const res = await authFetch(`/api/beneficiaries/${beneficiaryId}`);
      if (!res.ok) {
        throw new Error("Unable to retrieve beneficiary profile from server.");
      }
      const data = await res.json();
      setActiveBeneficiary(data);
      setActiveDetailsTab(tab);
      setViewMode(nextMode);
    } catch (err: any) {
      showToast(err.message || "Failed to load beneficiary profile.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateBeneficiary = async (formData: Partial<Beneficiary>) => {
    if (activeBeneficiary) {
      try {
        const response = await authFetch(`/api/beneficiaries/${activeBeneficiary.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to update beneficiary details.");
        }
        showToast("Beneficiary details successfully updated.", "success");
        setViewMode("roster");
        setActiveBeneficiary(null);
        fetchRosterData(); // refresh roster list
      } catch (err: any) {
        showToast(err.message || "Failed to save beneficiary changes.", "error");
      }
    }
  };

  // Load saved selection from localStorage once rosterId is available
  useEffect(() => {
    if (summary.rosterId) {
      const userId = user?.id || user?.email || "anon";
      const key = `ideas-tvet:official-roster:draft-selection:v1:${userId}:${userTspId}:${summary.rosterId}`;
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const ids = JSON.parse(stored);
          if (Array.isArray(ids)) {
            setSelectedRowIds(new Set(ids));
          }
        } else {
          setSelectedRowIds(new Set());
        }
      } catch (err) {
        console.error("Failed to load draft selection from localStorage", err);
      } finally {
        hasLoadedFromStorage.current = true;
      }
    }
  }, [summary.rosterId, userTspId, user?.id, user?.email]);

  // Write selection changes to localStorage
  useEffect(() => {
    if (summary.rosterId && hasLoadedFromStorage.current) {
      const userId = user?.id || user?.email || "anon";
      const key = `ideas-tvet:official-roster:draft-selection:v1:${userId}:${userTspId}:${summary.rosterId}`;
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(selectedRowIds)));
      } catch (err) {
        console.error("Failed to save draft selection to localStorage", err);
      }
    }
  }, [selectedRowIds, summary.rosterId, userTspId, user?.id, user?.email]);

  // Verify eligibility of selectedRowIds against allBeneficiaries (exclude non-eligible or other TSP)
  useEffect(() => {
    if (allBeneficiaries.length > 0 && selectedRowIds.size > 0 && hasLoadedFromStorage.current) {
      const eligibleIds = new Set(allBeneficiaries.map(b => b.id));
      const invalidIds: string[] = [];
      const updated = new Set<string>();

      selectedRowIds.forEach(id => {
        if (eligibleIds.has(id)) {
          updated.add(id);
        } else {
          invalidIds.push(id);
        }
      });

      if (invalidIds.length > 0) {
        setSelectedRowIds(updated);
        showToast(
          `Safely excluded ${invalidIds.length} checked trainees from your working selection because they are no longer eligible or belong to another organization.`,
          "info"
        );
      }
    }
  }, [allBeneficiaries, selectedRowIds, showToast]);

  const getTvetIdForBeneficiary = (id: string) => {
    const b = allBeneficiaries.find(bx => bx.id === id);
    if (!b) return id;
    return b.customFields?.tvet_id || b.custom_fields?.tvet_id || b.tvetId || b.tvet_id || b.id;
  };

  const handleCopyCheckedTvetIds = () => {
    const tvetIds = Array.from(selectedRowIds).map(id => getTvetIdForBeneficiary(id));
    const formatted = tvetIds.join(", ");
    navigator.clipboard.writeText(formatted).then(() => {
      showToast("Copied checked TVET IDs to clipboard!", "success");
    }).catch(err => {
      showToast("Failed to copy to clipboard", "error");
    });
  };

  const handleExportCheckedCsv = () => {
    const checkedBens = Array.from(selectedRowIds).map((id, index) => {
      const b = allBeneficiaries.find(bx => bx.id === id);
      return {
        sn: index + 1,
        tvetId: getTvetIdForBeneficiary(id),
        fullName: b ? `${b.firstName || b.first_name || ""} ${b.lastName || b.last_name || ""}`.trim() : "Unknown Trainee",
        status: b?.status || b?.beneficiary_status || "ACTIVE",
        skill: b?.skillSector || b?.skill_sector || b?.program || "N/A",
        cohort: b?.batch || b?.cohort || "N/A"
      };
    });

    const headers = ["S/N", "TVET ID", "Full Name", "Status", "Skill Sector", "Cohort"];
    const rows = checkedBens.map(b => [
      b.sn,
      `"${b.tvetId}"`,
      `"${b.fullName}"`,
      `"${b.status}"`,
      `"${b.skill}"`,
      `"${b.cohort}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Checked_Trainees_List_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Checked trainees list exported successfully!", "success");
  };

  // Modal control states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"select" | "remove">("select");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importCommitAction, setImportCommitAction] = useState<"add" | "replace">("add");
  const [importing, setImporting] = useState(false);

  // Bulk Admissions States
  const [bulkAdmissionsProcessing, setBulkAdmissionsProcessing] = useState(false);
  const [bulkAdmissionsProgress, setBulkAdmissionsProgress] = useState(0);
  const [bulkAdmissionsMsg, setBulkAdmissionsMsg] = useState("");

  // File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery);
      setPage(1); // Reset to first page when search changes
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Main Table & Summary data
  const fetchRosterData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: searchDebounced,
        skill: skillFilter,
        cohort: cohortFilter,
        trainingStatus: statusFilter,
        photoStatus: photoFilter,
        filter: selectionFilter,
        tsp_id: userTspId
      });

      const res = await authFetch(`/api/reporting-roster/trainees?${params.toString()}`);
      if (res && res.ok) {
        const body = await res.json();
        if (body.success && body.data) {
          setTrainees(body.data.rows || []);
          setTotalRows(body.data.pagination.total);
          setTotalPages(body.data.pagination.totalPages);
          setSummary(body.data.summary);
        } else {
          showToast(body.error || "Failed to load reporting roster", "error");
        }
      } else {
        showToast("Error communicating with roster services", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to connect to roster API", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all beneficiaries once to construct filter categories
  const fetchFilterCategories = async () => {
    try {
      const res = await authFetch(`/api/beneficiaries`);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const tspBens = data.filter((b: any) => b.tsp_id === userTspId || b.tsp === userTspId);
          setAllBeneficiaries(tspBens);

          // Extract unique lists
          const skillsSet = new Set<string>();
          const cohortsSet = new Set<string>();
          const statusesSet = new Set<string>();

          tspBens.forEach((b: any) => {
            if (b.skillSector) skillsSet.add(b.skillSector);
            if (b.skill_sector) skillsSet.add(b.skill_sector);
            if (b.batch) cohortsSet.add(b.batch);
            if (b.cohort) cohortsSet.add(b.cohort);
            if (b.status) statusesSet.add(b.status);
          });

          setAvailableSkills(Array.from(skillsSet).filter(Boolean));
          setAvailableCohorts(Array.from(cohortsSet).filter(Boolean));
          setAvailableStatuses(Array.from(statusesSet).filter(Boolean));
        }
      }
    } catch (err) {
      console.error("Failed to load background beneficiaries for filtering options:", err);
    }
  };

  // Trigger loading of data
  useEffect(() => {
    fetchRosterData();
  }, [page, pageSize, searchDebounced, skillFilter, cohortFilter, statusFilter, photoFilter, selectionFilter, userTspId]);

  useEffect(() => {
    fetchFilterCategories();
  }, [userTspId]);

  // Handle Select / Unselect of individual row
  const handleToggleSelection = async (beneficiaryId: string, currentSelected: boolean) => {
    setActionLoadingId(beneficiaryId);
    try {
      const endpoint = currentSelected ? "/api/reporting-roster/remove" : "/api/reporting-roster/select";
      const payload = {
        beneficiaryIds: [beneficiaryId],
        tsp_id: userTspId
      };

      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        const body = await res.json();
        if (body.success) {
          showToast(
            currentSelected 
              ? "Trainee successfully removed from official reporting reports."
              : "Trainee successfully selected for official reports.", 
            "success"
          );
          fetchRosterData();
        } else {
          showToast(body.error || "Failed to update selection", "error");
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        showToast(errBody.error || "Action rejected. Check quota limit.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Connection error", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Select all rows on current page
  const handlePageSelectAll = (checked: boolean) => {
    if (checked) {
      const allIdsOnPage = trainees.map(t => t.beneficiaryId);
      setSelectedRowIds(new Set(allIdsOnPage));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleRowCheckboxToggle = (id: string) => {
    const updated = new Set(selectedRowIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedRowIds(updated);
  };

  // Open Bulk Action Confirmation Modal
  const handleOpenBulkModal = (action: "select" | "remove") => {
    setBulkActionType(action);
    setShowBulkModal(true);
  };

  // Execute Bulk Action (Select or Remove)
  const handleExecuteBulkAction = async () => {
    setShowBulkModal(false);
    const idArray = Array.from(selectedRowIds);
    if (idArray.length === 0) return;

    setLoading(true);
    try {
      const endpoint = bulkActionType === "select" ? "/api/reporting-roster/select" : "/api/reporting-roster/remove";
      const payload = {
        beneficiaryIds: idArray,
        tsp_id: userTspId
      };

      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        const body = await res.json();
        if (body.success) {
          showToast(
            bulkActionType === "select"
              ? `Successfully added ${body.data.updated} trainees to Official Reports.`
              : `Successfully excluded ${body.data.updated} trainees from reports.`,
            "success"
          );
          fetchRosterData();
        } else {
          showToast(body.error || "Failed to commit bulk changes", "error");
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        showToast(errBody.error || "Operation failed. Allocation limit may have been exceeded.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Connection failure", "error");
    } finally {
      setLoading(false);
    }
  };

  // Bulk Admissions / Letter Workflows (Task 014)
  const handleBulkAdmissionsAction = async (actionType: "generate-form" | "send-offer") => {
    if (selectedRowIds.size === 0) {
      showToast("Please check at least one trainee first.", "error");
      return;
    }
    const ids = Array.from(selectedRowIds);
    const actionLabel = actionType === "generate-form" ? "Generate Admission Form" : "Send Admission Offer";
    const confirmMsg = `Are you sure you want to run bulk "${actionLabel}" for the ${ids.length} checked trainee(s)?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkAdmissionsProcessing(true);
    setBulkAdmissionsProgress(0);
    setBulkAdmissionsMsg(`Preparing bulk execution of "${actionLabel}"...`);

    let successes = 0;
    let failures = 0;

    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        setBulkAdmissionsMsg(`Processing ${i + 1} of ${ids.length}: ${getTvetIdForBeneficiary(id)}...`);
        try {
          let endpoint = "";
          let method = "POST";
          let body: any = null;

          if (actionType === "generate-form") {
            endpoint = `/api/admissions/${id}/generate-form`;
          } else {
            endpoint = `/api/admissions/send-offer`;
            body = { beneficiaryId: id };
          }

          const options: any = { method };
          if (body) {
            options.headers = { "Content-Type": "application/json" };
            options.body = JSON.stringify(body);
          }

          const res = await authFetch(endpoint, options);
          if (res && res.ok) {
            successes++;
          } else {
            failures++;
          }
        } catch (err) {
          console.error(`Error on candidate ${id}:`, err);
          failures++;
        }
        setBulkAdmissionsProgress(Math.round(((i + 1) / ids.length) * 100));
      }

      showToast(`Bulk processing complete! Successes: ${successes}, Failures: ${failures}`, successes > 0 ? "success" : "error");
      setSelectedRowIds(new Set());
      fetchRosterData();
    } catch (e: any) {
      console.error("Bulk action failed:", e);
      showToast(e.message || "An unexpected error occurred during bulk operation.", "error");
    } finally {
      setBulkAdmissionsProcessing(false);
      setBulkAdmissionsProgress(0);
      setBulkAdmissionsMsg("");
    }
  };

  // Import Selection: Parse Text (TVET IDs, CSV, XLSX)
  const handleImportAnalyze = async () => {
    if (!importText.trim()) {
      showToast("Please paste TVET IDs or select a CSV/text file first", "error");
      return;
    }

    setImporting(true);
    try {
      // Split by newlines, commas, semi-colons, or tabs
      const parsedIds = importText
        .split(/[\n,;\t]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (parsedIds.length === 0) {
        showToast("No valid TVET IDs detected in input", "error");
        setImporting(false);
        return;
      }

      const res = await authFetch("/api/reporting-roster/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tvetIds: parsedIds, tsp_id: userTspId })
      });

      if (res && res.ok) {
        const body = await res.json();
        if (body.success && body.data) {
          setImportPreview(body.data);
        } else {
          showToast(body.error || "Analysis failed", "error");
        }
      } else {
        showToast("Server rejected the analysis request", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error analyzing input data", "error");
    } finally {
      setImporting(false);
    }
  };

  // Handle Drag & Drop / File Selection for CSV
  const handleFileDropAndSelect = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ("files" in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ("dataTransfer" in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImportText(text);
        showToast(`Loaded "${file!.name}" content. Click Analyze to inspect!`, "info");
      };
      reader.readAsText(file);
    }
  };

  // Commit Import
  const handleImportCommit = async () => {
    if (!importPreview) return;
    const idsToCommit = importPreview.matchedTrainees.map((t: any) => t.beneficiaryId);

    setImporting(true);
    try {
      const res = await authFetch("/api/reporting-roster/import-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryIds: idsToCommit,
          action: importCommitAction,
          tsp_id: userTspId
        })
      });

      if (res && res.ok) {
        const body = await res.json();
        if (body.success) {
          showToast(
            importCommitAction === "replace"
              ? `Successfully replaced reporting roster. Selected ${body.data.updated} trainees.`
              : `Successfully added ${body.data.updated} matched trainees to selection.`,
            "success"
          );
          setShowImportModal(false);
          setImportText("");
          setImportPreview(null);
          fetchRosterData();
        } else {
          showToast(body.error || "Import failed", "error");
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        showToast(errBody.error || "Commit failed. Quota limit of 100 exceeded.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to commit import", "error");
    } finally {
      setImporting(false);
    }
  };

  const isAllPageSelected = trainees.length > 0 && trainees.every(t => selectedRowIds.has(t.beneficiaryId));

  if (viewMode === "view_details" && activeBeneficiary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode("roster")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Roster</span>
          </button>
          <span className="text-slate-400 font-mono text-xs">/</span>
          <span className="text-slate-500 font-bold text-xs font-mono">Dossier Overview</span>
        </div>
        <BeneficiaryDetails
          beneficiary={activeBeneficiary}
          onBack={() => setViewMode("roster")}
          onTriggerBiometrics={() => {}}
          onEdit={() => setViewMode("edit_details")}
          onUpdate={async (data) => {
            const updated = { ...activeBeneficiary, ...data };
            setActiveBeneficiary(updated);
          }}
          session={session}
          initialTab={activeDetailsTab as any}
        />
      </div>
    );
  }

  if (viewMode === "edit_details" && activeBeneficiary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode("roster")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Roster</span>
          </button>
          <span className="text-slate-400 font-mono text-xs">/</span>
          <span className="text-slate-500 font-bold text-xs font-mono">Edit Beneficiary Profile</span>
        </div>
        <NewEnrollmentForm
          key={activeBeneficiary ? `edit-${activeBeneficiary.id}` : "new-enrollment"}
          customFields={[]}
          beneficiary={activeBeneficiary}
          onCancel={() => setViewMode("roster")}
          onSave={handleUpdateBeneficiary}
          onTriggerCapture={() => {}}
          preloadedPhoto={activeBeneficiary?.photo || null}
        />
      </div>
    );
  }

  return (
    <div id="roster-module-container" className="space-y-6">
      
      {/* 1. Header Banner */}
      <div id="roster-header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xxs">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Official Reporting Roster</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Build your active roster for PDF Photo Albums, Monthly Annex 9, and official government submissions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            id="import-list-btn"
            onClick={() => {
              setImportText("");
              setImportPreview(null);
              setShowImportModal(true);
            }}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import Selection List</span>
          </button>
        </div>
      </div>

      {/* 2. Budget Indicators & Stats */}
      <div id="roster-budget-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Eligible */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xxs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Eligible Trainees</span>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-950 font-mono">
              {summary.totalEligible}
            </span>
            <span className="text-xs text-slate-400 font-medium">TSP Candidates</span>
          </div>
          <div className="text-xxs text-slate-400 font-semibold uppercase tracking-wider">
            Total candidate database
          </div>
        </div>

        {/* Selected Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xxs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Active Selection</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-950 font-mono">
              {summary.selectedCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {summary.allocationLimit}</span>
          </div>
          <div className="text-xxs text-slate-400 font-semibold uppercase tracking-wider">
            Official reporting report pool
          </div>
        </div>

        {/* Remaining slots */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xxs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Remaining Slots</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black font-mono ${summary.remainingSlots <= 10 ? "text-rose-600" : "text-slate-950"}`}>
              {summary.remainingSlots}
            </span>
            <span className="text-xs text-slate-400 font-medium">slots left</span>
          </div>
          <div className="text-xxs text-slate-400 font-semibold uppercase tracking-wider">
            Up to 100 maximum limit
          </div>
        </div>

        {/* Status indicator */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xxs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Limit Status</span>
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="mt-2">
            {summary.selectedCount > summary.allocationLimit ? (
              <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Allocation limit exceeded!</span>
              </div>
            ) : summary.selectedCount === summary.allocationLimit ? (
              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Limit strictly matched (100)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
                <Info className="w-4 h-4 shrink-0" />
                <span>Quota within boundaries</span>
              </div>
            )}
          </div>
          <div className="text-xxs text-slate-400 font-semibold uppercase tracking-wider mt-1">
            Rigorous boundary tracking
          </div>
        </div>
      </div>

      {/* 3. Filtering & Searching Controls */}
      <div id="roster-controls" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xxs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Search &amp; Filters</span>
          </div>
          <button 
            onClick={() => {
              setSearchQuery("");
              setSkillFilter("all");
              setCohortFilter("all");
              setStatusFilter("all");
              setPhotoFilter("all");
              setSelectionFilter("all");
            }}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Reset All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search Name or TVET ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Skill Sector */}
          <div>
            <select
              value={skillFilter}
              onChange={(e) => { setSkillFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 font-medium hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Skills</option>
              {availableSkills.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Batch / Cohort */}
          <div>
            <select
              value={cohortFilter}
              onChange={(e) => { setCohortFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 font-medium hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Cohorts</option>
              {availableCohorts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Training Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 font-medium hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {availableStatuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          {/* Photo Filter */}
          <div>
            <select
              value={photoFilter}
              onChange={(e) => { setPhotoFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 font-medium hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Photo: All</option>
              <option value="available">Photo Available</option>
              <option value="missing">Photo Missing</option>
            </select>
          </div>

        </div>

        {/* Secondary Selection Filter */}
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={() => { setSelectionFilter("all"); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectionFilter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Trainees ({summary.totalEligible})
          </button>
          <button
            onClick={() => { setSelectionFilter("selected"); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectionFilter === "selected"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Selected for Reports ({summary.selectedCount})
          </button>
          <button
            onClick={() => { setSelectionFilter("not_selected"); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectionFilter === "not_selected"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Not Selected ({Math.max(0, summary.totalEligible - summary.selectedCount)})
          </button>
        </div>
      </div>

      {/* Bulk Admissions Processing Indicator */}
      {bulkAdmissionsProcessing && (
        <div className="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-800 shadow-md animate-pulse space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-indigo-300">{bulkAdmissionsMsg}</span>
            <span className="font-mono text-indigo-200">{bulkAdmissionsProgress}%</span>
          </div>
          <div className="w-full bg-indigo-900 rounded-full h-2">
            <div 
              className="bg-emerald-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${bulkAdmissionsProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 4. Bulk Action Floating Toolbar */}
      {selectedRowIds.size > 0 && (
        <div id="bulk-toolbar" className="bg-indigo-900 text-white px-6 py-4 rounded-2xl border border-indigo-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md animate-fade-in w-full">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              Checked trainees: {selectedRowIds.size}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-indigo-200 font-medium font-sans">
              <span>{trainees.filter(t => selectedRowIds.has(t.beneficiaryId)).length} visible on current page</span>
              <span className="opacity-40">•</span>
              <span>{selectedRowIds.size - trainees.filter(t => selectedRowIds.has(t.beneficiaryId)).length} checked outside current page</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            {/* Safety Actions */}
            <button
              onClick={handleCopyCheckedTvetIds}
              className="bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-700"
              title="Copy TVET IDs of checked trainees"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Copy IDs
            </button>
            <button
              onClick={handleExportCheckedCsv}
              className="bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-700"
              title="Export Checked List to CSV"
            >
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>

            {/* Main DB Actions */}
            <button
              onClick={() => handleOpenBulkModal("select")}
              className="bg-white hover:bg-indigo-50 text-indigo-900 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1"
            >
              Select for Official Reports
            </button>
            <button
              onClick={() => handleOpenBulkModal("remove")}
              className="bg-indigo-850 hover:bg-indigo-800 text-white border border-indigo-700 text-xs font-bold px-4 py-2 rounded-xl transition-all"
            >
              Remove from Official Reports
            </button>

            {/* Admissions Actions (Task 014) */}
            <div className="h-6 w-[1px] bg-indigo-700 mx-1 hidden lg:block" />
            <button
              disabled={bulkAdmissionsProcessing}
              onClick={() => handleBulkAdmissionsAction("generate-form")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1 border border-emerald-500 disabled:opacity-50"
              title="Generate Registry Admission Forms for checked trainees"
            >
              <FileText className="w-3.5 h-3.5" />
              Generate Forms
            </button>
            <button
              disabled={bulkAdmissionsProcessing}
              onClick={() => handleBulkAdmissionsAction("send-offer")}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1 border border-sky-500 disabled:opacity-50"
              title="Send Admission Offer notifications to checked trainees"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Send Offers
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-indigo-300 hover:text-rose-400 text-xs font-semibold px-2 py-2 transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 5. Main Unified Selection Table */}
      <div id="roster-table-card" className="bg-white rounded-2xl border border-slate-100 shadow-xxs overflow-hidden">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-500">Querying beneficiary index databases...</span>
          </div>
        ) : trainees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 p-6 space-y-3">
            <Users className="w-16 h-16 text-slate-300 stroke-1" />
            <div className="text-base font-bold text-slate-700">No trainees found matching current criteria</div>
            <p className="text-xs text-slate-400 max-w-sm">
              Adjust your search inputs or try clearing active filters to search through all eligible beneficiary pools.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-xxs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={(e) => handlePageSelectAll(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500"
                    />
                  </th>
                  <th className="py-4 px-4 w-12 text-center">S/N</th>
                  <th className="py-4 px-4">Trainee Name</th>
                  <th className="py-4 px-4 font-mono">TVET ID</th>
                  <th className="py-4 px-4">Skill Sector</th>
                  <th className="py-4 px-4">Cohort / Batch</th>
                  <th className="py-4 px-4">Training Status</th>
                  <th className="py-4 px-4 text-center">Photo Status</th>
                  <th className="py-4 px-4 text-center">Attendance Log Count</th>
                  <th className="py-4 px-4 text-center">Selection Status</th>
                  <th className="py-4 px-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {trainees.map((row, idx) => {
                  const serialNum = (page - 1) * pageSize + idx + 1;
                  const isChecked = selectedRowIds.has(row.beneficiaryId);
                  const isActionLoading = actionLoadingId === row.beneficiaryId;

                  return (
                    <tr key={row.beneficiaryId} className={`hover:bg-slate-50/40 transition-colors ${row.isSelected ? "bg-indigo-50/10" : ""}`}>
                      
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRowCheckboxToggle(row.beneficiaryId)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* S/N */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        {serialNum}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {row.fullName}
                      </td>

                      {/* TVET ID */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-500">
                        {row.tvetId}
                      </td>

                      {/* Skill */}
                      <td className="py-3 px-4">
                        {row.skill}
                      </td>

                      {/* Cohort */}
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {row.batch}
                      </td>

                      {/* Training Status */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-slate-100 text-slate-700">
                          {row.trainingStatus}
                        </span>
                      </td>

                      {/* Photo Status */}
                      <td className="py-3 px-4 text-center">
                        {row.photoAvailable ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-xxs font-semibold" title="Photo verified">
                            <Check className="w-3 h-3" />
                            <span>Photo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-xxs font-semibold" title="Photo missing">
                            <X className="w-3 h-3" />
                            <span>Missing</span>
                          </span>
                        )}
                      </td>

                      {/* Attendance Log Count */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                        {row.attendanceRecordCount} days
                      </td>

                      {/* Selection Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {row.isSelected ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            Selected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-400 border border-slate-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            Not Selected
                          </span>
                        )}
                      </td>

                      {/* Clear per-row Action */}
                      <td className="py-3 px-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2 relative">
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleToggleSelection(row.beneficiaryId, row.isSelected)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xxs transition-all shadow-xxs ${
                              row.isSelected
                                ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100"
                                : "bg-indigo-550 hover:bg-indigo-600 text-white"
                            }`}
                          >
                            {isActionLoading ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : row.isSelected ? (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Select</span>
                              </>
                            )}
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => setOpenDropdownRowId(openDropdownRowId === row.beneficiaryId ? null : row.beneficiaryId)}
                              title="Trainee Actions"
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>

                            {openDropdownRowId === row.beneficiaryId && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownRowId(null)} />
                                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-150 shadow-lg py-1.5 z-[99] text-left font-sans text-xs divide-y divide-slate-50">
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => fetchAndOpenBeneficiary(row.beneficiaryId, "view_details", "overview")}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>View Beneficiary Details</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => fetchAndOpenBeneficiary(row.beneficiaryId, "edit_details")}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Edit Beneficiary Details</span>
                                    </button>
                                  </div>
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => fetchAndOpenBeneficiary(row.beneficiaryId, "view_details", "overview")}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                    >
                                      <User className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Open Full Profile</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => fetchAndOpenBeneficiary(row.beneficiaryId, "view_details", "attendance")}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                    >
                                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                      <span>View Attendance</span>
                                    </button>
                                  </div>
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownRowId(null);
                                        setSelectedAdmissionCandidate({
                                          id: row.beneficiaryId,
                                          fullName: row.fullName,
                                          tvetId: row.tvetId
                                        });
                                      }}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                                      <span>View Admissions & Letters</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => fetchAndOpenBeneficiary(row.beneficiaryId, "view_details", "communications")}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                    >
                                      <Mail className="w-3.5 h-3.5 text-purple-500" />
                                      <span>View Communication History</span>
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-700">{trainees.length}</span> out of{" "}
            <span className="font-bold text-slate-700">{totalRows}</span> filtered rows
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1 font-semibold focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-slate-600 text-xs px-2.5 py-1.5 rounded-lg font-bold"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600 font-bold font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-slate-600 text-xs px-2.5 py-1.5 rounded-lg font-bold"
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL: Clear Selection Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-bold text-slate-900">Confirm Clear Selection</h3>
              </div>
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to clear your current working selection of{" "}
                <strong className="text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded">
                  {selectedRowIds.size}
                </strong>{" "}
                checked trainees? This will reset the checkbox state in this browser session.
              </p>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSelectedRowIds(new Set());
                  setShowClearConfirm(false);
                  showToast("Working selection cleared.", "success");
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Bulk Action Confirmation */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Confirm Bulk Action</h3>
              </div>
              <button 
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                You are about to batch-update the official reporting status for{" "}
                <strong className="text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded">
                  {selectedRowIds.size}
                </strong>{" "}
                trainees.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Bulk operation:</span>
                  <span className={`font-bold uppercase ${bulkActionType === "select" ? "text-emerald-700" : "text-rose-700"}`}>
                    {bulkActionType === "select" ? "Add to Reports" : "Remove from Reports"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="text-slate-500 font-medium">Selected Slots Quota:</span>
                  <span className="font-bold text-slate-800">
                    {summary.selectedCount} / {summary.allocationLimit}
                  </span>
                </div>
                {bulkActionType === "select" && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">New Quota After Action:</span>
                    <span className={`font-bold ${summary.selectedCount + selectedRowIds.size > summary.allocationLimit ? "text-rose-600" : "text-emerald-600"}`}>
                      {summary.selectedCount + selectedRowIds.size} / {summary.allocationLimit}
                    </span>
                  </div>
                )}
              </div>

              {bulkActionType === "select" && summary.selectedCount + selectedRowIds.size > summary.allocationLimit && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs text-rose-800 flex gap-2">
                  <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-bold">Over-quota Warning!</span> This operation would exceed your official allocation limit of {summary.allocationLimit}. The database transaction will be aborted if committed.
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBulkAction}
                  disabled={bulkActionType === "select" && summary.selectedCount + selectedRowIds.size > summary.allocationLimit}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
                >
                  Confirm Bulk Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Import Selection List (CSV/XLSX text parse) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Import Selection List</h3>
                  <p className="text-xs text-slate-400">Match trainees from beneficiary database by TVET ID</p>
                </div>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {!importPreview ? (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Paste TVET IDs directly (separated by newlines or commas) or drag and drop a standard 
                    <strong> CSV / Text</strong> file containing TVET IDs in the first column.
                  </p>

                  {/* Drag and Drop Container */}
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFileDropAndSelect(e); }}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 p-8 rounded-2xl text-center cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex justify-center">
                      <FileText className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <span className="block text-xs font-bold text-slate-700">Drag &amp; drop a CSV file here, or click to upload</span>
                    <span className="block text-[10px] text-slate-400">Supported formats: CSV, TXT, Excel raw columns</span>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept=".csv,.txt"
                      onChange={handleFileDropAndSelect} 
                      className="hidden" 
                    />
                  </div>

                  {/* Raw Text Area Paste */}
                  <div className="space-y-1.5">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 block">Or Paste TVET IDs Manual Input</label>
                    <textarea
                      rows={5}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="e.g.&#10;TVET2026B1001&#10;TVET2026B1002&#10;TVET2026B1003"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono rounded-xl p-3 focus:outline-hidden focus:border-indigo-500 focus:bg-white resize-y"
                    />
                  </div>
                </>
              ) : (
                /* Import Preview Section */
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocation Target Preview</span>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        Matched Trainees: <span className="font-mono text-indigo-600">{importPreview.matchedTrainees.length}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block">CURRENT TOTAL SELECTION</span>
                      <span className="font-mono text-sm font-black text-slate-800">
                        {importPreview.currentSelectedCount} / {importPreview.allocationLimit}
                      </span>
                    </div>
                  </div>

                  {/* Categorized feedback panels */}
                  <div className="grid grid-cols-2 gap-3 text-xxs font-semibold">
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-emerald-800 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Ready to Import ({importPreview.matchedTrainees.length})</span>
                      </div>
                      <p className="text-[10px] text-emerald-600 font-medium">Eligible candidates belonging to your TSP.</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-slate-600 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        <span>Already Selected ({importPreview.alreadySelected.length})</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">Already marked active in your reporting roster.</p>
                    </div>

                    {importPreview.unmatchedIds.length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-amber-800 space-y-1 col-span-2">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Unmatched IDs ({importPreview.unmatchedIds.length})</span>
                        </div>
                        <p className="text-[10px] text-amber-600 font-medium leading-relaxed">
                          These IDs do not exist in the database:{" "}
                          <span className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded block max-h-16 overflow-y-auto mt-1">
                            {importPreview.unmatchedIds.join(", ")}
                          </span>
                        </p>
                      </div>
                    )}

                    {importPreview.belongsToAnotherTsp.length > 0 && (
                      <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-800 space-y-1 col-span-2">
                        <div className="font-bold flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                          <span>Belong to Another TSP ({importPreview.belongsToAnotherTsp.length})</span>
                        </div>
                        <p className="text-[10px] text-rose-600 font-medium">
                          These trainees exist but belong to another organization and cannot be loaded:{" "}
                          <span className="font-mono font-bold bg-rose-100 px-1.5 py-0.5 rounded block max-h-16 overflow-y-auto mt-1">
                            {importPreview.belongsToAnotherTsp.map((t: any) => `${t.fullName} (${t.tvetId})`).join(", ")}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Commitment Settings */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Import Allocation Method</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setImportCommitAction("add")}
                          className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                            importCommitAction === "add"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="text-xs font-bold flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" />
                            <span>Append to Selection</span>
                          </span>
                          <span className="text-[10px] text-slate-400">Add matched trainees to your existing selected roster.</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImportCommitAction("replace")}
                          className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                            importCommitAction === "replace"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="text-xs font-bold flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Replace Roster Entirely</span>
                          </span>
                          <span className="text-[10px] text-slate-400">Remove all current selected trainees and replace with matched imports.</span>
                        </button>
                      </div>
                    </div>

                    {/* Check future quota */}
                    {(() => {
                      const finalPredicted = importCommitAction === "replace"
                        ? importPreview.matchedTrainees.length
                        : importPreview.currentSelectedCount + importPreview.matchedTrainees.length;
                      
                      const exceeds = finalPredicted > importPreview.allocationLimit;

                      return (
                        <div className="p-3.5 rounded-xl border flex justify-between items-center text-xs bg-slate-50 border-slate-100">
                          <span className="text-slate-500 font-medium">Predicted Roster Quota Filled:</span>
                          <span className={`font-mono font-bold ${exceeds ? "text-rose-600" : "text-emerald-600"}`}>
                            {finalPredicted} / {importPreview.allocationLimit} {exceeds ? "(Exceeds Limit!)" : "(Ok)"}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-slate-50 flex justify-between items-center shrink-0 bg-slate-50/50">
              {importPreview ? (
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Back to Editing
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                
                {!importPreview ? (
                  <button
                    onClick={handleImportAnalyze}
                    disabled={importing}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                    <span>Analyze Selection List</span>
                  </button>
                ) : (
                  <button
                    onClick={handleImportCommit}
                    disabled={importing || (importCommitAction === "replace" ? importPreview.matchedTrainees.length : importPreview.currentSelectedCount + importPreview.matchedTrainees.length) > importPreview.allocationLimit}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    <span>Confirm Import List</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {selectedAdmissionCandidate && (
        <TraineeAdmissionDetailsModal
          candidate={selectedAdmissionCandidate}
          onClose={() => {
            setSelectedAdmissionCandidate(null);
            fetchRosterData();
          }}
        />
      )}

    </div>
  );
}
