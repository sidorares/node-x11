// Shareable playground links: the whole snippet travels in the query
// string, so there is nothing to store and nothing to expire. A link is
// self-contained — paste it anywhere and it still works in a year.
//
// The payload is `?code=<scheme><base64url>`, where the leading byte says
// how the rest was packed:
//   d — raw DEFLATE (CompressionStream), which is what every current
//       browser and node >= 18 takes; a 2.5 KB demo comes out near 900
//       characters
//   p — plain UTF-8, the fallback when CompressionStream is missing
//
// base64url (`-` and `_`, no padding) keeps the value legal in a URL
// without percent-encoding, which is what makes these links survive being
// pasted into chat clients and issue trackers.

const SCHEME_DEFLATE = 'd';
const SCHEME_PLAIN = 'p';

/** Refuse to build or accept absurd links rather than hanging the tab. */
export const MAX_SHARE_BYTES = 64 * 1024;

function toBase64Url(bytes) {
  // chunked: String.fromCharCode.apply blows the argument limit on big arrays
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const hasCompression =
  typeof CompressionStream === 'function' &&
  typeof DecompressionStream === 'function';

async function through(bytes, stream) {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

/** Source → the value for the `code` query parameter. */
export async function encodeShare(source) {
  const bytes = new TextEncoder().encode(source);
  if (bytes.length > MAX_SHARE_BYTES)
    throw new Error(
      `snippet is ${bytes.length} bytes, over the ${MAX_SHARE_BYTES} byte limit for a link`,
    );
  if (!hasCompression) return SCHEME_PLAIN + toBase64Url(bytes);
  const packed = await through(bytes, new CompressionStream('deflate-raw'));
  return SCHEME_DEFLATE + toBase64Url(packed);
}

/**
 * The `code` query parameter → source. Throws on anything malformed; the
 * caller is expected to fall back to a built-in demo and say so, since this
 * input arrives from a stranger's URL.
 */
export async function decodeShare(param) {
  if (typeof param !== 'string' || param.length < 2)
    throw new Error('empty shared snippet');
  const scheme = param[0];
  const bytes = fromBase64Url(param.slice(1));
  if (scheme === SCHEME_PLAIN) {
    if (bytes.length > MAX_SHARE_BYTES)
      throw new Error('shared snippet too large');
    return new TextDecoder().decode(bytes);
  }
  if (scheme !== SCHEME_DEFLATE)
    throw new Error(`unknown share format "${scheme}"`);
  if (!hasCompression)
    throw new Error('this browser cannot read compressed shared snippets');
  const raw = await through(bytes, new DecompressionStream('deflate-raw'));
  if (raw.length > MAX_SHARE_BYTES) throw new Error('shared snippet too large');
  return new TextDecoder().decode(raw);
}

/**
 * Absolute URL carrying `source`. A demo embedded in a guide shares to the
 * playground rather than to the page it sits on — a docs page renders fixed
 * prose and cannot host someone else's snippet — so the caller passes the
 * playground's path and we keep only the origin from `location`.
 */
export async function shareUrl(source, location, playgroundPath) {
  const code = await encodeShare(source);
  const path = playgroundPath || location.pathname;
  return `${location.origin}${path}?code=${code}`;
}
