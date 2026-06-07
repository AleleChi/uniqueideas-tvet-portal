/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  ShieldCheck, ShieldAlert, Shield, ShieldQuestion, Search, Filter, 
  ArrowRight, CheckCircle2, AlertCircle, X, HelpCircle, Calendar, 
  User, Mail, Phone, MapPin, CreditCard, ChevronRight, UserCheck, 
  FileText, CornerDownRight, History, Trash2, Edit2, RotateCcw,
  LayoutDashboard, ChevronUp, ChevronDown, BarChart3, Wrench, Send,
  Check, Download, Users, Info, Building, Database, Award, Zap,
  Sparkles, AlertTriangle, FileSpreadsheet, Activity, ChevronLeft,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from "recharts";
import { Beneficiary, UserSession } from "../types";
import { authFetch } from "../utils/authFetch";
import { useNotification } from "./NotificationContext";

interface EligibilityCenterProps {
  beneficiaries: Beneficiary[];
  session: UserSession | null;
  onRefresh: () => void;
}

export function EligibilityCenter({ beneficiaries, session, onRefresh }: EligibilityCenterProps) {
  const { showToast } = useNotification();
  
  // Workspace Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState("all");
  const [eligibilityFilter, setEligibilityFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [tspFilter, setTspFilter] = useState("all");
  
  // Dedicated compliance gap filter
  // "all" | "missing_dob" | "missing_nin" | "missing_bvn" | "missing_guardian" | "missing_bank" | "missing_address" | "missing_gender" | "missing_skill"
  const [activeGapFilter, setActiveGapFilter] = useState<string>("all");

  // Selection states for drawer and modals
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Bulk Override states
  const [isBulkOverrideOpen, setIsBulkOverrideOpen] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkOverrideReason, setBulkOverrideReason] = useState("");
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // Selected beneficiary detail cache
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);

  useEffect(() => {
    if (selectedBeneficiaryId) {
      const match = beneficiaries.find(b => b.id === selectedBeneficiaryId);
      if (match) setSelectedBeneficiary(match);
    } else {
      setSelectedBeneficiary(null);
    }
  }, [selectedBeneficiaryId, beneficiaries]);

  const handleOpenDetails = (id: string) => {
    setSelectedBeneficiaryId(id);
    setIsDrawerOpen(true);
  };

  const handleOpenOverrideModal = () => {
    setOverrideReason("");
    setIsOverrideModalOpen(true);
  };

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Compute beneficiary compliance scoring and details check
  const getBeneficiaryCompliance = (b: Beneficiary) => {
    const checks = {
      dob: !!b.dateOfBirth,
      nin: !!b.nin,
      bvn: !!b.bvn,
      guardian: !!(b.guardianName || b.guardianPhone),
      bank: !!(b.bankName || b.bankAccountNumber),
      address: !!(b.residentialAddress || b.city || b.state),
      gender: !!b.gender,
      skill: !!b.skillSector,
    };
    const keys = Object.keys(checks);
    const present = keys.filter(k => checks[k as keyof typeof checks]).length;
    const percentage = Math.round((present / keys.length) * 100);
    const missing = [];
    if (!checks.dob) missing.push("DOB");
    if (!checks.nin) missing.push("NIN");
    if (!checks.bvn) missing.push("BVN");
    if (!checks.guardian) missing.push("Guardian");
    if (!checks.bank) missing.push("Bank Details");
    if (!checks.address) missing.push("Address");
    if (!checks.gender) missing.push("Gender");
    if (!checks.skill) missing.push("Skill Assigned");
    
    return { percentage, missing, checks };
  };

  // Quick list calculations for stats
  const totalEvaluated = beneficiaries.length;
  const eligibleTrainees = beneficiaries.filter(b => b.eligibilityStatus === "ELIGIBLE");
  const overAgeTrainees = beneficiaries.filter(b => b.eligibilityStatus === "OVER_AGE");
  const overriddenTrainees = beneficiaries.filter(b => b.eligibilityStatus === "OVERRIDDEN");
  const unknownDobTrainees = beneficiaries.filter(b => b.eligibilityStatus === "UNKNOWN_DOB");
  
  const maleTotal = beneficiaries.filter(b => b.gender === "MALE").length;
  const femaleTotal = beneficiaries.filter(b => b.gender === "FEMALE").length;

  const eligibilityRate = totalEvaluated > 0 
    ? Math.round(((eligibleTrainees.length + overriddenTrainees.length) / totalEvaluated) * 100) 
    : 0;

  const averageComplianceScore = useMemo(() => {
    if (totalEvaluated === 0) return 0;
    const sum = beneficiaries.reduce((acc, b) => acc + getBeneficiaryCompliance(b).percentage, 0);
    return Math.round(sum / totalEvaluated);
  }, [beneficiaries, totalEvaluated]);

  // Compute stats of missing categories dynamically
  const missingStats = useMemo(() => {
    return {
      dob: beneficiaries.filter(b => !b.dateOfBirth).length,
      nin: beneficiaries.filter(b => !b.nin).length,
      bvn: beneficiaries.filter(b => !b.bvn).length,
      guardian: beneficiaries.filter(b => !(b.guardianName || b.guardianPhone)).length,
      bank: beneficiaries.filter(b => !(b.bankName || b.bankAccountNumber)).length,
      address: beneficiaries.filter(b => !(b.residentialAddress || b.city || b.state)).length,
      gender: beneficiaries.filter(b => !b.gender).length,
      skill: beneficiaries.filter(b => !b.skillSector).length,
    };
  }, [beneficiaries]);

  // Handle Singular Override submissions
  const handleApplyOverride = async () => {
    if (!selectedBeneficiary) return;
    if (!overrideReason.trim()) {
      showToast("Please provide a valid bypass justification.", "error");
      return;
    }

    setIsSubmittingOverride(true);
    try {
      const res = await authFetch("/api/eligibility/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: selectedBeneficiary.id,
          reason: overrideReason
        })
      });

      if (res.ok) {
        showToast(`Eligibility override applied successfully for ${selectedBeneficiary.firstName}`, "success");
        setIsOverrideModalOpen(false);
        setIsDrawerOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to submit eligibility override", "error");
      }
    } catch (e: any) {
      showToast("Network error executing override authorized action.", "error");
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Revoke override
  const handleRevokeOverride = async () => {
    if (!selectedBeneficiary) return;
    if (!window.confirm(`Are you sure you want to revoke the eligibility override for ${selectedBeneficiary.firstName}?`)) {
      return;
    }

    try {
      const res = await authFetch("/api/eligibility/remove-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: selectedBeneficiary.id,
          reason: "Manual revocation of compliance override"
        })
      });

      if (res.ok) {
        showToast(`Override status revoked for ${selectedBeneficiary.firstName}`, "success");
        setIsDrawerOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to revoke override", "error");
      }
    } catch (e: any) {
      showToast("Network error executing override revocation action.", "error");
    }
  };

  // Bulk overrides submission
  const handleBulkOverride = async () => {
    if (selectedBulkIds.length === 0) {
      showToast("Please select at least one candidate for compliance override.", "error");
      return;
    }
    if (!bulkOverrideReason.trim()) {
      showToast("Please provide a bulk authorization note.", "error");
      return;
    }

    setIsBulkSubmitting(true);
    setBulkProgress(0);
    
    let succeeded = 0;
    try {
      for (let i = 0; i < selectedBulkIds.length; i++) {
        const id = selectedBulkIds[i];
        try {
          const res = await authFetch("/api/eligibility/override", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              beneficiaryId: id,
              reason: `[BULK OVERRIDE] ${bulkOverrideReason}`
            })
          });
          if (res.ok) succeeded++;
        } catch (err) {
          // silent bypass row fail
        }
        setBulkProgress(Math.round(((i + 1) / selectedBulkIds.length) * 100));
      }

      showToast(`Bulk processing complete. Overrode ${succeeded} trainees successfully.`, "success");
      setIsBulkOverrideOpen(false);
      setSelectedBulkIds([]);
      setBulkOverrideReason("");
      onRefresh();
    } catch (e) {
      showToast("Error processing bulk compliance actions.", "error");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Helper selector for Age bracket
  const getAgeGroupLabelOf = (age: number | null | undefined): string => {
    if (age === null || age === undefined) return "Unknown";
    if (age < 18) return "Under 18";
    if (age <= 25) return "18 - 25";
    if (age <= 30) return "26 - 30";
    if (age <= 35) return "31 - 35";
    return "Over 35";
  };

  const ageGroups = ["Under 18", "18 - 25", "26 - 30", "31 - 35", "Over 35", "Unknown"];
  const ageGroupCounts = useMemo(() => {
    const counts = ageGroups.reduce((acc, cur) => { acc[cur] = 0; return acc; }, {} as Record<string, number>);
    beneficiaries.forEach(b => {
      const g = getAgeGroupLabelOf(b.age);
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [beneficiaries]);

  // Unique list of States and TSPs for filters
  const statesList = useMemo(() => {
    const s = new Set<string>();
    beneficiaries.forEach(b => { if (b.state) s.add(b.state); });
    return Array.from(s).sort();
  }, [beneficiaries]);

  const tspsList = useMemo(() => {
    const t = new Set<string>();
    beneficiaries.forEach(b => { if (b.tsp) t.add(b.tsp); });
    return Array.from(t).sort();
  }, [beneficiaries]);

  // Filters logic
  const filteredBeneficiaries = useMemo(() => {
    return beneficiaries.filter(b => {
      const nameMatch = `${b.firstName} ${b.lastName} ${b.otherName || ""}`.toLowerCase();
      const matchesSearch = searchTerm.trim() === "" || 
        nameMatch.includes(searchTerm.toLowerCase()) ||
        b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.tsp && b.tsp.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.nin && b.nin.includes(searchTerm));

      const matchesGender = genderFilter === "all" || b.gender === genderFilter.toUpperCase();
      
      let matchesAgeGroup = true;
      if (ageGroupFilter !== "all") {
        matchesAgeGroup = getAgeGroupLabelOf(b.age) === ageGroupFilter;
      }

      const matchesEligibility = eligibilityFilter === "all" || b.eligibilityStatus === eligibilityFilter.toUpperCase();
      const matchesState = stateFilter === "all" || b.state === stateFilter;
      const matchesTsp = tspFilter === "all" || b.tsp === tspFilter;

      // Active Gaps logic
      let matchesGap = true;
      if (activeGapFilter !== "all") {
        if (activeGapFilter === "missing_dob") matchesGap = !b.dateOfBirth;
        else if (activeGapFilter === "missing_nin") matchesGap = !b.nin;
        else if (activeGapFilter === "missing_bvn") matchesGap = !b.bvn;
        else if (activeGapFilter === "missing_guardian") matchesGap = !(b.guardianName || b.guardianPhone);
        else if (activeGapFilter === "missing_bank") matchesGap = !(b.bankName || b.bankAccountNumber);
        else if (activeGapFilter === "missing_address") matchesGap = !(b.residentialAddress || b.city || b.state);
        else if (activeGapFilter === "missing_gender") matchesGap = !b.gender;
        else if (activeGapFilter === "missing_skill") matchesGap = !b.skillSector;
      }

      return matchesSearch && matchesGender && matchesAgeGroup && matchesEligibility && matchesState && matchesTsp && matchesGap;
    });
  }, [beneficiaries, searchTerm, genderFilter, ageGroupFilter, eligibilityFilter, stateFilter, tspFilter, activeGapFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genderFilter, ageGroupFilter, eligibilityFilter, stateFilter, tspFilter, activeGapFilter]);

  // Paginated elements
  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiaries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBeneficiaries.slice(start, start + itemsPerPage);
  }, [filteredBeneficiaries, currentPage]);

  // CSV Exporter helper
  const exportToCSV = (data: any[], filename: string) => {
    const headers = ["Candidate ID", "Full Name", "Gender", "Birthdate", "Age", "State", "City", "NIN", "BVN", "TSP Center", "Skill Track", "Compliance Completion", "Eligibility Status"];
    const rows = data.map(b => {
      const comp = getBeneficiaryCompliance(b);
      return [
        b.id,
        `${b.firstName} ${b.lastName} ${b.otherName || ""}`.trim(),
        b.gender || "N/A",
        b.dateOfBirth || "N/A",
        b.age !== null && b.age !== undefined ? b.age : "Unknown",
        b.state || "N/A",
        b.city || "N/A",
        b.nin ? `'${b.nin}` : "N/A",
        b.bvn ? `'${b.bvn}` : "N/A",
        b.tsp || "N/A",
        b.skillSector || "N/A",
        `${comp.percentage}%`,
        b.eligibilityStatus || "N/A"
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportEligible = () => {
    const list = beneficiaries.filter(b => b.eligibilityStatus === "ELIGIBLE");
    exportToCSV(list, "ideas_tvet_eligible_candidates.csv");
    showToast(`Exported ${list.length} eligible candidates`, "success");
  };

  const handleExportOverAge = () => {
    const list = beneficiaries.filter(b => b.eligibilityStatus === "OVER_AGE");
    exportToCSV(list, "ideas_tvet_over_age_candidates.csv");
    showToast(`Exported ${list.length} over-age candidates`, "success");
  };

  const handleExportFullReport = () => {
    exportToCSV(filteredBeneficiaries, "ideas_tvet_compliance_report.csv");
    showToast(`Exported full list compliance report of ${filteredBeneficiaries.length} entries`, "success");
  };

  // Recharts Chart Formatted Data
  const ageChartData = ageGroups.map(group => ({
    name: group,
    value: ageGroupCounts[group] || 0
  }));

  const eligibilityChartData = [
    { name: "Eligible", value: eligibleTrainees.length, color: "#10b981" },
    { name: "Over Age", value: overAgeTrainees.length, color: "#f43f5e" },
    { name: "Overridden", value: overriddenTrainees.length, color: "#3b82f6" },
    { name: "Unknown DOB", value: unknownDobTrainees.length, color: "#f59e0b" }
  ].filter(c => c.value > 0);

  const stateChartData = useMemo(() => {
    const counts: Record<string, { total: number, eligible: number }> = {};
    beneficiaries.forEach(b => {
      const state = b.state || "Unassigned";
      if (!counts[state]) counts[state] = { total: 0, eligible: 0 };
      counts[state].total += 1;
      if (b.eligibilityStatus === "ELIGIBLE" || b.eligibilityStatus === "OVERRIDDEN") {
        counts[state].eligible += 1;
      }
    });
    return Object.keys(counts).map(st => ({
      name: st.replace(" State", ""),
      total: counts[st].total,
      eligible: counts[st].eligible,
      rate: counts[st].total > 0 ? Math.round((counts[st].eligible / counts[st].total) * 100) : 0
    })).sort((a, b) => b.eligible - a.eligible).slice(0, 5);
  }, [beneficiaries]);

  return (
    <div className="space-y-6 text-slate-800 font-sans pb-12">
      
      {/* SECTION 1: Eligibility Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="text-left space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider text-indigo-600 uppercase inline-flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-505 bg-emerald-500"></span>
              </span>
              Compliance Governance Center
            </div>
            
            <div className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold font-mono text-slate-600">
              Maximum Age: <span className="text-indigo-600 font-extrabold">35 Years</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
              <ShieldCheck className="w-8 h-8 text-indigo-600 shrink-0" />
              Eligibility & Compliance Center
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Monitor trainee eligibility, age compliance, exceptions, and governance controls.
            </p>
          </div>
        </div>

        {/* Header CTA action board */}
        <div className="flex flex-wrap items-center gap-2.5 no-print shrink-0">
          <button
            onClick={handleExportFullReport}
            className="px-4 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2 cursor-pointer h-12 shadow-sm transition-all duration-150"
            title="Download CSV database for matching records"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
            Export Report
          </button>
          
          <button
            onClick={handleExportEligible}
            className="px-4 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50/50 border border-emerald-250 border-emerald-200 text-emerald-700 flex items-center gap-2 cursor-pointer h-12 shadow-sm transition-all duration-150"
          >
            <Check className="w-4.5 h-4.5 text-emerald-500" />
            Export Eligible
          </button>

          <button
            onClick={handleExportOverAge}
            className="px-4 rounded-xl text-xs font-bold bg-white hover:bg-rose-50/50 border border-rose-250 border-rose-200 text-rose-700 flex items-center gap-2 cursor-pointer h-12 shadow-sm transition-all duration-150"
          >
            <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
            Export Over-Age
          </button>

          {session?.role === "SUPER_ADMIN" && (
            <button
              onClick={() => {
                const overAgeCount = beneficiaries.filter(b => b.eligibilityStatus === "OVER_AGE").length;
                if (overAgeCount === 0) {
                  showToast("No active over-age candidates found waiting for administrative overrides.", "info");
                  return;
                }
                setSelectedBulkIds([]);
                setBulkOverrideReason("");
                setIsBulkOverrideOpen(true);
              }}
              className="px-5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 cursor-pointer h-12 shadow-sm hover:shadow transition-all duration-150"
            >
              <Zap className="w-4.5 h-4.5 text-indigo-100" />
              Bulk Override ({beneficiaries.filter(b => b.eligibilityStatus === "OVER_AGE").length})
            </button>
          )}
        </div>
      </div>

      {/* SECTION 2: Executive KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 my-2">
        
        {/* KPI 1: Eligible Candidates */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left">
          <div className="p-2 w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold font-mono text-slate-900 leading-none">{eligibleTrainees.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Eligible Candidates</div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none flex items-center justify-between">
            <span>{totalEvaluated > 0 ? Math.round((eligibleTrainees.length / totalEvaluated) * 100) : 0}% ratio</span>
            <span className="text-emerald-600 font-bold font-sans uppercase text-[8px]">Active</span>
          </span>
        </div>

        {/* KPI 2: Over age Candidates */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left">
          <div className="p-2 w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold font-mono text-slate-900 leading-none">{overAgeTrainees.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Over-Age Candidates</div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none flex items-center justify-between">
            <span>{totalEvaluated > 0 ? Math.round((overAgeTrainees.length / totalEvaluated) * 100) : 0}% ratio</span>
            <span className="text-rose-600 font-bold font-sans uppercase text-[8px]">Exceeded</span>
          </span>
        </div>

        {/* KPI 3: Overridden cases */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left">
          <div className="p-2 w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold font-mono text-slate-900 leading-none">{overriddenTrainees.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Override Cases</div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none flex items-center justify-between">
            <span>{totalEvaluated > 0 ? Math.round((overriddenTrainees.length / totalEvaluated) * 100) : 0}% ratio</span>
            <span className="text-indigo-600 font-bold font-sans uppercase text-[8px]">Bypassed</span>
          </span>
        </div>

        {/* KPI 4: Unknown DOB */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left">
          <div className="p-2 w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldQuestion className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold font-mono text-slate-900 leading-none">{unknownDobTrainees.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Unknown DOB</div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none flex items-center justify-between">
            <span>{totalEvaluated > 0 ? Math.round((unknownDobTrainees.length / totalEvaluated) * 100) : 0}% ratio</span>
            <span className="text-amber-600 font-bold font-sans uppercase text-[8px]">Gaps</span>
          </span>
        </div>

        {/* KPI 5: Male statistics */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left">
          <div className="p-2 w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
            <User className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold font-mono text-slate-900 leading-none">{maleTotal}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Male Cohort</div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none flex items-center justify-between">
            <span>{totalEvaluated > 0 ? Math.round((maleTotal / totalEvaluated) * 100) : 0}% ratio</span>
            <span className="text-slate-500 font-bold font-sans uppercase text-[8px]">Enrolled</span>
          </span>
        </div>

        {/* KPI 6: Female statistics */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left">
          <div className="p-2 w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
            <User className="w-5 h-5 shrink-0 text-slate-500" />
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold font-mono text-slate-900 leading-none">{femaleTotal}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Female Cohort</div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none flex items-center justify-between">
            <span>{totalEvaluated > 0 ? Math.round((femaleTotal / totalEvaluated) * 100) : 0}% ratio</span>
            <span className="text-slate-500 font-bold font-sans uppercase text-[8px]">Enrolled</span>
          </span>
        </div>

        {/* KPI 7: Eligibility Rate */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.02] select-none pointer-events-none group-hover:scale-110 transition duration-300">
            <Award className="w-16 h-16 text-indigo-600" />
          </div>
          <div className="p-2 w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-1.5 grow flex flex-col justify-center">
            <div className="text-3xl font-black font-mono text-indigo-600 leading-none">{eligibilityRate}%</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Eligibility Rate</div>
            <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${eligibilityRate}%` }} />
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block">Passing compliance</span>
        </div>

        {/* KPI 8: Compliance Score */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between text-left relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.02] select-none pointer-events-none group-hover:scale-110 transition duration-300">
            <Database className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="p-2 w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-5 h-5 shrink-0" />
          </div>
          <div className="my-1.5 grow flex flex-col justify-center">
            <div className="text-3xl font-black font-mono text-emerald-600 leading-none">{averageComplianceScore}%</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Compliance Score</div>
            <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${averageComplianceScore}%` }} />
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block">Profile completeness</span>
        </div>

      </div>

      {/* SECTION 3: Eligibility Distribution Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Chart 1: Age distribution bar */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 text-left relative shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-1 border-b border-slate-100">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-extrabold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Trainee Age Distribution
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Ages 15-45 inclusive</span>
          </div>

          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" opacity={1} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                  labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                  itemStyle={{ color: "#4f46e5" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {ageChartData.map((entry, index) => {
                    let color = "#6366f1"; // indigo
                    if (entry.name === "Over 35") color = "#f43f5e"; // rose
                    if (entry.name === "Unknown") color = "#eab308"; // amber
                    if (entry.name === "Under 18") color = "#10b981"; // emerald
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Eligibility breakdown donut */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 text-left flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Eligibility Status Ratio
            </h3>
          </div>

          <div className="h-[180px] relative flex items-center justify-center">
            {eligibilityChartData.length === 0 ? (
              <span className="text-xs text-slate-400 font-mono">No data</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eligibilityChartData}
                    innerRadius={50}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {eligibilityChartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}
                    itemStyle={{ color: "#0f172a", fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {/* Center score */}
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-mono font-bold text-slate-900">{beneficiaries.filter(x => x.eligibilityStatus === "ELIGIBLE").length}</span>
              <span className="text-[9px] font-mono tracking-wider uppercase text-slate-500 font-bold">Eligible</span>
            </div>
          </div>

          {/* Miniature legends */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[9px] font-mono text-slate-500 pt-2 border-t border-slate-100">
            {eligibilityChartData.map((item, id) => (
              <div key={id} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}: <strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 3: Top Performing States */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 text-left flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-1 border-b border-slate-100">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-extrabold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              Top State Compliance
            </h3>
            <span className="text-[10px] font-mono text-indigo-600 font-bold">Registry Top 5</span>
          </div>

          {stateChartData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-xs text-slate-400 font-mono">
              No states registered
            </div>
          ) : (
            <div className="space-y-3.5 my-2">
              {stateChartData.map((st, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-mono text-slate-600 uppercase font-extrabold">{st.name} State</span>
                    <span className="text-slate-500 font-mono">
                      <span className="text-emerald-600 font-bold">{st.eligible}</span> / {st.total} · <strong className="text-slate-900">{st.rate}%</strong>
                    </span>
                  </div>
                  <div className="w-full bg-slate-50 rounded-full h-1.5 border border-slate-200/50 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${st.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[9px] font-mono text-slate-400 text-center leading-normal border-t border-slate-100 pt-2 shrink-0">
            States cataloged by validated residency checks.
          </div>
        </div>

      </div>
      {/* MID PANEL: Compliance Radar & Filters & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start text-left">
        
        {/* COMPLIANCE RADAR + QUICK ACTION PANEL (Right-side cockpit on desktop) */}
        <div className="xl:col-span-3 xl:order-last space-y-6">
          
          {/* SECTION 4: Compliance Radar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-600 font-extrabold flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                Compliance Gap Radar
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-sans leading-relaxed">
                Identify profile and biometrics gaps instantly. Click on any category block below to filter affected candidates.
              </p>
            </div>

            {/* Gap List items */}
            <div className="space-y-2">
              
              {/* DOB Gaps */}
              <button
                onClick={() => setActiveGapFilter(activeGapFilter === "missing_dob" ? "all" : "missing_dob")}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${activeGapFilter === "missing_dob" ? "bg-amber-50 border-amber-300 shadow-sm" : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70"}`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-amber-500" />
                    Missing DOB
                  </div>
                  <span className="text-[9px] font-mono font-bold text-rose-600 uppercase tracking-wide">Critical severity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-amber-600">{missingStats.dob}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeGapFilter === "missing_dob" ? "rotate-90 text-amber-600" : ""}`} />
                </div>
              </button>

              {/* NIN Gaps */}
              <button
                onClick={() => setActiveGapFilter(activeGapFilter === "missing_nin" ? "all" : "missing_nin")}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${activeGapFilter === "missing_nin" ? "bg-indigo-50 border-indigo-300 shadow-sm" : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70"}`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-indigo-500" />
                    Missing NIN
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 tracking-wide uppercase font-bold">High severity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-indigo-600">{missingStats.nin}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeGapFilter === "missing_nin" ? "rotate-90 text-indigo-600" : ""}`} />
                </div>
              </button>

              {/* BVN Gaps */}
              <button
                onClick={() => setActiveGapFilter(activeGapFilter === "missing_bvn" ? "all" : "missing_bvn")}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${activeGapFilter === "missing_bvn" ? "bg-indigo-50 border-indigo-300 shadow-sm" : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70"}`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-indigo-550 bg-indigo-505 bg-indigo-500" />
                    Missing BVN Code
                  </div>
                  <span className="text-[9px] font-mono text-slate-450 text-slate-500 tracking-wide uppercase font-bold">High severity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-indigo-600">{missingStats.bvn}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeGapFilter === "missing_bvn" ? "rotate-90 text-indigo-600" : ""}`} />
                </div>
              </button>

              {/* Guardian Info */}
              <button
                onClick={() => setActiveGapFilter(activeGapFilter === "missing_guardian" ? "all" : "missing_guardian")}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${activeGapFilter === "missing_guardian" ? "bg-slate-50 border-indigo-200 shadow-xs" : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70"}`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-slate-400" />
                    Missing Guardian
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">Medium severity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-slate-500 font-bold">{missingStats.guardian}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeGapFilter === "missing_guardian" ? "rotate-90 text-indigo-600" : ""}`} />
                </div>
              </button>

              {/* Bank Information */}
              <button
                onClick={() => setActiveGapFilter(activeGapFilter === "missing_bank" ? "all" : "missing_bank")}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${activeGapFilter === "missing_bank" ? "bg-indigo-50 border-indigo-300 shadow-sm" : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70"}`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-indigo-500" />
                    Missing Bank Specs
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 tracking-wide uppercase font-bold">High severity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-indigo-600">{missingStats.bank}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeGapFilter === "missing_bank" ? "rotate-90 text-indigo-600" : ""}`} />
                </div>
              </button>

              {/* Residential Address */}
              <button
                onClick={() => setActiveGapFilter(activeGapFilter === "missing_address" ? "all" : "missing_address")}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${activeGapFilter === "missing_address" ? "bg-slate-50 border-indigo-200 shadow-xs" : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70"}`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-slate-400" />
                    Missing Address
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">Medium severity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-slate-500 font-bold">{missingStats.address}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeGapFilter === "missing_address" ? "rotate-90 text-indigo-600" : ""}`} />
                </div>
              </button>

            </div>

            {activeGapFilter !== "all" && (
              <button
                onClick={() => setActiveGapFilter("all")}
                className="w-full py-1.5 text-center text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-750 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100/50 rounded-lg transition"
              >
                Clear Compliance Radar Gaps
              </button>
            )}
          </div>

          {/* QUICK ACTION PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-600 font-extrabold flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              Interactive Rail Actions
            </h3>
            
            <div className="grid grid-cols-1 gap-2 text-xs">
              
              <button
                onClick={() => { setEligibilityFilter("eligible"); setActiveGapFilter("all"); }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition text-left cursor-pointer ${eligibilityFilter === "eligible" ? "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-xs" : "bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 border-slate-200/60"}`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div className="grow">
                  <p className="font-bold leading-none text-slate-800">Eligible Only</p>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">Bypasses overrides & drafts</span>
                </div>
              </button>

              <button
                onClick={() => { setEligibilityFilter("over_age"); setActiveGapFilter("all"); }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition text-left cursor-pointer ${eligibilityFilter === "over_age" ? "bg-rose-50 border-rose-200 text-rose-800 shadow-xs" : "bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 border-slate-200/60"}`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <div className="grow">
                  <p className="font-bold leading-none text-slate-800">Over-Age Only</p>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">Filter candidates over 35</span>
                </div>
              </button>

              <button
                onClick={() => { setEligibilityFilter("overridden"); setActiveGapFilter("all"); }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition text-left cursor-pointer ${eligibilityFilter === "overridden" ? "bg-indigo-50 border-indigo-200 text-indigo-800 shadow-xs" : "bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 border-slate-200/60"}`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                <div className="grow">
                  <p className="font-bold leading-none text-slate-800">Overridden Exception list</p>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">Super Admin approved overrides</span>
                </div>
              </button>

              <button
                onClick={() => { setEligibilityFilter("all"); setActiveGapFilter("all"); setSearchTerm(""); setGenderFilter("all"); setAgeGroupFilter("all"); setStateFilter("all"); setTspFilter("all"); }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100/80 text-left bg-white border border-slate-250 hover:border-slate-300 text-slate-600 transition shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="grow">
                  <p className="font-bold leading-none text-slate-800">Reset Workplace Workspace</p>
                  <span className="text-[9px] text-slate-450 text-slate-500 font-mono mt-0.5 block">Clear all filter states</span>
                </div>
              </button>

            </div>
          </div>

        </div>

        {/* WORKBENCH & FILTER BAR SECTION */}
        <div className="xl:col-span-9 space-y-4">
          
          {/* FILTER BAR REDESIGN */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-mono uppercase tracking-widest font-black text-slate-750">
                  Refined Workspace Filters
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-550 text-slate-500">
                  Found <strong className="text-indigo-600 font-extrabold">{filteredBeneficiaries.length}</strong> candidates
                </span>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setGenderFilter("all");
                    setAgeGroupFilter("all");
                    setEligibilityFilter("all");
                    setStateFilter("all");
                    setTspFilter("all");
                    setActiveGapFilter("all");
                  }}
                  className="px-3 py-1.5 text-[10px] font-mono font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
              
              {/* Search label */}
              <div className="space-y-1.5 text-left relative">
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">Search Candidate</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input 
                    type="text"
                    placeholder="Search ID, Name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold h-9"
                  />
                </div>
              </div>

              {/* Gender label */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">Gender Cohort</label>
                <select
                  value={genderFilter}
                  onChange={e => setGenderFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer h-9"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              {/* Age label */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">Age Bracket</label>
                <select
                  value={ageGroupFilter}
                  onChange={e => setAgeGroupFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer h-9"
                >
                  <option value="all">All Ages</option>
                  {ageGroups.map(ag => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>

              {/* Status label */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">Eligibility Limits</label>
                <select
                  value={eligibilityFilter}
                  onChange={e => setEligibilityFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer h-9"
                >
                  <option value="all">All Conditions</option>
                  <option value="eligible">Eligible (Age ≤ 35)</option>
                  <option value="over_age">Over Age limit (&gt; 35)</option>
                  <option value="overridden">Super Admin Overridden</option>
                  <option value="unknown_dob">Birthdate Unknown</option>
                </select>
              </div>

              {/* State label */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">State Origin</label>
                <select
                  value={stateFilter}
                  onChange={e => setStateFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer h-9"
                >
                  <option value="all">All States</option>
                  {statesList.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* TSP label */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">TSP Assignment</label>
                <select
                  value={tspFilter}
                  onChange={e => setTspFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer h-9"
                >
                  <option value="all">All TSPs</option>
                  {tspsList.map(tsp => (
                    <option key={tsp} value={tsp}>{tsp}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Render active filter chips lists */}
            {(searchTerm || genderFilter !== "all" || ageGroupFilter !== "all" || eligibilityFilter !== "all" || stateFilter !== "all" || tspFilter !== "all" || activeGapFilter !== "all") && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-mono text-slate-450 text-slate-500 font-bold">Active Filters:</span>
                
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-205 text-[10px] text-slate-700 font-semibold shadow-xs">
                    Search: "{searchTerm}"
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-650 cursor-pointer" onClick={() => setSearchTerm("")} />
                  </span>
                )}

                {genderFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-semibold shadow-xs">
                    Gender: {genderFilter.toUpperCase()}
                    <X className="w-3 h-3 text-indigo-400 hover:text-indigo-600 cursor-pointer" onClick={() => setGenderFilter("all")} />
                  </span>
                )}

                {ageGroupFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-semibold shadow-xs">
                    Age Group: {ageGroupFilter}
                    <X className="w-3 h-3 text-indigo-400 hover:text-indigo-600 cursor-pointer" onClick={() => setAgeGroupFilter("all")} />
                  </span>
                )}

                {eligibilityFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-semibold shadow-xs">
                    Limitation: {eligibilityFilter.toUpperCase()}
                    <X className="w-3 h-3 text-indigo-400 hover:text-indigo-600 cursor-pointer" onClick={() => setEligibilityFilter("all")} />
                  </span>
                )}

                {stateFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-mono shadow-xs font-semibold">
                    State: {stateFilter}
                    <X className="w-3 h-3 text-indigo-400 hover:text-indigo-600 cursor-pointer" onClick={() => setStateFilter("all")} />
                  </span>
                )}

                {tspFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-mono shadow-xs font-semibold">
                    TSP: {tspFilter}
                    <X className="w-3 h-3 text-indigo-400 hover:text-indigo-600 cursor-pointer" onClick={() => setTspFilter("all")} />
                  </span>
                )}

                {activeGapFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] text-amber-800 font-mono shadow-xs font-semibold">
                    Gap: {activeGapFilter.replace("missing_", "No ")}
                    <X className="w-3 h-3 text-amber-500 hover:text-amber-700 cursor-pointer" onClick={() => setActiveGapFilter("all")} />
                  </span>
                )}

                <button
                  onClick={() => {
                    setSearchTerm("");
                    setGenderFilter("all");
                    setAgeGroupFilter("all");
                    setEligibilityFilter("all");
                    setStateFilter("all");
                    setTspFilter("all");
                    setActiveGapFilter("all");
                  }}
                  className="text-[10px] font-bold font-mono text-indigo-600 hover:underline hover:text-indigo-700 px-1 py-1"
                >
                  Clear All
                </button>
              </div>
            )}

          </div>

          {/* CANDIDATE COMPLIANCE WORKBENCH */}
          <div className="space-y-3">
            
            {/* Table workbench indicator bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-extrabold">Candidate Registry Workbench</span>
              <span className="text-[10px] font-mono text-slate-500">
                Displaying indexed slices <strong>{filteredBeneficiaries.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> – <strong>{Math.min(currentPage * itemsPerPage, filteredBeneficiaries.length)}</strong> of <strong>{filteredBeneficiaries.length}</strong>
              </span>
            </div>

            {/* List entries */}
            <AnimatePresence mode="popLayout">
              {paginatedBeneficiaries.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="border border-dashed border-slate-200 rounded-3xl py-16 text-center bg-slate-50/50 my-2 shadow-xs"
                >
                  <ShieldQuestion className="w-12 h-12 text-slate-400 mx-auto mb-3 stroke-[1.5]" />
                  <p className="text-sm font-bold text-slate-800 font-sans">No Trainees Match Filter Formula</p>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto font-sans leading-relaxed">
                    Adjust search values, disable active compliant filters under radar panels, or register new beneficiaries.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {paginatedBeneficiaries.map((b) => {
                    const comp = getBeneficiaryCompliance(b);
                    
                    // Elegance Progress colors
                    let scoreProgressColor = "bg-rose-500";
                    let scoreTextColor = "text-rose-700";
                    if (comp.percentage >= 100) {
                      scoreProgressColor = "bg-emerald-500";
                      scoreTextColor = "text-emerald-700";
                    } else if (comp.percentage >= 80) {
                      scoreProgressColor = "bg-indigo-500";
                      scoreTextColor = "text-indigo-700";
                    } else if (comp.percentage >= 50) {
                      scoreProgressColor = "bg-amber-500";
                      scoreTextColor = "text-amber-700";
                    }

                    // Badge Pill mappings
                    let statusPill = (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase bg-slate-100 border border-slate-200 text-slate-600 inline-flex items-center gap-1.5">
                        <ShieldQuestion className="w-3.5 h-3.5 text-slate-500" /> Unknown DOB
                      </span>
                    );

                    if (b.eligibilityStatus === "ELIGIBLE") {
                      statusPill = (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-150 inline-flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> ELIGIBLE
                        </span>
                      );
                    } else if (b.eligibilityStatus === "OVER_AGE") {
                      statusPill = (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-tight uppercase bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5 shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> OVER AGE
                        </span>
                      );
                    } else if (b.eligibilityStatus === "OVERRIDDEN") {
                      statusPill = (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-tight uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1.5 shadow-xs">
                          <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" /> OVERRIDDEN
                        </span>
                      );
                    } else if (b.eligibilityStatus === "UNKNOWN_DOB") {
                      statusPill = (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-tight uppercase bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1.5 shadow-xs">
                          <Shield className="w-3.5 h-3.5 text-amber-500" /> UNKNOWN DOB
                        </span>
                      );
                    }

                    return (
                      <motion.div
                        key={b.id}
                        layoutId={`candidate-${b.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="bg-white border border-slate-200 hover:border-indigo-200 hover:shadow shadow-sm rounded-2xl p-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition duration-150 text-left"
                      >
                        
                        {/* Profile avatar / metadata info */}
                        <div className="flex items-center gap-3.5 min-w-[240px]">
                          {b.photo ? (
                            <img 
                              src={b.photo} 
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
                              alt={`${b.firstName} profile`} 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 font-mono text-[11px] font-bold uppercase shrink-0">
                              {b.firstName[0]}{b.lastName[0]}
                            </div>
                          )}
                          <div className="text-left">
                            <h4 className="font-bold text-slate-900 hover:text-indigo-600 font-sans tracking-tight text-sm">
                              {b.firstName} {b.lastName}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400 mt-1 block flex items-center gap-1 leading-none">
                              ID: {b.id} · <span className="text-indigo-600 font-extrabold">{b.tsp || "Unique Center"}</span>
                            </span>
                          </div>
                        </div>

                        {/* Mid Row specs (Gender, Age, Location, Sector) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 text-left">
                          
                          {/* Gender field */}
                          <div className="space-y-0.5 lg:text-center">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide font-bold">Gender</span>
                            <p className="text-xs text-slate-700 font-mono font-bold">{b.gender || "MALE"}</p>
                          </div>

                          {/* Computed Age */}
                          <div className="space-y-0.5 lg:text-center">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide font-bold">Age Validation</span>
                            <p className="text-xs font-mono">
                              {b.age !== null && b.age !== undefined ? (
                                <span className={`font-bold ${b.age > 35 && !b.eligibilityOverride ? "text-rose-600" : "text-emerald-600"}`}>
                                  {b.age} Yrs
                                </span>
                              ) : (
                                <span className="text-amber-600 font-sans font-bold text-[11px]">Unset DOB</span>
                              )}
                            </p>
                          </div>

                          {/* Primary State */}
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide font-bold">State Origin</span>
                            <p className="text-xs text-slate-700 font-mono truncate max-w-[120px]" title={b.state}>{b.state?.replace(" State", "") || "N/A"}</p>
                          </div>

                          {/* Training Sectors */}
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide font-bold">Skill Track</span>
                            <p className="text-[11px] text-slate-700 truncate max-w-[140px] font-medium" title={b.skillSector}>{b.skillSector || "Hardware cell Repairs"}</p>
                          </div>

                        </div>

                        {/* Badges indicators (Eligibility, ComplianceScore, Actions) */}
                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-x-5 gap-y-2 lg:min-w-[340px] pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          
                          {/* Eligibility Badge */}
                          <div className="text-left lg:text-right shrink-0">
                            {statusPill}
                          </div>

                          {/* Compliance Score metrics panel */}
                          <div className="flex items-center gap-2 text-left justify-end min-w-[110px]">
                            <div className="space-y-0.5 text-right flex-1">
                              <span className="text-[9px] font-mono text-slate-400 uppercase font-black tracking-right">Completeness</span>
                              <div className="flex items-center gap-1.5 select-none leading-none">
                                <div className="w-14 bg-slate-50 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                                  <div className={`h-full rounded-full ${scoreProgressColor}`} style={{ width: `${comp.percentage}%` }} />
                                </div>
                                <span className={`text-[11px] font-mono font-bold ${scoreTextColor}`}>{comp.percentage}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Details action trigger button */}
                          <div className="shrink-0 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(b.id)}
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:text-slate-900 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer h-9 shadow-xs"
                            >
                              Explore
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </div>

                        </div>

                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs no-print">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold disabled:opacity-40 select-none cursor-pointer flex items-center gap-1 h-9 transition shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                
                <span className="font-mono text-slate-500">
                  Page <strong className="text-slate-800">{currentPage}</strong> of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-905 hover:bg-slate-50 font-bold disabled:opacity-40 select-none cursor-pointer flex items-center gap-1 h-9 transition shadow-xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>

        </div>
      <AnimatePresence>
        {isDrawerOpen && selectedBeneficiary && (
          <>
            {/* Overlay drop backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 transition-opacity"
            />

            {/* Main slide-out cabinet drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-slate-200 p-6 shadow-2xl z-50 overflow-y-auto flex flex-col justify-between font-sans text-left"
            >
              <div className="space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-widest font-black">
                      Eligibility Profile Audit
                    </span>
                    <h3 className="text-lg font-display font-black text-slate-900 mt-1">
                      {selectedBeneficiary.firstName} {selectedBeneficiary.lastName}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-800 transition cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 1. Identity Verification */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    1. Identity Verification
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-200">
                    {selectedBeneficiary.photo ? (
                      <img 
                        src={selectedBeneficiary.photo} 
                        className="w-20 h-24 rounded-lg object-cover border border-slate-200 shrink-0 shadow-sm" 
                        alt="Trainee biometric photo" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-20 h-24 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 font-mono text-[9px] gap-1 shrink-0">
                        <User className="w-5 h-5 text-slate-400" />
                        No Photo
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs flex-1">
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Candidate ID</span>
                        <p className="font-mono font-bold text-slate-800 select-all">{selectedBeneficiary.id}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Skill Sector</span>
                        <p className="font-sans font-bold text-slate-800 py-0.5">{selectedBeneficiary.skillSector || "Unassigned Track"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">National NIN</span>
                        <p className="font-mono font-bold text-indigo-650 select-all">{selectedBeneficiary.nin || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Biometric BVN</span>
                        <p className="font-mono font-bold text-indigo-650 select-all">{selectedBeneficiary.bvn || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Gender</span>
                        <p className="font-bold text-slate-800">{selectedBeneficiary.gender || "M/F"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 tracking-wider uppercase">Location residency</span>
                        <p className="font-sans font-semibold text-slate-800 truncate" title={selectedBeneficiary.state}>
                          {selectedBeneficiary.city ? `${selectedBeneficiary.city}, ` : ""}{selectedBeneficiary.state || "FCT"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Eligibility Assessment */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-500" />
                    2. Eligibility Assessment
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                    
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-450 text-slate-550 uppercase font-bold">Calculated Age</span>
                      <p className="font-mono font-black text-lg text-slate-800">
                        {selectedBeneficiary.age !== null && selectedBeneficiary.age !== undefined ? `${selectedBeneficiary.age} Years` : "Unknown"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-450 text-slate-550 uppercase font-bold">Age Boundary Limit</span>
                      <p className="font-mono font-black text-lg text-indigo-600">35 Years Maximum</p>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-100 space-y-1.5 text-left">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-black">Governance Evaluation Result</span>
                      
                      {selectedBeneficiary.eligibilityStatus === "ELIGIBLE" && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs flex gap-2 shadow-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <strong>PASSED COMPLIANCE:</strong> Trainee computed age is within federal limits. Fully eligible for funding dispatches.
                          </p>
                        </div>
                      )}

                      {selectedBeneficiary.eligibilityStatus === "OVER_AGE" && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-150 text-rose-800 text-xs flex gap-2 shadow-xs">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <strong>LIMIT OUT OF BOUNDS:</strong> Age computed exceeds maximum 35-year restriction. Locked from certificate issuances.
                          </p>
                        </div>
                      )}

                      {selectedBeneficiary.eligibilityStatus === "OVERRIDDEN" && (
                        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-150 text-indigo-900 text-xs flex flex-col gap-1.5 shadow-xs">
                          <div className="flex gap-2">
                            <ShieldAlert className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <p className="leading-snug">
                              <strong>OVERRIDE BYPASS ACTIVE:</strong> Trainee is over-aged but manually authorized by Super Administrator override logs.
                            </p>
                          </div>
                          
                          <div className="text-[10px] text-slate-500 pt-1.5 border-t border-indigo-100 space-y-1">
                            <p><strong>Approved By:</strong> <span className="text-slate-800 font-semibold select-all">{selectedBeneficiary.eligibilityOverrideBy}</span></p>
                            <p><strong>Approved At:</strong> <span className="text-slate-800 font-semibold">{selectedBeneficiary.eligibilityOverrideAt ? new Date(selectedBeneficiary.eligibilityOverrideAt).toLocaleString() : "N/A"}</span></p>
                            <p><strong>Bypass Reason:</strong> <span className="text-slate-800 font-semibold select-all">"{selectedBeneficiary.eligibilityOverrideReason || "N/A"}"</span></p>
                          </div>
                        </div>
                      )}

                      {selectedBeneficiary.eligibilityStatus === "UNKNOWN_DOB" && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-150 text-amber-800 text-xs flex gap-2 shadow-xs">
                          <ShieldQuestion className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <strong>MISSING BIRTH CREDENTIALS:</strong> No valid Birthdate registered on profile. Compliance scores cannot execute.
                          </p>
                        </div>
                      )}

                    </div>

                  </div>
                </div>

                {/* 3. Compliance Checklist */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    3. Dossier Compliance Checklist
                  </div>

                  <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 font-sans text-xs space-y-2.5">
                    
                    {/* Check DoB */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-medium">1. Valid Date of Birth (Age calculated)</span>
                      {selectedBeneficiary.dateOfBirth ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">PASSED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check NIN */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">2. National Identity Number (NIN) Validation</span>
                      {selectedBeneficiary.nin ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">VALIDATED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check BVN */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">3. Biometrics Bank Verification (BVN)</span>
                      {selectedBeneficiary.bvn ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">SYNCED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check Guardian */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">4. Legal Guardian Representative Info</span>
                      {(selectedBeneficiary.guardianName || selectedBeneficiary.guardianPhone) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">PASSED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check Bank */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">5. Registered Disbursement Bank Details</span>
                      {(selectedBeneficiary.bankName || selectedBeneficiary.bankAccountNumber) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">RECORDED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check Address */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">6. Physical Residential Address</span>
                      {(selectedBeneficiary.residentialAddress || selectedBeneficiary.city || selectedBeneficiary.state) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">VERIFIED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check Gender */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">7. Gender Cohort Profile</span>
                      {selectedBeneficiary.gender ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">PASSED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                    {/* Check Skill Sector */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-slate-700 font-medium">8. Assigned Skill Sector Core Specialty</span>
                      {selectedBeneficiary.skillSector ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold font-mono shadow-xs">ASSIGNED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-150 font-bold font-mono shadow-xs">MISSING</span>
                      )}
                    </div>

                  </div>
                </div>

              </div>

              {/* Slide Drawer footer workflow controls */}
              <div className="border-t border-slate-100 pt-5 mt-6 flex justify-end gap-2.5">
                {session?.role === "SUPER_ADMIN" ? (
                  <>
                    {selectedBeneficiary.eligibilityOverride ? (
                      <button 
                        onClick={handleRevokeOverride}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-705 hover:text-slate-900 font-display font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer h-11 shadow-xs"
                      >
                        <RotateCcw className="w-4 h-4 text-slate-500" />
                        Revoke Override
                      </button>
                    ) : (
                      <button 
                        onClick={handleOpenOverrideModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-display font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer h-11 shadow-lg shadow-indigo-600/15"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Apply Eligibility Override
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full text-center py-3 border border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-[10px] text-slate-500 font-sans italic">
                    Note: Submitting or revoking mechanical overrides requires higher authorization credentials (Super Administrator account role).
                  </div>
                )}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SUPER ADMIN OVERRIDE FLOW AUTHORIZATION MODAL */}
      <AnimatePresence>
        {isOverrideModalOpen && selectedBeneficiary && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 font-sans">
            
            {/* backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOverrideModalOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            {/* Modal Body Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 relative z-10 shadow-2xl space-y-4 text-left"
            >
              
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Authorize Eligibility Override
                </h4>
                <button 
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 bg-white border border-slate-205 rounded-xl cursor-pointer transition flex items-center justify-center min-h-[32px] min-w-[32px]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview failing candidates and current outcomes */}
              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                  {selectedBeneficiary.photo ? (
                    <img src={selectedBeneficiary.photo} className="w-10 h-11 object-cover rounded border border-slate-200 shrink-0" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-11 bg-slate-100 text-slate-500 text-[10px] font-mono font-bold flex items-center justify-center border border-slate-205 shrink-0 rounded">
                      {selectedBeneficiary.firstName[0]}
                    </div>
                  )}
                  <div className="text-left leading-snug">
                    <p className="font-bold text-slate-800">
                      {selectedBeneficiary.firstName} {selectedBeneficiary.lastName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-450 text-slate-500 mt-0.5 font-medium">
                      Current age: <strong className="text-rose-600 font-extrabold font-mono">{selectedBeneficiary.age} Yrs</strong> (Failed restriction constraint &gt; 35 yrs)
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2.5 text-amber-800 leading-normal">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10.5px] font-medium font-sans">
                    <strong>National Bypass Audit:</strong> Submitting this bypass activates registration exceptions inside federal database synchronization nodes. Bypasses are permanently cataloged with your Super Admin credentials.
                  </p>
                </div>
              </div>

              {/* Proposed Override visual stats */}
              <div className="grid grid-cols-2 gap-3.5 text-xs text-left">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs">
                  <p className="text-[9px] font-mono text-slate-400 uppercase font-black">Pre-Eligibility Status</p>
                  <p className="font-sans font-bold text-rose-600 mt-1 uppercase">FAILED: OVER-AGE</p>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-150 shadow-xs">
                  <p className="text-[9px] font-mono text-indigo-500 uppercase font-black">Proposed Bypass</p>
                  <p className="font-sans font-bold text-indigo-700 mt-1 uppercase">ACTIVE: BYPASSED</p>
                </div>
              </div>

              {/* Reason entry textbox */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 font-bold block">
                  Bypass Authorization Reason / Approver Note
                </label>
                <textarea
                  placeholder="E.g., Special state program exception, high-priority trainee placement, accredited TSP technical error adjustment, etc."
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-sans min-h-[90px]"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 text-xs pt-1.5 no-print">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 font-bold h-10 transition cursor-pointer shadow-xs"
                >
                  Cancel Action
                </button>
                <button
                  type="button"
                  disabled={isSubmittingOverride}
                  onClick={handleApplyOverride}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold h-10 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSubmittingOverride ? (
                    <span>Registering...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Confirm Override
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUPER ADMIN BULK OVERRIDE CENTER DRAWER */}
      <AnimatePresence>
        {isBulkOverrideOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isBulkSubmitting && setIsBulkOverrideOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40"
            />

            {/* Slide block drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-slate-200 p-6 shadow-2xl z-50 overflow-y-auto flex flex-col justify-between font-sans text-left"
            >
              <div className="space-y-5">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-widest font-black">
                      Bulk Authorization Core
                    </span>
                    <h3 className="text-lg font-display font-black text-slate-900 mt-1">
                      Bulk Bypass Workspace
                    </h3>
                  </div>
                  <button 
                    disabled={isBulkSubmitting}
                    onClick={() => setIsBulkOverrideOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-805 transition cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px] disabled:opacity-40"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info summary */}
                <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-900 text-xs flex gap-2.5 shadow-xs">
                  <Info className="w-4.5 h-4.5 text-indigo-550 mt-0.5 shrink-0" />
                  <div>
                    <strong className="font-bold block text-indigo-950">Bulk Bypassing Over-Aged Cohorts</strong>
                    <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">
                      The workflow applies single sequential REST overrides. All changes are stored under the secure certification logs. Only trainees currently listed as <span className="font-bold text-rose-600 uppercase">Over-age</span> are visible here.
                    </span>
                  </div>
                </div>

                {/* Submitting progress indicator overlay */}
                {isBulkSubmitting && (
                  <div className="p-4 bg-slate-50 border border-indigo-100 rounded-xl space-y-3 shadow-xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-indigo-600 font-bold flex items-center gap-1.5">
                        <span className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-500 border-t-transparent" />
                        Bypasses processing sequentially...
                      </span>
                      <span className="font-mono font-bold text-indigo-600">{bulkProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full border border-slate-100 overflow-hidden leading-none">
                      <div className="h-full bg-indigo-600 rounded-full transition-all duration-200" style={{ width: `${bulkProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Checked items list selection */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1 font-mono text-[10px] text-slate-400 font-bold">
                    <span>COHORT MEMBERS ({beneficiaries.filter(x => x.eligibilityStatus === "OVER_AGE").length})</span>
                    <button
                      type="button"
                      disabled={isBulkSubmitting}
                      onClick={() => {
                        const allOverAgeIds = beneficiaries.filter(x => x.eligibilityStatus === "OVER_AGE").map(x => x.id);
                        if (selectedBulkIds.length === allOverAgeIds.length) {
                          setSelectedBulkIds([]);
                        } else {
                          setSelectedBulkIds(allOverAgeIds);
                        }
                      }}
                      className="text-indigo-650 hover:underline hover:text-indigo-800 font-bold"
                    >
                      {selectedBulkIds.length === beneficiaries.filter(x => x.eligibilityStatus === "OVER_AGE").length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-2xl bg-slate-50/50 divide-y divide-slate-200 p-2 space-y-1">
                    {beneficiaries.filter(x => x.eligibilityStatus === "OVER_AGE").map(b => {
                      const isChecked = selectedBulkIds.includes(b.id);
                      return (
                        <div 
                          key={b.id} 
                          onClick={() => {
                            if (isBulkSubmitting) return;
                            if (isChecked) {
                              setSelectedBulkIds(prev => prev.filter(x => x !== b.id));
                            } else {
                              setSelectedBulkIds(prev => [...prev, b.id]);
                            }
                          }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer text-xs ${isChecked ? "bg-indigo-50 border border-indigo-100" : "hover:bg-white hover:shadow-xs border border-transparent"}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            disabled={isBulkSubmitting}
                            className="rounded bg-white border-slate-305 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                          />
                          <div className="text-left font-sans flex-1">
                            <p className="font-bold text-slate-800">{b.firstName} {b.lastName}</p>
                            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">Age: <span className="text-rose-600 font-bold">{b.age} Yrs</span> · ID: {b.id}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reason entry textbox */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 font-bold block">
                    Bulk Override Notes / Approval Verification
                  </label>
                  <textarea
                    disabled={isBulkSubmitting}
                    placeholder="E.g., Authorized bulk bypass for accredited local hub exceptions and specific state cohort program clearances..."
                    value={bulkOverrideReason}
                    onChange={e => setBulkOverrideReason(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-205 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-sans"
                  />
                </div>

              </div>

              {/* Workspace CTA block */}
              <div className="border-t border-slate-100 pt-5 mt-6 flex justify-end gap-2.5">
                <button 
                  type="button"
                  disabled={isBulkSubmitting}
                  onClick={() => setIsBulkOverrideOpen(false)}
                  className="bg-white border border-slate-205 hover:bg-slate-50 hover:text-slate-800 text-slate-655 text-slate-650 px-4 py-2.5 rounded-xl font-bold h-11 transition cursor-pointer text-xs shadow-xs"
                >
                  Close Center
                </button>
                <button 
                  type="button"
                  disabled={isBulkSubmitting || selectedBulkIds.length === 0}
                  onClick={handleBulkOverride}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-display font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer h-11 shadow-lg shadow-indigo-600/15 disabled:opacity-40"
                >
                  <Zap className="w-4 h-4" />
                  Apply overrides ({selectedBulkIds.length})
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
