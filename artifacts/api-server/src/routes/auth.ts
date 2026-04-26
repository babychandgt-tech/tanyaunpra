import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  studentsTable,
  lecturersTable,
  apiKeysTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email dan password wajib diisi" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, String(email)));

    if (!user) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.password);
    if (!valid) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, name, role, nim, nidn, prodi, fakultas, angkatan } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    nim?: string;
    nidn?: string;
    prodi?: string;
    fakultas?: string;
    angkatan?: number;
  };

  if (!email || !password || !name || !role || !prodi || !fakultas) {
    res.status(400).json({ error: "Email, password, name, role, prodi, dan fakultas wajib diisi" });
    return;
  }
  if (!["mahasiswa", "dosen"].includes(role)) {
    res.status(400).json({ error: "Role harus mahasiswa atau dosen" });
    return;
  }
  if (role === "mahasiswa" && !nim) {
    res.status(400).json({ error: "NIM wajib diisi untuk mahasiswa" });
    return;
  }
  if (role === "dosen" && !nidn) {
    res.status(400).json({ error: "NIDN wajib diisi untuk dosen" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, String(email)));

    if (existing) {
      res.status(409).json({ error: "Email sudah terdaftar" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    const userRole = role as "mahasiswa" | "dosen";

    const [user] = await db
      .insert(usersTable)
      .values({ email: String(email), password: passwordHash, name: String(name), role: userRole })
      .returning();

    if (role === "mahasiswa") {
      await db.insert(studentsTable).values({
        userId: user.id,
        nim: String(nim),
        prodi: String(prodi),
        fakultas: String(fakultas),
        angkatan: Number(angkatan) || new Date().getFullYear(),
        semester: 1,
      });
    } else if (role === "dosen") {
      await db.insert(lecturersTable).values({
        userId: user.id,
        nidn: String(nidn),
        prodi: String(prodi),
        fakultas: String(fakultas),
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
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
  const { name, expiresInDays } = req.body as { name?: string; expiresInDays?: number };
  if (!name) {
    res.status(400).json({ error: "Nama API key wajib diisi" });
    return;
  }

  try {
    const rawKey = `unpra_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 12);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : undefined;

    const [apiKey] = await db
      .insert(apiKeysTable)
      .values({
        name: String(name),
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
