import Link from "next/link";
import { getPublicMarketingHomeUrl } from "@/lib/public-marketing-home";

type Props = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Link to the public marketing site when `NEXT_PUBLIC_LANDING_ORIGIN` is set; otherwise `/` (Hub technical home).
 */
export function PublicMarketingHomeLink({ className, children }: Props) {
  const external = getPublicMarketingHomeUrl();
  if (external) {
    return (
      <a href={external} className={className} rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href="/" className={className}>
      {children}
    </Link>
  );
}
