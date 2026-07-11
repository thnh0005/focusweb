"use client";

import * as React from "react";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";
import { useHeartbeat } from "@/hooks/useHeartbeat";

export function ExtensionBridgeProvider({ children }: { children: React.ReactNode }) {
  useExtensionBridge();
  useHeartbeat();

  return <>{children}</>;
}
