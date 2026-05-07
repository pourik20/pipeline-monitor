"use client";

import { useRouter } from "next/navigation";
import type React from "react";

interface Props extends React.ComponentProps<"tr"> {
  href: string;
}

export function ClickableRow({ href, children, className, ...props }: Props) {
  const router = useRouter();
  return (
    <tr
      {...props}
      className={`cursor-pointer ${className ?? ""}`}
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
