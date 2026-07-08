// Parse pixel dimensions from base64 image data without any image library.
// Supports PNG (IHDR chunk) and JPEG (SOFn frame headers).

export function parseImageDimensions(
  base64Data: string,
  mimeType: string
): { width: number; height: number } | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(base64Data, "base64");
  } catch {
    return null;
  }
  if (mimeType === "image/png") return parsePng(buf);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return parseJpeg(buf);
  return null;
}

function parsePng(buf: Buffer): { width: number; height: number } | null {
  // 8-byte signature, then IHDR: 4-byte length, "IHDR", 4-byte width, 4-byte height
  if (buf.length < 24) return null;
  const signature = "\x89PNG\r\n\x1a\n";
  if (buf.toString("binary", 0, 8) !== signature) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

function parseJpeg(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    // SOF0-SOF15 except DHT(C4), JPG(C8), DAC(CC) carry dimensions
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (width === 0 || height === 0) return null;
      return { width, height };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}
