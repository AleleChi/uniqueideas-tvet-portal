import React, { useState, useEffect } from "react";
import { 
  FileText, Search, Filter, Download, Plus, RefreshCw, 
  MapPin, Award, CheckCircle, Clock, AlertCircle, Building2, HelpCircle, ChevronRight, Mail, Phone, Calendar, ClipboardList
} from "lucide-react";
import { EOIDetailsDrawer } from "./EOIDetailsDrawer";
import { EOIEvaluationModal } from "./EOIEvaluationModal";

// Interactive submission modal for testing & real data addition
function NewEOIModal({ onClose, onSubmitted, sectorsList }: { onClose: () => void; onSubmitted: () => void; sectorsList: string[] }) {
  const [org, setOrg] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stateName, setStateName] = useState("Kano");
  const [selectedSector, setSelectedSector] = useState("");
  const [skillArea, setSkillArea] = useState("");
  const [exp, setExp] = useState<number>(3);
  const [nbte, setNbte] = useState("ACCREDITED");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sectorsList.length > 0) {
      setSelectedSector(sectorsList[0]);
    }
  }, [sectorsList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !contact || !email || !phone || !skillArea || !selectedSector) {
      setErr("Please fill out all required fields.");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      const response = await fetch("/api/eoi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: org,
          contactPerson: contact,
          email,
          phone,
          state: stateName,
          sector: selectedSector,
          skillArea,
          yearsOfExperience: exp,
          nbteStatus: nbte
        })
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || "Failed to submit EOI");
      }
      onSubmitted();
      onClose();
    } catch (eAny: any) {
      setErr(eAny.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [states, setStates] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/locations/states")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const names = data.map((s: any) => s.name).sort();
          setStates(names);
          if (names.length > 0 && !names.includes(stateName)) {
            setStateName(names[0]);
          }
        }
      })
      .catch(e => console.error("Could not fetch states inside EOI Workspace:", e));
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 font-sans no-print animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-150 overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm tracking-tight text-white">Register Expression of Interest</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer min-h-[32px] min-w-[32px]">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[80vh] space-y-4 text-xs text-slate-700">
          {err && <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-200 font-semibold">{err}</div>}
          
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-650">Organization Name *</label>
            <input 
              type="text" 
              value={org} 
              onChange={e => setOrg(e.target.value)} 
              placeholder="e.g. Gombe Technical Institute" 
              className="w-full p-2 border border-slate-200 rounded-lg text-slate-800" 
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Contact Person *</label>
              <input 
                type="text" 
                value={contact} 
                onChange={e => setContact(e.target.value)} 
                placeholder="Full Name" 
                className="w-full p-2 border border-slate-200 rounded-lg" 
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Email Address *</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="name@organization.org" 
                className="w-full p-2 border border-slate-200 rounded-lg" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Phone Number *</label>
              <input 
                type="text" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="+234..." 
                className="w-full p-2 border border-slate-200 rounded-lg" 
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Operating State *</label>
              <select 
                value={stateName} 
                onChange={e => setStateName(e.target.value)} 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Sectors Alignment *</label>
              <select 
                value={selectedSector} 
                onChange={e => setSelectedSector(e.target.value)} 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                required
              >
                {sectorsList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Proposed Training Course *</label>
              <input 
                type="text" 
                value={skillArea} 
                onChange={e => setSkillArea(e.target.value)} 
                placeholder="e.g. Masonry & Wall Tiling" 
                className="w-full p-2 border border-slate-200 rounded-lg" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">Years of Experience</label>
              <input 
                type="number" 
                value={exp} 
                onChange={e => setExp(Number(e.target.value))} 
                className="w-full p-2 border border-slate-200 rounded-lg" 
                min="0"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-650">NBTE Accreditation Status</label>
              <select 
                value={nbte} 
                onChange={e => setNbte(e.target.value)} 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="ACCREDITED">Fully Accredited</option>
                <option value="NOT_ACCREDITED">Not Accredited</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg cursor-pointer transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg cursor-pointer hover:bg-slate-800 font-bold transition-colors disabled:opacity-50"
            >
              {submitting ? "Registering..." : "Submit Proposal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EOIWorkspace() {
  const [eoiList, setEoiList] = useState<any[]>([]);
  const [sectorsList, setSectorsList] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [nbteFilter, setNbteFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Drawer & Modals states
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [evaluationApp, setEvaluationApp] = useState<any | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchEOIs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/eoi");
      if (res.ok) {
        const data = await res.json();
        setEoiList(data);
      }
    } catch (err) {
      console.error("Failed to load EOI applications list:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch("/api/sectors");
      if (res.ok) {
        const data = await res.json();
        const names = data.map((d: any) => d.sector_name || d.sectorName);
        setSectorsList(names.length > 0 ? names : ["Agriculture", "Construction", "ICT", "Manufacturing", "Renewable Energy"]);
      }
    } catch (e) {
      setSectorsList(["Agriculture", "Construction", "ICT", "Manufacturing", "Renewable Energy"]);
    }
  };

  useEffect(() => {
    fetchEOIs();
    fetchSectors();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEOIs();
    setRefreshing(false);
  };

  const handleSaveEvaluation = async (id: string, evaluationData: {
    evaluationScore: number;
    recommendation: string;
    remarks: string;
    applicationStatus: string;
  }) => {
    const res = await fetch(`/api/eoi/${id}/evaluate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evaluationData)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to save evaluation");
    }
    // Update local state smoothly
    fetchEOIs();
    if (selectedApplication && selectedApplication.id === id) {
      setSelectedApplication((prev: any) => ({
        ...prev,
        ...evaluationData,
        evaluation_score: evaluationData.evaluationScore,
        application_status: evaluationData.applicationStatus,
        reviewed_by: "Federal Review Manager",
        review_date: new Date().toISOString()
      }));
    }
  };

  // Export results to CSV
  const handleExportCSV = () => {
    if (eoiList.length === 0) return;
    const headers = ["Application Code", "Organization Name", "Contact Person", "Email", "Phone", "State", "Proposed Sector", "Proposed Skill Area", "NBTE accreditation", "Score", "Status", "Submission Date"];
    const rows = filteredApplications.map(app => [
      app.application_code || app.applicationCode || "",
      app.organization_name || app.organizationName || "",
      app.contact_person || app.contactPerson || "",
      app.email || "",
      app.phone || "",
      app.state || "",
      app.sector || "",
      app.skill_area || app.skillArea || "",
      app.nbte_status || app.nbteStatus || "",
      app.evaluation_score ?? app.evaluationScore ?? 0,
      app.application_status || app.applicationStatus || "",
      app.submission_date || app.submissionDate || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `National_TVET_EOI_Applications_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter application matching logical search boundaries
  const filteredApplications = eoiList.filter(app => {
    const orgName = (app.organization_name || app.organizationName || "").toLowerCase();
    const contact = (app.contact_person || app.contactPerson || "").toLowerCase();
    const appCode = (app.application_code || app.applicationCode || "").toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = orgName.includes(query) || contact.includes(query) || appCode.includes(query);

    const appState = app.state || "";
    const matchesState = stateFilter === "ALL" || appState === stateFilter;

    const appStatus = app.application_status || app.applicationStatus || "SUBMITTED";
    const matchesStatus = statusFilter === "ALL" || appStatus === statusFilter;

    const acc = app.nbte_status || app.nbteStatus || "";
    const matchesAcc = nbteFilter === "ALL" || acc === nbteFilter;

    return matchesSearch && matchesState && matchesStatus && matchesAcc;
  });

  // Pagination bounds
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredApplications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStatusColor = (st: string) => {
    switch (st) {
      case "SUBMITTED": return "bg-sky-50 text-sky-700 border-sky-150";
      case "UNDER_REVIEW": return "bg-amber-50 text-amber-700 border-amber-150";
      case "SHORTLISTED": return "bg-indigo-50 text-indigo-700 border-indigo-150";
      case "APPROVED": return "bg-emerald-50 text-emerald-700 border-emerald-150";
      case "REJECTED": return "bg-rose-50 text-rose-700 border-rose-150";
      case "INVITED_TO_NEXT_PHASE": return "bg-purple-50 text-purple-700 border-purple-150";
      default: return "bg-slate-50 text-slate-700 border-slate-150";
    }
  };

  const uniqueStates = Array.from(new Set(eoiList.map(item => item.state).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-800">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/10">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Expression of Interest (EOI)</h1>
              <p className="text-xs text-slate-500 mt-0.5">Evaluate, verify, and shortlist training providers and national skill application cycles.</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs font-semibold">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New EOI Application
          </button>
        </div>
      </div>

      {/* Statistics & Insights Panels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2 bg-slate-50 text-slate-800 rounded-lg">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Total Filed</p>
            <p className="text-lg font-bold text-slate-850 mt-0.5">{eoiList.length}</p>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Under Review</p>
            <p className="text-lg font-bold text-slate-850 mt-0.5">
              {eoiList.filter(app => (app.application_status || app.applicationStatus) === "UNDER_REVIEW").length}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Shortlisted</p>
            <p className="text-lg font-bold text-slate-850 mt-0.5">
              {eoiList.filter(app => (app.application_status || app.applicationStatus) === "SHORTLISTED").length}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Accredited NBTE</p>
            <p className="text-lg font-bold text-slate-850 mt-0.5">
              {eoiList.filter(app => (app.nbte_status || app.nbteStatus) === "ACCREDITED").length}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Filter Hub */}
      <div className="bg-white p-4 border border-slate-200/90 rounded-xl shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          
          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by organization name, contact, or application code..."
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:outline-hidden focus:border-slate-800 rounded-lg bg-slate-50/50 text-slate-800 font-medium"
            />
          </div>

          {/* Quick Clear */}
          {(search || stateFilter !== "ALL" || statusFilter !== "ALL" || nbteFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStateFilter("ALL");
                setStatusFilter("ALL");
                setNbteFilter("ALL");
                setCurrentPage(1);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer self-start md:self-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter categories */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Filter State:
            </label>
            <select
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">All States ({eoiList.length})</option>
              {uniqueStates.map(st => (
                <option key={st} value={st}>{st} ({eoiList.filter(e => e.state === st).length})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Filter Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">All Statuses ({eoiList.length})</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="INVITED_TO_NEXT_PHASE">Invited to Next Phase</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> NBTE Status:
            </label>
            <select
              value={nbteFilter}
              onChange={(e) => { setNbteFilter(e.target.value); setCurrentPage(1); }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">All Accreditations ({eoiList.length})</option>
              <option value="ACCREDITED">Fully Accredited</option>
              <option value="NOT_ACCREDITED">Not Accredited</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-350" />
            <p className="text-xs font-semibold">Synchronizing EOI application data...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <h4 className="font-bold text-slate-700 text-sm">No Expressions of Interest Found</h4>
            <p className="text-xs text-slate-450 max-w-sm mx-auto">No records matched your search query or selected filters. Try broadening your keywords or register a test EOI application.</p>
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                  <th className="p-4">App Code</th>
                  <th className="p-4">Provider / Organization</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-center">State</th>
                  <th className="p-4">Sector & Course</th>
                  <th className="p-4 text-center">NBTE status</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {currentItems.map((app) => {
                  const status = app.application_status || app.applicationStatus || "SUBMITTED";
                  const score = Number(app.evaluation_score ?? app.evaluationScore ?? 0);
                  const isAccredited = (app.nbte_status || app.nbteStatus) === "ACCREDITED";

                  return (
                    <tr 
                      key={app.id} 
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedApplication(app)}
                    >
                      <td className="p-4 font-mono font-bold text-slate-850">
                        {app.application_code || app.applicationCode}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {app.organization_name || app.organizationName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 flex-shrink-0 text-slate-350" />
                          {new Date(app.submission_date || app.submissionDate || "").toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div>{app.contact_person || app.contactPerson}</div>
                        <div className="text-[10px] text-slate-450 font-normal mt-0.5">{app.email}</div>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-800">
                        {app.state}
                      </td>
                      <td className="p-4">
                        <div className="text-[11px] text-slate-850 font-semibold">{app.skill_area || app.skillArea}</div>
                        <div className="text-[10px] text-slate-450 mt-0.5">{app.sector}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold tracking-wider ${
                          isAccredited ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          {isAccredited ? "ACCREDITED" : "PENDING"}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-xs text-slate-900">
                        {score > 0 ? (
                          <span className={score >= 70 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600"}>
                            {score}%
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${getStatusColor(status)}`}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEvaluationApp(app)}
                          className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-md font-bold text-[10px] cursor-pointer inline-flex items-center gap-1 transition-colors"
                        >
                          Evaluate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paging Footer controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-150 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredApplications.length)} of {filteredApplications.length} entries
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
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
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

      {/* Sidebar Details Drawer */}
      {selectedApplication && (
        <EOIDetailsDrawer
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onEvaluate={() => {
            setEvaluationApp(selectedApplication);
          }}
        />
      )}

      {/* Status Transition & Review Scoring Modal */}
      {evaluationApp && (
        <EOIEvaluationModal
          application={evaluationApp}
          onClose={() => setEvaluationApp(null)}
          onSave={handleSaveEvaluation}
        />
      )}

      {/* Submitter Creation Form Modal */}
      {isNewModalOpen && (
        <NewEOIModal
          sectorsList={sectorsList}
          onClose={() => setIsNewModalOpen(false)}
          onSubmitted={() => {
            fetchEOIs();
          }}
        />
      )}
    </div>
  );
}
