import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const cwd = process.cwd();
const assetsDir = join(cwd, 'dist', 'assets');
const reportDir = join(cwd, 'dist', 'perf');

const WARN_TOP_JS_GZIP_KB = Number(process.env.BUNDLE_WARN_TOP_JS_GZIP_KB || 120);
const WARN_TOTAL_JS_GZIP_KB = Number(process.env.BUNDLE_WARN_TOTAL_JS_GZIP_KB || 1000);
const WARN_TOTAL_CSS_GZIP_KB = Number(process.env.BUNDLE_WARN_TOTAL_CSS_GZIP_KB || 80);

function listFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function gzipBytes(filePath) {
  const raw = readFileSync(filePath);
  return gzipSync(raw, { level: 9 }).byteLength;
}

function kb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

function rowFor(filePath) {
  const gz = gzipBytes(filePath);
  return {
    file: relative(cwd, filePath).replaceAll('\\\\', '/'),
    gzipBytes: gz,
    gzipKb: kb(gz),
  };
}

function toMarkdown(report) {
  const topJsRows = report.topJs
    .map((item) => `| ${item.file} | ${item.gzipKb} |`)
    .join('\n');
  const topCssRows = report.topCss
    .map((item) => `| ${item.file} | ${item.gzipKb} |`)
    .join('\n');

  const warningRows = report.warnings.length
    ? report.warnings.map((w) => `- ${w}`).join('\n')
    : '- No warnings';

  return [
    '# Bundle Analysis Report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Totals (gzip KB)',
    `- Total JS: ${report.totals.jsGzipKb}`,
    `- Total CSS: ${report.totals.cssGzipKb}`,
    '',
    '## Top JS Chunks',
    '| File | Gzip KB |',
    '|---|---:|',
    topJsRows || '| (none) | 0 |',
    '',
    '## Top CSS Chunks',
    '| File | Gzip KB |',
    '|---|---:|',
    topCssRows || '| (none) | 0 |',
    '',
    '## Warnings',
    warningRows,
    '',
  ].join('\n');
}

function main() {
  try {
    if (!statSync(assetsDir).isDirectory()) {
      console.error('[bundle-analyze] dist/assets not found. Run build first.');
      process.exit(1);
    }
  } catch {
    console.error('[bundle-analyze] dist/assets not found. Run build first.');
    process.exit(1);
  }

  const files = listFiles(assetsDir);
  const js = files.filter((f) => f.endsWith('.js')).map(rowFor).sort((a, b) => b.gzipBytes - a.gzipBytes);
  const css = files.filter((f) => f.endsWith('.css')).map(rowFor).sort((a, b) => b.gzipBytes - a.gzipBytes);

  const totalJs = js.reduce((sum, f) => sum + f.gzipBytes, 0);
  const totalCss = css.reduce((sum, f) => sum + f.gzipBytes, 0);
  const topJs = js.slice(0, 10);
  const topCss = css.slice(0, 5);

  const warnings = [];
  if (topJs[0] && topJs[0].gzipKb > WARN_TOP_JS_GZIP_KB) {
    warnings.push(`Largest JS chunk is ${topJs[0].gzipKb} KB (warn threshold ${WARN_TOP_JS_GZIP_KB} KB): ${topJs[0].file}`);
  }
  if (kb(totalJs) > WARN_TOTAL_JS_GZIP_KB) {
    warnings.push(`Total JS gzip is ${kb(totalJs)} KB (warn threshold ${WARN_TOTAL_JS_GZIP_KB} KB)`);
  }
  if (kb(totalCss) > WARN_TOTAL_CSS_GZIP_KB) {
    warnings.push(`Total CSS gzip is ${kb(totalCss)} KB (warn threshold ${WARN_TOTAL_CSS_GZIP_KB} KB)`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      jsGzipKb: kb(totalJs),
      cssGzipKb: kb(totalCss),
    },
    thresholds: {
      warnTopJsGzipKb: WARN_TOP_JS_GZIP_KB,
      warnTotalJsGzipKb: WARN_TOTAL_JS_GZIP_KB,
      warnTotalCssGzipKb: WARN_TOTAL_CSS_GZIP_KB,
    },
    topJs,
    topCss,
    warnings,
  };

  mkdirSync(reportDir, { recursive: true });
  const jsonOut = join(reportDir, 'bundle-report.json');
  const mdOut = join(reportDir, 'bundle-report.md');

  writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(mdOut, toMarkdown(report), 'utf8');

  console.log(`[bundle-analyze] report: ${relative(cwd, jsonOut).replaceAll('\\\\', '/')}`);
  console.log(`[bundle-analyze] report: ${relative(cwd, mdOut).replaceAll('\\\\', '/')}`);

  if (warnings.length) {
    console.log('[bundle-analyze] warnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  } else {
    console.log('[bundle-analyze] warnings: none');
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    writeFileSync(summaryPath, `${toMarkdown(report)}\n`, { encoding: 'utf8', flag: 'a' });
  }
}

main();
