import React, { useCallback, useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useColorMode } from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { shareUrl } from '../../lib/share.mjs';
import styles from './styles.module.css';

const MAX_CONSOLE_LINES = 200;

/**
 * Hold off mounting the runner until the demo is near the viewport.
 *
 * On the playground that changes nothing — the only demo is on screen at
 * once — but a guide page carries several, and each runner is a whole X
 * server compositing to a canvas on a rAF loop. Booting them all on page
 * load would spend the reader's CPU on demos they may never scroll to.
 */
function useNearViewport(ref, { rootMargin = '300px' } = {}) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return undefined; // one-way: never unmount a running demo
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver !== 'function') {
      setNear(true); // no observer: fall back to eager, which is the old behaviour
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, ref, rootMargin]);

  return near;
}

// Code editor next to a live X session: the iframe hosts a JS X server
// rendered to a canvas (static/demo/runner.html); Run sends the editor
// contents over postMessage and the runner executes them against a fresh
// server, exactly like a node program talking to a real display.
export default function LiveDemoImpl({
  code,
  height = 420,
  screenWidth = 640,
  screenHeight = 480,
  autoRun = true,
  // `compact` stacks the editor under the screen and trims the chrome, for
  // demos sitting inside prose rather than on the playground.
  compact = false,
  // Where Share points. Guides share to the playground, which is the only
  // page that can host an arbitrary snippet.
  sharePath = '/playground',
}) {
  const { colorMode } = useColorMode();
  const runnerBase = useBaseUrl('/demo/runner.html');
  const runnerSrc = `${runnerBase}?width=${screenWidth}&height=${screenHeight}`;
  const playgroundPath = useBaseUrl(sharePath);

  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const codeRef = useRef(code);
  const consoleRef = useRef(null);
  const [editorCode, setEditorCode] = useState(code);
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(null);

  const live = useNearViewport(containerRef);

  const run = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame || !frame.contentWindow) return;
    setLines([]);
    frame.contentWindow.postMessage({ type: 'run-code', code: codeRef.current }, '*');
  }, []);

  useEffect(() => {
    const onMessage = (ev) => {
      const frame = iframeRef.current;
      if (!frame || ev.source !== frame.contentWindow) return;
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ready') {
        setReady(true);
        if (autoRun) run();
      } else if (msg.type === 'console') {
        setLines((prev) => [
          ...prev.slice(-(MAX_CONSOLE_LINES - 1)),
          { level: msg.level, text: msg.text },
        ]);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [autoRun, run]);

  useEffect(() => {
    // keep the console scrolled to the latest line
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onChange = useCallback((value) => {
    codeRef.current = value;
    setEditorCode(value);
    setShared(null); // the link no longer describes what is in the editor
  }, []);

  const onReset = useCallback(() => {
    codeRef.current = code;
    setEditorCode(code);
    setShared(null);
    run();
  }, [code, run]);

  const onShare = useCallback(async () => {
    try {
      const url = await shareUrl(codeRef.current, window.location, playgroundPath);
      // Writing the address bar only makes sense when we are already on the
      // page the link points at; from a guide it would rewrite the doc URL.
      if (window.location.pathname === playgroundPath)
        window.history.replaceState(null, '', url);
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        // clipboard blocked (no permission, or a non-secure origin) — the
        // link is still shown below, selectable by hand
      }
      setShared({ url, copied });
    } catch (err) {
      setShared({ error: err.message });
    }
  }, [playgroundPath]);

  return (
    <div
      className={compact ? `${styles.container} ${styles.compact}` : styles.container}
      ref={containerRef}
    >
      <div className={styles.editorPane}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className="button button--primary button--sm"
            disabled={!ready}
            onClick={run}>
            Run ▶
          </button>
          <button
            type="button"
            className="button button--secondary button--sm"
            disabled={!ready}
            onClick={onReset}>
            Reset
          </button>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={onShare}>
            Share 🔗
          </button>
          <span className={styles.hint}>
            {!live
              ? 'scroll into view to start'
              : ready
                ? 'runs in your browser — no X server needed'
                : 'starting X server…'}
          </span>
        </div>
        {shared && (
          <div className={shared.error ? styles.shareError : styles.shareOk}>
            {shared.error ? (
              `That snippet could not be turned into a link: ${shared.error}`
            ) : (
              <>
                {shared.copied
                  ? 'Link copied — it carries the whole snippet, there is no server storing it.'
                  : 'Copy this link — it carries the whole snippet, there is no server storing it.'}
                <input
                  className={styles.shareInput}
                  readOnly
                  value={shared.url}
                  onFocus={(e) => e.target.select()}
                />
              </>
            )}
          </div>
        )}
        <div className={styles.editor}>
          <CodeMirror
            value={editorCode}
            height={`${height}px`}
            theme={colorMode === 'dark' ? 'dark' : 'light'}
            extensions={[javascript()]}
            onChange={onChange}
            basicSetup={{ tabSize: 2 }}
          />
        </div>
        <div className={styles.console} ref={consoleRef}>
          {lines.length === 0 ? (
            <div className={styles.consoleEmpty}>console output</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={styles[`console_${line.level}`] || undefined}>
                {line.text}
              </div>
            ))
          )}
        </div>
      </div>
      <div className={styles.screenPane}>
        {live ? (
          <iframe
            ref={iframeRef}
            src={runnerSrc}
            className={styles.frame}
            style={{ aspectRatio: `${screenWidth} / ${screenHeight}` }}
            title="node-x11 live X session"
          />
        ) : (
          <div
            className={styles.framePlaceholder}
            style={{ aspectRatio: `${screenWidth} / ${screenHeight}` }}
          />
        )}
        <div className={styles.screenCaption}>
          {screenWidth}×{screenHeight} X screen — click it to give it focus,
          then interact with the pointer and keyboard
        </div>
      </div>
    </div>
  );
}
