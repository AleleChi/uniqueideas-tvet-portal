/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, UserCheck, MapPin, Mail, Phone, Upload, Trash2, Plus, 
  Save, CheckCircle, AlertCircle, Award, BookOpen, Clock, Tag, RefreshCw 
} from "lucide-react";
import { OrganizationSettings, TrainingProgram } from "../types";
import { authFetch } from "../utils/authFetch";

export function SettingsWorkspace() {
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
    stampUrl: ""
  });

  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [feedbackSettings, setFeedbackSettings] = useState<{ status: "success" | "error"; msg: string } | null>(null);

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
    stamp: "idle"
  });

  useEffect(() => {
    fetchSettings();
    fetchPrograms();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await authFetch("/api/organization-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
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

  // Generic File Uploader proxying to Cloudinary
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "letterhead" | "signature" | "stamp") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(prev => ({ ...prev, [field]: "uploading" }));

    try {
      // 1. Convert to Base64 dataURI
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Content = reader.result as string;
        
        try {
          // 2. Dispatch upload to our proxy router, reducing CORS complexity
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
            setUploadStatus(prev => ({ ...prev, [field]: "success" }));
            setTimeout(() => {
              setUploadStatus(prev => ({ ...prev, [field]: "idle" }));
            }, 3000);
          } else {
            throw new Error("API return non-200 state");
          }
        } catch (err) {
          console.error(`Cloudinary upload failed for ${field}:`, err);
          setUploadStatus(prev => ({ ...prev, [field]: "error" }));
        }
      };
      
      reader.onerror = () => {
        setUploadStatus(prev => ({ ...prev, [field]: "error" }));
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
        await fetchSettings();
      } else {
        const errData = await res.json();
        setFeedbackSettings({ status: "error", msg: errData.error || "Failed updating organization parameters." });
      }
    } catch (err: any) {
      setFeedbackSettings({ status: "error", msg: err.message || "Failed saving parameters due to a connection break." });
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

  const handleDeleteProgram = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the accredited Training Program '${name}'? This may affect cascading historical beneficiary lookups.`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/training-programs/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        await fetchPrograms();
      } else {
        alert("Action restricted under system isolation guidelines.");
      }
    } catch (err) {
      console.error(err);
    }
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COMPONENT: ORGANIZATION DETAILS & LOGO/STAMP GRAPHICS */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/85 p-6 shadow-sm space-y-6">
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

        {/* RIGHT COMPONENT: TRAINING PROGRAMS & BATCHES CONFIG */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 1: Accredited Program Provisioner */}
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

    </div>
  );
}
