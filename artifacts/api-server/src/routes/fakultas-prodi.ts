import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { fakultasTable, prodiTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ─── FAKULTAS ───────────────────────────────────────────────────

router.get("/fakultas", requireAuth(), async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(fakultasTable).orderBy(asc(fakultasTable.name));
    res.json({ fakultas: list });
  } catch (err) {
    req.log.error({ err }, "List fakultas error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/fakultas", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(200),
    singkatan: z.string().min(1).max(20),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existing] = await db.select({ id: fakultasTable.id }).from(fakultasTable).where(eq(fakultasTable.name, parsed.data.name));
    if (existing) { res.status(409).json({ error: "Fakultas sudah terdaftar" }); return; }
    const [created] = await db.insert(fakultasTable).values(parsed.data).returning();
    res.status(201).json({ fakultas: created });
  } catch (err) {
    req.log.error({ err }, "Create fakultas error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/fakultas/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(200).optional(),
    singkatan: z.string().min(1).max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [updated] = await db
      .update(fakultasTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(fakultasTable.id, String(req.params.id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Fakultas tidak ditemukan" }); return; }
    res.json({ fakultas: updated });
  } catch (err) {
    req.log.error({ err }, "Update fakultas error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/fakultas/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db
      .delete(fakultasTable)
      .where(eq(fakultasTable.id, String(req.params.id)))
      .returning({ id: fakultasTable.id });
    if (!deleted) { res.status(404).json({ error: "Fakultas tidak ditemukan" }); return; }
    res.json({ message: "Fakultas berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete fakultas error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PRODI ──────────────────────────────────────────────────────

router.get("/prodi", requireAuth(), async (req: Request, res: Response) => {
  try {
    const fakultasId = req.query.fakultasId as string | undefined;
    const list = await db
      .select({
        id: prodiTable.id,
        name: prodiTable.name,
        singkatan: prodiTable.singkatan,
        fakultasId: prodiTable.fakultasId,
        fakultasName: fakultasTable.name,
        fakultasSingkatan: fakultasTable.singkatan,
        createdAt: prodiTable.createdAt,
        updatedAt: prodiTable.updatedAt,
      })
      .from(prodiTable)
      .leftJoin(fakultasTable, eq(prodiTable.fakultasId, fakultasTable.id))
      .where(fakultasId ? eq(prodiTable.fakultasId, fakultasId) : undefined)
      .orderBy(asc(prodiTable.name));
    res.json({ prodi: list });
  } catch (err) {
    req.log.error({ err }, "List prodi error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/prodi", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(200),
    singkatan: z.string().min(1).max(20),
    fakultasId: z.string().uuid(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existingFakultas] = await db.select({ id: fakultasTable.id }).from(fakultasTable).where(eq(fakultasTable.id, parsed.data.fakultasId));
    if (!existingFakultas) { res.status(404).json({ error: "Fakultas tidak ditemukan" }); return; }

    const [created] = await db.insert(prodiTable).values(parsed.data).returning();
    res.status(201).json({ prodi: created });
  } catch (err) {
    req.log.error({ err }, "Create prodi error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/prodi/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(200).optional(),
    singkatan: z.string().min(1).max(20).optional(),
    fakultasId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [updated] = await db
      .update(prodiTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(prodiTable.id, String(req.params.id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Prodi tidak ditemukan" }); return; }
    res.json({ prodi: updated });
  } catch (err) {
    req.log.error({ err }, "Update prodi error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/prodi/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const [deleted] = await db
      .delete(prodiTable)
      .where(eq(prodiTable.id, String(req.params.id)))
      .returning({ id: prodiTable.id });
    if (!deleted) { res.status(404).json({ error: "Prodi tidak ditemukan" }); return; }
    res.json({ message: "Prodi berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete prodi error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
