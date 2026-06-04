/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Printer, ChevronDown, RefreshCw, LayoutGrid, Award, CheckCircle, Search } from "lucide-react";
import { Beneficiary, ProgramStatus } from "../types";

interface AlbumGeneratorProps {
  beneficiaries: Beneficiary[];
}

export function AlbumGenerator({ beneficiaries }: AlbumGeneratorProps) {
  const [columns, setColumns] = useState<number>(3); // 2 | 3 | 4
  const [filterState, setFilterState] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");

  const handlePrint = () => {
    window.print();
  };

  // Filter list
  const displayList = beneficiaries.filter(b => {
    const sMatch = filterState === "all" || b.state === filterState;
    const bMatch = filterBatch === "all" || b.batch === filterBatch;
    return sMatch && bMatch;
  });

  // Calculate stats
  const totalVerified = displayList.filter(b => b.status === ProgramStatus.VERIFIED).length;

  return (
    <div className="space-y-6">
      
      {/* Control toolbelt block (no-print) */}
      <div className="no-print bg-white p-4 border border-slate-200/80 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
          >
            <option value="all">All States</option>
            <option value="Lagos State">Lagos State</option>
            <option value="Kano State">Kano State</option>
            <option value="Enugu State">Enugu State</option>
            <option value="Kaduna State">Kaduna State</option>
            <option value="Osun State">Osun State</option>
          </select>

          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:bg-white"
          >
            <option value="all">All Batches</option>
            {Array.from(new Set(beneficiaries.map(b => b.batch).filter(Boolean))).sort().map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <div className="h-5 w-px bg-slate-200"></div>

          {/* Grid setup */}
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200">
            {[2, 3, 4].map((col) => (
              <button 
                key={col}
                onClick={() => setColumns(col)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                  columns === col 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {col} Cols
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handlePrint}
          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-xs shadow transition active:scale-[99%]"
        >
          <Printer className="w-3.5 h-3.5" />
          Export / Print Album PDF
        </button>
      </div>

      {/* Printable Sheet Canvas Wrapper (Fits neatly under A4) */}
      <div className="bg-white border border-slate-200 shadow-lg rounded-2xl max-w-4xl mx-auto p-8 text-neutral-800 transition-all duration-300">
        
        {/* COVER SHEET SECTION (Always printed first) */}
        <div className="border-4 border-indigo-900/60 p-8 rounded-xl text-center space-y-8 mb-12">
          
          <div className="flex justify-center items-center gap-6">
            <div className="h-16 w-16 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-indigo-900 font-display font-medium text-xs text-center p-2 leading-none">
              IDEAS TVET
            </div>
            <div className="h-16 w-px bg-slate-300"></div>
            <div className="h-16 w-16 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-800 font-display font-medium text-xs leading-none">
              UNIQUE TECH
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold font-mono text-indigo-600 uppercase tracking-widest leading-none">
              Official Photo Album Registry
            </p>
            <h1 className="font-display font-bold text-3xl text-indigo-950 tracking-tight leading-tight">
              IDEAS-TVET Program Beneficiary Album
            </h1>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              Federal Ministry of Education Innovation Grants for Digital Skills Training program. 
              Sector: Computer Hardware and Cell Phone Repairs.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 max-w-lg mx-auto grid grid-cols-2 gap-4 text-left text-xs text-slate-600 font-mono">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Academic Range</span>
              <span className="font-semibold text-slate-800">
                {filterBatch === "all" ? "All Active Batches" : filterBatch}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Origin State</span>
              <span className="font-semibold text-slate-800">
                {filterState === "all" ? "Federal Coverage" : filterState}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Enrolled</span>
              <span className="font-semibold text-slate-800">{displayList.length} Candidates</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Compliance Score</span>
              <span className="font-semibold text-slate-800">100% Biometric lock</span>
            </div>
          </div>

          {/* Verification stamp design layout */}
          <div className="flex justify-center gap-12 pt-6 items-center text-left">
            <div className="border border-indigo-200 p-3 bg-indigo-50/30 rounded-lg max-w-[200px] text-[10px] text-slate-500 font-mono">
              <p className="font-bold text-indigo-700 uppercase mb-1">STAMP CERTIFIED</p>
              <p>Unique Technology Nig. Ltd</p>
              <p>Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="border border-slate-200 p-3 bg-slate-100/50 rounded-lg max-w-[200px] text-[10px] text-slate-500 font-mono flex items-center gap-2">
              <div className="h-10 w-10 bg-slate-300 rounded flex items-center justify-center text-[8px] font-bold">QR VERIFY</div>
              <div>
                <p className="font-bold uppercase mb-0.5">UID Verified</p>
                <p>IDEAS-TVET-GOV</p>
              </div>
            </div>
          </div>

        </div>

        {/* PRINT PAGE BREAK */}
        <div className="print-page-break"></div>

        {/* ALBUM CARDS GRID */}
        <div>
          <div className="flex items-center justify-between border-b pb-1.5 mb-6 border-slate-200">
            <h2 className="font-display font-bold text-sm tracking-widest text-slate-700 uppercase">
              REGISTER CATALOG (Page 2)
            </h2>
            <span className="text-xs font-mono text-slate-400">Total Records: {displayList.length}</span>
          </div>

          <div className={`grid grid-cols-1 ${
            columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
          } gap-6`}>
            {displayList.map((b) => (
              <div key={b.id} className="border border-slate-200 rounded-lg p-3 flex flex-col justify-between text-center bg-slate-50/40 relative">
                
                {b.status === ProgramStatus.VERIFIED && (
                  <div className="absolute top-1.5 right-1.5 bg-emerald-100 text-emerald-700 font-bold text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5 shadow-xs">
                    <CheckCircle className="w-2.5 h-2.5" /> VERIFIED
                  </div>
                )}

                <div>
                  <img 
                    src={b.photo} 
                    alt="Portrait" 
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-3 border-2 border-slate-200"
                  />
                  
                  <p className="font-display font-semibold text-slate-800 text-xs tracking-tight line-clamp-1">
                    {b.lastName}, {b.firstName}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 font-mono">
                    ID: {b.id}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 text-[10px] text-slate-500 font-mono space-y-0.5">
                  <p className="truncate">NIN: {b.nin}</p>
                  <p className="truncate">BVN: {b.bvn}</p>
                  <p className="truncate font-semibold text-indigo-700 text-[8px] uppercase">{b.batch}</p>
                </div>

              </div>
            ))}
          </div>

          {displayList.length === 0 && (
            <div className="p-12 text-center text-slate-400 font-medium text-xs">
              No matching records to generate photo cards.
            </div>
          )}
        </div>

        {/* PRINT PAGE BREAK */}
        <div className="print-page-break"></div>

        {/* VERIFICATION SIGN-OFF SHEET SUMMARY (Always prints at final page) */}
        <div className="mt-12 pt-8 border-t-2 border-slate-200/60 grid grid-cols-2 gap-8 text-xs text-slate-500 font-mono">
          <div>
            <span className="font-bold text-slate-700 border-b pb-1 pr-10 mb-6 block uppercase tracking-wider">
              Prepared By:
            </span>
            <p className="font-bold text-slate-800">Super Administrator</p>
            <p>Unique Technology Nig. Ltd</p>
            <p>Ideals TVET Training Coordinator</p>
          </div>
          <div>
            <span className="font-bold text-slate-700 border-b pb-1 pr-10 mb-6 block uppercase tracking-wider">
              Approved By:
            </span>
            <p className="font-bold text-slate-800">Operations Manager</p>
            <p>Federal Ministry of Education Auditor</p>
            <p>Authorized Signature & Stamp</p>
          </div>
        </div>

      </div>

    </div>
  );
}
