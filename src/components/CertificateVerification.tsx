/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, ShieldCheck, Printer, Download, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, Loader2, Search } from "lucide-react";
import { API_BASE_URL } from "../config/api";

export function CertificateVerification() {
  const [reference, setReference] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(0.95);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Extract reference from Hash e.g. #/verify/certificate/REF-1234
  useEffect(() => {
    const hash = window.location.hash || "";
    const parts = hash.split("/");
    // Format could be #/verify/certificate/:ref
    const refIdx = parts.indexOf("certificate");
    if (refIdx !== -1 && parts[refIdx + 1]) {
      const refCode = decodeURIComponent(parts[refIdx + 1]);
      setReference(refCode);
      fetchVerification(refCode);
    }
  }, []);

  const fetchVerification = async (ref: string) => {
    if (!ref || ref.trim() === "") return;
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/public/certificate/verify/${encodeURIComponent(ref.trim())}`;
      const res = await fetch(url);
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      } else {
        const errObj = await res.json().catch(() => ({}));
        setError(errObj.error || "Specified certificate registry record is missing or revoked.");
        setData(null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to reach verification system. Check internet connectivity.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.hash = `#/verify/certificate/${encodeURIComponent(searchQuery.trim())}`;
      setReference(searchQuery.trim());
      fetchVerification(searchQuery.trim());
    }
  };

  const zoomIn = () => setZoomScale(s => Math.min(s + 0.1, 1.4));
  const zoomOut = () => setZoomScale(s => Math.max(s - 0.1, 0.6));
  const resetZoom = () => setZoomScale(0.95);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (data?.certificateUrl) {
      window.open(data.certificateUrl, "_blank", "referrerPolicy=no-referrer");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Visual background flares */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-950/20 via-slate-950/90 to-slate-950 pointer-events-none" />
      
      {/* Header banner */}
      <header className="no-print border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => { window.location.hash = "#/landing"; }}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            title="Return to Portal Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] sm:text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase">
              FEDERAL REPUBLIC OF NIGERIA TVET REGISTRY
            </span>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-450 hidden sm:block">
          Node Address: <span className="text-slate-300 font-bold">NBTE-CERT-HUB-04B</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-start z-10 relative">
        
        {/* Search Header when no reference is provided or we are on blank lookup */}
        {(!reference || error) && (
          <div className="no-print max-w-xl w-full text-center mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-3 bg-emerald-600/10 rounded-full w-fit mx-auto border border-emerald-500/20 mb-4 text-emerald-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-emerald-400 tracking-tight">
              Public Certificate Verification
            </h1>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
              Inspect and verify the official credentials authenticity for KANO State TVET literacy trainees. Input the unique Certificate Number, Search Reference, or Verification Code.
            </p>

            <form onSubmit={handleManualSearch} className="mt-8 flex gap-2 bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-lg">
              <div className="flex-grow flex items-center pl-2 text-slate-450">
                <Search className="w-4 h-4 mr-2" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. IDEAS-CERT-2206-000001 or REF-..."
                  className="bg-transparent text-slate-100 text-xs w-full focus:outline-none placeholder:text-slate-550"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-500 font-semibold px-4 py-2 rounded-lg text-xs tracking-wide transition cursor-pointer"
              >
                Verify Credentials
              </button>
            </form>

            {error && (
              <div className="mt-6 bg-red-950/20 border border-red-900/30 rounded-xl p-4 text-left flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-xs font-semibold">Verification Scan Cleared Negative</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-20">
            <Loader2 className="w-9 h-9 text-emerald-500 animate-spin" />
            <p className="text-xs text-slate-400 mt-3 font-mono">Running secure cryptography signature check...</p>
          </div>
        )}

        {/* Certificate Display and Details */}
        {data && !loading && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            
            {/* Status Header Badge */}
            <div className="no-print bg-emerald-900/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-3 rounded-full flex items-center gap-2 mb-8 shadow-inner animate-pulse">
              <CheckCircle className="w-4 h-4" />
              <span>CRYPTOGRAPHICALLY VERIFIED GENUINE CREDENTIALS • SIGNATURE STATUS ACTIVE</span>
            </div>

            {/* Split Panel: Left Details Pane, Right Certificate Zoom Frame */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Credentials Metadata details (Col 5) */}
              <div className="no-print lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl sticky top-24">
                <div>
                  <h2 className="font-mono text-[9px] uppercase tracking-widest text-emerald-500 font-bold">Trainee Folder</h2>
                  <h3 className="text-lg font-bold text-slate-100 font-display mt-0.5">
                    {data.firstName} {data.lastName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-1">ID: {data.id}</p>
                </div>

                <div className="border-t border-slate-800/60 pt-4 space-y-3.5">
                  <div>
                    <span className="text-[10px] text-slate-450 block font-mono">Accredited Skill Arena</span>
                    <span className="text-xs text-slate-200 block font-semibold mt-0.5">
                      {data.skillSector || "Computer Hardware Repairs & Cellphone System Diagnostics"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block font-mono">Qualified Provider (TSP)</span>
                    <span className="text-xs text-slate-200 block font-semibold mt-0.5">
                      {data.tsp || "Unique Technology Nig. Ltd"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block font-mono">Graduation & Batch Code</span>
                    <span className="text-xs text-slate-200 block font-semibold mt-0.5">
                      {data.graduationBatch || "Batch 2026-Cohort A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block font-mono">Registration Suffix Date</span>
                    <span className="text-xs text-slate-200 block font-semibold mt-0.5">
                      {data.certificateIssuedAt ? new Date(data.certificateIssuedAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block font-mono">Credentials Number</span>
                    <span className="text-xs text-emerald-400 font-mono font-bold block mt-0.5">
                      {data.certificateNumber || "IDEAS-TVET-2026-X001"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block font-mono">Portal Verification Code</span>
                    <span className="text-xs text-slate-250 font-mono block mt-0.5">
                      {data.certificateVerificationCode || "TVET-CRT-DEFAULT"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-2">
                  <button 
                    onClick={handleDownload}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-2.5 px-4 rounded-xl text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/10"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Official PDF</span>
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="w-full bg-slate-800 hover:bg-slate-705/90 border border-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Trainee Record</span>
                  </button>
                </div>
              </div>

              {/* Live Certificate Preview Frame (Col 8) */}
              <div className="lg:col-span-8 flex flex-col gap-4 w-full">
                
                {/* Visual workbench toolbar */}
                <div className="no-print w-full bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold font-mono text-slate-450 px-2 py-1 bg-slate-800 rounded">
                      Document Scale
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {Math.round(zoomScale * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button 
                      onClick={zoomOut}
                      className="p-1 px-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-xs transition cursor-pointer flex items-center gap-1"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={zoomIn}
                      className="p-1 px-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-xs transition cursor-pointer flex items-center gap-1"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={resetZoom}
                      className="p-1 px-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-xs transition cursor-pointer flex items-center gap-1"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Print & View Frame Box - Scale transforms here */}
                <div className="w-full flex justify-center bg-slate-900/45 p-6 rounded-2xl border border-slate-800/80 overflow-auto shadow-2xl relative min-h-[500px]">
                  
                  <div 
                    id="certificate-print-area"
                    style={{ 
                      transform: `scale(${zoomScale})`, 
                      transformOrigin: "top center",
                      transition: "transform 0.15s ease-out"
                    }}
                    className="w-[1000px] bg-[#fffbf5] border-8 double border-[#008751] rounded-sm p-8 min-h-[700px] text-[#1e293b] relative flex flex-col justify-between shadow-2xl overflow-hidden pointer-events-auto"
                  >
                    
                    {/* Watermark in Preview */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                      <span className="text-[#008751]/[0.03] text-6xl font-bold font-sans uppercase -rotate-12 tracking-widest scale-125 whitespace-nowrap">
                        FEDERATION NIGERIA SEALS
                      </span>
                    </div>

                    <div className="border border-[#008751] p-6 text-center space-y-4 rounded-sm flex-grow flex flex-col justify-between relative z-10 bg-transparent min-h-[620px]">
                      
                      {/* Top Crest logo */}
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 mb-2" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="#008751" strokeWidth="2" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#d4af37" strokeWidth="1" />
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#008751" strokeWidth="1" />
                          <path d="M50,15 L35,80 L50,75 L65,80 Z" fill="#008751" />
                          <circle cx="50" cy="45" r="12" fill="#d4af37" />
                        </svg>
                        <h4 className="font-sans font-bold text-[10px] tracking-widest text-slate-500 uppercase">
                          Federal Republic of Nigeria
                        </h4>
                        <h3 className="font-sans font-bold text-sm tracking-wide text-[#008751] uppercase mt-1">
                          National Board for Technical Education & skill sector
                        </h3>
                      </div>

                      {/* Title */}
                      <div className="my-2">
                        <h1 className="font-serif italic font-semibold text-3xl capitalize text-[#0d1e3e]">
                          Certificate of Competence Completion
                        </h1>
                        <p className="text-[11px] text-slate-400 font-sans tracking-widest uppercase mt-1">
                          conferred to trainee student
                        </p>
                      </div>

                      {/* Recipient name */}
                      <div className="my-2">
                        <span className="text-xl sm:text-2xl font-serif font-bold text-[#008751] uppercase border-b-2 border-dashed border-[#d4af37] px-8 pb-1 inline-block tracking-wide">
                          {data.firstName} {data.lastName} {data.otherName || ""}
                        </span>
                      </div>

                      {/* Award clause */}
                      <div className="max-w-2xl mx-auto text-xs sm:text-sm text-[#1e293b] leading-relaxed my-2">
                        Who has successfully audited, met biometrics ledger requisites, and completed the certified and officially accredited TVET Literacy & Skills sector development curriculum in
                        <span className="font-sans font-bold text-[#0d1e3e] block text-sm sm:text-base tracking-wide uppercase mt-2">
                          {data.skillSector || "Computer Hardware Repairs & Cellphone System Board Diagnostics"}
                        </span>
                      </div>

                      {/* Contact Metrics */}
                      <div className="text-[11px] text-slate-550 border-t border-b border-slate-200 py-2 inline-block mx-auto">
                        Evaluated unit volume: <strong className="text-[#008751]">90 Classroom Contact Hours (9 Credits)</strong> • Grade Level: <strong className="text-[#008751]">Honorable Pass (Outstanding Merit)</strong>
                      </div>

                      {/* Trainee Signatories Table row layout */}
                      <div className="grid grid-cols-3 gap-4 items-end mt-4">
                        <div className="flex flex-col items-center">
                          <div className="w-32 border-b border-dashed border-slate-450 h-8 relative flex items-end justify-center">
                            <span className="font-serif italic text-sm text-[#008751]/80 absolute bottom-1">
                              O. Coordinator
                            </span>
                          </div>
                          <span className="text-[9px] font-sans font-bold text-slate-500 mt-1 uppercase text-center leading-none">
                            Operations Coordinator
                          </span>
                          <span className="text-[8px] font-sans text-slate-400 mt-0.5 text-center">
                            {data.tsp || "Unique Technology Nig. Ltd"}
                          </span>
                        </div>

                        <div className="flex justify-center h-16 items-center">
                          {/* Gold medallion seal */}
                          <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#c5a02c] via-[#f7e383] to-[#bca03f] shadow-inner p-1">
                            <div className="w-full h-full rounded-full border border-dashed border-[#ffeeaa]/40 flex items-center justify-center bg-transparent">
                              <span className="font-mono text-[7px] font-bold text-[#4a3200] tracking-tighter uppercase text-center">
                                ★ CERTIFIED SEALS ★
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className="w-32 border-b border-dashed border-slate-450 h-8 relative flex items-end justify-center">
                            <span className="font-serif italic text-sm text-[#008751]/80 absolute bottom-1">
                              M. State Coordinator
                            </span>
                          </div>
                          <span className="text-[9px] font-sans font-bold text-slate-500 mt-1 uppercase text-center leading-none">
                            Registrar Representative
                          </span>
                          <span className="text-[8px] font-sans text-slate-400 mt-0.5 text-center">
                            Federal Ministry of Education TVET
                          </span>
                        </div>
                      </div>

                      {/* Verification footer with QR placement in corner */}
                      <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-200/40 text-left font-mono">
                        <div>
                          <p className="text-[8.5px] text-slate-500">
                            REGISTRY SERIAL CODE: <strong className="text-slate-750 font-bold">{data.certificateNumber || "IDEAS-TVET-2026-X001"}</strong>
                          </p>
                          <p className="text-[8.5px] text-emerald-600 mt-1">
                            VERIFICATION CODE: <strong className="text-emerald-700 font-bold">{data.certificateVerificationCode || "TVET-CRT-UNVERIFIED"}</strong>
                          </p>
                          <p className="text-[8.5px] text-slate-400 mt-0.5">
                            REFERENCE: <strong className="text-slate-650 font-bold">{data.certificateReference || "REF-NONE"}</strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[8.5px] text-slate-400 block">
                            DATE SEALS: {data.certificateIssuedAt ? new Date(data.certificateIssuedAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      <footer className="no-print bg-slate-900 border-t border-slate-800/80 px-6 py-6 text-center text-xs text-slate-500 font-mono z-10 relative">
        <p>© {new Date().getFullYear()} National Board for Technical Education (NBTE) • Kano State Genuineness Registry Vault.</p>
        <p className="mt-1 text-[10px] text-slate-600">Secure SHA-256 Ledger Authentication Enabled.</p>
      </footer>
    </div>
  );
}
