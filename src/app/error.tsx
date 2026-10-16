"use client";

import { Frame } from "@/components/ui/Frame";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Frame className="mx-auto max-w-md" bodyClassName="p-8 text-center">
      <p className="title-gold text-3xl font-black">Coś poszło nie tak</p>
      <p className="mt-3 text-cream-dim">Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.</p>
      <button className="btn mt-6" onClick={reset}>
        Spróbuj ponownie
      </button>
    </Frame>
  );
}
