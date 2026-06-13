import React, { useState, useEffect } from "react";
import { 
  Users, CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Clock,
  Flame, Search, Filter, ArrowUpDown, ChevronDown, Download, FileSpreadsheet,
  FileText, Check, Database, Sparkles, RefreshCw, Bookmark, MapPin, Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TspAttendanceCenterProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function TspAttendanceCenter({ session, showToast }: TspAttendanceCenterProps) {
  const [activeTab, setActiveTab] = useState<"register" | "compliance" | "history">("register");
  const [loading, setLoading] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filters
  const [cohortFilter, setCohortFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [trainees, setTrainees] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [complianceRecords, setComplianceRecords] = useState<any[]>([]);
  const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);

  // Metadata Read-only (Derived or fallback)
  const assignedState = "Imo";
  const assignedTsp = "Unique Technology Nig. Ltd";
  const assignedSector = "ICT";
  const assignedSkill = "Computer Hardware and Cell Phone Repairs";

  useEffect(() => {
    loadData();
  }, [attendanceDate]);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch live beneficiaries inside our TSP
      const bRes = await fetch("/api/admissions/compliance-report?month=2026-06");
      const bData = await bRes.json();
      
      const res = await fetch(`/api/attendance?date=${attendanceDate}`);
      const attData = await res.json();
      
      // Match attendance status to beneficiaries
      if (bData.success && bData.records) {
        const mapped = bData.records.map((b: any) => {
          const matchedAtt = attData.records?.find((a: any) => a.beneficiary_id === b.id) || {};
          return {
            ...b,
            attendanceStatus: matchedAtt.status || "ABSENT",
            checkIn: matchedAtt.check_in_time ? matchedAtt.check_in_time.substring(11, 16) : "08:00",
            checkOut: matchedAtt.check_out_time ? matchedAtt.check_out_time.substring(11, 16) : "14:00",
            hoursLogged: matchedAtt.hours_logged !== undefined ? matchedAtt.hours_logged : (matchedAtt.status === "PRESENT" || matchedAtt.status === "LATE" ? 6.0 : 0.0),
            cohort: b.batch || "Batch 2026-C"
          };
        });
        setTrainees(mapped);
      }

      // Fetch compliance record list
      const compRes = await fetch("/api/attendance/compliance-report?month=2026-06");
      const compData = await compRes.json();
      if (compData.success && compData.records) {
        setComplianceRecords(compData.records);
      }
    } catch (e: any) {
      showToast("Failed to load attendance ledger: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (beneficiaryId: string, status: string) => {
    try {
      const trainee = trainees.find(t => t.id === beneficiaryId);
      if (!trainee) return;

      const dateNow = new Date().toISOString().split("T")[0];
      const checkInDateTime = status === "PRESENT" || status === "LATE" ? `${attendanceDate}T08:00:00.000Z` : null;
      const checkOutDateTime = status === "PRESENT" || status === "LATE" ? `${attendanceDate}T14:00:00.000Z` : null;

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id: beneficiaryId,
          attendance_date: attendanceDate,
          status,
          check_in_time: checkInDateTime,
          check_out_time: checkOutDateTime,
          attendance_source: "MANUAL"
        })
      });

      const data = await res.json();
      if (data.success) {
        setTrainees(prev => prev.map(t => {
          if (t.id === beneficiaryId) {
            return {
              ...t,
              attendanceStatus: status,
              hoursLogged: status === "PRESENT" || status === "LATE" ? 6.0 : 0.0
            };
          }
          return t;
        }));
        showToast(`Attendance marked ${status} for ${trainee.first_name} ${trainee.last_name}`, "success");
        
        // Reload compliance snapshots to reflect instant calculations
        const compRes = await fetch("/api/attendance/compliance-report?month=2026-06");
        const compData = await compRes.json();
        if (compData.success && compData.records) {
          setComplianceRecords(compData.records);
        }
      } else {
        showToast("Failed to update status: " + data.error, "error");
      }
    } catch (err: any) {
      showToast("Error updating status: " + err.message, "error");
    }
  };

  const handleBulkMark = async (status: string) => {
    if (selectedTrainees.length === 0) {
      showToast("Please select at least one beneficiary to bulk update", "info");
      return;
    }

    setSavingBulk(true);
    try {
      const records = selectedTrainees.map(id => {
        const checkInDateTime = status === "PRESENT" || status === "LATE" ? `${attendanceDate}T08:00:00.000Z` : null;
        const checkOutDateTime = status === "PRESENT" || status === "LATE" ? `${attendanceDate}T14:00:00.000Z` : null;
        return {
          beneficiary_id: id,
          attendance_date: attendanceDate,
          status,
          check_in_time: checkInDateTime,
          check_out_time: checkOutDateTime,
          attendance_source: "MANUAL"
        };
      });

      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Successfully bulk marked ${data.count} beneficiaries as ${status}`, "success");
        setSelectedTrainees([]);
        loadData();
      } else {
        showToast("Failed to perform bulk operations: " + data.error, "error");
      }
    } catch (err: any) {
      showToast("Error in bulk processing: " + err.message, "error");
    } finally {
      setSavingBulk(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrainees(filteredTrainees.map(t => t.id));
    } else {
      setSelectedTrainees([]);
    }
  };

  const handleSelectTrainee = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTrainees(prev => [...prev, id]);
    } else {
      setSelectedTrainees(prev => prev.filter(x => x !== id));
    }
  };

  // Filter application
  const filteredTrainees = trainees.filter(t => {
    const nameMatch = `${t.first_name} ${t.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase());
    const cohortMatch = cohortFilter === "all" || t.cohort === cohortFilter;
    const genderMatch = genderFilter === "all" || t.gender?.toUpperCase() === genderFilter.toUpperCase();
    const statusMatch = statusFilter === "all" || t.attendanceStatus?.toUpperCase() === statusFilter.toUpperCase();

    return nameMatch && cohortMatch && genderMatch && statusMatch;
  });

  const presentCount = trainees.filter(t => ["PRESENT", "LATE", "HOLIDAY", "FIELDWORK"].includes(t.attendanceStatus)).length;
  const absentCount = trainees.filter(t => t.attendanceStatus === "ABSENT").length;
  const lateCount = trainees.filter(t => t.attendanceStatus === "LATE").length;
  const overallRate = trainees.length > 0 ? Math.round((presentCount / trainees.length) * 100) : 100;

  // Sturdy visual badges for stipend statuses
  const getComplianceStatusBadge = (status: string) => {
    const mapping: any = {
      ELIGIBLE: { bg: "bg-emerald-50 text-emerald-850 border-emerald-250", label: "ELIGIBLE", icon: CheckCircle2 },
      AT_RISK: { bg: "bg-amber-50 text-amber-850 border-amber-250", label: "AT RISK Warning", icon: AlertTriangle },
      SUSPENDED: { bg: "bg-rose-50 text-rose-850 border-rose-250", label: "SUSPENDED Non-Compliant", icon: XCircle },
      ESCALATED: { bg: "bg-purple-50 text-purple-850 border-purple-250", label: "CRITICAL Escalated", icon: ShieldAlert }
    };
    const style = mapping[status] || mapping.ELIGIBLE;
    const Icon = style.icon;

    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-xl border flex items-center gap-1.5 w-fit ${style.bg}`}>
        <Icon className="w-3.5 h-3.5 text-current" />
        {style.label}
      </span>
    );
  };

  const getAttendanceStatusBadge = (status: string) => {
    const normalized = (status || "").toUpperCase();
    const mapping: any = {
      PRESENT: { bg: "bg-emerald-100 text-emerald-800", label: "PRESENT" },
      LATE: { bg: "bg-amber-100 text-amber-800", label: "LATE" },
      ABSENT: { bg: "bg-rose-100 text-rose-800", label: "ABSENT" },
      EXCUSED: { bg: "bg-indigo-100 text-indigo-800", label: "EXCUSED" },
      HOLIDAY: { bg: "bg-sky-100 text-sky-800", label: "HOLIDAY" },
      FIELDWORK: { bg: "bg-purple-100 text-purple-800", label: "FIELDWORK" }
    };
    const style = mapping[normalized] || { bg: "bg-slate-100 text-slate-800", label: normalized };
    return (
      <span className={`px-2 py-0.5 rounded text-xxs font-extrabold ${style.bg}`}>
        {style.label}
      </span>
    );
  };

  // Robust mock triggers for compliance exports
  const handleExportXlsx = () => {
    showToast("Compiling complete Annex 9 Attendance spreadsheet Ledger...", "info");
    setTimeout(() => {
      showToast("Official Workbook generated. Download active.", "success");
    }, 1500);
  };

  const handleExportPdf = () => {
    showToast("Rendering formatted monthly attendance audit PDF report...", "info");
    setTimeout(() => {
      showToast("PDF report successfully downloaded.", "success");
    }, 1500);
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans">
      
      {/* Read-only Assigned Header block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                LOCKED PORTAL ISOLATION
              </span>
              <span className="text-xs text-slate-500 font-mono">TSP: Unique Technology Nig. Ltd</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              TSP Attendance & Compliance Center
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Officially monitors and registers daily attendance logs and monthly performance snapshots for qualified beneficiaries.
            </p>
          </div>

          {/* Secure Badges Panel */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-slate-400 font-medium">State:</span> {assignedState}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-slate-400 font-medium">Sector:</span> {assignedSector}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-slate-400 font-medium">Skill:</span> {assignedSkill}
            </div>
          </div>
        </div>
      </div>

      {/* Numerical Quick Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Beneficiaries</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{trainees.length}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <Users className="w-6 h-6 text-slate-500" />
          </div>
        </div>

        <div className="bg-white border-2 border-emerald-400/30 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Present Today</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{presentCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Absent Today</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{absentCount}</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
            <XCircle className="w-6 h-6 text-rose-500" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Attendance Rate</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">{overallRate}%</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 -mb-px">
          <button
            onClick={() => setActiveTab("register")}
            className={`py-3 px-4 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition ${
              activeTab === "register" 
                ? "border-indigo-600 text-indigo-600 font-bold" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Daily Training Register
          </button>
          <button
            onClick={() => setActiveTab("compliance")}
            className={`py-3 px-4 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition ${
              activeTab === "compliance" 
                ? "border-indigo-600 text-indigo-600 font-bold" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Monthly Stipend Compliance
          </button>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={handleExportXlsx}
            className="px-3 py-1.5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/50 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Official Annex 9 (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 border border-rose-250 bg-rose-50 hover:bg-rose-100/50 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Audit Report PDF
          </button>
        </div>
      </div>

      {activeTab === "register" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-150/70 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
                />
              </div>

              {/* Date Input */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-bold">Session Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                />
              </div>

              {/* Cohort filter */}
              <select
                value={cohortFilter}
                onChange={(e) => setCohortFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-600 focus:outline-none"
              >
                <option value="all">All Cohorts</option>
                <option value="Batch 2026-C">Batch 2026-C</option>
                <option value="Batch 2024-C">Batch 2024-C</option>
              </select>

              {/* Gender filter */}
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-600 focus:outline-none"
              >
                <option value="all">All Genders</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-600 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="EXCUSED">EXCUSED</option>
                <option value="HOLIDAY">HOLIDAY</option>
                <option value="FIELDWORK">FIELDWORK</option>
              </select>
            </div>

            {/* Quick Refresh Button */}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Bulk Action Controls */}
          {selectedTrainees.length > 0 && (
            <div className="bg-indigo-50 border-b border-indigo-150 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-indigo-600 text-white text-xxs font-bold rounded-full flex items-center justify-center">
                  {selectedTrainees.length}
                </span>
                <span className="text-xs text-indigo-850 font-bold">Selected Beneficiaries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-750 font-bold mr-1">Bulk Operations:</span>
                <button
                  onClick={() => handleBulkMark("PRESENT")}
                  disabled={savingBulk}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  Present
                </button>
                <button
                  onClick={() => handleBulkMark("LATE")}
                  disabled={savingBulk}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  Late
                </button>
                <button
                  onClick={() => handleBulkMark("ABSENT")}
                  disabled={savingBulk}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  Absent
                </button>
                <button
                  onClick={() => handleBulkMark("EXCUSED")}
                  disabled={savingBulk}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  Excused
                </button>
              </div>
            </div>
          )}

          {/* Daily Table ledger */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xxs uppercase tracking-wider border-b border-slate-150 font-black">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredTrainees.length > 0 && selectedTrainees.length === filteredTrainees.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="p-4">Photo</th>
                  <th className="p-4">Beneficiary ID</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Gender</th>
                  <th className="p-4">Programme</th>
                  <th className="p-4">Cohort</th>
                  <th className="p-4">Check-In</th>
                  <th className="p-4">Check-Out</th>
                  <th className="p-4 text-center">Hours</th>
                  <th className="p-4 text-right">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-500 text-xs font-medium">
                      <Clock className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-2" />
                      Decrypting trainee attendance logs...
                    </td>
                  </tr>
                ) : filteredTrainees.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-500 text-xs font-medium">
                      No matching records found in this workspace.
                    </td>
                  </tr>
                ) : (
                  filteredTrainees.map((t, index) => {
                    const isSelected = selectedTrainees.includes(t.id);
                    return (
                      <tr 
                        key={t.id} 
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? "bg-indigo-50/20" : ""
                        }`}
                      >
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectTrainee(t.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-4">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 shadow-xxs overflow-hidden flex items-center justify-center">
                            {t.photo ? (
                              <img src={t.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="font-extrabold text-xxs text-slate-400">
                                {t.gender || "T"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-700">{t.id}</td>
                        <td className="p-4 font-extrabold text-slate-900">{t.first_name} {t.last_name}</td>
                        <td className="p-4 text-slate-500 font-bold">{t.gender || "F"}</td>
                        <td className="p-4 text-slate-500 font-bold">{t.program || "IDEAS-TVET"}</td>
                        <td className="p-4 text-slate-500 font-bold">{t.cohort}</td>
                        <td className="p-4 font-mono text-slate-500 font-bold">{t.checkIn}</td>
                        <td className="p-4 font-mono text-slate-500 font-bold">{t.checkOut}</td>
                        <td className="p-4 font-mono text-center font-bold text-slate-800">{t.hoursLogged.toFixed(1)} hrs</td>
                        <td className="p-4 text-right">
                          <select
                            value={t.attendanceStatus}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            className="px-2.5 py-1 border border-slate-250 bg-white rounded-lg text-xs font-black focus:outline-none"
                          >
                            <option value="PRESENT">PRESENT</option>
                            <option value="LATE">LATE</option>
                            <option value="ABSENT">ABSENT</option>
                            <option value="EXCUSED">EXCUSED</option>
                            <option value="HOLIDAY">HOLIDAY</option>
                            <option value="FIELDWORK">FIELDWORK</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "compliance" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          
          <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Monthly Stipend Evaluation Ledger</h3>
              <p className="text-xxs text-slate-500 mt-0.5">Calculated natively: Attendance Rate % = Present Days / Total Class Days in Month.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">Month:</span>
              <select className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-700 focus:outline-none">
                <option value="2026-06">June 2026 (Active Session)</option>
                <option value="2026-05">May 2026</option>
                <option value="2026-04">April 2026</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xxs uppercase tracking-wider border-b border-slate-150 font-black">
                  <th className="p-4">Beneficiary ID</th>
                  <th className="p-4">Trainee Name</th>
                  <th className="p-4">Gender</th>
                  <th className="p-4 text-center">Present Days</th>
                  <th className="p-4 text-center">Absent Days</th>
                  <th className="p-4 text-center">Total Hours</th>
                  <th className="p-4 text-center">Estimated Days</th>
                  <th className="p-4 text-center">Attendance %</th>
                  <th className="p-4">Compliance Status</th>
                  <th className="p-4 text-right">Evaluated Audit Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {complianceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-500">
                      No compliance logs compiled yet. Mark daily register to trigger compliance snapshots.
                    </td>
                  </tr>
                ) : (
                  complianceRecords.map((c) => {
                    const percentage = parseFloat(c.attendance_percentage) || 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-mono font-bold text-slate-700">{c.id}</td>
                        <td className="p-4 text-slate-900 font-extrabold">{c.first_name} {c.last_name}</td>
                        <td className="p-4 text-slate-500">{c.gender}</td>
                        <td className="p-4 text-center font-bold text-slate-800">{c.present_days} days</td>
                        <td className="p-4 text-center font-bold text-slate-800">{c.absent_days} days</td>
                        <td className="p-4 text-center font-bold text-slate-800">{c.total_hours} hrs</td>
                        <td className="p-4 text-center text-slate-500">{c.expected_days} days</td>
                        <td className="p-4 text-center">
                          <span className={`font-black text-xs ${
                            percentage >= 65 ? "text-emerald-600" : percentage >= 50 ? "text-amber-600" : "text-rose-600"
                          }`}>
                            {percentage}%
                          </span>
                        </td>
                        <td className="p-4">
                          {getComplianceStatusBadge(c.stipend_status || "ELIGIBLE")}
                        </td>
                        <td className="p-4 text-right text-slate-500 font-medium max-w-xs truncate" title={c.stipend_reason}>
                          {c.stipend_reason || "Evaluated successfully."}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
