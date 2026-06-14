import { Construction } from "lucide-react";

export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-subtle rounded-3xl bg-surface-elevated/[0.02]">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/50">
                <Construction className="w-8 h-8 text-zinc-500" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-3">{title}</h1>
            <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">{description}</p>
        </div>
    );
}
