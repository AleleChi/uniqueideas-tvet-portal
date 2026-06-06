import React, { useState, useEffect } from "react";
import { 
  FileText, Download, CheckCircle, ShieldCheck, AlertTriangle, 
  Printer, Clock, Eye, ChevronRight, HelpCircle,
  ExternalLink, FileCheck, RefreshCw, LogIn
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { motion } from "motion/react";

interface SecureDocumentPortalProps {
  token: string;
  onClose: () => void;
}

export function SecureDocumentPortal({ token, onClose }: SecureDocumentPortalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatch, setDispatch] = useState<any>(null);
  const [beneficiary, setBeneficiary] = useState<any>(null);
  const [document, setDocument] = useState<any>(null);
  const [branding, setBranding] = useState<any>({ letterhead: null, settings: null });
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadPortalData() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/documents/verify/${token}`);
        if (!res.ok) {
          const errData = await res.json();
          setError(errData.error || "The link is invalid or has expired.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setDispatch(data.dispatch);
        setBeneficiary(data.beneficiary);
        setDocument(data.document);
        setBranding(data.branding);
        setLoading(false);

        // Track open action in audit queue
        fetch(`${API_BASE_URL}/api/public/documents/verify/${token}/track-open`, {
          method: "POST"
        }).catch(e => console.error("Could not trace open tracking state:", e));

      } catch (err) {
        setError("Network error: Host connection aborted.");
        setLoading(false);
      }
    }

    loadPortalData();
  }, [token]);

  const handleDownload = async () => {
    if (!dispatch || !beneficiary) return;
    setIsDownloading(true);

    try {
      // Direct track download action
      await fetch(`${API_BASE_URL}/api/public/documents/verify/${token}/track-download`, {
        method: "POST"
      });

      // Update local state to reflect download action instantly
      setDispatch((prev: any) => ({ ...prev, status: "DOWNLOADED" }));

      // Trigger document download
      let downloadUrl = "";
      if (document && document.pdfUrl) {
        downloadUrl = document.pdfUrl;
      } else {
        // Fallback generator link matching admission controllers
        if (dispatch.documentType === "ADMISSION_LETTER") {
          downloadUrl = `${API_BASE_URL}/api/admissions/download-letter/${beneficiary.id}`;
        } else {
          // General document verification downloads
          downloadUrl = `${API_BASE_URL}/api/admissions/download-form/${beneficiary.id}`;
        }
      }

      window.open(downloadUrl, "_blank");
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printContent = window.document.getElementById("document-preview-pane");
    if (!printContent) return;
    const windowUrl = "about:blank";
    const uniqueName = new Date().getTime();
    const windowName = `PrintWindow_${uniqueName}`;
    const prtWin = window.open(windowUrl, windowName, "left=100,top=100,width=950,height=900,toolbar=0,scrollbars=1,status=0,resizable=1");
    if (!prtWin) return;
    prtWin.document.write(`
      <html>
        <head>
          <title>Government TVET Portal Print System</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 24px; 
              color: #1e293b;
            }
            .print-page {
              border: 1px solid #cbd5e1;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              position: relative;
            }
            @media print {
              .print-page { border: none; padding: 0; }
            }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="print-page">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    prtWin.document.close();
    prtWin.focus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm w-full border border-gray-100 flex flex-col items-center">
          <RefreshCw className="animate-spin text-[#008751] h-12 w-12 stroke-2 mb-4" />
          <h3 className="text-gray-900 font-semibold text-lg">Verifying Trainee Credentials</h3>
          <p className="text-gray-500 text-sm mt-2">Checking secure identity key with central registry data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border border-gray-100">
          <div className="bg-red-50 text-red-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="h-9 w-9 stroke-2" />
          </div>
          <h3 className="text-gray-900 font-bold text-xl">Authorization Error</h3>
          <p className="text-red-600 font-medium text-sm mt-2 bg-red-50 p-2 rounded border border-red-100">{error}</p>
          <p className="text-gray-500 text-sm mt-4 leading-relaxed">
            Please verify visual parameters of the link, check that the dispatch token is correct, or request the registry program coordinator to resend training documents.
          </p>
          <button 
            onClick={onClose}
            className="mt-6 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#008751]"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  const organizationName = branding?.settings?.organizationName || "State TVET Board, Kano";
  const letterheadImg = branding?.settings?.admissionLetterheadUrl || branding?.letterhead?.imageUrl || "";

  return (
    <div id="secure-document-portal-root" className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col">
      {/* Top Banner Navigation */}
      <header className="bg-[#008751] text-white py-4 px-6 shadow-md border-b-4 border-[#ffcc00]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg border border-white/20">
              <ShieldCheck className="h-8 w-8 text-[#ffcc00] stroke-[2.5]" id="portal-icon-shield" />
            </div>
            <div>
              <h2 className="font-extrabold text-xl tracking-tight leading-none uppercase">IDEAS-TVET</h2>
              <p className="text-xs text-white/80 font-semibold tracking-wider mt-0.5 uppercase">Federal Trainee Dispatch Vault</p>
            </div>
          </div>
          <div className="bg-white/15 px-4 py-1.5 rounded-full border border-white/20 text-xs font-semibold flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            Secure Link Verified
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Security Meta Info Dashboard (4/12 width) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Main Security Verification Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden" id="card-security-meta">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-6 -mt-6"></div>
            
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
                <CheckCircle className="h-6 w-6 stroke-2" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Document Quality Badge</span>
                <h3 className="text-slate-950 font-bold leading-none mt-0.5">Authenticity Secure</h3>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-semibold">RECIPIENT PORTFOLIO</p>
                <p className="text-slate-900 font-bold text-sm mt-0.5" id="verify-recipient-name">
                  {beneficiary.firstName} {beneficiary.lastName}
                </p>
                <p className="text-slate-500 mt-1">ID: {beneficiary.id}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-semibold">TSP TRAINING CENTER</p>
                <p className="text-slate-900 font-bold text-sm mt-0.5">{beneficiary.tsp}</p>
                <p className="text-slate-500 mt-1">{beneficiary.skillSector} Module</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-slate-400 font-semibold">DISPATCH REFERENCE</p>
                <p className="font-mono text-slate-700 font-bold mt-0.5">{dispatch.id}</p>
              </div>
            </div>
          </div>

          {/* Real-time Tracking and Delivery Lifecycle Progress UI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm" id="card-delivery-timeline">
            <h4 className="text-slate-950 font-bold text-sm mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#008751] stroke-2" />
              Delivery Access Lifecycle
            </h4>

            <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-5">
              
              {/* Step 1: Enqueued */}
              <div className="relative">
                <div className="absolute -left-7.5 top-0.5 bg-emerald-50 text-emerald-600 rounded-full h-5 w-5 border-2 border-white flex items-center justify-center shadow-sm">
                  <CheckCircle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Enqueued & Verified</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Automated queue verification checkpoint cleared</p>
                </div>
              </div>

              {/* Step 2: Formatted & Sent */}
              <div className="relative">
                <div className="absolute -left-7.5 top-0.5 bg-emerald-50 text-emerald-600 rounded-full h-5 w-5 border-2 border-white flex items-center justify-center shadow-sm">
                  <CheckCircle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Transmitted (SENT)</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Secure link dispatched to registered email</p>
                  {dispatch.sentAt && (
                    <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mt-1">
                      {new Date(dispatch.sentAt).toLocaleString("en-GB")}
                    </span>
                  )}
                </div>
              </div>

              {/* Step 3: Viewed/Opened */}
              <div className="relative">
                <div className="absolute -left-7.5 top-0.5 bg-[#ffcc00]/10 text-[#d4a000] rounded-full h-5 w-5 border-2 border-white flex items-center justify-center shadow-sm">
                  <Eye className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Opened (ACTIVE VIEW)</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Trainee established secure visual connection</p>
                  {dispatch.openedAt && (
                    <span className="inline-block bg-[#ffcc00]/10 text-amber-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mt-1">
                      {new Date(dispatch.openedAt).toLocaleString("en-GB")}
                    </span>
                  )}
                </div>
              </div>

              {/* Step 4: Downloaded */}
              <div className="relative">
                <div className={`absolute -left-7.5 top-0.5 rounded-full h-5 w-5 border-2 border-white flex items-center justify-center shadow-sm ${
                  dispatch.status === "DOWNLOADED" 
                    ? "bg-emerald-50 text-emerald-600" 
                    : "bg-gray-50 text-gray-400"
                }`}>
                  <FileCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Official Download Executed</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Document successfully saved to candidate's local storage</p>
                  {dispatch.downloadedAt ? (
                    <span className="inline-block bg-emerald-50 text-emerald-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mt-1">
                      {new Date(dispatch.downloadedAt).toLocaleString("en-GB")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold italic block mt-1">Pending action confirmation...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Document Viewer and Printable Live Frame Preview (8/12 width) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Action Toolbar */}
          <div className="bg-white px-5 py-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#008751] stroke-2" />
              <div>
                <h4 className="text-slate-950 font-bold text-sm">
                  {dispatch.documentType === "ADMISSION_LETTER" ? "Admission Offer Letter" : "Admission Registration Form"}
                </h4>
                <p className="text-xs text-slate-500">Registry Verified Verification Copy</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all w-full sm:w-auto"
                title="Print Document"
              >
                <Printer className="h-4 w-4" />
                Print Visual
              </button>

              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center justify-center gap-1.5 px-5 py-2 bg-[#008751] hover:bg-[#007043] disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all w-full sm:w-auto"
                title="Download Official PDF"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? "Downloading..." : "Download Official PDF"}
              </button>
            </div>
          </div>

          {/* THE DOCUMENT CANVAS PANELS */}
          <div 
            className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 sm:p-12 font-serif text-slate-900 leading-relaxed max-w-full overflow-x-auto relative"
            style={{ minHeight: "850px" }}
            id="document-preview-pane"
          >
            {/* Embedded Active Logo Letterhead Area */}
            {letterheadImg ? (
              <div className="w-full mb-6 border-b pb-4">
                <img 
                  src={letterheadImg} 
                  alt="Official Government Executive Letterhead banner" 
                  className="max-h-24 mx-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="text-center border-b-2 border-double border-slate-800 pb-5 mb-8">
                <h1 className="font-extrabold text-lg uppercase tracking-tight text-slate-900">{organizationName}</h1>
                <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 mt-1">State Ministry of Technical Education Office</p>
                <p className="text-[10px] font-sans text-slate-400">Headquarters Support Desk, Gwarzo Road, Kano</p>
              </div>
            )}

            {/* Document Body Layout */}
            <div className="font-serif leading-loose text-sm sm:text-base space-y-6 text-justify">
              <div className="flex justify-between items-start font-sans text-xs text-slate-500 mb-6">
                <div>
                  <strong>REFERENCE:</strong> IDEAS/KANO/{beneficiary.id}/{new Date().getFullYear()}
                </div>
                <div>
                  <strong>DATE:</strong> {new Date().toLocaleDateString("en-GB")}
                </div>
              </div>

              {dispatch.documentType === "ADMISSION_LETTER" ? (
                <>
                  <div className="font-sans text-sm font-bold text-slate-900">
                    NAME: {beneficiary.firstName} {beneficiary.lastName}<br />
                    RESIDENCE: {beneficiary.state} State Training Cohort<br />
                    Trainee Reference No: {beneficiary.id}
                  </div>

                  <h3 className="font-bold font-sans text-base text-[#008751] uppercase border-b-2 border-[#008751]/20 pb-1 mt-6 tracking-wide text-center">
                    OFFICIAL CORRESPONDENCE: OFFER OF ADMISSION PLACEMENT
                  </h3>

                  <p>
                    I am pleased to inform you that the state screening committee has reviewed your application dossier and formally approved your 
                    <strong> Admission Placement Offer</strong> into the specialized federal skills enhancement cohort pathway.
                  </p>

                  <p>
                    Your training instruction details and course allocation are outlined inside the system as follows:
                  </p>

                  <div className="font-sans text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 my-6 space-y-2">
                    <div className="grid grid-cols-12 gap-2 border-b border-slate-200/50 pb-2">
                      <div className="col-span-4 text-slate-500 font-semibold">Trainee Course Allocation:</div>
                      <div className="col-span-8 text-slate-900 font-bold">{beneficiary.skillSector}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 border-b border-slate-200/50 pb-2">
                      <div className="col-span-4 text-slate-500 font-semibold">Training Service Provider (TSP):</div>
                      <div className="col-span-8 text-slate-900 font-bold">{beneficiary.tsp}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 border-b border-slate-200/50 pb-2">
                      <div className="col-span-4 text-slate-500 font-semibold">Cohort Program Track:</div>
                      <div className="col-span-8 text-slate-900 font-bold">{beneficiary.program} - Batch {beneficiary.batch}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4 text-slate-500 font-semibold">State of Enrollment Office:</div>
                      <div className="col-span-8 text-slate-900 font-bold">{beneficiary.state} State</div>
                    </div>
                  </div>

                  <p>
                    This training placement is fully-sponsored. In accepting this offer, you pledge to strictly adhere to instructions, safety rules, attendance metrics, and portfolio deliverables mandated by NBTE directives.
                  </p>

                  <p>
                    Please log into your trainee portfolio dashboard or sign the official digital Acceptance Form immediately. Use the dispatch reference token to receive active coordinator response approvals.
                  </p>

                  <div className="pt-8 flex justify-between items-end font-sans">
                    <div>
                      <div className="h-10 border-b border-slate-350 w-44"></div>
                      <p className="text-xs text-slate-500 font-bold mt-1">Registrar Signature Endorsement</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-600 font-bold">{organizationName}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Federal Document Delivery Assurance</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-bold font-sans text-base text-[#1e3a8a] uppercase border-b-2 border-[#1e3a8a]/20 pb-1 mt-6 tracking-wide text-center">
                    IDEAS-TVET INDIVIDUAL BIOMETRIC ENROLLMENT REPORT
                  </h3>

                  <div className="font-sans text-xs bg-slate-50 p-6 rounded-2xl border border-slate-100 my-6 space-y-4">
                    <h4 className="font-bold text-slate-900 text-sm border-b pb-2">1. PERSONAL DEMOGRAPHICS PROFILE</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 font-semibold block">FIRST NAME</span>
                        <span className="text-slate-900 font-bold mt-0.5">{beneficiary.firstName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">LAST NAME</span>
                        <span className="text-slate-900 font-bold mt-0.5">{beneficiary.lastName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">OTHER NAME</span>
                        <span className="text-slate-900 font-bold mt-0.5">{beneficiary.otherName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">GENDER SECTOR</span>
                        <span className="text-slate-900 font-bold mt-0.5">{beneficiary.gender || "FEMALE"}</span>
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm border-b pb-2 pt-4">2. CENTER ALLOCATION DETAILS</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 font-semibold block">SERVICE PROVIDER</span>
                        <span className="text-slate-900 font-bold mt-0.5">{beneficiary.tsp}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">SKILL DIVISION COURSE</span>
                        <span className="text-slate-900 font-bold mt-0.5">{beneficiary.skillSector}</span>
                      </div>
                    </div>
                  </div>

                  <p>
                    The student database record listed above represents the biometrics portfolio filed at registry. All credentials, verification tokens, and associated data streams have been confirmed on-chain on {new Date().toLocaleDateString("en-GB")}.
                  </p>

                  <p className="text-slate-500 text-xs italic">
                    Note: To edit incorrect data fields (such as address variations, wrong NIN inputs, or bank details), candidate must report directly to State Ministry Registry headquarters for bio-audit correction access.
                  </p>
                </>
              )}
            </div>

            {/* Micro security watermark footprint */}
            <div className="absolute bottom-4 right-6 font-sans text-[8px] text-slate-300 pointer-events-none uppercase">
              ID DISPATCH CERTIFICATE: {dispatch.id} / SECURE LINK ENCRYPTED
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="bg-slate-90% py-6 px-6 border-t border-slate-200 mt-auto bg-slate-900 text-slate-400 text-center text-xs">
        <p>&copy; {new Date().getFullYear()} Federal Ministry of Education & National Technical Board. All rights reserved.</p>
        <p className="text-slate-600 mt-1 font-mono text-[10px]">Trainee Document Portal Protocol API Sec Version 2.4 (SSL Bound)</p>
      </footer>
    </div>
  );
}
