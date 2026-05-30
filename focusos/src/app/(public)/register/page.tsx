import type { Metadata } from "next";
import { RegisterForm } from "@/components/features/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create Account · FocusOS",
  description: "Create your FocusOS account to start measuring and optimizing focus quality.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
