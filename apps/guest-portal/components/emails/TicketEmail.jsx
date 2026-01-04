import React from 'react';

export const TicketEmail = ({
    userName,
    eventName,
    eventDate,
    eventLocation,
    eventPosterUrl,
    orderId,
    tickets,
    totalAmount,
}) => {
    const previewText = `Your ticket for ${eventName}`;

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>{previewText}</title>
            </head>
            <body style={{
                backgroundColor: '#000000',
                color: '#ffffff',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                margin: 0,
                padding: '40px 20px',
            }}>
                <div style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    backgroundColor: '#000000',
                }}>
                    {/* Header */}
                    <div style={{ marginBottom: '30px' }}>
                        <h1 style={{
                            fontSize: '32px',
                            fontWeight: 'bold',
                            margin: '0 0 10px 0',
                            color: '#ffffff',
                        }}>
                            {userName}, you're in...
                        </h1>
                    </div>

                    {/* Event Title */}
                    <div style={{ marginBottom: '20px' }}>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            margin: '0',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            {eventName}
                        </h2>
                    </div>

                    {/* Event Poster */}
                    <div style={{
                        marginBottom: '30px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid #333',
                    }}>
                        <img
                            src={eventPosterUrl}
                            alt={eventName}
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                            }}
                        />
                    </div>

                    {/* Ticket Details */}
                    <div style={{ marginBottom: '30px' }}>
                        <p style={{
                            fontSize: '14px',
                            color: '#888888',
                            margin: '0 0 5px 0',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                        }}>
                            {tickets.length} Tickets
                        </p>
                        <p style={{
                            fontSize: '16px',
                            color: '#ffffff',
                            margin: '0 0 20px 0',
                        }}>
                            Order code: {orderId}
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                            <p style={{
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#ffffff',
                                margin: '0 0 5px 0',
                            }}>
                                {eventDate}
                            </p>
                            <p style={{
                                fontSize: '14px',
                                color: '#cccccc',
                                margin: '0',
                            }}>
                                {eventLocation}
                            </p>
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(eventLocation)}`} style={{
                                fontSize: '12px',
                                color: '#666666',
                                textDecoration: 'underline',
                                marginTop: '5px',
                                display: 'inline-block',
                            }}>
                                Get directions
                            </a>
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div style={{
                        borderTop: '1px solid #333',
                        paddingTop: '20px',
                        marginBottom: '30px',
                    }}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            margin: '0 0 15px 0',
                        }}>
                            Order Summary
                        </h3>
                        <p style={{
                            fontSize: '14px',
                            color: '#888888',
                            margin: '0 0 10px 0',
                        }}>
                            Order {orderId} • {new Date().toLocaleDateString()}
                        </p>

                        {tickets.map((ticket, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '10px',
                                color: '#cccccc',
                                fontSize: '14px',
                            }}>
                                <span>{ticket.quantity}x {ticket.name}</span>
                                <span>₹{ticket.price * ticket.quantity}</span>
                            </div>
                        ))}

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '15px',
                            paddingTop: '15px',
                            borderTop: '1px solid #333',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '16px',
                        }}>
                            <span>Total</span>
                            <span>₹{totalAmount}</span>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '20px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        marginBottom: '30px',
                    }}>
                        <p style={{
                            color: '#000000',
                            fontSize: '12px',
                            margin: '0 0 15px 0',
                            fontWeight: '500',
                        }}>
                            Scan this code at the door
                        </p>
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${orderId}`}
                            alt="Ticket QR Code"
                            style={{
                                width: '150px',
                                height: '150px',
                            }}
                        />
                    </div>

                    {/* Footer */}
                    <div style={{
                        textAlign: 'center',
                        borderTop: '1px solid #333',
                        paddingTop: '30px',
                    }}>
                        <div style={{
                            marginBottom: '20px',
                        }}>
                            <span style={{
                                fontSize: '24px',
                                fontWeight: 'bold',
                                color: '#ffffff',
                                letterSpacing: '-1px',
                            }}>
                                posh
                            </span>
                        </div>
                        <p style={{
                            fontSize: '12px',
                            color: '#666666',
                            margin: '0 0 10px 0',
                        }}>
                            © 2025 THE C1RCLE. All rights reserved.
                        </p>
                        <p style={{
                            fontSize: '12px',
                            color: '#666666',
                            margin: '0',
                        }}>
                            New York, NY
                        </p>
                    </div>
                </div>
            </body>
        </html>
    );
};

export default TicketEmail;
