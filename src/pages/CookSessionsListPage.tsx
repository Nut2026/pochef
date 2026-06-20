import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getAllActiveCookingSessions, deleteCookingSession } from '@/lib/api';
import type { CookingSession } from '@/types/types';
import { ChefHat, RefreshCw, Play, X, Timer } from 'lucide-react';

export default function CookSessionsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CookingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const s = await getAllActiveCookingSessions(user.id);
      setSessions(s);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await deleteCookingSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      toast.success('Session removed');
    } catch {
      toast.error('Failed to remove session');
    } finally {
      setRemovingId(null);
    }
  };

  const handleResume = (session: CookingSession) => {
    navigate(`/cooking/${session.room_code}`);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getProgress = (session: CookingSession) => {
    if (!session.total_steps || session.total_steps === 0) return 0;
    return Math.round((session.current_step / session.total_steps) * 100);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Cooking Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">Resume your in-progress recipes</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <ChefHat className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="font-semibold text-muted-foreground">No active cooking sessions</p>
            <p className="text-sm text-muted-foreground mt-1">Go to Meal Planning and click Cook Now to start</p>
            <Button className="mt-6 bg-copper-gradient text-primary-foreground" onClick={() => navigate('/meal-planning/plan')}>
              Browse Recipes
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map(session => {
              const progress = getProgress(session);
              return (
                <Card key={session.id} className="glass border-0 shadow-card h-full flex flex-col">
                  <CardContent className="pt-4 flex flex-col h-full gap-3">
                    {/* Recipe name & room code */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-balance">{session.recipe_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(session.created_at)}</p>
                      </div>
                      {session.room_code && (
                        <Badge variant="outline" className="shrink-0 text-xs font-mono">
                          {session.room_code}
                        </Badge>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Step {session.current_step} of {session.total_steps}
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                      <Button
                        className="flex-1 bg-copper-gradient text-primary-foreground text-sm"
                        onClick={() => handleResume(session)}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />Resume
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10"
                        disabled={removingId === session.id}
                        onClick={() => handleRemove(session.id)}
                      >
                        {removingId === session.id
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
