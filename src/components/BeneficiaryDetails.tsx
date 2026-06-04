/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, Edit3, Printer, ShieldCheck, CheckCircle, ClipboardList, PenTool, 
  Award, Landmark, Check, Upload, FileText, Calendar, Trash2, Mail, ExternalLink, 
  Download, FileUp, Sparkles, AlertTriangle, FileCode, CheckSquare, Info,
  Copy, RotateCw, RefreshCw, FileSpreadsheet
} from "lucide-react";
import { Beneficiary, ProgramStatus, AuditLog } from "../types";

interface BeneficiaryDetailsProps {
  beneficiary: Beneficiary;
  onBack: () => void;
  onTriggerBiometrics: () => void;
  onEdit: () => void;
  onUpdate: (data: Partial<Beneficiary>) => Promise<void>;
}

export function BeneficiaryDetails({
  beneficiary,
  onBack,
  onTriggerBiometrics,
  onEdit,
  onUpdate
}: BeneficiaryDetailsProps) {
  
  const [activeTab, setActiveTab] = useState<"overview" | "admission" | "acceptance" | "forms" | "documents" | "training" | "audits">("overview");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [emailHealth, setEmailHealth] = useState<{ status: string; error?: string } | null>(null);
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Admin decision states
  const [rejectionMode, setRejectionMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textarea);
    }
  };

  const copySecureResponseLink = async () => {
    try {
      const res = await fetch(`/api/admissions/secure-link?beneficiaryId=${beneficiary.id}&origin=${encodeURIComponent(window.location.origin)}`);
      if (res.ok) {
        const data = await res.json();
        copyToClipboard(data.secureLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        alert("Failed to retrieve the secure response link.");
      }
    } catch (e) {
      console.error(e);
      alert("A system network error occurred while retrieving secure link.");
    }
  };

  // Load email service health metrics
  const fetchEmailHealth = async () => {
    try {
      const res = await fetch("/api/admissions/email-health");
      if (res.ok) {
        const data = await res.json();
        setEmailHealth(data);
      }
    } catch (e) {
      console.error("Failed to load SMTP health status details:", e);
    }
  };

  useEffect(() => {
    fetchEmailHealth();
  }, []);

  // Admin validation actions
  const approveVerification = async () => {
    if (!confirm("Are you sure you want to approve and verify this trainee? This will mark them as Accepted and verify their profiles.")) return;
    try {
      const res = await fetch("/api/admissions/approve-acceptance", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({ beneficiaryId: beneficiary.id, adminUser: "admission@uniqueideas.dontechservicesconst.com" })
      });
      if (res.ok) {
        const data = await res.json();
        await onUpdate(data.beneficiary);
        alert("Acceptance documents audited and approved! Trainee successfully verified.");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to approve documents.");
      }
    } catch (e) {
      console.error(e);
      alert("A system error occurred.");
    }
  };

  const submitRejection = async () => {
    if (!rejectReason.trim()) {
      alert("Please enter a clear reason for the rejection.");
      return;
    }
    try {
      const res = await fetch("/api/admissions/reject-acceptance", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({ beneficiaryId: beneficiary.id, adminUser: "admission@uniqueideas.dontechservicesconst.com", reason: rejectReason })
      });
      if (res.ok) {
        const data = await res.json();
        await onUpdate(data.beneficiary);
        setRejectionMode(false);
        setRejectReason("");
        alert("Acceptance documents declined. Status updated to Acceptance Rejected.");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit rejection.");
      }
    } catch (e) {
      console.error(e);
      alert("A system error occurred.");
    }
  };

  const markUnderReview = async () => {
    await onUpdate({ admissionStatus: "Under Review" });
    await logActionToBackend("BENEFICIARY_UPDATE", `Marked candidate verification status as UNDER REVIEW for candidate ID ${beneficiary.id}`);
  };
  
  // Local states for inputs to avoid typing lag
  const [formFields, setFormFields] = useState({
    emergencyName: beneficiary.admissionFormData?.emergencyName || "",
    emergencyPhone: beneficiary.admissionFormData?.emergencyPhone || "",
    guardianName: beneficiary.admissionFormData?.guardianName || "",
    highestQualification: beneficiary.admissionFormData?.highestQualification || "SSCE",
    priorKnowledge: beneficiary.admissionFormData?.priorKnowledge || "Beginner",
    medicalDeclaration: beneficiary.admissionFormData?.medicalDeclaration || false,
  });

  // Attendance log inputs
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceStatus, setAttendanceStatus] = useState<"Present" | "Absent" | "Excused">("Present");

  // Load audit logs strictly for this candidate
  useEffect(() => {
    fetchAuditLogs();
  }, [beneficiary.id]);

  useEffect(() => {
    // Keep local form in sync if beneficiary loads later
    setFormFields({
      emergencyName: beneficiary.admissionFormData?.emergencyName || "",
      emergencyPhone: beneficiary.admissionFormData?.emergencyPhone || "",
      guardianName: beneficiary.admissionFormData?.guardianName || "",
      highestQualification: beneficiary.admissionFormData?.highestQualification || "SSCE",
      priorKnowledge: beneficiary.admissionFormData?.priorKnowledge || "Beginner",
      medicalDeclaration: beneficiary.admissionFormData?.medicalDeclaration || false,
    });
  }, [beneficiary]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/audit-logs");
      if (res.ok) {
        const data = await res.json();
        // Filter actions belonging to this beneficiary id or matching full name
        const filtered = data.filter((log: AuditLog) => 
          log.details.includes(beneficiary.id) || 
          log.details.toLowerCase().includes(beneficiary.firstName.toLowerCase()) ||
          log.details.toLowerCase().includes(beneficiary.lastName.toLowerCase())
        );
        setAuditLogs(filtered);
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    }
  };

  const logActionToBackend = async (action: string, details: string) => {
    // Simulation updates candidate state directly while pushing an update
    // The server automatically logs "BENEFICIARY_UPDATE" when PUT api is called
    await fetchAuditLogs();
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert files to base64
  const processFile = (file: File, type: string) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      const updatedDocs = [...(beneficiary.documentsList || [])];
      const existIndex = updatedDocs.findIndex(d => d.type === type);
      
      const newDoc = {
        id: "doc_" + Date.now(),
        name: file.name,
        type,
        url: base64,
        uploadedAt: new Date().toISOString()
      };

      if (existIndex !== -1) {
        updatedDocs[existIndex] = newDoc;
      } else {
        updatedDocs.push(newDoc);
      }

      const updates: Partial<Beneficiary> = {
        documentsList: updatedDocs
      };

      // Also auto update specific quick handles
      if (type === "acceptance") {
        updates.acceptanceLetterUploaded = true;
        updates.acceptanceLetterUrl = base64;
        updates.acceptanceLetterUploadedAt = new Date().toISOString();
        if (beneficiary.admissionStatus === "Acceptance Pending" || !beneficiary.admissionStatus) {
          updates.admissionStatus = "Accepted";
        }
      }

      await onUpdate(updates);
      await logActionToBackend("DOCUMENT_UPLOAD", `Uploaded verified document scan (${type}): ${file.name} for candidate ID ${beneficiary.id}`);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  // Drag and Drop mechanics
  const handleDrag = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(type);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], type);
    }
  };

  const deleteDocument = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the document: "${name}"?`)) return;
    
    const updatedDocs = (beneficiary.documentsList || []).filter(d => d.id !== id);
    const updates: Partial<Beneficiary> = {
      documentsList: updatedDocs
    };

    // If deleting acceptance letter
    const targetDoc = (beneficiary.documentsList || []).find(d => d.id === id);
    if (targetDoc?.type === "acceptance") {
      updates.acceptanceLetterUploaded = false;
      updates.acceptanceLetterUrl = undefined;
      updates.acceptanceLetterUploadedAt = undefined;
    }

    await onUpdate(updates);
    await logActionToBackend("DOCUMENT_DELETE", `Removed document scan (${name}) for candidate ID ${beneficiary.id}`);
  };

  // Admission Workflow Triggers
  const generateAdmissionLetter = async () => {
    const admissionRef = `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
    await onUpdate({
      admissionStatus: "Admission Generated",
      admissionRef,
      admissionLetterGeneratedAt: new Date().toISOString(),
      status: ProgramStatus.VERIFIED
    });
    await logActionToBackend("ADMISSION_LETTER_GENERATE", `Generated official TVET admission offer letter (Ref: ${admissionRef}) for candidate ID ${beneficiary.id}`);
  };

  const sendAdmissionLetter = async () => {
    setEmailStatus("sending");
    try {
      // Auto generate admission letter credentials if not already processed
      if (!beneficiary.admissionRef) {
        const autoRef = `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
        await onUpdate({
          admissionStatus: "Admission Generated",
          admissionRef: autoRef,
          admissionLetterGeneratedAt: new Date().toISOString(),
          status: ProgramStatus.VERIFIED
        });
      }

      const res = await fetch("/api/admissions/send-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: beneficiary.id,
          origin: window.location.origin
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEmailStatus("sent");
          await onUpdate(data.beneficiary);
          alert(`Offer letter dispatched successfully!\n\nLink for student (No login required):\n${data.secureLink}`);
        } else {
          setEmailStatus("idle");
          await onUpdate(data.beneficiary);
          alert(`SMTP Delivery Failed: ${data.smtpErrorDetails || "Unknown SMTP error check."}`);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to trigger automated offer dispatch.");
        setEmailStatus("idle");
      }
    } catch (e) {
      console.error(e);
      alert("A system network error occurred while dispatching the offer.");
      setEmailStatus("idle");
    }
  };

  const acceptAdmissionDirectly = async () => {
    await onUpdate({
      admissionStatus: "Enrolled",
      status: ProgramStatus.IN_TRAINING,
      trainingProgress: {
        totalRequiredHours: 90,
        hoursCompleted: beneficiary.trainingProgress?.hoursCompleted || 0,
        completionStatus: "In Progress"
      }
    });
    await logActionToBackend("ADMISSION_ACCEPTED", `Admission officially accepted. Trainee cohort status elevated to ENROLLED for candidate ID ${beneficiary.id}`);
  };

  // Forms Submissions
  const saveAdmissionForm = async (status: "Draft" | "Verified") => {
    await onUpdate({
      admissionFormCompleted: status === "Verified",
      admissionFormStatus: status,
      admissionFormData: {
        ...formFields,
        submissionDate: new Date().toISOString()
      },
      // Automatically advance status if form verified
      ...(status === "Verified" && beneficiary.admissionStatus === "Admitted" ? { admissionStatus: "Admission Sent" } : {})
    });
    await logActionToBackend("ADMISSION_FORM_SAVE", `Saved admission registration profile form data as: [${status.toUpperCase()}] for candidate ID ${beneficiary.id}`);
    alert(`Admission registration form data saved successfully as ${status}!`);
  };

  // Logging Daily Attendance
  const addAttendanceLog = async () => {
    if (!attendanceDate) return;
    
    const newLog = {
      id: "att_" + Date.now(),
      date: attendanceDate,
      status: attendanceStatus,
      hoursLogged: attendanceStatus === "Present" ? 6 : 0 // Each standard lab day counts as 6 contact hours
    };

    const currentLogs = beneficiary.attendanceLogs || [];
    
    // Check if duplicate date
    if (currentLogs.some(l => l.date === attendanceDate)) {
      alert("An attendance record already exists for the selected date. Please choose another date or delete the existing record.");
      return;
    }

    const updatedLogs = [newLog, ...currentLogs];
    
    // Recalculate hours
    const totalHrs = updatedLogs.reduce((acc, curr) => acc + curr.hoursLogged, 0);
    const requiredHours = 90;
    
    let complStatus: "Not Started" | "In Progress" | "Completed" = "In Progress";
    let bStatus = beneficiary.status;
    let admissionFlowStatus = beneficiary.admissionStatus || "Enrolled";

    if (totalHrs >= requiredHours) {
      complStatus = "Completed";
      bStatus = ProgramStatus.VERIFIED; // Completed profiles verified
      admissionFlowStatus = "Training Completed";
    }

    await onUpdate({
      attendanceLogs: updatedLogs,
      admissionStatus: admissionFlowStatus,
      status: bStatus,
      trainingProgress: {
        totalRequiredHours: requiredHours,
        hoursCompleted: totalHrs,
        completionStatus: complStatus,
        grade: totalHrs >= requiredHours ? "A (Excellent)" : undefined
      }
    });

    await logActionToBackend("ATTENDANCE_LOGGED", `Logged daily attendance for Trainee (${attendanceStatus}) for date: ${attendanceDate}. Progress accumulated: ${totalHrs}/${requiredHours} hours.`);
  };

  const removeAttendanceLog = async (id: string, date: string) => {
    if (!confirm(`Are you sure you want to remove the attendance log for date ${date}?`)) return;
    
    const updatedLogs = (beneficiary.attendanceLogs || []).filter(l => l.id !== id);
    const totalHrs = updatedLogs.reduce((acc, curr) => acc + curr.hoursLogged, 0);
    const requiredHours = 90;

    await onUpdate({
      attendanceLogs: updatedLogs,
      trainingProgress: {
        totalRequiredHours: requiredHours,
        hoursCompleted: totalHrs,
        completionStatus: totalHrs >= requiredHours ? "Completed" : totalHrs > 0 ? "In Progress" : "Not Started"
      }
    });

    await logActionToBackend("ATTENDANCE_REMOVED", `Deleted daily attendance log record from date: ${date}. Candidate ID: ${beneficiary.id}`);
  };

  // Generate simple printable view for A4 letter
  const printAdmissionLetter = async () => {
    window.open(`/api/admissions/download-letter/${beneficiary.id}`, "_blank");
  };

  // Generate simple printable view for Form
  const printAdmissionForm = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const formHtml = `
      <html>
      <head>
        <title>Official Admission Enrollment Form - ID ${beneficiary.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 25px; }
          .header h1 { font-size: 20px; margin: 0; font-weight: bold; color: #0f172a; text-transform: uppercase; }
          .header p { font-size: 11px; margin: 5px 0 0 0; color: #64748b; font-weight: bold; text-transform: uppercase; }
          .form-title { text-align: center; font-size: 15px; font-weight: bold; background: #e2e8f0; padding: 6px; text-transform: uppercase; margin-bottom: 20px; border: 1px solid #cbd5e1; }
          .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 20px 0 10px 0; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .field { display: flex; flex-direction: column; }
          .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
          .value { font-size: 13px; font-weight: 600; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
          .terms { font-size: 11px; text-align: justify; margin-top: 30px; line-height: 1.4; color: #475569; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { width: 45%; text-align: center; }
          .sig-line { border-bottom: 1px solid #475569; height: 40px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Unique Technology Nig. Ltd</h1>
          <p>IDEAS-TVET Beneficiary Registration Catalog</p>
        </div>
        
        <div class="form-title">Federal Trainee Biometrics Enrollment Contract</div>

        <div class="section-title">1. Beneficiary Demographics</div>
        <div class="grid">
          <div class="field"><span class="label">Candidate Name</span><span class="value">${beneficiary.firstName} ${beneficiary.lastName}</span></div>
          <div class="field"><span class="label">Program Registry ID</span><span class="value">${beneficiary.id}</span></div>
          <div class="field"><span class="label">NIN Number</span><span class="value">${beneficiary.nin}</span></div>
          <div class="field"><span class="label">BVN Number</span><span class="value">${beneficiary.bvn}</span></div>
          <div class="field"><span class="label">State / City</span><span class="value">${beneficiary.state} (${beneficiary.city})</span></div>
          <div class="field"><span class="label">Skill Track Sector</span><span class="value">Computer Hardware & Cell Repairs</span></div>
        </div>

        <div class="section-title">2. Supplemental Registry Form Fields</div>
        <div class="grid">
          <div class="field"><span class="label">Next of Kin / Emergency Contact</span><span class="value">${formFields.emergencyName || "NOT SPECIFIED"}</span></div>
          <div class="field"><span class="label">Emergency Contact Phone</span><span class="value">${formFields.emergencyPhone || "NOT SPECIFIED"}</span></div>
          <div class="field"><span class="label">Parent / Sponsor Name</span><span class="value">${formFields.guardianName || "NOT SPECIFIED"}</span></div>
          <div class="field"><span class="label">Highest Academic Achievement</span><span class="value">${formFields.highestQualification}</span></div>
          <div class="field"><span class="label">Prior Device Repairs Knowledge Level</span><span class="value">${formFields.priorKnowledge}</span></div>
          <div class="field"><span class="label">Form Submission Date</span><span class="value">${beneficiary.admissionFormData?.submissionDate ? new Date(beneficiary.admissionFormData.submissionDate).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}</span></div>
        </div>

        <div class="terms">
          <strong>Declarative Attestation:</strong> I hereby declare that the details provided are true to the best of my knowledge and that I agree to conform to all academic protocols, biometrics tracking requirements, and disciplinary standards enacted by Unique Technology Nig. Ltd coordinates under Ministry guidelines.
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Candidate Endorsement</strong>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Verified Hub Coordinator Seal</strong>
          </div>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    printWindow.document.write(formHtml);
    printWindow.document.close();
  };

  // Derived variables for quick tab handles
  const documentsList = beneficiary.documentsList || [];
  const attendanceLogs = beneficiary.attendanceLogs || [];
  const training = beneficiary.trainingProgress || { totalRequiredHours: 90, hoursCompleted: 0, completionStatus: "Not Started" };
  const hoursPercent = Math.min(100, Math.round(((training.hoursCompleted || 0) / (training.totalRequiredHours || 90)) * 100));

  // Determine current active workflow Index
  const workflowSteps = [
    { key: "Draft", label: "Draft" },
    { key: "Admission Generated", label: "Admission Gen" },
    { key: "Admission Sent", label: "Admission Sent" },
    { key: "Offer Viewed", label: "Offer Viewed" },
    { key: "Acceptance Pending", label: "Acceptance Pend" },
    { key: "Acceptance Uploaded", label: "Acceptance Up" },
    { key: "Under Review", label: "Under Review" },
    { key: "Accepted", label: "Accepted" },
    { key: "Enrolled", label: "Enrolled" },
    { key: "Training In Progress", label: "In Training" },
    { key: "Training Completed", label: "Completed" },
    { key: "Certified", label: "Certified" },
    { key: "Alumni", label: "Alumni" }
  ];
  
  const currentStatus = (beneficiary.admissionStatus || "Draft") as string;
  let displayStatus = currentStatus;
  if (currentStatus === "Pending") {
    displayStatus = "Draft";
  } else if (currentStatus === "Admitted") {
    displayStatus = "Admission Generated";
  } else if (currentStatus === "Acceptance Rejected") {
    displayStatus = "Admission Sent";
  } else if (currentStatus === "Completed") {
    displayStatus = "Training Completed";
  } else if (currentStatus === "Acceptance Sent") {
    displayStatus = "Acceptance Uploaded";
  }
  const currentStepIndex = workflowSteps.findIndex(s => s.key === displayStatus);

  return (
    <div className="space-y-6 font-sans select-none max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Top Header & Navigation Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            <span>Beneficiaries</span>
            <span>/</span>
            <span className="text-slate-600 font-semibold">{beneficiary.firstName} {beneficiary.lastName}</span>
            <span>/</span>
            <span className="text-indigo-600 font-bold uppercase">{activeTab} Mode</span>
          </div>
          <h2 className="text-xl font-display font-medium text-slate-800 uppercase tracking-tight scale-y-[101%]">
            Beneficiary Portfolio Workspace
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onBack}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition outline-none cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
          
          <div className={`font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border ${
            beneficiary.status === ProgramStatus.VERIFIED 
              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
              : beneficiary.status === ProgramStatus.IN_TRAINING
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-yellow-50 text-yellow-600 border-yellow-100"
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              beneficiary.status === ProgramStatus.VERIFIED 
                ? "bg-emerald-500 animate-pulse" 
                : beneficiary.status === ProgramStatus.IN_TRAINING 
                ? "bg-blue-500 animate-pulse" 
                : "bg-yellow-500 animate-pulse"
            }`}></span>
            {beneficiary.status}
          </div>

          <div className="font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border bg-indigo-50 text-indigo-750 border-indigo-200">
            <span className="font-mono text-[9px] uppercase text-indigo-400 font-bold">LIFECYCLE:</span>
            <span className="font-bold">{beneficiary.admissionStatus || "Draft"}</span>
          </div>

          <button 
            type="button"
            onClick={onEdit}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition outline-none cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </button>

          <button 
            type="button"
            onClick={handlePrint}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 py-2 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition outline-none cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Portfolio
          </button>
        </div>
      </div>

      {/* Main split portfolio grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Static Info Anchor Card */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main passport avatar card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-indigo-650 border-l-indigo-600 text-center flex flex-col items-center space-y-4">
            
            <div className="relative group">
              <img 
                src={beneficiary.photo} 
                alt={`${beneficiary.firstName} Passport`} 
                referrerPolicy="no-referrer"
                className="w-32 h-32 rounded-full object-cover border-2 border-slate-200 shadow-md group-hover:opacity-90 transition"
              />
              <button 
                type="button"
                onClick={onTriggerBiometrics}
                className="absolute bottom-1 right-1 p-1.5 bg-indigo-600 border border-indigo-700 hover:bg-indigo-500 text-white rounded-full shadow-md transition"
                title="Surgical Camera Enrollment Capture Port"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            <div>
              <h3 className="font-display font-bold text-slate-900 text-base uppercase">
                {beneficiary.firstName} {beneficiary.lastName}
              </h3>
              <p className="text-[11px] text-indigo-700 font-bold font-mono tracking-tight mt-1 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">
                Mobile Hardware Repairs
              </p>
            </div>

            {/* Program specifics */}
            <div className="w-full pt-4 border-t border-slate-100 text-left space-y-3 text-xs">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-400 font-bold uppercase">BENEFICIARY ID</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{beneficiary.id}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400 font-bold uppercase">TRAINING HOURS TRACK</span>
                  <span className="font-bold text-slate-800">{training.hoursCompleted}/{training.totalRequiredHours} Hours</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      hoursPercent >= 100 ? "bg-emerald-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${hoursPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono pt-1">
                <span className="text-slate-400 font-bold uppercase">CURRICULUM UNIT</span>
                <span className="font-bold text-slate-700 uppercase">9 Units Completed</span>
              </div>
            </div>

          </div>

          {/* Center designation badge */}
          <div className="bg-indigo-950 text-slate-100 border border-indigo-900 rounded-xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] text-indigo-900/40 opacity-40">
              <Landmark className="w-20 h-20" />
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1 px-2 bg-indigo-900 text-indigo-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider block">
                Assigned skills coordinate
              </span>
            </div>

            <div className="space-y-0.5">
              <h4 className="font-semibold text-white text-xs uppercase tracking-tight">
                {beneficiary.tsp || "Unique Technology Nig. Ltd"}
              </h4>
              <p className="text-[10px] text-indigo-200">
                {beneficiary.state || "Imo State"}, {beneficiary.city || "Owerri"} Technical Hub
              </p>
            </div>

            <div className="pt-2 border-t border-indigo-900 text-[9px] w-full flex items-center gap-1.5 text-indigo-300">
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-mono tracking-tight font-bold uppercase">ACCREDITED IDEAS TVET PARTNER</span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive workspace and Tabs Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TAB STRIP CONTROL */}
          <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap gap-1 shadow-xs font-mono">
            {[
              { id: "overview", label: "OVERVIEW" },
              { id: "admission", label: "ADMISSION" },
              { id: "acceptance", label: "ACCEPTANCE" },
              { id: "forms", label: "FORMS" },
              { id: "documents", label: "DOCUMENTS" },
              { id: "training", label: "TRAINING" },
              { id: "audits", label: "AUDIT LOGS" }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  // Refresh on audits
                  if (tab.id === "audits") fetchAuditLogs();
                }}
                className={`flex-1 py-2 px-2.5 rounded-lg text-[10px] font-bold text-center uppercase tracking-wider cursor-pointer transition whitespace-nowrap ${
                  activeTab === tab.id 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB DETAILED CONTENTS */}

          {/* TAB 1: OVERVIEW PANEL */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-350">
              
              {/* PERSONAL INFO */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500" />
                  Personal Information Registered Profile
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-450 text-slate-400 font-bold block uppercase tracking-wider">Full Surname / Middle Name</span>
                    <span className="text-slate-800 font-semibold font-sans text-sm">
                      {beneficiary.lastName}, {beneficiary.firstName} {beneficiary.otherName || ""}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Date of Birth (Recorded Verification)</span>
                    <span className="text-slate-800 font-semibold font-sans text-sm">14 May 1998</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">NIN Identification Token</span>
                    <span className="text-slate-800 font-semibold text-sm">
                      {beneficiary.nin}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">BVN Financial Record ID</span>
                    <span className="text-slate-800 font-semibold text-sm">
                      {beneficiary.bvn}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Gender Demographics</span>
                    <span className="text-slate-800 font-semibold text-sm font-sans uppercase">{beneficiary.gender}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">State Base coordinate</span>
                    <span className="text-slate-800 font-semibold text-sm font-sans uppercase">{beneficiary.state} State</span>
                  </div>
                </div>
              </div>

              {/* CONTACTS INFO */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Contact & Communication Coordinates
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Email Address for Correspondence</span>
                    <span className="text-slate-800 font-medium text-sm font-sans">{beneficiary.email || "o.adeyemi.dev@email.com"}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Primary Mobile Contact</span>
                    <span className="text-slate-800 font-semibold text-sm">{beneficiary.phoneNumber || "+234 812 345 6789"}</span>
                  </div>

                  <div className="md:col-span-2 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Registered Residential Location Coordinates</span>
                    <span className="text-slate-800 font-medium text-sm font-sans leading-relaxed">
                      {beneficiary.residentialAddress || "24, Excellence Close, off Allen Avenue, Ikeja, Lagos State"}
                    </span>
                  </div>
                </div>
              </div>

              {/* HIGH LEVEL TIMELINE STATE */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-left">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  System Activity Status Milestones
                </h4>

                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  <div className="relative">
                    <div className="absolute left-[-23px] top-0.5 h-5 w-5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3" />
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">Biometrics Captured & Verified Log Entry</span>
                      <p className="text-slate-500 mt-0.5 leading-snug">Registration with standard 11-digit NIN locking parameters verified with federal registry backend.</p>
                      <span className="text-[9px] text-slate-450 text-slate-400 font-mono block mt-1">{new Date(beneficiary.createdAt).toLocaleString("en-GB")}</span>
                    </div>
                  </div>
                  {beneficiary.admissionRef && (
                    <div className="relative">
                      <div className="absolute left-[-23px] top-0.5 h-5 w-5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full flex items-center justify-center">
                        <FileText className="w-3 h-3" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Admission Letter Generated (Ref: {beneficiary.admissionRef})</span>
                        <p className="text-slate-500 mt-0.5 leading-snug">Academic offer issued by Unique Technology Nig. Ltd Coordinator under Ministry cohort parameters.</p>
                        <span className="text-[9px] text-slate-400 font-mono block mt-1">
                          {beneficiary.admissionLetterGeneratedAt ? new Date(beneficiary.admissionLetterGeneratedAt).toLocaleString("en-GB") : "N/A"}
                        </span>
                      </div>
                    </div>
                  )}
                  {beneficiary.admissionFormCompleted && (
                    <div className="relative">
                      <div className="absolute left-[-23px] top-0.5 h-5 w-5 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-full flex items-center justify-center">
                        <PenTool className="w-3 h-3" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Complete Application Forms Verified</span>
                        <p className="text-slate-500 mt-0.5 leading-snug">Self-declarations and parent emergency protocols logged as compliant and locked.</p>
                        <span className="text-[9px] text-slate-400 font-mono block mt-1">
                          Completed on {new Date(beneficiary.admissionFormData?.submissionDate || Date.now()).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ADMISSION PANEL */}
          {activeTab === "admission" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              
              {/* FLOW STEP TRACKER */}
              <div className="space-y-4">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span>Admission Workflow Steps Tracking</span>
                  <span className="text-[10px] text-slate-450 font-mono text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded font-bold">
                    ACTIVE FIELD: {currentStatus}
                  </span>
                </h4>

                <div className="flex items-center gap-4 py-4 px-3 bg-slate-50/50 rounded-xl border border-slate-100 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                  {workflowSteps.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={idx} className="flex-shrink-0 min-w-[100px] flex flex-col items-center gap-2 font-mono text-center relative">
                        {/* Connecting line */}
                        {idx !== 0 && (
                          <div className="absolute left-[-50%] right-[50%] top-3.5 h-0.5 bg-slate-200/90 z-0" />
                        )}
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition border ${
                          isCompleted 
                            ? "bg-indigo-600 border-indigo-700 text-white shadow-xs" 
                            : isCurrent 
                            ? "bg-yellow-500 border-yellow-600 text-slate-950 font-bold animate-pulse" 
                            : "bg-white text-slate-350 border-slate-200"
                        }`}>
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <div>
                          <span className={`block text-[9px] font-bold uppercase whitespace-nowrap ${
                            isCurrent ? "text-indigo-600 font-extrabold" : isCompleted ? "text-slate-800" : "text-slate-400"
                          }`}>{step.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 13-stage Workflow Elevator Control Dropdown */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-200/60 p-4 rounded-xl">
                  <div>
                    <h5 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">Administrative Pipeline Elevation Option</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">As an authorized officer, you can manually elevate or adjust this beneficiary's status along the 13-stage TVET training registry lifecycle.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">Change Stage:</span>
                    <select
                      value={currentStatus}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        if (confirm(`Elevate beneficiary to [${newStatus}] lifecycle stage?`)) {
                          try {
                            await onUpdate({ admissionStatus: newStatus });
                            alert(`Beneficiary successfully advanced/reverted to stage: ${newStatus}`);
                          } catch (err: any) {
                            alert(`Failed to update stage: ${err.message}`);
                          }
                        }
                      }}
                      className="bg-white hover:bg-slate-50 border border-slate-300 py-1.5 px-3.5 rounded-lg text-xs font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs transition"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Admission Generated">Admission Generated</option>
                      <option value="Admission Sent">Admission Sent</option>
                      <option value="Offer Viewed">Offer Viewed</option>
                      <option value="Acceptance Pending">Acceptance Pending</option>
                      <option value="Acceptance Uploaded">Acceptance Uploaded</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Enrolled">Enrolled</option>
                      <option value="Training In Progress">Training In Progress</option>
                      <option value="Training Completed">Training Completed</option>
                      <option value="Certified">Certified</option>
                      <option value="Alumni">Alumni</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ACTION LAYERS & ADMINISTRATIVE CONTROLS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4 border border-slate-150 p-5 rounded-xl bg-slate-50/40">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-650" />
                      Offer Generation & Action Node
                    </h5>
                    {beneficiary.admissionRef && (
                      <span className="text-[9px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                        REF: {beneficiary.admissionRef}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-slate-500 font-sans leading-normal">
                    Generate, print, and dispatch primary registration credentials, certificate letters, and response forms to candidates securely.
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Primary Generation Call */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={generateAdmissionLetter}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer transition active:scale-97"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                        {beneficiary.admissionRef ? "Regenerate Offer Letter" : "Generate Admission Offer"}
                      </button>

                      <button
                        type="button"
                        onClick={printAdmissionLetter}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Preview & Print Letter
                      </button>
                    </div>

                    {/* Secondary admin actions grid - AVAILABLE AT ALL TIMES */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-150 space-y-3">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Administrative Dispatches Desk</span>
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold font-mono">
                        <button
                          type="button"
                          onClick={printAdmissionLetter}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-705 border border-slate-200 py-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          Download PDF
                        </button>

                        <button
                          type="button"
                          onClick={copySecureResponseLink}
                          className={`py-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition border ${
                            copiedLink 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-slate-50 hover:bg-slate-100 text-slate-707 border-slate-200"
                          }`}
                        >
                          {copiedLink ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-650" />
                              Copied Link!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              Copy Secure Link
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {/* Send / Resend Email buttons always available! */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={sendAdmissionLetter}
                            disabled={emailStatus === "sending"}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-mono font-bold"
                          >
                            <Mail className="w-3.5 h-3.5 text-emerald-200" />
                            {emailStatus === "sending" ? "Sending Dispatch..." : beneficiary.emailStatus === "Sent" ? "Resend Email Offer" : "Send Email Offer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PREVIEW CONTAINER */}
                <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-xs flex flex-col justify-between max-h-[380px] overflow-hidden text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Live Paper Template Preview</span>
                    <button 
                      type="button"
                      onClick={printAdmissionLetter} 
                      className="text-indigo-650 hover:text-indigo-805 text-[10px] font-mono font-bold flex items-center gap-0.5"
                    >
                      Fullscreen Preview <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 text-[9px] font-serif border border-slate-100 rounded-lg overflow-y-auto leading-normal text-slate-700 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-justify flex-grow mt-2">
                    <div className="text-center font-bold font-sans text-[11px] uppercase text-indigo-900 border-b border-indigo-250 pb-1 mb-2">
                      UNIQUE TECHNOLOGY NIG. LTD
                    </div>
                    <div className="flex justify-between font-mono text-[7px] text-slate-400 mb-2">
                      <span>REF: {beneficiary.admissionRef || "DRAFT_PENDING_GENERATION"}</span>
                      <span>Date: {new Date().toLocaleDateString("en-GB")}</span>
                    </div>
                    <p className="mb-2"><strong>To: {beneficiary.firstName.toUpperCase()} {beneficiary.lastName.toUpperCase()}</strong></p>
                    <p className="mb-2">We are pleased to offer you provisional admission into our intensive skills training workshop for <strong>Computer Hardware and Cell Phone Repairs</strong>.</p>
                    <p className="mb-2">This study track entails extensive labs verifying component diagnosis, board soldering, and schematic analysis.</p>
                    <p className="mb-2">Failure to satisfy biometrics attendance daily disqualifies the candidate from acquiring stipes.</p>
                    <p className="border-t border-slate-200 pt-2 block font-sans font-bold text-[7px] text-slate-400 mt-2">OPERATIONAL REGISTRY COORDINATOR SEAL</p>
                  </div>
                </div>
              </div>

              {/* EMAIL CURRENT STATUS & TRANSMISSION CONTROL PANEL */}
              <div className="space-y-4 border border-slate-150 p-5 rounded-xl bg-slate-50/40 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-slate-800 text-xs uppercase flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-650" />
                      Operational Transmission Control Desk
                    </h5>
                    <span className="text-[10px] text-slate-400 font-sans block font-semibold">Monitor independent electronic notifications delivery status</span>
                  </div>
                  
                  {/* Separate Email Status Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">SMTP status:</span>
                    {emailHealth ? (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono flex items-center gap-1 border ${
                        emailHealth.status === "SMTP Connected"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : emailHealth.status === "Simulator Mode"
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          emailHealth.status === "SMTP Connected" ? "bg-emerald-500 animate-pulse" : emailHealth.status === "Simulator Mode" ? "bg-blue-500" : "bg-rose-500"
                        }`} />
                        {emailHealth.status}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[9px] font-mono animate-pulse">Checking...</span>
                    )}
                  </div>
                </div>

                {/* EMAIL STATUS METRICS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 font-mono">
                  {[
                    { label: "Not Sent", statusKey: "Not Sent", style: "border-slate-150 text-slate-400 bg-white" },
                    { label: "Sending", statusKey: "Sending", style: "bg-amber-50 border-amber-200 text-amber-750 font-bold animate-pulse" },
                    { label: "Sent", statusKey: "Sent", style: "bg-emerald-50 border-emerald-200 text-emerald-850 shadow-xs" },
                    { label: "Failed", statusKey: "Failed", style: "bg-rose-50 border-rose-200 text-rose-750 font-bold animate-pulse" }
                  ].map((item, keyIdx) => {
                    const localStatus = emailStatus === "sending" ? "Sending" : (beneficiary.emailStatus || "Not Sent");
                    const isActive = localStatus === item.statusKey;
                    return (
                      <div key={keyIdx} className={`p-3 rounded-lg border text-center transition ${
                        isActive 
                          ? item.style + " border-2 font-extrabold" 
                          : "bg-slate-100/40 border-slate-150 text-slate-400"
                      }`}>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider">{item.label}</div>
                        <div className="text-[8px] mt-1 font-semibold">
                          {isActive ? "CURRENT STATUS ✓" : "INACTIVE"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SMTP TROUBLESHOOTING DETAILS AND RETRY ZONE */}
                {(emailStatus === "sending" ? "Sending" : (beneficiary.emailStatus || "Not Sent")) === "Failed" && (
                  <div className="p-3.5 bg-rose-50/50 border border-rose-150 rounded-xl space-y-2 mt-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-605 shrink-0 mt-0.5 text-rose-605" />
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-rose-800 block uppercase font-mono tracking-wider">SMTP Delivery Failure Encountered</span>
                        <p className="text-xs text-rose-700 font-sans leading-normal">
                          The mail transfer agent was unable to submit the message to the recipient's host. Recipient Email: <span className="font-semibold">{beneficiary.bvn || beneficiary.email}</span>
                        </p>
                        {beneficiary.smtpErrorDetails && (
                          <div className="p-2 bg-rose-50 border border-rose-200 text-[10px] font-mono text-rose-850 rounded">
                            ERROR LOG: {beneficiary.smtpErrorDetails}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={sendAdmissionLetter}
                        disabled={emailStatus === "sending"}
                        className="bg-rose-605 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs border border-rose-700 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${emailStatus === "sending" ? "animate-spin" : ""}`} />
                        Retry Electronic Dispatch Now
                      </button>
                    </div>
                  </div>
                )}

                {/* DELIVERY HISTORY SECTION */}
                <div className="space-y-2 mt-2 pt-3 border-t border-slate-150">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block font-semibold">Complete SMTP Delivery Transmission History</span>
                  {beneficiary.emailDeliveryHistory && beneficiary.emailDeliveryHistory.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left font-mono text-[10px] text-slate-650 border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-semibold select-none">
                            <th className="p-2.5">Date Sent</th>
                            <th className="p-2.5">Recipient Email</th>
                            <th className="p-2.5">Result</th>
                            <th className="p-2.5">SMTP Response Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {beneficiary.emailDeliveryHistory.map((d, dIdx) => (
                            <tr key={dIdx} className="hover:bg-slate-50">
                              <td className="p-2.5 text-slate-500 whitespace-nowrap">{new Date(d.dateSent).toLocaleString()}</td>
                              <td className="p-2.5 font-sans font-semibold text-slate-800">{d.recipientEmail}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                  d.deliveryResult === "Sent" 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border-rose-100"
                                }`}>
                                  {d.deliveryResult}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-500 max-w-xs truncate" title={d.smtpResponse}>
                                {d.smtpResponse}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-slate-400 font-mono text-[10px] uppercase tracking-wider bg-slate-50/50 rounded-lg border border-slate-150 transition min-h-16 flex items-center justify-center font-bold col-span-4">
                      No official transmission logs saved on record. Use the actions above to establish dispatches.
                    </div>
                  )}
                </div>

                {/* Legacy detailed logs trail */}
                <div className="space-y-2 mt-2 pt-2 border-t border-slate-150">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block font-bold">Web Hook Correspondence Pulse Engine Feed</span>
                  {beneficiary.emailTrackingHistory && beneficiary.emailTrackingHistory.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {beneficiary.emailTrackingHistory.map((h, hIdx) => (
                        <div key={hIdx} className="p-2.5 bg-white border border-slate-150 rounded-lg text-[10px] font-mono flex items-start gap-2.5">
                          <span className="text-slate-400 shrink-0 select-none">[{new Date(h.timestamp).toLocaleTimeString()}]</span>
                          <div className="space-y-0.5">
                            <span className={`font-bold uppercase inline-block ${
                              h.status === "Opened" ? "text-indigo-600" : h.status === "Delivered" ? "text-emerald-700" : "text-rose-600"
                            }`}>{h.status}</span>
                            <p className="text-slate-605 text-slate-600 font-sans mt-0.5 leading-snug">{h.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2.5 text-center text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                      No automated correspondence tracking records discovered
                    </div>
                  )}
                </div>
              </div>

              {/* Historical Admission Versions Grid */}
              <div className="space-y-3 text-left border-t border-slate-100 pt-5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Admission Letters Compilation History Versions</span>
                {beneficiary.admissionLetterVersions && beneficiary.admissionLetterVersions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {beneficiary.admissionLetterVersions.map((v, vIdx) => (
                      <div key={vIdx} className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs flex items-center justify-between font-mono">
                        <div className="space-y-0.5 text-left">
                          <span className="font-bold text-slate-800 block text-xs">Offer Letter (Version {v.version})</span>
                          <span className="text-[9px] text-slate-400">Compiled: {new Date(v.generatedAt).toLocaleString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const win = window.open("", "_blank");
                            win?.document.write(v.url);
                            win?.document.close();
                          }}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] shadow-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          Launch HTML <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center font-mono py-4 bg-slate-50 rounded border border-slate-150 uppercase tracking-widest">
                    No historical letters compiled
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: ACCEPTANCE PANEL */}
          {activeTab === "acceptance" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <h4 className="font-display font-bold text-slate-900 text-xs uppercase pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Trainee Admission Acceptance Protocols</span>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded font-bold uppercase">
                  {beneficiary.acceptanceLetterUploaded ? "APPROVED PORTFOLIO" : "PENDING COHORT SIGN-OFF"}
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                
                {/* UPLOAD MECHANICS */}
                <div className="space-y-4 flex flex-col justify-between p-5 border border-slate-150 rounded-xl bg-slate-50/40">
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-emerald-650 text-emerald-600" />
                      Sign-off Documents Upload
                    </h5>
                    <p className="text-[11px] text-slate-500 font-sans leading-normal">
                      Scan and upload the signed Admission Acceptance Letter here. Supported formats: JPG/PNG scans or PDFs. This automatically verifies the enrollment status.
                    </p>
                  </div>

                  {/* DROP ZONE (Aesthetic & Interactive Drag and Drop) */}
                  <div 
                    onDragEnter={(e) => handleDrag(e, "acceptance")}
                    onDragOver={(e) => handleDrag(e, "acceptance")}
                    onDragLeave={(e) => handleDrag(e, "acceptance")}
                    onDrop={(e) => handleDrop(e, "acceptance")}
                    className={`mt-3 py-6 px-4 rounded-xl border-2 border-dashed text-center flex flex-col items-center justify-center cursor-pointer transition ${
                      dragActive === "acceptance"
                        ? "bg-indigo-50 border-indigo-500/70"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Upload className="w-7 h-7 text-slate-400 stroke-1 block mb-2" />
                    <span className="text-[10px] font-bold font-mono text-slate-700 block mb-1">Drag Acceptance Document here</span>
                    <span className="text-[9px] text-slate-450 text-slate-400 block mb-2">or browse device file explorer</span>
                    
                    <label className="bg-indigo-600 hover:bg-indigo-505 bg-indigo-505 hover:bg-indigo-500 text-white font-bold text-[9px] px-3 py-1.5 rounded uppercase tracking-wider font-mono cursor-pointer transition">
                      Choose Scan File
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "acceptance")}
                      />
                    </label>
                  </div>

                  {/* BYPASS CTA */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="text-[9px] text-slate-400 uppercase font-mono block mb-2">Operational Override</div>
                    <button
                      type="button"
                      onClick={acceptAdmissionDirectly}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-xs transition cursor-pointer active:scale-97"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Accept Admission & Force Enrol
                    </button>
                  </div>
                </div>

                {/* PREVIEW OF ACCEPTANCE */}
                <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-xs flex flex-col justify-between min-h-[300px]">
                  <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block border-b border-slate-100 pb-2">
                    ACCEPTANCE LETTER PREVIEW
                  </span>

                  {beneficiary.acceptanceLetterUploaded ? (
                    <div className="flex-grow flex flex-col items-center justify-center mt-4">
                      {beneficiary.acceptanceLetterUrl?.startsWith("data:image") ? (
                        <div className="relative group max-w-xs border border-slate-200 rounded-lg p-1 bg-slate-100 shadow-xs">
                          <img 
                            src={beneficiary.acceptanceLetterUrl} 
                            alt="Acceptance Scan" 
                            className="max-h-52 w-full object-contain rounded"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] font-mono font-bold text-white uppercase rounded">
                            Verified Upload Scan
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 border border-emerald-150 rounded-xl bg-emerald-50 max-w-xs space-y-3">
                          <Award className="w-10 h-10 text-emerald-600 stroke-1 mx-auto" />
                          <div>
                            <span className="text-xs font-bold font-mono text-emerald-800 block uppercase">ACCEPTANCE SLIP ENCLOSED</span>
                            <span className="text-[9px] text-emerald-600 block mt-0.5">Verified Document Code: ACC-LOCK-${beneficiary.id.split("-").pop()}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 text-[10px] font-mono text-slate-400 text-center">
                        Uploaded at: <span className="font-bold text-slate-705 text-slate-600">{new Date(beneficiary.acceptanceLetterUploadedAt || Date.now()).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 uppercase font-mono text-[10px] font-bold space-y-2 flex-grow flex flex-col items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-amber-500 stroke-1 animate-bounce" />
                      <span>Awaiting acceptance document</span>
                    </div>
                  )}
                </div>

              </div>

              {/* ADMIN DECISION DESK */}
              <div className="bg-slate-900 text-white border border-slate-950 rounded-xl p-5 shadow-xs text-left space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <h5 className="font-display font-medium text-xs uppercase flex items-center gap-2 tracking-wide text-indigo-400">
                    <ShieldCheck className="w-4 h-4" />
                    Administrative Document Review Panel
                  </h5>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                    beneficiary.admissionStatus === "Accepted"
                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-800"
                      : beneficiary.admissionStatus === "Acceptance Uploaded"
                      ? "bg-yellow-950/50 text-yellow-400 border-yellow-800 animate-pulse"
                      : "bg-slate-950/50 text-slate-400 border-slate-800"
                  }`}>
                    {beneficiary.admissionStatus?.toUpperCase() || "PENDING ACTION"}
                  </span>
                </div>

                <div className="text-slate-300 space-y-1">
                  <p className="text-xs">
                    Trainee acceptance letters and supplemental bio registry records are subject to human inspection before enrollment status is finalized.
                  </p>
                  
                  {/* Current decision status banner */}
                  <div className="bg-slate-800 p-2.5 rounded-lg text-[11px] font-mono text-slate-300 flex items-center justify-between border border-slate-700 mt-2">
                    <span>CURRENT FLOW STAGE Status:</span>
                    <span className="font-bold text-yellow-400 uppercase">{beneficiary.admissionStatus || "Pending"}</span>
                  </div>
                </div>

                {/* Inline rejection prompt */}
                {rejectionMode && (
                  <div className="space-y-2 p-3 bg-red-950/45 border border-red-800/40 rounded-lg text-xs font-sans">
                    <span className="font-bold text-red-400 block pb-1">ENTER REJECTION REASON:</span>
                    <input 
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Signature blurry, wrong template uploaded..."
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded p-2 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                    />
                    <div className="flex justify-end gap-2 pt-1 font-mono text-[10px]">
                      <button 
                        type="button"
                        onClick={() => { setRejectionMode(false); setRejectReason(""); }}
                        className="px-3 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-750 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        onClick={submitRejection}
                        className="px-3 py-1 bg-rose-600 text-white rounded hover:bg-rose-505 font-bold cursor-pointer"
                      >
                        Confirm Decline
                      </button>
                    </div>
                  </div>
                )}

                {/* Main CTAs */}
                {!rejectionMode && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono font-bold">
                    <button
                      type="button"
                      onClick={markUnderReview}
                      disabled={beneficiary.admissionStatus === "Under Review"}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Mark Under Review
                    </button>
                    <button
                      type="button"
                      onClick={approveVerification}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-97"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />
                      Approve & Accept Trainee
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectionMode(true)}
                      className="bg-rose-900/40 hover:bg-rose-900 text-rose-100 border border-rose-800/55 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                      Decline Scan Upload
                    </button>
                  </div>
                )}
              </div>

              {/* Historical Acceptance Versions Grid */}
              <div className="space-y-3 text-left border-t border-slate-100 pt-5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Acceptance Letter Uploads History Versions</span>
                {beneficiary.acceptanceLetterVersions && beneficiary.acceptanceLetterVersions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {beneficiary.acceptanceLetterVersions.map((v, vIdx) => (
                      <div key={vIdx} className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs flex justify-between items-center font-mono">
                        <div className="space-y-0.5 text-left">
                          <span className="font-bold text-slate-750 text-slate-800 block">Signed Acceptance Declaration (Version {v.version})</span>
                          <span className="text-[9px] text-slate-400">Uploaded: {new Date(v.uploadedAt).toLocaleString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const win = window.open("", "_blank");
                            win?.document.write(`<html><body style="margin:0;"><iframe src="${v.url}" style="width:100%; height:100%; border:0;"></iframe></body></html>`);
                            win?.document.close();
                          }}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1.5 rounded text-[10px] shadow-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          View Document Scan <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center font-mono py-4 bg-slate-50 rounded border border-slate-150 uppercase tracking-widest">
                    No acceptance letter uploads track history found
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: FORMS PANEL */}
          {activeTab === "forms" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  Beneficiary Registry Profile Admission form
                </h4>
                <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wide uppercase ${
                  beneficiary.admissionFormCompleted 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-amber-50 text-amber-600 border border-amber-100"
                }`}>
                  {beneficiary.admissionFormStatus || "Draft"} Mode
                </div>
              </div>

              {/* DEMO FORM EDITOR COMPONENTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Next of Kin / Emergency Name</label>
                  <input
                    type="text"
                    value={formFields.emergencyName}
                    onChange={(e) => setFormFields({ ...formFields, emergencyName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg p-2 font-sans text-xs font-normal outline-none transition"
                    placeholder="e.g. Ade Adeyemi"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Emergency Phone Contact</label>
                  <input
                    type="text"
                    value={formFields.emergencyPhone}
                    onChange={(e) => setFormFields({ ...formFields, emergencyPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg p-2 font-sans text-xs font-normal outline-none transition"
                    placeholder="e.g. +234 803 234 5678"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Parent/Guardian Sponsor Name</label>
                  <input
                    type="text"
                    value={formFields.guardianName}
                    onChange={(e) => setFormFields({ ...formFields, guardianName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg p-2 font-sans text-xs font-normal outline-none transition"
                    placeholder="e.g. Chief Adeyemi"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Highest Achievement Tier</label>
                  <select
                    value={formFields.highestQualification}
                    onChange={(e) => setFormFields({ ...formFields, highestQualification: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-sans text-xs font-normal outline-none cursor-pointer"
                  >
                    <option value="SSCE shadow-xs">SSCE (High School Certificate)</option>
                    <option value="ND Diploma">National Diploma (ND)</option>
                    <option value="HND Diploma">Higher National Diploma (HND)</option>
                    <option value="B.Sc / B.Eng">Bachelor Degree (B.Sc / B.Tech)</option>
                    <option value="None">None</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Prior Hardware Knowledge Tier</label>
                  <select
                    value={formFields.priorKnowledge}
                    onChange={(e) => setFormFields({ ...formFields, priorKnowledge: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-sans text-xs font-normal outline-none cursor-pointer"
                  >
                    <option value="Beginner">Beginner (No repair background)</option>
                    <option value="Intermediate">Intermediate (Understands cell assembly)</option>
                    <option value="Advanced">Advanced (Some board repair experience)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="medDec"
                    checked={formFields.medicalDeclaration}
                    onChange={(e) => setFormFields({ ...formFields, medicalDeclaration: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-550 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="medDec" className="text-[9px] text-slate-500 font-medium font-sans leading-normal cursor-pointer select-none">
                    Confirm medical clearance & hardware workshop liability acceptance terms.
                  </label>
                </div>
              </div>

              {/* ACTION BUTTON GRID */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
                <span className="text-[10px] text-slate-400 max-w-xs leading-normal font-sans">
                  Completed profiles will be compiled with candidate biometrics for federal onviews.
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={printAdmissionForm}
                    className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-slate-705 text-slate-600 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Print / Download PDF Form
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => saveAdmissionForm("Draft")}
                    className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => saveAdmissionForm("Verified")}
                    className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    Verify & Submit
                  </button>
                </div>
              </div>

              {/* Historical Form Versions List */}
              <div className="pt-4 border-t border-slate-100 text-left">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">Form Submission Profile History Versions</span>
                {beneficiary.admissionFormVersions && beneficiary.admissionFormVersions.length > 0 ? (
                  <div className="space-y-2">
                    {beneficiary.admissionFormVersions.map((v, vIdx) => (
                      <div key={vIdx} className="p-3.5 bg-slate-50 border border-slate-150 rounded-lg font-mono text-xs text-left">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-201 border-b border-slate-200">
                          <span className="font-bold text-slate-800 uppercase text-[10px]">Enrollment Form Details (Version {v.version})</span>
                          <span className="text-slate-400 text-[9px]">Captured: {new Date(v.submittedAt).toLocaleString()}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5 text-[10px] text-slate-600 leading-normal">
                          <div>EMERGENCY NOK: <span className="font-sans font-bold text-slate-800">{v.formData?.emergencyName || "N/A"}</span></div>
                          <div>EMERGENCY PHONE: <span className="font-sans font-bold text-slate-800">{v.formData?.emergencyPhone || "N/A"}</span></div>
                          <div>GUARDIAN / SPONSOR: <span className="font-sans font-bold text-slate-800">{v.formData?.guardianName || "N/A"}</span></div>
                          <div>QUALIFICATION: <span className="font-sans font-bold text-slate-800">{v.formData?.highestQualification || "SSCE"}</span></div>
                          <div>PRIOR KNOWLEDGE: <span className="font-sans font-bold text-slate-800">{v.formData?.priorKnowledge || "Beginner"}</span></div>
                          <div>MEDICAL CLEARANCE: <span className="font-sans font-bold text-slate-800">{v.formData?.medicalDeclaration ? "YES" : "NO"}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-lg text-center text-slate-400 text-[9px] uppercase font-mono tracking-widest">
                    Awaiting original profile form mapping version
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: DOCUMENTS PANEL */}
          {activeTab === "documents" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-5 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase">
                  Biometrics & Credentials Documentation Center
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {documentsList.length} Uploaded items
                </span>
              </div>

               {/* DOCUMENTS CARD MATRIX */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "passport", label: "PASSPORT PHOTOGRAPH", type: "Img", mandatory: true, exists: !!beneficiary.photo, url: beneficiary.photo },
                  { key: "nin", label: "NIN DOCUMENT SLIP", type: "Scan", mandatory: true, exists: documentsList.some(d => d.type === "nin"), url: documentsList.find(d => d.type === "nin")?.url },
                  { key: "bvn", label: "BVN VERIFICATION RECEIPT", type: "Scan", mandatory: true, exists: documentsList.some(d => d.type === "bvn"), url: documentsList.find(d => d.type === "bvn")?.url },
                  { key: "admission", label: "OFFICIAL ADMISSION LETTER", type: "PDF", mandatory: false, exists: !!beneficiary.admissionLetterUrl || !!beneficiary.admissionRef, url: beneficiary.admissionLetterUrl || "#" },
                  { key: "acceptance", label: "SIGNED ADMISSION ACCEPTANCE SLIP", type: "PDF Scan", mandatory: true, exists: !!beneficiary.acceptanceLetterUploaded || !!beneficiary.acceptanceLetterUrl, url: beneficiary.acceptanceLetterUrl },
                  { key: "enrollment", label: "ENROLLMENT CONFIRMATION", type: "PDF", mandatory: false, exists: !!beneficiary.enrollmentLetterUrl, url: beneficiary.enrollmentLetterUrl },
                  { key: "certificate", label: "COMPLETION CERTIFICATE (FUTURE)", type: "PDF Gold", mandatory: false, exists: !!beneficiary.certificateUrl, url: beneficiary.certificateUrl },
                  { key: "other", label: "OTHER ATTACHMENTS (SSCE/LGA)", type: "Scan Archive", mandatory: false, exists: documentsList.some(d => d.type === "other"), url: documentsList.find(d => d.type === "other")?.url }
                ].map((doc, idx) => {
                  return (
                    <div 
                      key={idx}
                      onDragEnter={(e) => handleDrag(e, doc.key)}
                      onDragOver={(e) => handleDrag(e, doc.key)}
                      onDragLeave={(e) => handleDrag(e, doc.key)}
                      onDrop={(e) => handleDrop(e, doc.key)}
                      className={`border rounded-xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3 ${
                        doc.exists 
                          ? "bg-slate-50/70 border-slate-150" 
                          : dragActive === doc.key
                          ? "bg-indigo-50 border-indigo-500"
                          : "bg-white border-dashed border-slate-200 hover:bg-slate-50/40"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">{doc.label}</span>
                            {doc.mandatory && <span className="text-red-500 font-bold">&#8727;</span>}
                          </div>
                          <span className="text-[9px] text-slate-400 block font-mono">{doc.type} Verification Attachment</span>
                        </div>

                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono ${
                          doc.exists 
                            ? "bg-emerald-50 text-emerald-700" 
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {doc.exists ? "COMPLIANT LOCK" : "REQUIRED"}
                        </span>
                      </div>

                      {/* ACTION CARD SPACE */}
                      {doc.exists ? (
                        <div className="flex items-center justify-between text-[10px] font-mono border-t border-slate-150 pt-3">
                          {doc.url === "#" ? (
                            <button
                              type="button"
                              onClick={printAdmissionLetter}
                              className="text-indigo-650 hover:text-indigo-805 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Preview Document
                            </button>
                          ) : (
                            <a 
                              href={doc.url} 
                              download={`${doc.key}_${beneficiary.id.split("-").pop()}`}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Exclude / Export File
                            </a>
                          )}
                          
                          {/* If not fixed passport/docs allow removal */}
                          {doc.key !== "passport" && doc.key !== "admission" && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchedDoc = documentsList.find(d => d.type === doc.key);
                                if (matchedDoc) deleteDocument(matchedDoc.id, matchedDoc.name);
                              }}
                              className="text-rose-600 hover:text-rose-800 font-semibold"
                            >
                              Clear ×
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2">
                          <label className="text-[9px] font-bold font-mono tracking-wide uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 py-1 px-3.5 rounded cursor-pointer transition text-center block w-max">
                            Upload Scan Slip
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileChange(e, doc.key)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 6: TRAINING PANEL */}
          {activeTab === "training" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-6 duration-300 animate-in fade-in font-sans">
              
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase">
                  Classroom Engagement & Training Milestones Tracker
                </h4>
                {hoursPercent >= 100 && (
                  <div className="animate-bounce bg-yellow-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> CERTIFICATE UNLOCKED
                  </div>
                )}
              </div>

              {/* GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* ATTENDANCE CONTROL PANEL */}
                <div className="md:col-span-1 space-y-4 border border-slate-150 p-4 rounded-xl bg-slate-50/30">
                  <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5 font-mono">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Log Daily Units
                  </h5>

                  <div className="space-y-3 font-mono text-[10px]">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-bold block uppercase">Select Training Date</span>
                      <input 
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 p-1.5 rounded p-2 text-slate-700 font-sans outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 font-bold block uppercase">Trainee Engagement Status</span>
                      <div className="grid grid-cols-3 gap-1 font-mono text-[9px] font-semibold text-center mt-1">
                        {[
                          { key: "Present", color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                          { key: "Absent", color: "text-rose-700 bg-rose-50 border-rose-100" },
                          { key: "Excused", color: "text-amber-700 bg-amber-50 border-amber-100" }
                        ].map(st => (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => setAttendanceStatus(st.key as any)}
                            className={`p-1.5 rounded cursor-pointer border transition ${
                              attendanceStatus === st.key 
                                ? "bg-indigo-650 border-indigo-700 text-slate-900 font-bold bg-yellow-400" 
                                : "bg-white text-slate-450 text-slate-400"
                            }`}
                          >
                            {st.key}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addAttendanceLog}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer mt-3"
                    >
                      Verify & Add Log
                    </button>
                  </div>
                </div>

                {/* RECORD LOGS MATRIX */}
                <div className="md:col-span-2 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Daily Attendance Records Timeline</span>

                  {attendanceLogs.length === 0 ? (
                    <div className="py-14 text-center border rounded-xl border-dashed border-slate-200 text-slate-400 font-mono text-[10px] uppercase font-bold flex flex-col items-center justify-center">
                      <span>No Attendance logs reported yet</span>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                      <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="p-2.5 px-4 text-[9px]">DATE</th>
                            <th className="p-2.5 px-4 text-[9px]">ENGAGEMENT TIER</th>
                            <th className="p-2.5 px-4 text-[9px]">CREDIT HOURS</th>
                            <th className="p-2.5 px-4 text-[9px] text-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {attendanceLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-2 px-4 uppercase font-bold text-slate-800">{new Date(log.date).toLocaleDateString("en-GB")}</td>
                              <td className="p-2 px-4">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                  log.status === "Present" 
                                    ? "bg-emerald-50 text-emerald-700" 
                                    : log.status === "Absent" 
                                    ? "bg-rose-50 text-rose-700" 
                                    : "bg-amber-50 text-amber-700"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="p-2 px-4">{log.hoursLogged} Hours</td>
                              <td className="p-2 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAttendanceLog(log.id, log.date)}
                                  className="text-rose-500 hover:text-rose-750 text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
              
              {/* CERTIFICATE SECTION */}
              <div className="border border-slate-200 rounded-xl bg-slate-50/40 p-5 mt-4 text-left">
                <div className="flex flex-col sm:flex-row items-center font-sans justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-full ${hoursPercent >= 100 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-400"}`}>
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-xs uppercase font-mono block">Certificate Credentials Code</span>
                      <span className="text-[11px] text-slate-505 text-slate-600 leading-normal block">
                        Federally signed diploma issued on completion of full diagnostics Repair unit curricula (90 hrs).
                      </span>
                    </div>
                  </div>

                  {hoursPercent >= 100 ? (
                    <div className="p-3 bg-yellow-400 text-slate-950 font-mono text-[9px] font-bold rounded-lg uppercase tracking-wider text-center border border-yellow-500 shadow-sm animate-pulse">
                      <span>DIPLOMA: CERT-IDEAS-{new Date().getFullYear()}-{beneficiary.id.split("-").pop()}</span>
                      <span className="block mt-0.5 font-bold">✓ ACCREDITED LEVEL STATUS</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-400 font-bold bg-slate-100 px-3 py-1.5 rounded uppercase">
                      Locked (Requires {90 - training.hoursCompleted!} contact hours)
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 7: AUDIT LOGS PANEL */}
          {activeTab === "audits" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-left space-y-5 duration-300 animate-in fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-xs uppercase">
                  Classified Security audit records
                </h4>
                <div className="text-[10px] font-mono text-slate-400">
                  {auditLogs.length} verified operations detected
                </div>
              </div>

              {/* TIMELINE LIST */}
              {auditLogs.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-mono text-[10px] uppercase font-bold">
                  <span>No security records recorded for this candidate profile</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="p-2.5 px-4 text-[9px]">DATETIME</th>
                        <th className="p-2.5 px-4 text-[9px]">ACTION</th>
                        <th className="p-2.5 px-4 text-[9px]">OPERATOR / ROLE</th>
                        <th className="p-2.5 px-4 text-[9px]">TRANSACTION DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 px-4 tracking-tight whitespace-nowrap text-slate-400">
                            {new Date(log.timestamp).toLocaleString("en-GB")}
                          </td>
                          <td className="p-2.5 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              log.action.includes("CREATE") || log.action.includes("UPLOAD")
                                ? "bg-emerald-50 text-emerald-700"
                                : log.action.includes("DELETE") || log.action.includes("FAILED")
                                ? "bg-rose-50 text-rose-700"
                                : "bg-indigo-50 text-indigo-700"
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-2.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-705 text-slate-700">{log.username}</div>
                            <div className="text-[9px] text-slate-400 font-sans">{log.role}</div>
                          </td>
                          <td className="p-2.5 px-4 leading-normal text-slate-605 text-slate-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
