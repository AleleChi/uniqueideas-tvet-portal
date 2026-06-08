/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  TrendingUp, Briefcase, GraduationCap, Building2, CheckCircle2, 
  AlertTriangle, ShieldCheck, Calendar, DollarSign, Search, 
  Filter, Plus, RefreshCw, User, MapPin, Activity, ArrowRight,
  TrendingDown, Check, X, FileSpreadsheet, Star, FileText, ChevronLeft, ChevronRight
} from "lucide-react";

interface TrainingOutcomesProps {
  session: any;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export const TrainingOutcomes = React.memo(function TrainingOutcomes({ session, toast }: TrainingOutcomesProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "employment" | "entrepreneurship" | "cohorts">("dashboard");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // States
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    graduates: 0,
    employed: 0,
    entrepreneurs: 0,
    selfEmployed: 0,
    furtherEducation: 0,
    verifiedOutcomes: 0,
    averageMonthlyIncome: 0,
    outcomeSuccessRate: 0,
    verificationCoverage: 0
  });
  const [cohorts, setCohorts] = useState<any[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Selected Beneficiary Profile Detail
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit / Add Outcome state
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({
    beneficiary_id: "",
    outcome_status: "UNKNOWN",
    employment_type: "",
    employer_name: "",
    job_title: "",
    business_name: "",
    business_type: "",
    employment_date: "",
    monthly_income: "0",
    business_revenue: "0",
    location: "Owerri, Imo State"
  });

  // Tracer Study Form state
  const [isTracerModalOpen, setIsTracerModalOpen] = useState(false);
  const [tracerForm, setTracerForm] = useState({
    beneficiary_id: "",
    follow_up_period: "3 Months",
    is_employed: false,
    is_self_employed: false,
    owns_business: false,
    is_business_active: false,
    income_improved: false,
    needs_support: ""
  });

  // Verification state
  const [verificationForm, setVerificationForm] = useState({
    verified: true,
    remarks: "Owerri Field Verification Verified"
  });

  // Fetch Outcomes List & Stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch registry list
      const outcomeRes = await fetch(
        `/api/outcomes?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}&track=${trackFilter}&page=${page}&limit=10`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (!outcomeRes.ok) throw new Error("Failed to load outcomes");
      const outcomesList = await outcomeRes.json();
      if (outcomesList.success) {
        setOutcomes(outcomesList.data);
        setTotalPages(outcomesList.pagination.totalPages);
        setPage(outcomesList.pagination.page);
        setTotalRecords(outcomesList.pagination.total);
      }

      // Fetch executive stats
      const statsRes = await fetch("/api/outcomes/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }
      }

      // Fetch cohorts list
      const cohortRes = await fetch("/api/outcomes/cohort-impact", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (cohortRes.ok) {
        const cohortData = await cohortRes.json();
        if (cohortData.success) {
          setCohorts(cohortData.cohorts);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Network error loading outcome tracking center");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, trackFilter, page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Detailed Profile
  const handleOpenDetail = async (beneficiaryId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/outcomes/profile/${beneficiaryId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("Failed to fetch beneficiary outcome profile");
      const data = await res.json();
      if (data.success) {
        setSelectedProfile(data);
        setSelectedBeneficiaryId(beneficiaryId);
        setIsDetailOpen(true);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not load beneficiary details");
    } finally {
      setLoading(false);
    }
  };

  // Open Upsert outcome model
  const handleOpenOutcomeSetup = (item: any) => {
    setOutcomeForm({
      beneficiary_id: item.beneficiary_id,
      outcome_status: item.outcome_status || "UNKNOWN",
      employment_type: item.employment_type || "",
      employer_name: item.employer_name || "",
      job_title: item.job_title || "",
      business_name: item.business_name || "",
      business_type: item.business_type || "",
      employment_date: item.employment_date ? item.employment_date.split("T")[0] : "",
      monthly_income: String(item.monthly_income || "0"),
      business_revenue: String(item.business_revenue || "0"),
      location: item.location || "Owerri, Imo State"
    });
    setIsOutcomeModalOpen(true);
  };

  // Submit outcome upsert
  const handleOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/outcomes/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(outcomeForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Training Outcome updated successfully");
        setIsOutcomeModalOpen(false);
        // Refresh detail profile if opened
        if (selectedBeneficiaryId) {
          handleOpenDetail(selectedBeneficiaryId);
        }
        fetchData();
      } else {
        throw new Error(data.error || "Failed to update outcome");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Verify outcome submit
  const handleVerificationSubmit = async (verified: boolean) => {
    if (!selectedBeneficiaryId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/outcomes/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          beneficiary_id: selectedBeneficiaryId,
          verified,
          remarks: verificationForm.remarks || "Owerri Field Verification Verified"
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Outcome verified status: ${verified ? 'Verified' : 'Rejected'}`);
        handleOpenDetail(selectedBeneficiaryId);
        fetchData();
      } else {
        throw new Error(data.error || "Failed verification action");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Tracer response modal
  const handleOpenTracer = () => {
    if (!selectedProfile) return;
    setTracerForm({
      beneficiary_id: selectedProfile.profile.id,
      follow_up_period: "3 Months",
      is_employed: selectedProfile.outcome?.outcome_status === "EMPLOYED" || false,
      is_self_employed: selectedProfile.outcome?.outcome_status === "SELF_EMPLOYED" || false,
      owns_business: selectedProfile.outcome?.outcome_status === "ENTREPRENEUR" || false,
      is_business_active: selectedProfile.outcome?.outcome_status === "ENTREPRENEUR" || selectedProfile.outcome?.outcome_status === "SELF_EMPLOYED" || false,
      income_improved: true,
      needs_support: ""
    });
    setIsTracerModalOpen(true);
  };

  // Submit tracer response
  const handleTracerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/outcomes/tracer/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(tracerForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Tracer response recorded successfully");
        setIsTracerModalOpen(false);
        if (selectedBeneficiaryId) {
          handleOpenDetail(selectedBeneficiaryId);
        }
        fetchData();
      } else {
        throw new Error(data.error || "Failed to submit tracer study response");
      }
    } catch (err: any) {
      toast.error(err.message || "Error submitting tracer study questionnaire");
    } finally {
      setSubmitting(false);
    }
  };

  // Formatted Currency
  const formatNGN = (val: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col p-6 animate-fade-in">
      {/* Top Breadcrumb & Actions */}
      <div className="border-b border-slate-200 pb-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
              Owerri, Imo State Digital Skills Hub
            </span>
          </div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900">
            Training Outcomes & post-Graduation Tracer Studio
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Operational dashboard and registry tracking employment, business creation, income levels, and tracer studies for graduates in Laptop Hardware & Cell Phone Repairs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 cursor-pointer min-h-[40px] flex items-center justify-center transition"
            title="Refresh statistics and registry tracking"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sub tabs navigation row */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-6 pb-px overflow-x-auto no-scrollbar">
        <button
          onClick={() => { setActiveTab("dashboard"); setPage(1); }}
          className={`py-2 px-4 text-xs font-semibold border-b-2 hover:border-slate-300 transition shrink-0 ${
            activeTab === "dashboard" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500"
          }`}
        >
          Executive Impact Analytics
        </button>
        <button
          onClick={() => { setActiveTab("employment"); setPage(1); }}
          className={`py-2 px-4 text-xs font-semibold border-b-2 hover:border-slate-300 transition shrink-0 ${
            activeTab === "employment" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500"
          }`}
        >
          Employment Registry
        </button>
        <button
          onClick={() => { setActiveTab("entrepreneurship"); setPage(1); }}
          className={`py-2 px-4 text-xs font-semibold border-b-2 hover:border-slate-300 transition shrink-0 ${
            activeTab === "entrepreneurship" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500"
          }`}
        >
          Business & Entrepreneurship Hub
        </button>
        <button
          onClick={() => { setActiveTab("cohorts"); setPage(1); }}
          className={`py-2 px-4 text-xs font-semibold border-b-2 hover:border-slate-300 transition shrink-0 ${
            activeTab === "cohorts" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500"
          }`}
        >
          Cohort Performance Analytics
        </button>
      </div>

      {/* 1. EXECUTIVE IMPACT ANALYTICS VIEW */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Top metric overview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                  Total Tracked Graduates
                </p>
                <h3 className="text-3xl font-extrabold tracking-tight text-slate-800 mt-1">
                  {stats.graduates}
                </h3>
                <p className="text-[10px] font-mono text-indigo-600 font-bold mt-1">
                  Laptop & Mobile Phone Tracks
                </p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                  Active Employment Rate
                </p>
                <h3 className="text-3xl font-extrabold tracking-tight text-slate-800 mt-1">
                  {stats.outcomeSuccessRate}%
                </h3>
                <p className="text-[10px] font-mono text-emerald-600 font-bold mt-1">
                  Employed + Entrepreneurs
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                  Average Graduate Income
                </p>
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-800 mt-1">
                  {formatNGN(stats.averageMonthlyIncome)}
                </h3>
                <p className="text-[10px] font-mono text-slate-500 font-bold mt-1.5">
                  Monthly wage/business revenue
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                  Verification Audit Rate
                </p>
                <h3 className="text-3xl font-extrabold tracking-tight text-slate-800 mt-1">
                  {stats.verificationCoverage}%
                </h3>
                <p className="text-[10px] font-mono text-indigo-600 font-bold mt-1">
                  Verified by Field Officers
                </p>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Graphical Split & Analytics Dashboard details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">
                Employment & Business Creation Split
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1 text-slate-600">
                    <span>Wage-Employed (Repair Workshops, Digital Centers, hardware retail)</span>
                    <span className="font-mono">{stats.employed} graduates</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-lg h-3 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-700"
                      style={{ width: `${stats.graduates > 0 ? (stats.employed / stats.graduates) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1 text-slate-600">
                    <span>Self-Employed (Freelancing hardware repairs, repairs on contract)</span>
                    <span className="font-mono">{stats.selfEmployed} graduates</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-lg h-3 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-700"
                      style={{ width: `${stats.graduates > 0 ? (stats.selfEmployed / stats.graduates) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1 text-slate-600">
                    <span>Entrepreneurs (Established Repair outlet, Spare parts store, training academy)</span>
                    <span className="font-mono">{stats.entrepreneurs} graduates</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-lg h-3 overflow-hidden">
                    <div 
                      className="bg-sky-500 h-full transition-all duration-700"
                      style={{ width: `${stats.graduates > 0 ? (stats.entrepreneurs / stats.graduates) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1 text-slate-600">
                    <span>Further Education (Higher learning, advanced digital certifications)</span>
                    <span className="font-mono">{stats.furtherEducation} graduates</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-lg h-3 overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full transition-all duration-700"
                      style={{ width: `${stats.graduates > 0 ? (stats.furtherEducation / stats.graduates) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                <Activity className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Post-Graduation Economic Uplift</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Prior to digital training tracks (Computer hardware repairs, phone diagnostic system Repairs), average graduate monthly income was estimated at under NGN 20,000. Under our tracker, graduates are now generating significant livelihood benefits in and around Imo State.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">
                  Verification Pipeline Status
                </h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-800">
                    {stats.verifiedOutcomes}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">outcomes verified</span>
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Field officers physically visit business locations in Owerri, verify employment logs, and inspect registration details of computer hardware and cell-phone repair businesses.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Field audits target</span>
                    <span className="font-semibold text-slate-800">100% graduates</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Average audit lookup</span>
                    <span className="font-semibold text-slate-800">7.5 days after logs</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium py-1.5">
                    <span className="text-slate-500">Imo State coverage</span>
                    <span className="font-semibold text-indigo-600">Owerri Municipal, West, North</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={() => setActiveTab("employment")}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition text-center block cursor-pointer"
                >
                  Verify Now in Registry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYMENT REGISTRY VIEW */}
      {activeTab === "employment" && (
        <div className="space-y-6">
          {/* Filters / Search Bar Row */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search graduates by name, ID or business name..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Filters:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-600 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="EMPLOYED">Wage Employed</option>
                <option value="SELF_EMPLOYED">Self Employed</option>
                <option value="ENTREPRENEUR">Entrepreneur</option>
                <option value="FURTHER_EDUCATION">Further Education</option>
                <option value="UNEMPLOYED">Unemployed</option>
                <option value="UNKNOWN">Unregistered</option>
              </select>

              <select
                value={trackFilter}
                onChange={(e) => { setTrackFilter(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-600 outline-none"
              >
                <option value="">All Tracks</option>
                <option value="Computer Hardware Repairs">Computer Hardware Repairs</option>
                <option value="Mobile Phone Repairs">Mobile Phone Repairs</option>
              </select>
            </div>
          </div>

          {/* Table list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Refreshing outcome records pipeline...
                </div>
              ) : outcomes.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No tracked graduates found matching filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-mono font-bold uppercase text-slate-400 border-b border-slate-250">
                      <th className="p-4 pl-6 text-left">Graduate ID & Name</th>
                      <th className="p-4">Training Track</th>
                      <th className="p-4">Employment Status</th>
                      <th className="p-4">Monthly Income</th>
                      <th className="p-4">Employer/Business Details</th>
                      <th className="p-4">Audit Verify</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {outcomes.map((item) => (
                      <tr key={item.beneficiary_id} className="hover:bg-slate-50/50 font-sans transition">
                        <td className="p-4 pl-6">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {item.first_name} {item.last_name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">
                            {item.beneficiary_id}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-slate-705">
                            {item.skill_sector || "Computer Hardware Repairs"}
                          </span>
                          <div className="text-[10px] font-mono text-slate-400">
                            {item.batch || "Cohort 1"}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            item.outcome_status === "EMPLOYED" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            item.outcome_status === "SELF_EMPLOYED" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            item.outcome_status === "ENTREPRENEUR" ? "bg-sky-50 text-sky-700 border-sky-100" :
                            item.outcome_status === "FURTHER_EDUCATION" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            item.outcome_status === "UNKNOWN" ? "bg-slate-50 text-slate-600 border-slate-200 h-[21px] flex items-center" :
                            "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {item.outcome_status || "UNKNOWN"}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-semibold text-slate-800">
                          {formatNGN(item.monthly_income)}
                        </td>
                        <td className="p-4">
                          {item.outcome_status === "EMPLOYED" ? (
                            <div>
                              <div className="font-semibold">{item.employer_name || "Unlogged"}</div>
                              <div className="text-[10px] text-slate-400">{item.job_title || "Repair Tech"}</div>
                            </div>
                          ) : item.outcome_status === "ENTREPRENEUR" || item.outcome_status === "SELF_EMPLOYED" ? (
                            <div>
                              <div className="font-semibold text-emerald-700">{item.business_name || "Self Managed Studio"}</div>
                              <div className="text-[10px] text-slate-400">{item.business_type || "Repair Shop"}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No business/employer logged</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            item.verified ? "text-emerald-700" : "text-amber-600"
                          }`}>
                            {item.verified ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verified</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Unverified</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenOutcomeSetup(item)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded text-[10px] cursor-pointer"
                            >
                              Edit Status
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(item.beneficiary_id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px] cursor-pointer"
                            >
                              Manage Profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls Footer */}
            {!loading && totalPages > 1 && (
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium font-mono">
                  Showing Page {page} of {totalPages} ({totalRecords} graduates)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-50 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-50 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. BUSINESS & ENTREPRENEURSHIP HUB VIEW */}
      {activeTab === "entrepreneurship" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">
              Graduate Business Creation & Enterprise Incubator
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              This space highlights our graduates in Owerri who have translated their Digital Laptop & Mobile Phone repairs skills into thriving private micro-enterprises. These alumni are not search applicants; they are local business owners!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outcomes.filter(o => ["SELF_EMPLOYED", "ENTREPRENEUR"].includes(o.outcome_status)).length === 0 ? (
              <div className="bg-white p-12 text-center text-slate-400 text-xs border border-slate-200 rounded-xl col-span-3">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No local repair enterprises currently registered. Use the Employment Registry to mark a graduate as an Entrepreneur.
              </div>
            ) : (
              outcomes.filter(o => ["SELF_EMPLOYED", "ENTREPRENEUR"].includes(o.outcome_status)).map((inc) => (
                <div key={inc.beneficiary_id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono font-bold tracking-wider px-2 py-0.5 rounded uppercase">
                      Local repair enterprise
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {inc.batch || "Cohort 1"}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {inc.business_name || "Cell Diagnostics Studio"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    Owner: {inc.first_name} {inc.last_name}
                  </p>

                  <div className="my-4 pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Main Focus</span>
                      <span className="font-semibold text-slate-800">{inc.skill_sector}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Monthly Revenue</span>
                      <span className="font-semibold text-emerald-600 font-mono">{formatNGN(inc.business_revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Location</span>
                      <span className="font-semibold text-slate-800 inline-flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {inc.location || "Owerri, Imo State"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                      inc.verified ? "text-emerald-700" : "text-amber-600"
                    }`}>
                      {inc.verified ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Field Audited</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" />
                          <span>Audit Pending</span>
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenDetail(inc.beneficiary_id)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Tracer log</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. COHORT PERFORMANCE VIEW */}
      {activeTab === "cohorts" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">
              Cohort / Batch Outcomes & Livelihood Impact
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              Breakdown of employment, enterprise creation, and business scale metrics aggregated by training cohort batches. This ensures zero N+1 database queries on larger lists.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-mono font-bold uppercase text-slate-400 border-b border-slate-200">
                    <th className="p-4 pl-6">Cohort Batch</th>
                    <th className="p-4 text-center">Graduates Tracked</th>
                    <th className="p-4 text-center">Employment Rate %</th>
                    <th className="p-4 text-semibold text-center">Business Creation %</th>
                    <th className="p-4 text-center">Average Wage / Income</th>
                    <th className="p-4 text-center">Audited Coverage %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {cohorts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        No active cohort batch metrics populated.
                      </td>
                    </tr>
                  ) : (
                    cohorts.map((coh) => (
                      <tr key={coh.cohort} className="hover:bg-slate-50/50 transition font-sans">
                        <td className="p-4 pl-6 font-semibold text-slate-900">
                          {coh.cohort}
                        </td>
                        <td className="p-4 text-center font-mono font-bold">
                          {coh.graduates}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800">{coh.employmentRate}%</span>
                            <div className="w-12 bg-slate-100 h-2 rounded overflow-hidden hidden sm:block">
                              <div className="bg-indigo-600 h-full" style={{ width: `${coh.employmentRate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-mono font-bold text-emerald-600">{coh.businessCreationRate}%</span>
                            <div className="w-12 bg-slate-100 h-2 rounded overflow-hidden hidden sm:block">
                              <div className="bg-emerald-500 h-full" style={{ width: `${coh.businessCreationRate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono font-semibold text-slate-850">
                          {formatNGN(coh.averageIncome)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                            coh.verifiedOutcomesRate >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {coh.verifiedOutcomesRate}% audited
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED STUDENT OUTCOME PROFILE DIALOG (SLIDE-OVER / DRAWER / MODAL) */}
      {isDetailOpen && selectedProfile && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 transition-opacity" onClick={() => setIsDetailOpen(false)} />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg">
              <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll border-l border-slate-200">
                <div className="p-6 bg-slate-950 text-white flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono tracking-wider text-slate-400 font-bold uppercase">
                      Graduate Outcomes Profile Detail
                    </span>
                    <h2 className="text-base font-bold font-sans mt-0.5" id="slide-over-title">
                      {selectedProfile.profile.first_name || selectedProfile.profile.first_name} {selectedProfile.profile.last_name || selectedProfile.profile.last_name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile Core content */}
                <div className="flex-1 p-6 space-y-6">
                  {/* Graduate & Course Detail */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider mb-2">
                      Training credentials
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-mono">ID / Owerri TVET</span>
                        <div className="font-semibold text-slate-800 uppercase mt-0.5">{selectedProfile.profile.id}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono">Specialized Track</span>
                        <div className="font-semibold text-indigo-700 mt-0.5">{selectedProfile.profile.skill_sector}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono">Training Center</span>
                        <div className="font-semibold text-slate-800 mt-0.5">{selectedProfile.profile.tsp || "Unique Tech Nig Ltd"}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono">Batch / Cohort</span>
                        <div className="font-semibold text-slate-800 mt-0.5">{selectedProfile.profile.batch}</div>
                      </div>
                    </div>
                  </div>

                  {/* Registered Post-Training Outcomes Status */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                        Current Outcome Status
                      </h4>
                      <button
                        onClick={() => { handleOpenOutcomeSetup(selectedProfile.profile); setIsDetailOpen(false); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Edit Outcome
                      </button>
                    </div>

                    {selectedProfile.outcome ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                            selectedProfile.outcome.outcome_status === "EMPLOYED" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            selectedProfile.outcome.outcome_status === "SELF_EMPLOYED" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            selectedProfile.outcome.outcome_status === "ENTREPRENEUR" ? "bg-sky-50 text-sky-700 border-sky-100" :
                            selectedProfile.outcome.outcome_status === "FURTHER_EDUCATION" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {selectedProfile.outcome.outcome_status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                          {selectedProfile.outcome.outcome_status === "EMPLOYED" && (
                            <>
                              <div>
                                <span className="text-slate-400">Employer Name</span>
                                <div className="font-semibold text-slate-800 mt-1">{selectedProfile.outcome.employer_name || "N/A"}</div>
                              </div>
                              <div>
                                <span className="text-slate-400">Job Title</span>
                                <div className="font-semibold text-slate-800 mt-1">{selectedProfile.outcome.job_title || "N/A"}</div>
                              </div>
                            </>
                          )}

                          {(selectedProfile.outcome.outcome_status === "ENTREPRENEUR" || selectedProfile.outcome.outcome_status === "SELF_EMPLOYED") && (
                            <>
                              <div>
                                <span className="text-slate-400">Business Name</span>
                                <div className="font-semibold text-emerald-700 mt-1">{selectedProfile.outcome.business_name || "N/A"}</div>
                              </div>
                              <div>
                                <span className="text-slate-400">Industry / Niche</span>
                                <div className="font-semibold text-slate-800 mt-1">{selectedProfile.outcome.business_type || "N/A"}</div>
                              </div>
                            </>
                          )}

                          <div>
                            <span className="text-slate-400">Logged Income</span>
                            <div className="font-semibold text-slate-900 mt-1 font-mono">
                              {formatNGN(selectedProfile.outcome.monthly_income)} / month
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Registered Date</span>
                            <div className="font-semibold text-slate-800 mt-1">
                              {selectedProfile.outcome.employment_date ? new Date(selectedProfile.outcome.employment_date).toLocaleDateString() : "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* Verification controls */}
                        <div className="pt-4 border-t border-slate-200 mt-4 bg-slate-50/50 p-3 rounded-lg">
                          <h5 className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase mb-2">
                            Field Officer Verification Status
                          </h5>
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold leading-none ${
                              selectedProfile.outcome.verified ? "text-emerald-700" : "text-amber-600"
                            }`}>
                              {selectedProfile.outcome.verified ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Verified Outcome</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>Verification Pending</span>
                                </>
                              )}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {selectedProfile.outcome.verified ? (
                                <button
                                  type="button"
                                  onClick={() => handleVerificationSubmit(false)}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded text-[10px] cursor-pointer"
                                >
                                  Reject Audit
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleVerificationSubmit(true)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded text-[10px] cursor-pointer"
                                >
                                  Verify Audit
                                </button>
                              )}
                            </div>
                          </div>
                          {selectedProfile.outcome.verified && (
                            <div className="text-[10px] text-slate-400 mt-2 font-mono">
                              Verified by: {selectedProfile.outcome.verified_by} at {new Date(selectedProfile.outcome.verified_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-xs">
                        No outcome registered for this alumnus yet. Click Edit Outcome to construct their profile.
                      </div>
                    )}
                  </div>

                  {/* Periodic Tracer Studies Follow-up Questionnaire Log */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                        Study Follow-up Survey History
                      </h4>
                      <button
                        type="button"
                        onClick={handleOpenTracer}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Add Response
                      </button>
                    </div>

                    {selectedProfile.tracerStudies.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs italic">
                        No periodic tracer studies responses logged for this graduate yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProfile.tracerStudies.map((tr: any) => (
                          <div key={tr.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                            <div className="flex items-center justify-between font-semibold border-b border-indigo-100pb-1.5 mb-1.5 text-[10px] font-mono uppercase">
                              <span className="text-indigo-700">{tr.follow_up_period} Survey</span>
                              <span className="text-slate-400">{new Date(tr.created_at || new Date()).toLocaleDateString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                              <div className="flex justify-between items-center text-slate-500">
                                <span>Employed</span>
                                <span className={`font-semibold ${tr.is_employed ? "text-emerald-700" : "text-rose-600"}`}>
                                  {tr.is_employed ? "Yes" : "No"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-500">
                                <span>Businesses</span>
                                <span className={`font-semibold ${tr.owns_business ? "text-emerald-700" : "text-rose-600"}`}>
                                  {tr.owns_business ? "Yes" : "No"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 col-span-2">
                                <span>Income Improved</span>
                                <span className={`font-semibold ${tr.income_improved ? "text-indigo-700" : "text-rose-600"}`}>
                                  {tr.income_improved ? "Enhanced Monthly Earnings" : "Standard"}
                                </span>
                              </div>
                              {tr.needs_support && (
                                <div className="col-span-2 pt-1 border-t border-slate-100">
                                  <span className="text-[10px] text-slate-400 block font-bold">ALUMNUS FEEDBACK/SUPPORT</span>
                                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{tr.needs_support}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Draw footer closes */}
                <div className="p-6 border-t border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg text-center cursor-pointer"
                  >
                    Close Profile Panel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTER / UPDATE OUTCOME */}
      {isOutcomeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsOutcomeModalOpen(false)} />

          <div className="relative bg-white rounded-xl border border-slate-250 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 bg-indigo-650 text-slate-900 border-b border-indigo-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Regulate graduate outcomes status
                </h3>
                <span className="text-[9px] font-mono text-indigo-505 block mt-0.5">
                  Beneficiary: {outcomeForm.beneficiary_id}
                </span>
              </div>
              <button
                onClick={() => setIsOutcomeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-indigo-300 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOutcomeSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wide block mb-1">
                  Outcome status type
                </label>
                <select
                  value={outcomeForm.outcome_status}
                  onChange={(e) => setOutcomeForm({...outcomeForm, outcome_status: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white text-slate-700 outline-none"
                >
                  <option value="UNKNOWN">UNKNOWN / UNREGISTERED</option>
                  <option value="EMPLOYED">WAGE EMPLOYED</option>
                  <option value="SELF_EMPLOYED">SELF EMPLOYED (REPAIR TECH)</option>
                  <option value="ENTREPRENEUR">ENTREPRENEUR (REPAIR SHOP OWNER)</option>
                  <option value="APPRENTICESHIP">APPRENTICESHIP PROGRAMME</option>
                  <option value="FURTHER_EDUCATION">FURTHER EDUCATION</option>
                  <option value="UNEMPLOYED">UNEMPLOYED</option>
                </select>
              </div>

              {/* Conditional fields based on status */}
              {outcomeForm.outcome_status === "EMPLOYED" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">EMPLOYER NAME</label>
                    <input
                      type="text"
                      value={outcomeForm.employer_name}
                      onChange={(e) => setOutcomeForm({...outcomeForm, employer_name: e.target.value})}
                      placeholder="e.g. Unique Technology Ltd Repairs Lab"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">JOB TITLE</label>
                    <input
                      type="text"
                      value={outcomeForm.job_title}
                      onChange={(e) => setOutcomeForm({...outcomeForm, job_title: e.target.value})}
                      placeholder="e.g. Lead Mobile Hardware Repairer"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">EMPLOYMENT TYPE</label>
                    <input
                      type="text"
                      value={outcomeForm.employment_type}
                      onChange={(e) => setOutcomeForm({...outcomeForm, employment_type: e.target.value})}
                      placeholder="e.g. Full time, Part time"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none"
                    />
                  </div>
                </div>
              )}

              {["ENTREPRENEUR", "SELF_EMPLOYED"].includes(outcomeForm.outcome_status) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1 font-semibold text-emerald-700">BUSINESS / OUTLET SHOP NAME</label>
                    <input
                      type="text"
                      value={outcomeForm.business_name}
                      onChange={(e) => setOutcomeForm({...outcomeForm, business_name: e.target.value})}
                      placeholder="e.g. Owerri Central Hardware Repair Lounge"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none border-emerald-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">BUSINESS SERVICES TYPE</label>
                    <input
                      type="text"
                      value={outcomeForm.business_type}
                      onChange={(e) => setOutcomeForm({...outcomeForm, business_type: e.target.value})}
                      placeholder="e.g. Smartphone diagnostics repairs & parts supply"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">MONTHLY BUSINESS REVENUE (NGN)</label>
                    <input
                      type="number"
                      value={outcomeForm.business_revenue}
                      onChange={(e) => setOutcomeForm({...outcomeForm, business_revenue: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">MONTHLY EARNINGS (NGN)</label>
                  <input
                    type="number"
                    value={outcomeForm.monthly_income}
                    onChange={(e) => setOutcomeForm({...outcomeForm, monthly_income: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">EFFECTIVE DATE</label>
                  <input
                    type="date"
                    value={outcomeForm.employment_date}
                    onChange={(e) => setOutcomeForm({...outcomeForm, employment_date: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">LOCATION / REGION</label>
                <input
                  type="text"
                  value={outcomeForm.location}
                  onChange={(e) => setOutcomeForm({...outcomeForm, location: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOutcomeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow cursor-pointer min-h-[36px]"
                >
                  {submitting ? "Saving Outcome..." : "Save Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SUBMIT TRACER SURVEY RESPONSE */}
      {isTracerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsTracerModalOpen(false)} />

          <div className="relative bg-white rounded-xl border border-slate-250 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-650 text-slate-900 border-b border-indigo-100/30 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Periodic Tracer follow up questionnaire
                </h3>
                <span className="text-[9px] font-mono text-slate-800 tracking-wider">
                  Trace responses record
                </span>
              </div>
              <button
                onClick={() => setIsTracerModalOpen(false)}
                className="p-1 rounded-lg text-slate-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTracerSubmit} className="p-5 space-y-4 text-xs text-slate-650">
              <div>
                <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">
                  Tracer interval timing
                </label>
                <select
                  value={tracerForm.follow_up_period}
                  onChange={(e) => setTracerForm({...tracerForm, follow_up_period: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white outline-none"
                >
                  <option value="3 Months">3 Months post-graduation</option>
                  <option value="6 Months">6 Months post-graduation</option>
                  <option value="12 Months">12 Months (1 Year) post-graduation</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Currently Wage-Employed?</span>
                  <input
                    type="checkbox"
                    checked={tracerForm.is_employed}
                    onChange={(e) => setTracerForm({...tracerForm, is_employed: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Operating active self-employment repairs?</span>
                  <input
                    type="checkbox"
                    checked={tracerForm.is_self_employed}
                    onChange={(e) => setTracerForm({...tracerForm, is_self_employed: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Established registered private business / store?</span>
                  <input
                    type="checkbox"
                    checked={tracerForm.owns_business}
                    onChange={(e) => setTracerForm({...tracerForm, owns_business: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Is the business currently operational/profitable?</span>
                  <input
                    type="checkbox"
                    checked={tracerForm.is_business_active}
                    onChange={(e) => setTracerForm({...tracerForm, is_business_active: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Has monthly income increased since TVET course?</span>
                  <input
                    type="checkbox"
                    checked={tracerForm.income_improved}
                    onChange={(e) => setTracerForm({...tracerForm, income_improved: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-1 focus:ring-indigo-550"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-[10px] font-bold font-mono text-slate-400 block mb-1">
                  STUDENT FEEDBACK & POST-GRAD SUPPORT REQUESTS
                </label>
                <textarea
                  rows={3}
                  value={tracerForm.needs_support}
                  onChange={(e) => setTracerForm({...tracerForm, needs_support: e.target.value})}
                  placeholder="e.g. Needs microfinancing for hardware repair tools, spare chip suppliers, etc..."
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTracerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow cursor-pointer min-h-[36px]"
                >
                  {submitting ? "Saving tracer..." : "Submit tracer response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
