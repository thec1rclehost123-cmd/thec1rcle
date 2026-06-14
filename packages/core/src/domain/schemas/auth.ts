import { z } from 'zod';

export const onboardRequestSchema = z.object({
    role: z.enum(['promoter', 'ambassador', 'creator']),
    experience: z.string().optional(),
    links: z.array(z.string().url()).optional()
});

export const hostVerificationSchema = z.object({
    companyName: z.string().min(2),
    registrationNumber: z.string().optional(),
    primaryCity: z.string().min(2),
    companyType: z.enum(['venue', 'promoter_group', 'independent']),
    idDocumentUrl: z.string().url(),
    businessDocumentUrl: z.string().url().optional()
});

export type OnboardRequest = z.infer<typeof onboardRequestSchema>;
export type HostVerification = z.infer<typeof hostVerificationSchema>;
