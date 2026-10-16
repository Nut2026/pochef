import { Helmet, HelmetProvider } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Set the page title and meta description for SEO.
 */
export function PageMeta({ title, description }: { title: string; description: string }) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
}

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
