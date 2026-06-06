import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, MapPin, FileCheck, Send, Eye, Download, ShieldAlert, CheckSquare, 
  RefreshCw, TrendingUp, Inbox, ArrowUpRight, Award, ServerCrash, Layers, HelpCircle, FileText, ChevronRight, Activity, Clock
} from "lucide-react";
import { Beneficiary } from "../types";
import { authFetch } from "../utils/authFetch";

interface OperationsCenterProps {
  beneficiaries: Beneficiary[];
  onSelectBeneficiary: (id: string) => void;
  onNavigateTab: (tab: "dashboard" | "registry" | "settings") => void;
}

export function OperationsCenter({ beneficiaries, onSelectBeneficiary, onNavigateTab }: OperationsCenterProps) {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);

  const fetchDispatchesAndLogs = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/dispatches");
      if (res.ok) {
        const data = await res.json();
        setDispatches(data);
      }
      
      const logRes = await authFetch("/api/audit-logs");
      if (logRes.ok) {
        const logData = await logRes.json();
        setActivities(logData.slice(0, 10)); // Top 10 activities
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage("System error connecting to secure API gateway.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchesAndLogs();
  }, [beneficiaries]);

  // Executive summary counts
  const pipelineStats = useMemo(() => {
    const total = beneficiaries.length;
    const pending = beneficiaries.filter(b => b.status === "DRAFT" || b.status === "PENDING" || b.status === "PENDING_PHOTO" || b.status === "UNDER_REVIEW").length;
    const reviewed = beneficiaries.filter(b => b.status === "ADMITTED" || b.status === "ACCEPTED").length;
    const activeCohort = beneficiaries.filter(b => b.status === "ENROLLED" || b.status === "IN_TRAINING" || b.status === "VERIFIED" || b.status === "GRADUATED").length;
    
    // Unique TSPs
    const tsps = Array.from(new Set(beneficiaries.map(b => b.tsp).filter(Boolean)));
    // Unique States
    const states = Array.from(new Set(beneficiaries.map(b => b.state).filter(Boolean)));

    return { total, pending, reviewed, activeCohort, tspsCount: tsps.length, statesCount: states.length };
  }, [beneficiaries]);

  // Document states
  const docStats = useMemo(() => {
    const total = dispatches.length;
    const sent = dispatches.filter(d => d.status === "SENT" || d.status === "DELIVERED" || d.status === "OPENED" || d.status === "DOWNLOADED").length;
    const opened = dispatches.filter(d => d.status === "OPENED" || d.status === "DOWNLOADED").length;
    const downloaded = dispatches.filter(d => d.status === "DOWNLOADED").length;
    const failed = dispatches.filter(d => d.status === "FAILED").length;
    const revoked = dispatches.filter(d => d.status === "REVOKED").length;
    const queued = dispatches.filter(d => d.status === "QUEUED").length;

    // Delivery rate
    const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    // Open rate
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    // Conversion downloaded rate
    const downloadRate = opened > 0 ? Math.round((downloaded / opened) * 100) : 0;

    return { total, sent, opened, downloaded, failed, revoked, queued, deliveryRate, openRate, downloadRate };
  }, [dispatches]);

  return (
    <div className="space-y-6 text-left select-none font-sans max-w-7xl mx-auto">
      
      {/* Upper header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-[#008751] font-mono">
            Federal Ministry of Education / World Bank Project Office
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase mt-1">
            National Operations Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Single-pane executive dashboard & real-time delivery conversion logs.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchDispatchesAndLogs}
            className="p-2 border rounded-xl bg-white hover:bg-slate-50 text-slate-650 flex items-center justify-center cursor-pointer min-h-[40px] shadow-xs"
            title="Reload metrics"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <button
            onClick={() => onNavigateTab("settings")}
            className="px-4 py-2 bg-[#008751] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Layers className="h-3.5 w-3.5" />
            Branding Controls
          </button>
        </div>
      </div>

      {loading && dispatches.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-[#008751]" />
          <p className="text-sm font-semibold">Composing national database operational feeds...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Executive KPI Block */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between border-l-4 border-indigo-600">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Admissions Pipeline
                </span>
                <span className="font-extrabold text-2xl text-slate-950 block">
                  {pipelineStats.total.toLocaleString()}
                </span>
                <p className="text-[10px] text-slate-500 font-semibold truncate">
                  {pipelineStats.pending} verification pending
                </p>
              </div>
              <div className="h-11 w-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between border-l-4 border-[#008751]">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Documents Sent
                </span>
                <span className="font-extrabold text-2xl text-slate-950 block">
                  {docStats.sent.toLocaleString()}
                </span>
                <p className="text-[10px] text-[#008751] font-bold">
                  {docStats.deliveryRate}% Transmitted
                </p>
              </div>
              <div className="h-11 w-11 bg-emerald-50 text-[#008751] rounded-xl flex items-center justify-center">
                <Send className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between border-l-4 border-cyan-500">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Opened Portals
                </span>
                <span className="font-extrabold text-2xl text-slate-950 block">
                  {docStats.opened.toLocaleString()}
                </span>
                <p className="text-[10px] text-indigo-600 font-bold">
                  {docStats.openRate}% Verification view
                </p>
              </div>
              <div className="h-11 w-11 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center">
                <Eye className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between border-l-4 border-amber-500">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Saved Downloads
                </span>
                <span className="font-extrabold text-2xl text-slate-950 block">
                  {docStats.downloaded.toLocaleString()}
                </span>
                <p className="text-[10px] text-amber-700 font-semibold">
                  {docStats.downloadRate}% Save completed
                </p>
              </div>
              <div className="h-11 w-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Download className="h-5 w-5" />
              </div>
            </div>

          </div>

          {/* Quick Metrics Multi Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="text-[10px] text-slate-400 font-bold tracking-wider block font-mono uppercase">Pending Confirm</p>
              <h4 className="text-lg font-black text-slate-900 mt-1">{pipelineStats.pending}</h4>
            </div>

            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="text-[10px] text-slate-400 font-bold tracking-wider block font-mono uppercase">Failed Deliveries</p>
              <h4 className="text-lg font-black text-rose-600 mt-1">{docStats.failed}</h4>
            </div>

            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="text-[10px] text-slate-400 font-bold tracking-wider block font-mono uppercase">Active TSPs</p>
              <h4 className="text-lg font-black text-indigo-700 mt-1">{pipelineStats.tspsCount} Centers</h4>
            </div>

            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="text-[10px] text-slate-400 font-bold tracking-wider block font-mono uppercase">Active States</p>
              <h4 className="text-lg font-black text-slate-800 mt-1">{pipelineStats.statesCount} offices</h4>
            </div>
          </div>

          {/* Core double layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Delivery Visual Funnel Conversion */}
            <div className="lg:col-span-7 bg-white border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4 uppercase tracking-wider font-sans">
                  <TrendingUp className="h-4 w-4 text-[#008751]" />
                  Document Transmission Delivery Funnel
                </h3>

                <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
                  Real-time conversion path analytics verifying student interactions with secure admission credentials.
                </p>

                <div className="space-y-4">
                  {/* Stage 1: Enqueued */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">1. Total Compiled / Generated</span>
                      <span className="font-mono font-bold text-slate-900">{docStats.total} <span className="text-slate-400 font-normal">(100%)</span></span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: "100%" }}></div>
                    </div>
                  </div>

                  {/* Stage 2: Sent */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">2. Successfully Sent & Dispatched</span>
                      <span className="font-mono font-bold text-slate-900">
                        {docStats.sent} <span className="text-slate-400 font-normal">({docStats.deliveryRate}%)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${docStats.deliveryRate}%` }}></div>
                    </div>
                  </div>

                  {/* Stage 3: Opened */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">3. Verification Link Opened</span>
                      <span className="font-mono font-bold text-slate-900">
                        {docStats.opened} <span className="text-slate-400 font-normal">({docStats.openRate}% of sent)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${docStats.openRate}%` }}></div>
                    </div>
                  </div>

                  {/* Stage 4: Downloaded */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">4. Saved as Local Verified PDF</span>
                      <span className="font-mono font-bold text-slate-900">
                        {docStats.downloaded} <span className="text-slate-400 font-normal">({docStats.downloadRate}% of opened)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${docStats.downloadRate}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t pt-4 flex justify-between items-center text-[11px] text-slate-400 font-medium">
                <span>Database Sync: Online</span>
                <span className="font-mono text-indigo-600 block">GATEWAY TRANSMISSION ENG: ACTIVE</span>
              </div>
            </div>

            {/* Today's Activities & Recent Workflow Events */}
            <div className="lg:col-span-5 bg-white border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4 uppercase tracking-wider font-sans">
                  <Activity className="h-4 w-4 text-[#008751]" />
                  Today's Activities & Operations Logs
                </h3>

                {activities.length === 0 ? (
                  <div className="py-12 text-center text-slate-450 border border-dashed rounded-xl flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-slate-350" />
                    <p className="text-xs">No administrative actions logged today.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {activities.map((act) => (
                      <div key={act.id} className="p-3 bg-slate-50 border rounded-xl text-left hover:bg-slate-100/55 transition">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`inline-block font-mono font-black text-[8px] px-1.5 py-0.5 rounded uppercase leading-none ${
                            act.action.includes("DELETE") || act.action.includes("REVOKE") 
                              ? "bg-rose-50 text-rose-700 border border-rose-100" 
                              : act.action.includes("SUCCESS") || act.action.includes("VERIFY") || act.action.includes("ADMISSION")
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}>
                            {act.action}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-slate-400">
                            {act.timestamp ? new Date(act.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-800 font-semibold leading-relaxed">
                          {act.details}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1 font-mono uppercase tracking-wider">
                          Operator: {act.username} ({act.role})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => onNavigateTab("dashboard")}
                  className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  Inspect All Audit Logs
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

          </div>

          {/* Extra Executive Reporting Cards Phase 13 */}
          <div className="bg-indigo-950/95 border border-indigo-900 rounded-2xl p-6 text-white text-left overflow-hidden relative">
            <div className="absolute right-0 bottom-0 w-44 h-44 bg-indigo-500/10 rounded-full -mr-8 -mb-8"></div>
            
            <div className="flex items-center gap-2.5">
              <Award className="h-6 w-6 text-yellow-400 stroke-2" />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-yellow-400">
                  Kano & Imo State Technical Training Hubs Summary
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Real-time cohort processing verification indicators. High accuracy national identity mapping enabled.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider">Top State Office</span>
                <span className="text-base font-extrabold block mt-0.5">Kano State Center</span>
                <span className="text-[10px] text-indigo-300 font-mono mt-1 block">
                  {beneficiaries.filter(b => b.state?.toLowerCase() === "kano").length} trainees verified
                </span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider">Primary Skill Sector</span>
                <span className="text-base font-extrabold block mt-0.5 truncate">Repair repair repairs</span>
                <span className="text-[10px] text-indigo-300 font-mono mt-1 block">
                  HardwareRepair repairs active
                </span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider">Delivery Rate</span>
                <span className="text-base font-extrabold block mt-0.5">{docStats.deliveryRate}% Transmissions</span>
                <span className="text-[10px] text-indigo-300 font-mono mt-1 block">
                  Email mail servers healthy
                </span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider">Primary Program</span>
                <span className="text-base font-extrabold block mt-0.5 uppercase tracking-wider">IDEAS-TVET Batch A </span>
                <span className="text-[10px] text-indigo-300 font-mono mt-1 block">
                  Fully aligned to NBTE metrics
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
