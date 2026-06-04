/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  FileSpreadsheet, Image as ImageIcon, FileText, Download, Printer, 
  CheckCircle2, Compass, AlertCircle, FileImage, Layers, Filter, Check, Landmark, Award 
} from "lucide-react";
import { Beneficiary, ProgramStatus } from "../types";
import { downloadWithAuth } from "../utils/authFetch";

interface ReportsWorkspaceProps {
  beneficiaries: Beneficiary[];
}

export function ReportsWorkspace({ beneficiaries }: ReportsWorkspaceProps) {
  const [activeReportTab, setActiveReportTab] = useState<"excel" | "album" | "pdf">("excel");

  // Excel filter state
  const [selectedState, setSelectedState] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState("all");

  const displayList = beneficiaries.filter(b => {
    const sMatch = selectedState === "all" || b.state === selectedState;
    const bMatch = selectedBatch === "all" || b.batch === selectedBatch;
    return sMatch && bMatch;
  });

  const totalCount = beneficiaries.length;
  const verifiedCount = beneficiaries.filter(b => b.status === ProgramStatus.VERIFIED).length;
  const compliancePercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;

  const existingStates = Array.from(new Set(["Imo", ...beneficiaries.map(b => b.state).filter(Boolean)]));

  return (
    <div className="space-y-6 font-sans select-none max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Workspace Menu Bar Tabs (matches 2.png, 3.png, 7.png sub-tabs) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200/90 gap-4">
        <div>
          <h2 className="text-xl font-display font-medium text-slate-800 uppercase tracking-tight">
            Program Audits & Reports Hub
          </h2>
          <p className="text-xs text-slate-400">
            Generate and export verified program deliverables under federal regulatory guidelines.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
          <button
            onClick={() => setActiveReportTab("excel")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeReportTab === "excel"
                ? "bg-white text-indigo-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Excel Worksheet
          </button>
          
          <button
            onClick={() => setActiveReportTab("album")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeReportTab === "album"
                ? "bg-white text-indigo-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ImageIcon className="w-4 h-4 text-indigo-600" />
            Photo Album Grid
          </button>

          <button
            onClick={() => setActiveReportTab("pdf")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeReportTab === "pdf"
                ? "bg-white text-indigo-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4 text-rose-500" />
            Official PDF Preview
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* VIEW A: EXCEL SPREADSHEET AUDIT PREVIEW (2.png) */}
      {/* ----------------------------------------------------------------- */}
      {activeReportTab === "excel" && (
        <div className="space-y-6">
          
          {/* Top Info metrics bento grids (2.png row) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            {/* Card 1: Data integrity */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-emerald-500 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-slate-400 block tracking-widest font-mono uppercase">DATA INTEGRITY</span>
                <span className="text-xl font-bold text-slate-900 font-display">100% SECURE</span>
                <p className="text-[10px] text-emerald-600 font-semibold font-mono">● All NIN / BVN Matched</p>
              </div>
              <div className="h-10 w-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Report Metadata */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-indigo-500 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-slate-400 block tracking-widest font-mono uppercase">REPORT METADATA</span>
                <span className="text-xl font-bold text-slate-900 font-display font-mono">FED-COV-{new Date().getFullYear()}</span>
                <p className="text-[10px] text-slate-400">Classified digital skills register</p>
              </div>
              <div className="h-10 w-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Confidentiality level */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-rose-500 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-slate-400 block tracking-widest font-mono uppercase">CONFIDENTIALITY</span>
                <span className="text-xl font-bold text-rose-700 font-display">RESTRICTED</span>
                <p className="text-[10px] text-rose-500 font-mono">● Federal Ministry of Education</p>
              </div>
              <div className="h-10 w-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Filtering row options */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
              >
                <option value="all">Federal Coverage (All States)</option>
                {existingStates.map(stateName => (
                  <option key={stateName} value={stateName}>{stateName}</option>
                ))}
              </select>

              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
              >
                <option value="all">All Academic Batches</option>
                {Array.from(new Set(beneficiaries.map(b => b.batch).filter(Boolean))).sort().map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={async () => {
                try {
                  await downloadWithAuth(`/api/export/excel?state=${selectedState}&batch=${selectedBatch}`, `ideas_beneficiaries_${selectedState}_${selectedBatch}.xls`);
                } catch (err) {
                  console.error("Excel download failed:", err);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-xs shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Secure Excel Download (.xlsx)
            </button>
          </div>

          {/* Spreadsheet table mockup conforming to 2.png */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-4 font-sans text-xs">Photo</th>
                    <th className="py-2.5 px-4 font-sans text-xs">First Name</th>
                    <th className="py-2.5 px-4 font-sans text-xs">Last Name</th>
                    <th className="py-2.5 px-4">NIN</th>
                    <th className="py-2.5 px-4">BVN</th>
                    <th className="py-2.5 px-4 font-sans text-xs">State</th>
                    <th className="py-2.5 px-4 font-sans text-xs">City</th>
                    <th className="py-2.5 px-4 font-sans text-xs">TSP</th>
                    <th className="py-2.5 px-4 font-sans text-xs">Skill Sector</th>
                    <th className="py-2.5 px-4 font-sans text-xs">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-600">
                  {displayList.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/55 transition">
                      <td className="py-2 px-4">
                        <img 
                          src={b.photo} 
                          alt="Biometric" 
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      </td>
                      <td className="py-2 px-4 font-sans text-slate-800 font-semibold">{b.firstName}</td>
                      <td className="py-2 px-4 font-sans text-slate-800 font-semibold">{b.lastName}</td>
                      <td className="py-2 px-4">{b.nin}</td>
                      <td className="py-2 px-4">{b.bvn}</td>
                      <td className="py-2 px-4 font-sans text-slate-500">{b.state}</td>
                      <td className="py-2 px-4 font-sans text-slate-500">{b.city}</td>
                      <td className="py-2 px-4 font-sans font-semibold text-slate-500">{b.tsp || "Unique Technology Nig. Ltd"}</td>
                      <td className="py-2 px-4 font-sans text-slate-500">{b.skillSector || "Computer Hardware and Cell Phone Repairs"}</td>
                      <td className="py-2 px-4 text-slate-400">
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-GB") : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginated info bar */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-[10px] font-semibold text-slate-400 text-center tracking-normal">
              PREVIEW RECONCILED DIRECTORY WITH NIGERIAN NATIONAL METADATA DATABASE
            </div>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* VIEW B: COMPACT PHOTO CARDS CATALOG (3.png) */}
      {/* ----------------------------------------------------------------- */}
      {activeReportTab === "album" && (
        <div className="space-y-6">
          
          <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
            <span className="text-xs text-slate-400 font-mono">Cataloging {displayList.length} candidate biometrics</span>
            <button 
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs shadow cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Album Cards
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayList.map(b => (
              <div 
                key={b.id}
                className="bg-white border border-slate-200 rounded-xl p-4 text-center space-y-4 hover:shadow-md transition relative flex flex-col justify-between"
              >
                
                {b.status === ProgramStatus.VERIFIED && (
                  <div className="absolute top-2 right-2 bg-emerald-50 text-emerald-700 font-bold text-[8px] px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> LOCK ACTIVE
                  </div>
                )}

                <div>
                  <img 
                    src={b.photo} 
                    alt="Biometric Capture" 
                    className="w-24 h-24 rounded-full object-cover border border-slate-200 mx-auto"
                  />
                  
                  <div className="space-y-0.5 mt-3">
                    <h4 className="font-display font-bold text-slate-900 text-[13px] uppercase">
                      {b.lastName}, {b.firstName}
                    </h4>
                    <p className="text-[10px] font-mono text-slate-400">
                      REF ID: {b.id}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 font-mono text-[9px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>NIN Number:</span>
                    <span className="font-semibold text-slate-800">{b.nin.substring(0,6)}*****</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BVN Profile:</span>
                    <span className="font-semibold text-slate-800">{b.bvn.substring(0,4)}******</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LGA Hub:</span>
                    <span className="font-semibold text-indigo-700">{b.state.replace(" State", "")}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* VIEW C: OFFICIAL PDF REPORT PREVIEW LAYOUT (7.png) */}
      {/* ----------------------------------------------------------------- */}
      {activeReportTab === "pdf" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Simulated Letter Paper Mockup (7.png left) */}
          <div className="lg:col-span-8 bg-zinc-100 border border-slate-200 rounded-xl p-3 sm:p-8 flex items-center justify-start overflow-x-auto">
            
            <div id="pdf-reconstruction-sheet" className="w-full max-w-[595px] bg-white border border-slate-300 p-8 shadow-xl text-slate-800 relative space-y-6 select-text text-xs min-h-[700px] flex flex-col justify-between">
              
              {/* Cover Header */}
              <div className="space-y-4">
                
                <div className="flex items-center justify-between border-b pb-4 border-slate-200">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-8 h-8 text-indigo-900" />
                    <div>
                      <span className="font-display font-bold text-[10px] text-indigo-950 uppercase block tracking-wider leading-none">
                        IDEAS-TVET Program Registry
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5 tracking-tight font-mono">
                        FEDERAL COMPLIANCE DOCUMENT
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase py-1 px-2.5 bg-slate-50 rounded border">
                    Page 1 of 1
                  </span>
                </div>

                {/* Sub-titles */}
                <div className="space-y-1.5 text-center py-4">
                  <h3 className="font-display font-medium text-lg text-slate-900 font-bold tracking-tight uppercase leading-tight">
                    Certificate of Training Allocation & Enrollment Lock
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    System Generated Transaction Hash: <span className="font-semibold">0x7F498A92EEBC</span> | Date: {new Date().toLocaleDateString()}
                  </p>
                </div>

                {/* Main letter description content text */}
                <div className="space-y-3 leading-relaxed text-[11px] text-slate-600 font-serif">
                  <p>
                    This is to certified and document that the specified enrolled candidates listed across the Unique Technology Nig. Ltd coordinates are vetted, cleared by the Federal Skills Sector Hub, and authorized to proceed on training tracks for <strong>Computer Hardware and Cell Phone Repairs</strong>.
                  </p>
                  <p>
                    Biometric locking mechanisms are activated and checked directly with National Identity database endpoints under Federal TVET grants parameters.
                  </p>
                </div>

                {/* Allocations checklist table inside paper mockup */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 mt-4 text-[10px] font-mono">
                  <div className="bg-slate-100 px-3 py-1.5 border-b font-bold text-slate-700">SUMMARY ALLOCATION LEVELS</div>
                  <div className="p-3 space-y-2.5 text-slate-600">
                    <div className="flex justify-between border-b pb-1">
                      <span>Total Vetted Hub Allocations</span>
                      <span className="font-bold text-slate-900">{totalCount.toLocaleString()} Candidates</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Approved Biometrics Locking Status</span>
                      <span className="font-bold text-emerald-600">{compliancePercent}% Compliance Verified</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accredited Provider Site Signature</span>
                      <span className="font-bold text-slate-900">Unique Technology Nig. Ltd</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Cover Stamp Cert and Authorized sign-offs (7.png bottom) */}
              <div className="pt-6 border-t border-slate-200 border-dashed grid grid-cols-2 gap-4 items-end">
                
                <div className="space-y-4">
                  <div className="border border-indigo-200 rounded p-2.5 bg-indigo-50/40 text-[9px] font-mono text-indigo-800 leading-normal max-w-[190px]">
                    <span className="font-bold uppercase tracking-wider block mb-1 text-indigo-755 text-indigo-700">✓ CERTIFIED LOCK</span>
                    <span>Unique Technology Nig. Ltd</span>
                    <span className="block mt-0.5">Disbursements Released</span>
                  </div>
                </div>

                <div className="text-right space-y-1 font-mono text-[9px] text-slate-500">
                  <div className="border-b border-slate-350 border-slate-300 w-36 ml-auto h-8 mb-1"></div>
                  <p className="font-bold text-slate-800">Authorized Auditor</p>
                  <p>Federal Ministry of Education</p>
                  <p>Signed and Stamped Registry</p>
                </div>

              </div>

            </div>

          </div>

          {/* Right panel: Dark control panel parameters uploader console (7.png right) */}
          <div className="lg:col-span-4 bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm space-y-5">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="font-display font-bold text-xs uppercase tracking-widest text-slate-200">
                PDF Export Parameters
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Configure layout preferences before compile dispatch.</p>
            </div>

            {/* Parameters properties */}
            <div className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Paper Dimension</span>
                <select className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 py-1.5 px-2.5 rounded text-slate-200 focus:outline-none">
                  <option value="a4">A4 (Standard Nigerian Audit)</option>
                  <option value="letter">Letter Size</option>
                  <option value="legal">Legal Sheet</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Watermark Lock</span>
                <select className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 py-1.5 px-2.5 rounded text-slate-200 focus:outline-none">
                  <option value="gov-only">"RESTRICTED GOV" Background</option>
                  <option value="none">No Watermark</option>
                  <option value="vetted">"VETTED" Center Stamp</option>
                </select>
              </div>

              {/* Check toggles */}
              <div className="space-y-2 py-2 border-t border-b border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none text-[11px]">
                  <input type="checkbox" defaultChecked className="rounded bg-slate-950 border-slate-800 text-indigo-500" />
                  <span>Affix Authorized Stamp seal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none text-[11px]">
                  <input type="checkbox" defaultChecked className="rounded bg-slate-950 border-slate-800 text-indigo-500" />
                  <span>Bypass Local BVN records data masking</span>
                </label>
              </div>
            </div>

            <button 
              onClick={async () => {
                try {
                  await downloadWithAuth(`/api/export/pdf?state=${selectedState}&batch=${selectedBatch}`, `ideas_beneficiaries_report_${selectedState}_${selectedBatch}.pdf`);
                } catch (err) {
                  console.error("PDF download failed:", err);
                }
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-55 bg-indigo-500 text-white font-bold text-xs py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              Compile & Download PDF
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
