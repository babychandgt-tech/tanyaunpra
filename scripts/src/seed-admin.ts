import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const adminEmail = "admin@unpra.ac.id";
  const adminPassword = "Admin@Unpra2024";

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (existing) {
    console.log("Admin sudah ada:", adminEmail);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: adminEmail,
      password: passwordHash,
      name: "Super Admin UNPRA",
      role: "admin",
    })
    .returning({ id: usersTable.id, email: usersTable.email });

  console.log("Admin berhasil dibuat:");
  console.log("  Email:", admin.email);
  console.log("  Password:", adminPassword);
  console.log("  ID:", admin.id);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
