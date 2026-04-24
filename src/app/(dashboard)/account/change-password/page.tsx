"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-elements";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/providers/auth-provider";
import { isApiError } from "@/lib/api-client";
import { Lock, ArrowLeft, ShieldCheck } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /account/change-password — Self-serve password change.
//
// On success the backend revokes every refresh token for this user, so
// they must sign in again on every other device. We warn up front.
// ═══════════════════════════════════════════════════════════════════

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    path: ["confirm"],
    message: "The two passwords don't match",
  })
  .refine((d) => d.current_password !== d.new_password, {
    path: ["new_password"],
    message: "Choose a different password than your current one",
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await authService.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast.success(
        "Password changed",
        "You'll stay signed in here. Other devices have been signed out.",
      );
      reset();
      router.push("/dashboard");
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "INVALID_CREDENTIALS") {
          setError("current_password", {
            message: "Your current password is incorrect.",
          });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          for (const [field, msg] of Object.entries(err.fieldErrors)) {
            setError(field as keyof PasswordFormValues, { message: msg });
          }
        } else {
          setServerError(err.message || "Could not change password.");
        }
      } else {
        setServerError("Could not change password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Account", "Change Password"]} />

      <div className="p-4 md:p-5 space-y-4 max-w-xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <PageHeader
          title="Change your password"
          description="Pick a new password to sign in with from next time. Your current session here stays active — only other devices are signed out."
          learnMore="For your safety, we revoke every refresh token tied to your account when your password changes. That means any device you've signed in on — laptop at home, phone, second browser — will be forced to sign in again with the new password."
        />

        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-md bg-brand-light flex items-center justify-center text-brand">
              <Lock size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">New password</h2>
              <p className="text-xs text-foreground-secondary">Minimum 8 characters. Longer is better.</p>
            </div>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-md bg-status-red-bg border border-status-red/20 text-sm text-status-red-text"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
            <Input
              label="Current password"
              type="password"
              required
              autoComplete="current-password"
              error={errors.current_password?.message}
              disabled={submitting}
              {...register("current_password")}
            />
            <Input
              label="New password"
              type="password"
              required
              autoComplete="new-password"
              hint="At least 8 characters. Use a mix of letters, numbers, and symbols."
              help="The longer and more random, the better. A sentence with a couple of numbers in it is often stronger than a short jumble."
              error={errors.new_password?.message}
              disabled={submitting}
              {...register("new_password")}
            />
            <Input
              label="Confirm new password"
              type="password"
              required
              autoComplete="new-password"
              error={errors.confirm?.message}
              disabled={submitting}
              {...register("confirm")}
            />

            <div className="mt-2 rounded-md bg-status-amber-bg border border-status-amber/20 px-3 py-2 flex items-start gap-2">
              <ShieldCheck size={14} className="text-status-amber-text flex-shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-status-amber-text leading-relaxed">
                <strong>Heads up:</strong> changing your password signs you out
                of every other device. This browser stays signed in.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" kind="primary" loading={submitting}>
                Change password
              </Button>
            </div>
          </form>
        </div>

        <div className="text-[11.5px] text-foreground-muted">
          Forgot your current password?{" "}
          <button
            onClick={() => logout()}
            className="text-brand font-medium hover:underline"
          >
            Sign out
          </button>{" "}
          and ask your administrator to reset it for you.
        </div>
      </div>
    </div>
  );
}
