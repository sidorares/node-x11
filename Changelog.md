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
