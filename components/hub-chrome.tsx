import { HubHeader } from "@/components/ui/hub-header";

/** App shell: DocHUB header + page content. Header is client; wrapper stays server-friendly. */
export function HubChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubHeader />
      {children}
    </>
  );
}
