// pages/api/debug-env.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const k = process.env.OPENAI_API_KEY || '';
  const info = {
    cwd: process.cwd(),
    hasKey: Boolean(k),
    keyLen: k.length,
    keyTail: k ? k.slice(-4) : null, // последние 4 символа для сверки
    nodeEnv: process.env.NODE_ENV,
    runtime: 'nodejs',
  };
  res.status(200).json(info);
}
