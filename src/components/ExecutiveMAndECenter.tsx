/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  BarChart3, Users, ShieldCheck, Award, Briefcase, ClipboardCheck, 
  MapPin, Filter, Download, AlertTriangle, ChevronRight, X, Clock,
  ArrowRight, Search, FileText, CheckCircle2, AlertCircle, Building, Settings, RefreshCw, Cpu
} from "lucide-react";
import { authFetch, downloadWithAuth } from "../utils/authFetch";

interface ExecutiveMAndECenterProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onRefreshRoot?: () => void;
}

export function ExecutiveMAndECenter({ session, showToast, onRefreshRoot }: ExecutiveMAndECenterProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>("ALL");
  const [selectedBatch, setSelectedBatch] = useState<string>("ALL");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("ALL");
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [selectedTraineeDetails, setSelectedTraineeDetails] = useState<any>(null);
  const [loadingTraineeDetails, setLoadingTraineeDetails] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  // Donor reporting parameters
  const [reportType, setReportType] = useState<"quarterly" | "annual" | "state" | "tsp" | "sector">("quarterly");
  const [reportFormat, setReportFormat] = useState<"csv" | "excel" | "pdf">("pdf");
  const [generatingReport, setGeneratingReport] = useState(false);

  // Search filter for state performance/alert/TSPs
  const [stateSearch, setStateSearch] = useState("");
  const [tspSearch, tspSetSearch] = useState("");
  const [alertSearch, setAlertSearch] = useState("");
  const [gisSearch, setGisSearch] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const resp = await authFetch(`/api/executive-m-and-e/dashboard-stats?track=${selectedTrack}&batch=${selectedBatch}&state=${selectedStateFilter}`);
      if (resp.ok) {
        const json = await resp.json();
        setStats(json.stats);
      } else {
        showToast("Failed to fetch M&E stats: " + resp.statusText, "error");
      }
    } catch (e: any) {
      showToast("Error loading M&E statistics: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedTrack, selectedBatch, selectedStateFilter]);

  // Open graduate profile drawer
  const viewGraduateProfile = async (id: string) => {
    setSelectedTraineeId(id);
    setLoadingTraineeDetails(true);
    setShowProfileDrawer(true);
    try {
      const resp = await authFetch(`/api/executive-m-and-e/profile/${id}`);
      if (resp.ok) {
        const json = await resp.json();
        setSelectedTraineeDetails(json.profile);
      } else {
        showToast("Failed to recover graduate profile", "error");
      }
    } catch (e: any) {
      showToast("Error retrieving profile: " + e.message, "error");
    } finally {
      setLoadingTraineeDetails(false);
    }
  };

  const handleDownloadReport = async () => {
    setGeneratingReport(true);
    try {
      // Create actual CSV/Excel/PDF trigger
      const url = `/api/executive-m-and-e/export-report?type=${reportType}&format=${reportFormat}&track=${selectedTrack}&batch=${selectedBatch}`;
      await downloadWithAuth(url, `ideas_tvet_m_and_e_${reportType}_report.${reportFormat === "pdf" ? "pdf" : reportFormat === "excel" ? "xlsx" : "csv"}`);
      showToast(`${reportType.toUpperCase()} M&E Report downloaded successfully.`, "success");
    } catch (e: any) {
      showToast("Download failed: " + e.message, "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 p-8 space-y-4 shadow-xs">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="font-mono text-xs text-slate-500 font-semibold uppercase tracking-wider">Compiling Executive M&E Records...</p>
      </div>
    );
  }

  // Safe fallback defaults for in-memory visualizations
  const reach = stats?.programReach || { totalBeneficiaries: 0, activeTrainees: 0, certifiedGraduates: 0, alumni: 0 };
  const compliance = stats?.compliance || { eligibilityRate: 100, attendanceCompliance: 100, portalCompliance: 100, verificationCompliance: 100 };
  const certification = stats?.certification || { certificationRate: 100, certificateIssued: 0, alumniConversion: 100 };
  const emps = stats?.employment || { employed: 0, selfEmployed: 0, entrepreneur: 0, unemployed: 0, totalAlumniTracked: 0 };
  const toolkit = stats?.toolkitImpact || { utilizationRate: 100, verificationRate: 100, recoveryRate: 100 };
  const evidenceObj = stats?.evidence || { verifiedGraduates: 0, pendingVerification: 0, impactScoreAverage: 0 };
  
  const pipeline = stats?.pipeline || [];
  const stateRankings = stats?.stateRanking || [];
  const tspRankings = stats?.tspRanking || [];
  const skillsTrack = stats?.skillsTrack || [];
  const alerts = stats?.alerts || [];
  const gis = stats?.gis || [];

  return (
    <div id="ideas-executive-mand-e" className="space-y-8 animate-in fade-in duration-150">
      
      {/* Dynamic Filter Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold font-mono text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">
              MEGALLY COMPLIANT GOVERNANCE
            </span>
          </div>
          <h2 className="font-sans font-bold text-slate-900 text-xl md:text-2xl tracking-tight text-left">
            Executive M&E Center
          </h2>
          <p className="text-xs text-slate-500">
            Real-time interactive monitoring dashboard compiling all admission cohorts, toolkit logistics, and verified jobs impact evidence.
          </p>
        </div>
        
        {/* Dynamic Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:self-end">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="bg-transparent border-0 text-xs font-medium text-slate-700 focus:ring-0 cursor-pointer outline-none font-sans"
            >
              <option value="ALL">All Skills Tracks</option>
              <option value="Computer Hardware Repairs">Computer Hardware Repairs</option>
              <option value="Mobile Phone Repairs">Mobile Phone Repairs</option>
            </select>

            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-transparent border-0 text-xs font-medium text-slate-700 focus:ring-0 cursor-pointer outline-none font-sans border-l border-slate-200 pl-1"
            >
              <option value="ALL">All Admission Batches</option>
              <option value="Cohort A">Cohort A</option>
              <option value="Cohort B">Cohort B</option>
              <option value="Cohort C">Cohort C</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
            </select>
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-medium text-xs transition active:scale-[0.98] disabled:opacity-55 cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync Stats</span>
          </button>
        </div>
      </div>

      {/* COMPACT TOP LEVEL KPI CARD GRIDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Segment 1: Program Reach */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 bg-indigo-50 rounded-bl-lg">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Program Reach</span>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-sans">{reach.totalBeneficiaries}</span>
              <span className="text-[10px] text-slate-400">total grads</span>
            </div>
            <div className="grid grid-cols-3 gap-0.5 text-[9px] font-mono font-medium text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
              <div>
                <p className="font-bold text-indigo-600">{reach.activeTrainees}</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">ACTIVE</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-emerald-600">{reach.certifiedGraduates}</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">CERT</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-slate-700">{reach.alumni}</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">ALUMNI</p>
              </div>
            </div>
          </div>
        </div>

        {/* Segment 2: Compliance Metrics */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 bg-violet-50 rounded-bl-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Compliance Rates</span>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-sans">{compliance.attendanceCompliance}%</span>
              <span className="text-[10px] text-slate-400">attendance</span>
            </div>
            <div className="grid grid-cols-3 gap-0.5 text-[9px] font-mono font-medium text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
              <div>
                <p className="font-bold text-indigo-600">{compliance.eligibilityRate}%</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">ELIGIBLE</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-violet-600">{compliance.portalCompliance}%</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">PORTAL</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-emerald-600">{compliance.verificationCompliance}%</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">VERIFIED</p>
              </div>
            </div>
          </div>
        </div>

        {/* Segment 3: Certification Center */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 bg-emerald-50 rounded-bl-lg">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Certification Center</span>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-sans">{certification.certificationRate}%</span>
              <span className="text-[10px] text-slate-400">pass rate</span>
            </div>
            <div className="grid grid-cols-2 gap-0.5 text-[9px] font-mono font-medium text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
              <div>
                <p className="font-bold text-emerald-600">{certification.certificateIssued}</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">ISSUED</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-indigo-600">{certification.alumniConversion}%</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">CONVERT</p>
              </div>
            </div>
          </div>
        </div>

        {/* Segment 4: Employment Impact */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 bg-amber-50 rounded-bl-lg">
            <Briefcase className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Employment Rates</span>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-sans">
                {Math.round(((emps.employed + emps.selfEmployed + emps.entrepreneur) / (emps.totalAlumniTracked || 1)) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400">employed</span>
            </div>
            <div className="grid grid-cols-4 gap-0.5 text-[9px] font-mono font-medium text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
              <div>
                <p className="font-bold text-indigo-600">{emps.employed}</p>
                <p className="scale-95 origin-left text-slate-400 text-[7px]" title="Salaried">JOB</p>
              </div>
              <div className="border-l border-slate-100 pl-0.5">
                <p className="font-bold text-violet-600">{emps.selfEmployed}</p>
                <p className="scale-95 origin-left text-slate-400 text-[7px]" title="Self Employed">SELF</p>
              </div>
              <div className="border-l border-slate-100 pl-0.5">
                <p className="font-bold text-emerald-600">{emps.entrepreneur}</p>
                <p className="scale-95 origin-left text-slate-400 text-[7px]" title="Entrepreneur">BIZ</p>
              </div>
              <div className="border-l border-slate-100 pl-0.5">
                <p className="font-bold text-rose-600">{emps.unemployed}</p>
                <p className="scale-95 origin-left text-slate-400 text-[7px]" title="Unemployed">UNEMP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Segment 5: Toolkits Impact */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 bg-slate-100 rounded-bl-lg">
            <Settings className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Toolkit Impact</span>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-sans">{toolkit.utilizationRate}%</span>
              <span className="text-[10px] text-slate-400">utilization</span>
            </div>
            <div className="grid grid-cols-2 gap-0.5 text-[9px] font-mono font-medium text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
              <div>
                <p className="font-bold text-emerald-600">{toolkit.verificationRate}%</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">VERIFIED</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-blue-600">{toolkit.recoveryRate}%</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">HEALED</p>
              </div>
            </div>
          </div>
        </div>

        {/* Segment 6: Proof & Evidence */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition shadow-xs relative overflow-hidden group col-span-1">
          <div className="absolute top-0 right-0 p-1 bg-rose-50 rounded-bl-lg">
            <ClipboardCheck className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Impact Evidence</span>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-indigo-950 font-mono bg-indigo-50 px-2.5 py-0.5 rounded-md">
                {Math.round(evidenceObj.impactScoreAverage || 0)}
              </span>
              <span className="text-[10px] text-slate-500 font-sans font-bold uppercase">SCORE</span>
            </div>
            <div className="grid grid-cols-2 gap-0.5 text-[9px] font-mono font-medium text-slate-500 border-t border-slate-100 pt-1.5 mt-1">
              <div>
                <p className="font-bold text-emerald-600">{evidenceObj.verifiedGraduates}</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">VERIFIED</p>
              </div>
              <div className="border-l border-slate-100 pl-1">
                <p className="font-bold text-amber-600">{evidenceObj.pendingVerification}</p>
                <p className="scale-95 origin-left text-slate-400 text-[8px]">PENDING</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* PIPELINE VISUALIZATION CASCADE CARD */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-slate-900 font-display">Program Pipeline Progression & Drop-off Analysis</h3>
          <p className="text-xs text-slate-500">
            A continuous tracking of the learner journey from first application to confirmed business growth and active alumni status.
          </p>
        </div>

        {/* Scalable SVG Timeline Path with zero dependency */}
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[1000px] flex items-center justify-between pb-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            {pipeline.map((step: any, idx: number) => {
              const previousStep = idx > 0 ? pipeline[idx - 1] : null;
              const hasDropoff = previousStep && previousStep.count > step.count;
              const dropoffCount = previousStep ? previousStep.count - step.count : 0;
              const dropoffPct = previousStep ? Math.round((dropoffCount / (previousStep.count || 1)) * 100) : 0;

              return (
                <React.Fragment key={`pipeline-${idx}`}>
                  {/* Pipeline Step Card */}
                  <div className="w-24 group relative flex flex-col items-center">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-indigo-600 bg-white shadow-xs group-hover:bg-indigo-50 transition">
                      <span className="text-xs font-bold font-mono text-indigo-700">{step.count}</span>
                    </div>
                    <p className="text-[9.5px] font-bold text-slate-800 text-center mt-2 leading-tight uppercase font-mono tracking-tighter h-7">
                      {step.name}
                    </p>
                    <span className="text-[10px] text-indigo-550 font-bold mt-1.5 block bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                      {step.pctOfTotal}%
                    </span>
                  </div>

                  {/* Transition Connection Arrow & Drop-off Metric */}
                  {idx < pipeline.length - 1 && (
                    <div className="flex-grow flex flex-col items-center justify-center px-1 text-[10px] font-mono select-none">
                      <div className="flex items-center w-full gap-1">
                        <div className="h-[2px] bg-slate-300 flex-grow" />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        <div className="h-[2px] bg-slate-300 flex-grow" />
                      </div>
                      
                      {/* Drop-off Details Container */}
                      {hasDropoff ? (
                        <div className="mt-1 text-center font-bold bg-rose-50 border border-slate-150 rounded px-1.5 py-0.5 text-rose-700 max-w-[70px] scale-90" title="Loss from previous stage">
                          <p className="text-[9px] font-mono leading-none">-{dropoffCount}</p>
                          <p className="text-[7.5px] origin-center text-rose-500 scale-95 mt-0.5 whitespace-nowrap">-{dropoffPct}% loss</p>
                        </div>
                      ) : (
                        <div className="mt-1 text-[8px] text-slate-400 uppercase font-mono font-semibold">100% flow</div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* STATE & TSP RANKINGS GRID PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Side: Top Performing States Ranking Table */}
        <div id="ideas-mand-e-ranks-state" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">Top Performing State Deployments</h3>
              <p className="text-xs text-slate-500">Cumulative performance scoring based on completion, toolkits, and evidence.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search state..."
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                className="pl-8 py-1 px-2 text-xs border border-slate-200 rounded-lg max-w-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-8 text-center">Pos</th>
                  <th className="p-3">State Node</th>
                  <th className="p-3 text-center font-semibold">Grads</th>
                  <th className="p-3 text-center">Cert %</th>
                  <th className="p-3 text-center">Toolkit %</th>
                  <th className="p-3 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stateRankings
                  .filter((s: any) => s.stateName.toLowerCase().includes(stateSearch.toLowerCase()))
                  .map((row: any, idx: number) => (
                    <tr key={`state-rank-${idx}`} className="hover:bg-slate-50/40">
                      <td className="p-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{row.stateName} State</span>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-medium text-slate-700">{row.graduatesCount}</td>
                      <td className="p-3 text-center font-mono">{Math.round(row.certificationRate)}%</td>
                      <td className="p-3 text-center font-mono text-slate-600">{Math.round(row.toolkitUtilization)}%</td>
                      <td className="p-3 text-center font-mono">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md font-bold text-[11px]">
                          {Math.round(row.overallScore)}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: TSP Providers Performance Metrics */}
        <div id="ideas-mand-e-ranks-tsp" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">Accredited TSP Providers Performance Ranking</h3>
              <p className="text-xs text-slate-500">Independent provider auditing matching completion and graduate employment rates.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search provider..."
                value={tspSearch}
                onChange={(e) => tspSetSearch(e.target.value)}
                className="pl-8 py-1 px-2 text-xs border border-slate-200 rounded-lg max-w-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-8 text-center">Pos</th>
                  <th className="p-3">Accredited Training Source Provider</th>
                  <th className="p-3 text-center">Comp %</th>
                  <th className="p-3 text-center">Cert %</th>
                  <th className="p-3 text-center">Emp %</th>
                  <th className="p-3 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tspRankings
                  .filter((t: any) => t.tspName.toLowerCase().includes(tspSearch.toLowerCase()))
                  .map((row: any, idx: number) => {
                    // New World Access / unique colors
                    const isNewWorld = row.tspName === "New World Access";
                    return (
                      <tr key={`tsp-rank-${idx}`} className={`hover:bg-slate-50/40 ${isNewWorld ? "bg-amber-50/20" : ""}`}>
                        <td className="p-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Building className={`w-3.5 h-3.5 ${isNewWorld ? "text-amber-600" : "text-slate-400"}`} />
                            <div className="font-semibold text-slate-800">
                              <span>{row.tspName}</span>
                              {isNewWorld && (
                                <span className="ml-1.5 text-[8.5px] uppercase font-mono text-amber-700 bg-amber-100 font-bold px-1.5 py-0.5 rounded leading-none">
                                  AUDITED TARGET
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono">{Math.round(row.completionRate)}%</td>
                        <td className="p-3 text-center font-mono">{Math.round(row.certificationRate)}%</td>
                        <td className="p-3 text-center font-mono text-slate-600">{Math.round(row.employmentRate)}%</td>
                        <td className="p-3 text-center font-mono">
                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-md font-bold text-[11px]">
                            {Math.round(row.impactScore)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* COMPONENT 3: DIGITAL SKILLS TRACK ANALYTICS & GIS PREPARATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Track analysis - 2 columns */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="space-y-1 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 font-display">Specialized Repairs Sector Analysis</h3>
            <p className="text-xs text-slate-500">Benchmarking outcomes and business creation benchmarks across key program skill domains.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skillsTrack.map((track: any, idx: number) => (
              <div key={`track-${idx}`} className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-mono font-bold text-indigo-600 tracking-wider">TRACK SCHEME</p>
                    <h4 className="font-bold text-xs text-slate-900 leading-tight">{track.trackName}</h4>
                  </div>
                  <Cpu className="w-5 h-5 text-indigo-400" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[8.5px] uppercase font-mono font-semibold text-slate-400">Enrolled</span>
                    <p className="text-xs font-bold text-slate-900 font-mono mt-0.5">{track.enrolled}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[8.5px] uppercase font-mono font-semibold text-slate-400">Certified</span>
                    <p className="text-xs font-bold text-emerald-700 font-mono mt-0.5">{track.certified}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[8.5px] uppercase font-mono font-semibold text-slate-400">Employed</span>
                    <p className="text-xs font-bold text-indigo-700 font-mono mt-0.5">{track.employed}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-1 font-mono text-[10.5px]">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Self-employed Alums:</span>
                    <span className="font-bold text-slate-800">{track.selfEmployed}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Off-shoot Businesses Created:</span>
                    <span className="font-bold text-violet-700">{track.businessesCreated} enterprise</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Toolkit Utilization Capacity:</span>
                    <span className="font-bold text-emerald-700">{Math.round(track.toolkitUtilization)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GIS Location Audit pre-aggregate panel (No map, future-ready metadata only) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="space-y-1 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 font-display">Compliance GIS Metadata Store</h3>
            <p className="text-xs text-slate-500">Standardizing GPS geo-coordinates mapped across local LGAs and States.</p>
          </div>
          
          <div className="space-y-3">
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between font-mono text-xs text-indigo-950">
              <div className="space-y-0.5">
                <span className="text-[10px] text-indigo-700 uppercase font-bold block leading-none">Mapped Node Sites</span>
                <span className="font-bold">{gis.filter((g: any) => g.latitude).length} verified audits</span>
              </div>
              <MapPin className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>

            <div className="space-y-2 max-h-[175px] overflow-y-auto pr-1">
              {gis.slice(0, 5).map((gps: any, idx: number) => (
                <div key={`gis-gps-${idx}`} className="p-2 border border-slate-100 hover:border-slate-200 rounded-lg flex items-center justify-between text-[11px] font-mono">
                  <div className="space-y-0.5">
                    <p className="font-sans font-bold text-slate-800">{gps.name}</p>
                    <p className="text-[9.5px] text-slate-450">{gps.lga}, {gps.state}</p>
                  </div>
                  <div className="text-right">
                    {gps.latitude ? (
                      <div>
                        <span className="text-[10px] text-slate-800 block">{parseFloat(gps.latitude).toFixed(4)}, {parseFloat(gps.longitude).toFixed(4)}</span>
                        <span className="text-[8.5px] text-emerald-600 font-bold block">CONFIRMED GPS</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">No GPS captured</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[9.5px] font-mono text-slate-400 leading-normal text-center bg-slate-50 p-2 rounded-lg border border-slate-100">
              * Database-compiled coordinates pre-structured for GIS API map-integration layout matching NBTE global spatial monitoring dashboard rules.
            </p>
          </div>
        </div>

      </div>

      {/* DONOR REPORTING CENTER CONTROL PANEL */}
      <div id="ideas-mand-e-donor-center" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="space-y-1 border-b border-indigo-50 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-indigo-600 rounded">
              <FileText className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="text-xs font-bold text-slate-900 font-display">Donor & Auditor Reporting Node</span>
          </div>
          <p className="text-xs text-slate-500">Configure parameters to compile and download multi-record outcomes performance books.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="space-y-1.5 text-xs text-slate-700">
            <span className="font-semibold block">Select Audit Report Criteria:</span>
            <select
              value={reportType}
              onChange={(e: any) => setReportType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none font-sans font-semibold text-slate-800 focus:border-indigo-500 cursor-pointer text-xs"
            >
              <option value="quarterly">Quarterly Program Report</option>
              <option value="annual">Annual Impact Report</option>
              <option value="state">Performance Report (by State Nodes)</option>
              <option value="tsp">TSP Audits Report (by Provider Nodes)</option>
              <option value="sector">Repairs Track Report (by Domain)</option>
            </select>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700">
            <span className="font-semibold block font-sans">Export Compiled Output Format:</span>
            <select
              value={reportFormat}
              onChange={(e: any) => setReportFormat(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none font-sans font-semibold text-slate-800 focus:border-indigo-500 cursor-pointer text-xs"
            >
              <option value="pdf">A4 Corporate Tabular Document (PDF)</option>
              <option value="excel">Tabular Workbook Spreadsheet (XLSX)</option>
              <option value="csv">Standard Comma-Separated Values (CSV)</option>
            </select>
          </div>

          <div className="self-end pt-1 bg-linear-to-r">
            <button
              onClick={handleDownloadReport}
              disabled={generatingReport}
              className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-xs transition active:scale-[98%] cursor-pointer text-xs uppercase tracking-wider font-sans group"
            >
              {generatingReport ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling Book...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>Generate &amp; Download Report</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* COMPONENT 5: ALERTS CENTER (REAL-TIME FAULT DETECTION) */}
      <div id="ideas-mand-e-alerts-center" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-rose-50 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="font-bold text-sm text-slate-900 font-display">Risk Alert Engine (Algorithms Triggers)</h3>
            </div>
            <p className="text-xs text-slate-500">Continuous background audit monitors highlighting compliance bottlenecks and high-risk assets.</p>
          </div>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter alerts..."
              value={alertSearch}
              onChange={(e) => setAlertSearch(e.target.value)}
              className="pl-8 py-1 px-2.5 text-xs border border-slate-200 rounded-lg max-w-xs outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="space-y-2 px-0.5">
          {alerts.length === 0 ? (
            <p className="p-4 text-center font-mono text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
              No critical compliant exceptions flagged in current registry.
            </p>
          ) : (
            alerts
              .filter((a: any) => a.category.toLowerCase().includes(alertSearch.toLowerCase()) || a.traineeName.toLowerCase().includes(alertSearch.toLowerCase()))
              .map((alert: any, idx: number) => {
                const isHigh = alert.severity === "HIGH" || alert.severity === "CRITICAL";
                return (
                  <div key={`alert-card-${idx}`} className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition relative overflow-hidden ${
                    isHigh ? "bg-red-50/50 border-red-150 text-red-950" : "bg-amber-50/30 border-amber-150 text-slate-800"
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${isHigh ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`font-mono text-[9px] font-bold px-1.5 rounded uppercase leading-none ${
                            isHigh ? "bg-red-200 text-red-900" : "bg-amber-200 text-amber-900"
                          }`}>
                            {alert.severity} Risk
                          </span>
                          <span className="font-semibold text-slate-900 font-sans">{alert.category}</span>
                        </div>
                        <p className="text-slate-500">Trainee ID: <strong className="font-semibold text-slate-850">{alert.traineeId}</strong> — {alert.traineeName}</p>
                        <p className="text-slate-600 mt-1 leading-relaxed text-[11.5px]">{alert.message}</p>
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0 flex flex-col items-start sm:items-end gap-1 font-mono text-[10.5px]">
                      <span className="text-slate-400">Protocol Intervention:</span>
                      <button
                        onClick={() => viewGraduateProfile(alert.traineeId)}
                        className={`font-semibold underline cursor-pointer hover:font-bold ${
                          isHigh ? "text-red-700" : "text-amber-700"
                        }`}
                      >
                        {alert.suggestedAction}
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* COMPONENT 6: INTEGRATED SLIDE-IN PROFILE DRAWER */}
      {showProfileDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-xs animate-in fade-in duration-200">
          
          {/* Backdrop Closer Click */}
          <div className="absolute inset-0" onClick={() => setShowProfileDrawer(false)} />
          
          {/* Slide Box */}
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-205 z-50">
            
            {/* Slide Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono bg-indigo-950 font-bold px-2 py-0.5 rounded text-indigo-300">
                  Global M&amp;E Executive Audit
                </span>
                <h3 className="font-bold text-base leading-tight">
                  {loadingTraineeDetails ? "Retrieving Profile File..." : selectedTraineeDetails?.firstName ? `${selectedTraineeDetails.firstName} ${selectedTraineeDetails.lastName}` : "Trainee Portfolio"}
                </h3>
              </div>
              <button
                onClick={() => setShowProfileDrawer(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slide Content */}
            <div className="flex-grow overflow-y-auto p-5 space-y-5">
              {loadingTraineeDetails || !selectedTraineeDetails ? (
                <div className="flex flex-col items-center justify-center py-20 font-mono text-slate-400 gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
                  <p className="text-[10px] uppercase font-bold text-center tracking-widest pl-2">Extracting records...</p>
                </div>
              ) : (
                <div className="space-y-6 text-xs text-slate-600">
                  
                  {/* Photo & Core Bio Header & Score Badge */}
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-16 h-16 rounded-full border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center bg-indigo-100 font-bold uppercase text-indigo-700 text-lg">
                      {selectedTraineeDetails.photo ? (
                        <img src={selectedTraineeDetails.photo} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        selectedTraineeDetails.firstName?.substring(0, 2)
                      )}
                    </div>

                    <div className="space-y-1 text-center sm:text-left flex-grow">
                      <p className="font-mono text-[9px] bg-indigo-100 font-bold px-2 py-0.5 rounded text-indigo-700 inline-block">
                        ID: {selectedTraineeDetails.id}
                      </p>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {selectedTraineeDetails.firstName} {selectedTraineeDetails.lastName}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">TSP: {selectedTraineeDetails.tsp}</p>
                    </div>

                    {/* Score badge in drawer */}
                    <div className="p-3 bg-white border border-slate-150 rounded-xl text-center shadow-xs shrink-0 w-24">
                      <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 block tracking-wider leading-none">Impact Index</span>
                      <span className="font-mono text-xl font-bold text-indigo-900 mt-1 block">
                        {Math.round(selectedTraineeDetails.impactScore)}
                      </span>
                      <span className={`text-[8px] uppercase font-mono font-bold mt-0.5 block ${
                        selectedTraineeDetails.impactScore >= 90 ? "text-emerald-700" :
                        selectedTraineeDetails.impactScore >= 75 ? "text-blue-750" :
                        selectedTraineeDetails.impactScore >= 60 ? "text-amber-700" : "text-rose-700"
                      }`}>
                        {selectedTraineeDetails.impactScoreClassification}
                      </span>
                    </div>
                  </div>

                  {/* Segment Details Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Admissions detail */}
                    <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 shadow-2xs space-y-1.5">
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-1">1. Admissions Entry</p>
                      <div className="space-y-1 font-mono text-[10.5px]">
                        <p className="flex justify-between"><span>Status:</span> <strong className="text-slate-800">{selectedTraineeDetails.admissionStatus || "Active"}</strong></p>
                        <p className="flex justify-between"><span>Gender:</span> <strong className="text-slate-800">{selectedTraineeDetails.gender}</strong></p>
                        <p className="flex justify-between"><span>State:</span> <strong className="text-slate-800">{selectedTraineeDetails.state}</strong></p>
                        <p className="flex justify-between"><span>LGA:</span> <strong className="text-slate-800">{selectedTraineeDetails.customFields?.LGA || "N/A"}</strong></p>
                      </div>
                    </div>

                    {/* Certification Detail */}
                    <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 shadow-2xs space-y-1.5">
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-1">2. Certification Node</p>
                      <div className="space-y-1 font-mono text-[10.5px]">
                        <p className="flex justify-between"><span>Status:</span> <strong className="text-slate-850">{selectedTraineeDetails.certificationStatus}</strong></p>
                        <p className="flex justify-between"><span>Cert Reg No:</span> <strong className="text-slate-850 truncate max-w-[100px]" title={selectedTraineeDetails.certificateNumber}>{selectedTraineeDetails.certificateNumber || "N/A"}</strong></p>
                        <p className="flex justify-between"><span>Award Date:</span> <strong className="text-slate-800">{selectedTraineeDetails.certificateIssuedAt ? new Date(selectedTraineeDetails.certificateIssuedAt).toISOString().split("T")[0] : "Pending"}</strong></p>
                      </div>
                    </div>

                    {/* Attendance Logs */}
                    <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 shadow-2xs space-y-1.5">
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-1">3. Attendance Tracker</p>
                      <div className="space-y-1 font-mono text-[10.5px]">
                        <p className="flex justify-between"><span>Total Classes Logged:</span> <strong className="text-slate-800">{selectedTraineeDetails.attendanceStats?.totalLogs || 0} days</strong></p>
                        <p className="flex justify-between"><span>Present Sessions:</span> <strong className="text-emerald-700">{selectedTraineeDetails.attendanceStats?.presentCount || 0}</strong></p>
                        <p className="flex justify-between"><span>Compliance Rate:</span> <strong className="text-slate-850 font-bold">{selectedTraineeDetails.attendanceStats?.complianceRate || 100}%</strong></p>
                      </div>
                    </div>

                    {/* Toolkit Log */}
                    <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 shadow-2xs space-y-1.5">
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-1">4. Toolkit Logistics</p>
                      <div className="space-y-1 font-mono text-[10.5px]">
                        <p className="flex justify-between"><span>Asset Code:</span> <strong className="text-slate-850 font-mono">{selectedTraineeDetails.toolkit?.assetCode || "N/A"}</strong></p>
                        <p className="flex justify-between"><span>Audit Verification:</span> <strong className="text-slate-850 font-bold">{selectedTraineeDetails.toolkit?.verificationStatus || "NOT ALLOCATED"}</strong></p>
                        <p className="flex justify-between"><span>Utilization Mode:</span> <strong className="text-slate-850">{selectedTraineeDetails.toolkit?.utilizationStatus || "N/A"}</strong></p>
                      </div>
                    </div>

                    {/* Employment detailed */}
                    <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 shadow-2xs space-y-1.5">
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-1">5. Tracer Outcome (Employment)</p>
                      <div className="space-y-1 font-mono text-[10.5px]">
                        <p className="flex justify-between"><span>Demographic State:</span> <strong className="text-slate-850">{selectedTraineeDetails.outcome?.outcomeStatus || "UNKNOWN"}</strong></p>
                        <p className="flex justify-between"><span>Employer:</span> <strong className="text-slate-800">{selectedTraineeDetails.outcome?.employerName || "N/A"}</strong></p>
                        <p className="flex justify-between"><span>Job Title:</span> <strong className="text-indigo-900 font-semibold">{selectedTraineeDetails.outcome?.jobTitle || "N/A"}</strong></p>
                        <p className="flex justify-between"><span>Income:</span> <strong className="text-emerald-700">₦{(selectedTraineeDetails.outcome?.monthlyIncome || 0).toLocaleString()}</strong></p>
                      </div>
                    </div>

                    {/* Business Activity Detailed */}
                    <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 shadow-2xs space-y-1.5">
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-1">6. Business Enterprise</p>
                      <div className="space-y-1 font-mono text-[10.5px]">
                        <p className="flex justify-between"><span>Business Registered:</span> <strong className="text-slate-850">{selectedTraineeDetails.outcome?.businessName || "N/A"}</strong></p>
                        <p className="flex justify-between"><span>Sector Type:</span> <strong className="text-slate-800">{selectedTraineeDetails.outcome?.businessType || "N/A"}</strong></p>
                        <p className="flex justify-between"><span>Active Revenue:</span> <strong className="text-emerald-700">₦{(selectedTraineeDetails.outcome?.businessRevenue || 0).toLocaleString()}/mo</strong></p>
                      </div>
                    </div>

                  </div>

                  {/* Impact Evidence list in drawer */}
                  <div className="p-4 border border-slate-150 rounded-xl bg-slate-50/40 space-y-2">
                    <p className="text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">
                      7. Impact Evidence & Documents Inventory
                    </p>
                    {selectedTraineeDetails.evidences?.length === 0 ? (
                      <p className="text-center italic font-sans text-slate-400 py-2">No evidence documents uploaded.</p>
                    ) : (
                      selectedTraineeDetails.evidences?.map((ev: any, evIdx: number) => (
                        <div key={`ev-invent-${evIdx}`} className="p-2.5 bg-white rounded-lg border border-slate-100 flex items-center justify-between text-[11px] font-mono">
                          <div className="space-y-0.5">
                            <span className="font-sans font-bold text-slate-800">{ev.evidenceType} Document</span>
                            <span className="text-[9.5px] text-slate-450 block">{ev.description || "No description given."}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            ev.verificationStatus === "VERIFIED" ? "bg-emerald-50 text-emerald-700" :
                            ev.verificationStatus === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {ev.verificationStatus}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Audit Trail Logs */}
                  <div className="p-4 border border-slate-150 rounded-xl bg-slate-50/40 space-y-2.5">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <p className="text-[8.5px] font-mono font-bold uppercase tracking-widest leading-none">
                        8. Core Forensic Audit Trail History
                      </p>
                    </div>
                    
                    <div className="space-y-1.5">
                      {selectedTraineeDetails.history?.length === 0 ? (
                        <p className="text-center italic text-slate-400 py-1">No forensic activity logged.</p>
                      ) : (
                        selectedTraineeDetails.history?.slice(0, 3).map((log: any, logIdx: number) => (
                          <div key={`log-hist-${logIdx}`} className="p-2 border border-slate-100 bg-white rounded-lg text-[10.5px]">
                            <div className="flex items-center justify-between font-mono text-slate-400 text-[9.5px]">
                              <span>By: {log.changedBy || log.username}</span>
                              <span>{log.changedAt ? new Date(log.changedAt).toISOString().split("T")[0] : ""}</span>
                            </div>
                            <p className="font-semibold text-slate-800 mt-0.5 leading-relaxed">{log.oldStatus ? `Status Shifted: ${log.oldStatus} ➔ ${log.newStatus}` : log.details || log.action}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Slide Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowProfileDrawer(false)}
                className="py-2 px-4 bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-lg text-xs cursor-pointer"
              >
                Close Audit File
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
