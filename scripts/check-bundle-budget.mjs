import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const distAssetsDir = join(process.cwd(), 'dist', 'assets');

const JS_GZIP_BUDGET_KB = Number(process.env.BUNDLE_JS_GZIP_BUDGET_KB || 1100);
const CSS_GZIP_BUDGET_KB = Number(process.env.BUNDLE_CSS_GZIP_BUDGET_KB || 80);
const ENTRY_JS_GZIP_BUDGET_KB = Number(process.env.BUNDLE_ENTRY_JS_GZIP_BUDGET_KB || 180);

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

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

function getGzipSizeBytes(filePath) {
  const raw = readFileSync(filePath);
  return gzipSync(raw, { level: 9 }).byteLength;
}

function collect() {
  const files = listFiles(distAssetsDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const cssFiles = files.filter((f) => f.endsWith('.css'));

  const jsWithSizes = jsFiles.map((file) => ({ file, gzipBytes: getGzipSizeBytes(file) }));
  const cssWithSizes = cssFiles.map((file) => ({ file, gzipBytes: getGzipSizeBytes(file) }));

  jsWithSizes.sort((a, b) => b.gzipBytes - a.gzipBytes);
  cssWithSizes.sort((a, b) => b.gzipBytes - a.gzipBytes);

  const totalJsGzip = jsWithSizes.reduce((sum, item) => sum + item.gzipBytes, 0);
  const totalCssGzip = cssWithSizes.reduce((sum, item) => sum + item.gzipBytes, 0);
  const entryJs = jsWithSizes[0]?.gzipBytes || 0;

  return {
    jsWithSizes,
    cssWithSizes,
    totalJsGzip,
    totalCssGzip,
    entryJs,
  };
}

function fail(message) {
  console.error(`\n[bundle-budget] FAIL: ${message}`);
  process.exit(1);
}

function main() {
  try {
    if (!statSync(distAssetsDir).isDirectory()) {
      fail(`Missing build output at ${distAssetsDir}. Run npm run build first.`);
    }
  } catch {
    fail(`Missing build output at ${distAssetsDir}. Run npm run build first.`);
  }

  const { jsWithSizes, cssWithSizes, totalJsGzip, totalCssGzip, entryJs } = collect();

  console.log('\n[bundle-budget] Top JS chunks (gzip KB)');
  jsWithSizes.slice(0, 8).forEach((item) => {
    console.log(`- ${item.file.replace(process.cwd(), '.')} => ${formatKb(item.gzipBytes)} KB`);
  });

  console.log('\n[bundle-budget] Top CSS chunks (gzip KB)');
  cssWithSizes.slice(0, 5).forEach((item) => {
    console.log(`- ${item.file.replace(process.cwd(), '.')} => ${formatKb(item.gzipBytes)} KB`);
  });

  console.log('\n[bundle-budget] Totals (gzip KB)');
  console.log(`- Total JS: ${formatKb(totalJsGzip)} KB (budget ${JS_GZIP_BUDGET_KB} KB)`);
  console.log(`- Entry JS: ${formatKb(entryJs)} KB (budget ${ENTRY_JS_GZIP_BUDGET_KB} KB)`);
  console.log(`- Total CSS: ${formatKb(totalCssGzip)} KB (budget ${CSS_GZIP_BUDGET_KB} KB)`);

  if (totalJsGzip > JS_GZIP_BUDGET_KB * 1024) {
    fail(`Total JS gzip size exceeded budget (${formatKb(totalJsGzip)} KB > ${JS_GZIP_BUDGET_KB} KB)`);
  }

  if (entryJs > ENTRY_JS_GZIP_BUDGET_KB * 1024) {
    fail(`Largest JS chunk exceeded budget (${formatKb(entryJs)} KB > ${ENTRY_JS_GZIP_BUDGET_KB} KB)`);
  }

  if (totalCssGzip > CSS_GZIP_BUDGET_KB * 1024) {
    fail(`Total CSS gzip size exceeded budget (${formatKb(totalCssGzip)} KB > ${CSS_GZIP_BUDGET_KB} KB)`);
  }

  console.log('\n[bundle-budget] PASS');
}

main();
