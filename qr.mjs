import QRCode from "qrcode";

// QR code (SVG) pointing to this site's voting page.
export default async (req) => {
  const url = new URL("/vote", new URL(req.url).origin).toString();
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b2545", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
};

export const config = { path: "/api/qr", method: "GET" };
