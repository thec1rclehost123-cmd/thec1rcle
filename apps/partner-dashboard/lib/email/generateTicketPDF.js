/**
 * PDF Ticket Generator
 * Generates a professional PDF ticket receipt using raw PDF construction
 * No external dependencies required — outputs valid PDF as a Buffer
 */

/**
 * Generate a minimal but clean PDF ticket receipt
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.userName
 * @param {string} params.eventName
 * @param {string} params.eventDate - Formatted date string
 * @param {string} params.eventTime - Formatted time string
 * @param {string} params.location
 * @param {Array}  params.tickets - [{ name, quantity, price }]
 * @param {number} params.totalAmount
 * @param {string} params.qrDataUrl - QR code image data (will be linked)
 * @param {boolean} params.isRSVP
 * @returns {Buffer} PDF buffer
 */
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
  // We'll generate a simple but professional looking HTML receipt
  // that gets rendered as a text-based PDF alternative
  // For a true PDF, we use raw PDF 1.4 construction

  const ticketLines = tickets.map(
    (t, i) =>
      `${t.quantity}x ${t.name} — ${isRSVP ? "RSVP" : `₹${(t.price * t.quantity).toLocaleString("en-IN")}`}`,
  );

  const totalLine = isRSVP ? "RSVP (Free)" : `₹${totalAmount.toLocaleString("en-IN")}`;
  const orderDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  // Build raw PDF content
  const contentLines = [
    { text: "THE C1RCLE", size: 20, y: 760, bold: true },
    { text: `Order #${orderId}`, size: 10, y: 760, x: 400, color: "0.5 0.5 0.5" },

    // Divider
    { line: true, y: 745 },

    { text: eventName, size: 16, y: 720, bold: true },
    { text: "", size: 12, y: 700 },
    { text: userName, size: 12, y: 685 },
    { text: `Order #${orderId}`, size: 10, y: 668, color: "0.4 0.4 0.4" },

    // Ticket details
    { text: "", size: 12, y: 640 },
    ...ticketLines.map((line, i) => ({
      text: line,
      size: 11,
      y: 625 - i * 18,
    })),

    // Divider
    { line: true, y: 625 - ticketLines.length * 18 - 10 },

    { text: `Total: ${totalLine}`, size: 13, y: 625 - ticketLines.length * 18 - 30, bold: true },

    // Event info
    { text: "", size: 12, y: 625 - ticketLines.length * 18 - 60 },
    { text: location, size: 10, y: 625 - ticketLines.length * 18 - 75, color: "0.4 0.4 0.4" },
    {
      text: `${eventDate}${eventTime ? `, ${eventTime}` : ""}`,
      size: 10,
      y: 625 - ticketLines.length * 18 - 90,
      color: "0.4 0.4 0.4",
    },

    // Footer
    { text: `Generated ${orderDate}`, size: 8, y: 40, color: "0.6 0.6 0.6" },
    { text: "THE C1RCLE — thec1rcle.com", size: 8, y: 28, color: "0.6 0.6 0.6" },
  ];

  // Build PDF using raw PDF 1.4 syntax
  const pdf = buildRawPDF(contentLines);
  return Buffer.from(pdf);
}

/**
 * Build a minimal valid PDF from content descriptions
 */
function buildRawPDF(contentLines) {
  // PDF objects
  const objects = [];
  let objectCount = 0;

  const addObject = (content) => {
    objectCount++;
    objects.push({ id: objectCount, content });
    return objectCount;
  };

  // Object 1: Catalog
  const catalogId = addObject("<<\n/Type /Catalog\n/Pages 2 0 R\n>>");

  // Object 2: Pages
  const pagesId = addObject("<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>");

  // Build content stream
  let stream = "";

  for (const item of contentLines) {
    if (item.line) {
      // Draw a horizontal line
      stream += `0.85 0.85 0.85 RG\n`;
      stream += `0.5 w\n`;
      stream += `50 ${item.y} m 545 ${item.y} l S\n`;
      continue;
    }

    if (!item.text && item.text !== "") continue;

    const x = item.x || 50;
    const y = item.y || 700;
    const size = item.size || 12;
    const fontRef = item.bold ? "/F2" : "/F1";
    const color = item.color || "0 0 0";

    // Escape PDF string special characters
    const escaped = item.text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/₹/g, "Rs.");

    stream += `BT\n`;
    stream += `${color} rg\n`;
    stream += `${fontRef} ${size} Tf\n`;
    stream += `${x} ${y} Td\n`;
    stream += `(${escaped}) Tj\n`;
    stream += `ET\n`;
  }

  // Object 3: Page
  const streamBytes = Buffer.byteLength(stream, "utf-8");

  // Object 4: Content stream
  const contentId = addObject(`<<\n/Length ${streamBytes}\n>>\nstream\n${stream}endstream`);

  // Update object 3 (Page) - need to insert it between pages and content
  // Re-order: we need page object to reference content
  objects.splice(2, 0, {
    id: 3,
    content: `<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 595 842]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 5 0 R\n/F2 6 0 R\n>>\n>>\n>>`,
  });

  // Renumber
  objects.forEach((obj, i) => {
    obj.id = i + 1;
  });
  objectCount = objects.length;

  // Object 5: Font (Helvetica)
  addObject(
    "<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>",
  );

  // Object 6: Font Bold (Helvetica-Bold)
  addObject(
    "<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica-Bold\n/Encoding /WinAnsiEncoding\n>>",
  );

  // Build the final PDF
  let pdf = "%PDF-1.4\n";
  const offsets = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  // Cross-reference table
  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += "xref\n";
  pdf += `0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  // Trailer
  pdf += "trailer\n";
  pdf += `<<\n/Size ${objects.length + 1}\n/Root 1 0 R\n>>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF\n";

  return pdf;
}

/**
 * Generate a QR code URL using a free API service
 * @param {string} data - Data to encode
 * @param {number} size - Image size in pixels
 * @returns {string} URL to QR code image
 */
export function getQRCodeUrl(data, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FFFFFF&color=000000&margin=10`;
}
