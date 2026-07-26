// Sync the repo's hand-written API reference (docs/) into the website's
// docs/reference/ directory, which is gitignored and regenerated on every
// build (`prebuild`) and on `npm start`.
//
// For each source file this script:
//   - adds Docusaurus front matter (title from the first `# heading`,
//     sidebar_position, and a custom_edit_url pointing at the real source
//     file in the repo, since the synced copy is not committed);
//   - rewrites links to README.md -> index.md (the file is renamed so that
//     Docusaurus serves it as /docs/reference);
//   - keeps the .md extension so Docusaurus (with `markdown.format:
//     'detect'`) parses the files as CommonMark, not MDX — the reference
//     contains angle-bracket placeholders and brace literals that are not
//     valid MDX.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoDir = path.dirname(websiteDir);
const srcDir = path.join(repoDir, 'docs');
const outDir = path.join(websiteDir, 'docs', 'reference');

const EDIT_BASE = 'https://github.com/sidorares/node-x11/tree/master/docs/';

/** Extract the first `# Heading` as the page title. */
function extractTitle(markdown, fallback) {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

const REPO_BASE = 'https://github.com/sidorares/node-x11/tree/master/';

/**
 * Rewrite cross-links for the new layout.
 *   - README.md becomes index.md (renamed so Docusaurus serves it as
 *     /docs/reference); links to it are renamed too. Other *.md files keep
 *     their relative position and Docusaurus resolves the links natively.
 *   - Relative links to repo source files (../../lib/ext/glx.js,
 *     ../test/render.js, …) make sense on GitHub but not on the website;
 *     resolve them against the source file's repo location and point them
 *     at GitHub.
 * `srcRel` is the source file's path relative to the repo's docs/ dir.
 */
function rewriteLinks(markdown, srcRel) {
  const srcDirRel = path.posix.join(
    'docs',
    path.dirname(srcRel.split(path.sep).join('/'))
  );
  return markdown.replace(/\]\(([^()\s]+)\)/g, (all, target) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) return all; // absolute/anchor
    const [file, anchor = ''] = target.split(/(?=#)/);
    if (file.endsWith('.md')) {
      // keep relative; only the README.md -> index.md rename applies
      return `](${file.replace(/README\.md$/, 'index.md')}${anchor})`;
    }
    const repoPath = path.posix.normalize(path.posix.join(srcDirRel, file));
    return `](${REPO_BASE}${repoPath}${anchor})`;
  });
}

/**
 * Guard against constructs that CommonMark would pass through as raw HTML:
 * angle-bracket placeholders like <wid> outside code spans/fences. The
 * current reference has none, but new ones must not silently disappear from
 * the rendered page, so wrap them in backticks.
 */
function sanitize(markdown) {
  const lines = markdown.split('\n');
  let inFence = false;
  const out = lines.map(line => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    // Split on code spans; only touch text outside them.
    return line
      .split(/(`+[^`]*`+)/)
      .map((part, i) => {
        if (i % 2 === 1) return part; // inside a code span
        // <placeholder> that is not a real HTML tag or an autolink
        return part.replace(
          /<(?!\/?(?:a|b|i|em|strong|code|pre|br|hr|img|sub|sup|table|thead|tbody|tr|td|th|ul|ol|li|p|div|span|details|summary|kbd)\b)(?!https?:)([A-Za-z_][\w.-]*)>/g,
          '`<$1>`'
        );
      })
      .join('');
  });
  return out.join('\n');
}

function frontMatter(fields) {
  const body = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) =>
      typeof v === 'string' ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`
    )
    .join('\n');
  return `---\n${body}\n---\n\n`;
}

function syncFile(srcRel, outRel, { title, sidebarPosition, slug, sidebarLabel }) {
  const srcPath = path.join(srcDir, srcRel);
  const outPath = path.join(outDir, outRel);
  let markdown = fs.readFileSync(srcPath, 'utf8');
  markdown = sanitize(rewriteLinks(markdown, srcRel));
  const fm = frontMatter({
    title: title ?? extractTitle(markdown, path.basename(srcRel, '.md')),
    sidebar_label: sidebarLabel,
    sidebar_position: sidebarPosition,
    slug,
    custom_edit_url: EDIT_BASE + srcRel.split(path.sep).join('/'),
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, fm + markdown);
}

// Regenerate from scratch so deletions in docs/ propagate.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

syncFile('README.md', 'index.md', {
  title: 'Overview',
  sidebarPosition: 1,
  slug: '/reference',
});
syncFile('core-requests.md', 'core-requests.md', { sidebarPosition: 2 });
syncFile('core-events.md', 'core-events.md', { sidebarPosition: 3 });

// One page per extension, alphabetical.
const extFiles = fs
  .readdirSync(path.join(srcDir, 'ext'))
  .filter(f => f.endsWith('.md'))
  .sort();
extFiles.forEach((file, i) => {
  syncFile(path.join('ext', file), path.join('ext', file), {
    sidebarPosition: i + 1,
  });
});
fs.writeFileSync(
  path.join(outDir, 'ext', '_category_.json'),
  JSON.stringify({ label: 'Extensions', position: 4, collapsed: true }, null, 2) + '\n'
);

console.log(
  `sync-docs: wrote ${3 + extFiles.length} reference pages to ${path.relative(
    websiteDir,
    outDir
  )}`
);
