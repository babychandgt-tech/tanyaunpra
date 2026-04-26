import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { ilike, or, eq, and, count, desc, SQL } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";
import * as bcrypt from "bcryptjs";

const router: IRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["mahasiswa", "dosen", "admin"]).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const createAdminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

router.get("/users", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const params = listSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const conditions: SQL[] = [];
    if (params.search) {
      conditions.push(
        or(
          ilike(usersTable.name, `%${params.search}%`),
          ilike(usersTable.email, `%${params.search}%`)
        ) as SQL
      );
    }
    if (params.role) {
      conditions.push(eq(usersTable.role, params.role));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [users, [{ value: total }]] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(whereClause)
        .orderBy(desc(usersTable.createdAt))
        .limit(params.limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(usersTable)
        .where(whereClause),
    ]);

    return res.json({
      users,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/admin", requireSuperAdmin(), async (req: Request, res: Response) => {
  try {
    const body = createAdminSchema.parse(req.body);

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, body.email));
    if (existing) {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }

    const hashed = await bcrypt.hash(body.password, 10);
    const [user] = await db.insert(usersTable).values({
      name: body.name,
      email: body.email,
      password: hashed,
      role: "admin",
    }).returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });

    return res.status(201).json({ user, message: "Akun admin berhasil dibuat" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Data tidak valid", details: err.flatten().fieldErrors });
    }
    console.error("Create admin error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.params);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
    if (user.role === "admin") return res.status(403).json({ error: "Tidak dapat menghapus akun admin" });

    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ message: "User berhasil dihapus" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "ID tidak valid" });
    }
    console.error("Delete user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
