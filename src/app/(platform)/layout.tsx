"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";
import { PageLoading } from "@/components/ui/shared";

// ═══════════════════════════════════════════════════════════
// Platform Layout — Only accessible by super_admin users
// ═══════════════════════════════════════════════════════════

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
    // If authenticated but not super admin, redirect to client dashboard
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
    <div className="h-screen flex overflow-hidden">
      <PlatformSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
