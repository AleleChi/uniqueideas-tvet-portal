/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Printer, Download, FileText, CheckCircle, Table } from "lucide-react";
import { Beneficiary, ProgramStatus, OrganizationSettings } from "../types";
import { authFetch, downloadWithAuth } from "../utils/authFetch";
import { SecureBeneficiaryImage } from "./SecureBeneficiaryImage";

interface AlbumGeneratorProps {
  beneficiaries: Beneficiary[];
}

export function AlbumGenerator({ beneficiaries }: AlbumGeneratorProps) {
  const [filterState, setFilterState] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await authFetch("/api/organization-settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error("Failed to load organization settings in album:", err);
      }
    }
    loadSettings();
  }, []);

  // Filter list
  const displayList = beneficiaries.filter(b => {
    const sMatch = filterState === "all" || b.state === filterState;
    const bMatch = filterBatch === "all" || b.batch === filterBatch;
    return sMatch && bMatch;
  });

  const uniqueStates = Array.from(new Set(["Imo", ...beneficiaries.map(b => b.state).filter(Boolean)]));
  const uniqueBatches = Array.from(new Set(beneficiaries.map(b => b.batch).filter(Boolean))).sort();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadWithAuth(
        `/api/export/pdf?state=${filterState}&batch=${filterBatch}`,
        `ideas_beneficiaries_registry_${filterState}_${filterBatch}.pdf`
      );
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadWord = async () => {
    try {
      setIsDownloadingWord(true);
      await downloadWithAuth(
        `/api/export/word?state=${filterState}&batch=${filterBatch}`,
        `ideas_beneficiaries_registry_${filterState}_${filterBatch}.doc`
      );
    } catch (err) {
      console.error("Word download failed:", err);
    } finally {
      setIsDownloadingWord(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Control toolbelt block (no-print) */}
      <div className="no-print bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
          >
            <option value="all">All States</option>
            {uniqueStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
          >
            <option value="all">All Batches</option>
            {uniqueBatches.map(batchName => (
              <option key={batchName} value={batchName}>{batchName}</option>
            ))}
          </select>

          <div className="h-5 w-px bg-slate-200"></div>
          
          <span className="text-xs text-slate-500 font-mono">
            Filtered count: <strong className="text-indigo-900">{displayList.length}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            type="button"
            onClick={handlePrint}
            className="flex-1 md:flex-initial bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3.5 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Registry (A4)
          </button>

          <button 
            type="button"
            disabled={isDownloadingPdf}
            onClick={handleDownloadPdf}
            className="flex-1 md:flex-initial bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3.5 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow transition cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            {isDownloadingPdf ? "Compiling PDF..." : "Export PDF"}
          </button>

          <button 
            type="button"
            disabled={isDownloadingWord}
            onClick={handleDownloadWord}
            className="flex-1 md:flex-initial bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3.5 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloadingWord ? "Compiling Word..." : "Export Word (.doc)"}
          </button>
        </div>
      </div>

      {/* Printable Sheet Canvas Wrapper (Fits neatly under A4) */}
      <div className="bg-white border border-slate-200 shadow-lg rounded-2xl max-w-4xl mx-auto p-4 sm:p-8 text-neutral-800 transition-all duration-300">
        
        {/* COVER SHEET SECTION (Always printed first) */}
        <div className="border-4 border-indigo-950 p-6 sm:p-8 rounded-xl text-center space-y-6 mb-10">
          
          {settings?.photoAlbumHeaderUrl ? (
            <div className="w-full flex justify-center mb-4">
              <img 
                src={settings.photoAlbumHeaderUrl} 
                alt="Photo Album Header" 
                className="max-h-20 object-contain max-w-full" 
                referrerPolicy="no-referrer" 
              />
            </div>
          ) : (
            <div className="flex justify-center items-center gap-4">
              <div className="h-14 w-14 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-indigo-950 font-display font-bold text-[10px] text-center p-1 leading-none">
                IDEAS TVET
              </div>
              <div className="h-12 w-px bg-slate-300"></div>
              <div className="h-14 w-14 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-800 font-display font-bold text-[10px] leading-none">
                UNIQUE TECH
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[9px] font-bold font-mono text-indigo-600 uppercase tracking-widest leading-none">
              Official Profile Directory
            </p>
            <h1 className="font-display font-bold text-2xl text-indigo-950 tracking-tight leading-tight">
              IDEAS-TVET Program Registry Portfolio
            </h1>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Federal Ministry of Education Innovation Grants for Digital Skills Training program. 
              Sector: Computer Hardware and Cell Phone Repairs.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-md mx-auto grid grid-cols-2 gap-3 text-left text-xs text-slate-600 font-mono">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Academic Range</span>
              <span className="font-semibold text-slate-800">
                {filterBatch === "all" ? "All Active Batches" : filterBatch}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Origin State</span>
              <span className="font-semibold text-slate-800">
                {filterState === "all" ? "Federal Coverage" : filterState}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Total Enrolled</span>
              <span className="font-semibold text-slate-800">{displayList.length} Candidates</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Compliance Status</span>
              <span className="font-semibold text-emerald-600 font-mono uppercase">100% REGISTRY SECURED</span>
            </div>
          </div>

          <div className="flex justify-center gap-6 pt-2 items-center text-left">
            <div className="border border-indigo-100 p-2.5 bg-indigo-50/20 rounded-lg text-[9px] text-slate-500 font-mono">
              <p className="font-bold text-indigo-700 uppercase mb-0.5">✓ VETTED PARTNER</p>
              <p>{settings?.organizationName || "Unique Technology Nig. Ltd"}</p>
              <p>Date: {new Date().toLocaleDateString("en-GB")}</p>
            </div>
            <div className="border border-slate-200 p-2.5 bg-slate-50 rounded-lg text-[9px] text-slate-500 font-mono flex items-center gap-2">
              <div className="h-8 w-8 bg-slate-200 rounded flex items-center justify-center text-[7px] font-bold">STAMP</div>
              <div>
                <p className="font-bold uppercase text-slate-700">FME APPROVED</p>
                <p>IDEAS-TVET-GOV</p>
              </div>
            </div>
          </div>

        </div>

        {/* PRINT PAGE BREAK */}
        <div className="print-page-break"></div>        {/* REGISTRY CONTENT SECTION */}
        <div>
          <div className="flex items-center justify-between border-b pb-1.5 mb-6 border-slate-200">
            <h2 className="font-display font-bold text-xs tracking-widest text-slate-600 uppercase">
              RECONCILED CANDIDATES DIRECTORY
            </h2>
            <span className="text-xs font-mono text-slate-400">Total Records: {displayList.length}</span>
          </div>

          {/* Records layout using official standard table layout */}
          <table className="w-full border-collapse border border-slate-300 text-left text-xs text-slate-850 mt-4 bg-white" id="official-registry-table">
            <thead>
              <tr className="bg-indigo-950 text-white font-display text-[10px] tracking-wide uppercase">
                <th className="border border-slate-300 p-2.5 text-center w-12 font-bold select-none">S/N</th>
                <th className="border border-slate-300 p-2.5 text-center w-[160px] font-bold select-none">Photograph</th>
                <th className="border border-slate-300 p-3 font-bold select-none">Details</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((b, index) => {
                const lga = b.customFields?.["Local Government Area (LGA)"] || b.customFields?.["lga"] || b.customFields?.["LGA"] || b.customFields?.["cf_lga"] || "N/A";
                
                let age = "N/A";
                if (b.dateOfBirth) {
                  try {
                    let dobDate: Date | null = null;
                    if (b.dateOfBirth.includes("/")) {
                      const parts = b.dateOfBirth.split("/");
                      if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        const year = parseInt(parts[2], 10);
                        dobDate = new Date(year, month, day);
                      }
                    }
                    if (!dobDate || isNaN(dobDate.getTime())) {
                      dobDate = new Date(b.dateOfBirth);
                    }

                    if (dobDate && !isNaN(dobDate.getTime())) {
                      const today = new Date();
                      let computedAge = today.getFullYear() - dobDate.getFullYear();
                      const m = today.getMonth() - dobDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                        computedAge--;
                      }
                      const formattedDob = dobDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                      age = `${computedAge} Yrs (${formattedDob})`;
                    } else {
                      age = b.dateOfBirth;
                    }
                  } catch (e) {
                    age = b.dateOfBirth;
                  }
                } else {
                  age = b.customFields?.["Age"] || b.customFields?.["age"] || b.customFields?.["Date of Birth"] || b.customFields?.["dob"] || "N/A";
                }

                return (
                  <tr 
                    key={b.id} 
                    className="hover:bg-slate-50/50"
                    style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                  >
                    {/* Column 1: S/N (Centered, Bold, sequential) */}
                    <td className="border border-slate-300 p-3 text-center font-mono font-bold text-slate-700 align-middle select-none">
                      {index + 1}
                    </td>

                    {/* Column 2: Photograph (Fixed width, white background behind photo, centered) */}
                    <td className="border border-slate-300 p-1.5 text-center align-middle bg-slate-50/30">
                      <div 
                        style={{
                          width: "135px",
                          height: "170px",
                          background: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto",
                          overflow: "hidden",
                          border: "1.5px solid #000000"
                        }}
                      >
                        {b.photo ? (
                          <img 
                            src={b.photo} 
                            alt="Passport Photograph" 
                            referrerPolicy="no-referrer"
                            style={{
                              width: "135px",
                              height: "170px",
                              objectFit: "cover"
                            }}
                          />
                        ) : (
                          <SecureBeneficiaryImage 
                            id={b.id}
                            className="w-full h-full object-cover"
                            alt="Passport Photograph"
                            style={{
                              width: "135px",
                              height: "170px",
                              objectFit: "cover"
                            }}
                            fallbackInitials="NO PHOTO AVAILABLE"
                          />
                        )}
                      </div>
                      <div className="mt-1 font-mono text-[8.5px] font-bold text-slate-500">
                        REF: {b.id}
                      </div>
                    </td>

                    {/* Column 3: Details (Fields vertically stacked with labels aligned right) */}
                    <td className="border border-slate-300 p-4 align-top">
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">Full Name:</span>
                          <span className="font-bold text-slate-900 uppercase">{b.lastName}, {b.firstName} {b.otherName || ""}</span>
                        </div>
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">Gender:</span>
                          <span className="font-bold text-slate-800 uppercase">{b.gender}</span>
                        </div>
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">Age / Date of Birth:</span>
                          <span className="font-bold text-slate-800">{age}</span>
                        </div>
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">Phone Number:</span>
                          <span className="font-bold text-slate-800">{b.phoneNumber || "N/A"}</span>
                        </div>
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">NIN:</span>
                          <span className="font-bold text-slate-800">{b.nin || "N/A"}</span>
                        </div>
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">Email Address:</span>
                          <span className="font-bold text-slate-800">{b.email || "N/A"}</span>
                        </div>
                        <div className="flex border-b border-dashed border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">State of Origin:</span>
                          <span className="font-bold text-slate-800">{b.state || "N/A"}</span>
                        </div>
                        <div className="flex border-b border-slate-100 pb-1 items-baseline">
                          <span className="text-slate-400 font-bold uppercase text-[9px] w-48 shrink-0">Local Government Area:</span>
                          <span className="font-extrabold text-indigo-950">{lga}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {displayList.length === 0 && (
            <div className="p-12 text-center text-slate-400 font-medium text-xs border border-dashed border-slate-200 rounded-xl mt-6">
              No matching records to generate photo registry blocks.
            </div>
          )}
        </div>

        {/* PRINT PAGE BREAK */}
        <div className="print-page-break"></div>

        {/* VERIFICATION SIGN-OFF SHEET SUMMARY (Always prints at final page) */}
        <div className="mt-12 pt-8 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500 font-mono">
          <div>
            <span className="font-bold text-slate-700 border-b pb-1 pr-10 mb-6 block uppercase tracking-wider">
              Prepared By:
            </span>
            <p className="font-bold text-slate-800 mt-2">Super Administrator</p>
            <p>{settings?.organizationName || "Unique Technology Nig. Ltd"}</p>
            <p>Ideals TVET Training Coordinator</p>
          </div>
          <div>
            <span className="font-bold text-slate-700 border-b pb-1 pr-10 mb-6 block uppercase tracking-wider">
              Approved By:
            </span>
            <p className="font-bold text-slate-800 mt-2">Operations Manager</p>
            <p>Federal Ministry of Education Auditor</p>
            <p>Authorized Signature & Stamp</p>
          </div>
        </div>

      </div>

    </div>
  );
}
