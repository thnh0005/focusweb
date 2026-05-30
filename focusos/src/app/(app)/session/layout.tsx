"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FocusLayout } from "@/components/layout/FocusLayout";

export default function SessionLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleEndSession = () => {
    // Navigate back to the dashboard when session ends
    router.push("/dashboard");
  };

  return (
    <FocusLayout phase="focus" onEndSession={handleEndSession}>
      {children}
    </FocusLayout>
  );
}
