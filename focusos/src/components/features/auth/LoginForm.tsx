"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";

export function LoginForm() {
  const router = useRouter();
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

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Invalid email or password";
      setSubmitError(errorMsg);
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
            <LogIn className="h-6 w-6 stroke-[1.5]" />
          </div>
          <CardTitle className="text-2xl font-light tracking-wide text-text-primary mt-2">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-text-muted text-sm font-light leading-relaxed">
            Enter your credentials to enter your sanctuary
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

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-text-secondary select-none tracking-wide">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-focus-purple hover:text-focus-purple/80 transition-colors font-light"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                required
                className={`flex h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-120 ease-reveal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-40 ${
                  passwordError ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {passwordError && (
                <span className="text-xs text-urgency-coral font-light animate-fade-in block mt-1">
                  {passwordError}
                </span>
              )}
            </div>

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
                  <span>Entering Sanctuary...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-white/[0.05] pt-4 mt-2">
          <p className="text-xs text-text-muted font-light">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-focus-purple hover:text-focus-purple/80 transition-colors font-medium ml-0.5"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
