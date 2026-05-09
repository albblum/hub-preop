import type { CommitteeMembershipClaim } from "@/lib/rbac";

/**
 * Sinal de qualidade da autoridade institucional do actor:
 * - `instrument_linked`: membership ativa **com** acto de nomeação registado
 *   (`authorityInstrumentId !== null`).
 * - `membership_only`: membership ativa **sem** acto de nomeação registado.
 * - `none`: nenhuma membership ativa aplicável ao contexto.
 *
 * Decisão IBA-0/D2: como o claim de sessão não inclui `endedAt`, e é resolvido
 * no `signIn` apenas para `status === "active"` (ver `auth.ts`), tratamos cada
 * claim como prova suficiente de actividade actual. Validação cruzada de
 * `Instrument.status` apontado por `authorityInstrumentId` fica fora desta fase
 * (decisão IBA-0/D5).
 */
export type AuthorityQuality = "instrument_linked" | "membership_only" | "none";

export type ActorAuthoritySignal = {
  quality: AuthorityQuality;
  /** Comité escolhido como base institucional (ou `null` quando `quality === "none"`). */
  committeeId: string | null;
  /** Acto de nomeação registado (apenas em `instrument_linked`). */
  authorityInstrumentId: string | null;
};

function startedBefore(claim: CommitteeMembershipClaim, timestamp: Date): boolean {
  const startedAtMs = Date.parse(claim.startedAt);
  if (Number.isNaN(startedAtMs)) return false;
  return startedAtMs <= timestamp.getTime();
}

/**
 * Resolve o sinal de autoridade para acções de comité, exigindo que a
 * membership escolhida cubra o `committeeId` do instrumento alvo.
 */
export function resolveActorAuthorityForCommittee(input: {
  memberships: CommitteeMembershipClaim[];
  committeeId: string | null;
  timestamp: Date;
}): ActorAuthoritySignal {
  if (!input.committeeId) {
    return { quality: "none", committeeId: null, authorityInstrumentId: null };
  }

  const matches = input.memberships.filter(
    (m) => m.committeeId === input.committeeId && startedBefore(m, input.timestamp),
  );

  if (matches.length === 0) {
    return {
      quality: "none",
      committeeId: input.committeeId,
      authorityInstrumentId: null,
    };
  }

  const linked = matches.find((m) => m.authorityInstrumentId);
  if (linked && linked.authorityInstrumentId) {
    return {
      quality: "instrument_linked",
      committeeId: input.committeeId,
      authorityInstrumentId: linked.authorityInstrumentId,
    };
  }

  return {
    quality: "membership_only",
    committeeId: input.committeeId,
    authorityInstrumentId: null,
  };
}

/**
 * Resolve o sinal de autoridade para acções **não escopadas a comité**
 * (ex.: `transition`). Decisão IBA-0/D3: o sinal nunca é promovido a
 * `instrument_linked` neste caminho — quando não há contexto de comité no
 * instrumento, a membership do actor pode no máximo justificar `membership_only`
 * (ramo `hybrid_fallback` no resolver). O `committeeId` retornado serve apenas
 * como evidência da membership escolhida.
 */
export function resolveActorAuthorityAny(input: {
  memberships: CommitteeMembershipClaim[];
  timestamp: Date;
}): ActorAuthoritySignal {
  const active = input.memberships.filter((m) => startedBefore(m, input.timestamp));
  if (active.length === 0) {
    return { quality: "none", committeeId: null, authorityInstrumentId: null };
  }
  return {
    quality: "membership_only",
    committeeId: active[0].committeeId,
    authorityInstrumentId: null,
  };
}
