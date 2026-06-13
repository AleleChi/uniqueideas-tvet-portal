/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Search, Edit2, Trash2, Calendar, AlertCircle, 
  ChevronLeft, ChevronRight, X, Loader2, RefreshCw, CheckCircle2, ListFilter
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface Cohort {
  id: string;
  tenantId?: string;
  name: string;
  cohortYear: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdBy?: string;
  createdAt?: string;
}

export function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Cohorts
  const fetchCohorts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/cohorts?search=${encodeURIComponent(searchTerm)}&page=${page}&pageSize=${pageSize}`;
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load cohorts. Server returned status: ${res.status}`);
      }
      const data = await res.json();
      setCohorts(data.rows || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      console.error("[CohortsPage] Failed to fetch cohorts:", e);
      setError(e.message || "Failed to load national cohorts registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCohorts();
  }, [page, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCohorts();
  };

  const handleOpenCreate = () => {
    setFormName("");
    setFormYear(new Date().getFullYear());
    setFormStartDate("");
    setFormEndDate("");
    setFormStatus("ACTIVE");
    setSubmitError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setFormName(cohort.name);
    setFormYear(cohort.cohortYear);
    setFormStartDate(cohort.startDate ? cohort.startDate.substring(0, 10) : "");
    setFormEndDate(cohort.endDate ? cohort.endDate.substring(0, 10) : "");
    setFormStatus(cohort.status);
    setSubmitError(null);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setIsDeleteOpen(true);
  };

  // POST Create
  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formYear) {
      setSubmitError("Name and Year are required fields");
      return;
    }
    if (formStartDate && formEndDate && new Date(formStartDate) > new Date(formEndDate)) {
      setSubmitError("Cohort Start Date cannot be after End Date.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch("/api/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          cohortYear: formYear,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          status: formStatus
        })
      });
      if (!res.ok) {
        const errDetail = await res.json();
        throw new Error(errDetail.error || "Failed to establish a new cohort");
      }
      setIsCreateOpen(false);
      fetchCohorts();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // PUT Edit
  const handleEditCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCohort) return;
    if (!formName.trim() || !formYear) {
      setSubmitError("Name and Year are required fields");
      return;
    }
    if (formStartDate && formEndDate && new Date(formStartDate) > new Date(formEndDate)) {
      setSubmitError("Cohort Start Date cannot be after End Date.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch(`/api/cohorts/${selectedCohort.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          cohortYear: formYear,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          status: formStatus
        })
      });
      if (!res.ok) {
        const errDetail = await res.json();
        throw new Error(errDetail.error || "Failed to update cohort properties");
      }
      setIsEditOpen(false);
      fetchCohorts();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // DELETE Confirm
  const handleDeleteCohort = async () => {
    if (!selectedCohort) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/cohorts/${selectedCohort.id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errDetail = await res.json();
        throw new Error(errDetail.error || "Failed to remove selected cohort");
      }
      setIsDeleteOpen(false);
      fetchCohorts();
    } catch (e: any) {
      alert(`Error deleting cohort: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
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
    <div id="cohorts-page-container" className="space-y-6 animate-in fade-in duration-300 text-left">
      
      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            cohort Registry & Lifecycle
          </h2>
          <p className="text-xs sm:text-sm text-slate-550 text-slate-500 mt-1">
            Systematically plan, review, and lock general training cohorts and academic milestones nationwide.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer text-center sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Form New Cohort</span>
        </button>
      </div>

      {/* Errors Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-205/85 rounded-xl p-4 shadow-3xs flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search cohorts by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-205 focus:border-indigo-500 rounded-lg outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-205 hover:bg-slate-50 active:bg-slate-100/80 rounded-lg shadow-3xs transition cursor-pointer"
          >
            Filter
          </button>
        </form>
        <button
          onClick={fetchCohorts}
          className="flex items-center justify-center p-2 rounded-lg border border-slate-205 bg-white text-slate-500 hover:text-slate-800 transition shadow-2xs cursor-pointer"
          title="Refresh cohort records from database"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Cohorts Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Name</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Year</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Start Date</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">End Date</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Created Date</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-450 hover:text-slate-600">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="font-semibold text-slate-500">Synchronizing registry...</span>
                    </div>
                  </td>
                </tr>
              ) : cohorts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No general cohort profiles matching your specifications were found.
                  </td>
                </tr>
              ) : (
                cohorts.map((cohort) => (
                  <tr key={cohort.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-semibold text-slate-800">{cohort.name}</td>
                    <td className="px-5 py-4 font-mono font-medium text-slate-650">{cohort.cohortYear}</td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(cohort.startDate)}</td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(cohort.endDate)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider font-sans uppercase ${
                        cohort.status === "ACTIVE" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : cohort.status === "COMPLETED" 
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                          : "bg-slate-50 text-slate-600 border border-slate-200"
                      }`}>
                        {cohort.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-550 text-slate-400 font-mono text-[10px]">{formatDate(cohort.createdAt || null)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(cohort)}
                          className="p-1 px-2.5 border border-slate-205 text-slate-600 hover:text-indigo-650 hover:bg-indigo-50 hover:border-indigo-250 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition shadow-3xs cursor-pointer text-[10px] font-bold"
                        >
                          <Edit2 className="w-3 h-3 inline mr-1" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleOpenDelete(cohort)}
                          className="p-1 px-2.5 border border-slate-205 text-rose-500 hover:text-white hover:bg-rose-600 hover:border-rose-600 rounded-md transition shadow-2xs cursor-pointer text-[10px] font-bold"
                        >
                          <Trash2 className="w-3 h-3 inline" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {!loading && totalCount > 0 && (
          <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-450 font-semibold uppercase tracking-wider">
              Itemized listings {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-205 bg-white text-slate-600 hover:text-slate-800 rounded-md transition cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono text-xs font-bold text-slate-705">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-205 bg-white text-slate-600 hover:text-slate-800 rounded-md transition cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE COHORT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Form New Cohort</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCohort} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-[11px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Cohort Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cohort 2026 Batch A"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Cohort Year *</label>
                <input
                  type="number"
                  required
                  value={formYear}
                  onChange={(e) => setFormYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-205 text-slate-600 hover:bg-slate-50 duration-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-705 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Forming..." : "Form Cohort"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COHORT MODAL */}
      {isEditOpen && selectedCohort && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Modify Cohort Parameters</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-755 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleEditCohort} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-[11px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Cohort Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Cohort Year *</label>
                <input
                  type="number"
                  required
                  value={formYear}
                  onChange={(e) => setFormYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-205 text-slate-600 hover:bg-slate-50 duration-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteOpen && selectedCohort && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-xs">
            <div className="px-4 py-3.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-rose-800">
              <span className="font-bold uppercase tracking-wider text-[11px]">Confirm Permanent Removal</span>
              <button onClick={() => setIsDeleteOpen(false)} className="text-rose-500 hover:text-rose-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-600 leading-normal">
                Are you absolutely sure you want to delete the general cohort profile <strong className="text-slate-900 font-bold">"{selectedCohort.name}"</strong>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-3.5 py-2 border border-slate-205 text-slate-650 hover:bg-slate-50 duration-200 rounded-lg cursor-pointer"
                >
                  Retain Profile
                </button>
                <button
                  onClick={handleDeleteCohort}
                  disabled={submitting}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Removing..." : "Confirm Removal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
