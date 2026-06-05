import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
      'repomix-output.xml',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/components/ui/chart.tsx', 'src/components/ui/resizable.tsx'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];

export default eslintConfig;
