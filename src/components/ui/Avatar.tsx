export function Avatar({ src, name, size = 32, className = "" }: { src?: string | null; name: string; size?: number; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 frame-xs ${className}`}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={`flex shrink-0 items-center justify-center frame-xs bg-[linear-gradient(160deg,var(--crimson),#2a0a10)] font-display font-bold text-gold-light ${className}`}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
