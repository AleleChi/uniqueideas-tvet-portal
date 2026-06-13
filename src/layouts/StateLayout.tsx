/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  LayoutDashboard, Calendar, Users, Award, GraduationCap, 
  Map, Landmark, BarChart3, TrendingUp, Cpu, 
  Settings, FolderLock, Sliders, LogOut, MessageSquare, 
  History, Menu, X, Bell, User, ChevronRight, ChevronDown, ShieldCheck, FileText
} from "lucide-react";

interface StateLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  session: any;
  handleLogout: () => void;
}

export function StateLayout({
  children,
  activePath,
  onNavigate,
  session,
  handleLogout
}: StateLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Groups and sub-items for State Admin Navigation
  const navGroups = [
    {
      group: "Overview",
      items: [
        { label: "Dashboard", path: "/state/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      group: "State Oversight",
      items: [
        { label: "Cohorts Registry", path: "/state/cohorts", icon: Calendar },
        { label: "Training Batches", path: "/state/batches", icon: Cpu },
        { label: "Trainers Directory", path: "/state/trainers", icon: Users },
        { label: "Graduation Clearances", path: "/state/graduation", icon: GraduationCap }
      ]
    },
    {
      group: "Governance & Intelligence",
      items: [
        { label: "Reports Module", path: "/state/reports", icon: FileText },
        { label: "Audits & Logs", path: "/state/audits", icon: History }
      ]
    }
  ];

  const stateLabel = session?.state_id || "State Border Scope";

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
      <header className="lg:hidden sticky top-0 z-35 bg-emerald-900 text-white flex items-center justify-between px-4 py-3 border-b border-emerald-950 shadow-md no-print flex-shrink-0 w-full">
        <button 
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-1 text-slate-305 hover:text-white hover:bg-emerald-800/45 rounded-lg flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600 rounded text-white text-xs font-bold leading-none">
            <Map className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold tracking-tight uppercase">{stateLabel.toUpperCase()} OPERATIONS</span>
        </div>
        <div className="w-11"></div>
      </header>

      {/* LEFT SIDEBAR NAVBAR */}
      <aside 
        className={`no-print w-64 bg-slate-900 text-white flex flex-col justify-between border-r border-slate-950 h-full flex-shrink-0 z-40 fixed inset-y-0 left-0 lg:static transform lg:translate-x-0 transition-transform duration-300 ease-in-out scrollbar-thin ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo / Context Title Header */}
          <div className="p-5 border-b border-slate-950 flex flex-col gap-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 rounded-lg text-white flex-shrink-0 shadow-sm">
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-emerald-400 font-mono uppercase bg-emerald-950/85 px-2 py-0.5 rounded">
                    {stateLabel.toUpperCase()} STATE
                  </span>
                  <p className="text-xs font-bold text-slate-100 font-sans tracking-wide mt-1">
                    State Oversight Hub
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

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/40">
              <span className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-wider block">
                Local State Officer:
              </span>
              <p className="text-[11px] text-emerald-300 font-semibold font-mono mt-0.5 truncate">
                {session?.email || "State Administrator"}
              </p>
            </div>
          </div>

          {/* Navigation link blocks */}
          <nav className="flex-grow p-3 space-y-4 overflow-y-auto">
            {navGroups.map((grp, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <span className="text-[9px] font-bold font-mono tracking-widest text-slate-400 uppercase px-3 block mb-1.5 opacity-60">
                  {grp.group}
                </span>
                <div className="space-y-0.5">
                  {grp.items.map((item, itemIdx) => {
                    const IconComponent = item.icon;
                    const isActive = activePath === item.path || (item.path === "/state/dashboard" && activePath === "");
                    return (
                      <button
                        key={itemIdx}
                        onClick={() => {
                          onNavigate(item.path);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-lg font-medium text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left ${
                          isActive
                            ? "bg-emerald-600/20 text-emerald-300 border-l-[3px] border-emerald-500 font-bold" 
                            : "text-slate-400 hover:text-white hover:bg-slate-950/30"
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
        <div className="p-4 border-t border-slate-950 bg-slate-950/25 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-450 hover:text-rose-405 hover:bg-rose-955/20 text-xs font-semibold cursor-pointer text-left"
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
            <span className="h-3 w-3 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="text-[11px] font-bold font-mono tracking-widest text-slate-505">
              STATE BOUNDARY SECURE ENCLAVE: <span className="text-emerald-600 font-bold">{stateLabel.toUpperCase()} REGION</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Profile menu dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-slate-105 rounded-lg cursor-pointer transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs ring-2 ring-emerald-50">
                  {session?.email ? session.email[0].toUpperCase() : "S"}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                    {session?.email || "State Officer"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono font-medium tracking-tight">
                    {stateLabel} Scope
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800">State Jurisdiction</p>
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
