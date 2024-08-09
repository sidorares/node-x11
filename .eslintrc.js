module.exports = {
    "env": {
        "node": true,
        "commonjs": true,
        "es2021": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 12
    },
    "rules": {
        // Allow unused function arguments with names beginning in an
        // underscore, to document that is _could_ be used.
        "no-unused-vars": ['error', { argsIgnorePattern: '^_' } ],
    },
};
