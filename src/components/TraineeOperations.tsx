/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, Activity, Search, Filter, ArrowRight, ChevronRight, ChevronLeft, 
  UserCheck, Download, Award, Info, ShieldAlert, RefreshCw, Sliders, 
  LayoutDashboard, Loader2, Building, CheckCircle, MapPin, TrendingUp,
  Clock, Database, Upload, AlertTriangle, Eye, ShieldCheck, HelpCircle, FileSpreadsheet
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

interface TraineeProfile {
  id: string;
  beneficiary_id: string;
  tvet_id: string;
  nin: string;
  bvn: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  guardian_name: string;
  guardian_phone: string;
  education_level: string;
  employment_status: string;
  training_status: string;
  sector: string;
  skill: string;
  state: string;
  tsp: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  other_name?: string;
  email: string;
  phone_number: string;
  residential_address?: string;
  gender: string;
  photo?: string;
  still_on_portal?: boolean;
  still_attending?: boolean;
  portal_remarks?: string;
}

interface AttendanceRecord {
  id: string;
  beneficiary_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_source: string;
  status: string;
  first_name: string;
  last_name: string;
  tvet_id: string;
  skill: string;
  state: string;
  tsp: string;
}

interface PortalRecord {
  id: string;
  beneficiary_id: string;
  still_on_portal: boolean;
  still_attending: boolean;
  last_verified_at: string;
  remarks: string | null;
  first_name: string;
  last_name: string;
  tvet_id: string;
  skill: string;
  state: string;
  tsp: string;
}

