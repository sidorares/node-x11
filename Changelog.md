# Changelog

## [3.1.1](https://github.com/sidorares/node-x11/compare/v3.1.0...v3.1.1) (2026-07-26)


### Bug Fixes

* re-arm the packet parser even when dispatch throws ([be94d5c](https://github.com/sidorares/node-x11/commit/be94d5cfe558b80237101fd1cd29fcae585051be))
* re-arm the packet parser even when dispatch throws ([296b525](https://github.com/sidorares/node-x11/commit/296b52544144c8d8c1d35b5426aec7ba1ad318cb)), closes [#226](https://github.com/sidorares/node-x11/issues/226)

## [3.1.0](https://github.com/sidorares/node-x11/compare/v3.0.0...v3.1.0) (2026-07-26)


### Features

* **xserver:** RENDER extension for the JS X server ([b401c0c](https://github.com/sidorares/node-x11/commit/b401c0cb7fefe2e5aa41013968d126af31ae851d))
* **xserver:** RENDER extension for the JS X server ([3293aaf](https://github.com/sidorares/node-x11/commit/3293aaf886af279624d13d805a959d519a83f49c))

## [3.0.0](https://github.com/sidorares/node-x11/compare/v2.3.0...v3.0.0) (2026-07-26)


### ⚠ BREAKING CHANGES

* complete GLX coverage; fix protocol bugs; render+ReadPixels tests
* AllocColor reply green/blue unswapped and pixel is the real 32-bit value; GetWindowAttributes field renamed doNotPropogateMask -> doNotPropagateMask; Randr.ConfigStatus.Sucess -> Success; PolyText8/16 throw Error objects; xc-misc GetXIDList returns plain ids.

### Features

* advanced GLX examples (reflection/shadow/envmap/dynamic texture, pbuffer interop) ([204eb01](https://github.com/sidorares/node-x11/commit/204eb01b51ed2bc26b284e00f4c111775f45f68f))
* **browser:** canvas presenter (damage-driven blits + DOM input injection) ([055d6d0](https://github.com/sidorares/node-x11/commit/055d6d07d0a408af123348d1f7557801c7265e80))
* **browser:** MessagePort duplex stream and DOM-key to keysym mapping ([7bbe49c](https://github.com/sidorares/node-x11/commit/7bbe49c299ef0b64fb59fc1b5e286584d831a539))
* complete core X11 protocol coverage (all 120 requests, all 34 events) ([e894943](https://github.com/sidorares/node-x11/commit/e89494358f6fd5b9a6593bbc12273a506899ca1a))
* complete extension coverage; GenericEvent framing; protocol bug fixes ([af1da82](https://github.com/sidorares/node-x11/commit/af1da822769094010d4ab65ce714030acb8ae09f))
* complete GLX coverage; fix protocol bugs; render+ReadPixels tests ([387a2a9](https://github.com/sidorares/node-x11/commit/387a2a925f4c89c8600391fb1638b7b545c5f169))
* **core:** flow control + checked void requests ([#195](https://github.com/sidorares/node-x11/issues/195), [#85](https://github.com/sidorares/node-x11/issues/85)) ([0fab681](https://github.com/sidorares/node-x11/commit/0fab6815a287d2c8d77ae54bb6755f682d308bce))
* **glx-emu:** GLX indirect-rendering emulator for the JS X server ([c3fea23](https://github.com/sidorares/node-x11/commit/c3fea2371f510e548076d3fab7226b472e074f1a))
* **glx:** ChooseFBConfig helper with GLX 1.4 selection rules ([#183](https://github.com/sidorares/node-x11/issues/183)) ([52de44a](https://github.com/sidorares/node-x11/commit/52de44a0dbe00a31f0701e63a44cd81c7a100774))
* pluggable DISPLAY protocols, injectable streams and auth ([48d09c8](https://github.com/sidorares/node-x11/commit/48d09c8a6ea95414261c0649f3a6878549397f6f))
* teapot/bunny mesh viewer example from npm meshes; drop bundled teapot.json ([cf89ccf](https://github.com/sidorares/node-x11/commit/cf89ccf593ae3260bacb0f523122544e45ebe944))
* **website:** GLX playground demos (triangle + spinning lit cube) ([6e0746c](https://github.com/sidorares/node-x11/commit/6e0746c5f69cfda185dfabc4984ac101c5c2de92))
* **website:** live playground powered by the in-browser JS X server ([6fdaefc](https://github.com/sidorares/node-x11/commit/6fdaefc32acb90a6fe5ef3bffcef88c184892806))
* **xserver:** foundation for the pure-JS X server ([174c14b](https://github.com/sidorares/node-x11/commit/174c14b573c7d327fa294c753e16b8fa9e7fdbd7))
* **xserver:** pure-JavaScript X server core ([c3e084b](https://github.com/sidorares/node-x11/commit/c3e084b8d940daa2eb7458bc74edb4c767fbaab5))


### Bug Fixes

* **ci:** survive broken Linux GLX servers; run tests in bookworm containers ([5e695d0](https://github.com/sidorares/node-x11/commit/5e695d0aba20b89d3c90f12b0b43672619a84902))
* **test:** detect GL-less indirect contexts via empty GL_VERSION string ([e06b292](https://github.com/sidorares/node-x11/commit/e06b292dc36a22b49d9fbc68e4a68549c24dde8d))
* **test:** skip subdirectories when the runner enumerates test/ ([798fe5a](https://github.com/sidorares/node-x11/commit/798fe5ac69e9ef282ff24ba7846f8bc167f0b0dc))
* **website:** polyfill setImmediate in the demo bundle ([9081f1a](https://github.com/sidorares/node-x11/commit/9081f1a948888f351fd9366f6d9014c54c9d0398))

### Notable details

* new extensions: xinerama, sync, record, shm, dbe, res, ge, present, xv,
  xkb (partial), xinput (partial); GenericEvent (type 35) framing +
  dispatch via `X.geEventParsers`
* completed extensions: fixes (XFIXES 5), randr (1.3), render, shape,
  screen-saver, xtest, xc-misc, apple-wm (menu/update requests)
* xc-misc `GetVersion` is the canonical name (`QueryVersion` kept as alias)
* extension bug fixes: damage Destroy BadLength, render Trapezoids
  overflow / FillRectangles skipping rects / CreatePicture dropping
  zero-valued attributes, xtest FakeInput coordinates, randr reply
  parsers, screen-saver version/enum/event parsing, XFIXES ChangeSaveSet
  window, apple-wm double callback when extension missing
* new `docs/` folder: core protocol reference + one page per extension

1.0.3 - 19/02/2015
  - cleanup debug logs               #83
