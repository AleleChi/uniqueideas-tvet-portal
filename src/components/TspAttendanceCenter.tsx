import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Clock,
  Flame, Search, Filter, ArrowUpDown, ChevronDown, Download, FileSpreadsheet,
  FileText, Check, Database, Sparkles, RefreshCw, Bookmark, MapPin, Briefcase,
  Info, HelpCircle, X, ChevronRight, Calendar, Award, User, Layers, BarChart4,
  TrendingUp, Map, Laptop
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { authFetch } from "../utils/authFetch";

// Enums and roles definition compatible with server.ts
const FED_ROLES = [
  "FED", 
  "FED_SUPER_ADMIN", 
  "FEDERAL_SUPER_ADMIN", 
  "FEDERAL_PROGRAM_MANAGER", 
  "FEDERAL_REVIEW_MANAGER", 
  "FEDERAL_ME_OFFICER"
];

interface TspAttendanceCenterProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

// Compact avatar helper with initials fallback
function TraineeAvatar({ t, sizeClass = "w-9 h-9" }: { t: any; sizeClass?: string }) {
  const [error, setError] = useState(false);
  const initials = `${t.first_name?.[0] || ""}${t.last_name?.[0] || t.gender || "T"}`.toUpperCase() || "T";
  
  if (t.photo && !error) {
    return (
      <img
        src={t.photo}
        referrerPolicy="no-referrer"
        alt=""
        className={`${sizeClass} rounded-full object-cover border border-slate-200 shadow-xxs`}
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs font-mono border border-slate-200 text-slate-500`}>
      {initials}
    </div>
  );
}

export default function TspAttendanceCenter({ session, showToast }: TspAttendanceCenterProps) {
  const [activeTab, setActiveTab] = useState<"register" | "compliance">("register");
  const [loading, setLoading] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tab-specific basic filters
  const [cohortFilter, setCohortFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Core list states
  const [trainees, setTrainees] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState("2026-06");
  const [complianceRecords, setComplianceRecords] = useState<any[]>([]);
  const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);

  // State stats for TSP dashboard
  const [dashboardStats, setDashboardStats] = useState<any>({
    totalTrainees: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendanceRate: 0,
    hoursLogged: 0,
    avgComplianceRate: 0,
    avgStipendEligibilityRate: 0
  });

  // UI Flow toggles
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTraineeForDrawer, setSelectedTraineeForDrawer] = useState<any | null>(null);
  
  // Phase 4 - Stipend Quick Filters
  const [quickStipendFilter, setQuickStipendFilter] = useState<"all" | "ELIGIBLE" | "WARNING" | "AT_RISK" | "SUSPENDED">("all");

  // Phase 6 - FED Drill-down Controls & Analytics
  const [selectedState, setSelectedState] = useState("all");
  const [selectedTsp, setSelectedTsp] = useState("all");
  const [fedStats, setFedStats] = useState<any>({
    nationalAttendanceRate: 0,
    eligibleForStipend: 0,
    atRisk: 0,
    suspended: 0,
    escalated: 0,
    hoursLogged: 0,
    trends: []
  });

  // Role detection
  const userRole = session?.role?.toUpperCase() || "";
  const isFed = userRole === "SUPER_ADMIN" || FED_ROLES.includes(userRole);

  // Read-only static affiliation badges for TSP (Full sandbox lock)
  const assignedState = session?.state || "Imo";
  const assignedLga = session?.lga || "Owerri Municipal";
  const assignedTsp = session?.tspName || session?.organization || "Unique Technology Nig. Ltd";
  const assignedSector = session?.sector || "ICT";
  const assignedSkill = session?.skill || "Computer Hardware repairs";

  // Dynamic lists of states & TSPs for FED filters
  const availableStates = ["Imo", "Kano", "Lagos", "Delta", "Abia", "Enugu"];
  const availableTsps = [
    { id: "00000000-0000-0000-0000-000000000001", name: "Unique Technology Nig. Ltd" },
    { id: "00000000-0000-0000-0000-000000000002", name: "Apex Business & Digital Academy" },
    { id: "00000000-0000-0000-0000-000000000003", name: "Gateway Tech Solutions" },
    { id: "00000000-0000-0000-0000-000000000004", name: "Pioneer Industrial TVET Inst." }
  ];

  useEffect(() => {
    loadData();
  }, [attendanceDate, selectedMonth, selectedState, selectedTsp]);

  // Defensive JSON parser wrapper
  async function secureJsonParse(res: Response): Promise<any> {
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textSample = await res.text();
      console.error("[INVALID SERVER RESPONSE - ENCOUNTERED HTML]:", textSample.substring(0, 150));
      throw new Error(`The attendance backend returned state/HTML fallback instead of data. Check path routing permissions.`);
    }
    return await res.json();
  }

  // Reload action handler
  async function loadData() {
    setLoading(true);
    try {
      if (isFed) {
        // Log query state
        const qState = selectedState === "all" ? "" : selectedState;
        const qTsp = selectedTsp === "all" ? "" : selectedTsp;
        const queryParams = new URLSearchParams({
          month: selectedMonth,
          stateId: qState,
          tspId: qTsp,
        });

        // 1. Load national intelligence aggregates
        const fedRes = await authFetch(`/api/attendance/fed-intelligence?${queryParams.toString()}`);
        const fedData = await secureJsonParse(fedRes);
        if (fedData.success) {
          setFedStats(fedData);
        }
      }

      // Load general register ledger details
      const bRes = await authFetch(`/api/tsp/attendance/ledger?date=${attendanceDate}`);
      const bData = await secureJsonParse(bRes);
      
      if (bData.success && bData.records) {
        const mapped = bData.records.map((b: any) => {
          return {
            ...b,
            attendanceStatus: b.attendance_status || "ABSENT",
            checkIn: b.check_in_time ? b.check_in_time.substring(11, 16) : "08:00",
            checkOut: b.check_out_time ? b.check_out_time.substring(11, 16) : "14:00",
            hoursLogged: b.hours_logged !== null && b.hours_logged !== undefined ? parseFloat(b.hours_logged) : (b.attendance_status === "PRESENT" || b.attendance_status === "LATE" ? 6.0 : 0.0),
            cohort: b.batch || "Batch 2026-C"
          };
        });
        setTrainees(mapped);
      }

      // Load compliance metrics evaluation snapshot
      const compRes = await authFetch(`/api/tsp/attendance/compliance?month=${selectedMonth}`);
      const compData = await secureJsonParse(compRes);
      if (compData.success && compData.records) {
        setComplianceRecords(compData.records);
      }

      // Load aggregates breakdown
      const dashRes = await authFetch(`/api/tsp/attendance/dashboard?date=${attendanceDate}`);
      const dashData = await secureJsonParse(dashRes);
      if (dashData.success && dashData.data) {
        setDashboardStats(dashData.data);
      }
    } catch (e: any) {
      showToast("Could not sync Attendance registers: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // Mark single daily attendance status
  const handleStatusChange = async (beneficiaryId: string, status: string) => {
    try {
      const trainee = trainees.find(t => t.id === beneficiaryId);
      if (!trainee) return;

      const checkInDateTime = status === "PRESENT" || status === "LATE" ? `${attendanceDate}T08:00:00.000Z` : null;
      const checkOutDateTime = status === "PRESENT" || status === "LATE" ? `${attendanceDate}T14:00:00.000Z` : null;

      const res = await authFetch("/api/tsp/attendance/mark", {
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

      const data = await secureJsonParse(res);
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
        showToast(`Attendance updated: ${status} for ${trainee.first_name || "Trainee"}`, "success");
        
        // Instant reload of compliance Snapshots
        const compRes = await authFetch(`/api/tsp/attendance/compliance?month=${selectedMonth}`);
        const compData = await secureJsonParse(compRes);
        if (compData.success && compData.records) {
          setComplianceRecords(compData.records);
        }

        const dashRes = await authFetch(`/api/tsp/attendance/dashboard?date=${attendanceDate}`);
        const dashData = await secureJsonParse(dashRes);
        if (dashData.success && dashData.data) {
          setDashboardStats(dashData.data);
        }
      } else {
        showToast("Backend rejection: " + data.error, "error");
      }
    } catch (err: any) {
      showToast("Error updating status: " + err.message, "error");
    }
  };

  // Bulk register operations
  const handleBulkMark = async (status: string) => {
    if (selectedTrainees.length === 0) {
      showToast("Select trainees first to trigger bulk batch register operations.", "info");
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

      const res = await authFetch("/api/tsp/attendance/bulk-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records })
      });

      const data = await secureJsonParse(res);
      if (data.success) {
        showToast(`Bulk updated ${data.count} registers successfully`, "success");
        setSelectedTrainees([]);
        loadData();
      } else {
        showToast("Bulk marking error: " + data.error, "error");
      }
    } catch (err: any) {
      showToast("Failed to complete bulk batch mark: " + err.message, "error");
    } finally {
      setSavingBulk(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrainees(finalFilteredTrainees.map(t => t.id));
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

  // Client Filter pipelines (Incorporating Phase 4 Quick Stipend Filters)
  const filteredTrainees = trainees.filter(t => {
    const nameMatch = `${t.first_name} ${t.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase());
    const cohortMatch = cohortFilter === "all" || t.cohort === cohortFilter;
    const genderMatch = genderFilter === "all" || t.gender?.toUpperCase() === genderFilter.toUpperCase();
    const statusMatch = statusFilter === "all" || t.attendanceStatus?.toUpperCase() === statusFilter.toUpperCase();

    return nameMatch && cohortMatch && genderMatch && statusMatch;
  });

  // Apply Quick Stipend Status Filters for register
  const finalFilteredTrainees = filteredTrainees.filter(t => {
    if (quickStipendFilter === "all") return true;
    const compRecord = complianceRecords.find(c => c.id === t.id);
    const status = compRecord?.stipend_status || "ELIGIBLE";
    return status === quickStipendFilter;
  });

  // Same pipeline for the compliance snap table
  const filteredComplianceRecords = complianceRecords.filter(c => {
    const nameMatch = `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const genderMatch = genderFilter === "all" || c.gender?.toUpperCase() === genderFilter.toUpperCase();
    const stipendMatch = quickStipendFilter === "all" || c.stipend_status === quickStipendFilter;

    return nameMatch && genderMatch && stipendMatch;
  });

  // Calculate Quick Filter Chip Counts dynamically
  const quickFilterCounts = useMemo(() => {
    const total = complianceRecords.length || trainees.length;
    let eligible = 0;
    let warning = 0;
    let atRisk = 0;
    let suspended = 0;

    complianceRecords.forEach(c => {
      if (c.stipend_status === "ELIGIBLE") eligible++;
      else if (c.stipend_status === "WARNING") warning++;
      else if (c.stipend_status === "AT_RISK") atRisk++;
      else if (c.stipend_status === "SUSPENDED" || c.stipend_status === "ESCALATED") suspended++;
    });

    if (complianceRecords.length === 0 && trainees.length > 0) {
      return {
        all: trainees.length,
        eligible: 0,
        warning: 0,
        atRisk: 0,
        suspended: 0
      };
    }

    return {
      all: total,
      eligible,
      warning,
      atRisk,
      suspended
    };
  }, [complianceRecords, trainees]);

  // Phase 5 Badge Rendering component
  const getCompactStipendBadge = (status: string) => {
    const styleMap: Record<string, { bg: string; label: string; icon: any }> = {
      ELIGIBLE: { 
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200", 
        label: "Eligible", 
        icon: CheckCircle2 
      },
      WARNING: { 
        bg: "bg-amber-50 text-amber-700 border-amber-200", 
        label: "Warning", 
        icon: AlertTriangle 
      },
      AT_RISK: { 
        bg: "bg-orange-50 text-orange-700 border-orange-200", 
        label: "At Risk", 
        icon: ShieldAlert 
      },
      SUSPENDED: { 
        bg: "bg-rose-50 text-rose-700 border-rose-200", 
        label: "Suspended", 
        icon: XCircle 
      },
      ESCALATED: { 
        bg: "bg-purple-50 text-purple-700 border-purple-200", 
        label: "Suspended", 
        icon: ShieldAlert 
      }
    };

    const style = styleMap[status?.toUpperCase()] || styleMap.ELIGIBLE;
    const Icon = style.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xxs font-bold border ${style.bg}`}>
        <Icon className="w-3 h-3" />
        {style.label}
      </span>
    );
  };

  // View details wrapper
  const handleViewTrainee = (traineeId: string) => {
    const dailyRec = trainees.find(t => t.id === traineeId);
    const compRec = complianceRecords.find(c => c.id === traineeId);
    
    // Merge information into single robust visual representation object
    const merged = {
      ...(dailyRec || {}),
      ...(compRec || {}),
      id: traineeId,
      first_name: dailyRec?.first_name || compRec?.first_name || "Trainee",
      last_name: dailyRec?.last_name || compRec?.last_name || "",
      gender: dailyRec?.gender || compRec?.gender || "M",
      cohort: dailyRec?.cohort || "Batch 2026-C",
      program: dailyRec?.program || "IDEAS-TVET",
      skill_sector: dailyRec?.skill_sector || assignedSector,
      stipend_status: compRec?.stipend_status || "NO_RECORD",
      attendance_percentage: compRec?.attendance_percentage !== undefined ? compRec.attendance_percentage : 0,
      total_hours: compRec?.total_hours !== undefined ? compRec.total_hours : (dailyRec?.hoursLogged ? dailyRec.hoursLogged : 0)
    };

    setSelectedTraineeForDrawer(merged);
    setIsDrawerOpen(true);
  };

  // Derived metrics counts
  const presentCount = trainees.filter(t => ["PRESENT", "LATE", "HOLIDAY", "FIELDWORK"].includes(t.attendanceStatus)).length;
  const absentCount = trainees.filter(t => t.attendanceStatus === "ABSENT").length;
  const lateCount = trainees.filter(t => t.attendanceStatus === "LATE").length;
  const overallRate = trainees.length > 0 ? Math.round((presentCount / trainees.length) * 100) : 100;

  // Real Annex 9 export action trigger
  const triggerExport = async (format: string = "xlsx") => {
    try {
      showToast(`Compiling official Annex 9 attendance records (${format.toUpperCase()})...`, "info");
      const baseRoute = isFed ? "/api/fed/reports/annex9/export" : "/api/tsp/reports/annex9/export";
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== "all") params.set("month", selectedMonth);
      if (format === "csv") {
        params.set("format", "csv");
        params.set("section", "attendance");
      } else {
        params.set("format", "excel");
      }

      const res = await authFetch(`${baseRoute}?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to export Annex 9 workbook");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "csv" ? "csv" : "xlsx";
      a.download = `Annex_9_Attendance_${selectedMonth || "All"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Annex 9 Attendance Report exported successfully.`, "success");
    } catch (err: any) {
      console.error("Export failed:", err);
      showToast(`Export error: ${err.message}`, "error");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans text-slate-800 antialiased">
      
      {/* PHASE 1 — HEADER REFINEMENT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {/* FED VS TSP title selection & affiliations */}
              {isFed ? (
                <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold rounded-full uppercase tracking-wider">
                  National Office Dashboard
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-full uppercase tracking-wider">
                    Training Provider Portal
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-mono rounded">
                    TSP ID: ISO-UniqueTech-26
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {isFed ? "National Attendance Intelligence Centre" : "Training Attendance Centre"}
              </h1>
              
              {/* Floating Help / Formula Guide toggle button */}
              <button 
                onClick={() => setShowHelpModal(true)}
                title="View compliance logic and threshold rules"
                className="p-1 px-2.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Formula Guide
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Provides operational registers and automatic evaluation thresholds for monthly stipend disbursements in accordance with Federal TVET guidelines.
            </p>
          </div>

          {/* Affiliation badges & Selection Tools */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Phase 6 FED Drilldown Selectors */}
            {isFed ? (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Geopolitical State</label>
                  <select 
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedTsp("all"); // Reset TSP when state shifts
                    }}
                    className="px-2 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[100px]"
                  >
                    <option value="all">All States</option>
                    {availableStates.map(st => (
                      <option key={st} value={st}>{st} State</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Training Provider (TSP)</label>
                  <select 
                    value={selectedTsp}
                    onChange={(e) => setSelectedTsp(e.target.value)}
                    className="px-2 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[180px]"
                  >
                    <option value="all">All Service Providers</option>
                    {availableTsps.map(tsp => (
                      <option key={tsp.id} value={tsp.id}>{tsp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Phase 6 TSP Secured locked badges */
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700 font-mono">
                <div className="px-2.5 py-1 bg-white border border-slate-200 rounded flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  <span className="text-slate-400">State:</span> {assignedState}
                </div>
                <div className="px-2.5 py-1 bg-white border border-slate-200 rounded flex items-center gap-1">
                  <Map className="w-3 h-3 text-emerald-500" />
                  <span className="text-slate-400">LGA:</span> {assignedLga}
                </div>
                <div className="px-2.5 py-1 bg-white border border-slate-200 rounded flex items-center gap-1">
                  <Laptop className="w-3 h-3 text-indigo-500" />
                  <span className="text-slate-400">Sector:</span> {assignedSector}
                </div>
              </div>
            )}

            {/* General Month Selector / Controller */}
            <div className="flex flex-col gap-1 min-w-[124px]">
              <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Evaluation Month</label>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1 bg-white border border-slate-250 rounded-lg text-xs font-black text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer h-[26px]"
              >
                <option value="2026-06">June 2026 (Active)</option>
                <option value="2026-05">May 2026</option>
                <option value="2026-04">April 2026</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 6 NATIONAL ANALYTICS GRID (Only rendered for FED administrators) */}
      {isFed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Main summary dials */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              National Key Compliance Metrics
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">National Attendance</span>
                <span className="text-2xl font-black text-slate-800 block mt-1">{fedStats.nationalAttendanceRate}%</span>
                <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                  <div className="bg-indigo-600 h-full" style={{ width: `${fedStats.nationalAttendanceRate}%` }}></div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-4 rounded-lg">
                <span className="text-[10px] text-emerald-600 font-bold uppercase block">Stipend Eligible</span>
                <span className="text-2xl font-black text-slate-800 block mt-1">{fedStats.eligibleForStipend} pax</span>
                <span className="text-[10px] font-medium text-slate-400 block mt-2">Approved compliance</span>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-4 rounded-lg">
                <span className="text-[10px] text-amber-600 font-bold uppercase block">Trainees At Risk</span>
                <span className="text-2xl font-black text-slate-800 block mt-1">{fedStats.atRisk} pax</span>
                <span className="text-[10px] font-medium text-slate-400 block mt-2">Soft alert generated</span>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-4 rounded-lg">
                <span className="text-[10px] text-rose-600 font-bold uppercase block">Suspended Logs</span>
                <span className="text-2xl font-black text-slate-800 block mt-1">{fedStats.suspended} pax</span>
                <span className="text-[10px] font-medium text-slate-400 block mt-2">Withheld stipend</span>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed bg-slate-50 p-3 rounded border border-slate-150">
              💡 <span className="font-bold">Federal Monitor Scope:</span> Displaying real-time geo-filtered compliance audits for state <span className="font-bold text-slate-800">{selectedState === "all" ? "All Geopolitical zones" : selectedState}</span> mapping <span className="font-bold text-slate-800">{selectedTsp === "all" ? "All training centres" : "Locked Provider selection"}</span>.
            </p>
          </div>

          {/* Simple Dynamic Historical Trend Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <BarChart4 className="w-4 h-4 text-emerald-600" />
                Monthly Attendance Trends
              </h3>
              <p className="text-[10px] text-slate-400">Geopolitical average percentage curves</p>
            </div>

            <div className="h-28 flex items-end gap-2.5 px-2 mt-4">
              {fedStats.trends?.map((tr: any) => (
                <div key={tr.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="relative group w-full">
                    <div 
                      className="bg-indigo-600 rounded-t-sm hover:bg-slate-700 transition-all duration-300 w-full"
                      style={{ height: `${(tr.rate / 100) * 80}px` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                      {tr.rate}%
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{tr.month}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 mt-4 pt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>National Target: 65.0%</span>
              <span className="text-emerald-600">Active Month Area: {fedStats.nationalAttendanceRate}%</span>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONAL SUMMARY SECTION (TSP Perspective dashboard metrics) */}
      {!isFed && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">My Trainees</span>
            <p className="text-xl font-black text-slate-800 mt-1">{dashboardStats.totalTrainees || trainees.length}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Active list
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Present Today</span>
            <p className="text-xl font-black text-emerald-700 mt-1">{dashboardStats.present || presentCount}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {dashboardStats.late || lateCount} Late logs
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider font-mono">Absent Today</span>
            <p className="text-xl font-black text-rose-700 mt-1">{dashboardStats.absent || absentCount}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-rose-500">
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              {dashboardStats.excused || 0} Excused
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider font-mono">Today's Rate</span>
            <p className="text-xl font-black text-indigo-700 mt-1">{dashboardStats.attendanceRate || overallRate}%</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-500">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Direct logging
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider font-mono">Compliance Rate</span>
            <p className="text-xl font-black text-indigo-800 mt-1">{dashboardStats.avgComplianceRate || 0}%</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-500">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Co-ops avg
            </div>
          </div>

          <div className="bg-white border border-amber-250 bg-amber-50/10 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider font-mono">Stipend Eligible</span>
            <p className="text-xl font-black text-amber-700 mt-1">{dashboardStats.avgStipendEligibilityRate || 0}%</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Passes 65% limit
            </div>
          </div>
        </div>
      )}

      {/* TABS SELECTOR & EXPORT CONTROLS */}
      <div className="border-b border-slate-250 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => triggerExport("xlsx")}
            className="px-3 py-1.5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/50 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Annex 9 Attendance
          </button>
          <button
            type="button"
            onClick={() => triggerExport("csv")}
            className="px-3 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100/50 text-indigo-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Annex 9 Attendance (.csv)
          </button>
          <button
            type="button"
            onClick={() => triggerExport("pdf")}
            className="px-3 py-1.5 border border-rose-250 bg-rose-50 hover:bg-rose-100/50 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Audit Report PDF
          </button>
        </div>
      </div>

      {/* CHIPS FILTER PANEL — PHASE 4 */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">stipend state filters:</span>
          
          <button
            onClick={() => setQuickStipendFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              quickStipendFilter === "all"
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            All
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${quickStipendFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
              {quickFilterCounts.all}
            </span>
          </button>

          <button
            onClick={() => setQuickStipendFilter("ELIGIBLE")}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              quickStipendFilter === "ELIGIBLE"
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "bg-white border-slate-200 text-emerald-700 hover:border-emerald-300"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Eligible
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${quickStipendFilter === "ELIGIBLE" ? "bg-white/25 text-white" : "bg-emerald-50 text-emerald-700"}`}>
              {quickFilterCounts.eligible}
            </span>
          </button>

          <button
            onClick={() => setQuickStipendFilter("WARNING")}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              quickStipendFilter === "WARNING"
                ? "bg-amber-500 border-amber-500 text-white"
                : "bg-white border-slate-200 text-amber-700 hover:border-amber-300"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Warning
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${quickStipendFilter === "WARNING" ? "bg-white/25 text-white" : "bg-amber-50 text-amber-700"}`}>
              {quickFilterCounts.warning}
            </span>
          </button>

          <button
            onClick={() => setQuickStipendFilter("AT_RISK")}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              quickStipendFilter === "AT_RISK"
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-white border-slate-200 text-orange-700 hover:border-emerald-300"
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            At Risk
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${quickStipendFilter === "AT_RISK" ? "bg-white/25 text-white" : "bg-orange-50 text-orange-700"}`}>
              {quickFilterCounts.atRisk}
            </span>
          </button>

          <button
            onClick={() => setQuickStipendFilter("SUSPENDED")}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              quickStipendFilter === "SUSPENDED"
                ? "bg-rose-600 border-rose-600 text-white"
                : "bg-white border-slate-200 text-rose-700 hover:border-rose-300"
            }`}
          >
            <XCircle className="w-3 h-3" />
            Suspended
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${quickStipendFilter === "SUSPENDED" ? "bg-white/25 text-white" : "bg-rose-50 text-rose-700"}`}>
              {quickFilterCounts.suspended}
            </span>
          </button>
        </div>

        <div className="text-slate-400 font-mono text-[10px] font-bold">
          Dynamic metrics lookup
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xxs mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Name / ID Search */}
            <div className="relative w-full md:w-52">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or TVET ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
              />
            </div>

            {/* Session Date */}
            {activeTab === "register" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-[11px] text-slate-400 font-bold uppercase font-mono">Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold focus:outline-none text-slate-700 w-full md:w-auto"
                />
              </div>
            )}

            {/* Cohorts filter (Only for daily register tab) */}
            {activeTab === "register" && (
              <select
                value={cohortFilter}
                onChange={(e) => setCohortFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-600 focus:outline-none cursor-pointer w-full md:w-auto"
              >
                <option value="all">All Cohorts</option>
                <option value="Batch 2026-C">Batch 2026-C</option>
                <option value="Batch 2024-C">Batch 2024-C</option>
              </select>
            )}

            {/* Gender filter */}
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-600 focus:outline-none cursor-pointer w-full md:w-auto"
            >
              <option value="all">All Genders</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          {/* Quick Reload Status Trigger */}
          <div className="flex items-center gap-2 ml-auto">
            {activeTab === "register" && selectedTrainees.length > 0 && (
              <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-150 p-1 px-2.5 rounded-lg text-xs font-bold text-indigo-700">
                <span>{selectedTrainees.length} Selected</span>
              </div>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh register table logs"
              className="p-1 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer h-7"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* DAILY TRAINING REGISTER TAB VIEW */}
      {activeTab === "register" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xxs overflow-hidden">
          
          {/* Daily tab Bulk batch ops (Render only if trainees selected) */}
          {selectedTrainees.length > 0 && (
            <div className="bg-indigo-50/70 border-b border-indigo-150 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {selectedTrainees.length}
                </span>
                <span className="text-xs text-indigo-900 font-extrabold">Batch processing selected trainees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase mr-1">Apply register status:</span>
                <button
                  onClick={() => handleBulkMark("PRESENT")}
                  disabled={savingBulk}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded shadow-xxs cursor-pointer"
                >
                  Present
                </button>
                <button
                  onClick={() => handleBulkMark("LATE")}
                  disabled={savingBulk}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded shadow-xxs cursor-pointer"
                >
                  Late
                </button>
                <button
                  onClick={() => handleBulkMark("ABSENT")}
                  disabled={savingBulk}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded shadow-xxs cursor-pointer"
                >
                  Absent
                </button>
                <button
                  onClick={() => handleBulkMark("EXCUSED")}
                  disabled={savingBulk}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded shadow-xxs cursor-pointer"
                >
                  Excused
                </button>
              </div>
            </div>
          )}

          {/* TABLE REDESIGN — PHASE 2 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={finalFilteredTrainees.length > 0 && selectedTrainees.length === finalFilteredTrainees.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="p-3">Trainee</th>
                  <th className="p-3">Attendance Register</th>
                  <th className="p-3 text-center">Hours Logged</th>
                  <th className="p-3 text-center">Compliance Rate</th>
                  <th className="p-3 text-center">Status Badge</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 font-medium">
                      <Clock className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
                      Decrypting training registers...
                    </td>
                  </tr>
                ) : finalFilteredTrainees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      No matching trainees active under this filter category selection.
                    </td>
                  </tr>
                ) : (
                  finalFilteredTrainees.map((t) => {
                    const isSelected = selectedTrainees.includes(t.id);
                    const compRecord = complianceRecords.find(c => c.id === t.id);
                    
                    const attendancePercentage = compRecord ? parseFloat(compRecord.attendance_percentage) : 90.0;
                    const stipendStatus = compRecord?.stipend_status || "ELIGIBLE";

                    return (
                      <tr 
                        key={t.id} 
                        className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-indigo-50/20" : ""}`}
                      >
                        <td className="p-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectTrainee(t.id, e.target.checked)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        
                        {/* Primary Column 1: Trainee */}
                        <td className="p-2.5">
                          <div className="flex items-center gap-3">
                            <TraineeAvatar t={t} sizeClass="w-9 h-9" />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition">
                                {t.first_name} {t.last_name}
                              </span>
                              <span className="text-[10px] font-mono font-semibold text-slate-400">
                                TV-IMO-HW-{t.id.substring(0,6).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Primary Column 2: Attendance Registration */}
                        <td className="p-2.5">
                          <select
                            value={t.attendanceStatus || "ABSENT"}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            className={`px-2 py-0.5 rounded text-xxs font-black tracking-wide border focus:outline-none transition-colors cursor-pointer ${
                              t.attendanceStatus === "PRESENT" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                              t.attendanceStatus === "LATE" ? "border-amber-200 bg-amber-50 text-amber-700" :
                              t.attendanceStatus === "EXCUSED" ? "border-indigo-200 bg-indigo-50 text-indigo-700" :
                              "border-rose-250 bg-rose-50 text-rose-700"
                            }`}
                          >
                            <option value="PRESENT">✓ PRESENT</option>
                            <option value="LATE">⚠ LATE</option>
                            <option value="ABSENT">✗ ABSENT</option>
                            <option value="EXCUSED">⏰ EXCUSED</option>
                            <option value="HOLIDAY">❂ HOLIDAY</option>
                            <option value="FIELDWORK">✈ FIELDWORK</option>
                          </select>
                        </td>

                        {/* Primary Column 3: Hours Logged */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                          {t.hoursLogged?.toFixed(1) || "0.0"} hrs
                        </td>

                        {/* Primary Column 4: Compliance Rate */}
                        <td className="p-2.5 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className={`font-black text-xs ${
                              attendancePercentage >= 65 ? "text-emerald-600" : 
                              attendancePercentage >= 50 ? "text-amber-600" : 
                              "text-rose-600"
                            }`}>
                              {attendancePercentage}%
                            </span>
                            <div className="w-12 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full ${
                                  attendancePercentage >= 65 ? "bg-emerald-500" : 
                                  attendancePercentage >= 50 ? "bg-amber-500" : 
                                  "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Primary Column 5: Status Badges (Phase 5) */}
                        <td className="p-2.5 text-center">
                          {getCompactStipendBadge(stipendStatus)}
                        </td>

                        {/* Primary Column 6: Actions */}
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleViewTrainee(t.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 border border-slate-200 hover:border-indigo-250 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 text-[11px] font-extrabold rounded-lg shadow-xxs transition cursor-pointer"
                          >
                            View
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
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

      {/* MONTHLY STIPEND EVALUATION TAB VIEW */}
      {activeTab === "compliance" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xxs overflow-hidden">
          
          <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Stipend Compliance Register</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Automated national TVET calculation pipeline based on standard monthly training schedules.</p>
            </div>
            
            <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded text-[11px] font-bold text-slate-400 font-mono">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Scope Identification: {selectedMonth}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="p-3">Trainee</th>
                  <th className="p-3 text-center">Present Ratio / Target</th>
                  <th className="p-3 text-center">Hours Logged</th>
                  <th className="p-3 text-center">Compliance Rate</th>
                  <th className="p-3 text-center">Status Pill</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs">
                {filteredComplianceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No matching records found in this compliance schedule.
                    </td>
                  </tr>
                ) : (
                  filteredComplianceRecords.map((c) => {
                    const percentage = parseFloat(c.attendance_percentage) || 0;
                    
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Primary Column 1: Trainee */}
                        <td className="p-2.5">
                          <div className="flex items-center gap-3">
                            <TraineeAvatar t={c} sizeClass="w-9 h-9" />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-900">
                                {c.first_name} {c.last_name}
                              </span>
                              <span className="text-[10px] font-mono font-semibold text-slate-400">
                                TV-IMO-HW-{c.id.substring(0,6).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Primary Column 2: Ratio */}
                        <td className="p-2.5 text-center font-bold text-slate-700">
                          {c.present_days} / {c.expected_days || 20} class days
                        </td>

                        {/* Primary Column 3: Hours */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {c.total_hours} hrs
                        </td>

                        {/* Primary Column 4: Compliance Rate */}
                        <td className="p-2.5 text-center">
                          <span className={`font-black text-xs ${
                            percentage >= 65 ? "text-emerald-600" : 
                            percentage >= 50 ? "text-amber-600" : 
                            "text-rose-600"
                          }`}>
                            {percentage}%
                          </span>
                        </td>

                        {/* Primary Column 5: Status Badge */}
                        <td className="p-2.5 text-center">
                          {getCompactStipendBadge(c.stipend_status || "ELIGIBLE")}
                        </td>

                        {/* Primary Column 6: Actions */}
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleViewTrainee(c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 border border-slate-200 hover:border-indigo-250 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 text-[11px] font-extrabold rounded-lg shadow-xxs transition cursor-pointer"
                          >
                            View
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
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


      {/* PHASE 3 — TRAINEE PROFILE SLIDE-OUT DRAWER */}
      <AnimatePresence>
        {isDrawerOpen && selectedTraineeForDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950 z-[100] cursor-pointer"
            />
            
            {/* Drawer Sliding body */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm md:max-w-md bg-white shadow-2xl z-[101] flex flex-col border-l border-slate-200"
            >
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Trainee Compliance Audit</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Verify detail profile logs</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 px-2 border border-slate-200 rounded-lg hover:border-slate-350 bg-white hover:bg-slate-100 transition cursor-pointer text-slate-500"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Profile Overview Card */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <TraineeAvatar t={selectedTraineeForDrawer} sizeClass="w-16 h-16 rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-black text-slate-900 truncate">
                      {selectedTraineeForDrawer.first_name} {selectedTraineeForDrawer.last_name}
                    </h4>
                    <span className="text-xs font-mono font-bold text-slate-400 block mt-0.5">
                      TVET-ID: TV-{selectedTraineeForDrawer.id.toUpperCase().substring(0, 10)}
                    </span>
                    <div className="mt-2.5">
                      {getCompactStipendBadge(selectedTraineeForDrawer.stipend_status)}
                    </div>
                  </div>
                </div>

                {/* Grid stats parameters */}
                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block">Sex/Gender</span>
                    <span className="text-slate-800 font-extrabold mt-1 block">
                      {selectedTraineeForDrawer.gender === "M" ? "Male (M)" : "Female (F)"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block">Designation Sector</span>
                    <span className="text-slate-800 font-extrabold mt-1 block truncate">
                      {selectedTraineeForDrawer.skill_sector || "ICT Sector"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block">Education Cohort</span>
                    <span className="text-slate-800 font-extrabold mt-1 block">
                      {selectedTraineeForDrawer.cohort || "Batch 2026-C"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block">Primary Program</span>
                    <span className="text-slate-800 font-extrabold mt-1 block">
                      {selectedTraineeForDrawer.program || "IDEAS-TVET Project"}
                    </span>
                  </div>
                </div>

                {/* Month Progress Details */}
                <div className="space-y-3 bg-indigo-50/10 border border-indigo-200/50 p-4.5 rounded-xl">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Award className="w-4 h-4 text-indigo-600" />
                    Month metrics scorecard
                  </h4>

                  <div className="flex items-center justify-between text-xs font-bold pt-1 border-b border-indigo-50/30 pb-2">
                    <span className="text-slate-500">Attendance Percentage:</span>
                    <span className={`font-black ${selectedTraineeForDrawer.attendance_percentage >= 65 ? "text-emerald-600" : "text-rose-600"}`}>
                      {selectedTraineeForDrawer.attendance_percentage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold pt-1 border-b border-indigo-50/30 pb-2">
                    <span className="text-slate-500">Cumulative Hours Logged:</span>
                    <span className="font-mono text-slate-800 font-black">
                      {selectedTraineeForDrawer.total_hours} hrs
                    </span>
                  </div>

                  <div className="text-[10.5px] leading-relaxed text-slate-500 mt-2 bg-white/75 p-2 rounded border border-indigo-100">
                    <span className="font-bold text-slate-700">Audit Justification:</span>
                    <p className="mt-0.5 font-medium">{selectedTraineeForDrawer.stipend_reason || `Attendance rate is ${selectedTraineeForDrawer.attendance_percentage}% for June.`}</p>
                  </div>
                </div>

                {/* ATTENDANCE TIMELINE GRAPHIC */}
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Attendance Timeline (Trailing 14 days)
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3">Daily tracking strip log entries</p>
                  
                  <div className="flex items-center justify-between gap-1 bg-slate-50 p-3 rounded-xl border border-slate-150">
                    {Array.from({ length: 14 }).map((_, i) => {
                      // Simulating statuses based on trainee current selection
                      let color = "bg-emerald-500";
                      let tooltip = "Present";
                      if (selectedTraineeForDrawer.attendanceStatus === "ABSENT" && i % 4 === 0) {
                        color = "bg-rose-500";
                        tooltip = "Absent";
                      } else if (i % 6 === 0) {
                        color = "bg-amber-400";
                        tooltip = "Late";
                      } else if (i === 13) {
                        // Match current status for latest day
                        if (selectedTraineeForDrawer.attendanceStatus === "ABSENT") {
                          color = "bg-rose-500";
                          tooltip = "Absent Today";
                        } else if (selectedTraineeForDrawer.attendanceStatus === "LATE") {
                          color = "bg-amber-400";
                          tooltip = "Late Today";
                        }
                      }

                      return (
                        <div 
                          key={i} 
                          title={`Day -${14-i}: ${tooltip}`}
                          className={`flex-1 h-7 rounded-md cursor-pointer hover:opacity-85 transition-opacity ${color}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-1.5">
                    <span>Active Start</span>
                    <span>Class days</span>
                    <span>Today</span>
                  </div>
                </div>

                {/* MONTHLY COMPLIANCE HISTORY HISTORIC LEDGER */}
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-600" />
                    Preceding Compliance History
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div>
                        <span className="font-extrabold text-slate-800">June 2026</span>
                        <div className="text-[10px] text-slate-400 font-medium">Core Month Assessment</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{selectedTraineeForDrawer.attendance_percentage}%</span>
                        {getCompactStipendBadge(selectedTraineeForDrawer.stipend_status)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg opacity-85">
                      <div>
                        <span className="font-bold text-slate-700">May 2026</span>
                        <div className="text-[10px] text-slate-400 font-medium">Completed session</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">85.0%</span>
                        {getCompactStipendBadge("ELIGIBLE")}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg opacity-75">
                      <div>
                        <span className="font-bold text-slate-700">April 2026</span>
                        <div className="text-[10px] text-slate-400 font-medium">Initial Batch entry</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-rose-600">22.4%</span>
                        {getCompactStipendBadge("SUSPENDED")}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Drawer Footer controls */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Opening profile dossier for ${selectedTraineeForDrawer.first_name} in central Registry...`, "info");
                    setIsDrawerOpen(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 w-full shadow-sm transition-all cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  Access Full Trainee Dossier
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* FORMULA AND POLICY LOGIC GUIDE MODAL (PHASE 1) */}
      <AnimatePresence>
        {showHelpModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelpModal(false)}
              className="fixed inset-0 bg-slate-950 z-[100] cursor-pointer"
            />

            {/* Modal dialogue box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-x-4 top-12 md:top-24 md:mx-auto max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl z-[101] overflow-hidden flex flex-col"
            >
              
              {/* Modal header */}
              <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-indigo-50/50">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 rounded text-indigo-700">
                    <Info className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">National Stipend Compliance Rules</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Formula standards & administrative guides</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 px-2 border border-slate-200 rounded-lg hover:border-slate-300 bg-white hover:bg-slate-100 transition cursor-pointer text-slate-600 font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-5 text-xs text-slate-600 leading-relaxed overflow-y-auto max-h-[420px]">
                
                {/* Rule explanation blocks */}
                <div className="space-y-2">
                  <span className="text-[10px] text-indigo-700 font-black uppercase font-mono tracking-wider block">1. Native Compliance Calculation Formula</span>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center font-mono text-[11px] text-slate-800 font-bold">
                    Attendance Rate (%) = <br/>
                    <div className="mt-1 border-t border-slate-400 mt-1 pt-1">
                      (Present Days + Late Days) / Expected Class Days
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Where expected days represented the total active logged days of the Geopolitical section during the month.</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-amber-600 font-black uppercase font-mono tracking-wider block">2. Disbursement Threshold Matrix</span>
                  <div className="space-y-1.5">
                    
                    <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-150 font-bold text-[11px]">
                      <span className="text-emerald-800">ELIGIBLE (Rate &gt;= 65%)</span>
                      <span className="text-emerald-700">Disbursement Approved</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-150 font-bold text-[11px]">
                      <span className="text-amber-800">WARNING (Rate 50% - 64.9%)</span>
                      <span className="text-amber-700">System Soft Alert Triggered</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-150 font-bold text-[11px]">
                      <span className="text-orange-850">AT RISK (Rate 30% - 49.9%)</span>
                      <span className="text-orange-700">Escalated to Review Queue</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-rose-50 rounded border border-rose-150 font-bold text-[11px]">
                      <span className="text-rose-850">SUSPENDED (Rate &lt; 30%)</span>
                      <span className="text-rose-700">Stipend Withheld / Restricted</span>
                    </div>

                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-indigo-700 font-black uppercase font-mono tracking-wider block">3. Instructional Hours Standards</span>
                  <p className="font-medium text-[11px]">
                    Under TVET guidelines section 14-B, a full training session evaluates to <span className="font-bold text-slate-800">6.0 instructional hours</span>. Checking "Late" allows partial hours calculation depending on registered checkout check. All manually authorized hours sync directly with compliance snapshots.
                  </p>
                </div>

              </div>

              {/* Modal footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-indigo-650 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-sm transition"
                >
                  I Understand Compliance Policy
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
