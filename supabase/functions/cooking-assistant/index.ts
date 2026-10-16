import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { sessionId, action, recipe, messages } = await req.json();

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const systemPrompt = `You are a personal chef specialising in ${recipe?.name || 'this dish'}. Behave professionally but not cold.

The recipe has ${recipe?.steps?.length ?? 0} steps. The user is currently on step ${(recipe?.currentStep ?? 0) + 1}.

Steps:
${(recipe?.steps ?? []).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

Ingredients:
${(recipe?.ingredients ?? []).map((ing: { name: string; measure: string }) => `- ${ing.measure} ${ing.name}`).join('\n')}

Your personality:
- Encouraging, warm, and practical
- Give concise, actionable answers
- When user says they're done with a step, confirm and briefly preview the next step
- When user asks for help, ask what is wrong then diagnose and fix: too salty means add acid or starch; too dry means add liquid; burnt means salvage tips
- For substitution questions, suggest alternatives and note any impact on nutrition or timing
- Keep responses under 150 words unless detailed instructions are needed
- IMPORTANT: Do NOT use any formatting such as asterisks, bold, italics, bullet points, or numbered lists. Use plain text only.`;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
        .filter((m: { role: string }) => m.role !== 'system')
        .map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    if (action === 'start' && (!messages || messages.length === 0)) {
      groqMessages.push({
        role: 'user',
        content: `I'm starting to cook ${recipe?.name}. Please greet me and tell me what to prepare first.`,
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: groqMessages,
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      throw new Error(`Groq error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content ?? "I'm here to help! What do you need?";
    if (!message || message.trim().length < 3) {
      throw new Error('Groq returned empty response');
    }

    return new Response(
      JSON.stringify({ message, sessionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('cooking-assistant error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, message: "I'm having trouble connecting. Please try again!" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});