import { db } from "@workspace/db";
import {
  schedulesTable,
  coursesTable,
  lecturersTable,
  studentsTable,
  announcementsTable,
  academicCalendarTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, or, ilike } from "drizzle-orm";

const KEYWORDS = {
  jadwal: ["jadwal", "kelas", "kuliah", "mengajar", "diajarkan", "ruangan", "jam kuliah", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "jam berapa", "hari apa"],
  pengumuman: ["pengumuman", "pemberitahuan", "info terbaru", "informasi terbaru", "kabar", "berita", "update"],
  kalender: ["kalender", "akademik", "uts", "uas", "ujian tengah", "ujian akhir", "libur", "wisuda", "krs", "registrasi", "tanggal", "jadwal ujian", "semester ini"],
  matkul: ["mata kuliah", "matkul", "sks", "kode mk", "kurikulum", "pelajaran", "subject"],
  dosen: ["dosen", "pengajar", "nidn", "staf pengajar", "siapa yang mengajar", "pengampu", "faculty"],
  mahasiswa: ["mahasiswa", "nim", "angkatan", "siswa", "student"],
};

function detectTopics(question: string): Set<keyof typeof KEYWORDS> {
  const lower = question.toLowerCase();
  const topics = new Set<keyof typeof KEYWORDS>();
  for (const [topic, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) {
      topics.add(topic as keyof typeof KEYWORDS);
    }
  }
  if (topics.size === 0) {
    topics.add("pengumuman");
    topics.add("kalender");
  }
  return topics;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

async function getJadwalContext(question: string): Promise<string> {
  const lower = question.toLowerCase();

  const rows = await db
    .select({
      hari: schedulesTable.hari,
      jamMulai: schedulesTable.jamMulai,
      jamSelesai: schedulesTable.jamSelesai,
      ruangan: schedulesTable.ruangan,
      semester: schedulesTable.semester,
      tahunAjaran: schedulesTable.tahunAjaran,
      namaMatkul: coursesTable.nama,
      kodeMatkul: coursesTable.kode,
      sks: coursesTable.sks,
      prodi: coursesTable.prodi,
      namaDosen: usersTable.name,
    })
    .from(schedulesTable)
    .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
    .leftJoin(lecturersTable, eq(schedulesTable.lecturerId, lecturersTable.id))
    .leftJoin(usersTable, eq(lecturersTable.userId, usersTable.id))
    .orderBy(schedulesTable.hari, schedulesTable.jamMulai)
    .limit(20);

  if (rows.length === 0) return "";

  const lines = rows.map((r) =>
    `- ${r.hari} ${r.jamMulai}–${r.jamSelesai} | ${r.namaMatkul ?? "-"} (${r.kodeMatkul ?? "-"}, ${r.sks ?? "-"} SKS) | Ruang: ${r.ruangan} | Dosen: ${r.namaDosen ?? "TBA"} | Prodi: ${r.prodi ?? "-"} | Semester ${r.semester} TA ${r.tahunAjaran}`
  );

  return `=== DATA JADWAL KULIAH ===\n${lines.join("\n")}`;
}

async function getPengumumanContext(): Promise<string> {
  const rows = await db
    .select({
      judul: announcementsTable.judul,
      konten: announcementsTable.konten,
      kategori: announcementsTable.kategori,
      publishedAt: announcementsTable.publishedAt,
    })
    .from(announcementsTable)
    .where(eq(announcementsTable.isActive, true))
    .orderBy(desc(announcementsTable.publishedAt))
    .limit(5);

  if (rows.length === 0) return "";

  const lines = rows.map((r) =>
    `- [${r.kategori}] ${r.judul} (${formatDate(r.publishedAt)}): ${r.konten.slice(0, 200)}${r.konten.length > 200 ? "..." : ""}`
  );

  return `=== PENGUMUMAN TERBARU ===\n${lines.join("\n")}`;
}

async function getKalenderContext(): Promise<string> {
  const today = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

  const todayStr = today.toISOString().split("T")[0];
  const futureStr = sixMonthsLater.toISOString().split("T")[0];

  const rows = await db
    .select({
      namaEvent: academicCalendarTable.namaEvent,
      tanggalMulai: academicCalendarTable.tanggalMulai,
      tanggalSelesai: academicCalendarTable.tanggalSelesai,
      tipe: academicCalendarTable.tipe,
      deskripsi: academicCalendarTable.deskripsi,
      tahunAjaran: academicCalendarTable.tahunAjaran,
    })
    .from(academicCalendarTable)
    .where(
      and(
        gte(academicCalendarTable.tanggalSelesai, todayStr),
        lte(academicCalendarTable.tanggalMulai, futureStr)
      )
    )
    .orderBy(academicCalendarTable.tanggalMulai)
    .limit(15);

  if (rows.length === 0) {
    const allRows = await db
      .select()
      .from(academicCalendarTable)
      .orderBy(desc(academicCalendarTable.tanggalMulai))
      .limit(10);

    if (allRows.length === 0) return "";

    const lines = allRows.map((r) =>
      `- [${r.tipe}] ${r.namaEvent}: ${formatDate(r.tanggalMulai)} s/d ${formatDate(r.tanggalSelesai)} (TA ${r.tahunAjaran})${r.deskripsi ? " - " + r.deskripsi : ""}`
    );
    return `=== KALENDER AKADEMIK ===\n${lines.join("\n")}`;
  }

  const lines = rows.map((r) =>
    `- [${r.tipe}] ${r.namaEvent}: ${formatDate(r.tanggalMulai)} s/d ${formatDate(r.tanggalSelesai)} (TA ${r.tahunAjaran})${r.deskripsi ? " - " + r.deskripsi : ""}`
  );

  return `=== KALENDER AKADEMIK (mendatang) ===\n${lines.join("\n")}`;
}

async function getMatkulContext(): Promise<string> {
  const rows = await db
    .select({
      kode: coursesTable.kode,
      nama: coursesTable.nama,
      sks: coursesTable.sks,
      semester: coursesTable.semester,
      prodi: coursesTable.prodi,
      deskripsi: coursesTable.deskripsi,
      namaDosen: usersTable.name,
    })
    .from(coursesTable)
    .leftJoin(lecturersTable, eq(coursesTable.lecturerId, lecturersTable.id))
    .leftJoin(usersTable, eq(lecturersTable.userId, usersTable.id))
    .orderBy(coursesTable.prodi, coursesTable.semester, coursesTable.nama)
    .limit(30);

  if (rows.length === 0) return "";

  const lines = rows.map((r) =>
    `- ${r.kode} | ${r.nama} | ${r.sks} SKS | Semester ${r.semester} | Prodi: ${r.prodi} | Dosen: ${r.namaDosen ?? "TBA"}`
  );

  return `=== DATA MATA KULIAH ===\n${lines.join("\n")}`;
}

async function getDosenContext(): Promise<string> {
  const rows = await db
    .select({
      nama: usersTable.name,
      email: usersTable.email,
      nidn: lecturersTable.nidn,
      prodi: lecturersTable.prodi,
      fakultas: lecturersTable.fakultas,
      jabatan: lecturersTable.jabatan,
      expertise: lecturersTable.expertise,
    })
    .from(lecturersTable)
    .leftJoin(usersTable, eq(lecturersTable.userId, usersTable.id))
    .orderBy(lecturersTable.prodi, usersTable.name)
    .limit(20);

  if (rows.length === 0) return "";

  const lines = rows.map((r) =>
    `- ${r.nama ?? "-"} (NIDN: ${r.nidn}) | Prodi: ${r.prodi} | Fakultas: ${r.fakultas}${r.jabatan ? " | " + r.jabatan : ""}${r.expertise ? " | Keahlian: " + r.expertise : ""}`
  );

  return `=== DATA DOSEN ===\n${lines.join("\n")}`;
}

async function getMahasiswaContext(): Promise<string> {
  const rows = await db
    .select({
      nama: usersTable.name,
      nim: studentsTable.nim,
      prodi: studentsTable.prodi,
      fakultas: studentsTable.fakultas,
      semester: studentsTable.semester,
      angkatan: studentsTable.angkatan,
    })
    .from(studentsTable)
    .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .orderBy(studentsTable.prodi, studentsTable.angkatan)
    .limit(20);

  if (rows.length === 0) return "";

  const lines = rows.map((r) =>
    `- ${r.nama ?? "-"} (NIM: ${r.nim}) | Prodi: ${r.prodi} | Fakultas: ${r.fakultas} | Semester ${r.semester} | Angkatan ${r.angkatan}`
  );

  return `=== DATA MAHASISWA ===\n${lines.join("\n")}`;
}

export async function retrieveContext(question: string): Promise<string> {
  const topics = detectTopics(question);

  const sections: string[] = [];

  const fetchers: Promise<string>[] = [];

  if (topics.has("jadwal")) fetchers.push(getJadwalContext(question));
  if (topics.has("pengumuman")) fetchers.push(getPengumumanContext());
  if (topics.has("kalender")) fetchers.push(getKalenderContext());
  if (topics.has("matkul")) fetchers.push(getMatkulContext());
  if (topics.has("dosen")) fetchers.push(getDosenContext());
  if (topics.has("mahasiswa")) fetchers.push(getMahasiswaContext());

  const results = await Promise.all(fetchers);
  for (const r of results) {
    if (r) sections.push(r);
  }

  return sections.join("\n\n");
}
