import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  studentsTable,
  lecturersTable,
  coursesTable,
  announcementsTable,
  academicCalendarTable,
  chatMessagesTable,
  chatSessionsTable,
} from "@workspace/db";
import { eq, gte, count, desc, and, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0]!;

    const [
      studentCount,
      lecturerCount,
      courseCount,
      announcementCount,
      recentAnnouncements,
      upcomingEvents,
      chatStatsToday,
    ] = await Promise.all([
      db.select({ count: count() }).from(studentsTable),
      db.select({ count: count() }).from(lecturersTable),
      db.select({ count: count() }).from(coursesTable),
      db.select({ count: count() }).from(announcementsTable).where(eq(announcementsTable.isActive, true)),
      db
        .select({
          id: announcementsTable.id,
          judul: announcementsTable.judul,
          kategori: announcementsTable.kategori,
          publishedAt: announcementsTable.publishedAt,
          authorName: usersTable.name,
        })
        .from(announcementsTable)
        .leftJoin(usersTable, eq(usersTable.id, announcementsTable.authorId))
        .where(eq(announcementsTable.isActive, true))
        .orderBy(desc(announcementsTable.publishedAt))
        .limit(5),
      db
        .select()
        .from(academicCalendarTable)
        .where(gte(academicCalendarTable.tanggalMulai, today))
        .orderBy(academicCalendarTable.tanggalMulai)
        .limit(5),
      db
        .select({ count: count() })
        .from(chatSessionsTable)
        .where(gte(chatSessionsTable.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))),
    ]);

    res.json({
      counts: {
        students: studentCount[0]?.count ?? 0,
        lecturers: lecturerCount[0]?.count ?? 0,
        courses: courseCount[0]?.count ?? 0,
        activeAnnouncements: announcementCount[0]?.count ?? 0,
      },
      recentAnnouncements,
      upcomingEvents,
      chatSessionsToday: chatStatsToday[0]?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/activity", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const [recentMessages, recentUsers, needsReviewMessages] = await Promise.all([
      db
        .select({
          id: chatMessagesTable.id,
          sessionId: chatMessagesTable.sessionId,
          content: chatMessagesTable.content,
          answerSource: chatMessagesTable.answerSource,
          confidence: chatMessagesTable.confidence,
          needsReview: chatMessagesTable.needsReview,
          createdAt: chatMessagesTable.createdAt,
        })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.role, "assistant"))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(10),
      db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(5),
      db
        .select({
          id: chatMessagesTable.id,
          sessionId: chatMessagesTable.sessionId,
          content: chatMessagesTable.content,
          confidence: chatMessagesTable.confidence,
          createdAt: chatMessagesTable.createdAt,
        })
        .from(chatMessagesTable)
        .where(and(eq(chatMessagesTable.needsReview, true), eq(chatMessagesTable.role, "assistant")))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(10),
    ]);

    res.json({
      recentChatMessages: recentMessages,
      recentUsers,
      messagesNeedingReview: needsReviewMessages,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
