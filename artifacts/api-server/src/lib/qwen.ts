import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

const UNPRA_SYSTEM_PROMPT = `Kamu adalah Tanya UNPRA, asisten akademik cerdas Universitas Prima Nusantara (UNPRA).

Tugasmu adalah membantu mahasiswa, dosen, dan civitas akademika UNPRA dengan:
- Informasi akademik: jadwal kuliah, KRS, KHS, IPK, transkrip
- Informasi administratif: prosedur cuti, pindah prodi, beasiswa
- Informasi kemahasiswaan: organisasi, kegiatan, fasilitas kampus
- Informasi dosen dan staf akademik
- Kalender akademik: jadwal ujian, liburan, wisuda
- Prosedur kampus: pendaftaran ulang, pembayaran, pengajuan surat

Panduan menjawab:
1. Jawab dalam Bahasa Indonesia yang sopan dan ramah
2. Jika tidak tahu informasi spesifik UNPRA, berikan panduan umum dan sarankan untuk menghubungi bagian terkait
3. Untuk informasi sensitif (nilai, data pribadi), arahkan ke portal akademik resmi UNPRA
4. Tetap fokus pada topik akademik dan kampus
5. Jawaban singkat, jelas, dan informatif (maksimal 3-4 paragraf)
6. Jika pertanyaan di luar konteks akademik kampus, tolak dengan sopan`;

export interface QwenResponse {
  answer: string;
  tokensUsed?: number;
}

export async function askQwen(
  question: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<QwenResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: UNPRA_SYSTEM_PROMPT },
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