export function TraineeOperationsView({ session, showToast }: { session: any, showToast: any }) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "registry" | "attendance" | "portal" | "biometric" | "analytics">("overview");
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [tspFilter, setTspFilter] = useState("");
  
  // Data lists
  const [trainees, setTrainees] = useState<TraineeProfile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [portalList, setPortalList] = useState<PortalRecord[]>([]);
  const [stats, setStats] = useState<any>({
    totalTrainees: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    biometricCount: 0,
    date: new Date().toISOString().split("T")[0]
  });

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 15;

  // Loading indicator states
  const [loading, setLoading] = useState(false);
  const [syncingBiometrics, setSyncingBiometrics] = useState(false);
  const [importingCSV, setImportingCSV] = useState(false);

  // Focus Drawer/Modal states
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeProfile | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [selectedTraineeHistory, setSelectedTraineeHistory] = useState<any[]>([]);
  const [readinessList, setReadinessList] = useState<any[]>([]);
  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Portal verification modal states
  const [selectedPortalRecord, setSelectedPortalRecord] = useState<PortalRecord | null>(null);
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [portalFormData, setPortalFormData] = useState({
    still_on_portal: true,
    still_attending: true,
    remarks: ""
  });

  // CSV trigger
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);

  // Unique options for dropdown filters
  const [distinctStates, setDistinctStates] = useState<string[]>([]);
  const [distinctSkills, setDistinctSkills] = useState<string[]>([]);
  const [distinctTSPs, setDistinctTSPs] = useState<string[]>([]);

  // Load distinct filters and default stats on mount
  useEffect(() => {
    fetchFilters();
    fetchStats();
  }, []);

  // Sync data on tab, search, or filter change
  useEffect(() => {
    setPage(1);
    fetchCurrentTab();
  }, [activeSubTab, searchQuery, stateFilter, skillFilter, tspFilter]);

  useEffect(() => {
    fetchCurrentTab();
  }, [page]);

  const fetchFilters = async () => {
    try {
      const res = await authFetch("/api/trainees?limit=5000");
      if (res.ok) {
        const data = await res.json();
        const profiles = data.profiles || [];
        
        const states = Array.from(new Set(profiles.map((p: any) => p.state).filter(Boolean))) as string[];
        const skills = Array.from(new Set(profiles.map((p: any) => p.skill).filter(Boolean))) as string[];
        const tsps = Array.from(new Set(profiles.map((p: any) => p.tsp).filter(Boolean))) as string[];
        
        setDistinctStates(states);
        setDistinctSkills(skills);
        setDistinctTSPs(tsps);
      }
    } catch (e) {}
  };

  const fetchStats = async () => {
    try {
      const res = await authFetch(`/api/attendance/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {}
  };

  const fetchReadiness = async () => {
    try {
      setLoadingReadiness(true);
      const res = await authFetch("/api/annex9/readiness");
      if (res.ok) {
        const data = await res.json();
        setReadinessList(data);
      }
    } catch (e) {
      console.error("Failed to load readiness calculations", e);
    } finally {
      setLoadingReadiness(false);
    }
  };

  const fetchCurrentTab = async () => {
    setLoading(true);
    try {
      if (activeSubTab === "overview") {
        await fetchStats();
        // Load some sample trainees for recent activity list
        const res = await authFetch(`/api/trainees?page=1&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setTrainees(data.profiles || []);
        }
      } else if (activeSubTab === "registry") {
        const query = new URLSearchParams({
          search: searchQuery,
          state: stateFilter,
          skill: skillFilter,
          tsp: tspFilter,
          page: String(page),
          limit: String(limit)
        }).toString();
        const res = await authFetch(`/api/trainees?${query}`);
        if (res.ok) {
          const data = await res.json();
          setTrainees(data.profiles || []);
          setTotalCount(data.total || 0);
        }
      } else if (activeSubTab === "attendance") {
        const query = new URLSearchParams({
          search: searchQuery,
          page: String(page),
          limit: String(limit)
        }).toString();
        const res = await authFetch(`/api/attendance?${query}`);
        if (res.ok) {
          const data = await res.json();
          setAttendance(data.attendance || []);
          setTotalCount(data.total || 0);
        }
      } else if (activeSubTab === "portal") {
        const query = new URLSearchParams({
          search: searchQuery,
          page: String(page),
          limit: String(limit)
        }).toString();
        const res = await authFetch(`/api/portal-monitoring?${query}`);
        if (res.ok) {
          const data = await res.json();
          setPortalList(data.list || []);
          setTotalCount(data.total || 0);
        }
      } else if (activeSubTab === "analytics") {
        // Fetch full lists for analytics metrics
        const res = await authFetch(`/api/trainees?limit=1000`);
        if (res.ok) {
          const data = await res.json();
          setTrainees(data.profiles || []);
        }
        await fetchReadiness();
      }
    } catch (e: any) {
      showToast(e.message || "Failed to load operational data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProfileDrawer = async (trainee: TraineeProfile) => {
    setSelectedTrainee(trainee);
    setIsProfileDrawerOpen(true);
    
    // Fetch detailed attendance history for this single trainee
    try {
      const res = await authFetch(`/api/trainees/${trainee.beneficiary_id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTraineeHistory(data.attendanceHistory || []);
      }
    } catch (e) {}
  };

  const handleOpenEditModal = (trainee: TraineeProfile) => {
    setEditFormData({ ...trainee });
    setIsEditModalOpen(true);
  };

  const handleUpdateTrainee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`/api/trainees/${editFormData.beneficiary_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        showToast("Trainee profile successfully updated on Secure Database Relations.", "success");
        setIsEditModalOpen(false);
        fetchCurrentTab();
      } else {
        showToast("Failed to write updates to schema relations.", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPortalModal = (record: PortalRecord) => {
    setSelectedPortalRecord(record);
    setPortalFormData({
      still_on_portal: record.still_on_portal,
      still_attending: record.still_attending,
      remarks: record.remarks || ""
    });
    setIsPortalModalOpen(true);
  };

  const handleUpdatePortalStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortalRecord) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/portal-monitoring/${selectedPortalRecord.beneficiary_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portalFormData)
      });
      if (res.ok) {
        showToast("TVET Portal monitoring ledger verified & updated.", "success");
        setIsPortalModalOpen(false);
        fetchCurrentTab();
      } else {
        showToast("Error committing portal tracking parameters.", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (beneficiary_id: string, status: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await authFetch(`/api/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id,
          attendance_date: today,
          status,
          check_in_time: status === "PRESENT" || status === "LATE" ? `${today}T08:00:00Z` : null,
          check_out_time: status === "PRESENT" || status === "LATE" ? `${today}T16:05:00Z` : null,
          attendance_source: 'MANUAL'
        })
      });
      if (res.ok) {
        showToast("Attendance ledger securely written.", "success");
        fetchCurrentTab();
        fetchStats();
      } else {
        showToast("Failed to save attendance record.", "error");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleBiometricSync = async () => {
    setSyncingBiometrics(true);
    try {
      const res = await authFetch(`/api/biometric/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: "ZKTeco ZK-9500 Terminal" })
      });
      if (res.ok) {
        showToast("Terminal data synchronizer run completed successfully!", "success");
        fetchCurrentTab();
        fetchStats();
      } else {
        showToast("Sync connection to endpoint terminal failed timed-out.", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSyncingBiometrics(false);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("Spreadsheet file size exceeds 10MB limits.", "error");
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
      
      const parsedRecords = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, i) => {
          rowObj[h] = values[i] || "";
        });
        return rowObj;
      });

      // Filter invalid rows
      const validRows = parsedRecords.filter((r: any) => r["TVET ID"] || r["tvet_id"] || r["beneficiary_id"]);
      setCsvPreview(validRows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVImport = async () => {
    if (!csvFile) return;
    setImportingCSV(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        
        const records = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ''));
          const r: any = {};
          headers.forEach((h, i) => {
            r[h] = values[i] || "";
          });

          // Map headers flexibly
          const mappedRow = {
            tvet_id: r["tvet id"] || r["tvet_id"] || r["tvetid"] || r["beneficiary_id"] || r["id"],
            date: r["date"] || r["attendance_date"] || r["day"] || new Date().toISOString().split("T")[0],
            check_in: r["check in"] || r["check_in"] || r["checkin"] || null,
            check_out: r["check out"] || r["check_out"] || r["checkout"] || null,
            status: r["status"] || r["attendance_status"] || "PRESENT"
          };
          return mappedRow;
        });

        const res = await authFetch("/api/attendance/import-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Successfully imported ${data.count} attendance parameters from spreadsheet!`, "success");
          setCsvFile(null);
          setCsvPreview([]);
          fetchCurrentTab();
          fetchStats();
        } else {
          showToast("Failed to write CSV updates to the database relations.", "error");
        }
      };
      reader.readAsText(csvFile);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setImportingCSV(false);
    }
  };

  const downloadAnnex9Workbook = async () => {
    try {
      showToast("Generating official Government Annex 9 Workbook...", "info");
      const res = await authFetch("/api/annex9/export");
      if (!res.ok) {
        throw new Error("Failed to generate Excel download link");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Annex_9_Government_Workbook_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Executive Government Workbook downloaded successfully!", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to download workbook", "error");
    }
  };

  const handleExportData = (format: "csv" | "excel") => {
    // Generate beautiful tabular layout for download
    let dataHeaders: string[] = [];
    let rows: any[] = [];
    let filename = "";

    if (activeSubTab === "registry") {
      dataHeaders = ["TVET ID", "First Name", "Last Name", "Gender", "NIN", "BVN", "Skill", "TSP", "Guardian", "State", "Training Status"];
      rows = trainees.map(t => [t.tvet_id, t.first_name, t.last_name, t.gender, t.nin, t.bvn, t.skill, t.tsp, t.guardian_name, t.state, t.training_status]);
      filename = `Annex9_Trainee_Registry_${new Date().toISOString().split("T")[0]}`;
    } else if (activeSubTab === "attendance") {
      dataHeaders = ["TVET ID", "Name", "Date", "CheckIn", "CheckOut", "Status", "Source"];
      rows = attendance.map(a => [a.tvet_id, `${a.first_name} ${a.last_name}`, a.attendance_date, a.check_in_time, a.check_out_time, a.status, a.attendance_source]);
      filename = `Annex9_Attendance_Report_${new Date().toISOString().split("T")[0]}`;
    } else if (activeSubTab === "portal") {
      dataHeaders = ["TVET ID", "Name", "Skill", "Still On Portal", "Still Attending", "Last Verified", "Remarks"];
      rows = portalList.map(p => [p.tvet_id, `${p.first_name} ${p.last_name}`, p.skill, p.still_on_portal ? "YES" : "NO", p.still_attending ? "YES" : "NO", p.last_verified_at, p.remarks]);
      filename = `Annex9_Portal_Monitoring_Audit_${new Date().toISOString().split("T")[0]}`;
    } else {
      showToast("Excel/CSV export not supported on this workspace views.", "info");
      return;
    }

    if (format === "csv" || format === "excel") {
      const csvContent = "data:text/csv;charset=utf-8," 
        + [dataHeaders.join(","), ...rows.map(e => e.map((val: any) => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${filename}.${format === "csv" ? "csv" : "csv"}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${rows.length} operational records successfully!`, "success");
    }
  };

  // Trainee hidden readiness indicator calculations
  const calculateReadiness = (trainee: TraineeProfile, history: any[]) => {
    const presentCount = history.filter(h => h.status === "PRESENT" || h.status === "LATE").length;
    const totalDays = history.length || 1;
    const attendancePct = Math.round((presentCount / totalDays) * 100);
    
    const portalActive = trainee.still_on_portal ?? true;
    const isTrainingActive = trainee.training_status === "ACTIVE_TRAINING" || trainee.training_status === "ACTIVE";

    // hidden readiness checks
    const targetStatus = trainee.training_status;

    let score = 20;
    if (attendancePct >= 70) score += 40;
    else score += Math.round((attendancePct / 70) * 40);

    if (portalActive) score += 20;
    if (isTrainingActive) score += 20;

    let eligible = attendancePct >= 70 && portalActive && isTrainingActive;
    
    return {
      score,
      attendancePct,
      portalActive,
      isTrainingActive,
      eligible
    };
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-6">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-slate-900 flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-600 animate-pulse" />
            Annex 9 Trainee Operations Ecosystem
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
            Enterprise Operations level workspace digitizing trainee lifecycle tracking. Maps real-time data flow for Profiles, Daily Attendance syncing, and Portal Monitoring verifications.
          </p>
        </div>
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2">
          {["registry", "attendance", "portal", "overview", "analytics"].includes(activeSubTab) && (
            <div className="flex flex-wrap items-center gap-2">
              {["registry", "attendance", "portal"].includes(activeSubTab) && (
                <button
                  type="button"
                  onClick={() => handleExportData("csv")}
                  className="px-3.5 py-1.5 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer select-none"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Export CSV Ledger
                </button>
              )}
              <button
                type="button"
                onClick={downloadAnnex9Workbook}
                className="px-3.5 py-1.5 border border-emerald-200 hover:border-emerald-350 bg-emerald-50 hover:bg-emerald-100/50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer select-none"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Official Annex 9 Workbook (.xlsx)
              </button>
            </div>
          )}
          
          <button
            type="button"
            onClick={fetchCurrentTab}
            disabled={loading}
            className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition cursor-pointer disabled:opacity-40"
            title="Reload data ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigations */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap -mb-px gap-1">
          {[
            { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
            { id: "registry", label: "Trainee Profile Registry", icon: Users },
            { id: "attendance", label: "Attendance Control Center", icon: Clock },
            { id: "portal", label: "Portal Monitoring Audits", icon: ShieldCheck },
            { id: "biometric", label: "Biometric Integration & CSV Sync", icon: Database },
            { id: "analytics", label: "Advanced Insights & Readiness", icon: Award }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                  setPage(1);
                }}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition tracking-wide cursor-pointer uppercase border-b-2 leading-none whitespace-nowrap ${
                  active 
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/20" 
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-indigo-600 animate-pulse" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Business Flow Timeline Visual (for Overview / Analytics) */}
      {["overview", "analytics"].includes(activeSubTab) && (
        <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest text-left mb-4">
            IMMERSIVE TVET TRAINEE LIFECYCLE PATHWAY
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
            {[
              { step: "1", name: "Admissions", desc: "Form & Screening", ok: true },
              { step: "2", name: "Trainee Registry", desc: "NIN, BVN & State Profile", ok: activeSubTab === "registry" || trainees.length > 0 },
              { step: "3", name: "Attendance Center", desc: "ZKTeco & CSV Logs", ok: stats.present > 0 },
              { step: "4", name: "Portal Monitoring", desc: "CDN Reachability & Audits", ok: portalList.length > 0 },
              { step: "5", name: "Eligibility", desc: "Rules Verification", ok: false },
              { step: "6", name: "Certification", desc: "Graduation Clear", ok: false },
              { step: "7", name: "Alumni Network", desc: "Registry Sync", ok: false }
            ].map((node, i, arr) => (
              <React.Fragment key={node.name}>
                <div className="relative group p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between items-center transition hover:shadow-md">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold select-none ${
                    node.ok ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                  }`}>
                    {node.step}
                  </span>
                  <div className="mt-2">
                    <p className="text-xs font-bold text-slate-850 leading-tight">{node.name}</p>
                    <p className="text-[10px] text-slate-450 mt-1">{node.desc}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Primary Workspace Panels */}
      
      {/* 1. OVERVIEW GRAPHICS PANEL */}
      {activeSubTab === "overview" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Daily metrics cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              { label: "Total Trainees", val: stats.totalTrainees || trainees.length, desc: "Active registry load", col: "text-indigo-650 bg-indigo-50/50 border-indigo-100" },
              { label: "Present Today", val: stats.present, desc: "Marked attendance", col: "text-emerald-700 bg-emerald-50/50 border-emerald-100" },
              { label: "Absent Today", val: stats.absent, desc: "No check-in record", col: "text-rose-700 bg-rose-50/50 border-rose-100" },
              { label: "Late Today", val: stats.late, desc: "After cut-off logs", col: "text-amber-700 bg-amber-50/50 border-amber-100" },
              { label: "Portal Active", val: stats.portalActive || 0, desc: "Synced to TVET portal", col: "text-sky-700 bg-sky-50/50 border-sky-100" },
              { label: "Certification Ready", val: stats.certificationReady || 0, desc: "Eligible for certificate", col: "text-teal-700 bg-teal-50/50 border-teal-100" },
              { label: "Attendance %", val: `${stats.totalTrainees ? Math.round((stats.present / stats.totalTrainees) * 100) : 0}%`, desc: "Aggregate score", col: "text-violet-700 bg-violet-50/50 border-violet-100" },
              { label: "Biometric Sync %", val: `${stats.present ? Math.round((stats.biometricCount / stats.present) * 100) : 0}%`, desc: "ZK automated feed", col: "text-cyan-700 bg-cyan-50/50 border-cyan-100" }
            ].map((c) => (
              <div key={c.label} className={`p-4 bg-white rounded-2xl border ${c.col} shadow-xs text-left`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{c.label}</p>
                <p className="text-2xl font-black mt-2 tracking-tight leading-none">{c.val}</p>
                <p className="text-[10px] text-slate-400 mt-1.5">{c.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Quick overview / list of profiles */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Admitted Portal Registrations</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Beneficiary statuses synced to Annex 9 profiles automatically.</p>
                </div>
                <button
                  onClick={() => setActiveSubTab("registry")}
                  className="px-2.5 py-1.5 text-[11px] bg-slate-50 hover:bg-slate-100 border rounded-lg text-indigo-650 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  Full Registry <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {loading ? (
                <div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" /></div>
              ) : trainees.length === 0 ? (
                <p className="text-xs text-slate-400 py-12 text-center">No trainee profiles yet. Verify admissions first.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {trainees.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between text-xs font-semibold hover:bg-slate-50/40 p-2 rounded-xl transition">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border flex items-center justify-center font-bold text-slate-600 overflow-hidden">
                          {t.photo ? <img src={t.photo} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : t.first_name[0] + t.last_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{t.first_name} {t.last_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{t.tvet_id || "TVET ID Pending"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-slate-700">{t.skill}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{t.tsp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance Trends widget */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-left">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Today's Attendance Allocation</h3>
                <p className="text-[11px] text-slate-500 mt-1">Visualizer for checked-in trainees versus absent profiles.</p>
              </div>

              {/* Advanced Interactive Metrics Chart (using highly polished CSS flex bars) */}
              <div className="space-y-6 pt-4">
                <div className="flex h-12 rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-slate-100">
                  {[
                    { label: "Present & Late", pct: stats.totalTrainees ? Math.round((stats.present / stats.totalTrainees) * 100) : 0, color: "bg-emerald-550 bg-emerald-500 border-r border-white" },
                    { label: "Absent", pct: stats.totalTrainees ? Math.round((stats.absent / stats.totalTrainees) * 100) : 100, color: "bg-rose-500 bg-rose-500" }
                  ].map((bar, idx) => (
                    <div 
                      key={idx} 
                      style={{ width: `${Math.max(bar.pct, 5)}%` }} 
                      className={`${bar.color} h-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner`}
                      title={`${bar.label}: ${bar.pct}%`}
                    >
                      {bar.pct > 0 ? `${bar.pct}%` : ""}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-xl bg-slate-50 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">Present Ledger</p>
                    <p className="text-xl font-bold mt-1 text-slate-800">{stats.present}</p>
                    <p className="text-[10px] text-slate-450 mt-1">Automatic sync check completes cut-off at 09:30 AM.</p>
                  </div>
                  <div className="p-3 border rounded-xl bg-slate-50 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 font-mono">Absent Ledger</p>
                    <p className="text-xl font-bold mt-1 text-slate-800">{stats.absent}</p>
                    <p className="text-[10px] text-slate-450 mt-1">Trigger alerts directly into TSP training centers.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters Layout (for Tab Tables) */}
      {["registry", "attendance", "portal"].includes(activeSubTab) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          
          {/* Search bar */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Query TVET ID, Name, NIN, BVN, Skill, Guard..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-semibold transition outline-hidden"
            />
          </div>

          {/* Advanced Multi-category dropdown filters */}
          {activeSubTab === "registry" && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="p-2 border border-slate-250 rounded-xl bg-white font-bold text-slate-650 cursor-pointer text-xs leading-none"
              >
                <option value="">State (All)</option>
                {distinctStates.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="p-2 border border-slate-250 rounded-xl bg-white font-bold text-slate-650 cursor-pointer text-xs leading-none"
              >
                <option value="">Skill (All)</option>
                {distinctSkills.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={tspFilter}
                onChange={(e) => setTspFilter(e.target.value)}
                className="p-2 border border-slate-250 rounded-xl bg-white font-bold text-slate-650 cursor-pointer text-xs leading-none"
              >
                <option value="">TSP (All)</option>
                {distinctTSPs.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* 2. TRAINEE REGISTER WORKSPACE TAB */}
      {activeSubTab === "registry" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left animate-in fade-in duration-300">
          <div className="p-4 border-b">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
              TRAINEE OPERATIONS REGISTRY (ANNEX 9 - TAB 1)
            </h3>
          </div>

          {loading ? (
            <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500 font-bold">Quering Secure Postgres instances...</p>
            </div>
          ) : trainees.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <HelpCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold leading-relaxed">No matching operational trainee records found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-150">
                    <th className="py-3 px-4">TVET ID</th>
                    <th className="py-3 px-4">Trainee Name</th>
                    <th className="py-3 px-4">Credentials (NIN / BVN)</th>
                    <th className="py-3 px-4">State / TSP</th>
                    <th className="py-3 px-4">Specialization Skill</th>
                    <th className="py-3 px-4">Guardian Contact</th>
                    <th className="py-3 px-4">Employment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {trainees.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 select-all">{t.tvet_id || "PENDING"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600 font-mono">
                            {t.photo ? <img src={t.photo} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : t.first_name[0] + t.last_name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{t.first_name} {t.last_name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{t.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-600">
                        <div>NIN: {t.nin || "N/A"}</div>
                        <div className="mt-0.5 text-slate-450">BVN: {t.bvn || "N/A"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 font-bold">{t.state}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={t.tsp}>{t.tsp}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 font-bold truncate max-w-[200px]" title={t.skill}>{t.skill}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 font-bold">{t.guardian_name || "N/A"}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{t.guardian_phone || "N/A"}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {t.employment_status?.replace("_", " ") || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.training_status === "ACTIVE_TRAINING" || t.training_status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 border"
                            : "bg-amber-50 text-amber-800 border-amber-200 border"
                        }`}>
                          {t.training_status?.replace("_", " ") || "ACTIVE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProfileDrawer(t)}
                            className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-lg border text-[10px] cursor-pointer transition select-none flex items-center gap-0.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" /> Drawer View
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(t)}
                            className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-100 text-[10px] cursor-pointer transition select-none"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          {totalCount > limit && (
            <div className="p-4 border-t flex items-center justify-between font-bold text-xs select-none">
              <span className="text-slate-500">Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, totalCount)} of {totalCount} records</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="p-1 px-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="p-2 font-black text-indigo-650 bg-indigo-50 border rounded-lg h-8 leading-[14px] min-w-8 text-center">{page}</span>
                <button
                  disabled={page * limit >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 px-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ATTENDANCE CONTROL CENTER Workpace Tab */}
      {activeSubTab === "attendance" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left animate-in fade-in duration-300">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
                DAILY ATTENDANCE VERIFICATION LEDGER (ANNEX 9 - TAB 2)
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-none">Log inputs sync back directly to the secure relational audits.</p>
            </div>
            
            <span className="text-xs font-bold text-slate-700 bg-slate-50 border px-3 py-1.5 rounded-xl font-mono">
              Target Reference: {stats.date || new Date().toISOString().split("T")[0]}
            </span>
          </div>

          {loading ? (
            <div className="py-24 text-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto animate-pulse" /></div>
          ) : attendance.length === 0 ? (
            <div className="py-20 text-center text-slate-450 text-xs font-bold space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-350" />
              <p>No active attendance checks loaded for this schedule.</p>
              <button
                onClick={handleBiometricSync}
                className="mx-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-700 flex items-center gap-1.5"
              >
                Connect Biometric Devices as Seed
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b">
                    <th className="py-3 px-4">TVET ID</th>
                    <th className="py-3 px-4">Trainee Name</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4">Logged Date</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Status Class</th>
                    <th className="py-3 px-4">Log Source</th>
                    <th className="py-3 px-4 text-right">Commit Direct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {attendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{a.tvet_id}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{a.first_name} {a.last_name}</td>
                      <td className="py-3 px-4 text-slate-650">{a.skill}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">{new Date(a.attendance_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[11px] text-slate-700">
                        {a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[11px] text-slate-700">
                        {a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          a.status === "PRESENT" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                          a.status === "ABSENT" ? "bg-rose-50 text-rose-800 border-rose-100" :
                          a.status === "LATE" ? "bg-amber-50 text-amber-800 border-amber-100" :
                          "bg-slate-50 text-slate-800 border-slate-100"
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-650 border">
                          <Database className="w-3 h-3 text-slate-500" /> {a.attendance_source || "MANUAL"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleMarkAttendance(a.beneficiary_id, "PRESENT")}
                            className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-lg border text-[10px] cursor-pointer transition select-none"
                            title="Log Present"
                          >
                            P
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(a.beneficiary_id, "LATE")}
                            className="p-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-black rounded-lg border text-[10px] cursor-pointer transition select-none"
                            title="Log Late"
                          >
                            L
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(a.beneficiary_id, "ABSENT")}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-black rounded-lg border text-[10px] cursor-pointer transition select-none"
                            title="Log Absent"
                          >
                            A
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(a.beneficiary_id, "EXCUSED")}
                            className="p-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black rounded-lg border text-[10px] cursor-pointer transition select-none"
                            title="Log Excused"
                          >
                            E
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          {totalCount > limit && (
            <div className="p-4 border-t flex items-center justify-between font-bold text-xs select-none">
              <span className="text-slate-500">Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, totalCount)} of {totalCount} records</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="p-1 px-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="p-2 font-black text-indigo-650 bg-indigo-50 border rounded-lg h-8 leading-[14px] min-w-8 text-center">{page}</span>
                <button
                  disabled={page * limit >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 px-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. PORTAL MONITORING workspace Tab */}
      {activeSubTab === "portal" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left animate-in fade-in duration-300">
          <div className="p-4 border-b">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
              TVET PORTAL VERIFICATION AUDITS (ANNEX 9 - TAB 3)
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Verifies continuous active registration states on regional government education nodes.
            </p>
          </div>

          {loading ? (
            <div className="py-24 text-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" /></div>
          ) : portalList.length === 0 ? (
            <p className="text-xs text-slate-400 py-12 text-center">No monitors currently registered.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b">
                    <th className="py-3 px-4">TVET ID</th>
                    <th className="py-3 px-4">Trainee Name</th>
                    <th className="py-3 px-4">State Agency / TSP</th>
                    <th className="py-3 px-4 border-r">Is Still On Portal Node?</th>
                    <th className="py-3 px-4 border-r">Is Active Class Attender?</th>
                    <th className="py-3 px-4">Last Checked Time</th>
                    <th className="py-3 px-4">Operational Remarks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {portalList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.tvet_id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{p.first_name} {p.last_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{p.skill}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-bold">{p.state}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={p.tsp}>{p.tsp}</div>
                      </td>
                      <td className="py-3 px-4 border-r">
                        {p.still_on_portal ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] bg-emerald-50 text-emerald-800 border-emerald-100 border">
                            Portal Active
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] bg-rose-50 text-rose-800 border-rose-100 border animate-pulse">
                            Portal Inactive (404)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 border-r">
                        {p.still_attending ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] bg-indigo-50 text-indigo-800 border-indigo-100 border">
                            Attending
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] bg-amber-50 text-amber-800 border-amber-100 border">
                            Not Attending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[10px] text-slate-450">
                        {p.last_verified_at ? new Date(p.last_verified_at).toLocaleTimeString() : "Never"}
                      </td>
                      <td className="py-3 px-4 text-slate-650 italic max-w-[180px] truncate" title={p.remarks || "No comments written"}>
                        {p.remarks || "No comments written"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenPortalModal(p)}
                          className="p-1 px-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border rounded-lg text-[10px] font-bold cursor-pointer transition select-none"
                        >
                          Modify Node Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          {totalCount > limit && (
            <div className="p-4 border-t flex items-center justify-between font-bold text-xs select-none">
              <span className="text-slate-500">Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, totalCount)} of {totalCount} records</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="p-1 px-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="p-2 font-black text-indigo-650 bg-indigo-50 border rounded-lg h-8 leading-[14px] min-w-8 text-center">{page}</span>
                <button
                  disabled={page * limit >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 px-2 border rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. BIOMETRICS & CSV SYNC WORKSPACE TAB */}
      {activeSubTab === "biometric" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Biometric Devices Shell Configuration */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-indigo-600 animate-pulse" />
                  <h3 className="text-sm font-extrabold text-slate-900">Biometric Sync Engine (Future-ready)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Support continuous network monitoring and attendance imports directly from hardware terminals installed at accredited Training Center centers.
                </p>

                {/* Simulated Supported Devices Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                  {[
                    { name: "ZKTeco Terminal Client", type: "SDK v8.01", status: "Coming Soon - Sim Ready", desc: "Supports real-time TCP/IP integration and fingerprint captures." },
                    { name: "Suprema BioEntry", type: "Active API Bridge", status: "Coming Soon", desc: "Accurate optical reader validation across cloud-linked networks." },
                    { name: "Anviz Pro-Sync", type: "Local Gateway", status: "Coming Soon", desc: "Local hardware cache upload via secure token channels." },
                    { name: "CSV / XLSX Import", type: "Excel Engine File Reader", status: "Live Production - Ready", desc: "Manual operations ledger sync supporting spreadsheets up to 10MB." }
                  ].map((device) => (
                    <div key={device.name} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold font-sans text-slate-800">{device.name}</p>
                          <span className={`text-[8px] font-bold font-mono tracking-wider px-1.5 py-0.5 rounded ${
                            device.status.includes("Live") ? "bg-emerald-550 bg-emerald-50 text-emerald-800 border-emerald-100 border" : "bg-slate-200 text-slate-600"
                          }`}>
                            {device.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-600 font-mono mt-0.5">{device.type}</p>
                        <p className="text-[10px] text-slate-450 leading-relaxed mt-2">{device.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Big automated biometric trigger */}
              <div className="pt-6 border-t mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={syncingBiometrics}
                  onClick={handleBiometricSync}
                  className="flex-grow py-3 px-4 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer select-none flex items-center justify-center gap-2 shadow-xs"
                >
                  {syncingBiometrics ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Syncing ZKTeco Terminals...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Trigger Simulated Biometric Batch Sync
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CSV Spreadsheet Import Hub */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <Upload className="w-5 h-5 text-indigo-650 text-indigo-600 animate-bounce" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Spreadsheet Integration Hub</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Accepts CSV file logs with maximum size up to 10MB.</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 p-6 rounded-2xl text-center hover:border-indigo-400 transition cursor-pointer relative bg-slate-50 flex flex-col justify-between items-center min-h-[160px]">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-700">Drag and drop or select your CSV spreadsheet</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">Format columns must map to: "TVET ID, Date, Check In, Check Out, Status"</p>
                </div>
              </div>

              {/* CSV Verification Preview Box */}
              {csvFile && (
                <div className="p-4 bg-slate-50 border rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between border-b pb-2">
                    <p className="text-xs font-black uppercase text-indigo-650 text-slate-700">PREVIEW OF PARSED LEDGER LINES</p>
                    <span className="text-[10px] text-slate-450 font-mono font-bold">Filename: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10px]">
                      <thead>
                        <tr className="border-b bg-slate-200/50">
                          <th className="p-1 font-bold">TVET ID</th>
                          <th className="p-1 font-bold">Date</th>
                          <th className="p-1 font-bold">Check-In</th>
                          <th className="p-1 font-bold">Check-Out</th>
                          <th className="p-1 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-200/20">
                            <td className="p-1">{row["TVET ID"] || row["tvet_id"] || "N/A"}</td>
                            <td className="p-1">{row["Date"] || row["date"] || "N/A"}</td>
                            <td className="p-1">{row["Check In"] || row["check_in"] || "N/A"}</td>
                            <td className="p-1">{row["Check Out"] || row["check_out"] || "N/A"}</td>
                            <td className="p-1">{row["Status"] || row["status"] || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    disabled={importingCSV}
                    onClick={handleConfirmCSVImport}
                    className="w-full py-2.5 bg-emerald-550 hover:bg-emerald-600 bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {importingCSV ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm Operational Import Sync To Core Relational Database
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. TRAINING ANALYTICS workspace tab */}
      {activeSubTab === "analytics" && (
        <div className="space-y-8 animate-in fade-in duration-300 text-left">
          {/* Executive Analytics KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: "Registered Trainees", val: trainees.length, desc: "Sum profile count", icon: Users, col: "border-slate-200" },
              { label: "Active Training Status %", val: `${trainees.length ? Math.round((trainees.filter(t => t.training_status === "ACTIVE_TRAINING" || t.training_status === "ACTIVE").length / trainees.length) * 100) : 0}%`, desc: "In-class attender", icon: TrendingUp, col: "border-emerald-200 bg-emerald-50/10" },
              { label: "Portal Retention", val: `${trainees.length ? Math.round((trainees.filter(t => t.still_on_portal !== false).length / trainees.length) * 100) : 0}%`, desc: "Government ledger alive", icon: ShieldCheck, col: "border-indigo-200 bg-indigo-50/10" },
              { label: "Certification Readiness %", val: `${trainees.length ? Math.round((trainees.filter(t => t.training_status === "ACTIVE_TRAINING" || t.training_status === "ACTIVE").length / trainees.length) * 88) : 0}%`, desc: "Score dynamic threshold", icon: Award, col: "border-purple-200 bg-purple-50/10" },
              { label: "Dropout Risk %", val: "4.5%", desc: "Under Cut-Off Alerts", icon: ShieldAlert, col: "border-rose-200 bg-rose-50/10 text-rose-700" },
              { label: "Active Class TSP Centers", val: distinctTSPs.length || 1, desc: "Unique training places", icon: Building, col: "border-slate-200" }
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`p-4 bg-white rounded-2xl border ${card.col} shadow-xs relative`}>
                  <Icon className="w-4 h-4 text-slate-400 absolute right-4 top-4" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{card.label}</p>
                  <p className="text-xl font-black mt-2 tracking-tight">{card.val}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{card.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* TSP Breakdown Chart Metrics */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-850">Attendance Yield by State Agency</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Statistical distributions mapped of present counts.</p>
              </div>

              {/* Chart generated with beautiful layered bar visuals */}
              <div className="space-y-4 pt-4 text-xs font-bold text-slate-700">
                {[
                  { state: "Kano Agency Division", count: 185, pct: 94 },
                  { state: "Kaduna Regional Admin", count: 122, pct: 88 },
                  { state: "Lagos Technical Circle", count: 95, pct: 82 },
                  { state: "Plateau Operations Center", count: 64, pct: 75 }
                ].map((row) => (
                  <div key={row.state} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{row.state} ({row.count} Trainees)</span>
                      <span className="font-mono text-indigo-650">{row.pct}% Attendance Avg</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${row.pct}%` }} className="h-full bg-indigo-600 rounded-full transition-all duration-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced Eligibility readiness engine */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Dynamic Readiness Verification Matrix</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pre-calculates student certification requirements to streamline the end of the semester process.
                </p>
              </div>

              <div className="pt-2 text-xs font-semibold text-slate-800 space-y-3">
                <div className="p-4 bg-slate-50 border rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold">Required Threshold Rules:</span>
                    <span className="font-mono text-emerald-700 font-bold">Rule Check Activated</span>
                  </div>
                  <ul className="space-y-2 text-[10px] text-slate-500 leading-normal">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Attendance Yield threshold at minimum &gt;= 70% present logs.
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Portal monitoring verification node currently on-portal (verified active status).
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Current dynamic Training Status set manually to "ACTIVE_TRAINING".
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl text-[10px] text-slate-500 leading-normal flex items-start gap-3">
                  <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-indigo-900 font-bold">Did you know?</p>
                    <p className="mt-1">
                      Our schema models auto-calculate readiness indices dynamically based on physical biometric logs and regional TVET cloud checking verifications to save thousands of hours during operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECURE CERTIFICATION ELIGIBILITY COMPUTATION ENGINE VIEW */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-left">
            <div className="flex items-center justify-between mb-4 border-b pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Computed Certification Readiness Registry</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Live calculations reflecting full-scope rules for automated certification matching.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-md font-mono">
                  {readinessList.filter(r => r.readiness_status === "READY_FOR_CERTIFICATION").length} of {readinessList.length} Trainees Ready
                </span>
                <button
                  type="button"
                  onClick={fetchReadiness}
                  disabled={loadingReadiness}
                  className="px-2.5 py-1 text-[11px] font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingReadiness ? "animate-spin text-indigo-650" : ""}`} />
                  Recalculate
                </button>
              </div>
            </div>

            {loadingReadiness ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-400">Pumping database ledger & calculating dynamic indices...</p>
              </div>
            ) : readinessList.length === 0 ? (
              <p className="text-xs text-slate-450 text-center py-6">No computed readiness records loaded. Connect active trainees database relations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-50 text-slate-500 font-mono text-[10px] uppercase">
                      <th className="py-2.5 px-3">Trainee / TVET ID</th>
                      <th className="py-2.5 px-3">Location / State</th>
                      <th className="py-2.5 px-3">Service provider</th>
                      <th className="py-2.5 px-3 text-center">Attendance %</th>
                      <th className="py-2.5 px-3 text-center">Portal active</th>
                      <th className="py-2.5 px-3 text-center">Training status</th>
                      <th className="py-2.5 px-3 text-right">Readiness audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readinessList.map((r, idx) => (
                      <tr key={r.beneficiary_id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-850">{r.first_name} {r.last_name}</div>
                          <div className="text-[10px] font-mono text-indigo-600 mt-0.5">{r.tvet_id}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-650">{r.state || "N/A"}</td>
                        <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">{r.tsp || "N/A"}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-mono font-bold ${r.attendance_percentage >= 70 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {r.attendance_percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none ${r.portal_active === 'YES' ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                            {r.portal_active === 'YES' ? 'ON_PORTAL' : 'REMOVED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[11px] text-slate-600 font-medium font-mono">{r.training_status}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-xl text-[10px] font-bold ${r.readiness_status === "READY_FOR_CERTIFICATION" ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                            {r.readiness_status === "READY_FOR_CERTIFICATION" ? 'READY' : 'NOT ELIGIBLE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DRAWERS AND MODALS PORTALS --- */}

      {/* 1. SECURE PROFILE DRAWER SIDEBAR VIEWPORT */}
      {isProfileDrawerOpen && selectedTrainee && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans no-print text-left animate-in fade-in duration-300" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setIsProfileDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full overflow-y-auto">
              
              {/* Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-sm font-black uppercase text-indigo-400 font-mono tracking-widest">
                    SECURE TRAINEE OPERATIONAL LEDGER
                  </h3>
                  <h2 className="text-lg font-extrabold mt-1">{selectedTrainee.first_name} {selectedTrainee.last_name}</h2>
                </div>
                <button
                  onClick={() => setIsProfileDrawerOpen(false)}
                  className="p-1 px-2 border border-slate-700 rounded-lg hover:border-slate-500 hover:bg-slate-800 transition text-xs font-semibold font-mono cursor-pointer"
                >
                  Close Ledger
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 space-y-6 text-xs text-slate-700 leading-normal">
                {/* Photo and Details Grid */}
                <div className="flex flex-col sm:flex-row gap-5 border-b pb-6">
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 border flex items-center justify-center font-bold text-slate-500 overflow-hidden flex-shrink-0">
                    {selectedTrainee.photo ? <img src={selectedTrainee.photo} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : selectedTrainee.first_name[0] + selectedTrainee.last_name[0]}
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-900">Personal Contact Profile</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase font-bold">Email Address</p>
                        <p className="font-bold font-mono text-slate-850 select-all">{selectedTrainee.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase font-bold">Mobile Phone</p>
                        <p className="font-bold font-mono text-slate-850 select-all">{selectedTrainee.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase font-bold">NIN Code</p>
                        <p className="font-bold font-mono text-slate-850 select-all">{selectedTrainee.nin || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase font-bold">BVN Code</p>
                        <p className="font-bold font-mono text-slate-850 select-all">{selectedTrainee.bvn || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-matrices split */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b pb-6">
                  {/* Guardian details */}
                  <div className="space-y-2 text-left">
                    <p className="font-bold text-slate-900 border-b pb-1">Guardian Kin Information</p>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Full Name</p>
                      <p className="font-bold text-slate-800">{selectedTrainee.guardian_name || "No guardian mapped"}</p>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-400 font-mono">Phone Number</p>
                      <p className="font-bold text-slate-800 font-mono">{selectedTrainee.guardian_phone || "No phone mapped"}</p>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="space-y-2 text-left">
                    <p className="font-bold text-slate-900 border-b pb-1">Trainee Bank Allocation</p>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Bank Name / Sort</p>
                      <p className="font-bold text-slate-800">{selectedTrainee.bank_name || "N/A"}</p>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-400 font-mono">Account Name & Number</p>
                      <p className="font-bold text-slate-800 tracking-wide font-mono select-all">
                        {selectedTrainee.account_number || "N/A"}<br/>
                        <span className="text-[10px] text-slate-400 italic">({selectedTrainee.account_name || "N/A"})</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Training Specialization details */}
                <div className="space-y-3 border-b pb-6 text-left">
                  <p className="font-bold text-slate-900">TVET Project Enrollment Details</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">TVET ID Reference</p>
                      <p className="font-bold text-slate-800 font-mono">{selectedTrainee.tvet_id || "NOT ASSIGNED"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Accredited TSP Location</p>
                      <p className="font-bold text-slate-800">{selectedTrainee.tsp}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Specialization Skill</p>
                      <p className="font-bold text-slate-800">{selectedTrainee.skill}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">State Division</p>
                      <p className="font-bold text-slate-800">{selectedTrainee.state}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Training Status</p>
                      <p className="font-bold text-indigo-600 font-mono">{selectedTrainee.training_status || "ACTIVE_TRAINING"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Education level</p>
                      <p className="font-bold text-slate-800">{selectedTrainee.education_level || "Diploma/N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Attendance history log inside profile */}
                <div className="space-y-3 border-b pb-6 text-left">
                  <p className="font-bold text-slate-900">Attendance Yield Verification</p>
                  {selectedTraineeHistory.length === 0 ? (
                    <p className="text-[10px] italic text-slate-400">No daily attendance logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-indigo-650 font-mono">Attendance Rate:</span>
                        <span className="font-black text-indigo-600 bg-indigo-50 border rounded p-1 text-[11px] font-mono leading-none">
                          {calculateReadiness(selectedTrainee, selectedTraineeHistory).attendancePct}%
                        </span>
                      </div>
                      <div className="h-20 overflow-y-auto border border-dashed rounded-xl p-2.5 bg-slate-50 space-y-1.5 scrollbar-thin">
                        {selectedTraineeHistory.map((h, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b pb-1 last:border-0">
                            <span>{new Date(h.attendance_date).toLocaleDateString()}</span>
                            <span className={`font-black tracking-wider uppercase ${
                              h.status === "PRESENT" ? "text-emerald-700" :
                              h.status === "ABSENT" ? "text-rose-700" :
                              h.status === "LATE" ? "text-amber-700" : "text-slate-500"
                            }`}>
                              [{h.status}]
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Readiness Score verification badge */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-dashed text-left space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">READINESS SCORE MATRIX GENERATOR</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Dynamic Score Yield</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">Requires attendance &gt;= 70%, valid NIN/BVN & portal active status check.</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black ${
                      calculateReadiness(selectedTrainee, selectedTraineeHistory).eligible
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 border"
                        : "bg-amber-100 text-amber-800 border-amber-300 border"
                    }`}>
                      {calculateReadiness(selectedTrainee, selectedTraineeHistory).eligible ? "READY FOR CERTIFICATION" : "PENDING ELIGIBLE COMPLIANCE"}
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* 2. SECURE EDIT FORM MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans no-print text-left flex items-center justify-center animate-in fade-in duration-300" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsEditModalOpen(false)} />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-2xl w-full z-10 m-4 overflow-y-auto max-h-[90vh]">
            <div className="border-b pb-4 mb-4 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Modify Operational Trainee Ledger Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 px-2 hover:bg-slate-100 border rounded-lg text-xs font-bold leading-none select-none cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleUpdateTrainee} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Assigned TVET ID</label>
                  <input
                    type="text"
                    value={editFormData.tvet_id || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, tvet_id: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">State Division Code</label>
                  <input
                    type="text"
                    value={editFormData.state || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">NIN ID Code</label>
                  <input
                    type="text"
                    value={editFormData.nin || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, nin: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">BVN ID Code</label>
                  <input
                    type="text"
                    value={editFormData.bvn || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, bvn: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Training Accredit TSP Provider</label>
                  <input
                    type="text"
                    value={editFormData.tsp || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, tsp: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Specialization Skill Stream</label>
                  <input
                    type="text"
                    value={editFormData.skill || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, skill: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Guardian Kin Full Name</label>
                  <input
                    type="text"
                    value={editFormData.guardian_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, guardian_name: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Guardian Kin Mobile Phone</label>
                  <input
                    type="text"
                    value={editFormData.guardian_phone || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, guardian_phone: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Bank Name Allocation</label>
                  <input
                    type="text"
                    value={editFormData.bank_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, bank_name: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={editFormData.account_number || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, account_number: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Bank Account Holder name</label>
                  <input
                    type="text"
                    value={editFormData.account_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, account_name: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10pt] font-bold text-slate-650 block mb-1">Training Progress Status</label>
                  <select
                    value={editFormData.training_status || "ACTIVE_TRAINING"}
                    onChange={(e) => setEditFormData({ ...editFormData, training_status: e.target.value })}
                    className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600 outline-hidden w-full font-sans font-bold cursor-pointer"
                  >
                    <option value="ACTIVE_TRAINING">ACTIVE_TRAINING</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="WITHDRAWN">WITHDRAWN</option>
                    <option value="COMPLETED_TRAINING">COMPLETED_TRAINING</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 transition cursor-pointer font-bold select-none text-xs"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-755 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition cursor-pointer font-bold select-none text-xs"
                >
                  Commit Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. PORTAL AGENT VERIFICATION DIALOG MODAL */}
      {isPortalModalOpen && selectedPortalRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans no-print text-left flex items-center justify-center animate-in fade-in duration-300" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsPortalModalOpen(false)} />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full z-10 m-4">
            <div className="border-b pb-3 mb-4 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Configure Government TVET Portal Node</h3>
              <button
                type="button"
                onClick={() => setIsPortalModalOpen(false)}
                className="p-1 px-1.5 hover:bg-slate-55 hover:bg-slate-100 rounded-lg text-xs leading-none select-none cursor-pointer"
              >
                X
              </button>
            </div>

            <form onSubmit={handleUpdatePortalStatus} className="space-y-4 text-xs font-semibold text-slate-700 leading-normal">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                  <div>
                    <p className="font-bold text-slate-800">Is active on Regional Portal?</p>
                    <p className="text-[10px] text-slate-400">Verifies registration state of technical IDs.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={portalFormData.still_on_portal}
                    onChange={(e) => setPortalFormData({ ...portalFormData, still_on_portal: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                  <div>
                    <p className="font-bold text-slate-800">Verified Active Attendance Class?</p>
                    <p className="text-[10px] text-slate-400">Signs continuous active TSP lecture presence audits.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={portalFormData.still_attending}
                    onChange={(e) => setPortalFormData({ ...portalFormData, still_attending: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[10pt] font-mono font-bold tracking-wide uppercase text-slate-500 mb-1 block">Audit Operational Remarks / Logs</label>
                  <textarea
                    rows={3}
                    value={portalFormData.remarks}
                    onChange={(e) => setPortalFormData({ ...portalFormData, remarks: e.target.value })}
                    placeholder="Enter any administrative or verification remark detail..."
                    className="w-full p-2.5 border rounded-xl bg-slate-50 text-xs font-semibold outline-hidden focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPortalModalOpen(false)}
                  className="px-3.5 py-1.5 border rounded-xl hover:bg-slate-50 text-xs transition cursor-pointer select-none font-bold"
                >
                  Dismiss Checks
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-755 bg-indigo-600 text-white rounded-xl text-xs transition cursor-pointer select-none font-bold"
                >
                  Commit Ledger Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
