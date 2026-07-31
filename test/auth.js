// Xauthority cookie selection. No X server involved: everything here happens
// before the connection is made, which is exactly why getting it wrong is so
// hard to diagnose from the outside.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const getAuthString = require('../lib/auth');

/** One Xauthority entry in its on-disk form: family, then four length-prefixed fields. */
function entry(family, address, display, authName, authData) {
    const parts = [Buffer.from([family >> 8, family & 0xff])];
    for (const field of [address, display, authName, authData]) {
        const b = Buffer.isBuffer(field) ? field : Buffer.from(field, 'latin1');
        parts.push(Buffer.from([b.length >> 8, b.length & 0xff]), b);
    }
    return Buffer.concat(parts);
}

const KEY = Buffer.alloc(16, 0xab);
const FAMILY_WILD = 65535;
const FAMILY_LOCAL = 256;
const FAMILY_INTERNET = 0;

describe('Xauthority', () => {
    let home;
    let savedEnv;
    let warnings;
    let originalWarn;

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'x11-auth-'));
        savedEnv = { HOME: process.env.HOME, XAUTHORITY: process.env.XAUTHORITY };
        // os.homedir() honours $HOME on POSIX, which is how the no-XAUTHORITY
        // path gets pointed at the fixture
        process.env.HOME = home;
        delete process.env.XAUTHORITY;
        warnings = [];
        originalWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
    });

    afterEach(() => {
        console.warn = originalWarn;
        for (const [k, v] of Object.entries(savedEnv)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        fs.rmSync(home, { recursive: true, force: true });
    });

    /** Write `buf` to a file under the fixture home and point XAUTHORITY at it. */
    const useAuthFile = (buf, name = 'authfile') => {
        const file = path.join(home, name);
        fs.writeFileSync(file, buf);
        process.env.XAUTHORITY = file;
        return file;
    };

    const lookup = (display = '0', host = 'myhost', family = 'pipe') =>
        new Promise((resolve, reject) =>
            getAuthString(display, host, family, (err, cookie) =>
                err ? reject(err) : resolve(cookie)));

    it('selects a FamilyWild cookie for any address', async () => {
        // the bug: matching tested cookie.family, which parseXauth never sets,
        // so this entry could never be chosen and the connection went out with
        // no authentication at all
        useAuthFile(entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('0', 'some-host-we-have-never-heard-of');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
        assert.strictEqual(cookie.authData, KEY.toString('latin1'));
        assert.deepStrictEqual(warnings, []);
    });

    it('still selects an exact local match', async () => {
        useAuthFile(entry(FAMILY_LOCAL, 'myhost', '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('0', 'myhost', 'pipe');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
    });

    it('matches an IPv4 entry by its dotted address', async () => {
        useAuthFile(entry(FAMILY_INTERNET, Buffer.from([10, 0, 0, 5]), '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('0', '10.0.0.5', 'IPv4');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
    });

    it('prefers an earlier exact entry over a later wildcard', async () => {
        const exact = Buffer.alloc(16, 0x11);
        useAuthFile(Buffer.concat([
            entry(FAMILY_LOCAL, 'myhost', '0', 'MIT-MAGIC-COOKIE-1', exact),
            entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY)
        ]));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authData, exact.toString('latin1'), 'file order decides');
    });

    it('an empty display field in the entry matches any display', async () => {
        useAuthFile(entry(FAMILY_WILD, '', '', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('7', 'myhost');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
    });

    it('a different display does not match', async () => {
        useAuthFile(entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('1', 'myhost');
        assert.strictEqual(cookie.authName, '', 'wildcard is over the address, not the display');
    });

    it('says which file it read and what was in it when nothing matches', async () => {
        // the silent half of the bug: without this the only symptom is the
        // server's generic "Authorization required", identical to having no
        // Xauthority file at all
        const file = useAuthFile(entry(FAMILY_LOCAL, 'otherhost', '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, '');
        assert.strictEqual(warnings.length, 1);
        const said = warnings[0];
        assert.ok(said.includes(file), 'names the file it read');
        assert.ok(said.includes('"myhost"'), 'names what it was looking for');
        assert.ok(said.includes('"otherhost"'), 'names what it found instead');
        assert.ok(!said.includes(KEY.toString('latin1')), 'never prints the key itself');
    });

    it('stays quiet when there is no Xauthority file at all', async () => {
        // the ordinary state on a server that accepts unauthenticated clients
        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, '');
        assert.deepStrictEqual(warnings, [], 'nothing was misconfigured, so nothing to say');
    });

    it('reads the dotless Xming file when ~/.Xauthority is absent', async () => {
        // this fallback used to throw TypeError from inside the fs callback
        // whenever it found the file, so it had never once worked
        fs.writeFileSync(path.join(home, 'Xauthority'),
            entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
        assert.strictEqual(cookie.authData, KEY.toString('latin1'));
    });

    it('prefers ~/.Xauthority when both spellings exist', async () => {
        const dotted = Buffer.alloc(16, 0x22);
        fs.writeFileSync(path.join(home, '.Xauthority'),
            entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', dotted));
        fs.writeFileSync(path.join(home, 'Xauthority'),
            entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authData, dotted.toString('latin1'));
    });

    it('does not fall back to a home-directory guess when XAUTHORITY is set', async () => {
        // an explicit path that is missing is the user's typo to see, not
        // something to paper over with a cookie from somewhere else
        fs.writeFileSync(path.join(home, '.Xauthority'),
            entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY));
        process.env.XAUTHORITY = path.join(home, 'does-not-exist');

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, '');
        assert.deepStrictEqual(warnings, [], 'no file read, so nothing to report about its contents');
    });

    it('keeps the entries before a truncation instead of throwing', async () => {
        const good = entry(FAMILY_LOCAL, 'myhost', '0', 'MIT-MAGIC-COOKIE-1', KEY);
        const cut = entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY).subarray(0, 9);
        useAuthFile(Buffer.concat([good, cut]));

        // reading past the end used to be a RangeError raised inside an fs
        // callback, which no caller could catch
        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
        assert.ok(
            warnings.some(w => w.includes('ends in the middle of an entry')),
            'and it says the file is damaged');
    });

    it('survives an entry cut off inside its address', async () => {
        // the nastier truncation: the length prefix says four bytes of IPv4
        // address and the file ends after two. Reading them back gives
        // undefined, and the dotted-quad conversion then threw TypeError from
        // inside the fs callback.
        const good = entry(FAMILY_LOCAL, 'myhost', '0', 'MIT-MAGIC-COOKIE-1', KEY);
        const cut = entry(FAMILY_INTERNET, Buffer.from([10, 0, 0, 5]), '0', 'MIT-MAGIC-COOKIE-1', KEY)
            .subarray(0, 6);
        useAuthFile(Buffer.concat([good, cut]));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1');
        assert.ok(warnings.some(w => w.includes('ends in the middle of an entry')));
    });

    it('an empty file is treated as no file', async () => {
        useAuthFile(Buffer.alloc(0));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, '');
        assert.deepStrictEqual(warnings, []);
    });

    it('reports an unknown address family without refusing the file', async () => {
        useAuthFile(Buffer.concat([
            entry(1234, 'weird', '0', 'MIT-MAGIC-COOKIE-1', KEY),
            entry(FAMILY_WILD, '', '0', 'MIT-MAGIC-COOKIE-1', KEY)
        ]));

        const cookie = await lookup('0', 'myhost');
        assert.strictEqual(cookie.authName, 'MIT-MAGIC-COOKIE-1', 'the usable entry still wins');
        assert.ok(warnings.some(w => w.includes('unknown address family 1234')));
    });
});
