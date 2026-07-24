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
