/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { UserSession, Beneficiary, ProgramStatus } from "../types";
import { authFetch } from "../utils/authFetch";
import { AdmissionFormPage } from "./AdmissionFormPage";
import {
  LogOut,
  FileText,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  User,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Eye,
  EyeOff,
  UploadCloud,
  CheckSquare,
  CheckCircle2,
  Menu,
  X,
  Bell,
  BookOpen,
  FolderLock,
  Info
} from "lucide-react";

interface TraineePortalProps {
  session: UserSession;
  onLogout: () => void;
}

export function TraineePortal({ session, onLogout }: TraineePortalProps) {
  const [candidate, setCandidate] = useState<Beneficiary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "letter" | "form" | "documents" | "notifications">("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      const res = await authFetch(`/api/beneficiaries/${session.beneficiaryId}`);
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
        acceptanceLetterUploaded: true,
        acceptanceLetterUrl: handSignedBase64 || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=300",
        acceptanceLetterUploadedAt: new Date().toISOString()
      };

      const res = await authFetch(`/api/beneficiaries/${session.beneficiaryId}`, {
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
      const res = await authFetch("/api/auth/change-password", {
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

  const getStepStatus = (step: number) => {
    if (!candidate) return "PENDING";
    const status = candidate.admissionStatus || "Pending";
    if (step === 1) return "CHECKED";
    if (step === 2) return candidate.admissionFormCompleted ? "CHECKED" : "CURRENT";
    if (step === 3) {
      if (!candidate.admissionFormCompleted) return "PENDING";
      if (status === "Accepted") return "CHECKED";
      if (status === "Acceptance Rejected") return "ALERT";
      return "CURRENT";
    }
    if (step === 4) return candidate.status === ProgramStatus.VERIFIED ? "CHECKED" : "PENDING";
    return "PENDING";
  };

  const getNotificationsList = () => {
    const list = [];
    if (!candidate) return [];

    if (candidate.admissionLetterUrl) {
      list.push({
        id: "notif-1",
        title: "Admission Letter Ready",
        desc: "Your official provisional Offer of Admission letter has been compiled in TVET registry database.",
        time: "Just now",
        type: "success"
      });
    }

    // Dynamic warning notifications if form not complete
    if (!candidate.admissionFormCompleted) {
      list.push({
        id: "notif-2",
        title: "Complete Supplementary Info",
        desc: "Please fill, scan sign, and submit your Supplementary Intake & E-Signature contract immediately.",
        time: "1 hour ago",
        type: "warning"
      });
    } else {
      list.push({
        id: "notif-2-comp",
        title: "Supplementary Form Completed",
        desc: "Supplementary intake parameters successfully synced and locks registered.",
        time: "Completed",
        type: "success"
      });
    }

    // Checks for formal registry Admission Form
    if (candidate.admissionFormPdfUrl) {
      list.push({
        id: "notif-3",
        title: "Admission Form Ready",
        desc: "You have a new Admission Form available.",
        time: "Recently",
        type: "info"
      });
    }

    if (candidate.admissionFormStatus === "LOCKED" || candidate.admissionFormStatus === "CONFIRMED") {
      list.push({
        id: "notif-4",
        title: "Form Lock Sealed",
        desc: "Admission Form successfully confirmed.",
        time: "Completed",
        type: "success"
      });
    }

    if (candidate.admissionFormStatus === "VIEWED" || candidate.admissionFormStatus === "IN_PROGRESS") {
      // Reopened check
      list.push({
        id: "notif-5",
        title: "Admission Form Active Draft",
        desc: "Your Admission Form has been reopened by an administrator.",
        time: "Action required",
        type: "warning"
      });
    }

    return list;
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
  const notifications = getNotificationsList();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none overflow-x-hidden md:flex-row">
      
      {/* LEFT SIDEBAR navigation on desktop, slide drawer on mobile */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-950 shrink-0 select-none">
        {/* Sidebar Header Brand block representation */}
        <div className="p-5 border-b border-indigo-950 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-650 rounded-lg flex items-center justify-center text-white font-black font-mono text-sm">
              {candidate.firstName.substring(0, 1)}{candidate.lastName.substring(0, 1)}
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-black text-white truncate max-w-[130px]">{candidate.firstName} {candidate.lastName}</h2>
              <span className="text-[9px] text-slate-400 font-mono">IDF-{candidate.id}</span>
            </div>
          </div>
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-400 hover:text-white md:hidden"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Sidebar Nav menu links items */}
        <nav className={`flex-grow p-4 space-y-1.5 md:block ${isMobileMenuOpen ? "block" : "hidden"}`}>
          {[
            { id: "dashboard", label: "Dashboard", icon: <BookOpen className="w-4 h-4" /> },
            { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
            { id: "letter", label: "Admission Letter", icon: <FileText className="w-4 h-4" /> },
            { id: "form", label: "Admission Form", icon: <CheckSquare className="w-4 h-4" />, highlight: true },
            { id: "documents", label: "Documents", icon: <FolderLock className="w-4 h-4" /> },
            { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" />, count: notifications.length }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer text-left ${
                activeTab === item.id
                  ? "bg-indigo-600 text-white font-black shadow-md shadow-indigo-900/30 font-display"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium"
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.count ? (
                <span className="bg-rose-500 text-white font-black font-mono text-[9px] px-1.5 py-0.5 rounded-full">{item.count}</span>
              ) : item.highlight ? (
                <span className="bg-indigo-500/35 text-indigo-300 font-bold font-mono text-[8px] px-2 py-0.5 rounded uppercase tracking-wider">NEW</span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Sidebar structural Footer log out */}
        <div className={`p-4 border-t border-indigo-950 md:block ${isMobileMenuOpen ? "block" : "hidden"}`}>
          <div className="bg-slate-950/45 p-3 rounded-xl mb-4 text-left">
            <span className="text-[9px] font-black text-slate-500 font-mono block uppercase">Status Network</span>
            <span className="text-[9px] text-emerald-400 font-semibold font-mono block mt-1">● TRAINEE SECURED PORTAL</span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/30 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer font-mono"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT WORKSPACE DISPLAY AREA container frame */}
      <main className="flex-grow flex flex-col min-h-screen overflow-y-auto">
        
        {/* Compact Header banner row */}
        <header className="bg-white border-b border-slate-200 py-4 px-6 flex flex-row items-center justify-between shrink-0">
          <div className="text-left">
            <span className="text-[10px] text-indigo-650 font-mono font-bold tracking-wider uppercase block">IDEAS-TVET Registry System</span>
            <h1 className="text-sm font-black text-slate-900 tracking-tight mt-0.5">
              Welcome, {candidate.firstName} {candidate.lastName}
            </h1>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[9px] font-mono text-slate-400 uppercase font-black block">SECTOR FACILITY COHORT:</span>
            <span className="text-[10px] font-semibold text-slate-700 block mt-0.5 truncate max-w-xs">{candidate.skillSector || "Computer Repairs Area"}</span>
          </div>
        </header>

        {/* Dynamic Tab Body switches */}
        <div className="p-4 sm:p-6 md:p-8 flex-grow">
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 max-w-6xl mx-auto">
              
              {/* Left 7 Columns: status tracking checklist details */}
              <div className="lg:col-span-8 flex flex-col space-y-6">
                
                <div className="bg-white border border-slate-250 p-6 md:p-8 rounded-2xl shadow-xs text-left space-y-6">
                  <h2 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest leading-none">
                    Enrollment Tracker
                  </h2>

                  <div className="flex flex-col space-y-6 relative">
                    {/* Progress checkpoints map */}
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                          <CheckCircle className="w-4.5 h-4.5" />
                        </div>
                        <div className="h-12 w-0.5 bg-emerald-250"></div>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        <h4 className="text-xs font-bold text-slate-900 font-display">1. Provisional Letter Issued</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                          Provisional Offer of Admission issued in registry DB. System Code: <strong className="text-slate-800 font-mono">{candidate.admissionRef || "IDEAS/TVET/ADM/OK"}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${
                          getStepStatus(2) === "CHECKED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-indigo-50 text-indigo-750 border border-indigo-200"
                        }`}>
                          {getStepStatus(2) === "CHECKED" ? <CheckCircle className="w-4.5 h-4.5" /> : <Clock className="w-4.5 h-4.5 animate-pulse" />}
                        </div>
                        <div className={`h-12 w-0.5 ${getStepStatus(2) === "CHECKED" ? "bg-emerald-250" : "bg-slate-200"}`}></div>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        <h4 className="text-xs font-bold text-slate-900 font-display">2. Supplementary Form Completeness</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                          {candidate.admissionFormCompleted
                            ? "✓ Form responses successfully locked and backed up in databases."
                            : "Action required. Complete your guarantor contact on the profile settings tab before registry lock."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${
                          getStepStatus(3) === "CHECKED"
                            ? "bg-emerald-100 text-emerald-700"
                            : getStepStatus(3) === "ALERT"
                            ? "bg-rose-100 text-rose-700 animate-bounce"
                            : "bg-slate-100 text-slate-450 border border-slate-200"
                        }`}>
                          {getStepStatus(3) === "CHECKED" && <CheckCircle className="w-4.5 h-4.5" />}
                          {getStepStatus(3) === "ALERT" && <AlertCircle className="w-4.5 h-4.5" />}
                          {getStepStatus(3) === "CURRENT" && <Clock className="w-4.5 h-4.5 animate-spin text-indigo-600" />}
                          {getStepStatus(3) === "PENDING" && <Clock className="w-4.5 h-4.5" />}
                        </div>
                        <div className={`h-12 w-0.5 ${getStepStatus(3) === "CHECKED" ? "bg-emerald-250" : "bg-slate-200"}`}></div>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        <h4 className="text-xs font-bold text-slate-900 font-display">3. Documentary Integrity Checks</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                          {candidate.admissionStatus === "Accepted" && "✓ Success! Formal documents certified."}
                          {candidate.admissionStatus === "Acceptance Rejected" && "⚠️ Letter scans rejected. Guardian / BVN name mismatch. Please verify."}
                          {candidate.admissionStatus === "Acceptance Sent" && "(Pending verification) Dossier uploaded and awaiting administrative approval."}
                          {candidate.admissionStatus !== "Accepted" && candidate.admissionStatus !== "Acceptance Sent" && candidate.admissionStatus !== "Acceptance Rejected" && "Awaiting hand-signed letter scanned upload actions."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${
                          getStepStatus(4) === "CHECKED"
                            ? "bg-emerald-100 text-emerald-700 shadow-md ring-4 ring-emerald-50 scale-110"
                            : "bg-slate-100 text-slate-450 border border-slate-200"
                        }`}>
                          <CheckCircle className="w-4.5 h-4.5" />
                        </div>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        <h4 className="text-xs font-bold text-slate-900 font-display">4. Official Enrollment Sealed</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                          {candidate.status === ProgramStatus.VERIFIED
                            ? "✓ Fully Verfied Registrar status! Class schedules active on TVET facilities."
                            : "Dossier locks automatically when the registry approved verification completes."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard Quick Notification overview */}
                <div className="bg-slate-1 dark:bg-slate-900/10 border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 font-display">Complete Your Registry Admission Form</h3>
                    <p className="text-[11.5px] text-slate-500 max-w-md font-mono leading-relaxed">
                      Initialize bank disbursal channels and parent contact data directly to prepare printable verification forms in TVET databases.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("form")}
                    className="shrink-0 bg-indigo-600 hover:bg-slate-900 text-white font-bold py-2 px-5 rounded-lg text-[10.5px] uppercase font-mono transition shadow-lg tracking-wider"
                  >
                    Enter Form
                  </button>
                </div>

              </div>

              {/* Right 4 Columns: Side widgets details / quick help info */}
              <div className="lg:col-span-4 space-y-6 text-left">
                
                {/* Visual support assistance help info */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-slate-100 p-6 rounded-2xl shadow-md border border-slate-800/60 text-left space-y-4">
                  <span className="text-[8px] font-mono tracking-widest text-indigo-400 font-bold uppercase">SECURED TOKEN LINK</span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold font-display">Accredited Repairs Area</h3>
                    <p className="text-[10px] text-indigo-300 font-mono tracking-wide mt-0.5 leading-relaxed">
                      You are allocated under Mobile Repairs & Electronics Maintenance TVET initiative facility track programs.
                    </p>
                  </div>

                  <div className="space-y-2 text-[10.5px] font-mono text-slate-300 pt-3 border-t border-indigo-950/50">
                    <div className="flex justify-between">
                      <span className="text-slate-450">Facility:</span>
                      <span className="font-extrabold truncate text-slate-100 tracking-tight max-w-[150px]">{candidate.tsp || "Not set"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Session Area:</span>
                      <span className="font-extrabold text-slate-100">Cohort Batch 1</span>
                    </div>
                  </div>
                </div>

                {/* Quick Info Box */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs text-left space-y-2">
                  <h4 className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest leading-none">REGISTRATION GUIDELINE</h4>
                  <p className="text-[10.5px] text-slate-505 font-mono leading-relaxed">
                    Make sure to upload signed scanned copy of your provisional admission letter on the profile section, then complete your bank account details under the formal admission form workspace!
                  </p>
                </div>

              </div>
              
            </div>
          )}

          {activeTab === "profile" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 max-w-6xl mx-auto">
              {/* Profile setup layout: Supplementary form (7 cols), Privacy key details (5 cols) */}
              <div className="lg:col-span-7">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs flex flex-col space-y-6 text-left">
                  <div className="space-y-1.5 border-b border-slate-100 pb-4">
                    <h2 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">
                      Intake & E-Signature Support Form
                    </h2>
                    <p className="text-[11px] text-slate-550 leading-relaxed font-mono">
                      Complete supplementary profile variables and sign physical placement seat reserving sheets.
                    </p>
                  </div>

                  {successResponse && (
                    <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-4 text-xs text-emerald-800 font-semibold space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-bold">E-Signature recorded successfully!</span>
                      </div>
                      <p className="text-[10.5px] text-emerald-600 leading-normal font-mono">{successResponse}</p>
                    </div>
                  )}

                  <form onSubmit={submitTraineeResponse} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Next of Kin Contact Name</label>
                      <input
                        type="text"
                        required
                        disabled={isFormCompleted}
                        placeholder="Full name of next of kin"
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Next of Kin contact Phone</label>
                      <input
                        type="tel"
                        required
                        disabled={isFormCompleted}
                        placeholder="e.g. +234 803 111 2222"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Guardian Name</label>
                        <input
                          type="text"
                          disabled={isFormCompleted}
                          placeholder="Parent/Sponsor Name"
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Highest Education Level</label>
                        <select
                          disabled={isFormCompleted}
                          value={highestQualification}
                          onChange={(e) => setHighestQualification(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-805"
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
                      <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Prior Electronics repair Experience</label>
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
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{lvl}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Medical/Physical Assistance declaration</label>
                      <textarea
                        disabled={isFormCompleted}
                        rows={2}
                        value={medicalDeclaration}
                        onChange={(e) => setMedicalDeclaration(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>

                    {/* Scanned upload signed image representation field */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-450 font-mono uppercase tracking-wider">Hand-Signed Acceptance Scan</label>
                      {candidate.acceptanceLetterUrl ? (
                        <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 text-center text-xs text-indigo-950 font-semibold flex items-center justify-center gap-1.5 font-mono">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>Scanned letter is verified and filed safely.</span>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-250 hover:border-indigo-600 bg-slate-50 rounded-xl p-5 text-center transition cursor-pointer relative">
                          <input
                            id="signed-upload-control"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          {handSignedBase64 ? (
                            <div className="space-y-1.5">
                              <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" />
                              <p className="text-[10px] text-slate-800 font-bold font-mono uppercase">scan selected</p>
                              <p className="text-[9px] text-slate-400 font-mono">Image data buffered. Ready to send.</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                              <p className="text-[10px] text-slate-705 font-bold uppercase">Click to select files</p>
                              <p className="text-[9px] text-slate-400">PDF, JPG, PNG formats up to 2MB supported</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!isFormCompleted && (
                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 mt-4 transition uppercase shadow-md cursor-pointer font-mono"
                      >
                        {formSubmitting ? "Uploading variables..." : "Register signed response"}
                        {!formSubmitting && <Send className="w-4 h-4" />}
                      </button>
                    )}
                  </form>
                </div>
              </div>

              {/* Password update section column */}
              <div className="lg:col-span-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs flex flex-col space-y-5 text-left">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <KeyRound className="w-5 h-5 text-slate-450" />
                    <h2 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">
                      Security Credentials Setting
                    </h2>
                  </div>
                  <p className="text-[10.5px] text-slate-500 font-mono leading-relaxed">
                    Prevent unauthorized placement modifications by changing your default assigned gateway key hashes regularly.
                  </p>

                  <form onSubmit={handlePasswordChange} className="space-y-4 font-mono">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase">Current secret</label>
                      <div className="relative">
                        <input
                          type={pwdShowCur ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs font-mono text-slate-805"
                        />
                        <button
                          type="button"
                          onClick={() => setPwdShowCur(!pwdShowCur)}
                          className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-650"
                        >
                          {pwdShowCur ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase">New secret</label>
                      <div className="relative">
                        <input
                          type={pwdShowNew ? "text" : "password"}
                          required
                          placeholder="New password code"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs font-mono text-slate-805"
                        />
                        <button
                          type="button"
                          onClick={() => setPwdShowNew(!pwdShowNew)}
                          className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-650"
                        >
                          {pwdShowNew ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 font-mono">
                      <label className="text-[9.5px] font-bold text-slate-505 uppercase">Verify replacement</label>
                      <input
                        type="password"
                        required
                        placeholder="Repeat password code"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-805 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                      />
                    </div>

                    <div className="pt-2 flex flex-col space-y-1">
                      {pwdError && <p className="text-[10px] font-bold text-rose-600">{pwdError}</p>}
                      {pwdSuccess && (
                        <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{pwdSuccess}</span>
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={pwdLoading}
                        className="w-full bg-slate-900 hover:bg-slate-950 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-[10px] uppercase font-mono tracking-wider transition cursor-pointer"
                      >
                        {pwdLoading ? "Modifying..." : "Update Secrets"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === "letter" && (
            <div className="max-w-4xl mx-auto text-left space-y-6">
              {/* Admission Letter page layout */}
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-xs text-left space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 font-display">Admissions Document Manager</h3>
                  <p className="text-xs text-slate-500 font-mono">Verify and fetch your approved letters in Federal Registry databases.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between text-left space-y-4">
                    <div className="space-y-2">
                      <div className="p-2.5 bg-indigo-50 text-indigo-900 rounded-lg w-fit">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">Offer of Admission letter</h4>
                      <p className="text-[10.5px] text-slate-500 leading-normal font-mono">Download formal Ministry of Education provisional seat allocation confirmation letter.</p>
                    </div>

                    {candidate.admissionLetterUrl ? (
                      <a
                        href={candidate.admissionLetterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-slate-900 hover:bg-indigo-950 text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wider uppercase text-center block"
                      >
                        <Download className="w-4 h-4 mx-auto inline" />
                        <span className="ml-2">Download (PDF)</span>
                      </a>
                    ) : (
                      <button disabled className="w-full bg-slate-100 text-slate-350 font-bold py-2 px-4 rounded-lg text-xs cursor-not-allowed">
                        Awaiting Letter Allocation
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between text-left space-y-4">
                    <div className="space-y-2">
                      <div className="p-2.5 bg-emerald-50 text-emerald-900 rounded-lg w-fit">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">Enrollment Confirmation certificate</h4>
                      <p className="text-[10.5px] text-slate-500 leading-normal font-mono">Available automatically once your uploaded scanned acceptance reviews successfully complete.</p>
                    </div>

                    {isEnrolled && candidate.enrollmentLetterUrl ? (
                      <a
                        href={candidate.enrollmentLetterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-emerald-650 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wider uppercase text-center block"
                      >
                        <Download className="w-4 h-4 mx-auto inline" />
                        <span className="ml-2">Download (PDF)</span>
                      </a>
                    ) : (
                      <button disabled className="w-full bg-slate-100 text-slate-350 font-bold py-2 px-4 rounded-lg text-xs cursor-not-allowed uppercase font-mono text-[9px]">
                        Pending Acceptance Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "form" && (
            <AdmissionFormPage
              candidate={candidate}
              onRefresh={fetchProfile}
            />
          )}

          {activeTab === "documents" && (
            <div className="max-w-4xl mx-auto text-left space-y-6">
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-xs text-left">
                <div className="border-b border-slate-100 pb-3 mb-5">
                  <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest leading-none">Structured Student Document Cabinet</h3>
                  <p className="text-xs mt-1 text-slate-500 font-mono">Durable cloud backing files registered on system registry servers.</p>
                </div>

                <div className="space-y-3">
                  {[
                    { name: "Provisional Offer of Admission Letter", size: "A4 Printable", url: candidate.admissionLetterUrl, ready: !!candidate.admissionLetterUrl },
                    { name: "Formal Signed Acceptance Scan Draft", size: "Scanned Template Upload", url: candidate.acceptanceLetterUrl, ready: !!candidate.acceptanceLetterUrl },
                    { name: "Official System Verification Admission Form", size: "Encrypted Dossier PDF", url: `/api/admissions/${candidate.id}/form/pdf`, ready: !!candidate.admissionFormPdfUrl },
                    { name: "Official Federal Enrollment Confirmation Certificate", size: "Enrollment Confirmed", url: candidate.enrollmentLetterUrl, ready: isEnrolled && !!candidate.enrollmentLetterUrl }
                  ].map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${doc.ready ? "bg-indigo-50 text-indigo-650" : "bg-slate-100 text-slate-350"}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <h4 className="text-xs font-bold text-slate-850 leading-none">{doc.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">{doc.size}</span>
                        </div>
                      </div>

                      {doc.ready ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-indigo-650 hover:text-indigo-900 uppercase font-mono flex items-center gap-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      ) : (
                        <span className="text-[10px] font-medium font-mono text-slate-350 bg-slate-50 px-2.5 py-1 rounded">NOT ACTIVE</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-xs text-left">
                <div className="border-b border-slate-100 pb-3 mb-5 flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest leading-none">System Notification events Center</h3>
                    <p className="text-xs text-slate-500 mt-1 font-mono">Official automated activity logs dispatched to student portal link records.</p>
                  </div>
                  <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold font-mono">LIVE FEED ACTIVE</span>
                </div>

                <div className="space-y-3.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 border rounded-xl flex gap-3 text-left transition-all duration-150 ${
                        n.type === "success"
                          ? "bg-emerald-50/50 border-emerald-150"
                          : n.type === "warning"
                          ? "bg-amber-50/50 border-amber-150"
                          : "bg-indigo-50/40 border-indigo-150"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.type === "success" ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        ) : n.type === "warning" ? (
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Info className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-xs font-extrabold text-slate-900">{n.title}</h4>
                          <span className="text-[9px] font-mono font-medium text-slate-400">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-650 leading-relaxed font-mono">{n.desc}</p>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="p-8 text-center text-slate-350 font-mono text-xs">
                      No notification messages located.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Unified Portal footer notices */}
        <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-[10px] text-slate-400 font-mono mt-auto shrink-0">
          <p>© {new Date().getFullYear()} Federal Ministry of Education · IDEAS-TVET Skills Sector Initiative</p>
        </footer>

      </main>

    </div>
  );
}
