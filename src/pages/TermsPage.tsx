import { ArrowLeft, ChefHat, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const LOGO = '/pochef-logo.png';

export default function TermsPage() {
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
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text text-balance">User Agreement</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long' })}</p>
        </div>

        <Card className="glass border-0 shadow-card">
          <CardContent className="p-6 md:p-8 space-y-8">
            <Section title="1. Service Description" icon={<ChefHat className="h-4 w-4" />}>
              Pochef is an AI-powered kitchen companion web application that provides inventory management, meal planning, cooking assistance, nutrition tracking, fermentation monitoring, and grocery list generation. The service is provided "as is" and may be updated or modified at any time.
            </Section>

            <Separator />

            <Section title="2. Account Responsibilities">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration and to update it as necessary. You must be at least 13 years old to use Pochef. You are solely responsible for all activities that occur under your account.
            </Section>

            <Separator />

            <Section title="3. Subscription Plans">
              Pochef offers three plans: Free (no cost), Pro Trial (28-day free trial with full Pro access), and Pro ($4.99/month or $39.99/year). The Free plan includes up to 50 inventory items, 2 active fermentation batches, daily meal planning, and basic nutrition tracking. Pro adds unlimited storage, batch meal planning, advanced nutrition analytics, smart grocery suggestions, and watermark-free PDF exports.
            </Section>

            <Separator />

            <Section title="4. Payment and Billing">
              All payments are processed securely through our payment provider. Pro subscriptions are billed monthly or annually based on your selected plan. You can cancel your subscription at any time from your Profile page. Cancellations take effect at the end of the current billing period.
            </Section>

            <Separator />

            <Section title="5. Cancellation and Refund Policy">
              You may cancel your Pro subscription at any time. Upon cancellation, you will retain Pro access until the end of your current billing period, after which your account will revert to the Free plan. Refunds are handled on a case-by-case basis and must be requested within 14 days of the charge date.
            </Section>

            <Separator />

            <Section title="6. Intellectual Property">
              All content, trademarks, logos, and intellectual property related to Pochef are owned by Pochef or its licensors. You may not copy, modify, distribute, or create derivative works from any part of the service without explicit written permission.
            </Section>

            <Separator />

            <Section title="7. Limitation of Liability">
              Pochef is provided for informational and organizational purposes only. We do not guarantee that recipes, nutritional estimates, or shelf-life predictions are 100% accurate. Always use your own judgment when preparing food, especially regarding allergies, food safety, and dietary restrictions. To the maximum extent permitted by law, Pochef shall not be liable for any indirect, incidental, or consequential damages.
            </Section>

            <Separator />

            <Section title="8. Termination">
              We reserve the right to suspend or terminate your account if you violate these terms or engage in abusive behavior. You may also delete your account at any time from your Profile page. Upon termination, all your data will be permanently deleted within 30 days.
            </Section>

            <Separator />

            <Section title="9. Governing Law">
              These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Pochef operates. Any disputes arising from these terms shall be resolved through good-faith negotiation.
            </Section>

            <Separator />

            <Section title="10. Changes to Terms">
              We may update these terms from time to time. We will notify you of significant changes via email or in-app notification. Continued use of Pochef after changes constitutes acceptance of the updated terms.
            </Section>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            Questions? Contact us at <span className="text-primary">support@pochef.app</span>
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
      <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{children}</p>
    </div>
  );
}
