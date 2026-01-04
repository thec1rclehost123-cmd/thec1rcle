const { createShareBundle } = require('./app/tickets/actions');

async function test() {
    process.env.NODE_ENV = 'development';
    try {
        console.log("Testing createShareBundle for order-1...");
        const result = await createShareBundle('order-1', 'after-dark-az', 1);
        console.log("Success:", result);
    } catch (e) {
        console.error("Failed:", e.message);
        if (e.stack) console.error(e.stack);
    }
}

test();
