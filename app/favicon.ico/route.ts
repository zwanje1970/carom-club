import { NextResponse } from "next/server";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="#1a1a2e" width="32" height="32" rx="6"/><text x="16" y="22" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold" font-family="system-ui">C</text></svg>`;

export function GET() {
  return new NextResponse(SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
