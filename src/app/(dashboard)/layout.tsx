"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { PageLoading } from "@/components/ui/shared";

// ═══════════════════════════════════════════════════════════
// Dashboard Layout — Authenticated shell with sidebar.
//
// Guards:
//   • Unauthenticated → /login
//   • Super admin → /platform/overview (they belong on the platform
//     sidebar; any inventory call would 400 without a tenant context).
// ═══════════════════════════════════════════════════════════

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isSuperAdmin) {
      router.replace("/platform/overview");
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <PageLoading />
      </div>
    );
  }

  if (!isAuthenticated || isSuperAdmin) {
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
