/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Building, ShieldCheck, HelpCircle, ArrowRight, CheckCircle2, 
  Users, MapPin, Award, GraduationCap, ChevronRight, ChevronDown, Check,
  Cpu, Scissors, Zap, Hammer, Sprout, Car, Sparkles, MessageSquare, BookOpen, Clock, Lock, KeyRound, Mail, AlertTriangle, UserPlus, Search, Menu, X, Landmark, ShieldAlert, BadgeCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../config/api";

interface LandingPageProps {
  onLoginShow: () => void;
  onLoginSuccess: (email: string, pass: string) => Promise<boolean>;
}

export function LandingPage({ onLoginShow, onLoginSuccess }: LandingPageProps) {
  // Mobile Hamburger menu toggle state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Interactive Tracker parameters
  const [trackEmail, setTrackEmail] = useState("");
  const [trackPassword, setTrackPassword] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showTrackerModal, setShowTrackerModal] = useState(false);

  // Application workflow parameters
  const [applyFirstName, setApplyFirstName] = useState("");
  const [applyLastName, setApplyLastName] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applyNin, setApplyNin] = useState("");
  const [applyBvn, setApplyBvn] = useState("");
  const [applyState, setApplyState] = useState("Lagos");
  const [applyGender, setApplyGender] = useState("MALE");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const stats = [
    { label: "Active TSPs Nationwide", count: "180+ Hubs", detail: "Fully accredited under Federal Government parameters.", icon: Building, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "State Center Coverage", count: "36 States + FCT", detail: "Extensive geopolitical distribution and network.", icon: MapPin, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { label: "Enrolled & Active Trainees", count: "12,450+", detail: "Tracked with live biometric and document registry.", icon: Users, color: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "Certified TVET Graduates", count: "8,920+ Alumni", detail: "Holding globally verifiable digital credentials.", icon: Award, color: "text-amber-700 font-bold bg-amber-50 border-amber-200" }
  ];

  const credentialsAndSupport = [
    {
      title: "Biometric Verification Gates",
      desc: "Instant onboarding check-in powered by real-time National Identity Number (NIN) authentication to eliminate duplicate rosters.",
      icon: ShieldCheck,
      color: "border-l-4 border-indigo-600 bg-linear-to-r from-indigo-50/10 to-transparent"
    },
    {
      title: "Provisional Admission Mapping",
      desc: "Authorized Training Providers can compile customize fields schema to dispatch official, watermarkable PDF offer letters instantly.",
      icon: DocumentIcon,
      color: "border-l-4 border-emerald-600 bg-linear-to-r from-emerald-50/10 to-transparent"
    },
    {
      title: "NDPR Compliant Audits",
      desc: "Rigorous record timeline logging ensuring student privacy protection and strict tracking of administrative event touchpoints.",
      icon: BadgeCheck,
      color: "border-l-4 border-blue-600 bg-linear-to-r from-blue-50/10 to-transparent"
    }
  ];

  function DocumentIcon({ className }: { className?: string }) {
    return <BookOpen className={className} />;
  }

  const focalPrograms = [
    { 
      title: "Solar PV Installations & Green Tech", 
      sector: "Power & Systems", 
      desc: "Advanced training in PV arrays design, high-capacity inverter synchronization, off-grid storage sizing, and green power grid inspections.", 
      icon: Zap, 
      capacity: "Capacity Limit: 120 slots per TSP" 
    },
    { 
      title: "ICT Systems & Computer Hardware", 
      sector: "Information Technology", 
      desc: "Rigorous training on complex microcontroller engineering, circuit diagnostics, logic analyzing, and cloud service architectures.", 
      icon: Cpu, 
      capacity: "Capacity Limit: 180 slots per TSP" 
    },
    { 
      title: "Automobile diagnostics & EFI Tech", 
      sector: "Transportation", 
      desc: "Computerized electronic fuel injection system maps, computerized hybrid powertrain overhauls, and telemetry standard inspections.", 
      icon: Car, 
      capacity: "Capacity Limit: 90 slots per TSP" 
    },
    { 
      title: "Advanced Metalwork & Precision Fabrication", 
      sector: "Metal Technology", 
      desc: "Precision MMA / TIG engineering, structural steel assembly blueprints, stress testing, and metallurgical safety inspections.", 
      icon: Hammer, 
      capacity: "Capacity Limit: 150 slots per TSP" 
    },
    { 
      title: "Industrial Apparel Pattern Drafting", 
      sector: "Creative Industries", 
      desc: "Technical garment engineering, computerized pattern CAD programs, and high-volume garment manufacturing logistics.", 
      icon: Scissors, 
      capacity: "Capacity Limit: 200 slots per TSP" 
    },
    { 
      title: "Micro-Greenhouse Hydroponics", 
      sector: "Agribusiness", 
      desc: "Automated drip greenhouse setups, micro-controller irrigation loops, and post-harvest supply distribution networks.", 
      icon: Sprout, 
      capacity: "Capacity Limit: 110 slots per TSP" 
    }
  ];

  const faqs = [
    { q: "What is the primary role of a Training Service Provider (TSP) on the Governance portal?", a: "Accredited TSPs utilize this centralized portal to log student profiles, verify biometric NIN records, compile document versions, track enrollment milestones, and issue tamper-proof certificates under federal supervision." },
    { q: "How does the progressive document unlock control operate?", a: "To maintain academic integrity, documents unlock sequentially based on state status: the Admission Form is always available; the Admission Letter requires status ADMITTED; the Acceptance Letter requires ACCEPTED; the Enrollment Letter requires ENROLLED; and the final Certificate requires GRADUATED." },
    { q: "How can individual trainees check and accept their admission offers?", a: "Trainees can click 'Track Admission' on the portal navigation bar, input their registered Email address, and use their 11-digit NIN as their default password to review timeline touchpoints and upload signed acceptance letters." },
    { q: "Does the system comply with Nigerian Data Protection laws?", a: "Absolutely. All stored identity elements, including NIN, BVN, and biometric records, are processed in complete alignment with the Nigerian Data Protection Regulation (NDPR) criteria." }
  ];

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);
    setApplySuccessMsg(null);
    setApplyLoading(true);

    if (!applyFirstName || !applyLastName || !applyEmail || !applyNin || !applyBvn) {
      setApplyError("All identity registry parameters are strictly required to verify applicant validity.");
      setApplyLoading(false);
      return;
    }

    try {
      const payload = {
        firstName: applyFirstName,
        lastName: applyLastName,
        email: applyEmail,
        phone: applyPhone,
        nin: applyNin,
        bvn: applyBvn,
        gender: applyGender,
        state: applyState,
        batch: "Cohort B",
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150", 
        admissionStatus: "Offer Dispatched",
        status: "DRAFT_REGISTERED",
        admissionRef: "IDEAS/TVET/ADM/" + Math.floor(100000 + Math.random() * 900000)
      };

      const res = await fetch(`${API_BASE_URL}/api/beneficiaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setApplySuccessMsg(
          `Congratulations ${applyFirstName}! Your provisional enrollment file has been recorded. Your provisional trainee default password is your NIN: ${applyNin}. Use 'Track Admission' to login and accept your seat allocation.`
        );
        setApplyFirstName("");
        setApplyLastName("");
        setApplyEmail("");
        setApplyPhone("");
        setApplyNin("");
        setApplyBvn("");
      } else {
        setApplyError(data.error || "The system rejected this entry. Please verify if the email or NIN is already registered.");
      }
    } catch (err: any) {
      setApplyError("Roster lookup timeout. Please check your network connection.");
    } finally {
      setApplyLoading(false);
    }
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setTrackLoading(true);

    try {
      const ok = await onLoginSuccess(trackEmail, trackPassword);
      if (ok) {
        setShowTrackerModal(false);
      } else {
        setTrackError("Failed credentials verification. Try entering your registered Email coupled with your NIN as password.");
      }
    } catch (err: any) {
      setTrackError("Authentication service communication breakdown.");
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* HEADER NAVIGATION (RESPONSIVE WITH MOBILE HAMBURGER TOGGLE) */}
      <nav id="nav-system-top" className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-40 px-6 py-4 shadow-3xs transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Institutional logo & name */}
          <a href="#" className="flex items-center gap-3 select-none group text-left">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold font-mono text-sm shadow-sm border border-slate-800 group-hover:scale-[102%] transition-all">
              <Building className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-450 font-mono uppercase tracking-widest block leading-none">
                IDEAS-TVET Initiative
              </span>
              <h2 className="text-[13px] font-extrabold text-slate-900 font-display mt-1 leading-none">
                TSP Governance Portal
              </h2>
            </div>
          </a>

          {/* Desktop Navitems */}
          <div className="hidden lg:flex items-center gap-7 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <a href="#branding-strip" className="hover:text-indigo-600 transition">Partners</a>
            <a href="#stats" className="hover:text-indigo-600 transition">Statistics</a>
            <a href="#credentials" className="hover:text-indigo-600 transition">Portal Capabilities</a>
            <a href="#programs" className="hover:text-indigo-600 transition">Training Programs</a>
            <a href="#faqs" className="hover:text-indigo-600 transition">TSP FAQ</a>
          </div>

          {/* Action buttons (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setShowTrackerModal(true)}
              className="text-indigo-600 hover:bg-slate-55 border border-slate-200 hover:border-slate-300 font-extrabold py-2 px-4 rounded-lg text-[11px] transition font-mono uppercase tracking-wide cursor-pointer"
            >
              Track Admission
            </button>
            <button
              onClick={onLoginShow}
              className="bg-slate-950 hover:bg-slate-800 text-white font-bold py-2.5 px-4.5 rounded-lg text-[11px] flex items-center gap-1.5 transition shadow-3xs cursor-pointer font-mono uppercase tracking-wide"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Officer Log-In</span>
            </button>
          </div>

          {/* Hamburger menu button for small screens */}
          <div className="flex lg:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Dynamic Mobile Menu Slide-Out Down Panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden mt-4 pt-4 border-t border-slate-100 flex flex-col gap-4 text-left font-mono text-[11px] uppercase tracking-wider text-slate-600"
            >
              <a 
                href="#branding-strip" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-indigo-600 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Partners
              </a>
              <a 
                href="#stats" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-indigo-600 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Statistics
              </a>
              <a 
                href="#credentials" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-indigo-600 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Portal Capabilities
              </a>
              <a 
                href="#programs" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-indigo-600 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Training Programs
              </a>
              <a 
                href="#faqs" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-indigo-600 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                TSP FAQ
              </a>
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowTrackerModal(true);
                  }}
                  className="w-full text-center text-indigo-600 border border-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Track Admission
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginShow();
                  }}
                  className="w-full text-center bg-slate-950 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-900 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Officer Log-In</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION DECORATED FOR ACCREDITED TRAINING SERVICES PROVIDERS */}
      <section className="relative overflow-hidden pt-12 pb-20 bg-linear-to-b from-white to-slate-50/60">
        
        {/* Soft background glow features */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-indigo-500/5 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero text descriptor */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-full text-emerald-800 font-bold font-mono text-[10px] leading-none shadow-3xs uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>TSPs Certified Governance Workspace</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight font-display leading-[1.12] select-text">
              Unified TSP Workspace & Trainee Lifecycle Tracker
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-slate-550 leading-relaxed font-semibold max-w-xl text-slate-600">
              Transforming skills acquisition with ironclad accountability. Authorized Training Service Providers (TSPs) can manage trainee onboarding, verify candidate credentials, automate biometric checks, compile compliance folders, and dispatch verified TVET certifications.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-4">
              <button
                onClick={() => setShowApplyModal(true)}
                className="bg-indigo-950 hover:bg-slate-900 text-white font-bold py-3.5 px-6 rounded-xl text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[98%] cursor-pointer uppercase tracking-wider font-mono hover:-translate-y-px"
              >
                <span>Register Trainee Prospect</span>
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                onClick={() => setShowTrackerModal(true)}
                className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold py-3.5 px-6 rounded-xl text-[11px] transition active:scale-[98%] cursor-pointer text-center uppercase tracking-wider font-mono border-slate-250/70"
              >
                Track Trainee Status
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-4 text-slate-500 text-[10px] font-mono font-bold tracking-wide">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Web-to-PDF Generative Stamped Engines</span>
              <span className="hidden sm:inline-block h-1 w-1 bg-slate-300 rounded-full" />
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Live Verification Logs tracking</span>
            </div>
          </div>

          {/* Hero right panel mockup */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-emerald-500/5 rounded-3xl filter blur-2xl rotate-6 -z-10" />
            
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-left border-l-4 border-l-emerald-600 space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-indigo-50/80">
                <div className="flex items-center gap-2">
                  <div className="h-8.5 w-8.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-800">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-extrabold text-slate-800 uppercase font-mono">TSP Roster Gate</h4>
                    <p className="text-[8px] text-slate-400 font-mono font-bold uppercase tracking-widest">Cohort Compliance</p>
                  </div>
                </div>
                <span className="text-[8px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-750 font-bold font-mono rounded">NIN INTEGRATED</span>
              </div>

              {/* Status workflow mockup cards */}
              <div className="space-y-3 font-sans text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wide uppercase">Stage A: Trainee Registration</span>
                    <span className="text-[8px] px-1 bg-emerald-150 rounded text-emerald-800 font-bold font-mono">OK</span>
                  </div>
                  <p className="text-slate-650 font-medium scale-98 mt-0.5 text-slate-550 leading-relaxed text-[11px]">Personal file recorded alongside verified BVN for quick financial checks and biometric tracking setup.</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wide uppercase">Stage B: Document Compilation</span>
                    <span className="text-[8px] px-1.5 bg-indigo-100 text-indigo-700 font-bold font-mono rounded">PENDING</span>
                  </div>
                  <p className="text-slate-650 font-medium scale-98 mt-0.5 text-slate-550 leading-relaxed text-[11px]">System generates secure, watermarked PDFs requiring candidate accept signatures and physical file verification.</p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-850 text-indigo-100 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-indigo-300 font-mono uppercase tracking-wide">Stage C: Final Audit & Certificate</span>
                    <span className="text-[7.5px] px-1 bg-emerald-400 text-slate-950 font-extrabold font-mono rounded select-none">FINAL</span>
                  </div>
                  <p className="text-indigo-200 text-[11px] leading-relaxed scale-98">Central administration locks attendance, signs final transcripts, and releases verifiable TVET awards.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] font-mono text-slate-400">
                <span>TSP HUB PORTAL V1.8</span>
                <span className="text-indigo-650 font-bold uppercase">Nigeria TVET Standards</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* STUNNING BRANDING STRIP CAPTURING ALL REQUIRED SYSTEM TRUST PATHWAYS */}
      <section id="branding-strip" className="border-t border-b border-slate-200/80 bg-white py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-[9px] font-extrabold text-indigo-600 font-mono uppercase tracking-widest block">
              ACCREDITED PROGRAM PARTNERS & GOVERNANCE AUTHORITIES
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 items-center justify-center">
            {/* World Bank Logo Box */}
            <div className="border border-slate-150 hover:border-slate-300 px-4 py-3 bg-slate-50/50 rounded-xl flex items-center gap-2.5 transition duration-200">
              <Landmark className="w-5 h-5 text-indigo-900 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">Funding Body</span>
                <h5 className="text-[10px] font-semibold text-slate-850 text-slate-800 mt-1 uppercase">WORLD BANK</h5>
              </div>
            </div>

            {/* FME Logo Box */}
            <div className="border border-slate-150 hover:border-slate-300 px-4 py-3 bg-slate-50/50 rounded-xl flex items-center gap-2.5 transition duration-200">
              <Building className="w-5 h-5 text-emerald-700 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">Federal Authority</span>
                <h5 className="text-[10px] font-semibold text-slate-850 text-slate-800 mt-1 uppercase">FME NIGERIA</h5>
              </div>
            </div>

            {/* NBTE Logo Box */}
            <div className="border border-slate-150 hover:border-slate-300 px-4 py-3 bg-slate-50/50 rounded-xl flex items-center gap-2.5 transition duration-200">
              <Landmark className="w-5 h-5 text-blue-700 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">Board regulator</span>
                <h5 className="text-[10px] font-semibold text-slate-850 text-slate-800 mt-1 uppercase">NBTE SECRETARIAT</h5>
              </div>
            </div>

            {/* IDEAS Logo Box */}
            <div className="border border-slate-150 hover:border-slate-300 px-4 py-3 bg-slate-50/50 rounded-xl flex items-center gap-2.5 transition duration-200">
              <Award className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">National Initiative</span>
                <h5 className="text-[10px] font-semibold text-slate-850 text-slate-800 mt-1 uppercase">IDEAS PROJECTS</h5>
              </div>
            </div>

            {/* Verification Security Standard Box */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 border border-emerald-150/80 px-4 py-3 bg-emerald-50/10 rounded-xl flex items-center gap-2.5 hover:bg-emerald-55 transition duration-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-emerald-600 uppercase">Portal Standard</span>
                <h5 className="text-[10px] font-semibold text-slate-850 text-slate-800 mt-1 uppercase">NDPR SECURE GATE</h5>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATISTICS SECTION */}
      <section id="stats" className="bg-slate-50 border-b border-slate-200 py-16 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-[10px] font-bold text-indigo-600 font-mono uppercase tracking-widest block">Accredited cumulative scope</span>
            <h2 className="text-2xl font-extrabold text-slate-900 font-display">IDEAS-TVET Key Program Metrics</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Live verified registry totals mapped across authorized Training Service Provider coordinates.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((st, idx) => {
              const IconComp = st.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between text-left space-y-3 cursor-default hover:shadow-md hover:border-slate-300 transition duration-300 transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 font-display tracking-tight">{st.count}</span>
                    <div className={`p-2 rounded-xl border ${st.color} flex items-center justify-center`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">{st.label}</h4>
                    <p className="text-[10.5px] text-slate-500 leading-normal font-semibold text-slate-450">{st.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PORTAL CAPABILITIES & DESIGN STANDARDS */}
      <section id="credentials" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left descriptors block */}
            <div className="lg:col-span-5 space-y-5 text-left">
              <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest block leading-none">Security Architecture</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display leading-tight">
                High Fidelity Auditing & Interactive TVET Validation
              </h2>
              <p className="text-xs leading-relaxed text-slate-550 text-slate-600 font-medium">
                Our database design guarantees complete operational accountability. Each administrative milestone, from the draft file creation to the final certificate stamp, is securely persisted under audited logs.
              </p>
              
              <div className="h-1 bg-gradient-to-r from-indigo-500 to-emerald-500 w-32 rounded"></div>
              
              <button
                onClick={() => setShowApplyModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:underline font-mono uppercase tracking-wider"
              >
                <span>Read security standards blueprint</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right capabilities cards split */}
            <div className="lg:col-span-7 space-y-5">
              {credentialsAndSupport.map((cr, idx) => {
                const IconC = cr.icon;
                return (
                  <div 
                    key={idx}
                    className={`bg-slate-50/50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 text-left hover:bg-white hover:shadow-xs transition duration-200 ${cr.color}`}
                  >
                    <div className="p-3 bg-white border border-slate-150 rounded-xl text-slate-800 shrink-0">
                      <IconC className="w-5 h-5 text-indigo-950" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase font-mono tracking-wide">{cr.title}</h4>
                      <p className="text-xs text-slate-500 leading-normal font-semibold text-slate-450">{cr.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* TRAINING SPECIALITIES */}
      <section id="programs" className="py-20 bg-slate-50/50 border-t border-b border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-bold text-indigo-600 font-mono uppercase tracking-widest block">Approved curricula</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">Accredited Specialities for TSPs</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Explore intensive skills training courses authorized under World Bank funded models.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {focalPrograms.map((p, idx) => {
              const IconC = p.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between text-left space-y-4 hover:shadow-md transition duration-200 border-t-4 border-t-indigo-950"
                >
                  <div className="space-y-3">
                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-950 rounded-xl w-fit flex items-center justify-center">
                      <IconC className="w-4.5 h-4.5 text-indigo-950" />
                    </div>
                    <div>
                      <span className="text-[8px] font-bold font-mono text-indigo-600 uppercase tracking-widest block bg-indigo-50 px-1.5 py-0.5 rounded w-fit mb-1.5">{p.sector}</span>
                      <h3 className="text-xs font-extrabold text-slate-900 font-display">{p.title}</h3>
                      <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-1">{p.desc}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 uppercase">Intake Limit:</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black">{p.capacity}</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* TRAINEE FAQ INTERACTIVE ACCORDION */}
      <section id="faqs" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest block leading-none">Frequently Answered Questions</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">TSP Support & Regulatory Information</h2>
            <p className="text-xs text-slate-500">Find direct clarifications regarding biometric standards, documents locks, and compliant auditing protocols.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((f, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden text-left"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full py-4 px-6 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-900 tracking-wide select-text">{f.q}</span>
                    <div className="h-6 w-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 shrink-0">
                      <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-250 ${isOpen ? "rotate-180 text-indigo-600" : ""}`} />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-6 pb-5 pt-1 text-xs text-slate-600 leading-relaxed font-semibold border-t border-slate-200/50 select-text font-serif">
                          {f.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* INSTITUTIONAL COHORT FOOTER DESIGNED WITH STRICT GOVERNANCE RECOGNITION */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t-4 border-t-emerald-600 font-mono text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
          
          <div className="space-y-4">
            <h4 className="text-slate-100 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 font-display">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              IDEAS-TVET Secretariat
            </h4>
            <p className="text-[11px] leading-relaxed select-text font-sans text-slate-350">
              Federal Ministry of Education Headquarters, Plot 245 Samuel Ademulegun Avenue, Central Business District, Abuja, FCT, Nigeria.
            </p>
            <div className="pt-2 text-slate-350 font-sans">
              <span className="block">Support: <strong className="text-slate-105 text-white font-mono select-all">support@ideas-tvet.ng</strong></span>
              <span className="block mt-1">Helpline: <strong className="text-slate-105 text-white font-mono select-all">+234 (0) 90 3242 5592</strong></span>
            </div>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-100 font-medium uppercase tracking-wider text-[11px]">Accredited Sectors</h4>
            <ul className="space-y-2 text-[11px] text-slate-350 font-sans">
              <li>Computer Hardware & Repairs</li>
              <li>Solar Energy Systems Installation</li>
              <li>Civil & Masonry Engineering</li>
              <li>Apparel Pattern Drafting</li>
              <li>High-yield Hydroponics</li>
            </ul>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-100 font-medium uppercase tracking-wider text-[11px]">Institutional Links</h4>
            <ul className="space-y-2 text-[11px] font-sans">
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("National TVET support lines: support@uniqueideas.dontechservicesconst.com"); }} className="hover:text-white hover:underline">Support Desk Chat</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("National TVET syllabus verified."); }} className="hover:text-white hover:underline">Syllabus Guidelines</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("Accredited centers map loaded."); }} className="hover:text-white hover:underline">TSP Registration Hub</a></li>
              <li><button onClick={onLoginShow} className="hover:text-white hover:underline bg-transparent border-none p-0 cursor-pointer text-left font-mono text-[11px]">Governance Administration Portal</button></li>
            </ul>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-105 text-slate-100 font-medium uppercase tracking-wider text-[11px]">Legal Regulations</h4>
            <p className="text-[11px] leading-relaxed font-sans text-slate-350">
              Identity parameters profiling conforms with the Nigeria Data Protection Regulation (NDPR) acts. Complete terms enable fast secure document verification with zero spam leakage.
            </p>
            <div className="flex gap-4 pt-1 font-mono text-[10px] text-slate-355 text-left font-bold">
              <a href="#" onClick={(e) => { e.preventDefault(); alert("NDPR compliant Privacy Policy activated."); }} className="hover:text-white hover:underline">Privacy Policy</a>
              <span>·</span>
              <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of Service activated."); }} className="hover:text-white hover:underline">Terms of Service</a>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-355">
          <p className="select-text">© {new Date().getFullYear()} Federal Ministry of Education · IDEAS Initiative Program. Built for Unique Technology Nig. Ltd.</p>
          <div className="flex items-center gap-2">
            <span>FEDERAL REPUBLIC OF NIGERIA</span>
            <span className="h-0.5 w-6 bg-emerald-500"></span>
            <span className="h-0.5 w-6 bg-white"></span>
            <span className="h-0.5 w-6 bg-emerald-500"></span>
          </div>
        </div>
      </footer>

      {/* TRACK ADMISSION MODAL OVERLAY */}
      <AnimatePresence>
        {showTrackerModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl relative border-t-4 border-t-indigo-600"
            >
              
              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowTrackerModal(false);
                  setTrackError(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 font-mono font-bold hover:bg-slate-100 rounded-lg p-1.5 focus:outline-none"
              >
                ✕
              </button>

              <div className="space-y-4 text-left">
                <div className="h-10 w-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-950">
                  <Search className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950 font-display">Candidate Tracker & Student Portal</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">Track your provisional status or access files using your credentials.</p>
                </div>
              </div>

              {trackError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 font-semibold text-xs p-3.5 rounded-lg mt-4 text-left">
                  {trackError}
                </div>
              )}

              <form onSubmit={handleTrackSubmit} className="space-y-4 mt-5 text-left font-sans">
                <div className="space-y-1">
                  <label htmlFor="track-email-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Registered Email</label>
                  <div className="relative">
                    <input
                      id="track-email-input"
                      type="email"
                      required
                      placeholder="trainee@ideas-tvet.ng"
                      value={trackEmail}
                      onChange={(e) => setTrackEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
                    />
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="track-password-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Default password (NIN or Key)</label>
                  <div className="relative font-sans">
                    <input
                      id="track-password-input"
                      type="password"
                      required
                      placeholder="Type your 11-digit NIN or Password"
                      value={trackPassword}
                      onChange={(e) => setTrackPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                    />
                    <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={trackLoading}
                  className="w-full bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  {trackLoading ? "Validating System Records..." : "Search & Enter Student Space"}
                </button>
              </form>

              <div className="bg-slate-50 border border-slate-105 rounded-lg p-3 text-[10px] text-slate-400 leading-normal text-left mt-5 font-mono">
                💡 <span className="font-bold">Sandbox Hint</span>: If you just filed a provisional registration, log in using your registered Email along with your 11-digit NIN as password!
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROVISIONAL REGISTRATION MODAL */}
      <AnimatePresence>
        {showApplyModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative border-l-4 border-l-emerald-600 overflow-y-auto max-h-[90vh]"
            >
              
              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowApplyModal(false);
                  setApplyError(null);
                  setApplySuccessMsg(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 font-mono font-bold hover:bg-slate-100 rounded-lg p-1.5 focus:outline-none"
              >
                ✕
              </button>

              <div className="space-y-3 text-left">
                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded text-[10px] font-mono leading-none font-bold uppercase tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>COHORT B PORTAL RESERVES</span>
                </div>
                <h3 className="text-lg font-black text-slate-950 font-display">Provisional Trainee Enrollment Registry</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">Please fill out your identity parameters. The system will auto-verify your credentials against civil registries and save draft folders.</p>
              </div>

              {applyError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 font-semibold text-xs p-3.5 rounded-lg mt-4 text-left font-mono">
                  {applyError}
                </div>
              )}

              {applySuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-250 text-emerald-900 text-xs p-4 rounded-xl mt-4 text-left space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="font-extrabold font-mono uppercase text-[11px]">Draft registration logged successfully!</span>
                  </div>
                  <p className="leading-relaxed font-mono text-[11.5px]">{applySuccessMsg}</p>
                </div>
              )}

              {!applySuccessMsg && (
                <form onSubmit={handleApplySubmit} className="space-y-4 mt-5 text-left">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="first-name-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">First Name</label>
                      <input
                        id="first-name-input"
                        type="text"
                        required
                        placeholder="e.g. Ibrahim"
                        value={applyFirstName}
                        onChange={(e) => setApplyFirstName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="last-name-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Last Name</label>
                      <input
                        id="last-name-input"
                        type="text"
                        required
                        placeholder="e.g. Musa"
                        value={applyLastName}
                        onChange={(e) => setApplyLastName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                    <div className="space-y-1">
                      <label htmlFor="apply-email-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Personal Email Address</label>
                      <input
                        id="apply-email-input"
                        type="email"
                        required
                        placeholder="musa@gmail.com"
                        value={applyEmail}
                        onChange={(e) => setApplyEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="phone-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Phone Number</label>
                      <input
                        id="phone-input"
                        type="tel"
                        required
                        placeholder="e.g. +2348011223344"
                        value={applyPhone}
                        onChange={(e) => setApplyPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="nin-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">National Identity Number (NIN)</label>
                      <input
                        id="nin-input"
                        type="text"
                        required
                        pattern="\d{11}"
                        maxLength={11}
                        placeholder="11-digit NIN"
                        value={applyNin}
                        onChange={(e) => setApplyNin(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="bvn-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Bank Verification Number (BVN)</label>
                      <input
                        id="bvn-input"
                        type="text"
                        required
                        pattern="\d{11}"
                        maxLength={11}
                        placeholder="11-digit BVN"
                        value={applyBvn}
                        onChange={(e) => setApplyBvn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                    <div className="space-y-1">
                      <label htmlFor="state-select" className="font-bold text-slate-500 uppercase tracking-wider">Roster State Center</label>
                      <select
                        id="state-select"
                        value={applyState}
                        onChange={(e) => setApplyState(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-250 border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none font-sans"
                      >
                        <option value="Lagos">Lagos</option>
                        <option value="FCT Abuja">FCT Abuja</option>
                        <option value="Enugu">Enugu</option>
                        <option value="Kaduna">Kaduna</option>
                        <option value="Rivers">Rivers</option>
                        <option value="Kano">Kano</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="gender-select" className="font-bold text-slate-500 uppercase tracking-wider">Candidate Gender</label>
                      <select
                        id="gender-select"
                        value={applyGender}
                        onChange={(e) => setApplyGender(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-250 border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none font-sans"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={applyLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {applyLoading ? "Submitting Application Parameters..." : "Submit Enrollment Application"}
                  </button>

                  <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-normal font-semibold">
                      Please guarantee the legitimacy of NIN and BVN parameters. Dual or blank registrations will void candidate slots.NDPR protection terms apply.
                    </p>
                  </div>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
