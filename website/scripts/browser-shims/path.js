// Browser stub for node's `path` (posix-only, just what lib/auth.js uses).
module.exports = {
    join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
};
