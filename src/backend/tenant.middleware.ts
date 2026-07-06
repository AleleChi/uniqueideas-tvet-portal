import { Response, NextFunction } from "express";
import { PoolClient } from "pg";
import { AuthenticatedRequest } from "./auth.middleware";
import { getPgPool, isPgActive, deactivatePg } from "./db";
import { requestStorage } from "./request-storage";

export async function tenantContextMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Skip unauthenticated requests
  if (!req.user) {
    return next();
  }

  let client: PoolClient | null = null;
  try {
    const pool = getPgPool();
    if (!pool || !isPgActive) {
      return next();
    }

    try {
      // Acquire PostgreSQL client
      client = await pool.connect();

      // Begin a transaction
      await client.query("BEGIN");

      // Push tenant context into PostgreSQL session variables in a single multi-set query
      const effectiveStateId = req.user.stateId === "state_imo_id_default" 
        ? "bc183dd7-3e5e-461c-8f23-b9e888339146" 
        : (req.user.stateId || "");

      await client.query(`
        SELECT 
          set_config('app.current_tenant_id', $1::text, true),
          set_config('app.current_tenant_tier', $2::text, true),
          set_config('app.current_state_id', $3::text, true),
          set_config('app.current_tsp_id', $4::text, true),
          set_config('app.current_beneficiary_id', $5::text, true),
          set_config('app.current_user_role', $6::text, true)
      `, [
        req.user.tenantId || "",
        req.user.tenantTier || "",
        effectiveStateId,
        req.user.tspId || "",
        req.user.beneficiaryId || "",
        req.user.role || ""
      ]);
    } catch (dbError: any) {
      console.warn("[TenantMiddleware] PostgreSQL initialization error. Falling back to JSON.", dbError.message || dbError);
      deactivatePg();
      if (client) {
        try {
          client.release();
        } catch (_) {}
        client = null;
      }
      return next();
    }

    // Attach client to request
    req.dbClient = client;

    const store = requestStorage.getStore();
    if (store) {
      store.dbClient = client;
      store.user = req.user;
    }

    let cleanedUp = false;
    const cleanup = async (action: "COMMIT" | "ROLLBACK") => {
      if (cleanedUp) return;
      cleanedUp = true;
      try {
        if (client) {
          await client.query(action);
        }
      } catch (err) {
        console.error(`[TenantMiddleware] Error during ${action}:`, err);
      } finally {
        try {
          if (client) {
            try {
              try {
                await client.query("DISCARD ALL");
              } catch (discardErr) {
                await client.query("RESET ALL");
              }
            } catch (resetErr) {
              console.error("[TenantMiddleware] Error resetting settings:", resetErr);
            }
            client.release();
          }
        } catch (releaseErr) {
          console.error("[TenantMiddleware] Error releasing PostgreSQL client:", releaseErr);
        } finally {
          if (store && store.dbClient === client) {
            store.dbClient = null;
          }
          if (req.dbClient === client) {
            req.dbClient = undefined;
          }
        }
      }
    };

    // Clean up on successful request completion
    res.on("finish", () => {
      cleanup("COMMIT").catch((err) => {
        console.error("[TenantMiddleware] Async error in finish event cleanup:", err);
      });
    });

    // Clean up on client disconnection or response close
    res.on("close", () => {
      cleanup("ROLLBACK").catch((err) => {
        console.error("[TenantMiddleware] Async error in close event cleanup:", err);
      });
    });

    next();
  } catch (error) {
    console.error("[TenantMiddleware] Initialization failure:", error);
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollErr) {
        console.error("[TenantMiddleware] Error during error ROLLBACK:", rollErr);
      } finally {
        try {
          client.release();
        } catch (releaseErr) {
          console.error("[TenantMiddleware] Error releasing client during error path:", releaseErr);
        } finally {
          const store = requestStorage.getStore();
          if (store && store.dbClient === client) {
            store.dbClient = null;
          }
          if (req.dbClient === client) {
            req.dbClient = undefined;
          }
        }
      }
    }
    return next(error);
  }
}
