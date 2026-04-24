"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { isApiError } from "@/lib/api-client";
import { Input, Checkbox } from "@/components/ui/form-elements";
import { Button } from "@/components/ui/button";
import { HelpHint } from "@/components/ui/help-hint";
import { AlertCircle, Lock, Mail } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Login page
//
// Email + password only. No workspace code — email is globally unique,
// and tenant identity travels inside the signed JWT the server returns.
//
// UX guarantees:
//   • Red asterisk + aria-required on every required field.
//   • Inline per-field errors (never alerts).
//   • Unified "Email or password is incorrect" on INVALID_CREDENTIALS.
//   • Countdown timer when rate-limited (429).
//   • "Forgot password?" inline guidance pointing at supportEmail.
//   • Brand identity read from BrandingProvider — white-label friendly.
// ═══════════════════════════════════════════════════════════════════

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const brand = useBranding();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Countdown effect for the rate-limit lockout.
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const id = setInterval(() => {
      setRetryAfter((s) => (s && s > 1 ? s - 1 : null));
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const lockedOut = retryAfter !== null && retryAfter > 0;

  const onSubmit = async (data: LoginFormValues) => {
    if (lockedOut) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await login({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      // AuthProvider.login handles the redirect.
    } catch (err) {
      if (isApiError(err)) {
        switch (err.code) {
          case "INVALID_CREDENTIALS":
            setFormError(
              "Email or password is incorrect. Check your details and try again.",
            );
            break;
          case "RATE_LIMIT_EXCEEDED":
            setRetryAfter(err.retryAfterSeconds ?? 60);
            setFormError(null);
            break;
          case "MODULE_NOT_SUBSCRIBED":
            setFormError(
              "Your workspace isn't subscribed to any active modules. Please contact your administrator.",
            );
            break;
          case "NETWORK_ERROR":
            setFormError(
              "We couldn't reach the server. Check your internet connection and try again.",
            );
            break;
          default:
            setFormError(err.message || "Sign-in failed. Please try again.");
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const Logo = brand.LogoMark;

  return (
    <div className="h-screen flex font-sans">
      {/* ════════ Left — Marketing panel ════════ */}
      <div className="flex-1 bg-[#0a0a0a] p-10 lg:p-12 flex-col text-white relative overflow-hidden hidden lg:flex">
        <svg className="absolute inset-0 opacity-50" width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div
          className="absolute -top-[10%] -right-[20%] w-[600px] h-[600px]"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.25), transparent 60%)" }}
        />

        <div className="flex items-center gap-2.5 relative">
          <div className="w-[26px] h-[26px] rounded-md bg-brand flex items-center justify-center text-white">
            <Logo width="14" height="14" />
          </div>
          <span className="font-semibold tracking-tight">{brand.name}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center relative">
          <div className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-3.5">
            {brand.tagline}
          </div>
          <h2 className="text-4xl font-semibold tracking-tight leading-[1.1] mb-5">
            Every SKU,<br />every warehouse,<br />every movement.
          </h2>
          <p className="text-sm text-[#a3a3a3] leading-relaxed max-w-[360px]">
            {brand.description}
          </p>
          {brand.marketingStats && brand.marketingStats.length > 0 && (
            <div className="flex gap-7 mt-9 p-4 bg-white/[0.04] rounded-xl border border-white/[0.06] max-w-[420px]">
              {brand.marketingStats.map((s, i) => (
                <div key={i}>
                  <div className="text-xl font-semibold tracking-tight">{s.value}</div>
                  <div className="text-[11px] text-[#737373] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3.5 text-[11px] text-[#525252] relative">
          <span>© {new Date().getFullYear()} {brand.copyrightHolder}</span>
          {brand.complianceBadges?.map((badge) => (
            <React.Fragment key={badge}>
              <span>·</span>
              <span>{badge}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ════════ Right — Login form ════════ */}
      <div className="w-full lg:w-[440px] px-8 lg:px-11 flex flex-col justify-center overflow-y-auto py-10">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white shadow-btn-primary">
            <Logo width="16" height="16" />
          </div>
          <div className="text-base font-semibold">{brand.name}</div>
        </div>

        {/* Heading + description */}
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-foreground-secondary mt-1 leading-relaxed">
          Sign in with the email your administrator set up.{" "}
          <HelpHint size={12} tone="muted">
            Each email is tied to one workspace. If you belong to more
            than one {brand.name} account, your admin will have set up
            separate emails.
          </HelpHint>
        </p>

        {/* Error banner */}
        {formError && (
          <div
            role="alert"
            className="mt-5 p-3 rounded-md bg-status-red-bg border border-status-red/20 text-sm text-status-red-text flex items-start gap-2 animate-fade-in"
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{formError}</span>
          </div>
        )}

        {/* Rate-limit banner */}
        {lockedOut && (
          <div
            role="alert"
            className="mt-5 p-3 rounded-md bg-status-amber-bg border border-status-amber/20 text-sm text-status-amber-text flex items-start gap-2 animate-fade-in"
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Too many failed attempts. Please wait{" "}
              <strong className="tabular-nums">{retryAfter}s</strong> before
              trying again.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 mt-6">
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            required
            icon={<Mail size={13} />}
            error={errors.email?.message}
            disabled={submitting || lockedOut}
            {...register("email")}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            icon={<Lock size={13} />}
            error={errors.password?.message}
            disabled={submitting || lockedOut}
            {...register("password")}
          />

          <div className="flex items-center justify-between">
            <Checkbox
              label="Keep me signed in on this device"
              checked={rememberMe}
              onChange={setRememberMe}
            />
          </div>

          <Button
            type="submit"
            kind="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={lockedOut}
            className="mt-1"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* Forgot password (Option A — pointer to admin) */}
        <div className="mt-5 p-3 bg-surface rounded-md border border-hairline-light">
          <div className="text-xs font-semibold text-foreground">
            Forgot your password?
          </div>
          <p className="text-[11.5px] text-foreground-secondary mt-1 leading-relaxed">
            Self-service password reset isn&apos;t available yet. Please ask
            your workspace administrator to reset it for you, or email{" "}
            <a
              href={`mailto:${brand.supportEmail}`}
              className="text-brand font-medium hover:underline"
            >
              {brand.supportEmail}
            </a>
            .
          </p>
        </div>

        {/* Explainer about account creation */}
        <div className="mt-4 text-[11.5px] text-foreground-muted leading-relaxed">
          <strong className="text-foreground-secondary">New to {brand.name}?</strong>{" "}
          Accounts are created by administrators — you won&apos;t find a
          sign-up link here. If you expected an invite, check your email
          or ask your admin.
        </div>

        {brand.supportUrl && (
          <Link
            href={brand.supportUrl}
            className="mt-5 text-[11px] text-foreground-muted hover:text-foreground-secondary text-center"
          >
            Need help? Visit support →
          </Link>
        )}
      </div>
    </div>
  );
}
