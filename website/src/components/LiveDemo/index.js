import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { byId } from '../../demos';
import styles from './styles.module.css';

/**
 * A live X session with an editor beside it.
 *
 * Pass `code` directly, or `demo="hello-window"` to pull one of the demos in
 * `src/demos`. Referencing by id is what keeps a guide honest: the same
 * string runs on the playground and is checked in CI by
 * `scripts/check-demos.mjs`, so a snippet in the prose cannot quietly rot
 * while the API moves under it.
 */
export default function LiveDemo({ demo, code, ...rest }) {
  const source = demo ? byId[demo] : null;

  if (demo && !source) {
    // A typo'd id must be loud at build time rather than rendering an empty
    // editor that nobody notices.
    throw new Error(
      `<LiveDemo demo="${demo}"> — no such demo in src/demos (have: ${Object.keys(byId).join(', ')})`,
    );
  }

  const props = source
    ? {
        code: source.code,
        screenWidth: source.screenWidth,
        screenHeight: source.screenHeight,
        height: source.height,
        ...rest,
      }
    : { code, ...rest };

  // Undefined props would clobber the impl's own defaults.
  for (const key of Object.keys(props))
    if (props[key] === undefined) delete props[key];

  return (
    <BrowserOnly
      fallback={<div className={styles.fallback}>Loading live demo…</div>}>
      {() => {
        const Impl = require('./impl').default;
        return <Impl {...props} />;
      }}
    </BrowserOnly>
  );
}
