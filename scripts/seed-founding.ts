/**
 * Idempotent founding load: dev users (optional) + placeholder instruments with stable idr:ref.
 * Run: `npm run seed:founding` (ensure `DATABASE_URL` is set, e.g. via `.env`)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { computeContentHash } from "../lib/integrity/content-hash";
import { syncMonolithicPartForInstrumentVersion } from "../lib/part-composition";

const prisma = new PrismaClient();

function seqFromIdrRef(idrRef: string): number {
  const m = idrRef.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function syncIdrSequenceFromInstruments() {
  const rows = await prisma.instrument.findMany({ select: { idrRef: true } });
  const maxSeq = rows.reduce((acc, r) => Math.max(acc, seqFromIdrRef(r.idrRef)), 0);
  const row = await prisma.idrSequence.findUnique({ where: { key: "instrument" } });
  const next = Math.max(row?.next ?? 0, maxSeq);
  await prisma.idrSequence.upsert({
    where: { key: "instrument" },
    create: { key: "instrument", next },
    update: { next },
  });
}

async function ensureUser(input: {
  email: string;
  passwordPlain: string;
  name: string;
  roles: ("admin" | "registrar" | "reviewer" | "viewer_public" | "viewer_registered")[];
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    console.log(`User exists, skip: ${input.email}`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(input.passwordPlain, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      roles: input.roles,
    },
  });
  console.log(`Created user ${input.email}`);
  return user;
}

async function ensureInstrument(spec: {
  idrRef: string;
  title: string;
  layer: number;
  status: string;
  content: string;
  draftingAuthority?: string | null;
  parentInstrumentId?: string | null;
}) {
  const existing = await prisma.instrument.findUnique({ where: { idrRef: spec.idrRef } });
  if (existing) {
    console.log(`Instrument exists, skip: ${spec.idrRef}`);
    if (spec.parentInstrumentId !== undefined && existing.parentInstrumentId !== (spec.parentInstrumentId ?? null)) {
      return prisma.instrument.update({
        where: { id: existing.id },
        data: { parentInstrumentId: spec.parentInstrumentId ?? null },
      });
    }
    return existing;
  }
  const hash = computeContentHash(1, spec.content);
  const created = await prisma.$transaction(async (tx) => {
    const inst = await tx.instrument.create({
      data: {
        idrRef: spec.idrRef,
        title: spec.title,
        layer: spec.layer,
        status: spec.status,
        draftingAuthority: spec.draftingAuthority ?? null,
        currentVersion: 1,
        parentInstrumentId: spec.parentInstrumentId ?? null,
      },
    });
    const v1 = await tx.instrumentVersion.create({
      data: {
        instrumentId: inst.id,
        version: 1,
        content: spec.content,
        contentHash: hash,
        previousContentHash: null,
        supersedesVersion: null,
        revisionNote: "Founding seed",
      },
    });
    await syncMonolithicPartForInstrumentVersion(tx, {
      instrumentId: inst.id,
      instrumentVersion: v1,
      instrumentStatus: spec.status,
    });
    return tx.instrument.update({
      where: { id: inst.id },
      data: { currentVersionRecordId: v1.id },
    });
  });
  console.log(`Created instrument ${spec.idrRef}`);
  return created;
}

async function main() {
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeAdmin!";
  const reviewerPass = process.env.SEED_REVIEWER_PASSWORD ?? "ChangeMeReviewer!";
  const viewerPass = process.env.SEED_VIEWER_PASSWORD ?? "ChangeMeViewer!";

  await ensureUser({
    email: "admin@hub-preop.local",
    passwordPlain: adminPass,
    name: "Hub Admin",
    roles: ["admin", "registrar"],
  });
  await ensureUser({
    email: "reviewer@hub-preop.local",
    passwordPlain: reviewerPass,
    name: "Reviewer",
    roles: ["reviewer"],
  });
  await ensureUser({
    email: "viewer@hub-preop.local",
    passwordPlain: viewerPass,
    name: "Public viewer",
    roles: ["viewer_public"],
  });

  const framework = await ensureInstrument({
    idrRef: "idr:HUB-INSTR-00009001",
    title: "MOC — Framework (founding placeholder)",
    layer: 1,
    status: "in-force",
    draftingAuthority: "regional-placeholder",
    content:
      "Founding placeholder for the **Framework** pillar (MOC). Full text lives in governed docs; " +
      "this row proves idr:ref allocation, versioning, and operational listing.\n\n" +
      "See also: Document Hub (Tech Specs) seed sibling.",
    parentInstrumentId: null,
  });

  await ensureInstrument({
    idrRef: "idr:HUB-INSTR-00009002",
    title: "Document Hub (Tech Specs) — founding stub",
    layer: 2,
    status: "normalization-pending",
    draftingAuthority: "regional-placeholder",
    parentInstrumentId: framework.id,
    content:
      "Founding placeholder referencing the **Document Hub (Tech Specs)**. Use the normalization queue " +
      "to resolve this item (in-force, under-review for GA, or revoked).\n\n" +
      "Link-style summary only in MVP; operational proof over full publication.",
  });

  await syncIdrSequenceFromInstruments();
  console.log("Founding seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
