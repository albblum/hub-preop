"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { IDRLoginSection } from "@/components/ui/idr-login-section";
import { IDRRecognitionModal } from "@/components/ui/idr-recognition-modal";

type MemberAccessPanelProps = {
  continueHref?: string;
};

/**
 * Landing-style login with recognition modal overlay (no redirect until Open DocHUB).
 */
export function MemberAccessPanel({ continueHref = "/ops" }: MemberAccessPanelProps) {
  const { status, update } = useSession();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      setShowModal(true);
    }
  }, [status]);

  const handleLoginSuccess = useCallback(async () => {
    await update();
    setShowModal(true);
  }, [update]);

  return (
    <>
      <div
        className="min-h-screen w-full"
        style={{ backgroundColor: "var(--color-surface)" }}
        aria-hidden={showModal}
      >
        <IDRLoginSection onSuccess={() => void handleLoginSuccess()} next={continueHref} />
      </div>
      <IDRRecognitionModal open={showModal} continueHref={continueHref} />
    </>
  );
}
