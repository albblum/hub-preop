import type { ActorKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/transitions";
import { resolveTransitionTarget } from "@/lib/domain/transition-policy";
import { mapInstrumentStatusToPartStatus } from "@/lib/domain/part-status";
import { appendCommitteeProcessLedger, appendTransitionLedger } from "@/lib/ledger/append-ledger";
import { getInstrumentById } from "@/lib/instrument-service";
import type { AuthorityDecision } from "@/lib/authority";

const PRC_DELIBERATION_MARKER = "prc:deliberation_recorded";

type AuthorityAuditSnapshot = Pick<
  AuthorityDecision,
  "reasonCode" | "authoritySource" | "normativeRefs" | "resolutionMode" | "authorityEvidence"
>;

/** Abertura formal de consulta pública: registo + transição rascunho → em análise. */
export async function committeeOpenConsultation(input: {
  instrumentId: string;
  closesAt: Date;
  openingNote: string;
  actorKind: ActorKind;
  actorLabel: string | null;
  actorExternalId: string | null;
  authorityDecision?: AuthorityAuditSnapshot;
}): Promise<void> {
  const inst = await prisma.instrument.findUnique({
    where: { id: input.instrumentId },
    include: { parent: { select: { layer: true } } },
  });
  if (!inst) throw new DomainError("Instrumento não encontrado");
  if (inst.status !== "draft") {
    throw new DomainError(
      "A consulta pública só pode ser aberta no modo elaboração (instrumento em rascunho).",
    );
  }
  if (input.closesAt.getTime() <= Date.now()) {
    throw new DomainError("O prazo de encerramento deve ser futuro.");
  }

  const parentForPolicy =
    inst.parentInstrumentId && inst.parent != null ? { layer: inst.parent.layer } : null;

  const resolved = resolveTransitionTarget({
    fromStatus: inst.status,
    requestedTo: "under-review",
    layer: inst.layer,
    parent: parentForPolicy,
    documentType: inst.documentType,
  });
  const toStatus = resolved.toStatus;
  const gateNote = resolved.note;

  await prisma.$transaction(async (tx) => {
    await tx.instrument.update({
      where: { id: inst.id },
      data: {
        consultationClosesAt: input.closesAt,
        consultationOpeningNote: input.openingNote,
        status: toStatus,
      },
    });

    const at = new Date();
    await appendCommitteeProcessLedger(tx, {
      instrument: { id: inst.id, idrRef: inst.idrRef },
      act: "consultation_opened",
      at,
      body: {
        closesAt: input.closesAt.toISOString(),
        openingNote: input.openingNote,
        authorityDecision: input.authorityDecision ?? null,
      },
    });

    const ev = await tx.transitionEvent.create({
      data: {
        instrumentId: inst.id,
        fromStatus: inst.status,
        toStatus,
        actor: input.actorLabel,
        actorKind: input.actorKind,
        actorLabel: input.actorLabel,
        actorExternalId: input.actorExternalId,
        note:
          [
            "Abertura formal de consulta pública",
            gateNote,
          ]
            .filter(Boolean)
            .join(" | ") || null,
      },
    });

    await appendTransitionLedger(tx, {
      instrument: { id: inst.id, idrRef: inst.idrRef },
      event: ev,
    });

    const partStatus = mapInstrumentStatusToPartStatus(toStatus);
    await tx.part.updateMany({
      where: { instrumentId: inst.id },
      data: { partStatus },
    });
  });
}

/** Registo de deliberação pós-consulta (sem mudança obrigatória de estado no MVP). */
export async function committeeRecordDeliberation(input: {
  instrumentId: string;
  synthesis: string;
  decision: "advance" | "reformulate" | "archive";
  justification: string;
  contributionRefs: string;
  actorKind: ActorKind;
  actorLabel: string | null;
  actorExternalId: string | null;
  authorityDecision?: AuthorityAuditSnapshot;
}): Promise<void> {
  const inst = await prisma.instrument.findUnique({
    where: { id: input.instrumentId },
  });
  if (!inst) throw new DomainError("Instrumento não encontrado");
  if (inst.status !== "under-review") {
    throw new DomainError("A deliberação regista-se após consulta pública (estado em análise).");
  }

  await prisma.$transaction(async (tx) => {
    await appendCommitteeProcessLedger(tx, {
      instrument: { id: inst.id, idrRef: inst.idrRef },
      act: "deliberation_recorded",
      at: new Date(),
      body: {
        synthesis: input.synthesis,
        decision: input.decision,
        justification: input.justification,
        contributionRefs: input.contributionRefs,
        actorLabel: input.actorLabel,
        actorExternalId: input.actorExternalId,
        authorityDecision: input.authorityDecision ?? null,
      },
    });

    await tx.transitionEvent.create({
      data: {
        instrumentId: inst.id,
        fromStatus: inst.status,
        toStatus: inst.status,
        actor: input.actorLabel,
        actorKind: input.actorKind,
        actorLabel: input.actorLabel,
        actorExternalId: input.actorExternalId,
        note: [
          "Acto PRC — deliberação registada",
          PRC_DELIBERATION_MARKER,
          `authority_reason:${input.authorityDecision?.reasonCode ?? "unknown"}`,
          `authority_mode:${input.authorityDecision?.resolutionMode ?? "unknown"}`,
        ]
          .filter(Boolean)
          .join(" | "),
      },
    });
  });
}

/** Aprovação formal com peso institucional — transição para força provisória fundacional (MVP). */
export async function committeeFormalApproval(input: {
  instrumentId: string;
  foundationNote: string;
  actorKind: ActorKind;
  actorLabel: string | null;
  actorExternalId: string | null;
  authorityDecision?: AuthorityAuditSnapshot;
}) {
  const instrumentId = input.instrumentId;

  const current = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    select: {
      id: true,
      idrRef: true,
      documentType: true,
      status: true,
      layer: true,
      parentInstrumentId: true,
      parent: { select: { layer: true } },
      committeeId: true,
    },
  });
  if (!current) throw new DomainError("Instrumento não encontrado");
  if (current.status !== "under-review") {
    throw new DomainError(
      "A aprovação formal aplica-se quando o instrumento está em análise (após consulta).",
    );
  }
  const prcDeliberationEvent = await prisma.transitionEvent.findFirst({
    where: {
      instrumentId: current.id,
      fromStatus: "under-review",
      toStatus: "under-review",
      note: { contains: PRC_DELIBERATION_MARKER },
    },
    orderBy: { at: "desc" },
    select: { id: true, at: true },
  });
  if (!prcDeliberationEvent) {
    throw new DomainError(
      "A aprovação SG depende de acto PRC prévio registado para este instrumento.",
      "PRC_ACT_REQUIRED",
    );
  }

  const parentForPolicy =
    current.parentInstrumentId && current.parent != null
      ? { layer: current.parent.layer }
      : null;

  const resolved = resolveTransitionTarget({
    fromStatus: current.status,
    requestedTo: "foundational-provisional",
    layer: current.layer,
    parent: parentForPolicy,
    documentType: current.documentType,
  });
  const toStatus = resolved.toStatus;
  const gateNote = resolved.note;

  await prisma.$transaction(async (tx) => {
    const at = new Date();
    await appendCommitteeProcessLedger(tx, {
      instrument: { id: current.id, idrRef: current.idrRef },
      act: "formal_approval",
      at,
      body: {
        foundationNote: input.foundationNote,
        quorumNote: "MVP: quórum confirmado pelo participante que executa o acto.",
        authorityDecision: input.authorityDecision ?? null,
        confirmedPriorAct: {
          kind: "prc_deliberation",
          eventId: prcDeliberationEvent.id,
          at: prcDeliberationEvent.at.toISOString(),
        },
      },
    });

    const ev = await tx.transitionEvent.create({
      data: {
        instrumentId: current.id,
        fromStatus: current.status,
        toStatus,
        actor: input.actorLabel,
        actorKind: input.actorKind,
        actorLabel: input.actorLabel,
        actorExternalId: input.actorExternalId,
        note:
          [
            "Aprovação formal do comité — fundamento normativo registado",
            `PRC confirmado: ${prcDeliberationEvent.id}`,
            `authority_reason:${input.authorityDecision?.reasonCode ?? "unknown"}`,
            `authority_mode:${input.authorityDecision?.resolutionMode ?? "unknown"}`,
            input.foundationNote,
            gateNote,
          ]
            .filter(Boolean)
            .join(" | ") || null,
      },
    });

    await tx.instrument.update({
      where: { id: current.id },
      data: { status: toStatus },
    });

    await appendTransitionLedger(tx, {
      instrument: { id: current.id, idrRef: current.idrRef },
      event: ev,
    });

    const partStatus = mapInstrumentStatusToPartStatus(toStatus);
    await tx.part.updateMany({
      where: { instrumentId: current.id },
      data: { partStatus },
    });
  });

  const detail = await getInstrumentById(current.id);
  if (!detail) throw new Error("Instrumento desapareceu após aprovação");
  return detail;
}
