import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { batchId, type, totalDays, ambientTemp } = await req.json();

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const prompt = `Generate a day-by-day fermentation guide for ${type} over ${totalDays} days at ${ambientTemp}°C.

Return a JSON object: { "stages": [...] }
Each stage:
{
  "day_number": number (1 to ${totalDays}),
  "action_prompt": string (specific actionable instruction for that day, 1-2 sentences, food-safety focused)
}

Include critical milestones:
- Day 1: Setup and initial preparation
- Mid-point: Key check/action (burp jars, taste test, etc.)
- Final day: Readiness check and storage instructions
- Any food-safety critical actions specific to ${type}

Return ONLY valid JSON. No markdown.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an expert fermentation guide. Provide accurate, safe fermentation instructions.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? '{"stages":[]}';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: { stages: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { stages: [] };
    }

    return new Response(
      JSON.stringify({ ...parsed, batchId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
