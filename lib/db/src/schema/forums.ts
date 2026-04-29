import { pgTable, text, timestamp, uuid, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const forumTypeEnum = pgEnum("forum_type", ["global", "fakultas", "prodi"]);

export const forumsTable = pgTable("forums", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: forumTypeEnum("type").notNull(),
  fakultas: text("fakultas"),
  prodi: text("prodi"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  typeIdx: index("forums_type_idx").on(t.type),
  fakultasIdx: index("forums_fakultas_idx").on(t.fakultas),
  prodiIdx: index("forums_prodi_idx").on(t.prodi),
}));

export const forumMessagesTable = pgTable("forum_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  forumId: uuid("forum_id").notNull().references(() => forumsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  forumIdIdx: index("forum_messages_forum_id_idx").on(t.forumId),
  createdAtIdx: index("forum_messages_created_at_idx").on(t.createdAt),
}));

export const insertForumSchema = createInsertSchema(forumsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectForumSchema = createSelectSchema(forumsTable);
export type InsertForum = z.infer<typeof insertForumSchema>;
export type Forum = typeof forumsTable.$inferSelect;

export const insertForumMessageSchema = createInsertSchema(forumMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertForumMessage = z.infer<typeof insertForumMessageSchema>;
export type ForumMessage = typeof forumMessagesTable.$inferSelect;
