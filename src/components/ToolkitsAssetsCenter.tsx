/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Briefcase, Landmark, Search, Plus, Trash2, Edit3, ArrowRight, Download, CheckCircle, 
  AlertTriangle, Hammer, RefreshCw, Smartphone, Monitor, ChevronRight, Upload, 
  MapPin, Check, Sparkles, Filter, Shield, User, Camera, Calendar, FileText
} from "lucide-react";
import { authFetch, downloadWithAuth } from "../utils/authFetch";

interface ToolkitsAssetsCenterProps {
  session: any;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function ToolkitsAssetsCenter({ session, showToast }: ToolkitsAssetsCenterProps) {
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "inventory" | "allocation" | "field-verification">("dashboard");
  const [loading, setLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalToolkits: 0,
    allocated: 0,
    issued: 0,
    verified: 0,
    damaged: 0,
    lost: 0,
    replacementRequests: 0,
    utilizationRate: 0
  });

  // DB States
  const [assets, setAssets] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);

  // Filtering / Search
  const [assetSearch, setAssetSearch] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("ALL");

  // Multi-Form Modal Controller
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Asset Form State
  const [assetForm, setAssetForm] = useState({
    assetCode: "",
    assetName: "",
    assetCategory: "",
    trainingTrack: "Computer Hardware Repairs",
    description: "",
    unitCost: 15000,
    quantity: 10,
    status: "ACTIVE"
  });

  // Assignment states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    beneficiaryId: "",
    assetId: ""
  });

  // Field Verification states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedAssignForVerify, setSelectedAssignForVerify] = useState<any | null>(null);
  const [verifyForm, setVerifyForm] = useState({
    visitDate: new Date().toISOString().split("T")[0],
    officerName: session?.username || "Field Inspector",
    gpsCoordinates: "",
    remarks: "",
    utilizationStatus: "ACTIVE_USE",
    conditionStatus: "GOOD",
    checklist: {
      toolkitPresent: true,
      toolkitInUse: true,
      workshopActive: true,
      businessActive: true,
      employmentVerified: true
    },
    evidencePhoto: ""
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isEditableRole = ["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role || "");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Stats
      const statsRes = await authFetch("/api/toolkits/stats");
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // 2. Fetch Assets
      const assetsRes = await authFetch("/api/toolkits/assets");
      const assetsData = await assetsRes.json();
      if (Array.isArray(assetsData)) {
        setAssets(assetsData);
      }

      // 3. Fetch Assignments
      const assignmentsRes = await authFetch("/api/toolkits/graduates");
      const assignmentsData = await assignmentsRes.json();
      if (Array.isArray(assignmentsData)) {
        setAssignments(assignmentsData);
      }

      // 4. Fetch Trainees Roster
      const traineesRes = await authFetch("/api/beneficiaries");
      const trainees = await traineesRes.json();
      if (Array.isArray(trainees)) {
        // filter trainees whose training outcomes or general outcomes are eligible / graduated
        setBeneficiaries(trainees);
      }
    } catch (e: any) {
      showToast("Failed to populate toolkit data streams: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Capture GPS coordinates for verify visit
  const handleGPSCapture = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setVerifyForm(prev => ({
            ...prev,
            gpsCoordinates: `Lat: ${position.coords.latitude.toFixed(5)}, Lng: ${position.coords.longitude.toFixed(5)}`
          }));
          showToast("GPS location coordinates resolved successfully!", "success");
        },
        (error) => {
          // Fallback to static Owerri coordinates
          setVerifyForm(prev => ({
            ...prev,
            gpsCoordinates: "Lat: 5.48310, Lng: 7.03050 (Default Owerri Office)"
          }));
          showToast("Unable to resolve GPS. Imputed Owerri regional coordinates instead.", "warning");
        }
      );
    } else {
      setVerifyForm(prev => ({
        ...prev,
        gpsCoordinates: "Lat: 5.48311, Lng: 7.03049 (Default Owerri Office)"
      }));
    }
  };

  // Convert and proxy image verification to endpoint CDN
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("File size violates 10MB limit threshold.", "error");
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Content = (reader.result as string).split(",")[1];
      try {
        const uploadResRaw = await authFetch("/api/toolkits/upload-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_content: base64Content,
            file_name: file.name,
            assignmentId: selectedAssignForVerify?.id || null
          })
        });
        const uploadRes = await uploadResRaw.json();

        if (uploadRes.success) {
          setVerifyForm(prev => ({ ...prev, evidencePhoto: uploadRes.photoUrl }));
          showToast("Workshop image evidence uploaded to secure CDN storage!", "success");
        } else {
          showToast("Photo transfer rejected: " + uploadRes.error, "error");
        }
      } catch (err: any) {
        showToast("Error processing attachment transfer: " + err.message, "error");
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditableRole) {
      showToast("Access Denied: Action restricted to administrative roles only.", "error");
      return;
    }

    try {
      const payload = selectedAsset ? { ...assetForm, id: selectedAsset.id } : assetForm;
      const resRaw = await authFetch("/api/toolkits/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const res = await resRaw.json();

      if (res.success) {
        showToast(`Asset '${assetForm.assetName}' master key registered successfully!`, "success");
        setShowAssetModal(false);
        fetchInitialData();
      } else {
        showToast(res.error, "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteAsset = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive asset ${name}?`)) return;
    try {
      const resRaw = await authFetch(`/api/toolkits/assets/${id}`, { method: "DELETE" });
      const res = await resRaw.json();
      if (res.success) {
        showToast(`Asset '${name}' archived and restricted from assigning list.`, "success");
        fetchInitialData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAssignToolkitByModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.beneficiaryId || !assignForm.assetId) {
      showToast("Please select both a graduate and a toolkit asset of study.", "warning");
      return;
    }

    try {
      const resRaw = await authFetch("/api/toolkits/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignForm)
      });
      const res = await resRaw.json();

      if (res.success) {
        showToast("Toolkit successfully allocated to selected graduate!", "success");
        setShowAssignModal(false);
        fetchInitialData();
      } else {
        showToast(res.error || "Duplicate allocation or tracking conflict encountered", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handlePhysicalIssuance = async (assignmentId: string, graduateName: string) => {
    if (!window.confirm(`Confirm physical hand-over of assigned tools to ${graduateName}?`)) return;
    try {
      const resRaw = await authFetch("/api/toolkits/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId })
      });
      const res = await resRaw.json();

      if (res.success) {
        showToast(`Physical toolkit issuance completed and dispatched for ${graduateName}!`, "success");
        fetchInitialData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleVerifySubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        assignmentId: selectedAssignForVerify.id,
        ...verifyForm
      };

      const resRaw = await authFetch("/api/toolkits/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const res = await resRaw.json();

      if (res.success) {
        showToast(`Verification checklist registered for ${selectedAssignForVerify.beneficiaryName}!`, "success");
        setShowVerifyModal(false);
        fetchInitialData();
      } else {
        showToast(res.error, "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleLostReport = async (assignmentId: string, bName: string) => {
    const remark = window.prompt(`Please provide details of missing / lost toolkit for ${bName}:`);
    if (remark === null) return;

    try {
      const resRaw = await authFetch("/api/toolkits/lost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, remark })
      });
      const res = await resRaw.json();
      if (res.success) {
        showToast(`Toolkit assigned to ${bName} is now flagged as LOST. Tracking status updated.`, "warning");
        fetchInitialData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDamageReport = async (assignmentId: string, bName: string) => {
    const remark = window.prompt(`Describe damage or mechanical fault for ${bName}:`);
    if (remark === null) return;

    try {
      const resRaw = await authFetch("/api/toolkits/damaged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, remark })
      });
      const res = await resRaw.json();
      if (res.success) {
        showToast(`Toolkit assigned to ${bName} marked as DAMAGED. Operational logs filed.`, "error");
        fetchInitialData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleReplacementAction = async (assignmentId: string, isApproved: boolean) => {
    const message = isApproved 
      ? "Approve replacement and dispatch a brand new toolkit to this graduate?"
      : "Submit general replacement request for this toolkit?";
    
    if (!window.confirm(message)) return;

    try {
      const resRaw = await authFetch("/api/toolkits/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          isApproved,
          reason: isApproved ? "Officer Approved Instant Replacement" : "Standard Replacement request submitted"
        })
      });
      const res = await resRaw.json();

      if (res.success) {
        showToast(
          isApproved 
            ? "New replacement toolkit successfully issued to graduate beneficiary!" 
            : "Replacement petition submitted for review", 
          "success"
        );
        fetchInitialData();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Excel workbook downloaded from authenticated API route
  const handleDownloadExcel = async () => {
    try {
      showToast("Generating secure Multi-sheet Toolkits Inventory spreadsheet...", "info");
      await downloadWithAuth("/api/toolkits/export-excel", "ideas_tvet_toolkits_inventory.xlsx");
      showToast("Multi-sheet spreadsheet downloaded!", "success");
    } catch (err: any) {
      showToast("Workbook extraction failed: " + err.message, "error");
    }
  };

  // Filter lists
  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.assetName.toLowerCase().includes(assetSearch.toLowerCase()) || 
                          a.assetCode.toLowerCase().includes(assetSearch.toLowerCase()) ||
                          a.assetCategory.toLowerCase().includes(assetSearch.toLowerCase());
    const matchesTrack = trackFilter === "ALL" || a.trainingTrack === trackFilter;
    return matchesSearch && matchesTrack && a.status !== "ARCHIVED";
  });

  const filteredAssignments = assignments.filter(g => {
    const matchesSearch = g.beneficiaryName.toLowerCase().includes(assignSearch.toLowerCase()) ||
                          (g.assetCode && g.assetCode.toLowerCase().includes(assignSearch.toLowerCase())) ||
                          (g.assetName && g.assetName.toLowerCase().includes(assignSearch.toLowerCase()));
    const matchesTrack = trackFilter === "ALL" || g.trainingTrack === trackFilter;
    return matchesSearch && matchesTrack;
  });

  return (
    <div id="ideas-toolkits-workspace" className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 bg-slate-50/50 min-h-screen">
      
      {/* Title Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/10 text-indigo-600 rounded-lg">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Toolkits & Asset Management Center</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Landmark className="w-3.5 h-3.5 text-slate-400" />
                New World Access Training Institute • Digital Skill Tracks Active • Owerri Sector
              </p>
            </div>
          </div>
        </div>

        {/* Action Trigger Row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchInitialData}
            title="Sync tracking streams"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg border border-slate-200 bg-white transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDownloadExcel}
            className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition shadow-sm inline-flex items-center gap-2 cursor-pointer border border-indigo-700 font-display"
          >
            <Download className="w-3.5 h-3.5 text-indigo-100" />
            <span>Generate Inventory Spreadsheet (xlsx)</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Metrics Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Total Physical Fleet</span>
            <Monitor className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalToolkits}</p>
          <div className="h-1 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: "100%" }}></div>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Bulk stock pieces active</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-indigo-500 uppercase tracking-wider font-bold">Assigned (Out)</span>
            <User className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.allocated + stats.issued + stats.verified}</p>
          <div className="h-1 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full" 
              style={{ width: `${stats.totalToolkits > 0 ? ((stats.allocated + stats.issued) / stats.totalToolkits) * 100 : 0}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">{stats.issued} verified in field</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-wider font-bold">Active Utilization</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.utilizationRate}%</p>
          <div className="h-1 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.utilizationRate}%` }}></div>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">In-use verified percentage</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-rose-500 uppercase tracking-wider font-bold">Replacements / Lost</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{stats.replacementRequests + stats.lost}</p>
          <div className="h-1 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-rose-500 rounded-full" 
              style={{ width: `${stats.totalToolkits > 0 ? ((stats.replacementRequests + stats.lost) / stats.totalToolkits) * 100 : 0}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-rose-500 mt-1 block">{stats.lost} total lost flagged</span>
        </div>

      </div>

      {/* Tab Navigation Menu */}
      <div className="border-b border-slate-200 bg-white p-1 rounded-xl border flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSubTab("dashboard")}
          className={`py-2 px-4 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "dashboard" 
              ? "bg-slate-950 text-white shadow-sm font-bold" 
              : "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Summary Overview
        </button>

        <button
          onClick={() => setActiveSubTab("inventory")}
          className={`py-2 px-4 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "inventory" 
              ? "bg-slate-950 text-white shadow-sm font-bold" 
              : "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          Master Inventory Assets
        </button>

        <button
          onClick={() => setActiveSubTab("allocation")}
          className={`py-2 px-4 rounded-lg font-display font-medium text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "allocation"
              ? "bg-slate-950 text-white shadow-sm font-bold" 
              : "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Graduate Allocations ({assignments.length})
        </button>
      </div>

      {/* CONDITIONAL RENDER SUB-TAB 1: Summary Overview */}
      {activeSubTab === "dashboard" && (
        <div id="ideas-toolkits-dashboard" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main informational banner */}
          <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 to-slate-950 text-white p-6 rounded-2xl shadow-md border border-slate-800 space-y-4">
            <div className="bg-indigo-500/20 text-indigo-300 py-1 px-2.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest inline-block">
              Governance Standard Implementation
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Owerri Digital Trades Toolkit Program</h2>
            <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed font-sans max-w-xl">
              This system tracks physical toolkits distributed to graduates of <strong className="text-white font-medium">Computer Hardware repairs</strong> and <strong className="text-white font-medium">Mobile Phone repairs</strong>. Program guidelines require periodic field audits, utilization verification, GPS logging, and photographic validation to guarantee job creation and positive employment multipliers.
            </p>

            <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono">
              <div className="flex items-center gap-2 text-indigo-200">
                <Check className="text-emerald-400 w-4 h-4" />
                <span>Weighted impact score integration active (10%)</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-200">
                <Check className="text-emerald-400 w-4 h-4" />
                <span>Active replacement validation loops</span>
              </div>
            </div>
          </div>

          {/* Quick Stats list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">Training Tracks</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-medium text-slate-800">Mobile Phone Repairs</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {assets.filter(a => a.trainingTrack === "Mobile Phone Repairs").reduce((s,i) => s+(i.quantity||0), 0)} items in stock
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-medium text-slate-800">Computer Hardware Repairs</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {assets.filter(a => a.trainingTrack === "Computer Hardware Repairs").reduce((s,i) => s+(i.quantity||0), 0)} items in stock
                </span>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 italic">
                * To assign, allocate, or verify hand-over kits, switch to the Graduate Allocations tab.
              </div>
            </div>
          </div>

          {/* Core distribution list / quick notifications */}
          <div className="md:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Distribution Audit Logs</h3>
                <p className="text-xs text-slate-500">Overview of physical asset allocations across study circles</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-mono">
                    <th className="p-3">S/N</th>
                    <th className="p-3">Beneficiary</th>
                    <th className="p-3">Assigned Toolkit</th>
                    <th className="p-3">Physical Handover</th>
                    <th className="p-3">Asset Status</th>
                    <th className="p-3">Utilization Status</th>
                    <th className="p-3">Last Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.slice(0, 5).map((a, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-900">{a.beneficiaryName}</td>
                      <td className="p-3">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 mr-1.5">
                          {a.assetCode}
                        </span>
                        {a.assetName}
                      </td>
                      <td className="p-3 text-slate-500">
                        {a.issueDate ? (
                          <span className="text-emerald-600 font-medium">Issued ({new Date(a.issueDate).toLocaleDateString()})</span>
                        ) : (
                          <span className="text-amber-500 italic">Allocated / Pending Handover</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          a.verificationStatus === "VERIFIED" ? "bg-emerald-100 text-emerald-800" :
                          a.verificationStatus === "ISSUED" ? "bg-blue-100 text-blue-800" :
                          a.verificationStatus === "LOST" ? "bg-red-100 text-red-800 font-bold" :
                          a.verificationStatus === "DAMAGED" ? "bg-rose-100 text-rose-800" :
                          "bg-slate-100 text-slate-800"
                        }`}>
                          {a.verificationStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          a.utilizationStatus === "ACTIVE_USE" ? "bg-emerald-50 text-emerald-700 font-bold" :
                          a.utilizationStatus === "OCCASIONAL_USE" ? "bg-amber-50 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {a.utilizationStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">
                        {a.lastVerifiedAt ? new Date(a.lastVerifiedAt).toLocaleDateString() : "Never"}
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">No graduate allocations registered on platform database. Add a graduate allocation to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* CONDITIONAL RENDER SUB-TAB 2: Inventory Master Assets */}
      {activeSubTab === "inventory" && (
        <div id="ideas-inventory-workspace" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900">Registered Blueprint Toolkit Inventory</h3>
              <p className="text-xs text-slate-500">Master templates and specifications for physical kit distribution</p>
            </div>

            {isEditableRole && (
              <button
                onClick={() => {
                  setSelectedAsset(null);
                  setAssetForm({
                    assetCode: "NWA-" + (trackFilter === "ALL" || trackFilter === "" ? "COMP" : trackFilter.substring(0,4).toUpperCase()) + "-" + Date.now().toString().substring(10),
                    assetName: "",
                    assetCategory: "Repair Tools",
                    trainingTrack: trackFilter === "ALL" ? "Computer Hardware Repairs" : trackFilter,
                    description: "",
                    unitCost: 15400,
                    quantity: 50,
                    status: "ACTIVE"
                  });
                  setShowAssetModal(true);
                }}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer font-display"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Master Asset</span>
              </button>
            )}
          </div>

          {/* Search, filters, grid */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search master assets (code, designation, etc)..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setTrackFilter("ALL")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
                  trackFilter === "ALL" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                All Tracks
              </button>
              <button
                onClick={() => setTrackFilter("Computer Hardware Repairs")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
                  trackFilter === "Computer Hardware Repairs" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                Computer Hardware
              </button>
              <button
                onClick={() => setTrackFilter("Mobile Phone Repairs")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
                  trackFilter === "Mobile Phone Repairs" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                Mobile Phone
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-mono">
                  <th className="p-3">Asset Code</th>
                  <th className="p-3">Asset Designation</th>
                  <th className="p-3">Track / Sector</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Registered Units</th>
                  <th className="p-3">Acquisition Cost</th>
                  <th className="p-3">Status</th>
                  {isEditableRole && <th className="p-3 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-900">{a.assetCode}</td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-800">{a.assetName}</p>
                      {a.description && <p className="text-[10px] text-slate-400 font-normal">{a.description}</p>}
                    </td>
                    <td className="p-3 font-medium text-slate-600">
                      {a.trainingTrack}
                    </td>
                    <td className="p-3 text-slate-500">{a.assetCategory}</td>
                    <td className="p-3 text-slate-950 font-semibold">{a.quantity} items</td>
                    <td className="p-3 font-mono text-slate-500">₦{(a.unitCost || 0).toLocaleString()}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                        {a.status}
                      </span>
                    </td>
                    {isEditableRole && (
                      <td className="p-3 text-center flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedAsset(a);
                            setAssetForm({
                              assetCode: a.assetCode,
                              assetName: a.assetName,
                              assetCategory: a.assetCategory,
                              trainingTrack: a.trainingTrack,
                              description: a.description || "",
                              unitCost: a.unitCost,
                              quantity: a.quantity,
                              status: a.status
                            });
                            setShowAssetModal(true);
                          }}
                          className="p-1 text-slate-500 hover:text-indigo-600 rounded-md transition hover:bg-indigo-50 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(a.id, a.assetName)}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded-md transition hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">No master assets found. Refine your search inputs.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* CONDITIONAL RENDER SUB-TAB 3: Graduate Toolkit Assignments */}
      {activeSubTab === "allocation" && (
        <div id="ideas-graduates-registry" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900">Distributed Graduate Toolkit Registers</h3>
              <p className="text-xs text-slate-500">Real-time status tracking of toolkit physical handover and functional use</p>
            </div>

            {isEditableRole && (
              <button
                onClick={() => {
                  setAssignForm({ beneficiaryId: "", assetId: assets[0]?.id || "" });
                  setShowAssignModal(true);
                }}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer font-display border border-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Allocate Kit to Graduate</span>
              </button>
            )}
          </div>

          {/* Search, Filters */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by graduate name or asset specifiers..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setTrackFilter("ALL")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
                  trackFilter === "ALL" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                All Tracks
              </button>
              <button
                onClick={() => setTrackFilter("Computer Hardware Repairs")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
                  trackFilter === "Computer Hardware Repairs" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                Computer repairs
              </button>
              <button
                onClick={() => setTrackFilter("Mobile Phone Repairs")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
                  trackFilter === "Mobile Phone Repairs" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                Mobile repairs
              </button>
            </div>
          </div>

          {/* Main Registry Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-mono">
                  <th className="p-3">Graduate Trainee</th>
                  <th className="p-3">Assigned Blueprint Kit</th>
                  <th className="p-3">Tracking State</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Utilization Status</th>
                  <th className="p-3">Verification Visit</th>
                  {isEditableRole && <th className="p-3 text-center">Administrative Ops</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">{g.beneficiaryName}</td>
                    <td className="p-3">
                      <p className="font-medium text-slate-800">{g.assetName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{g.assetCode || "PENDING"}</p>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium inline-block ${
                        g.verificationStatus === "VERIFIED" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                        g.verificationStatus === "ISSUED" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                        g.verificationStatus === "LOST" ? "bg-rose-100 text-rose-800 border border-rose-300 font-bold" :
                        g.verificationStatus === "DAMAGED" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                        g.verificationStatus === "REPLACED" ? "bg-purple-100 text-purple-800 border border-purple-200" :
                        "bg-slate-100 text-slate-800 border border-slate-200"
                      }`}>
                        {g.verificationStatus}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600">{g.conditionStatus || "GOOD"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        g.utilizationStatus === "ACTIVE_USE" ? "bg-emerald-50 text-emerald-700" :
                        g.utilizationStatus === "OCCASIONAL_USE" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {g.utilizationStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-sans">
                      {g.lastVerifiedAt ? (
                        <div>
                          <p className="font-semibold text-slate-700">{new Date(g.lastVerifiedAt).toLocaleDateString()}</p>
                          <span className="text-[9px] font-mono text-emerald-600 block">Verified Checked</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No audits recorded</span>
                      )}
                    </td>
                    {isEditableRole && (
                      <td className="p-3 text-center flex items-center justify-center gap-1.5 flex-wrap">
                        {g.verificationStatus === "ALLOCATED" && (
                          <button
                            onClick={() => handlePhysicalIssuance(g.id, g.beneficiaryName)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-[10px] py-1 px-2.5 rounded-lg transition font-display cursor-pointer"
                          >
                            Physical Issue
                          </button>
                        )}

                        {["ISSUED", "VERIFIED"].includes(g.verificationStatus) && (
                          <button
                            onClick={() => {
                              setSelectedAssignForVerify(g);
                              setVerifyForm(prev => ({
                                ...prev,
                                visitDate: new Date().toISOString().split("T")[0],
                                remarks: "",
                                gpsCoordinates: "",
                                utilizationStatus: g.utilizationStatus || "ACTIVE_USE",
                                conditionStatus: g.conditionStatus || "GOOD"
                              }));
                              setShowVerifyModal(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[10px] py-1 px-2.5 rounded-lg transition font-display cursor-pointer"
                          >
                            Field Verify
                          </button>
                        )}

                        <button
                          onClick={() => handleDamageReport(g.id, g.beneficiaryName)}
                          title="Flag toolkit damaged"
                          className="text-amber-600 hover:text-amber-800 p-1 rounded-md hover:bg-amber-50 transition cursor-pointer font-sans font-bold"
                        >
                          Flag Damaged
                        </button>

                        <button
                          onClick={() => handleLostReport(g.id, g.beneficiaryName)}
                          title="Report lost"
                          className="text-rose-600 hover:text-rose-800 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer font-sans font-bold"
                        >
                          Report Lost
                        </button>

                        {g.replacementRequested ? (
                          <button
                            onClick={() => handleReplacementAction(g.id, true)}
                            className="bg-purple-600 hover:bg-purple-750 text-white font-medium text-[10px] py-1 px-2.5 rounded-lg transition font-display cursor-pointer"
                          >
                            Approve Replacement
                          </button>
                        ) : (
                          g.verificationStatus !== "REPLACED" && (
                            <button
                              onClick={() => handleReplacementAction(g.id, false)}
                              className="text-purple-600 hover:bg-purple-50 font-medium text-[10px] py-1 px-2 rounded-lg transition font-display cursor-pointer"
                            >
                              Request Repl.
                            </button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {filteredAssignments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">No toolkit registers match currently applied search conditions.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* MODAL 1: CREATE / SAVE ASSET MODAL */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase font-mono tracking-widest text-indigo-400 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                {selectedAsset ? "Modify Asset Blueprint" : "Register Master Asset"}
              </h3>
              <button onClick={() => setShowAssetModal(false)} className="text-slate-400 hover:text-white transition text-xs font-mono tracking-widest cursor-pointer">CLOSE</button>
            </div>

            <form onSubmit={handleSaveAsset} className="p-5 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Asset Code (Primary Key)</label>
                  <input
                    type="text"
                    required
                    value={assetForm.assetCode}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, assetCode: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Physical Name</label>
                  <input
                    type="text"
                    required
                    value={assetForm.assetName}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, assetName: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Asset Description</label>
                <textarea
                  value={assetForm.description}
                  onChange={(e) => setAssetForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detail tools inside kit list..."
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Training Track</label>
                  <select
                    value={assetForm.trainingTrack}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, trainingTrack: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  >
                    <option value="Computer Hardware Repairs">Computer Hardware Repairs</option>
                    <option value="Mobile Phone Repairs">Mobile Phone Repairs</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Category Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Toolkit, Tester, Mat"
                    value={assetForm.assetCategory}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, assetCategory: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Unit Acquisition Cost (₦)</label>
                  <input
                    type="number"
                    required
                    value={assetForm.unitCost}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, unitCost: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Initial Stock Amount</label>
                  <input
                    type="number"
                    required
                    value={assetForm.quantity}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition shadow-md font-display tracking-wide cursor-pointer"
              >
                {selectedAsset ? "Modify Master Alignment" : "Register and Seed Master Assets"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ALLOCATE TOOLKIT TO BENEFICIARY */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase font-mono tracking-widest text-indigo-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Allocate toolkit to Graduate
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-white transition text-xs font-mono tracking-widest cursor-pointer">CLOSE</button>
            </div>

            <form onSubmit={handleAssignToolkitByModal} className="p-5 space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Select Graduate Trainee</label>
                <select
                  required
                  value={assignForm.beneficiaryId}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, beneficiaryId: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                >
                  <option value="">-- Click to select graduate --</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.firstName} {b.lastName} ({b.skillSector || "Digital Skills"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">Assign Master Inventory Item</label>
                <select
                  required
                  value={assignForm.assetId}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, assetId: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                >
                  <option value="">-- Choose repair kit blueprint --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.assetCode}] {a.assetName} - {a.trainingTrack}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-md font-display tracking-wide cursor-pointer border border-indigo-700"
              >
                Complete Allocation Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: FIELD VISIT AUDIT & VERIFICATION WITH UPLOADER */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase font-mono tracking-widest text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 animate-pulse" />
                Audit Physical Toolkits: {selectedAssignForVerify?.beneficiaryName}
              </h3>
              <button onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-white transition text-xs font-mono tracking-widest cursor-pointer">CLOSE</button>
            </div>

            <form onSubmit={handleVerifySubmission} className="p-5 space-y-4 text-xs font-sans max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Audit Date</label>
                  <input
                    type="date"
                    required
                    value={verifyForm.visitDate}
                    onChange={(e) => setVerifyForm(prev => ({ ...prev, visitDate: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Inspector Officer</label>
                  <input
                    type="text"
                    required
                    value={verifyForm.officerName}
                    onChange={(e) => setVerifyForm(prev => ({ ...prev, officerName: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Geo location capturing */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Geotagging GPS Coordinates</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Lat: 5.48, Lng: 7.03 (Capture below)"
                    required
                    value={verifyForm.gpsCoordinates}
                    onChange={(e) => setVerifyForm(prev => ({ ...prev, gpsCoordinates: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleGPSCapture}
                    className="p-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer font-bold font-mono"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Locate
                  </button>
                </div>
              </div>

              {/* Verification check lists */}
              <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2">
                <h4 className="font-bold text-[10px] uppercase font-mono tracking-wider text-indigo-800">Physical Verification Checklist</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={verifyForm.checklist.toolkitPresent}
                      onChange={(e) => setVerifyForm(prev => ({
                        ...prev,
                        checklist: { ...prev.checklist, toolkitPresent: e.target.checked }
                      }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    Toolkit Physically Present
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={verifyForm.checklist.toolkitInUse}
                      onChange={(e) => setVerifyForm(prev => ({
                        ...prev,
                        checklist: { ...prev.checklist, toolkitInUse: e.target.checked }
                      }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    In Active Use
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={verifyForm.checklist.workshopActive}
                      onChange={(e) => setVerifyForm(prev => ({
                        ...prev,
                        checklist: { ...prev.checklist, workshopActive: e.target.checked }
                      }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    Workshop Facility Operational
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={verifyForm.checklist.employmentVerified}
                      onChange={(e) => setVerifyForm(prev => ({
                        ...prev,
                        checklist: { ...prev.checklist, employmentVerified: e.target.checked }
                      }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    Graduate Job Verified
                  </label>
                </div>
              </div>

              {/* Utilization Status Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Utilization State</label>
                  <select
                    value={verifyForm.utilizationStatus}
                    onChange={(e) => setVerifyForm(prev => ({ ...prev, utilizationStatus: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  >
                    <option value="ACTIVE_USE">ACTIVE USE</option>
                    <option value="OCCASIONAL_USE">OCCASIONAL USE</option>
                    <option value="NOT_IN_USE">NOT IN USE</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Condition State</label>
                  <select
                    value={verifyForm.conditionStatus}
                    onChange={(e) => setVerifyForm(prev => ({ ...prev, conditionStatus: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                  >
                    <option value="NEW">BRAND NEW</option>
                    <option value="GOOD">EXCELLENT / GOOD</option>
                    <option value="FAIR">FAIR / OPERABLE</option>
                    <option value="POOR">POOR</option>
                  </select>
                </div>
              </div>

              {/* Photo Evidence CDN Uploader widget */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Upload Workshop Verification Image Evidence (10MB limit)</label>
                <div className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 relative">
                  {verifyForm.evidencePhoto ? (
                    <div className="space-y-2 text-center">
                      <img src={verifyForm.evidencePhoto} alt="evidence preview" className="h-28 mx-auto rounded-lg border border-slate-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => setVerifyForm(prev => ({ ...prev, evidencePhoto: "" }))}
                        className="text-rose-600 font-bold underline text-[10px] block mx-auto hover:text-rose-800"
                      >
                        Delete & Upload Different Photo
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                      <div>
                        <span className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer underline">
                          Choose Photo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Converts of JPG, PNG, WEBP (Maximum size limit: 10 MegaBytes)</p>
                      </div>
                    </div>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                      <span className="font-semibold text-indigo-700 font-mono">Uploading assets to Cloudinary...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks Area */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase block">Verification Remarks / Notes</label>
                <textarea
                  value={verifyForm.remarks}
                  onChange={(e) => setVerifyForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Insert field comments..."
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 h-16"
                />
              </div>

              <button
                type="submit"
                disabled={uploadingPhoto}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition shadow-md font-display tracking-wide cursor-pointer disabled:opacity-50"
              >
                Log Physical Field Verification
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
