import { db } from "@workspace/db";
import { intentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const EXACT_THRESHOLD = 0.95;
const FUZZY_THRESHOLD = 0.55;

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

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function keywordScore(questionTokens: string[], keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const kwTokens = keywords.flatMap((k) => tokenize(k));
  const matches = kwTokens.filter((kw) => questionTokens.includes(kw));
  return matches.length / kwTokens.length;
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
  let bestScore = 0;
  let bestIntent: (typeof intents)[0] | null = null;

  for (const intent of intents) {
    const pertanyaanTokens = tokenize(intent.pertanyaan);
    const jaccard = jaccardSimilarity(questionTokens, pertanyaanTokens);
    const kwScore = keywordScore(questionTokens, intent.keywords ?? []);
    const combined = jaccard * 0.6 + kwScore * 0.4;

    if (combined > bestScore) {
      bestScore = combined;
      bestIntent = intent;
    }
  }

  if (bestScore >= EXACT_THRESHOLD && bestIntent) {
    return {
      matched: true,
      answer: bestIntent.jawaban,
      confidence: bestScore,
      intentId: bestIntent.id,
      source: "intent",
    };
  }

  if (bestScore >= FUZZY_THRESHOLD && bestIntent) {
    return {
      matched: true,
      answer: bestIntent.jawaban,
      confidence: bestScore,
      intentId: bestIntent.id,
      source: "intent",
    };
  }

  return { matched: false, answer: null, confidence: bestScore, intentId: null, source: "ai" };
}
