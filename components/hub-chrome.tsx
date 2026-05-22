"use client";

import { HubHeader } from "@/components/ui/hub-header";

export function HubChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubHeader />
      {children}
    </>
  );
}
