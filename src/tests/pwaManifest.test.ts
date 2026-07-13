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
});
