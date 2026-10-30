import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text) throw new Error('Missing text field');

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const systemPrompt = `You parse natural language grocery/ingredient phrases into structured JSON.
Return a JSON array of items. Each item:
- "name": string (ingredient name, title-case, singular)
- "quantity": number (numeric amount, default 1)
- "unit": string ("piece","kg","g","lb","oz","L","ml","cup","pack","bunch","dozen","can","bottle")

Examples:
"Add 3 apples and 2 bananas" → [{"name":"Apple","quantity":3,"unit":"piece"},{"name":"Banana","quantity":2,"unit":"piece"}]
"half a kilo of chicken and a litre of milk" → [{"name":"Chicken","quantity":0.5,"unit":"kg"},{"name":"Milk","quantity":1,"unit":"L"}]

Return ONLY the JSON array. No markdown, no explanation.`;

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
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? '[]';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let items: unknown[];
    try {
      items = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      items = match ? JSON.parse(match[0]) : [];
    }

    return new Response(
      JSON.stringify({ items, original: text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('parse-voice-inventory error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, items: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});