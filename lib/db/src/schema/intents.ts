import { pgTable, text, timestamp, uuid, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const intentsTable = pgTable("intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  pertanyaan: text("pertanyaan").notNull(),
  jawaban: text("jawaban").notNull(),
  kategori: text("kategori").notNull().default("Umum"),
  keywords: text("keywords").array(),
  confidence: real("confidence").notNull().default(1.0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntentSchema = createInsertSchema(intentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectIntentSchema = createSelectSchema(intentsTable);
export type InsertIntent = z.infer<typeof insertIntentSchema>;
export type Intent = typeof intentsTable.$inferSelect;
