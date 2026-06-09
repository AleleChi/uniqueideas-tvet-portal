/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Search, Plus, Download, ChevronRight, Eye, ShieldAlert, Sparkles, 
  X, Check, Save, UserPlus, AlertTriangle, Users, CameraOff, Sparkles as SparklesIcon,
  Share2, Bookmark, RotateCcw, FileSpreadsheet
} from "lucide-react";
import { Beneficiary, CustomField, Gender, ProgramStatus } from "../types";
import { BeneficiaryDetails } from "./BeneficiaryDetails";
import { NewEnrollmentForm } from "./NewEnrollmentForm";
import { authFetch } from "../utils/authFetch";
import { SecureBeneficiaryImage } from "./SecureBeneficiaryImage";
import { AdmissionsWorkspace } from "./AdmissionsWorkspace";
import { PaginationControl } from "./PaginationControl";

interface BeneficiaryListProps {
  beneficiaries: Beneficiary[];
  customFields: CustomField[];
  onAddBeneficiary: (data: any) => Promise<void>;
  onUpdateBeneficiary: (id: string, data: Partial<Beneficiary>) => Promise<void>;
  onTriggerBiometrics: (beneficiary: Beneficiary) => void;
  onDownloadCSV: () => void;
  viewMode?: "list" | "details" | "create";
  onViewModeChange?: (view: "list" | "details" | "create") => void;
  tempCreatedPhoto?: string | null;
  onClearTempPhoto?: () => void;
  selectedBeneficiary?: Beneficiary | null;
  onSelectBeneficiary?: (b: Beneficiary | null) => void;
  onDeleteBeneficiary?: (id: string) => Promise<void>;
  session?: { username?: string; role?: string; email?: string } | null;
  initialDetailsTab?: "overview" | "admission" | "acceptance" | "forms" | "documents" | "training" | "audits";
  subTabMode?: "beneficiaries" | "admissions" | "documents";
  admissionsSubTab?: "dashboard" | "letters" | "forms" | "acceptance" | "dispatches";
}

