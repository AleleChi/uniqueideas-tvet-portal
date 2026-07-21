import React, { useState, useEffect } from "react";
import { authFetch } from "../utils/authFetch";
import { 
  Users, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  Edit, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  X
} from "lucide-react";

interface Trainee {
  id: string;
  beneficiary_id: string;
  first_name: string;
  last_name: string;
  tvet_id: string;
  gender: string;
  physical_challenge: string;
  education_level: string;
  employment_status: string;
  training_status: string;
  phone_number: string;
  updated_at?: string;
  cohort?: string;
  batch?: string;
  other_name?: string;
  nin?: string;
  bvn?: string;
  bank_name?: string;
  bank_sort_code?: string;
  account_number?: string;
  account_name?: string;
  guardian_name?: string;
  guardian_address?: string;
  guardian_phone?: string;
  education_qualification?: string;
}

const AUTHORITATIVE_BANKS = [
  { name: "Access Bank", sortCode: "044150149" },
  { name: "Zenith Bank", sortCode: "057150143" },
  { name: "Guaranty Trust Bank", sortCode: "058150125" },
  { name: "United Bank for Africa", sortCode: "033150111" },
  { name: "First Bank of Nigeria", sortCode: "011150148" },
  { name: "Fidelity Bank", sortCode: "070150003" },
  { name: "Union Bank of Nigeria", sortCode: "032150007" },
  { name: "Stanbic IBTC Bank", sortCode: "039150002" },
  { name: "Sterling Bank", sortCode: "232150008" },
  { name: "Wema Bank", sortCode: "035150103" },
  { name: "Ecobank Nigeria", sortCode: "050150010" },
  { name: "Keystone Bank", sortCode: "082150017" },
  { name: "Polaris Bank", sortCode: "076150001" },
  { name: "First City Monument Bank", sortCode: "214150018" },
  { name: "Providus Bank", sortCode: "101150001" },
  { name: "Jaiz Bank", sortCode: "301150001" },
  { name: "Taj Bank", sortCode: "302150001" },
  { name: "Globus Bank", sortCode: "103150001" },
  { name: "SunTrust Bank", sortCode: "100150001" },
  { name: "Signature Bank", sortCode: "107150001" }
];

