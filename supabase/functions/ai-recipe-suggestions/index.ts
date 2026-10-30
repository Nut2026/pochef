import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { inventory, filters } = await req.json();

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const systemPrompt = `You are a professional chef AI. Generate 6 original, diverse recipe suggestions based on the user's inventory and preferences.

CRITICAL RULES:
1. Each recipe MUST use ONLY ingredients available in the user's inventory. Do NOT suggest recipes requiring ingredients not listed.
2. Respect ingredient QUANTITIES — if the user has 1 chicken breast, do not suggest a recipe requiring 4.
3. Each recipe MUST include a complete, detailed step-by-step recipe with 5–12 steps.
4. Calculate accurate full macros (calories, protein, carbs, fat) per serving.
5. Include ripening_rate for any fruit/vegetable: estimated percentage of ripeness progression per day at room temperature (e.g. 0.15 means 15%/day).

Return a JSON object: { "recipes": [...] }
Each recipe object must have EXACTLY these fields:
{
  "id": string (unique short id, e.g. "r1"),
  "name": string (creative dish name),
  "area": string (cuisine/region, e.g. "Italian", "Chinese", "American"),
  "category": string (e.g. "Main Course", "Appetizer", "Dessert", "Soup"),
  "instructions": [
    { "step_number": number, "instruction": string, "time_mins": number }
  ] (5–12 detailed steps; each step has a realistic time estimate),
  "ingredients": [{"name": string, "measure": string}] (only ingredients from inventory),
  "prepTimeMins": number,
  "difficulty": "beginner" | "intermediate" | "advanced",
  "mealType": string (breakfast/lunch/dinner/snack),
  "calories": number (per serving, accurate estimate),
  "protein": number (grams per serving),
  "carbs": number (grams per serving),
  "fat": number (grams per serving),
  "servings": number (base serving size this recipe is written for),
  "imagePrompt": string (short vivid description for image generation)
}

Return ONLY valid JSON. No markdown, no explanation.`;

    const userContent = `Inventory (with quantities): ${inventory}

Filters:
- Dietary: ${filters.dietary || 'none'}
- Meal Type: ${filters.mealType || 'any'}
- Max cooking time: ${filters.cookingMinutes || 60} minutes
- Cuisine preference: ${filters.cuisine || 'any'}
- Additional requirements: ${filters.constraints || 'none'}
- Available cooking devices: ${(filters.cookingDevices || []).join(', ') || 'standard kitchen equipment'}
- Prioritize expiring items: ${filters.prioritizeExpiring ? 'Yes' : 'No'}

IMPORTANT: Only suggest recipes using ingredients from the inventory above. Respect their quantities.
Generate 6 diverse, creative recipes with complete step-by-step instructions (5–12 steps each).`;

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
        temperature: 0.7,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{"recipes":[]}';

    let parsed: { recipes: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { recipes: [] };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('ai-recipe-suggestions error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, recipes: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
