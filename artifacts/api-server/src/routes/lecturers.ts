import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { lecturersTable, usersTable } from "@workspace/db";
import { eq, ilike, and, SQL, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.resolve(process.cwd(), "uploads/photos");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router: IRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  prodi: z.string().optional(),
  fakultas: z.string().optional(),
  search: z.string().optional(),
});

const updateSchema = z.object({
  prodi: z.string().min(2).max(100).optional(),
  fakultas: z.string().min(2).max(100).optional(),
  jabatan: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  expertise: z.string().max(500).optional(),
});

const lecturerWithUser = (where?: SQL) =>
  db
    .select({
      id: lecturersTable.id,
      userId: lecturersTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      nidn: lecturersTable.nidn,
      prodi: lecturersTable.prodi,
      fakultas: lecturersTable.fakultas,
      jabatan: lecturersTable.jabatan,
      phone: lecturersTable.phone,
      expertise: lecturersTable.expertise,
      photoUrl: lecturersTable.photoUrl,
      createdAt: lecturersTable.createdAt,
      updatedAt: lecturersTable.updatedAt,
    })
    .from(lecturersTable)
    .leftJoin(usersTable, eq(usersTable.id, lecturersTable.userId))
    .where(where);

router.post("/lecturers", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const createSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(200),
    password: z.string().min(6).max(100),
    nidn: z.string().min(2).max(20),
    prodi: z.string().min(2).max(100),
    fakultas: z.string().min(2).max(100),
    jabatan: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    expertise: z.string().max(500).optional(),
  });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existingNidn] = await db.select({ id: lecturersTable.id }).from(lecturersTable).where(eq(lecturersTable.nidn, parsed.data.nidn));
    if (existingNidn) { res.status(409).json({ error: "NIDN sudah terdaftar" }); return; }

    const [existingEmail] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, parsed.data.email));
    if (existingEmail) { res.status(409).json({ error: "Email sudah digunakan" }); return; }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const [user] = await db.insert(usersTable).values({
      name: parsed.data.name,
      email: parsed.data.email,
      password: passwordHash,
      role: "dosen",
      isSuperAdmin: false,
    }).returning({ id: usersTable.id });

    const [lecturer] = await db.insert(lecturersTable).values({
      userId: user.id,
      nidn: parsed.data.nidn,
      prodi: parsed.data.prodi,
      fakultas: parsed.data.fakultas,
      jabatan: parsed.data.jabatan,
      phone: parsed.data.phone,
      expertise: parsed.data.expertise,
    }).returning();

    const rows = await lecturerWithUser(eq(lecturersTable.id, lecturer.id));
    res.status(201).json({ lecturer: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Create lecturer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/lecturers", requireAuth(), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, prodi, fakultas, search } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conds: SQL[] = [];
    if (prodi) conds.push(ilike(lecturersTable.prodi, `%${prodi}%`));
    if (fakultas) conds.push(ilike(lecturersTable.fakultas, `%${fakultas}%`));
    if (search) conds.push(ilike(usersTable.name, `%${search}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const [lecturers, totalResult] = await Promise.all([
      lecturerWithUser(where).limit(limit).offset(offset),
      db.select({ total: count() }).from(lecturersTable).leftJoin(usersTable, eq(usersTable.id, lecturersTable.userId)).where(where),
    ]);

    res.json({ lecturers, pagination: { page, limit, total: totalResult[0]?.total ?? 0, totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit) } });
  } catch (err) {
    req.log.error({ err }, "List lecturers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/lecturers/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const rows = await lecturerWithUser(eq(lecturersTable.id, String(req.params.id)));
    if (!rows[0]) { res.status(404).json({ error: "Dosen tidak ditemukan" }); return; }
    res.json({ lecturer: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Get lecturer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/lecturers/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const [target] = await db.select({ id: lecturersTable.id, userId: lecturersTable.userId }).from(lecturersTable).where(eq(lecturersTable.id, id));
    if (!target) { res.status(404).json({ error: "Dosen tidak ditemukan" }); return; }

    if (req.user!.role === "dosen" && target.userId !== req.user!.userId) {
      res.status(403).json({ error: "Anda hanya dapat mengedit profil sendiri" });
      return;
    }

    const [updated] = await db.update(lecturersTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(lecturersTable.id, id)).returning();
    res.json({ lecturer: updated });
  } catch (err) {
    req.log.error({ err }, "Update lecturer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/lecturers/:id/photo", requireAuth(["admin", "dosen"]), upload.single("photo"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [target] = await db.select({ id: lecturersTable.id, userId: lecturersTable.userId, photoUrl: lecturersTable.photoUrl }).from(lecturersTable).where(eq(lecturersTable.id, id));
    if (!target) { res.status(404).json({ error: "Dosen tidak ditemukan" }); return; }

    if (req.user!.role === "dosen" && target.userId !== req.user!.userId) {
      res.status(403).json({ error: "Anda hanya dapat mengedit profil sendiri" });
      return;
    }

    if (!req.file) { res.status(400).json({ error: "File foto tidak ditemukan atau format tidak didukung (jpg, png, webp, gif)" }); return; }

    if (target.photoUrl) {
      const oldFile = path.join(uploadsDir, path.basename(target.photoUrl));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const photoUrl = `/uploads/photos/${req.file.filename}`;
    const [updated] = await db.update(lecturersTable).set({ photoUrl, updatedAt: new Date() }).where(eq(lecturersTable.id, id)).returning();
    res.json({ lecturer: updated });
  } catch (err) {
    req.log.error({ err }, "Upload photo error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/lecturers/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(lecturersTable).where(eq(lecturersTable.id, String(req.params.id))).returning({ id: lecturersTable.id });
    if (!deleted) { res.status(404).json({ error: "Dosen tidak ditemukan" }); return; }
    res.json({ message: "Data dosen berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete lecturer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
