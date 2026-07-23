/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, ShieldCheck, HelpCircle, ArrowRight, CheckCircle2, 
  Users, MapPin, Award, GraduationCap, ChevronDown, ChevronRight, Check,
  Cpu, Scissors, Zap, Hammer, Sprout, Car, MessageSquare, 
  BookOpen, Clock, Lock, KeyRound, Mail, AlertTriangle, Search, Menu, 
  X, Landmark, BadgeCheck, FileText, Phone, Play, CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingPageProps {
  onLoginShow: () => void;
  onLoginSuccess: (email: string, pass: string) => Promise<boolean | { success: boolean; message?: string }>;
}

function AnimatedCounter({ target, suffix = "", duration = 1000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = target;
    if (end === 0) return;
    
    const totalFrames = 30;
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

  const [partners, setPartners] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState({
    supportEmail: "support@ideas-tvet.ng",
    supportPhone: "+234 (0) 90 3242 5592",
    dialablePhone: "+2349032425592",
    altPhone: "",
    officeHoursDays: "Monday to Friday",
    openingTime: "8:30 AM",
    closingTime: "5:00 PM",
    timezone: "GMT+1",
    publicHolidayNote: "excluding public holidays",
    officeName: "Federal Ministry of Education Headquarters",
    addressLine1: "Plot 245 Samuel Ademulegun Avenue",
    addressLine2: "Central Business District",
    city: "Abuja",
    stateFct: "FCT",
    country: "Nigeria",
    postalCode: "",
    mapUrl: "",
    footerDescription: "Supporting practical training, clearer admissions and better access to technical skills.",
    copyright: "Federal Ministry of Education · National IDEAS Initiative Project",
    privacyPolicyUrl: "#privacy",
    termsOfServiceUrl: "#terms",
    accessibilityUrl: "#accessibility"
  });

  useEffect(() => {
    fetch("/api/public/site-settings")
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("HTTP " + res.status);
      })
      .then(data => {
        if (data && data.supportEmail) {
          setSiteSettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});

    fetch("/api/public/institutional-partners")
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("HTTP " + res.status);
      })
      .then(data => {
        setPartners(data);
      })
      .catch(err => {
        console.error("Failed loading public institutional partners:", err);
      });
  }, []);

  const faqs = [
    { 
      q: "Who can apply for the IDEAS-TVET programme?", 
      a: "The initiative is open to eligible Nigerian citizens residing in participating states. Selection is conducted by accredited regional training providers based on objective criteria, including state equity standards, physical screenings, and basic educational alignment." 
    },
    { 
      q: "How is my personal information protected?", 
      a: "Trainee records are officially managed and verified by accredited Training Service Providers (TSPs). To protect data accuracy and prevent identity fraud, every profile is verified against official national identity records." 
    },
    { 
      q: "Can I apply directly through this website?", 
      a: "Applications and candidate registrations are managed directly through accredited Training Service Providers (TSPs) in participating states. Training centres handle candidate screening and enrollment within designated programme places." 
    },
    { 
      q: "How can an organisation verify my document?", 
      a: "Employers, licensing boards, and official organisations can verify letters or certificate transcripts using our document verification tool. Simply enter the document reference number to confirm its official record." 
    },
    { 
      q: "How does a training centre become accredited?", 
      a: "Technical colleges, polytechnics, and vocational institutions undergo technical audits by the National Board for Technical Education (NBTE) and state steering offices before being approved to participate in the programme." 
    }
  ];

  const focalPrograms = [
    { 
      id: "solar",
      title: "Solar installation", 
      officialTitle: "Solar PV Installations & Renewable Energy Engineering",
      sector: "Renewable energy", 
      desc: "Learn to install, test and maintain solar power systems safely.", 
      icon: Zap, 
      status: "Applications open",
      tint: "from-amber-500/10 via-amber-500/5 to-emerald-500/10",
      iconBg: "bg-amber-100 text-amber-800"
    },
    { 
      id: "ict",
      title: "Computer hardware and networking", 
      officialTitle: "ICT Systems Diagnostics & Network Infrastructure",
      sector: "Digital skills", 
      desc: "Build practical skills in computer repair, system setup and basic networking.", 
      icon: Cpu, 
      status: "Applications open",
      tint: "from-blue-500/10 via-indigo-500/5 to-emerald-500/10",
      iconBg: "bg-blue-100 text-blue-800"
    },
    { 
      id: "auto",
      title: "Automotive diagnostics and repair", 
      officialTitle: "EFI Automotive Systems Repair & Telemetry Diagnostics",
      sector: "Automotive", 
      desc: "Learn to identify faults, service vehicle systems and carry out essential repairs.", 
      icon: Car, 
      status: "Applications open",
      tint: "from-red-500/10 via-orange-500/5 to-emerald-500/10",
      iconBg: "bg-red-100 text-red-800"
    },
    { 
      id: "welding",
      title: "Precision welding and fabrication", 
      officialTitle: "Precision Welding & Metallurgical Fabrication",
      sector: "Manufacturing", 
      desc: "Learn structural welding techniques, blueprint interpretation and metal fabrication.", 
      icon: Hammer, 
      status: "Applications open",
      tint: "from-slate-500/10 via-slate-600/5 to-emerald-500/10",
      iconBg: "bg-slate-200 text-slate-800"
    },
    { 
      id: "apparel",
      title: "Fashion design and apparel", 
      officialTitle: "Apparel Engineering, Pattern Drafting & Fashion Tech",
      sector: "Creative skills", 
      desc: "Learn pattern drafting, apparel blueprinting and industrial production methods.", 
      icon: Scissors, 
      status: "Applications open",
      tint: "from-purple-500/10 via-pink-500/5 to-emerald-500/10",
      iconBg: "bg-purple-100 text-purple-800"
    },
    { 
      id: "agritech",
      title: "Agricultural technology", 
      officialTitle: "Automated Greenhouse Systems & Agri-Tech",
      sector: "Agriculture", 
      desc: "Learn automated irrigation, climate control and modern sustainable crop production.", 
      icon: Sprout, 
      status: "Applications open",
      tint: "from-emerald-500/10 via-teal-500/5 to-emerald-500/10",
      iconBg: "bg-emerald-100 text-emerald-800"
    }
  ];

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setTrackLoading(true);

    try {
      const result = await onLoginSuccess(trackEmail, trackPassword);
      const isOk = typeof result === "boolean" ? result : result.success;
      if (isOk) {
        setShowTrackerModal(false);
      } else {
        const errorMsg = typeof result === "object" && result.message 
          ? result.message 
          : "Credentials not recognized. Please check your registered email address or use your 11-digit NIN as password.";
        setTrackError(errorMsg);
      }
    } catch (err: any) {
      setTrackError("Unable to establish a secure connection with the verification server.");
    } finally {
      setTrackLoading(false);
    }
  };

  const handleQuickVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVerifyCode.trim()) return;
    window.location.hash = `#/verify-document?code=${encodeURIComponent(quickVerifyCode.trim())}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      
      {/* REFINED NAVIGATION */}
      <nav className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-40 px-4 sm:px-6 py-3 sm:py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <a href="#" className="flex items-center gap-2.5 select-none group text-left min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-900 rounded-lg flex items-center justify-center text-emerald-400 border border-slate-800 transition-transform group-hover:scale-105 shrink-0">
              <GraduationCap className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] sm:text-[9px] font-mono font-bold tracking-widest text-slate-400 block uppercase leading-none truncate">
                IDEAS-TVET ACCREDITED CENTER
              </span>
              <span className="text-[13px] sm:text-[14px] font-bold text-slate-900 font-display mt-0.5 block tracking-tight leading-tight truncate">
                Skills & Vocational Center
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-8 font-medium text-[13px] text-slate-500 tracking-wide">
            <a href="#about" className="hover:text-slate-900 transition-colors">About</a>
            <a href="#programs" className="hover:text-slate-900 transition-colors">Programs</a>
            <a href="#verification-section" className="hover:text-slate-900 transition-colors">Verify Documents</a>
            <a href="#faqs" className="hover:text-slate-900 transition-colors">Support & FAQ</a>
          </div>

          {/* Nav Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setShowTrackerModal(true)}
              className="text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 font-medium py-1.5 px-3.5 rounded-lg text-xs transition cursor-pointer"
            >
              Track Application
            </button>
            <button
              onClick={onLoginShow}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-1.5 px-4 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Access Portal</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center border border-slate-200 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden mt-3 pt-3 border-t border-slate-100 flex flex-col gap-3 text-left font-medium text-[13px] text-slate-600"
            >
              <a 
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 hover:bg-slate-50 rounded transition-colors"
              >
                About Initiative
              </a>
              <a 
                href="#programs" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 hover:bg-slate-50 rounded transition-colors"
              >
                Featured Programs
              </a>
              <a 
                href="#verification-section" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 hover:bg-slate-50 rounded transition-colors"
              >
                Verify Document
              </a>
              <a 
                href="#faqs" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 hover:bg-slate-50 rounded transition-colors"
              >
                FAQ Help Center
              </a>
              
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowTrackerModal(true);
                  }}
                  className="w-full text-center text-slate-600 font-medium py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Track Application
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginShow();
                  }}
                  className="w-full text-center bg-slate-900 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
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
      <section className="relative overflow-hidden pt-10 pb-12 sm:pt-16 sm:pb-20 lg:pt-24 lg:pb-32 bg-white font-sans">
        {/* Subtle atmospheric gradients and background accents */}
        <div className="absolute top-8 left-6 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-6 right-6 w-72 h-72 sm:w-96 sm:h-96 bg-slate-200/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 min-[375px]:px-5 min-[430px]:px-7 md:px-8 lg:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-16 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 text-left">
            
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-emerald-600 font-semibold text-[12px] min-[375px]:text-[12.5px] uppercase tracking-[0.03em] leading-snug mb-5 sm:mb-8 max-w-[28ch] min-[375px]:max-w-[32ch] sm:max-w-none"
            >
              IDEAS-TVET SKILLS DEVELOPMENT PROGRAMME
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-[32px] min-[375px]:text-[38px] min-[430px]:text-[42px] md:text-5xl lg:text-[56px] font-extrabold text-slate-900 tracking-tight font-display leading-[1.05] min-[375px]:leading-[1.08] max-w-[13ch] min-[375px]:max-w-[14ch] min-[430px]:max-w-[15ch] sm:max-w-xl lg:max-w-none mb-4.5 sm:mb-6"
            >
              Build practical skills for a changing economy.
            </motion.h1>
            
            {/* Supporting Paragraph */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-[15px] min-[375px]:text-[16px] min-[430px]:text-[17px] lg:text-[19px] text-slate-600 leading-[1.6] min-[375px]:leading-[1.65] font-normal max-w-[32ch] min-[375px]:max-w-[34ch] sm:max-w-xl lg:max-w-2xl mb-4 sm:mb-6"
            >
              Access industry-relevant training, manage your application and follow your progress through an accredited IDEAS-TVET training provider.
            </motion.p>

            {/* Trust Line */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-[13.5px] min-[375px]:text-[14px] text-slate-600 font-medium leading-snug max-w-[32ch] min-[375px]:max-w-[36ch] sm:max-w-xl mb-8 sm:mb-10"
            >
              Supported by the Federal Ministry of Education and the World Bank.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-4"
            >
              <button
                onClick={() => {
                  const el = document.getElementById("programs");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold h-[56px] px-6 rounded-[14px] text-[14px] min-[375px]:text-[15px] transition-all cursor-pointer shadow-xs"
              >
                <span>Explore Training Opportunities</span>
                <ArrowRight className="w-4 h-4 text-emerald-400 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => setShowTrackerModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-900 border border-slate-200/90 font-medium h-[56px] px-6 rounded-[14px] text-[14px] min-[375px]:text-[15px] transition-all cursor-pointer shadow-2xs"
              >
                Track Application
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById("verification-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center text-slate-500 hover:text-slate-900 font-medium text-xs sm:text-[13px] hover:underline underline-offset-4 cursor-pointer py-2 transition self-start sm:self-auto mt-1 sm:mt-0"
              >
                Verify a document
              </button>
            </motion.div>

            {/* Compact Mobile Journey Summary (< sm) */}
            <div className="sm:hidden pt-8 mt-8 border-t border-slate-100">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                Candidate Journey
              </p>
              <div className="flex items-center justify-between text-[12px] font-medium text-slate-700 bg-slate-50/80 border border-slate-200/60 rounded-xl px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Apply
                </span>
                <span className="text-slate-300">→</span>
                <span>Receive offer</span>
                <span className="text-slate-300">→</span>
                <span>Start training</span>
              </div>
            </div>

          </div>

          {/* Right Hero Panel / Minimalist Candidate Journey Visual (Hidden on < sm to avoid excessive scrolling on phones; visible on sm+) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="hidden sm:block lg:col-span-5 relative flex items-center justify-center mt-6 lg:mt-0"
          >
            <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-[32px] shadow-[0_15px_40px_rgba(0,0,0,0.02)] p-8 text-left relative overflow-hidden mx-auto">
              
              <div className="pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 font-display">Your training journey</h4>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">Simple. Verified. Progress-driven.</p>
              </div>

              <div className="relative pl-8 space-y-8 mt-8">
                {/* The vertical timeline path */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100" />
                
                {/* Stage 1: Active */}
                <div className="relative flex gap-4 items-start">
                  <div className="absolute -left-[33px] flex items-center justify-center">
                    <motion.div 
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                      className="h-8 w-8 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-sm"
                    >
                      <FileText className="w-4 h-4" />
                    </motion.div>
                  </div>
                  
                  <div className="space-y-1">
                    <h5 className="text-[13px] font-semibold text-slate-950 flex items-center gap-2">
                      Apply
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono rounded-full font-bold">Active</span>
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">Submit your details and select a training track.</p>
                  </div>
                </div>

                {/* Stage 2: Pending/Locked */}
                <div className="relative flex gap-4 items-start">
                  <div className="absolute -left-[33px] flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                      <BadgeCheck className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h5 className="text-[13px] font-semibold text-slate-400">Get admitted</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">Receive and respond to your placement offer.</p>
                  </div>
                </div>

                {/* Stage 3: Pending/Locked */}
                <div className="relative flex gap-4 items-start">
                  <div className="absolute -left-[33px] flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h5 className="text-[13px] font-semibold text-slate-400">Start training</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">Track attendance, documents and progress.</p>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

        </div>
      </section>

      {/* SOVEREIGN PARTNERS BAR */}
      <section className="relative border-y border-slate-200/50 bg-gradient-to-br from-[#fafcfb] via-[#f4faf7] to-[#fafcfb] py-14 sm:py-20 lg:py-24 overflow-hidden">
        {/* Style tag containing the high-performance CSS animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes partnerMarquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
          @keyframes partnerMarqueeReverse {
            0% { transform: translate3d(-50%, 0, 0); }
            100% { transform: translate3d(0, 0, 0); }
          }
          .partner-marquee-container {
            display: flex;
            width: 100%;
            overflow: hidden;
            position: relative;
          }
          .partner-marquee-track {
            display: flex;
            width: max-content;
            animation: partnerMarquee 28s linear infinite;
          }
          .partner-marquee-track-reverse {
            display: flex;
            width: max-content;
            animation: partnerMarqueeReverse 28s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .partner-marquee-track, .partner-marquee-track-reverse {
              animation: none !important;
              overflow-x: auto;
              width: 100%;
              justify-content: center;
              flex-wrap: wrap;
            }
          }
        `}} />

        {/* Edge Fade Masks for Marquee */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[#fafcfb] via-[#fafcfb]/70 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[#fafcfb] via-[#fafcfb]/70 to-transparent z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Heading & Copy */}
          <div className="lg:col-span-5 space-y-4 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-1.5 bg-emerald-100/60 text-emerald-800 font-mono text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded uppercase font-bold tracking-wider"
            >
              OUR PARTNERS
            </motion.div>
            
            <motion.h3
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display leading-tight"
            >
              Working together to expand access to practical skills.
            </motion.h3>
            
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed"
            >
              Supported by institutions committed to stronger technical education and employment opportunities.
            </motion.p>
          </div>

          {/* Right Column: Scrolling Marquee */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="relative w-full"
            >
              {(() => {
                const defaultPartners = [
                  {
                    id: "worldbank",
                    short_name: "World Bank",
                    logo_original_url: "/worldbank-clean.png",
                    logo_optimized_url: "/worldbank-clean.png",
                    logo_alt_text: "World Bank Group",
                    website_url: "https://www.worldbank.org",
                    display_scale: 0.90
                  },
                  {
                    id: "fme",
                    short_name: "Federal Ministry of Education",
                    logo_original_url: "/fedministry-clean.png",
                    logo_optimized_url: "/fedministry-clean.png",
                    logo_alt_text: "Federal Ministry of Education Nigeria",
                    website_url: "https://education.gov.ng",
                    display_scale: 0.88
                  },
                  {
                    id: "ideas",
                    short_name: "IDEAS-TVET",
                    logo_original_url: "/ideas-clean.png",
                    logo_optimized_url: "/ideas-clean.png",
                    logo_alt_text: "IDEAS-TVET Initiative",
                    website_url: "https://ideasproject.gov.ng",
                    display_scale: 0.82
                  }
                ];

                const activePartners = (partners && partners.length > 0) ? partners : defaultPartners;
                
                // Helper to render individual logo nicely
                const renderLogo = (p: typeof defaultPartners[0], uniqueKey: string, isAriaHidden = false) => {
                  const scale = p.display_scale || (p.short_name.toLowerCase().includes('ideas') ? 0.82 : p.short_name.toLowerCase().includes('ministry') || p.short_name.toLowerCase().includes('fme') ? 0.88 : 0.90);
                  const isClickable = !!p.website_url && p.website_url !== "#";
                  
                  const imageElement = (
                    <img 
                      src={p.logo_optimized_url || p.logo_original_url} 
                      alt={p.logo_alt_text || p.short_name}
                      style={{ transform: `scale(${scale})` }}
                      className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  );

                  if (isClickable) {
                    return (
                      <a
                        key={uniqueKey}
                        href={p.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.short_name}
                        tabIndex={isAriaHidden ? -1 : 0}
                        className="focus:outline-none focus:ring-2 focus:ring-emerald-500/80 rounded-lg p-1.5 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-[2px] opacity-[0.78] hover:opacity-100 focus:opacity-100 shrink-0 block"
                      >
                        <div className="w-[145px] h-[64px] sm:w-[175px] sm:h-[76px] lg:w-[210px] lg:h-[88px] flex items-center justify-center select-none">
                          {imageElement}
                        </div>
                      </a>
                    );
                  }

                  return (
                    <div
                      key={uniqueKey}
                      title={p.short_name}
                      className="transition-all duration-300 hover:scale-[1.03] hover:-translate-y-[2px] opacity-[0.78] hover:opacity-100 shrink-0"
                    >
                      <div className="w-[145px] h-[64px] sm:w-[175px] sm:h-[76px] lg:w-[210px] lg:h-[88px] flex items-center justify-center select-none">
                        {imageElement}
                      </div>
                    </div>
                  );
                };

                // Visual duplication: duplicate the logo list as many times as needed to guarantee a full seamless width
                const displayPartners = activePartners.length < 4 
                  ? [...activePartners, ...activePartners, ...activePartners] 
                  : activePartners;

                return (
                  <div className="partner-marquee-container">
                    <div className="partner-marquee-track hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
                      <div className="flex gap-[36px] sm:gap-[48px] lg:gap-[64px] items-center shrink-0 pr-[36px] sm:pr-[48px] lg:pr-[64px]">
                        {displayPartners.map((p, idx) => renderLogo(p, `t1-${p.id}-${idx}`, false))}
                      </div>
                      <div className="flex gap-[36px] sm:gap-[48px] lg:gap-[64px] items-center shrink-0 pr-[36px] sm:pr-[48px] lg:pr-[64px]" aria-hidden="true">
                        {displayPartners.map((p, idx) => renderLogo(p, `t2-${p.id}-${idx}`, true))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROGRAM OVERVIEW / ABOUT THE INITIATIVE */}
      <section id="about" className="py-16 sm:py-24 lg:py-28 bg-white scroll-mt-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            
            {/* Left Content Area */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex items-center gap-1.5 bg-emerald-100/70 text-emerald-900 font-mono text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded uppercase font-bold tracking-wider"
              >
                PROGRAM OVERVIEW
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 font-display leading-[1.15] tracking-tight max-w-2xl"
              >
                Building practical skills for real economic opportunity.
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl"
              >
                The IDEAS-TVET programme equips trainees with job-ready technical skills through accredited training, structured learning standards, and verified performance tracking. Each placement is designed to strengthen employability, improve quality, and support measurable outcomes.
              </motion.p>
            </div>

            {/* Right Side: Compact Insight Panel */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
                className="bg-gradient-to-br from-slate-50/90 via-white to-emerald-50/30 border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden group hover:border-emerald-300/80 transition-all duration-300"
              >
                {/* Subtle top accent highlight */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500" />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <span className="text-xs font-bold text-slate-900 font-display uppercase tracking-wider">Operational Pillars</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">IDEAS STANDARDS</span>
                  </div>

                  <ul className="space-y-3.5">
                    <li className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-md bg-emerald-600/10 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900">Accredited Delivery</p>
                        <p className="text-[11px] text-slate-500 leading-normal">National standard curriculum mapped to industry requirements.</p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-md bg-emerald-600/10 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900">Verified Tracking</p>
                        <p className="text-[11px] text-slate-500 leading-normal">NIN-linked candidate mapping and identity checks.</p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-md bg-emerald-600/10 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <BadgeCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900">Outcome-Led Reporting</p>
                        <p className="text-[11px] text-slate-500 leading-normal">Direct performance tracking measuring graduate readiness.</p>
                      </div>
                    </li>
                  </ul>

                  <div className="pt-3 border-t border-slate-200/60 text-left">
                    <p className="text-[11px] font-medium text-slate-500 italic">
                      “Built for credibility, monitored for quality, and aligned with real workforce needs.”
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* PROGRAM INDICATORS / MEASURABLE OUTCOMES */}
      <section id="impact" className="py-16 sm:py-20 lg:py-24 bg-slate-50/70 border-t border-b border-slate-200/60 relative">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header Row */}
          <div className="mb-10 lg:mb-12 text-left space-y-2 max-w-2xl">
            <span className="text-xs font-bold text-emerald-800 font-mono uppercase tracking-widest block">
              MEASURABLE OUTCOMES
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 font-display tracking-tight">
              Program indicators at a glance
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              A clear snapshot of reach, enrollment activity, and progress benchmarks.
            </p>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
            
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 text-left shadow-2xs hover:shadow-md hover:border-emerald-400/70 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 group-hover:via-emerald-500 transition-all duration-300" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    National Reach
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 tracking-tight">
                  <AnimatedCounter target={36} />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-emerald-800 tracking-wide font-sans flex items-center justify-between">
                  <span>States + FCT</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">Full Coverage</span>
                </p>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 text-left shadow-2xs hover:shadow-md hover:border-emerald-400/70 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 group-hover:via-emerald-500 transition-all duration-300" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Accredited Centers
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 tracking-tight">
                  <AnimatedCounter target={120} suffix="+" />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-emerald-800 tracking-wide font-sans flex items-center justify-between">
                  <span>Approved TSPs</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">Audited</span>
                </p>
              </div>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 text-left shadow-2xs hover:shadow-md hover:border-emerald-400/70 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 group-hover:via-emerald-500 transition-all duration-300" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Profile Coverage
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 tracking-tight">
                  <AnimatedCounter target={15420} suffix="+" />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-emerald-800 tracking-wide font-sans flex items-center justify-between">
                  <span>Eligible Trainees</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">Mapped</span>
                </p>
              </div>
            </motion.div>

            {/* Card 4 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 text-left shadow-2xs hover:shadow-md hover:border-emerald-400/70 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 group-hover:via-emerald-500 transition-all duration-300" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Active Enrollment
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 tracking-tight">
                  <AnimatedCounter target={480} suffix="+" />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-emerald-800 tracking-wide font-sans flex items-center justify-between">
                  <span>At This Center</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">Active</span>
                </p>
              </div>
            </motion.div>

            {/* Card 5 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 text-left shadow-2xs hover:shadow-md hover:border-emerald-400/70 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col justify-between overflow-hidden sm:col-span-2 lg:col-span-1"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 group-hover:via-emerald-500 transition-all duration-300" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Completion Target
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                    <BadgeCheck className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 tracking-tight">
                  <AnimatedCounter target={98} suffix="%" />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-emerald-800 tracking-wide font-sans flex items-center justify-between">
                  <span>Graduate KPI</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">Target</span>
                </p>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="py-16 sm:py-24 lg:py-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header */}
          <div className="mb-12 sm:mb-16 lg:mb-20 text-left space-y-3 max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block"
            >
              HOW IT WORKS
            </motion.span>
            
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 font-display tracking-tight leading-[1.15]"
            >
              From application to training.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal"
            >
              A clear process designed to help applicants choose a programme, receive an offer and begin their training with confidence.
            </motion.p>
          </div>

          {/* Process Stages Container */}
          <ol className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 list-none p-0 m-0">
            
            {/* Horizontal Connecting Line (Desktop lg) */}
            <div className="hidden lg:block absolute top-[2.75rem] left-[10%] right-[10%] h-[2px] bg-slate-200/80 -z-0" />

            {[
              {
                number: "01",
                title: "Choose a programme",
                description: "Explore the available training options and select the skill that matches your interests.",
                icon: BookOpen,
              },
              {
                number: "02",
                title: "Submit your application",
                description: "Provide your details and the information needed to review your application.",
                icon: FileText,
              },
              {
                number: "03",
                title: "Receive your offer",
                description: "Successful applicants receive a training offer with clear instructions on the next steps.",
                icon: CheckCircle2,
              },
              {
                number: "04",
                title: "Begin your training",
                description: "Confirm your place, attend your sessions and build practical skills for work.",
                icon: GraduationCap,
              },
            ].map((stage, idx) => {
              const IconComp = stage.icon;
              return (
                <motion.li
                  key={stage.number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1, ease: "easeOut" }}
                  className="relative z-10 flex flex-col items-start text-left group"
                >
                  {/* Top stage header row with number and quiet icon */}
                  <div className="flex items-center justify-between w-full mb-4 sm:mb-5 relative">
                    <span className="text-4xl sm:text-5xl font-semibold text-emerald-800/90 group-hover:text-emerald-950 transition-colors tracking-tight font-sans bg-white pr-2 z-10">
                      {stage.number}
                    </span>
                    <div className="h-9 w-9 rounded-xl bg-slate-100/90 group-hover:bg-emerald-50 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center transition-all duration-300 shadow-2xs">
                      <IconComp className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Stage card content */}
                  <div className="space-y-2 w-full p-5 sm:p-6 rounded-2xl bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-emerald-300/80 shadow-2xs hover:shadow-xs hover:-translate-y-1 transition-all duration-300">
                    <h3 className="text-lg sm:text-xl font-semibold text-slate-900 group-hover:text-emerald-950 transition-colors">
                      {stage.title}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                      {stage.description}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>

        </div>
      </section>

      {/* DOCUMENT VERIFICATION SECTION */}
      <section id="verification-section" className="py-16 sm:py-24 lg:py-28 bg-slate-900 text-white scroll-mt-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800/30 via-slate-900 to-slate-950 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            
            {/* Left Column: Verification Content */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="lg:col-span-6 space-y-6 text-left"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 font-medium text-xs tracking-wide uppercase font-sans">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify a Document</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white font-display leading-[1.15] tracking-tight">
                Check a trainee document
              </h2>
              
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
                Use the reference number on an official document to confirm that it was issued through the IDEAS-TVET programme.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-slate-200 font-sans">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Training offer letters</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Admission letters</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Placement letters</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Completion records</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={() => { window.location.hash = "#/verify-document"; }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl text-sm inline-flex items-center gap-2.5 cursor-pointer transition shadow-sm hover:shadow-emerald-950/50"
                >
                  <Search className="w-4 h-4" />
                  <span>Verify document</span>
                </button>
              </div>
            </motion.div>

            {/* Right Column: Verification Form Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
              className="lg:col-span-6 bg-slate-950/90 border border-slate-800/90 p-6 sm:p-8 lg:p-9 rounded-2xl text-left space-y-6 shadow-xl relative overflow-hidden backdrop-blur-sm group hover:border-slate-700/80 transition-all duration-300"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/80 via-teal-500/60 to-emerald-600/80" />

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
                  Enter document reference
                </h3>
                <p className="text-sm text-slate-400 font-normal mt-1.5 leading-relaxed">
                  Type the reference number exactly as it appears on the document.
                </p>
              </div>

              <form onSubmit={handleQuickVerifySubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="quick-verify-input" className="text-xs font-medium text-slate-300 font-sans block">
                    Reference number
                  </label>
                  <div className="relative">
                    <input
                      id="quick-verify-input"
                      type="text"
                      required
                      placeholder="e.g. DOC-123456"
                      value={quickVerifyCode}
                      onChange={(e) => setQuickVerifyCode(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-3.5 pl-4 pr-14 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-sans transition shadow-inner"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-2 bottom-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center rounded-lg cursor-pointer transition focus:outline-none font-medium text-xs shadow-xs"
                      aria-label="Submit verification reference"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-xs text-slate-400 font-normal">
                  <HelpCircle className="w-4 h-4 text-emerald-400/90 shrink-0" />
                  <span>Reference numbers are shown on official trainee documents.</span>
                </div>
              </form>
            </motion.div>

          </div>
        </div>
      </section>

      {/* TRAINING PROGRAMMES SECTION */}
      <section id="programs" className="py-16 sm:py-24 lg:py-28 bg-white scroll-mt-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Section Header */}
          <div className="mb-12 sm:mb-16 lg:mb-20 text-left space-y-3 max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block font-sans"
            >
              TRAINING PROGRAMMES
            </motion.span>
            
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 font-display tracking-tight leading-[1.15]"
            >
              Practical skills you can build.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal"
            >
              Explore hands-on training designed to prepare you for work, self-employment and further opportunities.
            </motion.p>
          </div>

          {/* Programmes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {focalPrograms.map((p, idx) => {
              const IconComponent = p.icon;
              return (
                <motion.div 
                  key={p.id || idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeOut" }}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-300/80 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group text-left"
                >
                  <div>
                    {/* Visual Area Header */}
                    <div className={`h-36 sm:h-40 w-full bg-gradient-to-br ${p.tint} p-6 flex items-center justify-center relative overflow-hidden border-b border-slate-100/80`}>
                      <div className={`h-14 w-14 rounded-2xl ${p.iconBg} flex items-center justify-center shadow-xs group-hover:scale-108 transition-transform duration-300`}>
                        <IconComponent className="w-7 h-7" />
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-800 tracking-wide font-sans">
                          {p.sector}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full font-sans">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {p.status}
                        </span>
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-display leading-snug group-hover:text-emerald-950 transition-colors">
                        {p.title}
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed font-normal font-sans">
                        {p.desc}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 pb-6 pt-2">
                    <button
                      onClick={() => { window.location.hash = "#/verify-document"; }}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200/90 group-hover:border-emerald-300/90 bg-slate-50/60 group-hover:bg-emerald-50/40 text-slate-700 group-hover:text-emerald-950 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
                    >
                      <span>Learn more</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* INTERACTIVE FAQS */}
      <section id="faqs" className="py-16 sm:py-24 lg:py-28 bg-slate-50/80 border-t border-b border-slate-200/60 scroll-mt-12 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16 space-y-3 max-w-2xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block font-sans"
            >
              HELP & INFORMATION
            </motion.span>
            
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 font-display tracking-tight leading-[1.15]"
            >
              Frequently asked questions
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal"
            >
              Find clear answers about applications, training, documents and programme participation.
            </motion.p>
          </div>

          {/* Accordion Rows */}
          <div className="space-y-3.5 sm:space-y-4">
            {faqs.map((f, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  className={`rounded-2xl transition-all duration-300 overflow-hidden text-left ${
                    isOpen 
                      ? "bg-white border-2 border-emerald-500/80 shadow-sm" 
                      : "bg-white border border-slate-200/90 hover:border-emerald-300/80 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  <button
                    type="button"
                    id={`faq-button-${idx}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${idx}`}
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full py-5 sm:py-6 px-6 sm:px-8 flex items-center justify-between gap-4 text-left focus:outline-none cursor-pointer group"
                  >
                    <span className={`text-base sm:text-lg font-semibold tracking-tight transition-colors font-sans ${
                      isOpen ? "text-emerald-950" : "text-slate-900 group-hover:text-emerald-950"
                    }`}>
                      {f.q}
                    </span>
                    <div 
                      className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen 
                          ? "bg-emerald-100 text-emerald-800 rotate-180" 
                          : "bg-slate-100/90 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-700"
                      }`}
                      aria-label={isOpen ? "Collapse answer" : "Expand answer"}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${idx}`}
                        role="region"
                        aria-labelledby={`faq-button-${idx}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 sm:px-8 pb-6 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed font-normal font-sans border-t border-slate-100/80">
                          {f.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Support Link */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-10 sm:mt-12 text-center flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-slate-600 font-sans"
          >
            <span>Still need help?</span>
            <a 
              href="#support" 
              className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1 transition-colors"
            >
              Contact support
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>

        </div>
      </section>

      {/* SUPPORT & CONTACT SECTION */}
      <section id="support" className="py-14 sm:py-20 bg-slate-50/60 border-t border-slate-200/60 scroll-mt-12 font-sans">
        <div className="max-w-7xl mx-auto px-4 min-[375px]:px-5 sm:px-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl min-[375px]:rounded-3xl p-5 min-[375px]:p-6 sm:p-8 lg:p-12 shadow-2xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-start lg:items-center">
              
              {/* Left Column: Heading & Quick Actions */}
              <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-left">
                <div className="space-y-2.5 sm:space-y-3">
                  <span className="text-[10.5px] min-[375px]:text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                    Contact & Support
                  </span>
                  <h3 className="text-xl min-[375px]:text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug sm:leading-tight">
                    Need help with your application or training?
                  </h3>
                  <p className="text-xs min-[375px]:text-sm text-slate-600 leading-relaxed max-w-md">
                    Our support team can help with applications, document checks and general programme enquiries.
                  </p>
                </div>

                <div className="flex flex-col min-[400px]:flex-row flex-wrap items-stretch min-[400px]:items-center gap-2.5 min-[375px]:gap-3 pt-1">
                  <a
                    href={`mailto:${siteSettings.supportEmail}`}
                    className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium py-3 px-5 rounded-xl text-xs sm:text-xs transition shadow-xs cursor-pointer min-h-[44px]"
                  >
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span>Email support</span>
                  </a>

                  <a
                    href={`tel:${siteSettings.dialablePhone}`}
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 border border-slate-300 font-medium py-3 px-5 rounded-xl text-xs transition shadow-2xs cursor-pointer min-h-[44px]"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Call support</span>
                  </a>

                  {siteSettings.mapUrl && (
                    <a
                      href={siteSettings.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium py-2.5 px-3 rounded-xl text-xs transition cursor-pointer min-h-[44px]"
                    >
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <span>Get directions</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Clean Unified Info Card */}
              <div className="lg:col-span-6 w-full">
                <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl min-[375px]:rounded-2xl p-4 min-[375px]:p-5 sm:p-8 text-left space-y-4 min-[375px]:space-y-5">
                  
                  <div className="flex items-start gap-3 min-[375px]:gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[11px] min-[375px]:text-xs font-bold text-slate-900 uppercase tracking-wider">Opening Hours</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {siteSettings.officeHoursDays}, {siteSettings.openingTime} to {siteSettings.closingTime} ({siteSettings.timezone})
                        {siteSettings.publicHolidayNote ? `, ${siteSettings.publicHolidayNote}` : ''}.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-3.5 min-[375px]:pt-4 flex items-start gap-3 min-[375px]:gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[11px] min-[375px]:text-xs font-bold text-slate-900 uppercase tracking-wider">Support Email</h4>
                      <a href={`mailto:${siteSettings.supportEmail}`} className="text-xs text-emerald-700 font-medium hover:underline block mt-1 break-all">
                        {siteSettings.supportEmail}
                      </a>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-3.5 min-[375px]:pt-4 flex items-start gap-3 min-[375px]:gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[11px] min-[375px]:text-xs font-bold text-slate-900 uppercase tracking-wider">Telephone</h4>
                      <a href={`tel:${siteSettings.dialablePhone}`} className="text-xs text-slate-800 font-semibold hover:underline block mt-1">
                        {siteSettings.supportPhone}
                      </a>
                      {siteSettings.altPhone && (
                        <p className="text-[11px] text-slate-500 mt-0.5">Alternative: {siteSettings.altPhone}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-3.5 min-[375px]:pt-4 flex items-start gap-3 min-[375px]:gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[11px] min-[375px]:text-xs font-bold text-slate-900 uppercase tracking-wider">Office Location</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed break-words">
                        {siteSettings.officeName}, {siteSettings.addressLine1}, {siteSettings.addressLine2}, {siteSettings.city}, {siteSettings.stateFct}, {siteSettings.country}
                        {siteSettings.postalCode ? ` (${siteSettings.postalCode})` : ''}.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-900 text-xs font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
          
          {/* Column 1: Brand & Overview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-white font-bold text-sm tracking-tight">IDEAS-TVET</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              {siteSettings.footerDescription}
            </p>
          </div>

          {/* Column 2: Explore Links */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-xs tracking-wide uppercase">Explore</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#programs" className="hover:text-white transition-colors">Training programmes</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="#verify-document" className="hover:text-white transition-colors">Verify a document</a></li>
              <li><a href="#faqs" className="hover:text-white transition-colors">Frequently asked questions</a></li>
            </ul>
          </div>

          {/* Column 3: Portal Access */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-xs tracking-wide uppercase">Portal Access</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => setShowTrackerModal(true)}
                  className="hover:text-white transition-colors text-left bg-transparent p-0 border-none cursor-pointer font-sans"
                >
                  Track application
                </button>
              </li>
              <li>
                <button
                  onClick={() => setShowTrackerModal(true)}
                  className="hover:text-white transition-colors text-left bg-transparent p-0 border-none cursor-pointer font-sans"
                >
                  Admitted candidate portal
                </button>
              </li>
              <li>
                <button
                  onClick={onLoginShow}
                  className="hover:text-slate-200 transition-colors text-left bg-transparent p-0 border-none cursor-pointer font-sans text-slate-500"
                >
                  Staff sign in
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold text-xs tracking-wide uppercase">Contact Support</h4>
            <div className="space-y-1.5 text-xs text-slate-400">
              <a href={`mailto:${siteSettings.supportEmail}`} className="hover:text-white transition-colors block font-medium text-emerald-400">
                {siteSettings.supportEmail}
              </a>
              <a href={`tel:${siteSettings.dialablePhone}`} className="hover:text-white transition-colors block">
                {siteSettings.supportPhone}
              </a>
              <p className="text-slate-500 pt-1 leading-snug">
                {siteSettings.officeName}<br />
                {siteSettings.city}, {siteSettings.country}
              </p>
            </div>
          </div>

        </div>

        {/* Footer Bottom Row */}
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {siteSettings.copyright}</p>
          <div className="flex items-center gap-4 text-xs">
            <a
              href={siteSettings.privacyPolicyUrl}
              onClick={(e) => {
                if (siteSettings.privacyPolicyUrl.startsWith("#")) {
                  e.preventDefault();
                  alert("National Data Protection Policy: All trainee records and document verifications comply with national data privacy standards.");
                }
              }}
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <span>·</span>
            <a
              href={siteSettings.termsOfServiceUrl}
              onClick={(e) => {
                if (siteSettings.termsOfServiceUrl.startsWith("#")) {
                  e.preventDefault();
                  alert("Terms of Service: Official national training project terms.");
                }
              }}
              className="hover:text-white transition-colors"
            >
              Terms of Service
            </a>
            {siteSettings.accessibilityUrl && (
              <>
                <span>·</span>
                <a
                  href={siteSettings.accessibilityUrl}
                  onClick={(e) => {
                    if (siteSettings.accessibilityUrl.startsWith("#")) {
                      e.preventDefault();
                      alert("Accessibility Statement: Built for WCAG AA compliance.");
                    }
                  }}
                  className="hover:text-white transition-colors"
                >
                  Accessibility
                </a>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* SECURE CANDIDATE TRACKER MODAL */}
      <AnimatePresence>
        {showTrackerModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 w-full max-w-md shadow-xl relative"
            >
              
              <button 
                onClick={() => {
                  setShowTrackerModal(false);
                  setTrackError(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-lg p-1 text-xs focus:outline-none cursor-pointer transition-colors"
              >
                ✕
              </button>

              <div className="space-y-3 text-left">
                <div className="h-9 w-9 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-800">
                  <Search className="w-4.5 h-4.5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display tracking-tight">Candidate Tracker</h3>
                  <p className="text-xs text-slate-500 leading-normal">Enter your email and registered credentials to view provisional placement letters or download certified forms.</p>
                </div>
              </div>

              {trackError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 font-medium text-xs p-3 rounded-lg mt-3 text-left">
                  {trackError}
                </div>
              )}

              <form onSubmit={handleTrackSubmit} className="space-y-4 mt-5 text-left font-sans">
                <div className="space-y-1">
                  <label htmlFor="track-email-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Registered Email Address</label>
                  <div className="relative">
                    <input
                      id="track-email-input"
                      type="email"
                      required
                      placeholder="e.g. candidate@ideas-tvet.ng"
                      value={trackEmail}
                      onChange={(e) => setTrackEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-medium transition-colors"
                    />
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="track-password-input" className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Password / 11-digit NIN</label>
                  <div className="relative">
                    <input
                      id="track-password-input"
                      type="password"
                      required
                      placeholder="Type your national credentials"
                      value={trackPassword}
                      onChange={(e) => setTrackPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono tracking-wide transition-colors"
                    />
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={trackLoading}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  {trackLoading ? "Searching registry databases..." : "Access Candidate Space"}
                </button>
              </form>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-[10px] text-slate-500 leading-normal text-left mt-5 font-mono">
                💡 <span className="font-bold text-slate-700">Admitted Student Portal Access</span>:<br />Log in using your registered trainee email and your 11-digit National Identity Number (NIN) as default password.
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
