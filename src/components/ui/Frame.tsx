import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "article" | "aside";
};

/**
 * Rama całej strony (najwyższa warstwa): niebieska na stronach publicznych, czerwona w koncie
 * gracza i panelu admina. Wewnątrz używaj Frame (frame-sm), a w nich frame-xs.
 */
export function PageFrame({ variant = "blue", children, className = "" }: { variant?: "blue" | "red"; children: ReactNode; className?: string }) {
  return (
    <div className={["frame", variant === "red" && "frame-red", className].filter(Boolean).join(" ")}>
      <div className="px-3 py-5 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}

/** Okno (panel) wewnątrz ramy strony: ramka frame-sm na przyciemnionej skórze. */
export function Frame({ title, actions, children, className = "", bodyClassName = "p-4 sm:p-5", as: Tag = "section" }: Props) {
  return (
    <Tag className={`frame-sm panel ${className}`}>
      {title !== undefined && (
        <header className="frame-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <h2 className="font-display text-base font-bold text-gold-light sm:text-lg">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-6 text-center sm:mb-8">
      <h1 className="title-gold text-3xl font-black sm:text-4xl">{children}</h1>
      {subtitle && <p className="mx-auto mt-2 max-w-2xl text-cream-dim">{subtitle}</p>}
      <div className="divider-ornament mx-auto mt-3 max-w-xs text-xs" aria-hidden>
        ◆
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-cream-dim italic">{children}</p>;
}

export function Loading({ label = "Wczytywanie…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-cream-dim" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      {label}
    </div>
  );
}
