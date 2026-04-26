import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { ilike, or, eq, count, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["mahasiswa", "dosen", "admin"]).optional(),
});

router.get("/users", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const params = listSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    const conditions = [];
    if (params.search) {
      conditions.push(
        or(
          ilike(usersTable.name, `%${params.search}%`),
          ilike(usersTable.email, `%${params.search}%`)
        )
      );
    }
    if (params.role) {
      conditions.push(eq(usersTable.role, params.role));
    }

    const where = conditions.length === 1
      ? conditions[0]
      : conditions.length > 1
        ? conditions.reduce((a, b) => a && b)
        : undefined;

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
        .where(where)
        .orderBy(desc(usersTable.createdAt))
        .limit(params.limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(usersTable)
        .where(where),
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

router.delete("/users/:id", requireAuth(["admin"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
    if (user.role === "admin") return res.status(403).json({ error: "Tidak dapat menghapus akun admin" });

    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ message: "User berhasil dihapus" });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
