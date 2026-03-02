import { z } from 'zod';
export declare const onboardRequestSchema: z.ZodObject<{
    role: z.ZodEnum<{
        promoter: "promoter";
        ambassador: "ambassador";
        creator: "creator";
    }>;
    experience: z.ZodOptional<z.ZodString>;
    links: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const hostVerificationSchema: z.ZodObject<{
    companyName: z.ZodString;
    registrationNumber: z.ZodOptional<z.ZodString>;
    primaryCity: z.ZodString;
    companyType: z.ZodEnum<{
        venue: "venue";
        promoter_group: "promoter_group";
        independent: "independent";
    }>;
    idDocumentUrl: z.ZodString;
    businessDocumentUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type OnboardRequest = z.infer<typeof onboardRequestSchema>;
export type HostVerification = z.infer<typeof hostVerificationSchema>;
