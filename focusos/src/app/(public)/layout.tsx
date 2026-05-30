import * as React from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function PublicRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayout>{children}</AuthLayout>;
}
