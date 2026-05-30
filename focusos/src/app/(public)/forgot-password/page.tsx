import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/features/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password · FocusOS",
  description: "Request a recovery link to securely reset your account credentials.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
