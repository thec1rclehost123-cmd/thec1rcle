export default function Loading() {
  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full space-y-8 animate-pulse">
      <div className="flex items-center gap-4">
        <div
          className="w-48 h-10 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        ></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-[24px]"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          ></div>
        ))}
      </div>
      <div className="space-y-3 mt-8">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          ></div>
        ))}
      </div>
    </div>
  );
}
