const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Lazy import to avoid crashing if dependency not installed yet
let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch (_) {}

const CACHE_DIR = path.join(__dirname, '..', 'cache', 'pdftext');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function readLocalPdfBuffer(localPath) {
  return fs.promises.readFile(localPath);
}

async function readRemotePdfBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(res.data);
}

async function extractPdfText({ localPath, remoteUrl, cacheKey }) {
  ensureDir(CACHE_DIR);
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.txt`);
  if (fs.existsSync(cacheFile)) {
    return fs.promises.readFile(cacheFile, 'utf8');
  }
  if (!pdfParse) {
    // Fallback: no extractor installed
    return '';
  }
  let buffer = null;
  if (localPath && fs.existsSync(localPath)) {
    buffer = await readLocalPdfBuffer(localPath);
  } else if (remoteUrl) {
    buffer = await readRemotePdfBuffer(remoteUrl);
  }
  if (!buffer) return '';
  const data = await pdfParse(buffer);
  const text = (data.text || '').replace(/\u0000/g, ' ').trim();
  await fs.promises.writeFile(cacheFile, text, 'utf8');
  return text;
}

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + chunkSize);
    chunks.push(text.slice(i, end));
    i += (chunkSize - overlap);
  }
  return chunks;
}

function scoreChunk(query, chunk) {
  // Simple scoring: keyword overlap with rudimentary normalization
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const qTokens = new Set(normalize(query));
  const cTokens = normalize(chunk);
  let score = 0;
  for (const t of cTokens) {
    if (qTokens.has(t)) score += 1;
  }
  // slight boost for phrase presence
  if (chunk.toLowerCase().includes(query.toLowerCase())) score += 5;
  return score;
}

async function answerQuestion({ question, localPath, remoteUrl, cacheKey }) {
  const fullText = await extractPdfText({ localPath, remoteUrl, cacheKey });
  if (!fullText) {
    return { answer: 'PDF text not available yet. Please try again later.', sources: [] };
  }
  const chunks = chunkText(fullText);
  let best = { score: -1, idx: -1 };
  for (let idx = 0; idx < chunks.length; idx++) {
    const s = scoreChunk(question, chunks[idx]);
    if (s > best.score) best = { score: s, idx };
  }
  const snippet = best.idx >= 0 ? chunks[best.idx].slice(0, 600) : '';
  const answer = best.score > 0
    ? `Here is a relevant passage from the book that may answer your question:\n\n${snippet}`
    : 'I could not find a highly relevant passage. Try rephrasing your question or adding keywords.';
  return { answer, sources: [{ type: 'pdf', snippet }] };
}

module.exports = {
  answerQuestion
};


