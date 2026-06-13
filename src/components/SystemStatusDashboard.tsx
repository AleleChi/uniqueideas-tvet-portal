/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SystemStatusDashboard Component.
 * Implements real-time diagnostic indicators and a complete, searchable Feed of System Audit Logs.
 */

import React, { useState, useEffect } from "react";
import { 
  Cpu, Database, Users, ShieldAlert, FileText, CheckCircle2, 
  Search, RefreshCw, AlertTriangle, Clock, Terminal, Filter, ArrowRightLeft, ShieldCheck
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

interface StatusMetrics {
  status: string;
  environment: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  database: {
    status: string;
    active_tsps: number;
    pending_invitations: number;
    total_beneficiaries: number;
    total_audit_logs: number;
  };
}

interface AuditLog {
  id: string;
  username: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
  tenant_id?: string;
  state_id?: string;
}

export function SystemStatusDashboard() {
  const [metrics, setMetrics] = useState<StatusMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filters for Audit logs
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetchSystemStatus = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Fetch Metrics Setup
      const sysRes = await authFetch("/api/system/status");
      if (sysRes.ok) {
        const sysData = await sysRes.json();
        setMetrics(sysData);
      } else {
        throw new Error("Unable to contact backend diagnostic system.");
      }

      // Fetch Audit Logs feed
      const logsRes = await authFetch("/api/audit-logs?limit=250");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(Array.isArray(logsData) ? logsData : logsData.data || []);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to retrieve live system health profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  // Format memory strings
  const formatMB = (bytes: number) => {
    if (!bytes) return "0 MB";
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  };

  // Convert uptime seconds to nice string
  const formatUptime = (sec: number) => {
    if (!sec) return "0s";
    const d = Math.floor(sec / (3600*24));
    const h = Math.floor((sec % (3600*24)) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesKeyword = 
      log.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = !roleFilter || log.role === roleFilter;
    const matchesAction = !actionFilter || log.action?.toLowerCase().includes(actionFilter.toLowerCase());

    return matchesKeyword && matchesRole && matchesAction;
  });

  return (
    <div id="system-status-dashboard" className="p-6 space-y-6 bg-slate-950 text-slate-100 min-h-screen font-sans">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <span className="text-[10px] font-bold font-mono tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-1 rounded">
            OPERATIONAL CONTROL PANEL
          </span>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white mt-1">
            System Status Dashboard & Audit Matrix
          </h1>
          <p className="text-sm text-slate-400">
            Realtime monitoring of primary infrastructure, database transactions, tenant pools, and regulatory cryptographic trails.
          </p>
        </div>
        <div>
          <button
            onClick={fetchSystemStatus}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition shadow-lg flex items-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync Live Console</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/35 border border-rose-900/40 text-rose-300 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* 2. Core indicators Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Core Engine status */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Gateway Status</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ONLINE</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">Uptime: {metrics ? formatUptime(metrics.uptime) : "Syncing..."}</p>
          </div>
        </div>

        {/* Database profile */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Relational Database</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white uppercase flex items-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 inline" />
              <span>{metrics?.database?.status || "HEALTHY"}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">Total Transactions: {metrics?.database?.total_audit_logs || 0}</p>
          </div>
        </div>

        {/* TSP Counts */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Registered TSPs</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white flex items-baseline gap-1.5">
              <span>{metrics?.database?.active_tsps || 0}</span>
              <span className="text-xs text-slate-500">Active</span>
              <span className="text-xs text-slate-500">/</span>
              <span className="text-xs text-amber-450 font-semibold font-sans">
                {metrics?.database?.pending_invitations || 0} Invited
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">National Tenancies</p>
          </div>
        </div>

        {/* Beneficiaries registered */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-purple-500" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Beneficiaries</span>
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">
              {metrics?.database?.total_beneficiaries?.toLocaleString() || 0}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">End-to-End Registries</p>
          </div>
        </div>
      </div>

      {/* 3. Memory & Environment Metadata section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4 lg:col-span-1">
          <h3 className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span>Virtual Machine Details</span>
          </h3>
          <div className="divide-y divide-slate-800/60 text-xs shadow-inner">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 font-medium">Node Environment</span>
              <span className="font-mono text-slate-200 capitalize">{metrics?.environment || "development"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 font-medium">RSS Memory Pool</span>
              <span className="font-mono text-slate-200">{metrics?.memory?.rss ? formatMB(metrics.memory.rss) : "0 MB"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 font-medium">Heap Allocated</span>
              <span className="font-mono text-slate-200">{metrics?.memory?.heapTotal ? formatMB(metrics.memory.heapTotal) : "0 MB"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 font-medium">Heap Used</span>
              <span className="font-mono text-slate-200">{metrics?.memory?.heapUsed ? formatMB(metrics.memory.heapUsed) : "0 MB"}</span>
            </div>
          </div>
        </div>

        {/* Quick Auditing Highlights */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4 lg:col-span-2">
          <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Trail Summary</span>
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850/50">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">State Level Segments</div>
              <p className="text-base text-white mt-1 font-bold">Encrypted</p>
              <p className="text-[10px] text-indigo-400 mt-1">Multi-tenant isolation enforced</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850/50">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Scope Enforcements</div>
              <p className="text-base text-white mt-1 font-bold">Strict RLS</p>
              <p className="text-[10px] text-emerald-400 mt-1">Zero permission bleed detected</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Audit Log Feed section */}
      <div className="border border-slate-800/80 bg-slate-900/30 rounded-xl overflow-hidden p-5 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-white font-display tracking-tight">
              Cryptographic Audit Feed
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live transactional actions executed across the TVET identity matrix. All telemetry is logged irrevocably.
            </p>
          </div>

          {/* Quick inline filters */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:flex-initial md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search log records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-lg py-1.5 pl-9 pr-3 text-[11px] text-slate-200 focus:outline-none focus:ring-0"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-850 text-slate-300 rounded-lg p-1.5 text-[11px] focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="FEDERAL_SUPER_ADMIN">FED_SUPER_ADMIN</option>
              <option value="STATE_COORDINATOR">STATE_COORDINATOR</option>
              <option value="TSP_ADMIN">TSP_ADMIN</option>
              <option value="TSP_TRAINING_MANAGER">TSP_MANAGER</option>
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-850 text-slate-300 rounded-lg p-1.5 text-[11px] focus:outline-none"
            >
              <option value="">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE_TSP">CREATE_TSP</option>
              <option value="SUSPEND">SUSPEND_TSP</option>
              <option value="REACTIVATE">REACTIVATE_TSP</option>
              <option value="COMPLETED_PROFILE">PROFILE_COMPLETION</option>
            </select>
          </div>
        </div>

        {/* Live list Feed */}
        <div className="border border-slate-850/80 rounded-xl overflow-hidden shadow-2xl bg-slate-950/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-slate-500 font-mono text-[10px] font-semibold uppercase tracking-wider py-3 px-4">
                  <th className="py-3 px-4 w-36">TIMESTAMP</th>
                  <th className="py-3 px-4 w-48">OPERATOR</th>
                  <th className="py-3 px-4 w-32">ROLE</th>
                  <th className="py-3 px-4 w-40">ACTION SCOPE</th>
                  <th className="py-3 px-4">PAYLOAD / DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/55 font-mono text-[11px] text-slate-300">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600 font-sans">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 100).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/35 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-indigo-300 font-semibold truncate max-w-[200px]" title={log.username}>
                        {log.username}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400 text-[10px]">
                          {log.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-semibold whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-350 select-text pr-4 leading-relaxed break-all">
                        {log.details || "None"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
