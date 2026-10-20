import Link from "next/link";
import { PageFrame } from "@/components/ui/Frame";

export default function NotFound() {
  return (
    <PageFrame className="mx-auto max-w-md text-center">
      <p className="title-gold text-5xl font-black">404</p>
      <p className="mt-3">Ta kraina nie została jeszcze odkryta. Mgła wojny skrywa tę stronę.</p>
      <Link href="/" className="btn mt-6">
        Wróć do zamku
      </Link>
    </PageFrame>
  );
}
