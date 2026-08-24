import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class AtomicJsonStore {
  constructor(filePath) { this.filePath = filePath; }
  read() {
    try {
      const document = JSON.parse(readFileSync(this.filePath, 'utf8'));
      return { plans: Array.isArray(document.plans) ? document.plans : [] };
    } catch (error) {
      if (error.code === 'ENOENT') return { plans: [] };
      throw error;
    }
  }
  write(document) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(document, null, 2));
    renameSync(temporaryPath, this.filePath);
  }
}
