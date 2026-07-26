// Minimal lint: enforce the post-2026-modernization invariants without
// imposing a full style guide on this legacy codebase.
module.exports = [
  // global ignores (must be a standalone entry to apply to every config):
  // website/ is its own project (ESM/JSX, built assets) — repo lint skips it
  { ignores: ['node_modules/**', 'lib/keysyms.js', 'website/**'] },
  {
    files: ['**/*.js'],
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
