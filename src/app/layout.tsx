import type { Metadata } from "next";
import "@/styles/globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { BrandingProvider } from "@/providers/branding-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DemoBanner } from "@/components/ui/demo-banner";
import { DEFAULT_BRANDING } from "@/config/branding";

export const metadata: Metadata = {
  title: `${DEFAULT_BRANDING.name} — ${DEFAULT_BRANDING.tagline}`,
  description: DEFAULT_BRANDING.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <BrandingProvider>
          <QueryProvider>
            <AuthProvider>
              <ToastProvider>
                <DemoBanner />
                {children}
              </ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
