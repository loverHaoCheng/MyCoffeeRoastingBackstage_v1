import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('PWA manifest', () => {
  it('requests the manifest with credentials for Basic Auth protected environments', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain(
      '<link rel="manifest" href="./site.webmanifest" crossorigin="use-credentials" />',
    );
  });

  it('contains an entry-level loading shell before the React app mounts', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('id="app-boot-shell"');
    expect(html).toContain('正在打开 EasyBake...');
  });
});
