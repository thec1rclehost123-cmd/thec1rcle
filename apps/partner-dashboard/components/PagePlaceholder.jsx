export default function PagePlaceholder({ title, description }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs uppercase tracking-[0.5em] text-white/60">Placeholder</p>
      <h1 className="text-4xl font-heading uppercase tracking-[0.3em]">{title}</h1>
      {description ? <p className="max-w-lg text-white/60">{description}</p> : null}
    </div>
  );
}
