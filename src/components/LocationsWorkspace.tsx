import React, { useState, useEffect } from "react";
import { 
  Building2, Plus, Edit2, Trash2, MapPin, Search, Globe, Landmark, 
  Map, Shield, Check, X, RefreshCw, AlertTriangle
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

interface StateNode {
  id: string;
  name: string;
  state_code: string;
  geopolitical_zone: string;
}

interface LgaNode {
  id: string;
  state_id: string;
  name: string;
  code: string;
}

interface TrainingCenter {
  id: string;
  tenant_id: string | null;
  state_id: string;
  lga_id: string;
  center_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  state_name: string;
  lga_name: string;
  tenant_name: string | null;
}

interface LocationsWorkspaceProps {
  session: any;
}

export function LocationsWorkspace({ session }: LocationsWorkspaceProps) {
  const [states, setStates] = useState<StateNode[]>([]);
  const [lgas, setLgas] = useState<LgaNode[]>([]);
  const [trainingCenters, setTrainingCenters] = useState<TrainingCenter[]>([]);
  
  // Filtering and Search
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("");
  const [selectedLgaFilter, setSelectedLgaFilter] = useState<string>("");
  const [tcSearch, setTcSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Loading and Error statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states for Create/Edit Training Center modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTc, setEditingTc] = useState<TrainingCenter | null>(null);
  
  const [formCenterName, setFormCenterName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formStateId, setFormStateId] = useState("");
  const [formLgaId, setFormLgaId] = useState("");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formTenantId, setFormTenantId] = useState("");

  const [formLgas, setFormLgas] = useState<LgaNode[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  // Detect and state restriction context
  const isSta = session?.role === "STA" || session?.tenantTier === "STA";
  const isTsp = session?.role === "TSP" || session?.tenantTier === "TSP";
  const userStateId = session?.stateId;
  const userTenantId = session?.tenantId;

  // Initial Fetch Data load
  useEffect(() => {
    fetchStatesAndMetadata();
    fetchTrainingCenters();
  }, [session]);

  // Load LGAs list when state selection changes in the editor state
  useEffect(() => {
    if (formStateId) {
      fetchLgasForStateId(formStateId, true);
    } else {
      setFormLgas([]);
    }
  }, [formStateId]);

  // Load LGAs list for filters when filter state changes
  useEffect(() => {
    if (selectedStateFilter) {
      fetchLgasForStateId(selectedStateFilter, false);
    } else {
      setLgas([]);
      setSelectedLgaFilter("");
    }
  }, [selectedStateFilter]);

  const fetchStatesAndMetadata = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch states
      const sRes = await authFetch("/api/locations/states");
      if (sRes.ok) {
        const sData = await sRes.json();
        setStates(sData);
        // If user is STA and has set stateId, preset filter State and Form State
        if (isSta && userStateId) {
          const match = sData.find((st: any) => st.id === userStateId);
          if (match) {
            setSelectedStateFilter(match.id);
          }
        }
      }

      // Also load tenants for assignment mapping list
      const tRes = await authFetch("/api/system/tenant-health"); // Fallback check or active registry of tenants
      if (tRes.ok) {
        const tData = await tRes.json();
        setTenants(tData.tenants || []);
      } else {
        // Fallback to active TSPs query which is safer
        const tspQueryRes = await authFetch("/api/tsps");
        if (tspQueryRes.ok) {
          const tspList = await tspQueryRes.json();
          setTenants(tspList.map((t: any) => ({ id: t.id || t.tenant_id, name: t.name })));
        }
      }
    } catch (e: any) {
      console.error(e);
      setError("Failed to load states baseline registry");
    } finally {
      setLoading(false);
    }
  };

  const fetchLgasForStateId = async (stateId: string, isForForm: boolean) => {
    try {
      const res = await authFetch(`/api/locations/states/${stateId}/lgas`);
      if (res.ok) {
        const data = await res.json();
        if (isForForm) {
          setFormLgas(data);
          // Auto select first LGA if none is selected or matches
          if (data.length > 0 && !formLgaId) {
            setFormLgaId(data[0].id);
          }
        } else {
          setLgas(data);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchTrainingCenters = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/training-centers");
      if (res.ok) {
        const data = await res.json();
        setTrainingCenters(data);
      }
    } catch (e: any) {
      console.error(e);
      setError("Failed to retrieve training centers registry");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (tc: TrainingCenter | null = null) => {
    if (tc) {
      setEditingTc(tc);
      setFormCenterName(tc.center_name);
      setFormAddress(tc.address || "");
      setFormStateId(tc.state_id);
      setFormLgaId(tc.lga_id);
      setFormLatitude(tc.latitude?.toString() || "");
      setFormLongitude(tc.longitude?.toString() || "");
      setFormStatus(tc.status || "ACTIVE");
      setFormTenantId(tc.tenant_id || "");
    } else {
      setEditingTc(null);
      setFormCenterName("");
      setFormAddress("");
      // Enforce default state if user is STA
      setFormStateId(isSta ? userStateId || "" : (states[0]?.id || ""));
      setFormLgaId("");
      setFormLatitude("");
      setFormLongitude("");
      setFormStatus("ACTIVE");
      setFormTenantId(isTsp ? userTenantId || "" : "");
    }
    setIsFormOpen(true);
  };

  const handleSaveTc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCenterName.trim()) return;

    const payload = {
      center_name: formCenterName,
      address: formAddress,
      state_id: isSta ? userStateId : formStateId,
      lga_id: formLgaId,
      latitude: formLatitude ? parseFloat(formLatitude) : null,
      longitude: formLongitude ? parseFloat(formLongitude) : null,
      status: formStatus,
      tenant_id: isTsp ? userTenantId : (formTenantId || null)
    };

    try {
      setLoading(true);
      const url = editingTc ? `/api/training-centers/${editingTc.id}` : "/api/training-centers";
      const method = editingTc ? "PUT" : "POST";
      
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsFormOpen(false);
        fetchTrainingCenters();
      } else {
        const errObj = await res.json();
        alert(errObj.error || "Save operation failed");
      }
    } catch (err: any) {
      alert("Error saving training center context: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTc = async (id: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to remove Training Center and deregister: "${name}"?`)) return;

    try {
      setLoading(true);
      const res = await authFetch(`/api/training-centers/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTrainingCenters();
      } else {
        const err = await res.json();
        alert(err.error || "Deregistration failed");
      }
    } catch (e: any) {
      alert("Deregistration request error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Compute stats for visualization cards
  const activeCenters = trainingCenters.filter(tc => tc.status === "ACTIVE").length;
  const deactivatedCenters = trainingCenters.filter(tc => tc.status !== "ACTIVE").length;
  
  // Filter list of training training centers
  const filteredCenters = trainingCenters.filter(tc => {
    const sMatch = !selectedStateFilter || tc.state_id === selectedStateFilter;
    const lMatch = !selectedLgaFilter || tc.lga_id === selectedLgaFilter;
    const stMatch = !statusFilter || tc.status === statusFilter;
    const qMatch = !tcSearch || 
      tc.center_name.toLowerCase().includes(tcSearch.toLowerCase()) ||
      tc.address.toLowerCase().includes(tcSearch.toLowerCase()) ||
      (tc.tenant_name && tc.tenant_name.toLowerCase().includes(tcSearch.toLowerCase())) ||
      tc.lga_name.toLowerCase().includes(tcSearch.toLowerCase()) ||
      tc.state_name.toLowerCase().includes(tcSearch.toLowerCase());
    return sMatch && lMatch && qMatch && stMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* Title Header with responsive Context and Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] uppercase font-bold text-amber-400 font-mono">
              National Location Infrastructure
            </span>
            <span className="p-1 px-2.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-[10px] uppercase font-bold text-indigo-400 font-mono">
              Nigeria Admin Standard
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight text-slate-100 flex items-center gap-3 mt-2">
            <Landmark className="w-6 h-6 text-indigo-500" />
            Training Centers & Locations Registry
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl font-sans mt-1">
            Browse state-level administrative divisions, monitor local government associations (LGAs), and manage accredited training facility coordinates under secure RLS policies.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={fetchTrainingCenters}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 flex items-center justify-center cursor-pointer active:scale-95 transition"
            title="Refresh Registry Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {["SUPER_ADMIN", "ADMIN_OFFICER", "STA", "FED"].includes(session?.role || "") && (
            <button 
              onClick={() => handleOpenForm(null)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow-lg transition active:scale-[97%] cursor-pointer text-xs uppercase"
            >
              <Plus className="w-4 h-4" />
              <span>Register Center</span>
            </button>
          )}
        </div>
      </div>

      {/* RLS Scoping Notification Ribbon */}
      <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4 flex items-center gap-3 text-left">
        <Shield className="w-5 h-5 text-indigo-400 flex-shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-indigo-300 font-mono uppercase block">Active Access & RLS Control Matrix</span>
          <p className="text-slate-400">
            {isSta && (
              <>You are authenticated as <strong>State Admin Coordinator</strong>. Your session is securely bound to state <strong>Kano</strong>. You can only view and manage training facilities registered within Kano State borders.</>
            )}
            {isTsp && (
              <>You are logged in as an accredited <strong>TSP Partner Agent</strong>. Your action space is locked to centers mapped to your specific Tenant UUID.</>
            )}
            {!isSta && !isTsp && (
              <>You are authenticated with <strong>Federal Oversight Context (FED)</strong>. You have complete visibility and edit clearance to traverse all 36 Nigerian states and Abuja Federal Capital Territory (FCT).</>
            )}
          </p>
        </div>
      </div>

      {/* Overview Analytics Stat Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Nigeria Hierarchy Baseline</span>
            <Globe className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-sans text-slate-100 mt-2">1 Country</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Nigeria (Federal Republic)</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Administrative states</span>
            <Map className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-sans text-amber-400 mt-2">36 States + FCT</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Seeded with Real ISO codes</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Local Govts (LGAs)</span>
            <MapPin className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold font-sans text-indigo-400 mt-2">774 LGAs</p>
          <p className="text-[10px] text-slate-500 mt-0.5">100% Seeded, Real Names</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Aced/Training Centers</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-sans text-emerald-400 mt-2">{activeCenters} Active</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{deactivatedCenters} Inactive facility centers</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/20 border border-rose-800/40 p-4 rounded-xl text-left text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs text-left">
        <h3 className="text-xs font-bold font-mono uppercase text-slate-350 tracking-wider mb-3">
          Interactive Filter & Traversal Matrix
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* State selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">State</label>
            <select
              value={selectedStateFilter}
              onChange={(e) => {
                setSelectedStateFilter(e.target.value);
                setSelectedLgaFilter("");
              }}
              disabled={isSta}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="">-- All 36 States + FCT --</option>
              {states.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.geopolitical_zone})</option>
              ))}
            </select>
          </div>

          {/* LGA selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Local Govt (LGA)</label>
            <select
              value={selectedLgaFilter}
              onChange={(e) => setSelectedLgaFilter(e.target.value)}
              disabled={!selectedStateFilter}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="">-- All Local Governments --</option>
              {lgas.map(lg => (
                <option key={lg.id} value={lg.id}>{lg.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="">-- All Operating Statuses --</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {/* Search bar */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Search Keywords</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search centers, addresses, partners..."
                value={tcSearch}
                onChange={(e) => setTcSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* TRAINING CENTERS TABLE GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Synchronizing state location schema instances...</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-sm font-bold font-sans text-slate-200 text-left flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              Accredited Centers ({filteredCenters.length} Mapped)
            </h3>
            <span className="text-[10px] bg-slate-950 font-mono border border-slate-800 p-1 px-2.5 rounded font-bold text-slate-500">
              Audit Actions Captured Automatically
            </span>
          </div>

          {filteredCenters.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-sans space-y-2">
              <Landmark className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="font-bold text-slate-300">No accredited centers registered for this filter combination</p>
              <p className="text-xs max-w-md mx-auto">Try selecting another administrative state layer or create a training center using the "Register Center" action.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                    <th className="py-3.5 px-6">Center Name / Address</th>
                    <th className="py-3.5 px-4">State & Geopolitical Zone</th>
                    <th className="py-3.5 px-4">Mapped LGA Boundary</th>
                    <th className="py-3.5 px-4">Operating Partner (TSP)</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                  {filteredCenters.map(tc => (
                    <tr key={tc.id} className="hover:bg-slate-800/15 transition-colors">
                      <td className="py-4 px-6 text-left">
                        <div>
                          <p className="font-bold text-slate-200 text-sm">{tc.center_name}</p>
                          <p className="text-slate-400 text-[11px] mt-1.5 flex items-center gap-1.5 leading-normal">
                            <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            {tc.address || "No structural address linked"}
                          </p>
                          {tc.latitude && tc.longitude && (
                            <span className="text-[10px] font-mono text-indigo-400 mt-1 block">
                              Coordinates: {tc.latitude}, {tc.longitude}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-left">
                        <span className="font-medium text-slate-300 bg-slate-950/60 border border-slate-800/50 p-1 px-2 rounded">
                          {tc.state_name}
                        </span>
                        {states.find(s => s.id === tc.state_id)?.geopolitical_zone && (
                          <span className="text-[10px] text-slate-500 block mt-1.5 font-mono">
                            Zone: {states.find(s => s.id === tc.state_id)?.geopolitical_zone}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-left font-medium text-slate-300">
                        {tc.lga_name}
                      </td>
                      <td className="py-4 px-4 text-left">
                        {tc.tenant_name ? (
                          <span className="font-mono text-indigo-300 font-semibold truncate max-w-[150px] block">
                            {tc.tenant_name}
                          </span>
                        ) : (
                          <span className="text-slate-550 italic">No TSP Mapped Yet</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-left">
                        <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold p-1 px-2 ml-px rounded-full leading-none ${
                          tc.status === "ACTIVE" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tc.status === "ACTIVE" ? "bg-emerald-400" : "bg-rose-400"}`}></span>
                          {tc.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenForm(tc)}
                            className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700/50 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          
                          {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "") && (
                            <button
                              onClick={() => handleDeleteTc(tc.id, tc.center_name)}
                              className="p-1 px-2 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300 hover:text-rose-100 rounded border border-rose-900/30 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE & EDIT FACILITY DIALOG TRIGGER MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                {editingTc ? "Edit Training Facility Profile" : "Accredit New Training Center Facility"}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white cursor-pointer min-h-[30px] min-w-[30px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTc} className="p-6 space-y-4 text-left">
              
              {/* facility name input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Acronym / Facility Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kano Vocational Skill Development Center A"
                  value={formCenterName}
                  onChange={(e) => setFormCenterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. Plot 15, Bompai Industrial Area"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* state selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">State Territory <span className="text-red-500">*</span></label>
                  <select
                    value={formStateId}
                    onChange={(e) => {
                      setFormStateId(e.target.value);
                      setFormLgaId("");
                    }}
                    disabled={isSta}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    {isSta && userStateId ? (
                      <option value={userStateId}>Kano State (Binding)</option>
                    ) : (
                      <>
                        <option value="">-- Dropdown Selection --</option>
                        {states.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                {/* LGA selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">LGA Boundary <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formLgaId}
                    onChange={(e) => setFormLgaId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Dropdown Selection --</option>
                    {formLgas.map(lg => (
                      <option key={lg.id} value={lg.id}>{lg.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TSP/Tenant Mapped Partner Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Operating TSP Tenant Group</label>
                <select
                  value={formTenantId}
                  onChange={(e) => setFormTenantId(e.target.value)}
                  disabled={isTsp}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="">-- Assign a TSP Service Group (Optional) --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Coordinates block */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 12.002179"
                    value={formLatitude}
                    onChange={(e) => setFormLatitude(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 8.591956"
                    value={formLongitude}
                    onChange={(e) => setFormLongitude(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status control */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Facility Operating Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE / DEACTIVATED</option>
                </select>
              </div>

              {/* Form buttons */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingTc ? "Update Facility" : "Decline/Save Center"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
