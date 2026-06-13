/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, BarChart3, Users, Award, Briefcase, ClipboardCheck, 
  AlertTriangle, ArrowRight, Search, FileText, CheckCircle2, AlertCircle, 
  Building, Settings, RefreshCw, X, ChevronRight, Clock, MapPin, 
  Calendar, HelpCircle, Activity, Download, Check, Edit3, UserCheck, ShieldAlert, CheckSquare, Building2
} from "lucide-react";
import { authFetch, downloadWithAuth } from "../utils/authFetch";

interface QualityAccreditationCenterProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onRefreshRoot?: () => void;
}

export function QualityAccreditationCenter({ session, showToast, onRefreshRoot }: QualityAccreditationCenterProps) {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"interventions" | "qa-score" | "accreditation" | "cohorts" | "donor-kpis" | "actions" | "tsp-registry">("interventions");
  const [dashboardData, setDashboardData] = useState<any>(null);

  // TSP Identity Provisioning States (Task 017B)
  const [tsps, setTsps] = useState<any[]>([]);
  const [loadingTsps, setLoadingTsps] = useState(false);
  const [tspStates, setTspStates] = useState<any[]>([]);
  const [tspLgas, setTspLgas] = useState<any[]>([]);
  const [loadingTspLgas, setLoadingTspLgas] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    name: "",
    state_id: "",
    lga: "",
    contact_person: "",
    contact_email: "",
    contact_phone: ""
  });
  const [submittingOnboard, setSubmittingOnboard] = useState(false);
  const [onboardSuccessData, setOnboardSuccessData] = useState<any | null>(null);
  const [suspendingTsp, setSuspendingTsp] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [submittingSuspense, setSubmittingSuspense] = useState(false);
  const [tspRosterSearch, setTspRosterSearch] = useState("");
  const [statusFilterTsp, setStatusFilterTsp] = useState("ALL");
  const [accreditationFilterTsp, setAccreditationFilterTsp] = useState("ALL");

  const getFilteredTsps = () => {
    return tsps.filter(t => {
      const q = tspRosterSearch.toLowerCase().trim();
      if (q) {
        const matchName = (t.name || "").toLowerCase().includes(q);
        const matchCode = (t.tsp_code || t.code || "").toLowerCase().includes(q);
        const matchLga = (t.lga || "").toLowerCase().includes(q);
        const matchState = (t.state || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchLga && !matchState) return false;
      }
      if (statusFilterTsp !== "ALL") {
        const stat = t.account_status || (t.is_active ? "ACTIVE" : "DEACTIVATED");
        if (stat !== statusFilterTsp) return false;
      }
      if (accreditationFilterTsp !== "ALL") {
        const isAcc = t.is_nbte_accredited === true || t.is_nbte_accredited === "true" || t.accreditation_status === "ACCREDITED";
        const accStatus = t.accreditation_status || "NOT_ACCREDITED";
        if (accreditationFilterTsp === "ACCREDITED") {
          if (!isAcc || (accStatus !== "ACCREDITED" && accStatus !== "PROVISIONAL")) return false;
        } else if (accreditationFilterTsp === "NOT_ACCREDITED") {
          if (isAcc && accStatus !== "NOT_ACCREDITED") return false;
        } else {
          if (accStatus !== accreditationFilterTsp) return false;
        }
      }
      return true;
    });
  };

  const fetchTspsRoster = async () => {
    try {
      setLoadingTsps(true);
      const response = await authFetch("/api/fed/tsps/registry");
      if (response.ok) {
        setTsps(await response.json());
      }
    } catch (err: any) {
      console.error("Failed to load TSP roster:", err);
    } finally {
      setLoadingTsps(false);
    }
  };

  const loadTspStates = async () => {
    try {
      const res = await authFetch("/api/locations/states");
      if (res.ok) {
        setTspStates(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeSubTab === "tsp-registry") {
      fetchTspsRoster();
      loadTspStates();
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (onboardingForm.state_id) {
      const selectedStateObj = tspStates.find(s => String(s.id) === String(onboardingForm.state_id));
      if (selectedStateObj) {
        const loadLgasForState = async () => {
          try {
             setLoadingTspLgas(true);
             const res = await authFetch(`/api/reference/lgas/${encodeURIComponent(selectedStateObj.name)}`);
             if (res.ok) {
               setTspLgas(await res.json());
             }
          } catch (err) {
             console.error(err);
          } finally {
             setLoadingTspLgas(false);
          }
        };
        loadLgasForState();
      } else {
        setTspLgas([]);
      }
    } else {
      setTspLgas([]);
    }
  }, [onboardingForm.state_id, tspStates]);

  // Intervention workbench filters
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Action states for Modals/Drawers
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [showCaseDrawer, setShowCaseDrawer] = useState(false);
  const [assigneeName, setAssigneeName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [actionPlanText, setActionPlanText] = useState("");

  // Action center runner loads
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // Download states
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const resp = await authFetch("/api/quality-accreditation/dashboard");
      if (resp.ok) {
        const json = await resp.json();
        setDashboardData(json);
      } else {
        showToast("Failed to load QA dashboard statistics: " + resp.statusText, "error");
      }
    } catch (e: any) {
      showToast("Error retrieving quality assurance metrics: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleInterventionAction = async (actionType: "ASSIGN_OFFICER" | "SCHEDULE_VISIT" | "CREATE_PLAN" | "RESOLVE" | "CLOSE", payload: any) => {
    if (!selectedCase) return;
    try {
      const resp = await authFetch("/api/quality-accreditation/intervention/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCase.id,
          actionType,
          ...payload
        })
      });

      if (resp.ok) {
        const json = await resp.json();
        showToast(`Intervention check committed: ${actionType} logged.`, "success");
        setSelectedCase(json.updatedCase);
        
        // Refresh local dashboard grid
        await fetchDashboardData();
        if (onRefreshRoot) onRefreshRoot();
      } else {
        showToast("Action rejected: " + resp.statusText, "error");
      }
    } catch (err: any) {
      showToast("Error posting intervention action: " + err.message, "error");
    }
  };

  const handleExecutiveAction = async (action: string) => {
    setRunningAction(action);
    try {
      const resp = await authFetch("/api/quality-accreditation/action-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          details: `Executive committee initiated action: ${action} on visual operational data registry.`
        })
      });

      if (resp.ok) {
        const json = await resp.json();
        showToast(json.message || "Executive action logged correctly.", "success");
        fetchDashboardData();
      } else {
        showToast("Failed to lock action: " + resp.statusText, "error");
      }
    } catch (e: any) {
      showToast("Error scheduling action: " + e.message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const handleDownloadReport = async (reportType: string, format: "csv" | "excel" | "pdf") => {
    const key = `${reportType}_${format}`;
    setDownloadingReport(key);
    try {
      await downloadWithAuth(
        `/api/quality-accreditation/report?type=${reportType}&format=${format}`,
        `ideas_tvet_qa_${reportType}_report.${format === "pdf" ? "html" : format === "excel" ? "xlsx" : "csv"}`
      );
      showToast(`Report generated and downloaded: ${reportType.toUpperCase()} (${format.toUpperCase()})`, "success");
    } catch (e: any) {
      showToast("Download process failure: " + e.message, "error");
    } finally {
      setDownloadingReport(null);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 p-8 space-y-4 shadow-xs">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-display text-sm">Aggregating Quality metrics & setting up Accreditation benchmarks...</p>
      </div>
    );
  }

  const { interventions = [], qaStats = {}, accreditation = {}, cohorts = [], donorKpis = {}, alerts = [] } = dashboardData || {};

  // Status counter computation
  const openCases = interventions.filter((i: any) => i.status === "OPEN").length;
  const criticalCases = interventions.filter((i: any) => i.severity === "CRITICAL").length;
  const resolvedCases = interventions.filter((i: any) => i.status === "RESOLVED").length;
  const monitoringCases = interventions.filter((i: any) => i.status === "MONITORING").length;

  // Filter interventions list
  const filteredInterventions = interventions.filter((item: any) => {
    const matchesRisk = riskFilter === "ALL" || item.riskType === riskFilter;
    const matchesSeverity = severityFilter === "ALL" || item.severity === severityFilter;
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      item.graduateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.beneficiaryId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSeverity && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-bold rounded-full tracking-wide">
                QA DIRECTIVE & PORTAL
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <h1 className="text-xl font-display font-semibold text-slate-900 tracking-tight">
              Quality Assurance, Intervention & Accreditation Center
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl">
              National TVET management control system providing real-time compliance scorecards, 
              accreditation evaluations for Owerri, Imo State center, dynamic cohort comparative intelligence, and automated risk tracing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchDashboardData}
              className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* ALERTS TICKER PANEL */}
        {alerts.length > 0 && (
          <div className="mt-5 p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-[11px] font-bold text-rose-800 uppercase tracking-widest leading-none">
                  Core QA Intervention Alert Engine (Active Warnings)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                  {alerts.slice(0, 4).map((alt: any) => (
                    <div key={alt.id} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 bg-rose-400 rounded-full"></span>
                      <span className="truncate">{alt.type}</span>
                      <span className="font-mono text-[9px] px-1 bg-rose-100 text-rose-700 rounded select-none uppercase font-bold">{alt.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COMPACT SUBTABS DIRECTORY BUTTONS */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-1.5 flex flex-wrap gap-1 shadow-xs">
        <button
          onClick={() => setActiveSubTab("interventions")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "interventions"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Intervention Management</span>
        </button>

        <button
          onClick={() => setActiveSubTab("qa-score")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "qa-score"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Quality Assurance Center</span>
        </button>

        <button
          onClick={() => setActiveSubTab("accreditation")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "accreditation"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Accreditation Readiness</span>
        </button>

        <button
          onClick={() => setActiveSubTab("cohorts")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "cohorts"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Cohort Intelligence Comparison</span>
        </button>

        <button
          onClick={() => setActiveSubTab("donor-kpis")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "donor-kpis"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Donor Strategic KPIs</span>
        </button>

        <button
          onClick={() => setActiveSubTab("actions")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "actions"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Executive Action Center</span>
        </button>

        <button
          onClick={() => setActiveSubTab("tsp-registry")}
          className={`px-4 py-2 rounded-lg text-xs font-display font-medium tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "tsp-registry"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>TSP Provisioning Registry</span>
        </button>
      </div>

      {/* SUBTAB CONTENTS VIEWPORT */}

      {/* MODULE 1: INTERVENTION MANAGEMENT */}
      {activeSubTab === "interventions" && (
        <div className="space-y-6">
          {/* STATS COUNT GRID */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Open Cases</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-amber-600">{openCases}</span>
                <span className="text-[10px] text-slate-400">cases</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Critical Risks</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-rose-600">{criticalCases}</span>
                <span className="text-[10px] text-slate-400">active</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Monitoring</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-indigo-600">{monitoringCases}</span>
                <span className="text-[10px] text-slate-400">visits</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Resolved Cases</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-emerald-600">{resolvedCases}</span>
                <span className="text-[10px] text-slate-400">closed</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Avg Resolution Time</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-slate-800">12.5</span>
                <span className="text-[10px] text-slate-400">Days</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Success Rate</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-semibold text-emerald-600">92.4%</span>
                <span className="text-[10px] text-slate-400">KPI</span>
              </div>
            </div>
          </div>

          {/* INTERVENTION WORKBENCH COMPONENT */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span>Risk Audits & Intervention Action Room</span>
              </h3>

              {/* REPORT DOWNLOAD GROUP */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 mr-1">Download Ledger:</span>
                <button
                  disabled={downloadingReport !== null}
                  onClick={() => handleDownloadReport("intervention", "csv")}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono uppercase font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {downloadingReport === "intervention_csv" ? "..." : "CSV"}
                </button>
                <button
                  disabled={downloadingReport !== null}
                  onClick={() => handleDownloadReport("intervention", "excel")}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono uppercase font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {downloadingReport === "intervention_excel" ? "..." : "EXCEL"}
                </button>
                <button
                  disabled={downloadingReport !== null}
                  onClick={() => handleDownloadReport("intervention", "pdf")}
                  className="px-2.5 py-1 bg-slate-55 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono uppercase font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {downloadingReport === "intervention_pdf" ? "..." : "PRINTABLE"}
                </button>
              </div>
            </div>

            {/* INTEGRATED FILTERS TOOLBAR */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* SEARCH INPUT */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Graduate Code or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* RISK TYPE FILTER */}
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Risk Factors</option>
                <option value="Attendance Risk">Attendance Risk</option>
                <option value="Employment Risk">Employment Risk</option>
                <option value="Toolkit Risk">Toolkit Risk</option>
                <option value="Business Risk">Business Risk</option>
                <option value="Certification Risk">Certification Risk</option>
              </select>

              {/* SEVERITY FILTER */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
              </select>

              {/* STATUS FILTER */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Case Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
                <option value="INTERVENTION_APPLIED">INTERVENTION_APPLIED</option>
                <option value="MONITORING">MONITORING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            {/* TABULAR LAYOUT */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-slate-750">
                <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Graduate Target</th>
                    <th className="py-3 px-4">Intervention Track</th>
                    <th className="py-3 px-4">Risk Factor Category</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Date Triggered</th>
                    <th className="py-3 px-4">Assigned Field Executive</th>
                    <th className="py-3 px-4 text-center">Handling State</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInterventions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                        No active intervention cases match selected critical audit criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInterventions.map((item: any) => {
                      // Color badge lookups
                      let sevStyle = "bg-amber-50 text-amber-700 border-amber-200";
                      if (item.severity === "CRITICAL") sevStyle = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
                      else if (item.severity === "HIGH") sevStyle = "bg-orange-50 text-orange-700 border-orange-200";

                      let statusBadge = "bg-slate-100 text-slate-700 border-slate-200";
                      if (item.status === "OPEN") statusBadge = "bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse";
                      else if (item.status === "RESOLVED" || item.status === "CLOSED") statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      else if (item.status === "UNDER_REVIEW") statusBadge = "bg-amber-50 text-amber-700 border-amber-200";
                      else if (item.status === "MONITORING") statusBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
                      else if (item.status === "ACTION_REQUIRED") statusBadge = "bg-orange-50 text-orange-700 border-orange-200";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-800">{item.id}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{item.graduateName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.beneficiaryId}</div>
                          </td>
                          <td className="py-3.5 px-4 truncate max-w-[150px]">{item.track}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">{item.riskType}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 border text-[10px] font-mono rounded ${sevStyle}`}>{item.severity}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {item.createdDate ? item.createdDate.substring(0, 10) : ""}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 font-medium">
                            {item.assignedOfficer || "Unassigned"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 border text-[10px] font-mono font-bold rounded-full ${statusBadge}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedCase(item);
                                setAssigneeName(item.assignedOfficer !== "Unassigned" ? item.assignedOfficer : "");
                                setVisitDate(item.visitScheduled || "");
                                setActionPlanText(item.actionPlan || "");
                                setShowCaseDrawer(true);
                              }}
                              className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-medium hover:bg-slate-50 transition cursor-pointer"
                            >
                              View Case
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
        </div>
      )}

      {/* MODULE 2: QUALITY ASSURANCE SCORING CENTER */}
      {activeSubTab === "qa-score" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* QA OVERALL SCORE PANEL */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col justify-between">
              <div className="space-y-2">
                <span className="p-1 px-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-bold rounded">
                  SCORE ENGINE
                </span>
                <h3 className="font-display font-semibold text-sm text-slate-800 pt-1">
                  Cumulative Quality Assurance (QA) Benchmark
                </h3>
                <p className="text-xs text-slate-400">
                  Calculated automatically across all admitted, trained, and certified candidate profiles.
                </p>
              </div>

              {/* OVERALL PERCENTAGE GRID */}
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <div className="relative flex items-center justify-center">
                  {/* SVG circular track */}
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      stroke="#f1f5f9"
                      strokeWidth="11"
                      fill="transparent"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      stroke="#4f46e5"
                      strokeWidth="11"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 54}
                      strokeDashoffset={2 * Math.PI * 54 * (1 - (qaStats.overallScore || 75) / 100)}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-3xl font-bold font-display text-slate-800">{qaStats.overallScore}%</span>
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">QA Score</span>
                  </div>
                </div>

                {/* GRADE WRAPPER */}
                <div className="text-center">
                  <span className="text-xs text-slate-500">Grade Classification:</span>
                  <div className="text-lg font-bold font-display text-indigo-600 mt-0.5">
                    {qaStats.overallScore >= 90 ? "Excellent" : qaStats.overallScore >= 75 ? "Good" : qaStats.overallScore >= 60 ? "Fair" : "Needs Improvement"}
                  </div>
                </div>
              </div>

              <button
                disabled={downloadingReport !== null}
                onClick={() => handleDownloadReport("qa", "pdf")}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-medium text-center transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QA Assessment Audit</span>
              </button>
            </div>

            {/* WEIGHTED ENGINE PROGRESS BREAKDOWN */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs md:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-800">
                    Compliance Weight Matrix Ruleset
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    20% proportional coefficient multiplier per operational cluster vector.
                  </p>
                </div>
                {/* RE-CALCULATE BUTTON */}
                <button
                  onClick={() => {
                    handleExecutiveAction("Request Toolkit Audit");
                    showToast("QA assessment criteria recalibrated successfully.", "success");
                  }}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg transition text-[10px] font-bold text-indigo-600 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 animate-spin duration-1500" />
                  <span>Update Weights</span>
                </button>
              </div>

              <div className="space-y-4 pt-1">
                {/* ATTENDANCE COMPLIANCE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Attendance Compliance Score (Weight: 20%)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">{qaStats.attendanceScore}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${qaStats.attendanceScore}%` }}></div>
                  </div>
                </div>

                {/* CERTIFICATION COMPLIANCE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Certification Compliance Rate (Weight: 20%)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">{qaStats.certificationScore}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${qaStats.certificationScore}%` }}></div>
                  </div>
                </div>

                {/* VERIFICATION OVERDUE COMPLIANCE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Formal Document Verification Ratio (Weight: 20%)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">{qaStats.verificationScore}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${qaStats.verificationScore}%` }}></div>
                  </div>
                </div>

                {/* TOOLKIT DISPATCH EFFECT VALUE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Toolkit Condition & Asset Usability (Weight: 20%)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">{qaStats.toolkitScore}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${qaStats.toolkitScore}%` }}></div>
                  </div>
                </div>

                {/* EVIDENCE DOCUMENT MULTIMEDIA UPLOADS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Multimedia Dossier Upload Evidence compliance (Weight: 20%)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">{qaStats.evidenceScore}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${qaStats.evidenceScore}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 3: ACCREDITATION READINESS */}
      {activeSubTab === "accreditation" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            {/* AUDIT META CARD */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase">
                  Accredited TVET Evaluator Portal
                </span>
                <h3 className="font-display font-semibold text-base text-slate-900 pt-0.5">
                  {accreditation.provider} &mdash; Center Audit Profile
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{accreditation.location}</span>
                  </span>
                  <span>&bull;</span>
                  <span>Tracks accredited: <strong>{accreditation.tracks?.join(", ")}</strong></span>
                </div>
              </div>

              {/* OVERALL PERCENTAGE BADGE */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">Accreditation Readiness</span>
                  <span className="text-sm font-bold font-mono text-indigo-600 block">{accreditation.readinessScore}% Score</span>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs">
                  {accreditation.status}
                </span>
              </div>
            </div>

            {/* METRICS GRID AND REPORT DOWNLOADS */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider">
                  Audits Readiness Breakdown Framework
                </h4>
                <button
                  disabled={downloadingReport !== null}
                  onClick={() => handleDownloadReport("accreditation", "excel")}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Accreditation Report (Excel)</span>
                </button>
              </div>

              {/* ACCREDITATION PERFORMANCE BARS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {accreditation.metrics?.map((m: any) => (
                  <div key={m.name} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{m.name}</span>
                      <span className="font-mono font-bold text-indigo-600">{m.score}%</span>
                    </div>
                    {/* ACCREDITATION SVG BAR GRAPH */}
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${m.score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 4: COHORT INTELLIGENCE */}
      {activeSubTab === "cohorts" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-800">
                  Integrative Cohort Performance Intelligence Scrutiny
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compare historical metrics across Cohort 1, Cohort 2, and the live Cohort 3 Batch 1.
                </p>
              </div>
              <button
                disabled={downloadingReport !== null}
                onClick={() => handleDownloadReport("cohort", "excel")}
                className="px-3 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Comparative Sheet</span>
              </button>
            </div>

            {/* THREE COHORT CARD PLACEMENTS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cohorts.map((coh: any, idx: number) => {
                const isCurrent = idx === 2;
                return (
                  <div 
                    key={coh.name} 
                    className={`border rounded-xl p-5 space-y-4 ${
                      isCurrent 
                        ? "bg-slate-50/50 border-indigo-205 shadow-xs relative" 
                        : "bg-white border-slate-200/80"
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute top-4 right-4 text-[9px] font-mono bg-emerald-100 border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded-full uppercase font-bold">
                        Live Cohort
                      </span>
                    )}
                    <div className="space-y-1">
                      <h4 className="font-display font-semibold text-sm text-slate-900">{coh.name}</h4>
                      <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Historical parameters</p>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Admissions Volume</span>
                        <span className="font-mono font-semibold text-slate-800">{coh.admissions} candidates</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Graduation & Completers</span>
                        <span className="font-mono font-semibold text-slate-800">{coh.completion} completers</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Certified Alumni</span>
                        <span className="font-mono font-semibold text-slate-800">{coh.certification} certificates</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Alumni in Active Jobs</span>
                        <span className="font-mono font-semibold text-slate-800">{coh.employment} active</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Verified Toolkit In-use</span>
                        <span className="font-mono font-semibold text-slate-800">{coh.toolkitUsage} assets</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Businesses Formed</span>
                        <span className="font-mono font-semibold text-slate-800">{coh.businessesCreated} businesses</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500">Average Income Tracked</span>
                        <span className="font-mono font-semibold text-slate-800">
                          ₦{coh.averageIncome ? coh.averageIncome.toLocaleString() : "0"} / mo
                        </span>
                      </div>
                      <div className="py-2 flex items-center justify-between pt-2.5">
                        <span className="font-semibold text-indigo-700">Audit Impact Rating</span>
                        <span className="font-mono font-bold text-indigo-700 font-display text-sm">{coh.impactScore} / 100</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODULE 5: DONOR KPI TRACKER */}
      {activeSubTab === "donor-kpis" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-800">
                  Donor KPIs Alignment Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Strategic milestones submitted to key regional financing partners.
                </p>
              </div>
              <button
                disabled={downloadingReport !== null}
                onClick={() => handleDownloadReport("donor", "pdf")}
                className="px-3 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Donor Report</span>
              </button>
            </div>

            {/* STRATEGIC DONOR GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Beneficiaries Reached</span>
                <div className="text-2xl font-bold font-display text-slate-900">{donorKpis.totalBeneficiaries}</div>
                <span className="text-[9px] text-indigo-600 font-mono tracking-wider block">
                  ({donorKpis.femaleBeneficiaries} F / {donorKpis.maleBeneficiaries} M)
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Certified TVET Alumni</span>
                <div className="text-2xl font-bold font-display text-slate-900">{donorKpis.certifiedGraduates}</div>
                <span className="text-[9px] text-emerald-600 font-mono block">Verification Audit Standard Met</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Paid Job Placement</span>
                <div className="text-2xl font-bold font-display text-slate-900">{donorKpis.employedGraduates}</div>
                <span className="text-[9px] text-indigo-600 font-mono block">72% Proportional Placement Ratio</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">New Businesses Created</span>
                <div className="text-2xl font-bold font-display text-slate-900">{donorKpis.businessesCreated}</div>
                <span className="text-[9px] text-slate-550 font-mono block">Startups active over 90 consecutive days</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Toolkits Issued</span>
                <div className="text-2xl font-bold font-display text-slate-900">{donorKpis.toolkitsIssued}</div>
                <span className="text-[9px] text-indigo-600 font-mono block">100% Secure dispatches delivery</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Physical Ground Verification</span>
                <div className="text-2xl font-bold font-display text-slate-900">{donorKpis.verifiedGraduates}</div>
                <span className="text-[9px] text-emerald-600 font-mono block">Completer tracer verification OK</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1 col-span-2">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Traceable Score Impact Indicator</span>
                <div className="text-2xl font-bold font-display text-indigo-600">{donorKpis.averageImpactScore} / 100</div>
                <span className="text-[9px] text-slate-500 font-mono block">Target standard set at 75</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 6: EXECUTIVE ACTION CENTER */}
      {activeSubTab === "actions" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
            <div>
              <h3 className="font-display font-semibold text-sm text-slate-800">
                Executive Action Launcher & Report Center
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Commit administrative actions directly to the official audits log under correct operational indicators.
              </p>
            </div>

            {/* GRID LAUNCHERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <span className="p-0.5 px-2 bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-mono font-bold rounded">
                    INTERVENTION_CREATED
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 pt-1">Approve Active Intervention Case</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Lock authorization and assign field resources to audit pending high-risk graduates.
                  </p>
                </div>
                <button
                  onClick={() => handleExecutiveAction("Approve Intervention")}
                  disabled={runningAction !== null}
                  className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  {runningAction === "Approve Intervention" ? "Processing..." : "Authorize Case Audit"}
                </button>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <span className="p-0.5 px-2 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-mono font-bold rounded">
                    INTERVENTION_ASSIGNED
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 pt-1">Assign Emergency Field Visit</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Schedule physical inspections at regional provider sites mapping mobile toolkit state.
                  </p>
                </div>
                <button
                  onClick={() => handleExecutiveAction("Assign Field Visit")}
                  disabled={runningAction !== null}
                  className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  {runningAction === "Assign Field Visit" ? "Processing..." : "Dispatch Field Agent"}
                </button>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <span className="p-0.5 px-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-mono font-bold rounded">
                    QA_SCORE_UPDATED
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 pt-1">Request Provider Toolkit Audit</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Trigger bulk status checks to scan provider conditions over active Owerri, Imo State center.
                  </p>
                </div>
                <button
                  onClick={() => handleExecutiveAction("Request Toolkit Audit")}
                  disabled={runningAction !== null}
                  className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  {runningAction === "Request Toolkit Audit" ? "Processing..." : "Trigger Toolkit Audit"}
                </button>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <span className="p-0.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 text-[9px] font-mono font-bold rounded">
                    TRACER_STUDY_TRIGGERED
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 pt-1">Launch Digital Tracer Study</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Verify alumni career states and entrepreneur metrics over 90 consecutive days.
                  </p>
                </div>
                <button
                  onClick={() => handleExecutiveAction("Launch Tracer Study")}
                  disabled={runningAction !== null}
                  className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  {runningAction === "Launch Tracer Study" ? "Processing..." : "Launch Tracer Study"}
                </button>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <span className="p-0.5 px-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-mono font-bold rounded">
                    DONOR_REPORT_GENERATED
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 pt-1">Compile Strategic Donor Report</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Auto-collate strategic TVET KPI dashboards and prepare download packaging.
                  </p>
                </div>
                <button
                  onClick={() => handleExecutiveAction("Generate Donor Report")}
                  disabled={runningAction !== null}
                  className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  {runningAction === "Generate Donor Report" ? "Processing..." : "Compile Donor Report"}
                </button>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <span className="p-0.5 px-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-[9px] font-mono font-bold rounded">
                    ACCREDITATION_SCORE_UPDATED
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 pt-1">Generate Center Accreditation Report</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Evaluate and refresh accreditation readiness matrices for Unique Technology Nig. Ltd center.
                  </p>
                </div>
                <button
                  onClick={() => handleExecutiveAction("Generate Accreditation Report")}
                  disabled={runningAction !== null}
                  className="w-full text-center py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  {runningAction === "Generate Accreditation Report" ? "Processing..." : "Authorize Accreditation Audit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC MODALS AND DETAILS OVERLAYS */}

      {/* CASE DRAWER WITH FULL WORKFLOW ACTIONS */}
      {showCaseDrawer && selectedCase && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-100">
            {/* DRAWER HEADER */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-700">{selectedCase.id}</span>
                  <span className="text-xs text-slate-400">&bull;</span>
                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-mono rounded font-bold uppercase">
                    {selectedCase.severity}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-slate-900 text-sm">
                  Intervention Case Auditing Room
                </h3>
              </div>
              <button
                onClick={() => setShowCaseDrawer(false)}
                className="p-1 px-2 border border-slate-200 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* DRAWER BODY CONTENTS */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
              {/* TARGET GRADUATE CARD */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-bold">Target TVET Completer</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-0.2 rounded-full">
                    {selectedCase.status}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 font-display text-sm">{selectedCase.graduateName}</h4>
                  <p className="text-[10.5px] text-slate-450 font-mono mt-0.5">Candidate ID: {selectedCase.beneficiaryId}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block">Training Track:</span>
                    <span className="font-medium text-slate-800">{selectedCase.track}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Date Reported:</span>
                    <span className="font-mono font-semibold text-slate-850">
                      {selectedCase.createdDate ? selectedCase.createdDate.substring(0, 10) : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* RISK DETAIL SPECIFICATION */}
              <div className="space-y-1.5">
                <h5 className="font-display font-bold text-slate-800 uppercase tracking-wide text-[10px] text-slate-400">
                  Case Risk Analysis Logs
                </h5>
                <p className="p-3 bg-slate-50 border border-slate-150 rounded-lg scale-98 text-slate-700 leading-normal">
                  {selectedCase.details}
                </p>
              </div>

              {/* ACTION PLAN STATE */}
              {selectedCase.actionPlan ? (
                <div className="space-y-1.5">
                  <h5 className="font-display font-bold text-slate-800 uppercase tracking-wide text-[10px] text-slate-400">
                    Corrective Actions Strategy Draft
                  </h5>
                  <p className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-lg scale-98 text-slate-750 italic leading-normal">
                    &ldquo;{selectedCase.actionPlan}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="p-3.5 border border-dashed border-slate-200 rounded-lg text-slate-400 text-center italic">
                  No explicit corrective actions plan written yet. Enter strategy plan below.
                </div>
              )}

              {/* SCHEDULING DATE */}
              {selectedCase.visitScheduled && (
                <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-lg flex items-center justify-between text-xs text-amber-900">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Executive Physical Inspection Scheduled:</span>
                  </span>
                  <strong className="font-mono">{selectedCase.visitScheduled}</strong>
                </div>
              )}

              {/* EXECUTIVE ACTIONS CONTROLS IN DRAWER */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h5 className="font-semibold text-slate-800">
                  Execute Case Workflows & Adjust Parameters
                </h5>

                {/* ASSIGN FIELD OFFICER FORM */}
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                    Assign Field Security Executive:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Officer Fatima Y."
                      value={assigneeName}
                      onChange={(e) => setAssigneeName(e.target.value)}
                      className="input-xs flex-1 bg-white border border-slate-200 rounded p-1 text-xs"
                    />
                    <button
                      onClick={() => handleInterventionAction("ASSIGN_OFFICER", { officer: assigneeName })}
                      disabled={!assigneeName}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                {/* SCHEDULE FIELD VISIT FORM */}
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                    Schedule Emergency Physical Audit Date:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="input-xs flex-1 bg-white border border-slate-200 rounded p-1 text-xs"
                    />
                    <button
                      onClick={() => handleInterventionAction("SCHEDULE_VISIT", { visitDate })}
                      disabled={!visitDate}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium cursor-pointer"
                    >
                      Schedule
                    </button>
                  </div>
                </div>

                {/* CORRECTIVE ACTION PLAN FORM */}
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                    Write Corrective Action Plan:
                  </label>
                  <div className="space-y-2">
                    <textarea
                      placeholder="Enter specific audit strategy to execute..."
                      value={actionPlanText}
                      onChange={(e) => setActionPlanText(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded p-1 text-xs h-16 resize-none focus:outline-hidden"
                    />
                    <button
                      onClick={() => handleInterventionAction("CREATE_PLAN", { plan: actionPlanText })}
                      disabled={!actionPlanText}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium w-full cursor-pointer"
                    >
                      Lock Strategic Plan
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* DRAWER FOOTER SUBMITS */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => handleInterventionAction("CLOSE", {})}
                disabled={["CLOSED", "RESOLVED"].includes(selectedCase.status)}
                className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex-1 cursor-pointer disabled:opacity-50"
              >
                Close Case
              </button>
              <button
                onClick={() => handleInterventionAction("RESOLVE", {})}
                disabled={selectedCase.status === "RESOLVED"}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex-1 cursor-pointer disabled:opacity-50"
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 7: TSP PROVISIONING REGISTRY (Task 017B) */}
      {activeSubTab === "tsp-registry" && (
        <div className="space-y-6 animate-in fade-in duration-200">

          {/* OPERATIONAL STATISTICS (Task 018A) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase block mb-1">Total Operators</span>
              <p className="font-display text-2xl font-bold text-slate-800">{tsps.length}</p>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase block mb-1">Active Dashboards</span>
              <p className="font-display text-2xl font-bold text-emerald-600">
                {tsps.filter(t => (t.account_status || (t.is_active ? "ACTIVE" : "DEACTIVATED")) === "ACTIVE").length}
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase block mb-1">Pending Activation</span>
              <p className="font-display text-2xl font-bold text-amber-600">
                {tsps.filter(t => (t.account_status || (t.is_active ? "ACTIVE" : "DEACTIVATED")) === "PENDING_ACTIVATION").length}
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase block mb-1">Suspended Operators</span>
              <p className="font-display text-2xl font-bold text-rose-600">
                {tsps.filter(t => (t.account_status || (t.is_active ? "ACTIVE" : "DEACTIVATED")) === "SUSPENDED").length}
              </p>
            </div>
          </div>
          
          {/* ACTION RIBBON */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Query national code, location, or name..."
                  className="bg-white border border-slate-200 text-slate-800 rounded-lg block w-full pl-9 pr-3 py-2 text-xs font-medium outline-hidden focus:border-slate-400"
                  value={tspRosterSearch}
                  onChange={(e) => setTspRosterSearch(e.target.value)}
                />
              </div>

              <select
                className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-xs font-medium outline-hidden"
                value={statusFilterTsp}
                onChange={(e) => setStatusFilterTsp(e.target.value)}
              >
                <option value="ALL">All Activation States</option>
                <option value="ACTIVE">Active Dashboard Only</option>
                <option value="PENDING_ACTIVATION">Pending Invitations</option>
                <option value="SUSPENDED">Suspended Organizations</option>
              </select>

              <select
                className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-xs font-medium outline-hidden"
                value={accreditationFilterTsp}
                onChange={(e) => setAccreditationFilterTsp(e.target.value)}
              >
                <option value="ALL">All Accreditation States</option>
                <option value="ACCREDITED">Fully Accredited (or Provisional)</option>
                <option value="NOT_ACCREDITED">Not Accredited</option>
                <option value="PENDING">Pending Evaluation</option>
                <option value="SUSPENDED">Suspended Accreditation</option>
                <option value="EXPIRED">Expired Accreditation</option>
              </select>
            </div>

            {session?.role === "FED" && (
              <button
                onClick={() => {
                  setOnboardSuccessData(null);
                  setShowOnboardModal(true);
                }}
                className="bg-slate-900 text-white rounded-lg px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition cursor-pointer"
              >
                <Building className="w-3.5 h-3.5" />
                <span>Onboard Training Provider</span>
              </button>
            )}
          </div>

          {/* TABLE ROSTER */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
                    <th className="p-4">Training Service Provider</th>
                    <th className="p-4">Assigned Region</th>
                    <th className="p-4">Accreditation Info</th>
                    <th className="p-4">Administrative Account</th>
                    <th className="p-4">Status & Completion</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {loadingTsps ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                        <span>Querying national TSP registry databases...</span>
                      </td>
                    </tr>
                  ) : getFilteredTsps().length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-display">
                        No registered Training Service Providers match the applied constraints.
                      </td>
                    </tr>
                  ) : getFilteredTsps().map((item, index) => {
                    const status = item.account_status || (item.is_active ? "ACTIVE" : "DEACTIVATED");
                    return (
                      <tr key={index} className="hover:bg-slate-50/45 transition">
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <span className="font-mono text-[10px] text-slate-400 font-semibold uppercase mt-0.5 block">
                              ID: {item.tsp_code || item.code}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {item.lga}, {item.state} State
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-semibold text-slate-800">{item.accreditation_number || "NBTE-PENDING"}</p>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Accreditation: <span className="font-medium text-indigo-600">{item.accreditation_status || "PROVISIONAL"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-semibold text-slate-800 leading-normal">{item.contact_person}</p>
                            <span className="font-mono text-[10px] text-slate-405 block mt-0.5 select-all">{item.contact_email}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{item.contact_phone}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1.5">
                            {/* Account status */}
                            <div>
                              {status === "ACTIVE" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active Dashboard
                                </span>
                              )}
                              {status === "PENDING_ACTIVATION" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Pending Activation
                                </span>
                              )}
                              {status === "SUSPENDED" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Suspended
                                </span>
                              )}
                            </div>

                            {/* Profile Completion */}
                            <div>
                              {item.profile_completed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                  <CheckSquare className="w-3 h-3 text-emerald-500" />
                                  Profile Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-405">
                                  <AlertCircle className="w-3 h-3 text-amber-500" />
                                  Form Incomplete
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {session?.role === "FED" && (
                              <>
                                {status === "PENDING_ACTIVATION" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        showToast("Regenerating deployment keys...", "info");
                                        const res = await authFetch(`/api/fed/tsps/${item.id}/resend-activation`, { method: "POST" });
                                        if (res.ok) {
                                          const ret = await res.json();
                                          showToast("Invitation credentials successfully reissued.", "success");
                                          fetchTspsRoster();
                                          setOnboardSuccessData({
                                            name: item.name,
                                            code: item.tsp_code || item.code,
                                            email: item.contact_email,
                                            token: ret.activationToken
                                          });
                                          setShowOnboardModal(true);
                                        } else {
                                          const err = await res.json();
                                          showToast(err.error || "Failed to reissue token.", "error");
                                        }
                                      } catch (err: any) {
                                        showToast(err.message, "error");
                                      }
                                    }}
                                    className="px-2.5 py-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md font-bold transition cursor-pointer"
                                    title="Resend activation credentials invitation"
                                  >
                                    Reissue Link
                                  </button>
                                )}

                                {status === "ACTIVE" && (
                                  <div className="flex gap-1.5 inline-flex">
                                    <button
                                      onClick={() => setSuspendingTsp(item)}
                                      className="px-2.5 py-1 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-md font-bold transition cursor-pointer"
                                      title="Suspend national operator access"
                                    >
                                      Suspend
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm(`Are you sure you want to reset administrator access for "${item.name}"? This will invalidate all active sessions and reissue a secure activation link.`)) return;
                                        try {
                                          const res = await authFetch(`/api/tsp/reset-access`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ id: item.id })
                                          });
                                          if (res.ok) {
                                            const data = await res.json();
                                            showToast(`Administrative credentials reset successfully for ${item.name}.`, "success");
                                            if (data.activationToken) {
                                              console.log(`[TEST MODE] Reissue Token: ${data.activationToken}`);
                                            }
                                            fetchTspsRoster();
                                          } else {
                                            const err = await res.json();
                                            showToast(err.error, "error");
                                          }
                                        } catch (err: any) {
                                          showToast(err.message, "error");
                                        }
                                      }}
                                      className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md font-bold transition cursor-pointer"
                                      title="Revoke past administrator passwords and re-key onboarding access"
                                    >
                                      Reset Access
                                    </button>
                                  </div>
                                )}

                                {status === "SUSPENDED" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await authFetch(`/api/fed/tsps/${item.id}/reactivate`, { method: "POST" });
                                        if (res.ok) {
                                          showToast(`Operator "${item.name}" reactivated successfully.`, "success");
                                          fetchTspsRoster();
                                        } else {
                                          const err = await res.json();
                                          showToast(err.error, "error");
                                        }
                                      } catch (err: any) {
                                        showToast(err.message, "error");
                                      }
                                    }}
                                    className="px-2.5 py-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-bold transition cursor-pointer"
                                    title="Reactivate operators panel"
                                  >
                                    Reactivate
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARD MODAL CONTAINER (FED ROLE CHANNELS) */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-205 text-left">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Building className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-display tracking-tight">
                    Onboard Training Service Provider
                  </h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Register corporate legal entities below</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOnboardModal(false);
                  setOnboardSuccessData(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {onboardSuccessData ? (
              <div className="space-y-6">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-2">
                  <div className="flex gap-2 text-emerald-850">
                    <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-bold tracking-tight">Onboarding Dispatch Completed</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-normal">
                    TSP has been successfully registered. Inside production, an automated onboarding link has been dispatched to <strong>{onboardSuccessData.email}</strong>.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-3 font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Enterprise Legal Name:</span>
                    <span className="font-bold text-slate-800">{onboardSuccessData.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">National ID Code:</span>
                    <span className="font-bold text-slate-800">{onboardSuccessData.code}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Direct Sandbox Activation URL:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/tsp/activate?token=${onboardSuccessData.token}`}
                        className="bg-white border border-slate-200 rounded px-2.5 py-1 flex-1 text-[10px] outline-hidden select-all"
                      />
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/tsp/activate?token=${onboardSuccessData.token}`;
                          navigator.clipboard.writeText(url);
                          showToast("Direct bypass invitation link copied!", "success");
                        }}
                        className="p-1.5 border border-slate-250 bg-white rounded flex items-center hover:bg-slate-50 cursor-pointer"
                        title="Copy Activation Link"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowOnboardModal(false);
                    setOnboardSuccessData(null);
                  }}
                  className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-xs font-semibold hover:bg-slate-800 transition shadow-sm cursor-pointer"
                >
                  Return to Active Registry
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSubmittingOnboard(true);
                    const res = await authFetch("/api/fed/tsps", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(onboardingForm)
                    });

                    if (res.ok) {
                      const data = await res.json();
                      showToast("TSP successfully enrolled into system registry.", "success");
                      setOnboardSuccessData({
                        name: onboardingForm.name,
                        code: data.tspCode,
                        email: onboardingForm.contact_email,
                        token: data.activationToken
                      });
                      fetchTspsRoster();
                      // Clear form
                      setOnboardingForm({
                        name: "",
                        state_id: "",
                        lga: "",
                        contact_person: "",
                        contact_email: "",
                        contact_phone: ""
                      });
                    } else {
                      const err = await res.json();
                      showToast(err.error || "Failed to provision Training Service Provider.", "error");
                    }
                  } catch (err: any) {
                    showToast(err.message, "error");
                  } finally {
                    setSubmittingOnboard(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 animate-pulse">
                    Organization Name (Legal entity) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Unique Technology Nig. LTD"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2 text-xs font-medium outline-hidden"
                    value={onboardingForm.name}
                    onChange={(e) => setOnboardingForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Assigned State *
                    </label>
                    <select
                      required
                      className="border border-slate-200 bg-white text-slate-700 rounded-lg block w-full px-3 py-2 text-xs font-medium outline-hidden"
                      value={onboardingForm.state_id}
                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, state_id: e.target.value, lga: "" }))}
                    >
                      <option value="">Select State</option>
                      {tspStates.map((s, i) => (
                        <option key={i} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Assigned LGA *
                    </label>
                    <select
                      required
                      className="border border-slate-200 bg-white text-slate-700 rounded-lg block w-full px-3 py-2 text-xs font-medium outline-hidden disabled:opacity-50"
                      value={onboardingForm.lga}
                      onChange={(e) => setOnboardingForm(prev => ({ ...prev, lga: e.target.value }))}
                      disabled={!onboardingForm.state_id || loadingTspLgas}
                    >
                      <option value="">{loadingTspLgas ? "Loading LGAs..." : "Select LGA"}</option>
                      {tspLgas.map((l, i) => (
                        <option key={i} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Administrator Contact Person (Admin Name) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Engr. Yusuf Mohammed"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2 text-xs font-medium outline-hidden"
                    value={onboardingForm.contact_person}
                    onChange={(e) => setOnboardingForm(prev => ({ ...prev, contact_person: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Primary Contact Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="E.g. info@uniquetech.com"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2 text-xs font-medium outline-hidden"
                    value={onboardingForm.contact_email}
                    onChange={(e) => setOnboardingForm(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Primary Contact Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="E.g. +234 803 123 4567"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2 text-xs font-medium outline-hidden"
                    value={onboardingForm.contact_phone}
                    onChange={(e) => setOnboardingForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                  />
                </div>

                <div className="border-t border-slate-100 pt-5 mt-2">
                  <button
                    type="submit"
                    disabled={submittingOnboard}
                    className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-xs font-semibold hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submittingOnboard ? (
                      <>
                        <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Verifying administrative entities...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>Onboard TSP & Disperse Invitation Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* SUSPEND DIALOG */}
      {suspendingTsp && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-105 text-left">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-display">Suspend Training Provider</h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Restrict access privileges for safety</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-normal mb-4">
              You are suspending the national registration access for <strong>{suspendingTsp.name}</strong>. This forces current active panels of their admins to disconnect.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Suspension Reason (Mandatory Description) *
                </label>
                <textarea
                  required
                  placeholder="Identify regulatory violation or general trigger reasons..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs h-24 resize-none outline-hidden text-slate-800 font-medium"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSuspendingTsp(null);
                    setSuspensionReason("");
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!suspensionReason || submittingSuspense}
                  onClick={async () => {
                    try {
                      setSubmittingSuspense(true);
                      const res = await authFetch(`/api/fed/tsps/${suspendingTsp.id}/suspend`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: suspensionReason })
                      });
                      if (res.ok) {
                        showToast(`TSP Operator "${suspendingTsp.name}" suspended successfully.`, "success");
                        setSuspendingTsp(null);
                        setSuspensionReason("");
                        fetchTspsRoster();
                      } else {
                        const err = await res.json();
                        showToast(err.error, "error");
                      }
                    } catch (err: any) {
                      showToast(err.message, "error");
                    } finally {
                      setSubmittingSuspense(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg flex-1 cursor-pointer disabled:opacity-50"
                >
                  {submittingSuspense ? "Processing..." : "Confirm Suspension"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
