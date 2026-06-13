import React, { useState, useEffect } from "react";
import { 
  Map, Search, Plus, RefreshCw, Layers, MapPin, Award, BookOpen, Clock, Trash2, Edit3, ShieldAlert
} from "lucide-react";
import { SectorEditorModal } from "./SectorEditorModal";

export function SectorRegistry() {
  const [sectorsList, setSectorsList] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selection states (Drawer & Modals)
  const [editingSector, setEditingSector] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchSectors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sectors");
      if (res.ok) {
        const data = await res.json();
        setSectorsList(data);
      }
    } catch (e) {
      console.error("Failed to load sectors registry:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSkillsCount = async () => {
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkillsList(data);
      }
    } catch (e) {
      console.error("Failed to load skills for count mapping:", e);
    }
  };

  useEffect(() => {
    fetchSectors();
    fetchSkillsCount();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSectors();
    await fetchSkillsCount();
    setRefreshing(false);
  };

  const handleSaveSector = async (payload: any) => {
    const res = await fetch("/api/sectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const msg = await res.json();
      throw new Error(msg.error || "Failed to save sector.");
    }
    fetchSectors();
  };

  const handleArchiveSector = async (id: string) => {
    const res = await fetch(`/api/sectors/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchSectors();
    }
  };

  // Filter sectors
  const filteredSectors = sectorsList.filter(s => {
    const secName = (s.sector_name || s.sectorName || "").toLowerCase();
    const secCode = (s.sector_code || s.sectorCode || "").toLowerCase();
    const secDesc = (s.description || "").toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = secName.includes(query) || secCode.includes(query) || secDesc.includes(query);
    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
              <Map className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">National Sector Registry</h1>
              <p className="text-xs text-slate-500 mt-0.5">Authoritative sectors mapping aligning national TVET vocational trades with industrial demands.</p>
            </div>
          </div>
        </div>

        {/* Action button handlers */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer transition-colors"
            title="Refresh registry"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Industry Sector
          </button>
        </div>
      </div>

      {/* Grid Filter Hub */}
      <div className="bg-white p-4 border border-slate-250/90 rounded-xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sectors by official name, short code, trade priority..."
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:outline-hidden focus:border-slate-800 rounded-lg bg-slate-50/50 text-slate-800 font-semibold text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <label className="font-bold text-[10px] uppercase">Filter Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 border border-slate-200 rounded-lg bg-white min-w-[120px] font-semibold text-slate-755"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sector Cards Bento Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-350" />
          <p className="text-xs font-semibold">Retrieving mapping of industry domains...</p>
        </div>
      ) : filteredSectors.length === 0 ? (
        <div className="p-16 text-center text-slate-400 space-y-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <Map className="w-10 h-10 mx-auto text-slate-300" />
          <h4 className="font-bold text-slate-750 text-sm">No Industrial Sectors Catalogued</h4>
          <p className="text-xs text-slate-450 max-w-sm mx-auto">No industrial sectors matched your query. Add a new industry category definition above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSectors.map((sec) => {
            const sid = sec.id;
            const sName = sec.sector_name || sec.sectorName;
            const sCode = sec.sector_code || sec.sectorCode;
            const sDescription = sec.description || "Scope and description not yet categorized.";
            const sStatus = sec.status || "ACTIVE";
            const linkedSkillsCount = skillsList.filter(sk => (sk.sector_id === sid || sk.sectorId === sid)).length;

            return (
              <div 
                key={sid}
                className="bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  {/* Top line badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 tracking-wide">
                      {sCode}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                      sStatus === "ACTIVE" 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : "bg-slate-105 text-slate-500 border border-slate-200"
                    }`}>
                      {sStatus}
                    </span>
                  </div>

                  {/* Title / Description */}
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-1">
                    {sName}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mb-4">
                    {sDescription}
                  </p>
                </div>

                {/* Utilized links footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-550">
                  <div className="flex items-center gap-1 font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{linkedSkillsCount} NOS Skills</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingSector(sec)}
                      className="p-1 px-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-150 rounded text-[10px] font-bold text-slate-700 cursor-pointer transition-colors"
                    >
                      Edit
                    </button>
                    {sStatus === "ACTIVE" && (
                      <button
                        onClick={() => handleArchiveSector(sid)}
                        className="p-1 px-2 bg-red-50 border border-red-200 hover:bg-red-100 rounded text-[10px] font-bold text-red-700 cursor-pointer transition-colors"
                        title="Archive sector"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {(isCreateOpen || editingSector) && (
        <SectorEditorModal
          sector={editingSector}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingSector(null);
          }}
          onSave={handleSaveSector}
        />
      )}

    </div>
  );
}
