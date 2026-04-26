import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  chatSessionsTable,
  chatMessagesTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, and, or, gte, lte, sql, count, SQL, ilike } from "drizzle-orm";
import { requireAuth, requireApiKey, requireApiKeyOrAuth } from "../middlewares/auth";
import { matchIntent } from "../lib/intentMatcher";
import { askQwen } from "../lib/qwen";
import { retrieveContext } from "../lib/contextRetriever";

const router: IRouter = Router();

const askSchema = z.object({
  question: z.string().min(1, "Pertanyaan tidak boleh kosong").max(2000, "Pertanyaan terlalu panjang"),
  sessionId: z.string().uuid("Session ID tidak valid").optional(),
  deviceInfo: z.string().max(255).optional(),
});

const LOW_CONFIDENCE_THRESHOLD = 0.4;

router.post("/chat/ask", requireApiKeyOrAuth(), async (req: Request, res: Response) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { question, sessionId, deviceInfo } = parsed.data;

  try {
    let currentSessionId = sessionId;

    if (currentSessionId) {
      const [existing] = await db
        .select({ id: chatSessionsTable.id })
        .from(chatSessionsTable)
        .where(eq(chatSessionsTable.id, currentSessionId));
      if (!existing) currentSessionId = undefined;
    }

    const resolvedDeviceInfo =
      deviceInfo ?? (req.headers["user-agent"] as string | undefined) ?? null;

    if (!currentSessionId) {
      const [newSession] = await db
        .insert(chatSessionsTable)
        .values({ deviceInfo: resolvedDeviceInfo })
        .returning({ id: chatSessionsTable.id });
      currentSessionId = newSession.id;
    }

    const recentMessages = await db
      .select({ role: chatMessagesTable.role, content: chatMessagesTable.content })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, currentSessionId))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(6);

    const history = recentMessages
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const intentResult = await matchIntent(question);

    let answer: string;
    let answerSource: "intent" | "ai" | "fallback";
    let confidence: number;

    if (intentResult.matched && intentResult.answer) {
      answer = intentResult.answer;
      answerSource = "intent";
      confidence = intentResult.confidence;
    } else {
      try {
        const dbContext = await retrieveContext(question).catch(() => "");
        const qwenResult = await askQwen(question, history, dbContext || undefined);
        answer = qwenResult.answer;
        answerSource = "ai";
        confidence = dbContext ? 0.85 : 0.75;
      } catch (err) {
        req.log.error({ err }, "Qwen API error — using fallback");
        answer = "Maaf, layanan AI saat ini tidak tersedia. Silakan coba beberapa saat lagi atau hubungi bagian akademik UNPRA secara langsung.";
        answerSource = "fallback";
        confidence = 0;
      }
    }

    const needsReview = confidence < LOW_CONFIDENCE_THRESHOLD || answerSource === "fallback";

    await db.insert(chatMessagesTable).values([
      {
        sessionId: currentSessionId,
        role: "user",
        content: question,
        answerSource: null,
        confidence: null,
        needsReview: false,
      } as typeof chatMessagesTable.$inferInsert,
      {
        sessionId: currentSessionId,
        role: "assistant",
        content: answer,
        answerSource,
        confidence,
        needsReview,
      } as typeof chatMessagesTable.$inferInsert,
    ]);

    await db
      .update(chatSessionsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatSessionsTable.id, currentSessionId));

    res.json({
      answer,
      sessionId: currentSessionId,
      source: answerSource,
      confidence: Math.round(confidence * 100) / 100,
      needsReview,
    });
  } catch (err) {
    req.log.error({ err }, "Chat ask error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/sessions", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const pageSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      .optional(),
    search: z.string().optional(),
    userSearch: z.string().optional(),
  });

  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { page, limit, date, search, userSearch } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions: SQL[] = [];
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(chatSessionsTable.createdAt, startOfDay));
      conditions.push(lte(chatSessionsTable.createdAt, endOfDay));
    }
    if (search) {
      conditions.push(ilike(chatSessionsTable.deviceInfo, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [sessions, totalResult] = await Promise.all([
      db
        .select({
          id: chatSessionsTable.id,
          userId: chatSessionsTable.userId,
          deviceInfo: chatSessionsTable.deviceInfo,
          lastMessageAt: chatSessionsTable.lastMessageAt,
          createdAt: chatSessionsTable.createdAt,
          messageCount: count(chatMessagesTable.id),
          userName: usersTable.name,
          userEmail: usersTable.email,
        })
        .from(chatSessionsTable)
        .leftJoin(chatMessagesTable, eq(chatMessagesTable.sessionId, chatSessionsTable.id))
        .leftJoin(usersTable, eq(usersTable.id, chatSessionsTable.userId))
        .where(
          userSearch
            ? and(whereClause, or(
                ilike(usersTable.name, `%${userSearch}%`),
                ilike(usersTable.email, `%${userSearch}%`),
              ))
            : whereClause
        )
        .groupBy(chatSessionsTable.id, usersTable.name, usersTable.email)
        .orderBy(desc(chatSessionsTable.lastMessageAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(chatSessionsTable)
        .leftJoin(usersTable, eq(usersTable.id, chatSessionsTable.userId))
        .where(
          userSearch
            ? and(whereClause, or(
                ilike(usersTable.name, `%${userSearch}%`),
                ilike(usersTable.email, `%${userSearch}%`),
              ))
            : whereClause
        ),
    ]);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total: totalResult[0]?.total ?? 0,
        totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    req.log.error({ err }, "List sessions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/sessions/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);

  try {
    const [sessionRow, messages] = await Promise.all([
      db
        .select({
          id: chatSessionsTable.id,
          userId: chatSessionsTable.userId,
          deviceInfo: chatSessionsTable.deviceInfo,
          lastMessageAt: chatSessionsTable.lastMessageAt,
          createdAt: chatSessionsTable.createdAt,
          messageCount: count(chatMessagesTable.id),
        })
        .from(chatSessionsTable)
        .leftJoin(chatMessagesTable, eq(chatMessagesTable.sessionId, chatSessionsTable.id))
        .where(eq(chatSessionsTable.id, id))
        .groupBy(chatSessionsTable.id),
      db
        .select()
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.sessionId, id))
        .orderBy(chatMessagesTable.createdAt),
    ]);

    const session = sessionRow[0];
    if (!session) {
      res.status(404).json({ error: "Session tidak ditemukan" });
      return;
    }

    res.json({ session, messages });
  } catch (err) {
    req.log.error({ err }, "Get session detail error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/chat/messages/:id/flag", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const schema = z.object({ needsReview: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    await db
      .update(chatMessagesTable)
      .set({ needsReview: parsed.data.needsReview })
      .where(eq(chatMessagesTable.id, id));
    res.json({ message: "Status review berhasil diperbarui" });
  } catch (err) {
    req.log.error({ err }, "Flag message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/stats", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      todaySessions,
      weekSessions,
      todayMessages,
      needsReviewCount,
      sourceBreakdown,
      lowConfidenceSessions,
      popularTopicsWeek,
      dailyBreakdown,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(chatSessionsTable)
        .where(gte(chatSessionsTable.createdAt, startOfToday)),
      db
        .select({ count: count() })
        .from(chatSessionsTable)
        .where(gte(chatSessionsTable.createdAt, startOfWeek)),
      db
        .select({ count: count() })
        .from(chatMessagesTable)
        .where(and(gte(chatMessagesTable.createdAt, startOfToday), eq(chatMessagesTable.role, "user"))),
      db
        .select({ count: count() })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.needsReview, true)),
      db
        .select({
          source: chatMessagesTable.answerSource,
          count: count(),
        })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.role, "assistant"))
        .groupBy(chatMessagesTable.answerSource),
      db
        .select({
          sessionId: chatMessagesTable.sessionId,
          avgConfidence: sql<number>`AVG(${chatMessagesTable.confidence})`,
        })
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.role, "assistant"),
            gte(chatMessagesTable.createdAt, startOfWeek)
          )
        )
        .groupBy(chatMessagesTable.sessionId)
        .having(sql`AVG(${chatMessagesTable.confidence}) < ${LOW_CONFIDENCE_THRESHOLD}`)
        .limit(10),
      db
        .select({
          content: chatMessagesTable.content,
          count: count(),
        })
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.role, "user"),
            gte(chatMessagesTable.createdAt, startOfWeek)
          )
        )
        .groupBy(chatMessagesTable.content)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({
          day: sql<string>`DATE(${chatSessionsTable.createdAt})`,
          count: count(),
        })
        .from(chatSessionsTable)
        .where(gte(chatSessionsTable.createdAt, sevenDaysAgo))
        .groupBy(sql`DATE(${chatSessionsTable.createdAt})`)
        .orderBy(sql`DATE(${chatSessionsTable.createdAt})`),
    ]);

    const dailyTrendMap: Record<string, number> = {};
    for (const row of dailyBreakdown) {
      if (row.day) dailyTrendMap[row.day] = row.count;
    }
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, sessions: dailyTrendMap[key] ?? 0 };
    });

    res.json({
      today: {
        sessions: todaySessions[0]?.count ?? 0,
        messages: todayMessages[0]?.count ?? 0,
      },
      week: {
        sessions: weekSessions[0]?.count ?? 0,
      },
      needsReview: needsReviewCount[0]?.count ?? 0,
      dailyTrend,
      sourceBreakdown: sourceBreakdown.reduce(
        (acc, row) => {
          if (row.source) acc[row.source] = row.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      popularTopics: popularTopicsWeek.map((row) => ({
        question: row.content,
        count: row.count,
      })),
      lowConfidenceSessions: lowConfidenceSessions.map((s) => ({
        sessionId: s.sessionId,
        avgConfidence: Math.round((s.avgConfidence ?? 0) * 100) / 100,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
