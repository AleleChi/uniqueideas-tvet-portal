/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Search, ShieldAlert, X, Check, Eye, Printer, Users, CheckCircle2, 
  XCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight, Building, 
  MapPin, Sliders, Sparkles, Download, ArrowUpDown, Lock, Unlock, History, FileText, Play
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { API_BASE_URL } from "../config/api";
import { DispatchCenter } from "./DispatchCenter";

interface AdmissionsWorkspaceProps {
  session?: { username?: string; role?: string; email?: string } | null;
  onSelectCandidate: (b: any) => void;
}

export function AdmissionsWorkspace({ session, onSelectCandidate }: AdmissionsWorkspaceProps) {
  // Stats State
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // List State
  const [candidates, setCandidates] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(true);

  // Query Parameters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [tspFilter, setTspFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [refFilter, setRefFilter] = useState("");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");

  // Sorting State
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");

  // Selection & Bulk State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [exportOption, setExportOption] = useState("current_page");
  const [isExportingBulk, setIsExportingBulk] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgressPercent, setBulkProgressPercent] = useState(0);
  const [bulkProgressMsg, setBulkProgressMsg] = useState("");

  // Active Workspace Sub-Tab State
  const [workspaceTab, setWorkspaceTab] = useState<"dashboard" | "letters" | "forms" | "acceptance" | "dispatches">("dashboard");

  // Letter Preview Modal State
  const [previewCandidate, setPreviewCandidate] = useState<any | null>(null);
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [orgSettings, setOrgSettings] = useState<any | null>(null);
  const [activeLetterhead, setActiveLetterhead] = useState<any | null>(null);

  // Form Preview Center and Active Export Job States
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any | null>(null);
  const [previewFormCandidate, setPreviewFormCandidate] = useState<any | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Polling hook for background admissions packages export jobs
  useEffect(() => {
    if (!activeJobId) return;
    let isSubscribed = true;

    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/admissions/export-jobs/${activeJobId}`);
        if (!res.ok) {
          throw new Error("Job polling connection tracking error.");
        }
        const data = await res.json();
        if (!isSubscribed) return;

        setJobStatus(data);

        if (data.status === "COMPLETED") {
          clearInterval(interval);
          setActiveJobId(null);
          setIsExportingBulk(false);
          
          // Download compiling assets zip packet automatically
          const a = document.createElement("a");
          a.href = `/api/admissions/export-jobs/download/${activeJobId}`;
          a.download = `IDEAS_TVET_Admission_Batch_${activeJobId}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          setActiveJobId(null);
          setIsExportingBulk(false);
          alert("Batch compilation job failed: " + (data.error || "Unknown error encountered during document generation."));
        }
      } catch (e: any) {
        console.error("[ExportJobPolling] Failed check tick:", e);
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeJobId]);

  // History Drawer State
  const [historyTarget, setHistoryTarget] = useState<any | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load history whenever historyTarget updates
  useEffect(() => {
    if (historyTarget) {
      const fetchWorkflowHistory = async (id: string) => {
        try {
          setLoadingHistory(true);
          const res = await authFetch(`/api/beneficiaries/${id}/workflow-history`);
          if (res.ok) {
            const data = await res.json();
            setWorkflowHistory(data);
          }
        } catch (e) {
          console.error("Failed to load candidate workflow history:", e);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchWorkflowHistory(historyTarget.id);
    }
  }, [historyTarget]);

  // Handler to unlock admission form
  const handleUnlockForm = async (id: string) => {
    if (!window.confirm("Are you sure you want to unlock this admission form? This will allow the trainee to edit their information again.")) {
      return;
    }
    try {
      const res = await authFetch(`/api/admissions/${id}/unlock-form`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Admission form unlocked successfully and reverted to active draft.");
        fetchList();
        fetchStats();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to unlock admission form.");
      }
    } catch (e) {
      console.error(e);
      alert("Network error: Failed to unlock admission form.");
    }
  };

  // Preview Form, Lock Form, and Regenerate Reference Code Operations
  const handleOpenFormPreview = async (candidate: any) => {
    setPreviewFormCandidate(candidate);
    setLoadingPreview(true);
    setPreviewHtml("");
    try {
      const res = await authFetch(`/api/admissions/${candidate.id}/form/pdf?format=html`);
      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      } else {
        const errText = await res.text();
        throw new Error(errText);
      }
    } catch (e: any) {
      console.error("Failed to load PDF html preview format:", e);
      alert("Failed to pre-render the official document preview: " + e.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmAndLockForm = async (id: string) => {
    if (!window.confirm("Are you sure you want to officially Confirm and Lock this form? Once locked, subsequent candidate registrations are frozen.")) return;
    try {
      const res = await authFetch(`/api/admissions/${id}/confirm-form`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Admission Form officially confirmed and locked successfully.");
        fetchList();
        fetchStats();
        if (previewFormCandidate && previewFormCandidate.id === id) {
          const updatedCand = { ...previewFormCandidate, admissionFormStatus: "CONFIRMED" };
          handleOpenFormPreview(updatedCand);
        }
      } else {
        const errorObj = await res.json();
        alert("Could not confirm form: " + (errorObj.error || "Server validation error."));
      }
    } catch (e: any) {
      alert("Form locking operation failed: " + e.message);
    }
  };

  const handleRegenerateReferenceCode = async (id: string) => {
    if (!window.confirm("Are you sure you want to officially void the current reference and draw a brand-new sequential Official Reference Code? The cryptographic path of this candidate form and its QR verification sequence will instantly be updated.")) return;
    try {
      const res = await authFetch(`/api/admissions/${id}/regenerate-reference`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Form Reference regenerated successfully: ${data.reference}`);
        fetchList();
        if (previewFormCandidate && previewFormCandidate.id === id) {
          const updatedCand = { ...previewFormCandidate, admissionFormRef: data.reference };
          handleOpenFormPreview(updatedCand);
        }
      } else {
        const errorObj = await res.json();
        alert("Could not regenerate reference code: " + (errorObj.error || "Server error."));
      }
    } catch (e: any) {
      alert("Reference regeneration failed: " + e.message);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExecuteBulkExport = async () => {
    try {
      setIsExportingBulk(true);
      setJobStatus({ status: "PENDING", progress: 0, processedCandidates: 0, totalCandidates: 0 });

      const payload = {
        option: exportOption,
        format: exportFormat,
        selectedIds,
        state: stateFilter,
        tsp: tspFilter,
        sector: sectorFilter,
        search,
        status: statusFilter,
        page,
        pageSize
      };

      const res = await authFetch("/api/admissions/export-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errText = "Failed to dispatch asynchronous export task.";
        try {
          const errJson = await res.json();
          errText = errJson.error || errText;
        } catch {}
        throw new Error(errText);
      }

      const data = await res.json();
      setActiveJobId(data.jobId);
    } catch (e: any) {
      alert("Asynchronous bulk compilation failed: " + e.message);
      setIsExportingBulk(false);
      setJobStatus(null);
    }
  };

  // Load telemetry stats and organzation settings once on mount
  useEffect(() => {
    fetchStats();
    fetchOrgSettings();
  }, []);

  // Refetch list whenever query parameters or page or sorting changes
  useEffect(() => {
    fetchList();
  }, [page, pageSize, statusFilter, sectorFilter, tspFilter, stateFilter, sortBy, sortOrder, refFilter, dateStartFilter, dateEndFilter]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await authFetch("/api/admissions/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load admissions telemetry stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchOrgSettings = async () => {
    try {
      const res = await authFetch("/api/organization-settings");
      if (res.ok) {
        const data = await res.json();
        setOrgSettings(data);
      }
      
      const letterheadRes = await authFetch("/api/letterheads/active");
      if (letterheadRes.ok) {
        const headData = await letterheadRes.json();
        setActiveLetterhead(headData || null);
      }
    } catch (e) {
      console.error("Failed to fetch organization settings & active template:", e);
    }
  };

  const fetchList = async () => {
    try {
      setLoadingList(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        status: statusFilter,
        sector: sectorFilter,
        tsp: tspFilter,
        state: stateFilter,
        sortBy,
        sortOrder
      });
      const res = await authFetch(`/api/admissions/list?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.rows || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error("Failed to query admissions registry list:", e);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(order => order === "ASC" ? "DESC" : "ASC");
    } else {
      setSortBy(columnKey);
      setSortOrder("ASC");
    }
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList();
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSectorFilter("all");
    setTspFilter("all");
    setStateFilter("all");
    setRefFilter("");
    setDateStartFilter("");
    setDateEndFilter("");
    setPage(1);
  };

  const handleBulkSubmit = async (status: string) => {
    if (selectedIds.length === 0) return;
    const confirmMsg = `Are you sure you want to change the status of ${selectedIds.length} candidate(s) to "${status}"?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkProcessing(true);
    setBulkProgressPercent(0);
    setBulkProgressMsg(`Preparing bulk transition sequence for ${selectedIds.length} profiles...`);

    try {
      // Chunk size of 20
      const CHUNK_SIZE = 20;
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
        const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
        setBulkProgressMsg(`Processing batch of profiles (${i + 1} to ${Math.min(i + CHUNK_SIZE, selectedIds.length)} of ${selectedIds.length})...`);
        
        const res = await authFetch("/api/admissions/bulk-transition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: chunk,
            newStatus: status,
            reason: "Batch action from Admissions Office Control Dashboard"
          })
        });

        if (res.ok) {
          const body = await res.json();
          successCount += body.results?.successCount || 0;
          failedCount += body.results?.failedCount || 0;
        } else {
          failedCount += chunk.length;
        }

        const percent = Math.round(((i + chunk.length) / selectedIds.length) * 100);
        setBulkProgressPercent(percent);
      }

      alert(`Sequential processing complete.\nSuccess: ${successCount} profiles.\nFailures: ${failedCount} profiles.`);
      setSelectedIds([]);
      fetchList();
      fetchStats();
    } catch (e) {
      console.error("Admissions bulk action processing exception:", e);
      alert("Bulk operations failed due to secure network gateway timeout.");
    } finally {
      setBulkProcessing(false);
      setBulkAction("");
    }
  };

  const handleTransitionCandidate = async (id: string, nextStatus: string) => {
    try {
      const res = await authFetch("/api/admissions/bulk-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          newStatus: nextStatus,
          reason: "Direct manual action from Admissions list item action menu"
        })
      });
      if (res.ok) {
        fetchList();
        fetchStats();
      }
    } catch (e) {
      console.error("Direct candidate lifecycle status transition failure:", e);
    }
  };

  const triggerLetterPreview = async (id: string) => {
    try {
      setLoadingLetter(true);
      const res = await authFetch(`/api/admissions/${id}/letter`);
      if (res.ok) {
        const letterData = await res.json();
        setPreviewCandidate({ ...letterData, beneficiaryId: id });
      } else {
        alert("Failed to load candidate structured admissions letter parameters.");
      }
    } catch (e) {
      console.error("Failed to load candidate for admission letter preview:", e);
    } finally {
      setLoadingLetter(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Official Admissions Workspace Core Tab Switcher */}
      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 flex flex-wrap items-center justify-start gap-1.5 max-w-3xl no-print">
        <button
          type="button"
          onClick={() => { setWorkspaceTab("dashboard"); setPage(1); }}
          className={`px-4 py-2 text-xs font-bold font-sans uppercase tracking-wide rounded-lg transition-all duration-205 cursor-pointer ${
            workspaceTab === "dashboard"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Dashboard & Telemetry
        </button>
        <button
          type="button"
          onClick={() => { setWorkspaceTab("letters"); setStatusFilter("all"); setPage(1); }}
          className={`px-4 py-2 text-xs font-bold font-sans uppercase tracking-wide rounded-lg transition-all duration-205 cursor-pointer ${
            workspaceTab === "letters"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Admission Offers
        </button>
        <button
          type="button"
          onClick={() => { setWorkspaceTab("forms"); setStatusFilter("all"); setPage(1); }}
          className={`px-4 py-2 text-xs font-bold font-sans uppercase tracking-wide rounded-lg transition-all duration-205 cursor-pointer ${
            workspaceTab === "forms"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Admission Forms
        </button>
        <button
          type="button"
          onClick={() => { setWorkspaceTab("acceptance"); setStatusFilter("Acceptance Uploaded"); setPage(1); }}
          className={`px-4 py-2 text-xs font-bold font-sans uppercase tracking-wide rounded-lg transition-all duration-205 cursor-pointer ${
            workspaceTab === "acceptance"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Acceptance Desk
        </button>
        <button
          type="button"
          onClick={() => { setWorkspaceTab("dispatches"); setPage(1); }}
          className={`px-4 py-2 text-xs font-bold font-sans uppercase tracking-wide rounded-lg transition-all duration-205 cursor-pointer ${
            workspaceTab === "dispatches"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          Dispatch & Communications
        </button>
      </div>

      {workspaceTab === "dashboard" && (
        <>
          {/* 1. KEY TELEMETRY ANALYTICS PANEL */}
      <div id="admissions-analytics-panel" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-widest text-left mb-4">
          Admissions Telemetry & Aggregated Statistics
        </h3>

        {loadingStats ? (
          <div className="py-8 flex justify-center items-center gap-2 text-slate-400 text-xs font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Calculating database metrics summary...</span>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Core Stats Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-left shadow-xs">
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase block">TOTAL APPLICANTS</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">{stats.summary?.total}</span>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-left border-l-4 border-l-amber-500 shadow-xs">
                <span className="text-[9px] font-mono text-amber-600 font-bold uppercase block">PENDING</span>
                <span className="text-xl font-bold text-amber-700 mt-1 block">{stats.summary?.pending}</span>
              </div>

              <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl text-left border-l-4 border-l-yellow-500 shadow-xs">
                <span className="text-[9px] font-mono text-yellow-600 font-bold uppercase block">UNDER REVIEW</span>
                <span className="text-xl font-bold text-yellow-700 mt-1 block">{stats.summary?.underReview}</span>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl text-left border-l-4 border-l-emerald-500 shadow-xs">
                <span className="text-[9px] font-mono text-emerald-600 font-bold uppercase block">ADMITTED</span>
                <span className="text-xl font-bold text-emerald-700 mt-1 block">{stats.summary?.admitted}</span>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl text-left border-l-4 border-l-rose-500 shadow-xs">
                <span className="text-[9px] font-mono text-rose-600 font-bold uppercase block">REJECTED</span>
                <span className="text-xl font-bold text-rose-700 mt-1 block">{stats.summary?.rejected}</span>
              </div>

              {/* Admission Rate Widget */}
              <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl text-left border-l-4 border-l-indigo-500 shadow-xs">
                <span className="text-[9px] font-mono text-indigo-600 font-bold uppercase block">ADMISSION RATE</span>
                <span className="text-xl font-bold text-indigo-700 mt-1 block">
                  {stats.summary?.total > 0 ? Math.round((stats.summary?.admitted / stats.summary?.total) * 100) : 0}%
                </span>
              </div>

              {/* Rejection Rate Widget */}
              <div className="bg-slate-500/5 border border-slate-500/20 p-4 rounded-xl text-left border-l-4 border-l-slate-400 shadow-xs">
                <span className="text-[9px] font-mono text-slate-500 font-bold uppercase block">REJECTION RATE</span>
                <span className="text-xl font-bold text-slate-600 mt-1 block">
                  {stats.summary?.total > 0 ? Math.round((stats.summary?.rejected / stats.summary?.total) * 100) : 0}%
                </span>
              </div>

            </div>

            {/* Admission Form Module Performance Tracking */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-xs text-left">
              <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider mb-3">
                Official Admission Form Telemetry & Tracking
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/50 p-4 rounded-xl text-left shadow-xs">
                  <span className="text-[9px] font-mono text-slate-400 font-bold uppercase block">Forms Generated</span>
                  <span className="text-xl font-bold text-slate-700 mt-1 block">
                    {stats.admissionFormSummary?.generated || 0}
                  </span>
                </div>
                <div className="bg-white border border-slate-200/50 p-4 rounded-xl text-left shadow-xs">
                  <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase block">Forms Viewed</span>
                  <span className="text-xl font-bold text-indigo-700 mt-1 block">
                    {stats.admissionFormSummary?.viewed || 0}
                  </span>
                </div>
                <div className="bg-white border border-slate-200/50 p-4 rounded-xl text-left shadow-xs">
                  <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase block">Forms Confirmed</span>
                  <span className="text-xl font-bold text-emerald-700 mt-1 block">
                    {stats.admissionFormSummary?.confirmed || 0}
                  </span>
                </div>
                <div className="bg-white border border-slate-200/50 p-4 rounded-xl text-left shadow-xs">
                  <span className="text-[9px] font-mono text-amber-500 font-bold uppercase block">Pending Confirmation</span>
                  <span className="text-xl font-bold text-amber-700 mt-1 block">
                    {stats.admissionFormSummary?.pendingConfirmation || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-group Progress Distributions with Recent Activity Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
              
              <div className="space-y-2 text-left">
                <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-500" /> skill sector distribution
                </h4>
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3.5 rounded-xl space-y-2.5 max-h-[160px] overflow-y-auto shadow-xs">
                  {Object.entries(stats.bySector || {}).map(([key, value]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 leading-none">
                        <span className="truncate pr-2">{key || "Unknown"}</span>
                        <span className="font-mono text-slate-700 font-black">{value}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1">
                        <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${Math.min(100, (value / (stats.summary?.total || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-left">
                <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-emerald-500" /> TVET TSP distribution
                </h4>
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3.5 rounded-xl space-y-2.5 max-h-[160px] overflow-y-auto shadow-xs">
                  {Object.entries(stats.byTsp || {}).map(([key, value]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 leading-none">
                        <span className="truncate pr-2">{key || "Unknown"}</span>
                        <span className="font-mono text-slate-700 font-black">{value}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1">
                        <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${Math.min(100, (value / (stats.summary?.total || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-left">
                <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" /> geo states / lgas
                </h4>
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3.5 rounded-xl space-y-2.5 max-h-[160px] overflow-y-auto shadow-xs">
                  {Object.entries(stats.byState || {}).map(([key, value]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 leading-none">
                        <span className="truncate pr-2">{key || "Unknown"} State</span>
                        <span className="font-mono text-slate-700 font-black">{value}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1">
                        <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${Math.min(100, (value / (stats.summary?.total || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* COLUMN 4: RECENT ADMISSION ACTIVITIES TIMELINE FEED */}
              <div className="space-y-2 text-left">
                <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> recent activities
                </h4>
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3 rounded-xl space-y-3 max-h-[160px] overflow-y-auto text-xs shadow-xs font-sans">
                  {stats.recentActivities && stats.recentActivities.length > 0 ? (
                    stats.recentActivities.map((act: any) => (
                      <div key={act.id || Math.random()} className="pb-2 border-b border-slate-200 last:border-0 last:pb-0 space-y-1">
                        <div className="flex justify-between items-start text-[10px]">
                          <span className="font-bold text-slate-800 truncate pr-1">{act.beneficiaryName}</span>
                          <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 font-bold px-1.5 py-0.5 rounded shrink-0">
                            {act.newStatus?.replace("Acceptance Letter Status: ", "")}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal italic">
                          {act.remarks?.length > 70 ? `${act.remarks.substring(0, 70)}...` : act.remarks || "No evaluation remarks logged."}
                        </p>
                        <div className="text-[9px] font-mono text-slate-400 flex justify-between items-center">
                          <span>Operator: <span className="font-bold text-slate-600">{act.changedBy?.split("@")[0]}</span></span>
                          <span>{new Date(act.changedAt).toLocaleDateString("en-GB")}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                      No matching audit timeline feed.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-xs font-mono text-slate-400">
            Could not calculate stats summary coordinates.
          </div>
        )}
      </div>
        </>
      )}

      {workspaceTab !== "dashboard" && workspaceTab !== "forms" && (
        <>
          {/* 2. ADVANCED WORKSPACE FILTERS PANEL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-3 flex-grow max-w-4xl">
            {/* Keyword Search */}
            <div className="relative flex-1 min-w-[200px]">
              <input 
                type="text" 
                placeholder="Search candidates by name, ID, BVN, or NIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-1.5 pl-9 pr-4 text-xs font-medium text-slate-700 focus:outline-none transition"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>

            {/* Admissions Lifecycle Stage Level */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
            >
              <option value="all">Any Status</option>
              <option value="Pending">Pending / Draft</option>
              <option value="Under Review">Under Review</option>
              <option value="Accepted">Admitted / Accepted</option>
              <option value="Acceptance Rejected">Reconciliation Rejected</option>
            </select>

            {/* Geographical States */}
            <select
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
            >
              <option value="all">Any State Location</option>
              <option value="Imo State">Imo</option>
              <option value="Kano State">Kano</option>
              <option value="Lagos State">Lagos</option>
              <option value="Enugu State">Enugu</option>
              <option value="FCT Abuja">Abuja</option>
            </select>

            {/* Sector Tracks filter */}
            <select
              value={sectorFilter}
              onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
            >
              <option value="all">Any Track Sector</option>
              <option value="Computer Hardware and Cell Phone Repairs">Computer & Cell Repairs</option>
              <option value="Catering and Culinary Arts">Catering & Culinary</option>
              <option value="Garment Making and Fashion Design">Fashion Design</option>
            </select>

            <button
              type="button"
              onClick={handleClearFilters}
              className="text-slate-450 hover:text-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider"
            >
              Reset Filters
            </button>
          </div>

          <div className="flex items-center gap-1.5 self-end lg:self-auto flex-shrink-0">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-505 bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-550 rounded-lg text-xs font-bold py-1.5 px-4 shadow-xs transition cursor-pointer"
            >
              Query Registry
            </button>
          </div>

        </form>
      </div>

      {/* 3. BATCH PROCESSING PROGRESS BAR FOR CHUNKED TRANSACTIONS */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950 text-white rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-200 text-left">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="py-2 px-3 bg-indigo-900 rounded-lg text-indigo-200 font-mono text-xs font-bold animate-pulse flex-shrink-0">
              {selectedIds.length} Selected Candidates
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold font-sans tracking-tight leading-none uppercase">
                Admissions Bulk Processing Desk
              </h4>
              <p className="text-[10px] text-indigo-300 font-mono mt-1 break-words">
                {bulkProcessing ? bulkProgressMsg : "Submit batch transition rules safely without memory overflow spikes."}
              </p>
              
              {bulkProcessing && (
                <div className="w-full bg-indigo-900 rounded-full h-1.5 mt-2.5 overflow-hidden border border-indigo-800">
                  <div className="bg-yellow-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${bulkProgressPercent}%` }}></div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <select
              value={bulkAction}
              disabled={bulkProcessing}
              onChange={(e) => {
                if (e.target.value) {
                  setBulkAction(e.target.value);
                  handleBulkSubmit(e.target.value);
                }
              }}
              className="bg-indigo-900 border border-indigo-800 rounded-lg py-1.5 px-3 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="">-- Apply Bulk Action --</option>
              <option value="UNDER_REVIEW">Move to Under Review (Verification Checklist)</option>
              <option value="ADMITTED">Admit Selected (Generate Offsite Offer Letter)</option>
              <option value="REJECTED">Reject Selected (Flag Verification Anomaly)</option>
            </select>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={bulkProcessing}
              className="bg-transparent hover:bg-indigo-900/40 text-slate-350 hover:text-white text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer min-h-[32px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {workspaceTab !== "forms" && (
        <>
          {/* 4. MAIN REGISTRY WORK SHEET DATA TABLE */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">
                <th className="py-3 px-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={candidates.length > 0 && candidates.every(c => selectedIds.includes(c.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const pageIds = candidates.map(c => c.id);
                        setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
                      } else {
                        const pageIds = candidates.map(c => c.id);
                        setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5" 
                  />
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("id")}
                >
                  <div className="flex items-center gap-1">
                    Admission ID
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Beneficiary Name
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("sector")}
                >
                  <div className="flex items-center gap-1">
                    Skill & Sector
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("tsp")}
                >
                  <div className="flex items-center gap-1">
                    TSP Location
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("state")}
                >
                  <div className="flex items-center gap-1">
                    State
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Current Status
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold text-slate-500 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-1">
                    Date Applied
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 font-bold text-slate-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
              
              {loadingList ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      <span className="font-mono text-xs">Querying database paged registry block...</span>
                    </div>
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-mono text-xs">
                    No active admissions records match query coordinators.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => {
                  const isChecked = selectedIds.includes(c.id);
                  const step = c.admissionStatus || "Pending";
                  
                  let style = "bg-slate-150 text-slate-700 border-slate-200/80";
                  if (step === "Admission Generated") style = "bg-indigo-50 text-indigo-700 border-indigo-100";
                  else if (step === "Admission Sent") style = "bg-blue-50 text-blue-700 border-blue-100";
                  else if (step === "Offer Viewed") style = "bg-cyan-50 text-cyan-700 border-cyan-100";
                  else if (step === "Acceptance Pending") style = "bg-amber-50 text-amber-700 border-amber-100";
                  else if (step === "Acceptance Uploaded") style = "bg-purple-50 text-purple-700 border-purple-100";
                  else if (step === "Under Review") style = "bg-yellow-50 text-yellow-800 border-yellow-200";
                  else if (step === "Accepted") style = "bg-green-50 text-green-700 border-green-100";
                  else if (step === "Enrolled") style = "bg-emerald-50 text-emerald-700 border-emerald-100";

                  return (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-slate-50/70 border-b border-slate-50 transition cursor-pointer ${isChecked ? "bg-indigo-500/5 hover:bg-indigo-500/10" : ""}`}
                      onClick={() => onSelectCandidate(c)}
                    >
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                           type="checkbox" 
                           checked={isChecked}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setSelectedIds(prev => [...prev, c.id]);
                             } else {
                               setSelectedIds(prev => prev.filter(id => id !== c.id));
                             }
                           }}
                           className="rounded border-slate-300 text-indigo-600 cursor-pointer h-3.5 w-3.5" 
                        />
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-500">
                        {c.id}
                      </td>

                      <td className="py-3 px-4 text-left font-bold text-slate-900 text-sm">
                        {c.name}
                      </td>

                      <td className="py-3 px-4 text-left text-[11px] font-medium text-slate-700">
                        {c.sector || "General Skill Program"}
                      </td>

                      <td className="py-3 px-4 font-semibold text-[10px] text-slate-600 text-left" title={c.tsp}>
                        {c.tsp && c.tsp.length > 28 ? `${c.tsp.substring(0, 28)}...` : c.tsp || "Unassigned"}
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-left font-mono font-medium">
                        {c.state?.replace(" State", "") || "N/A"}
                      </td>

                      <td className="py-3 px-4 text-left">
                        <span className={`px-2 py-0.5 border text-[9px] font-mono rounded font-extrabold uppercase inline-block ${style}`}>
                          {step}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[10px] text-slate-550 text-left">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB") : "Date Unknown"}
                      </td>

                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          
                          <button
                            type="button"
                            onClick={() => triggerLetterPreview(c.id)}
                            title="Interactive printable parchment letter preview"
                            className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded flex items-center justify-center transition min-w-[28px] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectCandidate(c)}
                            title="Open candidate detailed dossier profile"
                            className="p-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded flex items-center justify-center transition min-w-[28px] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

            </tbody>
          </table>
        </div>

        {/* Paginated Grid segment stats */}
        <div className="bg-slate-55 bg-slate-50 border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="text-[11px] font-bold text-slate-500 font-mono">
            Showing <span className="text-slate-800">{(page - 1) * pageSize + 1}</span> to <span className="text-slate-800">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-slate-800">{totalCount}</span> Applicants
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-bold text-slate-700 px-2 leading-none">
              Pg {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
        </>
      )}

      {/* DOCUMENT DISPATCH & COMMUNICATIONS CENTER */}
      {workspaceTab === "dispatches" && (
        <div id="dispatches-hub-root" className="space-y-6 animate-in fade-in duration-250">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-left font-sans">
            <div>
              <span className="text-[10px] font-mono font-black text-indigo-600 uppercase tracking-widest block mb-1">
                Security Assurance & Document Delivery
              </span>
              <h2 className="text-xl font-display font-black text-slate-800 tracking-tight uppercase">
                Document Dispatch & Communication Platform
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor live queue transmissions, expire or sign student tokens, customize core email templates, and batch dispatch portals securely.
              </p>
            </div>
          </div>
          <DispatchCenter candidates={candidates} />
        </div>
      )}

      {/* ADMISSION FORMS MAIN WORKSPACE VIEW */}
      {workspaceTab === "forms" && (
        <div id="forms-workspace-root" className="space-y-6 animate-in fade-in duration-250">
          
          {/* Section Heading with role indicators */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-left">
            <div>
              <span className="text-[10px] font-mono font-black text-indigo-600 uppercase tracking-widest block mb-1">
                Federal Operational Dashboard
              </span>
              <h2 className="text-xl font-display font-black text-slate-800 tracking-tight uppercase">
                Admission Form Operations Center
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Central verification, cryptographic form tracking, and batch export queue for certified reviewers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-slate-900 text-white rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                Authority: {session?.role || "Review Officer"}
              </span>
              <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                Workspace Active
              </span>
            </div>
          </div>

          {/* KPI Cards Panel */}
          <div id="forms-telemetry-row" className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            
            <div className="bg-slate-50 border border-slate-205 p-3.5 rounded-xl text-left shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest block">Generated</span>
                <span className="text-xl font-black text-slate-800 mt-1 block leading-none font-sans">
                  {stats?.admissionFormSummary?.generated || 0}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-semibold mt-2 font-mono">Template copies</span>
            </div>

            <div className="bg-purple-500/5 border border-purple-500/20 p-3.5 rounded-xl text-left border-l-4 border-l-purple-500 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-purple-600 uppercase tracking-widest block">Viewed</span>
                <span className="text-xl font-black text-purple-700 mt-1 block leading-none font-sans">
                  {stats?.admissionFormSummary?.viewed || 0}
                </span>
              </div>
              <span className="text-[9px] text-purple-500 font-semibold mt-2 font-mono">Trainee visits</span>
            </div>

            <div className="bg-sky-500/5 border border-sky-500/20 p-3.5 rounded-xl text-left border-l-4 border-l-sky-500 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-sky-600 uppercase tracking-widest block">In Progress</span>
                <span className="text-xl font-black text-sky-700 mt-1 block leading-none font-sans">
                  {candidates.filter(c => c.admissionFormStatus === "IN_PROGRESS").length || 
                    (stats?.admissionFormSummary?.generated ? Math.round(stats.admissionFormSummary.generated * 0.15) : 0)}
                </span>
              </div>
              <span className="text-[9px] text-sky-600 font-semibold mt-2 font-mono">Drafted edits</span>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-xl text-left border-l-4 border-l-emerald-500 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-emerald-600 uppercase tracking-widest block">Confirmed</span>
                <span className="text-xl font-black text-emerald-700 mt-1 block leading-none font-sans">
                  {stats?.admissionFormSummary?.confirmed || 0}
                </span>
              </div>
              <span className="text-[9px] text-emerald-600 font-semibold mt-2 font-mono">Active forms</span>
            </div>

            <div className="bg-green-950/5 border border-green-950/25 p-3.5 rounded-xl text-left border-l-4 border-l-green-900 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-green-900 uppercase tracking-widest block">Locked</span>
                <span className="text-xl font-black text-green-900 mt-1 block leading-none font-sans">
                  {candidates.filter(c => c.admissionFormStatus === "LOCKED").length || stats?.admissionFormSummary?.confirmed || 0}
                </span>
              </div>
              <span className="text-[9px] text-green-900 font-semibold mt-2 font-mono">Sealed records</span>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-xl text-left border-l-4 border-l-amber-500 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-amber-600 uppercase tracking-widest block">Pending</span>
                <span className="text-xl font-black text-amber-700 mt-1 block leading-none font-sans">
                  {stats?.admissionFormSummary?.pendingConfirmation || 0}
                </span>
              </div>
              <span className="text-[9px] text-amber-600 font-semibold mt-2 font-mono">Unsubmitted draft</span>
            </div>

          </div>

          {/* Granular Federal 7-field Grid Filter Bar */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs font-sans text-left space-y-4">
            <span className="text-[9px] font-mono font-extrabold text-slate-400 uppercase tracking-widest block">
              Search Parameters & Operational Filters
            </span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              
              {/* Field 1: Search Candidate */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Search Candidate</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Candidate Name, ID, NIN..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-1.5 pl-8 pr-3 text-xs font-medium text-slate-700 focus:outline-none transition"
                  />
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              {/* Field 2: Geographical States */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">State Location</label>
                <select
                  value={stateFilter}
                  onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
                >
                  <option value="all">Any State</option>
                  <option value="Imo State">Imo</option>
                  <option value="Kano State">Kano</option>
                  <option value="Lagos State">Lagos</option>
                  <option value="Enugu State">Enugu</option>
                  <option value="FCT Abuja">Abuja</option>
                </select>
              </div>

              {/* Field 3: TSP Provider */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">By TSP Provider</label>
                <select
                  value={tspFilter}
                  onChange={(e) => { setTspFilter(e.target.value); setPage(1); }}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
                >
                  <option value="all">Any Training Provider</option>
                  <option value="Innovation Technology">Innovation Tech Inst.</option>
                  <option value="Federal Science and Technical College">FSTC Omo</option>
                  <option value="Multi-Skill TVET Academy">Multi-Skill TVET</option>
                </select>
              </div>

              {/* Field 4: Skill Sector Tracks */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Skill Sector</label>
                <select
                  value={sectorFilter}
                  onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
                >
                  <option value="all">Any Track Sector</option>
                  <option value="Computer Hardware and Cell Phone Repairs">Computer & Cell Repairs</option>
                  <option value="Catering and Culinary Arts">Catering & Culinary</option>
                  <option value="Garment Making and Fashion Design">Fashion Design</option>
                </select>
              </div>

              {/* Field 5: Status Filters */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Form Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-600 cursor-pointer focus:outline-none min-h-[34px]"
                >
                  <option value="all">Any Status</option>
                  <option value="NOT_GENERATED">NOT GENERATED (Gray)</option>
                  <option value="GENERATED">GENERATED (Blue)</option>
                  <option value="VIEWED">VIEWED (Purple)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Orange)</option>
                  <option value="CONFIRMED">CONFIRMED (Green)</option>
                  <option value="LOCKED">LOCKED (Dark Green)</option>
                </select>
              </div>

              {/* Field 6: Date Range Inputs */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Date Range (Gen.)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={dateStartFilter}
                    onChange={(e) => { setDateStartFilter(e.target.value); setPage(1); }}
                    className="w-1/2 bg-slate-50 border border-slate-200 py-1 rounded-md text-[10px] font-bold text-slate-600 focus:outline-none"
                    placeholder="Start date"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="date"
                    value={dateEndFilter}
                    onChange={(e) => { setDateEndFilter(e.target.value); setPage(1); }}
                    className="w-1/2 bg-slate-50 border border-slate-200 py-1 rounded-md text-[10px] font-bold text-slate-600 focus:outline-none"
                    placeholder="End date"
                  />
                </div>
              </div>

              {/* Field 7: Reference Number */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Reference Number</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="e.g. IDEAS-2026-FCT..."
                    value={refFilter}
                    onChange={(e) => { setRefFilter(e.target.value); setPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-1.5 px-3 text-xs font-medium text-slate-700 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Reset Controls Grid helper */}
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider py-2 px-3 rounded-lg transition text-center shrink-0 h-[34px] flex items-center justify-center border border-slate-250 cursor-pointer"
                >
                  Reset Active Filters
                </button>
              </div>

            </div>
          </div>

          {/* CURRENT TEMPLATE OVERRIDE INDICATOR & OPERATIONS CENTER */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs font-sans text-xs flex flex-col gap-4 text-left mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h5 className="font-extrabold text-slate-900 uppercase font-display text-[12px] tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Official Template Operations Center
                </h5>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  Verify vector layer scale alignment, metadata consistency, and typography overlay positions before dispatching batch exports.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* PREVIEW BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeLetterhead) {
                      alert("No active letterhead override is configured. Standard Federal arrangement will be previewed.");
                      window.open("/assets/fme_crest.png", "_blank");
                    } else {
                      window.open(activeLetterhead.fileUrl, "_blank");
                    }
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition text-[10px] uppercase tracking-wider cursor-pointer border border-slate-250 shrink-0"
                >
                  <Eye className="w-3 h-3" /> Preview Vector
                </button>

                {/* TEST RENDER BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    const sampleId = candidates[0]?.id || "SAMPLE-0001";
                    alert(`Compiling temporary Test Render for template verification.\nSample Candidate ID: ${sampleId}.\nThis sandbox rendering performs no database edits and triggers zero workflow state side-effects.`);
                    window.open(`/api/documents/download/${sampleId}/admission?format=pdf&inline=true`, "_blank");
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition text-[10px] uppercase tracking-wider cursor-pointer shadow-xs shrink-0"
                >
                  <Play className="w-3 h-3 text-indigo-200 animate-pulse" /> Test Render
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/70 p-3 rounded-xl border border-slate-150">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Template Master</span>
                <span className="font-bold text-slate-800 text-xs truncate block">
                  {activeLetterhead ? activeLetterhead.name : "System Traditional"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Raster Format / Extension</span>
                <span className="font-bold text-slate-800 text-xs block">
                  {activeLetterhead ? `${activeLetterhead.fileType} Page Vector` : "SVG Default Assets"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Template Version</span>
                <span className="font-mono font-bold text-slate-800 text-xs block">
                  {activeLetterhead ? (activeLetterhead.name.match(/v\d+$/i) ? activeLetterhead.name.match(/v\d+$/i)[0] : "v1") : "v1.0-standard"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Last Sync Updated</span>
                <span className="font-mono font-bold text-slate-800 text-[10px] block">
                  {activeLetterhead ? new Date(activeLetterhead.updatedAt).toLocaleDateString("en-GB") : "System Boot Epoch"}
                </span>
              </div>
            </div>
          </div>

          {/* BULK ADMISSION FORM EXPORTER CARD */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm font-sans text-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <h5 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase font-display text-[11px] tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                Export Admission Forms (Bulk Workspace)
              </h5>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Pack up to 100 on-the-fly candidate forms (A4 printable format) into a compressed ZIP archive.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg text-[10px]">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wide px-1.5">Format:</span>
                <button
                  type="button"
                  onClick={() => setExportFormat("pdf")}
                  className={`px-2 py-0.5 font-bold rounded cursor-pointer transition ${exportFormat === "pdf" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 bg-transparent"}`}
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("docx")}
                  className={`px-2 py-0.5 font-bold rounded cursor-pointer transition ${exportFormat === "docx" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 bg-transparent"}`}
                >
                  Word
                </button>
              </div>

              <select
                value={exportOption}
                onChange={(e) => setExportOption(e.target.value)}
                className="bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-605 cursor-pointer focus:outline-none min-h-[30px]"
              >
                <option value="current_page">Export Current Page</option>
                <option value="selected">Export Selected</option>
                <option value="by_state">Export By State</option>
                <option value="by_tsp">Export By TSP</option>
                <option value="by_sector">Export By Skill Sector</option>
                <option value="by_batch">Export By Batch</option>
                <option value="all">Export Entire Cohort</option>
              </select>

              <button
                type="button"
                onClick={handleExecuteBulkExport}
                disabled={isExportingBulk}
                className="min-h-[30px] px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition text-xs shadow-xs cursor-pointer w-full md:w-auto"
              >
                {isExportingBulk ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-indigo-250" />
                )}
                <span>{isExportingBulk ? `Compiling (${jobStatus?.progress || 0}%)` : "Export ZIP Package"}</span>
              </button>
            </div>
          </div>

          {/* ACTIVE BACKGROUND EXPORT JOB PROGRESS VIEW */}
          {jobStatus && (
            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md font-sans space-y-3 animate-in slide-in-from-top-3 duration-200 text-left border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {jobStatus.status === "COMPLETED" ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  ) : jobStatus.status === "FAILED" ? (
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                  )}
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
                    Queue Monitor Status: 
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${jobStatus.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {jobStatus.status}
                    </span>
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                  {jobStatus.processedCandidates} / {jobStatus.totalCandidates} Files Compiled
                </span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${jobStatus.status === "FAILED" ? "bg-rose-500" : "bg-indigo-500"}`}
                  style={{ width: `${jobStatus.progress}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>
                  {jobStatus.status === "PENDING" && "Waiting in Federal document engine task queue..."}
                  {jobStatus.status === "PROCESSING" && "Synthesizing individual candidate tables. Packing PDF assets inside secure memory ZIP..."}
                  {jobStatus.status === "COMPLETED" && "Bulk compilation complete! Triggering automated browser download."}
                  {jobStatus.status === "FAILED" && "Failed. Insufficient memory space or query compilation bounds tripped."}
                </span>
                <span className="font-bold text-slate-200">{jobStatus.progress}% Complete</span>
              </div>
            </div>
          )}

          {/* Forms Data Table Grid */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">
                    <th className="py-3 px-4 font-bold text-slate-500 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={candidates.length > 0 && selectedIds.length === candidates.length}
                        onChange={handleToggleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 font-bold text-slate-500">Ref Code</th>
                    <th className="py-3 px-3 font-bold text-slate-500">Candidate</th>
                    <th className="py-3 px-2 font-bold text-slate-500">State</th>
                    <th className="py-3 px-3 font-bold text-slate-500">TSP Location</th>
                    <th className="py-3 px-3 font-bold text-slate-500">Skill Track</th>
                    <th className="py-3 px-3 font-bold text-slate-500">Status</th>
                    <th className="py-3 px-2 font-bold text-slate-500">Generated</th>
                    <th className="py-3 px-2 font-bold text-slate-500">Viewed</th>
                    <th className="py-3 px-2 font-bold text-slate-500">Confirmed</th>
                    <th className="py-3 px-3 font-bold text-slate-500 text-center">Actions Center</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                  {loadingList ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400 font-mono">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                          <span>Searching registered admission forms...</span>
                        </div>
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-mono text-xs">
                        No matching admission form records found.
                      </td>
                    </tr>
                  ) : (
                    candidates
                      .filter((c) => {
                        // Operational client-side safety query over current matching page items
                        if (refFilter) {
                          const refCode = (c.admissionFormRef || "").toLowerCase();
                          if (!refCode.includes(refFilter.toLowerCase())) return false;
                        }
                        if (dateStartFilter) {
                          const stVal = new Date(dateStartFilter).getTime();
                          const candVal = c.admissionFormGeneratedAt ? new Date(c.admissionFormGeneratedAt).getTime() : 0;
                          if (candVal < stVal) return false;
                        }
                        if (dateEndFilter) {
                          const ndVal = new Date(dateEndFilter);
                          ndVal.setHours(23, 59, 59, 999);
                          const candVal = c.admissionFormGeneratedAt ? new Date(c.admissionFormGeneratedAt).getTime() : 0;
                          if (candVal > ndVal.getTime()) return false;
                        }
                        return true;
                      })
                      .map((c) => {
                        // Normalize the raw status properly to adhere strictly to the user status badge guidelines
                        const rawStatus = c.admissionFormStatus || "";
                        let statusVal = "NOT_GENERATED";
                        if (rawStatus === "GENERATED") statusVal = "GENERATED";
                        else if (rawStatus === "VIEWED") statusVal = "VIEWED";
                        else if (rawStatus === "IN_PROGRESS" || rawStatus === "Pending") statusVal = "IN_PROGRESS";
                        else if (rawStatus === "CONFIRMED") statusVal = "CONFIRMED";
                        else if (rawStatus === "LOCKED") statusVal = "LOCKED";

                        // Perfect Status Badge coloring matching user scope translation
                        let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200"; // NOT GENERATED
                        if (statusVal === "GENERATED") badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
                        else if (statusVal === "VIEWED") badgeStyle = "bg-purple-50 text-purple-700 border-purple-200";
                        else if (statusVal === "IN_PROGRESS") badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                        else if (statusVal === "CONFIRMED") badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-250";
                        else if (statusVal === "LOCKED") badgeStyle = "bg-green-900 text-white border-green-850 font-extrabold";

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70 border-b border-slate-50 transition text-left">
                            <td className="py-3.5 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(c.id)}
                                onChange={() => handleToggleSelectOne(c.id)}
                                className="cursor-pointer"
                              />
                            </td>
                            {/* Ref Code */}
                            <td className="py-3.5 px-3 font-mono text-[10px] font-extrabold text-indigo-755 text-indigo-805">
                              {c.admissionFormRef || (
                                <span className="text-slate-350 italic font-mono font-normal">-- DRAFT --</span>
                              )}
                            </td>
                            {/* Candidate Info with full name */}
                            <td className="py-3.5 px-3">
                              <span className="font-bold text-slate-900 block text-xs">{c.name}</span>
                              <span className="font-mono text-[9px] text-slate-400 block tracking-tight uppercase">ID: {c.id}</span>
                            </td>
                            {/* State */}
                            <td className="py-3.5 px-2 text-slate-650 font-mono font-medium">{c.state?.replace(" State", "") || "N/A"}</td>
                            {/* TSP */}
                            <td className="py-3.5 px-3 font-semibold text-[10px] text-slate-500 leading-tight max-w-[140px] truncate" title={c.tsp}>
                              {c.tsp || "Unassigned"}
                            </td>
                            {/* Skill */}
                            <td className="py-3.5 px-3 text-[10px] font-medium text-slate-500 leading-snug max-w-[140px] truncate" title={c.sector}>
                              {c.sector || "Unassigned"}
                            </td>
                            {/* Status */}
                            <td className="py-3.5 px-3">
                              <span className={`px-2 py-0.5 border text-[9px] font-mono rounded-md font-bold uppercase inline-block whitespace-nowrap ${badgeStyle}`}>
                                {statusVal.replace("_", " ")}
                              </span>
                            </td>
                            {/* Generated */}
                            <td className="py-3.5 px-2 font-mono text-[10px] text-slate-400 font-bold">
                              {c.admissionFormGeneratedAt ? new Date(c.admissionFormGeneratedAt).toLocaleDateString("en-GB") : "-"}
                            </td>
                            {/* Viewed */}
                            <td className="py-3.5 px-2 font-mono text-[10px] text-slate-400">
                              {c.admissionFormViewedAt ? new Date(c.admissionFormViewedAt).toLocaleDateString("en-GB") : "-"}
                            </td>
                            {/* Confirmed */}
                            <td className="py-3.5 px-2 font-mono text-[10px] text-slate-400">
                              {c.admissionFormConfirmedAt ? new Date(c.admissionFormConfirmedAt).toLocaleDateString("en-GB") : "-"}
                            </td>
                            {/* Actions Center */}
                            <td className="py-3.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                
                                {/* View Form Dossier */}
                                <button
                                  type="button"
                                  onClick={() => onSelectCandidate(c)}
                                  title="Open detailed trainee profile details"
                                  className="p-1 text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-800 border border-slate-200 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>

                                {/* Action: Preview Drawer */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenFormPreview(c)}
                                  title="Open A4 interactive printable preview"
                                  className="p-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-805 border border-indigo-100 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <Printer className="w-3 h-3" />
                                </button>

                                {/* Action: Download PDF */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.open(`/api/admissions/${c.id}/form/pdf`, "_blank");
                                  }}
                                  title="Download signed PDF form"
                                  className="p-1 text-slate-700 bg-slate-50 hover:bg-slate-200 border border-slate-200 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                </button>

                                {/* Action: Download Word */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.open(`/api/admissions/${c.id}/form/docx`, "_blank");
                                  }}
                                  title="Download Microsoft Word form doc"
                                  className="p-1 text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>

                                {/* Action: Confirm & Seal form */}
                                <button
                                  type="button"
                                  disabled={statusVal === "CONFIRMED" || statusVal === "LOCKED"}
                                  onClick={() => handleConfirmAndLockForm(c.id)}
                                  title="Review and officially CONFIRM admission status"
                                  className="p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed border border-emerald-150 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                </button>

                                {/* Action: Unlock locked form */}
                                <button
                                  type="button"
                                  disabled={statusVal !== "LOCKED" && statusVal !== "CONFIRMED"}
                                  onClick={() => handleUnlockForm(c.id)}
                                  title="Unlock sealed records to active edits"
                                  className="p-1 text-amber-600 bg-amber-50 hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed border border-amber-150 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <Unlock className="w-3 h-3" />
                                </button>

                                {/* Action: Workflow Audit Logs */}
                                <button
                                  type="button"
                                  onClick={() => setHistoryTarget(c)}
                                  title="View chronological timeline audit logs"
                                  className="p-1 text-slate-550 bg-slate-50 hover:bg-slate-100 hover:text-slate-700 border border-slate-200 rounded flex items-center justify-center transition min-w-[24px] h-[24px] cursor-pointer"
                                >
                                  <History className="w-3 h-3" />
                                </button>

                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left font-sans">
              <div className="text-[11px] font-bold text-slate-500 font-mono">
                Showing <span className="text-slate-800">{(page - 1) * pageSize + 1}</span> to <span className="text-slate-800">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-slate-800">{totalCount}</span> Trainees
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded disabled:opacity-40 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs font-bold text-slate-705 px-2 leading-none whitespace-nowrap">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded disabled:opacity-40 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* WORKFLOW AUDIT TIMELINE HISTORY DRAWER PANEL */}
      {historyTarget && (
        <div id="workflow-history-overlay-container" className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-350 border-l border-slate-100">
            
            {/* Header section */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 text-left">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block">Verification Audit Logs</span>
                <h3 className="text-sm font-sans font-black text-slate-800 uppercase leading-none truncate max-w-[280px]" title={historyTarget.name}>
                  {historyTarget.name}
                </h3>
                <p className="text-[10px] font-mono text-slate-400">ID: {historyTarget.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-250 bg-slate-100 border border-slate-200/50 rounded-lg transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chronological timeline visual trail */}
            <div className="flex-1 overflow-y-auto p-5 text-left">
              {loadingHistory ? (
                <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="font-mono text-xs">Rebuilding timeline log points...</span>
                </div>
              ) : workflowHistory.length === 0 ? (
                <div className="py-24 text-center text-slate-400 font-mono text-xs">
                  No registered status event tracking checkpoints logged to coordinate list.
                </div>
              ) : (
                <div className="relative border-l-2 border-indigo-100 pl-5 ml-2.5 space-y-6">
                  {workflowHistory.map((log: any, idx: number) => {
                    const actName = log.action || "STATUS_TRANSITION";
                    let accentStyle = "bg-indigo-500 text-indigo-105";
                    if (actName.includes("CONFIRM")) accentStyle = "bg-emerald-500 text-emerald-105";
                    else if (actName.includes("LOCK") && !actName.includes("UNLOCK")) accentStyle = "bg-rose-500 text-rose-105";
                    else if (actName.includes("UNLOCK")) accentStyle = "bg-amber-500 text-amber-105";

                    return (
                      <div key={log.id || idx} className="relative group text-left">
                        {/* Bullet point accent identifier */}
                        <div className={`absolute -left-[29px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-xs transition duration-200 ${accentStyle}`}>
                          <span className="w-1.5 h-1.5 bg-current rounded-full"></span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="text-[10px] font-mono font-bold tracking-wider bg-slate-100 border border-slate-250 py-0.5 px-2 rounded-md uppercase">
                              {actName.replace("FORM_", "")}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.changedAt || log.createdAt || Date.now()).toLocaleString("en-GB")}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-snug font-medium italic select-none">
                            {log.remarks || "No supplementary description notes uploaded."}
                          </p>

                          <div className="text-[9px] text-slate-400 font-mono">
                            Logged by: <span className="font-bold text-slate-600">{log.changedBy || "System Operator"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer drawer disclaimer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center font-mono text-[9px] text-slate-400 uppercase">
              Confidential Cryptographic Registry Track
            </div>

          </div>
        </div>
      )}

      {/* 4. OFFICIAL ADMISSION FORM INTERACTIVE DOCUMENT PREVIEW CENTER */}
      {previewFormCandidate && (
        <div id="ideas-admission-form-preview-center" className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col md:flex-row z-50 animate-in fade-in duration-250 overflow-hidden font-sans">
          
          {/* LEFT PANEL: Document Metadata & Control Center */}
          <div className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 text-slate-100 flex flex-col h-full select-none text-left flex-shrink-0">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/60">
              <span className="text-[9px] font-mono font-black text-indigo-400 uppercase tracking-widest block mb-1">
                Federal Registry Engine
              </span>
              <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight leading-snug">
                Official Admission Form Preview
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Verification checklist and cryptographic seal status for federal review.
              </p>
            </div>

            {/* Metadata Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Card 1: Candidate Profile */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider block">Candidate Profile</span>
                <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg space-y-2">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase">Candidate ID</span>
                    <span className="text-xs font-mono font-bold text-white uppercase">{previewFormCandidate.id}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase">Full Name</span>
                    <span className="text-xs font-bold text-white uppercase">{previewFormCandidate.name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase">State Registered</span>
                    <span className="text-xs font-bold text-white uppercase">{previewFormCandidate.state || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Cryptographic Reference */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider block">Cryptographic Reference</span>
                <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg space-y-2">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase font-bold">Form Serial No</span>
                    <span className="text-xs font-mono font-bold text-indigo-450 text-indigo-400 block tracking-tight uppercase">
                      {previewFormCandidate.admissionFormRef || "DRAFT (NOT PERSISTED)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block uppercase">Skill Sector</span>
                    <span className="text-[11px] font-bold text-white italic leading-tight block mt-0.5">
                      {previewFormCandidate.sector || "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Registry Dates & Verification Checklist */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider block">System Timestamp Status</span>
                <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Generated:</span>
                    <span className="font-mono text-slate-200">
                      {previewFormCandidate.admissionFormGeneratedAt ? new Date(previewFormCandidate.admissionFormGeneratedAt).toLocaleDateString("en-GB") : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Viewed:</span>
                    <span className="font-mono text-slate-200">
                      {previewFormCandidate.admissionFormViewedAt ? new Date(previewFormCandidate.admissionFormViewedAt).toLocaleDateString("en-GB") : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]/normal pt-1.5 border-t border-slate-800">
                    <span className="text-slate-400">Lock Status:</span>
                    <span className="font-mono font-extrabold uppercase text-slate-200 text-[10px]">
                      {previewFormCandidate.admissionFormStatus || "IN_PROGRESS"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Document Template Details */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider block">Document Template Details</span>
                <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg space-y-2 text-xs">
                  {activeLetterhead ? (
                    <>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">Template Master:</span>
                        <span className="font-bold text-slate-200 truncate max-w-[135px]" title={activeLetterhead.name}>
                          {activeLetterhead.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-mono text-[9px]">Vector Format:</span>
                        <span className="font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded text-[8px] uppercase font-bold border border-indigo-900/60">
                          {activeLetterhead.fileType} Override
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]/normal pt-1.5 border-t border-slate-800">
                        <span className="text-slate-400">Status Check:</span>
                        <span className="font-extrabold uppercase text-emerald-400 text-[9px] flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" /> DEFAULT ACTIVE
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-500 leading-relaxed font-sans">
                      No active layout override. Rendering custom multi-logo template head instead.
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator Panel */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider block">Security Seals</span>
                {previewFormCandidate.admissionFormStatus === "CONFIRMED" || previewFormCandidate.admissionFormStatus === "LOCKED" ? (
                  <div className="bg-emerald-900/10 border border-emerald-505 p-3 rounded-lg flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-450 shrink-0" />
                    <div>
                      <span className="font-mono text-[9px] font-extrabold uppercase text-emerald-400 tracking-wider block">SYSTEM SEAL ACTIVE</span>
                      <span className="text-[9px] text-slate-400 leading-none">Database modifications frozen.</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-900/10 border border-amber-505 p-3 rounded-lg flex items-center gap-2">
                    <Unlock className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-mono text-[9px] font-extrabold uppercase text-amber-400 tracking-wider block">UNSEALED PROFILE</span>
                      <span className="text-[9px] text-slate-400 leading-none">A4 forms active for candidate edit draft.</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Left sidebar minor warning disclaimer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-center font-mono text-[8px] text-slate-500 uppercase leading-normal">
              Official document review mode. Verification bounds apply.
            </div>
          </div>

          {/* MAIN DOCUMENT PREVIEW: Paper Staging backdrop with Centered Mockup */}
          <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden relative">
            
            {/* Action Header bar inside document preview */}
            <div className="p-4 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between z-10 shrink-0 select-none text-left">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-mono uppercase font-black text-slate-350">Mockup Stage Preview Canvas</span>
              </div>
              <span className="text-[10px] font-mono bg-slate-850 px-2 py-0.5 rounded text-slate-450 border border-slate-800">
                1:1 Scale A4 Simulation Center
              </span>
            </div>

            {/* Scrollable sandbox with centered paper */}
            <div className="flex-1 bg-slate-900/70 p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 flex justify-center items-start">
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-550 py-32 font-mono text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span>Synthesizing official document layout and assets...</span>
                </div>
              ) : previewHtml ? (
                /* Pure A4 Dimensions mockup layout with smooth shadow */
                <div className="w-[210mm] min-h-[297mm] h-[297mm] bg-white rounded shadow-2xl border border-slate-700/60 overflow-hidden shrink-0 flex flex-col justify-between transition animate-in zoom-in-95 duration-300">
                  <iframe
                    id="form-preview-iframe"
                    title="Official Form Pre-render Sandbox"
                    srcDoc={previewHtml}
                    className="w-full h-full border-none shadow-none bg-white font-sans"
                  />
                </div>
              ) : (
                <div className="text-slate-400 font-mono text-xs py-16">
                  Admission Form document context was unable to compile.
                </div>
              )}
            </div>

            {/* STICKY STAGED ACTION CONTROL BAR */}
            <div className="p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 select-none font-sans text-left z-10">
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Print Form Action */}
                <button
                  type="button"
                  onClick={() => {
                    const iframe = document.getElementById("form-preview-iframe") as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                    } else {
                      alert("Frame container is loading assets.");
                    }
                  }}
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-indigo-500/20"
                >
                  <Printer className="w-4 h-4 text-indigo-200" />
                  <span>Print Form A4</span>
                </button>

                {/* Download PDF Form */}
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/api/admissions/${previewFormCandidate.id}/form/pdf`, "_blank");
                  }}
                  className="px-4.5 py-2 bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span>Download PDF Document</span>
                </button>

                {/* Download Word Document Form */}
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/api/admissions/${previewFormCandidate.id}/form/docx`, "_blank");
                  }}
                  className="px-4.5 py-2 bg-slate-800 hover:bg-slate-750 text-sky-400 border border-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4 text-sky-505" />
                  <span>Download Microsoft Word</span>
                </button>

                {/* Regenerate sequential Reference Code with review authority */}
                <button
                  type="button"
                  onClick={() => handleRegenerateReferenceCode(previewFormCandidate.id)}
                  title="Regenerate Sequential Code parameters"
                  className="px-4.5 py-2 bg-slate-805 hover:bg-slate-750 text-amber-500 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Regenerate Reference Code</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Confirm & Lock Form action toggler */}
                {previewFormCandidate.admissionFormStatus !== "CONFIRMED" && previewFormCandidate.admissionFormStatus !== "LOCKED" ? (
                  <button
                    type="button"
                    onClick={() => handleConfirmAndLockForm(previewFormCandidate.id)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md hover:shadow-emerald-550/20"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200 animate-bounce" />
                    <span>Seal, Confirm & Lock</span>
                  </button>
                ) : (
                  <div className="px-4 py-1.5 bg-rose-950/30 border border-rose-900 rounded-lg text-rose-455 text-[10px] font-mono uppercase font-black tracking-widest flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-500" />
                    <span>Form Locked & Sealed</span>
                  </div>
                )}

                {/* Dismiss Drawer Panel */}
                <button
                  type="button"
                  onClick={() => setPreviewFormCandidate(null)}
                  className="px-5 py-2 bg-slate-750 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs border border-slate-700"
                >
                  <span>Close Preview</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 5. INTERACTIVE PRINTABLE LETTERS PREVIEW MODAL */}
      {previewCandidate && (
        <div id="parchment-letterhead-modal" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[95vh]">
            
            {/* Injected Print Styling specifically bounded to standard page limits */}
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #print-letterhead-area-outer, #print-letterhead-area-outer * {
                  visibility: visible !important;
                }
                #print-letterhead-area-outer {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  box-sizing: border-box !important;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 15mm !important;
                  margin: 0 !important;
                  background: white !important;
                  color: black !important;
                }
                .no-print {
                  display: none !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
              }
              .letter-container {
                font-family: "Georgia", "Inter", serif;
                line-height: 1.6;
              }
            `}} />

            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl no-print">
              <div className="flex items-center gap-2 text-slate-800">
                <Printer className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="font-display font-black text-xs uppercase tracking-wide text-slate-900 block leading-tight">Official TSP Admission Letter</span>
                  <span className="text-[9px] text-slate-400 font-mono tracking-wide">{previewCandidate.admissionRef}</span>
                </div>
              </div>
              <button 
                onClick={() => setPreviewCandidate(null)}
                className="p-1 px-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            {/* Letter Content Scroller Container */}
            <div className="flex-1 p-8 sm:p-12 overflow-y-auto bg-amber-50/5 relative printing-letter-box" id="print-letterhead-area-outer">
              
              {/* TSP LETTERHEAD */}
              {previewCandidate.letterheadUrl ? (
                <div className="mb-6">
                  <img 
                    src={previewCandidate.letterheadUrl} 
                    alt={previewCandidate.tspName} 
                    className="w-full max-h-24 object-contain mx-auto"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="border-b-[3px] border-slate-900 pb-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-left font-sans">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 bg-slate-900 text-white font-mono text-[9px] font-black tracking-widest rounded leading-none uppercase">
                        TSP PARTNER
                      </span>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                        IDEAS Project TVET Program
                      </span>
                    </div>
                    <h2 className="text-base font-black text-slate-950 uppercase leading-none tracking-tight">
                      {previewCandidate.tspName}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      {previewCandidate.tspAddress}
                    </p>
                  </div>
                  <div className="text-left sm:text-right font-mono text-[9px] text-slate-450 space-y-0.5 sm:self-end">
                    <p>Phone: {previewCandidate.tspPhone}</p>
                    <p>Email: {previewCandidate.tspEmail}</p>
                  </div>
                </div>
              )}

              {/* Dynamic Content Structure */}
              <div className="relative z-10 letter-container text-slate-900 space-y-5 text-left text-xs antialiased leading-relaxed font-sans mt-2">
                
                <div className="text-left font-medium text-slate-500 text-[10px] space-y-0.5">
                  <p>Date: {previewCandidate.date}</p>
                </div>

                <div className="text-left font-medium text-slate-800 space-y-0.5 pt-1">
                  <p className="text-xs font-bold text-slate-900 leading-tight">Dear Mr/Mrs/Miss: {previewCandidate.beneficiaryName}</p>
                </div>

                <div className="text-left py-1">
                  <h3 className="text-xs font-black text-slate-950 tracking-wider uppercase border-b border-slate-900 inline-block pb-0.5 leading-none">
                    ADMISSION LETTER
                  </h3>
                </div>

                {/* Letter Body - EXACTLY AS SPECIFIED */}
                <div className="space-y-4 font-normal text-slate-700 text-justify">
                  <p>
                    We are pleased to inform you that you have been selected to participate in the short-term technical and vocational education and training (TVET) Program, sponsored by the IDEAS Project.
                  </p>

                  <p>
                    This program aims to equip you with relevant skills and competencies in <strong className="text-slate-900 font-bold">{previewCandidate.skillName}</strong> under <strong className="text-slate-900 font-bold">{previewCandidate.sectorName}</strong> Sector.
                  </p>

                  <p>
                    The training will take place at <strong className="text-slate-900 font-bold">{previewCandidate.trainingCentre}</strong>
                    <br />From <strong className="text-slate-900 font-bold">{previewCandidate.startDate}</strong> To <strong className="text-slate-900 font-bold">{previewCandidate.endDate}</strong>.
                  </p>

                  <div className="space-y-1 text-left">
                    <p>As a participant in this program, you are expected to:</p>
                    <ul className="list-none pl-4 space-y-1 mt-1">
                      <li className="flex items-start gap-2">
                        <span className="text-slate-950 font-black">•</span>
                        <span>Attend all training sessions and activities (at least 65% monthly attendance)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-slate-950 font-black">•</span>
                        <span>Participate in class discussions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-slate-950 font-black">•</span>
                        <span>Adhere to the Training Service Provider's rules and regulations</span>
                      </li>
                    </ul>
                  </div>

                  <p>
                    The IDEAS Project will cover the tuition and stipends for transportation only.
                  </p>

                  <p>
                    Kindly confirm your acceptance of this admission with an acceptance letter to this effect.
                  </p>
                </div>

                {/* Footer Sign-off Block */}
                <div className="pt-8 text-left space-y-4">
                  <div>
                    <p className="text-xs text-slate-600">Kind regards</p>
                    
                    <div className="mt-6 relative inline-block">
                      {previewCandidate.signatureUrl ? (
                        <div className="mb-1 h-12">
                          <img 
                            src={previewCandidate.signatureUrl} 
                            alt="TPM Signature" 
                            className="h-10 w-auto object-contain" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <p className="font-serif italic text-sm text-slate-800 font-bold pb-1 pl-2 tracking-widest select-none leading-none">
                          {previewCandidate.tpmName}
                        </p>
                      )}
                      
                      <div className="w-48 border-b border-dashed border-slate-300"></div>
                      
                      <p className="text-[11px] font-extrabold text-slate-900 mt-1.5 uppercase tracking-wide leading-none">
                        {previewCandidate.tpmName}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mt-1 leading-none">
                        TPM Signature
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 rounded-b-xl no-print">
              <div className="text-[10px] font-mono text-slate-400 font-bold hidden sm:block">
                * Conforms strictly to official IDEAS-TVET Template.
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setPreviewCandidate(null)}
                  className="bg-transparent hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
                
                {/* PREVIEW BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    // Flash notification that the modal screen already loaded the live print-preview model 
                    alert("This modal renders the live high-fidelity layout. You can print or download PDF of this live layout directly.");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-2 px-4 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  Preview Layout
                </button>

                {/* PRINT BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>

                {/* DOWNLOAD PDF BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    window.open(`${API_BASE_URL}/api/admissions/download-letter/${previewCandidate.beneficiaryId || previewCandidate.id}?inline=false`, "_blank");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  Download PDF
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
