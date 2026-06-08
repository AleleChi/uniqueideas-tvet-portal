/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, Image as ImageIcon, Sliders, ShieldCheck, LogOut, 
  Settings, FolderLock, Landmark, Cpu, Smartphone, LayoutDashboard, History, Check, Menu, X, FileCheck, UserCheck, Award, FileText
} from "lucide-react";
import { AdminLogin } from "./components/AdminLogin";
import { TraineePortal } from "./components/TraineePortal";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { BeneficiaryList } from "./components/BeneficiaryList";
import { CustomSchemaBuilder } from "./components/CustomSchemaBuilder";
import { BiometricCapture } from "./components/BiometricCapture";
import { PublicResponsePortal } from "./components/PublicResponsePortal";
import { DocumentVerification } from "./components/DocumentVerification";
import { SecureDocumentPortal } from "./components/SecureDocumentPortal";
import { CertificateVerification } from "./components/CertificateVerification";
import { SkeletonLoader } from "./components/SkeletonLoader";

const ReportsWorkspace = React.lazy(() => import("./components/ReportsWorkspace").then(module => ({ default: module.ReportsWorkspace })));
const AuditTrail = React.lazy(() => import("./components/AuditTrail").then(module => ({ default: module.AuditTrail })));
const SettingsWorkspace = React.lazy(() => import("./components/SettingsWorkspace").then(module => ({ default: module.SettingsWorkspace })));
const EligibilityCenter = React.lazy(() => import("./components/EligibilityCenter").then(module => ({ default: module.EligibilityCenter })));
const CertificationCenter = React.lazy(() => import("./components/CertificationCenter").then(module => ({ default: module.CertificationCenter })));
const TraineeOperationsView = React.lazy(() => import("./components/TraineeOperations").then(module => ({ default: module.TraineeOperationsView })));
const ToolkitsAssetsCenter = React.lazy(() => import("./components/ToolkitsAssetsCenter").then(module => ({ default: module.ToolkitsAssetsCenter })));
import { TrainingOutcomes } from "./components/TrainingOutcomes";
import ImpactEvidence from "./components/ImpactEvidence";
import { ExecutiveMAndECenter } from "./components/ExecutiveMAndECenter";
import { QualityAccreditationCenter } from "./components/QualityAccreditationCenter";
import { FinancialsRoiCenter } from "./components/FinancialsRoiCenter";
import { Beneficiary, CustomField, AuditLog, UserSession } from "./types";
import { authFetch, downloadWithAuth } from "./utils/authFetch";
import { useNotification } from "./components/NotificationContext";
import { API_BASE_URL, isVercelMissingApi, getEnvironmentType } from "./config/api";
import { Sidebar } from "./components/Sidebar";

const CACHE_VERSION = "ideas-cache-v3";

