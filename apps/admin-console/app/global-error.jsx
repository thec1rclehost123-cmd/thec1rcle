'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body className="antialiased bg-black text-white">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Critical Error</h1>
          <p className="text-sm text-zinc-500 max-w-md mb-8">
            {error?.message || 'The application encountered a critical error and could not recover.'}
          </p>
          <button
            onClick={reset}
            className="px-8 py-3.5 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
