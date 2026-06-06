/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, UserCheck, MapPin, Mail, Phone, Upload, Trash2, Plus, 
  Save, CheckCircle, AlertCircle, Award, BookOpen, Clock, Tag, RefreshCw,
  FileText, Sparkles, Loader2
} from "lucide-react";
import { OrganizationSettings, TrainingProgram } from "../types";
import { authFetch } from "../utils/authFetch";
import { useNotification } from "./NotificationContext";

export function SettingsWorkspace({ session }: { session?: { username?: string; role?: string; email?: string } | null }) {
  const { showToast, confirmDelete } = useNotification();
  const [settings, setSettings] = useState<OrganizationSettings>({
    id: "ideas_default",
    organizationName: "",
    tpmName: "",
    tpmTitle: "Technical Project Manager (TPM)",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    letterheadUrl: "",
    signatureUrl: "",
    stampUrl: "",
    fmeLogoUrl: "",
    ideasLogoUrl: "",
    worldBankLogoUrl: "",
    nbteLogoUrl: "",
    customLogoUrl: "",
    watermarkText: "SECURED REGISTRY DOCUMENT",
    watermarkEnabled: true,
    admissionLetterheadUrl: "",
    acceptanceLetterheadUrl: "",
    enrollmentLetterheadUrl: "",
    certificateBackgroundUrl: "",
    photoAlbumHeaderUrl: "",
    trainingVenue: "",
    trainingStartDate: "",
    trainingEndDate: "",
    attendanceThreshold: 80,
    completionThreshold: 75
  });

  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [feedbackSettings, setFeedbackSettings] = useState<{ status: "success" | "error"; msg: string } | null>(null);

  // Validation & upload specific error indicator
  const [uploadError, setUploadError] = useState<{ field: string; message: string } | null>(null);

  // Live Preview layout toggle
  const [previewType, setPreviewType] = useState<"admission" | "acceptance" | "enrollment" | "standard">("standard");

  // Training Program form state
  const [newProgram, setNewProgram] = useState<Partial<TrainingProgram>>({
    name: "",
    sector: "ICT & Digital Skills",
    code: "",
    totalHours: "350"
  });
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [feedbackProgram, setFeedbackProgram] = useState<{ status: "success" | "error"; msg: string } | null>(null);

  // Asset uploading status indicators
  const [uploadStatus, setUploadStatus] = useState<Record<string, "idle" | "uploading" | "success" | "error">>({
    letterhead: "idle",
    signature: "idle",
    stamp: "idle",
    fmeLogo: "idle",
    ideasLogo: "idle",
    worldBankLogo: "idle",
    nbteLogo: "idle",
    customLogo: "idle",
    admissionLetterhead: "idle",
    acceptanceLetterhead: "idle",
    enrollmentLetterhead: "idle",
    certificateBackground: "idle",
    photoAlbumHeader: "idle"
  });

  const [activeSubTab, setActiveSubTab] = useState<"general" | "letterheads">("general");
  const [letterheads, setLetterheads] = useState<any[]>([]);
  const [activeLetterhead, setActiveLetterhead] = useState<any | null>(null);
  const [isLoadingLetterheads, setIsLoadingLetterheads] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [newLetterheadName, setNewLetterheadName] = useState("");
  const [newLetterheadDescription, setNewLetterheadDescription] = useState("");
  const [letterheadIsDefault, setLetterheadIsDefault] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchPrograms();
    fetchLetterheads();
  }, []);

  const fetchLetterheads = async () => {
    setIsLoadingLetterheads(true);
    try {
      const res = await authFetch("/api/letterheads");
      if (res.ok) {
        const data = await res.json();
        setLetterheads(data);
        const active = data.find((l: any) => l.isDefault && l.isActive);
        setActiveLetterhead(active || null);
      }
    } catch (e) {
      console.error("Failed to fetch letterheads in client settings:", e);
    } finally {
      setIsLoadingLetterheads(false);
    }
  };

  const handleSetDefaultLetterhead = async (id: string) => {
    try {
      const res = await authFetch(`/api/letterheads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true, isActive: true })
      });
      if (res.ok) {
        showToast("Letterhead updated as system default!", "success");
        await fetchLetterheads();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed activating default template", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error updating default letterhead template.", "error");
    }
  };

  const handleDeleteLetterhead = async (id: string, name: string) => {
    confirmDelete({
      title: "Delete Letterhead Template",
      message: `Are you sure you want to delete the formal letterhead template '${name}'? This action is permanent and cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/letterheads/${id}`, {
            method: "DELETE"
          });
          if (res.ok) {
            showToast("Letterhead template deleted successfully", "success");
            await fetchLetterheads();
          } else {
            showToast("Unauthorized. Only SUPER_ADMIN users can perform this action.", "error");
          }
        } catch (e) {
          console.error(e);
          showToast("Network error deleting letterhead template.", "error");
        }
      }
    });
  };

  const handleUploadLetterheadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate role
    if (session?.role !== "SUPER_ADMIN") {
      showToast("Operation Restricted: Only SUPER_ADMIN is permitted to upload new letterhead templates.", "error");
      e.target.value = "";
      return;
    }

    // Validate Name field first
    const finalName = newLetterheadName.trim() || file.name.split(".")[0];

    const allowedExtensions = ["png", "jpg", "jpeg", "pdf"];
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExtensions.includes(extension)) {
      showToast("Invalid template format. Only PNG, JPG, JPEG, and PDF documents are supported.", "error");
      e.target.value = "";
      return;
    }

    setUploadingLetterhead(true);
    showToast("Processing document template binary...", "info");

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Content = reader.result as string;
        try {
          // 1. Upload file
          const uploadRes = await authFetch("/api/upload-asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileContent: base64Content,
              fileName: `template_${finalName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
              folder: "ideas_letterheads"
            })
          });

          if (!uploadRes.ok) throw new Error("Upload to asset storage failed.");
          const { secureUrl } = await uploadRes.json();

          // 2. Save letterhead record
          const saveRes = await authFetch("/api/letterheads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: finalName,
              description: newLetterheadDescription || `Official government head template in ${extension.toUpperCase()} style.`,
              fileUrl: secureUrl,
              thumbnailUrl: secureUrl, // Same for simplicity
              fileType: extension.toUpperCase(),
              isDefault: letterheadIsDefault,
              isActive: true
            })
          });

          if (saveRes.ok) {
            showToast("Success: Letterhead template imported successfully!", "success");
            setNewLetterheadName("");
            setNewLetterheadDescription("");
            setLetterheadIsDefault(false);
            await fetchLetterheads();
          } else {
            const err = await saveRes.json();
            throw new Error(err.error || "Failed saving letterhead meta parameters.");
          }
        } catch (err: any) {
          console.error(err);
          showToast(err.message || "Failed uploading letterhead document template.", "error");
        } finally {
          setUploadingLetterhead(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showToast("Error processing file parameters locally.", "error");
      setUploadingLetterhead(false);
    } finally {
      e.target.value = "";
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await authFetch("/api/organization-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          ...data,
          watermarkText: data.watermarkText ?? prev.watermarkText,
          watermarkEnabled: data.watermarkEnabled ?? prev.watermarkEnabled,
          admissionLetterheadUrl: data.admissionLetterheadUrl ?? prev.admissionLetterheadUrl,
          acceptanceLetterheadUrl: data.acceptanceLetterheadUrl ?? prev.acceptanceLetterheadUrl,
          enrollmentLetterheadUrl: data.enrollmentLetterheadUrl ?? prev.enrollmentLetterheadUrl,
          certificateBackgroundUrl: data.certificateBackgroundUrl ?? prev.certificateBackgroundUrl,
          photoAlbumHeaderUrl: data.photoAlbumHeaderUrl ?? prev.photoAlbumHeaderUrl,
          trainingVenue: data.trainingVenue ?? prev.trainingVenue,
          trainingStartDate: data.trainingStartDate ?? prev.trainingStartDate,
          trainingEndDate: data.trainingEndDate ?? prev.trainingEndDate,
          attendanceThreshold: data.attendanceThreshold ?? prev.attendanceThreshold,
          completionThreshold: data.completionThreshold ?? prev.completionThreshold
        }));
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await authFetch("/api/training-programs");
      if (res.ok) {
        const data = await res.json();
        setPrograms(data);
      }
    } catch (e) {
      console.error("Failed to load training programs:", e);
    }
  };

  // Generic File Uploader proxying to Cloudinary with format/size validation
  const handleAssetUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    field: "letterhead" | "signature" | "stamp" | "fmeLogo" | "ideasLogo" | "worldBankLogo" | "nbteLogo" | "customLogo" | "admissionLetterhead" | "acceptanceLetterhead" | "enrollmentLetterhead" | "certificateBackground" | "photoAlbumHeader"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format: PNG, JPG, JPEG, SVG
    const allowedExtensions = ["png", "jpg", "jpeg", "svg"];
    const extension = file.name.split(".").pop()?.toLowerCase();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      setUploadError({
        field,
        message: `Invalid file format (${extension ? "." + extension : "unknown"}). Only PNG, JPG, JPEG, and SVG files are allowed.`
      });
      e.target.value = "";
      return;
    }

    // Validate maximum size: 5MB
    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      setUploadError({
        field,
        message: `File size exceeds the 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please upload a smaller image.`
      });
      e.target.value = "";
      return;
    }

    setUploadError(null);
    setUploadStatus(prev => ({ ...prev, [field]: "uploading" }));

    try {
      // Convert to Base64 dataURI
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Content = reader.result as string;
        
        try {
          // Dispatch upload to our proxy router
          const res = await authFetch("/api/upload-asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileContent: base64Content,
              fileName: `org_${field}_image`,
              folder: "ideas_settings"
            })
          });

          if (res.ok) {
            const { secureUrl } = await res.json();
            setSettings(prev => ({
              ...prev,
              [`${field}Url`]: secureUrl
            }));
            const isLogo = field.toLowerCase().includes("logo");
            setUploadStatus(prev => ({ ...prev, [field]: "success" }));
            showToast(`${isLogo ? "Logo" : "Letterhead"} uploaded successfully`, "success");
            setTimeout(() => {
              setUploadStatus(prev => ({ ...prev, [field]: "idle" }));
            }, 3000);
          } else {
            throw new Error("API returned non-200 state");
          }
        } catch (err) {
          console.error(`Cloudinary upload failed for ${field}:`, err);
          const isLogo = field.toLowerCase().includes("logo");
          setUploadStatus(prev => ({ ...prev, [field]: "error" }));
          showToast(`${isLogo ? "Logo" : "Letterhead"} upload failed: server connection break.`, "error");
          setUploadError({
            field,
            message: `Server upload failed for the asset. Please verify key credentials and cloud connection.`
          });
        }
      };
      
      reader.onerror = () => {
        setUploadStatus(prev => ({ ...prev, [field]: "error" }));
        setUploadError({ field, message: "Failed reading local asset binary structure." });
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadStatus(prev => ({ ...prev, [field]: "error" }));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setFeedbackSettings(null);

    try {
      const res = await authFetch("/api/organization-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setFeedbackSettings({ status: "success", msg: "State organization and authority settings updated successfully!" });
        showToast("Settings saved successfully", "success");
        await fetchSettings();
      } else {
        const errData = await res.json();
        setFeedbackSettings({ status: "error", msg: errData.error || "Failed updating organization parameters." });
        showToast(errData.error || "Validation error: Failed updating organization settings", "error");
      }
    } catch (err: any) {
      setFeedbackSettings({ status: "error", msg: err.message || "Failed saving parameters due to a connection break." });
      showToast("Network error: Failed saving settings parameter keys.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgram.name || !newProgram.code) {
      setFeedbackProgram({ status: "error", msg: "Please fill in Program Name and Code." });
      return;
    }

    setIsSavingProgram(true);
    setFeedbackProgram(null);

    try {
      const res = await authFetch("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProgram)
      });

      if (res.ok) {
        setFeedbackProgram({ status: "success", msg: "Successfully provisioned new accredited training sector program!" });
        setNewProgram({
          name: "",
          sector: "ICT & Digital Skills",
          code: "",
          totalHours: "350"
        });
        await fetchPrograms();
      } else {
        const errData = await res.json();
        setFeedbackProgram({ status: "error", msg: errData.error || "Failed provisioning training program." });
      }
    } catch (err: any) {
      setFeedbackProgram({ status: "error", msg: err.message || "Endpoint error provisioning training sector." });
    } finally {
      setIsSavingProgram(false);
    }
  };

  const handleDeleteProgram = (id: string, name: string) => {
    confirmDelete({
      title: "Delete Training Program",
      message: `Are you sure you want to delete the accredited Training Program '${name}'? This may affect cascading historical beneficiary lookups.`,
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/training-programs/${id}`, {
            method: "DELETE"
          });

          if (res.ok) {
            await fetchPrograms();
            showToast("Accredited Training Program deleted successfully", "success");
          } else {
            showToast("Action restricted under system isolation guidelines.", "error");
          }
        } catch (err: any) {
          showToast(err.message || "Network error deleting training program.", "error");
        }
      }
    });
  };

  const missingLogos: string[] = [];
  if (!settings.fmeLogoUrl) missingLogos.push("Federal Ministry Logo");
  if (!settings.ideasLogoUrl) missingLogos.push("FME IDEAS Logo");
  if (!settings.worldBankLogoUrl) missingLogos.push("World Bank Logo");

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Visual Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-indigo-950/55 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-indigo-400 font-bold uppercase bg-slate-950 px-2.5 py-1 rounded-full">
            Institutional Settings Module
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-2.5">
            IDEAS-TVET Authority & Program Batches
          </h2>
          <p className="text-slate-450 text-xs mt-1.5 max-w-xl">
            Configure default state letters styling variables, accredited signatures, authorities stamp images, and create active cohort training packages.
          </p>
        </div>
        <button 
          onClick={() => { fetchSettings(); fetchPrograms(); }} 
          className="flex-shrink-0 self-start sm:self-center bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs py-2 px-3.5 rounded-lg border border-slate-700/60 inline-flex items-center gap-2 cursor-pointer transition active:scale-[98%]"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
          <span>Reload Parameters</span>
        </button>
      </div>
      {/* Dynamic Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6 mt-4 pb-0.5">
        <button
          onClick={() => setActiveSubTab("general")}
          className={`pb-3.5 px-2 font-bold text-xs tracking-wider uppercase border-b-2 transition inline-flex items-center gap-2 cursor-pointer ${
            activeSubTab === "general"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building className="w-4 h-4" />
          General settings & batches
        </button>
        <button
          onClick={() => setActiveSubTab("letterheads")}
          className={`pb-3.5 px-2 font-bold text-xs tracking-wider uppercase border-b-2 transition inline-flex items-center gap-2 cursor-pointer ${
            activeSubTab === "letterheads"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          Letterhead library ({letterheads.length})
        </button>
      </div>

      {activeSubTab === "general" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COMPONENT: ORGANIZATION DETAILS & LOGO/STAMP GRAPHICS */}
        <div className="lg:col-span-12 xl:col-span-7 bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-150 pb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 text-left">Organization Info & Graphic Branding</h3>
              <p className="text-[11px] text-slate-450 text-left mt-0.5">Define Letterhead details, signatures, and seals</p>
            </div>
          </div>
 
          <form onSubmit={handleSaveSettings} className="space-y-6">

            {/* Missing required branding logo asset warnings */}
            {missingLogos.length > 0 && (
              <div className="p-4 rounded-xl flex items-start gap-3 border bg-amber-50/70 border-amber-200 text-amber-800 animate-in fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="text-left flex-1">
                  <span className="font-bold text-xs text-amber-950 block uppercase tracking-wide">Missing Official Logo Assets</span>
                  <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                    The following required branding assets are currently missing: <strong className="text-amber-950">{missingLogos.join(", ")}</strong>. 
                    Please upload these high-resolution assets below to ensure official letterheads and printed credentials satisfy governmental layout guidelines.
                  </p>
                </div>
              </div>
            )}

            {/* Document upload validation error alert */}
            {uploadError && (
              <div className="p-4 rounded-xl flex items-start gap-4 border bg-rose-50 border-rose-200 text-rose-800 animate-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                <div className="text-left flex-1">
                  <span className="font-bold text-xs text-rose-950 block uppercase tracking-wide">Document Asset Validation Failed</span>
                  <p className="text-xs text-rose-900 mt-0.5 leading-relaxed">{uploadError.message}</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setUploadError(null)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-800 py-1 px-2.5 rounded text-[10px] font-bold uppercase transition shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            {/* Feedback alert banner */}
            {feedbackSettings && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                feedbackSettings.status === "success" 
                  ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" 
                  : "bg-rose-50/50 border-rose-200 text-rose-800"
              }`}>
                {feedbackSettings.status === "success" ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                )}
                <span className="text-xs font-medium text-left leading-relaxed">{feedbackSettings.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Organization name */}
              <div className="flex flex-col gap-1.5 text-left col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Organization / State Board Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kano State TVET Board"
                    value={settings.organizationName}
                    onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* TPM Contact */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Technical Project Manager (TPM)
                </label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engr. Kabiru Mohammed"
                    value={settings.tpmName}
                    onChange={(e) => setSettings({ ...settings, tpmName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* TPM Title */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Official Title Designation
                </label>
                <div className="relative">
                  <Award className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Technical Project Manager (TPM)"
                    value={settings.tpmTitle}
                    onChange={(e) => setSettings({ ...settings, tpmTitle: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  State Contact Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. kano-tvet@ideas.gov.ng"
                    value={settings.contactEmail}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  State Contact Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. +234 803 123 4567"
                    value={settings.contactPhone}
                    onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* Location address */}
              <div className="flex flex-col gap-1.5 text-left col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Physical Office Headquarters Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. No. 45 Gwarzo Road, Kano State, Nigeria"
                    value={settings.contactAddress}
                    onChange={(e) => setSettings({ ...settings, contactAddress: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* DOCUMENT WORKFLOW SETTINGS */}
              <div className="flex flex-col gap-1.5 text-left col-span-2 border-t border-slate-100 pt-6 mt-4">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-sky-wide">DOCUMENT WORKFLOW SETTINGS</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Define official cohort training details prepopulated across admission, acceptance, and enrollment confirmation letters.</p>
              </div>
              <div className="flex flex-col gap-1.5 text-left col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Assigned Training Venue Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Government Technical College (GTC), Kano"
                    value={settings.trainingVenue || ""}
                    onChange={(e) => setSettings({ ...settings, trainingVenue: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* Training Dates */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Cohort Training Start Date
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. October 12, 2026"
                    value={settings.trainingStartDate || ""}
                    onChange={(e) => setSettings({ ...settings, trainingStartDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 px-3.5 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Cohort Training End Date
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. December 18, 2026"
                    value={settings.trainingEndDate || ""}
                    onChange={(e) => setSettings({ ...settings, trainingEndDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 px-3.5 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              {/* Compliance Thresholds */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Attendance Threshold (%)
                </label>
                <div className="relative col-span-1">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    placeholder="e.g. 80"
                    value={settings.attendanceThreshold || 80}
                    onChange={(e) => setSettings({ ...settings, attendanceThreshold: parseInt(e.target.value) || 80 })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 px-3.5 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Completion Threshold (%)
                </label>
                <div className="relative col-span-1">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    placeholder="e.g. 75"
                    value={settings.completionThreshold || 75}
                    onChange={(e) => setSettings({ ...settings, completionThreshold: parseInt(e.target.value) || 75 })}
                    className="w-full bg-slate-50 border border-slate-250 py-2 px-3.5 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>
            </div>

            {/* ARTWORK SECTIONS: LETTERHEAD, SIGNATURE AND STAMP */}
            <div className="border-t border-slate-150 pt-6 space-y-4">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider text-left">
                Accreditation Stamp & Graphic Sign-offs (Cloudinary Synchronized)
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* 1. Letterhead URL */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between gap-3 text-left">
                  <div>
                    <h5 className="font-bold text-[10px] text-slate-700 uppercase tracking-wider">
                      Letterhead / Logo Cover
                    </h5>
                    <p className="text-[9px] text-slate-500 mt-0.5">Top centered logo and label header image (PNG/JPG)</p>
                  </div>
                  
                  {settings.letterheadUrl ? (
                    <div className="relative group w-full h-20 bg-white border border-slate-250 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.letterheadUrl} alt="Letterhead Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, letterheadUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[10px] font-semibold gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-20 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-500 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[9px] font-bold">
                        {uploadStatus.letterhead === "uploading" ? "Uploading..." : "Upload Cover"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "letterhead")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 2. Signature URL */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between gap-3 text-left">
                  <div>
                    <h5 className="font-bold text-[10px] text-slate-700 uppercase tracking-wider">
                      TPM Digital Signature
                    </h5>
                    <p className="text-[9px] text-slate-500 mt-0.5">Signatory signature for automatic letters printout</p>
                  </div>
                  
                  {settings.signatureUrl ? (
                    <div className="relative group w-full h-20 bg-white border border-slate-250 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.signatureUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, signatureUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[10px] font-semibold gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-20 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-500 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[9px] font-bold">
                        {uploadStatus.signature === "uploading" ? "Uploading..." : "Upload Signature"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "signature")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 3. Stamp URL */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between gap-3 text-left">
                  <div>
                    <h5 className="font-bold text-[10px] text-slate-700 uppercase tracking-wider">
                      Official Institutional Stamp
                    </h5>
                    <p className="text-[9px] text-slate-500 mt-0.5">Accreditation wet stamp graphic overlay</p>
                  </div>
                  
                  {settings.stampUrl ? (
                    <div className="relative group w-full h-20 bg-white border border-slate-250 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.stampUrl} alt="Stamp Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, stampUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[10px] font-semibold gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-20 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-500 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[9px] font-bold">
                        {uploadStatus.stamp === "uploading" ? "Uploading..." : "Upload Stamp"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "stamp")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

              </div>
            </div>

            {/* Document Branding Logos */}
            <div className="border-t border-slate-150 pt-6 space-y-4">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider text-left">
                Document Branding Settings (Dynamic Report & Certificate Logos)
              </h4>
              <p className="text-[10px] text-slate-500 text-left mt-0.5">These logos are used across dynamic document exports including candidate registries, trainees logs, certificates, and official admission sheets. If left unconfigured, standard high-resolution default SVGs are used as backups.</p>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                
                {/* FME Logo */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">
                      Fed Ministry of Education
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">Federal coat of education crest</p>
                  </div>
                  
                  {settings.fmeLogoUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.fmeLogoUrl} alt="FME Logo Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, fmeLogoUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.fmeLogo === "uploading" ? "Uploading..." : "Upload Logo"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "fmeLogo")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* FME IDEAS Logo */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">
                      FME IDEAS Project
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">IDEAS TVET initiative banner</p>
                  </div>
                  
                  {settings.ideasLogoUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.ideasLogoUrl} alt="IDEAS Logo Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, ideasLogoUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.ideasLogo === "uploading" ? "Uploading..." : "Upload Logo"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "ideasLogo")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* World Bank Logo */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">
                      World Bank Group
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">The World Bank development badge</p>
                  </div>
                  
                  {settings.worldBankLogoUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.worldBankLogoUrl} alt="World Bank Logo Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, worldBankLogoUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.worldBankLogo === "uploading" ? "Uploading..." : "Upload Logo"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "worldBankLogo")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* NBTE Logo */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">
                      NBTE Accreditation Logo
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">National Board for Technical Educ.</p>
                  </div>
                  
                  {settings.nbteLogoUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.nbteLogoUrl} alt="NBTE Logo Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, nbteLogoUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.nbteLogo === "uploading" ? "Uploading..." : "Upload Logo"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "nbteLogo")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* Custom Logo */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">
                      Additional Custom Logo
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">State Board or alternate partner logo</p>
                  </div>
                  
                  {settings.customLogoUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.customLogoUrl} alt="Custom Logo Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, customLogoUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.customLogo === "uploading" ? "Uploading..." : "Upload Logo"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "customLogo")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

              </div>
            </div>

            {/* Document-Specific Letterheads & Background Overlays */}
            <div className="border-t border-slate-150 pt-6 space-y-4">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider text-left font-sans">
                Document-Specific Letterheads & Custom Overlays (Cloudinary Synchronized)
              </h4>
              <p className="text-[10px] text-slate-500 text-left mt-0.5">
                Upload bespoke high-resolution letterheads or background layers for specific individual federal forms and official certificates. If set, these letterheads will suppress the standard triple logo header for targeted documents.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                
                {/* 1. Admission Letter Letterhead */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider font-sans">
                      Admission Letter Head
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">Cover logo for provisional offers</p>
                  </div>
                  
                  {settings.admissionLetterheadUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.admissionLetterheadUrl} alt="Admission Letterhead Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, admissionLetterheadUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.admissionLetterhead === "uploading" ? "Uploading..." : "Upload Cover"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "admissionLetterhead")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 2. Acceptance Letter Letterhead */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider font-sans">
                      Acceptance Ref Head
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">Cover letterhead for countersigns</p>
                  </div>
                  
                  {settings.acceptanceLetterheadUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.acceptanceLetterheadUrl} alt="Acceptance Letterhead Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, acceptanceLetterheadUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.acceptanceLetterhead === "uploading" ? "Uploading..." : "Upload Cover"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "acceptanceLetterhead")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 3. Enrollment Letter Letterhead */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider font-sans">
                      Enrollment Sheet Head
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">Top logo cover for enrollments</p>
                  </div>
                  
                  {settings.enrollmentLetterheadUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.enrollmentLetterheadUrl} alt="Enrollment Letterhead Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, enrollmentLetterheadUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.enrollmentLetterhead === "uploading" ? "Uploading..." : "Upload Cover"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "enrollmentLetterhead")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 4. Certificate Background Overlay */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider font-sans">
                      Certificate BG Layer
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">Full page background watermark image</p>
                  </div>
                  
                  {settings.certificateBackgroundUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.certificateBackgroundUrl} alt="Certificate Background Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, certificateBackgroundUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.certificateBackground === "uploading" ? "Uploading..." : "Upload BG"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "certificateBackground")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 5. Photo Album Header Logo */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5 text-left">
                  <div>
                    <h5 className="font-bold text-[9px] text-slate-700 uppercase tracking-wider font-sans">
                      Photo Album Header
                    </h5>
                    <p className="text-[8px] text-slate-400 mt-0.5">Custom cover banner for cohort portfolios</p>
                  </div>
                  
                  {settings.photoAlbumHeaderUrl ? (
                    <div className="relative group w-full h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={settings.photoAlbumHeaderUrl} alt="Photo Album Header Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, photoAlbumHeaderUrl: "" }))}
                        className="absolute inset-0 bg-slate-950/70 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] font-semibold gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-16 bg-slate-100 hover:bg-slate-200/80 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-400 transition">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[8px] font-bold">
                        {uploadStatus.photoAlbumHeader === "uploading" ? "Uploading..." : "Upload Cover"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAssetUpload(e, "photoAlbumHeader")}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

              </div>
            </div>

            {/* Watermark Management */}
            <div className="border-t border-slate-150 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest text-indigo-500 font-bold uppercase bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  Security overlay
                </span>
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider text-left">
                  Global Watermark Management
                </h4>
              </div>
              <p className="text-[10px] text-slate-500 text-left">
                Configure security watermarks embedded diagonally across generated PDF templates to identify, safeguard, and secure official beneficiary credentials against illegal fabrication.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-205">
                
                {/* Switch for watermark_enabled */}
                <div className="flex flex-col gap-2 justify-center text-left">
                  <span className="text-[10px] font-bold text-slate-650 uppercase tracking-wider">
                    Watermark Status
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={!!settings.watermarkEnabled}
                      onChange={(e) => setSettings({ ...settings, watermarkEnabled: e.target.checked })}
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-3 text-xs font-bold text-slate-700">
                      {settings.watermarkEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                </div>

                {/* Input for watermark_text */}
                <div className="flex flex-col gap-1.5 text-left sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-650 uppercase tracking-wider">
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    disabled={!settings.watermarkEnabled}
                    placeholder="e.g. SECURED REGISTRY DOCUMENT"
                    value={settings.watermarkText || ""}
                    onChange={(e) => setSettings({ ...settings, watermarkText: e.target.value })}
                    className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-250 py-2 px-3 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>

              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-150">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider font-sans inline-flex items-center gap-2 cursor-pointer shadow-md active:scale-98 transition-transform"
              >
                {isSavingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSavingSettings ? "Saving Settings..." : "Save Org Profile"}</span>
              </button>
            </div>

          </form>
        </div>

        {/* RIGHT COMPONENT: INSTITUTIONAL LOOKUPS, PREVIEWS & SECTORS */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          
          {/* 1. BRANDING LIVE PREVIEW PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-5 animate-in fade-in animate-duration-300">
            <div className="flex items-center gap-3 border-b border-slate-150 pb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 text-left">Real-Time Branding Preview</h3>
                <p className="text-[11px] text-slate-450 text-left mt-0.5 font-sans">Live visualization of header branding & watermark</p>
              </div>
            </div>

            {/* Preview Document Selector layout */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/70 justify-between items-center gap-1">
              <button 
                type="button"
                onClick={() => setPreviewType("standard")}
                className={`flex-1 text-[9px] font-bold py-1.5 px-1.5 rounded-md transition cursor-pointer ${previewType === "standard" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Standard
              </button>
              <button 
                type="button"
                onClick={() => setPreviewType("admission")}
                className={`flex-1 text-[9px] font-bold py-1.5 px-1.5 rounded-md transition cursor-pointer ${previewType === "admission" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Admission Offer
              </button>
              <button 
                type="button"
                onClick={() => setPreviewType("acceptance")}
                className={`flex-1 text-[9px] font-bold py-1.5 px-1.5 rounded-md transition cursor-pointer ${previewType === "acceptance" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Acceptance Ref
              </button>
            </div>

            <div className="relative w-full aspect-[4/3] bg-slate-50 border border-slate-205 rounded-xl shadow-inner p-5 overflow-hidden flex flex-col justify-between select-none">
              
              {/* Optional Watermark Overlay */}
              {settings.watermarkEnabled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 rotate-[-22deg] transform">
                  <span className="text-xl md:text-2xl font-black uppercase text-slate-950/5 tracking-widest whitespace-nowrap select-none">
                    {settings.watermarkText || "SECURED REGISTRY DOCUMENT"}
                  </span>
                </div>
              )}

              {/* Header Logos Block / Letterhead */}
              <div className="space-y-4 z-10">
                {previewType === "admission" && settings.admissionLetterheadUrl ? (
                  <div className="w-full h-12 flex items-center justify-center p-0.5 bg-white border border-slate-200 rounded-md overflow-hidden">
                    <img src={settings.admissionLetterheadUrl} alt="Admission Head preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                ) : previewType === "acceptance" && settings.acceptanceLetterheadUrl ? (
                  <div className="w-full h-12 flex items-center justify-center p-0.5 bg-white border border-slate-200 rounded-md overflow-hidden">
                    <img src={settings.acceptanceLetterheadUrl} alt="Acceptance Head preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 px-1 border-b pb-3 border-slate-200/70">
                    {/* FME Logo */}
                    <div className="h-8 flex items-center justify-center">
                      {settings.fmeLogoUrl ? (
                        <img src={settings.fmeLogoUrl} alt="FME Logo" className="h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-full aspect-square bg-slate-200/80 rounded border border-dashed border-slate-350 flex items-center justify-center px-1" title="FME Logo Missing">
                          <span className="text-[6px] font-black text-slate-455">FME</span>
                        </div>
                      )}
                    </div>

                    {/* IDEAS Logo */}
                    <div className="h-8 flex items-center justify-center">
                      {settings.ideasLogoUrl ? (
                        <img src={settings.ideasLogoUrl} alt="IDEAS Logo" className="h-[90%] object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-full px-2 bg-slate-200/80 rounded border border-dashed border-slate-350 flex items-center justify-center" title="IDEAS Logo Missing">
                          <span className="text-[6px] font-black text-slate-455">IDEAS</span>
                        </div>
                      )}
                    </div>

                    {/* World Bank Logo */}
                    <div className="h-8 flex items-center justify-center">
                      {settings.worldBankLogoUrl ? (
                        <img src={settings.worldBankLogoUrl} alt="World Bank Logo" className="h-[90%] object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-full aspect-[2/1] bg-slate-200/80 rounded border border-dashed border-slate-350 flex items-center justify-center px-1" title="World Bank Logo Missing">
                          <span className="text-[6px] font-black text-slate-455 font-mono">WORLD BANK</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Styled Headings */}
                <div className="text-center space-y-1 mt-1">
                  <h4 className="text-[9px] font-bold tracking-widest text-slate-705 uppercase font-sans">
                    {settings.organizationName || "IDEAS-TVET Initiative"}
                  </h4>
                  <div className="text-[10px] font-black tracking-wider text-indigo-700 uppercase font-sans py-0.5 px-3 bg-white border border-slate-205 rounded inline-block">
                    {previewType === "admission" ? "Provisional Admission Offer" : previewType === "acceptance" ? "Declaration Acceptance Letter" : "Trainee Admission Form"}
                  </div>
                </div>
              </div>

              {/* Dummy Document layout indicators */}
              <div className="space-y-1.5 opacity-25 z-10 my-2">
                <div className="h-1.5 w-1/4 bg-slate-400 rounded" />
                <div className="h-1.5 w-full bg-slate-305 rounded" />
                <div className="h-1.5 w-[92%] bg-slate-305 rounded" />
                <div className="h-1.5 w-5/6 bg-slate-305 rounded" />
              </div>

              {/* Footer Stamp & Signature visual overlay */}
              <div className="flex items-end justify-between px-1 z-10 pt-2 border-t border-slate-200/50 mt-1">
                <div className="text-[6px] font-mono font-bold text-slate-405">
                  SYSTEM VERIFIED REGISTRY DOCUMENT
                </div>
                <div className="flex items-center gap-1.5">
                  {settings.stampUrl ? (
                    <img src={settings.stampUrl} className="h-6 opacity-80 object-contain max-w-[28px]" alt="Official Stamp" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-5 aspect-square border border-slate-300 rounded-full border-dashed flex items-center justify-center text-[5px] text-slate-400">STAMP</div>
                  )}
                  {settings.signatureUrl ? (
                    <img src={settings.signatureUrl} className="h-4 object-contain max-w-[28px]" alt="Signature" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-4 w-6 border border-slate-350 border-dashed flex items-center justify-center text-[5px] text-slate-400">SIGN</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. DOCUMENT USAGE INDICATORS CARD */}
          <div className="bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-4 animate-in fade-in animate-duration-300">
            <div className="flex items-center gap-3 border-b border-slate-150 pb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 text-left font-sans">Document Usage Indicators</h3>
                <p className="text-[11px] text-slate-450 text-left mt-0.5">Templates synchronized with uploaded branding assets</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                "Admission Form",
                "Admission Letter",
                "Acceptance Letter",
                "Enrollment Letter",
                "Certificate",
                "Photo Album"
              ].map((docName, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-left">
                  <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 font-sans truncate cursor-help" title={`${docName} is currently fully sync'd`}>
                    {docName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Accredited Program Provisioner */}
          <div className="bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-150 pb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 text-left">Provision Training Program</h3>
                <p className="text-[11px] text-slate-450 text-left mt-0.5 font-sans">Accredit new cohort technical skill sectors</p>
              </div>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4">
              {feedbackProgram && (
                <div className={`p-3.5 rounded-xl flex items-start gap-2.5 border ${
                  feedbackProgram.status === "success" 
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" 
                    : "bg-rose-50/50 border-rose-200 text-rose-800"
                }`}>
                  {feedbackProgram.status === "success" ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <span className="text-[11px] font-semibold text-left">{feedbackProgram.msg}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Accredited Program Skill Title
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-450" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solar Panel Installation & Maintenance"
                    value={newProgram.name}
                    onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2.5 pl-9 pr-4 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Official Reference Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TP-ENG-002"
                    value={newProgram.code}
                    onChange={(e) => setNewProgram({ ...newProgram, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-250 py-2.5 px-3 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Syllabus Standard Hours
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-450" />
                    <input
                      type="number"
                      required
                      placeholder="e.g. 350"
                      value={newProgram.totalHours}
                      onChange={(e) => setNewProgram({ ...newProgram, totalHours: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-250 py-2.5 pl-9 pr-3 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Accredited Sector
                </label>
                <select
                  value={newProgram.sector}
                  onChange={(e) => setNewProgram({ ...newProgram, sector: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-250 py-2.5 px-3 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none appearance-none"
                >
                  <option value="ICT & Digital Skills">ICT & Digital Skills</option>
                  <option value="Energy & Power Tech">Energy & Power Tech</option>
                  <option value="Auto Mechanics">Auto Mechanics</option>
                  <option value="Building & Construction">Building & Construction</option>
                  <option value="Hospitality & Catering">Hospitality & Catering</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSavingProgram}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-bold py-2 px-4 rounded-lg text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Add Program</span>
              </button>
            </form>
          </div>

          {/* Section 2: Active Accredited Sector Programs List */}
          <div className="bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider text-left border-b border-slate-100 pb-3">
              Accredited Core TVET Programs ({programs.length})
            </h3>
            
            <div className="space-y-3.5 max-h-[310px] overflow-y-auto pr-1">
              {programs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center gap-2 border border-dashed border-slate-200 rounded-xl">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                  <span>No active cohort packages found.</span>
                </div>
              ) : (
                programs.map((prog) => (
                  <div key={prog.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 text-left hover:border-slate-350 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {prog.code}
                        </span>
                        <span className="text-[8px] font-mono uppercase bg-slate-200 text-slate-650 px-1 py-0.5 rounded leading-none">
                          {prog.totalHours} hrs
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate mt-1.5" title={prog.name}>
                        {prog.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                        Sector: {prog.sector}
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleDeleteProgram(prog.id, prog.name)}
                      className="p-2 bg-white border border-slate-200 hover:border-rose-300 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition hover:bg-rose-50"
                      title="De-accredit training sector"
                    >
                      <Trash2 className="w-3.5 h-3.5 animate-bounce-hover" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
      ) : (
        /* LETTERHEAD LIBRARY TAB VIEW CONTAINER */
        <div className="space-y-8 animate-in fade-in duration-300">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT AREA: UPLOAD & NEW TEMPLATE ENTRY BLOCK */}
            <div className="lg:col-span-12 xl:col-span-5 bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-150 pb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 text-left">Upload Template Master</h3>
                  <p className="text-[11px] text-slate-450 text-left mt-0.5">Import new PNG, JPG, or PDF template files</p>
                </div>
              </div>

              {session?.role !== "SUPER_ADMIN" ? (
                <div className="p-4 rounded-xl flex items-start gap-3 border bg-amber-50/70 border-amber-200 text-amber-800">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-left flex-1">
                    <span className="font-bold text-xs text-amber-950 block uppercase tracking-wide">Read-Only Mode</span>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      Your current role does not have authorization rights to upload or activate master letterhead assets. Only a <strong>SUPER_ADMIN</strong> user changes are synchronized.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Template Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kano GTC Official Letterhead"
                      value={newLetterheadName}
                      onChange={(e) => setNewLetterheadName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 py-2 px-3 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Template Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Formal header layout for GTC Kano offer sheets..."
                      value={newLetterheadDescription}
                      onChange={(e) => setNewLetterheadDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 py-2 px-3 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 transition outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 py-1 text-left">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={letterheadIsDefault}
                        onChange={(e) => setLetterheadIsDefault(e.target.checked)}
                      />
                      <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-xs font-bold text-slate-705">Set as System Default Template</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-150">
                    <label className={`w-full min-h-[140px] px-6 py-8 bg-slate-50 hover:bg-slate-100/80 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 transition ${uploadingLetterhead ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                      {uploadingLetterhead ? (
                        <>
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                          <span className="text-xs font-bold text-slate-700">Publishing letterhead page vectors...</span>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-white border border-slate-150 rounded-xl shadow-xs text-slate-550 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-bold text-indigo-600 block">Click to Browse File</span>
                            <span className="text-[10px] text-slate-400 block mt-1 font-sans">Accepts PDF, PNG, JPG, JPEG up to 5MB</span>
                          </div>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={handleUploadLetterheadTemplate}
                        disabled={uploadingLetterhead}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT AREA: THE ACTIVE PREVIEW AND ALL TEMPLATES LIST */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-6">
              
              {/* Active display overlay */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-900 text-left flex flex-col sm:flex-row gap-5 items-center">
                <div className="p-4 bg-indigo-905 bg-indigo-900/30 border border-indigo-700/40 rounded-xl flex items-center justify-center shrink-0 w-24 h-24 overflow-hidden relative shadow-inner">
                  {activeLetterhead ? (
                    <img 
                      src={activeLetterhead.fileUrl} 
                      alt="Active Letterhead" 
                      className="max-h-full max-w-full object-contain" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-indigo-400 opacity-60" />
                  )}
                  {activeLetterhead && (
                    <span className="absolute bottom-1 right-1 px-1 rounded font-mono text-[8px] bg-emerald-500 text-emerald-955 uppercase font-black tracking-tight leading-none">
                      {activeLetterhead.fileType}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-black text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-900/40 uppercase tracking-widest leading-none">
                      Default Letterhead Head
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-450 bg-emerald-400 animate-pulse"></span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">
                    {activeLetterhead ? activeLetterhead.name : "Standard Multi-Logo Header Active"}
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {activeLetterhead 
                      ? activeLetterhead.description 
                      : "The system is currently defaulting to the split federal multi-image header arrangement configured under standard settings options."}
                  </p>
                  {activeLetterhead && (
                    <div className="text-[10px] text-slate-450 font-mono flex flex-wrap gap-x-4 gap-y-1 pt-1.5">
                      <span>Ref Layout: <span className="text-white uppercase font-bold">{activeLetterhead.fileType}</span></span>
                      <span>Uploaded By: <span className="text-white">{activeLetterhead.uploadedBy || "System Admin"}</span></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Library List Card */}
              <div className="bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider text-left">
                    Template Masters Library ({letterheads.length})
                  </h3>
                  {isLoadingLetterheads && (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  )}
                </div>

                {letterheads.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2 border border-dashed border-slate-200 rounded-2xl w-full">
                    <FileText className="w-10 h-10 text-slate-350" />
                    <span className="font-bold text-slate-800">No custom letterhead masters deployed.</span>
                    <span className="text-[11px] text-slate-400 max-w-xs leading-normal">
                      Use the upload console on the left to add a custom official state or federation template.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {letterheads.map((item) => (
                      <div 
                        key={item.id} 
                        className={`p-4 bg-slate-50 border rounded-xl flex flex-col justify-between gap-4 text-left transition hover:border-slate-300 relative ${
                          item.isDefault && item.isActive ? "border-indigo-500 ring-1 ring-indigo-505" : "border-slate-200"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-750 border border-indigo-100 uppercase">
                              {item.fileType}
                            </span>
                            {item.isDefault && item.isActive && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-850 text-[9px] font-black tracking-wide uppercase">
                                DEFAULT ACTIVE
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed line-clamp-2" title={item.description}>
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-150">
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]" title={`Uploaded by ${item.uploadedBy}`}>
                            By {item.uploadedBy?.split("@")[0] || "Admin"}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Activate Default Trigger */}
                            {(!item.isDefault || !item.isActive) && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultLetterhead(item.id)}
                                disabled={session?.role !== "SUPER_ADMIN"}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-indigo-600 border border-slate-205 rounded-lg text-[10px] font-bold uppercase transition select-none cursor-pointer"
                                title="Activate formal template overrides"
                              >
                                Activate
                              </button>
                            )}

                            {/* View Original File */}
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 px-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[10px] font-bold whitespace-nowrap text-center block"
                              title="Original Source Vector File link"
                            >
                              View
                            </a>

                            {/* Delete Trigger */}
                            {(item.isDefault && item.isActive) ? null : (
                              <button
                                type="button"
                                onClick={() => handleDeleteLetterhead(item.id, item.name)}
                                disabled={session?.role !== "SUPER_ADMIN"}
                                className="p-1.5 bg-white border border-slate-200 hover:border-rose-300 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition disabled:opacity-40 hover:bg-rose-50"
                                title="Purge template index"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
