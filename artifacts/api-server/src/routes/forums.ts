import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  forumsTable,
  forumMessagesTable,
  usersTable,
  studentsTable,
  lecturersTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, count, lt, SQL } from "drizzle-orm";
import { requireAuth, requireApiKeyOrAuth } from "../middlewares/auth";

const router: IRouter = Router();

const FORUM_TYPES = ["global", "fakultas", "prodi"] as const;

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  scope: z.enum(["mine", "all"]).optional(),
});

const createSchema = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional(),
    type: z.enum(FORUM_TYPES),
    fakultas: z.string().max(150).optional().nullable(),
    prodi: z.string().max(150).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "fakultas" && !data.fakultas) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fakultas wajib diisi untuk forum tipe fakultas", path: ["fakultas"] });
    }
    if (data.type === "prodi" && (!data.fakultas || !data.prodi)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fakultas & prodi wajib diisi untuk forum tipe prodi", path: ["prodi"] });
    }
  });

const updateSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const messageListSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

async function getUserScope(userId: string, role: string): Promise<{ fakultas: string | null; prodi: string | null }> {
  if (role === "mahasiswa") {
    const [s] = await db.select({ fakultas: studentsTable.fakultas, prodi: studentsTable.prodi }).from(studentsTable).where(eq(studentsTable.userId, userId));
    return s ? { fakultas: s.fakultas, prodi: s.prodi } : { fakultas: null, prodi: null };
  }
  if (role === "dosen") {
    const [l] = await db.select({ fakultas: lecturersTable.fakultas, prodi: lecturersTable.prodi }).from(lecturersTable).where(eq(lecturersTable.userId, userId));
    return l ? { fakultas: l.fakultas, prodi: l.prodi } : { fakultas: null, prodi: null };
  }
  return { fakultas: null, prodi: null };
}

export async function getAccessibleForumIds(userId: string, role: string): Promise<string[]> {
  if (role === "admin") {
    const rows = await db.select({ id: forumsTable.id }).from(forumsTable).where(eq(forumsTable.isActive, true));
    return rows.map((r) => r.id);
  }
  const scope = await getUserScope(userId, role);
  const conds: SQL[] = [eq(forumsTable.type, "global")];
  if (scope.fakultas) {
    conds.push(and(eq(forumsTable.type, "fakultas"), eq(forumsTable.fakultas, scope.fakultas))!);
  }
  if (scope.fakultas && scope.prodi) {
    conds.push(and(eq(forumsTable.type, "prodi"), eq(forumsTable.fakultas, scope.fakultas), eq(forumsTable.prodi, scope.prodi))!);
  }
  const rows = await db.select({ id: forumsTable.id }).from(forumsTable).where(and(eq(forumsTable.isActive, true), or(...conds)));
  return rows.map((r) => r.id);
}

