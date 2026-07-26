// @ts-check
// Docusaurus configuration for the node-x11 documentation site.
// See https://docusaurus.io/docs/api/docusaurus-config

const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'node-x11',
  tagline:
    'A pure-JavaScript X Window System protocol client for Node.js — core protocol, extensions and GLX, no native code',
  favicon: 'img/favicon.svg',

  url: 'https://sidorares.github.io',
  baseUrl: '/node-x11/',
  trailingSlash: false,

  organizationName: 'sidorares',
  projectName: 'node-x11',

  onBrokenLinks: 'throw',

  markdown: {
    // Reference pages are synced verbatim from the repo's docs/ directory and
    // are plain Markdown (may contain <placeholders> and {braces} that are not
    // valid MDX). 'detect' parses .md files as CommonMark and .mdx as MDX.
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/sidorares/node-x11/tree/master/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'node-x11',
        logo: {
          alt: 'node-x11 logo',
          src: 'img/favicon.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Docs',
          },
          { to: '/playground', label: 'Playground', position: 'left' },
          {
            href: 'https://github.com/sidorares/node-x11',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Introduction', to: '/docs/intro' },
              { label: 'Getting started', to: '/docs/guides/getting-started' },
              { label: 'API reference', to: '/docs/reference' },
            ],
          },
          {
            title: 'Project',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/sidorares/node-x11',
              },
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/x11',
              },
              {
                label: 'Issues',
                href: 'https://github.com/sidorares/node-x11/issues',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} node-x11 contributors. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

module.exports = config;
