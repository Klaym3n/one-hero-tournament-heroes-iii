import { Frame } from "./Frame";
import { Markdown } from "./Markdown";

/** Rozdziela treść markdown na nagłówek z pierwszej linii (# / ## / ### …) i resztę. */
export function splitHeading(md: string): { title: string | null; body: string } {
  const m = md.match(/^\s*#{1,3}[ \t]+(.+?)[ \t]*#*[ \t]*(?:\r?\n|$)/);
  if (!m) return { title: null, body: md };
  return { title: m[1], body: md.slice(m[0].length).replace(/^\s+/, "") };
}

/**
 * Sekcja z treścią markdown edytowaną w panelu. Nagłówek z początku treści (np. „## Harmonogram”)
 * trafia do belki ramki – tak samo jak w ramkach z tytułem (np. „Aktualności”).
 */
export function MarkdownFrame({ md, fallbackTitle, className, bodyClassName, markdownClassName }: { md: string; fallbackTitle?: string; className?: string; bodyClassName?: string; markdownClassName?: string }) {
  const { title, body } = splitHeading(md);
  return (
    <Frame title={title ?? fallbackTitle} className={className} bodyClassName={bodyClassName}>
      <Markdown className={markdownClassName}>{body}</Markdown>
    </Frame>
  );
}
