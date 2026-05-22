"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MemberAccessPanel } from "@/components/ui/member-access-panel";
import { PublicMarketingHomeLink } from "@/components/public-marketing-home-link";
import { safeInternalPath } from "@/lib/safe-internal-path";

const LANDING_RETURN_PARAM = "public-site";

function LoginContent() {
  const search = useSearchParams();
  const requestedNext = safeInternalPath(search.get("callbackUrl"), "/ops");
  const fromLanding = search.get("from") === LANDING_RETURN_PARAM;
  const publicSiteUrl = process.env.NEXT_PUBLIC_LANDING_ORIGIN?.trim().replace(/\/$/, "");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-surface)" }}>
      {fromLanding && publicSiteUrl ? (
        <p className="pt-6 text-center font-sans text-sm">
          <a
            href={publicSiteUrl}
            className="underline"
            style={{ color: "var(--color-green-700)" }}
          >
            Voltar ao site público do IDR
          </a>
        </p>
      ) : null}

      <MemberAccessPanel continueHref={requestedNext} />

      <div className="mx-auto max-w-[400px] px-4 pb-10 text-center">
        <p className="font-sans text-sm" style={{ color: "var(--color-text-secondary)" }}>
          <Link
            href="/public"
            className="underline"
            style={{ color: "var(--color-green-700)" }}
          >
            Explorar o DocHub público
          </Link>
          {" · "}
          <PublicMarketingHomeLink className="underline text-[var(--color-green-700)]">
            {publicSiteUrl ? "Site público IDR" : "Início do Hub"}
          </PublicMarketingHomeLink>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-sans" style={{ color: "var(--color-text-secondary)" }}>
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
