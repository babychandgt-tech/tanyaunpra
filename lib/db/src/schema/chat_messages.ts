import { pgTable, text, timestamp, uuid, boolean, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { chatSessionsTable } from "./chat_sessions";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);
export const answerSourceEnum = pgEnum("answer_source", ["intent", "ai", "fallback"]);

export const chatMessagesTable = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  answerSource: answerSourceEnum("answer_source"),
  confidence: real("confidence"),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({
  id: true,
  createdAt: true,
});
export const selectChatMessageSchema = createSelectSchema(chatMessagesTable);
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
