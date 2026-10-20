import type { ReactNode } from "react";
import { PageFrame } from "@/components/ui/Frame";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PageFrame>{children}</PageFrame>;
}
