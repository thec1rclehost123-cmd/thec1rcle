function buildRawPDF(contentLines) {
    const objects = [];
    let objectCount = 0;

    const addObject = (content) => {
        objectCount++;
        objects.push({ id: objectCount, content });
        return objectCount;
    };

    addObject('<<\n/Type /Catalog\n/Pages 2 0 R\n>>');
    addObject('<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>');

    let stream = '';
    for (const item of contentLines) {
        if (item.line) {
            stream += `0.85 0.85 0.85 RG\n0.5 w\n50 ${item.y} m 545 ${item.y} l S\n`;
            continue;
        }
        if (!item.text && item.text !== '') continue;
        const x = item.x || 50;
        const y = item.y || 700;
        const size = item.size || 12;
        const fontRef = item.bold ? '/F2' : '/F1';
        const color = item.color || '0 0 0';
        const escaped = item.text
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/₹/g, 'Rs.');
        stream += `BT\n${color} rg\n${fontRef} ${size} Tf\n${x} ${y} Td\n(${escaped}) Tj\nET\n`;
    }

    const streamBytes = Buffer.byteLength(stream, 'utf-8');
    addObject(`<<\n/Length ${streamBytes}\n>>\nstream\n${stream}endstream`);

    objects.splice(2, 0, {
        id: 3,
        content: `<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 595 842]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 5 0 R\n/F2 6 0 R\n>>\n>>\n>>`,
    });

    objects.forEach((obj, i) => { obj.id = i + 1; });
    objectCount = objects.length;

    addObject('<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>');
    addObject('<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica-Bold\n/Encoding /WinAnsiEncoding\n>>');

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'utf-8'));
        pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
    pdf += 'xref\n';
    pdf += `0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const offset of offsets) {
        pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }

    pdf += 'trailer\n';
    pdf += `<<\n/Size ${objects.length + 1}\n/Root 1 0 R\n>>\n`;
    pdf += 'startxref\n';
    pdf += `${xrefOffset}\n`;
    pdf += '%%EOF\n';

    return pdf;
}

export function generateTicketPDF({
    orderId,
    userName,
    eventName,
    eventDate,
    eventTime,
    location,
    tickets = [],
    totalAmount = 0,
    isRSVP = false,
}) {
    const ticketLines = tickets.map(t =>
        `${t.quantity}x ${t.name} — ${isRSVP ? 'RSVP' : `Rs.${(t.price * t.quantity).toLocaleString('en-IN')}`}`
    );
    const totalLine = isRSVP ? 'RSVP (Free)' : `Rs.${totalAmount.toLocaleString('en-IN')}`;
    const orderDate = new Date().toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });

    const contentLines = [
        { text: 'THE C1RCLE', size: 20, y: 760, bold: true },
        { text: `Order #${orderId}`, size: 10, y: 760, x: 400, color: '0.5 0.5 0.5' },
        { line: true, y: 745 },
        { text: eventName, size: 16, y: 720, bold: true },
        { text: '', size: 12, y: 700 },
        { text: userName, size: 12, y: 685 },
        { text: `Order #${orderId}`, size: 10, y: 668, color: '0.4 0.4 0.4' },
        { text: '', size: 12, y: 640 },
        ...ticketLines.map((line, i) => ({ text: line, size: 11, y: 625 - (i * 18) })),
        { line: true, y: 625 - (ticketLines.length * 18) - 10 },
        { text: `Total: ${totalLine}`, size: 13, y: 625 - (ticketLines.length * 18) - 30, bold: true },
        { text: '', size: 12, y: 625 - (ticketLines.length * 18) - 60 },
        { text: location, size: 10, y: 625 - (ticketLines.length * 18) - 75, color: '0.4 0.4 0.4' },
        { text: `${eventDate}${eventTime ? `, ${eventTime}` : ''}`, size: 10, y: 625 - (ticketLines.length * 18) - 90, color: '0.4 0.4 0.4' },
        { text: `Generated ${orderDate}`, size: 8, y: 40, color: '0.6 0.6 0.6' },
        { text: 'THE C1RCLE — thec1rcle.com', size: 8, y: 28, color: '0.6 0.6 0.6' },
    ];

    return Buffer.from(buildRawPDF(contentLines));
}

export function getQRCodeUrl(data, size = 200) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FFFFFF&color=000000&margin=10`;
}
