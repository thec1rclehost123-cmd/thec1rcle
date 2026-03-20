import { Construction } from "lucide-react";

export default function VenuePlaceholderPage({ title, description }: { title: string, description: string }) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[var(--border-default)] rounded-3xl bg-[var(--bg-secondary)]">
            <div className="w-16 h-16 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--border-subtle)]">
                <Construction className="w-8 h-8 text-[var(--text-tertiary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{title}</h1>
            <p className="text-[var(--text-tertiary)] max-w-md mx-auto">{description}</p>
        </div>
    );
}
