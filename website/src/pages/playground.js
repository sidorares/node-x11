import React, { useState } from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import clsx from 'clsx';
import demos from '../demos';
import LiveDemo from '../components/LiveDemo';
import styles from './playground.module.css';

export default function Playground() {
  const [selectedId, setSelectedId] = useState(demos[0].id);
  const demo = demos.find((d) => d.id === selectedId) || demos[0];

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
          and press Run.
        </p>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <ul className={styles.demoList}>
              {demos.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={clsx(
                      styles.demoButton,
                      d.id === demo.id && styles.demoButtonActive
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
            <LiveDemo
              key={demo.id}
              code={demo.code}
              height={demo.height}
              screenWidth={demo.screenWidth}
              screenHeight={demo.screenHeight}
            />
          </div>
        </div>
      </main>
    </Layout>
  );
}
