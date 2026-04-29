import { db, schedulesTable, coursesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const NUMERIC_RE = /^[1-8]$/;

async function main() {
  console.log("Mencari jadwal dengan nilai semester non-angka...");

  const allSchedules = await db
    .select({
      id: schedulesTable.id,
      courseId: schedulesTable.courseId,
      semester: schedulesTable.semester,
      courseSemester: coursesTable.semester,
      courseKode: coursesTable.kode,
    })
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(coursesTable.id, schedulesTable.courseId));

  const broken = allSchedules.filter((s) => !NUMERIC_RE.test(s.semester));

  if (broken.length === 0) {
    console.log("Tidak ada data yang perlu di-cleanup. Selesai.");
    process.exit(0);
  }

  console.log(`Ditemukan ${broken.length} baris untuk di-cleanup:`);
  console.table(broken);

  let fixed = 0;
  let skipped = 0;
  for (const row of broken) {
    if (row.courseSemester == null) {
      console.warn(`SKIP ${row.id}: tidak ada course terkait`);
      skipped++;
      continue;
    }
    const newSem = String(row.courseSemester);
    if (!NUMERIC_RE.test(newSem)) {
      console.warn(`SKIP ${row.id}: courseSemester (${newSem}) di luar 1-8`);
      skipped++;
      continue;
    }
    await db
      .update(schedulesTable)
      .set({ semester: newSem, updatedAt: new Date() })
      .where(eq(schedulesTable.id, row.id));
    console.log(`FIXED ${row.id} (${row.courseKode}): "${row.semester}" -> "${newSem}"`);
    fixed++;
  }

  console.log(`\nSelesai. ${fixed} di-fix, ${skipped} di-skip.`);
  void inArray;
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
