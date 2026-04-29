import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { academicCalendarTable } from "@workspace/db";
import { eq, and, gte, lte, SQL, count, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { computeActiveAcademicTerm } from "../utils/academic-term";

const router: IRouter = Router();

const EVENT_TYPES = ["UTS", "UAS", "Libur", "Registrasi", "KRS", "Wisuda", "Lainnya"] as const;

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  tahunAjaran: z.string().optional(),
  tipe: z.enum(EVENT_TYPES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createSchema = z.object({
  namaEvent: z.string().min(3).max(200),
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tipe: z.enum(EVENT_TYPES),
  deskripsi: z.string().max(1000).optional(),
  tahunAjaran: z.string().min(4).max(20),
});

const updateSchema = createSchema.partial();

router.get("/academic-calendar", requireAuth(), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, tahunAjaran, tipe, from, to } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conds: SQL[] = [];
    if (tahunAjaran) conds.push(eq(academicCalendarTable.tahunAjaran, tahunAjaran));
    if (tipe) conds.push(eq(academicCalendarTable.tipe, tipe));
    if (from) conds.push(gte(academicCalendarTable.tanggalMulai, from));
    if (to) conds.push(lte(academicCalendarTable.tanggalSelesai, to));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const [events, totalResult] = await Promise.all([
      db.select().from(academicCalendarTable).where(where).orderBy(asc(academicCalendarTable.tanggalMulai)).limit(limit).offset(offset),
      db.select({ total: count() }).from(academicCalendarTable).where(where),
    ]);

    res.json({ events, pagination: { page, limit, total: totalResult[0]?.total ?? 0, totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit) } });
  } catch (err) {
    req.log.error({ err }, "List academic calendar error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/academic-calendar", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [event] = await db.insert(academicCalendarTable).values(parsed.data as typeof academicCalendarTable.$inferInsert).returning();
    res.status(201).json({ event });
  } catch (err) {
    req.log.error({ err }, "Create calendar event error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/academic-calendar/active", requireAuth(), async (_req: Request, res: Response) => {
  const now = new Date();
  const term = computeActiveAcademicTerm(now);
  res.json({
    tahunAjaran: term.tahunAjaran,
    semesterType: term.semesterType,
    startDate: term.startDate,
    endDate: term.endDate,
    serverDate: now.toISOString(),
  });
});

router.get("/academic-calendar/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const [event] = await db.select().from(academicCalendarTable).where(eq(academicCalendarTable.id, String(req.params.id)));
    if (!event) { res.status(404).json({ error: "Event tidak ditemukan" }); return; }
    res.json({ event });
  } catch (err) {
    req.log.error({ err }, "Get calendar event error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/academic-calendar/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [updated] = await db.update(academicCalendarTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(academicCalendarTable.id, String(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Event tidak ditemukan" }); return; }
    res.json({ event: updated });
  } catch (err) {
    req.log.error({ err }, "Update calendar event error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/academic-calendar/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(academicCalendarTable).where(eq(academicCalendarTable.id, String(req.params.id))).returning({ id: academicCalendarTable.id });
    if (!deleted) { res.status(404).json({ error: "Event tidak ditemukan" }); return; }
    res.json({ message: "Event kalender berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete calendar event error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
