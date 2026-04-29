import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const fakultasTable = pgTable("fakultas", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  singkatan: text("singkatan").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const prodiTable = pgTable("prodi", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  singkatan: text("singkatan").notNull(),
  fakultasId: uuid("fakultas_id").notNull().references(() => fakultasTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Fakultas = typeof fakultasTable.$inferSelect;
export type Prodi = typeof prodiTable.$inferSelect;
