/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Award, BookOpen, Clock, Search, Plus, Trash2, 
  RefreshCw, CheckCircle2, ChevronRight, Filter, Bookmark, Landmark
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface TrainingProgram {
  id: string;
  name: string;
  sector: string;
  code: string;
  totalHours: number;
}

export function ProgrammesPage() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSectorFilter, setSelectedSectorFilter] = useState("ALL");
  
  // Creation Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSector, setFormSector] = useState("DIGITAL SKILLS");
  const [formCode, setFormCode] = useState("");
  const [formHours, setFormHours] = useState(120);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "success" | "error" | null; msg: string }>({ status: null, msg: "" });

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/training-programs");
      if (res.ok) {
        const data = await res.json();
        setPrograms(data || []);
      }
    } catch (e: any) {
      console.error("Error loading programs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleAddProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCode) {
      setFeedback({ status: "error", msg: "Please enter Name and unique Program Code." });
      return;
    }
    setSaving(true);
    setFeedback({ status: null, msg: "" });
    try {
      const res = await authFetch("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          sector: formSector,
          code: formCode.toUpperCase().trim(),
          totalHours: formHours
        })
      });

      if (res.ok) {
        setFeedback({ status: "success", msg: "Program successfully registered and accredited nationally!" });
        setFormName("");
        setFormCode("");
        setFormHours(120);
        setTimeout(() => setShowAddForm(false), 2000);
        fetchPrograms();
      } else {
        const err = await res.json();
        setFeedback({ status: "error", msg: err.error || "Failed to accredit program." });
      }
    } catch (err: any) {
      setFeedback({ status: "error", msg: "Network error submitting program." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async (id: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to de-accredit and delete "${name}"? This action is permanent.`)) {
      return;
    }
    try {
      const res = await authFetch(`/api/training-programs/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchPrograms();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete program.");
      }
    } catch (err: any) {
      alert("Network error deleting program.");
    }
  };

  const filteredPrograms = programs.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sector.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = selectedSectorFilter === "ALL" || p.sector.toUpperCase() === selectedSectorFilter.toUpperCase();
    return matchesSearch && matchesSector;
  });

  // Calculate high level sector distributions
  const uniqueSectors = Array.from(new Set(programs.map(p => p.sector.toUpperCase())));

  return (
    <div id="fed-programmes-manager" className="space-y-6 animate-in fade-in duration-200 text-left">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <BookOpen className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
              National TVET Portfolio
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Accredited TVET Programs Registry
          </h2>
          <p className="text-xs text-slate-500 leading-normal">
            Authoritatively govern, register, and audit standard curriculum programs and courses across all active economic sectors.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 hover:scale-[101%] duration-150 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-md shadow-indigo-600/10"
        >
          <Plus className="w-4 h-4" />
          <span>Accredit New Program</span>
        </button>
      </div>

      {/* Grid of basic key counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-150 flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[11px] font-mono text-slate-450 uppercase font-bold">Total Programs</h4>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{programs.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-150 flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[11px] font-mono text-slate-450 uppercase font-bold">Active Sectors</h4>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{uniqueSectors.length || 1}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-150 flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[11px] font-mono text-slate-450 uppercase font-bold">Total Hours Range</h4>
            <p className="text-xl font-bold text-slate-800 mt-0.5">120 - 480 hrs</p>
          </div>
        </div>
      </div>

      {/* Accredit new program form modal/expandable card */}
      {showAddForm && (
        <div className="bg-slate-900 border border-indigo-950/80 rounded-2xl p-6 text-white shadow-xl max-w-xl mx-auto space-y-5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-indigo-950/60 pb-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm tracking-tight text-slate-100">Accredit Real-Time TVET Training Program</h3>
            </div>
            <button 
              onClick={() => setShowAddForm(false)} 
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddProgramSubmit} className="space-y-4 text-xs">
            {feedback.status && (
              <div className={`p-3 rounded-lg font-mono font-medium ${feedback.status === "success" ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/35" : "bg-rose-950/60 text-rose-300 border border-rose-800/35"}`}>
                {feedback.msg}
              </div>
            )}

            <div className="space-y-1 text-left">
              <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Program Title</label>
              <input 
                type="text"
                placeholder="e.g. Advanced Solar Power and Photovoltaic Diagnostics"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 outline-none font-medium text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1 text-left">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Program Code</label>
                <input 
                  type="text"
                  placeholder="e.g. PV-DIAG-60"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 outline-none font-mono text-slate-100"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Training Sector</label>
                <select
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 outline-none text-slate-200"
                >
                  <option value="DIGITAL SKILLS">DIGITAL SKILLS</option>
                  <option value="RENEWABLE ENERGY">RENEWABLE ENERGY</option>
                  <option value="CONSTRUCTION">CONSTRUCTION</option>
                  <option value="HOSPITALITY">HOSPITALITY</option>
                  <option value="AGRICULTURE">AGRICULTURE</option>
                  <option value="CREATIVE ARTS">CREATIVE ARTS</option>
                </select>
              </div>

              <div className="space-y-1 text-left">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Duration (Hours)</label>
                <input 
                  type="number"
                  min={10}
                  max={2000}
                  value={formHours}
                  onChange={(e) => setFormHours(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 outline-none text-slate-100 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider font-sans transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save & Register Program</span>
            </button>
          </form>
        </div>
      )}

      {/* Filters and List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by code, title, or sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSectorFilter}
              onChange={(e) => setSelectedSectorFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-650 font-medium outline-none"
            >
              <option value="ALL">All Sectors</option>
              <option value="DIGITAL SKILLS">DIGITAL SKILLS</option>
              <option value="RENEWABLE ENERGY">RENEWABLE ENERGY</option>
              <option value="CONSTRUCTION">CONSTRUCTION</option>
              <option value="HOSPITALITY">HOSPITALITY</option>
              <option value="AGRICULTURE">AGRICULTURE</option>
            </select>
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-150">
          {loading ? (
            <div className="text-center py-20 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="font-mono text-[10px] text-slate-450 uppercase font-bold tracking-wider">Syncing Programs Portfolio...</p>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/20 text-slate-450 text-xs flex flex-col items-center gap-3">
              <Bookmark className="w-10 h-10 text-slate-300" />
              <div className="font-semibold text-slate-700">No accredited products matched your criteria</div>
              <p className="text-[11px] text-slate-400 max-w-xs leading-normal">
                Try optimizing your search keyword or add a clean program registration up above.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-150 text-slate-500 font-mono text-[10px] uppercase font-bold">
                  <th className="p-4">Program Code</th>
                  <th className="p-4">Program Title</th>
                  <th className="p-4">Sector Category</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-700">
                {filteredPrograms.map((prog) => (
                  <tr key={prog.id} className="hover:bg-slate-55/35 transition">
                    <td className="p-4 font-mono text-indigo-600">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 font-bold">
                        {prog.code}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-800 block text-sm">{prog.name}</span>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-500">
                      {prog.sector}
                    </td>
                    <td className="p-4 font-mono text-slate-650">
                      {prog.totalHours} hrs
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteProgram(prog.id, prog.name)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                        title="De-accredit curriculum standard"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
