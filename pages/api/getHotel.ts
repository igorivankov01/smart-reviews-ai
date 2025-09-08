// pages/api/getHotel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabasePublic } from '../../lib/supabasePublic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = (req.query.id as string | undefined)?.trim();
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data, error } = await supabasePublic
    .from('hotels')
    .select('id, name, location, image_url')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ data });
}
