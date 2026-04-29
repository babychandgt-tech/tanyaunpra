import { db } from "@workspace/db";
import {
  schedulesTable,
  coursesTable,
  lecturersTable,
  studentsTable,
  announcementsTable,
  academicCalendarTable,
  usersTable,
  prodiTable,
  fakultasTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, ilike, or, sql, SQL } from "drizzle-orm";

const KEYWORDS = {
  jadwal: [
    "jadwal", "kelas", "kuliah", "mengajar", "diajarkan", "ruangan", "jam kuliah",
    "senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu",
    "jam berapa", "hari apa", "jadwalku", "jadwal saya", "kuliah hari ini", "kuliah besok", "mata kuliahku",
  ],
  pengumuman: ["pengumuman", "pemberitahuan", "info terbaru", "informasi terbaru", "kabar", "berita", "update"],
  kalender: [
    "kalender", "akademik", "uts", "uas", "ujian tengah", "ujian akhir",
    "libur", "wisuda", "krs", "registrasi", "tanggal", "jadwal ujian", "semester ini",
  ],
  matkul: ["mata kuliah", "matkul", "sks", "kode mk", "kurikulum", "pelajaran", "subject"],
  dosen: [
    "dosen", "pengajar", "nidn", "staf pengajar", "pengampu", "faculty",
    "kaprodi", "ketua prodi", "ketua program studi",
    "dekan", "wakil dekan",
    "rektor", "wakil rektor", "warek",
    "kasubag", "kepala", "pejabat", "struktur",
    "siapa yang", "siapa nama", "namanya siapa", "siapa pengajar", "siapa pak", "siapa bu",
    "biodata dosen", "kontak dosen",
  ],
  mahasiswa: ["mahasiswa", "nim", "angkatan", "siswa", "student"],
  prodi: [
    "prodi", "program studi", "jurusan",
    "fakultas", "fasilkom", "fkom", "fakom",
    "akreditasi",
    "berapa prodi", "ada prodi apa", "daftar prodi", "list prodi",
    "berapa fakultas", "ada fakultas apa", "daftar fakultas",
  ],
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

interface UserContext {
  nama?: string | null;
  nim?: string | null;
  prodi: string;
  semester: number;
  kelas?: string | null;
}

/* ----------------------------- DOSEN ----------------------------- */

interface JabatanFilter {
  positive: string[];
  negative?: string[];
}

const JABATAN_KEYWORDS: Array<{ words: string[]; filter: JabatanFilter }> = [
  { words: ["kaprodi", "ketua prodi", "ketua program studi"], filter: { positive: ["kaprodi", "ketua prodi", "ketua program studi"] } },
  { words: ["wakil dekan", "wadek"], filter: { positive: ["wakil dekan", "wadek"] } },
  { words: ["dekan"], filter: { positive: ["dekan"], negative: ["wakil"] } },
  { words: ["wakil rektor", "warek"], filter: { positive: ["wakil rektor", "warek"] } },
  { words: ["rektor"], filter: { positive: ["rektor"], negative: ["wakil"] } },
  { words: ["kasubag"], filter: { positive: ["kasubag"] } },
  { words: ["ketua penelitian"], filter: { positive: ["ketua penelitian"] } },
];

async function detectProdiInQuestion(lower: string): Promise<string | null> {
  const allProdi = await db.select({ name: prodiTable.name, singkatan: prodiTable.singkatan }).from(prodiTable);
  for (const p of allProdi) {
    if (lower.includes(p.name.toLowerCase())) return p.name;
  }
  for (const p of allProdi) {
    const s = p.singkatan.toLowerCase();
    if (s.length >= 2 && new RegExp(`\\b${s}\\b`).test(lower)) return p.name;
  }
  return null;
}

async function detectFakultasInQuestion(lower: string): Promise<string | null> {
  const allFak = await db.select({ name: fakultasTable.name, singkatan: fakultasTable.singkatan }).from(fakultasTable);
  for (const f of allFak) {
    if (lower.includes(f.name.toLowerCase())) return f.name;
  }
  for (const f of allFak) {
    const s = f.singkatan.toLowerCase();
    if (s.length >= 3 && new RegExp(`\\b${s}\\b`).test(lower)) return f.name;
  }
  return null;
}

function detectJabatanFilters(lower: string): JabatanFilter[] {
  const filters: JabatanFilter[] = [];
  const seen = new Set<string>();
  for (const j of JABATAN_KEYWORDS) {
    if (j.words.some((w) => lower.includes(w))) {
      const key = j.filter.positive.join("|");
      if (!seen.has(key)) {
        filters.push(j.filter);
        seen.add(key);
      }
    }
  }
  return filters;
}

async function getDosenContext(question: string, userCtx?: UserContext): Promise<string> {
  const lower = question.toLowerCase();
  const targetProdi = (await detectProdiInQuestion(lower)) ?? null;
  const targetFakultas = (await detectFakultasInQuestion(lower)) ?? null;
  const jabatanFilters = detectJabatanFilters(lower);

  const conds: SQL[] = [];
  if (targetProdi) conds.push(eq(lecturersTable.prodi, targetProdi));
  if (targetFakultas) conds.push(eq(lecturersTable.fakultas, targetFakultas));
  if (jabatanFilters.length > 0) {
    const filterSqls: SQL[] = jabatanFilters.map((f) => {
      const posOrs: SQL[] = f.positive.map((p) => ilike(lecturersTable.jabatan, `%${p}%`));
      const positive = posOrs.length === 1 ? posOrs[0] : (or(...posOrs) as SQL);
      if (!f.negative || f.negative.length === 0) return positive;
      const negSql = and(
        ...f.negative.map((n) => sql`${lecturersTable.jabatan} NOT ILIKE ${`%${n}%`}`)
      ) as SQL;
      return and(positive, negSql) as SQL;
    });
    conds.push((filterSqls.length === 1 ? filterSqls[0] : (or(...filterSqls) as SQL)));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select({
      nama: usersTable.name,
      email: usersTable.email,
      nidn: lecturersTable.nidn,
      prodi: lecturersTable.prodi,
      fakultas: lecturersTable.fakultas,
      jabatan: lecturersTable.jabatan,
      expertise: lecturersTable.expertise,
      phone: lecturersTable.phone,
    })
    .from(lecturersTable)
    .leftJoin(usersTable, eq(lecturersTable.userId, usersTable.id))
    .where(where)
    .orderBy(lecturersTable.prodi, lecturersTable.jabatan, usersTable.name)
    .limit(40);

  const hasSpecificFilter = !!targetProdi || !!targetFakultas || jabatanFilters.length > 0;

  if (rows.length === 0) {
    if (hasSpecificFilter) {
      const filterDesc: string[] = [];
      if (jabatanFilters.length > 0) filterDesc.push(`jabatan "${jabatanFilters.map((f) => f.positive[0]).join("/")}"`);
      if (targetProdi) filterDesc.push(`prodi "${targetProdi}"`);
      if (targetFakultas) filterDesc.push(`fakultas "${targetFakultas}"`);
      return `=== DATA DOSEN ===\n(Tidak ada data dosen dengan ${filterDesc.join(" + ")} di database UNPRA. Jangan mengarang nama atau identitas; sampaikan bahwa informasi tersebut belum tersedia di sistem.)`;
    }
    return "";
  }

  const headerParts: string[] = [];
  if (jabatanFilters.length > 0) {
    const jabatanLabels = jabatanFilters.map((f) => f.positive[0]);
    headerParts.push(`Jabatan: ${jabatanLabels.join("/")}`);
  }
  if (targetProdi) headerParts.push(`Prodi: ${targetProdi}`);
  if (targetFakultas) headerParts.push(`Fakultas: ${targetFakultas}`);
  const header = headerParts.length > 0
    ? `=== DATA DOSEN (${headerParts.join(", ")}) ===`
    : `=== DATA DOSEN ===`;

  const lines = rows.map((r) => {
    const parts = [
      `- ${r.nama ?? "-"} (NIDN: ${r.nidn})`,
      `Prodi: ${r.prodi}`,
      `Fakultas: ${r.fakultas}`,
    ];
    if (r.jabatan) parts.push(`Jabatan: ${r.jabatan.trim()}`);
    if (r.expertise && r.expertise.trim()) parts.push(`Keahlian: ${r.expertise}`);
    if (r.phone) parts.push(`HP/WA: ${r.phone}`);
    if (r.email) parts.push(`Email: ${r.email}`);
    return parts.join(" | ");
  });

  return `${header}\n${lines.join("\n")}`;
}

/* ----------------------------- JADWAL ----------------------------- */

async function getJadwalContext(question: string, userCtx?: UserContext): Promise<string> {
  const conds: SQL[] = [];
  if (userCtx) {
    conds.push(eq(coursesTable.prodi, userCtx.prodi));
    conds.push(eq(schedulesTable.semester, String(userCtx.semester)));
    if (userCtx.kelas && userCtx.kelas.trim() !== "") {
      conds.push(eq(schedulesTable.kelas, userCtx.kelas));
    }
  }

  const rows = await db
    .select({
      hari: schedulesTable.hari,
      jamMulai: schedulesTable.jamMulai,
      jamSelesai: schedulesTable.jamSelesai,
      ruangan: schedulesTable.ruangan,
      kelas: schedulesTable.kelas,
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
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(schedulesTable.hari, schedulesTable.jamMulai)
    .limit(40);

  if (rows.length === 0) return "";

  const trim = (t: string) => (t.length > 5 ? t.substring(0, 5) : t);
  const header = userCtx
    ? `=== JADWAL KULIAH (${userCtx.prodi}${userCtx.kelas ? " Kelas " + userCtx.kelas : ""}, Semester ${userCtx.semester}) ===`
    : `=== DATA JADWAL KULIAH ===`;

  const lines = rows.map((r) =>
    `- ${r.hari} ${trim(r.jamMulai)}–${trim(r.jamSelesai)} | ${r.namaMatkul ?? "-"} (${r.kodeMatkul ?? "-"}, ${r.sks ?? "-"} SKS) | Ruang: ${r.ruangan}${r.kelas ? " | Kelas: " + r.kelas : ""} | Dosen: ${r.namaDosen ?? "TBA"} | Prodi: ${r.prodi ?? "-"} | Semester ${r.semester} TA ${r.tahunAjaran}`
  );

  return `${header}\n${lines.join("\n")}`;
}

/* ----------------------------- PENGUMUMAN ----------------------------- */

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

/* ----------------------------- KALENDER ----------------------------- */

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

/* ----------------------------- MATKUL ----------------------------- */

async function getMatkulContext(question: string): Promise<string> {
  const lower = question.toLowerCase();
  const targetProdi = await detectProdiInQuestion(lower);

  const where = targetProdi ? eq(coursesTable.prodi, targetProdi) : undefined;

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
    .where(where)
    .orderBy(coursesTable.prodi, coursesTable.semester, coursesTable.nama)
    .limit(40);

  if (rows.length === 0) return "";

  const header = targetProdi
    ? `=== DATA MATA KULIAH (Prodi: ${targetProdi}) ===`
    : `=== DATA MATA KULIAH ===`;

  const lines = rows.map((r) =>
    `- ${r.kode} | ${r.nama} | ${r.sks} SKS | Semester ${r.semester} | Prodi: ${r.prodi} | Dosen: ${r.namaDosen ?? "TBA"}`
  );

  return `${header}\n${lines.join("\n")}`;
}

/* ----------------------------- MAHASISWA ----------------------------- */

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

/* ----------------------------- PRODI / FAKULTAS ----------------------------- */

async function getProdiFakultasContext(): Promise<string> {
  const rows = await db
    .select({
      fakultas: fakultasTable.name,
      fakultasSingkatan: fakultasTable.singkatan,
      prodi: prodiTable.name,
      prodiSingkatan: prodiTable.singkatan,
    })
    .from(prodiTable)
    .innerJoin(fakultasTable, eq(prodiTable.fakultasId, fakultasTable.id))
    .orderBy(fakultasTable.name, prodiTable.sortOrder);

  if (rows.length === 0) return "";

  const grouped = new Map<string, Array<{ prodi: string; singkatan: string }>>();
  for (const r of rows) {
    const key = `${r.fakultas} (${r.fakultasSingkatan})`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ prodi: r.prodi, singkatan: r.prodiSingkatan });
  }

  const sections: string[] = [];
  for (const [fak, prodis] of grouped) {
    sections.push(`- ${fak}:`);
    for (const p of prodis) sections.push(`    • ${p.prodi} (${p.singkatan})`);
  }

  return `=== STRUKTUR FAKULTAS & PROGRAM STUDI UNPRA ===\n${sections.join("\n")}`;
}

/* ----------------------------- ENTRY POINT ----------------------------- */

export async function retrieveContext(question: string, userCtx?: UserContext): Promise<string> {
  const topics = detectTopics(question);

  const sections: string[] = [];

  if (userCtx) {
    sections.push(
      `=== PROFIL PENGGUNA ===\nNama: ${userCtx.nama ?? "Mahasiswa"} | NIM: ${userCtx.nim ?? "-"} | Prodi: ${userCtx.prodi} | Semester: ${userCtx.semester}${userCtx.kelas ? " | Kelas: " + userCtx.kelas : ""}`
    );
  }

  const fetchers: Promise<string>[] = [];

  if (topics.has("jadwal")) fetchers.push(getJadwalContext(question, userCtx));
  if (topics.has("pengumuman")) fetchers.push(getPengumumanContext());
  if (topics.has("kalender")) fetchers.push(getKalenderContext());
  if (topics.has("matkul")) fetchers.push(getMatkulContext(question));
  if (topics.has("dosen")) fetchers.push(getDosenContext(question, userCtx));
  if (topics.has("mahasiswa")) fetchers.push(getMahasiswaContext());
  if (topics.has("prodi")) fetchers.push(getProdiFakultasContext());

  const results = await Promise.all(fetchers);
  for (const r of results) {
    if (r) sections.push(r);
  }

  return sections.join("\n\n");
}

export type { UserContext };
