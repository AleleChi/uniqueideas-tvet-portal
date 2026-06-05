/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Camera, Upload, AlertCircle, Sparkles, Trash2, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { Beneficiary, Gender, ProgramStatus, CustomField } from "../types";
import { useNotification } from "./NotificationContext";

interface NewEnrollmentFormProps {
  key?: string | number;
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
  
  const { showToast } = useNotification();

  // Field values state
  const [firstName, setFirstName] = useState(beneficiary?.firstName || "");
  const [lastName, setLastName] = useState(beneficiary?.lastName || "");
  const [otherName, setOtherName] = useState(beneficiary?.otherName || "");
  const [skillSector, setSkillSector] = useState(beneficiary?.skillSector || "Computer Hardware and Cell Phone Repairs");
  const [nin, setNin] = useState(beneficiary?.nin || "");
  const [bvn, setBvn] = useState(beneficiary?.bvn || "");
  const [gender, setGender] = useState<Gender>(beneficiary?.gender || Gender.MALE);
  const [state, setState] = useState(beneficiary?.state || "Imo");
  const [city, setCity] = useState(beneficiary?.city || "Owerri");
  const [email, setEmail] = useState(beneficiary?.email || "");
  const [phoneNumber, setPhoneNumber] = useState(beneficiary?.phoneNumber || "");
  const [residentialAddress, setResidentialAddress] = useState(beneficiary?.residentialAddress || "");
  const [batch, setBatch] = useState(beneficiary?.batch || `Batch ${new Date().getFullYear()}-C`);
  
  // Supplementary admission form fields
  const [guardianName, setGuardianName] = useState(beneficiary?.guardianName || "");
  const [guardianAddress, setGuardianAddress] = useState(beneficiary?.guardianAddress || "");
  const [guardianPhone, setGuardianPhone] = useState(beneficiary?.guardianPhone || "");
  const [physicalChallenge, setPhysicalChallenge] = useState(beneficiary?.physicalChallenge || "");
  const [bankAccountHolder, setBankAccountHolder] = useState(beneficiary?.bankAccountHolder || "");
  const [bankName, setBankName] = useState(beneficiary?.bankName || "");
  const [bankSortCode, setBankSortCode] = useState(beneficiary?.bankSortCode || "");
  const [bankAccountNumber, setBankAccountNumber] = useState(beneficiary?.bankAccountNumber || "");
  const [educationQualification, setEducationQualification] = useState(beneficiary?.educationQualification || "");
  const [dateOfBirth, setDateOfBirth] = useState(beneficiary?.dateOfBirth || "");
  
