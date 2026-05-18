/**
 * Movimento 2 — papéis institucionais, ato de nomeação e utilizadores provisórios.
 * Run: `npm run seed:movement2` (requires `DATABASE_URL`, e.g. via `.env`)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import type { HubRole } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { computeContentHash } from "../lib/integrity/content-hash";
import { appendInstrumentRegisteredLedger } from "../lib/ledger/append-ledger";
import { syncMonolithicPartForInstrumentVersion } from "../lib/part-composition";

const prisma = new PrismaClient();

const NOMINATION_IDR_REF = "idr:i:sg:nomination:provisional-members:v1";
const PREOP_IDR_REF = "idr:c:preop-regime";
const PROVISIONAL_COMMITTEE_CODE = "IDR-PROVISIONAL";
const REGISTERED_AT = new Date("2026-05-18T12:00:00.000Z");
const LEDGER_NOTE =
  "Foundational act. Provisional members nomination. Issued by IDR-SG-0001.";

function loadNominationContent(): string {
  const path = join(
    process.cwd(),
    "content/institutional/idr-i-sg-nomination-provisional-members-v1.md",
  );
  return readFileSync(path, "utf8");
}

async function ensureProvisionalCommittee() {
  return prisma.committee.upsert({
    where: { code: PROVISIONAL_COMMITTEE_CODE },
    create: {
      code: PROVISIONAL_COMMITTEE_CODE,
      name: "Pre-operational provisional pool (authority carrier)",
    },
    update: {},
  });
}

async function ensureUser(input: {
  email: string;
  passwordPlain: string;
  name: string;
  roles: HubRole[];
}) {
  const updatePasswords =
    process.env.SEED_UPDATE_EXISTING_PASSWORDS === "1" ||
    process.env.SEED_UPDATE_EXISTING_PASSWORDS === "true";
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (updatePasswords) {
      const passwordHash = await bcrypt.hash(input.passwordPlain, 10);
      return prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: input.name, roles: input.roles },
      });
    }
    const roleChanged =
      existing.roles.length !== input.roles.length ||
      input.roles.some((r) => !existing.roles.includes(r));
    if (roleChanged || existing.name !== input.name) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, roles: input.roles },
      });
    }
    return existing;
  }
  const passwordHash = await bcrypt.hash(input.passwordPlain, 10);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      roles: input.roles,
    },
  });
}

async function ensureAuthorityMembership(input: {
  userEmail: string;
  committeeId: string;
  authorityInstrumentId: string;
}) {
  const user = await prisma.user.findUnique({ where: { email: input.userEmail } });
  if (!user) return;
  const existing = await prisma.committeeMembership.findFirst({
    where: {
      userId: user.id,
      committeeId: input.committeeId,
      status: "active",
    },
  });
  if (existing) {
    if (existing.authorityInstrumentId !== input.authorityInstrumentId) {
      await prisma.committeeMembership.update({
        where: { id: existing.id },
        data: { authorityInstrumentId: input.authorityInstrumentId },
      });
    }
    return;
  }
  await prisma.committeeMembership.create({
    data: {
      userId: user.id,
      committeeId: input.committeeId,
      status: "active",
      authorityInstrumentId: input.authorityInstrumentId,
      startedAt: REGISTERED_AT,
    },
  });
}

async function ensureNominationInstrument(parentId: string, content: string) {
  const existing = await prisma.instrument.findUnique({
    where: { idrRef: NOMINATION_IDR_REF },
    include: { ledgerEntries: { orderBy: { sequence: "asc" } } },
  });
  if (existing) {
    console.log(`Nomination instrument exists: ${NOMINATION_IDR_REF}`);
    const hasRegistration = existing.ledgerEntries.some(
      (e) => e.entryType === "INSTRUMENT_REGISTERED",
    );
    if (!hasRegistration && existing.currentVersionRecordId) {
      const version = await prisma.instrumentVersion.findUnique({
        where: { id: existing.currentVersionRecordId },
      });
      if (version) {
        await prisma.$transaction(async (tx) => {
          await appendInstrumentRegisteredLedger(tx, {
            instrument: { id: existing.id, idrRef: existing.idrRef },
            version: { id: version.id, contentHash: version.contentHash },
            note: LEDGER_NOTE,
            registeredAt: REGISTERED_AT,
          });
        });
        console.log("Appended missing INSTRUMENT_REGISTERED ledger entry.");
      }
    }
    return existing;
  }

  const hash = computeContentHash(1, content);
  return prisma.$transaction(async (tx) => {
    const inst = await tx.instrument.create({
      data: {
        idrRef: NOMINATION_IDR_REF,
        title: "Nomination Act — Provisional Members",
        documentType: "institutional",
        structuralProfile: "v1",
        layer: 1,
        status: "foundational-provisional",
        draftingAuthority: "IDR-SG-0001",
        currentVersion: 1,
        parentInstrumentId: parentId,
        committeeId: null,
        semanticDocumentCode: "sg-nomination-provisional-members-v1",
        createdAt: REGISTERED_AT,
        updatedAt: REGISTERED_AT,
      },
    });
    const v1 = await tx.instrumentVersion.create({
      data: {
        instrumentId: inst.id,
        version: 1,
        content,
        contentHash: hash,
        previousContentHash: null,
        supersedesVersion: null,
        revisionNote: "Foundational nomination act (Movement 2 seed)",
        createdAt: REGISTERED_AT,
      },
    });
    await syncMonolithicPartForInstrumentVersion(tx, {
      instrumentId: inst.id,
      instrumentVersion: v1,
      instrumentStatus: "foundational-provisional",
    });
    const updated = await tx.instrument.update({
      where: { id: inst.id },
      data: { currentVersionRecordId: v1.id },
    });
    await appendInstrumentRegisteredLedger(tx, {
      instrument: { id: inst.id, idrRef: inst.idrRef },
      version: { id: v1.id, contentHash: v1.contentHash },
      note: LEDGER_NOTE,
      registeredAt: REGISTERED_AT,
    });
    console.log(`Created nomination instrument ${NOMINATION_IDR_REF}`);
    return updated;
  });
}

async function ensureAdminRoles() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@hub-preop.local" } });
  if (admin && !admin.roles.includes("admin")) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { roles: ["admin", "registrar"] },
    });
    console.log("Reclassified admin@hub-preop.local → admin (+ registrar preserved).");
  }
}

async function main() {
  const preop = await prisma.instrument.findUnique({ where: { idrRef: PREOP_IDR_REF } });
  if (!preop) {
    throw new Error(
      `Parent instrument ${PREOP_IDR_REF} not found. Load v2 preop-regime before Movement 2 seed.`,
    );
  }

  const sgPass = process.env.SEED_SG_PASSWORD ?? "ChangeMeSecretaryGeneral!";
  const memberPass = process.env.SEED_PROVISIONAL_MEMBER_PASSWORD ?? "ChangeMeProvisionalMember!";

  const committee = await ensureProvisionalCommittee();
  const content = loadNominationContent();
  const nomination = await ensureNominationInstrument(preop.id, content);

  await ensureUser({
    email: "idr-sg-0001@hub-preop.local",
    passwordPlain: sgPass,
    name: "Secretary-General (Provisional)",
    roles: ["secretary_general"],
  });
  await ensureAuthorityMembership({
    userEmail: "idr-sg-0001@hub-preop.local",
    committeeId: committee.id,
    authorityInstrumentId: preop.id,
  });

  for (let i = 1; i <= 7; i += 1) {
    const suffix = String(i).padStart(4, "0");
    const email = `idr-m-${suffix}@hub-preop.local`;
    await ensureUser({
      email,
      passwordPlain: memberPass,
      name: `Member ${i}`,
      roles: ["provisional_member"],
    });
    await ensureAuthorityMembership({
      userEmail: email,
      committeeId: committee.id,
      authorityInstrumentId: nomination.id,
    });
  }

  await ensureAdminRoles();

  console.log("Movement 2 seed completed.");
  console.log(JSON.stringify({
    nominationIdrRef: NOMINATION_IDR_REF,
    nominationInstrumentId: nomination.id,
    preopAuthorityInstrumentId: preop.id,
    provisionalCommitteeCode: PROVISIONAL_COMMITTEE_CODE,
    ledgerNote: LEDGER_NOTE,
  }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
