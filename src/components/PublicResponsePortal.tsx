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

  // Form Fields State with multi-session draft recovery fallback rules
  const [emergencyName, setEmergencyName] = useState(() => localStorage.getItem(`draft_${token}_emergencyName`) || "");
  const [emergencyPhone, setEmergencyPhone] = useState(() => localStorage.getItem(`draft_${token}_emergencyPhone`) || "");
  const [guardianName, setGuardianName] = useState(() => localStorage.getItem(`draft_${token}_guardianName`) || "");
  const [highestQualification, setHighestQualification] = useState(() => localStorage.getItem(`draft_${token}_highestQualification`) || "Secondary School Certificate");
  const [priorKnowledge, setPriorKnowledge] = useState(() => localStorage.getItem(`draft_${token}_priorKnowledge`) || "No Prior Knowledge");
  const [medicalDeclaration, setMedicalDeclaration] = useState(() => localStorage.getItem(`draft_${token}_medicalDeclaration`) === "true");

  // Step parameters for guided navigation
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem(`draft_${token}_currentStep`);
    return saved ? parseInt(saved, 10) : 1;
  });

  const handleSetStep = (step: number) => {
    setCurrentStep(step);
    localStorage.setItem(`draft_${token}_currentStep`, String(step));
  };

  const handleFieldChange = (field: string, value: any) => {
    if (field === "emergencyName") {
      setEmergencyName(value);
      localStorage.setItem(`draft_${token}_emergencyName`, value);
    } else if (field === "emergencyPhone") {
      setEmergencyPhone(value);
      localStorage.setItem(`draft_${token}_emergencyPhone`, value);
    } else if (field === "guardianName") {
      setGuardianName(value);
      localStorage.setItem(`draft_${token}_guardianName`, value);
    } else if (field === "highestQualification") {
      setHighestQualification(value);
      localStorage.setItem(`draft_${token}_highestQualification`, value);
    } else if (field === "priorKnowledge") {
      setPriorKnowledge(value);
      localStorage.setItem(`draft_${token}_priorKnowledge`, value);
    } else if (field === "medicalDeclaration") {
      setMedicalDeclaration(value);
      localStorage.setItem(`draft_${token}_medicalDeclaration`, String(value));
    }
  };

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
  const [isDeclined, setIsDeclined] = useState(false);

  // Validate Secure Token on Mount
  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admissions/validate-token?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          setCandidate(data.candidate);
          
          if (data.candidate.admissionStatus === "Declined") {
            setIsDeclined(true);
            setSubmissionSuccess(true);
          } else if (data.candidate.admissionStatus === "Acceptance Uploaded" || data.candidate.admissionStatus === "Accepted") {
            setSubmissionSuccess(true);
          }

          // Seed initial draft fields if student had some cached data
          if (data.candidate.admissionFormData) {
            const fd = data.candidate.admissionFormData;
            if (fd.emergencyName) handleFieldChange("emergencyName", fd.emergencyName);
            if (fd.emergencyPhone) handleFieldChange("emergencyPhone", fd.emergencyPhone);
            if (fd.guardianName) handleFieldChange("guardianName", fd.guardianName);
            if (fd.highestQualification) handleFieldChange("highestQualification", fd.highestQualification);
            if (fd.priorKnowledge) handleFieldChange("priorKnowledge", fd.priorKnowledge);
            if (fd.medicalDeclaration !== undefined) handleFieldChange("medicalDeclaration", fd.medicalDeclaration);
          }
        } else {
          const err = await res.json();
          setValidationError(err.error || "The link credentials have expired or are unrecognized.");
        }
      } catch (e) {
        setValidationError("Could not complete token gateway verification.");
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  // Handle PDF/Html download downloads
  const triggerAdmissionLetterDownload = () => {
    if (!candidate) return;
    window.open(`${API_BASE_URL}/api/admissions/download-letter/${candidate.id}`, "_blank");
  };

  const triggerAcceptanceLetterDownload = () => {
    if (!candidate) return;
    if (candidate.acceptanceLetterUrl) {
      window.open(candidate.acceptanceLetterUrl, "_blank");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Admission Acceptance Form - ${candidate.id}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 50px; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 25px; }
            .title { text-align: center; font-size: 16px; font-weight: bold; background: #e2e8f0; padding: 8px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="font-size: 22px; margin: 0;">Unique Technology Nig. Ltd</h1>
            <p style="font-size: 11px; margin: 3px 0; color: #64748b;">FEDERAL MINISTRY OF EDUCATION TVET SECTOR</p>
          </div>
          <div class="title">OFFER ACCEPTANCE & ENROLLMENT ATTESTATION CONTRACT</div>
          <br>
          <p>I, <strong>${candidate.firstName.toUpperCase()} ${candidate.lastName.toUpperCase()}</strong> (ID: ${candidate.id}), do hereby declare full acceptance of the offer into the Computer Hardware & repairs skill cohort.</p>
          <p>I pledge to conform to all class protocols, attend mandatory biometrics loggers daily, and maintain a minimum of 90 classroom hours.</p>
          <br><br><br>
          <div style="display: flex; justify-content: space-between;">
            <div style="border-top: 1px solid #475569; width: 45%; text-align: center; padding-top: 4px;">Trainee Ink / E-Signature</div>
            <div style="border-top: 1px solid #475569; width: 45%; text-align: center; padding-top: 4px;">Verified Hub Seal</div>
          </div>
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `IDEAS_TVET_Acceptance_Form_Template_${candidate.id}.html`;
    link.click();
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

  const handleNextToStep2 = () => {
    if (!emergencyName || !emergencyName.trim()) {
      alert("Next of Kin Name is required (*).");
      return;
    }
    if (!emergencyPhone || !emergencyPhone.trim()) {
      alert("Emergency Contact Phone Number is required (*).");
      return;
    }
    if (!guardianName || !guardianName.trim()) {
      alert("Parent / Sponsor Name (Guardian) is required (*).");
      return;
    }
    if (!medicalDeclaration) {
      alert("You must acknowledge and sign the physical workshop manual fitness declaration checkbox to proceed.");
      return;
    }
    handleSetStep(2);
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
        // Clear drafts
        const keysToClear = [
          "emergencyName", "emergencyPhone", "guardianName", 
          "highestQualification", "priorKnowledge", "medicalDeclaration", "currentStep"
        ];
        keysToClear.forEach(k => localStorage.removeItem(`draft_${token}_${k}`));

        setSubmissionSuccess(true);
        setIsDeclined(false);
        handleSetStep(3);
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

  // Call the Decline offer pipeline (Phase 3 option)
  const handleDeclineOffer = async () => {
    const confirmDecline = window.confirm(
      "Are you absolutely sure you want to decline this provisional admission offer? This action is permanent and irreversible."
    );
    if (!confirmDecline) return;

    setSubmitting(true);
    try {
      const payload = {
        token,
        responseData: {
          declined: true
        }
      };

      const res = await fetch(`${API_BASE_URL}/api/admissions/submit-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Clear drafts
        const keysToClear = [
          "emergencyName", "emergencyPhone", "guardianName", 
          "highestQualification", "priorKnowledge", "medicalDeclaration", "currentStep"
        ];
        keysToClear.forEach(k => localStorage.removeItem(`draft_${token}_${k}`));

        setIsDeclined(true);
        setSubmissionSuccess(true);
        handleSetStep(3);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to process decline request.");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected system anomaly occurred while submitting decline.");
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
    const isExpired = validationError.toLowerCase().includes("expire");
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-900 text-white font-sans px-6">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-950 p-8 border border-rose-950 rounded-2xl shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <CircleAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold font-sans text-rose-400 uppercase tracking-wide">
              {isExpired ? "Activation Link Expired" : "Activation Link Invalid"}
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isExpired ? (
                "This activation link has expired. Request a new activation email."
              ) : (
                "This activation link is invalid. Please contact your programme administrator."
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submissionSuccess) {
    if (isDeclined) {
      return (
        <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-950 text-white font-sans px-6">
          <div className="max-w-md w-full text-center space-y-6 bg-slate-900 p-8 border border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <CircleAlert className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold font-sans text-rose-400 uppercase tracking-wide">
                Admission Offer Declined
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Hello, <strong>{candidate.firstName} {candidate.lastName}</strong> (Applicant: {candidate.id}). You have formally declined the provisional admission offer for <strong>{candidate.program || "Computer Hardware and Cell Phone Repairs"}</strong>.
              </p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-left text-[11px] font-mono space-y-2 text-slate-400">
              <div className="flex items-center gap-2 text-slate-350 font-bold uppercase tracking-wider text-[10px] pb-1 border-b border-slate-800 font-sans">
                <CircleAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Registry Updates Applied:</span>
              </div>
              <div>• Candidate Admissions Status: <span className="text-rose-400 font-bold">DECLINED</span></div>
              <div>• Training TSP Organization: <span className="text-slate-300">{candidate.tsp}</span></div>
              <div>• Database Record Status: <span className="text-rose-400 font-bold">RELEASED</span></div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              The programme administrator has been updated. You may safely close this response window.
            </p>
          </div>
        </div>
      );
    }

    // Congratulations experience using live database loaded values (Phase 4 success page)
    return (
      <div className="min-h-screen w-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center font-sans antialiased px-6 py-12">
        <div className="max-w-xl w-full text-center space-y-8 bg-slate-950 p-8 sm:p-10 border border-emerald-950 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <FileCheck className="w-7 h-7 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-widest text-emerald-400">CONGRATULATIONS • ENROLLMENT LOCKED</span>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              Admission Formally Confirmed!
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              Dear <strong>{candidate.firstName} {candidate.lastName}</strong>, your signed acceptance contract and supplemental student demographics have been officially verified and committed to the federal TVET registry.
            </p>
          </div>

          {/* Live database properties list (Phase 4) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left text-xs space-y-3 font-sans">
            <div className="flex items-center gap-2 text-slate-300 font-extrabold uppercase tracking-wider text-[10px] pb-2 border-b border-indigo-900/40">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>COHORT ENROLLMENT VERIFIED RECORD:</span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Candidate ID:</span>
                <span className="text-slate-200 font-bold">{candidate.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Assigned TSP Center:</span>
                <span className="text-slate-200 font-bold">{candidate.tsp}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">Official Skill Cohort:</span>
                <span className="text-emerald-400 font-bold">{candidate.program}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider">State Region:</span>
                <span className="text-slate-200">{candidate.state} State ({candidate.city})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-sans font-bold uppercase tracking-wider font-mono">Admission status:</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase font-sans">
                  {candidate.status === "ENROLLED" ? "Enrolled" : "Accepted"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={triggerAdmissionLetterDownload}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 cursor-pointer flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Download Admission Offer
            </button>
            {candidate.acceptanceLetterUrl && (
              <a
                href={candidate.acceptanceLetterUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer flex items-center justify-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                View Acceptance Slip
              </a>
            )}
          </div>

          <p className="text-[10px] text-slate-500 font-mono">
            Thank you for joining the national skills recovery cohort. Standard bio loggers will commence next week.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white pb-12">
      {/* 1. Header Banner */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-slate-200 uppercase font-sans">
              {candidate.tsp || "Unique Technology Nig. Ltd"}
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

      {/* Modern guided progress indicator tracker */}
      <div className="max-w-4xl w-full mx-auto px-6 mt-6 animate-in fade-in duration-300">
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono font-bold text-[10px] uppercase tracking-wider text-slate-400">
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400 font-extrabold mr-1">
              STEP {currentStep} OF 2
            </span>
            <span>
              {currentStep === 1 
                ? "Supplemental Information & Lab Fitness Check" 
                : "Admission Documents Attestation & E-Signature"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500 font-bold font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>PROGRESS SAVE ENFORCED</span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-950 border border-slate-805 rounded-full overflow-hidden mt-3">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300" 
            style={{ width: currentStep === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>

      {/* 2. Main Content Canvas Container */}
      <main className="max-w-4xl w-full mx-auto px-6 mt-6 flex-grow space-y-8">
        
        {/* STEP 1: Candidate Roster Portrait & Help card */}
        {currentStep === 1 && (
          <>
            {/* STEP 0: Redesigned Candidate Roster & Portrait (Phase 3 requirement) */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-left flex flex-col md:flex-row gap-6 items-center md:items-start animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="relative shrink-0">
            {candidate.photo && (candidate.photo.startsWith("data:") || candidate.photo.length > 100) ? (
              <img
                id={`photo-${candidate.id}`}
                referrerPolicy="no-referrer"
                src={candidate.photo}
                alt="Candidate Avatar"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-indigo-500/30 shadow-md bg-slate-900"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-slate-800 bg-slate-900 flex flex-col items-center justify-center text-slate-500 shadow-inner">
                <FileText className="w-8 h-8 opacity-40 mb-1" />
                <span className="text-[8px] uppercase font-mono font-bold tracking-widest text-slate-400 text-center">NO PHOTO<br/>UPLOADED</span>
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-indigo-600 text-white rounded font-mono text-[9px] font-extrabold uppercase tracking-wide">
              TRAINEE
            </div>
          </div>

          <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 w-full">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Full Name</span>
              <h2 className="text-base font-extrabold text-slate-200">
                {candidate.firstName} {candidate.lastName}
              </h2>
            </div>
            
            <div className="space-y-0.5 font-mono">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Application Number</span>
              <span className="text-xs text-indigo-400 font-extrabold">{candidate.id}</span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Assigned TSP Center</span>
              <p className="text-xs text-slate-350 font-bold">
                {candidate.tsp || "Unique Technology Nig. Ltd"}
              </p>
            </div>

            <div className="space-y-0.5 font-mono">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">State & Sector</span>
              <span className="text-xs text-slate-350 font-semibold uppercase">
                {candidate.state || "FEDERAL COHORT"} State • {candidate.program || "Technology Diagnostic Sector"}
              </span>
            </div>

            <div className="space-y-0.5 col-span-1 sm:col-span-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Lifecycle Admission state</span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400">
                  Offer Status: {candidate.admissionStatus || "PENDING RESPONSE"}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400">
                  Acceptance Status: UNVERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Warning Alert Card */}
        <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-2xl p-6 flex gap-4 text-left">
          <div className="p-2 bg-indigo-900/40 rounded-lg text-indigo-400 h-fit">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Provisional FME Intake: Secure Verification Window
            </h4>
            <p className="text-xs text-slate-350 leading-relaxed">
              Hello, <strong>{candidate.firstName}</strong>! You have been granted provisional admission into <strong>{candidate.program}</strong>. Please download materials, provide emergency verification fields, and sign or upload standard acceptance terms.
            </p>
          </div>
        </div>
          </>
        )}

        <form onSubmit={handleFinalSubmit} className="space-y-8">

          {/* STEP 2: DOWNLOAD MATERIALS & CONTRACT VERIFICATION */}
          {currentStep === 2 && (
            <>
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
                  onClick={triggerAcceptanceLetterDownload}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                  title="Download Acceptance Form Template"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          </>
        )}

          {/* STEP 1 Questionnaire: FILL SUPPLEMENTAL DETAILS */}
          {currentStep === 1 && (
            <>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Next of Kin / Emergency Contact Name <span className="text-rose-455">*</span>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Emergency Contact Phone Number <span className="text-rose-455">*</span>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Parent / Sponsor Name (Guardian) <span className="text-rose-455">*</span>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Highest Academic Achievement <span className="text-rose-455">*</span>
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
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Prior repairs Knowledge / Diagnostic level <span className="text-rose-455">*</span>
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

          {/* Guided Step Navigation bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans text-xs">
            <div className="text-left">
              <p className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                ✓ PROGRESS CACHED LOCALLY
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Confirm metrics to activate next step.
              </p>
            </div>
            <button
              type="button"
              onClick={handleNextToStep2}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-505 text-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md font-mono"
            >
              <span>Proceed to Acceptance & Signature</span>
              <Check className="w-4 h-4 text-white shrink-0" />
            </button>
          </div>
          </>
        )}

          {/* STEP 2 Part 2: BIOMETRIC E-SIGNATURE & ENDORSEMENTS */}
          {currentStep === 2 && (
            <>
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
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Signature className="w-4.5 h-4.5 text-indigo-400" />
                    Option A: Draw Digital Signature (Touch / Cursor)
                  </span>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] text-rose-400 font-bold uppercase hover:underline transition flex items-center gap-1 cursor-pointer"
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
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
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
                        className="text-[10px] text-rose-400 uppercase font-bold hover:underline font-mono mt-1"
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

            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <span className="text-[10px] font-mono text-slate-500 block">
                Logged Hash: ID-{token.substring(0,8)} | State-Certified Protocol
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSetStep(1)}
                  disabled={submitting}
                  className="flex-1 sm:flex-initial py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-205 border border-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer font-sans"
                >
                  ← Back to Step 1
                </button>
                <button
                  type="button"
                  onClick={handleDeclineOffer}
                  disabled={submitting}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition hover:bg-rose-950/20 border border-rose-900/40 text-rose-400 cursor-pointer hover:border-rose-950"
                >
                  Decline Offer
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!hasSignature && !scannedLetterBase64)}
                  className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-lg text-xs font-bold uppercase tracking-wider transition active:scale-[98%] shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    submitting || (!hasSignature && !scannedLetterBase64)
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-450 text-slate-950 hover:scale-[101%]"
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
          </div>
            </>
          )}

        </form>
      </main>
    </div>
  );
}
