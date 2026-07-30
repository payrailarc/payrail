import Link from "next/link";

export function DocShell({
  title,
  subtitle,
  sections,
  children,
}: {
  title: string;
  subtitle: string;
  sections: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-xs tracking-[0.2em] text-sky">PAYRAIL</p>
      <h1 className="mt-3 text-4xl tracking-tight text-navy">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-navy/65">{subtitle}</p>

      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs tracking-[0.2em] text-navy/40">CONTENTS</p>
          <ul className="mt-4 space-y-2 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <Link href={`#${section.id}`} className="text-navy/60 transition hover:text-arcblue">
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-3xl space-y-14">{children}</div>
      </div>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl tracking-tight text-navy">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-navy/70">{children}</div>
    </section>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-navy p-5 text-xs leading-relaxed text-white/85">
      <code>{children}</code>
    </pre>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ice/70 text-xs uppercase tracking-wider text-navy/50">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-4 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-navy/5 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2 text-navy/70">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
