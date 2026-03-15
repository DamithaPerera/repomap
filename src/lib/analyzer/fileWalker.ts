import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  'coverage', '.cache', 'vendor', '__pycache__', '.venv', 'venv',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
]);

export interface FileEntry {
  filePath: string;
  relativePath: string;
  content: string;
}

export function walkFiles(rootDir: string): FileEntry[] {
  const results: FileEntry[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue;

      const fullPath = path.join(dir, entry);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          results.push({
            filePath: fullPath,
            relativePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
            content,
          });
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  walk(rootDir);
  return results;
}
