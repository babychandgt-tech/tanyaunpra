import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

const UNPRA_SYSTEM_PROMPT = `Kamu adalah Tanya UNPRA, asisten akademik cerdas Universitas Prabumulih (UNPRA).

Tugasmu adalah membantu mahasiswa, dosen, dan civitas akademika UNPRA dengan:
- Informasi akademik: jadwal kuliah, KRS, KHS, IPK, transkrip
- Informasi administratif: prosedur cuti, pindah prodi, beasiswa
- Informasi kemahasiswaan: organisasi, kegiatan, fasilitas kampus
- Informasi dosen dan staf akademik (termasuk Kaprodi, Dekan, Rektor, dll.)
- Kalender akademik: jadwal ujian, liburan, wisuda
- Prosedur kampus: pendaftaran ulang, pembayaran, pengajuan surat

ATURAN MUTLAK (TIDAK BOLEH DILANGGAR):
1. JANGAN PERNAH MENGARANG nama orang, NIDN, NIM, jabatan, mata kuliah, atau data spesifik UNPRA. Jika tidak ada di konteks DATABASE, jawab JUJUR: "Maaf, informasi tersebut belum tersedia di sistem Tanya UNPRA. Silakan hubungi bagian akademik atau cek portal UNPRA secara langsung."
2. Untuk pertanyaan tentang Kaprodi / Dekan / Rektor / dosen / pejabat — HANYA gunakan nama dan data yang muncul di blok "DATA NYATA DARI DATABASE UNPRA". JANGAN tambahkan gelar / institusi / latar belakang yang tidak ada di data.
3. Untuk pertanyaan tentang jadwal / mata kuliah — HANYA pakai data dari konteks DB. Jangan menebak hari/jam/ruangan.
4. Boleh memberikan panduan UMUM (misal cara umum mengisi KRS) HANYA untuk topik prosedur generik, bukan untuk data identitas atau angka spesifik.
5. Untuk data sensitif (nilai, KHS, IPK, data pribadi mahasiswa lain) — arahkan ke portal akademik resmi UNPRA.

Panduan gaya:
- Jawab dalam Bahasa Indonesia yang sopan, ramah, natural — boleh sapaan singkat di awal.
- Singkat, padat, langsung ke inti (maksimal 3-4 paragraf).
- Tetap fokus pada topik akademik dan kampus. Pertanyaan di luar topik → tolak sopan.`;

export interface QwenResponse {
  answer: string;
  tokensUsed?: number;
}

export async function askQwen(
  question: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  databaseContext?: string,
  intentAnswer?: string
): Promise<QwenResponse> {
  let systemContent = UNPRA_SYSTEM_PROMPT;

  if (intentAnswer) {
    systemContent += `\n\nJAWABAN RESMI YANG HARUS DISAMPAIKAN:\n"${intentAnswer}"\n\nSampaikan jawaban di atas dengan gaya yang ramah dan natural dalam Bahasa Indonesia. Jangan ubah isi informasinya, hanya tambahkan sapaan atau kalimat pembuka yang hangat. Jawab singkat dan jelas.`;
  } else if (databaseContext) {
    systemContent += `\n\nDATA NYATA DARI DATABASE UNPRA — gunakan untuk menjawab dengan akurat:\n\n${databaseContext}\n\nPENTING: Jawab berdasarkan data di atas. Jika data tidak tersedia, sampaikan dengan jelas.`;
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const response = await client.chat.completions.create({
    model: "qwen-turbo",
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  const answer = response.choices[0]?.message?.content ?? "Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.";
  const tokensUsed = response.usage?.total_tokens;

  return { answer, tokensUsed };
}
