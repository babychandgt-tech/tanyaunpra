import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { coursesTable, lecturersTable, usersTable, prodiTable, fakultasTable } from "@workspace/db";
import { eq, and, ilike, SQL, count, desc, asc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  prodi: z.string().optional(),
  fakultas: z.string().optional(),
  semester: z.coerce.number().int().min(1).max(14).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["kode", "sks", "semester"]).default("kode"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const createSchema = z.object({
  kode: z.string().min(2).max(20),
  nama: z.string().min(3).max(200),
  sks: z.number().int().min(1).max(6),
  semester: z.number().int().min(1).max(14),
  prodi: z.string().min(2).max(100),
  deskripsi: z.string().max(1000).optional(),
  lecturerId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial();

router.get("/courses", requireAuth(), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, prodi, fakultas, semester, search, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conds: SQL[] = [];
    if (prodi) conds.push(eq(coursesTable.prodi, prodi));
    if (fakultas) {
      const prodiNamesByFakultas = db
        .select({ name: prodiTable.name })
        .from(prodiTable)
        .innerJoin(fakultasTable, eq(prodiTable.fakultasId, fakultasTable.id))
        .where(eq(fakultasTable.name, fakultas));
      conds.push(inArray(coursesTable.prodi, prodiNamesByFakultas));
    }
    if (semester) conds.push(eq(coursesTable.semester, semester));
    if (search) conds.push(ilike(coursesTable.nama, `%${search}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const kodeNumExpr = sql`COALESCE(NULLIF(regexp_replace(${coursesTable.kode}, '[^0-9]', '', 'g'), '')::bigint, 0)`;
    const kodePrefixExpr = sql`regexp_replace(${coursesTable.kode}, '[0-9]+$', '')`;
    const sortCol =
      sortBy === "sks"
        ? coursesTable.sks
        : sortBy === "semester"
          ? coursesTable.semester
          : null;

    const orderExprs =
      sortCol === null
        ? sortOrder === "desc"
          ? [desc(kodePrefixExpr), desc(kodeNumExpr), desc(coursesTable.kode)]
          : [asc(kodePrefixExpr), asc(kodeNumExpr), asc(coursesTable.kode)]
        : sortOrder === "desc"
          ? [desc(sortCol), asc(kodePrefixExpr), asc(kodeNumExpr)]
          : [asc(sortCol), asc(kodePrefixExpr), asc(kodeNumExpr)];

    const [courses, totalResult] = await Promise.all([
      db
        .select({
          id: coursesTable.id,
          kode: coursesTable.kode,
          nama: coursesTable.nama,
          sks: coursesTable.sks,
          semester: coursesTable.semester,
          prodi: coursesTable.prodi,
          deskripsi: coursesTable.deskripsi,
          lecturerId: coursesTable.lecturerId,
          lecturerName: usersTable.name,
          createdAt: coursesTable.createdAt,
          updatedAt: coursesTable.updatedAt,
        })
        .from(coursesTable)
        .leftJoin(lecturersTable, eq(lecturersTable.id, coursesTable.lecturerId))
        .leftJoin(usersTable, eq(usersTable.id, lecturersTable.userId))
        .where(where)
        .orderBy(...orderExprs)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(coursesTable).where(where),
    ]);

    res.json({ courses, pagination: { page, limit, total: totalResult[0]?.total ?? 0, totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit) } });
  } catch (err) {
    req.log.error({ err }, "List courses error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/courses", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existing] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.kode, parsed.data.kode));
    if (existing) { res.status(409).json({ error: "Kode mata kuliah sudah digunakan" }); return; }

    const [course] = await db.insert(coursesTable).values(parsed.data as typeof coursesTable.$inferInsert).returning();
    res.status(201).json({ course });
  } catch (err) {
    req.log.error({ err }, "Create course error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/courses/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: coursesTable.id,
        kode: coursesTable.kode,
        nama: coursesTable.nama,
        sks: coursesTable.sks,
        semester: coursesTable.semester,
        prodi: coursesTable.prodi,
        deskripsi: coursesTable.deskripsi,
        lecturerId: coursesTable.lecturerId,
        lecturerName: usersTable.name,
        createdAt: coursesTable.createdAt,
        updatedAt: coursesTable.updatedAt,
      })
      .from(coursesTable)
      .leftJoin(lecturersTable, eq(lecturersTable.id, coursesTable.lecturerId))
      .leftJoin(usersTable, eq(usersTable.id, lecturersTable.userId))
      .where(eq(coursesTable.id, String(req.params.id)));

    if (!rows[0]) { res.status(404).json({ error: "Mata kuliah tidak ditemukan" }); return; }
    res.json({ course: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Get course error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/courses/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [updated] = await db
      .update(coursesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(coursesTable.id, String(req.params.id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Mata kuliah tidak ditemukan" }); return; }
    res.json({ course: updated });
  } catch (err) {
    req.log.error({ err }, "Update course error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/courses/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(coursesTable).where(eq(coursesTable.id, String(req.params.id))).returning({ id: coursesTable.id });
    if (!deleted) { res.status(404).json({ error: "Mata kuliah tidak ditemukan" }); return; }
    res.json({ message: "Mata kuliah berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete course error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
