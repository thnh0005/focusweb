import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | FocusOS",
  description: "Sign in to enter your calm focus space and start your next deep work session.",
};

export default function LoginPage() {
  return <LoginForm />;
}
