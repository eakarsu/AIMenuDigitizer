import { createHash } from 'node:crypto';

export function detectMenuSource(bytes: Buffer): { sourceType: 'pdf' | 'image'; mimeType: string } | null {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') return { sourceType: 'pdf', mimeType: 'application/pdf' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { sourceType: 'image', mimeType: 'image/jpeg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { sourceType: 'image', mimeType: 'image/png' };
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return { sourceType: 'image', mimeType: 'image/webp' };
  return null;
}

export const sourceSha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
