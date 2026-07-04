/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, ArrowDownToLine, Check, FileCheck, CircleAlert, 
  Trash2, Signature, HelpCircle, AlertCircle, Sparkles, UploadCloud 
} from "lucide-react";
import { API_BASE_URL } from "../config/api";

interface PublicResponsePortalProps {
  token: string;
  onClose: () => void;
}

export function PublicResponsePortal({ token, onClose }: PublicResponsePortalProps) {
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);

  // Form Fields State
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [highestQualification, setHighestQualification] = useState("Secondary School Certificate");
  const [priorKnowledge, setPriorKnowledge] = useState("No Prior Knowledge");
  const [medicalDeclaration, setMedicalDeclaration] = useState(false);

  // E-Signature Pad Parameters
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Scanned Document Upload Parameters
  const [scannedLetterBase64, setScannedLetterBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Submission Flow Parameters
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionWarning, setSubmissionWarning] = useState<string | null>(null);

  // Validate Secure Token on Mount
  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admissions/validate-token?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          setCandidate(data.candidate);
          
          if (data.alreadySubmitted || data.candidate.admissionStatus === "ACCEPTED" || data.candidate.admissionFormCompleted === true) {
            setIsAlreadySubmitted(true);
            setLoading(false);
            return;
          }

          // Seed initial draft fields if student had some cached data
          if (data.candidate.admissionFormData) {
            const fd = data.candidate.admissionFormData;
            if (fd.emergencyName) setEmergencyName(fd.emergencyName);
            if (fd.emergencyPhone) setEmergencyPhone(fd.emergencyPhone);
            if (fd.guardianName) setGuardianName(fd.guardianName);
            if (fd.highestQualification) setHighestQualification(fd.highestQualification);
            if (fd.priorKnowledge) setPriorKnowledge(fd.priorKnowledge);
            if (fd.medicalDeclaration !== undefined) setMedicalDeclaration(fd.medicalDeclaration);
          }
        } else {
          const err = await res.json();
          const errType = err.error || "";
          const errMsg = err.message || "";
          setErrorType(errType);

          if (res.status === 500 || errType === "SERVER_ERROR") {
            setErrorType("SERVER_ERROR");
            setValidationError("We could not complete link verification due to a server error. Please retry or contact your training provider.");
          } else if (errType === "TOKEN_EXPIRED" || errType === "OFFER_EXPIRED" || errType === "OFFER_WINDOW_EXPIRED") {
            setErrorType("TOKEN_EXPIRED");
            setValidationError(errMsg || "This offer link has expired. Please contact your training provider for a new link.");
          } else if (errType === "TOKEN_REVOKED") {
            setErrorType("TOKEN_REVOKED");
            setValidationError(errMsg || "This portal link is no longer active due to administrative status change or rollback.");
          } else if (errType === "TOKEN_SUBMITTED" || errType === "TOKEN_ALREADY_SUBMITTED" || errType === "ALREADY_SUBMITTED") {
            setErrorType("TOKEN_SUBMITTED");
            setValidationError(errMsg || "Your acceptance has already been submitted.");
          } else if (errType === "BENEFICIARY_NOT_FOUND" || errType === "TOKEN_INVALID") {
            setErrorType("TOKEN_INVALID");
            setValidationError(errMsg || "The candidate profile could not be found or activation link is invalid.");
          } else {
            setErrorType("TOKEN_INVALID");
            setValidationError(errMsg || "We could not verify this link. Please contact your training provider.");
          }
        }
      } catch (e) {
        setErrorType("SERVER_ERROR");
        setValidationError("We could not complete link verification due to a server error. Please retry or contact your training provider.");
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  // Handle PDF/Html download downloads
  const triggerAdmissionLetterDownload = () => {
    if (!candidate) return;
    window.open(`${API_BASE_URL}/api/admissions/download-letter/${candidate.id}?token=${encodeURIComponent(token)}`, "_blank");
  };

  const triggerAcceptanceTemplateDownload = () => {
    if (!candidate) return;
    window.open(`${API_BASE_URL}/api/admissions/download-acceptance/${candidate.id}?token=${encodeURIComponent(token)}`, "_blank");
  };

  const triggerAcceptanceLetterDownload = () => {
    if (!candidate) return;
    window.open(`${API_BASE_URL}/api/admissions/download-acceptance/${candidate.id}?token=${encodeURIComponent(token)}`, "_blank");
  };

  // E-Signature Drawing Logic
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support Touch and Mouse events smoothly
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    isDrawingRef.current = true;
    
    // Set Brush styling parameters (Elegantly drawn in tech-indigo stroke)
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#4f46e5";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // File Upload Handlers (Supports Drag and Drop + standard inputs)
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScannedLetterBase64(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Submit Admission Response Portal Details
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSignature && !scannedLetterBase64) {
      alert("Please provide your e-Signature drawing or upload a scanned signed Acceptance Form.");
      return;
    }

    setSubmitting(true);
    try {
      // Gather E-Signature Base64 if signed on canvas
      let signatureData = "";
      if (hasSignature && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL("image/png");
      }

      const payload = {
        token,
        responseData: {
          emergencyName,
          emergencyPhone,
          guardianName,
          highestQualification,
          priorKnowledge,
          medicalDeclaration,
          esignature: signatureData,
          uploadedAcceptanceLetter: scannedLetterBase64 || undefined
        }
      };

      const res = await fetch(`${API_BASE_URL}/api/admissions/submit-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.warning) {
          setSubmissionWarning(data.warning);
        }
        setSubmissionSuccess(true);
      } else {
        const err = await res.json();
        alert(err.error || "Failed submit validation checks.");
      }
    } catch (err) {
      console.error(err);
      alert("A system error occurred while transacting your admission details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-900 text-white font-sans">
        <div className="p-4 bg-indigo-600/10 rounded-full animate-bounce">
          <Sparkles className="w-10 h-10 text-indigo-400" />
        </div>
        <p className="mt-4 text-xs tracking-widest font-mono text-indigo-400 uppercase font-bold animate-pulse">
          Connecting Official Token Gateways...
        </p>
      </div>
    );
  }

  if (validationError) {
    let headingText = "Activation Link Invalid";
    if (errorType === "SERVER_ERROR") {
      headingText = "Verification Server Error";
    } else if (errorType === "TOKEN_EXPIRED") {
      headingText = "Activation Link Expired";
    } else if (errorType === "TOKEN_REVOKED") {
      headingText = "Activation Link Revoked";
    } else if (errorType === "TOKEN_SUBMITTED") {
      headingText = "Activation Link Already Submitted";
    } else if (validationError.toLowerCase().includes("expired") || validationError.toLowerCase().includes("expire")) {
      headingText = "Activation Link Expired";
    }

    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-900 text-white font-sans px-6">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-950 p-8 border border-rose-950 rounded-2xl shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <CircleAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold font-sans text-rose-400 uppercase tracking-wide">
              {headingText}
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              {validationError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAlreadySubmitted) {
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-900 text-white font-sans px-6">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-950 p-8 border border-emerald-950 rounded-2xl shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <FileCheck className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold font-sans text-emerald-400 uppercase tracking-wide">
              Acceptance Submitted
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Your acceptance has already been submitted.
            </p>
          </div>
          {candidate && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-left text-[11px] font-sans space-y-2 text-slate-400">
              <div>• Student: <strong>{candidate.firstName} {candidate.lastName}</strong></div>
              <div>• Status: <span className="text-emerald-400 font-bold">ACCEPTED</span></div>
            </div>
          )}
          <p className="text-[10px] text-slate-500 font-mono">
            You may safely close this response tab now.
          </p>
        </div>
      </div>
    );
  }

  if (submissionSuccess) {
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-900 text-white font-sans px-6">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-950 p-8 border border-emerald-950 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <FileCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold font-sans text-emerald-400 uppercase tracking-wide">
              Enrollment Declared Successful
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Thank you, <strong>{candidate.firstName} {candidate.lastName}</strong>! Your signed acceptance documentation and student profile details have been successfully certified by the federal TVET registry.
            </p>
          </div>

          {submissionWarning && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left text-xs text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Notice: Official PDF Render Queued</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200">
                {submissionWarning}
              </p>
            </div>
          )}

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-left text-[11px] font-sans space-y-2 text-slate-400">
            <div className="flex items-center gap-2 text-slate-350 font-bold uppercase tracking-wider text-[10px] pb-1 border-b border-slate-800">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registry Updates Applied:</span>
            </div>
            <div>• Candidate Admissions Status: <span className="text-emerald-400 font-bold">ACCEPTED</span></div>
            <div>• Attestation Contract Upload: <span className="text-emerald-400 font-bold">COMMITTED</span></div>
            <div>• Database Enrollment Lock: <span className="text-emerald-400 font-bold">VERIFIED</span></div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            You may safely close this response tab now.
          </p>
        </div>
      </div>
    );
  }

  if (candidate && (
    String(candidate.admissionStatus).toUpperCase() === "ACCEPTED" || 
    String(candidate.admissionStatus).toUpperCase() === "ACCEPTANCE UPLOADED" || 
    candidate.admissionFormCompleted
  )) {
    return (
      <div className="min-h-screen w-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased pb-12">
        {/* Header Banner */}
        <header className="bg-slate-950 border-b border-slate-800 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-slate-200 uppercase font-sans">
                Unique Technology Nig. Ltd
              </h1>
              <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Federal FME IDEAS-TVET Skills Registry Gateway
              </p>
            </div>
          </div>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2 self-start sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono font-bold text-indigo-400">
              PORTAL SECURED • SUBMISSION ARCHIVED
            </span>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="max-w-2xl w-full mx-auto px-6 mt-12 flex-grow space-y-8">
          
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-600" />
            
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-900">
              <FileCheck className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-3">
              <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold tracking-widest uppercase font-mono">
                Admission Finalized
              </span>
              <h2 className="text-xl font-bold font-sans text-slate-100 tracking-tight">
                Offer Acceptance Response Received
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed max-w-lg mx-auto">
                Welcome on board, <strong className="text-slate-200">{candidate.firstName} {candidate.lastName}</strong>! Your supplemental student profile is verified, and the signed offer acceptance contract has been successfully cataloged under standard Federal registry protocols.
              </p>
            </div>

            {/* Candidate Details & Status Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left space-y-4">
              <div className="flex items-center gap-2 text-slate-350 font-bold uppercase tracking-wider text-[10px] pb-2 border-b border-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Certified Enrollment Profile</span>
              </div>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">Student Reg ID</span>
                  <span className="font-bold text-slate-350 font-mono">{candidate.id}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">Assigned Course</span>
                  <span className="font-bold text-slate-350">{candidate.skillSector || "Computer Repairs Cohort"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">Admission Status</span>
                  <span className="font-bold text-emerald-400 uppercase">{candidate.admissionStatus || "Accepted"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">Form Verification</span>
                  <span className="font-bold text-emerald-400">COMPLETED & LOCKED</span>
                </div>
              </div>
            </div>

            {/* Next Steps Card */}
            <div className="border border-slate-850 bg-slate-900/50 rounded-2xl p-6 text-left space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[10px] pb-2 border-b border-indigo-950">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Next Onboarding Procedures</span>
              </div>
              
              <div className="space-y-3.5 text-xs text-slate-400">
                <div className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-slate-800 text-[10px] font-bold font-mono flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <h5 className="font-bold text-slate-300">Biometric Verification Log</h5>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      On your first day, walk up to the Unique Technology Nig. Ltd center registration workspace to register your finger logger credentials.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="h-5 w-5 rounded-full bg-slate-800 text-[10px] font-bold font-mono flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <h5 className="font-bold text-slate-300">Official Passport Upload</h5>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      The portal will prompt the final photo and ID cards step during centre-led biometric scheduling. Keep standard white background passport image copies ready.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <button
                type="button"
                onClick={triggerAdmissionLetterDownload}
                className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Download Admission Offer</span>
              </button>
              
              <button
                type="button"
                onClick={triggerAcceptanceLetterDownload}
                className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Download Acceptance Copy</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 font-mono">
              Federal TVET Digital Registry System • Secure Transaction ID: {candidate.id || "TRAINEE"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white pb-12">
      {/* 1. Header Banner */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-slate-200 uppercase font-sans">
              Unique Technology Nig. Ltd
            </h1>
            <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Federal FME IDEAS-TVET Skills Registry Gateway
            </p>
          </div>
        </div>
        <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2 self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-indigo-400">
            PORTAL ACTIVE • NO LOGIN REQUIRED
          </span>
        </div>
      </header>

      {/* 2. Main Content Canvas Container */}
      <main className="max-w-4xl w-full mx-auto px-6 mt-10 flex-grow space-y-8">
        
        {/* Dynamic Warning Alert Card */}
        <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-2xl p-6 flex gap-4">
          <div className="p-2 bg-indigo-900/40 rounded-lg text-indigo-400 h-fit">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-left">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Secure Registry Intake: Candidate Profile Located
            </h4>
            <p className="text-xs text-slate-350 leading-relaxed">
              Hello, <strong>{candidate.firstName} {candidate.lastName}</strong>! You have been awarded provisional admission into <strong>Computer Hardware and Cell Phone Repairs (IDEAS-TVET cohort)</strong>. Follow the steps below to download materials, provide necessary diagnostics fields, and sign your acceptance declaration.
            </p>
          </div>
        </div>

        <form onSubmit={handleFinalSubmit} className="space-y-8">

          {/* STEP 1: DOWNLOAD OFFICIAL MATERIALS */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-left">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <span className="h-6 w-6 rounded-full bg-slate-800 text-xs font-bold font-mono flex items-center justify-center text-indigo-400">
                01
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
                Formal Documents Download
              </h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Before submitting attestation forms, please download, read, and save copies of the credentials below containing reference numbers and stipend details.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Box 1: Admission Letter */}
              <div className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/30 p-4 rounded-xl flex items-center justify-between transition group">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-lg group-hover:scale-105 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">
                      Official Admission Offer
                    </h5>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Ref: {candidate.admissionRef || "Generated Ref"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={triggerAdmissionLetterDownload}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                  title="Download Admission Offer Letter"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </button>
              </div>

              {/* Box 2: Acceptance Template */}
              <div className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/30 p-4 rounded-xl flex items-center justify-between transition group">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-lg group-hover:scale-105 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">
                      Acceptance Template
                    </h5>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      A4 Attestation Contract
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={triggerAcceptanceTemplateDownload}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                  title="Download Acceptance Form Template"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* STEP 2: FILL SUPPLEMENTAL DETAILS */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-left">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <span className="h-6 w-6 rounded-full bg-slate-800 text-xs font-bold font-mono flex items-center justify-center text-indigo-400">
                02
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
                Supplemental Diagnostics Form
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Complete key metrics requested under federal guidelines. Verify carefully prior to submit sequences.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider">
                  Next of Kin / Emergency Contact Name <span className="text-rose-450">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                  placeholder="e.g. Samuel Adeyemi"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider">
                  Emergency Contact Phone Number <span className="text-rose-450">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                  placeholder="e.g. +234 809 ..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider">
                  Parent / Sponsor Name (Guardian) <span className="text-rose-450">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                  placeholder="e.g. Chief Gabriel Adeyemi"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider">
                  Highest Academic Achievement <span className="text-rose-450">*</span>
                </label>
                <select
                  value={highestQualification}
                  onChange={(e) => setHighestQualification(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                >
                  <option value="Secondary School Certificate">Secondary School Certificate (SSCE)</option>
                  <option value="National Diploma">National Diploma (ND/OND)</option>
                  <option value="Higher National Diploma">Higher National Diploma (HND)</option>
                  <option value="Bachelor's Degree">Bachelor's Degree (B.Sc / B.Tech / B.A)</option>
                  <option value="Vocational Trade Test">Vocational Trade Test Certificate</option>
                  <option value="Primary School Certificate">Primary School Certificate</option>
                  <option value="Other">Other Academic/Vocational Track</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider">
                  Prior repairs Knowledge / Diagnostic level <span className="text-rose-450">*</span>
                </label>
                <select
                  value={priorKnowledge}
                  onChange={(e) => setPriorKnowledge(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                >
                  <option value="No Prior Knowledge">No Prior Knowledge (Pure Beginner)</option>
                  <option value="Beginner/Basic">Beginner / Basic Knowledge (Screen Swaps)</option>
                  <option value="Intermediate Diagnostic">Intermediate Diagnostic Lab skills</option>
                  <option value="Experienced Device Tech">Experienced Device repairs technician</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="medical_chk"
                  checked={medicalDeclaration}
                  onChange={(e) => setMedicalDeclaration(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="medical_chk" className="text-xs text-slate-400 select-none cursor-pointer">
                  I declare that I am fit and able to participate manually in diagnostic lab workshops.
                </label>
              </div>
            </div>
          </div>

          {/* STEP 3: BIOMETRIC E-SIGNATURE OR FILE UPLOAD */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-left">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <span className="h-6 w-6 rounded-full bg-slate-800 text-xs font-bold font-mono flex items-center justify-center text-indigo-400">
                03
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
                Contract Endorsement & E-Signature
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Acceptance requires formal endorsement. Access either of the following paths: draw your signature on the interactive Pad OR upload a scanned file of your signed Acceptance Form.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Option A: Canvas E-Signature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                    <Signature className="w-4.5 h-4.5 text-indigo-400" />
                    Option A: Draw Digital Signature (Touch / Cursor)
                  </span>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] text-rose-450 font-bold uppercase hover:underline transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      clear pad
                    </button>
                  )}
                </div>

                <div className="border border-slate-800 hover:border-indigo-500/50 bg-slate-900 rounded-xl overflow-hidden shadow-inner transition">
                  <canvas
                    ref={canvasRef}
                    width={360}
                    height={180}
                    className="w-full bg-slate-950 cursor-crosshair blockTouchScroll"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Brush Active: Draw on tablet or with mouse coordinates. Full touch screen optimization locked.
                </p>
              </div>

              {/* Option B: Scanned Attestation Scan */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                  <UploadCloud className="w-4.5 h-4.5 text-emerald-400" />
                  Option B: Upload Signed Document Scan (PDF / Html / Image)
                </span>

                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col justify-center items-center gap-3 transition min-h-[180px] cursor-pointer ${
                    isDragOver 
                      ? "border-emerald-500 bg-emerald-500/5 text-slate-200" 
                      : scannedLetterBase64 
                        ? "border-emerald-600/50 bg-slate-950 text-slate-300" 
                        : "border-slate-850 hover:border-slate-700 bg-slate-900"
                  }`}
                  onClick={() => document.getElementById("file_picker")?.click()}
                >
                  <input
                    type="file"
                    id="file_picker"
                    className="hidden"
                    accept="image/*,application/pdf,text/html"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  {scannedLetterBase64 ? (
                    <>
                      <div className="h-10 w-10 text-emerald-400 bg-emerald-900/15 rounded-full flex items-center justify-center animate-bounce">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-450 uppercase tracking-widest leading-none">
                          Document Upload Loaded
                        </p>
                        <p className="text-[10px] font-mono text-slate-550 truncate max-w-[200px]">
                          {uploadedFileName || "scanned_document_contract.html"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScannedLetterBase64(null);
                          setUploadedFileName(null);
                        }}
                        className="text-[10px] text-rose-450 uppercase font-bold hover:underline font-mono mt-1"
                      >
                        remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-slate-500 group-hover:scale-110 transition" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Drag & Drop Scanned Letter
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          or click to choose files (Max 5MB)
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Supporting drag and drop and standard system picker actions in all form formats.
                </p>
              </div>
            </div>
          </div>

          {/* STEP 4: SUBMIT ATTESTATION CONTRACT */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl text-left">
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">
              Verification Attestation Declare check
            </h4>
            <p className="text-xs text-slate-450 leading-relaxed">
              By pressing the finalization button, I attet with high solemnity that the supplemental criteria supplied above represent truth. I declare provisional offer acceptance and authorize coordinates.
            </p>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <span className="text-[10px] font-mono text-slate-500 block">
                Logged Hash: ID-{token.substring(0,8)} | State-Certified Protocol
              </span>
              <button
                type="submit"
                disabled={submitting || (!hasSignature && !scannedLetterBase64)}
                className={`py-2.5 px-6 rounded-lg text-xs font-bold uppercase tracking-wider transition active:scale-[98%] shadow-md flex items-center gap-2 cursor-pointer ${
                  submitting || (!hasSignature && !scannedLetterBase64)
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-450 text-slate-950"
                }`}
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin inline-block" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4.5 h-4.5 text-slate-950" />
                    <span>Confirm & Accept Enrollment</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </main>
    </div>
  );
}
