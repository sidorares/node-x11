// Placeholder page. It will be replaced by the in-browser X server +
// live editor playground currently in development.
import React from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

export default function Playground() {
  return (
    <Layout title="Playground" description="Live in-browser node-x11 demos">
      <main className="container margin-vert--xl">
        <div className="row">
          <div className="col col--8 col--offset-2 text--center">
            <Heading as="h1">Playground</Heading>
            <p>
              Live in-browser demos are coming soon: an X server implemented
              in JavaScript rendering to this page, driven by node-x11 code
              you can edit and run right here.
            </p>
            <p>
              In the meantime, check out the runnable demos in the{' '}
              <a href="https://github.com/sidorares/node-x11/tree/master/examples">
                examples directory
              </a>{' '}
              on GitHub.
            </p>
          </div>
        </div>
      </main>
    </Layout>
  );
}