export function BeneficiaryList({
  beneficiaries,
  customFields,
  onAddBeneficiary,
  onUpdateBeneficiary,
  onTriggerBiometrics,
  onDownloadCSV,
  viewMode: externalViewMode,
  onViewModeChange,
  tempCreatedPhoto,
  onClearTempPhoto,
  selectedBeneficiary: propSelectedBeneficiary,
  onSelectBeneficiary: propOnSelectBeneficiary,
  onDeleteBeneficiary,
  session,
  initialDetailsTab,
  subTabMode = "beneficiaries",
  admissionsSubTab
}: BeneficiaryListProps) {
  
  // View mode switcher: "list" | "details" | "create"
  const [internalViewMode, setInternalViewState] = useState<"list" | "details" | "create">("list");
  const [internalSelectedBeneficiary, setInternalSelectedBeneficiary] = useState<Beneficiary | null>(null);

  const selectedBeneficiary = propSelectedBeneficiary !== undefined ? propSelectedBeneficiary : internalSelectedBeneficiary;
  const setSelectedBeneficiary = (b: Beneficiary | null) => {
    setInternalSelectedBeneficiary(b);
    if (propOnSelectBeneficiary) {
      propOnSelectBeneficiary(b);
    }
  };

  const totalActive = beneficiaries.length;
  const compliantPhotos = beneficiaries.filter(b => b.status === ProgramStatus.VERIFIED).length;
  const lockErrors = beneficiaries.filter(b => b.status !== ProgramStatus.VERIFIED).length;
  const compliancePercent = totalActive > 0 ? Math.round((compliantPhotos / totalActive) * 100) : 100;

  const liveBeneficiary = selectedBeneficiary
    ? {
        ...selectedBeneficiary,
        ...(beneficiaries.find(b => b.id === selectedBeneficiary.id) || {})
      }
    : null;

  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;

  const setViewState = (val: "list" | "details" | "create") => {
    setInternalViewState(val);
    if (onViewModeChange) {
      onViewModeChange(val);
    }
  };

  // Filters State
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [governanceFilter, setGovernanceFilter] = useState("all");

  // SMART FILTER EXPERIENCES (Phase 4)
  const [savedPresets, setSavedPresets] = useState<Array<{
    id: string;
    name: string;
    search: string;
    gender: string;
    batch: string;
    status: string;
    lifecycle: string;
    pinned?: boolean;
  }>>(() => {
    try {
      const cached = localStorage.getItem("ideas-filter-presets");
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.error(e);
    }
    return [
      { id: "preset-ver", name: "Verified Cohort", search: "", gender: "all", batch: "all", status: ProgramStatus.VERIFIED, lifecycle: "all", pinned: true },
      { id: "preset-drf", name: "Requires Image capture", search: "", gender: "all", batch: "all", status: ProgramStatus.DRAFT, lifecycle: "all", pinned: false }
    ];
  });

  const [presetNameInput, setPresetNameInput] = useState("");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);

  // Synchronize dynamic parameters URL loading
  React.useEffect(() => {
    try {
      const hashQuery = window.location.hash.includes("?") 
        ? window.location.hash.split("?")[1] 
        : window.location.search;
      if (hashQuery) {
        const urlParams = new URLSearchParams(hashQuery);
        const searchVal = urlParams.get("search");
        const genderVal = urlParams.get("gender");
        const batchVal = urlParams.get("batch");
        const statusVal = urlParams.get("status");
        const lifecycleVal = urlParams.get("lifecycle");

        if (searchVal) setSearch(searchVal);
        if (genderVal) setGenderFilter(genderVal);
        if (batchVal) setBatchFilter(batchVal);
        if (statusVal) setStatusFilter(statusVal);
        if (lifecycleVal) setLifecycleFilter(lifecycleVal);
      }
    } catch (e) {
      console.error("Query loading failure ignored", e);
    }
  }, []);

  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    const newPreset = {
      id: "preset_" + Date.now(),
      name: presetNameInput,
      search,
      gender: genderFilter,
      batch: batchFilter,
      status: statusFilter,
      lifecycle: lifecycleFilter,
      pinned: false
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem("ideas-filter-presets", JSON.stringify(updated));
    setPresetNameInput("");
    setShowSavePresetModal(false);
  };

  const handleTogglePinPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPresets.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p);
    setSavedPresets(updated);
    localStorage.setItem("ideas-filter-presets", JSON.stringify(updated));
  };

  const handleRemovePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem("ideas-filter-presets", JSON.stringify(updated));
  };

  const handleApplyPreset = (preset: any) => {
    setSearch(preset.search || "");
    setGenderFilter(preset.gender || "all");
    setBatchFilter(preset.batch || "all");
    setStatusFilter(preset.status || "all");
    setLifecycleFilter(preset.lifecycle || "all");
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setGenderFilter("all");
    setBatchFilter("all");
    setStatusFilter("all");
    setLifecycleFilter("all");
    setGovernanceFilter("all");
    setCurrentPage(1);
  };

  const handleShareFilterState = () => {
    try {
      const parentUrl = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (genderFilter !== "all") params.append("gender", genderFilter);
      if (batchFilter !== "all") params.append("batch", batchFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (lifecycleFilter !== "all") params.append("lifecycle", lifecycleFilter);
      if (governanceFilter !== "all") params.append("governance", governanceFilter);

      const queryStr = params.toString();
      const shareableLink = `${parentUrl}${window.location.hash.split("?")[0]}${queryStr ? "?" + queryStr : ""}`;
      
      navigator.clipboard.writeText(shareableLink);
      alert("Search results state copied to clipboard! Share the URL to pass this view.");
    } catch (e) {
      console.error(e);
      alert("Failed to access system clipboard.");
    }
  };

  const handleExportFilteredCSV = () => {
    if (filteredList.length === 0) {
      alert("No matching filtered records found to export.");
      return;
    }
    const headers = ["ID", "LastName", "FirstName", "NIN", "BVN", "State", "Batch", "Lifecycle", "Status"];
    const rows = filteredList.map(b => [
      b.id,
      `"${b.lastName}"`,
      `"${b.firstName}"`,
      `"${b.nin}"`,
      `"${b.bvn}"`,
      `"${b.state}"`,
      `"${b.batch}"`,
      `"${b.admissionStatus || 'Draft'}"`,
      `"${b.status}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `filtered_tvet_cohort_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination page selection state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // FEATURE 3: BULK SELECTION & OPERATIONS STATE
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  const [bulkGAction, setBulkGAction] = useState("");
  const [bulkGReason, setBulkGReason] = useState("");

  const handleApplyBulkGovernance = async () => {
    if (!bulkGAction) return;
    if (!bulkGReason || bulkGReason.trim() === "") {
      alert("A status change reason is required.");
      return;
    }

    setBulkProcessing(true);
    setBulkProgress(`Applying bulk governance state '${bulkGAction}' to ${selectedCandidateIds.length} candidate(s)...`);
    try {
      const response = await authFetch("/api/admissions/bulk-lifecycle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryIds: selectedCandidateIds,
          action: bulkGAction,
          reason: bulkGReason
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Bulk action could not be performed due to security limits.");
      }

      const resData = await response.json();
      alert(`Success: Successfully updated program states for ${resData.processedCount || selectedCandidateIds.length} candidate profiles!`);
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "Failed bulk update query.");
    } finally {
      setBulkProcessing(false);
      setBulkGAction("");
      setBulkGReason("");
    }
  };

  const handleBulkGenerateDocuments = async (docType: string) => {
    if (selectedCandidateIds.length === 0) return;
    setBulkProcessing(true);
    setBulkProgress(`Initializing bulk compilation for ${selectedCandidateIds.length} candidate(s)...`);
    try {
      for (let i = 0; i < selectedCandidateIds.length; i++) {
        const bId = selectedCandidateIds[i];
        setBulkProgress(`Compiling ${docType.replace(/_/g, " ")} (${i + 1}/${selectedCandidateIds.length})...`);
        const res = await authFetch("/api/documents/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beneficiaryId: bId,
            documentType: docType,
            regenerate: true
          })
        });
        if (!res.ok) {
          console.error(`Bulk compilation failed for beneficiary ${bId}`);
        }
        await new Promise(resolve => setTimeout(resolve, 150)); // nice processing buffer
      }
      alert(`Successfully processed and registered ${docType.replace(/_/g, " ")} for all ${selectedCandidateIds.length} candidates!`);
      setSelectedCandidateIds([]);
    } catch (e) {
      console.error(e);
      alert("Bulk compilation encountered a system error.");
    } finally {
      setBulkProcessing(false);
      setBulkProgress("");
    }
  };

  const handleBulkSendEmails = async () => {
    if (selectedCandidateIds.length === 0) return;
    setBulkProcessing(true);
    setBulkProgress(`Checking history records for ${selectedCandidateIds.length} candidate(s)...`);
    try {
      let successfulCount = 0;
      for (let i = 0; i < selectedCandidateIds.length; i++) {
        const bId = selectedCandidateIds[i];
        setBulkProgress(`Retrieving documents for candidate ${i + 1}/${selectedCandidateIds.length}...`);
        
        // 1. Fetch document history
        const hRes = await authFetch(`/api/documents/${bId}/history`);
        if (hRes.ok) {
          const history = await hRes.json();
          if (history && history.length > 0) {
            const latestDoc = history[0]; // grab the absolute latest compiled document
            setBulkProgress(`Dispatching email for document v${latestDoc.version} (${i + 1}/${selectedCandidateIds.length})...`);
            
            // 2. Dispatch email
            const emailRes = await authFetch("/api/documents/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ documentId: latestDoc.id })
            });
            if (emailRes.ok) {
              successfulCount++;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      alert(`Bulk mail dispatcher processed fully. Dispatched secure payloads to ${successfulCount} candidate(s).`);
      setSelectedCandidateIds([]);
    } catch (e) {
      console.error(e);
      alert("Bulk dispatch encountered a socket error.");
    } finally {
      setBulkProcessing(false);
      setBulkProgress("");
    }
  };

  const handleBulkExportCSV = () => {
    if (selectedCandidateIds.length === 0) return;
    const selectedList = beneficiaries.filter(b => selectedCandidateIds.includes(b.id));
    
    // Generate simple compliant CSV content client-side
    const headers = ["ID", "LastName", "FirstName", "NIN", "BVN", "State", "Batch", "Lifecycle", "Status"];
    const rows = selectedList.map(b => [
      b.id,
      `"${b.lastName}"`,
      `"${b.firstName}"`,
      `"${b.nin}"`,
      `"${b.bvn}"`,
      `"${b.state}"`,
      `"${b.batch}"`,
      `"${b.admissionStatus || 'Draft'}"`,
      `"${b.status}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bulk_selected_tvet_candidates_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`Exported dynamic record set for ${selectedList.length} candidate(s).`);
  };

  // Filter List Candidates
  const filteredList = beneficiaries.filter(b => {
    const query = search.toLowerCase();
    const matchesSearch = 
      b.firstName.toLowerCase().includes(query) ||
      b.lastName.toLowerCase().includes(query) ||
      b.id.toLowerCase().includes(query) ||
      b.bvn.includes(query) ||
      b.nin.includes(query);

    const matchesGender = genderFilter === "all" || b.gender === genderFilter;
    const matchesStatus = 
      statusFilter === "all" || 
      b.status === statusFilter ||
      (statusFilter === ProgramStatus.UNDER_REVIEW && b.status === ProgramStatus.PENDING_PHOTO) ||
      (statusFilter === ProgramStatus.ENROLLED && b.status === ProgramStatus.VERIFIED);
    const matchesBatch = batchFilter === "all" || b.batch === batchFilter;
    
    const bLife = b.admissionStatus || "Draft";
    const matchesLifecycle = lifecycleFilter === "all" || 
      (lifecycleFilter === "Draft" && (bLife === "Draft" || bLife === "Pending")) ||
      bLife.toLowerCase() === lifecycleFilter.toLowerCase();

    const bGovStatus = b.beneficiaryStatus || "ACTIVE";
    const matchesGovernance = governanceFilter === "all" || bGovStatus.toUpperCase() === governanceFilter.toUpperCase();

    return matchesSearch && matchesGender && matchesStatus && matchesBatch && matchesLifecycle && matchesGovernance;
  });

  // Calculate paginated index subset
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;

  // Form saving actions
  const handleAddNewCandidate = async (formData: Partial<Beneficiary>) => {
    try {
      await onAddBeneficiary({
        ...formData,
        otherName: "",
        city: formData.city || (formData.state?.includes("Imo") ? "Owerri" : (formData.state?.includes("Lagos") ? "Ikeja" : "Kano Central"))
      });
      setViewState("list");
      setSelectedBeneficiary(null);
      if (onClearTempPhoto) onClearTempPhoto();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCandidate = async (formData: Partial<Beneficiary>) => {
    if (liveBeneficiary) {
      try {
        await onUpdateBeneficiary(liveBeneficiary.id, formData);
        setViewState("list");
        setSelectedBeneficiary(null);
        if (onClearTempPhoto) onClearTempPhoto();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Switch to screen views
  const handleLaunchDetails = (b: Beneficiary) => {
    setSelectedBeneficiary(b);
    setViewState("details");
  };

  const handleLaunchCreate = () => {
    setSelectedBeneficiary(null);
    setViewState("create");
  };

  // If viewing Details screen matching 5.png
  if (viewMode === "details" && liveBeneficiary) {
    return (
      <BeneficiaryDetails 
        beneficiary={liveBeneficiary}
        onBack={() => { setViewState("list"); setSelectedBeneficiary(null); }}
        onTriggerBiometrics={() => onTriggerBiometrics(liveBeneficiary)}
        onEdit={() => setViewState("create")}
        onUpdate={(data) => onUpdateBeneficiary(liveBeneficiary.id, data)}
        onDelete={onDeleteBeneficiary ? () => onDeleteBeneficiary(liveBeneficiary.id) : undefined}
        session={session}
        initialTab={initialDetailsTab}
      />
    );
  }

  // If viewing Enrollment screen matching 9.png
  if (viewMode === "create") {
    return (
      <NewEnrollmentForm 
        key={liveBeneficiary ? `edit-${liveBeneficiary.id}` : "new-enrollment"}
        customFields={customFields}
        beneficiaries={beneficiaries}
        onCancel={() => { 
          setViewState("list"); 
          setSelectedBeneficiary(null); 
          if (onClearTempPhoto) onClearTempPhoto();
        }}
        onSave={liveBeneficiary ? handleUpdateCandidate : handleAddNewCandidate}
        onTriggerCapture={() => {
          // If we editing, trigger photo snap, else mock register snap
          onTriggerBiometrics(liveBeneficiary || { id: "TEMP", firstName: "Prospect", lastName: "Enroll" } as any);
        }}
        preloadedPhoto={tempCreatedPhoto || (liveBeneficiary ? liveBeneficiary.photo : null)}
        beneficiary={liveBeneficiary}
      />
    );
  }

  if (viewMode === "list" && subTabMode === "admissions") {
    return (
      <AdmissionsWorkspace 
        session={session} 
        onSelectCandidate={(c) => {
          const fullObj = beneficiaries.find(b => b.id === c.id) || c;
          handleLaunchDetails(fullObj);
        }} 
        activeSubTab={admissionsSubTab}
      />
    );
  }

  return (
    <div className="space-y-6 relative max-w-7xl mx-auto font-sans select-none pb-12 animate-in fade-in duration-200">
      
      {/* 1. TOP STATS CARDS ROW (4.png Header stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Stat Card 1: Total Active */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-indigo-600 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              TOTAL ACTIVE
            </span>
            <span className="font-display font-bold text-2xl text-slate-900 tracking-tight block">
              {totalActive.toLocaleString()}
            </span>
            <p className="text-[10px] text-slate-500 font-medium">In Repair Tracks</p>
          </div>
          <div className="h-10 w-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Stat Card 2: Compliant Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-emerald-500 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              COMPLIANT PHOTOS
            </span>
            <span className="font-display font-bold text-2xl text-slate-900 tracking-tight block">
              {compliantPhotos.toLocaleString()}
            </span>
            <p className="text-[10px] text-emerald-600 font-semibold uppercase">● {compliancePercent}% Locks Met</p>
          </div>
          <div className="h-10 w-10 bg-emerald-55 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <Check className="w-5 h-5" />
          </div>
        </div>

        {/* Stat Card 3: Biometric lock error (Red warning) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-rose-500 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              BIOMETRIC LOCK ERROR
            </span>
            <span className="font-display font-bold text-2xl text-slate-900 tracking-tight block">
              {lockErrors.toLocaleString()}
            </span>
            <p className="text-[10px] text-rose-600 font-semibold uppercase">● Needs Capture</p>
          </div>
          <div className="h-10 w-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-500">
            <CameraOff className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* 2. TABULAR WORKSHEET CONTROLS BAR (Phase 4 Smart Filters) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-4">
        
        {/* Presets and Pinned row */}
        {savedPresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-dashed border-slate-100 text-left">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Bookmark className="h-3 w-3 text-indigo-500" /> Presets:
            </span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {savedPresets.map(preset => (
                <div 
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="inline-flex items-center gap-1.5 p-1 px-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-[10px] font-bold text-slate-650 cursor-pointer transition border border-slate-200"
                >
                  <span className="truncate max-w-[120px]">{preset.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleTogglePinPreset(preset.id, e)}
                    className="p-0.5 hover:text-amber-600 font-mono text-slate-400 text-[8px]"
                    title={preset.pinned ? "Unpin filter preset" : "Pin filter preset"}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemovePreset(preset.id, e)}
                    className="text-slate-450 hover:text-rose-600 font-sans font-bold text-[10px] ml-0.5"
                    title="Delete preset"
                  >
                    ×
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => setShowSavePresetModal(true)}
                className="text-[10px] font-bold text-[#008751] hover:text-emerald-700 cursor-pointer flex items-center gap-0.5 font-mono px-1.5"
              >
                + Save Present View
              </button>
            </div>
          </div>
        )}

        {/* Save Preset Dialog Modal Input */}
        {showSavePresetModal && (
          <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between gap-3 text-left">
            <div className="flex-grow max-w-sm">
              <label htmlFor="preset-name-input" className="sr-only">Query Preset Label</label>
              <input
                id="preset-name-input"
                type="text"
                placeholder="Give current filters a secure name..."
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                className="w-full bg-white border rounded-lg p-1.5 px-3 text-xs focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePreset}
                className="bg-indigo-600 text-white rounded-lg p-1.5 px-3 text-xs font-bold hover:bg-indigo-500 cursor-pointer"
              >
                Confirm Save
              </button>
              <button
                type="button"
                onClick={() => { setShowSavePresetModal(false); setPresetNameInput(""); }}
                className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-3 flex-1 text-left">
            <h3 className="font-display font-bold text-indigo-700 text-sm uppercase tracking-wider mr-2">
              {subTabMode === "admissions" 
                ? "Admissions Office Queue" 
                : subTabMode === "documents" 
                ? "Generated Documents Registry" 
                : "All Candidates"}
            </h3>

            {/* Keyword search filter */}
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <input 
                type="text" 
                placeholder="Search Computer Hardware & Cell Phone Rep..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-1.5 pl-9 pr-4 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none transition"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>

            {/* Genders Filter */}
            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer focus:outline-none"
            >
              <option value="all">All Genders</option>
              <option value="MALE">Male Candidates Only</option>
              <option value="FEMALE">Female Candidates Only</option>
            </select>

            {/* Period filter */}
            <select
              value={batchFilter}
              onChange={(e) => { setBatchFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer focus:outline-none"
            >
              <option value="all">All Batches</option>
              {Array.from(new Set(beneficiaries.map(b => b.batch).filter(Boolean))).sort().map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Status Level */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer focus:outline-none"
            >
              <option value="all">All Status levels</option>
              <option value={ProgramStatus.DRAFT}>Draft Only</option>
              <option value={ProgramStatus.UNDER_REVIEW}>Under Review</option>
              <option value={ProgramStatus.ENROLLED}>Enrolled Only</option>
              <option value={ProgramStatus.IN_TRAINING}>In Training</option>
              <option value={ProgramStatus.GRADUATED}>Graduated Only</option>
              <option value={ProgramStatus.ALUMNI}>Alumni Only</option>
              <option value={ProgramStatus.FLAGGED}>Flagged Profiles</option>
            </select>

            {/* Lifecycle Stage dropdown */}
            <select
              value={lifecycleFilter}
              onChange={(e) => { setLifecycleFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer focus:outline-none"
            >
              <option value="all">All Lifecycle Stages</option>
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

            {/* Governance status dropdown filter */}
            <select
              value={governanceFilter}
              onChange={(e) => { setGovernanceFilter(e.target.value); setCurrentPage(1); }}
              className="bg-indigo-50 hover:bg-indigo-100 border-indigo-150 border border-slate-200 text-indigo-750 font-bold py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer focus:outline-none"
            >
              <option value="all">All Governance Statuses</option>
              <option value="ACTIVE">ACTIVE Status</option>
              <option value="COMPLETED">COMPLETED Status</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW Status</option>
              <option value="WITHDRAWN">WITHDRAWN Status</option>
              <option value="FAILED_VERIFICATION">FAILED_VERIFICATION Status</option>
              <option value="DISQUALIFIED">DISQUALIFIED Status</option>
              <option value="REMOVED">REMOVED (Soft Delete) Status</option>
              <option value="ARCHIVED">ARCHIVED Status</option>
            </select>

          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
            <button
              type="button"
              onClick={handleLaunchCreate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-555 py-2 px-4 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition outline-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Beneficiary
            </button>
            <button
              type="button"
              onClick={onDownloadCSV}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 text-slate-700 py-2 px-4 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition outline-none cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export National Registry
            </button>
          </div>

        </div>

        {/* ACTIVE CHIPS VIEW & CLEAR CONTROLS */}
        {(search || genderFilter !== "all" || batchFilter !== "all" || statusFilter !== "all" || lifecycleFilter !== "all" || governanceFilter !== "all") && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/70 border border-dashed rounded-xl text-left animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-tight block">
                Active Queries:
              </span>
              
              {search && (
                <span className="inline-flex items-center gap-1 p-1 px-2.5 bg-indigo-50 border border-indigo-150 rounded-full text-[10px] font-bold text-indigo-805 text-indigo-700 uppercase leading-none font-sans">
                  Keyword: {search}
                  <X className="h-3 w-3 hover:text-rose-600 cursor-pointer shrink-0" onClick={() => setSearch("")} />
                </span>
              )}

              {genderFilter !== "all" && (
                <span className="inline-flex items-center gap-1 p-1 px-2.5 bg-slate-100 border rounded-full text-[10px] font-bold text-slate-700 uppercase leading-none">
                  Gender: {genderFilter}
                  <X className="h-2.5 w-2.5 hover:text-rose-600 cursor-pointer shrink-0" onClick={() => setGenderFilter("all")} />
                </span>
              )}

              {batchFilter !== "all" && (
                <span className="inline-flex items-center gap-1 p-1 px-2.5 bg-slate-100 border rounded-full text-[10px] font-bold text-slate-700 uppercase leading-none">
                  Batch: {batchFilter}
                  <X className="h-2.5 w-2.5 hover:text-rose-600 cursor-pointer shrink-0" onClick={() => setBatchFilter("all")} />
                </span>
              )}

              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 p-1 px-2.5 bg-slate-100 border rounded-full text-[10px] font-bold text-slate-700 uppercase leading-none">
                  Status: {statusFilter}
                  <X className="h-2.5 w-2.5 hover:text-rose-600 cursor-pointer shrink-0" onClick={() => setStatusFilter("all")} />
                </span>
              )}

              {lifecycleFilter !== "all" && (
                <span className="inline-flex items-center gap-1 p-1 px-2.5 bg-slate-100 border rounded-full text-[10px] font-bold text-slate-700 uppercase leading-none">
                  Lifecycle: {lifecycleFilter}
                  <X className="h-2.5 w-2.5 hover:text-rose-600 cursor-pointer shrink-0" onClick={() => setLifecycleFilter("all")} />
                </span>
              )}

              {governanceFilter !== "all" && (
                <span className="inline-flex items-center gap-1 p-1 px-2.5 bg-indigo-900 border text-white border-indigo-950 rounded-full text-[10px] font-mono tracking-tight font-bold uppercase leading-none">
                  Gov Status: {governanceFilter}
                  <X className="h-2.5 w-2.5 text-indigo-300 hover:text-rose-400 cursor-pointer shrink-0" onClick={() => setGovernanceFilter("all")} />
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareFilterState}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer border border-slate-205 border-slate-200 p-1 px-2 rounded-lg bg-white bg-white hover:bg-slate-50 transition"
                title="Copy share link filter state"
              >
                <Share2 className="h-3 w-3" /> Copy Link
              </button>

              <button
                type="button"
                onClick={handleExportFilteredCSV}
                id="generic-export-csv-btn"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#008751] hover:text-emerald-800 cursor-pointer border border-emerald-250 border-emerald-200 p-1 px-2 rounded-lg bg-white bg-white hover:bg-slate-50 transition"
                title="Export active filtered dataset only"
              >
                <FileSpreadsheet className="h-3 w-3" /> Export Filtered ({filteredList.length})
              </button>

              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer hover:underline p-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset Queries
              </button>
            </div>
          </div>
        )}

        {/* FEATURE 3: BULK OPERATIONS PANEL */}
        {selectedCandidateIds.length > 0 && (
          <div id="bulk-operations-panel" className="bg-indigo-950 text-white rounded-xl p-4 space-y-4 animate-in slide-in-from-top duration-200 text-left">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-indigo-900 rounded-lg text-indigo-200 text-xs font-bold leading-none animate-pulse">
                  {selectedCandidateIds.length} Chosen
                </span>
                <div className="text-left">
                  <h4 className="text-sm font-bold font-sans tracking-tight text-white">Bulk Operations Center</h4>
                  <p className="text-[10px] text-indigo-300 font-mono">Select multiple candidates and execute bulk workflows</p>
                </div>
              </div>

              {bulkProcessing && (
                <div className="text-[10px] text-amber-300 font-mono animate-pulse bg-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-800 w-full lg:w-auto text-center lg:text-left">
                  {bulkProgress}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
                {/* Document Type Selector for Bulk Compile */}
                <select
                  id="bulk-doc-type-selector"
                  disabled={bulkProcessing}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkGenerateDocuments(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-indigo-900 hover:bg-indigo-850 text-white border border-indigo-800 rounded-lg py-1.5 px-3 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="">-- Compile Documents --</option>
                  <option value="ADMISSION_LETTER">Admission Intent Letter</option>
                  <option value="ACCEPTANCE_LETTER">Acceptance Slip Confirmation</option>
                  <option value="ADMISSION_FORM">Admission Form Dossier</option>
                  <option value="PHOTO_ALBUM">Photo Album Badge</option>
                  <option value="ENROLLMENT_CONFIRMATION">Enrollment Confirmation</option>
                  <option value="COMPLETION_CERTIFICATE">Graduation Certificate</option>
                </select>

                <button
                  type="button"
                  id="bulk-send-emails-btn"
                  disabled={bulkProcessing}
                  onClick={handleBulkSendEmails}
                  className="bg-white text-indigo-950 hover:bg-slate-50 font-extrabold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer min-h-[32px]"
                >
                  Dispatch Emails
                </button>

                <button
                  type="button"
                  id="bulk-export-data-btn"
                  disabled={bulkProcessing}
                  onClick={handleBulkExportCSV}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-700 font-extrabold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer min-h-[32px]"
                >
                  Export Selected
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCandidateIds([])}
                  disabled={bulkProcessing}
                  className="bg-transparent hover:bg-indigo-900/50 text-slate-300 hover:text-white font-bold text-xs py-1.5 px-3 rounded-lg transition min-h-[32px] cursor-pointer"
                >
                  Deselect
                </button>
              </div>
            </div>

            {/* NESTED LAYER: BULK LIFECYCLE GOVERNANCE STATUS UPDATES */}
            <div className="pt-3 border-t border-indigo-900/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-indigo-900/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-mono text-[10px] font-bold text-indigo-200 uppercase tracking-widest block leading-none">
                    Bulk Gov Control (Role: {session?.role || "GUEST"})
                  </span>
                  <p className="text-[9px] text-slate-400 font-sans mt-0.5">Change programmatic states simultaneously with mandatory audit log</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto md:flex-1 md:justify-end">
                <select
                  id="bulk-governance-action"
                  disabled={bulkProcessing}
                  onChange={(e) => {
                    setBulkGAction(e.target.value);
                  }}
                  value={bulkGAction}
                  className="bg-indigo-900 text-white border border-indigo-750 rounded-lg py-1.5 px-3 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="">-- Choose Governance State --</option>
                  {session?.role === "SUPER_ADMIN" && (
                    <>
                      <option value="FAILED_VERIFICATION">FAILED_VERIFICATION</option>
                      <option value="DISQUALIFIED">DISQUALIFIED</option>
                      <option value="ARCHIVED">ARCHIVED File</option>
                      <option value="RESTORE">RESTORE ACTIVE (Active status)</option>
                      <option value="REMOVED">REMOVE Trainees (Soft Delete)</option>
                    </>
                  )}
                  {session?.role === "ADMIN_OFFICER" && (
                    <>
                      <option value="WITHDRAWN">WITHDRAWN</option>
                    </>
                  )}
                  {session?.role !== "SUPER_ADMIN" && session?.role !== "ADMIN_OFFICER" && (
                    <option value="" disabled>No update rights for your role</option>
                  )}
                </select>

                <input
                  type="text"
                  placeholder="Mandatory central audit change reason..."
                  value={bulkGReason}
                  onChange={(e) => setBulkGReason(e.target.value)}
                  disabled={bulkProcessing || !bulkGAction}
                  className="bg-indigo-900 text-white border border-indigo-750 placeholder-indigo-400 rounded-lg py-1.5 px-3 text-xs outline-none flex-1 max-w-sm"
                />

                <button
                  type="button"
                  disabled={bulkProcessing || !bulkGAction || !bulkGReason.trim()}
                  onClick={handleApplyBulkGovernance}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-indigo-900 disabled:text-indigo-400 text-slate-950 font-extrabold text-xs py-1.5 px-4 rounded-lg transition cursor-pointer shrink-0 shadow-xs uppercase font-mono tracking-wider"
                >
                  Apply State
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. WORKSHEET MAIN DATABASE TABLE VIEW (4.png rows) */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto overflow-y-hidden">
          <table className="min-w-[900px] lg:min-w-0 w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-100">
                <th className="py-2.5 px-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedList.length > 0 && paginatedList.every(b => selectedCandidateIds.includes(b.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const currentIds = paginatedList.map(b => b.id);
                        setSelectedCandidateIds(prev => Array.from(new Set([...prev, ...currentIds])));
                      } else {
                        const currentIds = paginatedList.map(b => b.id);
                        setSelectedCandidateIds(prev => prev.filter(id => !currentIds.includes(id)));
                      }
                    }}
                    className="rounded text-indigo-600 cursor-pointer" 
                  />
                </th>
                <th className="py-2.5 px-4 w-16">Port</th>
                <th className="py-2.5 px-4">Candidate Identification</th>
                {subTabMode === "admissions" ? (
                  <>
                    <th className="py-2.5 px-4 font-bold text-indigo-600">Admissions Lifecycle</th>
                    <th className="py-2.5 px-4">Admission REF</th>
                    <th className="py-2.5 px-4">Location State</th>
                    <th className="py-2.5 px-4">Level batch</th>
                    <th className="py-2.5 px-4">Bio Lock Score</th>
                  </>
                ) : subTabMode === "documents" ? (
                  <>
                    <th className="py-2.5 px-4 font-bold text-indigo-600">Document Completeness</th>
                    <th className="py-2.5 px-4 text-rose-600">Missing Documents Warning</th>
                    <th className="py-2.5 px-4">Admissions Lifecycle</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-4">NIN Number</th>
                    <th className="py-2.5 px-4">BVN Number</th>
                    <th className="py-2.5 px-4">Location State</th>
                    <th className="py-2.5 px-4">Level batch</th>
                    <th className="py-2.5 px-4">Lifecycle Step</th>
                    <th className="py-2.5 px-4">Bio Lock Score</th>
                  </>
                )}
                <th className="py-2.5 px-4 text-right">View Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs font-medium text-slate-700">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-mono">
                    No beneficiary profile match in program subset coordinates.
                  </td>
                </tr>
              ) : (
                paginatedList.map((b) => (
                  <tr 
                    key={b.id}
                    onClick={() => handleLaunchDetails(b)}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedCandidateIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCandidateIds(prev => [...prev, b.id]);
                          } else {
                            setSelectedCandidateIds(prev => prev.filter(id => id !== b.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 cursor-pointer" 
                      />
                    </td>
                    
                    <td className="py-3 px-4">
                      {b.photo ? (
                        <img 
                          src={b.photo} 
                          alt="Port" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <SecureBeneficiaryImage 
                          id={b.id}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                          alt="Port"
                          fallbackInitials={`${b.firstName?.charAt(0) || ""}${b.lastName?.charAt(0) || ""}`}
                        />
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-sans font-bold text-slate-900 text-sm leading-normal">
                        {b.lastName}, {b.firstName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono tracking-wide">
                          {b.id}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-sm font-sans font-semibold uppercase text-[9px] border ${
                          b.beneficiaryStatus === "COMPLETED" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          b.beneficiaryStatus === "WITHDRAWN" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          b.beneficiaryStatus === "FAILED_VERIFICATION" ? "bg-red-50 text-red-700 border-red-200" :
                          b.beneficiaryStatus === "DISQUALIFIED" ? "bg-red-100 text-red-800 border-red-300" :
                          b.beneficiaryStatus === "REMOVED" ? "bg-rose-100 text-rose-800 border-rose-300" :
                          b.beneficiaryStatus === "ARCHIVED" ? "bg-slate-50 text-slate-700 border-slate-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {b.beneficiaryStatus || "ACTIVE"}
                        </span>
                      </div>
                    </td>

                    {subTabMode === "admissions" ? (
                      <>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const step = b.admissionStatus || "Draft";
                            let style = "bg-slate-100 text-slate-700 border-slate-200";
                            if (step === "Admission Generated") style = "bg-indigo-50 text-indigo-700 border-indigo-100";
                            else if (step === "Admission Sent") style = "bg-blue-50 text-blue-700 border-blue-100";
                            else if (step === "Offer Viewed") style = "bg-cyan-50 text-cyan-700 border-cyan-100";
                            else if (step === "Acceptance Pending") style = "bg-amber-50 text-amber-700 border-amber-100";
                            else if (step === "Acceptance Uploaded") style = "bg-purple-50 text-purple-700 border-purple-100";
                            else if (step === "Under Review") style = "bg-yellow-50 text-yellow-800 border-yellow-200";
                            else if (step === "Accepted") style = "bg-green-50 text-green-700 border-green-100";
                            else if (step === "Enrolled") style = "bg-emerald-50 text-emerald-700 border-emerald-100";
                            else if (step === "Training In Progress") style = "bg-indigo-950/10 text-indigo-950 border-indigo-950/20";
                            else if (step === "Training Completed") style = "bg-purple-950/10 text-purple-950 border-purple-950/20";
                            else if (step === "Certified") style = "bg-amber-500/10 text-amber-700 border-amber-500/20";
                            else if (step === "Alumni") style = "bg-teal-50 text-teal-700 border-teal-100";
                            
                            return (
                              <span className={`border px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${style}`}>
                                {step}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] font-bold text-indigo-600">
                          {b.admissionRef || <span className="text-slate-300">DRAFT</span>}
                        </td>

                        <td className="py-3 px-4 font-sans text-[11px] text-slate-600">
                          {b.state.replace(" State", "")}
                        </td>

                        <td className="py-3 px-4 font-sans text-xs text-indigo-700 font-semibold uppercase">
                          {b.batch.replace("Batch ", "")}
                        </td>

                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            let text = "Pending";
                            let style = "bg-amber-50 text-amber-700 border-amber-100";
                            let dotColor = "bg-amber-500";
                            let pulse = false;

                            if (b.status === ProgramStatus.DRAFT) {
                              text = "Draft";
                              style = "bg-slate-50 text-slate-600 border-slate-200";
                              dotColor = "bg-slate-400";
                            } else if (b.status === ProgramStatus.UNDER_REVIEW || b.status === ProgramStatus.PENDING_PHOTO) {
                              text = "Under Review";
                              style = "bg-orange-50 text-orange-700 border-orange-200";
                              dotColor = "bg-orange-500";
                            } else if (b.status === ProgramStatus.ENROLLED || b.status === ProgramStatus.VERIFIED) {
                              text = "Enrolled";
                              style = "bg-blue-50 text-blue-700 border-blue-200";
                              dotColor = "bg-blue-500";
                              pulse = true;
                            } else if (b.status === ProgramStatus.IN_TRAINING) {
                              text = "In Training";
                              style = "bg-purple-50 text-purple-700 border-purple-200";
                              dotColor = "bg-purple-500";
                              pulse = true;
                            } else if (b.status === ProgramStatus.GRADUATED) {
                              text = "Graduated";
                              style = "bg-emerald-50 text-emerald-700 border-emerald-200";
                              dotColor = "bg-emerald-500";
                            } else if (b.status === ProgramStatus.ALUMNI) {
                              text = "Alumni";
                              style = "bg-teal-50 text-teal-700 border-teal-200";
                              dotColor = "bg-teal-500";
                            } else if (b.status === ProgramStatus.FLAGGED) {
                              text = "NIN Mismatch";
                              style = "bg-rose-50 text-rose-700 border-rose-200";
                              dotColor = "bg-rose-500";
                            }

                            return (
                              <span className={`${style} border font-semibold px-2 py-0.5 rounded text-[10px] tracking-wide inline-flex items-center gap-1`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pulse ? "animate-pulse" : ""}`}></span>
                                {text}
                              </span>
                            );
                          })()}
                        </td>
                      </>
                    ) : subTabMode === "documents" ? (
                      <>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const docs = [
                              { key: "photo", label: "Passport", exists: !!b.photo },
                              { key: "nin", label: "NIN", exists: !!b.nin },
                              { key: "bvn", label: "BVN", exists: !!b.bvn },
                              { key: "admission", label: "Admission Letter", exists: !!b.admissionLetterUrl || !!b.admissionRef },
                              { key: "acceptance", label: "Acceptance Slip", exists: !!b.acceptanceLetterUrl || !!b.acceptanceLetterUploaded },
                            ];
                            const count = docs.filter(d => d.exists).length;
                            const total = docs.length;
                            const percent = Math.round((count / total) * 100);
                            return (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-800">{count}/{total} Docs</span>
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const docs = [
                              { key: "photo", label: "Passport Image", exists: !!b.photo },
                              { key: "nin", label: "NIN Verification", exists: !!b.nin },
                              { key: "bvn", label: "BVN Verification", exists: !!b.bvn },
                              { key: "admission", label: "Offer Letter", exists: !!b.admissionLetterUrl || !!b.admissionRef },
                              { key: "acceptance", label: "Acceptance Slip", exists: !!b.acceptanceLetterUrl || !!b.acceptanceLetterUploaded },
                            ];
                            const missing = docs.filter(d => !d.exists).map(d => d.label);
                            return missing.length === 0 ? (
                              <span className="text-emerald-600 font-extrabold text-[10px] flex items-center gap-1 uppercase tracking-wider">
                                <Check className="w-3.5 h-3.5" /> FULLY COMPLIANT
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-[280px]">
                                {missing.map((lbl) => (
                                  <span key={lbl} className="bg-rose-50 border border-rose-100 text-rose-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                    Missing {lbl}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const step = b.admissionStatus || "Draft";
                            let style = "bg-slate-100 text-slate-705 text-slate-700 border-slate-200";
                            if (step === "Admission Generated") style = "bg-indigo-50 text-indigo-700 border-indigo-100";
                            else if (step === "Admission Sent") style = "bg-blue-50 text-blue-700 border-blue-105 border-blue-100";
                            else if (step === "Offer Viewed") style = "bg-cyan-50 text-cyan-705 text-cyan-700 border-cyan-100";
                            else if (step === "Acceptance Pending") style = "bg-amber-50 text-amber-700 border-amber-100";
                            else if (step === "Acceptance Uploaded") style = "bg-purple-50 text-purple-705 text-purple-700 border-purple-100";
                            else if (step === "Under Review") style = "bg-yellow-50 text-yellow-850 text-yellow-800 border-yellow-200";
                            else if (step === "Accepted") style = "bg-green-50 text-green-700 border-green-100";
                            else if (step === "Enrolled") style = "bg-emerald-50 text-emerald-700 border-emerald-100";
                            
                            return (
                              <span className={`border px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${style}`}>
                                {step}
                              </span>
                            );
                          })()}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {b.nin.substring(0, 4)}-****-****
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {b.bvn.substring(0, 3)}****{b.bvn.substring(7)}
                        </td>

                        <td className="py-3 px-4 font-sans text-[11px] text-slate-600">
                          {b.state.replace(" State", "")}
                        </td>

                        <td className="py-3 px-4 font-sans text-xs text-indigo-700 font-semibold uppercase">
                          {b.batch.replace("Batch ", "")}
                        </td>

                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const step = b.admissionStatus || "Draft";
                            let style = "bg-slate-100 text-slate-700 border-slate-200";
                            if (step === "Admission Generated") style = "bg-indigo-50 text-indigo-700 border-indigo-100";
                            else if (step === "Admission Sent") style = "bg-blue-50 text-blue-700 border-blue-100";
                            else if (step === "Offer Viewed") style = "bg-cyan-50 text-cyan-700 border-cyan-100";
                            else if (step === "Acceptance Pending") style = "bg-amber-50 text-amber-700 border-amber-100";
                            else if (step === "Acceptance Uploaded") style = "bg-purple-50 text-purple-700 border-purple-100";
                            else if (step === "Under Review") style = "bg-yellow-50 text-yellow-800 border-yellow-200";
                            else if (step === "Accepted") style = "bg-green-50 text-green-700 border-green-100";
                            else if (step === "Enrolled") style = "bg-emerald-50 text-emerald-700 border-emerald-105 border-emerald-100";
                            else if (step === "Training In Progress") style = "bg-indigo-950/10 text-indigo-950 border-indigo-950/20";
                            else if (step === "Training Completed") style = "bg-purple-950/10 text-purple-950 border-purple-950/20";
                            else if (step === "Certified") style = "bg-amber-500/10 text-amber-700 border-amber-500/20";
                            else if (step === "Alumni") style = "bg-teal-50 text-teal-700 border-teal-100";
                            
                            return (
                              <span className={`border px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${style}`}>
                                {step}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            let text = "Pending";
                            let style = "bg-amber-50 text-amber-700 border-amber-100";
                            let dotColor = "bg-amber-500";
                            let pulse = false;

                            if (b.status === ProgramStatus.DRAFT) {
                              text = "Draft";
                              style = "bg-slate-50 text-slate-600 border-slate-200";
                              dotColor = "bg-slate-400";
                            } else if (b.status === ProgramStatus.UNDER_REVIEW || b.status === ProgramStatus.PENDING_PHOTO) {
                              text = "Under Review";
                              style = "bg-orange-50 text-orange-700 border-orange-200";
                              dotColor = "bg-orange-500";
                            } else if (b.status === ProgramStatus.ENROLLED || b.status === ProgramStatus.VERIFIED) {
                              text = "Enrolled";
                              style = "bg-blue-50 text-blue-700 border-blue-200";
                              dotColor = "bg-blue-500";
                              pulse = true;
                            } else if (b.status === ProgramStatus.IN_TRAINING) {
                              text = "In Training";
                              style = "bg-purple-50 text-purple-700 border-purple-200";
                              dotColor = "bg-purple-500";
                              pulse = true;
                            } else if (b.status === ProgramStatus.GRADUATED) {
                              text = "Graduated";
                              style = "bg-emerald-50 text-emerald-700 border-emerald-200";
                              dotColor = "bg-emerald-500";
                            } else if (b.status === ProgramStatus.ALUMNI) {
                              text = "Alumni";
                              style = "bg-teal-50 text-teal-700 border-teal-200";
                              dotColor = "bg-teal-500";
                            } else if (b.status === ProgramStatus.FLAGGED) {
                              text = "NIN Mismatch";
                              style = "bg-rose-50 text-rose-700 border-rose-200";
                              dotColor = "bg-rose-500";
                            }

                            return (
                              <span className={`${style} border font-semibold px-2 py-0.5 rounded text-[10px] tracking-wide inline-flex items-center gap-1`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pulse ? "animate-pulse" : ""}`}></span>
                                {text}
                              </span>
                            );
                          })()}
                        </td>
                      </>
                    )}

                    <td className="py-3 px-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 hover:text-indigo-600 inline-block" />
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. TABLE PAGINATION CONTROL BAR */}
        <div className="pt-3">
          <PaginationControl
            currentPage={currentPage}
            totalCount={filteredList.length}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={setItemsPerPage}
            idPrefix="beneficiary"
          />
        </div>

      </div>

      {/* 5. TVET FEDERAL RULE COMPLIANCE SUMMARY NOTE BANNER (4.png bottom guidelines) */}
      <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl shadow-xs text-xs font-mono text-slate-500 leading-relaxed">
        <div className="flex items-start gap-2 max-w-4xl text-left">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-700 uppercase mb-0.5 tracking-wider">Administrative Audit Notice</p>
            <p>
              According to Federal TVET Audit Mandates, all candidate profiles must carry a fully validated biometric stamp. Any record on Hold status will have disbursements temporarily delayed. Ensure NIN credentials are verified before photo capture initialization.
            </p>
          </div>
        </div>
      </div>

      {/* 6. FLOATING YELLOW ACTION BUTTON (4.png bottom-right corner FAB button) */}
      <div className="fixed bottom-6 right-6 z-30">
        <button 
          onClick={handleLaunchCreate}
          className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 shadow-2xl transition active:scale-[97%] cursor-pointer group"
          id="fab-register-candidate"
        >
          <UserPlus className="w-5 h-5 text-slate-950 group-hover:scale-110 transition" />
          <span className="text-xs">Register Candidate</span>
        </button>
      </div>

    </div>
  );
}
