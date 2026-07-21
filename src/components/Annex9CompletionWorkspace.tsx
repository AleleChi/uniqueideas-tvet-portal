/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Search, Check, Eye, Loader2, ChevronLeft, ChevronRight, Save, 
  Sparkles, Sliders, RefreshCw, AlertCircle, Info, Edit2, X
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

interface TraineeRow {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  physicalChallenge: string;
  educationQualification: string;
  bankName: string;
  bankAccountNumber: string;
  bankSortCode: string;
  bvn: string;
  status: string;
}

const BANK_DIRECTORY = [
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

const GENDER_OPTIONS = [
  { value: "", label: "Blank / Incomplete" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" }
];

const DISABILITY_OPTIONS = [
  { value: "", label: "Blank / Incomplete" },
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" }
];

const EDUCATION_OPTIONS = [
  { value: "", label: "Blank / Incomplete" },
  { value: "Primary", label: "Primary" },
  { value: "Secondary", label: "Secondary" },
  { value: "Tertiary", label: "Tertiary" }
];

const APPROVED_3_DIGIT_CODES: Record<string, string> = {
  "Access Bank": "044",
  "Ecobank Nigeria": "050",
  "Fidelity Bank": "070",
  "First Bank of Nigeria": "011",
  "First Bank": "011",
  "First City Monument Bank": "214",
  "FCMB": "214",
  "Guaranty Trust Bank": "058",
  "Stanbic IBTC Bank": "039",
  "Stanbic IBTC": "039",
  "Standard Chartered Bank": "068",
  "Standard Chartered": "068",
  "Sterling Bank": "232",
  "United Bank for Africa": "033",
  "UBA": "033",
  "UBA / United Bank for Africa": "033",
  "Union Bank of Nigeria": "032",
  "Union Bank": "032",
  "Unity Bank": "215",
  "Wema Bank": "035",
  "Zenith Bank": "057"
};

function getApproved3DigitCode(bankName: string): string | null {
  const norm = String(bankName || "").toLowerCase().trim();
  for (const [key, value] of Object.entries(APPROVED_3_DIGIT_CODES)) {
    const kNorm = key.toLowerCase();
    if (kNorm === norm || norm.includes(kNorm) || kNorm.includes(norm)) {
      return value;
    }
  }
  return null;
}

function areSortCodesMatching(rowCode: string, bankName: string, directory: any[]): boolean {
  const cleanRow = String(rowCode || "").trim();
  if (!cleanRow) return false;

  const approved3 = getApproved3DigitCode(bankName);
  if (approved3 && cleanRow === approved3) return true;

  const official9 = getOfficialSortCode(bankName, directory);
  if (official9) {
    if (cleanRow === official9) return true;
    if (cleanRow.length === 3 && official9.startsWith(cleanRow)) return true;
    if (official9.length === 3 && cleanRow.startsWith(official9)) return true;
  }
  return false;
}

function getOfficialSortCode(bankName: string, directory: { name: string; sortCode: string }[]): string {
  const norm = String(bankName || "").toLowerCase().trim();
  const found = directory.find(b => {
    const bNorm = b.name.toLowerCase();
    return bNorm.includes(norm) || norm.includes(bNorm) || 
      (norm.includes("gtb") && bNorm.includes("guaranty")) ||
      (norm.includes("uba") && bNorm.includes("united bank")) ||
      (norm.includes("fcmb") && bNorm.includes("monument")) ||
      (norm.includes("first bank") && bNorm.includes("first bank")) ||
      (norm.includes("union") && bNorm.includes("union")) ||
      (norm.includes("fidelity") && bNorm.includes("fidelity")) ||
      (norm.includes("eco") && bNorm.includes("eco")) ||
      (norm.includes("sterling") && bNorm.includes("sterling")) ||
      (norm.includes("stanbic") && bNorm.includes("stanbic")) ||
      (norm.includes("wema") && bNorm.includes("wema")) ||
      (norm.includes("keystone") && bNorm.includes("keystone")) ||
      (norm.includes("polaris") && bNorm.includes("polaris"));
  });
  return found ? found.sortCode : "";
}

function maskBvn(bvn: string): string {
  if (!bvn) return "Incomplete";
  const clean = String(bvn).trim();
  if (clean.length < 11) return clean;
  return `${clean.substring(0, 3)}*****${clean.substring(7)}`;
}

function maskAccountNumber(accNum: string): string {
  if (!accNum) return "Incomplete";
  const clean = String(accNum).trim();
  if (clean.length < 4) return clean;
  return `******${clean.substring(clean.length - 4)}`;
}

function normalizeSex(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "M" || s === "MALE") return "Male";
  if (s === "F" || s === "FEMALE") return "Female";
  return "";
}

function normalizePwd(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "NONE" || s === "NONE (NO DISABILITY)" || s === "NO DISABILITY (NONE)" || s === "NO DISABILITY" || s === "NULL" || s === "UNDEFINED" || s === "N/A" || s === "") {
    return "";
  }
  if (s === "TRUE" || s === "1" || s === "YES") return "Yes";
  if (s === "FALSE" || s === "0" || s === "NO") return "No";
  return "Yes";
}

