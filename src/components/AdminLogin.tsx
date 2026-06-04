/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Landmark, Mail, Lock, Eye, EyeOff, ShieldCheck, HelpCircle, ArrowRight, RefreshCw, KeyRound, CheckCircle2 } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: (email: string, pass: string) => Promise<boolean>;
  onBackToHome?: () => void;
}

type FormState = "LOGIN" | "FORGOT" | "RESET";

export function AdminLogin({ onLoginSuccess, onBackToHome }: AdminLoginProps) {
  const [formState, setFormState] = useState<FormState>("LOGIN");
  const [email, setEmail] = useState("admin@uniqueideas.dontechservicesconst.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Forgot password & reset fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [devTokenHint, setDevTokenHint] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const success = await onLoginSuccess(email, password);
      if (!success) {
        setError("System credentials validation failed. Please check your password or verification parameters.");
      }
    } catch (err: any) {
      setError(err.message || "An authentication server transaction timeout occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`A secure recovery link has been dispatched to ${forgotEmail}.`);
        if (data.resetToken) {
          setDevTokenHint(data.resetToken);
          setResetToken(data.resetToken); // Pre-fill token for instant sandbox validation!
        }
      } else {
        setError(data.error || "Failed to initiate password recovery.");
      }
    } catch (err: any) {
      setError("Server failed to respond to recovery dispatch request.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Success! Your password was updated. Please sign in now with your new credentials.");
        setFormState("LOGIN");
        // Update credentials fields to help testing
        setPassword(newPassword);
        if (forgotEmail) {
          setEmail(forgotEmail);
        }
      } else {
        setError(data.error || "The supplied password update parameters are invalid or expired.");
      }
    } catch (err: any) {
      setError("Network error submitting password reset payload.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 relative font-sans overflow-x-hidden select-none">
      
      {/* Top offset decoration empty spacing to center card */}
      <div className="flex-grow flex items-center justify-center py-12">
        <div 
          id="login-container-card"
          className="w-full max-w-lg bg-white border border-slate-200/80 rounded-2xl shadow-xl p-5 sm:p-8 md:p-10 relative border-l-4 border-yellow-500 flex flex-col space-y-6"
        >
          
          {/* Institutional Branding Header Section */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-14 w-14 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-900 shadow-xs mb-1">
              <Landmark className="w-7 h-7" />
            </div>
            
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-950 font-mono uppercase tracking-widest leading-none block">
                IDEAS-TVET Program Portal
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Unique Technology Nig. Ltd
              </span>
            </div>

            {formState === "LOGIN" && (
              <>
                <h1 className="font-display text-slate-900 text-3xl font-extrabold tracking-tight mt-3">
                  System Login
                </h1>
                <p className="text-xs text-slate-500 leading-normal max-w-sm">
                  Access the National Beneficiary & Admission Management System.
                </p>
              </>
            )}

            {formState === "FORGOT" && (
              <>
                <h1 className="font-display text-slate-900 text-3xl font-extrabold tracking-tight mt-3">
                  Reset Password
                </h1>
                <p className="text-xs text-slate-500 leading-normal max-w-sm">
                  Type your signed email address to fetch a secure challenge tokens token.
                </p>
              </>
            )}

            {formState === "RESET" && (
              <>
                <h1 className="font-display text-slate-900 text-3xl font-extrabold tracking-tight mt-3">
                  Credential Challenge
                </h1>
                <p className="text-xs text-slate-500 leading-normal max-w-sm">
                  Complete your password update using the challenge token.
                </p>
              </>
            )}
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-100 p-3.5 rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 p-3.5 rounded-lg flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
              {devTokenHint && (
                <div className="mt-2 bg-white/70 border border-emerald-200 p-2.5 rounded-md font-mono text-[10px] text-indigo-900 break-all select-all text-left">
                  <span className="font-bold block uppercase text-[8.5px] text-slate-500 tracking-wider mb-1">Sandbox Simulation Token Payload</span>
                  CODE: <span className="font-bold underline text-slate-800 text-[11px] font-mono">{devTokenHint}</span>
                </div>
              )}
            </div>
          )}

          {/* FORM: LOGIN */}
          {formState === "LOGIN" && (
            <form onSubmit={handleSubmitLogin} className="space-y-5">
              <div className="space-y-1.5 text-left">
                <label 
                  htmlFor="email-address-input"
                  className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider text-left"
                >
                  Account Work Email
                </label>
                <div className="relative">
                  <input 
                    id="email-address-input"
                    type="email"
                    required
                    placeholder="name@uniqueideas.dontechservicesconst.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 text-sm transition"
                  />
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="password-input"
                    className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider text-left"
                  >
                    Secret Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessMsg(null);
                      setError(null);
                      setFormState("FORGOT");
                    }}
                    className="text-[10px] text-indigo-600 font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                
                <div className="relative">
                  <input 
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 text-sm transition"
                  />
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 select-none bg-transparent border-none p-0"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-950 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-xs shadow-md transition active:scale-[99%] cursor-pointer"
              >
                {isLoading ? "Validating Security Session..." : "Secure Access Portal"}
                {!isLoading && <ArrowRight className="w-4 h-4 text-white/95" />}
              </button>

              {onBackToHome && (
                <button 
                  type="button"
                  onClick={onBackToHome}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs transition active:scale-[99%] cursor-pointer border border-slate-200/65"
                >
                  Return to National Portal
                </button>
              )}
            </form>
          )}

          {/* FORM: FORGOT PASSWORD */}
          {formState === "FORGOT" && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1.5 text-left">
                <label 
                  htmlFor="forgot-email-input"
                  className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider text-left"
                >
                  Verify Linked Email Address
                </label>
                <div className="relative">
                  <input 
                    id="forgot-email-input"
                    type="email"
                    required
                    placeholder="trainee@uniqueideas.dontechservicesconst.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 text-sm transition font-medium"
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setFormState("LOGIN");
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-250 text-slate-700 py-3 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Back to Login
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-indigo-950 hover:bg-indigo-900 justify-center disabled:opacity-50 text-white font-bold py-3 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  <span>{isLoading ? "Dispatching..." : "Send Token"}</span>
                </button>
              </div>

              {devTokenHint && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setFormState("RESET");
                    }}
                    className="text-xs text-indigo-700 font-bold hover:underline bg-slate-100 px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Click to challenge reset screen
                  </button>
                </div>
              )}
            </form>
          )}

          {/* FORM: RESET PASSWORD CHALLENGE */}
          {formState === "RESET" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label 
                  htmlFor="token-input"
                  className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider text-left"
                >
                  Verify Challenge Token
                </label>
                <div className="relative">
                  <input 
                    id="token-input"
                    type="text"
                    required
                    placeholder="Enter alphanumeric token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 text-sm transition font-mono"
                  />
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label 
                  htmlFor="new-password-input"
                  className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider text-left"
                >
                  Create New Password
                </label>
                <div className="relative">
                  <input 
                    id="new-password-input"
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="Enter replacement password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-2.5 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 text-sm transition"
                  />
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 select-none bg-transparent border-none p-0 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setFormState("LOGIN");
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-250 text-slate-705 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs shadow-sm transition cursor-pointer"
                >
                  {isLoading ? "Saving Credentials..." : "Reset My Password"}
                </button>
              </div>
            </form>
          )}

          {/* Warning notice in bottom of card */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              This is a secure government-monitored portal. Unauthorized access attempts are logged and protected by NDPR protocols.
            </p>
          </div>

        </div>
      </div>

      {/* Global Bottom Footer Info items */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 mt-auto text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-4 text-left">
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); alert("FME TVET National Support: support@uniqueideas.dontechservicesconst.com"); }}
            className="hover:text-slate-600 flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Support Center
          </a>
          <span className="text-slate-300">|</span>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); alert("NDPR Data Protection Policy activated."); }}
            className="hover:text-slate-600 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Privacy Policy
          </a>
        </div>
        
        <div className="text-right flex items-center gap-2">
          <span>FEDERAL TVET AUTHORITY</span>
          <span className="h-0.5 w-8 bg-yellow-500 inline-block"></span>
        </div>
      </footer>

    </div>
  );
}
