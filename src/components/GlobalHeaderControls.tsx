import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, ShieldCheck, Mail, Users, FileText, Settings, Download, PlusCircle, 
  MapPin, Bell, Globe, Sparkles, X, ChevronRight, CornerDownLeft, Command,
  AlertOctagon, Check, Activity, Trash
} from "lucide-react";
import { Beneficiary } from "../types";

interface GlobalHeaderControlsProps {
  beneficiaries: Beneficiary[];
  onSelectBeneficiary: (b: Beneficiary) => void;
  onNavigateTab: (tab: any, subTab?: any, selectMode?: any) => void;
}

interface NotificationItem {
  id: string;
  type: "success" | "warning" | "error" | "info" | "system" | "dispatch" | "admission" | "template" | "security";
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: { tab: string; subTab?: string; beneficiaryId?: string };
}

export function GlobalHeaderControls({ 
  beneficiaries, 
  onSelectBeneficiary, 
  onNavigateTab 
}: GlobalHeaderControlsProps) {
  
  // -- UNIVERSAL SEARCH STATES --
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // -- COMMAND PALETTE STATES --
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [highlightedPaletteIndex, setHighlightedPaletteIndex] = useState(0);
  const paletteDialogRef = useRef<HTMLDivElement>(null);

  // -- NOTIFICATIONS STATES --
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"ALL" | "UNREAD" | "SYSTEM" | "DISPATCH">("ALL");
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n-1",
      type: "success",
      title: "Document Dispatched",
      message: "Trainee Offer Letter generated & transmitted to Sani Dauda (Kano Tech Center).",
      time: "2 mins ago",
      read: false,
      link: { tab: "registry", subTab: "documents" }
    },
    {
      id: "n-2",
      type: "warning",
      title: "Pending Biometric Scan",
      message: "Trainee profile 'Grace Onyeka' created without biometric registration photo.",
      time: "1 hour ago",
      read: false,
      link: { tab: "registry", subTab: "beneficiaries" }
    },
    {
      id: "n-3",
      type: "error",
      title: "SMTP Dispatch Failure",
      message: "Email packet bounced for candidate reference IDEAS-2026-904. (Invalid address syntax)",
      time: "3 hours ago",
      read: false,
      link: { tab: "registry", subTab: "admissions" }
    },
    {
      id: "n-4",
      type: "info",
      title: "New Custom Schema Added",
      message: "Dynamic data database column 'LGA / Ward Code' compiled by Admin Officer.",
      time: "5 hours ago",
      read: true,
      link: { tab: "custom" }
    },
    {
      id: "n-5",
      type: "security",
      title: "Core Integrity Scan Passed",
      message: "Biometric and NIN database tables successfully audited. 0 anomalies flagged.",
      time: "Yesterday",
      read: true,
      link: { tab: "audits" }
    }
  ]);

  // Keyboard shortcut listener for Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setIsPaletteOpen(false);
        setShowSearchDropdown(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtered beneficiaries based on universal keyword inputs
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    
    return beneficiaries.filter(b => {
      return (
        b.lastName?.toLowerCase().includes(query) ||
        b.firstName?.toLowerCase().includes(query) ||
        b.otherName?.toLowerCase().includes(query) ||
        b.id?.toLowerCase().includes(query) ||
        b.nin?.toLowerCase().includes(query) ||
        b.bvn?.toLowerCase().includes(query) ||
        b.phoneNumber?.toLowerCase().includes(query) ||
        b.email?.toLowerCase().includes(query) ||
        b.state?.toLowerCase().includes(query) ||
        b.tsp?.toLowerCase().includes(query) ||
        b.skillSector?.toLowerCase().includes(query) ||
        b.admissionRef?.toLowerCase().includes(query) ||
        b.admissionFormRef?.toLowerCase().includes(query)
      );
    }).slice(0, 10); // Limit to top 10 results for lightning virtualization performance
  }, [searchQuery, beneficiaries]);

  // Handle Search Input Keyboard Navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = searchResults[highlightedIndex];
      if (selected) {
        handleConfirmSearchSelection(selected);
      }
    }
  };

  const handleConfirmSearchSelection = (b: Beneficiary) => {
    onSelectBeneficiary(b);
    setSearchQuery("");
    setShowSearchDropdown(false);
    onNavigateTab("registry", "beneficiaries", "details");
  };

  // COMMAND PALETTE ACTIONS LIST
  const paletteActions = [
    {
      id: "act-1",
      category: "Admissions Workflow",
      title: "Generate Admission Form",
      description: "Auto-compile and construct official trainee response details.",
      icon: PlusCircle,
      action: () => {
        onNavigateTab("registry", "admissions", "list");
      }
    },
    {
      id: "act-2",
      category: "Admissions Workflow",
      title: "Generate Official Admission Letter",
      description: "Configure state recruitment and cohort reference codes.",
      icon: FileText,
      action: () => {
        onNavigateTab("registry", "admissions", "list");
      }
    },
    {
      id: "act-3",
      category: "Secure Dispatches",
      title: "Bulk Dispatch Document Portals",
      description: "Batch send security access credentials to selected trainee groups.",
      icon: Mail,
      action: () => {
        onNavigateTab("registry", "documents", "list");
      }
    },
    {
      id: "act-4",
      category: "Audits & Data",
      title: "Export All Filter Results (Excel CSV)",
      description: "Compress currently filtered cohort records into a secure spreadsheet.",
      icon: Download,
      action: () => {
        onNavigateTab("registry", "beneficiaries", "list");
        // Trigger generic search query download
        setTimeout(() => {
          const exportBtn = document.getElementById("generic-export-csv-btn");
          if (exportBtn) exportBtn.click();
        }, 200);
      }
    },
    {
      id: "act-5",
      category: "Templates & Config",
      title: "Edit Core Email Templates",
      description: "Customize SMTP dispatch texts, placeholders, and links.",
      icon: Settings,
      action: () => {
        onNavigateTab("registry", "admissions", "dispatches");
      }
    },
    {
      id: "act-6",
      category: "Templates & Config",
      title: "Upload State Logo / Letterhead",
      description: "Add authentic state government watermarks.",
      icon: Globe,
      action: () => {
        onNavigateTab("settings");
      }
    },
    {
      id: "act-7",
      category: "Admissions Workflow",
      title: "Open Live Dispatch Transmission Center",
      description: "Monitor SMTP status queues, logs, and delivery ratios.",
      icon: Activity,
      action: () => {
        onNavigateTab("registry", "admissions", "dispatches");
      }
    },
    {
      id: "act-8",
      category: "Quick Directories",
      title: "Browse Unique Technology repairs",
      description: "Inspect specific Computer Hardware and Cell Phone repair cohorts.",
      icon: Users,
      action: () => {
        onNavigateTab("registry", "beneficiaries", "list");
      }
    }
  ];

  const filteredPaletteActions: Record<string, any[]> = useMemo(() => {
    if (!paletteQuery.trim()) return paletteActionGrouped(paletteActions);
    const q = paletteQuery.toLowerCase();
    const matched = paletteActions.filter(act => 
      act.title.toLowerCase().includes(q) || 
      act.description.toLowerCase().includes(q) ||
      act.category.toLowerCase().includes(q)
    );
    return paletteActionGrouped(matched);
  }, [paletteQuery]);

  function paletteActionGrouped(arr: any[]) {
    const groups: Record<string, any[]> = {};
    arr.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }

  // Handle Command Palette Navigation
  const flatPaletteActions = useMemo(() => {
    const list: any[] = [];
    Object.values(filteredPaletteActions).forEach(items => {
      list.push(...items);
    });
    return list;
  }, [filteredPaletteActions]);

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (flatPaletteActions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedPaletteIndex(prev => (prev + 1) % flatPaletteActions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedPaletteIndex(prev => (prev - 1 + flatPaletteActions.length) % flatPaletteActions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = flatPaletteActions[highlightedPaletteIndex];
      if (selected) {
        selected.action();
        setIsPaletteOpen(false);
        setPaletteQuery("");
      }
    }
  };

  // Close search and actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Unread notifications counter
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (n: NotificationItem) => {
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
    setShowNotifications(false);
    if (n.link) {
      onNavigateTab(n.link.tab, n.link.subTab, "list");
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (notificationFilter === "UNREAD") return !n.read;
      if (notificationFilter === "SYSTEM") return n.type === "system" || n.type === "security";
      if (notificationFilter === "DISPATCH") return n.type === "dispatch" || n.type === "success" || n.type === "error";
      return true;
    });
  }, [notifications, notificationFilter]);

  return (
    <div className="relative flex items-center justify-between gap-4 w-full h-full select-none font-sans bg-white pb-3 sm:pb-0">
      
      {/* 1. HEADER UNIVERSAL SEARCH BOX */}
      <div className="flex-grow max-w-xl relative">
        <label htmlFor="universal-search-input" className="sr-only">Search National TVET Database</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            id="universal-search-input"
            ref={searchInputRef}
            type="text"
            className="w-full pl-10 pr-12 py-2 text-xs bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl placeholder-slate-400 font-medium font-sans focus:outline-none focus:ring-2 focus:ring-indigo-100 transition min-h-[38px] text-left"
            placeholder="Search Trainee, NIN, BVN, Phone, Email, State, TSP..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            onKeyDown={handleSearchKeyDown}
          />
          <button
            onClick={() => setIsPaletteOpen(true)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 text-slate-400 cursor-pointer rounded-md flex items-center justify-center font-mono text-[9px] font-black tracking-tighter"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command className="h-3 w-3 mr-0.5" /> K
          </button>
        </div>

        {/* SEARCH INSTANT DROPDOWN */}
        {showSearchDropdown && searchQuery.trim() && (
          <div 
            ref={searchDropdownRef}
            className="absolute left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl z-55 overflow-hidden text-left border-slate-200 flex flex-col max-h-[420px]"
          >
            <div className="p-2.5 bg-slate-100/70 border-b flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase font-mono">
              <span>Matching Core Records Index</span>
              <span>Use arrows</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-medium font-mono text-xs flex flex-col items-center justify-center gap-2">
                <AlertOctagon className="h-5 w-5 text-slate-350" />
                No matching beneficiary details found.
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((b, idx) => (
                  <button
                    key={b.id}
                    className={`w-full p-3 text-left flex items-start gap-3 transition cursor-pointer min-h-[64px] ${
                      highlightedIndex === idx ? "bg-slate-50 border-l-4 border-indigo-500" : "hover:bg-slate-50 border-l-4 border-transparent"
                    }`}
                    onClick={() => handleConfirmSearchSelection(b)}
                  >
                    <div className="h-9 w-9 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-500 border border-slate-200">
                      {b.photo ? (
                        <img src={b.photo} className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-grow text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 font-sans tracking-tight text-[13px] truncate">
                          {b.firstName} {b.lastName}
                        </h4>
                        <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 border px-1.5 py-0.5 rounded uppercase leading-none">
                          {b.id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] text-slate-450 text-slate-500 font-semibold font-mono">
                        <span className="truncate">NIN: {b.nin || "N/A"}</span>
                        <span className="truncate">BVN: {b.bvn || "N/A"}</span>
                        <span className="truncate">State: {b.state || "N/A"}</span>
                        <span className="truncate">Sector: {b.skillSector || "N/A"}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. CORNER SYSTEM BADGES & NOTIFICATIONS GROUP */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        
        {/* Quick Action Trigger Button */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-650 font-sans cursor-pointer bg-white hover:bg-slate-50 active:scale-[98%] transition min-h-[38px] shadow-2xs"
        >
          <Command className="h-3.5 w-3.5 text-indigo-600" />
          <span>Quick Actions</span>
        </button>

        {/* Web Gateway Indicator */}
        <div className="hidden lg:flex items-center gap-1 bg-emerald-50 border border-emerald-150 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-emerald-700 font-mono tracking-tight shadow-3xs uppercase">
          <Globe className="h-3 w-3 text-emerald-600 animate-spin" style={{ animationDuration: "12s" }} />
          <span>Live Gateway</span>
        </div>

        {/* 3. NOTIFICATION BUTTON WITH FLYOUT */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(prev => !prev);
              setShowSearchDropdown(false);
            }}
            className={`p-2 border rounded-xl flex items-center justify-center cursor-pointer min-h-[38px] min-w-[38px] transition shadow-2xs ${
              showNotifications 
                ? "bg-indigo-50 border-indigo-300 text-indigo-600" 
                : "bg-white hover:bg-slate-50 border-slate-200"
            }`}
            title="Operational Alerts"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-[18px] w-[18px] bg-rose-500 text-white font-mono font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {/* NOTIFICATION HUB FLYOUT */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 bg-white border shadow-xl rounded-2xl w-[320px] sm:w-[380px] z-55 overflow-hidden text-left border-slate-200 flex flex-col max-h-[460px]">
              
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b">
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-display">Operational Alerts</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Monitor core activities and dispatches</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-mono uppercase"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification Filter Strip */}
              <div className="flex border-b bg-slate-50 p-1 gap-1">
                {(["ALL", "UNREAD", "SYSTEM", "DISPATCH"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setNotificationFilter(f)}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-[9px] font-bold text-center uppercase tracking-wider cursor-pointer transition ${
                      notificationFilter === f 
                        ? "bg-slate-900 text-white" 
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* List segment */}
              <div className="overflow-y-auto divide-y divide-slate-100 max-h-[300px]">
                {filteredNotifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-medium font-mono text-xs flex flex-col items-center justify-center gap-2">
                    <Check className="h-8 w-8 text-emerald-500 bg-emerald-50 rounded-full p-1.5" />
                    All captured systems healthy with zero alerts.
                  </div>
                ) : (
                  filteredNotifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full p-3.5 text-left flex items-start gap-3 transition cursor-pointer min-h-[72px] hover:bg-slate-50 relative ${
                        !n.read ? "bg-indigo-50/25 border-l-3 border-indigo-600" : "border-l-3 border-transparent"
                      }`}
                    >
                      <div className={`mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        n.type === "success" ? "bg-emerald-100 text-emerald-600" :
                        n.type === "warning" ? "bg-amber-100 text-amber-600" :
                        n.type === "error" ? "bg-rose-100 text-rose-600" : "bg-blue-105 text-indigo-100 text-indigo-700 bg-indigo-50"
                      }`}>
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-xs truncate leading-tight">{n.title}</h4>
                          <span className="text-[8px] font-mono font-bold text-slate-400 shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5 whitespace-pre-wrap">{n.message}</p>
                        {n.link && (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[9px] font-black text-indigo-600 mt-1.5 uppercase tracking-wider">
                            Trace target <ChevronRight className="h-2 w-2" />
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 4. COMMAND PALETTE DIALOG OVERLAY (MODAL) */}
      {isPaletteOpen && (
        <div 
          className="fixed inset-0 z-55 flex items-start justify-center pt-[15vh] px-4 md:px-0"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition"
            onClick={() => setIsPaletteOpen(false)}
          />

          {/* Dialog core */}
          <div 
            ref={paletteDialogRef}
            className="bg-white border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[480px] animate-in fade-in zoom-in-95 duration-150 border-slate-200"
          >
            <div className="p-4 border-b flex items-center gap-3 bg-slate-50">
              <Command className="h-5 w-5 text-indigo-600 flex-shrink-0" />
              <input
                type="text"
                className="w-full bg-transparent text-sm placeholder-slate-400 focus:outline-none font-medium font-sans text-left"
                placeholder="Type command action or filter shortcut..."
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setHighlightedPaletteIndex(0);
                }}
                onKeyDown={handlePaletteKeyDown}
                autoFocus
              />
              <button
                onClick={() => setIsPaletteOpen(false)}
                className="p-1 hover:bg-slate-250 hover:bg-slate-200 rounded text-slate-400 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions grouped rendering */}
            <div className="flex-grow overflow-y-auto divide-y divide-slate-100 p-2">
              {flatPaletteActions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium font-mono text-xs">
                  No matching workspace shortcut actions.
                </div>
              ) : (
                Object.entries(filteredPaletteActions).map(([category, items]) => (
                  <div key={category} className="p-1 text-left">
                    <span className="text-[9px] font-bold text-slate-405 text-slate-400 font-mono tracking-wider block px-3 py-1 bg-slate-50 rounded">
                      {category}
                    </span>
                    <div className="space-y-1 mt-1">
                      {items.map((act) => {
                        // Find global index in flat list
                        const flatIdx = flatPaletteActions.findIndex(f => f.id === act.id);
                        const isHighlighted = flatIdx === highlightedPaletteIndex;
                        const Icon = act.icon;

                        return (
                          <button
                            key={act.id}
                            className={`w-full p-2.5 rounded-xl text-left flex items-start gap-3 transition cursor-pointer min-h-[50px] ${
                              isHighlighted 
                                ? "bg-indigo-605 bg-indigo-600 text-white" 
                                : "hover:bg-slate-55 hover:bg-slate-100/70 text-slate-800"
                            }`}
                            onClick={() => {
                              act.action();
                              setIsPaletteOpen(false);
                              setPaletteQuery("");
                            }}
                          >
                            <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${isHighlighted ? "text-white" : "text-slate-400"}`} />
                            <div className="min-w-0 flex-grow text-xs">
                              <h4 className={`font-bold font-sans tracking-tight text-[13px] ${isHighlighted ? "text-white" : "text-slate-900"}`}>
                                {act.title}
                              </h4>
                              <p className={`font-medium line-clamp-1 text-[11px] mt-0.5 ${isHighlighted ? "text-indigo-200" : "text-slate-500"}`}>
                                {act.description}
                              </p>
                            </div>
                            {isHighlighted && (
                              <span className="self-center font-mono font-black text-[9px] text-indigo-100 px-1 py-0.5 rounded flex items-center gap-0.5 bg-indigo-705 bg-indigo-800 leading-none">
                                <CornerDownLeft className="h-2 w-2" /> ENTER
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t bg-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-mono font-medium">
              <span>Use ↑↓ arrows to navigate actions, ESC to exit</span>
              <span className="flex items-center gap-1">Command Palette <Command className="h-3 w-3" /> K</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
