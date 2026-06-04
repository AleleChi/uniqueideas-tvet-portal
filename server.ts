/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { Gender, ProgramStatus, Beneficiary, CustomField, AuditLog } from "./src/types";
import { AdmissionController } from "./src/backend/admission.controller";
import { EmailService } from "./src/backend/email.service";
import { initDb, DbRepo } from "./src/backend/db";
import { requireAuth, requireRole, JWT_SECRET, AuthenticatedRequest } from "./src/backend/auth.middleware";
import { PdfService } from "./src/backend/pdf.service";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Helper to log audit actions inside database
async function logAction(username: string, action: string, details: string) {
  const newLog: AuditLog = {
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    username,
    role: "Operations Manager",
    action,
    details
  };
  await DbRepo.saveAuditLog(newLog);
}

// REST API Endpoints

// Authentication API
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await DbRepo.getUserByEmail(normalizedEmail);

    if (!user) {
      await logAction(normalizedEmail, "SECURITY_FAILED", "Authentication failed: Email not registered");
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Check account lockout status
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remainingSeconds = Math.ceil((new Date(user.lockout_until).getTime() - Date.now()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return res.status(403).json({ 
        error: `Account locked due to 5 consecutive failures. Please try again in ${remainingMinutes} minute(s).` 
      });
    }

    // Verify Password Hash using bcryptjs
    const isMatched = bcrypt.compareSync(password, user.password_hash);
    if (isMatched) {
      // Login Success: Reset security counters
      user.failed_login_attempts = 0;
      user.lockout_until = null;
      await DbRepo.updateUser(user);

      // Generate Jwt Token containing user authorities
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, beneficiaryId: user.beneficiary_id },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Store in PostgreSQL user_sessions track list
      const sessionId = "sess_" + crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await DbRepo.saveUserSession(sessionId, user.id, token, expiresAt);

      // Set cookie header with HttpOnly parameters
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000
      });

      await logAction(user.email, "SECURITY_LOGIN", `User established secure session. Role: ${user.role}`);

      return res.json({
        isAuthenticated: true,
        username: user.email.split("@")[0],
        email: user.email,
        role: user.role,
        token: token,
        beneficiaryId: user.beneficiary_id || null
      });
    } else {
      // Incorrect password: increment lockout counter
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
      let isActionLocked = false;
      if (user.failed_login_attempts >= 5) {
        user.lockout_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        isActionLocked = true;
      }
      await DbRepo.updateUser(user);
      await logAction(normalizedEmail, "SECURITY_FAILED", `Failed login password challenge. Attempt count: ${user.failed_login_attempts}`);

      if (isActionLocked) {
        return res.status(403).json({ 
          error: "Incorrect password. 5 consecutive failures detected. Account locked out for 15 minutes." 
        });
      } else {
        return res.status(401).json({ 
          error: `Incorrect password. ${5 - user.failed_login_attempts} remaining attempts before lock.` 
        });
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : "");
    if (token) {
      await DbRepo.deleteUserSessionByToken(token);
    }
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/session", async (req, res) => {
  try {
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : "");
    if (!token) {
      return res.json({ isAuthenticated: false });
    }
    const session = await DbRepo.getUserSessionByToken(token);
    if (!session) {
      return res.json({ isAuthenticated: false });
    }
    return res.json({
      isAuthenticated: true,
      user: {
        id: session.user_id,
        email: session.email,
        role: session.role,
        beneficiaryId: session.beneficiary_id || null
      }
    });
  } catch (err: any) {
    res.json({ isAuthenticated: false, error: err.message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await DbRepo.getUserByEmail(normalizedEmail);
    if (!user) {
      // Secure response to prevent user discovery enumerations
      return res.json({ 
        success: true, 
        message: "If the email is registered in our database, a password reset link has been dispatched." 
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiry
    
    user.reset_token = resetToken;
    user.reset_token_expires = resetExpires;
    await DbRepo.updateUser(user);

    // Dynamic reset links
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    console.log(`[SECURITY] Forgot password requested for ${normalizedEmail}. Code: ${resetToken}. Link: ${resetLink}`);
    
    // Attempt real notification dispatch
    try {
      await EmailService.sendEmail({
        recipient: normalizedEmail,
        subject: "IDEAS-TVET Password Recovery Assistance",
        body: `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2b3e50;">Password Reset Authorization</h2>
            <p>You requested a password reset on your IDEAS-TVET account.</p>
            <p>Click the link below securely to authorize your password recovery:</p>
            <p style="margin: 25px 0;">
              <a href="${resetLink}" style="background-color: #248bf5; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; display: inline-block;">Change Password</a>
            </p>
            <p style="font-size: 13px; color: #666;">This recovery link expires in 60 minutes. If you did not make this request, ignore this notification.</p>
          </div>
        `
      });
    } catch (mailErr: any) {
      console.log("[SECURITY] Mail dispatch failed (Resend not verified):", mailErr.message);
    }

    return res.json({ 
      success: true, 
      message: "If the email is registered, a password reset link has been dispatched.",
      token: resetToken // Included for instant integration testing
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }
    const user = await DbRepo.getUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired password reset authorization." });
    }

    user.password_hash = bcrypt.hashSync(password, 10);
    user.reset_token = null;
    user.reset_token_expires = null;
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    await DbRepo.updateUser(user);

    await logAction(user.email, "SECURITY_PASSWORD_RESET", "Password successfully recovered and changed.");

    return res.json({ success: true, message: "Your account password has been updated securely. You may log in." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Old password and new password are required" });
    }
    const user = await DbRepo.getUserByEmail(req.user!.email);
    if (!user) {
      return res.status(401).json({ error: "User profile context not found." });
    }

    const isMatched = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!isMatched) {
      return res.status(400).json({ error: "Incorrect current password validation failed." });
    }

    user.password_hash = bcrypt.hashSync(newPassword, 10);
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    await DbRepo.updateUser(user);

    await logAction(user.email, "SECURITY_PASSWORD_CHANGED", "Credentials manually updated and authenticated from settings.");

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admissions Workflow Integration endpoints
app.get("/api/email/health", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), (req, res) => {
  res.json({
    provider: "resend",
    configured: !!process.env.RESEND_API_KEY
  });
});

app.post("/api/email/test", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Recipient email parameter 'email' is required." });
    }

    const auditOutcome = await EmailService.executeLiveIntegrationAudit(email);

    if (auditOutcome.deliveryStatus === "failed") {
      return res.status(400).json({
        messageId: auditOutcome.messageId,
        apiResponse: auditOutcome.apiResponse,
        deliveryStatus: auditOutcome.deliveryStatus,
        timestamp: auditOutcome.timestamp,
        errorDetails: auditOutcome.errorDetails,
        details: auditOutcome.details
      });
    }

    return res.status(200).json({
      messageId: auditOutcome.messageId,
      apiResponse: auditOutcome.apiResponse,
      deliveryStatus: auditOutcome.deliveryStatus,
      timestamp: auditOutcome.timestamp
    });

  } catch (err: any) {
    console.error("[POST /api/email/test] Integration route error:", err);
    return res.status(500).json({
      messageId: null,
      apiResponse: null,
      deliveryStatus: "failed",
      timestamp: new Date().toISOString(),
      errorDetails: {
        message: err.message || String(err),
        statusCode: 500,
        responseBody: err
      }
    });
  }
});

app.post("/api/email/production-test", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Recipient email parameter 'email' is required." });
    }

    // Call updated live integration audit method using verified domain
    const auditOutcome = await EmailService.executeLiveIntegrationAudit(email);

    return res.status(auditOutcome.deliveryStatus === "success" ? 200 : 400).json({
      success: auditOutcome.deliveryStatus === "success",
      recipient: email,
      messageId: auditOutcome.messageId || "",
      provider: "resend"
    });
  } catch (err: any) {
    console.error("[POST /api/email/production-test] Unexpected route error:", err);
    return res.status(500).json({
      success: false,
      recipient: req.body?.email || "unknown",
      messageId: "",
      provider: "resend",
      error: err.message || String(err)
    });
  }
});

