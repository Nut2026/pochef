import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Sparkles, Eye, EyeOff, ChefHat } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Login state
  const [loginId, setLoginId] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Signup state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPwd) { toast.error('Please fill in all fields'); return; }
    setLoginLoading(true);
    const { error } = await signIn(loginId.trim(), loginPwd);
    setLoginLoading(false);
    if (error) { toast.error(error.message || 'Login failed'); return; }
    if (typeof pendo !== 'undefined') {
      pendo.track('user_signed_in', {
        login_method: loginId.includes('@') ? 'email' : 'username',
      });
    }
    toast.success('Welcome back, Chef!');
    navigate('/dashboard');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPwd || !regConfirm) { toast.error('Please fill in all fields'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername)) { toast.error('Username: letters, digits, and _ only'); return; }
    if (regPwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (regPwd !== regConfirm) { toast.error('Passwords do not match'); return; }
    if (!agreed) { toast.error('Please accept the User Agreement'); return; }
    setRegLoading(true);
    const { error } = await signUp(regUsername.trim(), regEmail.trim(), regPwd);
    setRegLoading(false);
    if (error) { toast.error(error.message || 'Sign up failed'); return; }
    if (typeof pendo !== 'undefined') {
      pendo.track('user_signed_up', {
        username: regUsername.trim(),
        has_email: !!regEmail.trim(),
        signup_method: 'email',
      });
    }
    toast.success('Account created! Welcome to Pochef.');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-background)' }}>
      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full z-0 pointer-events-none opacity-30"
           style={{ background: 'radial-gradient(circle, #E8A87C44, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full z-0 pointer-events-none opacity-20"
           style={{ background: 'radial-gradient(circle, #B8733344, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-copper-gradient shadow-lg mb-4">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold gradient-text text-balance">Pochef</h1>
          <p className="text-sm text-muted-foreground mt-1">Your Digital Kitchen Twin</p>
        </div>

        <div className="glass rounded-2xl p-6 shadow-lg">
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Create Account</TabsTrigger>
            </TabsList>

            {/* LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="loginId" className="text-sm font-normal">Username or Email</Label>
                  <Input
                    id="loginId"
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    placeholder="your_username or email@example.com"
                    autoComplete="username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="loginPwd" className="text-sm font-normal">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="loginPwd"
                      type={showLoginPwd ? 'text' : 'password'}
                      value={loginPwd}
                      onChange={e => setLoginPwd(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowLoginPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-copper-gradient text-primary-foreground font-semibold h-10" disabled={loginLoading}>
                  {loginLoading ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            {/* SIGN UP */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="regUsername" className="text-sm font-normal">Username</Label>
                  <Input
                    id="regUsername"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    placeholder="chef_master (letters, digits, _)"
                    autoComplete="username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="regEmail" className="text-sm font-normal">Email <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="regEmail"
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="regPwd" className="text-sm font-normal">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="regPwd"
                      type={showRegPwd ? 'text' : 'password'}
                      value={regPwd}
                      onChange={e => setRegPwd(e.target.value)}
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowRegPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showRegPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="regConfirm" className="text-sm font-normal">Confirm Password</Label>
                  <Input
                    id="regConfirm"
                    type="password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="agree"
                    checked={agreed}
                    onCheckedChange={v => setAgreed(!!v)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="agree" className="text-xs font-normal text-muted-foreground leading-relaxed cursor-pointer">
                    I agree to the{' '}
                    <Link to="/terms" className="text-primary hover:underline">User Agreement</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                </div>
                <Button type="submit" className="w-full bg-copper-gradient text-primary-foreground font-semibold h-10" disabled={regLoading}>
                  {regLoading ? 'Creating account…' : <><ChefHat className="h-4 w-4 mr-2" />Start Cooking</>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By using Pochef you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
