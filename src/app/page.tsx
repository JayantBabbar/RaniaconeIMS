"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PageLoading } from "@/components/ui/shared";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (isSuperAdmin) {
      router.replace("/platform/overview");
    } else {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, router]);

  return <PageLoading />;
}
