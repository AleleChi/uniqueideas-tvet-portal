/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, Check, ShieldCheck, Lock, Eye, EyeOff, Mail, Phone, MapPin, 
  Building2, Globe, AlertTriangle, ArrowRight, Sparkles, Navigation, Globe2
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { NIGERIAN_STATES_AND_LGAS } from "../utils/nigerianLgasData";

interface TspActivationFlowProps {
  token?: string;
  onClose: () => void;
  onActivationSuccess: (sessionData: any) => void;
}

export function TspActivationFlow({ token, onClose, onActivationSuccess }: TspActivationFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(token ? 1 : 2);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAlreadyActivated, setIsAlreadyActivated] = useState(false);
  const [orgDetails, setOrgDetails] = useState<any>(null);

  // Step 1: Initializing Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Step 2: Organizational Profile
  const [states, setStates] = useState<any[]>(() => {
    return Object.keys(NIGERIAN_STATES_AND_LGAS).map((s) => ({ name: s })).sort((a,b) => a.name.localeCompare(b.name));
  });
  const [lgas, setLgas] = useState<any[]>([]);
  const [loadingLgas, setLoadingLgas] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    organization_name: "",
    state: "",
    lga: "",
    physical_address: "",
    contact_email: "",
    contact_phone: "",
    is_nbte_accredited: true,
    nbte_accreditation_number: "",
    accreditation_status: "ACCREDITED",
    accreditation_date: "",
    accreditation_expiry_date: "",
    website: "",
    secondary_contact: "",
    latitude: "",
    longitude: ""
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // 1. Validate the activation token or fetch the profile on mount
  useEffect(() => {
    let active = true;

    const verifyTokenOrLoadProfile = async () => {
      try {
        setLoading(true);

        if (token) {
          const res = await fetch("/api/tsp/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
          });

          if (!active) return;

          if (res.ok) {
            const data = await res.json();
            setOrgDetails(data);
            
            if (data.already_activated) {
              setIsAlreadyActivated(true);
              return;
            }

            if (data.onboarding_step === 2) {
              setCurrentStep(2);
            }
            
            setProfileForm(prev => ({
              ...prev,
              organization_name: data.name || "",
              contact_email: data.email || "",
              state: data.state || "",
              lga: data.lga || "",
              contact_phone: data.contact_phone || "",
              is_nbte_accredited: data.is_nbte_accredited !== undefined ? (data.is_nbte_accredited === true || data.is_nbte_accredited === "true") : true,
              nbte_accreditation_number: data.nbte_accreditation_number || data.accreditation_number || "",
              accreditation_status: data.accreditation_status || "ACCREDITED",
              accreditation_date: data.accreditation_date || "",
              accreditation_expiry_date: data.accreditation_expiry_date || data.accreditation_expiry || ""
            }));
          } else {
            const err = await res.json();
            setErrorMsg(err.error || "The activation token is invalid or has expired.");
          }
        } else {
          // No token supplied, load from auth profile
          const res = await authFetch("/api/tsps/profile");
          if (!active) return;

          if (res.ok) {
            const data = await res.json();
            setOrgDetails({
              name: data.name,
              tsp_code: data.code,
              email: data.contact_email
            });
            setProfileForm({
              organization_name: data.name || "",
              state: data.state || "",
              lga: data.lga || "",
              physical_address: data.physical_address || "",
              contact_email: data.contact_email || "",
              contact_phone: data.contact_phone || "",
              is_nbte_accredited: data.is_nbte_accredited !== undefined ? (data.is_nbte_accredited === true || data.is_nbte_accredited === "true") : true,
              nbte_accreditation_number: data.nbte_accreditation_number || data.accreditation_number || "",
              accreditation_status: data.accreditation_status || "ACCREDITED",
              accreditation_date: data.accreditation_date || "",
              accreditation_expiry_date: data.accreditation_expiry_date || data.accreditation_expiry || "",
              website: data.website || "",
              secondary_contact: data.secondary_contact || "",
              latitude: data.latitude ? String(data.latitude) : "",
              longitude: data.longitude ? String(data.longitude) : ""
            });
          } else {
            setErrorMsg("Failed to retrieve your organization profile context.");
          }
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg("Failed to establish server connection. Please retry shortly.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    verifyTokenOrLoadProfile();
    return () => {
      active = false;
    };
  }, [token]);

  // Fetch LGA dropdown dynamically when selected state changes
  useEffect(() => {
    if (!profileForm.state) {
      setLgas([]);
      return;
    }

    const loadLgas = () => {
      setLoadingLgas(true);
      try {
        const matchedKey = Object.keys(NIGERIAN_STATES_AND_LGAS).find(
          k => k.toLowerCase().trim() === profileForm.state.toLowerCase().trim()
        );
        if (matchedKey) {
          const matchedLgas = NIGERIAN_STATES_AND_LGAS[matchedKey].sort().map(name => ({ name }));
          setLgas(matchedLgas);
        } else {
          setLgas([]);
        }
      } catch (e) {
        console.error("Failed to load LGA cascade:", e);
      } finally {
        setLoadingLgas(false);
      }
    };

    loadLgas();
  }, [profileForm.state]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setFormErrors({ password: "Password must be at least 8 characters long." });
      return;
    }
    if (password !== confirmPassword) {
      setFormErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    try {
      setSubmittingPassword(true);
      setFormErrors({});
      const res = await fetch("/api/tsp/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });

      if (res.ok) {
        const sessionData = await res.json();
        // Set the active session in browser cookie/storage to proceed as logged-in!
        localStorage.setItem("ideas-session", JSON.stringify(sessionData));
        
        // Notify parent about new active session
        onActivationSuccess(sessionData);
        
        // Advance progress step
        setCurrentStep(2);
      } else {
        const err = await res.json();
        setFormErrors({ general: err.error || "Failed to set administrative password." });
      }
    } catch {
      setFormErrors({ general: "Network connection failing. Please check connection and retry." });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    // Validate fields
    if (!profileForm.organization_name.trim()) errors.organization_name = "Organization name is mandatory.";
    if (!profileForm.state) errors.state = "Assigning state is mandatory.";
    if (!profileForm.lga) errors.lga = "LGA is mandatory.";
    if (!profileForm.physical_address.trim()) errors.physical_address = "Corporate address is mandatory.";
    if (!profileForm.contact_email.trim()) errors.contact_email = "Primary email is mandatory.";
    if (!profileForm.contact_phone.trim()) errors.contact_phone = "Primary contact phone is mandatory.";
    if (profileForm.is_nbte_accredited) {
      if (!profileForm.nbte_accreditation_number.trim()) {
        errors.nbte_accreditation_number = "NBTE Accreditation number is mandatory.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmittingProfile(true);
      setFormErrors({});

      // Auth fetch operates under authenticated session cookie set during Step 1
      const res = await authFetch("/api/tsp/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm)
      });

      if (res.ok) {
        // Success! Reload session context to trigger fully authorized dashboard
        const currentSessionStr = localStorage.getItem("ideas-session");
        if (currentSessionStr) {
          const s = JSON.parse(currentSessionStr);
          s.profile_completed = true;
          localStorage.setItem("ideas-session", JSON.stringify(s));
          onActivationSuccess(s);
        }
        
        window.location.hash = "#/dashboard";
        onClose();
      } else {
        const err = await res.json();
        setFormErrors({ general: err.error || "Failed to complete national profile verification." });
      }
    } catch {
      setFormErrors({ general: "A communication error occurred with the secure gateway." });
    } finally {
      setSubmittingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center antialiased">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 max-w-md w-full shadow-lg space-y-4">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent mx-auto rounded-full" />
          <p className="text-slate-600 font-display text-sm font-medium">Verifying invitation credential key...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    const isExpired = errorMsg.toLowerCase().includes("expire");
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 antialiased">
        <div className="bg-white border border-slate-200 shadow-xl max-w-md w-full p-8 rounded-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-red-500" />
          <div className="h-12 w-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight font-display">
              {isExpired ? "Activation Link Expired" : "Activation Link Invalid"}
            </h1>
            <p className="text-slate-550 text-sm leading-relaxed">
              {isExpired ? (
                "This activation link has expired. Request a new activation email."
              ) : (
                "This activation link is invalid. Please contact your programme administrator."
              )}
            </p>
          </div>
          <div className="border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-400 leading-normal">
              Need assistance? Please contact the Federal TVET Administration Support Office or ask your designated state officer.
            </p>
            <button
              onClick={() => { window.location.hash = "#/landing"; }}
              className="mt-5 w-full bg-slate-900 text-white rounded-lg py-2.5 text-xs font-semibold hover:bg-slate-800 transition shadow-sm cursor-pointer"
            >
              Back to Home Gateway
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAlreadyActivated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased font-sans">
        <div className="bg-white border border-slate-200/80 shadow-xl max-w-sm w-full p-8 rounded-2xl space-y-6 relative overflow-hidden text-center">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight font-display">
              Account Already Activated
            </h1>
            <p className="text-slate-500 text-xs leading-relaxed">
              Great news! Your National TVET Platform account for <strong>{orgDetails?.name || "your organization"}</strong> is already fully activated and ready for use.
            </p>
          </div>
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <button
              onClick={() => { window.location.hash = "#/login"; onClose?.(); }}
              className="w-full bg-indigo-600 text-white rounded-lg py-3 text-xs font-bold hover:bg-indigo-700 transition shadow-sm cursor-pointer"
            >
              Go to Login
            </button>
            <button
              onClick={() => { window.location.hash = "#/forgot-password"; }}
              className="w-full bg-slate-150 text-slate-700 hover:bg-slate-205 rounded-lg py-3 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Forgot Password
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl px-4 sm:px-0">
        
        {/* PROGRESS STEPPER HEADER */}
        <div className="flex items-center justify-between mb-8 bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-55 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="text-[10px] font-bold tracking-widest text-indigo-600 font-mono uppercase bg-indigo-50 px-2.5 py-0.5 rounded">
                TSP ONBOARDING
              </span>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">National Provider Activation Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 font-mono text-[11px] font-bold text-slate-500">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${currentStep >= 1 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-450"}`}>
              {currentStep > 1 ? <Check className="w-3.5 h-3.5 text-white" /> : "1"}
            </div>
            <div className="w-4 h-[2px] bg-slate-200" />
            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${currentStep >= 2 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-450"}`}>
              "2"
            </div>
          </div>
        </div>

        {/* CONTAINER WORKSPACE */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-md text-left">
          
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/60">
            <span className="text-[9px] font-bold font-mono tracking-widest text-slate-400 block uppercase">
              REGISTERED LEGAL ENTITY
            </span>
            <h2 className="text-lg font-bold font-display text-slate-900 tracking-tight mt-1">
              {orgDetails?.name}
            </h2>
            <p className="text-xs text-indigo-600 font-medium font-mono mt-0.5">
              National TVET ID: {orgDetails?.tsp_code}
            </p>
          </div>

          {/* STEP 1: INITIALIZE PASSWORD */}
          {currentStep === 1 && (
            <form onSubmit={handlePasswordSubmit} className="p-6 sm:p-8 space-y-6">
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-100/50 p-4 space-y-2">
                <div className="flex gap-2.5 text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-bold tracking-tight">Active Enrollment Credential Available</p>
                </div>
                <p className="text-xs text-slate-600 leading-normal">
                  Your administrator login account has been initialized. Please configure a secure password below to secure your command workspace.
                </p>
              </div>

              {formErrors.general && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex gap-3 text-red-650">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">{formErrors.general}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Primary Contact Email
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      className="bg-slate-100 border border-slate-200 text-slate-500 rounded-lg block w-full pl-10 pr-3 py-2.5 text-xs font-medium outline-hidden select-all"
                      value={orgDetails?.email || ""}
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Administrator Account Password
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full pl-10 pr-10 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer min-h-[44px]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formErrors.password && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full pl-10 pr-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  {formErrors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingPassword}
                className="w-full bg-slate-900 text-white rounded-lg py-3 text-xs font-bold hover:bg-slate-800 transition inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingPassword ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Verifying authentication...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Password & Activate Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: MANDATORY PROFILE COMPLETION */}
          {currentStep === 2 && (
            <form onSubmit={handleProfileSubmit} className="p-6 sm:p-8 space-y-6">
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex gap-3 text-amber-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="text-xs space-y-1">
                  <p className="font-bold tracking-tight text-amber-900">National Organization Registration Incomplete</p>
                  <p className="leading-relaxed text-slate-600">
                    To access your operating dashboard and manage student cohorts, you must register your official corporate location, NBTE accreditation records, and administrative particulars as mandated by the Federal TVET guidelines.
                  </p>
                </div>
              </div>

              {formErrors.general && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex gap-3 text-red-650">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">{formErrors.general}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Organization Name (Full Legal Name) *
                  </label>
                  <input
                    type="text"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    placeholder="E.g. Unique Technology Nig. Ltd"
                    value={profileForm.organization_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, organization_name: e.target.value }))}
                  />
                  {formErrors.organization_name && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.organization_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Corporate Email Address *
                  </label>
                  <input
                    type="email"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    placeholder="corporate@domain.com"
                    value={profileForm.contact_email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                  {formErrors.contact_email && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.contact_email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Assigned State *
                  </label>
                  <select
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    value={profileForm.state}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, state: e.target.value, lga: "" }))}
                  >
                    <option value="">Select State</option>
                    {states.map((s, i) => (
                      <option key={i} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  {formErrors.state && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Assigned Local Government Area (LGA) *
                  </label>
                  <select
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    value={profileForm.lga}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lga: e.target.value }))}
                    disabled={!profileForm.state || loadingLgas}
                  >
                    <option value="">{loadingLgas ? "Loading LGAs..." : "Select LGA"}</option>
                    {lgas.map((l, i) => (
                      <option key={i} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                  {formErrors.lga && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.lga}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Corporate Physical Address *
                  </label>
                  <input
                    type="text"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    placeholder="Street, Suite number, city description etc."
                    value={profileForm.physical_address}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, physical_address: e.target.value }))}
                  />
                  {formErrors.physical_address && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.physical_address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Primary Contact Phone Number *
                  </label>
                  <input
                    type="text"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    placeholder="E.g. +23480xxxxxxxx"
                    value={profileForm.contact_phone}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                  />
                  {formErrors.contact_phone && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.contact_phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Secondary Contact/Representative Phone (Optional)
                  </label>
                  <input
                    type="text"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    placeholder="E.g. +23470xxxxxxxx"
                    value={profileForm.secondary_contact}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, secondary_contact: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2 border-t border-b border-slate-100 py-4 my-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    NBTE Accredited? *
                  </label>
                  <div className="flex gap-6 mt-1.5">
                    <label className="inline-flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        name="is_nbte_accredited"
                        checked={profileForm.is_nbte_accredited === true}
                        onChange={() => setProfileForm(prev => ({ 
                          ...prev, 
                          is_nbte_accredited: true,
                          accreditation_status: prev.accreditation_status === "NOT_ACCREDITED" ? "ACCREDITED" : prev.accreditation_status
                        }))}
                      />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        name="is_nbte_accredited"
                        checked={profileForm.is_nbte_accredited === false}
                        onChange={() => setProfileForm(prev => ({ 
                          ...prev, 
                          is_nbte_accredited: false,
                          accreditation_status: "NOT_ACCREDITED"
                        }))}
                      />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                </div>

                {profileForm.is_nbte_accredited && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Accreditation Number *
                      </label>
                      <input
                        type="text"
                        className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                        placeholder="E.g. NBTE/TVET/UT-001/2024"
                        value={profileForm.nbte_accreditation_number}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, nbte_accreditation_number: e.target.value }))}
                      />
                      {formErrors.nbte_accreditation_number && (
                        <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.nbte_accreditation_number}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Accreditation Status *
                      </label>
                      <select
                        className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                        value={profileForm.accreditation_status}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, accreditation_status: e.target.value }))}
                      >
                        <option value="ACCREDITED">Fully Accredited</option>
                        <option value="PENDING">Pending Evaluation</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="EXPIRED">Expired</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Accreditation Date *
                      </label>
                      <input
                        type="date"
                        className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                        value={profileForm.accreditation_date}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, accreditation_date: e.target.value }))}
                      />
                      {formErrors.accreditation_date && (
                        <p className="text-red-500 text-xs mt-1.5 font-medium">{formErrors.accreditation_date}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Accreditation Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                        value={profileForm.accreditation_expiry_date}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, accreditation_expiry_date: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Corporate Website Domain (Optional)
                  </label>
                  <input
                    type="url"
                    className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550 focus:ring-1 focus:ring-indigo-500"
                    placeholder="https://yourwebsite.edu.ng"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Latitude (Opt)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550"
                      placeholder="E.g. 12.002"
                      value={profileForm.latitude}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, latitude: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Longitude (Opt)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="border border-slate-200 bg-white text-slate-800 rounded-lg block w-full px-3 py-2.5 text-xs font-medium outline-hidden focus:border-indigo-550"
                      placeholder="E.g. 8.592"
                      value={profileForm.longitude}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, longitude: e.target.value }))}
                    />
                  </div>
                </div>

              </div>

              <div className="border-t border-slate-100 pt-6">
                <button
                  type="submit"
                  disabled={submittingProfile}
                  className="w-full bg-indigo-600 text-white rounded-lg py-3 text-xs font-bold hover:bg-indigo-700 transition inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingProfile ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      <span>Locking professional profile...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-white" />
                      <span>Lock Configuration & Open TVET Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
