import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) })
export default [
  { ignores: ['.next/**', 'node_modules/**', 'design-system/**', 'baoflow/**', '**/_legacy_pages/**', '**/_archive*/**', '**/_unused*/**'] },
  ...compat.extends('next/core-web-vitals'),
]
