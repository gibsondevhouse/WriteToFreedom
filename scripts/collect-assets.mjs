import {readdir, readFile} from 'node:fs/promises';
import {extname, join} from 'node:path';

const textTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const binaryTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};

/** Collect public bytes; dotfiles (including Vite's manifest) remain build-only. */
export async function collectAssets(directory, prefix = '') {
  const assets = {};
  async function walk(relative = '') {
    for (const entry of await readdir(join(directory, relative), {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const next = relative + '/' + entry.name;
      if (entry.isDirectory()) { await walk(next); continue; }
      const bytes = await readFile(join(directory, next));
      const extension = extname(entry.name).toLowerCase();
      assets[prefix + next] = textTypes[extension]
        ? {content: bytes.toString('utf8'), type: textTypes[extension]}
        : {content: bytes.toString('base64'), type: binaryTypes[extension] || 'application/octet-stream', encoding: 'base64'};
    }
  }
  await walk();
  return assets;
}
