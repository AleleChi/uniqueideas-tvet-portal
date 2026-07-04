/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Users, Image as ImageIcon, Sliders, ShieldCheck, LogOut, 
  Settings, Landmark, Cpu, LayoutDashboard, History, Check, X, FileCheck, UserCheck, Award, FileText, Clock,
  TrendingUp, ClipboardCheck, Briefcase, BarChart3, Wallet, Mail, Database, CheckSquare
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  subTabMode: string;
  admissionsSubTab: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: any) => void;
  setRegistryViewMode: (mode: any) => void;
  setSubTabMode: (mode: any) => void;
  setAdmissionsSubTab: (subTab: any) => void;
  setSelectedBeneficiary: (b: any) => void;
  setTempCreatedPhoto: (photo: any) => void;
  session: any;
  handleLogout: () => void;
}

export const Sidebar = React.memo(function Sidebar({
  activeTab,
  subTabMode,
  admissionsSubTab,
  isSidebarOpen,
  setIsSidebarOpen,
  setActiveTab,
  setRegistryViewMode,
  setSubTabMode,
  setAdmissionsSubTab,
  setSelectedBeneficiary,
  setTempCreatedPhoto,
  session,
  handleLogout
}: SidebarProps) {
  const FED_ROLES_LIST = ["FED", "FED_SUPER_ADMIN", "FEDERAL_SUPER_ADMIN", "FEDERAL_PROGRAM_MANAGER", "FEDERAL_REVIEW_MANAGER", "FEDERAL_ME_OFFICER"];
  const isFedUser = session?.role === "SUPER_ADMIN" || FED_ROLES_LIST.includes(session?.role || "");

  return (
    <aside 
      id="ideas-platform-sidebar"
      className={`no-print w-64 bg-slate-900 text-white flex flex-col justify-between border-r border-indigo-950 h-full flex-shrink-0 z-40 fixed inset-y-0 left-0 lg:static transform lg:translate-x-0 transition-transform duration-300 ease-in-out sidebar-scroll ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Top Section: Branding & Navigation Navigation Links */}
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

          <div className="pt-2 pb-1 border-t border-slate-800/60 mt-2">
            <span className="text-[9px] font-bold font-mono tracking-wider text-slate-500 uppercase px-3 text-left block mb-2">
              Admissions Ecosystem
            </span>
            <div className="space-y-1">
              <button 
                onClick={() => {
                  setActiveTab("registry");
                  setRegistryViewMode("list");
                  setSubTabMode("beneficiaries");
                  setSelectedBeneficiary(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "registry" && subTabMode === "beneficiaries"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Users className="w-3.5 h-3.5 text-inherit" />
                <span>Beneficiaries</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("registry");
                  setRegistryViewMode("list");
                  setSubTabMode("admissions");
                  setAdmissionsSubTab("forms");
                  setSelectedBeneficiary(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "registry" && subTabMode === "admissions" && admissionsSubTab === "forms"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-inherit" />
                <span>Admission Forms Registry</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("registry");
                  setRegistryViewMode("list");
                  setSubTabMode("admissions");
                  setAdmissionsSubTab("letters");
                  setSelectedBeneficiary(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "registry" && subTabMode === "admissions" && admissionsSubTab === "letters"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-inherit" />
                <span>Admission Offers</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("registry");
                  setRegistryViewMode("list");
                  setSubTabMode("admissions");
                  setAdmissionsSubTab("acceptance");
                  setSelectedBeneficiary(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "registry" && subTabMode === "admissions" && admissionsSubTab === "acceptance"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-inherit" />
                <span>Acceptance Desk</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("eligible-beneficiaries");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "eligible-beneficiaries"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-inherit" />
                <span>Eligible Beneficiaries</span>
              </button>
            </div>
          </div>

          <button 
            onClick={() => {
              setActiveTab("trainee-operations");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "trainee-operations"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <Users className="w-4 h-4 text-inherit" />
            <span>Trainee Operations</span>
          </button>

          <button 
            onClick={() => {
              setActiveTab("attendance-center");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "attendance-center"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <Clock className="w-4 h-4 text-inherit" />
            <span>Attendance Center</span>
          </button>

          <button 
            onClick={() => {
              setActiveTab("eligibility");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "eligibility"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-inherit" />
            <span>Eligibility & Compliance</span>
          </button>

          <button 
            onClick={() => {
              setActiveTab("outcomes");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "outcomes"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-inherit" />
            <span>Training Outcomes</span>
          </button>

          <button 
            onClick={() => {
              setActiveTab("toolkits");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "toolkits"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <Briefcase className="w-4 h-4 text-inherit" />
            <span>Toolkits & Assets</span>
          </button>

          <button 
            onClick={() => {
              setActiveTab("evidence");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "evidence"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-inherit" />
            <span>Impact Evidence</span>
          </button>

          {isFedUser && (
            <>
              <button 
                onClick={() => {
                  setActiveTab("executive-m-and-e");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "executive-m-and-e"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <BarChart3 className="w-4 h-4 text-inherit" />
                <span>Executive M&E</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("quality-accreditation");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "quality-accreditation"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-inherit" />
                <span>Quality & Accreditation</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("financials-roi");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "financials-roi"
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Wallet className="w-4 h-4 text-inherit" />
                <span>Financials & ROI</span>
              </button>
            </>
          )}

          <button 
            onClick={() => {
              setActiveTab("certification");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "certification"
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <Award className="w-4 h-4 text-inherit" />
            <span>🏆 Certification Center</span>
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

          <button 
            onClick={() => {
              setActiveTab("locations");
              setIsSidebarOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
              activeTab === "locations" 
                ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <Landmark className="w-4 h-4 text-inherit" />
            <span>Training Centers & Locations</span>
          </button>

          {["TSP", "TSP_ADMIN", "TSP_TRAINING_MANAGER", "TSP_REVIEW_OFFICER"].includes(session?.role || "") && (
            <button 
              onClick={() => {
                setActiveTab("tsp-profile");
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "tsp-profile" 
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Briefcase className="w-4 h-4 text-inherit" />
              <span>My Organization</span>
            </button>
          )}

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

          {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "") && (
            <button 
              onClick={() => {
                setActiveTab("communications");
                setIsSidebarOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                activeTab === "communications" 
                  ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Mail className="w-4 h-4 text-inherit" />
              <span>Bulk Communications</span>
            </button>
          )}

          {isFedUser && (
            <>
              <button 
                onClick={() => {
                  setActiveTab("organizations");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "organizations" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Landmark className="w-4 h-4 text-inherit" />
                <span>FED Organizations</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("restoration-center");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "restoration-center" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Database className="w-4 h-4 text-inherit" />
                <span>Restoration Center</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("email-audit");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "email-audit" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Mail className="w-4 h-4 text-inherit" />
                <span>Email Delivery System</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("system-status");
                  setIsSidebarOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                  activeTab === "system-status" 
                    ? "bg-indigo-600/15 text-indigo-400 border-l-[3px] border-indigo-500 font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Cpu className="w-4 h-4 text-inherit" />
                <span>System Status</span>
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Bottom Segment */}
      <div className="space-y-4">
        
        {/* Action CTA: Add New Beneficiary */}
        {["SUPER_ADMIN", "ADMIN_OFFICER", "TSP", "TSP_ADMIN", "TSP_TRAINING_MANAGER", "TSP_REVIEW_OFFICER"].includes(session?.role || "") && (
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
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-md transition active:scale-[97%] cursor-pointer text-xs uppercase tracking-wider font-sans group"
              id="sidebar-register-cta"
            >
              <Users className="w-4 h-4 text-slate-950 group-hover:scale-110 transition" />
              <span>Add Beneficiary</span>
            </button>
          </div>
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
  );
});
