import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChefHat, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden"
      style={{ background: 'var(--gradient-background)' }}
    >
      {/* Decorative blobs */}
      <div
        className="fixed top-0 right-0 w-96 h-96 rounded-full z-0 pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(circle, #E8A87C44, transparent 70%)', transform: 'translate(30%, -30%)' }}
      />
      <div
        className="fixed bottom-0 left-0 w-80 h-80 rounded-full z-0 pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #B8733344, transparent 70%)', transform: 'translate(-30%, 30%)' }}
      />

      <div className="relative z-10 glass rounded-2xl p-10 text-center max-w-md w-full shadow-card animate-scale-in">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-copper-gradient shadow-lg mb-6 mx-auto">
          <ChefHat className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-7xl font-bold gradient-text mb-2">404</h1>
        <h2 className="text-xl font-semibold text-balance mb-3">Page Not Found</h2>
        <p className="text-sm text-muted-foreground text-pretty mb-8">
          Looks like this recipe doesn't exist. The page may have been moved or deleted.
        </p>
        <Button asChild className="bg-copper-gradient text-primary-foreground font-semibold w-full">
          <Link to="/dashboard">
            <Home className="h-4 w-4 mr-2" />
            Back to Kitchen
          </Link>
        </Button>
      </div>

      <p className="absolute text-xs text-center text-muted-foreground bottom-6 left-1/2 -translate-x-1/2">
        &copy; {new Date().getFullYear()} Pochef
      </p>
    </div>
  );
}
