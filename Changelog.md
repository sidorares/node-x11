# Changelog

## [3.0.0](https://github.com/sidorares/node-x11/compare/v2.3.0...v3.0.0) (2026-07-25)


### ⚠ BREAKING CHANGES

* complete GLX coverage; fix protocol bugs; render+ReadPixels tests
* AllocColor reply green/blue unswapped and pixel is the real 32-bit value; GetWindowAttributes field renamed doNotPropogateMask -> doNotPropagateMask; Randr.ConfigStatus.Sucess -> Success; PolyText8/16 throw Error objects; xc-misc GetXIDList returns plain ids.

### Features

* advanced GLX examples (reflection/shadow/envmap/dynamic texture, pbuffer interop) ([204eb01](https://github.com/sidorares/node-x11/commit/204eb01b51ed2bc26b284e00f4c111775f45f68f))
* complete core X11 protocol coverage (all 120 requests, all 34 events) ([e894943](https://github.com/sidorares/node-x11/commit/e89494358f6fd5b9a6593bbc12273a506899ca1a))
* complete extension coverage; GenericEvent framing; protocol bug fixes ([af1da82](https://github.com/sidorares/node-x11/commit/af1da822769094010d4ab65ce714030acb8ae09f))
* complete GLX coverage; fix protocol bugs; render+ReadPixels tests ([387a2a9](https://github.com/sidorares/node-x11/commit/387a2a925f4c89c8600391fb1638b7b545c5f169))
* teapot/bunny mesh viewer example from npm meshes; drop bundled teapot.json ([cf89ccf](https://github.com/sidorares/node-x11/commit/cf89ccf593ae3260bacb0f523122544e45ebe944))


### Bug Fixes

* **ci:** survive broken Linux GLX servers; run tests in bookworm containers ([5e695d0](https://github.com/sidorares/node-x11/commit/5e695d0aba20b89d3c90f12b0b43672619a84902))
* **test:** detect GL-less indirect contexts via empty GL_VERSION string ([e06b292](https://github.com/sidorares/node-x11/commit/e06b292dc36a22b49d9fbc68e4a68549c24dde8d))

3.0.0 - unreleased
  - BREAKING: AllocColor reply fixed — green/blue are no longer swapped and
    pixel is the real 32-bit pixel value (was previously shifted right by 8)
  - BREAKING: GetWindowAttributes reply field renamed doNotPropogateMask ->
    doNotPropagateMask
  - BREAKING: Randr.ConfigStatus.Sucess renamed to Success
  - BREAKING: PolyText8/PolyText16 throw Error objects instead of strings
    for unsupported items
  - xc-misc GetXIDList returns plain ids (was one-element arrays);
    GetVersion is the canonical name (QueryVersion kept as alias)
  - GenericEvent (type 35) framing + dispatch via X.geEventParsers
  - new extensions: xinerama, sync, record, shm, dbe, res, ge, present, xv,
    xkb (partial), xinput (partial)
  - completed extensions: fixes (XFIXES 5), randr (1.3), render, shape,
    screen-saver, xtest, xc-misc, apple-wm (menu/update requests)
  - bug fixes: damage Destroy BadLength, render Trapezoids overflow /
    FillRectangles skipping rects / CreatePicture dropping zero-valued
    attributes, xtest FakeInput coordinates, randr reply parsers,
    screen-saver version/enum/event parsing, XFIXES ChangeSaveSet window,
    apple-wm double callback when extension missing
  - docs/ folder: core protocol + one page per extension

1.0.3 - 19/02/2015
  - cleanup debug logs               #83
