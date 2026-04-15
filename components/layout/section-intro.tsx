type SectionIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionIntro({ eyebrow, title, description }: SectionIntroProps) {
  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
      <div className="max-w-3xl space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="text-sm leading-7 text-slate-600">{description}</p>
      </div>
    </section>
  );
}
