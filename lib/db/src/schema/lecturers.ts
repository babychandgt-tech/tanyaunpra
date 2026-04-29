import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const lecturersTable = pgTable("lecturers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  nidn: text("nidn").notNull().unique(),
  prodi: text("prodi").notNull(),
  fakultas: text("fakultas").notNull(),
  jabatan: text("jabatan"),
  phone: text("phone"),
  expertise: text("expertise"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLecturerSchema = createInsertSchema(lecturersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectLecturerSchema = createSelectSchema(lecturersTable);
export type InsertLecturer = z.infer<typeof insertLecturerSchema>;
export type Lecturer = typeof lecturersTable.$inferSelect;
