// Browser stub for node's `fs`. Only lib/auth.js touches fs (reading
// ~/.Xauthority) and custom transports skip auth entirely; keep the shape
// callable so any stray call fails softly through the normal error path.
module.exports = {
    readFile(path, cb) {
        const err = new Error(`ENOENT: no file system in the browser (${path})`);
        err.code = 'ENOENT';
        if (typeof cb === 'function')
            queueMicrotask(() => cb(err));
    },
    readFileSync(path) {
        const err = new Error(`ENOENT: no file system in the browser (${path})`);
        err.code = 'ENOENT';
        throw err;
    },
    existsSync() {
        return false;
    }
};
