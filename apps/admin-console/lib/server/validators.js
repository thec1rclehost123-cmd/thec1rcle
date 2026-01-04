
import { z } from "zod";

// --- Order Schemas ---

export const ticketItemSchema = z.object({
    ticketId: z.string().min(1, "Ticket ID is required"),
    quantity: z.number().int().positive("Quantity must be at least 1").max(10, "Max 10 tickets per type"),
});

export const createOrderSchema = z.object({
    eventId: z.string().min(1, "Event ID is required"),
    tickets: z.array(ticketItemSchema).min(1, "At least one ticket is required"),
    userEmail: z.string().email("Invalid email address"),
    userName: z.string().min(2, "Name must be at least 2 characters").optional(),
    paymentMethod: z.enum(["card", "upi", "netbanking"]).default("card"),
});

// --- Waitlist Schemas ---

export const joinWaitlistSchema = z.object({
    eventId: z.string().min(1, "Event ID is required"),
    ticketId: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number").optional(),
});

// --- Validation Helper ---

export async function validateBody(request, schema) {
    try {
        const body = await request.json();
        return { data: schema.parse(body), error: null };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { data: null, error: error.errors[0].message };
        }
        return { data: null, error: "Invalid request body" };
    }
}
