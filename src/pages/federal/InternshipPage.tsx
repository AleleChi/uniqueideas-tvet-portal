/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Briefcase, Search, Plus, Filter, RefreshCw, 
  Building, MapPin, Calendar, Clock, DollarSign, CheckCircle, ArrowRight
} from "lucide-react";

export function InternshipPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Placements Mock database linking to repair graduates (e.g. Owerri Sector Repairs)
  const [placements, setPlacements] = useState([
    {
      id: "int-101",
      traineeName: "Adewale Yusuf",
      tvetId: "TVET-2026-081",
      company: "Airtel Networks Ltd",
      location: "Lagos, HQ",
      track: "Mobile Phone Repairs",
      duration: "12 Weeks",
      stipend: "NGN 45,000",
      status: "ACTIVE",
      startDate: "2026-05-01"
    },
    {
      id: "int-102",
      traineeName: "Chinedu Okafor",
      tvetId: "TVET-2026-114",
      company: "Unique Technology Repairs Center",
      location: "Owerri, Imo State",
      track: "Computer Hardware Repairs",
      duration: "24 Weeks",
      stipend: "NGN 40,000",
      status: "ACTIVE",
      startDate: "2026-04-15"
    },
    {
      id: "int-103",
      traineeName: "Fatima Bello",
      tvetId: "TVET-2026-004",
      company: "MainOne Data Center System",
      location: "Kano Regional office",
      track: "Computer Hardware Repairs",
      duration: "16 Weeks",
      stipend: "NGN 55,000",
      status: "COMPLETED",
      startDate: "2026-01-10"
    },
    {
      id: "int-104",
      traineeName: "Amaka Eze",
      tvetId: "TVET-2026-258",
      company: "Imo Skill Tech-Hub",
      location: "Owerri, Imo State",
      track: "Mobile Phone Repairs",
      duration: "12 Weeks",
      stipend: "NGN 35,000",
      status: "PENDING",
      startDate: "2026-07-01"
    }
  ]);

  // Form states
  const [formName, setFormName] = useState("");
  const [formTvetId, setFormTvetId] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formTrack, setFormTrack] = useState("Computer Hardware Repairs");
  const [formDuration, setFormDuration] = useState("12 Weeks");
  const [formStipend, setFormStipend] = useState("NGN 40,000");

  const handleAddPlacement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formTvetId || !formCompany) {
      alert("All core fields are required.");
      return;
    }

    const newInt = {
      id: `int-${Math.floor(Math.random() * 900) + 100}`,
      traineeName: formName,
      tvetId: formTvetId.toUpperCase(),
      company: formCompany,
      location: formLocation || "N/A",
      track: formTrack,
      duration: formDuration,
      stipend: formStipend,
      status: "PENDING",
      startDate: new Date().toISOString().split('T')[0]
    };

    setPlacements([newInt, ...placements]);
    setShowAddModal(false);
    
    // Clear states
    setFormName("");
    setFormTvetId("");
    setFormCompany("");
    setFormLocation("");
  };

  const handleApprove = (id: string) => {
    setPlacements(placements.map(p => p.id === id ? { ...p, status: "ACTIVE" } : p));
  };

  const filtered = placements.filter(p => {
    const matchesSearch = p.traineeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.tvetId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="fed-internship-manager" className="space-y-6 animate-in fade-in duration-200 text-left">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Briefcase className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
              Industrial Placements
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            National TVET Internship Tracker
          </h2>
          <p className="text-xs text-slate-500 leading-normal">
            Track, monitor, and sign off on industrial attachment placements, workplace apprenticeships, and corporative internship programs.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 hover:scale-[101%] duration-150 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-md shadow-indigo-600/10"
        >
          <Plus className="w-4 h-4" />
          <span>Post Internship Placement</span>
        </button>
      </div>

      {/* Basic Metrics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs">
          <span className="text-[9px] font-bold font-mono uppercase text-slate-400">Total Placements</span>
          <p className="text-xl font-bold text-slate-800 mt-1">{placements.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs">
          <span className="text-[9px] font-bold font-mono uppercase text-teal-605 text-emerald-600">Active Handshakes</span>
          <p className="text-xl font-bold text-slate-800 mt-1">{placements.filter(p => p.status === "ACTIVE").length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs">
          <span className="text-[9px] font-bold font-mono uppercase text-amber-600">Pending Approvals</span>
          <p className="text-xl font-bold text-slate-800 mt-1">{placements.filter(p => p.status === "PENDING").length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs">
          <span className="text-[9px] font-bold font-mono uppercase text-indigo-500">Completed Attachments</span>
          <p className="text-xl font-bold text-slate-800 mt-1">{placements.filter(p => p.status === "COMPLETED").length}</p>
        </div>
      </div>

      {/* Expandable creator dialog */}
      {showAddModal && (
        <div className="bg-slate-900 border border-indigo-950/80 rounded-2xl p-6 text-white shadow-xl max-w-xl mx-auto space-y-5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-indigo-950/60 pb-3">
            <h3 className="font-bold text-sm tracking-tight text-slate-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span>Record New Internship Placement</span>
            </h3>
            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">Cancel</button>
          </div>

          <form onSubmit={handleAddPlacement} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Graduate Name</label>
                <input 
                  type="text" 
                  placeholder="Student name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none font-medium text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Grad TVET ID Reference</label>
                <input 
                  type="text" 
                  placeholder="e.g. TVET-2026-XX"
                  value={formTvetId}
                  onChange={(e) => setFormTvetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none font-mono text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Employer Partner</label>
                <input 
                  type="text" 
                  placeholder="e.g. MTN Nigeria, Shell"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none text-slate-100 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Placement Location</label>
                <input 
                  type="text" 
                  placeholder="City, State"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Track</label>
                <select 
                  value={formTrack}
                  onChange={(e) => setFormTrack(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-250 outline-none"
                >
                  <option value="Computer Hardware Repairs">Computer Hardware Repairs</option>
                  <option value="Mobile Phone Repairs">Mobile Phone Repairs</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold">Duration</label>
                <select 
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-250 outline-none"
                >
                  <option value="12 Weeks">12 Weeks</option>
                  <option value="16 Weeks">16 Weeks</option>
                  <option value="24 Weeks">24 Weeks</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-400 uppercase font-bold text-indigo-400">Monthly Stipend</label>
                <input 
                  type="text" 
                  value={formStipend}
                  onChange={(e) => setFormStipend(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-950 rounded-lg p-2.5 outline-none font-bold text-indigo-300"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-lg font-sans uppercase tracking-widest text-[10px] transition cursor-pointer"
            >
              Confirm Internship Routing
            </button>
          </form>
        </div>
      )}

      {/* Placements List Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by intern, company, tvet-id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-650 font-medium outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
        </div>

        {/* placements table */}
        <div className="overflow-x-auto rounded-xl border border-slate-150">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-150 text-slate-500 font-mono text-[10px] uppercase font-bold">
                <th className="p-4">Intern ID</th>
                <th className="p-4">Trainee / TVET ID</th>
                <th className="p-4">Corporate Company</th>
                <th className="p-4">Attached Track</th>
                <th className="p-4">Stipend</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-700">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/40">
                  <td className="p-4 font-mono text-[11px] text-slate-400">{item.id}</td>
                  <td className="p-4">
                    <span className="font-bold text-slate-900 block">{item.traineeName}</span>
                    <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">{item.tvetId}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-850">{item.company}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{item.location}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs font-medium text-slate-500">
                    {item.track}
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      <span>Since {item.startDate} ({item.duration})</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-700">
                    <div className="flex items-center text-slate-800">
                      <DollarSign className="w-3 h-3 text-slate-400" />
                      <span>{item.stipend}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold ${
                      item.status === "ACTIVE" 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                        : item.status === "PENDING"
                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {item.status === "PENDING" && (
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded border border-indigo-150 text-[10px] font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Authorize</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
