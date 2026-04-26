import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db
    .update(usersTable)
    .set({ isSuperAdmin: true })
    .where(eq(usersTable.email, "admin@unpra.ac.id"))
    .returning({ id: usersTable.id, email: usersTable.email });
  console.log("Updated:", result);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
