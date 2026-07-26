import React, { useCallback, useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useColorMode } from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const MAX_CONSOLE_LINES = 200;

// Code editor next to a live X session: the iframe hosts a JS X server
// rendered to a canvas (static/demo/runner.html); Run sends the editor
// contents over postMessage and the runner executes them against a fresh
// server, exactly like a node program talking to a real display.
export default function LiveDemoImpl({
  code,
  height = 420,
  screenWidth = 640,
  screenHeight = 480,
}) {
  const { colorMode } = useColorMode();
  const runnerBase = useBaseUrl('/demo/runner.html');
  const runnerSrc = `${runnerBase}?width=${screenWidth}&height=${screenHeight}`;

  const iframeRef = useRef(null);
  const codeRef = useRef(code);
  const consoleRef = useRef(null);
  const [editorCode, setEditorCode] = useState(code);
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);

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
        run(); // auto-run on mount, once the runner has booted
      } else if (msg.type === 'console') {
        setLines((prev) => [
          ...prev.slice(-(MAX_CONSOLE_LINES - 1)),
          { level: msg.level, text: msg.text },
        ]);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [run]);

  useEffect(() => {
    // keep the console scrolled to the latest line
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onChange = useCallback((value) => {
    codeRef.current = value;
    setEditorCode(value);
  }, []);

  const onReset = useCallback(() => {
    codeRef.current = code;
    setEditorCode(code);
    run();
  }, [code, run]);

  return (
    <div className={styles.container}>
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
          <span className={styles.hint}>
            {ready ? 'runs in your browser — no X server needed' : 'starting X server…'}
          </span>
        </div>
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
        <iframe
          ref={iframeRef}
          src={runnerSrc}
          className={styles.frame}
          style={{ aspectRatio: `${screenWidth} / ${screenHeight}` }}
          title="node-x11 live X session"
        />
        <div className={styles.screenCaption}>
          {screenWidth}×{screenHeight} X screen — click it to give it focus,
          then interact with the pointer and keyboard
        </div>
      </div>
    </div>
  );
}
