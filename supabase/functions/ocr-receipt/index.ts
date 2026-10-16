import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const image = body?.image;
    const mimeType = body?.mimeType || 'image/jpeg';

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'Missing image field (base64 string)', items: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured on server', items: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are analyzing a grocery receipt image. Extract ONLY food and beverage items that are edible/drinkable. Strictly OMIT all non-food items (cleaning products, toiletries, batteries, stationery, pet supplies, household items, bags, etc.).

For each food item, identify the FULL product name as it would appear in a grocery store — decode abbreviations and shorthand (e.g. "HNYMD SMORES" → "Honey Maid S'mores", "EVRGD CHKN BRST" → "Evergood Chicken Breast"). Use proper title case.

For each food item return:
- "name": string — full, decoded title-case product name
- "quantity": number — how many packs/pieces (default 1)
- "amount_value": number — numeric weight/volume (e.g. 500 for 500g)
- "amount_unit": string — unit: g, kg, ml, l, oz, lb, or "N/A"
- "price": number — price in local currency (0 if not visible)
- "shelf_life": object with per-storage expiry in DAYS (integer) or "not_advised":
  { "room_temperature": number|"not_advised", "refrigerator": number|"not_advised", "freezer": number|"not_advised", "default_storage": "room_temperature"|"refrigerator"|"freezer" }
- "is_fruit": boolean — true ONLY for actual fruits (apples, bananas, mangoes, avocados, berries, etc.)
- "ripening_days": object or null — for fruits only:
  { "unripe_to_nearly_ripe": number, "nearly_ripe_to_ripe": number, "ripe_to_overripe": number }

Rules for shelf_life:
- Use realistic food safety standards (USDA/FDA guidelines)
- "not_advised" = storing there is unsafe (e.g. raw meat at room temp)
- default_storage = safest recommended location
- Days counted from purchase date

Return a SINGLE JSON object: {"items": [...array of items...]}
Return ONLY valid JSON. No markdown, no explanation.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: image } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const geminiData = await response.json();

    // Check for safety blocks or empty candidates
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('Gemini returned no candidates:', JSON.stringify(geminiData));
      throw new Error('Gemini returned no response. The image may be blocked or unclear.');
    }

    const rawText = geminiData.candidates[0]?.content?.parts?.[0]?.text ?? '{"items":[]}';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: { items: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { items: [] };
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    return new Response(
      JSON.stringify({ items, count: items.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('ocr-receipt error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, items: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});