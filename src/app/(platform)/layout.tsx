"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import { PageLoading } from "@/components/ui/shared";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
    if (!isLoading && isAuthenticated && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <PageLoading />
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <PlatformShell>{children}</PlatformShell>
    </SidebarProvider>
  );
}

function PlatformShell({ children }: { children: React.ReactNode }) {
  const { isMobileOpen, closeMobile } = useSidebar();

  return (
    <div className="h-screen flex overflow-hidden">
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
      <PlatformSidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
}
