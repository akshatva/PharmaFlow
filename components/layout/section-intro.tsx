type SectionIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionIntro({ eyebrow, title, description }: SectionIntroProps) {
  return (
    <section className="space-y-1 pb-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {eyebrow}
      </p>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </section>
  );
}
