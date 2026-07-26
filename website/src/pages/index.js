import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const codeSample = `const x11 = require('x11');

x11.createClient((err, display) => {
  const X = display.client;
  const wid = X.AllocID();
  X.CreateWindow(wid, display.screen[0].root, 0, 0, 500, 500, 0, 0, 0, 0, {
    eventMask: x11.eventMask.Exposure,
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: display.screen[0].black_pixel });
  X.on('event', ev => {
    if (ev.name === 'Expose')
      X.PolyText8(wid, gc, 50, 50, ['Hello, Node.JS!']);
  });
});`;

const features = [
  {
    title: 'Pure JavaScript, zero dependencies',
    description:
      'No native code, no node-gyp, no runtime dependencies. The library ' +
      'speaks the X11 wire protocol directly over a unix socket or TCP.',
  },
  {
    title: 'Full core protocol + extensions',
    description:
      'All 120 core requests and 34 events, plus RENDER, RANDR, XFIXES, ' +
      'Composite, Damage, SHAPE, XTEST, XKB, XInput, MIT-SHM and many more.',
  },
  {
    title: 'GLX / OpenGL',
    description:
      'Full GLX 1.4 support with vendor extensions: create GL contexts and ' +
      'render OpenGL over the X protocol, straight from Node.js.',
  },
  {
    title: 'Runs in the browser',
    description:
      'Pluggable transports let the client run against any duplex stream — ' +
      'in-browser live demos are coming to the Playground.',
  },
];

function Feature({ title, description }) {
  return (
    <div className={clsx('col col--3')}>
      <div className={styles.featureCard}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="node-x11: a pure-JavaScript X Window System protocol client for Node.js">
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Get started
            </Link>
            <Link
              className="button button--outline button--secondary button--lg"
              to="https://github.com/sidorares/node-x11">
              GitHub
            </Link>
            <Link
              className="button button--outline button--secondary button--lg"
              to="https://www.npmjs.com/package/x11">
              npm
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map(props => (
                <Feature key={props.title} {...props} />
              ))}
            </div>
          </div>
        </section>
        <section className={styles.codeSection}>
          <div className="container">
            <div className="row">
              <div className={clsx('col col--5', styles.codeIntro)}>
                <Heading as="h2">Talk to the X server directly</Heading>
                <p>
                  Install with <code>npm install x11</code>, connect with a
                  single call, and every core request is a method on the
                  client — windows, graphics contexts, drawing, events.
                </p>
                <p>
                  <Link to="/docs/guides/getting-started">
                    Read the getting-started guide →
                  </Link>
                </p>
                <p>
                  <Link to="/docs/reference">Browse the API reference →</Link>
                </p>
              </div>
              <div className="col col--7">
                <CodeBlock language="js">{codeSample}</CodeBlock>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
