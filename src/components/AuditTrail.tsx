/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShieldCheck, Search, Filter, History, Trash2, Calendar } from "lucide-react";
import { AuditLog } from "../types";
import { PaginationControl } from "./PaginationControl";

interface AuditTrailProps {
  logs: AuditLog[];
}

export function AuditTrail({ logs }: AuditTrailProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter]);

  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase();
    const matchesSearch = 
      log.username.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q);
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      
      {/* Search and action filtering */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <div className="flex-1 flex gap-2.5 items-center w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Filter audits by Admin email, action keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg text-xs text-slate-700"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
          >
            <option value="all">All Logs Action Paths</option>
            <option value="SECURITY_LOGIN">Admin Successful Sign-in</option>
            <option value="BENEFICIARY_CREATE">Candidate Enrollment Creation</option>
            <option value="FIELD_CREATE">Modified Custom Fields metadata</option>
            <option value="EXCEL_EXPORT">Excel Worksheet CSV downloads</option>
          </select>
        </div>
      </div>

      {/* Logging Worksheet tables */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50/70 p-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-display font-semibold text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            AUTHENTICATED SECURITY OPERATIONS AUDIT TRAIL
          </h4>
          <span className="text-[10px] font-mono text-slate-400">Total Audit Logs: {filteredLogs.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                <th className="py-3 px-4">TIMESTAMP</th>
                <th className="py-3 px-4">OPERATOR ACCOUNT</th>
                <th className="py-3 px-4">SECURITY ACTION</th>
                <th className="py-3 px-4">OPERATION DETAILS SUMMARY</th>
                <th className="py-3 px-4 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-600">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No transactions auditted matching current filter parameter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                      {log.username}
                      <span className="block text-[9px] text-slate-400 font-normal">{log.role}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes("FAILED") 
                          ? "bg-rose-50 text-rose-700 border border-rose-100" 
                          : log.action.includes("SECURITY") 
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-bold">
                        COMMIT_OK
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
