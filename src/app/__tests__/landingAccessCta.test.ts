// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('landing access CTA', () => {
  it('routes every primary onboarding CTA through the early-access promise', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/page.tsx'),
      'utf8'
    );

    expect(source.match(/Request early access/g)).toHaveLength(3);
    expect(source).not.toMatch(/Start free/i);
  });
});
