export default function Loading() {
    return (
        <div className="p-6 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full space-y-8 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="w-48 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                <div className="w-32 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
            </div>
            
            <div className="flex items-center gap-2">
                {[1, 2].map((i) => (
                    <div key={i} className="w-24 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-64 rounded-[32px]" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                ))}
            </div>
        </div>
    );
}
