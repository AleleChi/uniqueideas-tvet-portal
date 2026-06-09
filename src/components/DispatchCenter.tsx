import React, { useState, useEffect } from "react";
import { 
  FileText, Mail, Send, CheckCircle, XCircle, Search, 
  RotateCcw, Trash2, Edit3, Plus, ShieldAlert, ArrowUpDown,
  Copy, ExternalLink, Sliders, Play, Trash, Check, HelpCircle,
  TrendingUp, RefreshCw, Layers, FileCheck, Eye, EyeOff
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { buildPublicUrl } from "../config/api";

interface DispatchCenterProps {
  candidates: any[];
}

export function DispatchCenter({ candidates }: DispatchCenterProps) {
  // Navigation Sub tabs
  const [activeSubTab, setActiveSubTab] = useState<"queue" | "blueprints">("queue");

  // Dispatch Logs State
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Email Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({
    trainee_name: "Adeola Kolawole",
    reference_number: "T-09415",
    state: "Kano",
    skill: "Solar PV Installation",
    tsp: "Unique Solar Nig Ltd",
    download_link: buildPublicUrl("/documents/verify/demo-hash-key"),
    institution_name: "Unique Technology TVET Center",
    current_date: new Date().toLocaleDateString("en-GB")
  });

  // Bulk Dispatch State
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [bulkDocumentType, setBulkDocumentType] = useState("ADMISSION_LETTER");
  const [bulkStatusFilter, setBulkStatusFilter] = useState("all");
  const [searchCandidateQuery, setSearchCandidateQuery] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  useEffect(() => {
    fetchDispatches();
    fetchTemplates();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDispatches = async () => {
    try {
      setLoadingQueue(true);
      const res = await authFetch("/api/dispatches");
      if (res.ok) {
        const data = await res.json();
        setDispatches(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await authFetch("/api/email-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      const res = await authFetch(`/api/dispatches/${id}/resend`, { method: "POST" });
      if (res.ok) {
        showToast("Secure document transmited successfully via direct gateway.");
        fetchDispatches();
      } else {
        showToast("Gateway transmission failed.", "error");
      }
    } catch (e) {
      showToast("Connection transaction error.", "error");
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await authFetch(`/api/dispatches/${id}/revoke`, { method: "POST" });
      if (res.ok) {
        showToast("Secure link authorization revoked successfully.", "warning");
        fetchDispatches();
      }
    } catch (e) {
      showToast("Connection error.", "error");
    }
  };

  const [retryingFailed, setRetryingFailed] = useState(false);

  const handleRetryAllFailed = async () => {
    const failedList = dispatches.filter(d => d.status === "FAILED");
    if (failedList.length === 0) {
      showToast("No failed dispatches found to retry.", "warning");
      return;
    }
    
    setRetryingFailed(true);
    let successCount = 0;
    try {
      for (const d of failedList) {
        const res = await authFetch(`/api/dispatches/${d.id}/resend`, { method: "POST" });
        if (res.ok) {
          successCount++;
        }
      }
      showToast(`Bulk retry completed. Re-queued and retried ${successCount} failed dispatches.`);
      fetchDispatches();
    } catch (e) {
      console.error(e);
      showToast("Bulk retry system encountered an error.", "error");
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.bodyHtml) {
      showToast("Please provide all template envelopes.", "error");
      return;
    }

    try {
      const res = await authFetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate)
      });
      if (res.ok) {
        showToast("Email template saved successfully.");
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        showToast("Saving template failed.", "error");
      }
    } catch (e) {
      showToast("Template registration error.", "error");
    }
  };

  const handleCopyLink = (token: string) => {
    const link = buildPublicUrl(`/documents/verify/${token}`);
    navigator.clipboard.writeText(link);
    showToast("Copy verified link to dashboard clipboard!");
  };

  // Bulk triggers
  const handleBulkSubmit = async () => {
    if (selectedCandidates.length === 0) {
      showToast("Kindly select at least one candidate for bulk transmittal.", "warning");
      return;
    }

    try {
      setBulkProcessing(true);
      setBulkProgress(`Initializing bulk queue: compiling ${selectedCandidates.length} documents...`);
      
      const res = await authFetch("/api/dispatches/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryIds: selectedCandidates,
          documentType: bulkDocumentType
        })
      });

      if (res.ok) {
        const out = await res.json();
        showToast(`Bulk dispatch executed. Successfully compiled and processed ${selectedCandidates.length} transmissions.`);
        setIsBulkOpen(false);
        setSelectedCandidates([]);
        fetchDispatches();
      } else {
        showToast("Bulk operations gateway error.", "error");
      }
    } catch (e) {
      showToast("Bulk connection timeout.", "error");
    } finally {
      setBulkProcessing(false);
    }
  };

  // Substitute logic for visual local previews
  const renderPreview = (html: string) => {
    let out = html;
    for (const [key, val] of Object.entries(previewVars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      out = out.replace(regex, String(val));
    }
    return out;
  };

  // Aggregated analytics values
  const totalCount = dispatches.length;
  const sentCount = dispatches.filter(d => d.status === "SENT" || d.status === "DELIVERED").length;
  const openedCount = dispatches.filter(d => d.status === "OPENED" || d.status === "DOWNLOADED").length;
  const downloadedCount = dispatches.filter(d => d.status === "DOWNLOADED").length;
  const failedCount = dispatches.filter(d => d.status === "FAILED").length;
  const readRate = totalCount ? Math.round((openedCount / totalCount) * 100) : 0;

  // Filter queue records
  const filteredQueue = dispatches.filter(d => {
    const nameStr = (d.beneficiaryName || d.beneficiaryId || "").toLowerCase();
    const emailStr = (d.emailAddress || "").toLowerCase();
    const matchesSearch = nameStr.includes(searchQuery.toLowerCase()) || emailStr.includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const matchesType = typeFilter === "all" || d.documentType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Filter candidates list for bulk selector
  const eligibleCandidates = candidates.filter(c => {
    // Basic search query
    const matchName = `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchCandidateQuery.toLowerCase());
    
    // Status filters depending on document type requirements
    if (bulkStatusFilter === "all") return matchName;
    return matchName && c.status === bulkStatusFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Dynamic Floating Toast feedback alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] p-4 rounded-xl shadow-lg border text-xs font-sans font-bold flex items-center gap-2 animate-bounce ${
          toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
          toast.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
          "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {toast.type === "success" ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Stats Summary Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left">
          <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">Dispatched Packages</span>
          <span className="text-xl font-bold font-sans text-slate-900 mt-1 block">{totalCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left">
          <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">SENT SUCCESS</span>
          <span className="text-xl font-bold font-sans text-emerald-700 mt-1 block">{sentCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left">
          <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">Opened Rates</span>
          <span className="text-xl font-bold font-sans text-indigo-700 mt-1 block">{readRate}% <span className="text-slate-400 text-xs font-normal">({openedCount})</span></span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left">
          <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">Downloads Save</span>
          <span className="text-xl font-bold font-sans text-teal-700 mt-1 block">{downloadedCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-left">
          <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">Queue Bounces</span>
          <span className="text-xl font-bold font-sans text-rose-600 mt-1 block">{failedCount}</span>
        </div>
      </div>

      {/* Segment controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab("queue")}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === "queue" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-[#008751]" />
            Delivery Queue Log
          </button>
          <button
            onClick={() => setActiveSubTab("blueprints")}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === "blueprints" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mail className="h-3.5 w-3.5 text-[#008751]" />
            Email Templates System
          </button>
        </div>

        <button
          onClick={() => setIsBulkOpen(true)}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
          Bulk Dispatch Documents
        </button>
      </div>

      {/* WORKSPACE AREA */}

      {/* 1. DISPATCH ENQUEUE PORTAL TABLE TAB */}
      {activeSubTab === "queue" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left animate-in fade-in duration-100">
          
          {/* THE DELIBERATE VISUAL DELIVERY FUNNEL (Phase 6) */}
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase">Automated Dispatch Delivery Funnel Analytics</h4>
                <p className="text-[10px] text-slate-400 font-mono">KPI STATED CONVERSION ENVELOPE</p>
              </div>
              <button
                type="button"
                disabled={retryingFailed || dispatches.filter(d => d.status === "FAILED").length === 0}
                onClick={handleRetryAllFailed}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl py-1.5 px-3.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs select-none"
              >
                {retryingFailed ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                One-Click Retry Bounces ({dispatches.filter(d => d.status === "FAILED").length})
              </button>
            </div>

            {/* Funnel Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-white p-3 border rounded-xl space-y-1 relative overflow-hidden">
                <span className="text-[9px] text-slate-400 uppercase font-bold">1. Enqueued</span>
                <div className="text-sm font-black text-slate-900">{totalCount} logs</div>
                <div className="text-[9px] text-[#008751] font-bold">100% Core Registered</div>
                <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 w-full"></div>
              </div>

              <div className="bg-white p-3 border rounded-xl space-y-1 relative overflow-hidden">
                <span className="text-[9px] text-slate-400 uppercase font-bold">2. Sent & Delivered</span>
                <div className="text-sm font-black text-slate-900">{sentCount} logs</div>
                <div className="text-[9px] text-indigo-700 font-bold">
                  {totalCount ? Math.round((sentCount / totalCount) * 100) : 100}% Delivery Rate
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-emerald-500" style={{ width: `${totalCount ? Math.round((sentCount / totalCount) * 100) : 100}%` }}></div>
              </div>

              <div className="bg-white p-3 border rounded-xl space-y-1 relative overflow-hidden">
                <span className="text-[9px] text-slate-400 uppercase font-bold">3. Opened (Read)</span>
                <div className="text-sm font-black text-slate-900">{openedCount} logs</div>
                <div className="text-[9px] text-[#008751] font-bold">
                  {totalCount ? Math.round((openedCount / totalCount) * 100) : 0}% Open Rate
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-teal-500" style={{ width: `${totalCount ? Math.round((openedCount / totalCount) * 100) : 0}%` }}></div>
              </div>

              <div className="bg-white p-3 border rounded-xl space-y-1 relative overflow-hidden">
                <span className="text-[9px] text-slate-400 uppercase font-bold">4. Downloaded</span>
                <div className="text-sm font-black text-slate-900">{downloadedCount} logs</div>
                <div className="text-[9px] text-indigo-700 font-bold">
                  {totalCount ? Math.round((downloadedCount / totalCount) * 100) : 0}% Download Rate
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-yellow-500" style={{ width: `${totalCount ? Math.round((downloadedCount / totalCount) * 100) : 0}%` }}></div>
              </div>
            </div>

            {/* Micro Conversion Details */}
            <div className="text-[10px] font-mono text-slate-500 flex flex-wrap gap-x-6 gap-y-2 justify-between items-center bg-white p-2 px-3 rounded-lg border">
              <span>● Real-time transmission active</span>
              <div className="flex gap-4">
                <span>Delivery: <strong className="text-slate-800">{totalCount ? Math.round((sentCount / totalCount) * 100) : 100}%</strong></span>
                <span>Bounces: <strong className="text-rose-600">{totalCount ? Math.round((failedCount / totalCount) * 100) : 0}%</strong></span>
                <span>Open Rate: <strong className="text-[#008751]">{readRate}%</strong></span>
              </div>
            </div>
          </div>

          {/* Query Filter panel */}
          <div className="flex flex-col md:flex-row gap-4 mb-5">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-2.5 text-slate-400 h-4 w-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient name, student ID, email address..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008751] transition"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs py-2 px-3.5 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="all">Registration Actions (All)</option>
                <option value="QUEUED">STATUS: QUEUED</option>
                <option value="SENT">STATUS: SENT</option>
                <option value="OPENED">STATUS: OPENED</option>
                <option value="DOWNLOADED">STATUS: DOWNLOADED</option>
                <option value="FAILED">STATUS: BOUNCED</option>
                <option value="REVOKED">STATUS: REVOKED</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs py-2 px-3.5 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="all">Document Portfolio (All)</option>
                <option value="ADMISSION_LETTER">ADMISSION OFFER LETTER</option>
                <option value="ADMISSION_FORM">DEMOGRAPHICS FORM PROFILE</option>
                <option value="ACCEPTANCE_LETTER">ACCEPTANCE ENDORSEMENT</option>
              </select>

              <button
                onClick={fetchDispatches}
                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition"
                title="Refresh queue list"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Table list */}
          {loadingQueue ? (
            <div className="py-12 flex justify-center items-center gap-2 text-slate-400 font-mono text-xs">
              <RefreshCw className="h-4 w-4 animate-spin text-[#008751]" />
              <span>Checking dispatch queues...</span>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-xl">
              <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold">No active document dispatches found matching filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">Trainee ID</th>
                    <th className="py-3 px-4">Recipient Name</th>
                    <th className="py-3 px-4">Document Folder</th>
                    <th className="py-3 px-4">Dispatch Contact</th>
                    <th className="py-3 px-4">Send Date</th>
                    <th className="py-3 px-4">Status Pin</th>
                    <th className="py-3 px-4 text-center">Actions Controller</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 leading-relaxed">
                  {filteredQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.beneficiaryId}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{item.beneficiaryName || "Candidate Portfolio"}</span>
                        <span className="text-[10px] text-slate-400">Ref: {item.id}</span>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <span className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold text-[9px]">
                          {item.documentType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.emailAddress}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.sentAt ? new Date(item.sentAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "QUEUED"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[9px] ${
                          item.status === "DOWNLOADED" ? "bg-emerald-100 text-emerald-800" :
                          item.status === "OPENED" ? "bg-cyan-100 text-cyan-800" :
                          item.status === "SENT" ? "bg-blue-100 text-blue-800" :
                          item.status === "FAILED" ? "bg-red-100 text-red-800" :
                          item.status === "REVOKED" ? "bg-gray-100 text-gray-800" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {item.status}
                        </span>
                        {item.failureReason && (
                          <p className="text-[10px] text-red-600 mt-1 font-semibold italic">{item.failureReason}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleCopyLink(item.secureToken)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded"
                            title="Copy Dynamic Verified Portal Link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          
                          {item.secureToken && (
                            <a
                              href={`/documents/verify/${item.secureToken}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-[#008751] rounded inline-flex items-center"
                              title="Direct preview student view"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => handleResend(item.id)}
                            className="p-1.5 bg-slate-50 hover:bg-teal-50 text-teal-700 rounded"
                            title="Resend to Gateway"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>

                          {item.status !== "REVOKED" && (
                            <button
                              onClick={() => handleRevoke(item.id)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-rose-600 rounded"
                              title="Revoke / Expire Token Access"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. EMAIL TEMPLATES MANAGER TABLE TAB */}
      {activeSubTab === "blueprints" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed text-left animate-in fade-in duration-100">
          
          {/* Templates Visual Cards (Side column) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-[#008751] text-xs uppercase tracking-wider mb-3">Email Template Blueprints</h4>
              <p className="text-slate-500 text-xs mb-4">Click any visual profile to edit subject envelopes or bodies.</p>
              
              {loadingTemplates ? (
                <div className="py-4 text-center text-slate-400 font-mono text-xs">Loading templates...</div>
              ) : (
                <div className="space-y-2.5">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setEditingTemplate({ ...t })}
                      className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                        editingTemplate?.id === t.id 
                          ? "bg-indigo-50/60 border-indigo-200 shadow-sm" 
                          : "bg-slate-50 hover:bg-slate-105 border-slate-200/60"
                      }`}
                    >
                      <span className="inline-block bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase">{t.templateType}</span>
                      <h5 className="font-bold text-xs text-slate-900 mt-1">{t.name}</h5>
                      <p className="text-[10px] text-slate-400 truncate mt-1">{t.subject}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variable help card */}
            <div className="bg-slate-90% bg-slate-900 border border-slate-800 text-slate-300 p-5 rounded-2xl text-xs">
              <h5 className="text-[#ffcc00] font-extrabold uppercase mb-2">Supported Dynamic Values</h5>
              <p className="text-[11px] text-slate-400 mb-4">These placeholders are substituted on-the-fly inside subjects and body HTML: </p>
              <ul className="space-y-2 font-mono text-[10px]">
                <li><strong className="text-white">{"{{trainee_name}}"}</strong> - Full Name</li>
                <li><strong className="text-white">{"{{reference_number}}"}</strong> - ID Code</li>
                <li><strong className="text-white">{"{{download_link}}"}</strong> - Secure Link</li>
                <li><strong className="text-white">{"{{skill}}"}</strong> - Training Sector</li>
                <li><strong className="text-white">{"{{tsp}}"}</strong> - TSP Center Name</li>
                <li><strong className="text-white">{"{{state}}"}</strong> - Training State</li>
                <li><strong className="text-white">{"{{institution_name}}"}</strong> - Hub Title</li>
                <li><strong className="text-white">{"{{current_date}}"}</strong> - Local Date</li>
              </ul>
            </div>
          </div>

          {/* Core Template Editor */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
            {editingTemplate ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-3 mb-2">
                  <div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 rounded font-bold px-2 py-0.5 uppercase">{editingTemplate.templateType}</span>
                    <h3 className="text-slate-950 font-bold text-base mt-2">Editing Blueprint: {editingTemplate.name}</h3>
                  </div>
                  <button
                    onClick={handleSaveTemplate}
                    className="bg-[#008751] hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 text-xs">
                    <label className="text-slate-500 font-bold">Template Envelope Name</label>
                    <input
                      type="text"
                      className="p-2.5 border rounded-xl"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    <label className="text-slate-500 font-bold">Subject Line Header</label>
                    <input
                      type="text"
                      className="p-2.5 border rounded-xl font-medium"
                      value={editingTemplate.subject}
                      onChange={(e) => setEditingTemplate({...editingTemplate, subject: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-500 font-bold">Body HTML Code Structure</label>
                  <textarea
                    rows={12}
                    className="p-3 border rounded-xl font-mono text-xs leading-relaxed bg-slate-50/50"
                    value={editingTemplate.bodyHtml}
                    onChange={(e) => setEditingTemplate({...editingTemplate, bodyHtml: e.target.value})}
                  />
                </div>

                {/* Substituted Visual Sandbox Preview Frame */}
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-6">
                  <div className="bg-slate-100 font-sans font-bold text-slate-500 text-[10px] uppercase py-2 px-4 border-b">
                    Visual Render Sandbox (Auto Substitutions Demo)
                  </div>
                  <div 
                    className="p-6 bg-slate-50 max-h-[350px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: renderPreview(editingTemplate.bodyHtml) }}
                  />
                </div>

              </div>
            ) : (
              <div className="text-center py-24 text-slate-400">
                <Mail className="h-12 w-12 mx-auto text-slate-200 mb-3" />
                <h4 className="font-bold text-slate-800 text-sm">No Template Active</h4>
                <p className="text-xs mt-1">Select an email template blueprint from the left panel column to customize styling overlays.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. COHORT BULK DISPATCH MODAL FRAME */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] leading-relaxed text-left animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-5 border-b flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-[#008751]" />
                <div>
                  <h3 className="text-slate-900 font-extrabold text-base">Bulk Secure Document Dispatch Center</h3>
                  <p className="text-xs text-slate-500">Dispatch dynamic portal keys directly to student contact emails.</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkOpen(false)}
                className="p-1 px-2 hover:bg-slate-200 rounded text-slate-400 text-xs cursor-pointer"
                disabled={bulkProcessing}
              >
                Close Window
              </button>
            </div>

            {/* Config panel */}
            <div className="p-5 border-b grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/20">
              
              <div className="flex flex-col gap-1 text-xs">
                <label className="text-slate-500 font-bold">1. SELECT SOURCE FILE / DOCUMENT TYPE</label>
                <select
                  value={bulkDocumentType}
                  onChange={(e) => setBulkDocumentType(e.target.value)}
                  className="bg-white p-2.5 border border-slate-200 rounded-xl focus:outline-none"
                  disabled={bulkProcessing}
                >
                  <option value="ADMISSION_LETTER">ADMISSION OFFER LETTER</option>
                  <option value="ADMISSION_FORM">DEMOGRAPHICS FORM PROFILE</option>
                  <option value="ACCEPTANCE_LETTER">ACCEPTANCE ENDORSEMENT</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <label className="text-slate-500 font-bold">2. CHOOSE FILTER CRITERIA SEGMENT</label>
                <select
                  value={bulkStatusFilter}
                  onChange={(e) => setBulkStatusFilter(e.target.value)}
                  className="bg-white p-2.5 border border-slate-200 rounded-xl focus:outline-none"
                  disabled={bulkProcessing}
                >
                  <option value="all">ALL ACTIVE IN BLOCK</option>
                  <option value="PENDING">STATE: PENDING ADMISSION</option>
                  <option value="UNDER REVIEW">STATE: UNDER REVIEW</option>
                  <option value="ADMITTED">STATE: ADMITTED & DECLARED</option>
                  <option value="ACCEPTED">STATE: ACCEPTANCE ENDORSED</option>
                </select>
              </div>

            </div>

            {/* List selector */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider">
                  Select Target Trainees ({selectedCandidates.length} Selected)
                </h4>
                
                <input
                  type="text"
                  value={searchCandidateQuery}
                  onChange={(e) => setSearchCandidateQuery(e.target.value)}
                  placeholder="Quick search student name..."
                  className="p-1.5 px-3 border rounded-lg text-xs bg-slate-50 font-medium"
                />
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                {eligibleCandidates.map(c => {
                  const isChecked = selectedCandidates.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (bulkProcessing) return;
                        setSelectedCandidates(prev => 
                          isChecked ? prev.filter(x => x !== c.id) : [...prev, c.id]
                        );
                      }}
                      className="p-3 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="h-4 w-4 rounded pointer-events-none text-indigo-600"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{c.firstName} {c.lastName}</p>
                          <p className="text-[10px] text-slate-400">ID: {c.id} | Track: {c.skillSector} | TSP: {c.tsp}</p>
                        </div>
                      </div>
                      <span className="inline-block bg-slate-100 font-bold px-2 py-0.5 rounded text-[9px] uppercase">{c.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress logging and Actions */}
            <div className="p-5 border-t bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1 w-full text-xs text-slate-500 font-semibold italic">
                {bulkProcessing ? (
                  <div className="flex items-center gap-2 text-indigo-700 font-bold">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{bulkProgress}</span>
                  </div>
                ) : (
                  <span>Selected {selectedCandidates.length} trainees of {eligibleCandidates.length} filtered records.</span>
                )}
              </div>

              <div className="flex gap-2.5 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCandidates.length === eligibleCandidates.length) {
                      setSelectedCandidates([]);
                    } else {
                      setSelectedCandidates(eligibleCandidates.map(c => c.id));
                    }
                  }}
                  disabled={bulkProcessing}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold transition-all text-slate-700 cursor-pointer"
                >
                  {selectedCandidates.length === eligibleCandidates.length ? "De-select All" : "Select All"}
                </button>

                <button
                  type="button"
                  onClick={handleBulkSubmit}
                  disabled={bulkProcessing || selectedCandidates.length === 0}
                  className="px-6 py-2 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {bulkProcessing ? "Transmitting..." : "Execute Bulk Send"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
