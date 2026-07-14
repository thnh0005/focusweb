"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "@/services/auth.api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";

export function ForgotPasswordForm() {
  const { t } = useTranslation("auth");
  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const [emailError, setEmailError] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");

  const validate = () => {
    setEmailError("");
    setSubmitError("");

    if (!email) {
      setEmailError(t("validation.emailRequired"));
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError(t("validation.emailInvalid"));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setIsSuccess(true);
      setIsLoading(false);
    } catch {
      setSubmitError(t("errors.recoveryFailed"));
      setIsLoading(false);
    }
  };

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
              {t("forgotPassword.successTitle")}
            </CardTitle>
            <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
              {t("forgotPassword.successDescription")}
            </CardDescription>
            <div className="text-xs font-mono bg-white/[0.02] border border-white/[0.05] rounded-lg py-1 px-3 inline-block mx-auto text-text-secondary">
              {email}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-muted font-light leading-relaxed">
              {t("forgotPassword.successNote")}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-white/[0.05] pt-4 mt-2">
            <Link
              href="/login"
              className="text-xs text-focus-purple hover:text-focus-purple/80 transition-colors font-medium flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
              <span>{t("forgotPassword.backToLogin")}</span>
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
            <KeyRound className="h-6 w-6 stroke-[1.5]" />
          </div>
          <CardTitle className="text-2xl font-light tracking-wide text-text-primary mt-2">
            {t("forgotPassword.title")}
          </CardTitle>
          <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
            {t("forgotPassword.description")}
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
              type="email"
              label={t("forgotPassword.emailLabel")}
              placeholder={t("forgotPassword.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              disabled={isLoading}
              autoComplete="email"
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
                  <span>{t("forgotPassword.submitting")}</span>
                </>
              ) : (
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 stroke-[1.5]" />
                  <span>{t("forgotPassword.submit")}</span>
                </span>
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
            <span>{t("forgotPassword.cancel")}</span>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
