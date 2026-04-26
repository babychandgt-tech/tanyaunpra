import { pgTable, text, timestamp, uuid, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "UTS", "UAS", "Libur", "Registrasi", "KRS", "Wisuda", "Lainnya"
]);

export const academicCalendarTable = pgTable("academic_calendar", {
  id: uuid("id").primaryKey().defaultRandom(),
  namaEvent: text("nama_event").notNull(),
  tanggalMulai: date("tanggal_mulai").notNull(),
  tanggalSelesai: date("tanggal_selesai").notNull(),
  tipe: calendarEventTypeEnum("tipe").notNull(),
  deskripsi: text("deskripsi"),
  tahunAjaran: text("tahun_ajaran").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAcademicCalendarSchema = createInsertSchema(academicCalendarTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAcademicCalendarSchema = createSelectSchema(academicCalendarTable);
export type InsertAcademicCalendar = z.infer<typeof insertAcademicCalendarSchema>;
export type AcademicCalendar = typeof academicCalendarTable.$inferSelect;
