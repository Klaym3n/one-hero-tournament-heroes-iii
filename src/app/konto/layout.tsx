import type { ReactNode } from "react";
import { PageFrame } from "@/components/ui/Frame";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <PageFrame variant="red">{children}</PageFrame>;
}
