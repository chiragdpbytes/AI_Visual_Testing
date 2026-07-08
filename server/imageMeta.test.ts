import { describe, it, expect } from "vitest";
import { parseImageDimensions } from "./imageMeta";

// Build a minimal valid PNG header: 8-byte signature + IHDR chunk
function pngBase64(width: number, height: number): string {
  const buf = Buffer.alloc(33);
  buf.write("\x89PNG\r\n\x1a\n", 0, "binary"); // signature
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString("base64");
}

// Minimal JPEG: SOI + SOF0 frame with dimensions
function jpegBase64(width: number, height: number): string {
  const buf = Buffer.from([
    0xff, 0xd8,             // SOI
    0xff, 0xc0,             // SOF0 marker
    0x00, 0x11,             // segment length 17
    0x08,                   // bit depth
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,                   // components
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  return buf.toString("base64");
}

describe("parseImageDimensions", () => {
  it("parses PNG dimensions from IHDR", () => {
    expect(parseImageDimensions(pngBase64(1920, 1080), "image/png"))
      .toEqual({ width: 1920, height: 1080 });
  });

  it("parses JPEG dimensions from SOF0", () => {
    expect(parseImageDimensions(jpegBase64(1280, 720), "image/jpeg"))
      .toEqual({ width: 1280, height: 720 });
  });

  it("returns null for garbage input", () => {
    expect(parseImageDimensions("bm90IGFuIGltYWdl", "image/png")).toBeNull();
  });

  it("returns null for unsupported mime types", () => {
    expect(parseImageDimensions(pngBase64(10, 10), "image/webp")).toBeNull();
  });
});
