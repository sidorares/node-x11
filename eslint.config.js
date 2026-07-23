// Minimal lint: enforce the post-2026-modernization invariants without
// imposing a full style guide on this legacy codebase.
module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'lib/keysyms.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
    },
    rules: {
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-redeclare': 'error',
    },
  },
];
