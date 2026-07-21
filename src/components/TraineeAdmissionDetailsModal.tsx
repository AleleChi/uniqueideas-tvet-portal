import React, { useState, useEffect } from "react";
import { 
  X, Loader2, CheckCircle2, AlertCircle, RefreshCw, Copy, ExternalLink, 
  Mail, ShieldAlert, FileText, Send, User, Check, Clock, Eye
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { API_BASE_URL } from "../config/api";

interface TraineeAdmissionDetailsModalProps {
  candidate: {
    id: string;
    beneficiaryId?: string;
    name?: string;
    fullName?: string;
    email?: string;
    tvetId?: string;
    admissionStatus?: string;
  };
  onClose: () => void;
}

export function TraineeAdmissionDetailsModal({ candidate, onClose }: TraineeAdmissionDetailsModalProps) {
  const candidateId = candidate.beneficiaryId || candidate.id;
  const displayName = candidate.fullName || candidate.name || "Trainee Candidate";
  const displayEmail = candidate.email || "No Email Registered";
  const displayTvetId = candidate.tvetId || candidate.id;

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [admissionStatus, setAdmissionStatus] = useState<string>("Not Started");
  const [secureLink, setSecureLink] = useState<string | null>(null);
  const [docHistory, setDocHistory] = useState<any[]>([]);
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);
  
  // Action states
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [generatingAcceptance, setGeneratingAcceptance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch all data
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get profile / admission details
      const profileRes = await authFetch(`/api/admissions/list?search=${encodeURIComponent(candidateId)}`);
      if (profileRes.ok) {
        const data = await profileRes.json();
        const found = data.rows?.find((r: any) => r.id === candidateId || r.beneficiaryId === candidateId);
        if (found) {
          setAdmissionStatus(found.admissionStatus || found.step || "Not Started");
        }
      }

      // Get secure link
      try {
        const linkRes = await authFetch(`/api/admissions/secure-link?beneficiaryId=${candidateId}`);
        if (linkRes.ok) {
          const linkData = await linkRes.json();
          setSecureLink(linkData.secureLink || null);
        }
      } catch (err) {
        console.warn("Secure link fetch omitted or unavailable:", err);
      }

      // Get document history
      try {
        const docRes = await authFetch(`/api/documents/${candidateId}/history`);
        if (docRes.ok) {
          const docData = await docRes.json();
          setDocHistory(docData || []);
        }
      } catch (err) {
        console.warn("Document history fetch omitted or unavailable:", err);
      }

      // Get workflow history
      try {
        const workRes = await authFetch(`/api/beneficiaries/${candidateId}/workflow-history`);
        if (workRes.ok) {
          const workData = await workRes.json();
          setWorkflowHistory(workData || []);
        }
      } catch (err) {
        console.warn("Workflow history fetch omitted or unavailable:", err);
      }

    } catch (err: any) {
      console.error("Error loading trainee admission details modal:", err);
      setError(err.message || "Failed to load comprehensive admissions dossier.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [candidateId]);

  // Actions
  const handleGenerateOffer = async () => {
    try {
      setGeneratingOffer(true);
      const res = await authFetch(`/api/admissions/${candidateId}/render-offer-documents`, {
        method: "POST"
      });
      if (res.ok) {
        await loadAllData();
        alert("Provisional Admission Offer documents successfully generated on server.");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed to generate offer documents."}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingOffer(false);
    }
  };

  const handleSendOfferEmail = async () => {
    try {
      setSendingOffer(true);
      const res = await authFetch(`/api/admissions/send-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId: candidateId })
      });
      if (res.ok) {
        await loadAllData();
        alert("Admission Offer email and secure link successfully sent to trainee.");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed to dispatch email."}`);
      }
    } catch (err: any) {
      alert(`Error dispatching email: ${err.message}`);
    } finally {
      setSendingOffer(false);
    }
  };

  const handleGenerateAcceptance = async () => {
    try {
      setGeneratingAcceptance(true);
      const res = await authFetch(`/api/admissions/${candidateId}/render-acceptance-pdf`, {
        method: "POST"
      });
      if (res.ok) {
        await loadAllData();
        alert("Official Acceptance Letter PDF successfully rendered and registered.");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed to generate acceptance letter."}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingAcceptance(false);
    }
  };

  const handleCopyLink = () => {
    if (!secureLink) return;
    navigator.clipboard.writeText(secureLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Status-dependent badge style
  let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
  if (admissionStatus === "Admission Generated") badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-150";
  else if (admissionStatus === "Admission Sent") badgeStyle = "bg-blue-50 text-blue-700 border-blue-150";
  else if (admissionStatus === "Offer Viewed") badgeStyle = "bg-cyan-50 text-cyan-700 border-cyan-150";
  else if (admissionStatus === "Acceptance Pending") badgeStyle = "bg-amber-50 text-amber-700 border-amber-150";
  else if (admissionStatus === "Acceptance Uploaded") badgeStyle = "bg-purple-50 text-purple-700 border-purple-150";
  else if (admissionStatus === "Under Review") badgeStyle = "bg-yellow-50 text-yellow-800 border-yellow-200";
  else if (admissionStatus === "Accepted") badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-150";
  else if (admissionStatus === "Enrolled") badgeStyle = "bg-teal-50 text-teal-700 border-teal-150";

  // Document Helpers
  const admissionDoc = docHistory.find(d => d.documentType === "ADMISSION_LETTER");
  const acceptanceDoc = docHistory.find(d => d.documentType === "ACCEPTANCE_LETTER");

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 relative flex flex-col max-h-[90vh] shadow-2xl border border-slate-100 text-left font-sans">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight font-display">
                {displayName}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                TVET ID: <span className="font-bold text-slate-700">{displayTvetId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Loading States */}
        {loading ? (
          <div className="flex-1 py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              Gathering Trainee Dossier...
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 py-8 text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Access or Sync Error</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={loadAllData}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition"
            >
              Retry Sync
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            
            {/* 1. Core Profile Details and Status */}
            <div className="bg-slate-50/55 rounded-xl border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  EMAIL ADDRESS
                </span>
                <span className="text-slate-800 font-semibold text-sm block mt-0.5 font-mono truncate" title={displayEmail}>
                  {displayEmail}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  ADMISSION WORKFLOW STATUS
                </span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-extrabold uppercase border mt-1.5 ${badgeStyle}`}>
                  {admissionStatus}
                </span>
              </div>
            </div>

            {/* 2. Document & Token Statuses */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-100 pb-1.5">
                Workplace Document Status
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Offer Letter Document */}
                <div className="border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-300 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-450 text-slate-500" />
                      <span className="text-xs font-bold text-slate-800">Admission Offer PDF</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Official provisional training offer letter document.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase font-mono ${
                      admissionDoc ? "text-emerald-600" : "text-slate-400"
                    }`}>
                      {admissionDoc ? `v${admissionDoc.version} Generated` : "Not Created"}
                    </span>
                    {admissionDoc && (
                      <a
                        href={`${API_BASE_URL}/api/admissions/download-letter/${candidateId}?inline=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-extrabold text-xxs uppercase tracking-wider flex items-center gap-0.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Letter
                      </a>
                    )}
                  </div>
                </div>

                {/* Acceptance Letter Document */}
                <div className="border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-300 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-450 text-slate-500" />
                      <span className="text-xs font-bold text-slate-800">Acceptance Letter PDF</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Trainee signed admission confirmation and bio update document.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase font-mono ${
                      acceptanceDoc ? "text-emerald-600" : "text-slate-400"
                    }`}>
                      {acceptanceDoc ? `v${acceptanceDoc.version} Compiled` : "Not Compiled"}
                    </span>
                    {acceptanceDoc && (
                      <a
                        href={`${API_BASE_URL}/api/admissions/download-acceptance/${candidateId}?inline=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-extrabold text-xxs uppercase tracking-wider flex items-center gap-0.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Letter
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Secure Portal Link */}
              <div className="border border-slate-200/80 rounded-xl p-4 space-y-2">
                <span className="block text-[10px] font-bold text-slate-450 text-slate-500 uppercase tracking-widest font-mono">
                  SECURE RESPONSE PORTAL LINK
                </span>
                {secureLink ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={secureLink}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-xxs font-semibold text-slate-600 flex-1 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                      title="Copy link to clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={secureLink}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition-all flex items-center justify-center"
                      title="Open portal link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg p-2.5 text-xxs font-medium leading-relaxed">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>No secure portal link exists yet. Click "Generate Admission Offer" to establish credentials.</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Communication & Audit History */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-100 pb-1.5">
                Workflow Timeline & Dispatch logs
              </h4>
              
              {workflowHistory.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">
                    No communication dispatches or actions logged yet.
                  </p>
                </div>
              ) : (
                <div className="relative border-l-2 border-indigo-100 pl-4 space-y-4 py-1 ml-2 text-xs">
                  {workflowHistory.map((item, index) => (
                    <div key={item.id || index} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[23px] top-1.5 bg-indigo-100 text-indigo-600 rounded-full p-0.5 border-2 border-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 font-bold" />
                      </span>
                      <div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-extrabold text-slate-800 font-sans">
                            {item.action || "Workflow Action"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString("en-GB") : "Just now"}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-1 leading-normal font-sans text-xxs">
                          {item.details || item.remarks || "State transitioned successfully."}
                        </p>
                        {item.username && (
                          <span className="inline-block text-[9px] font-bold text-slate-400 font-mono uppercase bg-slate-50 px-1 py-0.5 rounded mt-1.5">
                            By: {item.username}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Modal Footer / Actions */}
        {!loading && !error && (
          <div className="border-t border-slate-100 pt-4 mt-5 flex flex-wrap items-center justify-end gap-2 bg-white">
            <button
              type="button"
              disabled={generatingOffer || sendingOffer || generatingAcceptance}
              onClick={handleGenerateOffer}
              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {generatingOffer ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Generate Admission Offer</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={generatingOffer || sendingOffer || generatingAcceptance}
              onClick={handleSendOfferEmail}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {sendingOffer ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Admission Offer Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={generatingOffer || sendingOffer || generatingAcceptance}
              onClick={handleGenerateAcceptance}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {generatingAcceptance ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Generate Acceptance Letter</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
