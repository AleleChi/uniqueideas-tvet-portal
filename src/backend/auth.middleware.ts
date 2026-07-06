import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PoolClient } from "pg";
import { DbRepo } from "./db";
import { requestStorage } from "./request-storage";

let secret = process.env.JWT_SECRET;
if (!secret) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL ERROR: JWT_SECRET environment variable is missing in production!");
    process.exit(1);
  }
  secret = "ideas-tvet-system-secret-authority-token-1995";
}
export const JWT_SECRET = secret;

export { requestStorage };

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    beneficiaryId?: string;
    tenantId?: string;
    tenantTier?: string;
    stateId?: string;
    tspId?: string;
    permissions?: string[];
  };
  dbClient?: PoolClient;
  auditPermission?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token = "";

    // 1. Check cookies
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } 
    // 2. Check Authorization Header as fallback
    else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Authentication required. Please log in." });
    }

    // Verify token using JWT_SECRET
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    }

    // Validate active session row in PostgreSQL DB
    const session = await DbRepo.getUserSessionByToken(token);
    if (!session) {
      return res.status(401).json({ error: "Session has been revoked or has expired." });
    }

    // Fetch dynamic permissions for the user
    let permissions: string[] = [];
    try {
      permissions = await DbRepo.getUserPermissions(session.user_id);
    } catch (permErr: any) {
      console.error("[RequireAuth Middleware] Failed to resolve permissions:", permErr.message || permErr);
    }

    // Attach verified user attributes
    const isFederalRole = session.role === "SUPER_ADMIN" || session.role.startsWith("FED") || session.role.startsWith("FEDERAL");
    const tenantTier = isFederalRole ? "FED" : (session.tenant_tier || undefined);

    const isTspUser = session.role === "TSP" || session.role.startsWith("TSP") || session.role === "REVIEW_OFFICER" || session.role === "ADMIN_OFFICER";
    let tspId = session.tsp_id || undefined;
    if (isTspUser && !tspId) {
      tspId = "00000000-0000-0000-0000-000000000001";
    }

    req.user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
      beneficiaryId: session.beneficiary_id || undefined,
      tenantId: session.tenant_id || undefined,
      tenantTier,
      stateId: session.state_id || undefined,
      tspId,
      permissions
    };

    next();
  } catch (err: any) {
    console.error("[RequireAuth Middleware] Error:", err);
    res.status(501).json({ error: "Internal authentication verification service exception." });
  }
}

export const FED_ROLES = ["FED", "FED_SUPER_ADMIN", "FEDERAL_SUPER_ADMIN", "FEDERAL_PROGRAM_MANAGER", "FEDERAL_REVIEW_MANAGER", "FEDERAL_ME_OFFICER"];

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const isFederal = req.user.role === "SUPER_ADMIN" || FED_ROLES.includes(req.user.role) || req.user.role.startsWith("FED") || req.user.role.startsWith("FEDERAL");

    if (!isFederal && !roles.includes(req.user.role)) {
      console.warn(`[Auth Warning] Authorization failed for user ${req.user.id}. Required roles: [${roles.join(", ")}], but user has: ${req.user.role}`);
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }

    next();
  };
}

/**
 * requirePermission (Task 009 - Dynamic Permission Authorization Engine implementation)
 */
export function requirePermission(permissions: string | string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const required = Array.isArray(permissions) ? permissions : [permissions];
    const granted = req.user.permissions || [];
    const isFederal = req.user.role === "SUPER_ADMIN" || FED_ROLES.includes(req.user.role) || req.user.role.startsWith("FED") || req.user.role.startsWith("FEDERAL");
    const authorized = isFederal || required.every(permission => granted.includes(permission));

    if (!authorized) {
      console.warn(`[Auth Warning] Authorization failed for user ${req.user.id}. Required permissions: [${required.join(", ")}]`);
      return res.status(403).json({
        error: "You do not have permission to perform this action."
      });
    }

    req.auditPermission = required.join(",");
    next();
  };
}

/**
 * requireRoleOrPermission (Task 010 - Controlled Endpoint Authorization Migration)
 */
export function requireRoleOrPermission(
  roles: string | string[],
  permissions: string | string[]
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const rolesList = Array.isArray(roles) ? roles : [roles];
    const permissionsList = Array.isArray(permissions) ? permissions : [permissions];

    // Check legacy role
    const hasRole = rolesList.length > 0 && rolesList.includes(req.user.role);

    // Check dynamic permission
    const granted = req.user.permissions || [];
    const hasPermission = permissionsList.length > 0 && permissionsList.every(permission => granted.includes(permission));

    const isFederal = req.user.role === "SUPER_ADMIN" || FED_ROLES.includes(req.user.role) || req.user.role.startsWith("FED") || req.user.role.startsWith("FEDERAL");
    const isAuthorized = isFederal || hasRole || hasPermission;

    if (!isAuthorized) {
      console.warn(`[Auth Warning] Authorization failed for user ${req.user.id}. Required roles: [${rolesList.join(", ")}], required permissions: [${permissionsList.join(", ")}]`);
      return res.status(403).json({
        error: "You do not have permission to perform this action."
      });
    }

    if (hasPermission) {
      req.auditPermission = permissionsList.join(",");
    }

    next();
  };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token = "";

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      try {
        jwt.verify(token, JWT_SECRET);
        const session = await DbRepo.getUserSessionByToken(token);
        if (session) {
          let permissions: string[] = [];
          try {
            permissions = await DbRepo.getUserPermissions(session.user_id);
          } catch (permErr: any) {
            console.error("[Authenticate Middleware] Failed to resolve permissions:", permErr.message || permErr);
          }
          const isFederalRole = session.role === "SUPER_ADMIN" || session.role.startsWith("FED") || session.role.startsWith("FEDERAL");
          const tenantTier = isFederalRole ? "FED" : (session.tenant_tier || undefined);
          req.user = {
            id: session.user_id,
            email: session.email,
            role: session.role,
            beneficiaryId: session.beneficiary_id || undefined,
            tenantId: session.tenant_id || undefined,
            tenantTier,
            stateId: session.state_id || undefined,
            tspId: session.tsp_id || undefined,
            permissions
          };
        }
      } catch (tokenErr) {
        // Skip invalid/expired tokens gracefully for unauthenticated paths
      }
    }
  } catch (err) {
    console.error("[Authenticate Middleware] Error:", err);
  }
  next();
}

