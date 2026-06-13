/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, Calendar, Users, Award, GraduationCap, 
  Map, Landmark, BarChart3, TrendingUp, Cpu, 
  Settings, FolderLock, Sliders, LogOut, MessageSquare, 
  History, Menu, X, Bell, User, ChevronRight, ChevronDown, 
  ShieldCheck, FileText, ChevronLeft, Search, HelpCircle, 
  ShieldAlert, Files, Database
} from "lucide-react";

interface EnterpriseLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  session: any;
  handleLogout: () => void;
}

export function EnterpriseLayout({
  children,
  activePath,
  onNavigate,
  session,
  handleLogout
}: EnterpriseLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Collapsed state of navigation groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    Executive: false,
    Governance: false,
    Operations: false,
    Intelligence: false,
    Administration: false
  });

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Keyboard navigation for accessible groups
  const handleGroupKeyDown = (e: React.KeyboardEvent, groupName: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleGroup(groupName);
    }
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const menuStructure = [
    {
      group: "Executive",
      items: [
        { label: "Command Center", path: "/federal/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      group: "Governance",
      items: [
        { label: "Organizations Workspace", path: "/federal/organizations", icon: Landmark },
        { label: "TSP Management", path: "/federal/tsps", icon: Landmark },
        { label: "States Performance", path: "/federal/states", icon: Map }
      ]
    },
    {
      group: "Operations",
      items: [
        { label: "Admissions", path: "/federal/cohorts", icon: Calendar },
        { label: "Attendance Monitoring", path: "/federal/attendance", icon: BarChart3 },
        { label: "Assessments", path: "/federal/assessments", icon: Award },
        { label: "Graduation", path: "/federal/graduation", icon: GraduationCap },
        { label: "Employment Outcomes", path: "/federal/employment", icon: TrendingUp }
      ]
    },
    {
      group: "Intelligence",
      items: [
        { label: "Reports Workspace", path: "/federal/reports", icon: FileText },
        { label: "Documents Center", path: "/federal/documents", icon: Files },
        { label: "Communications", path: "/federal/communications", icon: MessageSquare },
        { label: "Audit Center", path: "/federal/audits", icon: History }
      ]
    },
    {
      group: "Administration",
      items: [
        { label: "System Status", path: "/federal/system-status", icon: Cpu },
        { label: "Custom Schemas", path: "/federal/custom-fields", icon: Sliders },
        { label: "Settings", path: "/federal/settings", icon: Settings }
      ]
    }
  ];

  const checkIsActive = (itemPath: string) => {
    if (itemPath === "/federal/dashboard" && (activePath === "" || activePath === "/federal/dashboard")) {
      return true;
    }
    return activePath === itemPath;
  };

  return (
    <div id="enterprise-primary-shell" className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col lg:flex-row font-sans antialiased text-slate-800 relative z-0">
      
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div 
          id="mobile-nav-overlay"
          className="fixed inset-0 bg-[#0f172a]/60 z-30 lg:hidden no-print transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* HEADER FOR MOBILE ONLY */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#0f172a] text-white flex items-center justify-between px-4 py-3 border-b border-indigo-950 shadow-md no-print flex-shrink-0 w-full">
        <button 
          id="btn-mobile-sidebar-toggle"
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-650 rounded text-white text-xs font-bold leading-none">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold tracking-tight uppercase">NATIONAL TVET ERP</span>
        </div>
        <div className="w-11"></div>
      </header>

      {/* PERSISTENT MASTER SIDEBAR */}
      <aside 
        id="enterprise-sidebar"
        className={`no-print bg-[#0f172a] text-slate-300 flex flex-col justify-between border-r border-slate-900 h-full flex-shrink-0 z-40 fixed inset-y-0 left-0 lg:static transform lg:translate-x-0 transition-all duration-200 ease-in-out ${
          isSidebarCollapsed ? "w-20" : "w-64"
        } ${
          isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Logo Brand Header */}
          <div className="p-4 border-b border-slate-900 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white flex-shrink-0 shadow-md">
                <Database className="w-5 h-5" />
              </div>
              {(!isSidebarCollapsed || isMobileOpen) && (
                <div className="flex flex-col text-left truncate leading-tight animate-in fade-in duration-100">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 uppercase bg-indigo-950/80 px-2 py-0.5 rounded self-start">
                    FEDERAL AUTHORITY
                  </span>
                  <p className="text-xs font-extrabold text-slate-100 font-sans tracking-wide mt-1">
                    National TVET ERP
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Collapse Trigger */}
            <button 
              id="btn-desktop-collapse-sidebar"
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Trigger */}
            <button 
              id="btn-mobile-sidebar-close"
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Tenant Identity Banner */}
          {(!isSidebarCollapsed || isMobileOpen) && (
            <div className="px-4 py-3 border-b border-slate-900 bg-slate-900/40 border-l-4 border-indigo-500 animate-in fade-in duration-200">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold tracking-wider block">
                Session Identity:
              </span>
              <p className="text-[11px] text-indigo-300 font-semibold font-mono mt-0.5 truncate">
                {session?.email || "fed.ops@gov.tvet.ng"}
              </p>
            </div>
          )}

          {/* Navigation link blocks with groups */}
          <nav className="flex-grow p-3 space-y-4 overflow-y-auto scrollbar-thin">
            {menuStructure.map((grp, gIdx) => {
              const isGroupCollapsed = collapsedGroups[grp.group] && !isSidebarCollapsed;
              
              return (
                <div key={gIdx} className="space-y-1">
                  {/* Category Group Header */}
                  {(!isSidebarCollapsed || isMobileOpen) ? (
                    <div 
                      id={`group-header-${grp.group}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleGroup(grp.group)}
                      onKeyDown={(e) => handleGroupKeyDown(e, grp.group)}
                      className="flex items-center justify-between text-[9px] font-bold font-mono tracking-widest text-slate-450 uppercase px-3 py-1 block mb-1 hover:text-white cursor-pointer select-none"
                    >
                      <span>{grp.group}</span>
                      {isGroupCollapsed ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
                    </div>
                  ) : (
                    <div className="w-full h-px bg-slate-900/60 my-2" />
                  )}

                  {/* Render kids if not collapsed */}
                  {(!isGroupCollapsed || isSidebarCollapsed) && (
                    <div className="space-y-0.5 animate-in fade-in duration-100">
                      {grp.items.map((item, itemIdx) => {
                        const IconComponent = item.icon;
                        const isActive = checkIsActive(item.path);
                        
                        return (
                          <button
                            key={itemIdx}
                            id={`nav-item-${item.label.toLowerCase().replace(/ /g, "-")}`}
                            onClick={() => {
                              onNavigate(item.path);
                              setIsMobileOpen(false);
                            }}
                            className={`w-full py-2 px-3 rounded-xl font-semibold text-xs tracking-wide transition flex items-center gap-3 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-indigo-505 ${
                              isActive
                                ? "bg-indigo-600 border-l-4 border-indigo-400 text-white shadow-md font-bold" 
                                : "text-slate-400 hover:text-white hover:bg-slate-900/40"
                            }`}
                            title={isSidebarCollapsed ? item.label : undefined}
                          >
                            <IconComponent className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                            {(!isSidebarCollapsed || isMobileOpen) && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer / Terminate Session */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/40 flex-shrink-0">
          <button
            id="btn-sidebar-terminate-session"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 text-xs font-bold cursor-pointer text-left transition-colors"
          >
            <LogOut className="w-4.5 h-4.5 text-rose-500" />
            {(!isSidebarCollapsed || isMobileOpen) && <span className="font-sans">Terminate Session</span>}
          </button>
        </div>
      </aside>

      {/* CORE DISPLAY WINDOW - CONTENT WORKSPACE */}
      <div className="flex-grow flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP COMPREHENSIVE CONTROL BAR */}
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm relative z-10 select-none">
          
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-indigo-600 animate-pulse"></span>
            <span className="text-[11px] font-bold font-mono tracking-wider text-slate-500 flex items-center gap-1.5">
              NATIONAL INTEGRATED OPERATIONS: 
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-extrabold border border-indigo-100">
                ENTERPRISE SYSTEM GAGE
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            
            {/* National Alerts Feed Panel */}
            <div className="relative" ref={notificationsRef}>
              <button
                id="btn-header-alerts-dropdown"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl relative cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition"
                aria-haspopup="true"
                aria-expanded={isNotificationsOpen}
                aria-label="National Security & Compliance Alerts"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-xs text-slate-800">Compliance Notifications</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Live Synced</span>
                  </div>
                  <div className="py-2 space-y-3 max-h-64 overflow-y-auto text-left scrollbar-thin">
                    <div className="flex gap-2.5 pb-2 border-b border-slate-50">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          <strong>Oyo State Module</strong> completed physical audit verifying 150 student biometric records.
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">2 minutes ago</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5 pb-2 border-b border-slate-50">
                      <span className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          Compliance flag warnings issued automatically to <strong>Unique Technology Nig. Ltd</strong>.
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">10 minutes ago</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          Federal Council initialized Batch 2026 digital EOI portfolios.
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">1 hour ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu controller */}
            <div className="relative" ref={profileRef}>
              <button
                id="btn-header-profile-dropdown"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2.5 p-1 px-2 hover:bg-slate-100 rounded-xl cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-haspopup="true"
                aria-expanded={isProfileOpen}
              >
                <div className="h-8 w-8 rounded-xl bg-indigo-650 flex items-center justify-center text-white font-extrabold text-xs ring-2 ring-indigo-50">
                  {session?.email ? session.email[0].toUpperCase() : "A"}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                    {session?.email || "Admin User"}
                  </p>
                  <p className="text-[9px] text-slate-450 font-mono tracking-tight font-bold">
                    FEDERAL SYSTEM ADVISOR
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 text-left">
                    <p className="text-xs font-extrabold text-slate-800">Connected Network</p>
                    <p className="text-[10px] text-slate-450 font-mono mt-0.5 truncate">{session?.email || "fed.admin@tvet.ng"}</p>
                  </div>
                  <button
                    id="btn-header-logout"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold text-left transition mt-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Terminate Session</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* MASSIVE DYNAMICALLY LOADED VIEW CONTAINER */}
        <main className="flex-grow p-6 overflow-y-auto bg-slate-50 scrollbar-thin">
          {children}
        </main>
      </div>

    </div>
  );
}
