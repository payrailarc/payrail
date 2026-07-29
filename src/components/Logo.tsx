type LogoProps = {
  className?: string;
  tone?: "light" | "dark";
};

export function LogoMark({ className = "h-9 w-9", tone = "light" }: LogoProps) {
  const outer = tone === "dark" ? "#FFFFFF" : "#0D1B2F";
  const middle = tone === "dark" ? "#ACC6E9" : "#3E74BB";
  return (
    <svg viewBox="0 0 128 128" className={className} aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        <path d="M20 96 Q64 8 108 96" stroke={outer} strokeWidth={7} />
        <path d="M36 96 Q64 34 92 96" stroke={middle} strokeWidth={5.5} />
        <path d="M50 96 Q64 60 78 96" stroke="#5FBFFF" strokeWidth={4.5} />
      </g>
    </svg>
  );
}

export function Logo({ tone = "light" }: LogoProps) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark tone={tone} className="h-9 w-9" />
      <span
        className={`text-xl tracking-[0.08em] ${tone === "dark" ? "text-white" : "text-navy"}`}
      >
        pay<span className="font-semibold text-sky">rail</span>
      </span>
    </span>
  );
}
