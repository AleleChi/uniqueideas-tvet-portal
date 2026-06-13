/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  LayoutDashboard, Calendar, Users, Award, GraduationCap, 
  Map, Landmark, BarChart3, TrendingUp, Cpu, 
  Settings, FolderLock, FolderOpen, Sliders, LogOut, MessageSquare, 
  History, Menu, X, Bell, User, ChevronRight, ChevronDown, ShieldCheck, FileText,
  CheckCircle2, UserCheck, FileCheck, Briefcase, Mail, Database
} from "lucide-react";

interface FederalLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  session: any;
  handleLogout: () => void;
}

export function FederalLayout({
  children,
  activePath,
  onNavigate,
  session,
  handleLogout
}: FederalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Groups and sub-items for FED Navigation organized strictly by Phase 3 enterprise groups
  const navGroups = [
    {
      group: "EXECUTIVE",
      items: [
        { label: "Command Center", path: "/federal/dashboard", icon: LayoutDashboard },
        { label: "National Analytics", path: "/federal/analytics", icon: BarChart3 },
        { label: "Monitoring & Evaluation", path: "/federal/monitoring", icon: TrendingUp }
      ]
    },
    {
      group: "GOVERNANCE",
      items: [
        { label: "Organizations", path: "/federal/organizations", icon: Landmark },
        { label: "Accreditation", path: "/federal/accreditation", icon: ShieldCheck },
        { label: "EOI", path: "/federal/eoi", icon: FileText },
        { label: "Compliance", path: "/federal/compliance", icon: CheckCircle2 }
      ]
    },
    {
      group: "PROGRAMMES",
      items: [
        { label: "Programmes", path: "/federal/programmes", icon: Award },
        { label: "Curriculum", path: "/federal/curriculum", icon: Sliders },
        { label: "Skills Registry", path: "/federal/skills-registry", icon: Award },
        { label: "Sector Registry", path: "/federal/sector-registry", icon: Map }
      ]
    },
    {
      group: "BENEFICIARIES",
      items: [
        { label: "Admissions", path: "/federal/admissions", icon: Users },
        { label: "Beneficiaries", path: "/federal/beneficiaries", icon: UserCheck },
        { label: "Eligible Beneficiaries", path: "/federal/eligible-beneficiaries", icon: FileCheck },
        { label: "Attendance", path: "/federal/attendance", icon: Calendar },
        { label: "Assessments", path: "/federal/assessments", icon: FileCheck }
      ]
    },
    {
      group: "OUTCOMES",
      items: [
        { label: "Graduation", path: "/federal/graduation", icon: GraduationCap },
        { label: "Internship", path: "/federal/internship", icon: Briefcase },
        { label: "Employment", path: "/federal/employment", icon: TrendingUp }
      ]
    },
    {
      group: "OPERATIONS",
      items: [
        { label: "Documents", path: "/federal/documents", icon: FolderOpen },
        { label: "Communication Center", path: "/federal/communications", icon: MessageSquare },
        { label: "Reports", path: "/federal/reports", icon: FileText }
      ]
    },
    {
      group: "SYSTEM",
      items: [
        { label: "Identity & Access Center", path: "/federal/permissions", icon: ShieldCheck },
        { label: "Audit Center", path: "/federal/audits", icon: History },
        { label: "System Status", path: "/federal/system-status", icon: Cpu },
        { label: "Email Delivery Center", path: "/federal/email-center", icon: Mail },
        { label: "Restoration Center", path: "/federal/restoration", icon: Database }
      ]
    }
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col lg:flex-row font-sans antialiased text-slate-800 relative">
      
      {/* Mobile Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden no-print animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* STICKY HEADER FOR MOBILE */}
      <header className="lg:hidden sticky top-0 z-35 bg-slate-900 text-white flex items-center justify-between px-4 py-3 border-b border-indigo-950 shadow-md no-print flex-shrink-0 w-full">
        <button 
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-1 text-slate-350 hover:text-white hover:bg-slate-800/45 rounded-lg flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded text-white text-xs font-bold leading-none">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold tracking-tight uppercase">FED COMMAND CENTRE</span>
        </div>
        <div className="w-11"></div>
      </header>

      {/* LEFT SIDEBAR NAVBAR */}
      <aside 
        className={`no-print w-64 bg-slate-950 text-white flex flex-col justify-between border-r border-slate-900 h-full flex-shrink-0 z-40 fixed inset-y-0 left-0 lg:static transform lg:translate-x-0 transition-transform duration-300 ease-in-out scrollbar-thin ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo / Context Title Header */}
          <div className="p-5 border-b border-slate-900 flex flex-col gap-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-lg text-white flex-shrink-0 shadow-sm">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-indigo-400 font-mono uppercase bg-indigo-950/80 px-2 py-0.5 rounded">
                    FEDERAL LEVEL
                  </span>
                  <p className="text-xs font-bold text-slate-100 font-sans tracking-wide mt-1">
                    Command Centre
                  </p>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/40">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold tracking-wider block">
                Logged In Authority:
              </span>
              <p className="text-[11px] text-indigo-300 font-semibold font-mono mt-0.5 truncate">
                {session?.email || "Federal Administrator"}
              </p>
            </div>
          </div>

          {/* Navigation link blocks */}
          <nav className="flex-grow p-3 space-y-4 overflow-y-auto">
            {navGroups.map((grp, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <span className="text-[9px] font-bold font-mono tracking-widest text-slate-450 uppercase px-3 block mb-1.5 opacity-60">
                  {grp.group}
                </span>
                <div className="space-y-0.5">
                  {grp.items.map((item, itemIdx) => {
                    const IconComponent = item.icon;
                    const isActive = activePath === item.path || (item.path === "/federal/dashboard" && activePath === "");
                    return (
                      <button
                        key={itemIdx}
                        onClick={() => {
                          onNavigate(item.path);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-lg font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                          isActive
                            ? "bg-indigo-600/20 text-indigo-300 border-l-[3px] border-indigo-500 font-bold" 
                            : "text-slate-400 hover:text-white hover:bg-slate-900/60"
                        }`}
                      >
                        <IconComponent className="w-4 h-4 text-inherit flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-slate-900 bg-slate-900/20 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-rose-405 hover:bg-rose-950/15 text-xs font-semibold cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span className="font-sans">Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <div className="flex-grow flex-1 flex flex-col h-full overflow-y-auto">
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-indigo-600 animate-pulse"></span>
            <span className="text-[11px] font-bold font-mono tracking-widest text-slate-500">
              NATIONAL NETWORK COMMAND: <span className="text-indigo-600">FEDERAL TVET MODULE</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications panel dropdown container */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg relative cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-indigo-600"></span>
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-semibold text-xs text-slate-800">Alerts & Messages</span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">New</span>
                  </div>
                  <div className="py-2.5 space-y-3.5 max-h-60 overflow-y-auto">
                    <div className="flex gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                      <div>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          TSP National Compliance score audited successfully. See Reports page.
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">10 minutes ago</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></span>
                      <div>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          Federal Cohort 2026 registry initialized. Ready for batch assignments.
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">1 hour ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile menu dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-indigo-50">
                  {session?.email ? session.email[0].toUpperCase() : "A"}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                    {session?.email || "Admin User"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono font-medium tracking-tight">
                    FED Authority
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800">Connected System</p>
                    <p className="text-[10px] text-slate-450 font-mono mt-0.5 truncate">{session?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold text-left transition-colors mt-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Terminate Session</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic page main content body */}
        <main className="flex-grow p-6 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
