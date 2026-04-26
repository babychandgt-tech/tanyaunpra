import { pgTable, text, timestamp, uuid, pgEnum, time } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";
import { lecturersTable } from "./lecturers";

export const dayEnum = pgEnum("day_of_week", [
  "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
]);

export const schedulesTable = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  lecturerId: uuid("lecturer_id").references(() => lecturersTable.id, { onDelete: "set null" }),
  hari: dayEnum("hari").notNull(),
  jamMulai: time("jam_mulai").notNull(),
  jamSelesai: time("jam_selesai").notNull(),
  ruangan: text("ruangan").notNull(),
  semester: text("semester").notNull(),
  tahunAjaran: text("tahun_ajaran").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectScheduleSchema = createSelectSchema(schedulesTable);
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
