import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DbRepo } from "./db";

export const JWT_SECRET = process.env.JWT_SECRET || "ideas-tvet-system-secret-authority-token-1995";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN_OFFICER" | "REVIEW_OFFICER" | "TRAINEE";
    beneficiaryId?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token = "";

    // 1. Check query parameters first (vital for window.open / iframe files if cookies are blocked)
    if (req.query && req.query.token) {
      token = req.query.token as string;
    }
    // 2. Check cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } 
    // 3. Check Authorization Header as fallback
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

    // Attach verified user attributes
    req.user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
      beneficiaryId: session.beneficiary_id || undefined
    };

    next();
  } catch (err: any) {
    console.error("[RequireAuth Middleware] Error:", err);
    res.status(501).json({ error: "Internal authentication verification service exception." });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access Denied. Security Role restricted to: [${roles.join(", ")}]` });
    }

    next();
  };
}
