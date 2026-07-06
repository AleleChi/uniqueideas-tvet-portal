/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Users, CameraOff, Sparkles, Clock, Compass, Grid, Download, Eye, ChevronRight } from "lucide-react";
import { Beneficiary, ProgramStatus } from "../types";

interface DashboardProps {
  beneficiaries: Beneficiary[];
  onSelectBeneficiary: (id: string) => void;
  onNavigateToRegistryCreate: () => void;
  session?: any;
}

export function Dashboard({ beneficiaries, onSelectBeneficiary, onNavigateToRegistryCreate, session }: DashboardProps) {
  const [timeframe, setTimeframe] = useState("Last 6 Months");

  const isTspUser = ["TSP", "TSP_ADMIN", "TSP_TRAINING_MANAGER", "TSP_REVIEW_OFFICER", "ADMIN_OFFICER", "REVIEW_OFFICER"].includes(session?.role || "") || (session?.role && session?.role.startsWith("TSP"));
  const title = isTspUser ? "Training Center Workspace" : "Governance Dashboard";
  const subtitle = isTspUser 
    ? "Accredited operator command center and local trainees metrics." 
    : "Consolidated national reach metrics and audit trackers.";

  // Dynamic calculations from database
  const totalCount = beneficiaries.length;
  const verifiedCount = beneficiaries.filter(b => b.status === ProgramStatus.VERIFIED || b.status === ProgramStatus.ENROLLED).length;
  const pendingCount = beneficiaries.filter(b => b.status !== ProgramStatus.VERIFIED && b.status !== ProgramStatus.ENROLLED).length;
  
  // 6 Core Status counters
  const draftCount = beneficiaries.filter(b => b.status === ProgramStatus.DRAFT).length;
  const underReviewCount = beneficiaries.filter(b => b.status === ProgramStatus.UNDER_REVIEW || b.status === ProgramStatus.PENDING_PHOTO).length;
  const enrolledCount = beneficiaries.filter(b => b.status === ProgramStatus.ENROLLED || b.status === ProgramStatus.VERIFIED).length;
  const inTrainingCount = beneficiaries.filter(b => b.status === ProgramStatus.IN_TRAINING).length;
  const graduatedCount = beneficiaries.filter(b => b.status === ProgramStatus.GRADUATED).length;
  const alumniCount = beneficiaries.filter(b => b.status === ProgramStatus.ALUMNI).length;
  
  const maleCount = beneficiaries.filter(b => b.gender === "MALE").length;
  const femaleCount = beneficiaries.filter(b => b.gender === "FEMALE").length;
  const otherCount = beneficiaries.filter(b => b.gender === "OTHER").length;
  
  const malePercent = totalCount > 0 ? Math.round((maleCount / totalCount) * 100) : 0;
  const femalePercent = totalCount > 0 ? Math.round((femaleCount / totalCount) * 100) : 0;

  // 13-stage TVET Lifecycle counters
  const stagesList = [
    "Draft",
    "Admission Generated",
    "Admission Sent",
    "Offer Viewed",
    "Acceptance Pending",
    "Acceptance Uploaded",
    "Under Review",
    "Accepted",
    "Enrolled",
    "Training In Progress",
    "Training Completed",
    "Certified",
    "Alumni"
  ];

  const stageCounts = stagesList.reduce((acc, stage) => {
    acc[stage] = beneficiaries.filter(b => {
      const bLife = b.admissionStatus || "Draft";
      return bLife.toLowerCase() === stage.toLowerCase() || 
        (stage === "Draft" && bLife === "Pending");
    }).length;
    return acc;
  }, {} as Record<string, number>);

  // Completed Batches
  const completedBatches = Array.from(new Set(beneficiaries.filter(b => b.status === ProgramStatus.VERIFIED).map(b => b.batch))).length;

  const liveActivities = beneficiaries.slice(0, 3).map(b => {
    const isVerified = b.status === ProgramStatus.VERIFIED;
    const isDraft = b.status === ProgramStatus.DRAFT;
    const isFlagged = b.status === ProgramStatus.FLAGGED;
    
    let statusText = "In Training";
    let colorClass = "bg-blue-105 bg-blue-100 text-blue-800 border-blue-200";
    let dotClass = "bg-blue-500";
    
    if (isVerified) {
      statusText = "Verified";
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
      dotClass = "bg-emerald-500";
    } else if (isFlagged) {
      statusText = "Flagged Check";
      colorClass = "bg-rose-100 text-rose-800 border-rose-200";
      dotClass = "bg-rose-500";
    } else if (isDraft) {
      statusText = "Pending Capture";
      colorClass = "bg-amber-100 text-amber-805 text-amber-800 border-amber-200";
      dotClass = "bg-amber-500";
    }

    return {
      name: `${b.firstName} ${b.lastName}`,
      id: b.id,
      sector: b.skillSector || "Computer Repairs",
      location: b.state || "Imo",
      status: statusText,
      color: colorClass,
      dot: dotClass,
      time: b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "numeric" }) : "Recently"
    };
  });

  return (
    <div className="space-y-6 select-none font-sans max-w-7xl mx-auto">
      
      {/* Dashboard Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-display">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <button
          onClick={onNavigateToRegistryCreate}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg shadow-xs text-xs transition active:scale-[98%] cursor-pointer gap-2"
        >
          <span className="text-sm font-bold">+</span> New Beneficiary
        </button>
      </div>
      
      {/* STATS BENTO ROW (1.png) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* STAT CARD 1: TOTAL REGISTERED */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-indigo-600 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
              TOTAL REGISTERED
            </span>
            <span className="font-display font-bold text-3xl text-slate-900 tracking-tight block">
              {totalCount.toLocaleString()}
            </span>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="font-bold">↑ Actual</span>
              <span className="text-slate-400 font-normal">Real-time database</span>
            </p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* STAT CARD 2: PENDING PHOTOS */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-rose-500 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
              PENDING PHOTOS
            </span>
            <span className="font-display font-bold text-3xl text-slate-900 tracking-tight block">
              {pendingCount.toLocaleString()}
            </span>
            <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 font-mono uppercase">
              ● Requires action
            </p>
          </div>
          <div className="h-12 w-12 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-500 shadow-xs">
            <CameraOff className="w-5 h-5" />
          </div>
        </div>

        {/* STAT CARD 3: BATCHES COMPLETED */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-yellow-500 flex items-center justify-between">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
              BATCHES WITH VERIFIED
            </span>
            <span className="font-display font-bold text-3xl text-slate-900 tracking-tight block">
              {completedBatches}
            </span>
            
            {/* Progress bar matching 1.png */}
            <div className="space-y-1 max-w-[140px]">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-yellow-500 h-full rounded-full" style={{ width: completedBatches > 0 ? "100%" : "0%" }}></div>
              </div>
              <p className="text-[9px] text-slate-400">Database Tracks</p>
            </div>
          </div>
          
          <div className="h-12 w-12 bg-yellow-55 bg-yellow-50 border border-yellow-100 rounded-xl flex items-center justify-center text-yellow-600 shadow-xs flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* STAT CARD 4: RECENT ACTIVITY */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
              SYSTEM PORTAL STATUS
            </span>
            <span className="font-display font-bold text-xl text-slate-900 tracking-tight block uppercase text-emerald-600 font-mono">
              {totalCount > 0 ? "ACTIVE" : "ONLINE"}
            </span>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-550 text-emerald-500 animate-pulse" />
              <span>Synced with Imo Owerri Hub</span>
            </p>
          </div>
          <div className="h-12 w-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* RECHART / METRICS SPLIT SCREEN GRAPH DISTRIBUTION (1.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SKILL SECTOR PROGRESS (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-slate-100">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm tracking-wide uppercase">
                  Skill Sector Progress
                </h3>
                <p className="text-[11px] text-slate-400">
                  Active training distribution across key sectors
                </p>
              </div>

              {/* Minimal selector mockup */}
              <div className="relative">
                <select 
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="All Time">All Time</option>
                </select>
              </div>
            </div>

            {/* List Progress items matching 1.png */}
            <div className="space-y-5">
              
              {/* Item 1 */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="text-slate-800">Computer Hardware and Cell Phone Repairs</span>
                  <span className="font-mono text-slate-500">{totalCount > 0 ? "100%" : "0%"}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-950 h-full rounded-full" style={{ width: totalCount > 0 ? "100%" : "0%" }}></div>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom overview footer metric row (1.png) */}
          <div className="mt-8 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase uppercase tracking-wide">AVERAGE COMPLETION</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">72.4%</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase uppercase tracking-wide">TARGET ACHIEVEMENT</p>
              <p className="text-lg font-bold text-slate-950 mt-0.5 text-blue-600">+14%</p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: GENDER DISTRIBUTION (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 mb-6 border-b border-slate-100">
              <h3 className="font-display font-bold text-slate-900 text-sm tracking-wide uppercase">
                Gender Distribution
              </h3>
              <p className="text-[11px] text-slate-400">
                Beneficiary demographics overview
              </p>
            </div>

            {/* Custom SVG Donut Chart showing actual totals */}
            <div className="relative flex justify-center items-center py-6">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle 
                  cx="72" 
                  cy="72" 
                  r="56" 
                  stroke="#f1f5f9" 
                  strokeWidth="10" 
                  fill="transparent" 
                />
                
                {/* Male Circle */}
                <circle 
                  cx="72" 
                  cy="72" 
                  r="56" 
                  stroke="#1e1b4b" // Deep Navy/Blue
                  strokeWidth="10" 
                  fill="transparent" 
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - (totalCount > 0 ? malePercent / 100 : 0.5))}`}
                  strokeLinecap="round"
                />

                {/* Female Circle */}
                <circle 
                  cx="72" 
                  cy="72" 
                  r="56" 
                  stroke="#fbbf24" // gold-500
                  strokeWidth="10" 
                  fill="transparent" 
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - (totalCount > 0 ? femalePercent / 100 : 0.5))}`}
                  transform="rotate(234 72 72)"
                  strokeLinecap="round"
                />
              </svg>

              {/* Inner Circle metrics block */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-base font-semibold text-slate-500 tracking-wider font-mono text-[10px]">
                  TOTAL
                </span>
                <span className="text-2xl font-bold text-slate-900 font-display">
                  {totalCount}
                </span>
              </div>
            </div>

            {/* Labels and legends */}
            <div className="space-y-3 mt-4 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-indigo-950 inline-block"></span>
                  <span className="text-slate-600 font-medium">Male Candidates</span>
                </div>
                <span className="font-bold text-slate-800">{totalCount > 0 ? `${malePercent}%` : "0%"}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-yellow-500 inline-block"></span>
                  <span className="text-slate-600 font-medium">Female Candidates</span>
                </div>
                <span className="font-bold text-slate-800">{totalCount > 0 ? `${femalePercent}%` : "0%"}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => alert("Redirecting to comprehensive Gender Equalization Audits report.")}
            className="w-full mt-6 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-950 font-bold text-xs py-2 px-4 rounded-lg shadow-xs transition"
          >
            View Detailed Demographics
          </button>

        </div>

      </div>

      {/* 6-STATUS CANDIDATE LIFECYCLE LEVEL COUNTERS */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-display font-semibold text-slate-800 text-xs tracking-wider uppercase">
            Expanded Beneficiary Lifecycle Statuses
          </h3>
          <p className="text-[11px] text-slate-400">
            Real-time counts for each of the six core system status states of the beneficiary training cycle
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Draft", count: draftCount, color: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400" },
            { label: "Under Review", count: underReviewCount, color: "border-orange-200 bg-orange-50/50 text-orange-700", dot: "bg-orange-500" },
            { label: "Enrolled", count: enrolledCount, color: "border-blue-200 bg-blue-50/50 text-blue-700", dot: "bg-blue-500 animate-pulse" },
            { label: "In Training", count: inTrainingCount, color: "border-purple-200 bg-purple-50/50 text-purple-700", dot: "bg-purple-500 animate-pulse" },
            { label: "Graduated", count: graduatedCount, color: "border-emerald-200 bg-emerald-50/30 text-emerald-700", dot: "bg-emerald-500" },
            { label: "Alumni", count: alumniCount, color: "border-teal-200 bg-teal-50/30 text-teal-700", dot: "bg-teal-500" }
          ].map((st, idx) => (
            <div key={idx} className={`p-4 rounded-xl border text-center relative overflow-hidden transition hover:shadow-xs ${st.color}`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`}></span>
                <span className="text-[10px] font-bold uppercase tracking-wider block font-sans">{st.label}</span>
              </div>
              <span className="font-display font-bold text-2xl tracking-tight block mt-1">
                {st.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 13-STAGE TVET LIFECYCLE REGISTRY PIPELINE (Act as Senior Product Architect Specialty) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h3 className="font-display font-medium text-slate-900 text-sm tracking-wide uppercase">
            13-Stage TVET Lifecycle Registry Pipeline
          </h3>
          <p className="text-[11px] text-slate-400">
            Real-time administrative allocation monitoring of candidate transactions across the full training lifecycle
          </p>
        </div>

        {/* Horizontal Pipeline flow visually matched */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
          {stagesList.map((st, idx) => {
            const count = stageCounts[st] || 0;
            const isFilled = count > 0;
            return (
              <div key={idx} className="flex-shrink-0 flex items-center gap-2">
                <div className={`p-2.5 rounded-lg border transition-all text-center flex flex-col items-center justify-center min-w-[105px] ${
                  isFilled 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-950 font-bold scale-102" 
                    : "bg-slate-50 border-slate-200/60 text-slate-405 text-slate-400"
                }`}>
                  <span className="text-[10px] font-mono block opacity-60 leading-none mb-1">ST-{idx+1}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-tight block whitespace-nowrap">{st.replace("Training ", "").replace("Acceptance ", "")}</span>
                  <span className={`text-[13px] font-mono mt-0.5 block ${isFilled ? "text-indigo-600 font-extrabold" : "text-slate-400"}`}>{count}</span>
                </div>
                {idx !== stagesList.length - 1 && (
                  <span className="text-slate-300 font-mono text-xs">→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM AREA: RECENT ACTIVITY LOGS WORKSHEET (1.png) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        
        {/* Table header strip */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wide">
              Recent Activity Logs
            </h3>
            <p className="text-[11px] text-slate-400">
              System transaction monitor for active enrollments
            </p>
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => alert("Filters dialog opened")}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold"
            >
              Filter
            </button>
            <button 
              onClick={() => alert("Exported active system transaction subset CSV file")}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Database table view */}
        <div className="overflow-x-auto">
          {liveActivities.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-sans">
              No recent beneficiary registration activities logged in database.
            </div>
          ) : (
            <table className="min-w-[750px] lg:min-w-0 w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-100">
                  <th className="py-3 px-6">Beneficiary Name</th>
                  <th className="py-3 px-6">Sector</th>
                  <th className="py-3 px-6">Location</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Last Modified</th>
                  <th className="py-3 px-6 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono">
                {liveActivities.map((act, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-6">
                      <div className="font-sans font-semibold text-slate-800 text-[13px]">{act.name}</div>
                      <div className="text-[10px] text-slate-400">{act.id}</div>
                    </td>
                    <td className="py-3 px-6 text-slate-600 font-sans">{act.sector}</td>
                    <td className="py-3 px-6 text-slate-600 font-sans">{act.location}</td>
                    <td className="py-3 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${act.color} inline-flex items-center gap-1`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${act.dot}`}></span>
                        {act.status}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-slate-400 text-[11px]">{act.time}</td>
                    <td className="py-3 px-6 text-right">
                      <button 
                        onClick={() => onSelectBeneficiary(act.id)}
                        className="p-1 text-slate-400 hover:text-indigo-600 inline-block"
                        title="View Profile Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Custom table pagination strip matching design */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Showing {liveActivities.length} of {totalCount} recent activities</span>
          
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[10px] hover:bg-slate-50 select-none">Previous</button>
            <button className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[10px] hover:bg-slate-50 select-none">Next</button>
          </div>
        </div>

      </div>

    </div>
  );
}
