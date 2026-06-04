/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Building, ShieldCheck, HelpCircle, ArrowRight, CheckCircle2, 
  Users, MapPin, Award, GraduationCap, ChevronRight, ChevronDown, Check,
  Cpu, Scissors, Zap, Hammer, Sprout, Car, Sparkles, MessageSquare, BookOpen, Clock, Lock, KeyRound, Mail, AlertTriangle, UserPlus, Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingPageProps {
  onLoginShow: () => void;
  onLoginSuccess: (email: string, pass: string) => Promise<boolean>;
}

export function LandingPage({ onLoginShow, onLoginSuccess }: LandingPageProps) {
  // Navigation triggers
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
    { label: "Total Beneficiaries Enrolled", count: "12,450+", detail: "Empowered across diverse technical cohorts.", icon: Users, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    { label: "States Covered", count: "36 States + FCT", detail: "Broad national reach representing geopolitical sectors.", icon: MapPin, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { label: "Accredited TSPs", count: "180+ Hubs", detail: "Authorized Technical Service Providers.", icon: Building, color: "text-yellow-600 bg-yellow-50 border-yellow-105" },
    { label: "Licensed Graduates", count: "8,920+ Alumni", detail: "Fully qualified with national TVET credentials.", icon: Award, color: "text-pink-600 bg-pink-50 border-pink-100" }
  ];

  const benefits = [
    {
      title: "Industry-Relevant Skills",
      desc: "Curriculums mapped with global technology giants covering hardware micro-soldering, telemetry Diagnostics, and power configurations.",
      icon: Cpu,
      color: "border-l-4 border-indigo-500 bg-neutral-50/50"
    },
    {
      title: "National Certification",
      desc: "Accreditation by the Federal Ministry of Education providing worldwide verification of certified TVET qualifications.",
      icon: GraduationCap,
      color: "border-l-4 border-emerald-500 bg-neutral-50/50"
    },
    {
      title: "Employment Readiness",
      desc: "Accelerated interview setups, corporate networking fairs, and direct apprenticeship matching pathways.",
      icon: Sparkles,
      color: "border-l-4 border-yellow-500 bg-neutral-50/50"
    },
    {
      title: "Entrepreneurship Development",
      desc: "Starter tooling kits, seed funding coordination, legal registration training, and cooperative support frameworks.",
      icon: Sprout,
      color: "border-l-4 border-pink-500 bg-neutral-50/50"
    }
  ];

  const categories = [
    { title: "ICT & Hardware Diagnostics", desc: "Computer repair, circuit microsoldering, mobile device architecture.", icon: Cpu, counts: "4,600+ Trainees" },
    { title: "Apparel & Pattern Design", desc: "Industrial weaving, high-fidelity apparel systems, fashion business modeling.", icon: Scissors, counts: "2,100+ Trainees" },
    { title: "Solar & Electrical Tech", desc: "Industrial grids, solar PV integration, residential automation installations.", icon: Zap, counts: "2,840+ Trainees" },
    { title: "Modern Construction Drafting", desc: "Structural concrete, civil layouts, masonry calculations, architectural drafting.", icon: Hammer, counts: "1,200+ Trainees" },
    { title: "Smart Agriculture", desc: "Hydroponics, automated drip irrigation, innovative agro-processing systems.", icon: Sprout, counts: "940+ Trainees" },
    { title: "Automotive Technology", desc: "EFI engines calibration, smart vehicle diagnostics, transmission rebuilds.", icon: Car, counts: "770+ Trainees" }
  ];

  const faqs = [
    { q: "Who is eligible and fits the requirements of the IDEAS-TVET program?", a: "Nigerian youth aged 18-35 holding basic literacy credentials. Priority is given to individuals eager to activate practical engineering workshops and improve their immediate employment prospects." },
    { q: "What is required during the biometric profiling admission phase?", a: "Selected candidates will present their National Identification Number (NIN) alongside Bank Verification Number (bvn) parameters for instant security profiling and biometric enrollment verification." },
    { q: "How do I track and submit my admission acceptance envelope?", a: "Simply click 'Track Admission' on the platform top navbar, enter your profile email and use your NIN as your default password to access your secure candidate terminal, then download your provisional letter of admission and upload your signed copy." },
    { q: "Are the educational certifications internationally accredited?", a: "Yes, final graduates undergo formal evaluation by the Joint Technical and Vocational Evaluation Board, issuing licenses recognized both globally and by premium local telecommunications and electronics companies." }
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
      // Perform direct full-stack backend enrollment API dispatch
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
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150", // Def placeholder
        admissionStatus: "Offer Dispatched",
        status: "DRAFT_REGISTERED",
        admissionRef: "IDEAS/TVET/ADM/" + Math.floor(100000 + Math.random() * 900000)
      };

      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setApplySuccessMsg(
          `Congratulations ${applyFirstName}! Your provisional application files have been saved. Your provisional default portal password is your NIN: ${applyNin}. Log in using 'Track Admission' to accept your seat arrangement.`
        );
        // Clear inputs on success
        setApplyFirstName("");
        setApplyLastName("");
        setApplyEmail("");
        setApplyPhone("");
        setApplyNin("");
        setApplyBvn("");
      } else {
        setApplyError(data.error || "The system rejected this registration. Check if the email or NIN is already listed.");
      }
    } catch (err: any) {
      setApplyError("Server transaction timeout. No internet connectivity detected to save applicant files.");
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
      setTrackError("Authentication server communication breakdown.");
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-650 selection:text-white">
      
      {/* 1. FEDERAL HEADER HEADER & NAVIGATION */}
      <div className="bg-slate-900 border-b-2 border-emerald-600 text-slate-300 py-1.5 px-6 text-xs text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 font-mono">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px] tracking-wider">OFFICIAL SYSTEM</span>
            <p className="text-[11px] font-medium leading-none">Federal Ministry of Education · IDEAS-TVET Skills Council</p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Portal Sync Status: <strong className="text-emerald-400 font-bold uppercase">● Live Connected</strong></span>
            <span className="hidden md:inline text-slate-550">|</span>
            <span className="hidden md:inline font-bold">Standard Standard A4 Formats Enabled</span>
          </div>
        </div>
      </div>

      <nav className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 z-40 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Institutional logo & name */}
          <a href="#" className="flex items-center gap-3 select-none group text-left">
            <div className="h-11 w-11 bg-gradient-to-br from-indigo-950 to-slate-900 rounded-xl flex items-center justify-center text-white font-bold font-mono text-sm shadow-md border border-slate-700/30 group-hover:scale-105 transition-all">
              <Building className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest block leading-none">
                IDEAS-TVET Portal
              </span>
              <h2 className="text-sm font-extrabold text-slate-900 font-display mt-1 leading-snug">
                National Beneficiary & Admission Registry
              </h2>
            </div>
          </a>

          {/* Navitems center */}
          <div className="hidden lg:flex items-center gap-6 font-mono text-[12px] font-bold text-slate-500">
            <a href="#stats" className="hover:text-indigo-650 transition">Statistics</a>
            <a href="#benefits" className="hover:text-indigo-650 transition">Benefits</a>
            <a href="#timeline" className="hover:text-indigo-650 transition">Admission Flow</a>
            <a href="#sectors" className="hover:text-indigo-650 transition">Training Sectors</a>
            <a href="#faqs" className="hover:text-indigo-650 transition">FAQ Platform</a>
          </div>

          {/* Action Login indicators */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTrackerModal(true)}
              className="text-indigo-650 hover:bg-indigo-50 border border-indigo-200 font-extrabold py-2 px-4 rounded-xl text-xs transition font-mono cursor-pointer"
            >
              Track Admission
            </button>
            <button
              onClick={onLoginShow}
              className="bg-slate-950 hover:bg-slate-800 text-white font-bold py-2.5 px-4.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Officer Log-In</span>
            </button>
          </div>

        </div>
      </nav>

      {/* 2. HERO CHAMBER SECION WITH GRADIENT AND FLOATING CARD */}
      <section className="relative overflow-hidden pt-12 pb-20 md:py-24 lg:py-32 bg-radial from-slate-50 to-indigo-50/40">
        
        {/* Floating gradient orb accents */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero left descriptors */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-150 px-3 py-1.5 rounded-full text-emerald-800 font-semibold font-mono text-[11px] leading-none shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Federal Human Capital Infrastructure Program</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-slate-900 tracking-tight font-display leading-[1.1] max-w-2xl select-text">
              Empowering Nigerian Youth Through <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-950 to-emerald-600 block">Technical and Vocational Education</span>
            </h1>

            <p className="text-sm md:text-base text-slate-505 leading-relaxed max-w-xl font-medium select-text">
              Apply, Track Admission, Submit Acceptance, and Manage Enrollment Online. Fast-tracking national skills acquisition and certified global labor competitiveness.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={() => setShowApplyModal(true)}
                className="bg-indigo-950 hover:bg-indigo-900 text-white font-bold py-3.5 px-7 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-[98%] cursor-pointer group"
              >
                <span>Apply Now (Provisional Registry)</span>
                <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setShowTrackerModal(true)}
                className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-extrabold py-3.5 px-6 rounded-xl text-sm transition active:scale-[98%] cursor-pointer text-center"
              >
                Track Admission Status
              </button>
            </div>

            <div className="flex items-center gap-4 pt-6 text-slate-500 text-xs font-mono font-bold">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Real-time NIN Verification</span>
              <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> PDF Letters Approved on Portal</span>
            </div>
          </div>

          {/* Hero right image card (Computer/Hardware Theme Mockup) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-indigo-650/10 rounded-2xl filter blur-3xl p-10 -z-10 rotate-12"></div>
            
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-left overflow-hidden border-l-4 border-emerald-600 bg-linear-to-b from-white to-slate-50/70">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-950">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">IDEAS Cohort Portal</h4>
                    <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Enrollment Sandbox</p>
                  </div>
                </div>
                <span className="text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold font-mono rounded">SECURE</span>
              </div>

              {/* Status workflow cards mockup */}
              <div className="space-y-3.5">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">1. DISPATCH ADMISSION LETTER</span>
                    <span className="text-[8.5px] px-1.5 py-0.5 bg-indigo-100 text-indigo-900 font-bold rounded">AUTOMATED</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">System auto-generates printable provisional A4 letters dynamically mapped with secure verification tokens.</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">2. CANDIDATE RESPONDER SIGNATURE</span>
                    <span className="text-[8.5px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">INCOMING ACTION</span>
                  </div>
                  <p className="text-[11px] text-slate-605 font-medium">Trainees review files in their client portal, sign, and upload a raster scan of their seat acceptance response.</p>
                </div>

                <div className="p-3 bg-indigo-950 text-indigo-100 rounded-xl space-y-1.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-300 font-mono">3. ADMIN REVIEW & BIOMETRICS</span>
                    <span className="text-[8.5px] px-1.5 py-0.5 bg-emerald-400 text-slate-950 font-bold rounded">FINAL GATE</span>
                  </div>
                  <p className="text-[11px] text-indigo-200 leading-snug">Super Admins compile the custom fields schema builder and record biometric photos linked to the final enrollment roll.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-400">
                <span>Active Portal Version 1.74</span>
                <span className="text-indigo-650 font-bold">Nigeria TVET Standards</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 3. STATISTICS SECTION */}
      <section id="stats" className="border-t border-b border-slate-200/80 bg-white py-16 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <h3 className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest">National Reach Metrics</h3>
            <h2 className="text-2xl font-extrabold text-slate-900 font-display">IDEAS-TVET Cumulative Program Footprint</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">Consolidated database metrics validating our strategic expansion and beneficiary engagement goals.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((st, idx) => {
              const IconComp = st.icon;
              return (
                <div 
                  key={idx}
                  className="bg-slate-50/70 border border-slate-250/50 p-6 rounded-2xl flex flex-col justify-between text-left space-y-3 cursor-default hover:bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 font-display tracking-tight">{st.count}</span>
                    <div className={`p-2.5 rounded-xl ${st.color} flex items-center justify-center`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">{st.label}</h4>
                    <p className="text-[11px] text-slate-450 font-medium leading-normal">{st.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. PROGRAM BENEFITS SECTION */}
      <section id="benefits" className="py-20 md:py-24 bg-slate-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left intro details */}
            <div className="lg:col-span-4 space-y-5 text-left">
              <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest leading-none block">Program Values Matrix</span>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display leading-tight">
                Designed for Absolute Engineering Competency
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-medium">
                Our dynamic educational parameters bridge the digital gap, converting ambitious tech aspirants into certified industry-standard experts.
              </p>
              
              <div className="h-1 bg-gradient-to-r from-indigo-950 to-emerald-500 w-32 rounded"></div>
              
              <button
                onClick={() => setShowApplyModal(true)}
                className="inline-flex items-center gap-1 text-xs text-indigo-650 font-bold hover:underline font-mono"
              >
                <span>Read detailed program policy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right benefit bento cards */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {benefits.map((b, idx) => {
                const IconComp = b.icon;
                return (
                  <div 
                    key={idx}
                    className={`bg-white border border-slate-200 p-6 rounded-2xl flex flex-col items-start text-left space-y-4 hover:shadow-md transition ${b.color}`}
                  >
                    <div className="p-3 bg-slate-55 shadow-xs border border-slate-100 rounded-xl text-slate-850 flex items-center justify-center">
                      <IconComp className="w-5 h-5 text-indigo-900" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-extrabold text-slate-900 font-display">{b.title}</h3>
                      <p className="text-xs text-slate-450 leading-relaxed font-semibold">{b.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </section>

      {/* 5. ADMISSION PROCESS TIMELINE */}
      <section id="timeline" className="bg-white py-20 md:py-24 border-t border-b border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-2 mb-16">
            <span className="text-xs font-bold text-emerald-600 font-mono uppercase tracking-widest block leading-none">Cohort Enrollment Pipeline</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">Step-by-Step Candidate Milestones</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">The digital admission and training lifecycle ensuring security verification and verified certificates issue.</p>
          </div>

          {/* Interactive timeline cards layout */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 relative">
            
            {/* Background line helper */}
            <div className="hidden md:block absolute top-[44px] left-[5%] right-[5%] h-0.5 bg-indigo-100 -z-5"></div>

            {[
              { num: "01", step: "Registration", desc: "Submit basic biometric identity inputs, email accounts, and preferred field.", icon: UserPlus },
              { num: "02", step: "Review", desc: "TSPs review backgrounds, verifying NIN/BVN compliance criteria.", icon: CheckCircle2 },
              { num: "03", step: "Offer Dispatched", desc: "Provisional offer and private tokens are dynamically generated.", icon: Mail },
              { num: "04", step: "Acceptance", desc: "Trainees log in to sign agreement letters and commit reserves.", icon: ArrowRight },
              { num: "05", step: "Enrollment", desc: "Final state validation locks academic roster entries.", icon: ShieldCheck },
              { num: "06", step: "Technical Training", desc: "Intense laboratory instruction with modern curriculum.", icon: BookOpen },
              { num: "07", step: "Certification", desc: "Pass practical inspection boards for industry credentials.", icon: Award }
            ].map((t, idx) => {
              const IconC = t.icon;
              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between text-left space-y-4 hover:bg-white hover:shadow-xl transition-all duration-300 relative">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-black text-indigo-100">{t.num}</span>
                    <div className="h-8 w-8 bg-white border border-slate-200 shadow-xs rounded-full flex items-center justify-center text-slate-600">
                      <IconC className="w-4 h-4 text-slate-700" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 font-display leading-tight">{t.step}</h4>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">{t.desc}</p>
                  </div>
                </div>
              );
            })}

          </div>

          <div className="mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-200/80 inline-flex flex-col sm:flex-row items-center gap-4 text-left">
            <div className="p-3 bg-white border border-slate-100 rounded-full text-indigo-950">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-indigo-950">Current Intake Batch Active is Cohort B</h4>
              <p className="text-[10px] text-slate-500 font-semibold leading-normal mt-0.5">Application windows close once accredited center seats match strict quota indices limit.</p>
            </div>
            <button
              onClick={() => setShowApplyModal(true)}
              className="bg-indigo-950 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-lg text-xs tracking-wide uppercase transition font-mono whitespace-nowrap cursor-pointer"
            >
              Start Registration
            </button>
          </div>

        </div>
      </section>

      {/* 6. TRAINING CATEGORIES */}
      <section id="sectors" className="py-20 bg-slate-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-2 mb-16">
            <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest block leading-none">Accredited Sectors</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">Authorized TVET Skills Specialities</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Explore high-capacity sectors offering fully-funded national program slots.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((c, idx) => {
              const IconComp = c.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between text-left space-y-4 hover:shadow-lg transition group border-t-4 border-t-indigo-950"
                >
                  <div className="space-y-3">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-950 w-fit flex items-center justify-center">
                      <IconComp className="w-5 h-5 text-indigo-950" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 font-display transition group-hover:text-indigo-650">{c.title}</h3>
                      <p className="text-xs text-slate-455 font-semibold leading-relaxed mt-1">{c.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-mono">
                    <span className="text-slate-400 font-bold block">Capacity Slots</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black">{c.counts}</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 7. ALUMNI TESTIMONIALS */}
      <section className="bg-white py-20 md:py-24 border-t border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-2 mb-16">
            <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest block leading-none">Beneficiary Impact Stories</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">Testimonials from Certified Alumni</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Real voices reporting practical progress and actual financial empowerment.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Testimonial card 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 text-left space-y-6 flex flex-col justify-between relative">
              <div className="absolute top-6 right-6 text-indigo-200"><MessageSquare className="w-10 h-10 transform scale-x-[-1]" /></div>
              <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed italic z-10 select-text">
                "Before intermediate enrollment in Enugu's hardware repairs cohort, I scoured electronics bins daily trying to wire together scrap cellphone motherboards. The state-of-the-art diagnostic kits issued on our first week changed my horizon entirely. Today, I am completely certified and instruct three of my own apprentices."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-900 text-indigo-100 font-bold font-mono rounded-full flex items-center justify-center text-xs">KO</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Kenechukwu O.</h4>
                  <p className="text-[10px] text-slate-450 font-mono mt-0.5">Enugu, Nigeria · Computer Hardware repairs Alumnus</p>
                </div>
              </div>
            </div>

            {/* Testimonial card 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 text-left space-y-6 flex flex-col justify-between relative">
              <div className="absolute top-6 right-6 text-indigo-200"><MessageSquare className="w-10 h-10 transform scale-x-[-1]" /></div>
              <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed italic z-10 select-text">
                "The entrepreneurship mentorship sessions during our final semester gave us tools regarding data-protection guidelines and financial registration templates. Developing a structured business blueprint helped our tailoring cooperative secure a local machinery grant. Highly recommended platform!"
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-900 text-emerald-105 font-bold font-mono rounded-full flex items-center justify-center text-xs">AY</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Aminat Y.</h4>
                  <p className="text-[10px] text-slate-450 font-mono mt-0.5">Kaduna, Nigeria · Fashion Pattern Design Alumna</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. FAQ ACCORDION SECTION */}
      <section id="faqs" className="py-20 md:py-24 bg-slate-50 scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-widest block leading-none">Frequently Answered Answers</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">Trainee Help & Support FAQ</h2>
            <p className="text-xs text-slate-500">Find swift clarifications regarding online validations and digital certificates dispatch rules.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((f, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden text-left"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full py-4.5 px-6 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 select-text">{f.q}</span>
                    <div className="h-6 w-6 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-500">
                      <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isOpen ? "rotate-180 text-indigo-650" : ""}`} />
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
                        <div className="px-6 pb-5 pt-1 text-xs text-slate-505 leading-relaxed font-semibold border-t border-slate-50 select-text font-mono">
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

      {/* 9. GOVERNMENT-GRADE FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t-4 border-emerald-600 font-mono text-xs">
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
              <span className="block">Support: <strong className="text-slate-100 font-mono select-all">support@ideas-tvet.ng</strong></span>
              <span className="block mt-1">Helpline: <strong className="text-slate-100 font-mono select-all">+234 (0) 90 3242 5592</strong></span>
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
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("FME TVET National Support: support@uniqueideas.dontechservicesconst.com"); }} className="hover:text-white hover:underline">Support Desk Chat</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("National TVET syllabus verified."); }} className="hover:text-white hover:underline">Syllabus Guidelines</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("Accredited centers map loaded."); }} className="hover:text-white hover:underline">TSP Registration Hub</a></li>
              <li><button onClick={onLoginShow} className="hover:text-white hover:underline bg-transparent border-none p-0 cursor-pointer text-left">Governance Administration Portal</button></li>
            </ul>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-100 font-medium uppercase tracking-wider text-[11px]">Legal Regulations & Policy</h4>
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

        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-355">
          <p className="select-text">© {new Date().getFullYear()} Federal Ministry of Education · IDEAS Initiative Program. Built for Unique Technology Nig. Ltd.</p>
          <div className="flex items-center gap-2">
            <span>FEDERAL REPUBLIC OF NIGERIA</span>
            <span className="h-0.5 w-6 bg-emerald-500"></span>
            <span className="h-0.5 w-6 bg-white"></span>
            <span className="h-0.5 w-6 bg-emerald-500"></span>
          </div>
        </div>
      </footer>

      {/* 10. MODAL: TRACK ADMISSION & CANDIDATE LOG-IN */}
      <AnimatePresence>
        {showTrackerModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl relative border-t-4 border-t-indigo-650"
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

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-400 leading-normal text-left mt-5 font-mono">
                💡 <span className="font-bold">Sandbox Hint</span>: If you just submitted a provisional registration, log in using your registered Email along with your 11-digit NIN as the password!
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 11. MODAL: PROVISIONAL APPLICANT REGISTRATION FORM */}
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
                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded text-[10px] font-mono leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>COHORT B PORTAL RESYNC</span>
                </div>
                <h3 className="text-lg font-black text-slate-950 font-display">Provisional Trainee Enrollment Registry</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">Please fill out your identity parameters. The system will auto-verify your background logs and generate validation templates.</p>
              </div>

              {applyError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 font-semibold text-xs p-3.5 rounded-lg mt-4 text-left">
                  {applyError}
                </div>
              )}

              {applySuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold text-xs p-4 rounded-lg mt-4 text-left space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="font-bold">Application Filed Successfully!</span>
                  </div>
                  <p className="leading-relaxed font-mono text-[11px]">{applySuccessMsg}</p>
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        placeholder="11-digit NIN number"
                        value={applyNin}
                        onChange={(e) => setApplyNin(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="bvn-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Bank Verification Number (bvn)</label>
                      <input
                        id="bvn-input"
                        type="text"
                        required
                        pattern="\d{11}"
                        maxLength={11}
                        placeholder="11-digit BVN number"
                        value={applyBvn}
                        onChange={(e) => setApplyBvn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="state-select" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Roster State Center</label>
                      <select
                        id="state-select"
                        value={applyState}
                        onChange={(e) => setApplyState(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
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
                      <label htmlFor="gender-select" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Candidate Gender</label>
                      <select
                        id="gender-select"
                        value={applyGender}
                        onChange={(e) => setApplyGender(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={applyLoading}
                    className="w-full bg-emerald-650 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {applyLoading ? "Submitting Application Parameters..." : "Submit My Enrollment Application"}
                  </button>

                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-relaxed font-semibold">
                      Please guarantee the legitimacy of the NIN and BVN inputs. These parameters correspond with official registries for real-time validation. Double entries will forfeit seat quotas.
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
