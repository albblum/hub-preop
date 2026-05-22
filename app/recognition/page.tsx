"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { IDRRecognitionModal } from "@/components/ui/idr-recognition-modal";
import { MemberAccessPanel } from "@/components/ui/member-access-panel";
import { safeInternalPath } from "@/lib/safe-internal-path";

function RecognitionContent() {
  const { status } = useSession();
  const search = useSearchParams();
  const next = safeInternalPath(search.get("next"), "/ops");

  if (status === "loading") {
    return (
      <div className="p-8 font-sans" style={{ color: "var(--color-text-secondary)" }}>
        Carregando sessão…
      </div>
    );
  }

  if (status !== "authenticated") {
    return <MemberAccessPanel continueHref={next} />;
  }

  return (
    <>
      <div
        className="min-h-screen w-full"
        style={{ backgroundColor: "var(--color-surface)" }}
        aria-hidden
      />
      <IDRRecognitionModal open continueHref={next} />
      <p className="sr-only">
        <Link href={next}>Continuar para o painel</Link>
      </p>
    </>
  );
}

export default function RecognitionPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-sans" style={{ color: "var(--color-text-secondary)" }}>
          Carregando…
        </div>
      }
    >
      <RecognitionContent />
    </Suspense>
  );
}
