import { NextResponse } from "next/server";
import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { mayAccessCommitteeInstrument } from "@/lib/committee-access";
import { getInstrumentById, listLedgerEntries } from "@/lib/instrument-service";
import { listExternalReferencesForInstrument } from "@/lib/committee-references";
import { prisma } from "@/lib/prisma";
import { LEDGER_ENTRY_TYPES } from "@/lib/ledger/entry-types";

type RouteContext = { params: Promise<{ id: string }> };

/** Detalhe para o espaço do comité: instrumento, referências vinculadas, linha do tempo (eventos + razão). */
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const head = await prisma.instrument.findUnique({
    where: { id },
    select: { committeeId: true },
  });
  if (!head) {
    return NextResponse.json({ error: "Instrumento não encontrado." }, { status: 404 });
  }
  if (!mayAccessCommitteeInstrument(gate.sessionLike, head.committeeId)) {
    return NextResponse.json({ error: "Sem acesso a este instrumento." }, { status: 403 });
  }

  const [instrument, ledgerEntries, externalReferences] = await Promise.all([
    getInstrumentById(id),
    listLedgerEntries(id),
    listExternalReferencesForInstrument(id),
  ]);

  if (!instrument) {
    return NextResponse.json({ error: "Instrumento não encontrado." }, { status: 404 });
  }

  const timeline = [
    ...instrument.events.map((ev) => ({
      kind: "transition" as const,
      at: ev.at.toISOString(),
      fromStatus: ev.fromStatus,
      toStatus: ev.toStatus,
      note: ev.note,
      actorLabel: ev.actorLabel ?? ev.actor,
    })),
    ...ledgerEntries
      .filter((e) => e.entryType === LEDGER_ENTRY_TYPES.COMMITTEE_PROCESS_RECORD)
      .map((e) => ({
        kind: "committee_ledger" as const,
        at: e.createdAt.toISOString(),
        entryType: e.entryType,
        sequence: e.sequence,
        payloadHash: e.payloadHash,
      })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return NextResponse.json({
    instrument,
    externalReferences,
    ledgerEntries,
    timeline,
  });
}
