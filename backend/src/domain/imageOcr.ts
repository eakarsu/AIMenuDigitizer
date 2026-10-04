import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export type ImageOcrCandidate = { text: string; confidence: number; wordCount: number };
const execFileAsync = promisify(execFile);

export function parseImageOcrTsv(tsv: string): ImageOcrCandidate {
  const lines = new Map<string, string[]>();
  let confidenceTotal = 0;
  let wordCount = 0;
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const cells = row.split('\t');
    if (cells.length < 12 || cells[0] !== '5') continue;
    const word = cells.slice(11).join('\t').trim();
    const confidence = Number(cells[10]);
    if (!word || !Number.isFinite(confidence) || confidence < 0) continue;
    const lineKey = cells.slice(1, 5).join(':');
    if (!lines.has(lineKey)) lines.set(lineKey, []);
    lines.get(lineKey)!.push(word);
    confidenceTotal += confidence;
    wordCount += 1;
  }
  return {
    text: Array.from(lines.values(), words => words.join(' ')).join('\n').slice(0, 100000),
    confidence: wordCount ? Math.round(confidenceTotal / wordCount) / 100 : 0,
    wordCount,
  };
}

export function extractImageOcrCandidate(bytes: Buffer): Promise<ImageOcrCandidate> {
  const executable = process.env.MENU_TESSERACT_PATH || 'tesseract';
  const language = process.env.MENU_OCR_LANGUAGE || 'eng';
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['stdin', 'stdout', '-l', language, 'tsv'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
    const timer = setTimeout(() => { child.kill('SIGKILL'); fail(new Error('Image OCR exceeded 20 seconds')); }, 20000);
    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 2 * 1024 * 1024) { child.kill('SIGKILL'); fail(new Error('Image OCR output is too large')); }
      else stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => { if (Buffer.concat(stderr).length < 2000) stderr.push(chunk); });
    child.on('error', error => { clearTimeout(timer); fail(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) return fail(new Error(`Image OCR failed: ${Buffer.concat(stderr).toString('utf8').slice(0, 180)}`));
      const candidate = parseImageOcrTsv(Buffer.concat(stdout).toString('utf8'));
      if (!candidate.wordCount) return fail(new Error('No readable words found; transcribe this image manually'));
      settled = true; resolve(candidate);
    });
    child.stdin.on('error', () => { /* A failed OCR process is reported by its close event. */ });
    child.stdin.end(bytes);
  });
}

export async function extractPdfScanCandidate(bytes: Buffer, pageCount: number): Promise<ImageOcrCandidate & { pagesProcessed: number }> {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 5) throw new Error('Scanned PDF OCR supports 1 to 5 pages per source');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'governed-menu-pdf-ocr-'));
  const pdfPath = path.join(directory, 'source.pdf');
  const renderer = process.env.MENU_PDFTOPPM_PATH || 'pdftoppm';
  try {
    await fs.writeFile(pdfPath, bytes, { mode: 0o600 });
    const candidates: ImageOcrCandidate[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const prefix = path.join(directory, `page-${page}`);
      await execFileAsync(renderer, ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '1600', '-png', pdfPath, prefix], { timeout: 20000, maxBuffer: 2048 });
      const imagePath = `${prefix}.png`;
      const stat = await fs.stat(imagePath);
      if (stat.size > 12 * 1024 * 1024) throw new Error('Rendered PDF page is too large for OCR');
      try { candidates.push(await extractImageOcrCandidate(await fs.readFile(imagePath))); }
      catch (error: any) {
        if (!/No readable words found/.test(String(error.message))) throw error;
        candidates.push({ text: '', confidence: 0, wordCount: 0 });
      }
    }
    const wordCount = candidates.reduce((sum, item) => sum + item.wordCount, 0);
    if (!wordCount) throw new Error('No readable words found; transcribe this PDF manually');
    return {
      text: candidates.map((item, index) => `[Page ${index + 1}]\n${item.text}`).join('\n\n').slice(0, 100000),
      confidence: Math.round(candidates.reduce((sum, item) => sum + item.confidence * item.wordCount, 0) / wordCount * 100) / 100,
      wordCount,
      pagesProcessed: pageCount,
    };
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
