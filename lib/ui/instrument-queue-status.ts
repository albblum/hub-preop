/** Maps recognition modal copy to Hub instrument lifecycle filters (GET /api/instruments?status=). */
export const RECOGNITION_INSTRUMENT_STATUS = {
  awaitingReview: "under-review",
  inDeliberation: "foundational-provisional",
  published: "in-force",
} as const;
