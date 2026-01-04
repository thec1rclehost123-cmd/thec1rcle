import { Resend } from 'resend';
import TicketEmail from '../../components/emails/TicketEmail';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

export async function sendTicketEmail({
    to,
    userName,
    eventName,
    eventDate,
    eventLocation,
    eventPosterUrl,
    orderId,
    tickets,
    totalAmount,
}) {
    if (!resend) {
        console.warn('Resend API key not found. Skipping email send.');
        return { success: false, error: 'Missing API key' };
    }

    try {
        const data = await resend.emails.send({
            from: 'THE C1RCLE <tickets@thec1rcle.com>', // You might need to verify this domain or use 'onboarding@resend.dev' for testing
            to: [to],
            subject: `Your ticket for ${eventName}`,
            react: TicketEmail({
                userName,
                eventName,
                eventDate,
                eventLocation,
                eventPosterUrl,
                orderId,
                tickets,
                totalAmount,
            }),
        });

        console.log('Email sent successfully:', data);
        return { success: true, data };
    } catch (error) {
        console.error('Failed to send email:', error);
        return { success: false, error };
    }
}
