"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@/components/features/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return <ResetPasswordForm token={token} />;
}
