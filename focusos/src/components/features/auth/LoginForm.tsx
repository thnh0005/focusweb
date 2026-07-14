"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

export function LoginForm() {
  const router = useRouter();
  const { t } = useTranslation("auth");
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [emailError, setEmailError] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");

  const validate = () => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");
    setSubmitError("");

    if (!email) {
      setEmailError(t("validation.emailRequired"));
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError(t("validation.emailInvalid"));
      isValid = false;
    }

    if (!password) {
      setPasswordError(t("validation.passwordRequired"));
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError(t("validation.passwordMin6"));
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await login({ email, password });
      const { onboardingComplete } = useAuthStore.getState();
      router.push(onboardingComplete ? "/dashboard" : "/onboarding");
    } catch {
      setSubmitError(t("errors.invalidCredentials"));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card variant="glass-card" className="overflow-hidden border-white/10 shadow-ambient">
        <CardHeader className="space-y-3 px-6 pb-5 pt-7 text-center sm:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-focus-green">
            <LogIn className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-light text-text-primary">
              {t("login.title")}
            </CardTitle>
            <CardDescription className="mx-auto max-w-[30ch] text-sm leading-6 text-text-secondary">
              {t("login.description")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {submitError && (
              <div
                role="alert"
                className="rounded-2xl border border-urgency-coral/20 bg-urgency-coral/10 p-3.5 text-sm leading-6 text-urgency-coral animate-fade-in"
              >
                {submitError}
              </div>
            )}

            <Input
              type="email"
              label={t("login.emailLabel")}
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              disabled={isLoading}
              autoComplete="email"
              className="h-11 rounded-2xl bg-white/[0.055] focus-visible:border-ring"
              required
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-text-secondary">
                  {t("login.password")}
                </label>
                <Link
                  href="/forgot-password"
                  className="rounded-lg text-xs text-focus-green transition-colors hover:text-focus-green/80 focus-ring-soft"
                >
                  {t("login.forgot")}
                </Link>
              </div>
              <input
                type="password"
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                required
                className={`flex h-11 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-150 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${
                  passwordError ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {passwordError && (
                <span className="block text-xs text-urgency-coral animate-fade-in">
                  {passwordError}
                </span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl"
            >
              {isLoading ? (
                <>
                  <Spinner className="h-4 w-4 text-primary-foreground" />
                  <span>{t("login.submitting")}</span>
                </>
              ) : (
                <span>{t("login.submit")}</span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-white/[0.06] px-6 pb-6 pt-5 sm:px-8">
          <p className="text-sm text-text-muted">
            {t("login.noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-focus-green transition-colors hover:text-focus-green/80 focus-ring-soft"
            >
              {t("login.register")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
