'use client';

export default function Error({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-gray-400 mb-4 text-sm max-w-md">
        {error?.message || 'An unexpected error occurred on this page.'}
      </p>
      <button
        className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
