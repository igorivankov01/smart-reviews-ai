// pages/api/searchHotels.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabasePublic } from '../../lib/supabasePublic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 1) return res.status(200).json({ data: [] });

  const { data, error } = await supabasePublic
    .from('hotels')
    .select('id, name, location, image_url')
    .ilike('name', `%${q}%`)
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
