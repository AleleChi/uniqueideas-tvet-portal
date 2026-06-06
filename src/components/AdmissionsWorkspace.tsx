/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Search, ShieldAlert, X, Check, Eye, Printer, Users, CheckCircle2, 
  XCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight, Building, 
  MapPin, Sliders, Sparkles, Download, ArrowUpDown
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

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

  // Selection & Bulk State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgressPercent, setBulkProgressPercent] = useState(0);
  const [bulkProgressMsg, setBulkProgressMsg] = useState("");

  // Letter Preview Modal State
  const [previewCandidate, setPreviewCandidate] = useState<any | null>(null);
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [orgSettings, setOrgSettings] = useState<any | null>(null);

  // Load telemetry stats and organzation settings once on mount
  useEffect(() => {
    fetchStats();
    fetchOrgSettings();
  }, []);

  // Refetch list whenever query parameters or page changes
  useEffect(() => {
    fetchList();
  }, [page, pageSize, statusFilter, sectorFilter, tspFilter, stateFilter]);

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
      const res = await authFetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setOrgSettings(data);
      }
    } catch (e) {
      console.error("Failed to fetch organization settings:", e);
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
        state: stateFilter
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
        setPreviewCandidate(letterData);
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-left">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">TOTAL APPLICANTS</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">{stats.summary?.total}</span>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-left border-l-4 border-l-amber-500">
                <span className="text-[10px] font-mono text-amber-600 font-bold uppercase block">PENDING</span>
                <span className="text-xl font-bold text-amber-700 mt-1 block">{stats.summary?.pending}</span>
              </div>

              <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl text-left border-l-4 border-l-yellow-500">
                <span className="text-[10px] font-mono text-yellow-600 font-bold uppercase block">UNDER REVIEW</span>
                <span className="text-xl font-bold text-yellow-700 mt-1 block">{stats.summary?.underReview}</span>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl text-left border-l-4 border-l-emerald-500">
                <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase block">ADMITTED</span>
                <span className="text-xl font-bold text-emerald-700 mt-1 block">{stats.summary?.admitted}</span>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl text-left border-l-4 border-l-rose-500">
                <span className="text-[10px] font-mono text-rose-600 font-bold uppercase block">REJECTED</span>
                <span className="text-xl font-bold text-rose-700 mt-1 block">{stats.summary?.rejected}</span>
              </div>

            </div>

            {/* Sub-group Progress Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              
              <div className="space-y-2 text-left">
                <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-500" /> skill sector distribution
                </h4>
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3.5 rounded-xl space-y-2.5 max-h-[140px] overflow-y-auto">
                  {Object.entries(stats.bySector || {}).map(([key, value]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 leading-none">
                        <span className="truncate pr-2">{key}</span>
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
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3.5 rounded-xl space-y-2.5 max-h-[140px] overflow-y-auto">
                  {Object.entries(stats.byTsp || {}).map(([key, value]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 leading-none">
                        <span className="truncate pr-2">{key}</span>
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
                <div className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 p-3.5 rounded-xl space-y-2.5 max-h-[140px] overflow-y-auto">
                  {Object.entries(stats.byState || {}).map(([key, value]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 leading-none">
                        <span className="truncate pr-2">{key} State</span>
                        <span className="font-mono text-slate-700 font-black">{value}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1">
                        <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${Math.min(100, (value / (stats.summary?.total || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
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

      {/* 4. MAIN REGISTRY WORK SHEET DATA TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left border-collapse">
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
                <th className="py-3 px-4 font-bold text-slate-500">Applicant Name & ID</th>
                <th className="py-3 px-4 font-bold text-slate-500">Official Status</th>
                <th className="py-3 px-4 font-bold text-slate-500">Reference Number</th>
                <th className="py-3 px-4 font-bold text-slate-500">TSP Location Provider</th>
                <th className="py-3 px-4 font-bold text-slate-500">Operational state</th>
                <th className="py-3 px-4 font-bold text-slate-500">Photo checklist</th>
                <th className="py-3 px-4 font-bold text-slate-500 text-center">Action Menu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-705 text-slate-650">
              
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

                      <td className="py-3 px-4">
                        <div className="text-left font-semibold text-slate-900 text-sm">{c.name}</div>
                        <div className="text-[10px] font-mono mt-0.5 text-slate-400 font-bold block">{c.id}</div>
                      </td>

                      <td className="py-3 px-4 text-left">
                        <span className={`px-2 py-0.5 border text-[9px] font-mono rounded font-extrabold uppercase inline-block ${style}`}>
                          {step}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-indigo-600 text-left">
                        {c.referenceNumber || "DRAFT_DOCK"}
                      </td>

                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 text-left" title={c.tsp}>
                        {c.tsp.length > 25 ? `${c.tsp.substring(0, 25)}...` : c.tsp}
                      </td>

                      <td className="py-3 px-4 text-slate-650 text-left font-mono font-medium">
                        {c.state?.replace(" State", "") || "N/A"}
                      </td>

                      <td className="py-3 px-4 text-left">
                        {c.hasPhoto ? (
                          <span className="font-extrabold text-[9px] font-mono tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded leading-none">
                            PASS PHOTO LOCKED
                          </span>
                        ) : (
                          <span className="font-extrabold text-[9px] font-mono tracking-wider text-amber-600 bg-amber-50 border border-amber-100/60 px-1.5 py-0.5 rounded leading-none uppercase animate-pulse">
                            Needs snap capture
                          </span>
                        )}
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
                    // Direct window.print invokes save-as-pdf native layout safely
                    window.print();
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
