import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type Role = "mahasiswa" | "dosen" | "admin";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET!;

export function requireAuth(roles: Role[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token tidak ditemukan" });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.user = payload;

      if (roles.length > 0 && !roles.includes(payload.role)) {
        res.status(403).json({ error: "Akses ditolak. Role tidak diizinkan." });
        return;
      }

      next();
    } catch {
      res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa" });
    }
  };
}

export function requireApiKey() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey) {
      res.status(401).json({ error: "API key tidak ditemukan" });
      return;
    }

    try {
      const { db, apiKeysTable } = await import("@workspace/db");
      const { eq, and } = await import("drizzle-orm");
      const crypto = await import("crypto");

      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
      const [found] = await db
        .select()
        .from(apiKeysTable)
        .where(and(eq(apiKeysTable.keyHash, keyHash), eq(apiKeysTable.isActive, true)));

      if (!found) {
        res.status(401).json({ error: "API key tidak valid" });
        return;
      }

      if (found.expiresAt && found.expiresAt < new Date()) {
        res.status(401).json({ error: "API key sudah kadaluarsa" });
        return;
      }

      await db
        .update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, found.id));

      next();
    } catch (err) {
      req.log.error({ err }, "Error validating API key");
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
