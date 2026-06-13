/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Search, Cpu, Calendar, Landmark, BookOpen, AlertCircle, 
  ChevronLeft, ChevronRight, X, Loader2, RefreshCw, Layers,
  Edit2, Trash2, Check, Users
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface Batch {
  id: string;
  tenantId: string | null;
  tspId: string | null;
  cohortId: string | null;
  trainingProgramId: string | null;
  batchNumber: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: string;
  cohortName?: string;
  programName?: string;
  tspName?: string;
}

export function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selector datasets
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [knownTsps, setKnownTsps] = useState<Array<{ id: string; name: string }>>([]);

  // Filter conditions
  const [searchTerm, setSearchTerm] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [tspFilter, setTspFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // Form states
  const [formBatchNumber, setFormBatchNumber] = useState("");
  const [formCohortId, setFormCohortId] = useState("");
  const [formTspId, setFormTspId] = useState("");
  const [formProgramId, setFormProgramId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formCapacity, setFormCapacity] = useState(30);
  const [formStatus, setFormStatus] = useState("ACTIVE");

  // Trainee assignment states
  const [unassignedTrainees, setUnassignedTrainees] = useState<any[]>([]);
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);

  // Trainees counting
  const [traineeCountMap, setTraineeCountMap] = useState<Record<string, number>>({});

  const loadDependencies = async () => {
    try {
      // 1. Fetch cohorts
      const cohortsRes = await authFetch("/api/cohorts?page=1&pageSize=100");
      if (cohortsRes.ok) {
        const cData = await cohortsRes.json();
        setCohorts(cData.rows || []);
      }

      // 2. Fetch programs
      const progRes = await authFetch("/api/training-programs");
      if (progRes.ok) {
        const pData = await progRes.json();
        setPrograms(Array.isArray(pData) ? pData : []);
      } else {
        // Fallback robust standard programs
        setPrograms([
          { id: "prog_hardware", name: "Computer Hardware Repair \& Services" },
          { id: "prog_phone", name: "Cell Phone Repairs \& Software Engineering" },
          { id: "prog_tvet_tech", name: "Strategic TVET Tech Track" }
        ]);
      }

      // 3. Fetch beneficiaries for counting trainees assigned to batches
      const benRes = await authFetch("/api/beneficiaries");
      if (benRes.ok) {
        const data = await benRes.json();
        const counts: Record<string, number> = {};
        if (Array.isArray(data)) {
          data.forEach((b: any) => {
            const bId = b.training_batch_id || b.trainingBatchId;
            if (bId) {
              counts[bId] = (counts[bId] || 0) + 1;
            }
          });
        }
        setTraineeCountMap(counts);
      }
    } catch (e) {
      console.error("[BatchesPage] Error loading dependent drop-downs:", e);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/training-batches?page=${page}&pageSize=${pageSize}`;
      if (cohortFilter) url += `&cohortId=${encodeURIComponent(cohortFilter)}`;
      if (tspFilter) url += `&tspId=${encodeURIComponent(tspFilter)}`;
      
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load training batches. Status: ${res.status}`);
      }
      const data = await res.json();
      const rowsList = data.rows || [];
      
      // Filter rows locally if simple search string is entered
      let finalRows = rowsList;
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        finalRows = rowsList.filter((b: Batch) => 
          b.batchNumber?.toLowerCase().includes(search) ||
          b.programName?.toLowerCase().includes(search) ||
          b.tspName?.toLowerCase().includes(search) ||
          b.cohortName?.toLowerCase().includes(search)
        );
      }

      setBatches(finalRows);
      setTotalCount(searchTerm.trim() ? finalRows.length : (data.totalCount || 0));
      setTotalPages(searchTerm.trim() ? Math.ceil(finalRows.length / pageSize) : (data.totalPages || 1));

      // Extract unique TSPs on-the-fly to populate the search filter dropdown dynamically
      const discoveredTsps: Array<{ id: string; name: string }> = [];
      const seenIds = new Set<string>();

      rowsList.forEach((r: Batch) => {
        if (r.tspId && r.tspName && !seenIds.has(r.tspId)) {
          seenIds.add(r.tspId);
          discoveredTsps.push({ id: r.tspId, name: r.tspName });
        }
      });

      // Ensure at least one standard fallback TSP option is present for new batches
      const backupTspId = "550e8400-e29b-41d4-a716-446655440000"; // Valid fallback UUID format
      if (!seenIds.has(backupTspId)) {
        discoveredTsps.push({ id: backupTspId, name: "Unique Technology Nig. Ltd" });
      }

      setKnownTsps(discoveredTsps);
    } catch (e: any) {
      console.error("[BatchesPage] Failed to fetch training batches:", e);
      setError(e.message || "Failed to load national training batches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
    fetchBatches();
  }, [page, pageSize, cohortFilter, tspFilter]);

  const handleSearchClick = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBatches();
  };

  const handleOpenCreate = () => {
    setFormBatchNumber("");
    setFormCohortId(cohorts[0]?.id || "");
    setFormTspId(knownTsps[0]?.id || "550e8400-e29b-41d4-a716-446655440000");
    setFormProgramId(programs[0]?.id || "prog_hardware");
    setFormStartDate("");
    setFormEndDate("");
    setFormCapacity(30);
    setFormStatus("ACTIVE");
    setSubmitError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (batch: Batch) => {
    setSelectedBatch(batch);
    setFormBatchNumber(batch.batchNumber || "");
    setFormCohortId(batch.cohortId || "");
    setFormTspId(batch.tspId || "");
    setFormProgramId(batch.trainingProgramId || "");
    setFormStartDate(batch.startDate ? batch.startDate.substring(0, 10) : "");
    setFormEndDate(batch.endDate ? batch.endDate.substring(0, 10) : "");
    setFormCapacity(batch.capacity || 30);
    setFormStatus(batch.status || "ACTIVE");
    setSubmitError(null);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (batch: Batch) => {
    setSelectedBatch(batch);
    const assignedCount = traineeCountMap[batch.id] || 0;
    if (assignedCount > 0) {
      alert(`Conflict: Cannot delete Batch ${batch.batchNumber} while it has ${assignedCount} active trainee assignments. Deassign trainees first.`);
      return;
    }
    setIsDeleteOpen(true);
  };

  const handleOpenAssign = async (batch: Batch) => {
    setSelectedBatch(batch);
    setAssignLoading(true);
    setSelectedTraineeIds(new Set());
    setSubmitError(null);
    try {
      const res = await authFetch("/api/beneficiaries");
      if (res.ok) {
        const list = await res.json();
        const verifiedList = Array.isArray(list) ? list : [];
        setUnassignedTrainees(verifiedList);

        // Pre-populate already assigned trainees
        const initiallySelected = new Set<string>();
        verifiedList.forEach((b: any) => {
          const bBatchId = b.training_batch_id || b.trainingBatchId;
          if (bBatchId === batch.id) {
            initiallySelected.add(b.id);
          }
        });
        setSelectedTraineeIds(initiallySelected);
        setIsAssignOpen(true);
      } else {
        throw new Error("Failed to load beneficiary directory.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to fetch trainee list.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleToggleTrainee = (id: string) => {
    const clone = new Set(selectedTraineeIds);
    if (clone.has(id)) {
      clone.delete(id);
    } else {
      clone.add(id);
    }
    setSelectedTraineeIds(clone);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBatchNumber || !formCohortId || !formTspId || !formProgramId || !formStartDate || !formEndDate) {
      setSubmitError("All required fields must be completed.");
      return;
    }
    if (formStartDate && formEndDate && new Date(formStartDate) > new Date(formEndDate)) {
      setSubmitError("Start date cannot be after end date.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch("/api/training-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber: formBatchNumber,
          cohortId: formCohortId,
          tspId: formTspId,
          trainingProgramId: formProgramId,
          startDate: formStartDate,
          endDate: formEndDate,
          capacity: formCapacity,
          status: formStatus
        })
      });

      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to finalize training batch schedule.");
      }

      setIsCreateOpen(false);
      fetchBatches();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    if (!formBatchNumber || !formCohortId || !formTspId || !formProgramId || !formStartDate || !formEndDate) {
      setSubmitError("All required fields must be completed.");
      return;
    }
    if (formStartDate && formEndDate && new Date(formStartDate) > new Date(formEndDate)) {
      setSubmitError("Start date cannot be after end date.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch(`/api/training-batches/${selectedBatch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber: formBatchNumber,
          cohortId: formCohortId,
          tspId: formTspId,
          trainingProgramId: formProgramId,
          startDate: formStartDate,
          endDate: formEndDate,
          capacity: formCapacity,
          status: formStatus
        })
      });

      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to update training batch details.");
      }

      setIsEditOpen(false);
      fetchBatches();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/training-batches/${selectedBatch.id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to delete training batch.");
      }
      setIsDeleteOpen(false);
      fetchBatches();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Find what needs to be assigned and removed
      const currentAssignedIds = new Set<string>();
      unassignedTrainees.forEach((b: any) => {
        const bBatchId = b.training_batch_id || b.trainingBatchId;
        if (bBatchId === selectedBatch.id) {
          currentAssignedIds.add(b.id);
        }
      });

      const toAssign: string[] = [];
      selectedTraineeIds.forEach(id => {
        if (!currentAssignedIds.has(id)) {
          toAssign.push(id);
        }
      });

      const toRemove: string[] = [];
      currentAssignedIds.forEach(id => {
        if (!selectedTraineeIds.has(id)) {
          toRemove.push(id);
        }
      });

      if (toAssign.length > 0) {
        const assignRes = await authFetch(`/api/training-batches/${selectedBatch.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ traineeIds: toAssign })
        });
        if (!assignRes.ok) {
          const detail = await assignRes.json();
          throw new Error(detail.error || "Failed to complete trainee assignments.");
        }
      }

      if (toRemove.length > 0) {
        const removeRes = await authFetch(`/api/training-batches/${selectedBatch.id}/remove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ traineeIds: toRemove })
        });
        if (!removeRes.ok) {
          const detail = await removeRes.json();
          throw new Error(detail.error || "Failed to remove trainees from batch.");
        }
      }

      setIsAssignOpen(false);
      fetchBatches();
      loadDependencies(); // refresh trainee counts
    } catch (e: any) {
      setSubmitError(e.message);
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
    <div id="batches-page-container" className="space-y-6 animate-in fade-in duration-300 text-left">
      
      {/* Title & Add Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Training Batches registry
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create, assign, schedule, and authorize capacity profiles for accredited training batches.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Instate Batch</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-250 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Searching & Filter Bar */}
      <div className="bg-white border border-slate-205 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchClick} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by batch number or program..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/40 focus:bg-white border border-slate-205 focus:border-indigo-500 rounded-lg outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-205 hover:bg-slate-50 active:bg-slate-100 rounded-lg shadow-3xs transition cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2.5">
          {/* Cohort Filter */}
          <select
            value={cohortFilter}
            onChange={(e) => { setCohortFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-300 transition"
          >
            <option value="">All Cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* TSP Filter */}
          <select
            value={tspFilter}
            onChange={(e) => { setTspFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-300 transition"
          >
            <option value="">All TSPs</option>
            {knownTsps.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button
            onClick={fetchBatches}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-205 bg-white text-slate-550 hover:text-slate-800 transition cursor-pointer"
            title="Refresh registry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Batches Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Batch Number</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Cohort</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">TSP Provider</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Programme Track</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Start Date</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">End Date</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Capacity</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Utilization</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-450">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-650" />
                      <span className="font-semibold text-slate-500">Retrieving training batch directories...</span>
                    </div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    No active or scheduled batches matching selection parameters.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const assignedCount = traineeCountMap[batch.id] || 0;
                  const isFull = assignedCount >= batch.capacity;
                  const percent = Math.min(100, Math.round((assignedCount / batch.capacity) * 100));
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-bold text-slate-900 font-mono">
                        Batch {batch.batchNumber}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{batch.cohortName || "N/A"}</td>
                      <td className="px-5 py-4 text-indigo-600 font-semibold">{batch.tspName || "Unique Tech Nig."}</td>
                      <td className="px-5 py-4 text-slate-600 max-w-[150px] truncate" title={batch.programName || ""}>
                        {batch.programName || "General Repair Services"}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-550">{formatDate(batch.startDate)}</td>
                      <td className="px-5 py-4 font-mono text-slate-550">{formatDate(batch.endDate)}</td>
                      <td className="px-5 py-4 font-mono text-center font-bold text-slate-700">{batch.capacity}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={`font-mono font-bold ${isFull ? "text-rose-600" : "text-emerald-700"}`}>
                              {assignedCount} / {batch.capacity}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isFull ? "bg-rose-500" : "bg-emerald-500"}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                          batch.status === "ACTIVE" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-slate-50 text-slate-600 border border-slate-200"
                        }`}>
                          {batch.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAssign(batch)}
                            className="p-1 px-2 border border-indigo-200 text-indigo-600 hover:text-white hover:bg-indigo-650 hover:border-indigo-650 rounded-md transition cursor-pointer text-[10px] font-bold flex items-center gap-1 shadow-3xs"
                            title="Manage Trainee Assignments"
                          >
                            <Users className="w-3 h-3" />
                            <span>Assign</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(batch)}
                            className="p-1 border border-slate-205 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition cursor-pointer shadow-3xs"
                            title="Edit Schedule"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(batch)}
                            className="p-1 border border-slate-205 text-rose-600 hover:text-white hover:bg-rose-600 hover:border-rose-600 rounded-md transition cursor-pointer shadow-3xs"
                            title="Delete Batch"
                          >
                            <Trash2 className="w-3 h-3" />
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

        {/* Pagination bar */}
        {!loading && totalCount > 0 && (
          <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-450 font-semibold uppercase tracking-wider">
              Displaying batches {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} records
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

      {/* CREATE BATCH SCHEDULE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Instate accredited Training Batch</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateBatch} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-750 p-2.5 rounded-lg text-[10px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Batch Identifier / Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1, 2, B-3"
                  value={formBatchNumber}
                  onChange={(e) => setFormBatchNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Cohort Association *</label>
                  <select
                    value={formCohortId}
                    onChange={(e) => setFormCohortId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Cohort...</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">TSP Service Provider *</label>
                  <select
                    value={formTspId}
                    onChange={(e) => setFormTspId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="">Select TSP...</option>
                    {knownTsps.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Academic Training Program *</label>
                <select
                  value={formProgramId}
                  onChange={(e) => setFormProgramId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                >
                  <option value="">Select Programme...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Maximum Capacity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Scheduling..." : "Establish Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BATCH MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Modify Training Batch Schedule</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleEditBatch} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-750 p-2.5 rounded-lg text-[10px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Batch Identifier / Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1, 2, B-3"
                  value={formBatchNumber}
                  onChange={(e) => setFormBatchNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Cohort Association *</label>
                  <select
                    value={formCohortId}
                    onChange={(e) => setFormCohortId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Cohort...</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">TSP Service Provider *</label>
                  <select
                    value={formTspId}
                    onChange={(e) => setFormTspId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="">Select TSP...</option>
                    {knownTsps.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Academic Training Program *</label>
                <select
                  value={formProgramId}
                  onChange={(e) => setFormProgramId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                >
                  <option value="">Select Programme...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Maximum Capacity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
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
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TRAINEES TO BATCH MODAL */}
      {isAssignOpen && selectedBatch && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Manage Trainee Assignments</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Batch {selectedBatch.batchNumber} - Capacity: {selectedBatch.capacity}</p>
              </div>
              <button onClick={() => setIsAssignOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveAssignment} className="p-5 space-y-4">
              {submitError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-750 p-2.5 rounded-lg text-xs leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="text-xs text-slate-500 leading-relaxed bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>
                  Check beneficiaries you wish to assign to this batch. Unchecking a trainee will remove them from the batch. Disabled trainees are already assigned to details in another batch.
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-150 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {unassignedTrainees.filter((b: any) => {
                  const bBatchId = b.training_batch_id || b.trainingBatchId;
                  return !bBatchId || bBatchId === selectedBatch.id;
                }).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No unassigned beneficiaries available in this tenant sector.
                  </div>
                ) : (
                  unassignedTrainees.filter((b: any) => {
                    const bBatchId = b.training_batch_id || b.trainingBatchId;
                    return !bBatchId || bBatchId === selectedBatch.id;
                  }).map((trainee: any) => {
                    const isChecked = selectedTraineeIds.has(trainee.id);
                    return (
                      <div 
                        key={trainee.id}
                        onClick={() => handleToggleTrainee(trainee.id)}
                        className="flex items-center justify-between p-3 hover:bg-white transition cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? "bg-indigo-600 border-indigo-650 text-white" : "border-slate-300 bg-white"}`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{trainee.first_name || trainee.firstName} {trainee.last_name || trainee.lastName}</p>
                            <p className="text-[10px] text-slate-400">ID: {trainee.id_number || trainee.idNumber || "N/A"} • Program: {trainee.program_name || trainee.programName || "TVET Track"}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isChecked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {isChecked ? "Assigned" : "Available"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="font-mono text-[10px] text-slate-450 font-bold">
                  {selectedTraineeIds.size} / {selectedBatch.capacity} SEATS SELECTED
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignOpen(false)}
                    className="px-4 py-2 border border-slate-205 text-slate-600 hover:bg-slate-50 duration-200 rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Commit Seats"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {isDeleteOpen && selectedBatch && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 rounded-full text-rose-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-850">Remove Training Batch</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Are you absolutely certain you wish to purge Batch {selectedBatch.batchNumber}? This operation is soft-irreversible.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-3 py-2 border border-slate-205 text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBatch}
                  disabled={submitting}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition font-bold disabled:opacity-50"
                >
                  {submitting ? "Purging..." : "Confirm Purge"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
