import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  studentsTable,
  lecturersTable,
  apiKeysTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  requireAuth,
  type JwtPayload,
} from "../middlewares/auth";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token wajib diisi"),
});

const registerSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  role: z.enum(["mahasiswa", "dosen"], {
    invalid_type_error: "Role harus mahasiswa atau dosen",
  }),
  nim: z.string().optional(),
  nidn: z.string().optional(),
  prodi: z.string().min(1, "Prodi wajib diisi"),
  fakultas: z.string().min(1, "Fakultas wajib diisi"),
  angkatan: z.coerce.number().int().min(2000).max(2100).optional(),
  kelas: z.string().max(10).optional(),
}).superRefine((data, ctx) => {
  if (data.role === "mahasiswa" && !data.nim) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIM wajib diisi untuk mahasiswa", path: ["nim"] });
  }
  if (data.role === "dosen" && !data.nidn) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIDN wajib diisi untuk dosen", path: ["nidn"] });
  }
});

const createApiKeySchema = z.object({
  name: z.string().min(1, "Nama API key wajib diisi").max(100),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!user) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, name: user.name, isSuperAdmin: user.isSuperAdmin };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, isSuperAdmin: user.isSuperAdmin, createdAt: user.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const payload = jwt.verify(parsed.data.refreshToken, JWT_SECRET) as JwtPayload;

    if (payload.type !== "refresh") {
      res.status(401).json({ error: "Token tidak valid untuk refresh" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId));

    if (!user) {
      res.status(401).json({ error: "User tidak ditemukan" });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, name: user.name, isSuperAdmin: user.isSuperAdmin };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, isSuperAdmin: user.isSuperAdmin, createdAt: user.createdAt },
    });
  } catch {
    res.status(401).json({ error: "Refresh token tidak valid atau sudah kadaluarsa" });
  }
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password, name, role, nim, nidn, prodi, fakultas, angkatan, kelas } = parsed.data;

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (existing) {
      res.status(409).json({ error: "Email sudah terdaftar" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(usersTable)
        .values({ email, password: passwordHash, name, role })
        .returning();

      if (role === "mahasiswa") {
        await tx.insert(studentsTable).values({
          userId: newUser.id,
          nim: nim!,
          prodi,
          fakultas,
          angkatan: angkatan ?? new Date().getFullYear(),
          semester: 1,
          kelas: kelas ?? null,
        } as typeof studentsTable.$inferInsert);
      } else if (role === "dosen") {
        await tx.insert(lecturersTable).values({
          userId: newUser.id,
          nidn: nidn!,
          prodi,
          fakultas,
        } as typeof lecturersTable.$inferInsert);
      }

      return [newUser];
    });

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(201).json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, createdAt: user.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth(), async (req: Request, res: Response) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
        name: usersTable.name,
        isSuperAdmin: usersTable.isSuperAdmin,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));

    if (!user) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/api-keys", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = createApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { name, expiresInDays } = parsed.data;

  try {
    const rawKey = `unpra_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 12);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const [apiKey] = await db
      .insert(apiKeysTable)
      .values({
        name,
        keyHash,
        keyPrefix,
        isActive: true,
        ...(expiresAt ? { expiresAt } : {}),
      })
      .returning({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        keyPrefix: apiKeysTable.keyPrefix,
        createdAt: apiKeysTable.createdAt,
        expiresAt: apiKeysTable.expiresAt,
      });

    res.status(201).json({
      apiKey: { ...apiKey, key: rawKey },
      message: "Simpan API key ini dengan aman. Tidak akan ditampilkan lagi.",
    });
  } catch (err) {
    req.log.error({ err }, "Create API key error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/api-keys", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const keys = await db
      .select({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        keyPrefix: apiKeysTable.keyPrefix,
        isActive: apiKeysTable.isActive,
        lastUsedAt: apiKeysTable.lastUsedAt,
        expiresAt: apiKeysTable.expiresAt,
        createdAt: apiKeysTable.createdAt,
      })
      .from(apiKeysTable)
      .orderBy(apiKeysTable.createdAt);

    res.json({ apiKeys: keys });
  } catch (err) {
    req.log.error({ err }, "List API keys error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/auth/api-keys/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    await db
      .update(apiKeysTable)
      .set({ isActive: false })
      .where(eq(apiKeysTable.id, String(req.params.id)));

    res.json({ message: "API key berhasil dinonaktifkan" });
  } catch (err) {
    req.log.error({ err }, "Revoke API key error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
