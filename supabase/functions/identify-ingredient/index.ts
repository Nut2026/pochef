import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) throw new Error('Missing image field (base64 string)');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const prompt = `You are analyzing a food/ingredient image. Identify all food items visible.
Return a JSON array of objects with:
- "name": string (common food name, title-case)
- "quantity": number (estimate how many/much, default 1)
- "unit": string (appropriate unit: "piece", "bunch", "head", "kg", "g" etc.)
- "confidence": number (0-1, how confident you are)
- "category": string (e.g. "vegetable", "fruit", "protein", "dairy", "grain")

Return ONLY valid JSON array with no markdown. Example:
[{"name":"Broccoli","quantity":1,"unit":"head","confidence":0.95,"category":"vegetable"}]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini error: ${await response.text()}`);

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let items: unknown[];
    try {
      items = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      items = match ? JSON.parse(match[0]) : [];
    }

    // Filter by confidence
    const highConf = Array.isArray(items)
      ? items.filter((i: unknown) => (i as { confidence: number }).confidence >= 0.6)
      : items;

    return new Response(
      JSON.stringify({ items: highConf }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('identify-ingredient error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, items: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});