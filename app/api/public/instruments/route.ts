import { NextResponse } from "next/server";
import { getPublicInstrumentByIdrRef, listPublicCatalog } from "@/lib/publication-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idrRef = url.searchParams.get("idrRef");
  if (idrRef) {
    const versionParam = url.searchParams.get("version");
    let version: number | undefined;
    if (versionParam !== null && versionParam !== "") {
      const n = Number(versionParam);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json({ error: "Invalid version (positive integer required)" }, { status: 400 });
      }
      version = n;
    }
    const item = await getPublicInstrumentByIdrRef(
      idrRef,
      version !== undefined ? { version } : undefined,
    );
    if (!item) {
      return NextResponse.json({ error: "Instrument not found or not publicable" }, { status: 404 });
    }
    return NextResponse.json(item);
  }

  const limit = Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50);
  const items = await listPublicCatalog(limit);
  return NextResponse.json({ items, total: items.length });
}
