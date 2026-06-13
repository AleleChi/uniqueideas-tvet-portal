import React, { useState, useEffect } from "react";
import { 
  Building2, MapPin, Award, Save, RefreshCw, AlertTriangle, CheckCircle2, Info, Navigation
} from "lucide-react";

interface TspProfile {
  id: string;
  name: string;
  code: string;
  contact_person: string;
  programme_manager: string;
  contact_email: string;
  contact_phone: string;
  state: string;
  lga: string;
  physical_address: string;
  latitude: number | null;
  longitude: number | null;
  registration_number: string;
  accreditation_status: string;
  accreditation_number: string;
  accreditation_expiry: string;
  pending_change?: {
    id: string;
    requested_by: string;
    requested_at: string;
    status: string;
    changes: any;
  };
  change_history?: Array<{
    id: string;
    requested_by: string;
    requested_at: string;
    status: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    reject_reason: string | null;
  }>;
}

interface StateOption {
  name: string;
  code: string;
  geopoliticalZone: string;
}

interface LgaOption {
  name: string;
}

export const TspProfileComponent: React.FC = () => {
  const [profile, setProfile] = useState<TspProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<TspProfile | null>(null);
  const [states, setStates] = useState<StateOption[]>([]);
  const [lgas, setLgas] = useState<LgaOption[]>([]);
  
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 1. Fetch profile and states on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingProfile(true);
        setLoadingStates(true);
        
        // Fetch states list
        const statesRes = await fetch("/api/reference/states");
        if (statesRes.ok) {
          const statesData = await statesRes.json();
          setStates(statesData);
        }
        setLoadingStates(false);

        // Fetch TSP profile
        const profileRes = await fetch("/api/tsps/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData);
          setOriginalProfile(profileData);
          
          // Fetch initial LGAs if state is already selected
          if (profileData.state) {
            fetchDependentLgas(profileData.state);
          }
        }
        setLoadingProfile(false);
      } catch (e: any) {
        console.error("Error fetching metadata databases:", e);
        setNotification({ type: "error", message: "Failed to initialize TSP location tables." });
        setLoadingProfile(false);
        setLoadingStates(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch LGAs based on selected state
  const fetchDependentLgas = async (stateName: string) => {
    if (!stateName) {
      setLgas([]);
      return;
    }
    setLoadingLgas(true);
    try {
      const res = await fetch(`/api/reference/lgas/${encodeURIComponent(stateName)}`);
      if (res.ok) {
        const lgaData = await res.json();
        setLgas(lgaData);
      } else {
        setLgas([]);
      }
    } catch (e) {
      console.error("LGA cascade fetch failed:", e);
      setLgas([]);
    } finally {
      setLoadingLgas(false);
    }
  };

  // Handle Input Changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!profile) return;
    const { name, value } = e.target;
    
    setProfile(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [name]: value
      };
    });

    // Reset specific error
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }

    // Cascade: If selected state is modified, reset LGA selection and reload lgas references
    if (name === "state") {
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          lga: ""
        };
      });
      fetchDependentLgas(value);
    }
  };

  // Inline validation
  const validateForm = (): boolean => {
    if (!profile) return false;
    const newErrors: { [key: string]: string } = {};

    if (!profile.name.trim()) newErrors.name = "Organization Name is required.";
    if (!profile.contact_person || !profile.contact_person.trim()) newErrors.contact_person = "Primary Contact Person is required.";
    if (!profile.programme_manager || !profile.programme_manager.trim()) newErrors.programme_manager = "Training Programme Manager is required.";
    if (!profile.registration_number.trim()) newErrors.registration_number = "Registration details must be declared.";
    
    if (!profile.contact_email.trim()) {
      newErrors.contact_email = "Contact email is required.";
    } else if (!/\S+@\S+\.\S+/.test(profile.contact_email)) {
      newErrors.contact_email = "Provide a valid email address.";
    }

    if (!profile.contact_phone.trim()) newErrors.contact_phone = "Contact phone number is required.";
    if (!profile.state) newErrors.state = "Select training provider's state.";
    if (!profile.lga) newErrors.lga = "Select local government area (LGA).";
    if (!profile.physical_address.trim()) newErrors.physical_address = "Detailed physical address is required.";

    if (profile.latitude !== null && profile.latitude !== undefined) {
      const lat = Number(profile.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = "Latitude must be between -90 and 90.";
      }
    }
    if (profile.longitude !== null && profile.longitude !== undefined) {
      const lng = Number(profile.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = "Longitude must be between -180 and 180.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!validateForm()) {
      setNotification({ type: "error", message: "Please correct highlighted fields before submitting." });
      return;
    }

    setSaving(true);
    setNotification(null);
    try {
      const res = await fetch("/api/tsps/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });
      
      const resData = await res.json();
      if (res.ok) {
        setOriginalProfile(profile);
        if (resData.pendingApproval) {
          setNotification({ type: "success", message: resData.message });
        } else {
          setNotification({ type: "success", message: "Organization Profile saved and synced with TVET reference servers successfully." });
        }
        
        // Refresh profile data to load pending_changes state and history
        const verifyRes = await fetch("/api/tsps/profile");
        if (verifyRes.ok) {
          const freshData = await verifyRes.json();
          setProfile(freshData);
          setOriginalProfile(freshData);
        }
      } else {
        setNotification({ type: "error", message: resData.error || "Failed to update profile changes." });
      }
    } catch (e: any) {
      setNotification({ type: "error", message: "Server connection failure. Please confirm connection/credentials." });
    } finally {
      setSaving(false);
    }
  };

  // Reset/Discard changes
  const handleReset = () => {
    if (window.confirm("Are you sure you want to discard your unsaved edits?")) {
      if (originalProfile) {
        setProfile(originalProfile);
        setErrors({});
        setNotification(null);
        if (originalProfile.state) {
          fetchDependentLgas(originalProfile.state);
        }
      }
    }
  };

  // Detect unsaved changes
  const isDirty = profile && originalProfile && JSON.stringify(profile) !== JSON.stringify(originalProfile);

  if (loadingProfile || loadingStates) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded"></div>
        <div className="h-4 w-72 bg-slate-200 animate-pulse rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="h-64 bg-slate-100 animate-pulse rounded-xl border border-slate-200"></div>
          <div className="h-64 bg-slate-100 animate-pulse rounded-xl border border-slate-200"></div>
          <div className="h-64 bg-slate-100 animate-pulse rounded-xl border border-slate-200 md:col-span-2"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto bg-white rounded-xl border border-slate-200 my-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-sm font-semibold text-slate-900 mt-4">Profile Unavailable</h3>
        <p className="text-xs text-slate-500 mt-2">Could not retrieve provider organization details.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6" id="tsp-profile-workspace">
      {/* Header and Context details */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight text-slate-900 flex items-center gap-3 text-left">
            <Building2 className="w-6 h-6 text-indigo-600" />
            My Organization Profile
          </h2>
          <p className="text-xs text-slate-500 mt-1 md:mt-0 text-left">
            Manage your National Training Provider (TSP) registration, geography, and NBTE accreditation status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Discard Edit
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs text-white rounded-lg transition font-medium shadow-sm cursor-pointer ${
              isDirty 
                ? "bg-indigo-600 hover:bg-indigo-700 active:transform active:scale-95" 
                : "bg-slate-300 cursor-not-allowed text-slate-500"
            }`}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save & Sync
          </button>
        </div>
      </div>

      {/* Pending Change Banner */}
      {profile.pending_change && (
        <div id="pending-change-banner" className="no-print p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 flex items-start gap-3 text-left transition relative">
          <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Awaiting Federal Administrative Approval</p>
            <p className="text-xs mt-1 leading-relaxed">
              You submitted a profile update request on <strong>{new Date(profile.pending_change.requested_at).toLocaleString()}</strong> (by <em>{profile.pending_change.requested_by}</em>) which is currently pending review. 
              Once reviewed and approved by the Federal regulator, your public profile will become the active source of truth.
            </p>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-left transition animate-fade-in ${
          notification.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-xs font-semibold leading-tight">
              {notification.type === "success" ? "Changes Applied Successfully" : "Submission Blocked"}
            </p>
            <p className="text-xs mt-1 text-inherit">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Unsaved Changes Indicator banner */}
      {isDirty && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2.5 text-left transition animate-pulse">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-medium">
            You have unsaved changes. Remember to click <strong>"Save & Sync"</strong> to synchronize your details with the National databases.
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Section 1: Organization Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-sm transition flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4.5 h-4.5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-800 font-sans uppercase tracking-wider">
                Organization Information
              </h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Org Name */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={profile.name}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.name 
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                      : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. Unique Technology Nig. Ltd"
                />
                {errors.name && <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.name}</p>}
              </div>

              {/* Reg Number */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  name="registration_number"
                  value={profile.registration_number}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.registration_number 
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                      : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. RC-123456"
                />
                {errors.registration_number && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.registration_number}</p>
                )}
              </div>

              {/* Contact Email */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Email *
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={profile.contact_email}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.contact_email 
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                      : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. office@tvet.ng"
                />
                {errors.contact_email && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.contact_email}</p>
                )}
              </div>

              {/* Contact Phone */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="text"
                  name="contact_phone"
                  value={profile.contact_phone}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.contact_phone 
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                      : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. +234 803 123 4567"
                />
                {errors.contact_phone && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.contact_phone}</p>
                )}
              </div>

              {/* Primary Contact Person */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Contact Person *
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={profile.contact_person || ""}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.contact_person 
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                      : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. Tom Okwa"
                />
                {errors.contact_person && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.contact_person}</p>
                )}
              </div>

              {/* Training Programme Manager */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Training Programme Manager *
                </label>
                <input
                  type="text"
                  name="programme_manager"
                  value={profile.programme_manager || ""}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.programme_manager 
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                      : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. Tom Okwa"
                />
                {errors.programme_manager && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.programme_manager}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Accreditation Status */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-sm transition flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Award className="w-4.5 h-4.5 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-800 font-sans uppercase tracking-wider">
                Accreditation Records
              </h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Status */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accreditation Status
                </label>
                <select
                  name="accreditation_status"
                  value={profile.accreditation_status}
                  onChange={handleInputChange}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition"
                >
                  <option value="ACTIVE">ACTIVE Accredited status (Verified)</option>
                  <option value="PENDING">PENDING Renewal / Review</option>
                  <option value="SUSPENDED">SUSPENDED (Action required)</option>
                  <option value="EXPIRED">EXPIRED (Urgent NBTE update required)</option>
                </select>
              </div>

              {/* Accreditation Number */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accreditation Number
                </label>
                <input
                  type="text"
                  name="accreditation_number"
                  value={profile.accreditation_number}
                  onChange={handleInputChange}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition"
                  placeholder="e.g. NBTE/TVET/UT-001/2024"
                />
              </div>

              {/* Expiry Date */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accreditation Expiry Date
                </label>
                <input
                  type="date"
                  name="accreditation_expiry"
                  value={profile.accreditation_expiry}
                  onChange={handleInputChange}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Verification Info Note */}
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 flex gap-2.5 text-left items-start">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-normal">
                  All NBTE/ID-EAS accredited providers are locked inside the regulatory tenant tree by the State Coordinator. Any critical registry shifts must be directed to National TVET Desk.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Physical & Location Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-sm transition md:col-span-2 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4.5 h-4.5 text-rose-500" />
            <h3 className="text-sm font-semibold text-slate-800 font-sans uppercase tracking-wider">
              Location & Spatial Identification
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* State selection */}
            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State Location *
              </label>
              <select
                name="state"
                value={profile.state}
                onChange={handleInputChange}
                className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                  errors.state 
                    ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                    : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                }`}
              >
                <option value="">-- Choose State --</option>
                {states.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.geopoliticalZone})
                  </option>
                ))}
              </select>
              {errors.state && <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.state}</p>}
            </div>

            {/* LGA selector */}
            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Local Govt. Area (LGA) *</span>
                {loadingLgas && <span className="text-[9px] text-slate-400 font-mono">loading...</span>}
              </label>
              <select
                name="lga"
                value={profile.lga}
                disabled={!profile.state || loadingLgas}
                onChange={handleInputChange}
                className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                  !profile.state ? "bg-slate-50 cursor-not-allowed" : ""
                } ${
                  errors.lga 
                    ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                    : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                }`}
              >
                <option value="">
                  {!profile.state ? "Select state first" : "-- Choose LGA --"}
                </option>
                {lgas.map(l => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
              {errors.lga && <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.lga}</p>}
            </div>

            {/* Spatial coordinates block */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Latitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={profile.latitude || ""}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.latitude
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-indigo-500"
                  }`}
                  placeholder="e.g. 12.0022"
                />
                {errors.latitude && <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.latitude}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Longitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={profile.longitude || ""}
                  onChange={handleInputChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    errors.longitude
                      ? "border-rose-400 focus:ring-rose-500"
                      : "border-slate-300 focus:ring-indigo-500"
                  }`}
                  placeholder="e.g. 8.5920"
                />
                {errors.longitude && <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.longitude}</p>}
              </div>
            </div>

            {/* Address textarea */}
            <div className="md:col-span-3 text-left">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Physical Address *
              </label>
              <textarea
                name="physical_address"
                rows={3}
                value={profile.physical_address}
                onChange={handleInputChange}
                className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-1 focus:outline-none transition ${
                  errors.physical_address 
                    ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20" 
                    : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                }`}
                placeholder="Declare precise workspace address, landmarks, and street details..."
              />
              {errors.physical_address && (
                <p className="text-[10px] text-rose-500 mt-1 font-medium">{errors.physical_address}</p>
              )}
            </div>

          </div>
        </div>

      </form>

      {/* History panel */}
      {profile.change_history && profile.change_history.length > 0 && (
        <div id="profile-history-audit-center" className="bg-white p-6 rounded-xl border border-slate-200 mt-8 text-left">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Info className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Profile Changes Audit Trail & History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5">Date Requested</th>
                  <th className="py-2.5">Requested By</th>
                  <th className="py-2.5 text-center">Status</th>
                  <th className="py-2.5">Reviewed By</th>
                  <th className="py-2.5">Date Reviewed</th>
                  <th className="py-2.5">Rejection Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {profile.change_history.map((hist) => (
                  <tr key={hist.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-mono text-[10px]">
                      {new Date(hist.requested_at).toLocaleDateString()} {new Date(hist.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 font-mono text-[10px]">{hist.requested_by}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        hist.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {hist.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[10px]">{hist.reviewed_by || "-"}</td>
                    <td className="py-3 font-mono text-[10px]">
                      {hist.reviewed_at ? new Date(hist.reviewed_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 text-slate-500 italic max-w-xs truncate" title={hist.reject_reason || undefined}>
                      {hist.reject_reason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
