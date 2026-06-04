import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, ShieldAlert, Cpu, Search, Calendar, FileText, 
  ExternalLink, Hash, ArrowLeft, Loader2, CheckCircle, HelpCircle
} from "lucide-react";

export function DocumentVerification() {
  const [searchType, setSearchType] = useState<"code" | "id">("code");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedDoc, setVerifiedDoc] = useState<any | null>(null);

  const handleVerification = async (queryVal: string, type: "code" | "id") => {
    if (!queryVal.trim()) return;
    setLoading(true);
    setError(null);
    setVerifiedDoc(null);

    try {
      const payload: Record<string, string> = {};
      if (type === "code") {
        payload.code = queryVal.trim();
      } else {
        payload.id = queryVal.trim();
      }

      const res = await fetch("/api/documents/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setVerifiedDoc(data);
      } else {
        const errData = await res.json();
        setError(errData.error || "Document could not be verified within the centralized registry.");
      }
    } catch (e: any) {
      setError("Network error failed to communicate with registry verification servers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Extract query parameters from standard search or hash suffix
    const searchString = window.location.search || window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(searchString);
    const code = params.get("code");
    const id = params.get("id");

    if (code) {
      setSearchType("code");
      setSearchQuery(code);
      handleVerification(code, "code");
    } else if (id) {
      setSearchType("id");
      setSearchQuery(id);
      handleVerification(id, "id");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerification(searchQuery, searchType);
  };

  const getFriendlyDocType = (type: string) => {
    return type.replace(/_/g, " ").toUpperCase();
  };

  return (
    <div id="doc-verification-workspace" className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 md:p-6 select-none">
      {/* Dynamic Background Mesh Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-950/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 backdrop-blur-md">
        
        {/* Header Government Seals */}
        <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl">
              <Cpu className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="p-2 bg-indigo-950/80 border border-indigo-500/30 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <div>
            <h2 className="text-[10px] tracking-[0.2em] font-mono text-emerald-400 font-bold uppercase">
              Federal Republic of Nigeria
            </h2>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 mt-1">
              IDEAS-TVET Central Registry
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 max-w-md">
              Secure digital verification workspace for certificate, enrollment, and biographical documents reconciliation.
            </p>
          </div>
        </div>

        {/* Navigation back and form tab selectors */}
        <div className="flex items-center justify-between mt-6">
          <button 
            onClick={() => { window.location.hash = "#/landing"; }} 
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Registry Home
          </button>

          <div className="flex h-9 bg-slate-900 p-1 border border-slate-800 rounded-lg">
            <button
              onClick={() => { setSearchType("code"); setSearchQuery(""); setError(null); }}
              className={`px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                searchType === "code" 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Code Search
            </button>
            <button
              onClick={() => { setSearchType("id"); setSearchQuery(""); setError(null); }}
              className={`px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                searchType === "id" 
                  ? "bg-slate-850 text-white border border-slate-750" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Document ID
            </button>
          </div>
        </div>

        {/* Main query submission form */}
        <form onSubmit={handleSubmit} className="mt-6">
          <div className="relative">
            <input
              type="text"
              id="verification-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                searchType === "code" 
                  ? "Enter Verification Code (e.g. NBC-143210)" 
                  : "Enter System Document ID (e.g. gdoc_...)"
              }
              className="w-full bg-slate-900/90 border border-slate-800 hover:border-slate-700 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner font-mono text-center md:text-left"
              disabled={loading}
              required
            />
            <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-4" />
          </div>

          <button
            type="submit"
            id="trigger-verify-btn"
            disabled={loading}
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-slate-400 text-slate-95 text-white font-bold text-sm tracking-wide py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/40 min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-100" />
                Querying System Ledger...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-100" />
                Authenticate Document Record
              </>
            )}
          </button>
        </form>

        {/* Error notification display */}
        {error && (
          <div id="verification-error" className="mt-6 flex gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-xs text-left animate-in fade-in duration-200">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-red-300 font-semibold block text-sm mb-0.5">Verification Warning!</strong>
              {error} Please check the alphanumeric string for typographical errors or scan the valid QR code watermark.
            </div>
          </div>
        )}

        {/* Document verification result profile display (FEATURE 1 success card) */}
        {verifiedDoc && (
          <div id="verification-success-card" className="mt-6 bg-slate-900 border border-emerald-500/35 rounded-xl overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-950/80 border-b border-emerald-500/20 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-xs font-bold font-mono tracking-wider">OFFICIAL REGISTER RECORD MATCHED</span>
              </div>
              <span className="text-[10px] bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-extrabold font-mono uppercase px-2 py-0.5 rounded-full shadow-inner animate-pulse">
                STATUS: {verifiedDoc.verificationStatus}
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-[9px] font-mono uppercase text-slate-500 block mb-1">
                    Beneficiary Demographics
                  </span>
                  <span className="text-sm font-semibold text-slate-200">
                    {verifiedDoc.beneficiaryName}
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-[9px] font-mono uppercase text-slate-500 block mb-1">
                    Document Designation
                  </span>
                  <span className="text-sm font-semibold text-indigo-300 font-mono">
                    {getFriendlyDocType(verifiedDoc.documentType)}
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-[9px] font-mono uppercase text-slate-500 block mb-1">
                    Accredited Version Locks
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-sm">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <span className="font-mono font-bold text-slate-200">Version v{verifiedDoc.version}</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-[9px] font-mono uppercase text-slate-500 block mb-1">
                    Ledger Validation Suffix
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono font-bold text-slate-200">{verifiedDoc.verificationCode}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-3.5 rounded-lg border border-slate-800/40 text-left text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Admissions Timestamp:</span>
                  <span className="font-mono text-slate-200">{new Date(verifiedDoc.createdAt).toLocaleString("en-GB")}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Cryptographic Verification Date:</span>
                  <span className="font-mono text-slate-200">{new Date(verifiedDoc.verificationDate).toLocaleString("en-GB")}</span>
                </div>
              </div>

              {/* PDF Preview Trigger Link Endpoint (FEATURE 1: Reachable Preview URL verification) */}
              <a
                href={verifiedDoc.pdfUrl}
                target="_blank"
                rel="noreferrer"
                id="preview-pdf-link"
                className="w-full py-3 bg-emerald-950 border border-emerald-500/30 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                Inspect Official PDF Version (v{verifiedDoc.version})
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Safety Disclaimer Footer Notes */}
        <div className="mt-8 flex justify-center text-[9px] text-slate-500 font-mono gap-1 text-center">
          <span>TVET-SECURE VERIFICATION LEDGER LOCK IP SECURED</span>
        </div>
      </div>
    </div>
  );
}
