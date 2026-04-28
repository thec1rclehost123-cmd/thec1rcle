import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guestV1OpenApi } from './guest-v1';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../../openapi/guest-v1.json');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(guestV1OpenApi, null, 2)}\n`);

console.log(`Wrote ${outputPath}`);