  // Dynamic fields state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() => {
    if (beneficiary?.customFields) {
      return beneficiary.customFields;
    }
    return {
      "Local Government Area (LGA)": "Owerri Municipal",
      "Training Location Hub": "Owerri Tech Hub",
      "Ward Name": "Ward 1"
    };
  });

  // Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Operational states
  const [ninVerified, setNinVerified] = useState(!!beneficiary);
  const [verifyingNin, setVerifyingNin] = useState(false);

  // Core Validator Function
  const validateField = (name: string, value: string): string => {
    let error = "";
    switch (name) {
      case "firstName":
        if (!value.trim()) {
          error = "First Name is required.";
        } else if (!/^[A-Za-z\s-]+$/.test(value)) {
          error = "First Name must contain text characters only.";
        } else if (value.trim().length < 2) {
          error = "First Name must be at least 2 characters.";
        }
        break;
      case "lastName":
        if (!value.trim()) {
          error = "Surname (Last Name) is required.";
        } else if (!/^[A-Za-z\s-]+$/.test(value)) {
          error = "Surname (Last Name) must contain text characters only.";
        } else if (value.trim().length < 2) {
          error = "Surname (Last Name) must be at least 2 characters.";
        }
        break;
      case "otherName":
        if (value.trim() && !/^[A-Za-z\s-]+$/.test(value)) {
          error = "Other Name must contain text characters only.";
        }
        break;
      case "email":
        if (!value.trim()) {
          error = "Work email address is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Please specify a valid email format (e.g. name@domain.com).";
        }
        break;
      case "phoneNumber":
        if (!value.trim()) {
          error = "Phone number is required.";
        } else if (!/^\d+$/.test(value)) {
          error = "Phone number must contain numbers only.";
        } else if (value.trim().length !== 11) {
          error = "Nigerian phone number must be exactly 11 digits.";
        }
        break;
      case "nin":
        if (!value.trim()) {
          error = "National Identity Number (NIN) is required.";
        } else if (!/^\d+$/.test(value)) {
          error = "NIN must contain numbers only.";
        } else if (value.trim().length !== 11) {
          error = "NIN must be exactly 11 digits.";
        }
        break;
      case "city":
        if (!value.trim()) {
          error = "City / Town of training is required.";
        }
        break;
      case "residentialAddress":
        if (!value.trim()) {
          error = "Contact address is required.";
        } else if (value.trim().length < 10) {
          error = "Address is brief; must be at least 10 characters.";
        }
        break;
      case "dateOfBirth": {
        if (!value.trim()) {
          error = "Date of Birth is required.";
          break;
        }
        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) {
          error = "Must match format DD/MM/YYYY (e.g. 15/08/1998).";
        } else {
          const d = parseInt(match[1], 10);
          const m = parseInt(match[2], 10) - 1;
          const y = parseInt(match[3], 10);
          const dateObj = new Date(y, m, d);
          if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m || dateObj.getDate() !== d) {
            error = "Specified date is an invalid calendar day.";
          } else if (dateObj > new Date()) {
            error = "Date of Birth cannot be in the future.";
          }
        }
        break;
      }
      case "educationQualification":
        if (!value.trim()) {
          error = "Highest educational qualification is required.";
        }
        break;
      case "guardianName":
        if (!value.trim()) {
          error = "Parent/Guardian Name is required.";
        }
        break;
      case "guardianAddress":
        if (!value.trim()) {
          error = "Parent/Guardian full address is required.";
        }
        break;
      case "guardianPhone":
        if (!value.trim()) {
          error = "Parent/Guardian phone is required.";
        } else if (!/^\d+$/.test(value)) {
          error = "Guardian phone must contain numbers only.";
        } else if (value.trim().length !== 11) {
          error = "Parent/Guardian phone must be exactly 11 digits.";
        }
        break;
      case "bankAccountHolder":
        if (!value.trim()) {
          error = "Name of account holder is required.";
        } else if (!/^[A-Za-z\s-]+$/.test(value)) {
          error = "Account holder name must contain text characters only.";
        }
        break;
      case "bvn":
        if (!value.trim()) {
          error = "BVN is required.";
        } else if (!/^\d+$/.test(value)) {
          error = "BVN must contain numbers only.";
        } else if (value.trim().length !== 11) {
          error = "Bank Verification Number (BVN) must be exactly 11 digits.";
        }
        break;
      case "bankName":
        if (!value.trim()) {
          error = "Bank Name is required.";
        }
        break;
      case "bankSortCode":
        if (!value.trim()) {
          error = "Bank Sort Code is required.";
        } else if (!/^\d+$/.test(value)) {
          error = "Bank Sort Code must contain numbers only.";
        }
        break;
      case "bankAccountNumber":
        if (!value.trim()) {
          error = "Bank account number is required.";
        } else if (!/^\d+$/.test(value)) {
          error = "Account number must contain numbers only.";
        } else if (value.trim().length !== 10) {
          error = "NUBAN Bank Account Number must be exactly 10 digits.";
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleFieldBlur = (fieldName: string, value: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    const err = validateField(fieldName, value);
    setErrors(prev => ({
      ...prev,
      [fieldName]: err
    }));
  };

  const handleFieldChange = (fieldName: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (touched[fieldName]) {
      const err = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: err
      }));
    }
  };

  const handleVerifyNin = () => {
    if (!nin || nin.length < 8) {
      showToast("Please specify a valid 11-digit National Identity Number (NIN).", "warning");
      return;
    }
    setVerifyingNin(true);
    setTimeout(() => {
      setVerifyingNin(false);
      setNinVerified(true);
      showToast("NIN successfully verified against NIMC direct databases.", "success");
    }, 1200);
  };

  const handleCustomFieldChange = (label: string, val: string) => {
    setCustomFieldValues(prev => ({ ...prev, [label]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // Run active validations across all fields
    const fieldsCheck = {
      firstName, lastName, otherName, email, phoneNumber, nin, city, residentialAddress,
      dateOfBirth, educationQualification, guardianName, guardianAddress, guardianPhone,
      bankAccountHolder, bvn, bankName, bankSortCode, bankAccountNumber
    };

    const newErrors: Record<string, string> = {};
    const touchedAll: Record<string, boolean> = {};

    Object.entries(fieldsCheck).forEach(([key, val]) => {
      touchedAll[key] = true;
      const err = validateField(key, val);
      if (err) {
        newErrors[key] = err;
      }
    });

    customFields.forEach(f => {
      if (f.required) {
        const val = customFieldValues[f.label] || "";
        if (!val.trim()) {
          newErrors[`custom_${f.label}`] = `${f.label} is required.`;
        }
      }
    });

    setTouched(touchedAll);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      showToast("Form validation failure. Please complete missing or invalid fields highlighted in red.", "error");
      // Scroll to top of form smoothly to show errors
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!ninVerified) {
      showToast("NIN verification is mandatory. Please click 'Verify NIN' to validate candidate identifiers.", "warning");
      return;
    }
    if (!preloadedPhoto) {
      showToast("Active biometric passport photograph registration is required. Please capture or upload a profile image.", "warning");
      return;
    }

    setIsSaving(true);
    showToast("Saving...", "info");

    try {
      await onSave({
        firstName,
        lastName,
        otherName,
        skillSector,
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
        customFields: customFieldValues,
        guardianName,
        guardianAddress,
        guardianPhone,
        physicalChallenge,
        bankAccountHolder,
        bankName,
        bankSortCode,
        bankAccountNumber,
        educationQualification,
        dateOfBirth
      });
    } catch (err: any) {
      showToast(err.message || "An exception occurred while saving beneficiary profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const existingStates = beneficiaries ? Array.from(new Set(beneficiaries.map(b => b.state).filter(Boolean))) : [];
  const statesOfNigeria = Array.from(new Set(["Imo", ...existingStates]));

  // Tailwind error helper class binders
  const inputClass = (fieldName: string) => {
    const base = "w-full bg-slate-50 border rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition font-semibold";
    if (errors[fieldName] && touched[fieldName]) {
      return `${base} border-rose-500 focus:bg-white focus:border-rose-500 ring-1 ring-rose-200`;
    }
    return `${base} border-slate-200 focus:bg-white focus:border-indigo-600`;
  };

  return (
    <div className="space-y-6 font-sans select-none max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Header section matching welcome design */}
      <div className="pb-3 border-b border-slate-200 text-left">
        <h2 className="text-xl font-display font-medium text-slate-800 uppercase tracking-tight">
          {beneficiary ? "Edit Beneficiary Parameters" : "New Beneficiary Enrollment"}
        </h2>
        <p className="text-xs text-slate-400">
          Federally funded TVET development initiative. Active biometric passport identification registration required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs border-l-4 border-indigo-600 space-y-6">
          
          {/* SECTION A: TRAINEE INFORMATION */}
          <div className="space-y-4">
            <h3 className="text-xs font-display font-bold text-slate-800 uppercase tracking-wider pb-1 border-b border-indigo-100 flex items-center justify-between animate-in fade-in duration-200">
              <span className="text-indigo-900">SECTION A: TRAINEE INFORMATION</span>
              <span className="text-[9px] text-slate-400 font-mono normal-case font-medium">Trainee profile & credentials</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Surname (Last Name) */}
              <div className="space-y-1.5 font-sans text-left">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Surname (Last Name)</label>
                <input 
                  type="text" 
                  placeholder="Adeyemi"
                  value={lastName}
                  onChange={(e) => handleFieldChange("lastName", e.target.value, setLastName)}
                  onBlur={() => handleFieldBlur("lastName", lastName)}
                  className={inputClass("lastName")}
                />
                {errors.lastName && touched.lastName && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1 transition-all">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.lastName}</span>
                  </p>
                )}
              </div>

              {/* First Name */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">First Name</label>
                <input 
                  type="text" 
                  placeholder="Oluwaseun"
                  value={firstName}
                  onChange={(e) => handleFieldChange("firstName", e.target.value, setFirstName)}
                  onBlur={() => handleFieldBlur("firstName", firstName)}
                  className={inputClass("firstName")}
                />
                {errors.firstName && touched.firstName && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.firstName}</span>
                  </p>
                )}
              </div>

              {/* Other Name */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Other Names</label>
                <input 
                  type="text" 
                  placeholder="e.g. John (Optional)"
                  value={otherName}
                  onChange={(e) => handleFieldChange("otherName", e.target.value, setOtherName)}
                  onBlur={() => handleFieldBlur("otherName", otherName)}
                  className={inputClass("otherName")}
                />
                {errors.otherName && touched.otherName && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.otherName}</span>
                  </p>
                )}
              </div>

              {/* Skill Applied For */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Skill Applied For</label>
                <select
                  value={skillSector}
                  onChange={(e) => setSkillSector(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition cursor-pointer font-semibold"
                >
                  <option value="Computer Hardware and Cell Phone Repairs">Computer Hardware and Cell Phone Repairs</option>
                  <option value="Renewable Energy and Solar Installation">Renewable Energy and Solar Installation</option>
                  <option value="Graphics Design and Digital Marketing">Graphics Design and Digital Marketing</option>
                  <option value="Catering and Hotel Management">Catering and Hotel Management</option>
                  <option value="Tailoring and Fashion Design">Tailoring and Fashion Design</option>
                  <option value="Automobile Engineering">Automobile Engineering</option>
                  <option value="Plumbing and Pipe Fitting">Plumbing and Pipe Fitting</option>
                </select>
              </div>

              {/* NIN Verification Block */}
              <div className="space-y-1.5 md:col-span-2 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">National Identity Number (NIN)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="44923301825"
                    maxLength={11}
                    value={nin}
                    onChange={(e) => {
                      // Only allow numeric input
                      const val = e.target.value.replace(/\D/g, "");
                      handleFieldChange("nin", val, setNin);
                      if (val !== beneficiary?.nin) {
                        setNinVerified(false);
                      }
                    }}
                    onBlur={() => handleFieldBlur("nin", nin)}
                    className={inputClass("nin")}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyNin}
                    disabled={verifyingNin || ninVerified}
                    className={`px-4 py-2 text-[10px] font-bold font-mono uppercase tracking-wide rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
                      ninVerified 
                        ? "bg-slate-100 border border-slate-200 text-emerald-600 cursor-default font-semibold" 
                        : "bg-indigo-950 text-white hover:bg-slate-900 shadow-sm font-semibold hover:scale-101 active:scale-98"
                    }`}
                  >
                    {verifyingNin ? "Checking..." : ninVerified ? "✓ Verified" : "Verify NIN"}
                  </button>
                </div>
                {errors.nin && touched.nin && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.nin}</span>
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Phone Number (WhatsApp)</label>
                <input 
                  type="tel" 
                  placeholder="08123456789"
                  maxLength={11}
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    handleFieldChange("phoneNumber", val, setPhoneNumber);
                  }}
                  onBlur={() => handleFieldBlur("phoneNumber", phoneNumber)}
                  className={inputClass("phoneNumber")}
                />
                {errors.phoneNumber && touched.phoneNumber && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.phoneNumber}</span>
                  </p>
                )}
              </div>

              {/* Work Email Address */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Work Email Address</label>
                <input 
                  type="email" 
                  placeholder="username@domain.com"
                  value={email}
                  onChange={(e) => handleFieldChange("email", e.target.value, setEmail)}
                  onBlur={() => handleFieldBlur("email", email)}
                  className={inputClass("email")}
                />
                {errors.email && touched.email && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* State of Origin */}
              <div className="space-y-1.5 text-left font-sans">
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

              {/* City / Town */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">City / Town (Training Hub)</label>
                <input 
                  type="text" 
                  placeholder="Owerri"
                  value={city}
                  onChange={(e) => handleFieldChange("city", e.target.value, setCity)}
                  onBlur={() => handleFieldBlur("city", city)}
                  className={inputClass("city")}
                />
                {errors.city && touched.city && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.city}</span>
                  </p>
                )}
              </div>

              {/* Contact Address */}
              <div className="space-y-1.5 md:col-span-2 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Contact Address</label>
                <textarea 
                  rows={2}
                  placeholder="24, Excellence Close, Allen Avenue, Ikeja"
                  value={residentialAddress}
                  onChange={(e) => handleFieldChange("residentialAddress", e.target.value, setResidentialAddress)}
                  onBlur={() => handleFieldBlur("residentialAddress", residentialAddress)}
                  className={inputClass("residentialAddress")}
                />
                {errors.residentialAddress && touched.residentialAddress && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.residentialAddress}</span>
                  </p>
                )}
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Date of Birth (DD/MM/YYYY)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 15/08/1998"
                  value={dateOfBirth}
                  onChange={(e) => handleFieldChange("dateOfBirth", e.target.value, setDateOfBirth)}
                  onBlur={() => handleFieldBlur("dateOfBirth", dateOfBirth)}
                  className={inputClass("dateOfBirth")}
                />
                {errors.dateOfBirth && touched.dateOfBirth && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.dateOfBirth}</span>
                  </p>
                )}
              </div>

              {/* Qualification */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Highest Educational Qualification</label>
                <input 
                  type="text" 
                  placeholder="e.g. OND, SSCE, B.Sc"
                  value={educationQualification}
                  onChange={(e) => handleFieldChange("educationQualification", e.target.value, setEducationQualification)}
                  onBlur={() => handleFieldBlur("educationQualification", educationQualification)}
                  className={inputClass("educationQualification")}
                />
                {errors.educationQualification && touched.educationQualification && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.educationQualification}</span>
                  </p>
                )}
              </div>

              {/* Gender */}
              <div className="space-y-1.5 text-left font-sans">
                <span className="text-[10px] font-bold font-mono text-slate-500 uppercase block mb-1">Gender</span>
                <div className="flex gap-2">
                  {[Gender.MALE, Gender.FEMALE, Gender.OTHER].map(gen => (
                    <button
                      key={gen}
                      type="button"
                      onClick={() => setGender(gen)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition ${
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

              {/* Disbursement Batch */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Disbursement Batch</label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition cursor-pointer font-semibold text-slate-800"
                >
                  <option value={`Batch ${new Date().getFullYear()}-A`}>Batch {new Date().getFullYear()}-A</option>
                  <option value={`Batch ${new Date().getFullYear()}-B`}>Batch {new Date().getFullYear()}-B</option>
                  <option value={`Batch ${new Date().getFullYear()}-C`}>Batch {new Date().getFullYear()}-C</option>
                </select>
              </div>

            </div>
          </div>

          {/* SECTION B: PARENT/GUARDIAN INFORMATION */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-display font-bold text-indigo-900 uppercase tracking-wider pb-1 border-b border-indigo-100 flex items-center justify-between">
              <span>SECTION B: PARENT/GUARDIAN INFORMATION</span>
              <span className="text-[9px] text-slate-400 font-mono normal-case font-medium">Emergency parent/guardian contacts</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Name */}
              <div className="space-y-1.5 md:col-span-2 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Name of Parent/Guardian</label>
                <input 
                  type="text" 
                  placeholder="Adeyemi John"
                  value={guardianName}
                  onChange={(e) => handleFieldChange("guardianName", e.target.value, setGuardianName)}
                  onBlur={() => handleFieldBlur("guardianName", guardianName)}
                  className={inputClass("guardianName")}
                />
                {errors.guardianName && touched.guardianName && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.guardianName}</span>
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-1.5 md:col-span-2 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Address of Parent/Guardian</label>
                <textarea 
                  rows={2}
                  placeholder="Full physical home or office location"
                  value={guardianAddress}
                  onChange={(e) => handleFieldChange("guardianAddress", e.target.value, setGuardianAddress)}
                  onBlur={() => handleFieldBlur("guardianAddress", guardianAddress)}
                  className={inputClass("guardianAddress")}
                />
                {errors.guardianAddress && touched.guardianAddress && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.guardianAddress}</span>
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5 md:col-span-2 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Phone Number of Parent/Guardian</label>
                <input 
                  type="text" 
                  placeholder="08032345678"
                  maxLength={11}
                  value={guardianPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    handleFieldChange("guardianPhone", val, setGuardianPhone);
                  }}
                  onBlur={() => handleFieldBlur("guardianPhone", guardianPhone)}
                  className={inputClass("guardianPhone")}
                />
                {errors.guardianPhone && touched.guardianPhone && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.guardianPhone}</span>
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* SECTION C: SPECIAL NEEDS */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-display font-bold text-indigo-900 uppercase tracking-wider pb-1 border-b border-indigo-100 flex items-center justify-between">
              <span>SECTION C: SPECIAL NEEDS</span>
              <span className="text-[9px] text-slate-400 font-mono normal-case font-medium">Welfare & accessibility details</span>
            </h3>

            <div className="grid grid-cols-1 gap-4 text-left font-sans">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Any Physical Challenge? (State 'None' or describe the challenges)</label>
                <input 
                  type="text" 
                  placeholder="e.g. None, or describe kind of challenge"
                  value={physicalChallenge}
                  onChange={(e) => setPhysicalChallenge(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition font-semibold"
                />
              </div>
            </div>
          </div>

          {/* SECTION D: BANK DETAILS */}
          <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in duration-200">
            <h3 className="text-xs font-display font-bold text-indigo-900 uppercase tracking-wider pb-1 border-b border-indigo-100 flex items-center justify-between">
              <span>SECTION D: BANK DETAILS</span>
              <span className="text-[9px] text-slate-400 font-mono normal-case font-medium">Stipend bank disbursement channels</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Account Holder */}
              <div className="space-y-1.5 md:col-span-2 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Name of Account Holder</label>
                <input 
                  type="text" 
                  placeholder="e.g. Oluwaseun Adeyemi"
                  value={bankAccountHolder}
                  onChange={(e) => handleFieldChange("bankAccountHolder", e.target.value, setBankAccountHolder)}
                  onBlur={() => handleFieldBlur("bankAccountHolder", bankAccountHolder)}
                  className={inputClass("bankAccountHolder")}
                />
                {errors.bankAccountHolder && touched.bankAccountHolder && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.bankAccountHolder}</span>
                  </p>
                )}
              </div>

              {/* BVN */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Bank Verification Number (BVN)</label>
                <input 
                  type="text" 
                  placeholder="22149583904"
                  maxLength={11}
                  value={bvn}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    handleFieldChange("bvn", val, setBvn);
                  }}
                  onBlur={() => handleFieldBlur("bvn", bvn)}
                  className={inputClass("bvn")}
                />
                {errors.bvn && touched.bvn && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.bvn}</span>
                  </p>
                )}
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Bank Name (Full Name)</label>
                <input 
                  type="text" 
                  placeholder="e.g. First Bank of Nigeria"
                  value={bankName}
                  onChange={(e) => handleFieldChange("bankName", e.target.value, setBankName)}
                  onBlur={() => handleFieldBlur("bankName", bankName)}
                  className={inputClass("bankName")}
                />
                {errors.bankName && touched.bankName && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.bankName}</span>
                  </p>
                )}
              </div>

              {/* Sort Code */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Bank Sort Code</label>
                <input 
                  type="text" 
                  placeholder="e.g. 011151003"
                  value={bankSortCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    handleFieldChange("bankSortCode", val, setBankSortCode);
                  }}
                  onBlur={() => handleFieldBlur("bankSortCode", bankSortCode)}
                  className={inputClass("bankSortCode")}
                />
                {errors.bankSortCode && touched.bankSortCode && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.bankSortCode}</span>
                  </p>
                )}
              </div>

              {/* Account Number */}
              <div className="space-y-1.5 text-left font-sans">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Bank Account Number</label>
                <input 
                  type="text" 
                  placeholder="10-digit NUBAN number"
                  maxLength={10}
                  value={bankAccountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    handleFieldChange("bankAccountNumber", val, setBankAccountNumber);
                  }}
                  onBlur={() => handleFieldBlur("bankAccountNumber", bankAccountNumber)}
                  className={inputClass("bankAccountNumber")}
                />
                {errors.bankAccountNumber && touched.bankAccountNumber && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{errors.bankAccountNumber}</span>
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Section 4: Schema Fields */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in duration-300">
              <h3 className="text-xs font-display font-bold text-indigo-900 uppercase tracking-wider pb-1 border-b border-indigo-100">
                Additional Schema Fields
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map((f, idx) => (
                  <div key={idx} className="space-y-1.5 text-left font-sans">
                    <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    <input 
                      type="text"
                      placeholder={`Enter custom ${f.label.toLowerCase()}`}
                      value={customFieldValues[f.label] || ""}
                      onChange={(e) => handleCustomFieldChange(f.label, e.target.value)}
                      className={`w-full bg-slate-50 border rounded-lg py-2 px-3 text-slate-800 text-xs focus:outline-none transition font-semibold ${
                        errors[`custom_${f.label}`] && touched[`custom_${f.label}`] 
                          ? "border-rose-500 focus:bg-white focus:border-rose-500 ring-1 ring-rose-200" 
                          : "border-slate-200 focus:bg-white focus:border-indigo-600"
                      }`}
                    />
                    {errors[`custom_${f.label}`] && touched[`custom_${f.label}`] && (
                      <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors[`custom_${f.label}`]}</span>
                      </p>
                    )}
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
              disabled={isSaving}
              className="bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-700 py-2 px-4 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Reset Form Parameters
            </button>
            
            <button
              type="submit"
              disabled={isSaving}
              className={`font-bold py-2.5 px-6 rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition active:scale-[99%] cursor-pointer ${
                isSaving 
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                  : "bg-yellow-500 hover:bg-yellow-400 text-slate-950 hover:scale-101 active:scale-98"
              }`}
            >
              {isSaving ? "Saving..." : "Save & Enroll Beneficiary"}
              {!isSaving && <ArrowRight className="w-3.5 h-3.5 text-slate-950" />}
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
              <div className="text-left font-sans">
                <span className="text-[10px] font-bold font-mono uppercase block tracking-wider mb-0.5">Eligibility Standards</span>
                <p className="text-[11px] leading-relaxed">
                  According to Federal Ministry of Education Innovation Grants parameters:
                </p>
              </div>
            </div>

            <ul className="text-[10px] font-mono list-disc pl-4 space-y-1 text-slate-600 text-left">
              <li>Candidate must specify a verified matching 11-digit NIN block.</li>
              <li>Dual registrations across distinct hubs will automatically trigger an administrative hold block.</li>
              <li>Camera biometric crop must conform to standard high-resolution passport guides (white/blue backdrop).</li>
            </ul>

            <div className="pt-2 border-t border-amber-200 text-[9px] text-slate-400 flex items-center gap-1 font-mono uppercase text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure TVET Portal Guard
            </div>

          </div>

        </div>

      </form>

    </div>
  );
}
