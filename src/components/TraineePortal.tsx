/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  UserSession, Beneficiary, ProgramStatus, Gender 
} from "../types";
import { 
  LogOut, FileText, Download, CheckCircle, Clock, AlertCircle, 
  Send, User, ShieldAlert, KeyRound, Key, RefreshCw, Eye, EyeOff, UploadCloud, CheckCircle2 
} from "lucide-react";

interface TraineePortalProps {
  session: UserSession;
  onLogout: () => void;
}

export function TraineePortal({ session, onLogout }: TraineePortalProps) {
  const [candidate, setCandidate] = useState<Beneficiary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Custom Supplementary Form Inputs
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [highestQualification, setHighestQualification] = useState("SSCE / WASSCE");
  const [priorKnowledge, setPriorKnowledge] = useState("None");
  const [medicalDeclaration, setMedicalDeclaration] = useState("No medical declarations or special assistance required.");
  
  // Acceptance Response Files State
  const [handSignedBase64, setHandSignedBase64] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [successResponse, setSuccessResponse] = useState<string | null>(null);

  // Change Password state in Student Portal
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdShowCur, setPwdShowCur] = useState(false);
  const [pwdShowNew, setPwdShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/beneficiaries/${session.beneficiaryId}`);
      if (res.ok) {
        const data = await res.json();
        setCandidate(data);
        
        // Prepopulate if form already filed
        if (data.admissionFormCompleted && data.admissionFormData) {
          const form = data.admissionFormData;
          setEmergencyName(form.emergencyName || "");
          setEmergencyPhone(form.emergencyPhone || "");
          setGuardianName(form.guardianName || "");
          setHighestQualification(form.highestQualification || "SSCE / WASSCE");
          setPriorKnowledge(form.priorKnowledge || "None");
          setMedicalDeclaration(form.medicalDeclaration || "");
        }
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Failed to load candidate files.");
      }
    } catch (e: any) {
      setErrorMessage("Network timeout connecting to TVET registry server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size surpasses 2MB boundary limit.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setHandSignedBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitTraineeResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyName || !emergencyPhone) {
      alert("Emergency contact parameters are required.");
      return;
    }

    setFormSubmitting(true);
    setSuccessResponse(null);

    try {
      const payload = {
        admissionFormCompleted: true,
        admissionFormStatus: "Verified",
        admissionFormData: {
          emergencyName,
          emergencyPhone,
          guardianName,
          highestQualification,
          priorKnowledge,
          medicalDeclaration,
          submissionDate: new Date().toISOString()
        },
        admissionStatus: "Acceptance Sent",
        // Fallback placeholder is a self-generated dynamic placeholder URL if no file is provided
        acceptanceLetterUploaded: true,
        acceptanceLetterUrl: handSignedBase64 || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=300",
        acceptanceLetterUploadedAt: new Date().toISOString()
      };

      const res = await fetch(`/api/beneficiaries/${session.beneficiaryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessResponse("Congratulations! Your signed acceptance response has been registered and queued for administrator review.");
        await fetchProfile();
      } else {
        const rErr = await res.json();
        alert(rErr.error || "Failed to save response parameters.");
      }
    } catch (err: any) {
      alert("Network exception uploading signed templates.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess(null);
    setPwdError(null);

    if (newPassword !== confirmPassword) {
      setPwdError("New password matches do not align.");
      return;
    }
    if (newPassword.length < 6) {
      setPwdError("Password must be at least 6 characters.");
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        setPwdSuccess("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwdError(data.error || "Could not change password.");
      }
    } catch (err) {
      setPwdError("Failed to dispatch password modification request.");
    } finally {
      setPwdLoading(false);
    }
  };

  /**
   * Status trackers mapping
   */
  const getStepStatus = (step: number) => {
    if (!candidate) return "PENDING";
    
    const status = candidate.admissionStatus || "Pending";
    
    if (step === 1) {
      return "CHECKED"; // Offer sent is always true for logged in trainees
    }
    if (step === 2) {
      return candidate.admissionFormCompleted ? "CHECKED" : "CURRENT";
    }
    if (step === 3) {
      if (!candidate.admissionFormCompleted) return "PENDING";
      if (status === "Accepted") return "CHECKED";
      if (status === "Acceptance Rejected") return "ALERT";
      return "CURRENT";
    }
    if (step === 4) {
      return candidate.status === ProgramStatus.VERIFIED ? "CHECKED" : "PENDING";
    }
    return "PENDING";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto animate-pulse" />
          <p className="text-xs text-slate-500 font-mono tracking-wider font-semibold uppercase">Securing student token files...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !candidate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-rose-150 p-8 rounded-2xl shadow-lg border-l-4 border-rose-500 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 font-display">Authorisation Error</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-mono">{errorMessage || "Invalid profile link reference"}</p>
          <button 
            onClick={onLogout}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-lg text-xs transition uppercase cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isFormCompleted = candidate.admissionFormCompleted;
  const isEnrolled = candidate.status === ProgramStatus.VERIFIED;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      
      {/* Dynamic Student Portal Top Bar Header */}
      <header className="bg-slate-900 text-white p-5 border-b border-indigo-950 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shadow-md">
        <div className="flex items-center gap-3 text-left">
          <div className="h-10 w-10 bg-indigo-650 rounded-lg flex items-center justify-center text-white font-bold font-mono text-sm leading-none flex-shrink-0">
            {candidate.firstName.substring(0, 1)}{candidate.lastName.substring(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-slate-100 flex items-center gap-1.5 font-display select-text">
              {candidate.firstName} {candidate.lastName}
              <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500 text-slate-950 rounded font-bold font-mono">ID: {candidate.id}</span>
            </h1>
            <p className="text-[10px] text-slate-450 font-semibold font-mono tracking-wide mt-0.5" title="Accredited TSP">
              PROGRAM COHORT: Computer Hardware and Cell Phone Repairs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <span className="text-[9px] font-bold text-slate-400 font-mono block leading-none">CANDIDATE WORKSPACE</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold block mt-1">● RESPONDER PORTAL LIVE</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/30 font-semibold py-2 px-4 rounded-lg text-xs transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Core Student Workspace Frame */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* LEFT COLUMN: Checklists and printable documents (7 columns wide) */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* Section 1: Tracker Progress Checklist Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6">
            <h2 className="text-sm font-bold tracking-wider font-mono text-slate-400 uppercase text-left">
              Enrollment Status Checklist
            </h2>

            {/* Visual Tracking Nodes */}
            <div className="flex flex-col space-y-5 text-left relative">
              
              {/* Tracker items loops */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="h-10 w-0.5 bg-emerald-250"></div>
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 font-display">1. Official Offer of Admission Sent</h3>
                  <p className="text-[10px] text-slate-400 leading-normal font-medium max-w-md">
                    Provisional offer issued in Federal TVET enrollment system. Reference Code: <strong className="font-mono text-slate-650">{candidate.admissionRef || "IDEAS/TVET/ADM/PENDING"}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                    getStepStatus(2) === "CHECKED" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-indigo-50 text-indigo-650 border border-indigo-200"
                  }`}>
                    {getStepStatus(2) === "CHECKED" ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4 animate-pulse" />}
                  </div>
                  <div className={`h-10 w-0.5 ${getStepStatus(2) === "CHECKED" ? "bg-emerald-250" : "bg-slate-200"}`}></div>
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 font-display">2. Supplementary Intake Form & E-Signature Contract</h3>
                  <p className="text-[10px] text-slate-400 leading-normal font-medium max-w-md">
                    {candidate.admissionFormCompleted 
                      ? "Form completed and response letter successfully logged in database and backed up."
                      : "Action required. Please fill out details and sign the provisional contract on the right sidebar."
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                    getStepStatus(3) === "CHECKED" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : getStepStatus(3) === "ALERT" 
                        ? "bg-rose-100 text-rose-700 animate-bounce" 
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    {getStepStatus(3) === "CHECKED" && <CheckCircle className="w-4 h-4" />}
                    {getStepStatus(3) === "ALERT" && <AlertCircle className="w-4 h-4" />}
                    {getStepStatus(3) === "CURRENT" && <Clock className="w-4 h-4 animate-spin text-indigo-600" />}
                    {getStepStatus(3) === "PENDING" && <Clock className="w-4 h-4" />}
                  </div>
                  <div className={`h-10 w-0.5 ${getStepStatus(3) === "CHECKED" ? "bg-emerald-250" : "bg-slate-200"}`}></div>
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 font-display">3. Institutional Documents Review</h3>
                  <p className="text-[10px] text-slate-400 leading-normal font-medium max-w-md">
                    {candidate.admissionStatus === "Accepted" && "Approved! Formal documents reviewed and confirmed."}
                    {candidate.admissionStatus === "Acceptance Rejected" && "Response Rejected. Lacks hand signature or next of kin mismatch. Please update details."}
                    {candidate.admissionStatus === "Acceptance Sent" && "Awaiting Review. Administrators notified and verifying files."}
                    {candidate.admissionStatus !== "Accepted" && candidate.admissionStatus !== "Acceptance Sent" && candidate.admissionStatus !== "Acceptance Rejected" && "Waiting for student to upload signed acceptance documents."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                    getStepStatus(4) === "CHECKED" 
                      ? "bg-emerald-100 text-emerald-700 font-bold scale-110 shadow-sm" 
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 font-display">4. Enrollment Active & Confirmed</h3>
                  <p className="text-[10px] text-slate-400 leading-normal font-medium max-w-md">
                    {candidate.status === ProgramStatus.VERIFIED
                      ? "Officially Registered! Download your Enrollment Confirmation letter below."
                      : "Enrolls automatically when your signed response letter is approved by reviewers."
                    }
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* Section 2: PDF Document Cabinet Area */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6">
            <h2 className="text-sm font-bold tracking-wider font-mono text-slate-400 uppercase text-left">
              Official PDF Letter Downloads
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card A: Admission Letter */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between text-left space-y-4">
                <div className="space-y-2">
                  <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-900 w-fit">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 font-display">Admission Letter</h3>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">Federal branding · A4 printable</p>
                  </div>
                </div>
                {candidate.admissionLetterUrl ? (
                  <a 
                    href={candidate.admissionLetterUrl}
                    target="_blank"
                    rel="referrer"
                    className="w-full bg-slate-900 hover:bg-indigo-950 text-white font-bold py-2 rounded-lg text-[10px] text-center uppercase tracking-wider flex items-center justify-center gap-1.5 transition select-text"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                ) : (
                  <button disabled className="w-full bg-slate-100 text-slate-350 cursor-not-allowed font-bold py-2 rounded-lg text-[10px] text-center uppercase tracking-wider">
                    Not Ready
                  </button>
                )}
              </div>

              {/* Card B: Acceptance Letter Template */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between text-left space-y-4">
                <div className="space-y-2">
                  <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-900 w-fit">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 font-display">Acceptance Letter</h3>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">Completed copy for records</p>
                  </div>
                </div>
                {candidate.acceptanceLetterUrl ? (
                  <a 
                    href={candidate.acceptanceLetterUrl}
                    target="_blank"
                    rel="referrer"
                    className="w-full bg-slate-900 hover:bg-emerald-950 text-white font-bold py-2 rounded-lg text-[10px] text-center uppercase tracking-wider flex items-center justify-center gap-1.5 transition select-text"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                ) : (
                  <button disabled className="w-full bg-slate-100 text-slate-350 cursor-not-allowed font-bold py-2 rounded-lg text-[10px] text-center uppercase tracking-wider">
                    Awaiting upload
                  </button>
                )}
              </div>

              {/* Card C: Enrollment Certificate */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between text-left space-y-4">
                <div className="space-y-2">
                  <div className="p-2.5 bg-amber-50 rounded-lg text-amber-900 w-fit">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 font-display">Enrollment Confirm</h3>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">Class scheduling details</p>
                  </div>
                </div>
                {isEnrolled && candidate.enrollmentLetterUrl ? (
                  <a 
                    href={candidate.enrollmentLetterUrl}
                    target="_blank"
                    rel="referrer"
                    className="w-full bg-indigo-950 hover:bg-indigo-910 text-white font-bold py-2 rounded-lg text-[10px] text-center uppercase tracking-wider flex items-center justify-center gap-1.5 transition select-text"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                ) : (
                  <button disabled className="w-full bg-slate-100 text-slate-350 cursor-not-allowed font-bold py-2 rounded-lg text-[10px] text-center uppercase tracking-wider" title="Awaiting Acceptance Approval">
                    Pending Approval
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Section 3: Change Password Block */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-5 text-left">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-slate-500" />
              <h2 className="text-sm font-bold tracking-wider font-mono text-slate-400 uppercase">
                Privacy & Credentials Settings
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal max-w-lg">
              Changing your default entry credentials prevents unauthorized third-party record modifications and shields your profile from tampering.
            </p>

            <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-505 uppercase">Current Password</label>
                <div className="relative">
                  <input
                    type={pwdShowCur ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowCur(!pwdShowCur)}
                    className="absolute right-2 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {pwdShowCur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-[9.5px] font-bold text-slate-505 uppercase">New Password</label>
                <div className="relative font-mono">
                  <input
                    type={pwdShowNew ? "text" : "password"}
                    required
                    placeholder="Create replacing secret"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowNew(!pwdShowNew)}
                    className="absolute right-2 top-3 text-slate-400 hover:text-slate-600 font-mono"
                  >
                    {pwdShowNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-505 uppercase">Verify Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="col-span-1 md:col-span-3 flex items-center justify-between gap-4 pt-1">
                <div className="min-w-0">
                  {pwdError && <p className="text-[10px] font-bold text-red-650">{pwdError}</p>}
                  {pwdSuccess && <p className="text-[10px] font-bold text-emerald-650 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{pwdSuccess}</span>
                  </p>}
                </div>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="bg-indigo-950 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-[10px] uppercase tracking-wider font-sans transition flex-shrink-0 cursor-pointer"
                >
                  {pwdLoading ? "Modifying..." : "Update Secrets"}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: Supplementary Intake & Forms upload (5 columns wide) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6 text-left">
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold tracking-wider font-mono text-slate-450 uppercase">
                Intake & E-Signature Intake Form
              </h2>
              <p className="text-[11px] text-slate-505 leading-normal font-medium">
                Please complete your supplemental biographical registry parameters and confirm your physical seat reservation.
              </p>
            </div>

            {successResponse && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-800 font-semibold space-y-1 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Submission registered!</span>
                </div>
                <p className="text-[10px] text-emerald-600 leading-normal font-mono font-medium">{successResponse}</p>
              </div>
            )}

            <form onSubmit={submitTraineeResponse} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Next of Kin Name</label>
                <input
                  type="text"
                  required
                  disabled={isFormCompleted}
                  placeholder="Enter contact full name"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Next of Kin Phone Number</label>
                <input
                  type="tel"
                  required
                  disabled={isFormCompleted}
                  placeholder="e.g., +234 803 123 4567"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Guardian Name</label>
                  <input
                    type="text"
                    disabled={isFormCompleted}
                    placeholder="Father/Mother/Sponsor"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Highest Education</label>
                  <select
                    disabled={isFormCompleted}
                    value={highestQualification}
                    onChange={(e) => setHighestQualification(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="SSCE / WASSCE">SSCE / WASSCE</option>
                    <option value="ND / OND">ND / OND</option>
                    <option value="HND / B.Sc">HND / B.Sc</option>
                    <option value="Master's / Postgraduate">Master's / Postgrad</option>
                    <option value="Other Skills Certificate">Other Skills Certificate</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Prior Phone/Repair Experience</label>
                <div className="flex gap-4">
                  {["None", "Basic", "Experienced"].map((lvl) => (
                    <label key={lvl} className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-500">
                      <input
                        type="radio"
                        disabled={isFormCompleted}
                        name="priorExperience"
                        value={lvl}
                        checked={priorKnowledge === lvl}
                        onChange={() => setPriorKnowledge(lvl)}
                        className="text-indigo-650 focus:ring-indigo-500"
                      />
                      <span>{lvl}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Health/Special Assistance Needs</label>
                <textarea
                  disabled={isFormCompleted}
                  rows={2}
                  value={medicalDeclaration}
                  onChange={(e) => setMedicalDeclaration(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-medium focus:outline-none"
                />
              </div>

              {/* Hand-signed or Drawn acceptance letters upload box */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Hand-Signed Acceptance Scan (Max 2MB)</label>
                
                {candidate.acceptanceLetterUrl ? (
                  <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 text-center text-xs text-indigo-950 font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Acceptance document uploaded and backed up.</span>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-650 bg-slate-50 rounded-xl p-5 text-center transition cursor-pointer relative">
                    <input
                      id="hand-signed-upload"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {handSignedBase64 ? (
                      <div className="space-y-1">
                        <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" />
                        <p className="text-[10px] text-slate-800 font-bold font-mono uppercase tracking-wide">Document successfully selected</p>
                        <p className="text-[9px] text-slate-450 font-mono">Format: image / raster base64 parsed. Ready to submit.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Upload / Scan signed letter</p>
                        <p className="text-[9px] text-slate-400">Click to locate template or drag scanned file here</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isFormCompleted && (
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full bg-emerald-650 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 tracking-wide uppercase transition shadow-md cursor-pointer"
                >
                  {formSubmitting ? "Uploading forms..." : "Submit Enrollment Response"}
                  {!formSubmitting && <Send className="w-4 h-4 text-white" />}
                </button>
              )}

            </form>
          </div>

        </div>

      </main>

      {/* Trainee Portal footer notices */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-[10px] text-slate-400 font-mono mt-auto">
        <p>© {new Date().getFullYear()} Federal Ministry of Education · IDEAS-TVET Skills Sector Initiative</p>
      </footer>

    </div>
  );
}