export default function App() {
  const { showToast } = useNotification();
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const cached = localStorage.getItem("ideas-session");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<"dashboard" | "registry" | "album" | "custom" | "audits" | "settings" | "eligibility" | "trainee-operations" | "certification" | "outcomes" | "evidence" | "toolkits" | "executive-m-and-e" | "quality-accreditation">("dashboard");
  const [admissionsSubTab, setAdmissionsSubTab] = useState<"dashboard" | "letters" | "forms" | "acceptance" | "dispatches">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [registryViewMode, setRegistryViewMode] = useState<"list" | "details" | "create">("list");
  const [subTabMode, setSubTabMode] = useState<"beneficiaries" | "admissions" | "documents">("beneficiaries");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(() => {
    try {
      const cached = localStorage.getItem(`${CACHE_VERSION}-beneficiaries`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    try {
      const cached = localStorage.getItem(`${CACHE_VERSION}-custom-fields`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const cached = localStorage.getItem(`${CACHE_VERSION}-audit-logs`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLiveSynced, setIsLiveSynced] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<Beneficiary | null>(null);
  const [tempCreatedPhoto, setTempCreatedPhoto] = useState<string | null>(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [secureVerifyToken, setSecureVerifyToken] = useState<string | null>(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith("/documents/verify/")) {
      return pathname.substring("/documents/verify/".length);
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("dispatchToken") || params.get("secureToken") || null;
  });

  // Synchronous route parsing and navigation guards
  const [currentHash, setCurrentHash] = useState<string>(() => {
    if (!window.location.hash) {
      window.location.hash = "#/landing";
    }
    return window.location.hash;
  });

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || "#/landing");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    const normalized = currentHash.replace("#", "");
    const isAuthenticated = !!session?.isAuthenticated;

    if (normalized === "/dashboard" || normalized === "dashboard") {
      if (!isAuthenticated) {
        window.location.hash = "#/login";
      } else if (session?.role === "TRAINEE") {
        window.location.hash = "#/trainee";
      }
    } else if (normalized === "/trainee" || normalized === "trainee") {
      if (!isAuthenticated) {
        window.location.hash = "#/login";
      } else if (session?.role !== "TRAINEE") {
        window.location.hash = "#/dashboard";
      }
    } else if (normalized === "/login" || normalized === "login") {
      if (isAuthenticated) {
        if (session?.role === "TRAINEE") {
          window.location.hash = "#/trainee";
        } else {
          window.location.hash = "#/dashboard";
        }
      }
    }
  }, [currentHash, session]);

  // Log every completed render cycle for forensics
  useEffect(() => {
    console.log("[RENDER COMPLETED] Dashboard viewport successfully mounted and redrawn.");
  });

  // Startup diagnostics once on application boot (STEP 5 & 6) and Cache Versioning (Phase 7)
  useEffect(() => {
    const env = "production";
    const envType = getEnvironmentType();
    
    console.log(`[SYS] IDEAS-TVET Startup Diagnostics\n\nEnvironment:\n${env}\n\nEnvironment Type:\n${envType}\n\nAPI Base:\n${API_BASE_URL || "(relative)"}`);

    if (isVercelMissingApi) {
      console.error(`[SYS] ERROR:\nMissing VITE_API_BASE_URL`);
    }

    try {
      // Clean up stale caches from previous versions or unversioned caches
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("ideas-") || key.includes("cached")) &&
          !key.startsWith(CACHE_VERSION) &&
          key !== "ideas-session"
        ) {
          keysToClear.push(key);
        }
      }
      keysToClear.forEach(key => {
        console.log(`[CACHE CLEANUP] Evicting stale cache structure: "${key}"`);
        localStorage.removeItem(key);
      });
    } catch (e) {
      console.error("[CACHE CLEANUP] Failed to evict stale cache structures:", e);
    }

    // Verify backend reachability on boot
    const healthUrl = `${API_BASE_URL}/api/health`;
    fetch(healthUrl)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log(`\nBackend Reachability:\nONLINE`);
        console.log(`[SYS] Backend API database status:`, data.database);
      })
      .catch(err => {
        console.log(`\nBackend Reachability:\nOFFLINE`);
        console.error(`[SYS] Backend Reachability Check FAILED: Unreachable at ${healthUrl}:`, err.message || err);
      });
  }, []);

  // Load active memory caches from browser on launch
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      setPortalToken(token);
    }
  }, []);

  // Listen to 401 / 403 security context events to prevent silent failures
  useEffect(() => {
    const handleUnauthorized = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.warn("[SECURITY REJECTION] Unauthorized event received:", detail);
      showToast("Your session has expired. Please log in again.", "error");
      handleLogout();
    };

    const handleForbidden = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.warn("[SECURITY REJECTION] Forbidden event received:", detail);
      showToast("Access denied. You do not have permission to view this resource.", "error");
    };

    window.addEventListener("ideas-auth-unauthorized", handleUnauthorized);
    window.addEventListener("ideas-auth-forbidden", handleForbidden);

    return () => {
      window.removeEventListener("ideas-auth-unauthorized", handleUnauthorized);
      window.removeEventListener("ideas-auth-forbidden", handleForbidden);
    };
  }, []);

  // Fetch dynamic variables on API once authenticated & handle continuous polling if not live-synced
  useEffect(() => {
    let intervalId: any = null;

    if (session?.isAuthenticated) {
      fetchBeneficiaries();
      fetchCustomFields();
      fetchAuditLogs();

      // If we are NOT live-synced, keep polling every 10 seconds to retry
      if (!isLiveSynced) {
        console.log("No live sync yet. Establishing background poll to sync local states...");
        intervalId = setInterval(() => {
          if (isLiveSynced) {
            console.log("Live sync detected. Cleaning up active polling interval immediately.");
            clearInterval(intervalId);
            return;
          }
          console.log("Polling gateway for live active synchronization check...");
          fetchBeneficiaries();
          fetchCustomFields();
          fetchAuditLogs();
        }, 10000);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, isLiveSynced]);

  const fetchBeneficiaries = async () => {
    try {
      const res = await authFetch("/api/beneficiaries");
      if (res.ok) {
        const data = await res.json();
        // Set live sync immediately! Disables future polling cycles.
        setIsLiveSynced(true);
        console.log(`[STATE UPDATED] endpoint: "/api/beneficiaries", record count: ${Array.isArray(data) ? data.length : 0}`);
        if (Array.isArray(data) && data.length > 0) {
          setBeneficiaries(data);
          localStorage.setItem(`${CACHE_VERSION}-beneficiaries`, JSON.stringify(data));
        } else if (Array.isArray(data)) {
          // Never replace live data with empty cache
          setBeneficiaries(prev => prev.length > 0 ? prev : data);
          localStorage.setItem(`${CACHE_VERSION}-beneficiaries`, JSON.stringify(data));
        }
      } else {
        console.error("Failed to load beneficiaries list: Status", res.status);
        if (!isLiveSynced) {
          const cachedStr = localStorage.getItem(`${CACHE_VERSION}-beneficiaries`);
          const cachedData = cachedStr ? JSON.parse(cachedStr) : [];
          console.warn(`[CACHE FALLBACK] endpoint: "/api/beneficiaries", cache count: ${cachedData.length}`);
          showToast("System is currently experiencing heavy load. Displaying cached session records.", "warning");
        }
      }
    } catch (e: any) {
      console.error("Failed to load beneficiaries due to network error:", e);
      if (!isLiveSynced) {
        const cachedStr = localStorage.getItem(`${CACHE_VERSION}-beneficiaries`);
        const cachedData = cachedStr ? JSON.parse(cachedStr) : [];
        console.warn(`[CACHE FALLBACK] endpoint: "/api/beneficiaries", cache count: ${cachedData.length}`);
        showToast("System error: Failed to connect to secure gateway. Relying on active local data session.", "warning");
      }
    }
  };

  const handleSelectBeneficiary = async (b: Beneficiary | null) => {
    if (!b) {
      setSelectedBeneficiary(null);
      return;
    }
    // Set lightweight selection immediately and transition screens with zero perceived lag
    setSelectedBeneficiary(b);
    try {
      const res = await authFetch(`/api/beneficiaries/${b.id}`);
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedBeneficiary(fullDetail);
      }
    } catch (e) {
      console.error("Failed to fetch full beneficiary details, falling back to lightweight:", e);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const res = await authFetch("/api/custom-fields");
      if (res.ok) {
        const data = await res.json();
        console.log(`[STATE UPDATED] endpoint: "/api/custom-fields", record count: ${Array.isArray(data) ? data.length : 0}`);
        if (Array.isArray(data) && data.length > 0) {
          setCustomFields(data);
          localStorage.setItem(`${CACHE_VERSION}-custom-fields`, JSON.stringify(data));
        } else if (Array.isArray(data)) {
          setCustomFields(prev => prev.length > 0 ? prev : data);
        }
      }
    } catch (e) {
      console.error(e);
      const cachedStr = localStorage.getItem(`${CACHE_VERSION}-custom-fields`);
      const cachedData = cachedStr ? JSON.parse(cachedStr) : [];
      console.warn(`[CACHE FALLBACK] endpoint: "/api/custom-fields", cache count: ${cachedData.length}`);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await authFetch("/api/audit-logs");
      if (res.ok) {
        const data = await res.json();
        console.log(`[STATE UPDATED] endpoint: "/api/audit-logs", record count: ${Array.isArray(data) ? data.length : 0}`);
        if (Array.isArray(data) && data.length > 0) {
          setAuditLogs(data);
          localStorage.setItem(`${CACHE_VERSION}-audit-logs`, JSON.stringify(data));
        } else if (Array.isArray(data)) {
          setAuditLogs(prev => prev.length > 0 ? prev : data);
        }
      }
    } catch (e) {
      console.error(e);
      const cachedStr = localStorage.getItem(`${CACHE_VERSION}-audit-logs`);
      const cachedData = cachedStr ? JSON.parse(cachedStr) : [];
      console.warn(`[CACHE FALLBACK] endpoint: "/api/audit-logs", cache count: ${cachedData.length}`);
    }
  };

  const handleLogin = async (email: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    try {
      // 1. Verify backend health first (gracefully handles cold starts on Render!)
      const healthUrl = `${API_BASE_URL}/api/health`;
      let healthOk = false;
      let retries = 0;
      
      while (retries < 3 && !healthOk) {
        try {
          const hRes = await fetch(healthUrl);
          if (hRes.ok) {
            healthOk = true;
            break;
          }
        } catch (hErr) {
          console.warn(`[COLD START RETRY] Health check attempt ${retries + 1} failed:`, hErr);
        }
        retries++;
        if (!healthOk && retries < 3) {
          await new Promise(r => setTimeout(r, 1500)); // Sleep before retry
        }
      }

      if (!healthOk) {
        return { success: false, message: "Backend unreachable. The server is offline or starting from a cold state. Please retry in a moment." };
      }

      // 2. Perform the actual auth request
      let res;
      try {
        res = await authFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });
      } catch (err) {
        console.warn("[LOGIN RETRY] Attempting single retry after potential network/cold state error...");
        await new Promise(r => setTimeout(r, 1500));
        res = await authFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });
      }

      if (res && res.ok) {
        const sData: UserSession = await res.json();
        localStorage.setItem("ideas-session", JSON.stringify(sData));
        setSession(sData);
        if (sData.role === "TRAINEE") {
          window.location.hash = "#/trainee";
        } else {
          window.location.hash = "#/dashboard";
        }
        return { success: true };
      } else {
        const errorData = res ? await res.json().catch(() => ({})) : {};
        const msg = errorData.error || "Invalid credentials. Please verify your username and password.";
        return { success: false, message: msg };
      }
    } catch (e: any) {
      console.error("[LOGIN CAUGHT EXCEPTION]", e);
      return { success: false, message: "Backend unreachable. Network configuration is offline." };
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Cookie clearing network exception:", e);
    }
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setSession(null);
    setBeneficiaries([]);
    setCustomFields([]);
    setAuditLogs([]);
    window.location.hash = "#/landing";
  };

  const handleAddBeneficiary = async (data: any) => {
    try {
      const res = await authFetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          photo: tempCreatedPhoto || data.photo
        })
      });
      if (res.ok) {
        setTempCreatedPhoto(null);
        await fetchBeneficiaries();
        await fetchAuditLogs();
        showToast("Beneficiary created successfully", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create beneficiary", "error");
      }
    } catch (e: any) {
      console.error(e);
      showToast("Network error: Failed to create beneficiary profile.", "error");
    }
  };

  const handleUpdateBeneficiary = async (id: string, data: Partial<Beneficiary>) => {
    try {
      const res = await authFetch(`/api/beneficiaries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        await fetchBeneficiaries();
        await fetchAuditLogs();
        showToast("Beneficiary updated successfully", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update beneficiary", "error");
      }
    } catch (e: any) {
      console.error(e);
      showToast("Network error: Failed to update beneficiary profile.", "error");
    }
  };

  const handleDeleteBeneficiary = async (id: string) => {
    try {
      const res = await authFetch(`/api/beneficiaries/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSelectedBeneficiary(null);
        setRegistryViewMode("list");
        await fetchBeneficiaries();
        await fetchAuditLogs();
        showToast("Beneficiary deleted successfully", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete beneficiary profile", "error");
      }
    } catch (e: any) {
      console.error(e);
      showToast("Network error: Failed to delete beneficiary profile.", "error");
    }
  };

  const handleAddCustomField = async (field: any) => {
    try {
      const res = await authFetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field)
      });
      if (res.ok) {
        await fetchCustomFields();
        await fetchAuditLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveCustomField = async (id: string) => {
    try {
      const res = await authFetch(`/api/custom-fields/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await fetchCustomFields();
        await fetchAuditLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      await downloadWithAuth("/api/export/csv", "ideas_tvet_beneficiaries_export.csv");
      setTimeout(() => {
        fetchAuditLogs(); // Grab log stating Excel CSV export was downloaded
      }, 1500);
    } catch (e) {
      console.error("CSV download error:", e);
    }
  };

  const handlePhotoCaptured = async (base64Photo: string) => {
    if (captureTarget) {
      if (captureTarget.id === "TEMP" || registryViewMode === "create") {
        setTempCreatedPhoto(base64Photo);
      } else {
        await handleUpdateBeneficiary(captureTarget.id, { photo: base64Photo });
      }
      setCaptureTarget(null);
    }
  };

  // Block rendering on Vercel if VITE_API_BASE_URL is missing to prevent sending logic/API calls to itself
  if (isVercelMissingApi) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased font-sans flex-col text-center">
        <div className="bg-slate-900 border border-rose-950/80 max-w-md w-full p-8 rounded-xl shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-red-500" />
          <div className="mx-auto h-16 w-16 bg-red-650/10 text-red-500 rounded-full flex items-center justify-center shadow-lg border border-red-500/20">
            <X className="w-8 h-8" />
          </div>
          <div className="space-y-3 text-center">
            <h1 className="text-xl font-bold font-display text-slate-100 tracking-tight">Configuration Error</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Backend configuration missing. Contact administrator.
            </p>
          </div>
          <div className="border-t border-slate-950/60 pt-4 font-mono text-[9px] text-slate-500 select-all">
            Missing environment variable: VITE_API_BASE_URL
          </div>
        </div>
      </div>
    );
  }

  // Render Public Response Portal if a secure token is supplied, bypassing logins
  if (portalToken) {
    return (
      <PublicResponsePortal 
        token={portalToken} 
        onClose={() => setPortalToken(null)} 
      />
    );
  }

  // Render Secure Document Verification Portal if a secure verify token is supplied
  if (secureVerifyToken) {
    return (
      <SecureDocumentPortal 
        token={secureVerifyToken} 
        onClose={() => {
          setSecureVerifyToken(null);
          window.history.pushState({}, "", "/");
        }} 
      />
    );
  }

  const normalizedHash = currentHash || "#/";
  const isAuthenticated = !!session?.isAuthenticated;

  // Determine core route template to render
  if (normalizedHash.startsWith("#/verify/certificate") || normalizedHash.includes("verify/certificate") || normalizedHash.includes("verify-certificate")) {
    return <CertificateVerification />;
  }

  if (normalizedHash === "#/verify-document" || normalizedHash === "#verify-document" || normalizedHash.startsWith("#/verify-document") || normalizedHash.startsWith("#verify-document") || normalizedHash.includes("verify-document")) {
    return <DocumentVerification />;
  }

  if (normalizedHash === "#/login" || normalizedHash === "#login") {
    return (
      <AdminLogin 
        onLoginSuccess={handleLogin} 
        onBackToHome={() => { window.location.hash = "#/landing"; }} 
      />
    );
  }

  if (normalizedHash === "#/dashboard" || normalizedHash === "#dashboard") {
    if (!isAuthenticated) {
      // route guard will capture and redirect, but render a fallback
      return (
        <AdminLogin 
          onLoginSuccess={handleLogin} 
          onBackToHome={() => { window.location.hash = "#/landing"; }} 
        />
      );
    }
    // Proceed to rendering primary secure operator views downstairs
  } else if (normalizedHash === "#/trainee" || normalizedHash === "#trainee") {
    if (!isAuthenticated || session?.role !== "TRAINEE") {
      return (
        <AdminLogin 
          onLoginSuccess={handleLogin} 
          onBackToHome={() => { window.location.hash = "#/landing"; }} 
        />
      );
    }
    return <TraineePortal session={session} onLogout={handleLogout} />;
  } else {
    // Default fallback is ALWAYS the Landing Page
    return (
      <LandingPage 
        onLoginShow={() => { window.location.hash = "#/login"; }} 
        onLoginSuccess={handleLogin} 
      />
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col lg:flex-row font-sans antialiased text-slate-800 relative">
      
      {/* BACKGROUND BACKDROP OVERLAY ON MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden no-print animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* STICKY HEADER NAVIGATION BAR ON MOBILE/TABLET */}
      <header className="lg:hidden sticky top-0 z-35 bg-slate-900 text-white flex items-center justify-between px-4 py-3 border-b border-indigo-950 shadow-md no-print flex-shrink-0">
        <button 
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-1 text-slate-350 hover:text-white hover:bg-slate-800/40 rounded-lg flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded text-white-95 bg-indigo-600 rounded text-white text-xs font-bold leading-none">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold font-sans tracking-tight uppercase">IDEAS-TVET IMS</span>
        </div>
        <div className="w-11"></div> {/* Spacer for symmetry */}
      </header>

      {/* 1. LEFT SIDEBAR - FULL VIEWPORT HEIGHT */}
      <Sidebar
        activeTab={activeTab}
        subTabMode={subTabMode}
        admissionsSubTab={admissionsSubTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        setActiveTab={setActiveTab}
        setRegistryViewMode={setRegistryViewMode}
        setSubTabMode={setSubTabMode}
        setAdmissionsSubTab={setAdmissionsSubTab}
        setSelectedBeneficiary={setSelectedBeneficiary}
        setTempCreatedPhoto={setTempCreatedPhoto}
        session={session}
        handleLogout={handleLogout}
      />

      {/* 2. MAIN WORKSPACE CONTENT AREA - RIGHT ALIGNED */}
      <div className="flex-grow flex-1 flex flex-col h-full overflow-y-auto">
        
        {/* Navigation Indicator Line */}
        <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:justify-between flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 text-left">
              SECURE GOVERNMENT SYSTEM DATABASE PORTAL ACTIVE
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 text-left">
            Node: <span className="text-slate-600 font-semibold font-mono">IDEAS-COHORT-A5E8</span>
          </div>
        </header>

        {/* Content scroll block container */}
        <main className="flex-grow p-6 sm:p-8">
          
          {activeTab === "dashboard" && (
            <Dashboard 
              beneficiaries={beneficiaries} 
              onSelectBeneficiary={(id) => {
                const b = beneficiaries.find(x => x.id === id);
                if (b) {
                  handleSelectBeneficiary(b);
                  setRegistryViewMode("details");
                  setSubTabMode("beneficiaries");
                }
                setActiveTab("registry");
              }}
              onNavigateToRegistryCreate={() => {
                setActiveTab("registry");
                setRegistryViewMode("create");
                setSubTabMode("beneficiaries");
                setSelectedBeneficiary(null);
                setTempCreatedPhoto(null);
              }}
            />
          )}
          
          {activeTab === "registry" && (
            <BeneficiaryList 
              beneficiaries={beneficiaries}
              customFields={customFields}
              onAddBeneficiary={handleAddBeneficiary}
              onUpdateBeneficiary={handleUpdateBeneficiary}
              onTriggerBiometrics={(b) => setCaptureTarget(b)}
              onDownloadCSV={handleDownloadCSV}
              viewMode={registryViewMode}
              onViewModeChange={(v) => setRegistryViewMode(v)}
              tempCreatedPhoto={tempCreatedPhoto}
              onClearTempPhoto={() => setTempCreatedPhoto(null)}
              selectedBeneficiary={selectedBeneficiary}
              onSelectBeneficiary={handleSelectBeneficiary}
              onDeleteBeneficiary={handleDeleteBeneficiary}
              session={session}
              subTabMode={subTabMode}
              admissionsSubTab={admissionsSubTab}
              initialDetailsTab={
                subTabMode === "admissions" 
                  ? "admission" 
                  : subTabMode === "documents" 
                  ? "documents" 
                  : "overview"
              }
            />
          )}

          {activeTab === "album" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Reports..." />}>
              <ReportsWorkspace beneficiaries={beneficiaries} />
            </React.Suspense>
          )}

          {activeTab === "eligibility" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Eligibility & Compliance Center..." />}>
              <EligibilityCenter 
                beneficiaries={beneficiaries} 
                session={session} 
                onRefresh={fetchBeneficiaries} 
              />
            </React.Suspense>
          )}

          {activeTab === "outcomes" && (
            <TrainingOutcomes 
              session={session} 
              toast={showToast} 
            />
          )}

          {activeTab === "evidence" && (
            <ImpactEvidence 
              session={session} 
              showToast={showToast} 
            />
          )}

          {activeTab === "executive-m-and-e" && (
            <ExecutiveMAndECenter
              session={session}
              showToast={showToast}
              onRefreshRoot={fetchBeneficiaries}
            />
          )}

          {activeTab === "quality-accreditation" && (
            <QualityAccreditationCenter
              session={session}
              showToast={showToast}
              onRefreshRoot={fetchBeneficiaries}
            />
          )}

          {activeTab === "financials-roi" && (
            <FinancialsRoiCenter
              session={session}
              showToast={showToast}
              onRefreshRoot={fetchBeneficiaries}
            />
          )}

          {activeTab === "toolkits" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Toolkits & Assets Management..." />}>
              <ToolkitsAssetsCenter
                session={session}
                showToast={showToast}
              />
            </React.Suspense>
          )}

          {activeTab === "certification" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Certification Center..." />}>
              <CertificationCenter
                session={session}
                onRefreshRoot={fetchBeneficiaries}
              />
            </React.Suspense>
          )}

          {activeTab === "trainee-operations" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Trainee Operations Ecosystem..." />}>
              <TraineeOperationsView 
                session={session} 
                showToast={showToast} 
              />
            </React.Suspense>
          )}

          {activeTab === "custom" && (
            <CustomSchemaBuilder 
              fields={customFields}
              onAddField={handleAddCustomField}
              onRemoveField={handleRemoveCustomField}
            />
          )}

          {activeTab === "audits" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Audit Logs..." />}>
              <AuditTrail logs={auditLogs} />
            </React.Suspense>
          )}

          {activeTab === "settings" && (
            <React.Suspense fallback={<SkeletonLoader label="Loading Settings & Configurations..." />}>
              <SettingsWorkspace session={session} />
            </React.Suspense>
          )}

        </main>
      </div>

      {/* Biometrics Studio camera popup modal overlay */}
      {captureTarget && (
        <BiometricCapture 
          beneficiary={captureTarget}
          onPhotoCaptured={handlePhotoCaptured}
          onClose={() => setCaptureTarget(null)}
        />
      )}

    </div>
  );
}
