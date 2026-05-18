/** Ledger entry types — conceptual mirror of DocHUB §5.5 (subset, instrument-level pre-op). */
export const LEDGER_ENTRY_TYPES = {
  /** New or revised content snapshot; `payloadHash` = `InstrumentVersion.contentHash`. */
  VERSION_RECORDED: "VERSION_RECORDED",
  /** Status change; `payloadHash` = canonical hash of the transition event record. */
  STATUS_TRANSITION: "STATUS_TRANSITION",
  /** Comité — acto formal registado (consulta, deliberação, aprovação); payloadHash = hash canónico do corpo. */
  COMMITTEE_PROCESS_RECORD: "COMMITTEE_PROCESS_RECORD",
  /** Registo fundacional de instrumento institucional (ato monolítico v1). */
  INSTRUMENT_REGISTERED: "INSTRUMENT_REGISTERED",
} as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[keyof typeof LEDGER_ENTRY_TYPES];
