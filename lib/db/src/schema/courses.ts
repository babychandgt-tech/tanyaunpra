import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lecturersTable } from "./lecturers";

export const coursesTable = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  kode: text("kode").notNull().unique(),
  nama: text("nama").notNull(),
  sks: integer("sks").notNull(),
  semester: integer("semester").notNull(),
  prodi: text("prodi").notNull(),
  deskripsi: text("deskripsi"),
  lecturerId: uuid("lecturer_id").references(() => lecturersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectCourseSchema = createSelectSchema(coursesTable);
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
