import type { HubRole } from "@prisma/client";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

export type AuthorityActionType =
  | "transition"
  | "committee_consultation_open"
  | "committee_deliberation"
  | "committee_formal_approval";

export type AuthorityActorContext = {
  id: string | null;
  roles: HubRole[];
  memberships: CommitteeMembershipClaim[];
};

export type AuthorityInstrumentContext = {
  id: string;
  committeeId?: string | null;
};

export type AuthorityContext = {
  actor: AuthorityActorContext;
  instrument: AuthorityInstrumentContext;
  actionType: AuthorityActionType;
  timestamp: Date;
};

export type AuthoritySource = "role_based" | "instrument_based" | "hybrid";

/**
 * Modo de resolução aplicado pelo `resolveAuthorityForAction`:
 * - `instrument_first`: decisão derivada de membership ativa **com**
 *   `authorityInstrumentId` (acto de nomeação registado).
 * - `hybrid_fallback`: decisão derivada de membership ativa **sem** acto de
 *   nomeação registado (RBAC sozinho não bastaria).
 * - `role_fallback`: decisão derivada exclusivamente de papéis RBAC (`HubRole`).
 *
 * Aditivo a `authoritySource`: o `resolutionMode` descreve o caminho que
 * concedeu/negou a acção; permite filtros de auditoria sem alterar as
 * categorias semânticas existentes (`role_based` | `instrument_based` | `hybrid`).
 */
export type AuthorityResolutionMode = "instrument_first" | "hybrid_fallback" | "role_fallback";

/**
 * Evidências usadas pela decisão; campos opcionais para compatibilidade
 * estrita com consumidores legados de `AuthorityDecision`.
 */
export type AuthorityEvidence = {
  /** Acto de nomeação que sustentou a decisão (apenas em `instrument_first`). */
  authorityInstrumentId?: string | null;
  /** Comité usado como base institucional (quando aplicável). */
  committeeId?: string | null;
};

export type AuthorityDecision = {
  allowed: boolean;
  reasonCode: string;
  authoritySource: AuthoritySource;
  normativeRefs: string[];
  /** Aditivo (IBA): caminho efectivamente aplicado para chegar à decisão. */
  resolutionMode?: AuthorityResolutionMode;
  /** Aditivo (IBA): evidências institucionais usadas pela decisão. */
  authorityEvidence?: AuthorityEvidence;
};
