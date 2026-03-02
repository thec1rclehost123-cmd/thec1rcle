"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error(error);
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-50 rounded-xl m-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went critically wrong</h2>
            <p className="text-gray-600 mb-6 max-w-md">
                An unexpected error occurred in the Admin Console. The engineering team has been notified.
            </p>
            <button
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                onClick={() => reset()}
            >
                Try recovering
            </button>
        </div>
    );
}
