// components/layout/SiteChrome.tsx — gate customer-facing chrome off ops pages
"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import SiteFooter from "@/components/layout/SiteFooter";
import ContactHub from "@/components/ContactHub";
import SalesChat from "@/components/SalesChat";

function isOpsPath(p: string | null): boolean {
  return !!p && p.startsWith("/ops-");
}

export function SiteHeader() {
  if (isOpsPath(usePathname())) return null;
  return <Header />;
}

export function SiteChromeBottom() {
  if (isOpsPath(usePathname())) return null;
  return (
    <>
      <SiteFooter />
      <ContactHub />
      <SalesChat />
    </>
  );
}
