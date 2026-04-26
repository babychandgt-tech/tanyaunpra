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
- Informasi dosen dan staf akademik
- Kalender akademik: jadwal ujian, liburan, wisuda
- Prosedur kampus: pendaftaran ulang, pembayaran, pengajuan surat

Panduan menjawab:
1. Jawab dalam Bahasa Indonesia yang sopan, ramah, dan natural seperti asisten yang hangat
2. Selalu sapa atau beri respons pembuka yang ramah sebelum menjawab inti pertanyaan
3. Jika tidak tahu informasi spesifik UNPRA, berikan panduan umum dan sarankan untuk menghubungi bagian terkait
4. Untuk informasi sensitif (nilai, data pribadi), arahkan ke portal akademik resmi UNPRA
5. Tetap fokus pada topik akademik dan kampus
6. Jawaban singkat, jelas, dan informatif (maksimal 3-4 paragraf)
7. Jika pertanyaan di luar konteks akademik kampus, tolak dengan sopan`;

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
