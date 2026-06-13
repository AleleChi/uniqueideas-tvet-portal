/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Search, Award, Calendar, User, FileText, AlertCircle, 
  ChevronLeft, ChevronRight, X, Loader2, RefreshCw, BarChart2
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface Assessment {
  id: string;
  tenantId: string | null;
  beneficiaryId: string;
  trainerId: string;
  assessmentName: string;
  continuousAssessmentScore: number | string | null;
  practicalScore: number | string | null;
  examScore: number | string | null;
  finalScore: number | string | null;
  finalGrade: string | null;
  examinerComments: string | null;
  examDate: string | null;
  status: string;
  beneficiaryFirstName?: string;
  beneficiaryLastName?: string;
  trainerFirstName?: string;
  trainerLastName?: string;
}

export function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists for dropdown selections
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);

  // Search & Filtration
  const [searchTerm, setSearchTerm] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Submit Form States
  const [formBeneficiaryId, setFormBeneficiaryId] = useState("");
  const [formTrainerId, setFormTrainerId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCaScore, setFormCaScore] = useState<number>(0);
  const [formPracticalScore, setFormPracticalScore] = useState<number>(0);
  const [formExamScore, setFormExamScore] = useState<number>(0);
  const [formComments, setFormComments] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStatus, setFormStatus] = useState("APPROVED");

  const loadDependencies = async () => {
    try {
      // 1. Fetch beneficiaries
      const benRes = await authFetch("/api/beneficiaries");
      if (benRes.ok) {
        const bData = await benRes.json();
        setBeneficiaries(Array.isArray(bData) ? bData : []);
      }

      // 2. Fetch trainers
      const trainersRes = await authFetch("/api/trainers?page=1&pageSize=100");
      if (trainersRes.ok) {
        const tData = await trainersRes.json();
        setTrainers(tData.rows || []);
      }
    } catch (e) {
      console.error("[AssessmentsPage] Error loading dependent lists:", e);
    }
  };

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/assessments?page=${page}&pageSize=${pageSize}`;
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load assessments ledger. Status code: ${res.status}`);
      }
      const data = await res.json();
      const rowsList = data.rows || [];

      // Appy local custom filters for real-time search, score, and assessment types
      let finalRows = rowsList;
      if (searchTerm.trim() || scoreFilter || typeFilter) {
        finalRows = rowsList.filter((a: Assessment) => {
          const matchSearch = !searchTerm.trim() ||
            a.assessmentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${a.beneficiaryFirstName} ${a.beneficiaryLastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${a.trainerFirstName} ${a.trainerLastName}`.toLowerCase().includes(searchTerm.toLowerCase());

          const finalVal = parseFloat(a.finalScore?.toString() || "0");
          let matchScore = true;
          if (scoreFilter === "EXCELLENT") matchScore = finalVal >= 75;
          else if (scoreFilter === "PASS") matchScore = finalVal >= 50 && finalVal < 75;
          else if (scoreFilter === "FAIL") matchScore = finalVal < 50;

          let matchType = true;
          if (typeFilter) {
            matchType = a.assessmentName?.toLowerCase().includes(typeFilter.toLowerCase());
          }

          return matchSearch && matchScore && matchType;
        });
      }

      setAssessments(finalRows);
      setTotalCount(searchTerm.trim() || scoreFilter || typeFilter ? finalRows.length : (data.totalCount || 0));
      setTotalPages(searchTerm.trim() || scoreFilter || typeFilter ? Math.ceil(finalRows.length / pageSize) : (data.totalPages || 1));
    } catch (e: any) {
      console.error("[AssessmentsPage] Failed to fetch assessments ledger:", e);
      setError(e.message || "Failed to load national assessments ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
    fetchAssessments();
  }, [page, pageSize, scoreFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAssessments();
  };

  const handleOpenSubmit = () => {
    setFormBeneficiaryId(beneficiaries[0]?.id || "");
    setFormTrainerId(trainers[0]?.id || "");
    setFormName("Continuous Assessment 1");
    setFormCaScore(0);
    setFormPracticalScore(0);
    setFormExamScore(0);
    setFormComments("");
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormStatus("APPROVED");
    setSubmitError(null);
    setIsSubmitOpen(true);
  };

  // POST Create Assessment
  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBeneficiaryId || !formTrainerId || !formName) {
      setSubmitError("Beneficiary, Trainer, and Assessment Name are required parameters.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Sum scores
    const cScore = parseFloat(formCaScore.toString()) || 0;
    const pScore = parseFloat(formPracticalScore.toString()) || 0;
    const eScore = parseFloat(formExamScore.toString()) || 0;
    const finalVal = cScore + pScore + eScore;

    // Estimate Letter grade
    let grade = "F";
    if (finalVal >= 75) grade = "A";
    else if (finalVal >= 60) grade = "B";
    else if (finalVal >= 50) grade = "C";

    try {
      const res = await authFetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: formBeneficiaryId,
          trainerId: formTrainerId,
          assessmentName: formName,
          continuousAssessmentScore: cScore,
          practicalScore: pScore,
          examScore: eScore,
          finalScore: finalVal,
          finalGrade: grade,
          examinerComments: formComments || null,
          examDate: formDate || null,
          status: formStatus
        })
      });

      if (!res.ok) {
        const detail = await res.json();
        throw new Error(detail.error || "Failed to commit performance grades.");
      }

      setIsSubmitOpen(false);
      fetchAssessments();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="assessments-page-container" className="space-y-6 animate-in fade-in duration-300 text-left">
      
      {/* Title & Submit Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Assessments ledger
          </h2>
          <p className="text-xs sm:text-sm text-slate-550 text-slate-500 mt-0.5">
            Audit continuous assessments and practical grading sheets nationwide under IDEAS-TVET standards.
          </p>
        </div>
        <button
          onClick={handleOpenSubmit}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Record compliance assessment</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* filtration and search headers */}
      <div className="bg-white border border-slate-205 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by assessment, trainee or trainer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/40 focus:bg-white border border-slate-205 focus:border-indigo-500 rounded-lg outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-205 hover:bg-slate-50 active:bg-slate-100 rounded-lg shadow-3xs transition cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2.5">
          {/* Score filter */}
          <select
            value={scoreFilter}
            onChange={(e) => { setScoreFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-350 transition"
          >
            <option value="">Score Performance</option>
            <option value="EXCELLENT">Excellent (75%+)</option>
            <option value="PASS">Pass (50%-74%)</option>
            <option value="FAIL">Fail (&lt;50%)</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-xs outline-none text-slate-600 hover:border-slate-350 transition"
          >
            <option value="">Assessment Type</option>
            <option value="continuous">Continuous Assessment</option>
            <option value="practical">Practical exam</option>
            <option value="exam">Written final</option>
          </select>

          <button
            onClick={fetchAssessments}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-205 bg-white text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Synchronize database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Assessments data tables */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Trainee / Benficiary</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Assessment Detail</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Examiner / Trainer</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Grading (CA/Prac/Exam)</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">cumulative score</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Grade</th>
                <th className="px-5 py-3.5 text-[11px] font-bold font-mono uppercase tracking-widest text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-450">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-650" />
                      <span className="font-semibold text-slate-500">Scanning ledger tables...</span>
                    </div>
                  </td>
                </tr>
              ) : assessments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No matching student score records entered.
                  </td>
                </tr>
              ) : (
                assessments.map((a) => {
                  const rawScoreVal = parseFloat(a.finalScore?.toString() || "0");
                  const scoreColor = rawScoreVal >= 75 
                    ? "text-emerald-700 font-bold" 
                    : rawScoreVal >= 50 
                    ? "text-indigo-600 font-medium" 
                    : "text-rose-500 font-semibold";
                  
                  return (
                    <tr key={a.id} className="hover:bg-slate-55/50 hover:bg-slate-50/50 transition duration-150">
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {a.beneficiaryFirstName || "Unassigned"} {a.beneficiaryLastName || "Trainee"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-750">{a.assessmentName}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(a.examDate)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {a.trainerFirstName ? `Engr. ${a.trainerFirstName} ${a.trainerLastName}` : "Compliance Administrator"}
                      </td>
                      <td className="px-5 py-4 text-slate-550 font-mono">
                        CA: {a.continuousAssessmentScore || 0} | PR: {a.practicalScore || 0} | EX: {a.examScore || 0}
                      </td>
                      <td className="px-5 py-4 font-mono text-center">
                        <span className={`text-sm ${scoreColor}`}>{a.finalScore || 0}</span>
                        <span className="text-[10px] text-slate-400"> / 100</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block font-mono font-bold text-[13px] border border-slate-100 rounded px-2.5 py-0.5 bg-slate-50 ${
                          a.finalGrade === 'A' ? 'text-emerald-600' : a.finalGrade === 'B' ? 'text-indigo-600' : a.finalGrade === 'C' ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {a.finalGrade || "F"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
                          a.status === "APPROVED" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination indicators */}
        {!loading && totalCount > 0 && (
          <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-450 font-semibold uppercase tracking-wider">
              Displaying graded listings {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-205 bg-white text-slate-600 rounded-md transition cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono text-xs font-bold text-slate-705">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-205 bg-white text-slate-600 rounded-md transition cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECORD COMPLIANCE GRADE SHEET MODAL */}
      {isSubmitOpen && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Record trainee metrics</h3>
              <button onClick={() => setIsSubmitOpen(false)} className="text-slate-400 hover:text-slate-750 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitAssessment} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-755 p-2.5 rounded-lg text-[10px] leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Active Beneficiary / Trainee *</label>
                <select
                  value={formBeneficiaryId}
                  onChange={(e) => setFormBeneficiaryId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                >
                  <option value="">Select Trainee...</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>{b.first_name} {b.last_name} ({b.state})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Assigned Examiner *</label>
                  <select
                    value={formTrainerId}
                    onChange={(e) => setFormTrainerId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Trainer...</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Assessment Phase *</label>
                  <select
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="Continuous Assessment 1">Continuous Assessment 1</option>
                    <option value="Continuous Assessment 2">Continuous Assessment 2</option>
                    <option value="Practical Examination Phase A">Practical Examination Phase A</option>
                    <option value="Practical Examination Phase B">Practical Examination Phase B</option>
                    <option value="Written Final Examination">Written Final Examination</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-605 text-[10px] uppercase">CA score (40)</label>
                  <input
                    type="number"
                    max={40}
                    min={0}
                    value={formCaScore}
                    onChange={(e) => setFormCaScore(Math.min(40, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full px-2 py-1.5 border border-slate-205 bg-white rounded-md text-center font-mono focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-605 text-[10px] uppercase">Practical (30)</label>
                  <input
                    type="number"
                    max={30}
                    min={0}
                    value={formPracticalScore}
                    onChange={(e) => setFormPracticalScore(Math.min(30, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full px-2 py-1.5 border border-slate-205 bg-white rounded-md text-center font-mono focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-605 text-[10px] uppercase">Written (30)</label>
                  <input
                    type="number"
                    max={30}
                    min={0}
                    value={formExamScore}
                    onChange={(e) => setFormExamScore(Math.min(30, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full px-2 py-1.5 border border-slate-205 bg-white rounded-md text-center font-mono focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Exam Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Approval State</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-205 bg-white rounded-lg outline-none focus:border-indigo-500"
                  >
                    <option value="APPROVED">APPROVED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Examiner Feedback / Comments</label>
                <textarea
                  placeholder="Review student repair metrics, adherence to safety..."
                  value={formComments}
                  onChange={(e) => setFormComments(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-205 bg-white rounded-lg outline-none h-16 resize-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2.5 font-sans">
                <button
                  type="button"
                  onClick={() => setIsSubmitOpen(false)}
                  className="px-4 py-2 border border-slate-205 text-slate-600 hover:bg-slate-50 duration-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Save Metrics"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
