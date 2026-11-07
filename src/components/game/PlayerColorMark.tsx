import { playerColor } from "@/data/colors";

/**
 * Pasek kolorów, którymi gracz grał kolejne gry meczu – jeden segment na grę.
 * Kolory wybierają gracze w raporcie, więc przed wprowadzeniem wyniku (colors = null)
 * w miejscu paska zostaje pusta przestrzeń.
 */
export function PlayerColorMark({
  colors,
  className = "h-6 w-1",
  horizontal = false,
}: {
  colors: string[] | null | undefined;
  className?: string;
  horizontal?: boolean;
}) {
  const list = (colors ?? []).map(playerColor).filter((c) => c !== null);
  if (!list.length) return <span className={`shrink-0 ${className}`} aria-hidden />;
  const label = `Kolory w kolejnych grach: ${list.map((c) => c.name.toLowerCase()).join(", ")}`;
  return (
    <span className={`flex shrink-0 gap-px overflow-hidden ${horizontal ? "flex-row" : "flex-col"} ${className}`} title={label} aria-label={label} role="img">
      {list.map((c, i) => (
        <span key={i} className="min-h-0 min-w-0 flex-1" style={{ background: c.hex }} />
      ))}
    </span>
  );
}
