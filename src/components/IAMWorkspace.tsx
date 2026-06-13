/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IAMWorkspace Component.
 * Implements a unified, clean, enterprise light-theme workspace for Identity & Access Management.
 */

import React, { useState, useEffect } from "react";
import { 
  Users, ShieldCheck, History, Grid, Search, Plus, Lock, Unlock, 
  Settings, Mail, RefreshCw, Sliders, Check, X, ShieldAlert, UserPlus, FileText, CheckSquare, Square
} from "lucide-react";
import { useNotification } from "./NotificationContext";

interface IAMUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER ADMIN" | "ADMIN" | "MANAGER" | "OFFICER" | "VIEWER";
  status: "ACTIVE" | "INVITED" | "LOCKED" | "SUSPENDED";
  invitedBy?: string;
  createdAt: string;
  lastLogin?: string;
}

interface SecurityLog {
  id: string;
  timestamp: string;
  operator: string;
  role: string;
  action: string;
  details: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  ipAddress: string;
}

interface SystemRole {
  id: "SUPER ADMIN" | "ADMIN" | "MANAGER" | "OFFICER" | "VIEWER";
  name: string;
  userCount: number;
  clearanceLevel: number;
  capabilities: string[];
}

export function IAMWorkspace() {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "roles" | "matrix">("users");
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Data State
  const [users, setUsers] = useState<IAMUser[]>([
    { id: "usr-1", name: "Alhaji Ibrahim Musa", email: "i.musa@ideas.gov.ng", role: "SUPER ADMIN", status: "ACTIVE", createdAt: "2024-03-10", lastLogin: "2026-06-12 09:30" },
    { id: "usr-2", name: "Dr. Chioma Nwachukwu", email: "c.nwachukwu@ideas.gov.ng", role: "ADMIN", status: "ACTIVE", createdAt: "2024-04-12", lastLogin: "2026-06-12 11:24" },
    { id: "usr-3", name: "Abubakar Garba", email: "a.garba@ideas.gov.ng", role: "MANAGER", status: "ACTIVE", createdAt: "2024-06-01", lastLogin: "2026-06-11 16:45" },
    { id: "usr-4", name: "Oluwaseun Adebayo", email: "o.adebayo@ideas.gov.ng", role: "OFFICER", status: "INVITED", invitedBy: "Alhaji Ibrahim Musa", createdAt: "2026-06-11", lastLogin: undefined },
    { id: "usr-5", name: "Fatima Bello", email: "f.bello@ideas.gov.ng", role: "VIEWER", status: "ACTIVE", createdAt: "2024-09-15", lastLogin: "2026-06-10 10:15" },
    { id: "usr-6", name: "Zubairu Sani", email: "z.sani@ideas.gov.ng", role: "OFFICER", status: "LOCKED", createdAt: "2025-01-20", lastLogin: "2026-05-30 08:12" },
    { id: "usr-7", name: "Ezenwa Udoka", email: "e.udoka@ideas.gov.ng", role: "MANAGER", status: "SUSPENDED", createdAt: "2024-11-05", lastLogin: "2026-06-01 14:22" }
  ]);

  const [logs, setLogs] = useState<SecurityLog[]>([
    { id: "log-1", timestamp: "2026-06-12 16:10:45", operator: "i.musa@ideas.gov.ng", role: "SUPER ADMIN", action: "USER_INVITE", details: "Dispatched system onboarding invite to o.adebayo@ideas.gov.ng", status: "SUCCESS", ipAddress: "197.210.64.12" },
    { id: "log-2", timestamp: "2026-06-12 15:45:22", operator: "c.nwachukwu@ideas.gov.ng", role: "ADMIN", action: "SECURITY_RULE_UPDATE", details: "Modified dynamic permissions mapping matrix for STATE COORDINATOR role", status: "SUCCESS", ipAddress: "102.89.2.45" },
    { id: "log-3", timestamp: "2026-06-12 14:12:08", operator: "z.sani@ideas.gov.ng", role: "OFFICER", action: "SESSION_AUTHENTICATION", details: "Failed password credentials verification attempt", status: "FAILED", ipAddress: "197.210.45.89" },
    { id: "log-4", timestamp: "2026-06-12 14:14:10", operator: "System Guard Engine", role: "SYSTEM", action: "USER_LOCKOUT", details: "Automatically locked operator registry z.sani@ideas.gov.ng due to consecutive Auth mismatches", status: "BLOCKED", ipAddress: "10.0.4.99" },
    { id: "log-5", timestamp: "2026-06-11 11:32:15", operator: "i.musa@ideas.gov.ng", role: "SUPER ADMIN", action: "ROLE_SUSPENSION", details: "Suspended clearance credentials for e.udoka@ideas.gov.ng (Pending compliance audit)", status: "SUCCESS", ipAddress: "197.210.64.12" },
    { id: "log-6", timestamp: "2026-06-11 09:15:30", operator: "e.udoka@ideas.gov.ng", role: "MANAGER", action: "BULK_DATA_EXPORT", details: "Downloaded master CSV trainee roster for Kano State", status: "SUCCESS", ipAddress: "102.89.44.110" }
  ]);

  const rolesObj: SystemRole[] = [
    { id: "SUPER ADMIN", name: "SUPER ADMIN", userCount: 1, clearanceLevel: 5, capabilities: ["Global System Access", "Permission Management", "Database Operations", "Audit Log Evacuation", "Credential Revocation", "Bypass RLS Boundary", "SLA Verification Controls"] },
    { id: "ADMIN", name: "ADMIN", userCount: 1, clearanceLevel: 4, capabilities: ["Organization Management", "Accreditation Approvals", "User Provisioning", "Custom Schema Modeling", "Reports Oversight", "Audit Trail Inspection"] },
    { id: "MANAGER", name: "MANAGER", userCount: 2, clearanceLevel: 3, capabilities: ["Enrollment Management", "Attendance Oversight", "Sector/Skill Setup", "SLA Template Selection", "Document Verification"] },
    { id: "OFFICER", name: "OFFICER", userCount: 2, clearanceLevel: 2, capabilities: ["Trainee Registration", "Photo Capture Re-verification", "Standard Communications dispatch", "Attendance log entry"] },
    { id: "VIEWER", name: "VIEWER", userCount: 1, clearanceLevel: 1, capabilities: ["Read-only general statistics", "Export certified rosters", "Accreditation view"] }
  ];

  // Dynamic system permissions matrix: rows (permissions) vs columns (roles)
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({
    all_access: { "SUPER ADMIN": true, "ADMIN": false, "MANAGER": false, "OFFICER": false, "VIEWER": false },
    manage_users: { "SUPER ADMIN": true, "ADMIN": true, "MANAGER": false, "OFFICER": false, "VIEWER": false },
    manage_roles: { "SUPER ADMIN": true, "ADMIN": false, "MANAGER": false, "OFFICER": false, "VIEWER": false },
    manage_permissions: { "SUPER ADMIN": true, "ADMIN": false, "MANAGER": false, "OFFICER": false, "VIEWER": false },
    execute_migrations: { "SUPER ADMIN": true, "ADMIN": false, "MANAGER": false, "OFFICER": false, "VIEWER": false },
    download_reports: { "SUPER ADMIN": true, "ADMIN": true, "MANAGER": true, "OFFICER": false, "VIEWER": false },
    verify_documents: { "SUPER ADMIN": true, "ADMIN": true, "MANAGER": true, "OFFICER": true, "VIEWER": false },
    view_analytics: { "SUPER ADMIN": true, "ADMIN": true, "MANAGER": true, "OFFICER": true, "VIEWER": true },
  });

  const permissionLabels: Record<string, { name: string; desc: string }> = {
    all_access: { name: "all_access", desc: "Full administrative mastery across all databases and schemas" },
    manage_users: { name: "manage_users", desc: "Provision, edit scope, and suspend user accounts" },
    manage_roles: { name: "manage_roles", desc: "Assign administrative levels and role hierarchies" },
    manage_permissions: { name: "manage_permissions", desc: "Modify permissions matrix mappings dynamically" },
    execute_migrations: { name: "execute_migrations", desc: "Perform database migrations or restore points" },
    download_reports: { name: "download_reports", desc: "Extract national, sector boundaries, and finance sheets" },
    verify_documents: { name: "verify_documents", desc: "Verify and sign off SLA contracts and trainee documents" },
    view_analytics: { name: "view_analytics", desc: "Read non-sensitive dashboards and statistics pages" },
  };

  // Form State for User Invite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "OFFICER" as any });

  const handleInviteUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;

    const addedUser: IAMUser = {
      id: `usr-${users.length + 1}`,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: "INVITED",
      invitedBy: "Alhaji Ibrahim Musa",
      createdAt: new Date().toISOString().split("T")[0]
    };

    setUsers([addedUser, ...users]);
    setShowInviteModal(false);
    showToast(`Successfully dispatched system invitation to ${newUser.email}`, "success");
    setNewUser({ name: "", email: "", role: "OFFICER" });
    
    // Add log entry
    const newLog: SecurityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operator: "i.musa@ideas.gov.ng",
      role: "SUPER ADMIN",
      action: "USER_INVITE",
      details: `Dispatched system onboarding invite to ${newUser.email} with role: ${newUser.role}`,
      status: "SUCCESS",
      ipAddress: "197.210.64.12"
    };
    setLogs([newLog, ...logs]);
  };

  const toggleUserStatus = (userId: string, currentStatus: string) => {
    let nextStatus: "ACTIVE" | "LOCKED" | "SUSPENDED" = "ACTIVE";
    let actionLabel = "";
    
    if (currentStatus === "ACTIVE") {
      nextStatus = "LOCKED";
      actionLabel = "locked";
    } else {
      nextStatus = "ACTIVE";
      actionLabel = "activated";
    }

    setUsers(users.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
    showToast(`User account status modified to ${nextStatus}`, "info");

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    // Log the event
    const newLog: SecurityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operator: "i.musa@ideas.gov.ng",
      role: "SUPER ADMIN",
      action: nextStatus === "LOCKED" ? "USER_LOCK" : "USER_UNLOCK",
      details: `Administratively ${actionLabel} account ${targetUser.email}`,
      status: "SUCCESS",
      ipAddress: "197.210.64.12"
    };
    setLogs([newLog, ...logs]);
  };

  const togglePermission = (permKey: string, roleKey: string) => {
    // Super admin cannot have permission revoked
    if (roleKey === "SUPER ADMIN" && permKey === "all_access") {
      showToast("Cannot revoke administrative master access from SUPER ADMIN", "error");
      return;
    }

    const previousVal = matrix[permKey][roleKey];
    setMatrix({
      ...matrix,
      [permKey]: {
        ...matrix[permKey],
        [roleKey]: !previousVal
      }
    });

    showToast(`Security access path updated for role ${roleKey}`, "success");

    // Add log entry
    const newLog: SecurityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operator: "i.musa@ideas.gov.ng",
      role: "SUPER ADMIN",
      action: "PERMISSION_MATRIX_SET",
      details: `${previousVal ? 'Revoked' : 'Granted'} permission node [${permKey}] to role [${roleKey}]`,
      status: "SUCCESS",
      ipAddress: "197.210.64.12"
    };
    setLogs([newLog, ...logs]);
  };

  // Badge Style Generators
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "SUPER ADMIN":
        return "bg-[#FEF3C7] text-[#D97706] border border-[#FEF3C7]/80";
      case "ADMIN":
        return "bg-[#E0F2FE] text-[#0369A1] border border-[#E0F2FE]/80";
      case "MANAGER":
        return "bg-[#F3E8FF] text-[#7E22CE] border border-[#F3E8FF]/80";
      case "OFFICER":
        return "bg-[#E0F8FF] text-[#0284C7] border border-[#E0F8FF]/80";
      case "VIEWER":
      default:
        return "bg-[#F1F5F9] text-[#475569] border border-[#F1F5F9]/80";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-[#D1FAE5] text-[#065F46] border border-[#D1FAE5]/80";
      case "INVITED":
        return "bg-[#DBEAFE] text-[#1E40AF] border border-[#DBEAFE]/80";
      case "LOCKED":
        return "bg-[#FEE2E2] text-[#991B1B] border border-[#FEE2E2]/80";
      case "SUSPENDED":
      default:
        return "bg-[#FEF3C7] text-[#92400E] border border-[#FEF3C7]/80";
    }
  };

  // Filter lists based on inputs
  const filteredUsers = users.filter(usr => {
    const matchesSearch = usr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          usr.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || usr.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || usr.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredLogs = logs.filter(lg => {
    const matchesSearch = lg.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          lg.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          lg.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || lg.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div id="iam-workspace-root" className="min-h-screen bg-[#F8FAFC] text-[#101828] font-sans antialiased p-6 space-y-6">
      
      {/* Upper header summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E4E7EC]">
        <div>
          <span className="text-[10px] font-bold font-mono tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase">
            TVET NATIONAL IDENTITY MANAGER
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828] mt-1.5 font-display">
            Identity &amp; Access Controls Workspace
          </h1>
          <p className="text-xs text-[#475467] mt-0.5">
            Configure system boundaries, roles assignments, audit cryptographic logs, and manage dynamic permissions matrix schemas.
          </p>
        </div>
        
        <div className="flex gap-2 flex-shrink-0">
          <button 
            type="button"
            onClick={() => {
              showToast("Forced dynamic IAM sync across network nodes.", "success");
            }}
            className="p-2.5 bg-white border border-[#E4E7EC] hover:bg-[#FCFCFD] text-[#475467] rounded-xl flex items-center justify-center transition active:scale-95 shadow-[0_1px_3px_rgba(16,24,40,0.06)] cursor-pointer"
            title="Sync Registry Permissions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-[0_4px_12px_rgba(79,70,229,0.15)] hover:shadow-[0_4px_20px_rgba(79,70,229,0.25)] transition active:scale-[97%] cursor-pointer text-xs uppercase"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite System User</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation list panel switching */}
      <div className="border-b border-[#E4E7EC] pb-1 flex flex-wrap gap-2">
        {[
          { id: "users", label: "Users Directory", icon: Users },
          { id: "roles", label: "Clearance Roles", icon: ShieldCheck },
          { id: "matrix", label: "System Permissions Matrix", icon: Grid },
          { id: "logs", label: "Security & Access Logs", icon: History }
        ].map(tb => {
          const IconComp = tb.icon;
          const isSel = activeTab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => {
                setActiveTab(tb.id as any);
                setSearchQuery("");
                setRoleFilter("ALL");
                setStatusFilter("ALL");
              }}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition border cursor-pointer ${
                isSel
                  ? "bg-white border-[#E4E7EC] text-indigo-700 font-bold shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
                  : "bg-transparent border-transparent text-[#475467] hover:text-[#101828] hover:bg-[#FCFCFD]"
              }`}
            >
              <IconComp className={`w-4 h-4 ${isSel ? "text-indigo-600" : "text-[#475467]"}`} />
              <span>{tb.label}</span>
            </button>
          );
        })}
      </div>

      {/* SEARCH AND FILTERS HOOK */}
      {activeTab !== "roles" && (
        <div id="iam-filters-bar" className="bg-white p-4 border border-[#E4E7EC] rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.06)] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:flex-grow">
            <Search className="w-4 h-4 text-[#475467] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder={
                activeTab === "users" ? "Search directory by operator name, auth email address..." :
                activeTab === "matrix" ? "Search schema permissions actions..." :
                "Search audit trails payload action names, operators..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FCFCFD] border border-[#E4E7EC] hover:border-[#D0D5DD] focus:border-indigo-500 rounded-xl py-2 pl-10 pr-4 text-xs text-[#101828] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans transition-all"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {activeTab === "users" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#FCFCFD] border border-[#E4E7EC] hover:border-[#D0D5DD] text-[#475467] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none w-1/2 sm:w-auto transition-all"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INVITED">INVITED</option>
                <option value="LOCKED">LOCKED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            )}

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#FCFCFD] border border-[#E4E7EC] hover:border-[#D0D5DD] text-[#475467] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none w-1/2 sm:w-auto transition-all"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER ADMIN">SUPER ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OFFICER">OFFICER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>
        </div>
      )}

      {/* CORE ACTIVE VIEWPORT */}
      <div id="iam-viewport" className="space-y-4">
        
        {/* VIEW 1: Users Directory */}
        {activeTab === "users" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center col-span-3 bg-white border border-[#E4E7EC] rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <Users className="w-8 h-8 text-[#475467] mx-auto mb-3 opacity-60" />
                <p className="text-sm font-semibold text-[#101828]">No matched registry operator found</p>
                <p className="text-xs text-[#475467] mt-0.5">Please check status filter scope parameters or spelling criteria.</p>
              </div>
            ) : (
              filteredUsers.map((usr) => (
                <div 
                  key={usr.id} 
                  className="bg-white border border-[#E4E7EC] rounded-2xl p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 transition-all duration-250 text-left flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {usr.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase tracking-wide ${getRoleBadgeClass(usr.role)}`}>
                          {usr.role}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase tracking-wide ${getStatusBadgeClass(usr.status)}`}>
                          {usr.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-[#101828] text-sm break-words">{usr.name}</h4>
                      <p className="text-xs text-[#475467] font-mono break-all mt-0.5">{usr.email}</p>
                    </div>

                    <div className="border-t border-[#E4E7EC] pt-3 text-[10.5px] text-[#475467] space-y-1">
                      <div className="flex justify-between">
                        <span>Provision Date:</span>
                        <strong className="text-[#101828] font-mono font-semibold">{usr.createdAt}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Session Activity:</span>
                        <strong className="text-[#101828] font-mono font-semibold">{usr.lastLogin || "Never Signed In"}</strong>
                      </div>
                      {usr.invitedBy && (
                        <div className="flex justify-between">
                          <span>Invited By:</span>
                          <strong className="text-indigo-600 font-sans truncate max-w-[120px]">{usr.invitedBy}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-[#E4E7EC]">
                    {usr.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(usr.id, usr.status)}
                        className="flex-1 py-1.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-[#991B1B] font-bold text-[10.5px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Suspend system credentials"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock Account</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={usr.status === "SUSPENDED"}
                        onClick={() => toggleUserStatus(usr.id, usr.status)}
                        className="flex-1 py-1.5 px-3 bg-[#D1FAE5] hover:bg-emerald-200 border border-emerald-300 text-[#065F46] font-bold text-[10.5px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock Account</span>
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                        showToast(`Dispatched scope update parameters dispatch verification to ${usr.email}`, "success");
                      }}
                      className="py-1.5 px-3 bg-white hover:bg-[#FCFCFD] border border-[#E4E7EC] text-[#475467] font-semibold text-[10.5px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Edit Scope</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VIEW 2: Clearance Roles */}
        {activeTab === "roles" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rolesObj.map((rl) => (
              <div 
                key={rl.id}
                className="bg-white border border-[#E4E7EC] rounded-2xl p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 transition-all duration-250 text-left flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start border-b border-[#E4E7EC] pb-4 mb-4">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase tracking-wider ${getRoleBadgeClass(rl.id)}`}>
                        {rl.name}
                      </span>
                      <h4 className="font-bold text-[#101828] text-base mt-1.5">System Level Tier</h4>
                    </div>
                    <div className="bg-[#FCFCFD] border border-[#E4E7EC] p-2 rounded-xl text-center">
                      <span className="text-[10px] text-[#475467] uppercase tracking-wider block font-bold font-mono">CLE LEVEL</span>
                      <span className="text-sm font-extrabold text-indigo-700 font-mono text-center block mt-0.5">{rl.clearanceLevel}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] text-[#475467]">
                      Capable authorizations configured permanently under this administration class:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {rl.capabilities.map((cp, idx) => (
                        <span key={idx} className="bg-[#F1F5F9] border border-[#E4E7EC] px-2 py-1 rounded text-[10px] font-medium text-[#475467] flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>{cp}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#E4E7EC] mt-6 pt-4 text-xs font-semibold text-[#475467]">
                  <span className="font-mono">Registered Users: {rl.userCount}</span>
                  <button
                    type="button"
                    onClick={() => {
                      showToast(`Draft audit generated for role profile ${rl.name}.`, "info");
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-bold p-1 cursor-pointer"
                  >
                    Capability audit &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 3: System Permissions Matrix */}
        {activeTab === "matrix" && (
          <div className="bg-white border border-[#E4E7EC] rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden text-left">
            <div className="p-5 border-b border-[#E4E7EC] bg-[#FCFCFD] flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-[#101828] uppercase tracking-wider font-mono flex items-center gap-2">
                  <Grid className="w-4 h-4 text-indigo-600" />
                  DYNAMIC ROLE PERMISSIONS MAPPINGS SCHEMAS
                </h4>
                <p className="text-xs text-[#475467] mt-1 font-sans">
                  Checked cells indicate authorized action paths. Click checkboxes optionally to alter system capabilities live.
                </p>
              </div>
              <span className="text-[10px] font-bold text-[#475467] font-mono bg-indigo-50 border border-indigo-100 px-2 py-1 rounded uppercase">
                Active Policy: POS_RBAC_V3
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FCFCFD] border-b border-[#E4E7EC] text-[#475467] font-bold uppercase select-none">
                    <th className="p-4 w-1/3 min-w-[220px]">Permission Directive Node</th>
                    {rolesObj.map((r) => (
                      <th key={r.id} className="p-4 font-mono text-center min-w-[120px]">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wide tracking-tight ${getRoleBadgeClass(r.id)}`}>
                          {r.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC] font-medium text-[#101828]">
                  {Object.keys(matrix)
                    .filter(permKey => permissionLabels[permKey]?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                       permissionLabels[permKey]?.desc.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((permKey, i) => {
                      const { name, desc } = permissionLabels[permKey] || { name: permKey, desc: "System default action permission scope" };
                      return (
                        <tr key={permKey} className={`hover:bg-[#F8FAFC] transition-colors ${i % 2 === 1 ? "bg-[#FCFCFD]" : ""}`}>
                          <td className="p-4 border-r border-[#E4E7EC]">
                            <span className="font-mono font-bold text-[11.5px] text-indigo-700 block select-all">{name}</span>
                            <span className="text-[#475467] text-[10.5px] block mt-0.5 leading-relaxed font-sans">{desc}</span>
                          </td>
                          {rolesObj.map((r) => {
                            const isGranted = matrix[permKey]?.[r.id] || false;
                            return (
                              <td key={r.id} className="p-4 text-center border-r border-[#E4E7EC]">
                                <button
                                  type="button"
                                  onClick={() => togglePermission(permKey, r.id)}
                                  className={`mx-auto h-6 w-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                    isGranted 
                                      ? "bg-[#D1FAE5] border border-emerald-300 text-[#065F46]" 
                                      : "bg-[#F1F5F9] border border-[#E4E7EC] text-[#475569] hover:bg-[#E4E7EC]"
                                  }`}
                                  title={`${isGranted ? 'Revoke' : 'Grant'} ${name} for ${r.name}`}
                                >
                                  {isGranted ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <X className="w-3 h-3 text-[#94A3B8]" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: Security & Access Logs */}
        {activeTab === "logs" && (
          <div className="bg-white border border-[#E4E7EC] rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden text-left">
            <div className="p-5 border-b border-[#E4E7EC] bg-[#FCFCFD] flex justify-between items-center flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#101828] uppercase tracking-wider font-mono flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  REAL-TIME CRYPTOGRAPHIC AUDITING & SECURITY TIMELINE
                </h4>
                <p className="text-xs text-[#475467] mt-1 font-sans">
                  Irrevocable security events and access logs. Use filter params above to browse activities.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[#475467] bg-[#F1F5F9] border border-[#E4E7EC] px-2 py-1 rounded font-bold uppercase">
                Active Traversal Log: OK (6 entries)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FCFCFD] border-b border-[#E4E7EC] text-[#475467] font-bold font-mono text-[10px] uppercase tracking-wider select-none">
                    <th className="p-4 w-32">Timestamp</th>
                    <th className="p-4 w-48">Operator / Actor</th>
                    <th className="p-4 w-32">Security Action</th>
                    <th className="p-4">Payload Details / Directive</th>
                    <th className="p-4 w-28 text-center">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC] font-mono text-[11px] text-[#475467]">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#475467] font-sans">
                        No matched audit logs found inside filter parameters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FCFCFD] transition-colors leading-relaxed">
                        <td className="p-4 text-[#475467] whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-4 border-r border-[#E4E7EC]/40">
                          <strong className="text-indigo-700 block font-sans text-xs">{log.operator}</strong>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wide mt-1 scale-95 origin-left ${getRoleBadgeClass(log.role)}`}>
                            {log.role}
                          </span>
                        </td>
                        <td className="p-4 border-r border-[#E4E7EC]/40 font-bold text-amber-800">{log.action}</td>
                        <td className="p-4 text-[#101828] font-sans text-xs max-w-xs break-all pr-4 select-text leading-relaxed">{log.details}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-center border font-mono ${
                            log.status === "SUCCESS" ? "bg-[#D1FAE5] text-[#065F46] border-emerald-300" :
                            log.status === "FAILED" ? "bg-[#FEE2E2] text-[#991B1B] border-red-300 animate-pulse" :
                            "bg-[#FEF3C7] text-[#92400E] border-amber-300"
                          }`}>
                            {log.status}
                          </span>
                          <span className="block text-[8px] text-slate-400 mt-1 font-mono">{log.ipAddress}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* USER INVITATION MODAL CONTAINER */}
      {showInviteModal && (
        <div id="invite-dialog-root" className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EC] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-[#E4E7EC] bg-[#FCFCFD] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-[#101828] uppercase tracking-wider font-mono flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  Invite System User
                </h3>
                <p className="text-[11px] text-[#475467] mt-0.5">Dispatches secure account authentication link.</p>
              </div>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-[#475467] hover:text-[#101828] p-1.5 hover:bg-[#F1F5F9] rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteUserSubmit} className="p-5 space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-[#475467] tracking-wider font-mono">Full Operator Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Alhaji Ibrahim Musa"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="w-full p-2.5 bg-[#FCFCFD] border border-[#E4E7EC] focus:border-indigo-500 rounded-xl text-xs text-[#101828] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-[#475467] tracking-wider font-mono">Operator Email Address</label>
                <input 
                  type="email"
                  required
                  placeholder="e.g. i.musa@ideas.gov.ng"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full p-2.5 bg-[#FCFCFD] border border-[#E4E7EC] focus:border-indigo-500 rounded-xl text-xs text-[#101828] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-[#475467] tracking-wider font-mono">Assigned System Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full p-2.5 bg-[#FCFCFD] border border-[#E4E7EC] focus:border-indigo-500 rounded-xl text-xs text-[#475467] focus:outline-none"
                >
                  <option value="SUPER ADMIN">SUPER ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="OFFICER">OFFICER</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-[#E4E7EC] justify-end">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-white border border-[#E4E7EC] hover:bg-[#FCFCFD] text-[#475467] font-bold rounded-xl cursor-pointer text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer transition flex items-center gap-1.5 text-xs uppercase"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Send Onboarding Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
