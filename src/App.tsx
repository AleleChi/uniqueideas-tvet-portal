/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, Image as ImageIcon, Sliders, ShieldCheck, LogOut, 
  Settings, FolderLock, Landmark, Cpu, Smartphone, LayoutDashboard, History, Check, Menu, X, FileCheck
} from "lucide-react";
import { AdminLogin } from "./components/AdminLogin";
import { TraineePortal } from "./components/TraineePortal";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { BeneficiaryList } from "./components/BeneficiaryList";
import { ReportsWorkspace } from "./components/ReportsWorkspace";
import { CustomSchemaBuilder } from "./components/CustomSchemaBuilder";
import { AuditTrail } from "./components/AuditTrail";
import { BiometricCapture } from "./components/BiometricCapture";
import { PublicResponsePortal } from "./components/PublicResponsePortal";
import { SettingsWorkspace } from "./components/SettingsWorkspace";
import { DocumentVerification } from "./components/DocumentVerification";
import { Beneficiary, CustomField, AuditLog, UserSession } from "./types";
import { authFetch, downloadWithAuth } from "./utils/authFetch";
import { useNotification } from "./components/NotificationContext";

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
  const [activeTab, setActiveTab] = useState<"dashboard" | "registry" | "album" | "custom" | "audits" | "settings">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [registryViewMode, setRegistryViewMode] = useState<"list" | "details" | "create">("list");
  const [subTabMode, setSubTabMode] = useState<"beneficiaries" | "admissions" | "documents">("beneficiaries");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [captureTarget, setCaptureTarget] = useState<Beneficiary | null>(null);
  const [tempCreatedPhoto, setTempCreatedPhoto] = useState<string | null>(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [portalToken, setPortalToken] = useState<string | null>(null);

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

  // Load active memory caches from browser on launch
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      setPortalToken(token);
    }
  }, []);

  // Fetch dynamic variables on API once authenticated
  useEffect(() => {
    if (session?.isAuthenticated) {
      fetchBeneficiaries();
      fetchCustomFields();
      fetchAuditLogs();
    }
  }, [session]);

  const fetchBeneficiaries = async () => {
    try {
      const res = await authFetch("/api/beneficiaries");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setBeneficiaries(data);
        } else if (Array.isArray(data)) {
          setBeneficiaries(prev => prev.length > 0 ? prev : data);
        }
      } else {
        console.error("Failed to load beneficiaries list: Status", res.status);
        showToast("System is currently experiencing heavy load. Displaying cached session records.", "warning");
      }
    } catch (e) {
      console.error("Failed to load beneficiaries due to network error:", e);
      showToast("System error: Failed to connect to secure gateway. Relying on active local data session.", "warning");
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
        setCustomFields(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await authFetch("/api/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (email: string, pass: string): Promise<boolean> => {
    try {
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });

      if (res.ok) {
        const sData: UserSession = await res.json();
        localStorage.setItem("ideas-session", JSON.stringify(sData));
        setSession(sData);
        if (sData.role === "TRAINEE") {
          window.location.hash = "#/trainee";
        } else {
          window.location.hash = "#/dashboard";
        }
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
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

  // Render Public Response Portal if a secure token is supplied, bypassing logins
  if (portalToken) {
    return (
      <PublicResponsePortal 
        token={portalToken} 
        onClose={() => setPortalToken(null)} 
      />
    );
  }

  const normalizedHash = currentHash || "#/";
  const isAuthenticated = !!session?.isAuthenticated;

  // Determine core route template to render
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
      <aside className={`no-print w-64 bg-slate-900 text-white flex flex-col justify-between border-r border-indigo-950 h-full flex-shrink-0 z-40 fixed inset-y-0 left-0 lg:static transform lg:translate-x-0 transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        
        {/* Top: Branding Section */}
        <div>
          <div className="p-6 border-b border-indigo-950/80 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-indigo-600 rounded-lg text-white flex-shrink-0">
                  <Cpu className="w-5 h-5 flex-shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[8px] font-bold tracking-widest text-indigo-400 font-mono uppercase bg-indigo-950 px-1 py-0.5 rounded leading-none">
                      SKILLS SECTOR
                    </span>
                    <span className="text-[8px] font-bold tracking-widest text-emerald-400 font-mono uppercase bg-slate-950 px-1 py-0.5 rounded leading-none">
                      TVET
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Mobile Close Button for Sidebar */}
              <button 
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h1 className="font-display font-bold text-slate-100 text-[10px] md:text-xs tracking-tight leading-tight font-sans text-left">
              Computer Hardware and Cell Phone Repairs
            </h1>

            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
              <p className="text-[9px] font-mono uppercase text-slate-500 font-bold tracking-wider text-left">
                Accredited TSP Provider:
              </p>
              <p className="text-[10px] text-indigo-300 font-semibold font-mono mt-0.5 text-left" title="Unique Technology Nig. Ltd">
                Unique Technology Nig. Ltd
              </p>
            </div>
          </div>

          {/* Navigation Items List */}
          <nav className="px-3 py-5 space-y-1">
            <button 
              onClick={() => {
                setActiveTab("dashboard");
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "dashboard" 
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-inherit" />
              <span>Detail Dashboard</span>
            </button>

            <button 
              onClick={() => {
                setActiveTab("registry");
                setRegistryViewMode("list");
                setSubTabMode("beneficiaries");
                setSelectedBeneficiary(null);
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "registry" && subTabMode === "beneficiaries"
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Users className="w-4 h-4 text-inherit" />
              <span>Beneficiaries</span>
            </button>

            <button 
              onClick={() => {
                setActiveTab("registry");
                setRegistryViewMode("list");
                setSubTabMode("admissions");
                setSelectedBeneficiary(null);
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "registry" && subTabMode === "admissions"
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-inherit" />
              <span>Admissions Office</span>
            </button>

            <button 
              onClick={() => {
                setActiveTab("registry");
                setRegistryViewMode("list");
                setSubTabMode("documents");
                setSelectedBeneficiary(null);
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "registry" && subTabMode === "documents"
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <FileCheck className="w-4 h-4 text-inherit" />
              <span>Generated Documents</span>
            </button>

            <button 
              onClick={() => {
                setActiveTab("album");
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "album" 
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <ImageIcon className="w-4 h-4 text-inherit" />
              <span>Reports</span>
            </button>

            {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "") && (
              <button 
                onClick={() => {
                  setActiveTab("settings");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "settings" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Settings className="w-4 h-4 text-inherit" />
                <span>Settings</span>
              </button>
            )}

            {session?.role === "SUPER_ADMIN" && (
              <button 
                onClick={() => {
                  setActiveTab("audits");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "audits" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <History className="w-4 h-4 text-inherit" />
                <span>Audit Logs</span>
              </button>
            )}

            {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "") && (
              <button 
                onClick={() => {
                  setActiveTab("custom");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "custom" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Sliders className="w-4 h-4 text-inherit" />
                <span>Dynamic field Schemas</span>
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Segment */}
        <div className="space-y-4">
          
          {/* Action CTA: Add New Beneficiary */}
          {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "") && (
            (() => {
              console.log("SIDEBAR BUTTON RENDERED");
              return (
                <div className="px-4">
                  <button 
                    onClick={() => {
                      setActiveTab("registry");
                      setRegistryViewMode("create");
                      setSubTabMode("beneficiaries");
                      setSelectedBeneficiary(null);
                      setTempCreatedPhoto(null);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-md transition active:scale-[97%] cursor-pointer text-xs uppercase tracking-wider font-sans group animate-pulse"
                    id="sidebar-register-cta"
                  >
                    <Users className="w-4 h-4 text-slate-950 group-hover:scale-110 transition" />
                    <span>Add Beneficiary</span>
                  </button>
                </div>
              );
            })()
          )}

          {/* Operator session and bottom action buttons */}
          <div className="p-4 border-t border-indigo-950/80 bg-slate-950/30 space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-8.5 w-8.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold text-xs uppercase font-mono flex-shrink-0">
                {session?.username?.substring(0, 2) || "AD"}
              </div>
              <div className="min-w-0 overflow-hidden text-left">
                <p className="text-[10px] font-bold text-slate-350 tracking-wide block leading-none">SYSTEM OPERATOR</p>
                <p className="text-[9px] text-slate-500 truncate font-mono mt-1" title={session?.email}>
                  {session?.email}
                </p>
              </div>
            </div>

            <div className="pb-1">
              <button 
                type="button"
                onClick={handleLogout}
                className="w-full bg-rose-950/25 hover:bg-rose-900/40 text-rose-300 hover:text-rose-100 border border-rose-800/30 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span>Sign Out of Portal</span>
              </button>
            </div>
          </div>

        </div>

      </aside>

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
              initialDetailsTab={
                subTabMode === "admissions" 
                  ? "admission" 
                  : subTabMode === "documents" 
                  ? "documents" 
                  : "overview"
              }
            />
          )}

          {activeTab === "album" && <ReportsWorkspace beneficiaries={beneficiaries} />}

          {activeTab === "custom" && (
            <CustomSchemaBuilder 
              fields={customFields}
              onAddField={handleAddCustomField}
              onRemoveField={handleRemoveCustomField}
            />
          )}

          {activeTab === "audits" && <AuditTrail logs={auditLogs} />}

          {activeTab === "settings" && <SettingsWorkspace />}

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
