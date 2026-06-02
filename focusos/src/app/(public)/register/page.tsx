import type { Metadata } from "next";
import { RegisterForm } from "@/components/features/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create your focus space | FocusOS",
  description: "Create your FocusOS account and set up a calmer way to start deep work.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
