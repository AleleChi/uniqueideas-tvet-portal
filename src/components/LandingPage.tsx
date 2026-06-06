/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, ShieldCheck, HelpCircle, ArrowRight, CheckCircle2, 
  Users, MapPin, Award, GraduationCap, ChevronDown, ChevronRight, Check,
  Cpu, Scissors, Zap, Hammer, Sprout, Car, Sparkles, MessageSquare, 
  BookOpen, Clock, Lock, KeyRound, Mail, AlertTriangle, Search, Menu, 
  X, Landmark, BadgeCheck, FileText, Phone, Play, CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../config/api";

interface LandingPageProps {
  onLoginShow: () => void;
  onLoginSuccess: (email: string, pass: string) => Promise<boolean>;
}

// Lightweight dynamic counter component for premium look
function AnimatedCounter({ target, suffix = "", duration = 1200 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = target;
    if (end === 0) return;
    
    const totalFrames = 40;
    const increment = Math.ceil(end / totalFrames);
    const frameDuration = duration / totalFrames;
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, frameDuration);
    
    return () => clearInterval(timer);
  }, [target, duration]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

export function LandingPage({ onLoginShow, onLoginSuccess }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Interactive Tracker parameters
  const [trackEmail, setTrackEmail] = useState("");
  const [trackPassword, setTrackPassword] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showTrackerModal, setShowTrackerModal] = useState(false);

  // Quick Verification parameter inside the dedicated section
  const [quickVerifyCode, setQuickVerifyCode] = useState("");

  const faqs = [
    { 
      q: "Who can participate in the IDEAS-TVET initiative?", 
      a: "Participation is open to eligible Nigerian citizens targeted by regional training service providers. Eligible trainees are selected through competitive physical screening, national board eligibility filters, and local equity quotas to guarantee equal distribution of training benefits." 
    },
    { 
      q: "How are trainees selected and onboarded?", 
      a: "Trainees are officially mapped and selected by accredited Training Service Providers (TSPs) under strict supervision of the State Coordination Offices and the Federal Ministry of Education. Selection is bound to National Identity Number (NIN) credentials and verified bank coordinates to maintain absolute transparency." 
    },
    { 
      q: "Can I register as a student directly on this portal?", 
      a: "No, self-registration is strictly deactivated on the public portal to secure regulatory boundaries and prevent fraudulent entries. Candidate listings and provisional enrollment portfolios can only be created by certified, accredited state-designated Training Service Providers (TSPs) through our official administrative onboarding networks." 
    },
    { 
      q: "How do I verify an official document using the portal?", 
      a: "Third-party employers, corporate bodies, and state offices can verify credentials by entering the watermarked Document Reference ID into our Central Registry Verification form. The portal instantly pulls active digital logs certifying the integrity and timeline logs of the requested certificate or letter." 
    },
    { 
      q: "How do training institutions and providers participate?", 
      a: "Technical colleges, vocational centers, and private training institutions must be heavily vetted and certified by the National Board for Technical Education (NBTE) and accredited as active TSPs before receiving portal access credentials and state-funded trainee allocations." 
    }
  ];

  const focalPrograms = [
    { 
      title: "Solar PV Installations & Green Energy Tech", 
      sector: "Power & Renewable Technology", 
      desc: "Comprehensive training in solar PV arrays configuration, hybrid inverter synchronization, local battery storage setups, and green power grid regulations.", 
      icon: Zap, 
      capacity: "120 seats limit" 
    },
    { 
      title: "ICT Systems Engineering & Desktop Diagnostics", 
      sector: "Information & Communication Tech", 
      desc: "Hands-on instruction targeting motherboard electronics diagnostic loops, micro-soldering, networking infrastructures, and secure operating environments.", 
      icon: Cpu, 
      capacity: "180 seats limit" 
    },
    { 
      title: "EFI Automotive Diagnostics & Systems Repair", 
      sector: "Transportation & Advanced Mobility", 
      desc: "Technical mapping of electronic fuel injection systems, computer-guided fault-code parsing, electronic telemetry standardizations, and mechanical retrofits.", 
      icon: Car, 
      capacity: "90 seats limit" 
    },
    { 
      title: "Precision Welding & Industrial Metal Fabrication", 
      sector: "Metallurgical Technologies", 
      desc: "Advanced shielded metal arc welding (SMAW) methods, computerized CAD blueprints translation, safety stress-testing, and architectural steel assembly.", 
      icon: Hammer, 
      capacity: "150 seats limit" 
    },
    { 
      title: "Apparel Garment Engineering & Pattern Design", 
      sector: "Creative & Manufacturing Sectors", 
      desc: "Garment design logic, industrialized apparel blueprinting, specialized CAD grading applications, and massive production line logistical workflows.", 
      icon: Scissors, 
      capacity: "200 seats limit" 
    },
    { 
      title: "Automated Greenhouse Farming & Hydroponics", 
      sector: "Agribusiness & Sustainable Food Tech", 
      desc: "System design of modern micro-irrigation controller boards, liquid nutrient formulations, water recycler routines, and high-yield distribution pipelines.", 
      icon: Sprout, 
      capacity: "110 seats limit" 
    }
  ];

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setTrackLoading(true);

    try {
      const ok = await onLoginSuccess(trackEmail, trackPassword);
      if (ok) {
        setShowTrackerModal(false);
      } else {
        setTrackError("Invalid Credentials. Please enter your registered email address and use your 11-digit NIN as password.");
      }
    } catch (err: any) {
      setTrackError("Connection breakdown with authentication servers.");
    } finally {
      setTrackLoading(false);
    }
  };

  const handleQuickVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVerifyCode.trim()) return;
    // Safely redirect third-parties to verification route with target search param
    window.location.hash = `#/verify-document?code=${encodeURIComponent(quickVerifyCode.trim())}`;
  };

  return (
    <div id="ideas-tvet-portal-layout" className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      
      {/* GOVERNMENT TOPMOST REGULATORY HEADER BAR */}
      <div className="bg-slate-950 border-b border-emerald-500/30 text-white py-2 px-6 flex items-center justify-between text-[10px] font-mono tracking-wider font-semibold">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-3.5 bg-emerald-500 rounded-xs"></span>
          <span className="inline-block h-2 w-3.5 bg-white rounded-xs"></span>
          <span className="inline-block h-2 w-3.5 bg-emerald-500 rounded-xs"></span>
          <span className="text-slate-350 uppercase">Official Portal of the Federal Republic of Nigeria</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-slate-400">
          <span>COHORT B ADMISSIONS TIMELINE ACTIVE</span>
          <span>·</span>
          <span>SYSTEM SECURITY: SECURE AES-256</span>
        </div>
      </div>

      {/* PRIMARY NAVIGATION PANELS */}
      <nav id="nav-system-top" className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-40 px-6 py-4.5 shadow-3xs transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Institutional logo & name */}
          <a href="#" className="flex items-center gap-3 select-none group text-left">
            <div className="h-10 w-10 bg-emerald-950 rounded-xl flex items-center justify-center text-white font-bold border border-emerald-600/30 shadow-xs group-hover:scale-[101%] transition-all">
              <Landmark className="w-5.5 h-5.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-emerald-700 font-mono uppercase tracking-widest block leading-none">
                Federal Ministry of Education
              </span>
              <h2 className="text-[14px] font-black text-slate-900 font-display mt-0.5 leading-none tracking-tight">
                IDEAS-TVET Initiative
              </h2>
            </div>
          </a>

          {/* Desktop Navitems */}
          <div className="hidden lg:flex items-center gap-7 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <a href="#about" className="hover:text-emerald-700 transition">About</a>
            <a href="#impact" className="hover:text-emerald-700 transition">National Impact</a>
            <a href="#programs" className="hover:text-emerald-700 transition">Featured Tracks</a>
            <a href="#how-it-works" className="hover:text-emerald-700 transition">Portal Flow</a>
            <a href="#verification-section" className="hover:text-emerald-700 transition">Verify Document</a>
            <a href="#support" className="hover:text-emerald-700 transition">Support</a>
          </div>

          {/* Action buttons (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setShowTrackerModal(true)}
              className="text-slate-700 hover:text-emerald-800 hover:bg-slate-50 border border-slate-200 hover:border-slate-350 font-mono font-extrabold py-2 px-4 rounded-lg text-[11.5px] transition uppercase tracking-wider cursor-pointer"
            >
              Track Application
            </button>
            <button
              onClick={onLoginShow}
              className="bg-emerald-900 hover:bg-emerald-950 text-white font-mono font-extrabold py-2 px-4 rounded-lg text-[11.5px] flex items-center gap-1.5 transition shadow-xs cursor-pointer uppercase tracking-wider"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Access Portal</span>
            </button>
          </div>

          {/* Hamburger menu button for small screens */}
          <div className="flex lg:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none"
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
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-750 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                About
              </a>
              <a 
                href="#impact" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-750 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                National Impact
              </a>
              <a 
                href="#programs" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-750 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Featured Tracks
              </a>
              <a 
                href="#how-it-works" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-750 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Portal Flow
              </a>
              <a 
                href="#verification-section" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-750 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Verify Document
              </a>
              <a 
                href="#support" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-750 font-bold py-1 px-2 hover:bg-slate-50 rounded"
              >
                Support Hub
              </a>
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 font-sans">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowTrackerModal(true);
                  }}
                  className="w-full text-center text-slate-700 font-bold py-2.5 px-4 rounded-lg border border-slate-250 hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Track Application
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginShow();
                  }}
                  className="w-full text-center bg-emerald-905 bg-emerald-900 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-emerald-950 cursor-pointer flex items-center justify-center gap-1.5 text-xs text-center"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Access Portal</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* PREMIUM HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-24 bg-linear-to-b from-white to-slate-50">
        
        {/* Soft background glow features mimicking sovereign authority */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] bg-slate-900/5 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero text descriptor */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-slate-700 font-extrabold font-mono text-[9px] uppercase tracking-wider">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              <span>Federal Ministry of Education · IDEAS-TVET</span>
            </div>

            <div className="space-y-3">
              <p className="text-emerald-700 font-extrabold font-mono text-xs uppercase tracking-widest block">
                Sovereign Vocational Empowerment System
              </p>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight font-display leading-[1.12]">
                Skills Development for <span className="text-emerald-900 block sm:inline">National Growth</span>
              </h1>
            </div>

            <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed font-medium max-w-xl">
              Coordinating technical masteries with sovereign transparency. The Innovative Development for Effectiveness in the Acquisition of Skills (IDEAS) project, supported by the World Bank, empowers certified Training Service Providers (TSPs) to register candidates, track biometrics, compile credential histories, and verify credentials.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-4">
              <button
                onClick={onLoginShow}
                className="bg-emerald-900 hover:bg-emerald-950 text-white font-mono font-extrabold py-3.5 px-6 rounded-xl text-[11px] flex items-center justify-center gap-2 shadow-sm transition active:scale-[98%] cursor-pointer uppercase tracking-wider"
              >
                <span>Access Portal</span>
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById("verification-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-350 font-mono font-extrabold py-3.5 px-6 rounded-xl text-[11px] transition active:scale-[98%] cursor-pointer text-center uppercase tracking-wider"
              >
                Verify Document
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-4 text-slate-500 text-[10px] font-mono font-bold tracking-wide">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Authorized TSPs Dashboard Access</span>
              </span>
              <span className="hidden sm:inline-block h-1 w-1 bg-slate-300 rounded-full" />
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Watermarked Stamp PDF Transcripts</span>
              </span>
            </div>
          </div>

          {/* Hero right panel - Telemetry Dashboard preview demonstrating portal systems */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-slate-350/5 rounded-3xl filter blur-2xl rotate-3 -z-10" />
            
            <div className="w-full max-w-md bg-slate-950 text-white border border-slate-800 rounded-2xl shadow-xl p-6 text-left relative overflow-hidden">
              {/* Outer micro decorative stripes */}
              <div className="absolute top-0 right-0 h-40 w-1 bg-gradient-to-b from-emerald-500 via-transparent to-transparent"></div>
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8.5 w-8.5 bg-emerald-950/80 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-[10.5px] font-black text-white uppercase font-mono tracking-wide">SECURE REGISTRY</h4>
                    <p className="text-[8px] text-slate-400 font-mono font-bold uppercase tracking-widest">Admissions Coordination</p>
                  </div>
                </div>
                <span className="text-[8px] px-2 py-0.5 bg-slate-900 border border-slate-800 text-emerald-400 font-mono rounded font-extrabold uppercase">
                  Gov-Gate Checked
                </span>
              </div>

              {/* Program features highlighting student portal access benefits */}
              <div className="space-y-4 font-sans text-xs text-slate-300 leading-relaxed py-4">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Access federal verification streams, download watermarked admission files, print verified transcripts, and accept training allocations securely.
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-3 bg-slate-900/60 border border-slate-850 rounded-xl">
                    <BadgeCheck className="w-4.5 h-4.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-bold text-white text-[11px] uppercase tracking-wide">Pre-Selected Candidates Space</h5>
                      <p className="text-[10px] font-sans text-slate-400 mt-0.5 leading-normal">
                        Verify provisional status, accept placements, and download certified enrollment forms with 11-digit civil credential security.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 bg-slate-900/60 border border-slate-850 rounded-xl">
                    <GraduationCap className="w-4.5 h-4.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-bold text-white text-[11px] uppercase tracking-wide">Central Training Directory</h5>
                      <p className="text-[10px] font-sans text-slate-400 mt-0.5 leading-normal">
                        Accredited training service tracks covering technical solar configurations, ICT system diagnostics, and precision fabrications.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowTrackerModal(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition font-mono uppercase tracking-wide cursor-pointer shadow-3xs"
                >
                  <Search className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Verify Placement Status</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-900 text-[8.5px] font-mono text-slate-500">
                <span>PROJECT ID: FME-IDEAS-COHORT-B</span>
                <span className="text-emerald-500 font-bold uppercase transition">STAMPED AUDIT LEDGER LOCK</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* SOVEREIGN COOP PARTNERS STRIP */}
      <section id="branding-strip" className="border-t border-b border-slate-200 bg-white py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-[9px] font-extrabold text-slate-400 font-mono uppercase tracking-widest block">
              ACCREDITED PROGRAM PARTNERS & GOVERNANCE AUTHORITIES
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 items-center justify-center">
            {/* World Bank Logo Box */}
            <div className="border border-slate-150 px-4 py-3 bg-slate-50 rounded-xl flex items-center gap-2.5">
              <Landmark className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase leading-none block">Supporting Body</span>
                <h5 className="text-[10px] font-extrabold text-slate-700 mt-1 uppercase font-mono">WORLD BANK</h5>
              </div>
            </div>

            {/* FME Logo Box */}
            <div className="border border-slate-150 px-4 py-3 bg-slate-50 rounded-xl flex items-center gap-2.5">
              <Building className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase leading-none block">Federal Ministry</span>
                <h5 className="text-[10px] font-extrabold text-slate-700 mt-1 uppercase font-mono">FME NIGERIA</h5>
              </div>
            </div>

            {/* NBTE Logo Box */}
            <div className="border border-slate-150 px-4 py-3 bg-slate-50 rounded-xl flex items-center gap-2.5">
              <Award className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase leading-none block">Regulatory Board</span>
                <h5 className="text-[10px] font-extrabold text-slate-700 mt-1 uppercase font-mono">NBTE SECRETARIAT</h5>
              </div>
            </div>

            {/* IDEAS Logo Box */}
            <div className="border border-slate-150 px-4 py-3 bg-slate-50 rounded-xl flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-slate-400 uppercase leading-none block">National Initiative</span>
                <h5 className="text-[10px] font-extrabold text-slate-700 mt-1 uppercase font-mono">IDEAS PROJECTS</h5>
              </div>
            </div>

            {/* Verification Security Standard Box */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 border border-emerald-150 px-4 py-3 bg-emerald-50/20 rounded-xl flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-left leading-none">
                <span className="text-[8px] font-mono font-bold text-emerald-600 uppercase leading-none block">Identity Standard</span>
                <h5 className="text-[10px] font-extrabold text-slate-800 mt-1 uppercase font-mono">CIVIL NIN SENSITIVE</h5>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAM IMPACT SECTION */}
      <section id="impact" className="py-20 bg-slate-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-3 mb-16 max-w-xl mx-auto">
            <span className="text-xs font-bold text-emerald-700 font-mono uppercase tracking-widest block leading-none">Initiative Outcomes</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 font-display">Program Impact Metrics</h2>
            <p className="text-xs text-slate-500">Live indicators of registered training candidates, certificate completions, and state participation benchmarks.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-left space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">National Reach</span>
              <div className="text-3xl font-black font-mono text-slate-900">
                <AnimatedCounter target={36} />
              </div>
              <p className="text-[10px] uppercase font-mono font-bold text-emerald-700">States + FCT</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-left space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Trainees Enrolled</span>
              <div className="text-3xl font-black font-mono text-slate-900">
                <AnimatedCounter target={15420} suffix="+" />
              </div>
              <p className="text-[10px] uppercase font-mono font-bold text-emerald-700">Verified Profiles</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-left space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Accredited TSPs</span>
              <div className="text-3xl font-black font-mono text-slate-900">
                <AnimatedCounter target={120} suffix="+" />
              </div>
              <p className="text-[10px] uppercase font-mono font-bold text-emerald-700">Active Centers</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-left space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Stamp Documents</span>
              <div className="text-3xl font-black font-mono text-slate-900">
                <AnimatedCounter target={45000} suffix="+" />
              </div>
              <p className="text-[10px] uppercase font-mono font-bold text-emerald-700">Generated PDFs</p>
            </div>

            <div className="bg-col-span-2 col-span-2 lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 text-left space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Graduated Core</span>
              <div className="text-3xl font-black font-mono text-slate-900">
                <AnimatedCounter target={12800} suffix="+" />
              </div>
              <p className="text-[10px] uppercase font-mono font-bold text-emerald-700">Certificates Issued</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 bg-white border-t border-b border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-3 mb-16 max-w-xl mx-auto">
            <span className="text-xs font-bold text-emerald-700 font-mono uppercase tracking-widest block leading-none">Onboarding Protocols</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 font-display">Trainee Lifecycle Workflow</h2>
            <p className="text-xs text-slate-500">The 4-stage regulatory loop designed to align candidates with certified academic centers and stamp digital credentials.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 h-6 w-6 bg-emerald-50 text-emerald-800 text-[10px] font-black font-mono flex items-center justify-center rounded-lg border border-emerald-200">
                01
              </div>
              <div className="space-y-3 pt-4">
                <Users className="w-6 h-6 text-emerald-800" />
                <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Beneficiary Selection</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                  Rigorous civil screening and eligibility criteria validation backed by official NIN identification check streams.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 h-6 w-6 bg-emerald-50 text-emerald-800 text-[10px] font-black font-mono flex items-center justify-center rounded-lg border border-emerald-200">
                02
              </div>
              <div className="space-y-3 pt-4">
                <Building className="w-6 h-6 text-emerald-800" />
                <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Training Placement</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                  Accurate pairing of validated trainees with fully accredited state Training Service Providers (TSPs).
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 h-6 w-6 bg-emerald-50 text-emerald-800 text-[10px] font-black font-mono flex items-center justify-center rounded-lg border border-emerald-200">
                03
              </div>
              <div className="space-y-3 pt-4">
                <FileText className="w-6 h-6 text-emerald-800" />
                <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Admission Documents</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                  Digitized signature check systems, provisional allocation letters generation, and signed secure acceptance uploads.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 h-6 w-6 bg-emerald-50 text-emerald-800 text-[10px] font-black font-mono flex items-center justify-center rounded-lg border border-emerald-200">
                04
              </div>
              <div className="space-y-3 pt-4">
                <Award className="w-6 h-6 text-emerald-800" />
                <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Certified Graduation</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                  Curriculum completion verified under external ministry assessment. Delivery of watermarked stamped certificates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DOCUMENT VERIFICATION SECTION */}
      <section id="verification-section" className="py-20 bg-slate-950 text-white scroll-mt-20 relative overflow-hidden">
        {/* Abstract grids */}
        <div className="absolute inset-0 bg-radial(at_90%_10%,_var(--color-slate-900)_0%,_transparent_50%) pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left descriptors block */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-emerald-400 font-bold font-mono text-[9px] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Central Validation Infrastructure</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                Document Verification Portal
              </h2>
              
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold">
                This verification gateway allows third-party institutions, state corporations, employers, and banks to instantly verify documents issued under NBTE regulatory frameworks. Confirm authenticity, verify student records, and check enrollment timestamps.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-350">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Provisional Admission Letters</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-350">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Student Admission Forms</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-350">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Accredited Letters of Acceptance</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-350">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>TVET Digital Certifications</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => { window.location.hash = "#/verify-document"; }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-extrabold py-3.5 px-6 rounded-xl text-[11px] uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Open Verification System</span>
                </button>
              </div>
            </div>

            {/* Right form input widget block */}
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl text-left space-y-5">
              <div>
                <h4 className="text-xs font-black uppercase font-mono text-emerald-400 tracking-wider">Quick Document Lookup</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">SEARCH ACTIVE COHORT CORE REGISTRY DIRECTLY</p>
              </div>

              <form onSubmit={handleQuickVerifySubmit} className="space-y-4 font-sans">
                <div className="space-y-1">
                  <label htmlFor="quick-verify-input" className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Document Dispatch Reference ID</label>
                  <div className="relative">
                    <input
                      id="quick-verify-input"
                      type="text"
                      required
                      placeholder="e.g. DOC-123456 or DISP-TOKEN"
                      value={quickVerifyCode}
                      onChange={(e) => setQuickVerifyCode(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg py-2.5 pl-4 pr-12 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold uppercase transition"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-2 h-7.5 w-7.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center rounded-md cursor-pointer focus:outline-none transition"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg text-[10.5px] text-slate-400 leading-normal font-mono">
                  💡 <span className="font-bold text-white">Auditing Tip</span>: Look for the watermarked signature ref code at the header margin or footer base of the digital letter.
                </div>
              </form>
            </div>

          </div>
        </div>
      </section>

      {/* TRAINING SPECIALITIES */}
      <section id="programs" className="py-20 bg-slate-50/50 border-t border-b border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-3 mb-16 max-w-xl mx-auto">
            <span className="text-xs font-bold text-emerald-700 font-mono uppercase tracking-widest block leading-none">Vetted technical tracks</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 font-display">Priority Vocational Curricula</h2>
            <p className="text-xs text-slate-500">Rigorous 6-month hands-on programs certified under FME standards with leading training centers.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {focalPrograms.map((p, idx) => {
              const IconC = p.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-250/70 border-slate-200 rounded-2xl p-6 flex flex-col justify-between text-left space-y-4 hover:shadow-xs hover:border-slate-300 transition-all border-t-4 border-t-emerald-800"
                >
                  <div className="space-y-3">
                    <div className="p-2.5 bg-slate-50 border border-slate-150 text-slate-800 rounded-xl w-fit flex items-center justify-center">
                      <IconC className="w-4.5 h-4.5 text-slate-800" />
                    </div>
                    <div>
                      <span className="text-[8px] font-bold font-mono text-emerald-700 uppercase tracking-widest block bg-emerald-50 px-1.5 py-0.5 rounded w-fit mb-1.5">{p.sector}</span>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight font-display">{p.title}</h3>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{p.desc}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono">
                    <span className="text-slate-400 uppercase tracking-wider font-bold">Priority Sector</span>
                    <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded font-bold">{p.capacity}</span>
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
          
          <div className="text-center space-y-3 mb-16 max-w-xl mx-auto">
            <span className="text-xs font-bold text-emerald-700 font-mono uppercase tracking-widest block leading-none">Frequently Answered Questions</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 font-display">Regulatory Support & FAQ</h2>
            <p className="text-xs text-slate-500">Official clarifications concerning biometric validation, placement checks, and authorized enrollment gates.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((f, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden text-left transition-colors hover:border-slate-300"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full py-4 px-6 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-900 tracking-wide select-text">{f.q}</span>
                    <div className="h-6 w-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-550 shrink-0">
                      <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-250 ${isOpen ? "rotate-180 text-emerald-700" : ""}`} />
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
                        <div className="px-6 pb-5 pt-1 text-xs text-slate-600 leading-relaxed font-medium border-t border-slate-200/50 select-text font-sans">
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

      {/* NEW CONTACT & HELP DESK SECTION */}
      <section id="support" className="py-16 bg-slate-50 border-t border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 text-left">
              <div className="h-9 w-9 bg-emerald-50 text-emerald-800 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Official Office Hours</h4>
              <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                The central support desk and regulatory help coordinators operate Monday through Friday, 8:30 AM to 5:00 PM GMT+1 (excluding federal public holidays).
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 text-left">
              <div className="h-9 w-9 bg-emerald-50 text-emerald-800 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Central Help Desk Coordinates</h4>
              <div className="text-[11px] leading-normal text-slate-500 font-medium space-y-1 font-mono">
                <p>Support Email: <span className="text-emerald-800 font-bold select-all">support@ideas-tvet.ng</span></p>
                <p>Telephone: <span className="text-emerald-800 font-bold select-all">+234 (0) 90 3242 5592</span></p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 text-left">
              <div className="h-9 w-9 bg-emerald-50 text-emerald-800 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">Federal Secretariat Location</h4>
              <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                Federal Ministry of Education Headquarters, Plot 245 Samuel Ademulegun Avenue, Central Business District, Abuja, FCT, Nigeria.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL COHORT FOOTER DESIGNED WITH STRICT GOVERNANCE RECOGNITION */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-6 border-t font-mono text-xs border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
          
          <div className="space-y-4">
            <h4 className="text-slate-100 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 font-display">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              IDEAS-TVET Secretariat
            </h4>
            <p className="text-[11px] leading-relaxed select-text font-sans text-slate-400">
              Federal Ministry of Education Headquarters, Plot 245 Samuel Ademulegun Avenue, Central Business District, Abuja, FCT, Nigeria.
            </p>
            <div className="pt-2 text-slate-400 font-sans">
              <span className="block">Support: <strong className="text-white font-mono select-all">support@ideas-tvet.ng</strong></span>
              <span className="block mt-1">Helpline: <strong className="text-white font-mono select-all">+234 (0) 90 3242 5592</strong></span>
            </div>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-100 font-medium uppercase tracking-wider text-[10px]">Accredited Sectors</h4>
            <ul className="space-y-2 text-[11px] text-slate-400 font-sans">
              <li>Computer Hardware & Repairs</li>
              <li>Solar Energy Systems Installation</li>
              <li>Civil & Masonry Engineering</li>
              <li>Apparel Pattern Drafting</li>
              <li>High-yield Hydroponics</li>
            </ul>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-100 font-medium uppercase tracking-wider text-[10px]">Authorized Links</h4>
            <ul className="space-y-2 text-[11px] font-sans">
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("National TVET Support Line is available at support@ideas-tvet.ng."); }} className="hover:text-white hover:underline transition">Support Desk Chat</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("National TVET syllabus verified."); }} className="hover:text-white hover:underline transition">Syllabus Guidelines</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); alert("Accredited centers roster loading..."); }} className="hover:text-white hover:underline transition">TSP Registration Hub</a></li>
              <li><button onClick={onLoginShow} className="hover:text-white hover:underline bg-transparent border-none p-0 cursor-pointer text-left font-mono text-[11px]">Officer Administration Login</button></li>
            </ul>
          </div>

          <div className="space-y-4 font-mono">
            <h4 className="text-slate-100 font-medium uppercase tracking-wider text-[10px]">Legal Regulations</h4>
            <p className="text-[11px] leading-relaxed font-sans text-slate-400">
              Identity parameters profiling conforms with the Nigeria Data Protection Regulation (NDPR) acts. Complete terms enable fast secure document verification with zero spam leakage.
            </p>
            <div className="flex gap-4 pt-1 font-mono text-[10px] text-slate-500 text-left font-bold">
              <a href="#" onClick={(e) => { e.preventDefault(); alert("NDPR compliant Privacy Policy activated."); }} className="hover:text-white hover:underline transition">Privacy Policy</a>
              <span>·</span>
              <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of Service activated."); }} className="hover:text-white hover:underline transition">Terms of Service</a>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p className="select-text">© {new Date().getFullYear()} Federal Ministry of Education · IDEAS Initiative Program.</p>
          <div className="flex items-center gap-2 font-mono text-[10px]">
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
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl relative border-t-4 border-t-emerald-800"
            >
              
              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowTrackerModal(false);
                  setTrackError(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-mono font-bold hover:bg-slate-100 rounded-lg p-1.5 focus:outline-none cursor-pointer"
              >
                ✕
              </button>

              <div className="space-y-4 text-left">
                <div className="h-10 w-10 bg-emerald-55 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-800">
                  <Search className="w-5 h-5 text-emerald-805 text-emerald-800" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950 font-display">Candidate Tracker & Student Portal</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">Verify your provisional status or access official files using secure credentials.</p>
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
                      placeholder="e.g. trainee@ideas-tvet.ng"
                      value={trackEmail}
                      onChange={(e) => setTrackEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-medium"
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                    />
                    <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={trackLoading}
                  className="w-full bg-emerald-800 hover:bg-emerald-950 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  {trackLoading ? "Searching registry databases..." : "Access Candidate Portal"}
                </button>
              </form>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-[10px] text-slate-500 leading-normal text-left mt-5 font-mono">
                💡 <span className="font-bold text-slate-700">Sandbox Access Guidelines</span>:<br />Log in with any active student email (e.g., student registered by TSP) using their 11-digit National Identity Number (NIN) as default password.
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
