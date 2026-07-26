import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './styles.module.css';

// SSR-safe wrapper: the editor + iframe runner only exist in the browser.
export default function LiveDemo(props) {
  return (
    <BrowserOnly
      fallback={
        <div className={styles.fallback}>Loading live demo…</div>
      }>
      {() => {
        const Impl = require('./impl').default;
        return <Impl {...props} />;
      }}
    </BrowserOnly>
  );
}
