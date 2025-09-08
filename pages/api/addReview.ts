// pages/api/addReview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Подключаем Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

// Подключаем OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { hotel_id, text, rating } = req.body;

  try {
    // Генерация AI-анализа отзыва
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ты анализируешь отзывы об отелях." },
        { role: "user", content: text }
      ],
    });

    const analysis = aiResponse.choices[0].message?.content || "";

    // Сохраняем отзыв и AI-анализ в Supabase
    const { data, error } = await supabase
      .from("reviews")
      .insert([{ hotel_id, text, rating, analysis }]);

    if (error) throw error;

    res.status(200).json({ data, analysis });
  } catch (err) {
  const errorMessage =
    err instanceof Error ? err.message : "Неизвестная ошибка";
  res.status(500).json({ error: errorMessage });
}
}
