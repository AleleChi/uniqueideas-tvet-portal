/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Search, ShieldCheck, Award, Mail, Phone, AlertCircle, 
  ChevronLeft, ChevronRight, X, Loader2, RefreshCw, CheckCircle2, XCircle
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface Trainer {
  id: string;
  tenantId: string | null;
  tspId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  accreditationDetails: string | null;
  isNbteCertified: boolean;
  status: string;
}

export function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selector / mappings
  const [knownTsps, setKnownTsps] = useState<Array<{ id: string; name: string }>>([
    { id: "550e8400-e29b-41d4-a716-446655440000", name: "Unique Technology Nig. Ltd" }
  ]);

  // Searching & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [nbteFilter, setNbteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tspFilter, setTspFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal and edit structures
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAccreditation, setFormAccreditation] = useState("");
  const [formIsNbte, setFormIsNbte] = useState(false);
  const [formTspId, setFormTspId] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");

  const loadKnownTsps = async () => {
    try {
      const res = await authFetch("/api/training-batches?page=1&pageSize=100");
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        const map = new Map<string, string>();
        rows.forEach((r: any) => {
          if (r.tspId && r.tspName) {
            map.set(r.tspId, r.tspName);
          }
        });
        if (map.size > 0) {
          const list: Array<{ id: string; name: string }> = [];
          map.forEach((name, id) => {
            list.push({ id, name });
          });
          setKnownTsps(list);
        }
      }
    } catch (e) {
      console.error("[TrainersPage] Error locating available TSPs:", e);
    }
  };

  const fetchTrainers = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/trainers?page=${page}&pageSize=${pageSize}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load trainers catalog. Response code: ${res.status}`);
      }
      const data = await res.json();
      const rowsList = data.rows || [];

      // Filter locally for name searching, NBTE certification, and TSP
      let finalRows = rowsList;
      if (searchTerm.trim() || nbteFilter || tspFilter) {
        finalRows = rowsList.filter((t: Trainer) => {
          const matchName = !searchTerm.trim() || 
            `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.email?.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchNbte = !nbteFilter ||
            (nbteFilter === "YES" && t.isNbteCertified) ||
            (nbteFilter === "NO" && !t.isNbteCertified);

          const matchTsp = !tspFilter || t.tspId === tspFilter;
          
          return matchName && matchNbte && matchTsp;
        });
      }

      setTrainers(finalRows);
      setTotalCount((searchTerm.trim() || nbteFilter || tspFilter) ? finalRows.length : (data.totalCount || 0));
      setTotalPages((searchTerm.trim() || nbteFilter || tspFilter) ? Math.ceil(finalRows.length / pageSize) : (data.totalPages || 1));
    } catch (e: any) {
      console.error("[TrainersPage] Failed to fetch trainers:", e);
      setError(e.message || "Failed to load national trainers directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnownTsps();
    fetchTrainers();
  }, [page, pageSize, statusFilter, tspFilter, nbteFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTrainers();
  };

  const handleOpenCreate = () => {
    setFormFirstName("");
    setFormLastName("");
    setFormEmail("");
    setFormPhone("");
    setFormAccreditation("");
    setFormIsNbte(false);
    setFormTspId(knownTsps[0]?.id || "");
    setFormStatus("ACTIVE");
    setSubmitError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    setFormFirstName(trainer.firstName);
    setFormLastName(trainer.lastName);
    setFormEmail(trainer.email || "");
    setFormPhone(trainer.phone || "");
    setFormAccreditation(trainer.accreditationDetails || "");
    setFormIsNbte(trainer.isNbteCertified);
    setFormTspId(trainer.tspId || "");
    setFormStatus(trainer.status);
    setSubmitError(null);
    setIsEditOpen(true);
  };

  // POST Create Trainer
  const handleCreateTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formLastName.trim()) {
      setSubmitError("First Name and Last Name are required fields.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch("/api/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formFirstName,
          lastName: formLastName,
          email: formEmail || null,
          phone: formPhone || null,
          accreditationDetails: formAccreditation || null,
          isNbteCertified: formIsNbte,
          tspId: formTspId || null,
          status: formStatus
        })
      });
      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to register trainer.");
      }
      setIsCreateOpen(false);
      fetchTrainers();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // PUT Edit Trainer
  const handleEditTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainer) return;
    if (!formFirstName.trim() || !formLastName.trim()) {
      setSubmitError("First Name and Last Name are required fields.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch(`/api/trainers/${selectedTrainer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formFirstName,
          lastName: formLastName,
          email: formEmail || null,
          phone: formPhone || null,
          accreditationDetails: formAccreditation || null,
          isNbteCertified: formIsNbte,
          tspId: formTspId || null,
          status: formStatus
        })
      });
      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to modify trainer credentials.");
      }
      setIsEditOpen(false);
      fetchTrainers();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (trainer: Trainer) => {
    const freshStatus = trainer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await authFetch(`/api/trainers/${trainer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...trainer,
          status: freshStatus
        })
      });
      if (res.ok) {
        fetchTrainers();
      } else {
        alert("Failed to toggle status flag.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div id="trainers-page-container" className="space-y-6 animate-in fade-in duration-300 text-left">
      
      {/* Title & Register Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            trainers directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor state accreditation lists, register qualified experts, and toggle NBTE certification standings.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Accredit Trainer</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter / Search section */}
      <div className="bg-white border border-slate-205 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by first name, last name or email..."
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
          {/* TSP filter */}
          <select
            value={tspFilter}
            onChange={(e) => { setTspFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-350 transition"
          >
            <option value="">All TSPs</option>
            {knownTsps.map((tsp) => (
              <option key={tsp.id} value={tsp.id}>{tsp.name}</option>
            ))}
          </select>

          {/* NBTE Filter */}
          <select
            value={nbteFilter}
            onChange={(e) => { setNbteFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-350 transition"
          >
            <option value="">Accreditation (NBTE)</option>
            <option value="YES">Certified Only</option>
            <option value="NO">Uncertified Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-350 transition"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <button
            onClick={fetchTrainers}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-205 bg-white text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Refresh Trainers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trainers Listing Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Full Name</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Contact Details</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Specialization</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">NBTE Certified</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Assigned TSP</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-105 divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-450">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="font-semibold text-slate-500">Synchronizing trainers database...</span>
                    </div>
                  </td>
                </tr>
              ) : trainers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No registered trainers match selection parameters.
                  </td>
                </tr>
              ) : (
                trainers.map((trainer) => {
                  const assignedTspName = knownTsps.find(t => t.id === trainer.tspId)?.name || "Unique Technology Nig. Ltd";
                  return (
                    <tr key={trainer.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {trainer.firstName} {trainer.lastName}
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        {trainer.email && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Mail className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{trainer.email}</span>
                          </div>
                        )}
                        {trainer.phone && (
                          <div className="flex items-center gap-1.5 text-slate-450">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{trainer.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">
                        {trainer.accreditationDetails || "General repairs expert"}
                      </td>
                      <td className="px-5 py-4">
                        {trainer.isNbteCertified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            <span>Certified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            <span>Uncertified</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-sky-750 text-sky-700">{assignedTspName}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleStatus(trainer)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border cursor-pointer hover:opacity-80 transition ${
                            trainer.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {trainer.status}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(trainer)}
                          className="p-1 px-2.5 border border-slate-205 text-slate-600 hover:text-indigo-650 hover:bg-slate-100 rounded-md transition shadow-3xs cursor-pointer text-[10px] font-bold"
                        >
                          Modify
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-450 font-semibold uppercase tracking-wider">
              Displaying trainers {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} records
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

      {/* REGISTER / ACCREDIT TRAINER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Accredit Trainer profile</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTrainer} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-750 p-2.5 rounded-lg text-[10px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doe"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Phone Line</label>
                  <input
                    type="text"
                    placeholder="+234..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Accellation / Specialization Detail</label>
                <input
                  type="text"
                  placeholder="e.g. Computer hardware, screen repairs..."
                  value={formAccreditation}
                  onChange={(e) => setFormAccreditation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Assigned TSP Center</label>
                  <select
                    value={formTspId}
                    onChange={(e) => setFormTspId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    {knownTsps.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-150 rounded-lg">
                <input
                  id="create-is-nbte-cert"
                  type="checkbox"
                  checked={formIsNbte}
                  onChange={(e) => setFormIsNbte(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="create-is-nbte-cert" className="font-semibold text-slate-700 cursor-pointer">
                  Accredited & Certified by NBTE
                </label>
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
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Accrediting..." : "Establish Trainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TRAINER REGISTRY MODAL */}
      {isEditOpen && selectedTrainer && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Modify Trainer properties</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleEditTrainer} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-755 p-2.5 rounded-lg text-[10px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Phone Line</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Accellation / Specialization Detail</label>
                <input
                  type="text"
                  value={formAccreditation}
                  onChange={(e) => setFormAccreditation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Assigned TSP Center</label>
                  <select
                    value={formTspId}
                    onChange={(e) => setFormTspId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    {knownTsps.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-150 rounded-lg">
                <input
                  id="edit-is-nbte-cert"
                  type="checkbox"
                  checked={formIsNbte}
                  onChange={(e) => setFormIsNbte(e.target.checked)}
                  className="w-4 h-4 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="edit-is-nbte-cert" className="font-semibold text-slate-700 cursor-pointer">
                  Accredited & Certified by NBTE
                </label>
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

    </div>
  );
}
