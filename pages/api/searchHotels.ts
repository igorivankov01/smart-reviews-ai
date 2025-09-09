// pages/api/search-hotels.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabasePublic } from '../../lib/supabasePublic'

type HotelListItem = {
  id: string
  name: string
  location: string | null
  image_url: string | null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string | undefined)?.trim() || ''
  if (!q) return res.status(400).json({ error: 'q is required' })

  const { data, error } = await supabasePublic
    .from('hotels')
    .select('id,name,location,image_url')
    .ilike('name', `%${q}%`)
    .limit(10)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ data: (data as HotelListItem[]) ?? [] })
}