export function BulkAnnex9UpdateView({ session, showToast }: { session: any; showToast: any }) {
  const [loading, setLoading] = useState(false);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Search and Filter States
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk update field values
  const [bulkSex, setBulkSex] = useState("No change");
  const [bulkPwd, setBulkPwd] = useState("No change");
  const [bulkEducation, setBulkEducation] = useState("No change");
  const [bulkEmployment, setBulkEmployment] = useState("No change");
  const [bulkTrainingStatus, setBulkTrainingStatus] = useState("No change");

  // Preview Modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Single Trainee Editing state
  const [editingTrainee, setEditingTrainee] = useState<Trainee | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editOtherName, setEditOtherName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editPwd, setEditPwd] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNin, setEditNin] = useState("");
  const [editBvn, setEditBvn] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankSortCode, setEditBankSortCode] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editAccountName, setEditAccountName] = useState("");
  const [editGuardianName, setEditGuardianName] = useState("");
  const [editGuardianAddress, setEditGuardianAddress] = useState("");
  const [editGuardianPhone, setEditGuardianPhone] = useState("");
  const [editEducationLevel, setEditEducationLevel] = useState("");
  const [editEmploymentStatus, setEditEmploymentStatus] = useState("");
  const [editTrainingStatus, setEditTrainingStatus] = useState("");

  const [bankSearch, setBankSearch] = useState("");
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<"general" | "bank_reconciliation">("general");

  // Bank Reconciliation states
  const [reconSearch, setReconSearch] = useState("");
  const [reconStatus, setReconStatus] = useState("all");
  const [reconTsp, setReconTsp] = useState("all");
  const [selectedReconIds, setSelectedReconIds] = useState<string[]>([]);
  const [reconPreviewList, setReconPreviewList] = useState<any[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [authRef, setAuthRef] = useState("Annex 9 Verified Reconciliation Reference");
  const [reconCommitting, setReconCommitting] = useState(false);
  const [reconTsps, setReconTsps] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Lists of available filters (fetched dynamically or matched against known categories)
  const cohortOptions = ["all", "Batch 2026-C", "Cohort 1", "Cohort 2"];
  const skillOptions = ["all", "ICT", "Welding", "Automotive", "Catering", "Garment Making"];

  const fetchReconciliationPreview = async () => {
    setReconLoading(true);
    try {
      const params = new URLSearchParams({
        search: reconSearch,
        status: reconStatus,
        tspId: reconTsp
      });
      const res = await authFetch(`/api/bank-reconciliation/preview?${params.toString()}`);
      if (!res.ok) throw new Error("Could not retrieve bank reconciliation preview list");
      const data = await res.json();
      setReconPreviewList(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load bank reconciliation preview.", "error");
    } finally {
      setReconLoading(false);
    }
  };

  const fetchReconTsps = async () => {
    try {
      const res = await authFetch("/api/bank-reconciliation/tsps");
      if (res.ok) {
        const data = await res.json();
        setReconTsps(data);
      }
    } catch (err) {
      console.error("Failed to fetch reconciliation TSPs list:", err);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await authFetch("/api/bank-reconciliation/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Failed to load audit trail logs:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Run triggers based on active tabs
  useEffect(() => {
    if (activeTab === "bank_reconciliation") {
      fetchReconciliationPreview();
      fetchReconTsps();
      fetchAuditLogs();
    }
  }, [activeTab, reconStatus, reconTsp]);

  // Debounced search for reconciliation
  useEffect(() => {
    if (activeTab === "bank_reconciliation") {
      const delay = setTimeout(() => {
        fetchReconciliationPreview();
      }, 400);
      return () => clearTimeout(delay);
    }
  }, [reconSearch]);

  const handleCommitReconciliation = async () => {
    if (selectedReconIds.length === 0) {
      showToast("Please select at least one candidate with mismatch to reconcile.", "error");
      return;
    }
    if (!authRef.trim()) {
      showToast("Please provide an approved authority reference or reason for reconciliation.", "error");
      return;
    }

    setReconCommitting(true);
    try {
      const res = await authFetch("/api/bank-reconciliation/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryIds: selectedReconIds,
          reason: authRef
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reconciliation failed");
      }

      showToast(`Successfully reconciled and verified ${data.reconciledCount} trainee bank accounts!`, "success");
      setSelectedReconIds([]);
      fetchReconciliationPreview();
      fetchAuditLogs();
    } catch (err: any) {
      showToast("Commit failed: " + err.message, "error");
    } finally {
      setReconCommitting(false);
    }
  };

  // Fetch trainees
  const fetchTrainees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search.trim(),
        cohort: cohortFilter === "all" ? "" : cohortFilter,
        skill: skillFilter === "all" ? "" : skillFilter,
        status: statusFilter === "all" ? "" : statusFilter,
      });

      const res = await authFetch(`/api/trainees?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load trainees");
      const data = await res.json();
      
      if (data && data.profiles) {
        setTrainees(data.profiles);
        setTotal(data.total || 0);
      }
    } catch (err: any) {
      showToast("Error retrieving trainee registry: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainees();
  }, [page, cohortFilter, skillFilter, statusFilter]);

  // Debounced manual search
  useEffect(() => {
    const delay = setTimeout(() => {
      setPage(1);
      fetchTrainees();
    }, 400);
    return () => clearTimeout(delay);
  }, [search]);

  // Handle Select / Deselect
  const toggleSelectTrainee = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = trainees.map(t => t.beneficiary_id);
    const allVisibleSelected = visibleIds.every(id => selectedIds.includes(id));
    
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const union = new Set([...prev, ...visibleIds]);
        return Array.from(union);
      });
    }
  };

  const selectAllMatching = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "1000",
        search: search.trim(),
        cohort: cohortFilter === "all" ? "" : cohortFilter,
        skill: skillFilter === "all" ? "" : skillFilter,
        status: statusFilter === "all" ? "" : statusFilter,
      });

      const res = await authFetch(`/api/trainees?${params.toString()}`);
      if (!res.ok) throw new Error("Could not fetch full matching trainees");
      const data = await res.json();
      if (data && data.profiles) {
        const matchedIds = data.profiles.map((t: any) => t.beneficiary_id);
        setSelectedIds(matchedIds);
        showToast(`Selected all ${matchedIds.length} matching trainees.`, "info");
      }
    } catch (err: any) {
      showToast("Could not select all: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Preview data to list exactly what changes
  const getChangesPreview = () => {
    const targets = trainees.filter(t => selectedIds.includes(t.beneficiary_id));
    return targets.map(t => {
      const changes: { field: string; from: string; to: string }[] = [];
      if (bulkSex !== "No change" && t.gender !== bulkSex) {
        changes.push({ field: "Sex", from: t.gender || "None", to: bulkSex });
      }
      if (bulkPwd !== "No change" && t.physical_challenge !== bulkPwd) {
        changes.push({ field: "PWD?", from: t.physical_challenge || "No", to: bulkPwd });
      }
      if (bulkEducation !== "No change" && t.education_level !== bulkEducation) {
        changes.push({ field: "Education", from: t.education_level || "Secondary", to: bulkEducation });
      }
      if (bulkEmployment !== "No change" && t.employment_status !== bulkEmployment) {
        changes.push({ field: "Employment", from: t.employment_status || "Unemployed", to: bulkEmployment });
      }
      if (bulkTrainingStatus !== "No change" && t.training_status !== bulkTrainingStatus) {
        changes.push({ field: "Training Status", from: t.training_status || "On-going", to: bulkTrainingStatus });
      }
      return { trainee: t, changes };
    }).filter(p => p.changes.length > 0);
  };

  const previewList = getChangesPreview();

  const handleApplyUpdates = async () => {
    if (selectedIds.length === 0) {
      showToast("No trainees selected for update", "error");
      return;
    }
    if (
      bulkSex === "No change" &&
      bulkPwd === "No change" &&
      bulkEducation === "No change" &&
      bulkEmployment === "No change" &&
      bulkTrainingStatus === "No change"
    ) {
      showToast("Please choose at least one field to change", "error");
      return;
    }

    setShowPreviewModal(true);
  };

  const commitUpdates = async () => {
    setCommitting(true);
    try {
      const res = await authFetch("/api/trainees/bulk-compliance-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryIds: selectedIds,
          updates: {
            gender: bulkSex,
            physical_challenge: bulkPwd,
            education_level: bulkEducation,
            employment_status: bulkEmployment,
            training_status: bulkTrainingStatus
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      showToast(
        `Successfully bulk updated ${data.updated} trainees. Unchanged: ${data.unchanged}. Failed: ${data.failed}.`,
        "success"
      );

      // Reset fields
      setSelectedIds([]);
      setBulkSex("No change");
      setBulkPwd("No change");
      setBulkEducation("No change");
      setBulkEmployment("No change");
      setBulkTrainingStatus("No change");
      setShowPreviewModal(false);
      
      fetchTrainees();
    } catch (err: any) {
      showToast("Failed to commit bulk updates: " + err.message, "error");
    } finally {
      setCommitting(false);
    }
  };

  // Start single trainee editing modal
  const handleStartEditTrainee = (t: Trainee) => {
    setEditingTrainee(t);
    setEditFirstName(t.first_name || "");
    setEditLastName(t.last_name || "");
    setEditOtherName(t.other_name || "");
    setEditGender(t.gender || "Male");
    setEditPwd(t.physical_challenge || "No");
    setEditPhone(t.phone_number || "");
    setEditNin(t.nin || "");
    setEditBvn(t.bvn || "");
    setEditBankName(t.bank_name || "");
    setEditBankSortCode(t.bank_sort_code || "");
    setEditAccountNumber(t.account_number || "");
    setEditAccountName(t.account_name || "");
    setEditGuardianName(t.guardian_name || "");
    setEditGuardianAddress(t.guardian_address || "");
    setEditGuardianPhone(t.guardian_phone || "");
    setEditEducationLevel(t.education_level || "Secondary");
    setEditEmploymentStatus(t.employment_status || "Unemployed");
    setEditTrainingStatus(t.training_status || "On-going");
    setBankSearch(t.bank_name || "");
    setShowBankDropdown(false);
  };

  // Submit single trainee edit profile updates
  const handleSaveTraineeProfile = async () => {
    if (!editingTrainee) return;
    setCommitting(true);
    try {
      const res = await authFetch(`/api/trainees/${editingTrainee.beneficiary_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          other_name: editOtherName,
          gender: editGender,
          physical_challenge: editPwd,
          phone_number: editPhone,
          nin: editNin,
          bvn: editBvn,
          bank_name: editBankName,
          bank_sort_code: editBankSortCode,
          account_number: editAccountNumber,
          account_name: editAccountName,
          guardian_name: editGuardianName,
          guardian_address: editGuardianAddress,
          guardian_phone: editGuardianPhone,
          education_level: editEducationLevel,
          employment_status: editEmploymentStatus,
          training_status: editTrainingStatus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile changes.");

      showToast(`Successfully updated compliance profile for ${editFirstName} ${editLastName}.`, "success");
      setEditingTrainee(null);
      fetchTrainees();
    } catch (err: any) {
      showToast("Could not save profile details: " + err.message, "error");
    } finally {
      setCommitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-indigo-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Annex 9 Profile Data Completion & Compliance Center
            </h3>
            <p className="text-xs text-slate-400 leading-normal max-w-2xl">
              Strict government validation compliance manager. Select trainees to apply bulk updates or use inline actions to edit individual registration logs, stipend accounts, and guardian profiles.
            </p>
          </div>
          <button
            onClick={() => {
              if (activeTab === "general") {
                setPage(1);
                fetchTrainees();
              } else {
                fetchReconciliationPreview();
                fetchAuditLogs();
              }
            }}
            className="self-start lg:self-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            title="Refresh Registry"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || reconLoading) ? "animate-spin text-indigo-400" : "text-slate-300"}`} />
          </button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-5 py-3 text-xs font-bold uppercase font-mono tracking-wider border-b-2 transition ${
            activeTab === "general"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          General Compliance Updates
        </button>
        <button
          onClick={() => setActiveTab("bank_reconciliation")}
          className={`px-5 py-3 text-xs font-bold uppercase font-mono tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === "bank_reconciliation"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Bank Sort Code Reconciliation Manager</span>
          <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-extrabold animate-pulse">
            LIVE AUDIT
          </span>
        </button>
      </div>

      {activeTab === "general" ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Bulk Action Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs xl:col-span-1 space-y-4 text-left">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono pb-2 border-b border-slate-100 flex items-center gap-2">
            <Edit className="w-3.5 h-3.5 text-indigo-500" />
            Bulk Modification Panel
          </h4>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Sex</label>
              <select
                value={bulkSex}
                onChange={(e) => setBulkSex(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
              >
                <option value="No change">-- No change --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">PWD Status (Physical challenge?)</label>
              <select
                value={bulkPwd}
                onChange={(e) => setBulkPwd(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
              >
                <option value="No change">-- No change --</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Education Qualification</label>
              <select
                value={bulkEducation}
                onChange={(e) => setBulkEducation(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
              >
                <option value="No change">-- No change --</option>
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
                <option value="Tertiary">Tertiary</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Employment Status</label>
              <select
                value={bulkEmployment}
                onChange={(e) => setBulkEmployment(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
              >
                <option value="No change">-- No change --</option>
                <option value="Employed">Employed</option>
                <option value="Self-employed">Self-employed</option>
                <option value="Unemployed">Unemployed</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Training Status</label>
              <select
                value={bulkTrainingStatus}
                onChange={(e) => setBulkTrainingStatus(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
              >
                <option value="No change">-- No change --</option>
                <option value="On-going">On-going</option>
                <option value="Completed">Completed</option>
                <option value="Droped out">Droped out</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-[10px] text-slate-400 italic">
                Selected: <span className="font-bold text-indigo-600">{selectedIds.length}</span> trainees
              </div>
              <button
                type="button"
                onClick={handleApplyUpdates}
                disabled={selectedIds.length === 0}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xxs animate-in fade-in"
              >
                <Save className="w-4 h-4" />
                Apply Selected Changes
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Trainees Table Registry */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs xl:col-span-3 space-y-4 text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              Trainee Search & Filters
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={selectAllVisible}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Select/Deselect Page ({trainees.length})
              </button>
              <button
                onClick={selectAllMatching}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-lg transition cursor-pointer"
              >
                Select All Matching ({total})
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg transition cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search TVET ID, name, nin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <select
                value={cohortFilter}
                onChange={(e) => { setCohortFilter(e.target.value); setPage(1); }}
                className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Cohorts (Batches)</option>
                {cohortOptions.filter(o => o !== "all").map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={skillFilter}
                onChange={(e) => { setSkillFilter(e.target.value); setPage(1); }}
                className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Sectors / Skills</option>
                {skillOptions.filter(o => o !== "all").map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Training Statuses</option>
                <option value="On-going">On-going</option>
                <option value="Completed">Completed</option>
                <option value="Droped out">Droped out</option>
              </select>
            </div>
          </div>

          {/* Table container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-600 divide-y divide-slate-100">
              <thead className="bg-slate-50 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="p-3 w-10"></th>
                  <th scope="col" className="p-3">Trainee Name</th>
                  <th scope="col" className="p-3">TVET ID</th>
                  <th scope="col" className="p-3 text-center">Sex</th>
                  <th scope="col" className="p-3 text-center">PWD Status</th>
                  <th scope="col" className="p-3">Education</th>
                  <th scope="col" className="p-3">Stipend Account</th>
                  <th scope="col" className="p-3">Training Status</th>
                  <th scope="col" className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      Loading compliant data ledger...
                    </td>
                  </tr>
                ) : trainees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      No active trainees found matching your filters.
                    </td>
                  </tr>
                ) : (
                  trainees.map(t => {
                    const isSelected = selectedIds.includes(t.beneficiary_id);
                    return (
                      <tr 
                        key={t.beneficiary_id} 
                        className={`hover:bg-slate-50 transition ${isSelected ? "bg-indigo-50/20" : ""}`}
                      >
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectTrainee(t.beneficiary_id)}
                            className="text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {t.last_name}, {t.first_name} {t.other_name || ""}
                        </td>
                        <td className="p-3 font-mono text-slate-500 text-[10px]">
                          {t.tvet_id || t.beneficiary_id}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold text-[9px] ${
                            t.gender === "Female" ? "bg-pink-50 text-pink-600 border border-pink-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}>
                            {t.gender || "Male"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold text-[9px] ${
                            (t.physical_challenge === "Yes" || t.physical_challenge === "YES") ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-slate-100 text-slate-500"
                          }`}>
                            {(t.physical_challenge === "Yes" || t.physical_challenge === "YES") ? "YES" : "NO"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {t.education_level || "Secondary"}
                        </td>
                        <td className="p-3">
                          {t.bank_name ? (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-700 text-[11px] block">{t.bank_name}</span>
                              <span className="text-[10px] font-mono text-slate-400 block">{t.account_number}</span>
                            </div>
                          ) : (
                            <span className="text-amber-500 italic text-[11px]">No Bank Setup</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            t.training_status === "Completed" ? "bg-emerald-50 text-emerald-600" :
                            t.training_status === "Droped out" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                          }`}>
                            {t.training_status || "On-going"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleStartEditTrainee(t)}
                            className="p-1.5 text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition cursor-pointer flex items-center justify-center mx-auto"
                            title="Edit Compliance Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing <span className="font-bold">{(page - 1) * limit + 1}</span> to <span className="font-bold">{Math.min(page * limit, total)}</span> of <span className="font-bold">{total}</span> trainees
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        /* BANK SORT CODE RECONCILIATION MANAGER TAB */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Action / Settings Panel */}
          <div className="xl:col-span-1 space-y-6 text-left animate-in fade-in duration-350">
            {/* Reconciliation Authority & Commit Controls */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono pb-2 border-b border-slate-100 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                Reconciliation Action Hub
              </h4>

              <div className="space-y-3.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Selected For Reconcile</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-indigo-600 font-mono">{selectedReconIds.length}</span>
                    <span className="text-[10px] text-slate-500 font-medium font-mono">Trainee Records</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">
                    Authority Reference / Reason
                  </label>
                  <textarea
                    rows={4}
                    value={authRef}
                    onChange={(e) => setAuthRef(e.target.value)}
                    placeholder="Provide official authorization, board approval ref, or justification (required)..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500 text-xs resize-none"
                  />
                  <span className="text-[9.5px] text-slate-400 mt-1 block leading-normal">
                    This reference is persisted in compliance audit logs for federal treasury and program oversight.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={selectedReconIds.length === 0 || reconCommitting || !authRef.trim()}
                  onClick={handleCommitReconciliation}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  {reconCommitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Reconcile & Verify Selected
                </button>
              </div>
            </div>

            {/* Reconciliation Live Statistics */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono pb-2 border-b border-slate-100">
                Performance Dashboard
              </h4>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center p-2 rounded-lg bg-indigo-50/50 border border-indigo-100">
                  <span className="text-slate-600">Total Scoped:</span>
                  <span className="font-bold text-indigo-700">{reconPreviewList.length}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="text-slate-600">Matched:</span>
                  <span className="font-bold text-emerald-700">
                    {reconPreviewList.filter(x => x.status === "MATCHED").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                  <span className="text-slate-600">Mismatched:</span>
                  <span className="font-bold text-amber-700">
                    {reconPreviewList.filter(x => x.status === "MISMATCH").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                  <span className="text-slate-600">Unmatched:</span>
                  <span className="font-bold text-rose-700">
                    {reconPreviewList.filter(x => x.status === "UNMATCHED").length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Table list + Audit trail log */}
          <div className="xl:col-span-3 space-y-6 text-left animate-in fade-in duration-350">
            {/* Candidates Table Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-800">
                    Sort Code Alignment Roster
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review physical bank names, automatically query our authorized directory, and align discrepancies.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search trainee name..."
                      value={reconSearch}
                      onChange={(e) => setReconSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-medium text-slate-700 focus:bg-white focus:border-indigo-500 w-44"
                    />
                  </div>

                  {/* TSP Selector Filter */}
                  <div className="relative flex items-center">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <select
                      value={reconTsp}
                      onChange={(e) => setReconTsp(e.target.value)}
                      className="pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-medium text-slate-750 focus:bg-white focus:border-indigo-500 cursor-pointer appearance-none animate-none"
                    >
                      <option value="all">-- All TSPs --</option>
                      {reconTsps.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Selector Filter */}
                  <div className="relative flex items-center">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <select
                      value={reconStatus}
                      onChange={(e) => setReconStatus(e.target.value)}
                      className="pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-medium text-slate-750 focus:bg-white focus:border-indigo-500 cursor-pointer appearance-none animate-none"
                    >
                      <option value="all">-- All States --</option>
                      <option value="MATCHED">Matched (Correct)</option>
                      <option value="MISMATCH">Discrepancy (Mismatched)</option>
                      <option value="UNMATCHED">Unmapped Banks</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table rendering */}
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-400 text-[10px] uppercase">
                      <th className="p-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const mismatches = reconPreviewList.filter(x => x.status === "MISMATCH" && x.is_verified).map(x => x.beneficiary_id);
                            const allSelected = mismatches.length > 0 && mismatches.every(id => selectedReconIds.includes(id));
                            if (allSelected) {
                              setSelectedReconIds(prev => prev.filter(id => !mismatches.includes(id)));
                            } else {
                              setSelectedReconIds(prev => Array.from(new Set([...prev, ...mismatches])));
                            }
                          }}
                          className="hover:bg-slate-200 p-1 rounded transition text-indigo-600 flex items-center justify-center mx-auto"
                          title="Select / Deselect All Mismatches"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                      </th>
                      <th className="p-3">Trainee Profile</th>
                      <th className="p-3">Reported Bank Account</th>
                      <th className="p-3">Directory Lookup Match</th>
                      <th className="p-3">Audit Action</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {reconLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
                          Processing bank alignment preview indices...
                        </td>
                      </tr>
                    ) : reconPreviewList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                          No matching reconciliation records found for the current scopes.
                        </td>
                      </tr>
                    ) : (
                      reconPreviewList.map((item) => {
                        const isMismatch = item.status === "MISMATCH";
                        const isSelectable = isMismatch && item.is_verified;
                        const isChecked = selectedReconIds.includes(item.beneficiary_id);

                        return (
                          <tr key={item.beneficiary_id} className={`hover:bg-slate-50/50 transition ${isChecked ? "bg-indigo-50/20" : ""}`}>
                            <td className="p-3 text-center">
                              {isSelectable ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedReconIds(prev =>
                                      prev.includes(item.beneficiary_id)
                                        ? prev.filter(id => id !== item.beneficiary_id)
                                        : [...prev, item.beneficiary_id]
                                    );
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 transition flex items-center justify-center mx-auto"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <div className="text-slate-300 flex items-center justify-center">
                                  <Square className="w-4 h-4 opacity-30" />
                                </div>
                              )}
                            </td>
                            <td className="p-3 space-y-0.5">
                              <span className="font-bold text-slate-800 text-[12px] block text-left">
                                {item.last_name}, {item.first_name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block text-left">
                                TVET-ID: {item.tvet_id || "N/A"}
                              </span>
                            </td>
                            <td className="p-3 space-y-0.5 text-left">
                              <span className="text-slate-700 block font-semibold">{item.current_bank_name || <span className="italic text-rose-400 text-[11px]">No Bank Name</span>}</span>
                              <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                                <span className="text-slate-400">Sort Code:</span>
                                <span className="text-slate-500 font-bold bg-slate-100 px-1 py-0.5 rounded">{item.current_sort_code || "N/A"}</span>
                              </div>
                            </td>
                            <td className="p-3 space-y-0.5 text-left">
                              <span className={`font-semibold ${item.matched_canonical_bank_name === "N/A" ? "text-slate-400 italic" : "text-emerald-700"}`}>
                                {item.matched_canonical_bank_name}
                              </span>
                              {item.approved_sort_code !== "N/A" && (
                                <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                                  <span className="text-slate-400">Approved Code:</span>
                                  <span className="text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded">{item.approved_sort_code}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-left">
                              <span className="text-[11px] text-slate-500 max-w-[200px] block leading-normal font-medium">
                                {item.proposed_action}
                              </span>
                            </td>
                            <td className="p-3 text-left">
                              <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase font-mono border ${
                                item.status === "MATCHED"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-150"
                                  : item.status === "MISMATCH"
                                  ? "bg-amber-50 text-amber-600 border-amber-150 animate-pulse"
                                  : "bg-rose-50 text-rose-600 border-rose-150"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit History Logs Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2 text-left">
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-450">
                  Compliance Audit Trail Logs
                </h3>
                <p className="text-[11px] text-slate-400">
                  Historical archive of sort code realignments authorized by operators.
                </p>
              </div>

              <div className="max-h-[300px] overflow-y-auto border border-slate-150 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-400 text-[9px] uppercase">
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Trainee</th>
                      <th className="p-2.5">Bank Change Detail</th>
                      <th className="p-2.5">Operator (Approved By)</th>
                      <th className="p-2.5">Authority Reference / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 italic font-mono">
                          Retrieving alignment audit logs...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                          No audit trail records compiled in this database yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-2.5 font-mono text-slate-400 whitespace-nowrap text-left">
                            {new Date(log.changed_at).toLocaleString()}
                          </td>
                          <td className="p-2.5 space-y-0.5 text-left">
                            <span className="font-bold text-slate-800 block">
                              {log.last_name}, {log.first_name}
                            </span>
                            <span className="font-mono text-[9px] text-slate-400 block">
                              ID: {log.tvet_id || log.beneficiary_id}
                            </span>
                          </td>
                          <td className="p-2.5 space-y-0.5 text-left">
                            <span className="font-semibold text-slate-700 block">
                              {log.matched_canonical_bank_name || log.current_bank_name}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-mono">
                              <span className="text-slate-450 line-through">{log.old_sort_code || "N/A"}</span>
                              <span className="text-slate-400">➡</span>
                              <span className="text-emerald-600 font-bold">{log.new_sort_code}</span>
                            </div>
                          </td>
                          <td className="p-2.5 space-y-0.5 text-left">
                            <span className="font-bold text-slate-700 block">{log.changed_by}</span>
                            {log.tsp_name && (
                              <span className="px-1 py-0.5 bg-slate-100 rounded text-[9.5px] font-semibold text-slate-500 font-mono">
                                {log.tsp_name}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-500 max-w-xs truncate text-left" title={log.reason}>
                            {log.reason || "N/A"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BEFORE & AFTER PRE-COMMIT PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 text-left shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between pb-3 border-b border-slate-150">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Validate Compliance Modifications
                </h3>
                <p className="text-[11px] text-slate-400">
                  Carefully audit proposed before-and-after state transitions below.
                </p>
              </div>
              <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold font-mono rounded-lg text-[10px]">
                {selectedIds.length} Trainees Selected
              </span>
            </div>

            {/* Change Preview Summary Grid */}
            <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1">
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Proposed Shared State Values:</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px]">
                  {bulkSex !== "No change" && (
                    <div className="bg-white p-2 border border-slate-200 rounded-lg">
                      <span className="text-[9px] text-slate-400 block font-mono">Sex</span>
                      <span className="font-bold text-slate-800">➡ {bulkSex}</span>
                    </div>
                  )}
                  {bulkPwd !== "No change" && (
                    <div className="bg-white p-2 border border-slate-200 rounded-lg">
                      <span className="text-[9px] text-slate-400 block font-mono">PWD?</span>
                      <span className="font-bold text-slate-800">➡ {bulkPwd}</span>
                    </div>
                  )}
                  {bulkEducation !== "No change" && (
                    <div className="bg-white p-2 border border-slate-200 rounded-lg">
                      <span className="text-[9px] text-slate-400 block font-mono">Education</span>
                      <span className="font-bold text-slate-800">➡ {bulkEducation}</span>
                    </div>
                  )}
                  {bulkEmployment !== "No change" && (
                    <div className="bg-white p-2 border border-slate-200 rounded-lg">
                      <span className="text-[9px] text-slate-400 block font-mono">Employment</span>
                      <span className="font-bold text-slate-800">➡ {bulkEmployment}</span>
                    </div>
                  )}
                  {bulkTrainingStatus !== "No change" && (
                    <div className="bg-white p-2 border border-slate-200 rounded-lg">
                      <span className="text-[9px] text-slate-400 block font-mono">Training Status</span>
                      <span className="font-bold text-slate-800">➡ {bulkTrainingStatus}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">
                  Affected Trainees ({previewList.length}):
                </span>
                {previewList.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl italic text-[11px]">
                    No trainees will experience value changes (all matching elements already contain these selected state values).
                  </div>
                ) : (
                  <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                    {previewList.map(({ trainee, changes }) => (
                      <div key={trainee.beneficiary_id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 text-[11px] block">{trainee.last_name}, {trainee.first_name}</span>
                          <span className="text-[9.5px] text-slate-400 font-mono">{trainee.tvet_id || trainee.beneficiary_id}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {changes.map(ch => (
                            <span key={ch.field} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[9.5px] text-slate-700 leading-normal">
                              <strong>{ch.field}:</strong> <span className="text-rose-500 line-through">{ch.from}</span> ➡ <span className="text-emerald-600 font-bold">{ch.to}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-150 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-start gap-2 text-[10.5px] text-slate-500 leading-normal max-w-sm">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Confirming commits will update these profiles in the database. These changes are synchronized with federal reports immediately.
                </span>
              </div>
              <div className="sm:ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  disabled={committing}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commitUpdates}
                  disabled={committing}
                  className="py-2 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow-xxs"
                >
                  {committing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Commit Selected Updates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL TRAINEE COMPLIANCE EDIT MODAL */}
      {editingTrainee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 text-left shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between pb-3 border-b border-slate-150">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-800 flex items-center gap-2">
                  <Edit className="w-4 h-4 text-indigo-600" />
                  Edit Trainee Compliance Profile
                </h3>
                <p className="text-[11px] text-slate-400">
                  Update demographical records, stipend bank accounts, and guarantor data for federal audit reports.
                </p>
              </div>
              <button 
                onClick={() => setEditingTrainee(null)}
                className="p-1 rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile fields grouped nicely */}
            <div className="flex-1 overflow-y-auto my-4 space-y-5 pr-1 text-xs">
              {/* Demographics */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black font-mono text-slate-450 uppercase tracking-widest pb-1 border-b border-slate-100">
                  1. Trainee Identity & Demographics
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">First Name</label>
                    <input
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Other Names</label>
                    <input
                      type="text"
                      value={editOtherName}
                      onChange={(e) => setEditOtherName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Sex / Gender</label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">PWD Status (Physical challenge?)</label>
                    <select
                      value={editPwd}
                      onChange={(e) => setEditPwd(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">NIN (National ID Number)</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={editNin}
                      onChange={(e) => setEditNin(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-mono font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                      placeholder="11 digits"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">BVN (Bank Verification Number)</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={editBvn}
                      onChange={(e) => setEditBvn(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-mono font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                      placeholder="11 digits"
                    />
                  </div>
                </div>
              </div>

              {/* Education, Employment & Status */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black font-mono text-slate-450 uppercase tracking-widest pb-1 border-b border-slate-100">
                  2. Education, Employment & Roster Status
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Education Level</label>
                    <select
                      value={editEducationLevel}
                      onChange={(e) => setEditEducationLevel(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Primary">Primary</option>
                      <option value="Secondary">Secondary</option>
                      <option value="Tertiary">Tertiary</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Employment Status</label>
                    <select
                      value={editEmploymentStatus}
                      onChange={(e) => setEditEmploymentStatus(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Employed">Employed</option>
                      <option value="Self-employed">Self-employed</option>
                      <option value="Unemployed">Unemployed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Training Status</label>
                    <select
                      value={editTrainingStatus}
                      onChange={(e) => setEditTrainingStatus(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="On-going">On-going</option>
                      <option value="Completed">Completed</option>
                      <option value="Droped out">Droped out</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Stipend Banking details */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black font-mono text-slate-450 uppercase tracking-widest pb-1 border-b border-slate-100">
                  3. Stipend Bank Disbursement Details
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Bank Name (Searchable)</label>
                    <input
                      type="text"
                      placeholder="Start typing bank name..."
                      value={bankSearch}
                      onChange={(e) => {
                        setBankSearch(e.target.value);
                        setEditBankName(e.target.value);
                        setShowBankDropdown(true);
                      }}
                      onFocus={() => setShowBankDropdown(true)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                    {showBankDropdown && (
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50 divide-y divide-slate-100 text-xs">
                        {AUTHORITATIVE_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase())).map(b => (
                          <div
                            key={b.name}
                            onClick={() => {
                              setEditBankName(b.name);
                              setEditBankSortCode(b.sortCode);
                              setBankSearch(b.name);
                              setShowBankDropdown(false);
                            }}
                            className="p-2 hover:bg-indigo-50 cursor-pointer font-medium text-slate-700 transition"
                          >
                            {b.name} <span className="text-[10px] font-mono text-slate-400 float-right">Code: {b.sortCode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Bank Sort Code</label>
                    <input
                      type="text"
                      readOnly
                      value={editBankSortCode}
                      className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-250 rounded-lg outline-none font-mono font-medium text-slate-500"
                      placeholder="Auto-filled"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-mono font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                      placeholder="10 digits"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={editAccountName}
                      onChange={(e) => setEditAccountName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                      placeholder="Exactly as registered with bank"
                    />
                  </div>
                </div>
              </div>

              {/* Guardian / Guarantor Details */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black font-mono text-slate-450 uppercase tracking-widest pb-1 border-b border-slate-100">
                  4. Guardian & Guarantor Emergency Profile
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Guardian Full Name</label>
                    <input
                      type="text"
                      value={editGuardianName}
                      onChange={(e) => setEditingTrainee && setEditGuardianName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Guardian Phone</label>
                    <input
                      type="text"
                      value={editGuardianPhone}
                      onChange={(e) => setEditGuardianPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase font-mono mb-1">Guardian Residential Address</label>
                    <input
                      type="text"
                      value={editGuardianAddress}
                      onChange={(e) => setEditGuardianAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:bg-white focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-150 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
              <div className="flex items-start gap-2 text-[10.5px] text-slate-500 leading-normal max-w-sm">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Please double check bank details and NIN values. Incorrect entries will cause automated clearance failures during central treasury verification.
                </span>
              </div>
              <div className="sm:ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTrainee(null)}
                  disabled={committing}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTraineeProfile}
                  disabled={committing}
                  className="py-2 px-5 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  {committing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Profile Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
