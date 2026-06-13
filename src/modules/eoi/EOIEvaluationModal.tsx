import React, { useState } from "react";
import { X, Award, Shield, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

interface EOIEvaluationModalProps {
  application: any;
  onClose: () => void;
  onSave: (id: string, evaluationData: {
    evaluationScore: number;
    recommendation: string;
    remarks: string;
    applicationStatus: string;
  }) => Promise<void>;
}

export function EOIEvaluationModal({ application, onClose, onSave }: EOIEvaluationModalProps) {
  const [score, setScore] = useState<number>(Number(application.evaluation_score || application.evaluationScore || 0));
  const [recommendation, setRecommendation] = useState<string>(application.recommendation || "");
  const [remarks, setRemarks] = useState<string>(application.remarks || "");
  const [status, setStatus] = useState<string>(application.application_status || application.applicationStatus || "SUBMITTED");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score < 0 || score > 100) {
      setError("Evaluation score must be between 0 and 100.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(application.id, {
        evaluationScore: score,
        recommendation,
        remarks,
        applicationStatus: status
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit evaluation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = [
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "SHORTLISTED", label: "Shortlisted" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "INVITED_TO_NEXT_PHASE", label: "Invited to Next Phase" }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 font-sans no-print animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col"
        id="eoi-evaluation-modal"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm tracking-tight">Evaluate Application</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{application.application_code || application.applicationCode}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg flex items-center justify-center min-h-[32px] min-w-[32px] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-600 mb-1">Organization Name</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800">
              {application.organization_name || application.organizationName}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="score-input" className="block font-bold text-slate-600 mb-1">Evaluation Score (Max 100)</label>
              <input
                id="score-input"
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 font-semibold"
                required
              />
            </div>

            <div>
              <label htmlFor="status-select" className="block font-bold text-slate-600 mb-1">Application Status</label>
              <select
                id="status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 font-semibold bg-white"
                required
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="recom-input" className="block font-bold text-slate-600 mb-1">Recommendation Summary</label>
            <input
              id="recom-input"
              type="text"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="e.g. Recommended for next phase review"
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600"
            />
          </div>

          <div>
            <label htmlFor="remarks-input" className="block font-bold text-slate-600 mb-1">Overall Review Remarks</label>
            <textarea
              id="remarks-input"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Detailed feedback regarding capability, accreditation status, or timeline alignments."
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 h-24 resize-none"
            />
          </div>

          {/* Quick templates */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
            <h4 className="font-semibold text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
              Quick Decision Templates
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setScore(85);
                  setStatus("APPROVED");
                  setRecommendation("Fully accredited TSP, eligible to begin admission cycles immediately.");
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-[10px] font-medium transition-colors"
              >
                Standard Approval (85/100)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScore(68);
                  setStatus("SHORTLISTED");
                  setRecommendation("Good capability indices; shortlisted pending structural facility audit.");
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-[10px] font-medium transition-colors"
              >
                Shortlist (68/100)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScore(42);
                  setStatus("REJECTED");
                  setRecommendation("Lacks NBTE status alignment or basic program equipment lists.");
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-[10px] font-medium transition-colors"
              >
                Reject (42/100)
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-750 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-900 border border-slate-950 text-white hover:bg-slate-850 font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Evaluation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
