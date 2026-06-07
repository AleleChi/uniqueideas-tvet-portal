/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Award, ShieldCheck, Mail, Users, FileCheck, ThumbsUp, 
  ChevronRight, Search, Filter, Loader2, Download, Printer, 
  ZoomIn, ZoomOut, RotateCcw, Check, Sparkles, X, Briefcase, 
  MapPin, HelpCircle, CheckSquare, Square, RefreshCcw
} from "lucide-react";
import { API_BASE_URL } from "../config/api";

interface Trainee {
  id: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  gender: string;
  state: string;
  city: string;
  phoneNumber: string;
  email: string;
  tsp: string;
  program: string;
  skillSector: string;
  status: string;
  beneficiaryStatus: string;
  age?: number;
  eligibilityStatus?: string;
  isEligibleForCert?: boolean;
  certificationStatus?: "NONE" | "CERTIFICATION_PENDING" | "CERTIFIED" | "CERTIFICATE_ISSUED" | "ALUMNI";
  certificateNumber?: string;
  certificateUrl?: string;
  certificateReference?: string;
  certificateVerificationCode?: string;
  graduationBatch?: string;
  alumniStatus?: boolean;
  alumniEmploymentStatus?: string;
  alumniEntrepreneurStatus?: string;
  alumniBusinessName?: string;
  alumniCurrentEmployer?: string;
}

interface CertificationCenterProps {
  session: any;
  onRefreshRoot?: () => void;
}

