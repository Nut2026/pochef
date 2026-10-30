import { HelmetProvider } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Root wrapper that provides Helmet and Tooltip context for the entire app.
 */
export function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <HelmetProvider>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </HelmetProvider>
  );
}
