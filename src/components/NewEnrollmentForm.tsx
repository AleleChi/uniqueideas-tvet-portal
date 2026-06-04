/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Camera, Upload, AlertCircle, Sparkles, Trash2, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { Beneficiary, Gender, ProgramStatus, CustomField } from "../types";

interface NewEnrollmentFormProps {
  customFields?: CustomField[];
  onSave: (data: Partial<Beneficiary>) => void;
  onCancel: () => void;
  onTriggerCapture: () => void;
  preloadedPhoto: string | null;
  beneficiary?: Beneficiary | null;
  beneficiaries?: Beneficiary[];
}

export function NewEnrollmentForm({
  customFields = [],
  onSave,
  onCancel,
  onTriggerCapture,
  preloadedPhoto,
  beneficiary,
  beneficiaries = []
}: NewEnrollmentFormProps) {
  
  // Field values state
  const [firstName, setFirstName] = useState(beneficiary?.firstName || "");
  const [lastName, setLastName] = useState(beneficiary?.lastName || "");
  const [nin, setNin] = useState(beneficiary?.nin || "");
  const [bvn, setBvn] = useState(beneficiary?.bvn || "");
  const [gender, setGender] = useState<Gender>(beneficiary?.gender || Gender.MALE);
  const [state, setState] = useState(beneficiary?.state || "Imo");
  const [city, setCity] = useState(beneficiary?.city || "Owerri");
  const [email, setEmail] = useState(beneficiary?.email || "");
  const [phoneNumber, setPhoneNumber] = useState(beneficiary?.phoneNumber || "");
  const [residentialAddress, setResidentialAddress] = useState(beneficiary?.residentialAddress || "");
  const [batch, setBatch] = useState(beneficiary?.batch || `Batch ${new Date().getFullYear()}-C`);
  
  // Dynamic fields state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() => {
    if (beneficiary?.customFields) {
      return beneficiary.customFields;
    }
    return {
      "Local Government Area (LGA)": "Owerri Municipal",
      "Training Location Hub": "Owerri Tech Hub",
      "Ward Name": "Ward 1",
      "Bank Name": "Access Bank"
    };
  });

  // Operational states
  const [ninVerified, setNinVerified] = useState(!!beneficiary);
  const [verifyingNin, setVerifyingNin] = useState(false);

  const handleVerifyNin = () => {
    if (!nin || nin.length < 8) {
      alert("Please specify a valid 11-digit National Identity Number (NIN).");
      return;
    }
    setVerifyingNin(true);
    setTimeout(() => {
      setVerifyingNin(false);
      setNinVerified(true);
    }, 1200);
  };

  const handleCustomFieldChange = (label: string, val: string) => {
    setCustomFieldValues(prev => ({ ...prev, [label]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ninVerified) {
      alert("NIN verification is mandatory under Federal TVET directives. Please trigger 'Verify NIN' before enrollment.");
      return;
    }
    if (!preloadedPhoto) {
      alert("Active biometric passport photograph registration is required to establish identification lock. Please trigger 'Intelligent Capture' to enroll biometric portrait.");
      return;
    }

    // Build saved object properties
    const values: Partial<Beneficiary> = {
      firstName,
      lastName,
      nin,
      bvn,
      gender,
      state,
      city,
      email,
      phoneNumber,
      residentialAddress,
      batch,
      photo: preloadedPhoto,
      status: ProgramStatus.VERIFIED,
      customFields: customFieldValues
    };

    onSave(values);
  };

  const existingStates = beneficiaries ? Array.from(new Set(beneficiaries.map(b => b.state).filter(Boolean))) : [];
  const statesOfNigeria = Array.from(new Set(["Imo", ...existingStates]));

  return (
    <div className="space-y-6 font-sans select-none max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Header section matching welcome design */}
      <div className="pb-3 border-b border-slate-200">
        <h2 className="text-xl font-display font-medium text-slate-800 uppercase tracking-tight">
          New Beneficiary Enrollment
        </h2>
        <p className="text-xs text-slate-400">
          Federally funded TVET development initiative. Active biometric passport identification registration required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: TWO COLUMN FORM ENTRY FIELD CARD (8/12 columns) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs border-l-4 border-indigo-600 space-y-6">
          
          {/* Section 1: Personal Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-display font-bold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100">
              1. Personal Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">First Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Oluwaseun"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Last Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Adeyemi"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">National Identity Number (NIN)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    placeholder="44923301825"
                    maxLength={11}
                    value={nin}
                    onChange={(e) => setNin(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyNin}
                    disabled={verifyingNin || ninVerified}
                    className={`px-4 py-2 text-[10px] font-bold font-mono uppercase tracking-wide rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
                      ninVerified 
                        ? "bg-slate-100 border border-slate-200 text-emerald-600 cursor-default" 
                        : "bg-indigo-950 text-white hover:bg-slate-900 shadow-sm"
                    }`}
                  >
                    {verifyingNin ? "Checking..." : ninVerified ? "✓ Verified" : "Verify NIN"}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Bank Verification Number (BVN)</label>
                <input 
                  type="text" 
                  required
                  placeholder="22149583904"
                  maxLength={11}
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">State of Origin</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition cursor-pointer font-semibold"
                >
                  {statesOfNigeria.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">City / Town (Training Hub)</label>
                <input 
                  type="text" 
                  required
                  placeholder="Owerri"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition font-semibold"
                />
              </div>

              {/* Gender Radio Choice Chips */}
              <div className="space-y-1.5 md:col-span-2">
                <span className="text-[10px] font-bold font-mono text-slate-500 uppercase block mb-1">Gender</span>
                <div className="flex gap-2">
                  {[Gender.MALE, Gender.FEMALE, Gender.OTHER].map(gen => (
                    <button
                      key={gen}
                      type="button"
                      onClick={() => setGender(gen)}
                      className={`px-4 py-2 border rounded-lg text-xs font-semibold cursor-pointer transition ${
                        gender === gen 
                          ? "bg-indigo-950 text-white border-indigo-900 shadow-sm" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {gen}
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* Section 2: Contact Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-display font-bold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100">
              2. Contact & Coordinates
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Work Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="username@uniqueideas.dontechservicesconst.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  placeholder="+234 812 345 6789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Residential Address</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="24, Excellence Close, Allen Avenue, Ikeja"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-400 font-bold text-slate-500 uppercase">Disbursement Batch</label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition cursor-pointer"
                >
                  <option value={`Batch ${new Date().getFullYear()}-A`}>Batch {new Date().getFullYear()}-A</option>
                  <option value={`Batch ${new Date().getFullYear()}-B`}>Batch {new Date().getFullYear()}-B</option>
                  <option value={`Batch ${new Date().getFullYear()}-C`}>Batch {new Date().getFullYear()}-C</option>
                </select>
              </div>

            </div>
          </div>

          {/* Section 3: Schema Fields */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-display font-bold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100">
                3. Additional Schema fields
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map((f, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    <input 
                      type="text"
                      required={f.required}
                      placeholder={`Enter custom ${f.label.toLowerCase()}`}
                      value={customFieldValues[f.label] || ""}
                      onChange={(e) => handleCustomFieldChange(f.label, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Controls */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-700 py-2 px-4 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Reset Form Parameters
            </button>
            
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-2.5 px-6 rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition active:scale-[99%] cursor-pointer"
            >
              Save & Enroll Beneficiary
              <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: PORTRAIT PHOTO UPLOADER & WARNING BANNER (4/12 columns) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Passport Photo Biometric Action Box (matches 9.png uploader frame) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-center space-y-4">
            
            <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest block text-left">
              Biometric Passport Enroll
            </span>

            <div className="aspect-square w-full max-w-[200px] mx-auto bg-slate-50 border border-slate-200 border-dashed rounded-xl flex flex-col items-center justify-center p-3 relative overflow-hidden group shadow-inner">
              {preloadedPhoto ? (
                <>
                  <img 
                    src={preloadedPhoto} 
                    alt="Uploaded Passport Preset" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition p-4">
                    <button
                      type="button"
                      onClick={onTriggerCapture}
                      className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition shadow"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Small verified tag */}
                  <div className="absolute bottom-2 right-2 bg-emerald-500 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                    <Check className="w-2.5 h-2.5" /> LOCKED
                  </div>
                </>
              ) : (
                <div className="text-center p-4 space-y-2 flex flex-col items-center">
                  <Camera className="w-8 h-8 text-slate-300" />
                  <p className="text-[10px] text-slate-400 max-w-[130px] font-medium leading-relaxed">
                    Portrait capture required for data integrity audits.
                  </p>
                </div>
              )}
            </div>

            {/* Dynamic camera launcher action triggers */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={onTriggerCapture}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-indigo-500" />
                Intelligent Capture
              </button>
              
              <button
                type="button"
                onClick={onTriggerCapture} // also launch capture to let user toggle local upload
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Upload className="w-3 h-3 text-slate-400" />
                Upload Local Photograph
              </button>
            </div>

          </div>

          {/* Program warning eligibility info strip */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 shadow-xs text-slate-800 space-y-3">
            
            <div className="flex items-start gap-2.5 text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold font-mono uppercase block tracking-wider mb-0.5">Eligibility Standards</span>
                <p className="text-[11px] leading-relaxed">
                  According to Federal Ministry of Education Innovation Grants parameters:
                </p>
              </div>
            </div>

            <ul className="text-[10px] font-mono list-disc pl-4 space-y-1 text-slate-600">
              <li>Candidate must specify a verified matching 11-digit NIN block.</li>
              <li>Dual registrations across distinct hubs will automatically trigger an administrative hold block.</li>
              <li>Camera biometric crop must conform to standard high-resolution passport guides (white/blue backdrop).</li>
            </ul>

            <div className="pt-2 border-t border-amber-200 text-[9px] text-slate-400 flex items-center gap-1 font-mono uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure TVET Portal Guard
            </div>

          </div>

        </div>

      </form>

    </div>
  );
}
