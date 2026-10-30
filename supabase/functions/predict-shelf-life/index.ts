import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ingredientName } = await req.json();
    if (!ingredientName) throw new Error('Missing ingredientName');

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const prompt = `You are a food safety expert. For the ingredient "${ingredientName}", provide accurate shelf life estimates AND fruit ripening info.

Return a JSON object with exactly this structure:
{
  "room_temperature": <integer days> or "not_advised",
  "refrigerator": <integer days> or "not_advised",
  "freezer": <integer days> or "not_advised",
  "default_storage": "room_temperature" | "refrigerator" | "freezer",
  "is_fruit": true | false,
  "ripening_days": {
    "unripe_to_nearly_ripe": <integer days>,
    "nearly_ripe_to_ripe": <integer days>,
    "ripe_to_overripe": <integer days>
  } | null
}

Rules:
- Use realistic food safety standards (USDA/FDA guidelines)
- "not_advised" = storing there is unsafe or impractical (e.g. raw meat at room temperature)
- default_storage = safest recommended location for typical home use
- Days are from purchase/today
- is_fruit = true ONLY for actual fruits (apples, bananas, mangoes, avocados, etc.), NOT vegetables
- ripening_days = filled for fruits, null for non-fruits

Return ONLY valid JSON. No markdown, no explanation.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = {
        room_temperature: 'not_advised',
        refrigerator: 7,
        freezer: 90,
        default_storage: 'refrigerator',
        is_fruit: false,
        ripening_days: null,
      };
    }

    const shelf_life = {
      room_temperature: result.room_temperature,
      refrigerator: result.refrigerator,
      freezer: result.freezer,
      default_storage: result.default_storage,
    };

    return new Response(
      JSON.stringify({
        shelf_life,
        is_fruit: result.is_fruit ?? false,
        ripening_days: result.ripening_days ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('predict-shelf-life error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
