import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { intentsTable } from "@workspace/db";
import { eq, desc, count, ilike, or, and, SQL } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const createIntentSchema = z.object({
  pertanyaan: z.string().min(5, "Pertanyaan minimal 5 karakter").max(500),
  jawaban: z.string().min(10, "Jawaban minimal 10 karakter").max(2000),
  kategori: z.string().min(1).max(100).default("Umum"),
  keywords: z.array(z.string().max(50)).max(20).optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  isActive: z.boolean().default(true),
});

const updateIntentSchema = createIntentSchema.partial();

const listIntentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kategori: z.string().optional(),
  search: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

router.get("/intents", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const parsed = listIntentsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { page, limit, kategori, search, isActive } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions: SQL[] = [];
    if (kategori) conditions.push(eq(intentsTable.kategori, kategori));
    if (isActive !== undefined) conditions.push(eq(intentsTable.isActive, isActive === "true"));
    if (search) {
      conditions.push(
        or(
          ilike(intentsTable.pertanyaan, `%${search}%`),
          ilike(intentsTable.jawaban, `%${search}%`)
        ) as SQL
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [intents, totalResult] = await Promise.all([
      db
        .select()
        .from(intentsTable)
        .where(whereClause)
        .orderBy(desc(intentsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(intentsTable).where(whereClause),
    ]);

    res.json({
      intents,
      pagination: {
        page,
        limit,
        total: totalResult[0]?.total ?? 0,
        totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    req.log.error({ err }, "List intents error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intents", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = createIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const [intent] = await db
      .insert(intentsTable)
      .values({
        pertanyaan: parsed.data.pertanyaan,
        jawaban: parsed.data.jawaban,
        kategori: parsed.data.kategori,
        keywords: parsed.data.keywords ?? [],
        confidence: parsed.data.confidence,
        isActive: parsed.data.isActive,
      })
      .returning();

    res.status(201).json({ intent });
  } catch (err) {
    req.log.error({ err }, "Create intent error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/intents/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [intent] = await db
      .select()
      .from(intentsTable)
      .where(eq(intentsTable.id, id));

    if (!intent) {
      res.status(404).json({ error: "Intent tidak ditemukan" });
      return;
    }
    res.json({ intent });
  } catch (err) {
    req.log.error({ err }, "Get intent error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/intents/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const [updated] = await db
      .update(intentsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(intentsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Intent tidak ditemukan" });
      return;
    }
    res.json({ intent: updated });
  } catch (err) {
    req.log.error({ err }, "Update intent error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/intents/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [deleted] = await db
      .delete(intentsTable)
      .where(eq(intentsTable.id, id))
      .returning({ id: intentsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Intent tidak ditemukan" });
      return;
    }
    res.json({ message: "Intent berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete intent error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
