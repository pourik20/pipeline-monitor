"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const sectionTitles: Record<string, string> = {
  datasets: "Datasets",
  pipelines: "Pipelines",
  runs: "Runs",
  alerts: "Alerts",
  new: "New",
};

function buildCrumbs(pathname: string) {
  if (pathname === "/") return [{ label: "Dashboard", href: "/", isLast: true }];
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string; isLast: boolean }> = [
    { label: "Dashboard", href: "/", isLast: false },
  ];
  segments.forEach((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    const label =
      sectionTitles[seg] ??
      (seg.length > 12 ? `${seg.slice(0, 8)}…` : seg);
    crumbs.push({ label, href, isLast });
  });
  return crumbs;
}

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              <BreadcrumbItem>
                {c.isLast ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {i < crumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
