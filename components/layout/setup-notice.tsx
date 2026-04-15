export function SetupNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-amber-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-800">{description}</p>
    </div>
  );
}
