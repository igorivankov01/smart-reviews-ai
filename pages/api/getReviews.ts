// pages/api/getReviews.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabasePublic } from '../../lib/supabasePublic';

// Локальный тип ответа из БД (минимум нужных полей)
type Review = {
  id: string;
  hotel_id: string;
  text: string;
  rating: number | null;
  created_at: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const hotel_id = (req.query.hotel_id as string | undefined)?.trim();
    if (!hotel_id) return res.status(400).json({ error: 'hotel_id required' });

    // безопасный парс параметров пагинации
    const limitParam = Number(req.query.limit ?? 50);
    const offsetParam = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, limitParam)) : 50;
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

    // ВАЖНО: подсказываем TS тип результата, чтобы count был известен
    const { data, error, count }: {
      data: Review[] | null;
      error: PostgrestError | null;
      count: number | null;
    } = await supabasePublic
      .from('reviews')
      .select('id, hotel_id, text, rating, created_at', { count: 'exact' })
      .eq('hotel_id', hotel_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // возвращаем и данные, и общее количество
    return res.status(200).json({
      data: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
