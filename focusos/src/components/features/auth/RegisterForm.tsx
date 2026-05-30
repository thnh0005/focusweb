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
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";

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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card variant="glass-card" className="border border-white/[0.06] shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-focus-purple/10 border border-focus-purple/20 text-focus-purple animate-pulse-glow">
            <UserPlus className="h-6 w-6 stroke-[1.5]" />
          </div>
          <CardTitle className="text-2xl font-light tracking-wide text-text-primary mt-2">
            Create Account
          </CardTitle>
          <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
            Begin your journey towards mindful productivity
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
              label="Email Address"
              placeholder="e.g. minh@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              disabled={isLoading}
              autoComplete="email"
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              disabled={isLoading}
              autoComplete="new-password"
              required
            />

            <Input
              type="password"
              label="Confirm Password"
              placeholder="Re-enter your password"
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Register</span>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-white/[0.05] pt-4 mt-2">
          <p className="text-xs text-text-muted font-light">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-focus-purple hover:text-focus-purple/80 transition-colors font-medium ml-0.5"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
