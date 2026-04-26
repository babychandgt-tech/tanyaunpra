import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@unpra.ac.id";

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (existing) {
    console.log("Admin sudah ada:", adminEmail);
    process.exit(0);
  }

  const adminPassword = crypto.randomBytes(16).toString("hex");
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const [admin] = await db
    .insert(usersTable)
    .values({
      email: adminEmail,
      password: passwordHash,
      name: "Super Admin UNPRA",
      role: "admin",
      isSuperAdmin: true,
    })
    .returning({ id: usersTable.id, email: usersTable.email });

  console.log("========================================");
  console.log("Admin berhasil dibuat (simpan dengan aman):");
  console.log("  Email   :", admin.email);
  console.log("  Password:", adminPassword);
  console.log("  ID      :", admin.id);
  console.log("========================================");
  console.log("PERINGATAN: Password ini tidak akan ditampilkan lagi.");
  console.log("Segera ganti password setelah login pertama.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
