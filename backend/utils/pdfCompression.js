const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Try to locate Ghostscript executable on different platforms
function getGhostscriptCommand() {
  const envCmd = process.env.GHOSTSCRIPT_CMD;
  if (envCmd) return envCmd;

  const candidates = process.platform === 'win32'
    ? ['gswin64c', 'gswin32c', 'gs']
    : ['gs'];

  for (const cmd of candidates) {
    // naive check: let spawn fail fast later; just return first candidate
    return cmd;
  }
  return 'gs';
}

/**
 * Compress a PDF using Ghostscript. Returns the output file path.
 * If compression fails, the function throws. Callers may catch and fallback to original.
 * @param {string} inputPath
 * @param {string} quality - one of: screen, ebook, printer, prepress, default
 * @returns {Promise<string>}
 */
function compressPdf(inputPath, quality = 'ebook') {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(inputPath)) {
        return reject(new Error('Input PDF not found'));
      }

      const dir = path.dirname(inputPath);
      const base = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(dir, `${base}.compressed.pdf`);

      const gsCmd = getGhostscriptCommand();
      const args = [
        '-sDEVICE=pdfwrite',
        `-dPDFSETTINGS=/${quality}`,
        '-dCompatibilityLevel=1.4',
        '-dDetectDuplicateImages=true',
        '-dDownsampleColorImages=true',
        '-dColorImageResolution=120',
        '-dDownsampleGrayImages=true',
        '-dGrayImageResolution=120',
        '-dDownsampleMonoImages=true',
        '-dMonoImageResolution=120',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath
      ];

      const proc = spawn(gsCmd, args, { stdio: 'ignore' });

      proc.on('error', (err) => {
        reject(err);
      });

      proc.on('exit', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`Ghostscript exited with code ${code}`));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  compressPdf
};


