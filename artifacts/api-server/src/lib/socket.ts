import type { Server as HTTPServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { studentsTable, lecturersTable, forumsTable, forumMessagesTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { logger } from "./logger";

const JWT_SECRET = process.env.JWT_SECRET!;

interface SocketUser {
  userId: string;
  email: string;
  role: "mahasiswa" | "dosen" | "admin";
  name: string;
  isSuperAdmin?: boolean;
}

declare module "socket.io" {
  interface SocketData {
    user?: SocketUser;
  }
}

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

async function computeAccessibleForumIds(user: SocketUser): Promise<string[]> {
  if (user.role === "admin") {
    const rows = await db.select({ id: forumsTable.id }).from(forumsTable).where(eq(forumsTable.isActive, true));
    return rows.map((r) => r.id);
  }
  let fakultas: string | null = null;
  let prodi: string | null = null;
  if (user.role === "mahasiswa") {
    const [s] = await db.select({ fakultas: studentsTable.fakultas, prodi: studentsTable.prodi }).from(studentsTable).where(eq(studentsTable.userId, user.userId));
    if (s) { fakultas = s.fakultas; prodi = s.prodi; }
  } else if (user.role === "dosen") {
    const [l] = await db.select({ fakultas: lecturersTable.fakultas, prodi: lecturersTable.prodi }).from(lecturersTable).where(eq(lecturersTable.userId, user.userId));
    if (l) { fakultas = l.fakultas; prodi = l.prodi; }
  }
  const conds = [eq(forumsTable.type, "global")];
  if (fakultas) conds.push(and(eq(forumsTable.type, "fakultas"), eq(forumsTable.fakultas, fakultas))!);
  if (fakultas && prodi) conds.push(and(eq(forumsTable.type, "prodi"), eq(forumsTable.fakultas, fakultas), eq(forumsTable.prodi, prodi))!);
  const rows = await db.select({ id: forumsTable.id }).from(forumsTable).where(and(eq(forumsTable.isActive, true), or(...conds)));
  return rows.map((r) => r.id);
}

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);

      if (!token) return next(new Error("Token tidak ditemukan"));

      const payload = jwt.verify(token, JWT_SECRET) as SocketUser & { type?: string };
      if (payload.type === "refresh") return next(new Error("Gunakan access token, bukan refresh token"));

      socket.data.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.name,
        isSuperAdmin: payload.isSuperAdmin,
      };
      next();
    } catch (err) {
      next(new Error("Token tidak valid"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const user = socket.data.user!;
    logger.info({ userId: user.userId, role: user.role, sid: socket.id }, "Socket connected");

    try {
      const forumIds = await computeAccessibleForumIds(user);
      for (const fid of forumIds) {
        socket.join(`forum:${fid}`);
      }
      socket.emit("joined_forums", { forumIds });
    } catch (err) {
      logger.error({ err }, "Failed to auto-join rooms");
    }

    socket.on("send_message", async (payload: { forumId: string; content: string }, ack?: (res: { ok: boolean; error?: string; message?: unknown }) => void) => {
      try {
        if (!payload?.forumId || !payload?.content || payload.content.length > 2000 || payload.content.length === 0) {
          ack?.({ ok: false, error: "Data pesan tidak valid" });
          return;
        }
        const [forum] = await db.select({ id: forumsTable.id, isActive: forumsTable.isActive }).from(forumsTable).where(eq(forumsTable.id, payload.forumId));
        if (!forum) {
          ack?.({ ok: false, error: "Forum tidak ditemukan" });
          return;
        }
        if (!forum.isActive) {
          ack?.({ ok: false, error: "Forum tidak aktif" });
          return;
        }
        if (user.role !== "admin") {
          const accessible = await computeAccessibleForumIds(user);
          if (!accessible.includes(payload.forumId)) {
            ack?.({ ok: false, error: "Akses ditolak" });
            return;
          }
        }

        const [msg] = await db
          .insert(forumMessagesTable)
          .values({ forumId: payload.forumId, userId: user.userId, content: payload.content })
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

        io!.to(`forum:${payload.forumId}`).emit("new_message", withUser);
        ack?.({ ok: true, message: withUser });
      } catch (err) {
        logger.error({ err }, "send_message failed");
        ack?.({ ok: false, error: "Internal error" });
      }
    });

    socket.on("typing", (payload: { forumId: string; isTyping: boolean }) => {
      if (!payload?.forumId) return;
      socket.to(`forum:${payload.forumId}`).emit("typing", {
        forumId: payload.forumId,
        userId: user.userId,
        userName: user.name,
        isTyping: !!payload.isTyping,
      });
    });

    socket.on("disconnect", () => {
      logger.info({ userId: user.userId, sid: socket.id }, "Socket disconnected");
    });
  });

  return io;
}
