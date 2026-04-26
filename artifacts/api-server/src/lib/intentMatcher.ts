import { db } from "@workspace/db";
import { intentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const MATCH_THRESHOLD = 0.45;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

const STOPWORDS = new Set([
  "apa", "itu", "ini", "yang", "dan", "di", "ke", "dari", "untuk", "dengan",
  "adalah", "ada", "tidak", "bisa", "saya", "aku", "kamu", "kita", "nya",
  "ya", "yah", "dong", "deh", "sih", "lah", "dong", "tuh", "gitu", "gimana",
  "berapa", "kapan", "dimana", "siapa", "bagaimana", "kenapa", "mengapa",
  "apakah", "tolong", "mohon", "minta", "kasih", "tau", "tahu", "info",
  "informasi", "detail", "jelaskan", "sebutkan", "ceritakan", "tentang",
  "mengenai", "terkait", "soal", "hal", "cara", "prosedur", "langkah",
]);

function removeStopwords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

function containmentScore(questionTokens: string[], intentTokens: string[]): number {
  if (intentTokens.length === 0) return 0;
  const intentSet = new Set(intentTokens);
  const matches = questionTokens.filter((t) => intentSet.has(t)).length;
  return matches / intentTokens.length;
}

function keywordScore(questionTokens: string[], keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const kwTokens = keywords.flatMap((k) => tokenize(k));
  const kwSet = new Set(kwTokens);
  const matches = questionTokens.filter((t) => kwSet.has(t)).length;
  return Math.min(matches / kwTokens.length, 1);
}

function tagScore(questionText: string, tags: string[]): number {
  if (!tags || tags.length === 0) return 0;
  const lower = questionText.toLowerCase();
  for (const tag of tags) {
    if (lower.includes(tag.toLowerCase())) return 1;
  }
  return 0;
}

export interface MatchResult {
  matched: boolean;
  answer: string | null;
  confidence: number;
  intentId: string | null;
  source: "intent" | "ai" | "fallback";
}

export async function matchIntent(question: string): Promise<MatchResult> {
  const intents = await db
    .select()
    .from(intentsTable)
    .where(eq(intentsTable.isActive, true));

  if (intents.length === 0) {
    return { matched: false, answer: null, confidence: 0, intentId: null, source: "ai" };
  }

  const questionTokens = tokenize(question);
  const cleanTokens = removeStopwords(questionTokens);

  let bestScore = 0;
  let bestIntent: (typeof intents)[0] | null = null;

  for (const intent of intents) {
    const intentTokens = tokenize(intent.pertanyaan);
    const cleanIntentTokens = removeStopwords(intentTokens);

    const containment = containmentScore(cleanTokens, cleanIntentTokens);
    const kwScore = keywordScore(cleanTokens, intent.keywords ?? []);
    const tScore = tagScore(question, intent.tags ?? []);

    const combined =
      containment * 0.45 +
      kwScore * 0.35 +
      tScore * 0.20;

    if (combined > bestScore) {
      bestScore = combined;
      bestIntent = intent;
    }
  }

  if (bestScore >= MATCH_THRESHOLD && bestIntent) {
    return {
      matched: true,
      answer: bestIntent.jawaban,
      confidence: Math.min(bestScore, 1),
      intentId: bestIntent.id,
      source: "intent",
    };
  }

  return { matched: false, answer: null, confidence: bestScore, intentId: null, source: "ai" };
}
