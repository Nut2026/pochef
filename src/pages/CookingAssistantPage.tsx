import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  getCookingSession, createCookingSession, updateCookingSession,
  logNutrition, updateInventoryItem, getInventory, autoLogNutrition,
  getCookingSessionByRoomCode,
} from '@/lib/api';
import type { CookingSession, ChatMessage, InventoryItem } from '@/types/types';
import { supabase } from '@/db/supabase';
import {
  ChefHat, Send, Pause, Check, HelpCircle, Timer,
  Thermometer, Users, RefreshCw, CheckSquare, Square,
  Utensils, ArrowLeft, Play, RotateCcw, StopCircle,
} from 'lucide-react';

interface Step {
  text: string;
  done: boolean;
  timerSeconds?: number;
}

/** Robust step parser — handles inline "(1)", "1.", "1)" numbering OR newline-split */
function parseSteps(source: string | { instruction: string; time_mins?: number }[]): Step[] {
  // If Groq returned structured steps array
  if (Array.isArray(source)) {
    return source.map(s => ({
      text: s.instruction.trim(),
      done: false,
      timerSeconds: s.time_mins ? s.time_mins * 60 : extractTimerSeconds(s.instruction),
    })).filter(s => s.text.length > 3);
  }
  if (!source || typeof source !== 'string') return [];
  const str = source.trim();

  // Split on any inline numbering: "(1)", "1.", "1)" possibly preceded by whitespace
  const parts = str.split(/\s*[\(\[]?\d+[\)\]]?[.)]\s+/).map(s => s.trim()).filter(s => s.length > 4);
  if (parts.length > 1) {
    // First element might be empty if string starts with a number
    const clean = parts[0].length > 4 ? parts : parts.slice(1);
    if (clean.length > 1) return clean.map(text => ({ text, done: false, timerSeconds: extractTimerSeconds(text) }));
  }

  // Newline split
  const lines = str.split(/\r?\n/).map(l => l.replace(/^\s*[\(\[]?\d+[\)\]]?[.)]\s*/, '').trim()).filter(l => l.length > 4);
  if (lines.length > 1) return lines.map(text => ({ text, done: false, timerSeconds: extractTimerSeconds(text) }));

  // Sentence split as last resort
  const sentences = str.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10);
  return sentences.length > 1
    ? sentences.map(text => ({ text, done: false, timerSeconds: extractTimerSeconds(text) }))
    : [{ text: str, done: false, timerSeconds: extractTimerSeconds(str) }];
}

function extractTimerSeconds(text: string): number | undefined {
  const secMatch = text.match(/(\d+)\s*(?:to\s*\d+\s*)?sec(?:ond)?s?/i);
  if (secMatch) return parseInt(secMatch[1]);
  const minMatch = text.match(/(\d+)\s*(?:to\s*\d+\s*)?min(?:ute)?s?/i);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  const hrMatch = text.match(/(\d+(?:\.\d+)?)\s*hour/i);
  if (hrMatch) return Math.round(parseFloat(hrMatch[1]) * 3600);
  return undefined;
}