router.get("/forums", requireApiKeyOrAuth(), async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { page, limit, scope } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const isAdmin = req.user?.role === "admin";
    let where: SQL | undefined = undefined;

    if (req.user) {
      if (scope === "all" && isAdmin) {
        where = undefined;
      } else {
        const accessibleIds = await getAccessibleForumIds(req.user.userId, req.user.role);
        if (accessibleIds.length === 0) {
          res.json({ forums: [], pagination: { page, limit, total: 0, totalPages: 0 } });
          return;
        }
        const idConds = accessibleIds.map((id) => eq(forumsTable.id, id));
        where = and(eq(forumsTable.isActive, true), or(...idConds));
      }
    } else {
      where = eq(forumsTable.isActive, true);
    }

    const [rows, totalRes] = await Promise.all([
      db
        .select({
          id: forumsTable.id,
          name: forumsTable.name,
          description: forumsTable.description,
          type: forumsTable.type,
          fakultas: forumsTable.fakultas,
          prodi: forumsTable.prodi,
          isActive: forumsTable.isActive,
          createdBy: forumsTable.createdBy,
          createdByName: usersTable.name,
          createdAt: forumsTable.createdAt,
          updatedAt: forumsTable.updatedAt,
        })
        .from(forumsTable)
        .leftJoin(usersTable, eq(usersTable.id, forumsTable.createdBy))
        .where(where)
        .orderBy(asc(forumsTable.type), asc(forumsTable.name))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(forumsTable).where(where),
    ]);

    res.json({
      forums: rows,
      pagination: { page, limit, total: totalRes[0]?.total ?? 0, totalPages: Math.ceil((totalRes[0]?.total ?? 0) / limit) },
    });
  } catch (err) {
    req.log.error({ err }, "List forums error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forums", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [forum] = await db
      .insert(forumsTable)
      .values({
        ...parsed.data,
        fakultas: parsed.data.fakultas ?? null,
        prodi: parsed.data.prodi ?? null,
        createdBy: req.user!.userId,
      } as typeof forumsTable.$inferInsert)
      .returning();
    res.status(201).json({ forum });
  } catch (err) {
    req.log.error({ err }, "Create forum error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/forums/:id", requireApiKeyOrAuth(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [forum] = await db
      .select({
        id: forumsTable.id,
        name: forumsTable.name,
        description: forumsTable.description,
        type: forumsTable.type,
        fakultas: forumsTable.fakultas,
        prodi: forumsTable.prodi,
        isActive: forumsTable.isActive,
        createdBy: forumsTable.createdBy,
        createdByName: usersTable.name,
        createdAt: forumsTable.createdAt,
        updatedAt: forumsTable.updatedAt,
      })
      .from(forumsTable)
      .leftJoin(usersTable, eq(usersTable.id, forumsTable.createdBy))
      .where(eq(forumsTable.id, id));

    if (!forum) {
      res.status(404).json({ error: "Forum tidak ditemukan" });
      return;
    }

    if (req.user && req.user.role !== "admin") {
      const accessible = await getAccessibleForumIds(req.user.userId, req.user.role);
      if (!accessible.includes(id)) {
        res.status(403).json({ error: "Anda tidak punya akses ke forum ini" });
        return;
      }
    }

    res.json({ forum });
  } catch (err) {
    req.log.error({ err }, "Get forum error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forums/:id", requireAuth(["admin", "dosen"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const [existing] = await db.select().from(forumsTable).where(eq(forumsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Forum tidak ditemukan" });
      return;
    }
    const [updated] = await db
      .update(forumsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(forumsTable.id, id))
      .returning();
    res.json({ forum: updated });
  } catch (err) {
    req.log.error({ err }, "Update forum error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/forums/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [deleted] = await db.delete(forumsTable).where(eq(forumsTable.id, id)).returning({ id: forumsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Forum tidak ditemukan" });
      return;
    }
    res.json({ message: "Forum berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete forum error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/forums/:id/messages", requireApiKeyOrAuth(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = messageListSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parameter tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const [forum] = await db.select({ id: forumsTable.id, isActive: forumsTable.isActive }).from(forumsTable).where(eq(forumsTable.id, id));
    if (!forum) {
      res.status(404).json({ error: "Forum tidak ditemukan" });
      return;
    }
    if (req.user && req.user.role !== "admin") {
      const accessible = await getAccessibleForumIds(req.user.userId, req.user.role);
      if (!accessible.includes(id)) {
        res.status(403).json({ error: "Anda tidak punya akses ke forum ini" });
        return;
      }
    }

    const conds: SQL[] = [eq(forumMessagesTable.forumId, id)];
    if (parsed.data.before) {
      conds.push(lt(forumMessagesTable.createdAt, new Date(parsed.data.before)));
    }
    const rows = await db
      .select({
        id: forumMessagesTable.id,
        forumId: forumMessagesTable.forumId,
        userId: forumMessagesTable.userId,
        userName: usersTable.name,
        userRole: usersTable.role,
        content: forumMessagesTable.content,
        createdAt: forumMessagesTable.createdAt,
      })
      .from(forumMessagesTable)
      .leftJoin(usersTable, eq(usersTable.id, forumMessagesTable.userId))
      .where(and(...conds))
      .orderBy(desc(forumMessagesTable.createdAt))
      .limit(parsed.data.limit);

    res.json({ messages: rows.reverse() });
  } catch (err) {
    req.log.error({ err }, "List forum messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forums/:id/messages", requireApiKeyOrAuth(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.flatten().fieldErrors });
    return;
  }
  if (!req.user) {
    res.status(401).json({ error: "Hanya user terautentikasi (JWT) yang bisa kirim pesan" });
    return;
  }
  try {
    const [forum] = await db.select({ id: forumsTable.id, isActive: forumsTable.isActive }).from(forumsTable).where(eq(forumsTable.id, id));
    if (!forum) {
      res.status(404).json({ error: "Forum tidak ditemukan" });
      return;
    }
    if (!forum.isActive) {
      res.status(403).json({ error: "Forum sedang tidak aktif" });
      return;
    }
    if (req.user.role !== "admin") {
      const accessible = await getAccessibleForumIds(req.user.userId, req.user.role);
      if (!accessible.includes(id)) {
        res.status(403).json({ error: "Anda tidak punya akses ke forum ini" });
        return;
      }
    }

    const [msg] = await db
      .insert(forumMessagesTable)
      .values({ forumId: id, userId: req.user.userId, content: parsed.data.content })
      .returning();

    const [withUser] = await db
      .select({
        id: forumMessagesTable.id,
        forumId: forumMessagesTable.forumId,
        userId: forumMessagesTable.userId,
        userName: usersTable.name,
        userRole: usersTable.role,
        content: forumMessagesTable.content,
        createdAt: forumMessagesTable.createdAt,
      })
      .from(forumMessagesTable)
      .leftJoin(usersTable, eq(usersTable.id, forumMessagesTable.userId))
      .where(eq(forumMessagesTable.id, msg.id));

    // Broadcast via socket.io if server is initialized
    try {
      const { getIO } = await import("../lib/socket");
      const io = getIO();
      if (io) {
        io.to(`forum:${id}`).emit("new_message", withUser);
      }
    } catch (err) {
      req.log.warn({ err }, "Socket broadcast failed");
    }

    res.status(201).json({ message: withUser });
  } catch (err) {
    req.log.error({ err }, "Create forum message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/forums/:forumId/messages/:messageId", requireAuth(["admin"]), async (req: Request, res: Response) => {
  const forumId = String(req.params.forumId);
  const messageId = String(req.params.messageId);
  try {
    const [deleted] = await db
      .delete(forumMessagesTable)
      .where(and(eq(forumMessagesTable.id, messageId), eq(forumMessagesTable.forumId, forumId)))
      .returning({ id: forumMessagesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Pesan tidak ditemukan" });
      return;
    }
    try {
      const { getIO } = await import("../lib/socket");
      const io = getIO();
      if (io) io.to(`forum:${forumId}`).emit("delete_message", { id: messageId });
    } catch {}
    res.json({ message: "Pesan berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Delete forum message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
