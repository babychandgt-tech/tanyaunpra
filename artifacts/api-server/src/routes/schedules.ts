import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { schedulesTable, coursesTable, lecturersTable, usersTable } from "@workspace/db";
import { eq, and, SQL, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const DAY_ENUM = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
const TIMEZONE_ENUM = ["WIB", "WITA", "WIT"] as const;

const trimTime = (t: string) => t.length > 5 ? t.substring(0, 5) : t;

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  prodi: z.string().optional(),
  semester: z.string().optional(),
  tahunAjaran: z.string().optional(),
  lecturerId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  hari: z.enum(DAY_ENUM).optional(),
  kelas: z.string().optional(),
});

const createSchema = z.object({
  courseId: z.string().uuid(),
  lecturerId: z.string().uuid().optional(),
  hari: z.enum(DAY_ENUM),
  jamMulai: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format HH:MM"),
  jamSelesai: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format HH:MM"),
  ruangan: z.string().min(1).max(50),
  kelas: z.string().max(10).optional(),
  semester: z.string().min(1).max(20),
  tahunAjaran: z.string().min(4).max(20),
  timezone: z.enum(TIMEZONE_ENUM).default("WIB"),
});

const updateSchema = createSchema.partial();

const buildScheduleQuery = (where?: SQL) =>
  db
    .select({
      id: schedulesTable.id,
      courseId: schedulesTable.courseId,
      courseKode: coursesTable.kode,
      courseNama: coursesTable.nama,
      lecturerId: schedulesTable.lecturerId,
      lecturerName: usersTable.name,
      hari: schedulesTable.hari,
      jamMulai: schedulesTable.jamMulai,
      jamSelesai: schedulesTable.jamSelesai,
      ruangan: schedulesTable.ruangan,
      kelas: schedulesTable.kelas,
      semester: schedulesTable.semester,
      tahunAjaran: schedulesTable.tahunAjaran,
      timezone: schedulesTable.timezone,
      createdAt: schedulesTable.createdAt,
      updatedAt: schedulesTable.updatedAt,
    })
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(coursesTable.id, schedulesTable.courseId))
    .leftJoin(lecturersTable, eq(lecturersTable.id, schedulesTable.lecturerId))
    .leftJoin(usersTable, eq(usersTable.id, lecturersTable.userId))
    .where(where);

const formatSchedule = (s: Awaited<ReturnType<typeof buildScheduleQuery>>[number]) => ({
  ...s,
  jamMulai: trimTime(s.jamMulai),
  jamSelesai: trimTime(s.jamSelesai),
});

router.get("/schedules", requireAuth(), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, prodi, semester, tahunAjaran, lecturerId, courseId, hari, kelas } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conds: SQL[] = [];
    if (semester) conds.push(eq(schedulesTable.semester, semester));
    if (tahunAjaran) conds.push(eq(schedulesTable.tahunAjaran, tahunAjaran));
    if (lecturerId) conds.push(eq(schedulesTable.lecturerId, lecturerId));
    if (courseId) conds.push(eq(schedulesTable.courseId, courseId));
    if (hari) conds.push(eq(schedulesTable.hari, hari));
    if (kelas) conds.push(eq(schedulesTable.kelas, kelas));
    if (prodi) conds.push(eq(coursesTable.prodi, prodi));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const [schedules, totalResult] = await Promise.all([
      buildScheduleQuery(where).limit(limit).offset(offset),
      db
        .select({ total: count() })
        .from(schedulesTable)
        .leftJoin(coursesTable, eq(coursesTable.id, schedulesTable.courseId))
        .where(where),
    ]);

    res.json({ schedules: schedules.map(formatSchedule), pagination: { page, limit, total: totalResult[0]?.total ?? 0, totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit) } });
  } catch (err) {
    req.log.error({ err }, "List schedules error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/schedules", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [inserted] = await db
      .insert(schedulesTable)
      .values(parsed.data as typeof schedulesTable.$inferInsert)
      .returning({ id: schedulesTable.id });
    const rows = await buildScheduleQuery(eq(schedulesTable.id, inserted.id));
    res.status(201).json({ schedule: formatSchedule(rows[0]) });
  } catch (err) {
    req.log.error({ err }, "Create schedule error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/schedules/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const rows = await buildScheduleQuery(eq(schedulesTable.id, String(req.params.id)));
    if (!rows[0]) { res.status(404).json({ error: "Jadwal tidak ditemukan" }); return; }
    res.json({ schedule: formatSchedule(rows[0]) });
  } catch (err) {
    req.log.error({ err }, "Get schedule error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/schedules/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    await db
      .update(schedulesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schedulesTable.id, String(req.params.id)));
    const rows = await buildScheduleQuery(eq(schedulesTable.id, String(req.params.id)));
    if (!rows[0]) { res.status(404).json({ error: "Jadwal tidak ditemukan" }); return; }
    res.json({ schedule: formatSchedule(rows[0]) });
  } catch (err) {
    req.log.error({ err }, "Update schedule error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/schedules/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(schedulesTable).where(eq(schedulesTable.id, String(req.params.id))).returning({ id: schedulesTable.id });
    if (!deleted) { res.status(404).json({ error: "Jadwal tidak ditemukan" }); return; }
    res.json({ message: "Jadwal berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete schedule error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
