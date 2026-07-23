/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Save, Globe, CheckCircle2, AlertTriangle, RefreshCw, Eye, Smartphone, Tablet, Monitor,
  Mail, Phone, Clock, MapPin, ExternalLink, ShieldCheck, HelpCircle, ArrowRight, Sparkles, AlertCircle, FileText
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";
import { PublicSiteSettings } from "../../types";

export default function PublicSiteSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  // Settings from API
  const [publishedSettings, setPublishedSettings] = useState<PublicSiteSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<PublicSiteSettings | null>(null);

  // Form Fields (editable)
  const [supportEmail, setSupportEmail] = useState("support@ideas-tvet.ng");
  const [supportPhone, setSupportPhone] = useState("+234 (0) 90 3242 5592");
  const [dialablePhone, setDialablePhone] = useState("+2349032425592");
  const [altPhone, setAltPhone] = useState("");
  const [officeHoursDays, setOfficeHoursDays] = useState("Monday to Friday");
  const [openingTime, setOpeningTime] = useState("8:30 AM");
  const [closingTime, setClosingTime] = useState("5:00 PM");
  const [timezone, setTimezone] = useState("GMT+1");
  const [publicHolidayNote, setPublicHolidayNote] = useState("excluding public holidays");
  const [officeName, setOfficeName] = useState("Federal Ministry of Education Headquarters");
  const [addressLine1, setAddressLine1] = useState("Plot 245 Samuel Ademulegun Avenue");
  const [addressLine2, setAddressLine2] = useState("Central Business District");
  const [city, setCity] = useState("Abuja");
  const [stateFct, setStateFct] = useState("FCT");
  const [country, setCountry] = useState("Nigeria");
  const [postalCode, setPostalCode] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [footerDescription, setFooterDescription] = useState("Supporting practical training, clearer admissions and better access to technical skills.");
  const [copyright, setCopyright] = useState("Federal Ministry of Education · National IDEAS Initiative Project");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("#privacy");
  const [termsOfServiceUrl, setTermsOfServiceUrl] = useState("#terms");
  const [accessibilityUrl, setAccessibilityUrl] = useState("#accessibility");

  // Preview Mode State
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  useEffect(() => {
    fetchSettings();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const populateForm = (data: PublicSiteSettings) => {
    setSupportEmail(data.supportEmail || "support@ideas-tvet.ng");
    setSupportPhone(data.supportPhone || "+234 (0) 90 3242 5592");
    setDialablePhone(data.dialablePhone || "+2349032425592");
    setAltPhone(data.altPhone || "");
    setOfficeHoursDays(data.officeHoursDays || "Monday to Friday");
    setOpeningTime(data.openingTime || "8:30 AM");
    setClosingTime(data.closingTime || "5:00 PM");
    setTimezone(data.timezone || "GMT+1");
    setPublicHolidayNote(data.publicHolidayNote || "excluding public holidays");
    setOfficeName(data.officeName || "Federal Ministry of Education Headquarters");
    setAddressLine1(data.addressLine1 || "Plot 245 Samuel Ademulegun Avenue");
    setAddressLine2(data.addressLine2 || "Central Business District");
    setCity(data.city || "Abuja");
    setStateFct(data.stateFct || "FCT");
    setCountry(data.country || "Nigeria");
    setPostalCode(data.postalCode || "");
    setMapUrl(data.mapUrl || "");
    setFooterDescription(data.footerDescription || "Supporting practical training, clearer admissions and better access to technical skills.");
    setCopyright(data.copyright || "Federal Ministry of Education · National IDEAS Initiative Project");
    setPrivacyPolicyUrl(data.privacyPolicyUrl || "#privacy");
    setTermsOfServiceUrl(data.termsOfServiceUrl || "#terms");
    setAccessibilityUrl(data.accessibilityUrl || "#accessibility");
  };

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    setAccessDenied(false);
    try {
      const res = await authFetch("/api/federal/site-settings");
      if (res.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load public site settings");
      }
      const data = await res.json();
      setPublishedSettings(data.published);
      setDraftSettings(data.draft);
      if (data.draft) {
        populateForm(data.draft);
      } else if (data.published) {
        populateForm(data.published);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const getFormData = (): Partial<PublicSiteSettings> => ({
    supportEmail,
    supportPhone,
    dialablePhone,
    altPhone,
    officeHoursDays,
    openingTime,
    closingTime,
    timezone,
    publicHolidayNote,
    officeName,
    addressLine1,
    addressLine2,
    city,
    stateFct,
    country,
    postalCode,
    mapUrl,
    footerDescription,
    copyright,
    privacyPolicyUrl,
    termsOfServiceUrl,
    accessibilityUrl
  });

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = getFormData();
      const res = await authFetch("/api/federal/site-settings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 403) {
        showToast("Access Denied: Only authorised Federal Admin roles can save site settings.", "error");
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save draft");
      }
      const data = await res.json();
      setDraftSettings(data.draft);
      showToast("Draft settings saved successfully.", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to save draft.", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const payload = {
        ...getFormData(),
        expectedVersion: publishedSettings?.version
      };
      const res = await authFetch("/api/federal/site-settings/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 403) {
        showToast("Access Denied: Only authorised Federal Admin roles can publish site settings.", "error");
        return;
      }
      if (res.status === 409) {
        setConflictModalOpen(true);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to publish settings");
      }
      const data = await res.json();
      setPublishedSettings(data.published);
      setDraftSettings(data.published);
      showToast("Public contact and footer settings published live!", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to publish settings.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleReset = () => {
    if (draftSettings) {
      populateForm(draftSettings);
      showToast("Reset form to current saved draft.", "warning");
    } else if (publishedSettings) {
      populateForm(publishedSettings);
      showToast("Reset form to current published settings.", "warning");
    }
  };

  if (accessDenied) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            You do not have permission to view or manage Public Contact & Footer Settings. This page is restricted to authorised Federal Admin personnel only.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
        <p className="text-sm font-medium">Loading Public Site Settings...</p>
      </div>
    );
  }

  const previewData = getFormData();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 ${
          toast.type === "success" ? "bg-emerald-900 text-white border-emerald-700" :
          toast.type === "error" ? "bg-rose-900 text-white border-rose-700" :
          "bg-amber-900 text-white border-amber-700"
        }`}>
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          {toast.type === "warning" && <AlertCircle className="w-4 h-4 text-amber-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Version Conflict Modal */}
      {conflictModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full space-y-4 text-left shadow-2xl">
            <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Concurrent Update Conflict</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Another Federal Administrator has published updated site settings while you were editing this page.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Please reload the page to review the latest published values before making and saving your changes.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setConflictModalOpen(false);
                  fetchSettings();
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-2.5 rounded-xl transition cursor-pointer text-center"
              >
                Reload Latest Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 text-left">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Website Management
            </span>
            {publishedSettings?.version && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                Version {publishedSettings.version} Published
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Public Contact & Footer Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage the official contact information, opening hours, office address and footer details displayed on the public landing page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Reset Form
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-slate-600" />}
            <span>Save Draft</span>
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {publishing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span>Publish Live</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        
        {/* Left 7 Columns: Form Editor */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section 1: Support Details */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Support & Communication</h2>
                <p className="text-[11px] text-slate-500">Email, helpline number and opening hours shown in the contact section.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Support Email Address</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="e.g. support@ideas-tvet.ng"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Display Phone Number</label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="e.g. +234 (0) 90 3242 5592"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Dialable Phone (tel: link format)</label>
                <input
                  type="text"
                  value={dialablePhone}
                  onChange={(e) => setDialablePhone(e.target.value)}
                  placeholder="e.g. +2349032425592"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Alternative Phone Number (Optional)</label>
                <input
                  type="text"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                  placeholder="e.g. +234 (0) 80 1234 5678"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Office Working Days</label>
                <input
                  type="text"
                  value={officeHoursDays}
                  onChange={(e) => setOfficeHoursDays(e.target.value)}
                  placeholder="e.g. Monday to Friday"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Opening Time</label>
                <input
                  type="text"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  placeholder="e.g. 8:30 AM"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Closing Time</label>
                <input
                  type="text"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  placeholder="e.g. 5:00 PM"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. GMT+1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Public Holiday Note</label>
                <input
                  type="text"
                  value={publicHolidayNote}
                  onChange={(e) => setPublicHolidayNote(e.target.value)}
                  placeholder="e.g. excluding public holidays"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Office Location */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Office Location & Address</h2>
                <p className="text-[11px] text-slate-500">Official office headquarters details and optional map link.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Office Name</label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="e.g. Federal Ministry of Education Headquarters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Address Line 1</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. Plot 245 Samuel Ademulegun Avenue"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Address Line 2</label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="e.g. Central Business District"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Abuja"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">State / FCT</label>
                <input
                  type="text"
                  value={stateFct}
                  onChange={(e) => setStateFct(e.target.value)}
                  placeholder="e.g. FCT"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Nigeria"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Postal Code (Optional)</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 900211"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Google Maps Direction URL (Optional)</label>
                <input
                  type="text"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="e.g. https://maps.google.com/?q=Federal+Ministry+of+Education+Abuja"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Footer Content */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Footer Text & Legal Links</h2>
                <p className="text-[11px] text-slate-500">Short project description, copyright statement and policy link anchors.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Short Footer Description</label>
                <textarea
                  rows={2}
                  value={footerDescription}
                  onChange={(e) => setFooterDescription(e.target.value)}
                  placeholder="Supporting practical training, clearer admissions and better access to technical skills."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Copyright Line</label>
                <input
                  type="text"
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  placeholder="e.g. Federal Ministry of Education · National IDEAS Initiative Project"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Privacy Policy Link</label>
                  <input
                    type="text"
                    value={privacyPolicyUrl}
                    onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                    placeholder="#privacy"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Terms Link</label>
                  <input
                    type="text"
                    value={termsOfServiceUrl}
                    onChange={(e) => setTermsOfServiceUrl(e.target.value)}
                    placeholder="#terms"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Accessibility Link (Optional)</label>
                  <input
                    type="text"
                    value={accessibilityUrl}
                    onChange={(e) => setAccessibilityUrl(e.target.value)}
                    placeholder="#accessibility"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right 5 Columns: Live Responsive Preview Frame */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-8 h-fit">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 space-y-4">
            
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold tracking-tight">Live Public Preview</span>
              </div>

              {/* Device Selector */}
              <div className="flex items-center bg-slate-800 rounded-lg p-1 text-slate-400">
                <button
                  onClick={() => setPreviewDevice("desktop")}
                  className={`p-1.5 rounded-md transition ${previewDevice === "desktop" ? "bg-slate-700 text-white" : "hover:text-slate-200"}`}
                  title="Desktop view"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewDevice("tablet")}
                  className={`p-1.5 rounded-md transition ${previewDevice === "tablet" ? "bg-slate-700 text-white" : "hover:text-slate-200"}`}
                  title="Tablet view"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewDevice("mobile")}
                  className={`p-1.5 rounded-md transition ${previewDevice === "mobile" ? "bg-slate-700 text-white" : "hover:text-slate-200"}`}
                  title="Mobile view"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Simulated Frame Outer Container */}
            <div className="overflow-x-auto py-2">
              <div 
                className={`mx-auto bg-slate-100 rounded-xl overflow-hidden border border-slate-700 shadow-2xl transition-all duration-300 ${
                  previewDevice === "desktop" ? "w-full max-w-xl" :
                  previewDevice === "tablet" ? "w-[420px]" : "w-[300px]"
                }`}
              >
                
                {/* Simulated Frame Content: Contact Section Preview */}
                <div className="bg-slate-50 p-5 border-b border-slate-200 text-left space-y-4 font-sans text-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      Contact & Support
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight mt-1">
                      Need help with your application or training?
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                      Our support team can help with applications, document checks and general programme enquiries.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="bg-slate-900 text-white text-[10px] font-medium py-1.5 px-3 rounded-lg flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email support
                    </span>
                    <span className="bg-white text-slate-800 border border-slate-300 text-[10px] font-medium py-1.5 px-3 rounded-lg flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" /> Call support
                    </span>
                  </div>

                  {/* Details Panel */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3 text-[11px] space-y-2 mt-2">
                    <div className="flex items-start gap-2 text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold block text-slate-900">Opening Hours</span>
                        <span className="text-slate-600">
                          {previewData.officeHoursDays}, {previewData.openingTime} to {previewData.closingTime} ({previewData.timezone})
                          {previewData.publicHolidayNote ? `, ${previewData.publicHolidayNote}` : ''}.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-700">
                      <Mail className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold block text-slate-900">Support Email</span>
                        <span className="text-emerald-700 font-medium">{previewData.supportEmail}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold block text-slate-900">Telephone</span>
                        <span className="text-slate-800 font-medium">{previewData.supportPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold block text-slate-900">Office Location</span>
                        <span className="text-slate-600 leading-tight block">
                          {previewData.officeName}, {previewData.addressLine1}, {previewData.addressLine2}, {previewData.city}, {previewData.stateFct}, {previewData.country}.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Frame Content: Footer Section Preview */}
                <div className="bg-slate-950 text-slate-400 p-5 text-left space-y-4 font-sans text-[10px]">
                  
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-900">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        IDEAS-TVET
                      </div>
                      <p className="text-slate-500 leading-snug text-[9px]">
                        {previewData.footerDescription}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold text-white block">Contact</span>
                      <span className="block text-slate-400 truncate">{previewData.supportEmail}</span>
                      <span className="block text-slate-400">{previewData.supportPhone}</span>
                      <span className="block text-slate-500">{previewData.city}, {previewData.country}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-[9px] text-slate-600">
                    <p>© {new Date().getFullYear()} {previewData.copyright}</p>
                    <div className="flex gap-2 text-slate-500">
                      <span>Privacy Policy</span>
                      <span>·</span>
                      <span>Terms of Service</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              Changes updated live as you type. Click <strong className="text-emerald-400 font-semibold">Publish Live</strong> to make these values public.
            </p>

          </div>
        </div>

      </div>

    </div>
  );
}
