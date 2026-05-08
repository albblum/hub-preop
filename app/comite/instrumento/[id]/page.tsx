import { InstrumentWorkspaceClient } from "./instrument-workspace-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function ComiteInstrumentoPage(context: PageProps) {
  const { id } = await context.params;
  return <InstrumentWorkspaceClient instrumentId={id} />;
}
