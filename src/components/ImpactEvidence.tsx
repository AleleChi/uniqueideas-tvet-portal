import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Sparkles, CheckCircle, XCircle, AlertTriangle, FileText, 
  Download, Search, Filter, Calendar, MapPin, User, Check, RotateCcw, 
  Upload, Eye, Camera, ClipboardCheck, Briefcase, ChevronRight, File, Shield
} from "lucide-react";
import { API_BASE } from "../config/api";

interface ImpactEvidenceProps {
  session: any;
  showToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export default function ImpactEvidence({ session, showToast }: ImpactEvidenceProps) {
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "explorer" | "reports">("dashboard");
  
  // Stats state
  const [stats, setStats] = useState({
    totalUploaded: 0,
    pendingReview: 0,
    verifiedEvidence: 0,
    rejectedEvidence: 0,
    employmentProofs: 0,
    businessProofs: 0,
    incomeProofs: 0,
    verificationRate: 0
  });

  // Evidence list state
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Selected Graduate for Tab 2
  const [selectedGradId, setSelectedGradId] = useState<string>("");
  const [gradList, setGradList] = useState<any[]>([]);
  const [gradProfile, setGradProfile] = useState<any>(null);
  const [gradSearch, setGradSearch] = useState("");

  // Review Modal state
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<"VERIFIED" | "REJECTED" | "RESUBMISSION_REQUIRED">("VERIFIED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [nextAction, setNextAction] = useState("");

  // Upload Evidence state against selected graduate
  const [outcomeType, setOutcomeType] = useState("EMPLOYED");
  const [evidenceType, setEvidenceType] = useState("EMPLOYMENT_LETTER");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileDescription, setFileDescription] = useState("");

  // Field verification state against selected graduate
  const [fieldVisited, setFieldVisited] = useState(false);
  const [fieldDate, setFieldDate] = useState("");
  const [fieldOfficer, setFieldOfficer] = useState("");
  const [fieldGps, setFieldGps] = useState("");
  const [fieldRemarks, setFieldRemarks] = useState("");
  const [fieldPhotos, setFieldPhotos] = useState<string[]>([]);
  const [fieldPhotoToUpload, setFieldPhotoToUpload] = useState<File | null>(null);
  const [uploadingFieldPhoto, setUploadingFieldPhoto] = useState(false);
  const [fieldResult, setFieldResult] = useState("ACTIVE");
  const [savingFieldRecord, setSavingFieldRecord] = useState(false);

  // Reports state
  const [reportsSummary, setReportsSummary] = useState<any>(null);

  // Load basic dashboard stats
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/evidence/stats`);
      const d = await res.json();
      if (d.success) {
        setStats(d.stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load evidence queue
  const fetchEvidence = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        searchQuery,
        evidenceType: filterType,
        status: filterStatus,
        outcomeType: filterOutcome,
        page: String(currentPage),
        limit: "10"
      });
      const res = await fetch(`${API_BASE}/api/evidence?${qs.toString()}`);
      const d = await res.json();
      if (d.success) {
        setEvidenceList(d.data);
        setTotalPages(d.pagination.totalPages);
      }
    } catch (e) {
      showToast("Failed to fetch evidence directory info", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all graduates (to search for or select in Tab 2)
  const fetchGraduates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/beneficiaries`);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Only include graduates
        const grads = data.filter((b: any) => 
          ["CERTIFIED", "ALUMNI", "GRADUATED", "TRAINED"].includes(b.status)
        );
        setGradList(grads);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch detailed profile for selected graduate
  const fetchDetailedGradProfile = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/evidence/profile/${id}`);
      const d = await res.json();
      if (d.success) {
        setGradProfile(d);
        // Pre-fill field verification form from database values if they exist
        if (d.fieldVerification) {
          setFieldVisited(d.fieldVerification.visited);
          setFieldDate(d.fieldVerification.visit_date ? d.fieldVerification.visit_date.substring(0, 10) : "");
          setFieldOfficer(d.fieldVerification.officer_name || "");
          setFieldGps(d.fieldVerification.gps_coordinates || "");
          setFieldRemarks(d.fieldVerification.remarks || "");
          setFieldPhotos(d.fieldVerification.photos ? d.fieldVerification.photos.split(",") : []);
          setFieldResult(d.fieldVerification.verification_result || "ACTIVE");
        } else {
          // Clear form
          setFieldVisited(false);
          setFieldDate("");
          setFieldOfficer("");
          setFieldGps("");
          setFieldRemarks("");
          setFieldPhotos([]);
          setFieldResult("ACTIVE");
        }
      } else {
        showToast(d.error || "Failed to load graduate profile", "error");
      }
    } catch (e) {
      showToast("Failed to acquire verified graduate profile metrics", "error");
    }
  };

  // Fetch Reports summary
  const fetchReportsSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/evidence/reports-summary`);
      const d = await res.json();
      if (d.success) {
        setReportsSummary(d.report);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchEvidence();
    fetchGraduates();
    fetchReportsSummary();
  }, []);

  useEffect(() => {
    fetchEvidence();
  }, [currentPage, filterType, filterStatus, filterOutcome]);

  useEffect(() => {
    if (selectedGradId) {
      fetchDetailedGradProfile(selectedGradId);
    }
  }, [selectedGradId]);

  // Action: Submit evidence review status change
  const handleReviewSubmit = async () => {
    if (!selectedEvidence) return;
    const isWriteAllowed = ["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role);
    if (!isWriteAllowed) {
      showToast("Access Denied: Only Administrator and Super Admins are permitted to perform verification audits", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/evidence/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence_id: selectedEvidence.id,
          status: reviewStatus,
          rejection_reason: rejectionReason,
          next_action: nextAction
        })
      });
      const d = await res.json();
      if (d.success) {
        showToast(`Evidence verified as ${reviewStatus} successfully`, "success");
        setSelectedEvidence(null);
        setRejectionReason("");
        setNextAction("");
        // Refresh listings
        fetchStats();
        fetchEvidence();
        if (selectedGradId === selectedEvidence.beneficiary_id) {
          fetchDetailedGradProfile(selectedGradId);
        }
      } else {
        showToast(d.error || "Review submission failed", "error");
      }
    } catch (e) {
      showToast("Network error submitting review status", "error");
    }
  };

  // Helper file uploader via Cloudinary proxied endpoint
  const uploadFileToCloudinary = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/upload-asset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileContent: reader.result,
              fileName: file.name,
              folder: "impact_evidence"
            })
          });
          const d = await res.json();
          if (res.ok && d.secureUrl) {
            resolve(d.secureUrl);
          } else {
            reject(new Error(d.error || "Asset upload endpoint rejected content"));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (e) => reject(e);
    });
  };

  // Action: Upload verification evidence document
  const handleEvidenceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGradId) {
      showToast("Please search and select a graduate first", "warning");
      return;
    }
    if (!fileToUpload) {
      showToast("Please select a physical file to upload", "warning");
      return;
    }

    setUploadingFile(true);
    try {
      // 1. Upload file itself to get secure URL
      const fileUrl = await uploadFileToCloudinary(fileToUpload);
      
      // 2. Submit record to database
      const response = await fetch(`${API_BASE}/api/evidence/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id: selectedGradId,
          evidence_type: evidenceType,
          outcome_type: outcomeType,
          file_url: fileUrl,
          file_name: fileToUpload.name,
          file_size: fileToUpload.size,
          file_type: fileToUpload.type,
          description: fileDescription
        })
      });

      const d = await response.json();
      if (d.success) {
        showToast("Impact evidence document logged successfully for verification", "success");
        setFileToUpload(null);
        setFileDescription("");
        fetchStats();
        fetchEvidence();
        fetchDetailedGradProfile(selectedGradId);
        fetchReportsSummary();
      } else {
        showToast(d.error || "Failed registration inside database", "error");
      }
    } catch (err: any) {
      showToast("Error uploading file: " + err.message, "error");
    } finally {
      setUploadingFile(false);
    }
  };

  // Locate current browser coordinates (executive-grade UX)
  const handleAutoFetchCoordinates = () => {
    if (!navigator.geolocation) {
      showToast("Your browser does not support automatic geolocation services", "info");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFieldGps(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        showToast("Successfully fetched high resolution GPS coordinates", "success");
      },
      () => {
        showToast("Unable to acquire high accuracy location via GPS", "warning");
      }
    );
  };

  // Action: Upload image for shop/visit photo
  const handleFieldPhotoUpload = async () => {
    if (!fieldPhotoToUpload) return;
    setUploadingFieldPhoto(true);
    try {
      const url = await uploadFileToCloudinary(fieldPhotoToUpload);
      setFieldPhotos([...fieldPhotos, url]);
      setFieldPhotoToUpload(null);
      showToast("Visit photo attached securely", "success");
    } catch(err: any) {
      showToast("Failed uploading photo: " + err.message, "error");
    } finally {
      setUploadingFieldPhoto(false);
    }
  };

  // Action: Save field verification log
  const handleSaveFieldRecord = async () => {
    if (!selectedGradId) return;
    setSavingFieldRecord(true);
    try {
      const res = await fetch(`${API_BASE}/api/evidence/field-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id: selectedGradId,
          visited: fieldVisited,
          visit_date: fieldDate || null,
          officer_name: fieldOfficer,
          gps_coordinates: fieldGps,
          remarks: fieldRemarks,
          photos: fieldPhotos.join(","),
          verification_result: fieldResult,
          status: "COMPLETE"
        })
      });
      const d = await res.json();
      if (d.success) {
        showToast("Field Verification survey log compiled successfully", "success");
        fetchDetailedGradProfile(selectedGradId);
        fetchStats();
        fetchReportsSummary();
      } else {
        showToast(d.error || "Failed filing verification survey database record", "error");
      }
    } catch (e) {
      showToast("Error contacting server for field verification registry", "error");
    } finally {
      setSavingFieldRecord(false);
    }
  };

  // Filter list of graduates based on search queries
  const filteredGrads = gradList.filter(b => {
    const fullName = `${b.first_name || ""} ${b.last_name || ""} ${b.other_name || ""}`.toLowerCase();
    const query = gradSearch.toLowerCase();
    return fullName.includes(query) || b.id.toLowerCase().includes(query);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <span className="inline-flex items-center gap-1.5 px-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
          <CheckCircle className="w-3 h-3" /> Approved / Verified
        </span>;
      case "REJECTED":
        return <span className="inline-flex items-center gap-1.5 px-2 bg-rose-50 text-rose-700 text-xs font-semibold rounded-md border border-rose-200">
          <XCircle className="w-3 h-3" /> Rejected
        </span>;
      case "RESUBMISSION_REQUIRED":
        return <span className="inline-flex items-center gap-1.5 px-2 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> Resubmission Required
        </span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-300">
          <RotateCcw className="w-3 h-3 animate-spin" /> Pending Review
        </span>;
    }
  };

  return (
    <div id="impact_evidence_block" className="space-y-6">
      {/* Executive level Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            <span className="text-xs uppercase font-bold tracking-widest text-indigo-500 font-mono">Unique Technology Nig. Ltd</span>
          </div>
          <h1 className="text-2xl font-sans font-bold text-gray-900 tracking-tight mt-1">
            Impact Evidence & Verification Center
          </h1>
          <p className="text-sm text-gray-500 font-sans mt-0.5">
            Rigorous outcome verification with file previews, GPS metrics, and dynamic compliance calculations of high-impact Owerri trainees.
          </p>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex items-center bg-gray-100 p-1.5 rounded-xl border border-gray-200 self-start">
          <button 
            onClick={() => setActiveSubTab("dashboard")}
            className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "dashboard" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Dashboard Queue
          </button>
          <button 
            onClick={() => {
              setActiveSubTab("explorer");
              if (!selectedGradId && gradList.length > 0) {
                setSelectedGradId(gradList[0].id);
              }
            }}
            className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "explorer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Graduate Explorer
          </button>
          <button 
            onClick={() => setActiveSubTab("reports")}
            className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "reports" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Dynamic Audits & Exports
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: DASHBOARD & QUEUES */}
      {activeSubTab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-xs uppercase font-mono font-bold tracking-wider text-gray-400">Total Proofs Logged</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-sans font-extrabold text-gray-900 tracking-tight">{stats.totalUploaded}</span>
                <span className="text-xs font-mono font-medium text-indigo-500">files</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between border-l-4 border-l-amber-500">
              <span className="text-xs uppercase font-mono font-bold tracking-wider text-amber-500">Awaiting Verification</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-sans font-extrabold text-gray-900 tracking-tight">{stats.pendingReview}</span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Pending review</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between border-l-4 border-l-emerald-500">
              <span className="text-xs uppercase font-mono font-bold tracking-wider text-emerald-600">Verified Evidence</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-sans font-extrabold text-gray-900 tracking-tight">{stats.verifiedEvidence}</span>
                <span className="text-xs font-sans font-medium text-emerald-600">Approved logs</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-xs uppercase font-mono font-bold tracking-wider text-gray-400">Audit Compliance</span>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-sans font-extrabold text-gray-900 tracking-tight">{stats.verificationRate}%</span>
                <span className="text-xs font-sans font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">Target: 85%</span>
              </div>
            </div>
          </div>

          {/* Quick sector-specific outcome metrics breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs text-gray-400 uppercase font-mono tracking-wide">Employment Proofs</span>
                <span className="text-sm font-sans font-bold text-gray-800">{stats.employmentProofs} files verified</span>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
              <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs text-gray-400 uppercase font-mono tracking-wide">Enterprise/Shop Proofs</span>
                <span className="text-sm font-sans font-bold text-gray-800">{stats.businessProofs} locations logged</span>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs text-gray-400 uppercase font-mono tracking-wide">Income Payslips</span>
                <span className="text-sm font-sans font-bold text-gray-800">{stats.incomeProofs} salary records</span>
              </div>
            </div>
          </div>

          {/* Review Queue Directory */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-sans font-bold text-gray-900">Evidence Compliance Review Queue</h3>
                <p className="text-xs text-gray-500">Cross-examine uploaded letters, certificates, shop images, and payslips submitted by training officers.</p>
              </div>

              {/* Dynamic Search & Pagination control */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search Graduate..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                  />
                </div>

                <select 
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans"
                >
                  <option value="">All Evidence Types</option>
                  <option value="EMPLOYMENT_LETTER">Employment Letters</option>
                  <option value="PAYSLIP">Salary Payslips</option>
                  <option value="BANK_STATEMENT">Bank Statements</option>
                  <option value="BUSINESS_REGISTRATION">Business Registrations</option>
                  <option value="CAC_CERTIFICATE">CAC Certificates</option>
                  <option value="SHOP_PHOTO">Workshop/Shop Photos</option>
                  <option value="BUSINESS_LICENSE">Operational Licenses</option>
                  <option value="GUARANTOR_LETTER">Guarantor Letters</option>
                </select>

                <select 
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="VERIFIED">Verified / Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="RESUBMISSION_REQUIRED">Resubmission Needed</option>
                </select>
              </div>
            </div>

            {/* Evidence List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] tracking-wider uppercase font-mono font-bold text-gray-400">
                    <th className="py-3 px-5">Graduate Trainee</th>
                    <th className="py-3 px-5">Track / Sectors</th>
                    <th className="py-3 px-5">Outcome</th>
                    <th className="py-3 px-5">Evidence Type</th>
                    <th className="py-3 px-5">Uploader</th>
                    <th className="py-3 px-5">Uploaded On</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-sans text-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        <div className="flex justify-center items-center gap-2">
                          <RotateCcw className="w-4 h-4 animate-spin text-indigo-500" />
                          <span>Streaming verification records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : evidenceList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        No verification records match your filters at present.
                      </td>
                    </tr>
                  ) : (
                    evidenceList.map((ev: any) => (
                      <tr key={ev.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-5 font-bold text-gray-900">
                          {ev.first_name} {ev.last_name}
                          <span className="block text-[10px] font-mono text-gray-400 font-normal">{ev.beneficiary_id}</span>
                        </td>
                        <td className="py-3 px-5 text-gray-600 font-mono text-[11px]">
                          {ev.skill_sector}
                          <span className="block text-[10px] text-gray-400">Batch {ev.batch}</span>
                        </td>
                        <td className="py-3 px-5 font-mono text-[11px] font-semibold text-slate-600">
                          {ev.outcome_type}
                        </td>
                        <td className="py-3 px-5 font-medium">
                          {ev.evidence_type.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-5 text-gray-500 font-mono text-[11px]">
                          {ev.uploaded_by || "anonymous"}
                        </td>
                        <td className="py-3 px-5 text-gray-500">
                          {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : "--"}
                        </td>
                        <td className="py-3 px-5">
                          {getStatusBadge(ev.verification_status)}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button 
                            onClick={() => {
                              setSelectedEvidence(ev);
                              setReviewStatus(ev.verification_status === 'PENDING' ? 'VERIFIED' : ev.verification_status);
                              setRejectionReason(ev.rejection_reason || "");
                            }}
                            className="bg-gray-100 font-bold hover:bg-gray-200 border border-gray-300 text-gray-700 py-1 px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Open / Audit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-sans">
                Page <span className="font-bold text-gray-800">{currentPage}</span> of <span className="font-bold text-gray-800">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Previous
                </button>
                <button 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GRADUATE IMPACT EXPLORER */}
      {activeSubTab === "explorer" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left search picker layout */}
          <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-sans font-bold text-gray-900">Select Graduate Profile</h3>
              <p className="text-[11px] text-gray-400 font-sans">Search and choose an Owerri repair technician to record surveys, logs, and files.</p>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="text"
                placeholder="Filter by name/ID..."
                value={gradSearch}
                onChange={(e) => setGradSearch(e.target.value)}
                className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
              />
            </div>

            <div className="divide-y divide-gray-100 overflow-y-auto max-h-96 pr-1 space-y-1">
              {filteredGrads.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedGradId(b.id)}
                  className={`w-full py-2 px-3 rounded-lg text-left transition text-xs font-sans flex items-center justify-between border cursor-pointer ${
                    selectedGradId === b.id 
                      ? "bg-indigo-600/5 text-indigo-700 border-indigo-400 font-bold" 
                      : "border-transparent text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <span className="block text-gray-900 font-bold">{b.first_name} {b.last_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{b.id} • {b.skill_sector}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-inherit" />
                </button>
              ))}
              {filteredGrads.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-4">No matching graduates discovered.</p>
              )}
            </div>
          </div>

          {/* Right Detailed Panel */}
          <div className="lg:col-span-8 space-y-6">
            {!gradProfile ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 text-gray-400 font-sans">
                <ClipboardCheck className="w-12 h-12 stroke-1 text-gray-300 mx-auto mb-3" />
                Select a graduate on the left to display their Impact Score calculations and upload evidence proofs.
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Graduate Header Card with Impact score and dynamic classification display */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                        {gradProfile.profile.skill_sector}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 text-gray-600 rounded">
                        Batch {gradProfile.profile.batch}
                      </span>
                    </div>
                    <h2 className="text-xl font-sans font-extrabold text-gray-900 tracking-tight">
                      {gradProfile.profile.first_name} {gradProfile.profile.last_name} {gradProfile.profile.other_name || ""}
                    </h2>
                    <div className="flex flex-wrap text-xs text-gray-500 gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> Owerri, Imo State</span>
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" /> TSP: {gradProfile.profile.tsp || "Unique Technology Nig. Ltd"}</span>
                      <span className="font-mono text-[11px] text-gray-400">{gradProfile.profile.id}</span>
                    </div>
                  </div>

                  {/* Impact score badge */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex items-center justify-center">
                      {/* Round dynamic ring indicator */}
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="transparent" />
                        <circle cx="28" cy="28" r="24" stroke="#6366f1" strokeWidth="4" fill="transparent" 
                          strokeDasharray={150.7} 
                          strokeDashoffset={150.7 - (150.7 * (gradProfile.impactScore || 0)) / 100}
                        />
                      </svg>
                      <span id="score_text" className="absolute text-sm font-sans font-black text-gray-900">{gradProfile.impactScore}%</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono tracking-wider text-gray-400">Impact Classification</span>
                      <span id="classification_badge" className="inline-flex items-center gap-1 text-sm font-sans font-bold text-gray-900">
                        <Sparkles className="w-4 h-4 text-amber-500 fill-amber-300" />
                        {gradProfile.impactClassification}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                  <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-400">Calculated Impact Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Employment (40%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">Employment Proof Verification</span>
                        <span className="font-semibold text-gray-900">
                          {gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["EMPLOYED", "SELF_EMPLOYED", "ENTREPRENEUR", "APPRENTICESHIP"].includes(e.outcome_type)) ? "Verified (40 / 40)" : "Pending (0 / 40)"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["EMPLOYED", "SELF_EMPLOYED", "ENTREPRENEUR", "APPRENTICESHIP"].includes(e.outcome_type)) ? "bg-indigo-600" : "bg-gray-300"
                          }`}
                          style={{ width: gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["EMPLOYED", "SELF_EMPLOYED", "ENTREPRENEUR", "APPRENTICESHIP"].includes(e.outcome_type)) ? "100%" : "0%" }}
                        />
                      </div>
                    </div>

                    {/* Income (20%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">Salary Income Certification</span>
                        <span className="font-semibold text-gray-900">
                          {gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["PAYSLIP", "BANK_STATEMENT"].includes(e.evidence_type)) ? "Verified (20 / 20)" : "Pending (0 / 20)"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["PAYSLIP", "BANK_STATEMENT"].includes(e.evidence_type)) ? "bg-indigo-600" : "bg-gray-300"
                          }`}
                          style={{ width: gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["PAYSLIP", "BANK_STATEMENT"].includes(e.evidence_type)) ? "100%" : "0%" }}
                        />
                      </div>
                    </div>

                    {/* Business status (20%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">Business / Asset Verification</span>
                        <span className="font-semibold text-gray-900">
                          {gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["BUSINESS_REGISTRATION", "CAC_CERTIFICATE", "SHOP_PHOTO", "WORKSHOP_PHOTO", "SIGNBOARD_PHOTO", "TOOLS_PHOTO", "BUSINESS_LICENSE"].includes(e.evidence_type)) ? "Verified (20 / 20)" : "Pending (0 / 20)"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["BUSINESS_REGISTRATION", "CAC_CERTIFICATE", "SHOP_PHOTO", "WORKSHOP_PHOTO", "SIGNBOARD_PHOTO", "TOOLS_PHOTO", "BUSINESS_LICENSE"].includes(e.evidence_type)) ? "bg-indigo-600" : "bg-gray-300"
                          }`}
                          style={{ width: gradProfile.evidence.some((e: any) => e.verification_status === "VERIFIED" && ["BUSINESS_REGISTRATION", "CAC_CERTIFICATE", "SHOP_PHOTO", "WORKSHOP_PHOTO", "SIGNBOARD_PHOTO", "TOOLS_PHOTO", "BUSINESS_LICENSE"].includes(e.evidence_type)) ? "100%" : "0%" }}
                        />
                      </div>
                    </div>

                    {/* Quality (20%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">Evidence Documentation Quality</span>
                        <span className="font-semibold text-gray-900">
                          {gradProfile.evidence.length > 0 ? `${Math.round((gradProfile.evidence.filter((e: any) => e.verification_status === "VERIFIED").length / gradProfile.evidence.length) * 20)} / 20` : "0 / 20"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                          style={{ 
                            width: gradProfile.evidence.length > 0 
                              ? `${(gradProfile.evidence.filter((e: any) => e.verification_status === "VERIFIED").length / gradProfile.evidence.length) * 100}%` 
                              : "0%" 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-panels Grid: Upload Verification Forms & Field Visit Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* File Upload Form */}
                  <form onSubmit={handleEvidenceUpload} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                      <Upload className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-gray-700">Log Verification Document</h4>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Employment Outcome Track</label>
                      <select 
                        value={outcomeType}
                        onChange={(e) => setOutcomeType(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="EMPLOYED">Wage Employment (Employed)</option>
                        <option value="SELF_EMPLOYED">Self Employment / Freelance</option>
                        <option value="ENTREPRENEUR">Micro-Entrepreneur (Owns Shop)</option>
                        <option value="APPRENTICESHIP">Paid Apprenticeship placement</option>
                      </select>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Verification Evidence Type</label>
                      <select 
                        value={evidenceType}
                        onChange={(e) => setEvidenceType(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="EMPLOYMENT_LETTER">Official Employment Contract</option>
                        <option value="PAYSLIP">Monthly Payslip Proof</option>
                        <option value="BANK_STATEMENT">Salary Bank Statement Log</option>
                        <option value="BUSINESS_REGISTRATION">Business CAC / SMEDAN Registration</option>
                        <option value="CAC_CERTIFICATE">CAC Certificate Copy</option>
                        <option value="SHOP_PHOTO">Workshop / Signboard Photo</option>
                        <option value="BUSINESS_LICENSE">Operational Business License</option>
                        <option value="GUARANTOR_LETTER">Verified Guarantor Letter</option>
                      </select>
                    </div>

                    {/* Drag & drop file area */}
                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Physical Evidence File</label>
                      <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 text-center hover:bg-slate-50 transition relative">
                        <input 
                          type="file" 
                          id="file-uploader"
                          onChange={(e: any) => {
                            if (e.target.files && e.target.files[0]) {
                              setFileToUpload(e.target.files[0]);
                            }
                          }}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
                        <span className="block text-xs font-semibold text-gray-600">
                          {fileToUpload ? fileToUpload.name : "Choose or drag evidence file"}
                        </span>
                        <span className="block text-[10px] text-gray-400">PDF, PNG, JPEG maximum 10MB</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Description / Verification Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Add annotations, phone confirmations, employer contacts..."
                        value={fileDescription}
                        onChange={(e) => setFileDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role) ? (
                      <button 
                        type="submit"
                        disabled={uploadingFile}
                        className="w-full bg-indigo-600 font-bold hover:bg-indigo-700 text-white text-xs py-2 rounded-lg font-sans shadow-sm transition disabled:opacity-50 inline-flex justify-center items-center gap-2 cursor-pointer"
                      >
                        {uploadingFile ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                            Uploading & encoding...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Submit Evidence Document
                          </>
                        )}
                      </button>
                    ) : (
                      <p className="text-[10px] text-rose-500 text-center font-semibold">Your current account permissions do not allow modifying outcome registries.</p>
                    )}
                  </form>

                  {/* Field Verification Form */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-gray-700">Record Field Visit Survey</h4>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input 
                        type="checkbox"
                        id="field-visited-box"
                        checked={fieldVisited}
                        onChange={(e) => setFieldVisited(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="field-visited-box" className="text-xs font-bold text-gray-700 cursor-pointer">
                        Physical Field Visit Executed
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-600">Surveilled Date</label>
                        <input 
                          type="date"
                          value={fieldDate}
                          onChange={(e) => setFieldDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-600">Field Officer Name</label>
                        <input 
                          type="text"
                          value={fieldOfficer}
                          onChange={(e) => setFieldOfficer(e.target.value)}
                          placeholder="e.g. Officer Okechukwu"
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600 flex justify-between items-center">
                        <span>GPS Coordinates (WGS84 Format)</span>
                        <button 
                          onClick={handleAutoFetchCoordinates}
                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Auto-fetch GPS
                        </button>
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. 5.485121, 7.035824 (Owerri)"
                        value={fieldGps}
                        onChange={(e) => setFieldGps(e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Physical Verification Outcome</label>
                      <select 
                        value={fieldResult}
                        onChange={(e) => setFieldResult(e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans"
                      >
                        <option value="ACTIVE_VERIFIED">Active & Works Verified (Active)</option>
                        <option value="ACTIVE_DOUBTFUL">Active (Doubtful Details)</option>
                        <option value="INACTIVE_MOVED">Inactive (Graduate Moved)</option>
                        <option value="UNTRACEABLE">Unstable / Untraceable profile</option>
                      </select>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Field Visit Photos</label>
                      <div className="flex gap-2">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={(e: any) => {
                            if (e.target.files && e.target.files[0]) {
                              setFieldPhotoToUpload(e.target.files[0]);
                            }
                          }}
                          className="text-xs"
                        />
                        {fieldPhotoToUpload && (
                          <button 
                            onClick={handleFieldPhotoUpload}
                            disabled={uploadingFieldPhoto}
                            type="button"
                            className="bg-slate-800 text-white font-bold px-2 py-1 rounded text-[10px] cursor-pointer"
                          >
                            {uploadingFieldPhoto ? "Uploading..." : "Attach"}
                          </button>
                        )}
                      </div>
                      
                      {/* Attached photos list */}
                      {fieldPhotos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {fieldPhotos.map((p, idx) => (
                            <img 
                              key={idx} 
                              src={p} 
                              referrerPolicy="no-referrer"
                              alt="attached shop visit" 
                              className="w-10 h-10 object-cover rounded border border-gray-200" 
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-gray-600">Remarks / Observation Logs</label>
                      <textarea
                        rows={2}
                        placeholder="State business activity, shop name, tools observed, client interaction..."
                        value={fieldRemarks}
                        onChange={(e) => setFieldRemarks(e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                      />
                    </div>

                    {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role) ? (
                      <button 
                        onClick={handleSaveFieldRecord}
                        disabled={savingFieldRecord}
                        className="w-full bg-emerald-600 font-bold hover:bg-emerald-700 text-white text-xs py-2 rounded-lg font-sans shadow-sm transition disabled:opacity-50 inline-flex justify-center items-center gap-1 cursor-pointer"
                      >
                        {savingFieldRecord ? <RotateCcw className="w-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Commit Field Survey Logs
                      </button>
                    ) : (
                      <p className="text-[10px] text-rose-500 text-center font-semibold">Only verify officers can save field operations data.</p>
                    )}
                  </div>
                </div>

                {/* Graduate Impact Timeline */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                  <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-400">Graduate Verification Timeline</h3>
                  <div className="relative pl-6 border-l border-gray-200 space-y-4">
                    {/* Stage 1: Certification */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                      <div className="text-xs font-sans">
                        <span className="font-bold text-gray-900 block">Digital Skills Certificate Conferred</span>
                        <span className="text-[10px] text-gray-400">Trained under track: {gradProfile.profile.skill_sector} at Owerri Center</span>
                      </div>
                    </div>

                    {/* Stage 2: Outcome registration */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        gradProfile.outcome ? "bg-emerald-500" : "bg-gray-300"
                      }`} />
                      <div className="text-xs font-sans">
                        <span className="font-bold text-gray-900 block">Outcomes Self-Report Registered</span>
                        {gradProfile.outcome ? (
                          <span className="text-[10px] text-emerald-600 font-mono">
                            Type: {gradProfile.outcome.outcome_status || gradProfile.outcome.outcomeStatus} • Registered on: {gradProfile.outcome.created_at ? new Date(gradProfile.outcome.created_at).toLocaleDateString() : "Draft"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">No self-reported outcome is registered in the tracer yet.</span>
                        )}
                      </div>
                    </div>

                    {/* Stage 3: Proofs registration */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        gradProfile.evidence.length > 0 ? "bg-emerald-500" : "bg-gray-300"
                      }`} />
                      <div className="text-xs font-sans">
                        <span className="font-bold text-gray-900 block">Impact Evidence Uploaded</span>
                        <span className="text-[10px] text-gray-400">
                          {gradProfile.evidence.length} files currently logged. ({gradProfile.evidence.filter((e: any) => e.verification_status === "VERIFIED").length} Verified)
                        </span>
                      </div>
                    </div>

                    {/* Stage 4: Field Survey */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        gradProfile.fieldVerification?.visited ? "bg-emerald-500" : "bg-gray-300"
                      }`} />
                      <div className="text-xs font-sans">
                        <span className="font-bold text-gray-900 block">Compliance Field Audit Survey</span>
                        {gradProfile.fieldVerification?.visited ? (
                          <span className="text-[10px] text-emerald-600 font-mono">
                            Visited by {gradProfile.fieldVerification.officer_name} on {new Date(gradProfile.fieldVerification.visit_date).toLocaleDateString()} • Code: {gradProfile.fieldVerification.verification_result}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">No field visit survey logged yet.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* historical list of files specifically for this graduate */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-700">Graduate Evidence Proof Logs</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-gray-50 font-mono text-[9px] uppercase font-bold text-gray-400 border-b border-gray-100">
                          <th className="py-2.5 px-4">Evidence Type</th>
                          <th className="py-2.5 px-4">Outcome</th>
                          <th className="py-2.5 px-4">Uploaded Date</th>
                          <th className="py-2.5 px-4">Uploader</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4 text-right">Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {gradProfile.evidence.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-gray-400">No files uploaded. Use the upload panel to upload.</td>
                          </tr>
                        ) : (
                          gradProfile.evidence.map((ev: any) => (
                            <tr key={ev.id}>
                              <td className="py-2.5 px-4 font-semibold text-gray-900">{ev.evidence_type.replace(/_/g, " ")}</td>
                              <td className="py-2.5 px-4">{ev.outcome_type}</td>
                              <td className="py-2.5 px-4">{ev.created_at ? new Date(ev.created_at).toLocaleDateString() : "--"}</td>
                              <td className="py-2.5 px-4 font-mono text-[10px] text-gray-500">{ev.uploaded_by}</td>
                              <td className="py-2.5 px-4">{getStatusBadge(ev.verification_status)}</td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => setSelectedEvidence(ev)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* SUB-TAB 3: EXPORTS & MONITORING REPORTS */}
      {activeSubTab === "reports" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Dynamic Report card breakdown statistics */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200">
            <h3 className="text-base font-sans font-bold text-gray-950">Dynamic Verification & Outcomes Compliance Metrics</h3>
            <p className="text-xs text-gray-500">Real-time calculations based on approved physical documents uploads and in-field evidence audits.</p>
            
            {reportsSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                
                {/* Rate Metrics */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-600">Verified Wage Employment Rate</span>
                      <span className="text-indigo-600 font-bold">{reportsSummary.verifiedEmploymentRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${reportsSummary.verifiedEmploymentRate}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-600">Verified Self-Employment/Enterprise</span>
                      <span className="text-indigo-600 font-bold">{reportsSummary.verifiedEntrepreneurshipRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${reportsSummary.verifiedEntrepreneurshipRate}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-600">Verified Income Improvement Rate</span>
                      <span className="text-indigo-600 font-bold">{reportsSummary.verifiedIncomeRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${reportsSummary.verifiedIncomeRate}%` }} />
                    </div>
                  </div>
                </div>

                {/* Middle Coverage Radial */}
                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                      <circle cx="48" cy="48" r="40" stroke="#059669" strokeWidth="8" fill="transparent" 
                        strokeDasharray={251.2} 
                        strokeDashoffset={251.2 - (251.2 * reportsSummary.evidenceCoverageRate) / 100}
                      />
                    </svg>
                    <span className="absolute text-lg font-sans font-black text-gray-900">{reportsSummary.evidenceCoverageRate}%</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">Total Evidence Coverage Rate</span>
                  <span className="text-[10px] text-gray-400 text-center">Percentage of certified graduates with verified outcomes.</span>
                </div>

                {/* Right Breakdown metrics */}
                <div className="space-y-2.5 text-xs text-gray-700">
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-300" /> Gold Impact Graduates</span>
                    <span className="font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">{reportsSummary.goldImpactGraduates}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-slate-400 fill-slate-200" /> Silver Impact Graduates</span>
                    <span className="font-mono font-bold bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">{reportsSummary.silverImpactGraduates}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-700 fill-amber-500/20" /> Bronze Impact Graduates</span>
                    <span className="font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">{reportsSummary.bronzeImpactGraduates}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-semibold text-gray-600">Needs Verification</span>
                    <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{reportsSummary.needsVerificationCount}</span>
                  </div>
                </div>

              </div>
            ) : (
              <p className="text-xs text-center text-gray-400 py-8">Streaming dynamic outcomes rates...</p>
            )}
          </div>

          {/* Export Center UI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Box 1: Evidence Registry */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-fit mb-4">
                  <File className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-sans font-bold text-gray-900">Evidence Registry Export</h4>
                <p className="text-xs text-gray-500 mt-1">Export full compiled registry containing graduate IDs, file links, document statuses, and reviews logs in CSV format.</p>
              </div>
              <a 
                href="/api/evidence/export-csv?type=evidence" 
                className="mt-6 bg-gray-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer text-center"
              >
                <Download className="w-3.5 h-3.5" /> Direct Download CSV
              </a>
            </div>

            {/* Box 2: Field Visit Logs */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-4">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-sans font-bold text-gray-900">Field Verification Logs</h4>
                <p className="text-xs text-gray-500 mt-1">Acquire geographic logs, visitation survey timestamps, field officer comments, and active statuses of Owerri shops.</p>
              </div>
              <a 
                href="/api/evidence/export-csv?type=field_verifications" 
                className="mt-6 bg-gray-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer text-center"
              >
                <Download className="w-3.5 h-3.5" /> Direct Export CSV
              </a>
            </div>

            {/* Box 3: Graduate Impact Scores */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl w-fit mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-sans font-bold text-gray-900">Graduate Impact Roster</h4>
                <p className="text-xs text-gray-500 mt-1">Bulk export of graduates with their respective calculated Impact Scores, track percentages, and dynamic class badges.</p>
              </div>
              <a 
                href="/api/evidence/export-csv?type=impact_scores" 
                className="mt-6 bg-gray-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer text-center"
              >
                <Download className="w-3.5 h-3.5" /> Download Roster CSV
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ============================================
          INTERACTIVE PROOF PREVIEW & AUDIT MODAL
      ============================================ */}
      {selectedEvidence && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-height-[90vh] shadow-2xl overflow-hidden flex flex-col border border-gray-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-500">Document Audit Panel</span>
                <h3 className="text-lg font-sans font-extrabold text-gray-900 leading-tight">
                  Audit: {selectedEvidence.evidence_type.replace(/_/g, " ")} ({selectedEvidence.first_name} {selectedEvidence.last_name})
                </h3>
              </div>
              <button 
                onClick={() => setSelectedEvidence(null)}
                className="text-gray-400 hover:text-gray-900 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <XCircle className="w-6 h-6" strokeWidth={1} />
              </button>
            </div>

            {/* Modal Body: Left Preview, Right Compliance checklist */}
            <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto duration-200" style={{ maxHeight: "calc(90vh - 130px)" }}>
              {/* Left Column: Inline Preview Center */}
              <div className="md:col-span-7 bg-slate-900 p-4 flex flex-col items-center justify-center min-h-[300px] border-r border-gray-100 relative">
                
                {selectedEvidence.file_url ? (
                  <>
                    {/* Render Image Previews Inline */}
                    {(selectedEvidence.file_type?.startsWith("image/") || selectedEvidence.file_url.match(/\.(jpeg|jpg|png|gif|webp)$/i)) ? (
                      <div className="w-full h-full max-h-[420px] overflow-hidden flex items-center justify-center relative p-2">
                        <img 
                          src={selectedEvidence.file_url} 
                          referrerPolicy="no-referrer"
                          alt="Evidence upload preview" 
                          className="max-w-full max-h-full object-contain shadow-lg rounded-lg border border-slate-700 hover:scale-105 transition duration-200" 
                        />
                        <span className="absolute bottom-2 right-2 bg-gray-900/80 text-[10px] font-mono font-semibold text-white px-2 py-0.5 rounded-md">
                          Click / Open tab for full scope
                        </span>
                      </div>
                    ) : selectedEvidence.file_url.endsWith(".pdf") || selectedEvidence.file_type === "application/pdf" ? (
                      /* Render PDF interactive inline preview */
                      <div className="w-full h-[400px] overflow-hidden rounded-lg border border-slate-700 bg-white">
                        <iframe 
                          src={selectedEvidence.file_url} 
                          title="Evidence PDF Preview" 
                          className="w-full h-full"
                          frameBorder="0"
                        />
                      </div>
                    ) : (
                      /* Fallback Preview Center template cards */
                      <div className="text-center text-slate-400 p-8 space-y-4">
                        <div className="w-16 h-16 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto border border-slate-700">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">Non-Visual Document Reference Log</p>
                          <p className="text-[10px] text-slate-500 mt-1 max-w-sm">This file is classified as a spreadsheet, signature log, or operational database. You can inspect details or launch full resolution download.</p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons directly beneath the preview zone */}
                    <div className="flex gap-2 mt-4 self-center">
                      <a 
                        href={selectedEvidence.file_url} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        rel="noopener noreferrer" 
                        className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg border border-white/20 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Full Resolution (New Tab)
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-xs">No visual attachment URL found.</p>
                )}
              </div>

              {/* Right Column: Review Decisions Checklist Form */}
              <div className="md:col-span-5 p-5 space-y-4 text-xs">
                
                {/* Meta details */}
                <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-2">
                  <h4 className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1">Registry Annotation</h4>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
                    <span className="text-gray-400">Graduate ID:</span>
                    <span className="font-mono font-bold text-gray-800">{selectedEvidence.beneficiary_id}</span>
                    
                    <span className="text-gray-400">Target Outcome:</span>
                    <span className="font-semibold text-gray-800">{selectedEvidence.outcome_type}</span>

                    <span className="text-gray-400">Document Type:</span>
                    <span className="font-semibold text-gray-800">{selectedEvidence.evidence_type.replace(/_/g, " ")}</span>
                    
                    <span className="text-gray-400">Uploaded By:</span>
                    <span className="font-mono text-gray-800">{selectedEvidence.uploaded_by}</span>
                  </div>
                  {selectedEvidence.description && (
                    <p className="text-[11px] text-gray-500 pt-1.5 border-t border-gray-200/50 italic mt-1.5">
                      &ldquo;{selectedEvidence.description}&rdquo;
                    </p>
                  )}
                </div>

                {/* Audit state history */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Audit Audit Decision</h4>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(selectedEvidence.verification_status)}
                    {selectedEvidence.verified_by && (
                      <span className="text-[10px] text-gray-400 font-mono">by {selectedEvidence.verified_by}</span>
                    )}
                  </div>
                </div>

                {/* Compliance Action inputs (Only allowed for Super Admin / Admin Officer) */}
                {["SUPER_ADMIN", "ADMIN_OFFICER"].includes(session?.role) ? (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <h4 className="font-mono text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Verify / Update Status</h4>
                    
                    <div className="grid grid-cols-3 gap-1">
                      <button 
                        onClick={() => {
                          setReviewStatus("VERIFIED");
                        }}
                        className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          reviewStatus === "VERIFIED" ? "bg-emerald-600 text-white shadow-xs" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> Approved
                      </button>
                      
                      <button 
                        onClick={() => {
                          setReviewStatus("REJECTED");
                        }}
                        className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          reviewStatus === "REJECTED" ? "bg-rose-600 text-white shadow-xs" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>

                      <button 
                        onClick={() => {
                          setReviewStatus("RESUBMISSION_REQUIRED");
                        }}
                        className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          reviewStatus === "RESUBMISSION_REQUIRED" ? "bg-amber-500 text-white shadow-xs" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Re-submit
                      </button>
                    </div>

                    {/* Reject & resubmission reason inputs */}
                    {(reviewStatus === "REJECTED" || reviewStatus === "RESUBMISSION_REQUIRED") && (
                      <div className="space-y-2 animate-fade-in text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-gray-600">Rejection Cause / Issue description *</label>
                          <textarea
                            rows={3}
                            placeholder="e.g. CAC search failed; photo blurred; name does not match registry description..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        {reviewStatus === "RESUBMISSION_REQUIRED" && (
                          <div className="space-y-1">
                            <label className="font-bold text-gray-600">Actionable recommendations *</label>
                            <input
                              type="text"
                              placeholder="e.g. Upload a clear readable shop signboard photograph."
                              value={nextAction}
                              onChange={(e) => setNextAction(e.target.value)}
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              required
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={handleReviewSubmit}
                      className="w-full bg-slate-900 font-bold hover:bg-slate-800 text-white py-2 rounded-lg mt-3 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Shield className="w-3.5 h-3.5" /> Submit Audit Decision
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mt-4">
                    <p className="font-semibold text-rose-700">Audit Privilege Restricted</p>
                    <p className="text-[11px] text-rose-600 mt-0.5">Your review officer account is authorized for Read-Only access in verification queues.</p>
                  </div>
                )}

              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