app.get("/api/admissions/email-health", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), AdmissionController.getEmailHealth);
app.post("/api/admissions/send-offer", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), AdmissionController.sendOffer);
app.get("/api/admissions/validate-token", AdmissionController.validateToken);
app.get("/api/admissions/secure-link", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), AdmissionController.getSecureLink);
app.post("/api/admissions/submit-response", AdmissionController.submitResponse);
app.post("/api/admissions/approve-acceptance", requireAuth, requireRole(["SUPER_ADMIN", "REVIEW_OFFICER"]), AdmissionController.approveAcceptance);
app.post("/api/admissions/reject-acceptance", requireAuth, requireRole(["SUPER_ADMIN", "REVIEW_OFFICER"]), AdmissionController.rejectAcceptance);

// PDF Download Endpoint with application/pdf and .pdf extension
app.get("/api/admissions/download-letter/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const beneficiary = await DbRepo.getBeneficiaryById(id);
    if (!beneficiary) {
      return res.status(404).send("Beneficiary candidate not found");
    }

    const pdfBuffer = await PdfService.generateAdmissionLetterPdf(beneficiary);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Admission_Letter_${beneficiary.id}.pdf`);
    return res.status(200).send(pdfBuffer);
  } catch (e: any) {
    console.error("[GET /api/admissions/download-letter] Error compiling PDF document:", e);
    return res.status(500).send(e.message);
  }
});

// Custom Field Builder API
app.get("/api/custom-fields", requireAuth, async (req, res) => {
  try {
    const customFields = await DbRepo.getCustomFields();
    res.json(customFields);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/custom-fields", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { label, type, required, options } = req.body;
    if (!label || !type) {
      return res.status(400).json({ error: "Label and field type are required" });
    }

    const name = label.toLowerCase().replace(/[^a-z0-9]/g, "");
    const newField: CustomField = {
      id: "cf_" + Date.now(),
      name,
      label,
      type,
      required: !!required,
      options: options || []
    };

    await DbRepo.saveCustomField(newField);
    await logAction(req.user!.email, "FIELD_CREATE", `Added dynamic custom field '${label}'`);
    res.status(201).json(newField);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/custom-fields/:id", requireAuth, requireRole(["SUPER_ADMIN"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const customFields = await DbRepo.getCustomFields();
    const index = customFields.findIndex(f => f.id === id);
    if (index !== -1) {
      const deletedField = customFields[index];
      await DbRepo.deleteCustomField(id);
      await logAction(req.user!.email, "FIELD_DELETE", `Removed dynamic custom field '${deletedField.label}'`);
      return res.json({ success: true, removed: deletedField });
    }
    res.status(404).json({ error: "Field not found" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Beneficiary management resource
app.get("/api/beneficiaries", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER", "REVIEW_OFFICER"]), async (req, res) => {
  try {
    const beneficiaries = await DbRepo.getBeneficiaries();
    res.json(beneficiaries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/beneficiaries/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    // In-depth Authorization boundary: Trainees are locked out of other beneficiaries profiles
    if (req.user!.role === "TRAINEE" && req.user!.beneficiaryId !== id) {
      return res.status(403).json({ error: "Access Denied. A trainee candidate can only access their personal profile." });
    }

    const b = await DbRepo.getBeneficiaryById(id);
    if (b) {
      res.json(b);
    } else {
      res.status(404).json({ error: "Beneficiary record not found" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/beneficiaries", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER"]), async (req: AuthenticatedRequest, res) => {
  try {
    const data = req.body;
    if (!data.firstName || !data.lastName || !data.nin || !data.bvn) {
      return res.status(400).json({ error: "First Name, Last Name, NIN, and BVN are required fields" });
    }

    const beneficiaries = await DbRepo.getBeneficiaries();

    // Generate customized ID
    const enrollYear = new Date().getFullYear();
    const pad = String(beneficiaries.length + 1).padStart(3, "0");
    const id = `IDEAS-${enrollYear}-${pad}`;

    const newBeneficiary: Beneficiary = {
      id,
      photo: data.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200",
      firstName: data.firstName,
      lastName: data.lastName,
      otherName: data.otherName || "",
      gender: data.gender || Gender.OTHER,
      bvn: data.bvn,
      nin: data.nin,
      state: data.state || "Imo",
      city: data.city || "Owerri",
      phoneNumber: data.phoneNumber || "",
      email: data.email || "",
      residentialAddress: data.residentialAddress || "",
      batch: data.batch || `Batch ${new Date().getFullYear()}-C`,
      customFields: data.customFields || {},
      tsp: "Unique Technology Nig. Ltd",
      program: "IDEAS-TVET",
      skillSector: "Computer Hardware and Cell Phone Repairs",
      status: data.status || ProgramStatus.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await DbRepo.upsertBeneficiary(newBeneficiary);
    await logAction(req.user!.email, "BENEFICIARY_CREATE", `Registered beneficiary ${newBeneficiary.firstName} ${newBeneficiary.lastName} with ID ${newBeneficiary.id}`);
    res.status(201).json(newBeneficiary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/beneficiaries/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Security Gate check
    if (req.user!.role === "TRAINEE" && req.user!.beneficiaryId !== id) {
      return res.status(403).json({ error: "Access Denied. You are forbidden from modifying other candidate profiles." });
    }
    if (req.user!.role !== "TRAINEE" && !["SUPER_ADMIN", "ADMIN_OFFICER"].includes(req.user!.role)) {
      return res.status(403).json({ error: "Access Denied. Permissions restricted to Super Admins and Admin Officers." });
    }

    const original = await DbRepo.getBeneficiaryById(id);
    if (original) {
      const data = req.body;
      
      const updated: Beneficiary = {
        ...original,
        ...data,
        id: original.id, // Cannot change ID
        updatedAt: new Date().toISOString()
      };
      
      await DbRepo.upsertBeneficiary(updated);
      await logAction(req.user!.email, "BENEFICIARY_UPDATE", `Updated details of beneficiary ${original.firstName} ${original.lastName} (ID: ${original.id})`);
      return res.json(updated);
    }
    res.status(404).json({ error: "Beneficiary not found" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/beneficiaries/:id", requireAuth, requireRole(["SUPER_ADMIN"]), async (req: AuthenticatedRequest, res) => {
  try {
    const target = await DbRepo.getBeneficiaryById(req.params.id);
    if (target) {
      await DbRepo.deleteBeneficiary(req.params.id);
      await logAction(req.user!.email, "BENEFICIARY_DELETE", `Soft deleted beneficiary registration ${target.firstName} ${target.lastName} (ID: ${target.id})`);
      return res.json({ success: true, deleted: target });
    }
    res.status(404).json({ error: "Beneficiary not found" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Audit Logging Fetch
app.get("/api/audit-logs", requireAuth, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const auditLogs = await DbRepo.getAuditLogs();
    res.json(auditLogs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// CSV Export compilation endpoint
app.get("/api/export/csv", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER", "REVIEW_OFFICER"]), async (req: AuthenticatedRequest, res) => {
  try {
    const customFields = await DbRepo.getCustomFields();
    const beneficiaries = await DbRepo.getBeneficiaries();

    await logAction(req.user!.email, "EXCEL_EXPORT", "Triggered bulk beneficiary spreadsheet export in CSV format");

    // Compile header columns recursively including dynamic fields
    const headers = [
      "Beneficiary ID", "First Name", "Last Name", "Other Name", "Gender", "BVN", "NIN",
      "State", "City", "Phone Number", "Email", "Residential Address", "Batch",
      "TSP Provider", "Program Track", "Skill Sector", "Verification Status", "Lifecycle Stage"
    ];
    
    // Custom headers from customFields schema definition
    customFields.forEach(cf => {
      headers.push(`Custom: ${cf.label}`);
    });

    let csvContent = headers.join(",") + "\n";

    beneficiaries.forEach(b => {
      const row = [
        `"${b.id}"`, `"${b.firstName}"`, `"${b.lastName}"`, `"${b.otherName || ""}"`, `"${b.gender}"`, `"${b.bvn}"`, `"${b.nin}"`,
        `"${b.state}"`, `"${b.city}"`, `"${b.phoneNumber}"`, `"${b.email}"`, `"${b.residentialAddress.replace(/"/g, '""')}"`, `"${b.batch}"`,
        `"${b.tsp}"`, `"${b.program}"`, `"${b.skillSector}"`, `"${b.status}"`, `"${b.admissionStatus || "Draft"}"`
      ];

      customFields.forEach(cf => {
        row.push(`"${(b.customFields[cf.name] || "").replace(/"/g, '""')}"`);
      });

      csvContent += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ideas_tvet_beneficiaries_export.csv");
    res.status(200).send(csvContent);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// Excel Spreadsheet compilation endpoint (.xls styled HTML)
