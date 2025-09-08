// pages/api/analyzeReviews.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabasePublic } from '../../lib/supabasePublic';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import OpenAI, { APIError } from 'openai';
import { PostgrestError } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' };

type DBReview = { text: string; rating: number | null };

type SummaryPayload = {
  model: string;
  content: string;
  stats: { reviews_count: number; generated_at: string };
};

const MODEL = 'gpt-4o-mini';
const CACHE_TTL_HOURS = 24;

function buildPromptText(reviews: DBReview[]): string {
  const lines = reviews.map((r) => `- [${r.rating ?? 'nr'}/5] ${r.text.replace(/\s+/g, ' ').slice(0, 600)}`);
  const corpus = lines.join('\n');
  return `Ты — аналитик отзывов. Суммируй по отелю строго по структуре и на русском:
1) Плюсы — буллеты
2) Минусы — буллеты
3) Общая тональность — одно короткое предложение
4) Частые проблемы — буллеты (если есть)
5) Кому подойдёт / кому не подойдёт — по 1–2 буллета

Отвечай кратко, без вводных слов, без Markdown-заголовков вроде "Плюсы:". Используй маркеры "• ".

Отзывы:
${corpus}`;
}

function isFresh(updatedAtIso: string, ttlHours: number): boolean {
  const updated = new Date(updatedAtIso).getTime();
  const now = Date.now();
  return now - updated < ttlHours * 3600_000;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const q = req.query.hotel_id;
    const hotel_id = typeof q === 'string' ? q.trim() : Array.isArray(q) ? q[0].trim() : '';
    const force = String(req.query.force ?? '').toLowerCase() === 'true';
    if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });

    // 1) КЭШ
    if (!force) {
      const cached = await supabasePublic
        .from('summaries')
        .select('summary, updated_at')
        .eq('hotel_id', hotel_id)
        .maybeSingle();

      if (cached.error) return res.status(500).json({ error: cached.error.message });

      if (cached.data?.summary && cached.data?.updated_at && isFresh(cached.data.updated_at, CACHE_TTL_HOURS)) {
        return res.status(200).json({ cached: true, summary: cached.data.summary as SummaryPayload });
      }
      // если кэш есть, но устарел — пересчитаем ниже
    }

    // 2) ОТЗЫВЫ
    const { data: reviews, error: rErr }: { data: DBReview[] | null; error: PostgrestError | null } =
      await supabasePublic
        .from('reviews')
        .select('text, rating')
        .eq('hotel_id', hotel_id)
        .order('created_at', { ascending: false })
        .limit(250);

    if (rErr) return res.status(500).json({ error: rErr.message });

    const safeReviews = (reviews ?? []).filter((r) => r.text && r.text.trim().length > 0);
    if (safeReviews.length === 0) {
      const emptySummary: SummaryPayload = {
        model: MODEL,
        content: 'Отзывов нет — выжимка недоступна.',
        stats: { reviews_count: 0, generated_at: new Date().toISOString() },
      };
      await supabaseAdmin
        .from('summaries')
        .upsert({ hotel_id, summary: emptySummary, updated_at: new Date().toISOString() });
      return res.status(200).json({ cached: false, summary: emptySummary });
    }

    // 3) ПРОМПТ
    const promptText = buildPromptText(safeReviews);

    // 4) OPENAI
    const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is missing in server env' });

    const client = new OpenAI({ apiKey });

    let aiContent = '';
    try {
      const ai = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.2,
        max_tokens: 600,
      });
      aiContent = ai.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      const msg =
        err instanceof APIError
          ? err.error?.message ?? `${err.status} ${err.name}`
          : err instanceof Error
          ? err.message
          : String(err);
      return res.status(502).json({ error: `OpenAI error: ${msg}` });
    }

    const finalContent = aiContent || 'Не удалось получить ответ от модели.';
    const summary: SummaryPayload = {
      model: MODEL,
      content: finalContent,
      stats: { reviews_count: safeReviews.length, generated_at: new Date().toISOString() },
    };

    // 5) СОХРАНИТЬ КЭШ
    const up = await supabaseAdmin
      .from('summaries')
      .upsert({ hotel_id, summary, updated_at: new Date().toISOString() });

    if (up.error) {
      console.error('cache upsert error', up.error);
    }

    return res.status(200).json({ cached: false, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('analyzeReviews error:', msg);
    return res.status(500).json({ error: msg });
  }
}
