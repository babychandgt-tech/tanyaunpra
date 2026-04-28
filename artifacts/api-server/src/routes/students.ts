import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { studentsTable, usersTable, lecturersTable } from "@workspace/db";
import { eq, ilike, and, SQL, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  prodi: z.string().optional(),
  fakultas: z.string().optional(),
  angkatan: z.coerce.number().int().optional(),
  search: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(6).max(100),
  nim: z.string().min(2).max(20),
  prodi: z.string().min(2).max(100),
  fakultas: z.string().min(2).max(100),
  semester: z.number().int().min(1).max(14).default(1),
  angkatan: z.number().int().min(2000).max(2100),
  kelas: z.string().max(10).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
});

const updateSchema = z.object({
  prodi: z.string().min(2).max(100).optional(),
  fakultas: z.string().min(2).max(100).optional(),
  semester: z.number().int().min(1).max(14).optional(),
  kelas: z.string().max(10).optional().nullable(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
});

const studentWithUser = (where?: SQL) =>
  db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      nim: studentsTable.nim,
      prodi: studentsTable.prodi,
      fakultas: studentsTable.fakultas,
      semester: studentsTable.semester,
      angkatan: studentsTable.angkatan,
      kelas: studentsTable.kelas,
      phone: studentsTable.phone,
      address: studentsTable.address,
      createdAt: studentsTable.createdAt,
      updatedAt: studentsTable.updatedAt,
    })
    .from(studentsTable)
    .leftJoin(usersTable, eq(usersTable.id, studentsTable.userId))
    .where(where);

router.post("/students", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existingNim] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.nim, parsed.data.nim));
    if (existingNim) { res.status(409).json({ error: "NIM sudah terdaftar" }); return; }

    const [existingEmail] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, parsed.data.email));
    if (existingEmail) { res.status(409).json({ error: "Email sudah digunakan" }); return; }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const [user] = await db.insert(usersTable).values({
      name: parsed.data.name,
      email: parsed.data.email,
      password: passwordHash,
      role: "mahasiswa",
      isSuperAdmin: false,
    }).returning({ id: usersTable.id });

    const { name: _name, email: _email, password: _password, ...studentData } = parsed.data;
    const [student] = await db.insert(studentsTable).values({
      ...studentData,
      userId: user.id,
    }).returning();

    const rows = await studentWithUser(eq(studentsTable.id, student.id));
    res.status(201).json({ student: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Create student error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/students", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, prodi, fakultas, angkatan, search } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conds: SQL[] = [];

    if (req.user!.role === "dosen") {
      const [dosenProfile] = await db
        .select({ prodi: lecturersTable.prodi })
        .from(lecturersTable)
        .where(eq(lecturersTable.userId, req.user!.userId));
      if (!dosenProfile) {
        res.status(403).json({ error: "Profil dosen tidak ditemukan. Hubungi admin." });
        return;
      }
      conds.push(eq(studentsTable.prodi, dosenProfile.prodi));
    }

    if (prodi) conds.push(ilike(studentsTable.prodi, `%${prodi}%`));
    if (fakultas) conds.push(ilike(studentsTable.fakultas, `%${fakultas}%`));
    if (angkatan) conds.push(eq(studentsTable.angkatan, angkatan));
    if (search) conds.push(ilike(usersTable.name, `%${search}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const [students, totalResult] = await Promise.all([
      studentWithUser(where).limit(limit).offset(offset),
      db.select({ total: count() }).from(studentsTable).leftJoin(usersTable, eq(usersTable.id, studentsTable.userId)).where(where),
    ]);

    res.json({ students, pagination: { page, limit, total: totalResult[0]?.total ?? 0, totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit) } });
  } catch (err) {
    req.log.error({ err }, "List students error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/students/me", requireAuth(["mahasiswa"]), async (req: Request, res: Response) => {
  try {
    const rows = await studentWithUser(eq(studentsTable.userId, req.user!.userId));
    if (!rows[0]) { res.status(404).json({ error: "Data mahasiswa tidak ditemukan" }); return; }
    res.json({ student: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Get my student error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/students/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  try {
    const rows = await studentWithUser(eq(studentsTable.id, String(req.params.id)));
    if (!rows[0]) { res.status(404).json({ error: "Mahasiswa tidak ditemukan" }); return; }

    if (req.user!.role === "dosen") {
      const [dosenProfile] = await db
        .select({ prodi: lecturersTable.prodi })
        .from(lecturersTable)
        .where(eq(lecturersTable.userId, req.user!.userId));
      if (!dosenProfile) {
        res.status(403).json({ error: "Profil dosen tidak ditemukan. Hubungi admin." });
        return;
      }
      if (rows[0].prodi !== dosenProfile.prodi) {
        res.status(403).json({ error: "Akses ditolak. Mahasiswa bukan dari prodi Anda." });
        return;
      }
    }

    res.json({ student: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Get student error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/students/me", requireAuth(["mahasiswa"]), async (req: Request, res: Response) => {
  const parsed = z.object({
    phone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [target] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, req.user!.userId));
    if (!target) { res.status(404).json({ error: "Data mahasiswa tidak ditemukan" }); return; }

    const [updated] = await db.update(studentsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(studentsTable.id, target.id)).returning();
    res.json({ student: updated });
  } catch (err) {
    req.log.error({ err }, "Update my student error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/students/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [updated] = await db.update(studentsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(studentsTable.id, String(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Mahasiswa tidak ditemukan" }); return; }
    res.json({ student: updated });
  } catch (err) {
    req.log.error({ err }, "Update student error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/students/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(studentsTable).where(eq(studentsTable.id, String(req.params.id))).returning({ id: studentsTable.id });
    if (!deleted) { res.status(404).json({ error: "Mahasiswa tidak ditemukan" }); return; }
    res.json({ message: "Data mahasiswa berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete student error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
