import React, { useState, useEffect } from "react";
import { authFetch } from "../utils/authFetch";
import { 
  FileText, ShieldCheck, Clock, CheckCircle2, RotateCcw, Lock, Edit, Plus, Eye,
  ArrowRight, AlertOctagon, HelpCircle, Send, Check, X, FilePlus, RefreshCw
} from "lucide-react";

interface Submission {
  id: string;
  report_type: string;
  tsp_id: string;
  state_id: string | null;
  title: string;
  period: string;
  payload: any;
  status: "DRAFT" | "SUBMITTED" | "RECOMMENDED" | "APPROVED" | "LOCKED" | "RETURNED";
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  recommendation: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  tsp_name: string | null;
  state_name: string | null;
}

interface AuditLog {
  id: string;
  submission_id: string;
  action: string;
  actor_email: string;
  actor_role: string;
  from_status: string | null;
  to_status: string;
  remarks: string | null;
  created_at: string;
}

interface GovernanceSubmissionsProps {
  session: any;
}

export default function GovernanceSubmissions({ session }: GovernanceSubmissionsProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Audits logs overlay
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  
  // New/Edit Draft Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("ATTENDANCE");
  const [formPeriod, setFormPeriod] = useState("June 2026");
  const [formPayload, setFormPayload] = useState('{\n  "totalTrainees": 50,\n  "averageAttendance": "92%",\n  "toolkitsDistributed": 12,\n  "complianceChecklistPassed": true\n}');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Review transitions action
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null);
  const [reviewAction, setReviewAction] = useState<"SUBMIT" | "RECOMMEND" | "APPROVE" | "LOCK" | "RETURN" | "OVERRIDE" | "">("");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("APPROVED");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/submissions");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to load governance registry.");
      }
    } catch (e) {
      setError("Network error connecting to governance pipeline.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditHistory = async (sub: Submission) => {
    setSelectedSubmission(sub);
    setLoadingAudits(true);
    try {
      const res = await authFetch(`/api/submissions/${sub.id}/audits`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.audits || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudits(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    
    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(formPayload);
    } catch (err) {
      setFormError("Invalid JSON metrics structure. Please check bracket formatting.");
      setFormSubmitting(false);
      return;
    }

    try {
      const res = await authFetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formId,
          title: formTitle,
          reportType: formType,
          period: formPeriod,
          payload: parsedPayload
        })
      });

      if (res.ok) {
        setIsFormOpen(false);
        setFormId(null);
        setFormTitle("");
        setFormPayload('{\n  "totalTrainees": 50,\n  "averageAttendance": "92%",\n  "toolkitsDistributed": 12,\n  "complianceChecklistPassed": true\n}');
        fetchSubmissions();
      } else {
        const err = await res.json();
        setFormError(err.error || "Failed to save drafted report.");
      }
    } catch (err) {
      setFormError("Server timeout saving draft report.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleApplyTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewSubmission || !reviewAction) return;
    setReviewError(null);
    setReviewSubmitting(true);

    try {
      const res = await authFetch(`/api/submissions/${reviewSubmission.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          remarks: reviewRemarks,
          overrideStatus: reviewAction === "OVERRIDE" ? overrideStatus : undefined
        })
      });

      if (res.ok) {
        setIsReviewOpen(false);
        setReviewSubmission(null);
        setReviewAction("");
        setReviewRemarks("");
        fetchSubmissions();
      } else {
        const err = await res.json();
        setReviewError(err.error || "Governance transition criteria not satisfied.");
      }
    } catch (err) {
      setReviewError("Network error while submitting transition.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openEditDraft = (sub: Submission) => {
    setFormId(sub.id);
    setFormTitle(sub.title);
    setFormType(sub.report_type);
    setFormPeriod(sub.period);
    setFormPayload(JSON.stringify(sub.payload, null, 2));
    setFormError(null);
    setIsFormOpen(true);
  };

  const openReviewModal = (sub: Submission, action: "SUBMIT" | "RECOMMEND" | "APPROVE" | "LOCK" | "RETURN" | "OVERRIDE") => {
    setReviewSubmission(sub);
    setReviewAction(action);
    setReviewRemarks("");
    setReviewError(null);
    setIsReviewOpen(true);
  };

  // Status badges colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider">DRAFT</span>;
      case "SUBMITTED":
        return <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider">SUBMITTED</span>;
      case "RECOMMENDED":
        return <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider font-display">RECOMMENDED</span>;
      case "APPROVED":
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-250 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider">APPROVED</span>;
      case "LOCKED":
        return <span className="bg-indigo-950 text-indigo-100 border border-indigo-900 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider flex items-center gap-1"><Lock className="w-3 h-3" /> LOCKED</span>;
      case "RETURNED":
        return <span className="bg-amber-100 text-amber-800 border border-amber-250 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider">RETURNED</span>;
      default:
        return <span className="bg-slate-150 px-2.5 py-1 rounded-full text-xs font-mono">{status}</span>;
    }
  };

  const isTsp = session?.role === "TSP" || session?.role?.startsWith("TSP");
  const isSta = session?.role === "STA" || session?.role?.startsWith("STA");
  const isFed = session?.role === "FED" || session?.role?.startsWith("FED") || session?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 font-display">Oversight Governance Submissions Desk</h2>
          <p className="text-xs text-slate-500 font-mono">
            State-audited workflow pipeline governing attendance sheets, assessments, and distribution reports.
          </p>
        </div>
        
        {isTsp && (
          <button
            onClick={() => {
              setFormId(null);
              setFormTitle("");
              setFormType("ATTENDANCE");
              setFormPeriod("June 2026");
              setFormPayload('{\n  "totalTrainees": 50,\n  "averageAttendance": "92%",\n  "toolkitsDistributed": 12,\n  "complianceChecklistPassed": true\n}');
              setFormError(null);
              setIsFormOpen(true);
            }}
            className="bg-indigo-600 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs font-mono tracking-wider flex items-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            COMPILE REPORT DRAFT
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs font-mono">
          <AlertOctagon className="w-4.5 h-4.5 shrink-0 text-rose-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: left submissions table ledger, right side dynamic tracker or auditor logs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left 8 Cols: List */}
        <div className="xl:col-span-8 bg-white border border-slate-250 rounded-2xl shadow-xs overflow-hidden">
          <div className="bg-slate-50/50 p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-indigo-950 uppercase font-mono tracking-wider leading-none">
              Governance Reports List
            </h3>
            <button
              onClick={fetchSubmissions}
              className="p-1 px-2 hover:bg-slate-200 rounded text-[11px] font-mono text-indigo-750 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400">
              Querying central TVET registries...
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-slate-500 border-2 border-dashed border-slate-100 rounded-b-2xl">
              No reports registered for this organizational workspace yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase font-mono tracking-wide">
                    <th className="py-3 px-4">Title / Period</th>
                    <th className="py-3 px-4">Report Type</th>
                    <th className="py-3 px-4">Institution</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {submissions.map((sub) => {
                    const isDraftable = sub.status === "DRAFT" || sub.status === "RETURNED";
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-sans">
                          <p className="font-bold text-slate-900 text-xs">{sub.title}</p>
                          <p className="text-[10px] font-mono text-indigo-700 font-bold mt-0.5">{sub.period}</p>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-950 pr-2">
                          <span className="capitalize text-slate-650 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {sub.report_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-sans max-w-[150px] truncate">
                          <p className="text-xs text-slate-800 font-medium truncate">{sub.tsp_name || "Central Office"}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{sub.state_name || "Federal scope"}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(sub.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Viewer button */}
                          <button
                            onClick={() => loadAuditHistory(sub)}
                            className="p-1 px-2 hover:bg-slate-200 text-slate-700 bg-slate-100 rounded text-[10.5px] font-bold transition cursor-pointer"
                            title="Audit Trail/History logs"
                          >
                            <Eye className="w-3.5 h-3.5 inline mr-1" />
                            Audit
                          </button>

                          {/* Edit button */}
                          {isTsp && isDraftable && (
                            <button
                              onClick={() => openEditDraft(sub)}
                              className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10.5px] font-bold transition cursor-pointer"
                              title="Edit Report Draft"
                            >
                              <Edit className="w-3.5 h-3.5 inline mr-1" />
                              Edit
                            </button>
                          )}

                          {/* Action triggers depending on current states */}
                          {isTsp && isDraftable && (
                            <button
                              onClick={() => openReviewModal(sub, "SUBMIT")}
                              className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[10.5px] font-bold transition cursor-pointer"
                            >
                              <Send className="w-3 h-3 inline mr-1" />
                              Submit
                            </button>
                          )}

                          {isSta && sub.status === "SUBMITTED" && (
                            <>
                              <button
                                onClick={() => openReviewModal(sub, "RECOMMEND")}
                                className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-850 rounded text-[10.5px] font-bold transition cursor-pointer"
                              >
                                Recommend
                              </button>
                              <button
                                onClick={() => openReviewModal(sub, "RETURN")}
                                className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10.5px] font-bold transition cursor-pointer"
                              >
                                Return
                              </button>
                            </>
                          )}

                          {isFed && (sub.status === "RECOMMENDED" || sub.status === "SUBMITTED") && (
                            <>
                              <button
                                onClick={() => openReviewModal(sub, "APPROVE")}
                                className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[10.5px] font-bold transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => openReviewModal(sub, "RETURN")}
                                className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10.5px] font-bold transition cursor-pointer"
                              >
                                Return
                              </button>
                            </>
                          )}

                          {isFed && sub.status === "APPROVED" && (
                            <button
                              onClick={() => openReviewModal(sub, "LOCK")}
                              className="p-1 px-2 bg-slate-900 text-white hover:bg-slate-800 rounded text-[10.5px] font-bold transition cursor-pointer"
                            >
                              <Lock className="w-3 h-3 inline mr-1" /> Lock
                            </button>
                          )}

                          {isFed && (
                            <button
                              onClick={() => openReviewModal(sub, "OVERRIDE")}
                              className="p-1 px-1 text-slate-400 hover:text-slate-700 text-[10px]"
                              title="Administrative Override"
                            >
                              Override
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
        </div>

        {/* Right 4 Cols: Audits chronological trail */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-sm border border-slate-850">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
              Audit timeline log viewer
            </h3>
            
            {selectedSubmission ? (
              <div className="mt-5 space-y-5 text-left">
                <div className="border-b border-slate-800 pb-3">
                  <p className="font-semibold text-xs text-white">{selectedSubmission.title}</p>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                    <span>Type: {selectedSubmission.report_type}</span>
                    <span className="font-mono text-indigo-300">Period: {selectedSubmission.period}</span>
                  </div>
                </div>

                {loadingAudits ? (
                  <p className="text-[11px] text-slate-500 font-mono text-center">Loading audit trails...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-mono">No registered auditing state triggers of this report.</p>
                ) : (
                  <div className="relative border-l border-slate-750 pl-4 ml-2.5 space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative text-[10.5px] font-mono leading-relaxed text-slate-350">
                        <div className="absolute -left-[21.5px] mt-1 h-3 w-3 rounded-full bg-slate-700 border-2 border-slate-900" />
                        
                        <p className="text-slate-100 font-bold">
                          {log.action} by <span className="text-indigo-400">{log.actor_role}</span>
                        </p>
                        <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                          {log.actor_email} · {new Date(log.created_at).toLocaleString("en-GB")}
                        </p>
                        {log.remarks && (
                          <div className="mt-1 p-2 bg-slate-950/50 text-slate-400 font-sans text-[10px] rounded border border-slate-800 leading-normal">
                            "{log.remarks}"
                          </div>
                        )}
                        {log.from_status && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1 font-mono uppercase tracking-tight">
                            <span>{log.from_status}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                            <span className="text-indigo-300">{log.to_status}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 py-10 text-center text-slate-500 text-xs font-mono space-y-2">
                <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto" />
                <p>Click “Audit” on any report above to load its real-time blockchain validation ledger.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FORM MODAL: Draft / Compilation */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-indigo-400" />
                {formId ? "Edit Governance Report Draft" : "Compile New Governance Report Draft"}
              </h4>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDraft} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-mono">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-550 gap-0.5 uppercase tracking-wide">Report Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Month 1 Progress & Toolkits Allocation Sheets"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 px-3 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 gap-0.5 uppercase tracking-wide">Report Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 px-3 font-sans"
                  >
                    <option value="ATTENDANCE">Attendance sheet report</option>
                    <option value="INVENTORY">Inventory / Toolkits checkouts</option>
                    <option value="ASSESSMENT">Assessments & milestones</option>
                    <option value="MONTHLY_REPORT">Regular monthly update</option>
                    <option value="COMPLIANCE">Regulatory compliance report</option>
                    <option value="GRADUATION">Graduation & job linkages</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 gap-0.5 uppercase tracking-wide">Period</label>
                  <input
                    type="text"
                    required
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                    placeholder="e.g. June 2026"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 px-3 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wide">Report Metrics Payload (JSON format)</label>
                  <span className="text-[8px] font-mono text-slate-400">Strict formatting required</span>
                </div>
                <textarea
                  required
                  rows={6}
                  value={formPayload}
                  onChange={(e) => setFormPayload(e.target.value)}
                  className="w-full text-[11px] font-mono bg-slate-950 text-emerald-400 rounded-xl p-3 shadow-inner leading-relaxed focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="py-2 px-4 hover:bg-slate-100 rounded-lg border border-slate-250 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-indigo-600 hover:bg-slate-900 text-white font-bold py-2 px-5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? "Saving Draft..." : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSITION MODAL: Review / Remarks / Return */}
      {isReviewOpen && reviewSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in duration-150 font-sans">
            <div className="bg-slate-900 text-white p-5">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">
                Action: {reviewAction} REPORT
              </h4>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">ID: {reviewSubmission.id}</p>
            </div>

            <form onSubmit={handleApplyTransition} className="p-6 space-y-4">
              {reviewError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-mono">
                  {reviewError}
                </div>
              )}

              <p className="text-xs text-slate-700 leading-relaxed font-sans">
                You are about to invoke action <strong className="text-indigo-600">{reviewAction}</strong> on 
                report draft: <strong>{reviewSubmission.title}</strong>. This changes the status from 
                <span className="text-indigo-500 font-bold ml-1">{reviewSubmission.status}</span>.
              </p>

              {reviewAction === "OVERRIDE" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wide">Force Status To:</label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 px-3 font-mono"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="RECOMMENDED">RECOMMENDED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="LOCKED">LOCKED</option>
                    <option value="RETURNED">RETURNED</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wide">Audit remarks / Review Feedback</label>
                <textarea
                  required={reviewAction === "RETURN" || reviewAction === "OVERRIDE"}
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder={reviewAction === "RETURN" ? "Please state the correction requirements clearly..." : "Add standard compliance review feedback notes..."}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="py-2 px-4 hover:bg-slate-100 rounded-lg border border-slate-250 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="bg-indigo-600 hover:bg-slate-900 text-white font-bold py-2 px-5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {reviewSubmitting ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
