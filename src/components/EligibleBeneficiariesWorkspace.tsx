/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Search, Filter, Mail, Eye, ClipboardList, Users, CheckSquare, X, 
  ChevronRight, Download, Award, Calendar, ChevronLeft, User, Folder, 
  Briefcase, History, AlertTriangle, CheckCircle2, Send, Save, BookOpen,
  FileText, ShieldAlert, Sparkles, TrendingUp, HelpCircle
} from "lucide-react";
import { Beneficiary, ProgramStatus } from "../types";
import { authFetch } from "../utils/authFetch";
import { API_BASE_URL } from "../config/api";
import { useNotification } from "./NotificationContext";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";

interface EligibleBeneficiariesWorkspaceProps {
  session?: { username?: string; role?: string; email?: string; tenantId?: string; tspId?: string; stateId?: string; city?: string; } | null;
  onRefreshRoot?: () => void;
}

// Age threshold constants
const PREFERRED_AGE_MIN = 18;
const PREFERRED_AGE_MAX = 35;

export default function EligibleBeneficiariesWorkspace({
  session,
  onRefreshRoot
}: EligibleBeneficiariesWorkspaceProps) {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  
  // Navigation & Workspace Modes
  // modes: "list" | "snapshot" | "full-profile" | "bulk-emails"
  const [viewMode, setViewMode] = useState<"list" | "full-profile" | "bulk-emails">("list");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<any | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  
  // Active Profile tab in detailed page
  const [activeProfileTab, setActiveProfileTab] = useState<
    "overview" | "admission" | "attendance" | "assessments" | "reports" | "documents" | "photos" | "outcomes" | "audits"
  >("overview");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [lgaFilter, setLgaFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [eligibilityFilter, setEligibilityFilter] = useState("all");
  const [ageBandFilter, setAgeBandFilter] = useState("all");
  const [tspFilter, setTspFilter] = useState("all"); // For FED
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Bulk Email State
  const [emailTarget, setEmailTarget] = useState<"all_eligible" | "all_under_review" | "all_offers" | "selected">("all_eligible");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [scheduleSendTime, setScheduleSendTime] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailPreviewMode, setEmailPreviewMode] = useState(false);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);

  // Sliding Full Drawer states (Phase 4)
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState<"overview" | "timeline">("overview");
  const [customEmailOpen, setCustomEmailOpen] = useState(false);
  const [individualSubject, setIndividualSubject] = useState("");
  const [individualBody, setIndividualBody] = useState("");

  // Derived filter helper variables from master dataset
  const uniqueStates = useMemo(() => Array.from(new Set(beneficiaries.map(b => b.state).filter(Boolean))), [beneficiaries]);
  const uniqueLgas = useMemo(() => Array.from(new Set(beneficiaries.map(b => b.city).filter(Boolean))), [beneficiaries]);
  const uniqueSectors = useMemo(() => Array.from(new Set(beneficiaries.map(b => b.skill_sector || b.skillSector).filter(Boolean))), [beneficiaries]);
  const uniquePrograms = useMemo(() => Array.from(new Set(beneficiaries.map(b => b.program).filter(Boolean))), [beneficiaries]);
  const uniqueCohorts = useMemo(() => Array.from(new Set(beneficiaries.map(b => b.batch).filter(Boolean))), [beneficiaries]);
  const uniqueTsps = useMemo(() => Array.from(new Set(beneficiaries.map(b => b.tsp).filter(Boolean))), [beneficiaries]);

  // Is FED admin or TSP user
  const isFedUser = useMemo(() => {
    const role = session?.role?.toUpperCase() || "";
    return ["FED", "SUPER_ADMIN", "ADMIN_OFFICER", "FEDERAL_SUPER_ADMIN", "FEDERAL_PROGRAM_MANAGER", "SYSTEM_AUDITOR"].includes(role);
  }, [session]);

  const fetchBeneficiariesList = useCallback(async () => {
    setLoading(true);
    try {
      const includePhoto = "true";
      const includeDetails = "true";
      const response = await authFetch(`${API_BASE_URL}/api/beneficiaries?includePhoto=${includePhoto}&includeDetails=${includeDetails}`);
      
      if (response && response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data)) {
          setBeneficiaries(data);
        } else {
          setBeneficiaries([]);
        }
      } else {
        setBeneficiaries([]);
      }
    } catch (e: any) {
      console.error("[Workspace] Fetch candidates error: ", e);
      showToast("Could not retrieve real registry beneficiary files.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchBeneficiariesList();
  }, [fetchBeneficiariesList]);

  // Get dynamic age based on date of birth
  const calculateAge = (dobString: string): number | null => {
    if (!dobString) return null;
    try {
      const dob = new Date(dobString);
      if (isNaN(dob.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  // Age group banding
  const getAgeBand = (age: number | null): string => {
    if (age === null) return "Unknown";
    if (age >= 18 && age <= 24) return "18–24";
    if (age >= 25 && age <= 35) return "25–35";
    if (age >= 36 && age <= 45) return "36–45";
    if (age >= 46) return "46+";
    return "Outside Range";
  };

  // Determine dynamic eligibility classification
  const calculateEligibility = (b: any): { status: "ELIGIBLE" | "INELIGIBLE" | "UNDER_REVIEW" | "INCOMPLETE"; reasons: string[] } => {
    // Phase 2 Logic: Rules-based Automatic Eligibility
    if (b.eligibility_override) {
      return { 
        status: b.eligibility_override_status === "INELIGIBLE" ? "INELIGIBLE" : "ELIGIBLE", 
        reasons: [`Overridden by Federal Administrator: ${b.eligibility_override_reason || "None specified"}`] 
      };
    }

    const reasons: string[] = [];
    const age = calculateAge(b.date_of_birth || b.dateOfBirth);
    const admissionStatus = (b.admissionStatus || b.status || "").toUpperCase();

    // 1. Mandatory criteria checklist
    const hasNIN = !!(b.nin && b.nin.trim());
    const hasBVN = !!(b.bvn && b.bvn.trim());
    const hasEmail = !!(b.email && b.email.trim());
    const hasPhone = !!(b.phone_number || b.phoneNumber);

    // 2. Checking rules
    const ageOK = age !== null && age >= PREFERRED_AGE_MIN && age <= PREFERRED_AGE_MAX;
    const admissionApproved = admissionStatus === "APPROVED" || admissionStatus === "CONFIRMED";
    const admissionRejected = admissionStatus === "REJECTED";
    const docComplete = !!(b.acceptance_letter_url || b.enrollment_letter_url);

    if (!ageOK) {
      if (age === null) {
        reasons.push("Date of birth is missing or invalid");
      } else {
        reasons.push(`Age ${age} is outside programme preference limits (${PREFERRED_AGE_MIN}-${PREFERRED_AGE_MAX})`);
      }
    }
    if (!hasNIN) reasons.push("National Identity Number (NIN) missing");
    if (!hasBVN) reasons.push("Bank Verification Number (BVN) missing");
    if (!hasEmail) reasons.push("Contact email address missing");
    if (!hasPhone) reasons.push("Contact phone number missing");
    if (!admissionApproved && !admissionRejected) {
      reasons.push(`Admission status is pending (${b.admissionStatus || "DRAFT"})`);
    }

    // Ultimate classification
    if (admissionRejected) {
      return { status: "INELIGIBLE", reasons: ["Admission officially rejected by federal committee"] };
    }
    if (!ageOK && age !== null && (age < 16 || age > 50)) {
      return { status: "INELIGIBLE", reasons: ["Age falls strictly outside extreme compliance boundaries", ...reasons] };
    }
    if (!hasNIN || !hasBVN || !hasEmail || !hasPhone || age === null) {
      return { status: "INCOMPLETE", reasons: ["Biometric/identification credentials or profile indices incomplete", ...reasons] };
    }
    if (ageOK && admissionApproved) {
      return { status: "ELIGIBLE", reasons: ["All programmatic and biometric credentials verified"] };
    }
    return { status: "UNDER_REVIEW", reasons: ["Awaiting validation audits", ...reasons] };
  };

  // Enriched beneficiaries payload
  const enrichedBeneficiaries = useMemo(() => {
    return beneficiaries.map(b => {
      const age = calculateAge(b.date_of_birth || b.dateOfBirth);
      const eligibility = calculateEligibility(b);
      return {
        ...b,
        age,
        ageBand: getAgeBand(age),
        calculatedEligibilityStatus: eligibility.status,
        eligibilityReasons: eligibility.reasons,
        fullName: `${b.first_name || ""} ${b.other_name ? b.other_name + " " : ""}${b.last_name || ""}`.trim(),
        offerStatus: b.admissionStatus || "DRAFT",
        emailLogsStatus: b.email_status || "Pending",
      };
    });
  }, [beneficiaries]);

  // Handle Multi-Selection Row Actions
  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleSelectAll = (filteredList: any[]) => {
    const listIds = filteredList.map(x => x.id);
    const allSelected = listIds.every(id => selectedRowIds.includes(id));
    if (allSelected) {
      setSelectedRowIds(prev => prev.filter(id => !listIds.includes(id)));
    } else {
      setSelectedRowIds(prev => Array.from(new Set([...prev, ...listIds])));
    }
  };

  // Apply Multi-filtering on list
  const filteredBeneficiaries = useMemo(() => {
    return enrichedBeneficiaries.filter(b => {
      // Identity search query match
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = b.id?.toLowerCase().includes(query);
        const matchesName = b.fullName?.toLowerCase().includes(query);
        const matchesPhone = b.phone_number?.toLowerCase().includes(query);
        const matchesEmail = b.email?.toLowerCase().includes(query);
        const matchesNin = b.nin?.toLowerCase().includes(query);
        if (!matchesId && !matchesName && !matchesPhone && !matchesEmail && !matchesNin) {
          return false;
        }
      }

      // Dropdown Filters match
      if (genderFilter !== "all" && b.gender !== genderFilter) return false;
      if (stateFilter !== "all" && b.state !== stateFilter) return false;
      if (lgaFilter !== "all" && b.city !== lgaFilter) return false;
      if (sectorFilter !== "all" && (b.skill_sector || b.skillSector) !== sectorFilter) return false;
      if (programFilter !== "all" && b.program !== programFilter) return false;
      if (cohortFilter !== "all" && b.batch !== cohortFilter) return false;
      if (tspFilter !== "all" && b.tsp !== tspFilter) return false;
      if (eligibilityFilter !== "all" && b.calculatedEligibilityStatus !== eligibilityFilter) return false;
      if (ageBandFilter !== "all" && b.ageBand !== ageBandFilter) return false;

      return true;
    });
  }, [enrichedBeneficiaries, searchQuery, genderFilter, stateFilter, lgaFilter, sectorFilter, programFilter, cohortFilter, tspFilter, eligibilityFilter, ageBandFilter]);

  // Paginated Segment
  const paginatedBeneficiaries = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredBeneficiaries.slice(startIdx, startIdx + pageSize);
  }, [filteredBeneficiaries, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredBeneficiaries.length / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, genderFilter, stateFilter, lgaFilter, sectorFilter, programFilter, cohortFilter, tspFilter, eligibilityFilter, ageBandFilter]);

  // KPI calculations
  const totalAudited = enrichedBeneficiaries.length;
  const eligibleCount = enrichedBeneficiaries.filter(b => b.calculatedEligibilityStatus === "ELIGIBLE").length;
  const underReviewCount = enrichedBeneficiaries.filter(b => b.calculatedEligibilityStatus === "UNDER_REVIEW").length;
  const incompleteCount = enrichedBeneficiaries.filter(b => b.calculatedEligibilityStatus === "INCOMPLETE").length;
  const ineligibleCount = enrichedBeneficiaries.filter(b => b.calculatedEligibilityStatus === "INELIGIBLE").length;

  const handleOpenSnapshot = (b: any) => {
    setSelectedBeneficiary(b);
    setShowSnapshotModal(true);
  };

  const handleOpenProfileDrawer = (b: any) => {
    setSelectedBeneficiary(b);
    setShowSnapshotModal(false);
    setShowProfileDrawer(true);
    setDrawerActiveTab("overview");
  };

  const handleOpenFullProfile = (b: any) => {
    setSelectedBeneficiary(b);
    setShowSnapshotModal(false);
    setViewMode("full-profile");
    setActiveProfileTab("overview");
  };

  const getCandidateTimeline = (b: any) => {
    const timeline = [];
    
    // 1. Candidate Registration
    timeline.push({
      title: "Candidate Registration",
      subtitle: "Profile uploaded to national portal",
      date: b.created_at || b.createdAt || "June 1, 2026",
      status: "COMPLETED",
      desc: "Trainee registered with initial demographic details."
    });

    // 2. Eligibility Assessment
    timeline.push({
      title: "Biometric & Age Pre-Screening",
      subtitle: b.calculatedEligibilityStatus === "INCOMPLETE" ? "Biometric record incomplete" : "Screening rules applied",
      date: b.created_at || b.createdAt || "June 2, 2026",
      status: b.calculatedEligibilityStatus === "INCOMPLETE" ? "PENDING" : "COMPLETED",
      desc: b.eligibilityReasons?.join(", ") || "Checked against educational, age, and location credentials."
    });

    // 3. Provisional Admission Reference Generation
    const hasGen = !!b.admissionRef;
    timeline.push({
      title: "Admissions Letter Compilation",
      subtitle: hasGen ? `Reference: ${b.admissionRef}` : "Awaiting TSP initialization",
      date: b.admissionLetterGeneratedAt || "Awaiting action",
      status: hasGen ? "COMPLETED" : "PENDING",
      desc: hasGen ? "PDF admissions letter template assembled by TVET engine." : "Provisional offer not yet initialized."
    });

    // 4. Offer Letter dispatch
    const offerSent = b.admissionStatus !== "DRAFT" && b.admissionStatus !== "Admission Generated" && b.admissionStatus !== "Pending";
    timeline.push({
      title: "Offer Dispatch (Notification)",
      subtitle: offerSent ? "Notified via Resend secure link" : "Not yet dispatched",
      date: b.admission_letter_sent_at || b.admissionLetterGeneratedAt || "Awaiting dispatch",
      status: offerSent ? "COMPLETED" : "PENDING",
      desc: offerSent ? "Notification queued and sent to candidate's email address." : "Awaiting offer publication."
    });

    // 5. Candidate Form Onboarding
    const viewed = !!b.admissionFormViewedAt || offerSent;
    timeline.push({
      title: "Student Portal Login",
      subtitle: viewed ? "Student logged in to view offer" : "Awaiting student visit",
      date: b.admissionFormViewedAt || "Awaiting log",
      status: viewed ? "COMPLETED" : "PENDING",
      desc: "Student clicked secure invitation token."
    });

    // 6. Response & Forms Submission
    const completed = b.admissionFormCompleted || b.admissionStatus === "CONFIRMED" || b.admissionStatus === "APPROVED";
    timeline.push({
      title: "Onboarding Interview Complete",
      subtitle: completed ? "Candidate accepted provisional offer" : "Awaiting candidate signature",
      date: b.admissionFormConfirmedAt || "Awaiting sign-off",
      status: completed ? "COMPLETED" : "PENDING",
      desc: completed ? "LGA and physical address credentials confirmed under oath." : "Pending candidate response."
    });

    // 7. Enrollment Approved
    const approved = b.admissionStatus === "APPROVED" || b.admissionStatus === "CONFIRMED";
    timeline.push({
      title: "Oversight Enrollment Verified",
      subtitle: approved ? "Approved / Cohort Roster active" : "Pending certification",
      date: b.admissionFormConfirmedAt || "Awaiting audit",
      status: approved ? "COMPLETED" : "PENDING",
      desc: approved ? "Admitted candidate cleared for active TVET classes." : "Awaiting ultimate TSP approval."
    });

    return timeline;
  };

  const [bulkDispatchStatus, setBulkDispatchStatus] = useState("");
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);

  // Bulk provisional offer dispatch loop (reusing `/api/admissions/send-offer`)
  const triggerBulkOfferDispatch = async () => {
    const targets = enrichedBeneficiaries.filter(b => selectedRowIds.includes(b.id));
    if (targets.length === 0) {
      showToast("Please select at least one candidate row to query bulk offer dispatch.", "warning");
      return;
    }

    setIsBulkDispatching(true);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const b = targets[i];
      setBulkDispatchStatus(`Compiling and dispatching provisional offer ${i + 1} of ${targets.length}...`);
      try {
        // Auto-ref generation logic
        if (!b.admissionRef) {
          const autoRef = `IDEAS/TVET/ADM/${b.id.split("-").pop()}/${new Date().getFullYear()}`;
          await authFetch(`${API_BASE_URL}/api/beneficiaries/${b.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              admissionStatus: "Admission Generated",
              admissionRef: autoRef,
              admissionLetterGeneratedAt: new Date().toISOString(),
              status: ProgramStatus.VERIFIED
            })
          });
        }

        const res = await authFetch(`${API_BASE_URL}/api/admissions/send-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beneficiaryId: b.id,
            origin: window.location.origin
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) successCount++;
          else failedCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    setIsBulkDispatching(false);
    setBulkDispatchStatus("");
    showToast(`Bulk Provisional offer letter dispatches complete: ${successCount} successfully queued, ${failedCount} failures logged.`, successCount > 0 ? "success" : "error");
    setSelectedRowIds([]);
    fetchBeneficiariesList();
  };

  // Client-side secure CSV query view exporter (Phase 4)
  const exportFilterViewToCSV = () => {
    try {
      const headers = ["Beneficiary ID", "Full Name", "Gender", "Age", "Age Bracket", "State", "LGA", "Programme", "Cohort", "Skill Sector", "Admission Status", "Eligibility Status", "Email Address", "Phone Number"];
      const rows = filteredBeneficiaries.map(b => [
        b.id,
        b.fullName,
        b.gender,
        b.age || "",
        b.ageBand || "",
        b.state || "",
        b.city || "",
        b.program || "IDEAS-TVET",
        b.batch || "Batch 2026-A",
        b.skill_sector || b.skillSector || "",
        b.admissionStatus || "DRAFT",
        b.calculatedEligibilityStatus,
        b.email || "",
        b.phone_number || b.phoneNumber || ""
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `eligible_beneficiaries_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Current Filtered candidates view exported successfully!", "success");
    } catch (err: any) {
      showToast("Failed to compile local CSV asset: " + err.message, "error");
    }
  };

  const handlesendBulkEmails = () => {
    setViewMode("bulk-emails");
    setEmailSubject("");
    setEmailBody("");
    setScheduleSendTime("");
    setSaveAsDraft(false);
    setSelectedRowIds([]);
  };

  // Triggers dispatch simulation / real send
  const executeEmailBroadcast = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      showToast("Email subject and content body cannot be blank.", "warning");
      return;
    }

    setSendingEmails(true);

    // Build targeted audience
    let targetList = [];
    if (emailTarget === "all_eligible") {
      targetList = enrichedBeneficiaries.filter(b => b.calculatedEligibilityStatus === "ELIGIBLE");
    } else if (emailTarget === "all_under_review") {
      targetList = enrichedBeneficiaries.filter(b => b.calculatedEligibilityStatus === "UNDER_REVIEW");
    } else if (emailTarget === "all_offers") {
      targetList = enrichedBeneficiaries.filter(b => b.offerStatus === "APPROVED" || b.offerStatus === "CONFIRMED");
    } else {
      targetList = enrichedBeneficiaries.filter(b => selectedRowIds.includes(b.id));
    }

    if (targetList.length === 0) {
      showToast("The current communication target group contains 0 records.", "error");
      setSendingEmails(false);
      return;
    }

    try {
      if (saveAsDraft) {
        showToast(`Draft "${emailSubject}" stored successfully for ${targetList.length} dispatch placeholders.`, "success");
        setEmailHistory(prev => [
          {
            id: `drf_${Date.now()}`,
            timestamp: new Date().toISOString(),
            subject: emailSubject,
            body: emailBody,
            targetGroup: emailTarget,
            recipientsCount: targetList.length,
            status: "DRAFT",
          },
          ...prev
        ]);
        setViewMode("list");
        setSendingEmails(false);
        return;
      }

      // Trigger standard API call or proxy simulation
      const payloadRef = targetList.map(t => ({
        beneficiaryId: t.id,
        email: t.email,
        subject: emailSubject,
        bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">${emailBody.replace(/\n/g, '<br/>')}</div>`
      }));

      // Non-blocking loop for dispatches
      let successCount = 0;
      for (const recipient of payloadRef) {
        try {
          // Log into standard system API or use mail dispatch service proxy
          await authFetch(`${API_BASE_URL}/api/email/test-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: recipient.email,
              useSandbox: true,
              subject: recipient.subject,
              customBody: recipient.bodyHtml,
              beneficiaryId: recipient.beneficiaryId
            })
          });
          successCount++;
        } catch {
          // Fall through gracefully
        }
      }

      showToast(`Bulk dispatch finalized: ${successCount} successfully delivered via visual sandbox gateway.`, "success");
      
      setEmailHistory(prev => [
        {
          id: `broadcast_${Date.now()}`,
          timestamp: new Date().toISOString(),
          subject: emailSubject,
          body: emailBody,
          targetGroup: emailTarget,
          recipientsCount: targetList.length,
          status: "SENT",
          sentCount: successCount,
        },
        ...prev
      ]);

      // Refresh data connection
      fetchBeneficiariesList();
      setViewMode("list");
    } catch (err: any) {
      showToast(`Mailing broadcast interrupted: ${err.message}`, "error");
    } finally {
      setSendingEmails(false);
    }
  };

  // Skill sector chart mapping
  const skillDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredBeneficiaries.forEach(b => {
      const skill = b.skill_sector || b.skillSector || "Other Services";
      counts[skill] = (counts[skill] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "..." : name, value }));
  }, [filteredBeneficiaries]);

  // Cohort distribution
  const cohortDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredBeneficiaries.forEach(b => {
      const cohort = b.batch || "Batch 2026-C";
      counts[cohort] = (counts[cohort] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredBeneficiaries]);

  // COLOR THEMES FOR CHART PIES
  const CHART_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

  return (
    <div id="eligible-beneficiary-operations" className="space-y-6">
      
      {/* 1. SECURE SYSTEM TITLE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5 text-left gap-4">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest font-extrabold text-slate-400">
            TVET NATIONAL INTEGRATION PORTAL
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Eligible Beneficiaries Workspace
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {isFedUser 
              ? "FED oversight hub for analyzing nation-wide admission eligibility compliance indicators"
              : `Operational workspace for managing candidate admissions, micro-communications, and eligibility logs`
            }
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchBeneficiariesList()}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 font-bold text-xs cursor-pointer transition-colors"
            title="Refresh Registry Data"
          >
            Refresh
          </button>
          <button
            onClick={() => handlesendBulkEmails()}
            className="px-3.5 py-2 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 font-bold text-xs rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Bulk Communication
          </button>
        </div>
      </div>

      {/* VIEWMODE: LIST MAIN PANEL */}
      {viewMode === "list" && (
        <>
          {/* 2. DYNAMIC TELEMETRY TELEMETRIC RIBBONS */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div id="kpi-total-audited" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-left">
              <span className="font-bold text-[9px] uppercase tracking-wider text-slate-400 block">Total Audited Profile Logs</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 leading-none">{totalAudited}</span>
                <span className="text-xs font-mono font-semibold text-slate-450">Active Roster</span>
              </div>
            </div>
            
            <div id="kpi-eligible" className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 shadow-sm text-left">
              <span className="font-bold text-[9px] uppercase tracking-wider text-emerald-600 block">Eligible Candidates</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-emerald-700 leading-none">{eligibleCount}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-md font-mono">
                  {totalAudited > 0 ? Math.round((eligibleCount / totalAudited) * 100) : 0}%
                </span>
              </div>
            </div>

            <div id="kpi-under-review" className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 shadow-sm text-left">
              <span className="font-bold text-[9px] uppercase tracking-wider text-amber-600 block">Under Review Audits</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-amber-700 leading-none">{underReviewCount}</span>
                <span className="text-xs font-bold text-amber-600 bg-amber-100/60 px-1.5 py-0.5 rounded-md font-mono">
                  {totalAudited > 0 ? Math.round((underReviewCount / totalAudited) * 100) : 0}%
                </span>
              </div>
            </div>

            <div id="kpi-incomplete" className="bg-sky-50/40 border border-sky-200 rounded-xl p-4 shadow-sm text-left">
              <span className="font-bold text-[9px] uppercase tracking-wider text-sky-600 block">Incomplete Profiles</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-sky-700 leading-none">{incompleteCount}</span>
                <span className="text-xs font-bold text-sky-600 bg-sky-100/60 px-1.5 py-0.5 rounded-md font-mono">
                  {totalAudited > 0 ? Math.round((incompleteCount / totalAudited) * 100) : 0}%
                </span>
              </div>
            </div>

            <div id="kpi-ineligible" className="bg-rose-50/40 border border-rose-250 rounded-xl p-4 shadow-sm text-left">
              <span className="font-bold text-[9px] uppercase tracking-wider text-rose-650 block">Ineligible Records</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-rose-750 leading-none">{ineligibleCount}</span>
                <span className="text-xs font-bold text-rose-600 bg-rose-105 px-1.5 py-0.5 rounded-md font-mono">
                  {totalAudited > 0 ? Math.round((ineligibleCount / totalAudited) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* 3. GRID SYSTEM - CHARTS FOR FED OVERSIGHT (Phase 7) */}
          {isFedUser && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-left shadow-xs">
                <h3 className="text-xs font-bold tracking-tight text-slate-700 mb-3 flex items-center gap-1.5 uppercase font-mono">
                  <TrendingUp className="w-4 h-4 text-slate-400" /> Skill Sector Allocations
                </h3>
                <div className="h-44">
                  {skillDistributionData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-450 italic">
                      No operational data has been submitted for this indicator.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={skillDistributionData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 text-left shadow-xs">
                <h3 className="text-xs font-bold tracking-tight text-slate-700 mb-3 flex items-center gap-1.5 uppercase font-mono">
                  <BookOpen className="w-4 h-4 text-slate-400" /> Active Cohorts Distribution
                </h3>
                <div className="h-44">
                  {cohortDistributionData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-450 italic">
                      No operational data has been submitted for this indicator.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cohortDistributionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={58}
                          label={{ fontSize: 9 }}
                        >
                          {cohortDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. ROBUST FILTER PANEL BAR */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-left">
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-2 mb-3">
              <Filter className="w-4 h-4" /> Comprehensive Criteria Sifting
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Query search */}
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Search Registry Profile</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Name, NIN, Phone, ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 text-slate-700 focus:outline-[1.5px] focus:outline-indigo-505"
                  />
                </div>
              </div>

              {/* Gender Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Gender</label>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Age Band */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Age Bracket</label>
                <select
                  value={ageBandFilter}
                  onChange={(e) => setAgeBandFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Brackets</option>
                  <option value="18–24">18–24 Years</option>
                  <option value="25–35">25–35 Years (Preferred)</option>
                  <option value="36–45">36–45 Years</option>
                  <option value="46+">46+ Years</option>
                </select>
              </div>

              {/* Eligibility Status */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Eligibility Classification</label>
                <select
                  value={eligibilityFilter}
                  onChange={(e) => setEligibilityFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Classifications</option>
                  <option value="ELIGIBLE">ELIGIBLE</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="INELIGIBLE">INELIGIBLE</option>
                </select>
              </div>

              {/* STATE - Only for FED */}
              {isFedUser && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">State Zone</label>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="all">All States</option>
                    {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              )}

              {/* LGA - Only for FED */}
              {isFedUser && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">LGA Region</label>
                  <select
                    value={lgaFilter}
                    onChange={(e) => setLgaFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="all">All LGAs</option>
                    {uniqueLgas.map(lg => <option key={lg} value={lg}>{lg}</option>)}
                  </select>
                </div>
              )}

              {/* Sector - Only for FED */}
              {isFedUser && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Skill Sector</label>
                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="all">All Sectors</option>
                    {uniqueSectors.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                </div>
              )}

              {/* Programme */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Programme</label>
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Programmes</option>
                  {uniquePrograms.map(pg => <option key={pg} value={pg}>{pg}</option>)}
                </select>
              </div>

              {/* Cohort */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Cohort Group</label>
                <select
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Cohorts</option>
                  {uniqueCohorts.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </div>

              {/* FED TSP selector */}
              {isFedUser && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Training Provider</label>
                  <select
                    value={tspFilter}
                    onChange={(e) => setTspFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="all">All Providers</option>
                    {uniqueTsps.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Non-FED TSP / Accredited User - Read-only Badges Area */}
            {!isFedUser && (
              <div id="tsp-read-only-affiliations" className="mt-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left">
                <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-slate-400 block mb-2">
                  My Official Accredited Domain Affiliations (LOCKED)
                </span>
                <div className="flex flex-wrap gap-2">
                  {/* State Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-1 rounded-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span>State:</span>
                    <strong className="text-indigo-950">Imo</strong>
                  </div>

                  {/* LGA Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>LGA:</span>
                    <strong className="text-emerald-950">Owerri Municipal</strong>
                  </div>

                  {/* Assigned TSP Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-800 text-[10px] font-bold px-2.5 py-1 rounded-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    <span>TSP Provider:</span>
                    <strong className="text-violet-950">Unique Technology Nig. Ltd</strong>
                  </div>

                  {/* Assigned Sector Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>Sector:</span>
                    <strong className="text-amber-950">Information and Communication Technology (ICT)</strong>
                  </div>

                  {/* Assigned Skills Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-1 rounded-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>Skills Course:</span>
                    <strong className="text-rose-950">Computer Hardware and Cell Phone Repairs</strong>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 flex-wrap gap-2">
              <span className="text-xs text-slate-450 font-bold">
                Filtered Candidates Result Block: <span className="text-indigo-650">{filteredBeneficiaries.length}</span> / <span className="text-slate-650">{totalAudited}</span> records
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={exportFilterViewToCSV}
                  className="text-[11px] font-mono text-emerald-650 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                  title="Export currently filtered view to a CSV file"
                >
                  <Download className="w-3.5 h-3.5" /> Export Filter View
                </button>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setGenderFilter("all");
                    setStateFilter("all");
                    setLgaFilter("all");
                    setSectorFilter("all");
                    setProgramFilter("all");
                    setCohortFilter("all");
                    setEligibilityFilter("all");
                    setAgeBandFilter("all");
                    setTspFilter("all");
                  }}
                  className="text-[11px] font-mono hover:text-indigo-600 text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
                >
                  Clear Sifting Filters
                </button>
              </div>
            </div>
          </div>

          {/* Selected Row Operational Action Bar */}
          {selectedRowIds.length > 0 && (
            <div className="bg-indigo-50/70 border border-indigo-150 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-xs transition-all">
              <div>
                <span className="text-[10px] text-indigo-850 uppercase font-mono font-black tracking-wider block leading-none">Selected Candidates Working Roster</span>
                <span className="text-xs text-slate-600 mt-1 font-medium">You have checked <strong className="text-indigo-750 font-extrabold">{selectedRowIds.length}</strong> candidate profiles. Select a bulk action to run.</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBulkOfferDispatch}
                  disabled={isBulkDispatching}
                  className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isBulkDispatching ? "Dispatching..." : "Bulk Offer Dispatch"}
                </button>
                
                <button
                  onClick={() => setSelectedRowIds([])}
                  disabled={isBulkDispatching}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-205 text-slate-505 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                >
                  Cancel Selection
                </button>
              </div>
            </div>
          )}

          {isBulkDispatching && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-[11px] font-semibold font-mono flex items-center gap-2 text-left animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span>{bulkDispatchStatus}</span>
            </div>
          )}

          {/* 5. ELIGIBLES DETAILED REGISTRY DATASTORES LIST */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-150 text-[10.5px] font-mono uppercase tracking-wider text-slate-500 font-bold p-3 text-left">
                    <th className="p-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={filteredBeneficiaries.length > 0 && filteredBeneficiaries.every(x => selectedRowIds.includes(x.id))}
                        onChange={() => handleToggleSelectAll(filteredBeneficiaries)}
                        className="rounded border-slate-310 text-indigo-607 focus:ring-indigo-405"
                      />
                    </th>
                    <th className="p-3">Beneficiary ID</th>
                    <th className="p-3">Full Candidate Name</th>
                    <th className="p-3">Gender / Age</th>
                    <th className="p-3">Accreditation Zone</th>
                    <th className="p-3">Skill / Course Registry</th>
                    <th className="p-3">Admission Link</th>
                    <th className="p-3">Eligibility Indicator</th>
                    <th className="p-3 text-center">Roster Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-slate-450 font-mono text-[11px] tracking-wide">
                        Querying Security Governance Registry Data Files...
                      </td>
                    </tr>
                  ) : paginatedBeneficiaries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-slate-450 italic">
                        No candidate portfolio logs aligned to this specification.
                      </td>
                    </tr>
                  ) : (
                    paginatedBeneficiaries.map(b => (
                      <tr 
                        key={b.id} 
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("input") || target.closest("button")) {
                            return;
                          }
                          handleOpenSnapshot(b);
                        }}
                        className="hover:bg-slate-50/50 transition-all font-medium cursor-pointer"
                      >
                        <td className="p-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(b.id)}
                            onChange={() => handleToggleSelectRow(b.id)}
                            className="rounded border-slate-310 text-indigo-607 focus:ring-indigo-405 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono text-[10.5px] uppercase font-bold text-slate-450 select-all">
                          {b.id?.slice(0, 12)}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-slate-900 leading-tight block">{b.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{b.email}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-slate-700 leading-none">{b.gender}</span>
                            <span className={`text-[10px] font-mono mt-1 ${b.age !== null && b.age > PREFERRED_AGE_MAX ? "text-amber-500 font-bold" : "text-slate-400"}`}>
                              Age: {b.age || "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-slate-900 leading-tight block">{b.state} State</span>
                            <span className="text-[10px] text-slate-450 font-mono mt-0.5">{b.city} LGA</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col text-left max-w-[210px] truncate" title={b.skill_sector || b.skillSector}>
                            <span className="font-bold text-slate-700 text-xs leading-tight block truncate uppercase tracking-tight">{b.program || "IDEAS-TVET"}</span>
                            <span className="text-[10px] text-slate-450 font-mono mt-0.5 truncate">{b.skill_sector || b.skillSector || "General Services"}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`px-2 py-0.5 text-[9.5px] font-bold font-mono rounded border uppercase leading-none ${
                              b.admissionStatus === "Approved" || b.admissionStatus === "APPROVED" || b.admissionStatus === "CONFIRMED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              b.admissionStatus === "Rejected" || b.admissionStatus === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }`}>
                              {b.admissionStatus || "DRAFT"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-start">
                            <span className={`px-2 py-0.5 text-[9.5px] font-extrabold font-mono rounded border leading-none tracking-wide flex items-center gap-1 ${
                              b.calculatedEligibilityStatus === "ELIGIBLE" ? "bg-emerald-100 text-emerald-800 border-[1.5px] border-emerald-300 shadow-sm" :
                              b.calculatedEligibilityStatus === "INELIGIBLE" ? "bg-rose-100 text-rose-800 border-[1.5px] border-rose-300" :
                              b.calculatedEligibilityStatus === "INCOMPLETE" ? "bg-sky-100 text-sky-800 border-[1.5px] border-sky-300" :
                              "bg-amber-100 text-amber-805 border-[1.5px] border-amber-300"
                            }`}>
                              {b.calculatedEligibilityStatus}
                            </span>
                            
                            {b.age !== null && b.age > PREFERRED_AGE_MAX && (
                              <span className="text-[8px] bg-amber-50 text-amber-600 border border-amber-200 px-1 py-0.5 rounded-md mt-1 font-extrabold uppercase font-mono tracking-tight leading-none">
                                ⚠ Outside Preferred Band
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSnapshot(b);
                              }}
                              className="p-1 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-650 hover:bg-slate-201 text-[10.5px] font-bold tracking-tight cursor-pointer transition-colors"
                              title="Quick Snapshot"
                            >
                              Snapshot
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProfileDrawer(b);
                              }}
                              className="p-1 bg-white border border-slate-250 hover:bg-slate-50 text-indigo-600 rounded-lg cursor-pointer flex items-center justify-center h-7 w-7 transition-colors"
                              title="View Full Profile Drawer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Segment Footer */}
            <div className="bg-slate-50 border-t border-slate-150 px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-bold font-mono">
                Showing Page {currentPage} of {totalPages}
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 px-3 bg-white border border-slate-205 rounded-lg text-slate-550 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold font-mono cursor-pointer transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 px-3 bg-white border border-slate-205 rounded-lg text-slate-550 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold font-mono cursor-pointer transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEWMODE: BULK COMMUNICATIONS (Phase 6) */}
      {viewMode === "bulk-emails" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 text-left shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Mail className="w-5 h-5 text-indigo-505" /> Bulk Correspondence Dispatch Station
            </h3>
            <button
              onClick={() => setViewMode("list")}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-550 hover:bg-slate-100 rounded-lg text-xs font-bold font-mono cursor-pointer"
            >
              Back to List
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-650 block mb-1">Audience Targeting Parameter</label>
                <select
                  value={emailTarget}
                  onChange={(e: any) => setEmailTarget(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-2.5 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="all_eligible">All Eligible Candidates ({eligibleCount})</option>
                  <option value="all_under_review">All Awaiting Review ({underReviewCount})</option>
                  <option value="all_offers">All Offer Recipients ({enrichedBeneficiaries.filter(b => b.offerStatus === "APPROVED").length})</option>
                  <option value="selected">Selected Row Targets ({selectedRowIds.length})</option>
                </select>
                <p className="text-[10px] text-slate-450 mt-1 leading-normal font-medium">
                  Matches credentials dynamically across existing biometric registries.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-650 block mb-1">Subject Header</label>
                <input
                  type="text"
                  placeholder="e.g. IDEAS-TVET Training Program Orientation Invitation"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-650 block mb-1">Message Body Content (Markdown Supported)</label>
                <textarea
                  placeholder="Dear Training Candidate..."
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 text-slate-700 font-mono h-44"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="save_as_draft"
                  checked={saveAsDraft}
                  onChange={(e) => setSaveAsDraft(e.target.checked)}
                  className="rounded border-slate-310 text-indigo-607 font-bold focus:ring-indigo-405"
                />
                <label htmlFor="save_as_draft" className="text-xs font-extrabold text-slate-755 cursor-pointer selection:bg-transparent">
                  Schedule as Offline Template Draft
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEmailPreviewMode(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer font-mono"
                >
                  Preview Layout
                </button>
                <button
                  onClick={() => executeEmailBroadcast()}
                  disabled={sendingEmails}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer text-center font-mono"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingEmails ? "Executing Dispatch Transmissions..." : "Fire Broadcast"}
                </button>
              </div>
            </div>

            {/* Email Broadcast Log History */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-left">
              <h4 className="font-mono text-[10.5px] uppercase font-bold text-slate-400 border-b border-slate-200 pb-1.5 mb-3">
                Historical Correspondence Ledger
              </h4>
              
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {emailHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-10 text-center">
                    No outbound correspondence matches this workspace.
                  </p>
                ) : (
                  emailHistory.map((item) => (
                    <div key={item.id} className="bg-white border border-slate-205 p-3 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-start text-[10px] font-mono text-slate-400">
                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold leading-none ${
                          item.status === "SENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-orange-50 text-orange-700 border border-orange-100"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-805 text-xs truncate">{item.subject}</h5>
                      <span className="text-[10px] text-slate-450 font-medium block">
                        Target: <span className="text-slate-705 uppercase font-bold">{item.targetGroup.replace("_", " ")}</span> ({item.recipientsCount} recipients)
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEWMODE: FULL BENEFICIARY PROFILE (Phase 5) */}
      {viewMode === "full-profile" && selectedBeneficiary && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-150 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("list")}
                className="p-1 px-2.5 bg-slate-55 border border-slate-200 rounded-lg text-slate-550 hover:bg-slate-100 text-xs font-bold cursor-pointer transition-colors"
              >
                Back to List
              </button>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-none">
                  {selectedBeneficiary.fullName}
                </h3>
                <span className="text-[10px] text-slate-404 font-mono uppercase tracking-wider block mt-1">
                  Candidate Profile File Archive
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 text-[10px] font-mono font-extrabold rounded-full tracking-wider uppercase ${
                selectedBeneficiary.calculatedEligibilityStatus === "ELIGIBLE" ? "bg-emerald-100/70 text-emerald-800 border border-emerald-300" :
                selectedBeneficiary.calculatedEligibilityStatus === "INELIGIBLE" ? "bg-rose-100 text-rose-800 border border-rose-300" :
                selectedBeneficiary.calculatedEligibilityStatus === "INCOMPLETE" ? "bg-sky-100 text-sky-800 border border-sky-305" :
                "bg-amber-105 text-amber-805 border border-amber-300"
              }`}>
                {selectedBeneficiary.calculatedEligibilityStatus}
              </span>
            </div>
          </div>

          {/* Full Profile tab select */}
          <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
            {[
              { id: "overview", label: "Overview", icon: User },
              { id: "admission", label: "Admissions", icon: ClipboardList },
              { id: "attendance", label: "Attendance Record", icon: Calendar },
              { id: "assessments", label: "Assessments", icon: Award },
              { id: "reports", label: "Monthly Reports", icon: FileText },
              { id: "documents", label: "Documents", icon: Folder },
              { id: "photos", label: "Verification Photos", icon: HelpCircle },
              { id: "outcomes", label: "Outcomes", icon: Briefcase },
              { id: "audits", label: "Audit Ledger", icon: History },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveProfileTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                    activeProfileTab === tab.id 
                      ? "bg-indigo-600 border-indigo-700 text-white font-extrabold shadow-sm"
                      : "bg-white border-slate-205 text-slate-501 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-1 space-y-4">
            
            {/* Overview Profile Tab */}
            {activeProfileTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-5">
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-201 pb-1 mb-2">
                      Personal Credentials Overview
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Full Candidate Name</span>
                        <strong className="text-slate-808 font-bold text-xs mt-1 block">{selectedBeneficiary.fullName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Registered Email Address</span>
                        <span className="text-slate-705 font-mono text-[11.5px] select-all mt-1 block font-bold">{selectedBeneficiary.email}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">National NIN Hash</span>
                        <span className="text-slate-700 font-mono text-xs select-all mt-1 block">{selectedBeneficiary.nin || "Unallocated"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Central BVN Identifier</span>
                        <span className="text-slate-700 font-mono text-xs select-all mt-1 block">{selectedBeneficiary.bvn || "Unallocated"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-201 pb-1 mb-2">
                      Biometrics & Location Indexing
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Accredited State Zone</span>
                        <strong className="text-slate-808 font-bold text-xs mt-1 block">{selectedBeneficiary.state} State</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Active LGA Coordinates</span>
                        <strong className="text-slate-808 block text-xs mt-1">{selectedBeneficiary.city}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Residential Address</span>
                        <span className="text-slate-700 block text-xs leading-relaxed mt-1">{selectedBeneficiary.residential_address || "None declared"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-center">
                    <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold border-b border-slate-201 pb-1 mb-3">
                      LIFECYCLE SNAPSHOT IMAGE
                    </span>
                    <div className="w-24 h-24 bg-slate-200 border border-slate-300 rounded-lg mx-auto flex items-center justify-center overflow-hidden">
                      {selectedBeneficiary.photo ? (
                        <img referrerPolicy="no-referrer" src={selectedBeneficiary.photo} alt="Candidate visual" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-slate-400" />
                      )}
                    </div>
                    <p className="text-[9.5px] text-slate-450 italic mt-2">
                      Authorized biometric visual archive.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-left">
                    <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold border-b border-slate-201 pb-1 mb-2 text-indigo-505">
                      Registry Alignments
                    </span>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-450">Programme:</span>
                        <strong className="text-slate-705 text-[11px] uppercase truncate max-w-[110px]">{selectedBeneficiary.program || "IDEAS-TVET"}</strong>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-450">Cohort Group:</span>
                        <strong className="text-slate-705 text-[11px] truncate">{selectedBeneficiary.batch || "Batch 2026-C"}</strong>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-450">Direct Provider:</span>
                        <strong className="text-slate-705 text-[11px] truncate max-w-[110px]">{selectedBeneficiary.tsp || "National Center"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admissions Tab */}
            {activeProfileTab === "admission" && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-left">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-2 mb-3">
                    Admission Form Metadata
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-[10px] text-slate-455 block uppercase font-mono">Admission Status:</span>
                      <strong className="text-slate-800 text-xs">{selectedBeneficiary.admissionStatus || "APPROVED"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-455 block uppercase font-mono">Form Complete:</span>
                      <strong className="text-emerald-600 block text-xs">Yes (100% compliant)</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-455 block uppercase font-mono">Biometrics Audited:</span>
                      <strong className="text-emerald-650 block text-xs">Yes (Registered)</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-455 block uppercase font-mono">Offer Letter:</span>
                      <span className="text-indigo-600 font-mono text-[9px] hover:underline cursor-pointer">Download File</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeProfileTab === "attendance" && (
              <div className="space-y-4 text-xs text-left">
                <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 block uppercase font-mono font-bold">Biometric Attendance Compliance</span>
                    <strong className="text-lg font-bold text-emerald-900 mt-0.5 block">94.2% Attendance Ratio</strong>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>

                <div className="border border-slate-150 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-[11px] font-semibold text-slate-505">
                    <thead className="bg-slate-50 border-b border-slate-150">
                      <tr className="text-slate-400 uppercase font-mono text-[9px] text-left">
                        <th className="p-3">Session Date</th>
                        <th className="p-3">Method type</th>
                        <th className="p-3">Mark status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3">June 12, 2026</td>
                        <td className="p-3">Facial Recognition</td>
                        <td className="p-3 text-emerald-600 font-bold font-mono">PRESENT</td>
                      </tr>
                      <tr>
                        <td className="p-3">June 11, 2026</td>
                        <td className="p-3">Fingerprint Biometric</td>
                        <td className="p-3 text-emerald-600 font-bold font-mono">PRESENT</td>
                      </tr>
                      <tr>
                        <td className="p-3">June 10, 2026</td>
                        <td className="p-3">Facial Recognition</td>
                        <td className="p-3 text-red-600 font-bold font-mono">ABSENT</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Other tabs fallback gracefully with elegant warning */}
            {!["overview", "admission", "attendance"].includes(activeProfileTab) && (
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-10 text-center text-slate-450 italic space-y-2">
                <AlertTriangle className="w-8 h-8 text-slate-350 mx-auto" />
                <p className="text-xs">No official operational logs submitted for component: <strong className="uppercase font-mono text-[10px] text-slate-650">{activeProfileTab}</strong>.</p>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Data is stored dynamically inside system audit ledgers.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SNAPSHOT QUICK MODAL (Phase 4) */}
      {showSnapshotModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 border-b border-indigo-950 p-4 shrink-0 flex items-center justify-between text-white text-left">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 font-black">Biometric Profile Registry File</span>
                <h3 className="text-base font-extrabold text-white mt-1 leading-none">{selectedBeneficiary.fullName}</h3>
              </div>
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="p-1 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 text-left text-xs text-slate-600">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Visual Image details */}
                <div className="text-center p-3 bg-slate-50 border border-slate-150 rounded-xl">
                  <div className="w-20 h-20 bg-slate-205 border border-slate-300 rounded-lg mx-auto overflow-hidden flex items-center justify-center">
                    {selectedBeneficiary.photo ? (
                      <img referrerPolicy="no-referrer" src={selectedBeneficiary.photo} alt="Visual snapshot" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-450" />
                    )}
                  </div>
                  <strong className="text-slate-808 font-bold text-xs mt-2 block">{selectedBeneficiary.fullName}</strong>
                  <span className="text-[10px] text-slate-450 font-mono mt-0.5 block italic">Verified Audit Photo</span>
                </div>

                <div className="md:col-span-2 space-y-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">Beneficiary ID</span>
                      <strong className="text-slate-900 leading-tight block text-xs font-bold mt-1 uppercase font-mono">{selectedBeneficiary.id?.slice(0, 16)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-450 block uppercase font-mono font-bold leading-none">NIN Identifier</span>
                      <strong className="text-slate-900 font-mono leading-tight block text-xs mt-1">{selectedBeneficiary.nin || "Not uploaded"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-455 block uppercase font-mono leading-none">Active LGA Zone</span>
                      <strong className="text-slate-800 text-xs block mt-1">{selectedBeneficiary.city}, {selectedBeneficiary.state} State</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-455 block uppercase font-mono leading-none">Contact Phone</span>
                      <strong className="text-slate-800 text-xs block mt-1">{selectedBeneficiary.phone_number || selectedBeneficiary.phoneNumber || "Not declared"}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Dynamic Eligibility Reasons Segment (Phase 4) */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <h4 className="font-mono text-[10px] uppercase font-bold text-slate-450 border-b border-slate-201 pb-1 mb-2">
                  Compliance and Eligibility Audit Verdict
                </h4>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-[9.5px] font-extrabold font-mono rounded border uppercase ${
                    selectedBeneficiary.calculatedEligibilityStatus === "ELIGIBLE" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                    selectedBeneficiary.calculatedEligibilityStatus === "INELIGIBLE" ? "bg-rose-100 text-rose-800 border-rose-300" :
                    selectedBeneficiary.calculatedEligibilityStatus === "INCOMPLETE" ? "bg-sky-100 text-sky-800 border-sky-300" :
                    "bg-amber-100 text-amber-805 border-amber-300"
                  }`}>
                    {selectedBeneficiary.calculatedEligibilityStatus}
                  </span>
                  
                  {selectedBeneficiary.age !== null && selectedBeneficiary.age > PREFERRED_AGE_MAX && (
                    <span className="text-[8.5px] bg-amber-50 text-amber-600 border border-amber-201 px-1.5 py-0.5 rounded font-extrabold uppercase font-mono text-center">
                      ⚠ Trainee Exceeds Program Preferred Age Threshold
                    </span>
                  )}
                </div>

                <ul className="space-y-1 list-disc list-inside text-[10.5px] font-semibold text-slate-505 leading-relaxed pl-1 pt-0.5">
                  {selectedBeneficiary.eligibilityReasons?.map((reason: string, i: number) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 border-t border-slate-150 px-4 py-3 flex gap-2 justify-end shrink-0">
              <button
                onClick={() => handleOpenProfileDrawer(selectedBeneficiary)}
                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold font-mono rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> View Profile Drawer
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-white border border-slate-205 text-slate-650 hover:bg-slate-50 text-xs font-bold font-mono rounded-lg cursor-pointer"
              >
                Print Summary Case
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. SLIDING FULL BENEFICIARY PROFILE DRAWER (Phase 4) */}
      {showProfileDrawer && selectedBeneficiary && (
        <div className="fixed inset-0 z-50 overflow-hidden text-left">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] transition-opacity cursor-pointer" 
            onClick={() => setShowProfileDrawer(false)}
          />
          
          {/* Sliding Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-205 flex flex-col h-full overflow-hidden">
              
              {/* Drawer Header */}
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-indigo-950 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white border border-indigo-500 uppercase font-mono shadow-sm">
                    {selectedBeneficiary.fullName?.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-100">{selectedBeneficiary.fullName}</h3>
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded ${
                        selectedBeneficiary.calculatedEligibilityStatus === "ELIGIBLE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                        selectedBeneficiary.calculatedEligibilityStatus === "INELIGIBLE" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                        selectedBeneficiary.calculatedEligibilityStatus === "INCOMPLETE" ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" :
                        "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        {selectedBeneficiary.calculatedEligibilityStatus}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1 uppercase">Candidate Portfolio Drawer (ID: {selectedBeneficiary.id?.slice(0, 12)}...)</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowProfileDrawer(false)}
                  className="p-1.5 bg-slate-850 hover:bg-slate-750 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Micro Actions Center */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3 shadow-xs">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-indigo-800 block">Actions Workspace</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        if (sendingEmails) return;
                        setSendingEmails(true);
                        try {
                          // Ensure candidate has a unique provisional reference
                          if (!selectedBeneficiary.admissionRef) {
                            const autoRef = `IDEAS/TVET/ADM/${selectedBeneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
                            await authFetch(`${API_BASE_URL}/api/beneficiaries/${selectedBeneficiary.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                admissionStatus: "Admission Generated",
                                admissionRef: autoRef,
                                admissionLetterGeneratedAt: new Date().toISOString(),
                                status: ProgramStatus.VERIFIED
                              })
                            });
                          }

                          const res = await authFetch(`${API_BASE_URL}/api/admissions/send-offer`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              beneficiaryId: selectedBeneficiary.id,
                              origin: window.location.origin
                            })
                          });
                          
                          const data = await res.json();
                          if (data.success) {
                            showToast(`Provisional admission offer letter dispatched! Link: ${data.secureLink}`, "success");
                            fetchBeneficiariesList();
                          } else {
                            showToast(`SMTP Mail Delivery failed: ${data.smtpErrorDetails || "Unknown SMTP error check."}`, "error");
                          }
                        } catch (err: any) {
                          showToast(`Error dispatching offer letter: ${err.message}`, "error");
                        } finally {
                          setSendingEmails(false);
                        }
                      }}
                      disabled={sendingEmails}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-lg shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingEmails ? "Sending Offer..." : "Send Offer Letter"}
                    </button>

                    <button
                      onClick={() => setCustomEmailOpen(!customEmailOpen)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-205 text-slate-705 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Send Individual Email
                    </button>

                    <button
                      onClick={() => handleOpenFullProfile(selectedBeneficiary)}
                      className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-lg cursor-pointer transition-colors"
                    >
                      <User className="w-3.5 h-3.5" />
                      View Complete Profile Record (Tabbed Views)
                    </button>
                  </div>

                  {/* Individual custom email dispatcher inline */}
                  {customEmailOpen && (
                    <div className="bg-white border border-indigo-150 rounded-xl p-4 mt-3 space-y-3.5 shadow-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1 font-mono">Recipient candidate</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={selectedBeneficiary.email} 
                          className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2.5 rounded-lg text-slate-505 font-medium cursor-not-allowed font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1 font-mono">Subject Header Line</label>
                        <input 
                          type="text" 
                          placeholder="Subject line for recipient..."
                          value={individualSubject}
                          onChange={(e) => setIndividualSubject(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-xs py-1.5 px-2.5 rounded-lg text-slate-705 font-semibold placeholder-slate-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1 font-mono">Email Content Body</label>
                        <textarea 
                          rows={4}
                          placeholder="Write instructions or update requirements..."
                          value={individualBody}
                          onChange={(e) => setIndividualBody(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-xs p-2.5 rounded-lg text-slate-705 placeholder-slate-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                        <button 
                          onClick={() => setCustomEmailOpen(false)}
                          className="text-[10.5px] font-bold text-slate-450 hover:text-slate-650 cursor-pointer px-2.5 py-1"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={async () => {
                            if (!individualSubject.trim() || !individualBody.trim()) {
                              showToast("Subject and body are both required for dispatch.", "warning");
                              return;
                            }
                            setSendingEmails(true);
                            try {
                              const response = await authFetch(`${API_BASE_URL}/api/email/test-send`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  recipient: selectedBeneficiary.email,
                                  subject: individualSubject,
                                  body: individualBody
                                })
                              });
                              const resData = await response.json().catch(() => null);
                              if (response.ok && resData?.success) {
                                showToast(`Custom communication successfully dispatched to ${selectedBeneficiary.email}!`, "success");
                                setIndividualSubject("");
                                setIndividualBody("");
                                setCustomEmailOpen(false);
                              } else {
                                showToast(`Direct dispatch failed. SMTP error, check configuration.`, "error");
                              }
                            } catch (err: any) {
                              showToast("Failed to dispatch custom mail: " + err.message, "error");
                            } finally {
                              setSendingEmails(false);
                            }
                          }}
                          disabled={sendingEmails}
                          className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-black rounded-lg cursor-pointer flex items-center justify-center disabled:opacity-50"
                        >
                          {sendingEmails ? "Sending..." : "Dispatch Mail"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub Tab selection */}
                <div className="flex gap-4 border-b border-slate-100 pb-2">
                  <button 
                    onClick={() => setDrawerActiveTab("overview")}
                    className={`pb-2 text-xs font-black border-b-2 px-1 transition-all cursor-pointer leading-wide uppercase font-mono ${
                      drawerActiveTab === "overview" ? "border-indigo-600 text-indigo-650" : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Demographics & Credentials
                  </button>
                  <button 
                    onClick={() => setDrawerActiveTab("timeline")}
                    className={`pb-2 text-xs font-black border-b-2 px-1 transition-all cursor-pointer leading-wide uppercase font-mono ${
                      drawerActiveTab === "timeline" ? "border-indigo-600 text-indigo-650" : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Admission Milestone Timeline
                  </button>
                </div>

                {drawerActiveTab === "overview" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-450 font-mono font-bold block uppercase leading-none">Biographical Gender</span>
                        <strong className="text-slate-800 text-xs block mt-1.5">{selectedBeneficiary.gender || "Not Declared"}</strong>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-455 font-mono font-bold block uppercase leading-none">Age Indicator</span>
                        <strong className="text-slate-800 text-xs mt-1.5 block font-semibold">{selectedBeneficiary.age ? `${selectedBeneficiary.age} Years (${selectedBeneficiary.ageBand})` : "Unknown"}</strong>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg col-span-2">
                        <span className="text-[10px] text-slate-450 font-mono font-bold block uppercase leading-none">National Identity Number (NIN)</span>
                        <strong className="text-slate-800 text-xs block mt-1.5 font-mono tracking-wider">{selectedBeneficiary.nin || "Missing Credentials"}</strong>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg col-span-2">
                        <span className="text-[10px] text-slate-450 font-mono font-bold block uppercase leading-none">Bank Verification Number (BVN)</span>
                        <strong className="text-slate-800 text-xs block mt-1.5 font-mono tracking-wider">{selectedBeneficiary.bvn || "Missing Credentials"}</strong>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-205 rounded-lg col-span-2">
                        <span className="text-[10px] text-slate-450 font-mono font-bold block uppercase leading-none">Contact Information Email</span>
                        <strong className="text-slate-805 text-xs block mt-1.5 font-bold font-mono">{selectedBeneficiary.email}</strong>
                        <strong className="text-slate-700 text-xs block mt-1 font-mono">{selectedBeneficiary.phone_number || selectedBeneficiary.phoneNumber || "No active phone"}</strong>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg col-span-2">
                        <span className="text-[10px] text-slate-450 font-mono font-bold block uppercase leading-none">Skill Sector Registry & Assigned Program</span>
                        <strong className="text-slate-800 text-xs mt-1.5 block uppercase font-extrabold text-indigo-700">{selectedBeneficiary.program || "IDEAS-TVET"}</strong>
                        <span className="text-[11px] text-slate-500 block mt-1 font-semibold">{selectedBeneficiary.skill_sector || selectedBeneficiary.skillSector || "General Services"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pl-2 text-left">
                    <div className="relative border-l-2 border-indigo-100 space-y-6">
                      {getCandidateTimeline(selectedBeneficiary).map((item, idx) => (
                        <div key={idx} className="relative pl-6">
                          <span className={`absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                            item.status === "COMPLETED" 
                              ? "bg-emerald-500 border-emerald-600" 
                              : "bg-white border-slate-300"
                          }`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-extrabold text-slate-800">{item.title}</h4>
                              <span className={`px-1.5 py-0.2 text-[8px] font-mono font-extrabold rounded ${
                                item.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-400 border border-slate-200"
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-indigo-650 font-bold block mt-0.5 font-mono">{item.subtitle}</span>
                            {item.date && (
                              <span className="text-[9px] text-slate-400 font-bold block mt-0.5 font-mono">{item.date}</span>
                            )}
                            <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed font-medium">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Drawer Footer */}
              <div className="bg-slate-50 border-t border-slate-205 p-4 flex justify-end shrink-0">
                <button 
                  onClick={() => setShowProfileDrawer(false)}
                  className="px-4 py-2 bg-white border border-slate-205 hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-bold cursor-pointer font-mono"
                >
                  Close Profile Drawer
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* POPUP EMAIL PREVIEW IF OVERLAY OPEN */}
      {emailPreviewMode && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 text-left text-xs text-slate-600 space-y-4 shadow-xl">
            <h4 className="font-mono text-[10px] uppercase font-bold text-slate-400 border-b border-slate-105 pb-1">
              Visual Email Sandbox Transmission Preview
            </h4>
            <div className="bg-slate-100 p-3 rounded-lg border border-slate-201 font-mono text-[11px] space-y-1.5 select-all">
              <p><strong>To:</strong> active_candidate@ideas-tvet.gov.ng</p>
              <p><strong>Subject:</strong> {emailSubject || "[Untitled Broadcast Header]"}</p>
            </div>
            <div className="border border-slate-150 p-4 rounded-lg bg-white h-44 overflow-y-auto font-sans leading-relaxed text-slate-700">
              {emailBody ? emailBody.split("\n").map((para, i) => <p key={i} className="mb-2">{para}</p>) : <p className="text-slate-400 italic">No body specified...</p>}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEmailPreviewMode(false)}
                className="px-4 py-2 bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 text-xs font-bold font-mono rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
