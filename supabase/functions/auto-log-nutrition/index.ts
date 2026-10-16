import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { description, servings = 1 } = await req.json();
    if (!description) throw new Error('Missing description');

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const prompt = `Estimate the nutritional values for the following food/meal:

"${description}" (${servings} serving(s))

Return a JSON object with these exact fields:
{
  "calories": number (total kcal),
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams)
}

Rules:
- Use realistic average values based on standard recipes/ingredients
- Scale by servings
- Round to 1 decimal place
- Return ONLY valid JSON, no markdown, no explanation`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are a nutrition expert. Return only valid JSON with nutritional estimates.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? '{}';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let nutrition: { calories: number; protein: number; carbs: number; fat: number };
    try {
      nutrition = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      nutrition = match ? JSON.parse(match[0]) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    return new Response(
      JSON.stringify(nutrition),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('auto-log-nutrition error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, calories: 0, protein: 0, carbs: 0, fat: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});