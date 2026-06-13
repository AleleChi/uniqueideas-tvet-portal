import React, { useState, useEffect } from "react";
import { 
  Award, Search, Filter, Plus, RefreshCw, Landmark, Users, 
  Trash2, Eye, Edit3, ArrowLeft, ToggleLeft, ToggleRight, Grid, Calendar, Clock, Sliders
} from "lucide-react";
import { SkillEditorModal } from "./SkillEditorModal";
import { SkillDetailsDrawer } from "./SkillDetailsDrawer";

export function SkillsRegistry() {
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selection states (Drawer & Modals)
  const [selectedSkill, setSelectedSkill] = useState<any | null>(null);
  const [editingSkill, setEditingSkill] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkillsList(data);
      }
    } catch (e) {
      console.error("Failed to load skills list:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch("/api/sectors");
      if (res.ok) {
        const data = await res.json();
        setSectors(data);
      }
    } catch (e) {
      console.error("Failed to load sectors list for dropdowns:", e);
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchSectors();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSkills();
    setRefreshing(false);
  };

  const handleSaveSkill = async (skillPayload: any) => {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skillPayload)
    });
    if (!res.ok) {
      const msg = await res.json();
      throw new Error(msg.error || "Failed to save skill.");
    }
    // reload skills seamlessly
    fetchSkills();
    if (selectedSkill && selectedSkill.id === skillPayload.id) {
      const foundSec = sectors.find(s => s.id === skillPayload.sectorId);
      setSelectedSkill((prev: any) => ({
        ...prev,
        ...skillPayload,
        sectorName: foundSec ? (foundSec.sector_name || foundSec.sectorName) : ""
      }));
    }
  };

  const handleArchiveSkill = async (id: string) => {
    const res = await fetch(`/api/skills/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchSkills();
      if (selectedSkill && selectedSkill.id === id) {
        setSelectedSkill((prev: any) => ({ ...prev, status: "ARCHIVED" }));
      }
    }
  };

  const handleRestoreSkill = async (id: string) => {
    const res = await fetch(`/api/skills/${id}/restore`, { method: "POST" });
    if (res.ok) {
      fetchSkills();
      if (selectedSkill && selectedSkill.id === id) {
        setSelectedSkill((prev: any) => ({ ...prev, status: "ACTIVE" }));
      }
    }
  };

  // Perform client-side grid matching
  const filteredSkills = skillsList.filter(s => {
    const skName = (s.skill_name || s.skillName || "").toLowerCase();
    const skCode = (s.skill_code || s.skillCode || "").toLowerCase();
    const skDesc = (s.description || "").toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = skName.includes(query) || skCode.includes(query) || skDesc.includes(query);

    const sId = s.sector_id || s.sectorId || "";
    const matchesSector = sectorFilter === "ALL" || sId === sectorFilter;

    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

    return matchesSearch && matchesSector && matchesStatus;
  });

  // Pagination bounds
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSkills.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSkills.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
              <Award className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">National Skills Registry</h1>
              <p className="text-xs text-slate-500 mt-0.5">Authoritative repository of National Occupational Standards (NOS) vocational qualifications.</p>
            </div>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg cursor-pointer transition-colors"
            title="Refresh skills"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register New Skill
          </button>
        </div>
      </div>

      {/* Grid Filter Hub */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-3 pt-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          
          {/* Main search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by skill name, code identifier, curriculum desc..."
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:outline-hidden focus:border-slate-800 rounded-lg bg-slate-50/55 text-slate-800 font-semibold text-xs"
            />
          </div>

          {/* Selector filters */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-500 text-[10px] uppercase">Sector:</label>
              <select
                value={sectorFilter}
                onChange={(e) => { setSectorFilter(e.target.value); setCurrentPage(1); }}
                className="p-2 border border-slate-200 rounded-lg bg-white min-w-[130px] font-semibold text-slate-750"
              >
                <option value="ALL">All Sectors ({skillsList.length})</option>
                {sectors.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.sector_name || sec.sectorName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-500 text-[10px] uppercase">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="p-2 border border-slate-200 rounded-lg bg-white min-w-[110px] font-semibold text-slate-750"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Skills Schema Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-350" />
            <p className="text-xs font-semibold">Retrieving vocational NOS frameworks...</p>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Award className="w-10 h-10 mx-auto text-slate-300" />
            <h4 className="font-bold text-slate-750 text-sm">No Vocational Skills Found</h4>
            <p className="text-xs text-slate-450 max-w-sm mx-auto">No vocational skill definitions match your chosen filters. Create a new skill representation using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                  <th className="p-4 w-28">Skill Code</th>
                  <th className="p-4">Official Designation</th>
                  <th className="p-4">Primary Sector</th>
                  <th className="p-4 text-center">Duration</th>
                  <th className="p-4">Certification Level</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {currentItems.map((sk) => {
                  const isActive = sk.status === "ACTIVE";

                  return (
                    <tr 
                      key={sk.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedSkill(sk)}
                    >
                      <td className="p-4 font-mono font-bold text-indigo-700">
                        {sk.skill_code || sk.skillCode}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {sk.skill_name || sk.skillName}
                        </div>
                        <p className="text-[10px] text-slate-450 font-normal line-clamp-1 mt-0.5">
                          {sk.description || "No description provided."}
                        </p>
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-800">
                        {sk.sectorName || (sectors.find(sec => sec.id === sk.sector_id || sec.id === sk.sectorId)?.sector_name) || "National Sector"}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-800">
                        {sk.duration_weeks || sk.durationWeeks || 12} wks
                      </td>
                      <td className="p-4 text-slate-650 font-medium">
                        {sk.certification_type || sk.certificationType || "NVC"}
                      </td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          isActive 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-250" 
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          {sk.status || "ACTIVE"}
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingSkill(sk);
                            }}
                            className="p-1 px-1.5 bg-slate-100 text-slate-700 hover:bg-slate-250 border border-slate-200 rounded font-bold text-[10px] cursor-pointer"
                            title="Edit classification"
                          >
                            Edit
                          </button>

                          {isActive ? (
                            <button
                              onClick={() => handleArchiveSkill(sk.id)}
                              className="p-1 px-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded font-bold text-[10px] cursor-pointer"
                              title="Archive skill classification"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreSkill(sk.id)}
                              className="p-1 px-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded font-bold text-[10px] cursor-pointer"
                              title="Restore skill classification"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-150 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-550 font-semibold">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSkills.length)} of {filteredSkills.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-2.5 py-1 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`px-3 py-1 border rounded-md font-bold text-xs ${
                    currentPage === i + 1 
                      ? "bg-slate-900 text-white border-slate-900" 
                      : "bg-white text-slate-750 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-2.5 py-1 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details drawer */}
      {selectedSkill && (
        <SkillDetailsDrawer
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onEdit={() => {
            setEditingSkill(selectedSkill);
            setSelectedSkill(null);
          }}
        />
      )}

      {/* Creation and Edit Modals */}
      {(isCreateOpen || editingSkill) && (
        <SkillEditorModal
          skill={editingSkill}
          sectors={sectors}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingSkill(null);
          }}
          onSave={handleSaveSkill}
        />
      )}
    </div>
  );
}
