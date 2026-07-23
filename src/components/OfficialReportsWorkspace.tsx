/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Image as ImageIcon, Sliders, ArrowUpRight, 
  Download, CheckCircle, AlertTriangle, FileText, Info, Loader2, Sparkles
} from "lucide-react";
import { authFetch } from "../utils/authFetch";

interface OfficialReportsWorkspaceProps {
  session: any;
  onNavigateToTab: (tab: any) => void;
  onSelectBeneficiary?: (id: string) => void;
}

export function OfficialReportsWorkspace({ session, onNavigateToTab, onSelectBeneficiary }: OfficialReportsWorkspaceProps) {
  const [totalCount, setTotalCount] = useState<number>(195);
  const [rosterCount, setRosterCount] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [preflightConflicts, setPreflightConflicts] = useState<Array<{ 
    beneficiaryId: string; 
    name: string; 
    reason: string;
    tvetId?: string;
    accountNumber?: string;
    conflictBeneficiaries?: Array<{ id: string; name: string; tvetId: string }>;
  }> | null>(null);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        // Load counts dynamically
        const beneficiariesRes = await authFetch("/api/beneficiaries?limit=1");
        if (beneficiariesRes.ok) {
          const bData = await beneficiariesRes.json();
          if (bData.total) {
            setTotalCount(bData.total);
          }
        }
        
        // Active roster count is always canonically 100
        setRosterCount(100);
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const downloadFile = async (url: string, filename: string) => {
    try {
      setExportLoading(filename);
      const response = await authFetch(url);
      if (!response.ok) {
        if (response.status === 422) {
          try {
            const data = await response.json();
            if (data.conflicts && Array.isArray(data.conflicts)) {
              setPreflightConflicts(data.conflicts);
              setShowConflictModal(true);
              return;
            }
          } catch (e) {
            console.error("Failed to parse 422 conflicts:", e);
          }
        }
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed. Please check the preflight integrity report and try again.");
    } finally {
      setExportLoading(null);
    }
  };

  const triggerPostExport = async (url: string, filename: string) => {
    try {
      setExportLoading(filename);
      const response = await authFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRoster: true })
      });
      if (!response.ok) {
        if (response.status === 422) {
          try {
            const data = await response.json();
            if (data.conflicts && Array.isArray(data.conflicts)) {
              setPreflightConflicts(data.conflicts);
              setShowConflictModal(true);
              return;
            }
          } catch (e) {
            console.error("Failed to parse POST 422 conflicts:", e);
          }
        }
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error("Post export failed:", err);
      alert("Export failed. Please check the preflight integrity report and try again.");
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div id="official_reports_container" className="space-y-6 max-w-7xl mx-auto p-1 font-sans">
      {/* Header Banner */}
      <div id="official_reports_header_banner" className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-10 pointer-events-none">
          <FileSpreadsheet className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold font-mono tracking-widest uppercase rounded-full">
            Federal Ministry of Education
          </span>
          <h1 className="text-2xl font-display font-medium tracking-tight">
            Official Program Audits & Reporting Hub
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Generate, sign, and download compliance-ready program reports fully scoped to the active official reporting roster.
          </p>
        </div>
      </div>

      {/* Roster & Headcount Overview Section */}
      <div id="roster_headcount_overview_section" className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div id="metric_reporting_scope" className="p-5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs border-l-4 border-indigo-600">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block tracking-wider">
            Reporting Scope
          </span>
          <div className="text-2xl font-extrabold text-slate-900 font-display">
            Active Official
          </div>
          <p className="text-xs text-slate-500">
            Strictly limited to the 100 active selected trainees roster.
          </p>
        </div>

        {/* Metric 2 */}
        <div id="metric_selected_trainees" className="p-5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs border-l-4 border-emerald-500">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block tracking-wider">
            Selected Trainees
          </span>
          <div className="text-3xl font-extrabold text-slate-900 font-display flex items-baseline gap-2">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            ) : (
              <span>{rosterCount}</span>
            )}
            <span className="text-xs font-medium text-slate-500">verified</span>
          </div>
          <p className="text-xs text-slate-500">
            Roster is active and finalized in database state.
          </p>
        </div>

        {/* Metric 3 */}
        <div id="metric_total_eligible" className="p-5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs border-l-4 border-amber-500">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block tracking-wider">
            Total Eligible Candidates
          </span>
          <div className="text-3xl font-extrabold text-slate-900 font-display flex items-baseline gap-2">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            ) : (
              <span>{totalCount}</span>
            )}
            <span className="text-xs font-medium text-slate-500">registered</span>
          </div>
          <p className="text-xs text-slate-500">
            Total cohort applications registered across all states.
          </p>
        </div>
      </div>

      {/* Information Callout */}
      <div id="compliance_notice" className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-xs text-slate-600">
        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-slate-800">Compliance Directives Enforced</strong>
          <p>
            This system enforces tenant isolation. Exports generated below automatically scope to your authorized Training Service Provider (TSP) or State jurisdiction. All PDF, Word, and Excel exports respect the active 100-trainee audit roster.
          </p>
        </div>
      </div>

      {/* Three Beautiful Report Cards */}
      <div id="three_report_cards_grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Official Annex 9 Workbook */}
        <div id="card_official_annex_9" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-slate-300 transition duration-200">
          <div className="space-y-3">
            <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Official Annex 9 Attendance Ledger</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Contains verified biometric attendance percentages, TVET-ID mappings, bank account details, and profile completeness audits formatted to standard federal reporting formats.
              </p>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <button
              id="export_annex9_xlsx_btn"
              disabled={exportLoading !== null}
              onClick={() => downloadFile("/api/reports/annex9/official/export?useActiveRoster=true", "Official_Annex_9_Workbook.xlsx")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {exportLoading === "Official_Annex_9_Workbook.xlsx" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export Workbook (.xlsx)
            </button>
            <button
              id="export_annex9_csv_btn"
              disabled={exportLoading !== null}
              onClick={() => downloadFile("/api/reports/annex9/official/export?useActiveRoster=true&format=csv", "Official_Annex_9_Attendance.csv")}
              className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {exportLoading === "Official_Annex_9_Attendance.csv" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-slate-400" />
              )}
              Export Clean CSV
            </button>
          </div>
        </div>

        {/* Card 2: Official Beneficiary Photo Album */}
        <div id="card_official_photo_album" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-slate-300 transition duration-200">
          <div className="space-y-3">
            <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Official Beneficiary Photo Album</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Compiles professional high-resolution verified biometric profile photographs of active roster members with designated national identification cards and enrollment indicators.
              </p>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <button
              id="export_album_pdf_btn"
              disabled={exportLoading !== null}
              onClick={() => triggerPostExport("/api/export/album/pdf", "Official_Photo_Album.pdf")}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {exportLoading === "Official_Photo_Album.pdf" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export Photo Album (PDF)
            </button>
            <button
              id="export_album_word_btn"
              disabled={exportLoading !== null}
              onClick={() => triggerPostExport("/api/export/album/word", "Official_Photo_Album.docx")}
              className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {exportLoading === "Official_Photo_Album.docx" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-slate-400" />
              )}
              Export Photo Album (Word)
            </button>
          </div>
        </div>

        {/* Card 3: Monthly Annex 9 Data Correction */}
        <div id="card_annex9_data_completion" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-slate-300 transition duration-200">
          <div className="space-y-3">
            <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Annex 9 Data Completion</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Review, correct, and finalize critical reporting fields like Gender, Disabilities, and Education background before compiling official ledger packages for final submission.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <button
              id="goto_data_completion_btn"
              onClick={() => onNavigateToTab("annex9-completion")}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-xs transition duration-150 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Launch Correction Module
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Preflight Conflicts Dialog / Modal */}
      {showConflictModal && preflightConflicts && (
        <div id="preflight_conflict_modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Bank-Data Integrity Preflight Failures
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The official ledger export cannot be compiled because the backend preflight checker detected active data-integrity or profile-completeness conflicts. Correct these issues inside the database profile to proceed.
                </p>
              </div>
            </div>

            {/* Modal Content - List of conflicts */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
              <div className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider mb-2">
                Identified Conflicts ({preflightConflicts.length})
              </div>
              {preflightConflicts.map((c, idx) => {
                const isProvenDuplicate = c.conflictBeneficiaries && c.conflictBeneficiaries.length > 0;
                return (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 flex-wrap gap-2">
                      <span className="font-extrabold text-[10px] tracking-wider uppercase text-slate-800">
                        {isProvenDuplicate ? "Confirmed Duplicate Account Number" : "Bank Data Verification Required"}
                      </span>
                      {c.accountNumber && (
                        <span className="font-mono text-[9px] bg-slate-150 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                          Evidence: *** *** {c.accountNumber.slice(-4)}
                        </span>
                      )}
                    </div>
                    
                    {isProvenDuplicate ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Trainee A */}
                          <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-lg flex flex-col justify-between gap-2">
                            <div>
                              <div className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider">Trainee A</div>
                              <div className="font-bold text-xs text-slate-800 mt-0.5">{c.name}</div>
                              <div className="font-mono text-[9px] text-slate-500 font-semibold mt-0.5">TVET ID: {c.tvetId || c.beneficiaryId}</div>
                            </div>
                            {onSelectBeneficiary && (
                              <button
                                onClick={() => {
                                  setShowConflictModal(false);
                                  onSelectBeneficiary(c.beneficiaryId);
                                }}
                                className="mt-1 self-start px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] rounded-md uppercase tracking-wider transition duration-100 cursor-pointer"
                              >
                                View Trainee A
                              </button>
                            )}
                          </div>

                          {/* Trainee B */}
                          {c.conflictBeneficiaries!.map((cb, cbIdx) => (
                            <div key={cbIdx} className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-lg flex flex-col justify-between gap-2">
                              <div>
                                <div className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider">Trainee B</div>
                                <div className="font-bold text-xs text-slate-800 mt-0.5">{cb.name}</div>
                                <div className="font-mono text-[9px] text-slate-500 font-semibold mt-0.5">TVET ID: {cb.tvetId || cb.id}</div>
                              </div>
                              {onSelectBeneficiary && (
                                <button
                                  onClick={() => {
                                    setShowConflictModal(false);
                                    onSelectBeneficiary(cb.id);
                                  }}
                                  className="mt-1 self-start px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded-md uppercase tracking-wider transition duration-100 cursor-pointer"
                                >
                                  View Trainee B
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <p className="text-xs text-slate-650 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-150 font-medium">
                          {c.reason}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-slate-800">{c.name}</span>
                          <span className="font-mono text-[9px] bg-red-50 text-red-700 px-2.5 py-1 rounded-md font-bold border border-red-100">
                            ID: {c.beneficiaryId}
                          </span>
                        </div>
                        <p className="text-xs text-red-650 font-medium leading-relaxed bg-red-50/20 p-2.5 rounded-lg border border-red-50">
                          {c.reason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer transition"
              >
                Cancel & Close
              </button>
              <button
                onClick={() => {
                  setShowConflictModal(false);
                  onNavigateToTab("annex9-completion");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Launch Correction Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