export function CertificationCenter({ session, onRefreshRoot }: CertificationCenterProps) {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Search & Filtering
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tspFilter, setTspFilter] = useState<string>("ALL");
  
  // Selection & Bulk
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionTarget, setBulkActionTarget] = useState<string>("");
  const [bulkRemark, setBulkRemark] = useState("");
  const [bulkGraduationBatch, setBulkGraduationBatch] = useState("Batch 2026-Cohort A");

  // Certificate Preview Modal
  const [previewTrainee, setPreviewTrainee] = useState<Trainee | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(0.9);

  // Alumni demographic profile editor modal
  const [alumniEditTrainee, setAlumniEditTrainee] = useState<Trainee | null>(null);
  const [employmentStatus, setEmploymentStatus] = useState("Employed");
  const [entrepreneurStatus, setEntrepreneurStatus] = useState("None");
  const [businessName, setBusinessName] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch(`${API_BASE_URL}/api/certification/stats`);
      const listRes = await fetch(`${API_BASE_URL}/api/certification/list`);
      
      if (statsRes.ok && listRes.ok) {
        const statsData = await statsRes.json();
        const listData = await listRes.json();
        setStats(statsData);
        setTrainees(listData);
      }
    } catch (e) {
      console.error("[CertificationCenter] Failed fetching registry feeds:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleTransition = async (id: string, nextStatus: string, params: any = {}) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/certification/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          nextStatus,
          ...params
        })
      });

      if (res.ok) {
        // Refresh local views
        await fetchData();
        if (onRefreshRoot) onRefreshRoot();
      } else {
        const errObj = await res.json().catch(() => ({}));
        alert(errObj.error || "Failed executing state transition mutation.");
      }
    } catch (err) {
      console.error(err);
      alert("Network exception occurred during lifecycle transition.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !bulkActionTarget) return;

    setActionLoading("BULK_ACTION");
    try {
      const res = await fetch(`${API_BASE_URL}/api/certification/bulk-transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids: selectedIds,
          nextStatus: bulkActionTarget,
          remark: bulkRemark,
          graduationBatch: bulkGraduationBatch
        })
      });

      if (res.ok) {
        setSelectedIds([]);
        setBulkRemark("");
        setBulkActionTarget("");
        await fetchData();
        if (onRefreshRoot) onRefreshRoot();
      } else {
        const errObj = await res.json().catch(() => ({}));
        alert(errObj.error || "Bulk process failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Network link failure during batch transaction series.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAlumniProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumniEditTrainee) return;

    setActionLoading("ALUMNI_UPDATE");
    try {
      const res = await fetch(`${API_BASE_URL}/api/certification/alumni-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: alumniEditTrainee.id,
          employmentStatus,
          entrepreneurStatus,
          businessName,
          currentEmployer
        })
      });

      if (res.ok) {
        setAlumniEditTrainee(null);
        await fetchData();
        if (onRefreshRoot) onRefreshRoot();
      } else {
        alert("Failed saving career tracking variables.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // Selection callbacks
  const toggleSelectAll = () => {
    const list = filteredTrainees;
    if (selectedIds.length === list.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(list.map(t => t.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // Filtering Logic
  const filteredTrainees = trainees.filter(t => {
    const term = search.toLowerCase();
    const matchesSearch = 
      t.firstName.toLowerCase().includes(term) ||
      t.lastName.toLowerCase().includes(term) ||
      (t.certificateNumber && t.certificateNumber.toLowerCase().includes(term)) ||
      t.id.toLowerCase().includes(term);

    const matchesStatus = 
      statusFilter === "ALL" || 
      (statusFilter === "ELIGIBLE" && t.isEligibleForCert && (!t.certificationStatus || t.certificationStatus === "NONE")) ||
      (statusFilter === "CERTIFICATION_PENDING" && t.certificationStatus === "CERTIFICATION_PENDING") ||
      (statusFilter === "CERTIFIED" && t.certificationStatus === "CERTIFIED") ||
      (statusFilter === "CERTIFICATE_ISSUED" && t.certificationStatus === "CERTIFICATE_ISSUED") ||
      (statusFilter === "ALUMNI" && (t.alumniStatus || t.certificationStatus === "ALUMNI"));

    const matchesTsp = 
      tspFilter === "ALL" || t.tsp === tspFilter;

    return matchesSearch && matchesStatus && matchesTsp;
  });

  // Extract unique TSPs for filter dropdown lists
  const tsps = Array.from(new Set(trainees.map(t => t.tsp)));

  return (
    <div className="space-y-6 animate-in fade-in duration-350">
      
      {/* Dashboard Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-450 block">Eligible Trainees</span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-600 block">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold font-sans tracking-tight text-slate-900 block">
              {stats ? stats.eligibleCount : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </span>
            <span className="text-[10px] text-slate-450 mt-1 block">Awaiting certification review</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-450 block">Pending Review</span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-600 block">
              <RefreshCcw className="w-4 h-4 animate-spin-slow" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold font-sans tracking-tight text-slate-900 block">
              {stats ? stats.pendingCount : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </span>
            <span className="text-[10px] text-slate-450 mt-1 block">Trainees in queue</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-450 block">Certified Files</span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-600 block">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold font-sans tracking-tight text-slate-900 block">
              {stats ? stats.certifiedCount : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </span>
            <span className="text-[10px] text-slate-450 mt-1 block">Signatures validated</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-450 block">Certificates Issued</span>
            <div className="p-1.5 bg-indigo-50 rounded text-indigo-600 block">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold font-sans tracking-tight text-slate-900 block">
              {stats ? stats.issuedCount : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </span>
            <span className="text-[10px] text-slate-450 mt-1 block">Dispatched to candidates</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-450 block">Alumni Registry</span>
            <div className="p-1.5 bg-purple-50 rounded text-purple-600 block">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold font-sans tracking-tight text-slate-900 block">
              {stats ? stats.alumniCount : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </span>
            <span className="text-[10px] text-slate-450 mt-1 block">Career tracking profiles</span>
          </div>
        </div>

        <div className="bg-indigo-950 border border-indigo-900 p-4.5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[110px] text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-indigo-300 block">Completion Rate</span>
            <div className="p-1.5 bg-indigo-900/30 rounded text-indigo-400 block">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold font-sans tracking-tight text-white block">
              {stats ? `${stats.certificationRate}%` : <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />}
            </span>
            <span className="text-[10px] text-indigo-300 mt-1 block">Total certified progress</span>
          </div>
        </div>

      </div>

      {/* Main Workbench Body */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Workbench (Col 8/9): Queues and Search lists */}
        <div className="xl:col-span-9 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            
            {/* Toolbar and filter drawers */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center border-b border-slate-100 pb-5 mb-5 no-print">
              
              {/* Dynamic search bar */}
              <div className="flex-grow max-w-sm flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-500">
                <Search className="w-4 h-4 mr-2" />
                <input 
                  type="text"
                  placeholder="Search candidate, cert serial, or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-xs w-full focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Advanced UI filter select lists */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="w-3.5 h-3.5" />
                  <span>State Queue:</span>
                </div>
                <select 
                  className="bg-transparent border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:border-indigo-500"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setSelectedIds([]);
                  }}
                >
                  <option value="ALL">All States</option>
                  <option value="ELIGIBLE">Eligible Candidates</option>
                  <option value="CERTIFICATION_PENDING">Pending Review</option>
                  <option value="CERTIFIED">Certified Profiles</option>
                  <option value="CERTIFICATE_ISSUED">Certificates Issued</option>
                  <option value="ALUMNI">Alumni Registry</option>
                </select>

                <select 
                  className="bg-transparent border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:border-indigo-500 max-w-[200px]"
                  value={tspFilter}
                  onChange={(e) => setSearch("")}
                >
                  <option value="ALL">All TSPs</option>
                  {tsps.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Trainee Queue Board Layout */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-400 mt-2 font-mono">Sweeping database registries...</p>
              </div>
            ) : filteredTrainees.length === 0 ? (
              <div className="text-center py-16">
                <Award className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-slate-600 text-xs font-semibold mt-3">No candidates located inside filtered queue.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Change state queue filters or search tokens to refresh rows.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                      <th className="py-3 px-4 w-10">
                        <button 
                          onClick={toggleSelectAll}
                          className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          {selectedIds.length === filteredTrainees.length ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Trainee ID & Name</th>
                      <th className="py-3 px-4">Institutions (TSP)</th>
                      <th className="py-3 px-4">Baseline Age / Compliance</th>
                      <th className="py-3 px-4">Ecosystem Status</th>
                      <th className="py-3 px-4">Certificate Serial</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredTrainees.map(t => {
                      const isSelected = selectedIds.includes(t.id);
                      
                      return (
                        <tr 
                          key={t.id}
                          className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-indigo-50/15" : ""}`}
                        >
                          <td className="py-3.5 px-4">
                            <button 
                              onClick={() => toggleSelectRow(t.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 font-sans font-semibold text-slate-900">
                            <div>
                              <span>{t.firstName} {t.lastName}</span>
                              <span className="block font-mono text-[9px] font-normal text-slate-400 mt-0.5">{t.id}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            <div>
                              <span className="block tracking-tight truncate max-w-[150px]" title={t.tsp}>{t.tsp}</span>
                              <span className="block text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[150px]">{t.skillSector}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-[10px] font-bold text-slate-600">{t.age} Years</span>
                              <span className={`text-[9px] font-mono uppercase mt-0.5 ${
                                t.eligibilityStatus === "ELIGIBLE" ? "text-emerald-500 font-bold" : "text-amber-500 font-semibold"
                              }`} title={t.eligibilityStatus}>
                                {t.eligibilityStatus || "ELIGIBLE"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {(() => {
                              const certStatus = t.certificationStatus || "NONE";
                              let label = "Under Evaluation";
                              let color = "bg-slate-100 text-slate-600 border-slate-200/50";
                              
                              if (certStatus === "CERTIFICATION_PENDING") {
                                label = "Pending Review";
                                color = "bg-amber-50 text-amber-600 border-amber-200";
                              } else if (certStatus === "CERTIFIED") {
                                label = "Certified File";
                                color = "bg-[#e2f3ee] text-[#008751] border-emerald-250";
                              } else if (certStatus === "CERTIFICATE_ISSUED") {
                                label = "Issued (Published)";
                                color = "bg-indigo-50 text-indigo-600 border-indigo-200";
                              } else if (certStatus === "ALUMNI" || t.alumniStatus) {
                                label = "Alumni Active";
                                color = "bg-purple-50 text-purple-600 border-purple-200";
                              }

                              return (
                                <span className={`inline-block border text-[10px] font-semibold px-2.5 py-1 rounded-full ${color}`} style={{ transition: "all 0.15s" }}>
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-4">
                            {t.certificateNumber ? (
                              <div className="flex flex-col">
                                <span className="font-mono text-[10px] font-bold text-indigo-550">{t.certificateNumber}</span>
                                {t.graduationBatch && (
                                  <span className="block text-[8.5px] uppercase font-bold text-slate-400 mt-0.5">{t.graduationBatch}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] italic text-slate-400 font-mono">No Serial Locks</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {actionLoading === t.id ? (
                              <div className="flex justify-end pr-4">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                
                                {/* Lifecycle button drivers dependent on state */}
                                {(!t.certificationStatus || t.certificationStatus === "NONE") && t.isEligibleForCert && (
                                  <button
                                    onClick={() => handleSingleTransition(t.id, "CERTIFICATION_PENDING", { graduationBatch: "Batch 2026-Cohort A", remark: "Trainee evaluated compliant with all program and background registers." })}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded-lg text-[10.5px] cursor-pointer transition"
                                    title="Approve for Certification Review Queue"
                                  >
                                    Approve Queue
                                  </button>
                                )}

                                {t.certificationStatus === "CERTIFICATION_PENDING" && (
                                  <button
                                    onClick={() => handleSingleTransition(t.id, "CERTIFIED", { remark: "Cryptographic credentials compiled successfully." })}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[10.5px] cursor-pointer transition flex items-center gap-1"
                                    title="Generate Certificate & Unique Serial Number"
                                  >
                                    <Sparkles className="w-3 h-3 text-white" />
                                    <span>Certify</span>
                                  </button>
                                )}

                                {t.certificationStatus === "CERTIFIED" && (
                                  <>
                                    <button
                                      onClick={() => handleSingleTransition(t.id, "CERTIFICATE_ISSUED", { remark: "Certificate issued to trainee and dispatched to verified mail addresses." })}
                                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1 rounded-lg text-[10.5px] cursor-pointer transition flex items-center gap-1"
                                      title="Issue certificate & dispatch to student email"
                                    >
                                      <Mail className="w-3 h-3 text-white" />
                                      <span>Dispatch</span>
                                    </button>
                                    <button 
                                      onClick={() => { setPreviewTrainee(t); setZoomScale(0.9); }}
                                      className="border border-slate-205 text-slate-800 hover:bg-slate-50 font-semibold px-2 py-1 rounded-lg text-[10.5px] cursor-pointer transition"
                                      title="Preview certificate layout details"
                                    >
                                      Preview
                                    </button>
                                  </>
                                )}

                                {t.certificationStatus === "CERTIFICATE_ISSUED" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setAlumniEditTrainee(t);
                                        setEmploymentStatus(t.alumniEmploymentStatus || "Employed");
                                        setEntrepreneurStatus(t.alumniEntrepreneurStatus || "None");
                                        setBusinessName(t.alumniBusinessName || "");
                                        setCurrentEmployer(t.alumniCurrentEmployer || "");
                                      }}
                                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 rounded-lg text-[10.5px] cursor-pointer transition flex items-center gap-1"
                                      title="Promote to Alumni & fill career demographic tracking details"
                                    >
                                      <Briefcase className="w-3 h-3" />
                                      <span>Graduate</span>
                                    </button>
                                    <button 
                                      onClick={() => { setPreviewTrainee(t); setZoomScale(0.9); }}
                                      className="border border-slate-205 text-slate-800 hover:bg-slate-50 font-semibold px-2 py-1 rounded-lg text-[10.5px] cursor-pointer transition"
                                      title="Preview certificate layout details"
                                    >
                                      Preview
                                    </button>
                                  </>
                                )}

                                {(t.certificationStatus === "ALUMNI" || t.alumniStatus) && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setAlumniEditTrainee(t);
                                        setEmploymentStatus(t.alumniEmploymentStatus || "Employed");
                                        setEntrepreneurStatus(t.alumniEntrepreneurStatus || "None");
                                        setBusinessName(t.alumniBusinessName || "");
                                        setCurrentEmployer(t.alumniCurrentEmployer || "");
                                      }}
                                      className="border border-purple-200 hover:bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-lg text-[10.5px] cursor-pointer transition"
                                      title="Edit Alumni Employment Demographics file"
                                    >
                                      Edit Tracking
                                    </button>
                                    <button 
                                      onClick={() => { setPreviewTrainee(t); setZoomScale(0.9); }}
                                      className="border border-slate-205 text-slate-800 hover:bg-slate-50 font-semibold px-2 py-1 rounded-lg text-[10.5px] cursor-pointer transition"
                                      title="Preview certificate layout details"
                                    >
                                      Preview
                                    </button>
                                  </div>
                                )}

                                {!t.isEligibleForCert && (!t.certificationStatus || t.certificationStatus === "NONE") && (
                                  <HelpCircle className="w-4 h-4 text-slate-350 cursor-help" title="Disqualified: Ensure candidate registers are active, grade boundaries passed, and age checks compliant." />
                                )}

                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>

        {/* Right Panel (Col 3): Bulk Controls & Operations Drawer */}
        <div className="xl:col-span-3 space-y-6 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs sticky top-24">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-550 border-b border-slate-100 pb-3 block">
              Bulk Certificate Center
            </h3>

            <p className="text-[11.5px] text-slate-400 mt-3 leading-normal">
              Accelerate lifecycle movements by batch certifying multiple selected records recursively. Secure, memory-efficient serial processing limits locked cycles.
            </p>

            <form onSubmit={handleBulkSubmit} className="mt-5 space-y-4">
              
              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Selected Profiles</label>
                <div className="mt-1.5 flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="font-semibold text-indigo-500 font-mono text-[12px]">
                    {selectedIds.length} Recipient Row{selectedIds.length !== 1 ? "s" : ""}
                  </span>
                  {selectedIds.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-slate-400 hover:text-slate-600 text-[10.5px] font-semibold cursor-pointer underline"
                    >
                      Clear Rows
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Bulk Transition Action</label>
                <select 
                  className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  value={bulkActionTarget}
                  onChange={(e) => setBulkActionTarget(e.target.value)}
                  required
                >
                  <option value="">Choose bulk transition target state</option>
                  <option value="CERTIFICATION_PENDING">Bulk Approve (Move to Pending Review)</option>
                  <option value="CERTIFIED">Bulk Certify (Generate Cryptographic Serials)</option>
                  <option value="CERTIFICATE_ISSUED">Bulk Dispatch (Mails to Candidate Emails)</option>
                  <option value="ALUMNI">Bulk Graduate (Promote to Alumni Registry)</option>
                </select>
              </div>

              {bulkActionTarget === "CERTIFICATION_PENDING" && (
                <div>
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Graduation Batch Code</label>
                  <input 
                    type="text" 
                    value={bulkGraduationBatch}
                    onChange={(e) => setBulkGraduationBatch(e.target.value)}
                    placeholder="e.g. Batch 2026-Cohort A"
                    className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Chronicle Remarks</label>
                <textarea 
                  value={bulkRemark}
                  onChange={(e) => setBulkRemark(e.target.value)}
                  placeholder="Record formal operations ledger note..."
                  className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 min-h-[70px] resize-none"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={selectedIds.length === 0 || !bulkActionTarget || actionLoading === "BULK_ACTION"}
                className={`w-full font-bold py-2.5 rounded-xl text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/5 ${
                  selectedIds.length === 0 || !bulkActionTarget || actionLoading === "BULK_ACTION"
                    ? "bg-slate-100 text-slate-350 cursor-not-allowed border border-slate-200/55 shadow-none"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {actionLoading === "BULK_ACTION" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing chunk queue...</span>
                  </>
                ) : (
                  <>
                    <sparkles className="w-4 h-4 text-white" />
                    <span>Execute Batch Series</span>
                  </>
                )}
              </button>

            </form>
          </div>
        </div>

      </div>

      {/* MODAL 1: HIGH QUALITY CERTIFICATE LAYOUT PREVIEW */}
      {previewTrainee && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/80 backdrop-blur-xs flex justify-center items-start py-10 px-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-[1080px] p-6 shadow-2xl relative">
            
            {/* Modal Exit and Toolbar */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 font-display">
                  Official Completion Credentials Preview
                </h3>
                <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                  Trainee: {previewTrainee.firstName} {previewTrainee.lastName} • ID: {previewTrainee.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                  <button 
                    onClick={() => setZoomScale(s => Math.max(s - 0.05, 0.5))}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-semibold px-1 text-slate-300">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button 
                    onClick={() => setZoomScale(s => Math.min(s + 0.05, 1.2))}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setZoomScale(0.9)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition text-xs flex items-center gap-1 cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button 
                  onClick={() => {
                    if (previewTrainee.certificateUrl) {
                      window.open(previewTrainee.certificateUrl, "_blank", "referrerPolicy=no-referrer");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer text-white"
                  title="Download Certificate PDF from CDN"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button 
                  onClick={() => {
                    const printContents = document.getElementById("certificate-modal-print-area")?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      // Trigger clean native window printing by injecting certificate HTML briefly 
                      const popup = window.open("", "_blank");
                      popup?.document.open();
                      popup?.document.write(`
                        <html>
                        <head>
                          <title>Certificate Of Completion Print Frame</title>
                          <style>
                            @page { size: A4 landscape; margin: 0; }
                            body { margin: 12mm; background-color: white; }
                          </style>
                        </head>
                        <body>
                          <div style="transform: none; width: 100%; border: 8px double #008751; padding: 30px; box-sizing: border-box; background-color: #fffbf5; height: 175mm;">
                            ${printContents}
                          </div>
                          <script>
                            window.onload = function() { window.print(); window.close(); }
                          </script>
                        </body>
                        </html>
                      `);
                      popup?.document.close();
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>

                <button 
                  onClick={() => setPreviewTrainee(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5 animate-spin-hover" />
                </button>
              </div>
            </div>

            {/* Scale Container */}
            <div className="w-full flex justify-center bg-slate-950 p-6 rounded-xl border border-slate-850 overflow-auto max-h-[580px]">
              
              <div 
                id="certificate-modal-print-area"
                style={{ 
                  transform: `scale(${zoomScale})`, 
                  transformOrigin: "top center",
                  transition: "transform 0.1s ease-out"
                }}
                className="w-[950px] bg-[#fffbf5] border-8 double border-[#008751] rounded-sm p-8 min-h-[660px] text-[#1e293b] relative flex flex-col justify-between shadow-2xl pointer-events-auto shrink-0"
              >
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                  <span className="text-[#008751]/[0.03] text-6xl font-bold font-sans uppercase -rotate-12 tracking-widest scale-125 whitespace-nowrap">
                    SECURED REGISTRY
                  </span>
                </div>

                <div className="border border-[#008751] p-6 text-center space-y-4 rounded-sm flex-grow flex flex-col justify-between relative z-10 bg-transparent min-h-[580px]">
                  
                  {/* Top Crest logo */}
                  <div className="flex flex-col items-center">
                    <svg className="w-14 h-14 mb-2" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#008751" strokeWidth="2" />
                      <path d="M50,15 L35,80 L50,75 L65,80 Z" fill="#008751" />
                      <circle cx="50" cy="45" r="10" fill="#d4af37" />
                    </svg>
                    <h4 className="font-sans font-bold text-[9px] tracking-widest text-[#334155] uppercase">
                      Federal Republic of Nigeria
                    </h4>
                    <h3 className="font-sans font-bold text-xs tracking-wide text-[#008751] uppercase mt-0.5">
                      National Board for Technical Education & skill sector
                    </h3>
                  </div>

                  {/* Title */}
                  <div>
                    <h1 className="font-serif italic font-semibold text-2xl capitalize text-[#0d1e3e]">
                      Certificate of Competence Completion
                    </h1>
                    <p className="text-[10px] text-slate-400 font-sans tracking-widest uppercase mt-0.5">
                      conferred upon trainee student
                    </p>
                  </div>

                  {/* Recipient name */}
                  <div>
                    <span className="text-xl font-serif font-bold text-[#008751] uppercase border-b-2 border-dashed border-[#d4af37] px-6 pb-1 inline-block tracking-wide">
                      {previewTrainee.firstName} {previewTrainee.lastName} {previewTrainee.otherName || ""}
                    </span>
                  </div>

                  {/* Award clause */}
                  <div className="max-w-2xl mx-auto text-xs text-[#1e293b] leading-relaxed">
                    Who has successfully audited, met biometrics ledger requisites, and completed the certified and officially accredited TVET Literacy & Skills sector development curriculum in
                    <span className="font-sans font-bold text-[#0d1e3e] block text-sm tracking-wide uppercase mt-1">
                      {previewTrainee.skillSector || "Computer Hardware Repairs & Cellphone System Board Diagnostics"}
                    </span>
                  </div>

                  {/* Contact Metrics */}
                  <div className="text-[10px] text-slate-550 border-t border-b border-slate-200 py-1.5 inline-block mx-auto">
                    Evaluated unit volume: <strong className="text-[#008751]">90 Classroom Contact Hours (9 Credits)</strong> • Grade Level: <strong className="text-[#008751]">Honorable Pass (Outstanding Merit)</strong>
                  </div>

                  {/* Trainee Signatories Table row layout */}
                  <div className="grid grid-cols-3 gap-4 items-end mt-2">
                    <div className="flex flex-col items-center">
                      <div className="w-28 border-b border-dashed border-slate-450 h-8 relative flex items-end justify-center">
                        <span className="font-serif italic text-xs text-[#008751]/80 absolute bottom-1">
                          O. Coordinator
                        </span>
                      </div>
                      <span className="text-[8.5px] font-sans font-bold text-slate-500 mt-1 uppercase text-center leading-none">
                        Operations Coordinator
                      </span>
                      <span className="text-[7.5px] font-sans text-slate-400 mt-0.5 text-center">
                        {previewTrainee.tsp || "Unique Technology Nig. Ltd"}
                      </span>
                    </div>

                    <div className="flex justify-center h-12 items-center">
                      <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#c5a02c] via-[#f7e383] to-[#bca03f] p-1">
                        <div className="w-full h-full rounded-full border border-dashed border-[#ffeeaa]/40 flex items-center justify-center bg-transparent">
                          <span className="font-mono text-[5px] font-bold text-[#4a3200] uppercase text-center">
                            ★ CERTIFIED ★
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-28 border-b border-dashed border-slate-450 h-8 relative flex items-end justify-center">
                        <span className="font-serif italic text-xs text-[#008751]/80 absolute bottom-1">
                          M. State Coordinator
                        </span>
                      </div>
                      <span className="text-[8.5px] font-sans font-bold text-slate-500 mt-1 uppercase text-center leading-none">
                        Registrar Representative
                      </span>
                      <span className="text-[7.5px] font-sans text-slate-400 mt-0.5 text-center">
                        Federal Ministry of Education TVET
                      </span>
                    </div>
                  </div>

                  {/* Verification footer with QR placement in corner */}
                  <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-200/40 text-left font-mono">
                    <div>
                      <p className="text-[8px] text-slate-500">
                        REGISTRY SERIAL CODE: <strong className="text-slate-700 font-bold">{previewTrainee.certificateNumber || "IDEAS-TVET-2026-X001"}</strong>
                      </p>
                      <p className="text-[8px] text-emerald-600 mt-0.5">
                        VERIFICATION CODE: <strong className="text-emerald-700 font-bold">{previewTrainee.certificateVerificationCode || "TVET-CRT-UNVERIFIED"}</strong>
                      </p>
                      <p className="text-[8px] text-slate-400 mt-0.5">
                        REFERENCE: <strong className="text-slate-650 font-bold">{previewTrainee.certificateReference || "REF-NONE"}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 block">
                        DATE SEALS: {previewTrainee.certificateIssuedAt ? new Date(previewTrainee.certificateIssuedAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: ALUMNI EMPLOYMENT DEMOGRAPHICS FILE CHANGER */}
      {alumniEditTrainee && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/70 backdrop-blur-xs flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-100 font-display">
                  Alumni Career Tracking & Profile
                </h3>
              </div>
              <button 
                onClick={() => setAlumniEditTrainee(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Enter post-training demographics and employment status profiles for <strong>{alumniEditTrainee.firstName} {alumniEditTrainee.lastName}</strong> to maintain exact federal impact indicators.
            </p>

            <form onSubmit={handleSaveAlumniProfile} className="space-y-4">
              
              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Work Employment Status</label>
                <select 
                  className="mt-1.5 w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 text-slate-100"
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value)}
                  required
                >
                  <option value="Employed">Gainfully Employed (Paid Job)</option>
                  <option value="Self-Employed">Self-Employed / Independent</option>
                  <option value="Unemployed">Transitioning / Unemployed</option>
                  <option value="Advanced Studies">Higher Technical Studies</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Entrepreneur Status</label>
                <select 
                  className="mt-1.5 w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 text-slate-100"
                  value={entrepreneurStatus}
                  onChange={(e) => setEntrepreneurStatus(e.target.value)}
                  required
                >
                  <option value="None">None</option>
                  <option value="Sole Proprietor">Sole Business Owner</option>
                  <option value="Co-Founder">Co-Founder (Partner)</option>
                </select>
              </div>

              {employmentStatus === "Self-Employed" || entrepreneurStatus !== "None" ? (
                <div>
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Registered Business Name</label>
                  <input 
                    type="text" 
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Unique Cyber Hub Repairs Ltd"
                    className="mt-1.5 w-full bg-slate-800/80 border border-slate-705 rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 text-slate-100"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-450 block">Current Employer</label>
                  <input 
                    type="text" 
                    value={currentEmployer}
                    onChange={(e) => setCurrentEmployer(e.target.value)}
                    placeholder="e.g. Kano Technical College"
                    className="mt-1.5 w-full bg-slate-800/80 border border-slate-705 rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 text-slate-100"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-800/60">
                <button 
                  type="button"
                  onClick={() => setAlumniEditTrainee(null)}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Undo
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading === "ALUMNI_UPDATE"}
                  className="bg-purple-600 hover:bg-purple-500 font-bold px-4 py-2 rounded-xl text-xs text-white tracking-wide transition flex items-center gap-1 cursor-pointer"
                >
                  {actionLoading === "ALUMNI_UPDATE" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Demographic Profile</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