// ── Per-step timer with start / stop / resume / restart ──────────
function StepTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => setRemaining(r => r - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    if (remaining <= 0 && running) {
      setRunning(false);
      toast.info('⏱ Timer complete!');
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      <Timer className="h-3 w-3 text-primary shrink-0" />
      <span className={`text-xs font-mono font-semibold min-w-[36px] ${remaining <= 10 && remaining > 0 ? 'text-destructive' : remaining === 0 ? 'text-success' : 'text-primary'}`}>
        {fmt(remaining)}
      </span>
      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setRunning(r => !r)}>
        {running ? <><StopCircle className="h-3 w-3 mr-1" />Stop</> : <><Play className="h-3 w-3 mr-1" />{remaining < seconds ? 'Resume' : 'Start'}</>}
      </Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => { setRunning(false); setRemaining(seconds); }}>
        <RotateCcw className="h-3 w-3 mr-1" />Restart
      </Button>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        isUser ? 'bg-copper-gradient text-primary-foreground' : 'glass border border-border'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function CookingAssistantPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const recipeFromNav = location.state?.recipe as {
    name: string;
    instructions: string | { instruction: string; time_mins?: number }[];
    ingredients: { name: string; measure: string }[];
    thumbnail?: string;
    prepTimeMins?: number;
    calories?: number; protein?: number; carbs?: number; fat?: number;
    difficulty?: string; mealDbId?: string;
  } | null;

  const [session, setSession] = useState<CookingSession | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [iAteLoading, setIAteLoading] = useState(false);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load or create session
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        let sess: CookingSession | null = null;

        if (roomCode) {
          sess = await getCookingSessionByRoomCode(roomCode);
        }

        if (!sess && recipeFromNav) {
          // Build steps from instructions
          const parsedSteps = parseSteps(recipeFromNav.instructions || '');
          sess = await createCookingSession(user.id, {
            recipe_name: recipeFromNav.name,
            current_step: 0,
            total_steps: parsedSteps.length,
            is_active: true,
            messages: [],
            steps_json: parsedSteps,
          });
          if (!cancelled && sess) {
            setSteps(parsedSteps);
            setMessages([]);
            await supabase.functions.invoke('cooking-assistant', {
              body: {
                action: 'start', recipe: { name: recipeFromNav.name, steps: parsedSteps.map(s => s.text), ingredients: recipeFromNav.ingredients },
                messages: [],
              },
            }).then(({ data }) => {
              if (data?.message) {
                const aiMsg: ChatMessage = { role: 'assistant', content: data.message, timestamp: new Date().toISOString() };
                setMessages([aiMsg]);
                updateCookingSession(sess!.id, { messages: [aiMsg] });

                window.pendo?.trackAgent("agent_response", {
                  agentId: "YPaO9W_Euo3NBUJMpnMOgqSkFIM",
                  conversationId: sess!.id,
                  messageId: crypto.randomUUID(),
                  content: data.message,
                });
              }
            });
          }
        } else if (sess) {
          if (!cancelled) {
            setMessages((sess.messages as ChatMessage[]) || []);
            if (sess.steps_json && sess.steps_json.length > 0) {
              setSteps(sess.steps_json.map((s, i) => ({
                text: s.text,
                done: i < (sess!.current_step || 0),
                timerSeconds: s.timerSeconds,
              })));
            } else if (recipeFromNav?.instructions) {
              setSteps(parseSteps(recipeFromNav.instructions).map((s, i) => ({
                ...s,
                done: i < (sess!.current_step || 0),
              })));
            }
          }
        }

        if (!cancelled) setSession(sess);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [user, roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (text: string, action = 'chat') => {
    if (!session || !text.trim()) return;
    setAiLoading(true);
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    window.pendo?.trackAgent("prompt", {
      agentId: "YPaO9W_Euo3NBUJMpnMOgqSkFIM",
      conversationId: session.id,
      messageId: crypto.randomUUID(),
      content: text,
      suggestedPrompt: action !== 'chat',
    });

    try {
      const { data } = await supabase.functions.invoke('cooking-assistant', {
        body: {
          sessionId: session.id, action,
          recipe: {
            name: session.recipe_name,
            steps: steps.map(s => s.text),
            ingredients: recipeFromNav?.ingredients || [],
            currentStep: session.current_step,
          },
          messages: newMessages,
        },
      });
      const aiMsg: ChatMessage = { role: 'assistant', content: data?.message || "I'm here to help!", timestamp: new Date().toISOString() };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      await updateCookingSession(session.id, { messages: updated });

      window.pendo?.trackAgent("agent_response", {
        agentId: "YPaO9W_Euo3NBUJMpnMOgqSkFIM",
        conversationId: session.id,
        messageId: crypto.randomUUID(),
        content: aiMsg.content,
      });
    } catch {
      toast.error('AI assistant unavailable');
    } finally {
      setAiLoading(false);
    }
  }, [session, messages, steps, recipeFromNav]);

  const handleStepDone = useCallback(async () => {
    if (!session) return;
    const currentIdx = session.current_step;
    const newSteps = steps.map((s, i) => i === currentIdx ? { ...s, done: true } : s);
    setSteps(newSteps);
    const nextStep = Math.min(currentIdx + 1, steps.length);
    const updated = { ...session, current_step: nextStep };
    setSession(updated);
    await updateCookingSession(session.id, { current_step: nextStep, steps_json: newSteps });
    await sendMessage(`✅ Step ${currentIdx + 1} done. Moving to step ${nextStep + 1}.`, 'next_step');
  }, [session, steps, sendMessage]);

  const handleIAteThis = async () => {
    if (!user || !session) return;
    setIAteLoading(true);
    try {
      // 1. Log nutrition — prefer recipe macros, fall back to auto-estimate
      const cal = recipeFromNav?.calories ?? 0;
      if (cal > 0) {
        await logNutrition(user.id, {
          recipe_name: session.recipe_name,
          calories: cal,
          protein: recipeFromNav!.protein ?? 0,
          carbs: recipeFromNav!.carbs ?? 0,
          fat: recipeFromNav!.fat ?? 0,
          servings: 1,
        });
      } else {
        await autoLogNutrition(user.id, session.recipe_name, 1);
      }

      // 2. Deduct ingredients from inventory
      if (recipeFromNav?.ingredients?.length) {
        const inventory = await getInventory(user.id);
        for (const ing of recipeFromNav.ingredients) {
          const match = inventory.find((item: InventoryItem) =>
            item.name.toLowerCase().includes(ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(item.name.toLowerCase())
          );
          if (match) {
            const used = parseFloat(ing.measure) || 1;
            const newQty = Math.max(0, match.quantity - used);
            if (newQty <= 0) {
              await updateInventoryItem(match.id, { is_consumed: true, consumed_at: new Date().toISOString() });
            } else {
              await updateInventoryItem(match.id, { quantity: newQty });
            }
          }
        }
      }

      // 3. Mark session inactive
      await updateCookingSession(session.id, { is_active: false });
      toast.success('Meal logged! Inventory updated 🎉', { duration: 4000 });
      navigate('/cooking');
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIAteLoading(false);
    }
  };

  const convertTemp = (text: string) =>
    tempUnit === 'F' ? text.replace(/(\d+)°C/g, (_, c) => `${Math.round(parseInt(c) * 9 / 5 + 32)}°F`) : text;

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  if (!session) return (
    <AppLayout>
      <div className="glass rounded-2xl p-12 text-center">
        <ChefHat className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="font-semibold text-muted-foreground">No active cooking session</p>
        <p className="text-sm text-muted-foreground mt-1">Go to Meal Planning to start cooking a recipe</p>
        <Button className="mt-4" onClick={() => navigate('/cooking')}>Back to Sessions</Button>
      </div>
    </AppLayout>
  );

  const completedSteps = steps.filter(s => s.done).length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/cooking')} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold gradient-text text-balance truncate max-w-lg">
                {session.recipe_name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-1">
                {recipeFromNav?.difficulty && <Badge variant="secondary">{recipeFromNav.difficulty}</Badge>}
                {recipeFromNav?.prepTimeMins && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />{recipeFromNav.prepTimeMins} min
                  </Badge>
                )}
                {session.room_code && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />Room: {session.room_code}
                  </Badge>
                )}
                <button
                  onClick={() => setTempUnit(t => t === 'C' ? 'F' : 'C')}
                  className="flex items-center gap-1 text-xs glass rounded px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Thermometer className="h-3 w-3" />°{tempUnit}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted-foreground">{completedSteps}/{steps.length} steps · {progress}%</span>
            <Progress value={progress} className="w-24 h-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Recipe + Steps */}
          <div className="space-y-4">
            {recipeFromNav?.thumbnail && (
              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl">
                <img src={recipeFromNav.thumbnail} alt={session.recipe_name} className="w-full h-full object-cover" />
              </div>
            )}

            {recipeFromNav?.ingredients && recipeFromNav.ingredients.length > 0 && (
              <Card className="glass border-0 shadow-card">
                <CardContent className="pt-4">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />Ingredients
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {recipeFromNav.ingredients.map((ing, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">{ing.measure}</span> {ing.name}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Steps with per-step timers */}
            <Card className="glass border-0 shadow-card">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold mb-3">Steps</p>
                <div className="space-y-2">
                  {steps.map((step, i) => {
                    const isCurrent = i === session.current_step;
                    return (
                      <div
                        key={i}
                        className={`flex gap-3 rounded-lg p-2.5 transition-all ${
                          step.done ? 'bg-success/10 opacity-60' :
                          isCurrent ? 'bg-primary/10 border border-primary/20' :
                          'hover:bg-muted/50'
                        }`}
                      >
                        <button
                          onClick={() => {
                            const newSteps = steps.map((s, j) => j === i ? { ...s, done: !s.done } : s);
                            setSteps(newSteps);
                            updateCookingSession(session.id, { steps_json: newSteps });
                          }}
                          className="shrink-0 mt-0.5"
                        >
                          {step.done
                            ? <CheckSquare className="h-4 w-4 text-success" />
                            : <Square className={`h-4 w-4 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-relaxed ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                            <span className="font-semibold mr-1">Step {i + 1}:</span>
                            {convertTemp(step.text)}
                          </p>
                          {/* Show timer on current step and any non-done step the user hovers */}
                          {step.timerSeconds && !step.done && (
                            <StepTimer seconds={step.timerSeconds} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Chat */}
          <div className="flex flex-col h-full">
            <Card className="glass border-0 shadow-card flex flex-col" style={{ minHeight: 480 }}>
              <CardContent className="pt-4 flex flex-col h-full gap-3">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Pochef Assistant</p>
                  {aiLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
                  {paused && <Badge variant="outline" className="border-warning text-warning ml-auto text-xs">Paused</Badge>}
                </div>
                <Separator />

                <ScrollArea className="flex-1 pr-1" style={{ maxHeight: 320 }}>
                  <div className="space-y-1 pb-2">
                    {messages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        The AI assistant will guide you through cooking…
                      </p>
                    )}
                    {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                    {aiLoading && (
                      <div className="flex justify-start mb-2">
                        <div className="glass border border-border rounded-2xl px-3 py-2">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                                   style={{ animationDelay: `${i * 150}ms` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Quick action buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm" className="flex-1 text-xs h-8 bg-copper-gradient text-primary-foreground"
                    onClick={handleStepDone}
                    disabled={completedSteps >= steps.length}
                  >
                    <Check className="h-3 w-3 mr-1" />Done
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="flex-1 text-xs h-8 glass border-warning/40 text-warning"
                    onClick={() => sendMessage("Help! I'm having trouble with this step.", 'help')}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />Help!
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => { setPaused(p => !p); sendMessage(paused ? "I'm ready to continue." : 'Please pause.', 'pause'); }}
                  >
                    <Pause className="h-3 w-3 mr-1" />{paused ? 'Resume' : 'Pause'}
                  </Button>
                </div>

                {/* Chat input */}
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder="Ask anything… e.g. 'Can I double the sauce?'"
                    className="flex-1 text-sm"
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || aiLoading}
                    className="bg-copper-gradient text-primary-foreground shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Nutrition summary */}
                {(recipeFromNav?.calories ?? 0) > 0 && (
                  <div className="glass-light rounded-lg p-2 grid grid-cols-4 gap-1 text-center">
                    {[
                      { label: 'Cal', value: recipeFromNav!.calories },
                      { label: 'Protein', value: `${recipeFromNav!.protein}g` },
                      { label: 'Carbs', value: `${recipeFromNav!.carbs}g` },
                      { label: 'Fat', value: `${recipeFromNav!.fat}g` },
                    ].map(m => (
                      <div key={m.label}>
                        <p className="text-xs font-semibold">{m.value}</p>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full bg-success/90 hover:bg-success text-white text-sm"
                  onClick={handleIAteThis}
                  disabled={iAteLoading}
                >
                  {iAteLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : '🍽️ '}
                  I Ate This!
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
