/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Beneficiary } from "../types";
import { authFetch } from "../utils/authFetch";
import { useNotification } from "./NotificationContext";
import {
  FileText,
  Clock,
  CheckCircle,
  Lock,
  Download,
  AlertTriangle,
  ArrowRight,
  Info,
  Check,
  Building,
  User,
  CreditCard,
  RefreshCw,
  Eye
} from "lucide-react";

interface AdmissionFormPageProps {
  candidate: Beneficiary;
  onRefresh: () => Promise<void>;
}

export function AdmissionFormPage({ candidate, onRefresh }: AdmissionFormPageProps) {
  const { showToast } = useNotification();
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isConfirmingForm, setIsConfirmingForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form Fields State
  const [guardianName, setGuardianName] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [physicalChallenge, setPhysicalChallenge] = useState("None");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bvn, setBvn] = useState("");

  // Lock State Confirmation Checkboxes
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  useEffect(() => {
    if (candidate) {
      setGuardianName(candidate.guardianName || "");
      setGuardianAddress(candidate.guardianAddress || "");
      setGuardianPhone(candidate.guardianPhone || "");
      setPhysicalChallenge(candidate.physicalChallenge || "None");
      setBankAccountHolder(candidate.bankAccountHolder || "");
      setBankName(candidate.bankName || "");
      setBankSortCode(candidate.bankSortCode || "");
      setBankAccountNumber(candidate.bankAccountNumber || "");
      setBvn(candidate.bvn || "");

      // Send a VIEWED ping if status is GENERATED and form was not previously viewed
      if (candidate.admissionFormStatus === "GENERATED" && candidate.admissionFormPdfUrl) {
        markAsViewed();
      }
    }
  }, [candidate]);

  const markAsViewed = async () => {
    try {
      await authFetch(`/api/admissions/${candidate.id}/get-form`);
      await onRefresh();
    } catch (e) {
      console.error("Failed to automatically record viewed state", e);
    }
  };

  const handleGenerateForm = async () => {
    setIsGenerating(true);
    try {
      const res = await authFetch(`/api/admissions/${candidate.id}/generate-form`, { method: "POST" });
      if (res.ok) {
        showToast("Official system registration Admission Form generated!", "success");
        await onRefresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to trigger form generation.", "error");
      }
    } catch (err) {
      showToast("Network exception preparing document registry session.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const res = await authFetch(`/api/admissions/${candidate.id}/save-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardianName,
          guardianAddress,
          guardianPhone,
          physicalChallenge,
          bankAccountHolder,
          bankName,
          bankSortCode,
          bankAccountNumber,
          bvn
        })
      });
      if (res.ok) {
        showToast("Form draft saved successfully to database!", "success");
        await onRefresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save draft details.", "error");
      }
    } catch (err) {
      showToast("Network connection error saving draft.", "error");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleConfirmForm = async () => {
    if (!guardianName.trim() || !guardianPhone.trim() || !bankAccountHolder.trim() || !bankName.trim() || !bankAccountNumber.trim() || !bvn.trim()) {
      showToast("Please fill out all required fields marked with * before confirming.", "warning");
      return;
    }

    if (!declarationChecked || !privacyChecked) {
      showToast("You must read and tick all declaration check assertions to proceed.", "warning");
      return;
    }

    const conf = window.confirm(
      "Are you sure you want to lock and submit? Once submitted, your registration record is sealed on the Central Registry and CANNOT be modified. Ensure all bank details are correct."
    );
    if (!conf) return;

    setIsConfirmingForm(true);
    try {
      const res = await authFetch(`/api/admissions/${candidate.id}/confirm-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardianName,
          guardianAddress,
          guardianPhone,
          physicalChallenge,
          bankAccountHolder,
          bankName,
          bankSortCode,
          bankAccountNumber,
          bvn
        })
      });
      if (res.ok) {
        showToast("Success! Your Admission Form is verified, confirmed, and locked.", "success");
        await onRefresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to finalize form lock keys.", "error");
      }
    } catch (err) {
      showToast("Network exception transmitting confirmation records.", "error");
    } finally {
      setIsConfirmingForm(false);
    }
  };

  // Status computation
  const formStatus = candidate.admissionFormStatus || "NOT_GENERATED";

  const getStatusBadgeConfig = () => {
    switch (formStatus) {
      case "LOCKED":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <Lock className="w-5 h-5 text-emerald-600" />,
          title: "Admission Form Confirmed & Locked",
          desc: "Your enrollment registration form has been officially signed, sealed, and locked from further edits."
        };
      case "CONFIRMED":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-250",
          icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
          title: "Admission Form Confirmed",
          desc: "All registry details verified. Document queue active for automated registry integration."
        };
      case "IN_PROGRESS":
        return {
          bg: "bg-indigo-50 text-indigo-800 border-indigo-200",
          icon: <Clock className="w-5 h-5 text-indigo-600" />,
          title: "Complete Remaining Information",
          desc: "You have active draft edits saved. Please review, complete all details, checklist confirm, and submit."
        };
      case "VIEWED":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <Eye className="w-5 h-5 text-amber-600" />,
          title: "Admission Form Opened & Viewed",
          desc: "Document generated and accessed. Record editable below. Fill in mandatory fields to proceed."
        };
      case "GENERATED":
        return {
          bg: "bg-amber-50 text-amber-850 border-amber-150",
          icon: <FileText className="w-5 h-5 text-amber-600" />,
          title: "Official Record Ready for Verification",
          desc: "Admissions office has generated your verification form structure. Fill in your banking and guardian info."
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          icon: <AlertTriangle className="w-5 h-5 text-slate-500" />,
          title: "Registry Record Form Not Generated",
          desc: "Your formal student registration dossier structure is not active. Click the run button to begin form initialization."
        };
    }
  };

  const badgeConfig = getStatusBadgeConfig();
  const isFormLocked = formStatus === "LOCKED" || formStatus === "CONFIRMED" || !!candidate.admissionFormConfirmedAt;

  // Active step computed index for progress visualization
  const getStepIndex = () => {
    if (formStatus === "LOCKED") return 4;
    if (formStatus === "CONFIRMED") return 3;
    if (formStatus === "IN_PROGRESS") return 2;
    if (formStatus === "VIEWED" || formStatus === "GENERATED") return 1;
    return 0; // NOT_GENERATED
  };
  const stepIndex = getStepIndex();

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto pb-24">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">Trainee Admission Form</h1>
          <p className="text-xs text-slate-500">Official Federal Ministry of Education · IDEAS-TVET Registry Verification Dossier</p>
        </div>
        {candidate.id && (
          <div className="font-mono text-[10px] bg-slate-900 text-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="text-slate-400">REG SERIAL:</span>
            <span className="font-bold text-green-400 select-text">{`IDF-${candidate.id}`}</span>
          </div>
        )}
      </div>

      {/* 2. Status Banner */}
      <div className={`border p-5 rounded-2xl flex items-start gap-4 shadow-xs ${badgeConfig.bg}`}>
        <div className="p-2 bg-white/80 rounded-xl shadow-xs shrink-0">{badgeConfig.icon}</div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold font-display">{badgeConfig.title}</h3>
          <p className="text-xs opacity-90 leading-relaxed font-mono">{badgeConfig.desc}</p>
          {isFormLocked && candidate.admissionFormConfirmedAt && (
            <div className="text-[10px] uppercase font-bold tracking-wider pt-1 opacity-75 font-mono flex items-center gap-1.5">
              <span>Timestamp Locked:</span>
              <span className="bg-white/45 px-1.5 py-0.5 rounded text-emerald-950">
                {new Date(candidate.admissionFormConfirmedAt).toLocaleDateString("en-GB")} at {new Date(candidate.admissionFormConfirmedAt).toLocaleTimeString("en-GB")}
              </span>
              <span className="text-slate-400">|</span>
              <span>Signee Owner:</span>
              <span className="bg-white/45 px-1.5 py-0.5 rounded text-emerald-950 uppercase">{candidate.firstName} {candidate.lastName}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Visual Workflow Progress Steps Tracker */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <h4 className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest mb-6">
          Registry Form Lifecycle Path
        </h4>
        <div className="relative">
          {/* Gray Background Bar */}
          <div className="absolute top-4 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
          {/* Progress Colored Bar */}
          <div
            className="absolute top-4 left-0 h-1 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-500 rounded-full"
            style={{ width: `${stepIndex === 0 ? 0 : stepIndex === 1 ? 25 : stepIndex === 2 ? 50 : stepIndex === 3 ? 75 : 100}%` }}
          />

          <div className="grid grid-cols-5 relative z-10">
            {[
              { label: "1. Generated", code: "GENERATED" },
              { label: "2. Accessed", code: "VIEWED" },
              { label: "3. Draft Active", code: "IN_PROGRESS" },
              { label: "4. Certified", code: "CONFIRMED" },
              { label: "5. Sealed", code: "LOCKED" }
            ].map((step, idx) => {
              const isActive = stepIndex >= idx;
              const isCurrent = stepIndex === idx;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 text-xs font-bold font-mono ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-50"
                        : "bg-white border-2 border-slate-200 text-slate-450"
                    }`}
                  >
                    {isActive && idx < stepIndex ? <Check className="w-4.5 h-4.5 stroke-[3px]" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] mt-2 font-semibold tracking-tight text-center font-display ${
                      isCurrent
                        ? "text-indigo-600 font-extrabold"
                        : isActive
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {formStatus === "NOT_GENERATED" ? (
        <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center space-y-4 shadow-sm">
          <FileText className="w-12 h-12 text-slate-350 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 font-display">Dossier Initialization Required</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
            You must initialize your official Ministry Admission form profile to enable details capture and PDF exports.
          </p>
          <button
            onClick={handleGenerateForm}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase cursor-pointer tracking-wider font-mono flex items-center gap-2 mx-auto transition"
          >
            {isGenerating ? "Preparing keys..." : "Initialize Verification Form"}
            {!isGenerating && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Section A: Read-Only System Demographics */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-450" /> System-Populated Demographics
              </h3>
              <p className="text-[10px] text-slate-450 mt-0.5">Read-only facts verified during physical registry registration.</p>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">First Name</span>
                  <span className="font-semibold text-slate-805 select-text">{candidate.firstName || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Surname / Last Name</span>
                  <span className="font-semibold text-slate-805 select-text">{candidate.lastName || "Not provided"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Gender Marker</span>
                  <span className="text-slate-700">{candidate.gender || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Permanent NIN</span>
                  <span className="text-slate-705 text-[11px] font-bold select-text">{candidate.nin || "Not registered"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Date of Birth</span>
                  <span className="text-slate-700">
                    {candidate.dateOfBirth
                      ? new Date(candidate.dateOfBirth).toLocaleDateString("en-GB")
                      : "Not registered"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Contact Email</span>
                  <span className="text-slate-700 break-all select-text">{candidate.email || "Not registered"}</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 uppercase block font-bold">Physical Address of Residence</span>
                <span className="text-slate-800 leading-normal block select-text">{candidate.residentialAddress || "Not provided"}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">LGA of Origin</span>
                  <span className="text-slate-700">{candidate.city || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">State Origin Area</span>
                  <span className="text-slate-705 font-bold">{candidate.state || "Not provided"}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Accredited Skill Sector</span>
                  <span className="font-semibold text-indigo-650 font-sans block">{candidate.skillSector || "Cell Repairs and Electronics Maintenance"}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">Training Cohort Batch</span>
                    <span className="text-slate-700 font-bold">{candidate.batch || "Cohort 1 (2026)"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">Federal Registry TSP</span>
                    <span className="text-slate-700 truncate block font-sans font-bold" title={candidate.tsp}>{candidate.tsp || "Not assigned"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Editable Intake Fields */}
          <div className="space-y-6">
            
            {/* Parent/Guardian Info & Challenges */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-slate-450" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                  Guarantor & Parent Details
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                    Parent / Guardian Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    disabled={isFormLocked}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="e.g. Chief Aliyu Abubakar"
                    className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                    Parent Contact address
                  </label>
                  <input
                    type="text"
                    value={guardianAddress}
                    disabled={isFormLocked}
                    onChange={(e) => setGuardianAddress(e.target.value)}
                    placeholder="e.g. No 15 Garki Main Road, Abuja"
                    className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                      Guarantor Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={guardianPhone}
                      disabled={isFormLocked}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="e.g. +234 803 XXXXXXX"
                      className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                      Physical Challenge
                    </label>
                    <select
                      value={physicalChallenge}
                      disabled={isFormLocked}
                      onChange={(e) => setPhysicalChallenge(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="None">None</option>
                      <option value="Hearing Impaired">Hearing Impaired</option>
                      <option value="Visually Impaired">Visually Impaired</option>
                      <option value="Physical Disability">Physical Disability</option>
                      <option value="Speech Impaired">Speech Impaired</option>
                      <option value="Other">Other Specific Support Needed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank details card */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-450" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                  Monthly Stipend Account Channels
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                    Bank Account Holder Name <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[9.5px] text-slate-400 mb-1 font-sans">Must match the legal demographics of registered student.</p>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    disabled={isFormLocked}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="e.g. John Okafor"
                    className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                      Bank Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      disabled={isFormLocked}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Access Bank"
                      className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                      Bank Sort Code (6-digit)
                    </label>
                    <input
                      type="text"
                      value={bankSortCode}
                      disabled={isFormLocked}
                      onChange={(e) => setBankSortCode(e.target.value)}
                      placeholder="e.g. 058150"
                      className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                      Account Number (10-digit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      disabled={isFormLocked}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="e.g. 1023456789"
                      className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase font-black text-slate-500 block">
                      Bank Verification Number (BVN) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bvn}
                      disabled={isFormLocked}
                      onChange={(e) => setBvn(e.target.value)}
                      placeholder="e.g. 22212345678"
                      className="mt-1 block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-600 focus:bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmation & declaration region */}
            {!isFormLocked && (
              <div className="bg-slate-900 text-slate-100 border border-slate-850 p-5 rounded-2xl space-y-4 shadow-sm text-xs font-mono">
                <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-2 uppercase text-[10px] tracking-wider leading-none">
                  Legal Certification & Locking Declarations
                </h4>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={declarationChecked}
                      onChange={(e) => setDeclarationChecked(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[10px] text-slate-300 leading-normal">
                      I hereby confirm that the information contained in this admission form is true, legal, and correct.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={privacyChecked}
                      onChange={(e) => setPrivacyChecked(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[10px] text-slate-300 leading-normal">
                      I understand that once confirmed, this form cannot be edited, and will be locked permanently.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 border-t border-slate-200 p-4 backdrop-blur-md flex flex-row items-center justify-between shadow-2xl z-40 max-w-7xl mx-auto rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 hidden sm:block" />
          <span className="text-[9.5px] font-mono text-slate-500 hidden sm:block">
            {isFormLocked
              ? "✓ Formal locked records verified"
              : "⚠️ Check that all bank and guarantor details are correct before locking"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={`/api/admissions/${candidate.id}/form/pdf?format=html`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-250 rounded-lg font-bold flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span>Preview Form (HTML)</span>
          </a>

          {formStatus !== "NOT_GENERATED" && (
            <>
              <a
                href={`/api/admissions/${candidate.id}/form/pdf`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs bg-slate-900 hover:bg-black text-white rounded-lg font-bold flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-slate-300" />
                <span>Download PDF</span>
              </a>

              <a
                href={`/api/admissions/${candidate.id}/form/docx`}
                download={`Admission_Form_${candidate.lastName}_${candidate.firstName}.doc`}
                className="px-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 hover:border-slate-300 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Export Word</span>
              </a>
            </>
          )}

          {!isFormLocked && formStatus !== "NOT_GENERATED" && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isConfirmingForm}
                className="px-4 py-2 text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-bold transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSavingDraft ? "animate-spin" : ""}`} />
                <span>Save Draft</span>
              </button>

              <button
                onClick={handleConfirmForm}
                disabled={isSavingDraft || isConfirmingForm || !declarationChecked || !privacyChecked}
                className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white rounded-lg font-bold transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirm & Lock Form</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
