/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  CheckCircle, Shield, Award, Users, Search, MapPin, Map, AlertCircle, 
  ChevronLeft, ChevronRight, X, Loader2, RefreshCw, GraduationCap, CheckSquare, Square
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface ClearanceRecord {
  id: string;
  beneficiaryId: string;
  isClearedAttendance: boolean;
  isClearedAssessment: boolean;
  isClearedToolkit: boolean;
  clearedBy: string | null;
  clearedAt: string | null;
  ceremonyEventName: string | null;
  beneficiaryFirstName?: string;
  beneficiaryLastName?: string;
  beneficiaryState?: string;
  beneficiaryTsp?: string;
}

export function GraduationPage() {
  const [clearances, setClearances] = useState<ClearanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter criteria 
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // ALL, CLEARED, PENDING
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Ceremony Modal trigger
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulk, setIsBulk] = useState(false);
  const [singleCandidateId, setSingleCandidateId] = useState("");
  const [ceremonyName, setCeremonyName] = useState("National Unified IDEAS-TVET Graduation Ceremony");
  const [submitting, setSubmitting] = useState(false);

  const fetchClearances = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const url = `/api/graduation/clearances?page=${page}&pageSize=${pageSize}`;
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load clearance records. Response status: ${res.status}`);
      }
      const data = await res.json();
      const rowsList = data.rows || [];

      // Filter locally for state placement and status filters
      let finalRows = rowsList;
      if (searchTerm.trim() || stateFilter || statusFilter) {
        finalRows = rowsList.filter((c: ClearanceRecord) => {
          const name = `${c.beneficiaryFirstName} ${c.beneficiaryLastName}`.toLowerCase();
          const matchSearch = !searchTerm.trim() || 
            name.includes(searchTerm.toLowerCase()) ||
            c.beneficiaryTsp?.toLowerCase().includes(searchTerm.toLowerCase());

          const matchState = !stateFilter || c.beneficiaryState === stateFilter;

          let matchStatus = true;
          if (statusFilter === "CLEARED") {
            matchStatus = !!c.clearedAt;
          } else if (statusFilter === "PENDING") {
            matchStatus = !c.clearedAt;
          }

          return matchSearch && matchState && matchStatus;
        });
      }

      setClearances(finalRows);
      setTotalCount(searchTerm.trim() || stateFilter || statusFilter ? finalRows.length : (data.totalCount || 0));
      setTotalPages(searchTerm.trim() || stateFilter || statusFilter ? Math.ceil(finalRows.length / pageSize) : (data.totalPages || 1));
    } catch (e: any) {
      console.error("[GraduationPage] Error loading clearances directories:", e);
      setError(e.message || "Failed to load national graduation ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClearances();
  }, [page, pageSize, stateFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClearances();
  };

  // Toggle single row selection
  const handleSelectRow = (id: string) => {
    const clone = new Set(selectedIds);
    if (clone.has(id)) {
      clone.delete(id);
    } else {
      clone.add(id);
    }
    setSelectedIds(clone);
  };

  // Select all rows on current page
  const handleSelectAllOnPage = () => {
    const clearIdList = clearances.filter(c => !c.clearedAt).map(c => c.beneficiaryId);
    if (selectedIds.size === clearIdList.length && clearIdList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clearIdList));
    }
  };

  const handleOpenSingleClear = (beneficiaryId: string) => {
    setIsBulk(false);
    setSingleCandidateId(beneficiaryId);
    setCeremonyName("National Unified IDEAS-TVET Graduation Ceremony");
    setIsModalOpen(true);
  };

  const handleOpenBulkClear = () => {
    if (selectedIds.size === 0) {
      alert("No pending candidates selected for approval.");
      return;
    }
    setIsBulk(true);
    setCeremonyName("National Unified IDEAS-TVET Graduation Ceremony");
    setIsModalOpen(true);
  };

  const handleProcessClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isBulk) {
        // Bulk clearance process
        const res = await authFetch("/api/graduation/clear/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beneficiaryIds: Array.from(selectedIds),
            ceremonyEventName: ceremonyName
          })
        });
        if (!res.ok) {
          const detail = await res.json();
          throw new Error(detail.error || "Failed to execute bulk clearance approval.");
        }
      } else {
        // Single clearance process
        const res = await authFetch("/api/graduation/clear/single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beneficiaryId: singleCandidateId,
            ceremonyEventName: ceremonyName
          })
        });
        if (!res.ok) {
          const detail = await res.json();
          throw new Error(detail.error || "Failed to execute single candidate clearance.");
        }
      }

      setIsModalOpen(false);
      fetchClearances();
    } catch (e: any) {
      alert(e.message || "Approval process hit a server side roadblock.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeClearance = async (beneficiaryId: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to revoke the graduation clearance for ${name}? This will decertify the trainee and return them to ACTIVE status.`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/graduation/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId })
      });
      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to suspend clearance.");
      }
      alert("Clearance successfully suspended. Trainee decertified.");
      fetchClearances();
    } catch (e: any) {
      alert(`Error revoking clearance: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCertificate = (candidateName: string) => {
    // Generate text-based mock certificate and trigger local download
    const element = document.createElement("a");
    const file = new Blob([
      `========================================================================\n` +
      `                  NIGER FEDERAL MINISTRY OF EDUCATION\n` +
      `                   FEDERAL TVET ACCREDITATION SCHEME\n` +
      `========================================================================\n\n` +
      `           OFFICIAL GRADUATION CERTIFICATE OF COMPETENCY CONFORMANCE\n\n` +
      `This is to certify that candidate: ${candidateName.toUpperCase()}\n` +
      `has successfully verified all required elements of training attendance,\n` +
      `performed satisfactory practical and Continuous Assessment examinations,\n` +
      `and received a verified and state-cleared graduate startup toolkit.\n\n` +
      `Under the active sponsorship of the IDEAS-TVET multi-tenant initiative,\n` +
      `this graduate is hereby certified as fully competent.\n\n` +
      `Federal Review Commissioner signature: OKOROAFOR B.\\\n` +
      `Date of issuance: ${new Date().toLocaleDateString()}\n` +
      `Authenticity Verification Hash: #${Math.floor(Math.random() * 900000000 + 100000000)}\n\n` +
      `========================================================================\n`
    ], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${candidateName.replace(/\s+/g, "_")}_Competency_Certificate.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="graduation-centre-container" className="space-y-6 animate-in fade-in duration-300 text-left">
      
      {/* Title & Bulk buttons Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Central Graduation registry
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Evaluate attendance, assessment, and toolkit compliance checkmarks; authorize final certifications.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 self-start sm:self-center">
          {clearances.filter(c => !!c.clearedAt).length > 0 && (
            <button
              onClick={() => {
                const clearedList = clearances.filter(c => !!c.clearedAt);
                if (confirm(`Do you wish to batch download official certificates for all ${clearedList.length} cleared candidates on this page?`)) {
                  clearedList.forEach(c => {
                    handleDownloadCertificate(`${c.beneficiaryFirstName} ${c.beneficiaryLastName}`);
                  });
                }
              }}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <Award className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>Batch Download Certificates ({clearances.filter(c => !!c.clearedAt).length})</span>
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={handleOpenBulkClear}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Clear Selected Candidates ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* filtration row */}
      <div className="bg-white border border-slate-205 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by graduate name or TSP provider..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/40 focus:bg-white border border-slate-205 focus:border-indigo-500 rounded-lg outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-205 hover:bg-slate-50 active:bg-slate-100 rounded-lg shadow-3xs transition cursor-pointer"
          >
            Filter
          </button>
        </form>

        <div className="flex flex-wrap gap-2.5">
          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-350 transition"
          >
            <option value="">All States</option>
            <option value="FCT">FCT Abuja</option>
            <option value="Kano">Kano</option>
            <option value="Lagos">Lagos</option>
            <option value="Kaduna">Kaduna</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-355 transition"
          >
            <option value="">Graduation Clearance</option>
            <option value="CLEARED">Cleared Candidates</option>
            <option value="PENDING">Clearance Pending</option>
          </select>

          <button
            onClick={fetchClearances}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-205 bg-white text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Refresh Graduation Center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Graduation List Grid Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-12 px-5 py-3.5 text-center">
                  <button
                    onClick={handleSelectAllOnPage}
                    className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                    title="Select all pending clearances on page"
                  >
                    <CheckSquare className="w-4.5 h-4.5" />
                  </button>
                </th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Graduate Name</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">State / Location</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Compliance Indicators</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">TSP Service Provider</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Clearance Date</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Clearance Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-450">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="font-semibold text-slate-500">Verifying federal certification eligibilities...</span>
                    </div>
                  </td>
                </tr>
              ) : clearances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No active candidates matching the clearance parameters.
                  </td>
                </tr>
              ) : (
                clearances.map((c) => {
                  const isCleared = !!c.clearedAt;
                  const isSelected = selectedIds.has(c.beneficiaryId);
                  return (
                    <tr key={c.id} className={`transition duration-150 ${isCleared ? "hover:bg-slate-50/40" : isSelected ? "bg-indigo-50/20" : "hover:bg-slate-50"}`}>
                      <td className="px-5 py-4 text-center">
                        {!isCleared ? (
                          <button
                            onClick={() => handleSelectRow(c.beneficiaryId)}
                            className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4.5 h-4.5 text-indigo-600 fill-indigo-50/50" />
                            ) : (
                              <Square className="w-4.5 h-4.5 text-slate-300" />
                            )}
                          </button>
                        ) : (
                          <span className="block h-2 w-2 bg-emerald-500 rounded-full mx-auto" />
                        )}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {c.beneficiaryFirstName} {c.beneficiaryLastName}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600">
                        {c.beneficiaryState || "FCT"}
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-medium">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.isClearedAttendance ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <span className="text-slate-500">Attendance: {c.isClearedAttendance ? "Verified" : "Shortfall"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium1">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.isClearedAssessment ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <span className="text-slate-500">Assessments: {c.isClearedAssessment ? "Approved" : "Pending"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium1">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.isClearedToolkit ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <span className="text-slate-500">Toolkit Check: {c.isClearedToolkit ? "Completed" : "Unissued"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">{c.beneficiaryTsp || "Unique Tech Nig."}</td>
                      <td className="px-5 py-4 text-slate-450 font-mono text-[10px]">{formatDate(c.clearedAt)}</td>
                      <td className="px-5 py-4">
                        {isCleared ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-3xs">
                            <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                            <span>CLEARED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span>UNAUTHORIZED</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isCleared ? (
                          <button
                            onClick={() => handleOpenSingleClear(c.beneficiaryId)}
                            className="p-1 px-2.5 border border-indigo-200 text-indigo-600 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 rounded-md transition shadow-3xs cursor-pointer text-[10px] font-extrabold"
                          >
                            Clear Candidate
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDownloadCertificate(`${c.beneficiaryFirstName} ${c.beneficiaryLastName}`)}
                              className="p-1 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 rounded-md transition shadow-3xs cursor-pointer text-[10px] font-bold flex items-center gap-1"
                              title="Download Competency Certificate"
                            >
                              <Award className="w-3 h-3" />
                              <span>Certificate</span>
                            </button>
                            <button
                              onClick={() => handleRevokeClearance(c.beneficiaryId, `${c.beneficiaryFirstName} ${c.beneficiaryLastName}`)}
                              className="p-1 px-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-md transition shadow-3xs cursor-pointer text-[10px] font-bold"
                              title="Revoke graduation and decertify"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination component */}
        {!loading && totalCount > 0 && (
          <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-450 font-semibold uppercase tracking-wider">
              Displaying clearance directory {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-205 bg-white text-slate-600 rounded-md transition cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono text-xs font-bold text-slate-705">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-205 bg-white text-slate-600 rounded-md transition cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ACCREDITATION CEREMONY DETAILS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-150 flex items-center justify-between text-slate-805">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">Clear Candidate Graduation</span>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleProcessClearance} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed font-medium">
                {isBulk 
                  ? `You are about to authorize central graduation clearance for the ${selectedIds.size} select candidate(s) under federal oversight.`
                  : "You are about to evaluate and authorize central graduation clearance for this select candidate."
                }
              </p>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Official Graduation Event / Ceremony Name</label>
                <input
                  type="text"
                  required
                  value={ceremonyName}
                  onChange={(e) => setCeremonyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-205 text-slate-600 hover:bg-slate-5 border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Grant clearance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
