"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@c1rcle/ui";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => createQueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
