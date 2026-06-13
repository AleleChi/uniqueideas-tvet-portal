import React from "react";
import { X, Building2, User, Phone, Mail, Award, CheckSquare, Calendar, Compass, Layers, Globe, Shield } from "lucide-react";

interface EOIDetailsDrawerProps {
  application: any;
  onClose: () => void;
  onEvaluate: () => void;
}

export function EOIDetailsDrawer({ application, onClose, onEvaluate }: EOIDetailsDrawerProps) {
  const score = Number(application.evaluation_score ?? application.evaluationScore ?? 0);
  const status = application.application_status ?? application.applicationStatus ?? "SUBMITTED";

  const getStatusStyle = (st: string) => {
    switch (st) {
      case "SUBMITTED":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "UNDER_REVIEW":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "SHORTLISTED":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "APPROVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-250";
      case "INVITED_TO_NEXT_PHASE":
        return "bg-purple-50 text-purple-700 border-purple-250";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case "SUBMITTED": return "Submitted";
      case "UNDER_REVIEW": return "Under Review";
      case "SHORTLISTED": return "Shortlisted";
      case "APPROVED": return "Approved";
      case "REJECTED": return "Rejected";
      case "INVITED_TO_NEXT_PHASE": return "Invited to Next Phase";
      default: return st;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col font-sans text-xs text-slate-700 no-print animate-in slide-in-from-right duration-250">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-sm tracking-tight">{application.organization_name || application.organizationName}</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{application.application_code || application.applicationCode}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg flex items-center justify-center min-h-[32px] min-w-[32px] cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
        {/* Status card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Status</span>
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${getStatusStyle(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Evaluation Score</span>
            <div className="flex items-center gap-1">
              <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
              <span className="font-bold text-slate-800">{score}/100</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 text-slate-500">
            <span>Submitted On:</span>
            <span className="font-medium text-slate-700">
              {new Date(application.submission_date || application.submissionDate || "").toLocaleString()}
            </span>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Contact Details</h4>
          
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-slate-450 text-[10px]">Contact Person</p>
              <p className="font-semibold text-slate-800 text-xs">{application.contact_person || application.contactPerson}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-slate-450 text-[10px]">Email Address</p>
              <p className="font-semibold text-slate-800">{application.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-slate-450 text-[10px]">Phone Number</p>
              <p className="font-semibold text-slate-800">{application.phone}</p>
            </div>
          </div>
        </div>

        {/* Program Scope */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Program Scope</h4>
          
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <p className="text-slate-450 text-[10px] uppercase font-semibold">Working State</p>
              <p className="text-slate-800 font-bold bg-slate-50 px-2 py-1 rounded border border-slate-200 text-[11px] inline-block">
                {application.state}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-slate-450 text-[10px] uppercase font-semibold">NBTE Status</p>
              <p className={`text-[10px] font-bold px-2 py-1 rounded border inline-block ${
                (application.nbte_status || application.nbteStatus) === "ACCREDITED" 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {(application.nbte_status || application.nbteStatus) === "ACCREDITED" ? "Accredited" : "Not Accredited"}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-slate-450 text-[10px] uppercase font-semibold">Proposed Sector</p>
            <p className="text-slate-805 font-medium text-xs">{application.sector}</p>
          </div>

          <div className="space-y-1">
            <p className="text-slate-450 text-[10px] uppercase font-semibold">Proposed Skill Area</p>
            <p className="text-slate-805 font-medium text-xs">{application.skill_area || application.skillArea}</p>
          </div>

          <div className="space-y-1">
            <p className="text-slate-450 text-[10px] uppercase font-semibold">Years of Operational Experience</p>
            <p className="text-slate-800 font-bold text-xs">{application.years_of_experience || application.yearsOfExperience || 0} Years</p>
          </div>
        </div>

        {/* Review & Evaluation Indices */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Governance Review</h4>
          
          <div className="space-y-3">
            <div>
              <p className="text-slate-450 text-[10px]">Reviewed By</p>
              <p className="font-semibold text-slate-800 bg-slate-100/60 p-1.5 rounded text-[10px] border border-slate-200/50">
                {application.reviewed_by || application.reviewedBy || "Pending Review"}
              </p>
            </div>

            {application.review_date || application.reviewDate ? (
              <div>
                <p className="text-slate-450 text-[10px]">Review Date</p>
                <p className="font-medium text-slate-700">
                  {new Date(application.review_date || application.reviewDate).toLocaleString()}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-slate-450 text-[10px]">Recommendation</p>
              <p className="text-slate-800 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                {application.recommendation || "No recommendation logged yet."}
              </p>
            </div>

            <div>
              <p className="text-slate-450 text-[10px]">Reviewer Remarks</p>
              <p className="text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-150 min-h-[50px] whitespace-pre-wrap">
                {application.remarks || "No evaluation remarks filed."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold cursor-pointer transition-colors"
        >
          Close Drawer
        </button>

        <button
          onClick={onEvaluate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 text-white rounded-lg font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Award className="w-4 h-4" />
          Evaluate Scope
        </button>
      </div>
    </div>
  );
}
