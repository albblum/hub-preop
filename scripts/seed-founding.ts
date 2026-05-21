/**
 * Idempotent founding load: dev users and committee scaffolding (no placeholder instruments).
 * Institutional documents: `load-v2-constitutional-foundation.ts`, `load-v2-preop-regime.ts`, Movement 2 seed.
 * Run: `npm run seed:founding` (ensure `DATABASE_URL` is set, e.g. via `.env`)
 *
 * If you changed `SEED_*_PASSWORD` in `.env` after users were already created, re-run with:
 * `SEED_UPDATE_EXISTING_PASSWORDS=1 npm run seed:users-only`
 * so hashes match your current env (dev/lab only).
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

async function ensureCommittees() {
  const codes = ["C#01", "C#02", "C#03", "C#04", "C#05"];
  for (const code of codes) {
    await prisma.committee.upsert({
      where: { code },
      create: { code, name: `Comité ${code}` },
      update: {},
    });
  }
  console.log("Committees C#01–C#05 ensured.");
}

/** Active membership for committee participant (authorityInstrumentId optional until nomination instrument exists). */
async function ensureActiveMembership(userEmail: string, committeeCode: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const committee = await prisma.committee.findUnique({ where: { code: committeeCode } });
  if (!user || !committee) return;
  const existing = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId: committee.id, status: "active" },
  });
  if (existing) {
    console.log(`Committee membership exists: ${userEmail} -> ${committeeCode}`);
    return;
  }
  await prisma.committeeMembership.create({
    data: {
      userId: user.id,
      committeeId: committee.id,
      status: "active",
    },
  });
  console.log(`Committee membership created: ${userEmail} -> ${committeeCode}`);
}

async function ensureUser(input: {
  email: string;
  passwordPlain: string;
  name: string;
  roles: ("admin" | "registrar" | "reviewer" | "viewer_public" | "viewer_registered")[];
}) {
  const updatePasswords =
    process.env.SEED_UPDATE_EXISTING_PASSWORDS === "1" ||
    process.env.SEED_UPDATE_EXISTING_PASSWORDS === "true";
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (updatePasswords) {
      const passwordHash = await bcrypt.hash(input.passwordPlain, 10);
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: input.name, roles: input.roles },
      });
      console.log(`User exists — password and profile updated: ${input.email}`);
      return updated;
    }
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
  /** Comité responsável (código estável, ex. C#01). */
  committeeCode?: string | null;
}) {
  let committeeId: string | null = null;
  if (spec.committeeCode) {
    const c = await prisma.committee.findUnique({ where: { code: spec.committeeCode } });
    committeeId = c?.id ?? null;
    if (!committeeId) {
      console.warn(`Committee not found for code ${spec.committeeCode}; instrument sem comité.`);
    }
  }

  const existing = await prisma.instrument.findUnique({ where: { idrRef: spec.idrRef } });
  if (existing) {
    console.log(`Instrument exists, skip: ${spec.idrRef}`);
    const updates: {
      parentInstrumentId?: string | null;
      committeeId?: string | null;
    } = {};
    if (
      spec.parentInstrumentId !== undefined &&
      existing.parentInstrumentId !== (spec.parentInstrumentId ?? null)
    ) {
      updates.parentInstrumentId = spec.parentInstrumentId ?? null;
    }
    if (committeeId !== null && existing.committeeId !== committeeId) {
      updates.committeeId = committeeId;
    }
    if (Object.keys(updates).length > 0) {
      return prisma.instrument.update({
        where: { id: existing.id },
        data: updates,
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
        committeeId,
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
  const skipInstruments = process.env.SEED_SKIP_INSTRUMENTS === "1" || process.env.SEED_SKIP_INSTRUMENTS === "true";
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
    name: "Participante comité (seed)",
    roles: [],
  });
  await ensureUser({
    email: "viewer@hub-preop.local",
    passwordPlain: viewerPass,
    name: "Public viewer",
    roles: ["viewer_public"],
  });

  await ensureCommittees();
  await ensureActiveMembership("reviewer@hub-preop.local", "C#01");
  await prisma.user.updateMany({
    where: { email: "reviewer@hub-preop.local" },
    data: { roles: [] },
  });

  if (skipInstruments) {
    console.log("SEED_SKIP_INSTRUMENTS set — users and committees only.");
  } else {
    console.log(
      "Skipping retired HUB-INSTR-00009001–00009003 placeholders; use v2 load scripts for institutional instruments.",
    );
  }

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
