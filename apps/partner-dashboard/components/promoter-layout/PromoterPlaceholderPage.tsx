import { Construction } from 'lucide-react';

export default function PromoterPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-default rounded-3xl bg-surface-secondary">
      <div className="w-16 h-16 bg-surface-tertiary rounded-full flex items-center justify-center mb-6 shadow-xl border border-border-subtle">
        <Construction className="w-6 h-6 text-emerald-500" />
      </div>
      <h1 className="text-xl font-bold text-text-primary mb-2">{title}</h1>
      <p className="text-text-tertiary max-w-xs mx-auto text-sm">{description}</p>
    </div>
  );
}
