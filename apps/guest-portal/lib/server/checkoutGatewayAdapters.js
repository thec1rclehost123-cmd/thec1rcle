export function adaptGatewayPaymentConfig(data = {}) {
    return {
        config: data.config || {
            key: data.key || "rzp_test_DEVELOPMENT",
            currency: data.currency || "INR",
            name: "THE C1RCLE",
            description: "Event Tickets",
            theme: { color: "#1d1d1f" },
        }
    };
}

export function adaptGatewayPaymentOrder(orderData = {}, configData = {}) {
    return {
        razorpayOrderId: orderData.razorpayOrderId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        config: adaptGatewayPaymentConfig(configData).config,
    };
}
