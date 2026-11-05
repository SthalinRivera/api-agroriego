import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('PDF sin fuentes externas de PDFKit', () => {
  it('genera fichas aunque Helvetica.cjs y los archivos de fuentes no existan', () => {
    const script = `
      const Module = require('module');
      const originalLoad = Module._load;
      Module._load = function(id, ...args) {
        if (/standard-fonts/.test(String(id))) {
          const error = new Error("Cannot find module 'pdfkit/js/standard-fonts/Helvetica.cjs'");
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        }
        return originalLoad.call(this, id, ...args);
      };
      const fs = require('fs');
      const originalRead = fs.readFileSync;
      fs.readFileSync = function(file, ...args) {
        if (/\\.(ttf|otf|afm)$/i.test(String(file))) throw new Error('External font file unavailable');
        return originalRead.call(this, file, ...args);
      };
      const { writePdf } = require(process.argv[1]);
      const { sampleSnapshot } = require(process.argv[2]);
      const { PassThrough } = require('stream');
      (async () => {
        const tables = [{ id: '1', title: 'Humedad y temperatura', description: 'Evaluación R² y calibración', columns: [{ key: 'valor', label: 'Temperatura (°C)' }], rows: [{ valor: 0 }], notes: ['Sin datos adicionales.'] }];
        for (const selected of [undefined, tables]) {
          const stream = new PassThrough(), chunks = [];
          stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
          await writePdf(sampleSnapshot(), stream, selected);
          const bytes = Buffer.concat(chunks);
          if (bytes.subarray(0, 5).toString() !== '%PDF-' || !/%%EOF\\s*$/.test(bytes.toString('latin1'))) throw new Error('Incomplete PDF');
        }
        console.log('PDF_OK');
      })().catch(error => { console.error(error.stack); process.exitCode = 1; });
    `;
    const output = execFileSync(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        '-e',
        script,
        resolve(__dirname, 'fichas.export.ts'),
        resolve(__dirname, '../../../test/fixtures/ficha.ts'),
      ],
      { cwd: resolve(__dirname, '../../..'), timeout: 30000, encoding: 'utf8' },
    );
    expect(output).toContain('PDF_OK');
  });
});
