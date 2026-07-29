import MDXComponents from '@theme-original/MDXComponents';
import LiveDemo from '@site/src/components/LiveDemo';

// Making LiveDemo global means a guide can drop `<LiveDemo demo="..." />`
// into the prose without an import line at the top of the file — the import
// is the kind of boilerplate that discourages adding a demo at all.
export default {
  ...MDXComponents,
  LiveDemo,
};
