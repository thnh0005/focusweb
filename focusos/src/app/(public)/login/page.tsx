import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In · FocusOS",
  description: "Sign in to enter your digital sanctuary and start your deep work session.",
};

export default function LoginPage() {
  return <LoginForm />;
}
