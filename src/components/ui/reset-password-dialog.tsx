"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-elements";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { userService } from "@/services/rbac.service";
import { isApiError } from "@/lib/api-client";
import { KeyRound } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Admin-initiated password reset modal. Calls POST /users/{id}/reset-password.
// On success the target user's refresh tokens are revoked server-side.
//
// Pass `actingTenantId` from super-admin contexts (cross-tenant flows) so
// the backend recognises the X-Acting-Tenant-Id header. Tenant admins
// should leave it undefined — backend ignores the header for them anyway.
// ═══════════════════════════════════════════════════════════════════

const resetSchema = z
  .object({
    new_password: z.string().min(8, "Password must be at least 8 characters").max(128, "Too long"),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export function ResetPasswordDialog({
  open,
  onClose,
  userId,
  userEmail,
  actingTenantId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  actingTenantId?: string;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { new_password: "", confirm: "" },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: ResetFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await userService.adminResetPassword(userId, data.new_password, actingTenantId);
      toast.success(
        "Password reset",
        `${userEmail} has been signed out of every device. Share the new password securely and ask them to change it after signing in.`,
      );
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 422 && err.fieldErrors?.new_password) {
          setServerError(err.fieldErrors.new_password);
        } else if (err.status === 403) {
          setServerError(
            "You don't have permission to reset this user's password. Required: auth.users.write.",
          );
        } else if (err.status === 404) {
          setServerError("That user no longer exists.");
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Reset this user's password"
      description={`Set a new password for ${userEmail}. Share it securely (e.g. password manager) and ask them to change it after sign-in.`}
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text leading-relaxed">
            {serverError}
          </div>
        )}
        <Input
          type="password"
          label="New password"
          placeholder="Minimum 8 characters"
          required
          autoComplete="new-password"
          error={errors.new_password?.message}
          disabled={submitting}
          {...register("new_password")}
        />
        <Input
          type="password"
          label="Confirm password"
          placeholder="Type it again"
          required
          autoComplete="new-password"
          error={errors.confirm?.message}
          disabled={submitting}
          {...register("confirm")}
        />
        <div className="bg-status-amber-bg rounded-md px-3 py-2 text-[11.5px] text-status-amber-text leading-relaxed">
          <strong>Heads up:</strong> the user will be signed out of all their
          other sessions and must sign in again with this new password.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting} icon={<KeyRound size={13} />}>
            Reset password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
