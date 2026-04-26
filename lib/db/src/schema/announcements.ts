import { pgTable, text, timestamp, uuid, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const announcementCategoryEnum = pgEnum("announcement_category", [
  "Akademik", "Kemahasiswaan", "Keuangan", "Umum", "Beasiswa"
]);

export const announcementsTable = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  judul: text("judul").notNull(),
  konten: text("konten").notNull(),
  kategori: announcementCategoryEnum("kategori").notNull().default("Umum"),
  authorId: uuid("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAnnouncementSchema = createSelectSchema(announcementsTable);
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcementsTable.$inferSelect;
