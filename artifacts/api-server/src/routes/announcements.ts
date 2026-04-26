import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { announcementsTable, usersTable } from "@workspace/db";
import { eq, ilike, and, desc, SQL, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const KATEGORI = ["Akademik", "Kemahasiswaan", "Keuangan", "Umum", "Beasiswa"] as const;

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kategori: z.enum(KATEGORI).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

const createSchema = z.object({
  judul: z.string().min(5).max(300),
  konten: z.string().min(10).max(10000),
  kategori: z.enum(KATEGORI).default("Umum"),
  isActive: z.boolean().default(true),
  publishedAt: z.coerce.date().optional(),
});

const updateSchema = createSchema.partial();

router.get("/announcements", requireAuth(), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, kategori, isActive, search } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conds: SQL[] = [];
    if (kategori) conds.push(eq(announcementsTable.kategori, kategori));
    if (isActive !== undefined) conds.push(eq(announcementsTable.isActive, isActive === "true"));
    if (search) conds.push(ilike(announcementsTable.judul, `%${search}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const [announcements, totalResult] = await Promise.all([
      db
        .select({
          id: announcementsTable.id,
          judul: announcementsTable.judul,
          konten: announcementsTable.konten,
          kategori: announcementsTable.kategori,
          authorId: announcementsTable.authorId,
          authorName: usersTable.name,
          isActive: announcementsTable.isActive,
          publishedAt: announcementsTable.publishedAt,
          createdAt: announcementsTable.createdAt,
          updatedAt: announcementsTable.updatedAt,
        })
        .from(announcementsTable)
        .leftJoin(usersTable, eq(usersTable.id, announcementsTable.authorId))
        .where(where)
        .orderBy(desc(announcementsTable.publishedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(announcementsTable).where(where),
    ]);

    res.json({ announcements, pagination: { page, limit, total: totalResult[0]?.total ?? 0, totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit) } });
  } catch (err) {
    req.log.error({ err }, "List announcements error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/announcements", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [announcement] = await db
      .insert(announcementsTable)
      .values({
        ...parsed.data,
        authorId: req.user!.userId,
        publishedAt: parsed.data.publishedAt ?? new Date(),
      } as typeof announcementsTable.$inferInsert)
      .returning();
    res.status(201).json({ announcement });
  } catch (err) {
    req.log.error({ err }, "Create announcement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/announcements/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: announcementsTable.id,
        judul: announcementsTable.judul,
        konten: announcementsTable.konten,
        kategori: announcementsTable.kategori,
        authorId: announcementsTable.authorId,
        authorName: usersTable.name,
        isActive: announcementsTable.isActive,
        publishedAt: announcementsTable.publishedAt,
        createdAt: announcementsTable.createdAt,
        updatedAt: announcementsTable.updatedAt,
      })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(usersTable.id, announcementsTable.authorId))
      .where(eq(announcementsTable.id, String(req.params.id)));

    if (!rows[0]) { res.status(404).json({ error: "Pengumuman tidak ditemukan" }); return; }
    res.json({ announcement: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Get announcement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/announcements/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existing] = await db.select({ authorId: announcementsTable.authorId }).from(announcementsTable).where(eq(announcementsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Pengumuman tidak ditemukan" }); return; }

    if (req.user!.role === "dosen" && existing.authorId !== req.user!.userId) {
      res.status(403).json({ error: "Anda hanya dapat mengedit pengumuman yang Anda buat" });
      return;
    }

    const [updated] = await db.update(announcementsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(announcementsTable.id, id)).returning();
    res.json({ announcement: updated });
  } catch (err) {
    req.log.error({ err }, "Update announcement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/announcements/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [existing] = await db.select({ authorId: announcementsTable.authorId }).from(announcementsTable).where(eq(announcementsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Pengumuman tidak ditemukan" }); return; }

    if (req.user!.role === "dosen" && existing.authorId !== req.user!.userId) {
      res.status(403).json({ error: "Anda hanya dapat menghapus pengumuman yang Anda buat" });
      return;
    }

    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    res.json({ message: "Pengumuman berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete announcement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
