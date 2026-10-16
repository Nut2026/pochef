import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { inventory, preferences, existingList, days, pax, cookingDevices, requirements } = await req.json();

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const daysNum = Number(days) || 7;
    const paxNum  = Number(pax)  || 2;
    const occasion = requirements?.trim() || null;

    const systemPrompt = `You are a smart grocery shopping assistant. Generate a grocery list to feed ${paxNum} people for ${daysNum} days.

Rules:
1. Do NOT suggest items already well-stocked in inventory
2. Do NOT suggest items already in the existing grocery list
3. Consider nutritional balance: ${preferences || 'balanced'} diet
4. Account for available cooking devices: ${(cookingDevices || []).join(', ') || 'standard kitchen'}
5. Plan for ${paxNum} people eating ${daysNum} days worth of meals (breakfast, lunch, dinner)
6. Suggest staples they may be running low on (oils, spices, grains)
7. Suggest 10-16 items maximum, scaled to pax × days
${occasion ? `8. SPECIAL OCCASION: "${occasion}" — tailor ingredient choices and quantities accordingly.` : '8. No special occasion — treat this as a regular grocery run.'}

Return JSON: { "items": [...] }
Each item:
{
  "name": string (title-case),
  "quantity": string (amount as text, scaled for ${paxNum} people × ${daysNum} days),
  "unit": string (e.g. "piece", "g", "kg", "L", "pack"),
  "reason": string (short reason, 1 sentence)
}

Return ONLY valid JSON. No markdown.`;

    const userContent = `
Current inventory: ${(inventory || []).join(', ') || 'empty'}
Already on grocery list: ${(existingList || []).join(', ') || 'none'}
Dietary preference: ${preferences || 'balanced'}
Planning for: ${paxNum} people, ${daysNum} days
Cooking devices: ${(cookingDevices || []).join(', ') || 'standard'}
${occasion ? `Special occasion/requirements: ${occasion}` : ''}

Generate the grocery list.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? '{"items":[]}';

    let parsed: { items: unknown[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { items: [] };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('generate-grocery-list error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, items: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});