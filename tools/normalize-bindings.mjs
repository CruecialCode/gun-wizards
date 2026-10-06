import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
function normalize(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) normalize(path);
    else if (path.endsWith('.ts')) writeFileSync(path, readFileSync(path, 'utf8').trimEnd() + '\n');
  }
}
normalize('src/module_bindings');
