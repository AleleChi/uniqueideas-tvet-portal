/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useNotification } from "./NotificationContext";
import { triggerEnterpriseToast } from "../utils/notification";
import { 
  Mail, Send, RefreshCw, Eye, Copy, History, CheckCircle, AlertTriangle, 
  Search, ShieldAlert, Cpu, Heart, Check, Trash
} from "lucide-react";

interface EmailLog {
  id: number;
  recipient_email: string;
  delivery_result: string;
  smtp_response: string | any;
  smtp_error_details: string | any;
  tracking_status: string;
  created_at: string;
  subject?: string;
}

export default function EmailDeliverySystem() {
  const { showToast } = useNotification();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailConfig, setEmailConfig] = useState<{ provider: string; configured: boolean } | null>(null);
  
  // Test email state
  const [testRecipient, setTestRecipient] = useState("");
  const [testSubject, setTestSubject] = useState("Enterprise Security Verification");
  const [testBody, setTestBody] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Preview state
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const fetchEmailConfig = async () => {
    try {
      const res = await fetch("/api/email/health");
      if (res.ok) {
        const data = await res.json();
        setEmailConfig(data);
      }
    } catch (err) {
      console.error("Failed to fetch email health status:", err);
    }
  };

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/email/delivery-history");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        triggerEnterpriseToast(showToast, "ERROR", "Failed to retrieve SMTP delivery history.");
      }
    } catch (err: any) {
      triggerEnterpriseToast(showToast, "ERROR", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
    fetchEmailConfig();
  }, []);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) {
      showToast("Please enter a recipient email address.", "warning");
      return;
    }

    try {
      setSendingTest(true);
      const res = await fetch("/api/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: testRecipient,
          subject: testSubject,
          body: testBody,
          simulateFailure
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Test email transmitted successfully via SMTP transport.", "success");
        setTestRecipient("");
        setTestBody("");
        fetchEmailLogs();
      } else {
        showToast(
          data.error || "SMTP mail courier returned invalid response signature. Please check Resend API key config.", 
          "error"
        );
      }
    } catch (err: any) {
      triggerEnterpriseToast(showToast, "ERROR", err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleCopyLink = (email: string) => {
    // Generate a mock activation link
    const dummyToken = "act_" + Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/tsp/activate?token=${dummyToken}`;
    navigator.clipboard.writeText(link);
    showToast("Activation token copied directly to clipboard.", "success");
  };

  const handleRetryFailed = async (log: EmailLog) => {
    try {
      showToast("Re-queueing SMTP payload...", "info");
      const res = await fetch("/api/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: log.recipient_email,
          subject: log.subject || "Re-attempt: IDEAS-TVET Platform Activation",
          body: `<p>This is a retry attempt of an original transaction requested on ${new Date(log.created_at).toLocaleString()}</p>`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Re-queued dispatch completed successfully.", "success");
        fetchEmailLogs();
      } else {
        showToast("Retry failed. SMTP server rejected credentials or endpoint config.", "error");
      }
    } catch (err: any) {
      showToast(`Retry exception: ${err.message}`, "error");
    }
  };

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (
      log.recipient_email.toLowerCase().includes(q) ||
      log.delivery_result.toLowerCase().includes(q) ||
      (log.tracking_status && log.tracking_status.toLowerCase().includes(q))
    );
  });

  // Calculate metrics
  const totalAttempts = logs.length;
  const deliverySuccesses = logs.filter(l => l.delivery_result.toLowerCase() === "success" || l.delivery_result.toLowerCase() === "delivered").length;
  const deliveryFailures = totalAttempts - deliverySuccesses;
  const successRate = totalAttempts > 0 ? Math.round((deliverySuccesses / totalAttempts) * 100) : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6" id="email-delivery-dashboard">
      
      {/* Title Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-xl border border-indigo-950/40 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Mail className="w-6 h-6" />
            </span>
            Enterprise Email Delivery System
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Audit outbound transactional dispatches, SMTP gateways, delivery rates, and trigger real-time activation simulations.
          </p>
        </div>
        {emailConfig ? (
          emailConfig.configured ? (
            <div className="flex items-center gap-2 text-xs bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-990/30 border-emerald-800 text-emerald-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Status: Active Resend API Gateway ({emailConfig.provider})</span>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-xs bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-900/30 text-amber-500">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Status: Simulator Fallback Sandbox Mode</span>
              </div>
              <span className="text-[10px] text-slate-400 block text-right max-w-sm">
                RESEND_API_KEY environment variable is not defined. Outbound emails write safely to Sandbox Mock logs.
              </span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 text-xs bg-indigo-950/20 px-3 py-1.5 rounded-lg border border-indigo-900/30 text-indigo-300 animate-pulse">
            <Cpu className="w-4 h-4" />
            <span>Analyzing Delivery Transports...</span>
          </div>
        )}
      </div>

      {/* Analytics KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900/40 border border-indigo-950/40 rounded-xl p-5 hover:border-indigo-900/50 transition duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Total Dispatches</span>
            <History className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{totalAttempts}</span>
            <span className="text-[10px] text-slate-500">outbound attempts</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-indigo-950/40 rounded-xl p-5 hover:border-indigo-900/50 transition duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Delivered Success</span>
            <CheckCircle className="w-4 h-4 text-green-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-400 font-mono">{deliverySuccesses}</span>
            <span className="text-[10px] text-slate-500">confirmed receipts</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-indigo-950/40 rounded-xl p-5 hover:border-indigo-900/50 transition duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Delivery Failures</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-400 font-mono">{deliveryFailures}</span>
            <span className="text-[10px] text-slate-500">undelivered/simulated</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-indigo-950/40 rounded-xl p-5 hover:border-indigo-900/50 transition duration-300 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Gateway Health</span>
            <Heart className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400 font-mono">{successRate}%</span>
            <span className="text-[10px] text-emerald-500">efficiency rate</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form: Real-Time SMTP Sandbox Dispatch */}
        <div className="bg-slate-900 border border-indigo-950 p-6 rounded-xl shadow-xl space-y-4">
          <div className="border-b border-indigo-950 pb-3 flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              SMTP Test Sandbox
            </h3>
          </div>

          <form onSubmit={handleSendTestEmail} className="space-y-4">
            
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-semibold text-slate-400">
                Recipient Email Address
              </label>
              <input
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="e.g. testing@example.com"
                className="w-full bg-slate-950 text-slate-200 border border-indigo-950 focus:border-indigo-500 rounded-lg p-2.5 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-semibold text-slate-400">
                Subject
              </label>
              <input
                type="text"
                required
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="Subject line..."
                className="w-full bg-slate-950 text-slate-200 border border-indigo-950 focus:border-indigo-500 rounded-lg p-2.5 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-semibold text-slate-400">
                Body / Message Content
              </label>
              <textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder="Type testing parameters or audit codes here..."
                rows={4}
                className="w-full bg-slate-950 text-slate-200 border border-indigo-950 focus:border-indigo-500 rounded-lg p-2.5 text-xs focus:outline-none"
              />
            </div>

            {/* Sandbox Simulation parameters */}
            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-indigo-950/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-red-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Simulate Delivery Failure
                </span>
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="w-4 h-4 rounded text-red-650 bg-slate-900 border-indigo-950 focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Check this box to manually test how the National TVET platform responds when an outbound SMTP connection fails or times out.
              </p>
            </div>

            <button
              type="submit"
              disabled={sendingTest}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wide transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingTest ? "Sending..." : "Transmit Test Packet"}</span>
            </button>

          </form>

        </div>

        {/* Right Audit Trail Table: outbound register logs */}
        <div className="lg:col-span-2 bg-slate-900 border border-indigo-950 p-6 rounded-xl shadow-xl flex flex-col space-y-4">
          
          <div className="border-b border-indigo-950 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Outbound SMTP Logs Registry
              </h3>
            </div>
            {/* Table search filter */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search delivery logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 pl-8 pr-3 py-1.5 rounded-lg border border-indigo-950 focus:border-indigo-500 focus:outline-none text-[11px]"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 flex-grow">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-950/60 animate-pulse rounded border border-indigo-950/20" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 flex-grow">
              <Mail className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No SMTP packets recorded in this cycle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-grow max-h-[460px] overflow-y-auto border border-indigo-950 rounded-lg">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-950 text-slate-500 uppercase tracking-widest font-semibold sticky top-0 border-b border-indigo-950 text-[9px]">
                  <tr>
                    <th className="py-3 px-4 bg-slate-950">Recipient</th>
                    <th className="py-3 px-4 bg-slate-950">Result</th>
                    <th className="py-3 px-4 bg-slate-950">Timestamp</th>
                    <th className="py-3 px-4 bg-slate-950 text-right">Oversight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-950/30 text-slate-300">
                  {filteredLogs.map(log => {
                    const isSuccess = log.delivery_result.toLowerCase() === "success" || log.delivery_result.toLowerCase() === "delivered";
                    return (
                      <tr key={log.id} className="hover:bg-slate-950/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {log.recipient_email}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                            isSuccess 
                              ? "bg-green-500/10 text-green-400" 
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${isSuccess ? "bg-green-400" : "bg-red-400"}`} />
                            {log.delivery_result}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleTimeString() || "now"}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => {
                              setPreviewLog(log);
                              setShowPreviewModal(true);
                            }}
                            className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                            title="Preview transmitted context"
                          >
                            <Eye className="w-3 h-3 inline mr-0.5" />
                            <span>Preview</span>
                          </button>
                          
                          <button
                            onClick={() => handleCopyLink(log.recipient_email)}
                            className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                            title="Copy secure activation invite link"
                          >
                            <Copy className="w-3 h-3 inline mr-0.5" />
                            <span>Link</span>
                          </button>

                          {!isSuccess && (
                            <button
                              onClick={() => handleRetryFailed(log)}
                              className="p-1 px-2 bg-indigo-900/40 hover:bg-indigo-900 text-indigo-300 rounded text-[10px] cursor-pointer font-bold transition"
                              title="Re-transmit SMTP payload package"
                            >
                              <RefreshCw className="w-3 h-3 inline mr-0.5" />
                              <span>Retry</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* HTML Onboarding Email Preview Modal */}
      {showPreviewModal && previewLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <Eye className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Formal Transmission Stream Preview
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Email Spec Headers */}
            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-950/50 space-y-2 text-xs font-mono text-slate-300">
              <div className="grid grid-cols-6 gap-1">
                <span className="text-slate-500 font-semibold font-sans">SENDER:</span>
                <span className="col-span-5 text-indigo-300">IDEAS TVET &lt;admission@uniqueideas.dontechservicesconst.com&gt;</span>
                
                <span className="text-slate-500 font-semibold font-sans">RECIPIENT:</span>
                <span className="col-span-5 text-white">{previewLog.recipient_email}</span>
                
                <span className="text-slate-500 font-semibold font-sans">SUBJECT:</span>
                <span className="col-span-5 text-indigo-200">
                  {previewLog.subject || "IDEAS-TVET Training Service Provider Onboarding Invitation"}
                </span>

                <span className="text-slate-500 font-semibold font-sans">RESULT:</span>
                <span className={`col-span-5 uppercase font-bold font-sans ${previewLog.delivery_result.toLowerCase() === "success" ? "text-green-400" : "text-red-400"}`}>
                  {previewLog.delivery_result}
                </span>
              </div>
            </div>

            {/* Simulated Live HTML Email Wrapper Container */}
            <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-inner max-h-[350px] overflow-y-auto p-6" id="email-rendered-preview">
              <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
                <div style={{ backgroundColor: "#1e3a8a", padding: "20px", borderRadius: "8px 8px 0 0", color: "#ffffff", textAlign: "center" }}>
                  <h2 style={{ margin: 0, fontSize: "20px" }}>IDEAS-TVET Partner Activation Hub</h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#93c5fd" }}>National Training Service Provider Enrollment Portal</p>
                </div>
                <div style={{ padding: "24px", color: "#1e293b", lineHeight: "1.6", fontSize: "13px" }}>
                  <p>Dear Administrator,</p>
                  <p>This transmission contains the secure invite to activate your organization on the TVET enterprise portal.</p>
                  <p>Click the link below to verify identity, establish primary admin credentials, and link state registry licenses.</p>
                  <div style={{ textAlign: "center", margin: "24px 0" }}>
                    <a href="#" style={{ backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 20px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", display: "inline-block", pointerEvents: "none" }}>
                      Activate Organization Gateway
                    </a>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748b" }}>This link will expire precisely 72 hours from dispatch.</p>
                </div>
              </div>
            </div>

            {/* Footer with actions */}
            <div className="flex justify-end gap-3 border-t border-indigo-950 pt-3">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer font-semibold"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