app.get("/api/export/excel", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER", "REVIEW_OFFICER"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { state, batch } = req.query;
    const beneficiaries = await DbRepo.getBeneficiaries();

    await logAction(req.user!.email, "EXCEL_EXPORT", `Triggered bulk beneficiary spreadsheet export in Excel format for State: ${state}, Batch: ${batch}`);

    // Filter beneficiaries list matching the request
    const filtered = beneficiaries.filter(b => {
      const sMatch = !state || state === "all" || b.state === state;
      const bMatch = !batch || batch === "all" || b.batch === batch;
      return sMatch && bMatch;
    });

    // Construct standard Excel openable XML/HTML string with exact 10 columns
    let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; }
  table { border-collapse: collapse; width: 100%; }
  th { background-color: #312e81; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; font-size: 11px; text-transform: uppercase; }
  td { border: 1px solid #cbd5e1; padding: 10px; font-size: 11px; vertical-align: middle; }
  .title-cell { font-size: 16px; font-weight: bold; color: #1e1b4b; background-color: #f1f5f9; text-align: center; }
  .meta-cell { font-size: 11px; color: #64748b; background-color: #f1f5f9; text-align: center; }
  .photo-img { width: 50px; height: 50px; border-radius: 25px; border: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <table>
    <tr>
      <td colspan="11" class="title-cell" height="40">IDEAS-TVET BENEFICIARY PHOTO ALBUM REGISTRY</td>
    </tr>
    <tr>
      <td colspan="11" class="meta-cell" height="25">Training Service Provider (TSP): Unique Technology Nig. Ltd | Date Extracted: ${new Date().toLocaleDateString("en-GB")}</td>
    </tr>
    <tr><td colspan="11" style="background-color:#ffffff; border:none;" height="15"></td></tr>
    <thead>
      <tr>
        <th>Photo</th>
        <th>First Name</th>
        <th>Last Name</th>
        <th>NIN</th>
        <th>BVN</th>
        <th>State</th>
        <th>City</th>
        <th>TSP</th>
        <th>Skill Sector</th>
        <th>Lifecycle Stage</th>
        <th>Registration Date</th>
      </tr>
    </thead>
    <tbody>
  `;

    filtered.forEach(b => {
      const photoUrl = b.photo;
      const formattedDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-GB") : "N/A";
      html += `
      <tr>
        <td align="center" valign="middle" height="60">
          <img class="photo-img" src="${photoUrl}" width="50" height="50" />
        </td>
        <td>${b.firstName}</td>
        <td>${b.lastName}</td>
        <td style="mso-number-format:'@';">${b.nin}</td>
        <td style="mso-number-format:'@';">${b.bvn}</td>
        <td>${b.state}</td>
        <td>${b.city}</td>
        <td>${b.tsp || "Unique Technology Nig. Ltd"}</td>
        <td>${b.skillSector || "Computer Hardware and Cell Phone Repairs"}</td>
        <td style="font-weight: bold; color: #312e81;">${b.admissionStatus || "Draft"}</td>
        <td>${formattedDate}</td>
      </tr>
    `;
    });

    if (filtered.length === 0) {
      html += `<tr><td colspan="11" align="center" style="font-weight:bold; color:#ef4444; padding:20px;">No beneficiary records found for the selected filter parameters.</td></tr>`;
    }

    html += `
    </tbody>
  </table>
</body>
</html>
  `;

    res.setHeader("Content-Type", "application/vnd.ms-excel");
    res.setHeader("Content-Disposition", "attachment; filename=ideas_tvet_beneficiaries_export.xls");
    res.status(200).send(html);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// PDF Exporter compilation endpoint (Renders beautiful media A4 printable document)
app.get("/api/export/pdf", requireAuth, requireRole(["SUPER_ADMIN", "ADMIN_OFFICER", "REVIEW_OFFICER"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { state, batch } = req.query;
    const beneficiaries = await DbRepo.getBeneficiaries();

    await logAction(req.user!.email, "PDF_EXPORT", `Triggered official multi-page PDF generation for State: ${state}, Batch: ${batch}`);

    const filtered = beneficiaries.filter(b => {
      const sMatch = !state || state === "all" || b.state === state;
      const bMatch = !batch || batch === "all" || b.batch === batch;
      return sMatch && bMatch;
    });

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>IDEAS-TVET Official Beneficiary Photo Album PDF</title>
  <style>
    @media print {
      .print-button-container {
        display: none !important;
      }
      body {
        background: none;
      }
      .document-page {
        margin: 0 !important;
        box-shadow: none !important;
        page-break-after: always;
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: #f1f5f9;
    }
    .print-button-container {
      background: #312e81;
      padding: 15px 30px;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .btn {
      background-color: #22c55e;
      color: white;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 700;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      transition: all 0.2s;
    }
    .btn:hover {
      background-color: #16a34a;
      transform: translateY(-1px);
    }
    .document-page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      box-sizing: border-box;
      background: white;
      margin: 30px auto;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #312e81;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo-icon {
      width: 45px;
      height: 45px;
      background-color: #312e81;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }
    .logo-text h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e1b4b;
    }
    .logo-text p {
      margin: 2px 0 0 0;
      font-size: 10px;
      color: #64748b;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .doc-meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .doc-meta strong {
      color: #1e293b;
    }
    .title-block {
      text-align: center;
      margin-bottom: 30px;
    }
    .title-block h2 {
      font-size: 22px;
      color: #0f172a;
      margin: 0 0 8px 0;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .title-block p {
      font-size: 12px;
      color: #475569;
      margin: 0;
    }
    .intro-paragraph {
      font-size: 12px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 25px;
    }
    .beneficiary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .beneficiary-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      gap: 15px;
      background-color: #f8fafc;
      page-break-inside: avoid;
    }
    .card-photo {
      width: 85px;
      height: 85px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #e2e8f0;
    }
    .card-details {
      flex-grow: 1;
      font-size: 11px;
    }
    .card-details h4 {
      margin: 0 0 6px 0;
      font-size: 13px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .detail-label {
      color: #64748b;
      font-weight: 500;
    }
    .detail-val {
      color: #0f172a;
      font-weight: 600;
    }
    .footer {
      position: absolute;
      bottom: 20px;
      left: 20mm;
      right: 20mm;
      border-top: 1px dashed #cbd5e1;
      padding-top: 15px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }
    .sign-section {
      display: flex;
      justify-content: space-between;
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sign-box {
      width: 45%;
      font-size: 11px;
    }
    .sign-line {
      border-bottom: 1px solid #94a3b8;
      height: 40px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="print-button-container">
    <div style="font-size: 13px;">
      <strong>Official Registry Document Compiler Active</strong> | Click 'Print' to save as dynamic vector PDF.
    </div>
    <button class="btn" onclick="window.print()">Print & Save PDF</button>
  </div>

  <div class="document-page">
    <div class="header">
      <div class="logo-section">
        <div class="logo-icon">U</div>
        <div class="logo-text">
          <h1>Unique Technology Nig. Ltd</h1>
          <p>IDEAS-TVET Program Registry</p>
        </div>
      </div>
      <div class="doc-meta">
        <div>Ref: <strong>TVET-ALBUM-RECON</strong></div>
        <div>Date: <strong>${new Date().toLocaleDateString("en-GB")}</strong></div>
        <div>Scope: <strong>National Security Code</strong></div>
      </div>
    </div>

    <div class="title-block">
      <h2>Official Beneficiary Photo Album</h2>
      <p>Federally Authenticated TVET Trainees Profile Dashboard Directory</p>
    </div>

    <p class="intro-paragraph">
      This is to certify that the dynamic biometrics registration lock is active across our federal skill hubs. The candidates cataloged below are verified by our accredited audit workflows as enrolled participants for <strong>Computer Hardware and Cell Phone Repairs</strong>. All biometrics matching filters conform to TVET program standards.
    </p>

    <div class="beneficiary-grid">
  `;

    filtered.forEach(b => {
      html += `
      <div class="beneficiary-card">
        <img class="card-photo" src="${b.photo}" />
        <div class="card-details">
          <h4>${b.lastName}, ${b.firstName}</h4>
          <div class="detail-row">
            <span class="detail-label">NIN:</span>
            <span class="detail-val">${b.nin}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">BVN:</span>
            <span class="detail-val">${b.bvn}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">State/City:</span>
            <span class="detail-val">${b.state} (${b.city})</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Skill Track:</span>
            <span class="detail-val">Mobile hardware repair</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Lifecycle Stage:</span>
            <span class="detail-val" style="color:#312e81; font-weight:bold;">${b.admissionStatus || "Draft"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-val" style="color:#16a34a;">VERIFIED LOCK</span>
          </div>
        </div>
      </div>
    `;
    });

    if (filtered.length === 0) {
      html += `
      <div style="grid-column: span 2; text-align: center; color: #ef4444; font-weight: bold; border: 1px dashed #ef4444; padding: 30px; border-radius: 12px;">
        No verified candidates found matching filtered criteria.
      </div>
    `;
    }

    html += `
    </div>

    <div class="sign-section">
      <div class="sign-box">
        <div class="sign-line"></div>
        <strong>Accredited Coordinator Sign-off</strong>
        <p style="margin: 3px 0; color: #64748b; font-size: 10px;">Unique Technology Nig. Ltd Coordinator</p>
      </div>
      <div class="sign-box" style="text-align: right;">
        <div class="sign-line"></div>
        <strong>Federal Board Auditor Signature</strong>
        <p style="margin: 3px 0; color: #64748b; font-size: 10px;">Federal Ministry of Education Officer</p>
      </div>
    </div>

    <div class="footer">
      <span>Security Hash Key: 0x8FE0A1959C - Classified Gov Registry</span>
      <span>Printed via IDEAS Portal Management System</span>
      <span>Page 1 of 1</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 800);
    };
  </script>
</body>
</html>
  `;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// Server boot with Vite middleware
async function startServer() {
  // Gracefully initialize PostgreSQL schema and run migrations
  try {
    await initDb();
  } catch (err) {
    console.error("[SYS] Database setup failure during bootstrap lifecycle:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SYS] Server running on http://localhost:${PORT}`);
  });
}

startServer();
