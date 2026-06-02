"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { authApi } from "@/services/auth.api";
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

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const [emailError, setEmailError] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [confirmError, setConfirmError] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");

  const validate = () => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setSubmitError("");

    if (!email) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    }

    if (!passwordConfirm) {
      setConfirmError("Please confirm your password");
      isValid = false;
    } else if (password !== passwordConfirm) {
      setConfirmError("Passwords do not match");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await authApi.register({ email, password, passwordConfirm });

      // Update global auth store state
      useAuthStore.setState({
        user: response.user,
        isAuthenticated: true,
        onboardingComplete: response.user.onboardingComplete,
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setSubmitError(errorMsg);
      setIsLoading(false);
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
            <UserPlus className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-light text-text-primary">
              Create your focus space
            </CardTitle>
            <CardDescription className="mx-auto max-w-[31ch] text-sm leading-6 text-text-secondary">
              Set up a calm place for sessions, reflection, and gentle attention tracking.
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
              label="Email address"
              placeholder="minh@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              disabled={isLoading}
              autoComplete="email"
              className="h-11 rounded-2xl bg-white/[0.055] focus-visible:border-ring"
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              disabled={isLoading}
              autoComplete="new-password"
              className="h-11 rounded-2xl bg-white/[0.055] focus-visible:border-ring"
              required
            />

            <Input
              type="password"
              label="Confirm password"
              placeholder="Re-enter your password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              error={confirmError}
              disabled={isLoading}
              autoComplete="new-password"
              className="h-11 rounded-2xl bg-white/[0.055] focus-visible:border-ring"
              required
            />

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
                  <span>Creating your space...</span>
                </>
              ) : (
                <span>Create focus space</span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-white/[0.06] px-6 pb-6 pt-5 sm:px-8">
          <p className="text-sm text-text-muted">
            Already have a space?{" "}
            <Link
              href="/login"
              className="font-medium text-focus-green transition-colors hover:text-focus-green/80 focus-ring-soft"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
