import { ArrowLeft, Brain, Clock, Cookie, Lock, Server, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const LOGO = '/pochef-logo.png';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-background)' }}>
      {/* Header */}
      <header className="border-b border-border/50 glass-heavy">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 shrink-0">
            <img src={LOGO} alt="Pochef" className="h-7 w-7 rounded-lg" />
            <span className="font-bold gradient-text text-base leading-none">Pochef</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login"><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text text-balance">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long' })}</p>
        </div>

        <Card className="glass border-0 shadow-card">
          <CardContent className="p-6 md:p-8 space-y-8">
            <Section title="1. Data We Collect" icon={<UserCheck className="h-4 w-4" />}>
              We collect the minimum data necessary to provide Pochef's services:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-muted-foreground">
                <li><strong>Account data:</strong> username, email address (optional), password hash (handled by Supabase Auth)</li>
                <li><strong>Kitchen data:</strong> inventory items, fermentation batches, meal plans, saved recipes, nutrition logs, waste logs</li>
                <li><strong>Preferences:</strong> cooking devices, currency, dietary goals, color scheme</li>
                <li><strong>Usage data:</strong> anonymized feature usage to improve the app</li>
              </ul>
            </Section>

            <Separator />

            <Section title="2. AI Services" icon={<Brain className="h-4 w-4" />}>
              Pochef uses third-party AI services to enhance your experience:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-muted-foreground">
                <li><strong>Groq AI</strong> powers recipe generation, shelf-life predictions, cooking assistance, and smart suggestions</li>
                <li><strong>Gemini 2.0 Flash</strong> processes receipt images for OCR and ingredient extraction</li>
                <li><strong>Stable Diffusion</strong> generates recipe imagery and fermentation reference images</li>
              </ul>
              Your inventory and recipe data may be sent to these services for processing. We do not share your data with AI services for marketing or advertising purposes.
            </Section>

            <Separator />

            <Section title="3. Data Storage and Security" icon={<Server className="h-4 w-4" />}>
              All data is stored in <strong>Supabase</strong>, which provides enterprise-grade security with Row-Level Security (RLS) policies. This means your kitchen data is only ever visible to you. We use encrypted connections (TLS/SSL) for all data transfers. Passwords are hashed using industry-standard bcrypt by Supabase Auth — we never store plain-text passwords.
            </Section>

            <Separator />

            <Section title="4. Your Rights" icon={<UserCheck className="h-4 w-4" />}>
              You have full control over your data:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-muted-foreground">
                <li><strong>Access:</strong> View all your data at any time through the app</li>
                <li><strong>Export:</strong> Pro users can export meal plans and nutrition logs as PDFs</li>
                <li><strong>Deletion:</strong> Delete your account and all associated data from your Profile page</li>
                <li><strong>Correction:</strong> Edit any inventory item, recipe, or log at any time</li>
              </ul>
            </Section>

            <Separator />

            <Section title="5. Cookies and Local Storage" icon={<Cookie className="h-4 w-4" />}>
              Pochef uses browser local storage to remember your filter defaults and session state. We use essential cookies for authentication (managed by Supabase Auth). We do not use third-party tracking cookies or advertising cookies.
            </Section>

            <Separator />

            <Section title="6. Third-Party Integrations" icon={<Server className="h-4 w-4" />}>
              Pochef integrates with the following services:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-muted-foreground">
                <li><strong>TheMealDB API</strong> for base recipe database lookups</li>
                <li><strong>Supabase</strong> for authentication, database, storage, and real-time sync</li>
                <li><strong>ExchangeRate-API</strong> for currency conversion in pricing displays</li>
              </ul>
              These integrations only receive the data necessary to perform their specific function.
            </Section>

            <Separator />

            <Section title="7. Data Retention" icon={<Clock className="h-4 w-4" />}>
              Your account data and kitchen data are retained as long as your account is active. If you delete your account, all personal data is permanently removed within 30 days. Anonymized usage statistics may be retained longer for product improvement purposes.
            </Section>

            <Separator />

            <Section title="8. Children's Privacy">
              Pochef is not intended for children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us with personal data, please contact us immediately.
            </Section>

            <Separator />

            <Section title="9. Changes to This Policy">
              We may update this Privacy Policy from time to time. Significant changes will be communicated via email or in-app notification. Continued use of Pochef after changes constitutes acceptance of the updated policy.
            </Section>

            <Separator />

            <Section title="10. Contact Us">
              If you have any questions about this Privacy Policy or your data, please contact us at{' '}
              <span className="text-primary font-medium">support@pochef.app</span>.
            </Section>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            Your privacy matters. We never sell or share your personal data with advertisers.
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        {title}
      </h2>
      <div className="text-sm text-muted-foreground text-pretty leading-relaxed">{children}</div>
    </div>
  );
}
