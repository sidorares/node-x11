import React, { useEffect, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import clsx from 'clsx';
import demos from '../demos';
import LiveDemo from '../components/LiveDemo';
import { decodeShare } from '../lib/share.mjs';
import styles from './playground.module.css';

const SHARED_ID = '__shared__';

/**
 * A snippet that arrived in the URL. Decoding is asynchronous (the payload
 * is DEFLATE), and the query is read exactly once — pressing Share rewrites
 * the address bar, and re-reading it then would throw away whatever the
 * reader had since typed.
 */
function useSharedSnippet() {
  const [shared, setShared] = useState(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return undefined;
    done.current = true;
    const param = new URLSearchParams(window.location.search).get('code');
    if (!param) return undefined;

    let live = true;
    decodeShare(param).then(
      (code) => live && setShared({ code }),
      (err) => live && setShared({ error: err.message }),
    );
    return () => {
      live = false;
    };
  }, []);

  return shared;
}

export default function Playground() {
  const shared = useSharedSnippet();
  const [selectedId, setSelectedId] = useState(null);

  // A decoded link selects itself, unless the reader has already clicked
  // something else.
  useEffect(() => {
    if (shared?.code) setSelectedId((current) => current ?? SHARED_ID);
  }, [shared]);

  const sharedDemo = shared?.code && {
    id: SHARED_ID,
    title: 'Shared snippet',
    description: 'This code came from a link rather than from this site.',
    code: shared.code,
  };

  const items = sharedDemo ? [sharedDemo, ...demos] : demos;
  const demo = items.find((d) => d.id === selectedId) || items[0];
  const isShared = demo.id === SHARED_ID;

  return (
    <Layout
      title="Playground"
      description="Live in-browser node-x11 demos: edit real node-x11 client code and run it against a JavaScript X server rendering right on this page.">
      <main className="container margin-vert--lg">
        <Heading as="h1">Playground</Heading>
        <p className={styles.intro}>
          Everything on this page runs in your browser: the panel on the right
          is a real X session served by the pure-JavaScript X server that ships
          with this repository, composited to a canvas. The editor holds
          ordinary node-x11 client code — the same code you would run in node
          against a real display — connected through a custom{' '}
          <code>DISPLAY</code> transport (<code>demo/local:0</code>). Edit it
          and press Run, or press <strong>Share</strong> for a link that carries
          the whole snippet in its query string — there is no server storing any
          of this.
        </p>
        <div className={styles.perfNote}>
          <strong>This is the slow way to run an X server.</strong> Everything
          here is emulation: the server is JavaScript, rasterizing into a canvas
          on the same main thread as the editor, and input reaches it by{' '}
          <code>postMessage</code> across an iframe boundary. On a desktop your
          client talks over a unix socket to a real X server — C, usually
          GPU-accelerated — which does the compositing and glyph drawing itself.
          Judge the protocol here; judge the performance there.
        </div>
        {shared?.error && (
          <div className={styles.shareError}>
            That shared link could not be read ({shared.error}), so here are the
            built-in demos instead.
          </div>
        )}
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <ul className={styles.demoList}>
              {items.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={clsx(
                      styles.demoButton,
                      d.id === demo.id && styles.demoButtonActive,
                      d.id === SHARED_ID && styles.demoButtonShared,
                    )}
                    onClick={() => setSelectedId(d.id)}>
                    {d.title}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className={styles.main}>
            <Heading as="h2" className={styles.demoTitle}>
              {demo.title}
            </Heading>
            <p className={styles.demoDescription}>{demo.description}</p>
            {isShared && (
              <div className={styles.sharedNote}>
                <strong>This snippet came from a link.</strong> It is ordinary
                JavaScript and it will run in this page, so read it before you
                press Run — which is why, unlike the built-in demos, it has not
                started on its own.
              </div>
            )}
            <LiveDemo
              key={demo.id}
              code={demo.code}
              height={demo.height}
              screenWidth={demo.screenWidth}
              screenHeight={demo.screenHeight}
              autoRun={!isShared}
            />
          </div>
        </div>
      </main>
    </Layout>
  );
}
