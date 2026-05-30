import { create } from "zustand";
import { pingExtension } from "@/lib/extension/bridge";
import type { ExtensionSyncStatus } from "@/types/extension.types";

export interface ExtensionState {
  installed: boolean;
  connected: boolean;
  version: string | null;
  lastHeartbeat: Date | null;
  syncStatus: ExtensionSyncStatus;

  // Actions
  checkHeartbeat: () => Promise<void>;
  setInstalled: (installed: boolean) => void;
  setConnected: (connected: boolean) => void;
  setSyncStatus: (status: ExtensionSyncStatus) => void;
}

export const useExtensionStore = create<ExtensionState>((set) => ({
  installed: false,
  connected: false,
  version: null,
  lastHeartbeat: null,
  syncStatus: "idle",

  checkHeartbeat: async () => {
    const isAlive = await pingExtension();
    set({
      connected: isAlive,
      installed: isAlive,
      lastHeartbeat: isAlive ? new Date() : null,
    });
  },

  setInstalled: (installed) => {
    set({ installed });
  },

  setConnected: (connected) => {
    set({ connected });
  },

  setSyncStatus: (status) => {
    set({ syncStatus: status });
  },
}));
