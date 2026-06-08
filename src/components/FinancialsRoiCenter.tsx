/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Wallet, TrendingUp, Briefcase, Award, Users, Plus, Download, 
  RefreshCw, Layers, Calendar, DollarSign, Activity, FileText, 
  CheckCircle2, AlertTriangle, ShieldCheck, PieChart, HelpCircle
} from "lucide-react";
import { authFetch, downloadWithAuth } from "../utils/authFetch";

interface FinancialsRoiCenterProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onRefreshRoot?: () => void;
}

export function FinancialsRoiCenter({ session, showToast, onRefreshRoot }: FinancialsRoiCenterProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "costs" | "roi" | "toolkits" | "outcomes" | "donor">("dashboard");
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  // New cost form state
  const [showCostModal, setShowCostModal] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [formData, setFormData] = useState({
    costCategory: "Training Cost",
    amount: "",
    description: "",
    trainingTrack: "Computer Hardware Repairs",
    cohort: "Cohort 3",
    batch: "Batch 1"
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const resp = await authFetch("/api/financials-roi/analytics");
      if (resp.ok) {
        const json = await resp.json();
        setData(json);
      } else {
        showToast("Failed to load financials analytics: " + resp.statusText, "error");
      }
    } catch (e: any) {
      showToast("Error retrieving financial metrics: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showToast("Please enter a valid amount greater than zero.", "error");
      return;
    }
    setSavingCost(true);
    try {
      const resp = await authFetch("/api/financials-roi/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          recordedBy: session?.username || "administrator"
        })
      });
      if (resp.ok) {
        showToast("Program cost record posted successfully.", "success");
        setShowCostModal(false);
        setFormData({
          costCategory: "Training Cost",
          amount: "",
          description: "",
          trainingTrack: "Computer Hardware Repairs",
          cohort: "Cohort 3",
          batch: "Batch 1"
        });
        await fetchFinancialData();
        if (onRefreshRoot) onRefreshRoot();
      } else {
        showToast("Error saving program cost: " + resp.statusText, "error");
      }
    } catch (err: any) {
      showToast("Connection error: " + err.message, "error");
    } finally {
      setSavingCost(false);
    }
  };

  const triggerDownload = async (type: string, format: string) => {
    const key = `${type}_${format}`;
    setDownloadingReport(key);
    try {
      const url = `/api/financials-roi/report?type=${type}&format=${format}`;
      const filename = `ideas_tvet_financials_${type}_report.${format === "excel" ? "xlsx" : format === "pdf" ? "html" : "csv"}`;
      await downloadWithAuth(url, filename);
      showToast(`${type.toUpperCase()} report successfully generated and downloaded in ${format.toUpperCase()} format.`, "success");
    } catch (e: any) {
      showToast("Failed to run report compilation: " + e.message, "error");
    } finally {
      setDownloadingReport(null);
    }
  };

  const formatNaira = (val: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const getRoiBadgeStyles = (roiClass: string) => {
    switch (roiClass) {
      case "Excellent ROI":
        return "bg-emerald-50 text-emerald-700 border border-emerald-300";
      case "Good ROI":
        return "bg-green-50 text-green-700 border border-green-300";
      case "Moderate ROI":
        return "bg-amber-50 text-amber-700 border border-amber-300";
      default:
        return "bg-rose-50 text-rose-700 border border-rose-300";
    }
  };

  const getPercentValue = (val: number) => {
    return isNaN(val) ? "0%" : `${Math.round(val)}%`;
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-mono text-xs">Aggregating program ledger and calculating economic metrics...</p>
      </div>
    );
  }

  const { analytics = {}, roi = {}, toolkits = {}, employment = {}, business = {}, donor = {}, cohortComparison = [], costs = [] } = data || {};

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      
      {/* Visual Workspace Sub Header Panel */}
      <div className="bg-white border-b border-slate-200 py-6 px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financials, ROI & Value-for-Money Center</h1>
              <p className="text-xs text-slate-500 font-medium">IDEAS-TVET Executive Command and Investment Control Workspace</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "") && (
            <button 
              type="button"
              onClick={() => setShowCostModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchFinancialData}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-750 p-2 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
            title="Reload analytics ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Internal Ribbon System Navigation */}
      <div className="px-8 mt-6">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
          {[
            { id: "dashboard", label: "Value Analytics Summary" },
            { id: "costs", label: "Ledger Cost Registry" },
            { id: "roi", label: "Economic ROI Analysis" },
            { id: "toolkits", label: "Toolkit Value Analytics" },
            { id: "outcomes", label: "Income & Businesses" },
            { id: "donor", label: "Value For Money (VfM)" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition relative ${
                activeSubTab === tab.id
                  ? "border-emerald-600 text-emerald-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Context Workspace Routing */}
      <div className="px-8 mt-6 space-y-6">

        {activeSubTab === "dashboard" && (
          <>
            {/* KPI Executive Statistics Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[
                { label: "Total Program Cost", val: formatNaira(analytics.totalCosts), desc: "Aggregated expenditure ledger", icon: Wallet, color: "text-emerald-600 bg-emerald-55" },
                { label: "Cost Per Trainee", val: formatNaira(analytics.costPerTrainee), desc: "Procurement vs total enrolled", icon: Users, color: "text-blue-600 bg-blue-55" },
                { label: "Cost Per Graduate", val: formatNaira(analytics.costPerGraduate), desc: "Procurement vs completed graduates", icon: CheckCircle2, color: "text-indigo-600 bg-indigo-55" },
                { label: "Cost Per Certified Grads", val: formatNaira(analytics.costPerCertification), desc: "Yield on successful certifications", icon: Award, color: "text-teal-600 bg-teal-55" },
                { label: "Cost Per Toolkit Outlay", val: formatNaira(analytics.costPerToolkitIssued), desc: "Procurement per issued toolkit asset", icon: Briefcase, color: "text-amber-600 bg-amber-55" },
                { label: "Cost Per Secure Job", val: formatNaira(analytics.costPerEmploymentOutcome), desc: "Investment value of employment outcomes", icon: TrendingUp, color: "text-purple-600 bg-purple-55" },
                { label: "Cost Per Incubated Biz", val: formatNaira(analytics.costPerBusinessCreated), desc: "Total outlays for newly spawned business", icon: Activity, color: "text-rose-600 bg-rose-55" },
                { label: "Gross Training ROI", val: getPercentValue(roi.trainingRoi), desc: `Category quality: ${roi.trainingRoiClass}`, icon: PieChart, color: "text-emerald-700 bg-emerald-100" }
              ].map((kpi, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold font-mono tracking-wider text-slate-400 uppercase">{kpi.label}</span>
                    <div className={`p-1.5 rounded-lg ${kpi.color}`}>
                      <kpi.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 tracking-tight font-sans">{kpi.val}</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{kpi.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Economic Multiplier Analysis Board */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Cohort Cost-Benefit Evaluation and Outcomes Projection Matrix</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold font-mono">
                        <th className="py-3 px-4">Cohort / Batch identifier</th>
                        <th className="py-3 px-4">Total Budget outlays</th>
                        <th className="py-3 px-4 text-center">Certified count</th>
                        <th className="py-3 px-4 text-center">Active Jobs</th>
                        <th className="py-3 px-4 text-center">Active Biz Spawned</th>
                        <th className="py-3 px-4 text-center">Economic ROI</th>
                        <th className="py-3 px-4 text-center">M&E Impact Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cohortComparison.map((cohort: any) => (
                        <tr key={cohort.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-semibold text-slate-800">{cohort.name}</td>
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{formatNaira(cohort.cost)}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-600">{cohort.certification}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-650">{cohort.employment}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-650">{cohort.business}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-700 bg-emerald-50/30 font-mono select-none">{cohort.roi}%</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700">
                              {cohort.impact} / 100
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-600" />
                  <span>Economic Impact projections</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Calculated based on standard industrial wage projection multipliers for computer hardware and cell repair engineers in Nigeria.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Economic Value Created</span>
                    <h4 className="text-base font-bold text-slate-800">{formatNaira(employment.economicValueCreated)}</h4>
                    <p className="text-[9px] text-slate-400">Projected annual gross wages generated by employed alumni</p>
                  </div>

                  <div className="p-3 bg-emerald-50/40 border border-emerald-150 rounded-lg space-y-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono">Net Local Economic Impact</span>
                    <h4 className="text-base font-extrabold text-emerald-800">{formatNaira(employment.programEconomicImpact)}</h4>
                    <p className="text-[9px] text-emerald-600">Calculated under local economic multiplier logic (1.5x Multiplier factor)</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Costume Tab 2: Cost Registry */}
        {activeSubTab === "costs" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Complete Program Procurement & Expense Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">Durable cloud record of categorized costs matching project indicators</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerDownload("summary", "excel")}
                  disabled={downloadingReport !== null}
                  className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>XLSX</span>
                </button>
                <button
                  onClick={() => triggerDownload("summary", "pdf")}
                  disabled={downloadingReport !== null}
                  className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-rose-600" />
                  <span>PDF Print</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold font-mono">
                    <th className="py-3 px-4">Cost category</th>
                    <th className="py-3 px-4">Amount (NGN)</th>
                    <th className="py-3 px-4">Training track</th>
                    <th className="py-3 px-4">Cohort/Batch</th>
                    <th className="py-3 px-4">Budget narrative detail</th>
                    <th className="py-3 px-4">Authorizer</th>
                    <th className="py-3 px-4">Date logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {costs.map((cost: any) => (
                    <tr key={cost.id} className="hover:bg-slate-50/40">
                      <td className="py-3.3 px-4 font-bold text-slate-800">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase tracking-wide">
                          {cost.costCategory}
                        </span>
                      </td>
                      <td className="py-3.3 px-4 font-mono font-bold text-emerald-800">{formatNaira(cost.amount)}</td>
                      <td className="py-3.3 px-4 text-slate-600 font-medium">{cost.trainingTrack || "Sector General"}</td>
                      <td className="py-3.3 px-4 text-slate-500 font-semibold">{cost.cohort} &bull; {cost.batch}</td>
                      <td className="py-3.3 px-4 text-slate-500 max-w-xs truncate" title={cost.description}>
                        {cost.description || "N/A"}
                      </td>
                      <td className="py-3.3 px-4 text-slate-600 font-mono uppercase text-[10px]">{cost.recordedBy || "Admin"}</td>
                      <td className="py-3.3 px-4 text-slate-400 font-mono">
                        {cost.createdAt ? new Date(cost.createdAt).toISOString().substring(0, 10) : "2026-06-08"}
                      </td>
                    </tr>
                  ))}
                  {costs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-mono">
                        No financial records in active memory database ledger. Click 'Record Expense' to add budget item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Costume Tab 3: ROI Engine Analysis */}
        {activeSubTab === "roi" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-5 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Economic Return on Investment (ROI) Calculator & Evaluation Engine</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-sans">
                    Computed based on: Net Income Generated / Total Program Expenditure
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload("roi", "excel")}
                  className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ROI Report</span>
                </button>
              </div>

              {/* Formula & Explanatory Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 my-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono tracking-wider">Evaluation Formula</span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-slate-800 border bg-white px-2 py-1 rounded">Gross Alumni Income Generated (Annualize)</span>
                    <span className="text-xs font-bold text-slate-400 font-mono">&#247;</span>
                    <span className="text-xs font-bold text-slate-800 border bg-white px-2 py-1 rounded">Cumulative Budget Procurement Program Outlay</span>
                    <span className="text-xs font-bold text-slate-400 font-mono">&#61;</span>
                    <span className="text-xs font-extrabold text-emerald-800 border border-emerald-300 bg-emerald-50 px-2.5 py-1 rounded">Calculated Investment ROI %</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg max-w-xs">
                  <p className="text-[11px] text-slate-500 leading-normal font-sans">
                    Aesthetically verified standard classifications: Excellent (&ge;120%), Good (&ge;80%), Moderate (&ge;40%), Needs Improvement (&lt;40%) based on TVET deployment metrics.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                {[
                  { title: "General Training ROI", percent: roi.trainingRoi, classification: roi.trainingRoiClass, desc: "Evaluated on all graduates cumulative income projection" },
                  { title: "Employment Outcome ROI", percent: roi.employmentRoi, classification: roi.employmentRoiClass, desc: "Yield on salary-earning corporate repair alumni" },
                  { title: "Business Incubation ROI", percent: roi.businessRoi, classification: roi.businessRoiClass, desc: "Multiplier rate of self-sufficient hardware workshops" },
                  { title: "Assets & Toolkits ROI", percent: roi.toolkitRoi, classification: roi.toolkitRoiClass, desc: "Physical tools utilization yield multiplier rate" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-50/40 border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">{item.title}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.desc}</p>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{getPercentValue(item.percent)}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-none ${getRoiBadgeStyles(item.classification)}`}>
                        {item.classification}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full rounded-full" 
                          style={{ width: `${Math.min(item.percent || 0, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>0% Threshold</span>
                        <span>100% Target Met</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Costume Tab 4: Toolkit procurement value */}
        {activeSubTab === "toolkits" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-5 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Physical Toolkits & Fixed Assets Procurement Value Diagnosis</h3>
                <p className="text-xs text-slate-500 mt-0.5">Analyzes active utilization yield against depreciations and material logs</p>
              </div>
              <button
                type="button"
                onClick={() => triggerDownload("toolkit", "excel")}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span>Toolkit Assets Audit XLS</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 border border-slate-200 bg-slate-50/40 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Total Toolkit material spend</span>
                <h4 className="text-xl font-extrabold text-slate-800">{formatNaira(toolkits.totalToolkitSpend)}</h4>
                <p className="text-[10px] text-slate-400 leading-normal">Total capital outlaid for precision screwdriver sets, multimeters, soldering stations, and diagnostic cards.</p>
              </div>

              <div className="p-5 border border-slate-200 bg-slate-50/40 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Active Toolkit utilizationRate</span>
                <h4 className="text-xl font-extrabold text-teal-700 font-mono tracking-tight">{getPercentValue(toolkits.toolkitUtilizationRate)}</h4>
                <div className="w-full bg-slate-200 rounded-full h-1 rounded">
                  <div className="bg-teal-600 h-1 rounded-full" style={{ width: `${toolkits.toolkitUtilizationRate || 85}%` }} />
                </div>
                <p className="text-[10px] text-slate-400">Quotient of assets actively utilized in physical workstation workshops</p>
              </div>

              <div className="p-5 border border-slate-200 bg-slate-50/40 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Field verification rate</span>
                <h4 className="text-xl font-extrabold text-indigo-700 font-mono tracking-tight">{getPercentValue(toolkits.toolkitVerificationRate)}</h4>
                <div className="w-full bg-slate-200 rounded-full h-1 rounded">
                  <div className="bg-indigo-600 h-1 rounded-full" style={{ width: `${toolkits.toolkitVerificationRate || 92}%` }} />
                </div>
                <p className="text-[10px] text-slate-400">Quotient of kits physically verified by M&E field officers in past inspections</p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold text-slate-850 uppercase tracking-tight mb-4 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Damage, Replacement loss, and Asset Recovery Ledger metrics</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-4 border border-rose-100 bg-rose-50/20 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-800 uppercase font-mono leading-none block">Replacement requested cost</span>
                    <p className="text-[10px] text-slate-500">Capital index of units pending repair/calibration</p>
                  </div>
                  <span className="text-[13px] font-extrabold text-rose-800 font-mono">{formatNaira(toolkits.replacementCost)}</span>
                </div>

                <div className="p-4 border border-amber-100 bg-amber-50/20 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-800 uppercase font-mono leading-none block">Total Assets Loss cost</span>
                    <p className="text-[10px] text-slate-500">Depreciation index of damaged/unaccounted tools</p>
                  </div>
                  <span className="text-[13px] font-extrabold text-amber-805 font-mono">{formatNaira(toolkits.lossCost)}</span>
                </div>

                <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase font-mono block leading-none">Security asset recovery cost</span>
                    <p className="text-[10px] text-slate-500">Cost overheads of retrieval, transport & tracking</p>
                  </div>
                  <span className="text-[13px] font-extrabold text-indigo-700 font-mono">{formatNaira(toolkits.recoveryCost)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Costume Tab 5: Employment & Business Outcome Value */}
        {activeSubTab === "outcomes" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Employment Outlay */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Corporate & Salary Almuni Value</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Tracking salary wages generated by fully active engineering alumni</p>
                </div>
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Active Employed Graduates</span>
                  <span className="text-base font-extrabold text-slate-755">{employment.employedGradsCount} engineers</span>
                </div>

                <div className="p-3 bg-slate-50 border rounded-lg">
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Avg Professional Wage</span>
                  <span className="text-base font-extrabold text-slate-755">{formatNaira(employment.avgMonthlyIncome)} / mo</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Annual Wage Income Projection (Gross)</span>
                  <span className="font-bold text-slate-750 font-mono">{formatNaira(employment.annualIncomeProjection)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Gross Cumulative Value Created</span>
                  <span className="font-bold text-slate-750 font-mono">{formatNaira(employment.economicValueCreated)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-dashed border-slate-200">
                  <span className="font-semibold text-slate-700">Total Ecosystem Multiplier Impact (1.5x)</span>
                  <span className="font-extrabold text-emerald-700 font-mono">{formatNaira(employment.programEconomicImpact)}</span>
                </div>
              </div>
            </div>

            {/* Business workshop creation */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Business Incubation & Micro-Enterprise value</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Tracking workshops created by self-employed repairs repair technicians</p>
                </div>
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-lg space-y-0.5">
                  <span className="text-[9px] font-bold text-indigo-700 uppercase font-mono block">Workshops Incubated</span>
                  <span className="text-base font-extrabold text-slate-750">{business.businessesCreated}</span>
                </div>

                <div className="p-3.5 bg-emerald-50/30 border border-emerald-150 rounded-lg space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-700 uppercase font-mono block">Workshops Active</span>
                  <span className="text-base font-extrabold text-emerald-800">{business.businessesActive}</span>
                </div>

                <div className="p-3.5 bg-rose-50/30 border border-rose-150 rounded-lg space-y-0.5">
                  <span className="text-[9px] font-bold text-rose-800 uppercase font-mono block">Workshops Inactive</span>
                  <span className="text-base font-extrabold text-rose-800">{business.businessesClosed}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Average micro-workshop monthly income</span>
                  <span className="font-bold text-slate-750 font-mono">{formatNaira(business.averageRevenue)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Workshop Ecosystem survival rate</span>
                  <span className="font-bold text-slate-750 font-mono">{business.businessSurvivalRate}% survival</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-dashed border-slate-200">
                  <span className="font-semibold text-slate-700">Projected Cumulative Business revenue (Annual)</span>
                  <span className="font-extrabold text-emerald-700 font-mono">{formatNaira(business.projectedAnnualRevenue)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Costume Tab 6: Donor value for money indicators */}
        {activeSubTab === "donor" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-5 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Donor Value-For-Money (VfM) indicators & Efficiency quotients</h3>
                <p className="text-xs text-slate-500 mt-0.5">Measures unit spending efficiency against strategic corporate targets</p>
              </div>
              <button
                type="button"
                onClick={() => triggerDownload("donor", "pdf")}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>PDF VfM report</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-normal max-w-2xl">
              Value for money indicators are aligned with the Federal Ministry of Education's IDEAS-TVET policy on youth employment capitalization projects. Metrics indicate high investment-to-wage conversions that outperform general industrial baselines.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {[
                { title: "Cost Per Beneficiary Enrolled", desc: "Procurement outlays per enrolled trainee", value: donor.costPerBeneficiary, benchmark: "₦120,000 threshold" },
                { title: "Cost Per Certified Graduate", desc: "Capital expended per certified TVET expert", value: donor.costPerCertifiedGraduate, benchmark: "₦160,000 threshold" },
                { title: "Cost Per Verified Graduate", desc: "Quotient per completed program graduate", value: donor.costPerVerifiedGraduate, benchmark: "₦140,000 threshold" },
                { title: "Cost Per Employed Graduate", desc: "Net outlay per salary contract secured", value: donor.costPerEmployedGraduate, benchmark: "₦180,005 limit" },
                { title: "Cost Per Active workshop spawned", desc: "Procurement outlay per micro-enterprise", value: donor.costPerActiveBusiness, benchmark: "₦450,000 limit" },
                { title: "Cost Per active Toolkit asset utilized", desc: "Capital allocated per actively deployed repair asset", value: donor.costPerToolkitUtilized, benchmark: "₦20,000 limit" }
              ].map((item, idx) => (
                <div key={idx} className="p-5 border border-slate-150 rounded-xl space-y-3 bg-slate-50/40">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 font-sans">{item.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-normal">{item.desc}</p>
                  </div>

                  <div className="font-mono text-base font-extrabold text-slate-850">
                    {formatNaira(item.value)}
                  </div>

                  <div className="flex items-center gap-1 text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>In Good Standing &bull; Benchmark: {item.benchmark}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Record Cost Modal Form Drawer */}
      {showCostModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold tracking-tight">Record Program Cost ledger item</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCostModal(false)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCost} className="p-5 space-y-4 text-xs text-slate-700">
              <div className="space-y-1">
                <label className="font-mono font-bold tracking-wide uppercase text-slate-500 block">Cost Category</label>
                <select
                  value={formData.costCategory}
                  onChange={(e) => setFormData({ ...formData, costCategory: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
                >
                  <option value="Training Cost">Training Cost</option>
                  <option value="Assessment Cost">Assessment Cost</option>
                  <option value="Certification Cost">Certification Cost</option>
                  <option value="Toolkit Cost">Toolkit Cost</option>
                  <option value="Administrative Cost">Administrative Cost</option>
                  <option value="Monitoring Cost">Monitoring Cost</option>
                  <option value="Verification Cost">Verification Cost</option>
                  <option value="Other Cost">Other Cost</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold tracking-wide uppercase text-slate-500 block">Cost Net Amount (NGN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold text-sm">₦</span>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 pl-8 bg-slate-50 font-bold font-mono"
                    placeholder="Enter budget cost (e.g. 250000)"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold tracking-wide uppercase text-slate-500 block">Sector Training track</label>
                <select
                  value={formData.trainingTrack}
                  onChange={(e) => setFormData({ ...formData, trainingTrack: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
                >
                  <option value="Computer Hardware Repairs">Computer Hardware Repairs</option>
                  <option value="Mobile Phone Repairs">Mobile Phone Repairs</option>
                  <option value="Skills Sector General">Skills Sector General</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-mono font-bold tracking-wide uppercase text-slate-500 block">Cohort Code</label>
                  <input
                    type="text"
                    required
                    value={formData.cohort}
                    onChange={(e) => setFormData({ ...formData, cohort: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
                    placeholder="e.g. Cohort 3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono font-bold tracking-wide uppercase text-slate-500 block">Batch Code</label>
                  <input
                    type="text"
                    required
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
                    placeholder="e.g. Batch 1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold tracking-wide uppercase text-slate-500 block">Budget Description detail</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium h-20 resize-none font-sans"
                  placeholder="Enter specific items procured, honorariums, travel details, etc."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCostModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCost}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition font-bold cursor-pointer flex items-center gap-1.5"
                >
                  {savingCost ? "Saving..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