function normalizeEducation(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (s === "" || s === "NONE" || s === "NO FORMAL EDUCATION" || s === "NULL" || s === "UNDEFINED" || s === "N/A") {
    return "";
  }
  
  const tertiaryKeywords = ["BSC", "HND", "ND", "NCE", "UNIVERSITY", "POLYTECHNIC", "COLLEGE", "B.SC", "B.A", "BA", "PGD", "MASTERS", "B.TECH", "BTECH", "H.N.D", "B.CS", "B.ED", "BSC ED.", "BENG", "OND", "TERTIARY"];
  const secondaryKeywords = ["SSCE", "WAEC", "NECO", "SECONDARY", "SCCE"];
  const primaryKeywords = ["PRIMARY", "FLSC"];
  
  if (tertiaryKeywords.some(kw => s.includes(kw))) return "Tertiary";
  if (secondaryKeywords.some(kw => s.includes(kw))) return "Secondary";
  if (primaryKeywords.some(kw => s.includes(kw))) return "Primary";
  
  return ""; 
}

export function Annex9CompletionWorkspace() {
  const [candidates, setCandidates] = useState<TraineeRow[]>([]);
  const [bankDirectory, setBankDirectory] = useState<{ name: string; sortCode: string }[]>(BANK_DIRECTORY);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Editing Row State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TraineeRow | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await authFetch("/api/bank-reconciliation/banks");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setBankDirectory(data.map((b: any) => ({
              name: b.canonical_bank_name,
              sortCode: b.approved_sort_code
            })));
          }
        }
      } catch (err) {
        console.error("Failed to load canonical bank directory:", err);
      }
    };
    fetchBanks();
  }, []);

  const fetchTrainees = async () => {
    try {
      setLoading(true);
      const url = `/api/beneficiaries?page=${page}&limit=${pageSize}&search=${encodeURIComponent(searchTerm)}`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.results || []);
        const total = Array.isArray(data) ? data.length : (data.total || items.length);
        
        setCandidates(items.map((b: any) => ({
          id: b.id,
          firstName: b.firstName || b.first_name || "",
          lastName: b.lastName || b.last_name || "",
          gender: normalizeSex(b.gender || b.gender_id),
          physicalChallenge: normalizePwd(b.physicalChallenge || b.physical_challenge),
          educationQualification: normalizeEducation(b.educationQualification || b.education_qualification),
          bankName: b.bankName || b.bank_name || "Access Bank",
          bankAccountNumber: b.bankAccountNumber || b.bank_account_number || "",
          bankSortCode: b.bankSortCode || b.bank_sort_code || "",
          bvn: b.bvn || "",
          status: b.status || ""
        })));
        setTotalCount(total);
      }
    } catch (err) {
      console.error("Error fetching trainees:", err);
      triggerToast("Failed to fetch trainees list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainees();
  }, [page, pageSize]);

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setPage(1);
      fetchTrainees();
    }
  };

  const startEditing = (row: TraineeRow) => {
    setEditingId(row.id);
    setEditForm({ ...row });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleFieldChange = (field: keyof TraineeRow, value: string) => {
    if (!editForm) return;
    
    if (field === "bankName") {
      const officialSortCode = getApproved3DigitCode(value) || getOfficialSortCode(value, bankDirectory);
      const currentSortCode = editForm.bankSortCode;
      
      if (currentSortCode && officialSortCode && currentSortCode !== officialSortCode) {
        // Keeps current sort code if it is already non-empty and different, allowing user-guided confirmation
        setEditForm({
          ...editForm,
          bankName: value
        });
      } else {
        setEditForm({
          ...editForm,
          bankName: value,
          bankSortCode: officialSortCode || currentSortCode
        });
      }
    } else {
      setEditForm({
        ...editForm,
        [field]: value
      });
    }
  };

  const saveRow = async (id: string) => {
    if (!editForm) return;
    try {
      setSavingId(id);
      
      const updatePayload = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        gender: editForm.gender,
        physicalChallenge: editForm.physicalChallenge,
        educationQualification: editForm.educationQualification,
        bankName: editForm.bankName,
        bankAccountNumber: editForm.bankAccountNumber,
        bankSortCode: editForm.bankSortCode,
        bvn: editForm.bvn
      };

      const res = await authFetch(`/api/beneficiaries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        triggerToast(`Updated details for ${editForm.firstName} ${editForm.lastName} successfully!`);
        setCandidates(candidates.map(c => c.id === id ? { ...editForm } : c));
        cancelEditing();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update candidate");
      }
    } catch (err: any) {
      console.error("Save error:", err);
      triggerToast(err.message || "Could not save candidate data", "error");
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div id="annex9_completion_workspace" className="space-y-6 max-w-7xl mx-auto p-1 font-sans">
      
      {/* Toast Alert */}
      {toast && (
        <div id="completion_toast" className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        }`}>
          <Check className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold font-mono uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div id="annex9_completion_header" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Annex 9 Data Completion & Normalization
          </h2>
          <p className="text-xs text-slate-500">
            Review, correct, and save critical reporting parameters for official audits. Changes are committed directly to database state.
          </p>
        </div>
        
        {/* Search controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="annex9_search_input"
              type="text"
              placeholder="Search by candidate name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="pl-9 pr-4 py-1.5 w-64 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>
          <button
            id="annex9_search_btn"
            onClick={() => { setPage(1); fetchTrainees(); }}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            Filter
          </button>
          <button
            id="annex9_refresh_btn"
            onClick={fetchTrainees}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SpreadSheet Grid Table Component */}
      <div id="annex9_grid_container" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Loading Spreadsheet Registry...</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-24 text-center space-y-2">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-400">No candidate records found matching current search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-55 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  <th className="py-3 px-4">Trainee Name</th>
                  <th className="py-3 px-4">Sex</th>
                  <th className="py-3 px-4">PWD?</th>
                  <th className="py-3 px-4">Educational Qualification</th>
                  <th className="py-3 px-4">Bank Name</th>
                  <th className="py-3 px-4">Bank Sort Code</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4">BVN</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs font-medium text-slate-700">
                {candidates.map((row) => {
                  const isEditing = editingId === row.id;
                  
                  return (
                    <tr 
                      key={row.id} 
                      className={`hover:bg-slate-50/50 transition duration-150 ${isEditing ? "bg-indigo-50/40" : ""}`}
                    >
                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={editForm?.firstName || ""}
                              onChange={(e) => handleFieldChange("firstName", e.target.value)}
                              className="w-24 bg-white border border-slate-250 rounded px-1.5 py-0.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <input
                              type="text"
                              value={editForm?.lastName || ""}
                              onChange={(e) => handleFieldChange("lastName", e.target.value)}
                              className="w-24 bg-white border border-slate-250 rounded px-1.5 py-0.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ) : (
                          <span>{row.firstName} {row.lastName}</span>
                        )}
                      </td>

                      {/* Sex Dropdown */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editForm?.gender || ""}
                            onChange={(e) => handleFieldChange("gender", e.target.value)}
                            className="bg-white border border-slate-250 rounded px-1 py-0.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {GENDER_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.gender === "Female" ? "bg-pink-50 text-pink-700" : row.gender === "Male" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600 font-mono"
                          }`}>
                            {row.gender || "Incomplete"}
                          </span>
                        )}
                      </td>

                      {/* Disability / Challenge Dropdown */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editForm?.physicalChallenge || ""}
                            onChange={(e) => handleFieldChange("physicalChallenge", e.target.value)}
                            className="bg-white border border-slate-250 rounded px-1 py-0.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {DISABILITY_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.physicalChallenge === "Yes" ? "bg-emerald-50 text-emerald-700" : row.physicalChallenge === "No" ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-600 font-mono"
                          }`}>
                            {row.physicalChallenge || "Incomplete"}
                          </span>
                        )}
                      </td>

                      {/* Education Dropdown */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editForm?.educationQualification || ""}
                            onChange={(e) => handleFieldChange("educationQualification", e.target.value)}
                            className="bg-white border border-slate-250 rounded px-1 py-0.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {EDUCATION_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`font-semibold ${
                            row.educationQualification ? "text-slate-600" : "text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                          }`}>
                            {row.educationQualification || "Incomplete"}
                          </span>
                        )}
                      </td>

                      {/* Bank Name */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editForm?.bankName || "Access Bank"}
                            onChange={(e) => handleFieldChange("bankName", e.target.value)}
                            className="bg-white border border-slate-250 rounded px-1 py-0.5 font-semibold text-slate-800 w-36 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {bankDirectory.map(bank => (
                              <option key={bank.name} value={bank.name}>{bank.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-600 font-semibold">{row.bankName}</span>
                        )}
                      </td>

                      {/* Bank Sort Code */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 w-28">
                            <input
                              type="text"
                              maxLength={15}
                              value={editForm?.bankSortCode || ""}
                              onChange={(e) => handleFieldChange("bankSortCode", e.target.value.replace(/\D/g, ""))}
                              className="bg-white border border-slate-250 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                            />
                            {editForm && !areSortCodesMatching(editForm.bankSortCode, editForm.bankName, bankDirectory) && (getApproved3DigitCode(editForm.bankName) || getOfficialSortCode(editForm.bankName, bankDirectory)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const official = getApproved3DigitCode(editForm.bankName) || getOfficialSortCode(editForm.bankName, bankDirectory);
                                  handleFieldChange("bankSortCode", official);
                                }}
                                className="text-[9px] text-indigo-600 hover:text-indigo-850 font-bold uppercase tracking-wider text-left underline cursor-pointer"
                              >
                                Autofill Official
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-[11px] font-bold ${
                              row.bankSortCode ? "text-slate-700" : "text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                            }`}>
                              {row.bankSortCode || "Incomplete"}
                            </span>
                            {row.bankSortCode && !areSortCodesMatching(row.bankSortCode, row.bankName, bankDirectory) && (
                              <span 
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200"
                                title={`Mismatch: Official is ${getApproved3DigitCode(row.bankName) || getOfficialSortCode(row.bankName, bankDirectory)}`}
                              >
                                Mismatch
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Account Number */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={10}
                            value={editForm?.bankAccountNumber || ""}
                            onChange={(e) => handleFieldChange("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
                            className="bg-white border border-slate-250 rounded px-1.5 py-0.5 w-24 font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className={`font-mono text-[11px] font-bold ${
                            row.bankAccountNumber ? "text-slate-700" : "text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                          }`}>
                            {maskAccountNumber(row.bankAccountNumber)}
                          </span>
                        )}
                      </td>

                      {/* BVN */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={11}
                            value={editForm?.bvn || ""}
                            onChange={(e) => handleFieldChange("bvn", e.target.value.replace(/\D/g, ""))}
                            className="bg-white border border-slate-250 rounded px-1.5 py-0.5 w-28 font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className={`font-mono text-[11px] font-bold ${
                            row.bvn ? "text-slate-700" : "text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                          }`}>
                            {maskBvn(row.bvn)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              id={`save_row_${row.id}`}
                              disabled={savingId === row.id}
                              onClick={() => saveRow(row.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition cursor-pointer"
                              title="Save Changes"
                            >
                              {savingId === row.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              id={`cancel_edit_${row.id}`}
                              onClick={cancelEditing}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition cursor-pointer"
                              title="Cancel Editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`start_edit_${row.id}`}
                            onClick={() => startEditing(row)}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded transition cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer pagination */}
        {!loading && candidates.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>Showing page {page} of {totalPages} (Total Records: {totalCount})</span>
            <div className="flex items-center gap-1">
              <button
                id="pagination_prev_btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                id="pagination_next_btn"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
