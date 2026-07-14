"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { authApi } from "@/services/auth.api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";

export interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { t } = useTranslation("auth");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const [passwordError, setPasswordError] = React.useState("");
  const [confirmError, setConfirmError] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");

  const validate = () => {
    setPasswordError("");
    setConfirmError("");
    setSubmitError("");

    let isValid = true;

    if (!token) {
      setSubmitError(t("errors.missingToken"));
      return false;
    }

    if (!password) {
      setPasswordError(t("validation.newPasswordRequired"));
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError(t("validation.passwordMin6"));
      isValid = false;
    }

    if (!passwordConfirm) {
      setConfirmError(t("validation.confirmNewPasswordRequired"));
      isValid = false;
    } else if (password !== passwordConfirm) {
      setConfirmError(t("validation.passwordMismatch"));
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset(token, password, passwordConfirm);
      setIsSuccess(true);
      setIsLoading(false);
    } catch {
      setSubmitError(t("errors.resetFailed"));
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card variant="glass-card" className="border border-red-500/10 shadow-2xl backdrop-blur-xl text-center">
          <CardHeader className="space-y-2 pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-urgency-coral animate-bounce">
              <ShieldAlert className="h-6 w-6 stroke-[1.5]" />
            </div>
            <CardTitle className="text-2xl font-light tracking-wide text-text-primary mt-2">
              {t("resetPassword.invalidTitle")}
            </CardTitle>
            <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
              {t("resetPassword.invalidDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-muted font-light leading-relaxed">
              {t("resetPassword.invalidNote")}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-white/[0.05] pt-4 mt-2">
            <Link
              href="/forgot-password"
              className="text-xs text-focus-purple hover:text-focus-purple/80 transition-colors font-medium flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
              <span>{t("resetPassword.backToReset")}</span>
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card variant="glass-card" className="border border-white/[0.06] shadow-2xl backdrop-blur-xl text-center">
          <CardHeader className="space-y-2 pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle2 className="h-6 w-6 stroke-[1.5]" />
            </div>
            <CardTitle className="text-2xl font-light tracking-wide text-text-primary mt-2">
              {t("resetPassword.successTitle")}
            </CardTitle>
            <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
              {t("resetPassword.successDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-muted font-light leading-relaxed">
              {t("resetPassword.successNote")}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-white/[0.05] pt-4 mt-2">
            <Link
              href="/login"
              className="text-xs text-focus-purple hover:text-focus-purple/80 transition-colors font-medium flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
              <span>{t("resetPassword.signInNewPassword")}</span>
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card variant="glass-card" className="border border-white/[0.06] shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-focus-purple/10 border border-focus-purple/20 text-focus-purple animate-pulse-glow">
            <Lock className="h-6 w-6 stroke-[1.5]" />
          </div>
          <CardTitle className="text-2xl font-light tracking-wide text-text-primary mt-2">
            {t("resetPassword.title")}
          </CardTitle>
          <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
            {t("resetPassword.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {submitError && (
              <div 
                role="alert"
                className="p-3.5 rounded-lg border border-red-500/10 bg-red-500/5 text-xs text-urgency-coral font-light tracking-wide leading-relaxed animate-fade-in"
              >
                {submitError}
              </div>
            )}
            
            <Input
              type="password"
              label={t("resetPassword.newPasswordLabel")}
              placeholder={t("resetPassword.newPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              disabled={isLoading}
              autoComplete="new-password"
              required
            />

            <Input
              type="password"
              label={t("resetPassword.confirmPasswordLabel")}
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              error={confirmError}
              disabled={isLoading}
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full mt-2 font-light tracking-wide flex items-center justify-center gap-2 h-11"
            >
              {isLoading ? (
                <>
                  <Spinner className="h-4 w-4 text-primary-foreground" />
                  <span>{t("resetPassword.submitting")}</span>
                </>
              ) : (
                <span>{t("resetPassword.submit")}</span>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-white/[0.05] pt-4 mt-2">
          <Link
            href="/login"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors font-light flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
            <span>{t("resetPassword.cancel")}</span>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
