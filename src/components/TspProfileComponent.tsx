import React, { useState, useEffect } from "react";
import { 
  Building2, MapPin, Award, Save, RefreshCw, AlertTriangle, CheckCircle2, Info, Navigation,
  Users, CheckSquare, FileText, Mail, Upload, Trash2, Calendar, FileCheck, Check, Settings
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

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
  is_nbte_accredited: boolean;
  nbte_accreditation_number: string;
  accreditation_date: string;
  accreditation_expiry_date: string;
  tsp_code: string;
  account_status: string;
  profile_completed: boolean;
  activated_at: string | null;
  suspended_at: string | null;
  suspension_reason: string;
  website: string;
  secondary_contact: string;
  
  // New operational / document fields
  sector: string;
  skill_area: string;
  cac_certificate_url: string;
  nbte_accreditation_url: string;
  eoi_documents_url: string;
  mou_documents_url: string;
  tax_compliance_url: string;

  // Training setup fields
  training_venue: string;
  training_start_date: string;
  training_end_date: string;
  attendance_threshold: number;
  completion_threshold: number;

  // Nested branding profiles
  branding: {
    logo_url: string;
    letterhead_url: string;
    admission_letterhead_url: string;
    acceptance_letterhead_url: string;
    signature_url: string;
    stamp_url: string;
    certificate_background_url: string;
    photo_album_header_url: string;
    official_name: string;
    accreditation_number: string;
    contact_email: string;
    contact_phone: string;
    address: string;
  };

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
  const [stats, setStats] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<"profile" | "accreditation" | "branding" | "training">("profile");
  
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Fetch profile, states, and stats on mount using authFetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingProfile(true);
        setLoadingStates(true);
        setLoadingStats(true);
        
        // Fetch states list
        const statesRes = await authFetch("/api/reference/states");
        if (statesRes.ok) {
          const statesData = await statesRes.json();
          setStates(statesData);
        }
        setLoadingStates(false);

        // Fetch TSP profile and branding
        const [profileRes, brandingRes] = await Promise.all([
          authFetch("/api/tsps/profile"),
          authFetch("/api/tsps/branding")
        ]);
        
        let brandingData: any = null;
        if (brandingRes && brandingRes.ok) {
          try {
            brandingData = await brandingRes.json();
          } catch (_) {}
        }

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          
          // Ensure branding profile nested object exists and is populated with fetched branding
          if (brandingData) {
            profileData.branding = {
              ...brandingData,
              official_name: brandingData.official_name || profileData.name || "",
              accreditation_number: brandingData.accreditation_number || profileData.accreditation_number || "",
              contact_email: brandingData.contact_email || profileData.contact_email || "",
              contact_phone: brandingData.contact_phone || profileData.contact_phone || "",
              address: brandingData.address || profileData.physical_address || ""
            };
          } else if (!profileData.branding) {
            profileData.branding = {
              logo_url: "",
              letterhead_url: "",
              admission_letterhead_url: "",
              acceptance_letterhead_url: "",
              signature_url: "",
              stamp_url: "",
              certificate_background_url: "",
              photo_album_header_url: "",
              official_name: profileData.name || "",
              accreditation_number: profileData.accreditation_number || "",
              contact_email: profileData.contact_email || "",
              contact_phone: profileData.contact_phone || "",
              address: profileData.physical_address || ""
            };
          }
          
          setProfile(profileData);
          setOriginalProfile(JSON.parse(JSON.stringify(profileData)));
          
          if (profileData.state) {
            fetchDependentLgas(profileData.state);
          }
        }
        setLoadingProfile(false);

        // Fetch operational stats
        try {
          const statsRes = await authFetch("/api/tsps/stats");
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData);
          }
        } catch (errStats) {
          console.error("TSP Stats load failed:", errStats);
        } finally {
          setLoadingStats(false);
        }
      } catch (e: any) {
        console.error("Error fetching metadata databases:", e);
        setNotification({ type: "error", message: "Failed to initialize TSP location tables." });
        setLoadingProfile(false);
        setLoadingStates(false);
        setLoadingStats(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch LGAs based on selected state using authFetch
  const fetchDependentLgas = async (stateName: string) => {
    if (!stateName) {
      setLgas([]);
      return;
    }
    setLoadingLgas(true);
    try {
      const res = await authFetch(`/api/reference/lgas/${encodeURIComponent(stateName)}`);
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

    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }

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

  // File Upload Helper
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string,
    isBrandingField: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      setNotification({ type: "error", message: "File is too large" });
      return;
    }

    const isImageMime = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type);
    const isPdfMime = file.type === "application/pdf";

    if (!isImageMime && !isPdfMime) {
      setNotification({ type: "error", message: "File type not supported" });
      return;
    }

    if (isBrandingField && isPdfMime) {
      const allowedPdfFields = ["letterhead_url", "admission_letterhead_url", "acceptance_letterhead_url", "certificate_background_url", "photo_album_header_url"];
      if (!allowedPdfFields.includes(field)) {
        setNotification({ type: "error", message: "File type not supported" });
        return;
      }
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Content = reader.result as string;
      try {
        setSaving(true);
        const endpoint = isBrandingField ? "/api/tsps/branding/upload" : "/api/tsps/profile/assets";
        const bodyPayload = isBrandingField ? {
          assetType: field,
          fileName: `${field}_${file.name.toLowerCase().replace(/[^a-z0-9.]/g, "_")}`,
          fileContent: base64Content,
          mimeType: file.type
        } : {
          fileContent: base64Content,
          fileName: `${field}_${file.name.toLowerCase().replace(/[^a-z0-9.]/g, "_")}`,
          folder: "tsp_uploads"
        };

        const res = await authFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });

        let data;
        try {
          data = await res.json();
        } catch (_) {}

        if (!res.ok) {
          throw new Error(data?.error || "Upload failed.");
        }
        
        const uploadedUrl = data.url || data.secureUrl;

        if (isBrandingField) {
          setProfile(prev => {
            if (!prev) return null;
            const branding = prev.branding || {
              logo_url: "",
              letterhead_url: "",
              admission_letterhead_url: "",
              acceptance_letterhead_url: "",
              signature_url: "",
              stamp_url: "",
              certificate_background_url: "",
              photo_album_header_url: "",
              official_name: prev.name,
              accreditation_number: prev.accreditation_number,
              contact_email: prev.contact_email,
              contact_phone: prev.contact_phone,
              address: prev.physical_address
            };
            return {
              ...prev,
              branding: {
                ...branding,
                [field]: uploadedUrl
              }
            };
          });
          setOriginalProfile(prev => {
            if (!prev) return null;
            const branding = prev.branding || {
              logo_url: "",
              letterhead_url: "",
              admission_letterhead_url: "",
              acceptance_letterhead_url: "",
              signature_url: "",
              stamp_url: "",
              certificate_background_url: "",
              photo_album_header_url: "",
              official_name: prev.name,
              accreditation_number: prev.accreditation_number,
              contact_email: prev.contact_email,
              contact_phone: prev.contact_phone,
              address: prev.physical_address
            };
            return {
              ...prev,
              branding: {
                ...branding,
                [field]: uploadedUrl
              }
            };
          });
        } else {
          setProfile(prev => {
            if (!prev) return null;
            return {
              ...prev,
              [field]: uploadedUrl
            };
          });
          setOriginalProfile(prev => {
            if (!prev) return null;
            return {
              ...prev,
              [field]: uploadedUrl
            };
          });
        }
        setNotification({ type: "success", message: "File uploaded successfully." });
      } catch (uploadErr: any) {
        console.error("Asset upload failure:", uploadErr);
        const errMsg = uploadErr.message || "Failed to upload document or branding asset.";
        setNotification({ type: "error", message: errMsg });
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeFileField = async (field: string, isBrandingField: boolean = false) => {
    if (isBrandingField) {
      if (!profile) return;
      const updatedBranding = {
        ...profile.branding,
        [field]: ""
      };
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          branding: updatedBranding
        };
      });
      try {
        setSaving(true);
        const res = await authFetch("/api/tsps/branding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedBranding)
        });
        if (!res.ok) {
          throw new Error("Failed to save branding change after removal.");
        }
        setOriginalProfile(prev => {
          if (!prev) return null;
          return {
            ...prev,
            branding: updatedBranding
          };
        });
        setNotification({ type: "success", message: "Asset removed successfully." });
      } catch (err: any) {
        console.error("Failed to persist asset removal:", err);
        setNotification({ type: "error", message: err.message || "Failed to save removal to backend." });
      } finally {
        setSaving(false);
      }
    } else {
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          [field]: ""
        };
      });
    }
  };

  // Inline validation
  const validateForm = (): boolean => {
    if (!profile) return false;
    const newErrors: { [key: string]: string } = {};

    if (!profile.name?.trim()) newErrors.name = "Organization Name is required.";
    if (!profile.contact_person?.trim()) newErrors.contact_person = "Primary Contact Person is required.";
    if (!profile.programme_manager?.trim()) newErrors.programme_manager = "Training Programme Manager is required.";
    if (!profile.registration_number?.trim()) newErrors.registration_number = "Registration details must be declared.";
    
    if (!profile.contact_email?.trim()) {
      newErrors.contact_email = "Contact email is required.";
    } else if (!/\S+@\S+\.\S+/.test(profile.contact_email)) {
      newErrors.contact_email = "Provide a valid email address.";
    }

    if (!profile.contact_phone?.trim()) newErrors.contact_phone = "Contact phone number is required.";
    if (!profile.state) newErrors.state = "Select training provider's state.";
    if (!profile.lga) newErrors.lga = "Select local government area (LGA).";
    if (!profile.physical_address?.trim()) newErrors.physical_address = "Detailed physical address is required.";

    if (profile.latitude !== null && profile.latitude !== undefined && profile.latitude !== 0) {
      const lat = Number(profile.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = "Latitude must be between -90 and 90.";
      }
    }
    if (profile.longitude !== null && profile.longitude !== undefined && profile.longitude !== 0) {
      const lng = Number(profile.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = "Longitude must be between -180 and 180.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save changes using authFetch
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
      const res = await authFetch("/api/tsps/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });
      
      const resData = await res.json();
      if (res.ok) {
        setOriginalProfile(JSON.parse(JSON.stringify(profile)));
        if (resData.pendingApproval) {
          setNotification({ type: "success", message: resData.message });
        } else {
          setNotification({ type: "success", message: "Organization Profile saved and synced with TVET reference servers successfully." });
        }
        
        // Refresh profile data using authFetch to pull changes
        const verifyRes = await authFetch("/api/tsps/profile");
        if (verifyRes.ok) {
          const freshData = await verifyRes.json();
          if (!freshData.branding) {
            freshData.branding = {
              logo_url: "",
              letterhead_url: "",
              admission_letterhead_url: "",
              acceptance_letterhead_url: "",
              signature_url: "",
              stamp_url: "",
              certificate_background_url: "",
              photo_album_header_url: "",
              official_name: freshData.name || "",
              accreditation_number: freshData.accreditation_number || "",
              contact_email: freshData.contact_email || "",
              contact_phone: freshData.contact_phone || "",
              address: freshData.physical_address || ""
            };
          }
          setProfile(freshData);
          setOriginalProfile(JSON.parse(JSON.stringify(freshData)));
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
        setProfile(JSON.parse(JSON.stringify(originalProfile)));
        setErrors({});
        setNotification(null);
        if (originalProfile.state) {
          fetchDependentLgas(originalProfile.state);
        }
      }
    }
  };

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight text-slate-900 flex items-center gap-3 text-left">
            <Building2 className="w-6 h-6 text-indigo-600" />
            My Organization
          </h2>
          <p className="text-xs text-slate-500 mt-1 md:mt-0 text-left">
            Manage your organization details, official branding files, certificates, training settings, and location records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Discard Edits
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

      {/* Pending Approval Banner */}
      {profile.pending_change && (
        <div id="pending-change-banner" className="no-print p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 flex items-start gap-3 text-left transition relative">
          <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Awaiting Federal Administrative Approval</p>
            <p className="text-xs mt-1 leading-relaxed">
              You submitted a profile update request on <strong>{new Date(profile.pending_change.requested_at).toLocaleString()}</strong> which is currently pending review. 
              Once reviewed and approved by the Federal regulator, your public profile will become the active source of truth.
            </p>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-left transition ${
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
              {notification.type === "success" ? "Changes Applied" : "Failed to Submit"}
            </p>
            <p className="text-xs mt-1 text-inherit">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Bento Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="tsp-stats-panel">
          {/* Registered Trainees Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-white p-4 md:p-5 rounded-2xl border border-indigo-100 hover:border-indigo-300 hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex items-start justify-between text-left group">
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-700 font-bold tracking-wider uppercase block">Registered Trainees</span>
              <span className="text-3xl font-black text-indigo-950 block">{stats.beneficiaryCount || 0}</span>
            </div>
            <div className="p-2.5 bg-indigo-100/80 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Eligible Trainees Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-white p-4 md:p-5 rounded-2xl border border-emerald-100 hover:border-emerald-300 hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex items-start justify-between text-left group">
            <div className="space-y-1">
              <span className="text-[10px] text-emerald-700 font-bold tracking-wider uppercase block">Eligible Trainees</span>
              <span className="text-3xl font-black text-emerald-950 block">{stats.eligibleBeneficiaryCount || 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-100/80 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              <Award className="w-5 h-5" />
            </div>
          </div>

          {/* Active Letters Card */}
          <div className="bg-gradient-to-br from-sky-50 to-white p-4 md:p-5 rounded-2xl border border-sky-100 hover:border-sky-300 hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex items-start justify-between text-left group">
            <div className="space-y-1">
              <span className="text-[10px] text-sky-700 font-bold tracking-wider uppercase block">Active Letters</span>
              <span className="text-3xl font-black text-sky-950 block">{stats.offerLetterCount || 0}</span>
            </div>
            <div className="p-2.5 bg-sky-100/80 text-sky-600 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          {/* Acceptance Forms Card */}
          <div className="bg-gradient-to-br from-violet-50 to-white p-4 md:p-5 rounded-2xl border border-violet-100 hover:border-violet-300 hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex items-start justify-between text-left group">
            <div className="space-y-1">
              <span className="text-[10px] text-violet-700 font-bold tracking-wider uppercase block">Acceptance Forms</span>
              <span className="text-3xl font-black text-violet-950 block">{stats.acceptanceCount || 0}</span>
            </div>
            <div className="p-2.5 bg-violet-100/80 text-violet-600 rounded-xl group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-4 no-print">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === "profile" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Profile & Location
        </button>
        <button
          onClick={() => setActiveTab("branding")}
          className={`pb-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === "branding" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Branding Assets
        </button>
        <button
          onClick={() => setActiveTab("accreditation")}
          className={`pb-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === "accreditation" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Accreditation & Documents
        </button>
        <button
          onClick={() => setActiveTab("training")}
          className={`pb-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === "training" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Training & Report Settings
        </button>
      </div>

      <div className="mt-4">
        {/* TAB 1: Profile & Location */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Organization Information</h3>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={profile.name}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Provider Code</label>
                  <input
                    type="text"
                    value={profile.code}
                    disabled
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-slate-50 text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Contact Person *</label>
                  <input
                    type="text"
                    name="contact_person"
                    value={profile.contact_person}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {errors.contact_person && <p className="text-[10px] text-rose-500 mt-0.5">{errors.contact_person}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Programme Manager *</label>
                  <input
                    type="text"
                    name="programme_manager"
                    value={profile.programme_manager}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {errors.programme_manager && <p className="text-[10px] text-rose-500 mt-0.5">{errors.programme_manager}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={profile.contact_email}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {errors.contact_email && <p className="text-[10px] text-rose-500 mt-0.5">{errors.contact_email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Phone Number *</label>
                  <input
                    type="text"
                    name="contact_phone"
                    value={profile.contact_phone}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {errors.contact_phone && <p className="text-[10px] text-rose-500 mt-0.5">{errors.contact_phone}</p>}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Training Location</h3>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State Location *</label>
                  <select
                    name="state"
                    value={profile.state}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Select State --</option>
                    {states.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  {errors.state && <p className="text-[10px] text-rose-500 mt-0.5">{errors.state}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Local Government Area *</label>
                  <select
                    name="lga"
                    value={profile.lga}
                    onChange={handleInputChange}
                    disabled={!profile.state || loadingLgas}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{profile.state ? "-- Choose LGA --" : "Select state first"}</option>
                    {lgas.map(l => (
                      <option key={l.name} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                  {errors.lga && <p className="text-[10px] text-rose-500 mt-0.5">{errors.lga}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={profile.latitude || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. 12.0022"
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={profile.longitude || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. 8.5920"
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Physical Address *</label>
                  <textarea
                    name="physical_address"
                    rows={4}
                    value={profile.physical_address}
                    onChange={handleInputChange}
                    placeholder="Provide full address including landmarks, street name, and ward info..."
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {errors.physical_address && <p className="text-[10px] text-rose-500 mt-0.5">{errors.physical_address}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Accreditation & Documents */}
        {activeTab === "accreditation" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Award className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Accreditation Records</h3>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Number *</label>
                  <input
                    type="text"
                    name="registration_number"
                    value={profile.registration_number}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                  />
                  {errors.registration_number && <p className="text-[10px] text-rose-500 mt-0.5">{errors.registration_number}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Accreditation Code</label>
                  <input
                    type="text"
                    name="accreditation_number"
                    value={profile.accreditation_number}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Accreditation Status</label>
                  <select
                    name="accreditation_status"
                    value={profile.accreditation_status}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Accreditation Expiry Date</label>
                  <input
                    type="date"
                    name="accreditation_expiry"
                    value={profile.accreditation_expiry}
                    onChange={handleInputChange}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Sector Scope</label>
                    <input
                      type="text"
                      name="sector"
                      value={profile.sector || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. Information Technology"
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Skill Area Scope</label>
                    <input
                      type="text"
                      name="skill_area"
                      value={profile.skill_area || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. Mobile Repairs"
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Uploads & Certificates</h3>
              </div>
              <div className="space-y-4 text-left">
                {/* CAC File Slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CAC Incorporation Certificate</label>
                  <div className="flex items-center gap-2">
                    {profile.cac_certificate_url ? (
                      <div className="flex items-center justify-between w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-800 font-mono truncate flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          File uploaded successfully
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.cac_certificate_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                          <button type="button" onClick={() => removeFileField("cac_certificate_url")} className="text-xs text-red-600 hover:text-red-800">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <div className="flex flex-col items-center justify-center py-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <p className="text-[10px] text-slate-500">Upload PDF / Image (Max 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "cac_certificate_url")} />
                      </label>
                    )}
                  </div>
                </div>

                {/* NBTE File Slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NBTE Accreditation Letter</label>
                  <div className="flex items-center gap-2">
                    {profile.nbte_accreditation_url ? (
                      <div className="flex items-center justify-between w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-800 font-mono truncate flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          File uploaded successfully
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.nbte_accreditation_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                          <button type="button" onClick={() => removeFileField("nbte_accreditation_url")} className="text-xs text-red-600 hover:text-red-800">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <div className="flex flex-col items-center justify-center py-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <p className="text-[10px] text-slate-500">Upload PDF / Image (Max 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "nbte_accreditation_url")} />
                      </label>
                    )}
                  </div>
                </div>

                {/* EOI Document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expression of Interest (EOI) Document</label>
                  <div className="flex items-center gap-2">
                    {profile.eoi_documents_url ? (
                      <div className="flex items-center justify-between w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-800 font-mono truncate flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          File uploaded successfully
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.eoi_documents_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                          <button type="button" onClick={() => removeFileField("eoi_documents_url")} className="text-xs text-red-600 hover:text-red-800">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <div className="flex flex-col items-center justify-center py-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <p className="text-[10px] text-slate-500">Upload PDF / Image (Max 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "eoi_documents_url")} />
                      </label>
                    )}
                  </div>
                </div>

                {/* MOU Document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Signed Memorandum of Understanding (MOU)</label>
                  <div className="flex items-center gap-2">
                    {profile.mou_documents_url ? (
                      <div className="flex items-center justify-between w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-800 font-mono truncate flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          File uploaded successfully
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.mou_documents_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                          <button type="button" onClick={() => removeFileField("mou_documents_url")} className="text-xs text-red-600 hover:text-red-800">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <div className="flex flex-col items-center justify-center py-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <p className="text-[10px] text-slate-500">Upload PDF / Image (Max 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "mou_documents_url")} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Tax Compliance Document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Clearance Certificate</label>
                  <div className="flex items-center gap-2">
                    {profile.tax_compliance_url ? (
                      <div className="flex items-center justify-between w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-800 font-mono truncate flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          File uploaded successfully
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.tax_compliance_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                          <button type="button" onClick={() => removeFileField("tax_compliance_url")} className="text-xs text-red-600 hover:text-red-800">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <div className="flex flex-col items-center justify-center py-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <p className="text-[10px] text-slate-500">Upload PDF / Image (Max 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "tax_compliance_url")} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Branding Assets */}
        {activeTab === "branding" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Logo & Stamp Branding</h3>
              </div>
              <div className="space-y-4 text-left">
                {/* Logo Upload Slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Logo</label>
                  {profile.branding?.logo_url ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <img src={profile.branding.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg bg-white p-1 border border-slate-150" referrerPolicy="no-referrer" />
                      <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Logo image
                        </span>
                        <button type="button" onClick={() => removeFileField("logo_url", true)} className="text-[10px] text-red-600 hover:text-red-800 text-left w-fit flex items-center gap-1.5 font-medium">
                          <Trash2 className="w-3 h-3" /> Remove image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500">Upload logo image (PNG/JPG, Max 5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "logo_url", true)} />
                    </label>
                  )}
                </div>

                {/* Stamp Upload Slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Stamp</label>
                  {profile.branding?.stamp_url ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <img src={profile.branding.stamp_url} alt="Stamp" className="w-16 h-16 object-contain rounded-lg bg-white p-1 border border-slate-150" referrerPolicy="no-referrer" />
                      <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Stamp image
                        </span>
                        <button type="button" onClick={() => removeFileField("stamp_url", true)} className="text-[10px] text-red-600 hover:text-red-800 text-left w-fit flex items-center gap-1.5 font-medium">
                          <Trash2 className="w-3 h-3" /> Remove image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500">Upload Stamp image (PNG, transparent pref, Max 5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "stamp_url", true)} />
                    </label>
                  )}
                </div>

                {/* Signature Upload Slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Authorized Signature</label>
                  {profile.branding?.signature_url ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <img src={profile.branding.signature_url} alt="Signature" className="w-24 h-12 object-contain rounded-lg bg-white p-1 border border-slate-150" referrerPolicy="no-referrer" />
                      <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Signature image
                        </span>
                        <button type="button" onClick={() => removeFileField("signature_url", true)} className="text-[10px] text-red-600 hover:text-red-800 text-left w-fit flex items-center gap-1.5 font-medium">
                          <Trash2 className="w-3 h-3" /> Remove image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500">Upload Signature image (Max 5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "signature_url", true)} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Document Letterheads</h3>
              </div>
              <div className="space-y-4 text-left">
                {/* General Letterhead */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">General Letterhead Template</label>
                  {profile.branding?.letterhead_url ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="w-16 h-16 bg-indigo-50 border rounded-lg flex items-center justify-center">
                        <FileText className="w-8 h-8 text-indigo-400" />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active General Letterhead
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.branding.letterhead_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View File</a>
                          <button type="button" onClick={() => removeFileField("letterhead_url", true)} className="text-[10px] text-red-600 hover:text-red-800 font-medium">Remove</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500">Upload General Letterhead (A4 format, Max 5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "letterhead_url", true)} />
                    </label>
                  )}
                </div>

                {/* Admission Letterhead */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Letterhead Template</label>
                  {profile.branding?.admission_letterhead_url ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="w-16 h-16 bg-indigo-50 border rounded-lg flex items-center justify-center">
                        <FileText className="w-8 h-8 text-indigo-400" />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Admission Letterhead
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.branding.admission_letterhead_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View File</a>
                          <button type="button" onClick={() => removeFileField("admission_letterhead_url", true)} className="text-[10px] text-red-600 hover:text-red-800 font-medium">Remove</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500">Upload Admission Letterhead (A4 format, Max 5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "admission_letterhead_url", true)} />
                    </label>
                  )}
                </div>

                {/* Acceptance Letterhead */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Acceptance Form Letterhead Template</label>
                  {profile.branding?.acceptance_letterhead_url ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="w-16 h-16 bg-indigo-50 border rounded-lg flex items-center justify-center">
                        <FileText className="w-8 h-8 text-indigo-400" />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Acceptance Letterhead
                        </span>
                        <div className="flex gap-2">
                          <a href={profile.branding.acceptance_letterhead_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View File</a>
                          <button type="button" onClick={() => removeFileField("acceptance_letterhead_url", true)} className="text-[10px] text-red-600 hover:text-red-800 font-medium">Remove</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500">Upload Acceptance Letterhead (A4 format, Max 5MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "acceptance_letterhead_url", true)} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Training & Report Settings */}
        {activeTab === "training" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calendar className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Training Session & Venue Settings</h3>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Training Venue Address</label>
                  <input
                    type="text"
                    name="training_venue"
                    value={profile.training_venue || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. Government Technical College Hall, Gwale, Kano"
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Training Commencement Date</label>
                    <input
                      type="text"
                      name="training_start_date"
                      value={profile.training_start_date || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. October 12, 2026"
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Training Conclusion Date</label>
                    <input
                      type="text"
                      name="training_end_date"
                      value={profile.training_end_date || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. December 18, 2026"
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Min Attendance Threshold (%)</label>
                    <input
                      type="number"
                      name="attendance_threshold"
                      value={profile.attendance_threshold !== undefined ? profile.attendance_threshold : 80}
                      onChange={handleInputChange}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Min Assessment Score (%)</label>
                    <input
                      type="number"
                      name="completion_threshold"
                      value={profile.completion_threshold !== undefined ? profile.completion_threshold : 75}
                      onChange={handleInputChange}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xs transition space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Settings className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Annex 9 & Reporting Settings</h3>
              </div>
              <div className="space-y-4 text-left">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3.5 flex gap-2.5 items-start">
                  <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900">Annex 9 Operational Settings</h4>
                    <p className="text-[10px] text-indigo-700 mt-1 leading-relaxed">
                      These parameters define the headers, thresholds, and identity descriptors used when exporting the Annex 9 Attendance records to Microsoft Excel. All values are automatically pulled into reporting modules.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Watermark or Annex 9 Sub-Header Text</label>
                  <input
                    type="text"
                    value={`${profile.name || ""} - ${profile.code || ""}`}
                    disabled
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-slate-50 text-slate-400 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Audit trail */}
      {profile.change_history && profile.change_history.length > 0 && (
        <div id="profile-history-audit-center" className="bg-white p-6 rounded-xl border border-slate-200 mt-8 text-left">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Info className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Update History
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
                  <th className="py-2.5">Comment</th>
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
