import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { lecturersTable, usersTable } from "@workspace/db";
import { eq, ilike, and, SQL, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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
      createdAt: lecturersTable.createdAt,
      updatedAt: lecturersTable.updatedAt,
    })
    .from(lecturersTable)
    .leftJoin(usersTable, eq(usersTable.id, lecturersTable.userId))
    .where(where);

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
