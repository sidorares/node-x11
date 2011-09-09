var x11 = require('../lib/x11');
x11.createClient().on('connect', function(display) {
  var X = this
    , rects = 
      [ { rect: { x: 50, y: 50, width: 100, height: 100 }, dir: 1, range: [0, 100]   }
      , { rect: { x: 100, y: 200, width: 90, height: 90 }, dir: 2, range: [80, 120]  }
      , { rect: { x: 20, y: 30, width: 15, height: 15   }, dir: 3, range: [10, 50]   }
      ]
    , windows = [X.AllocID()]
    , draw = [X.AllocID(), X.AllocID(), X.AllocID(), X.AllocID()]
    , borderWidth = 5
    , width = 800
    , split = 400
    , dir = 5
    , screen = display.screen[0];

  windows.forEach(function(window, i) {
    X.CreateWindow(
      { depth: 0
      , wid: window
      , parent: screen.root
      , x: 400 * (i % 2)
      , y: 300 * Math.floor(i/2)
      , width: 400 - borderWidth
      , height: 300 - borderWidth
      , border_width: borderWidth
      , 'class': 1
      , value_mask: { BackPixel: screen.white_pixel, EventMask: x11.eventMask.PointerMotion }
      })
    X.CreateGC({ cid: draw[i], drawable: window })
    setTimeout(function(){
      X.MapWindow({ window: window })
    }, 1000 * i + 1000)
  })
  setInterval(function() {
    windows.forEach(function(window, i) {
      X.ClearArea(
        { exposures: false
        , window: window
        , x: 0
        , y: 0
        , width: 400
        , height: 400})
      rects.forEach(function(rect, i) {
        rect.rect.x += rect.dir
        rect.rect.y += rect.dir
        //rect.rect.width += rect.dir
        //rect.rect.height += rect.dir
        if (rect.rect.x >= rect.range[1] || rect.rect.x <= rect.range[0]) rect.dir *= -1
      })
      var rectList = rects.map(function(r) { return r.rect })
      X.PolyFillRectangle({ drawable: window, gc: draw[i], rectangles: rectList })
    })
    split += dir
    if (split > 500 || split < 300) dir *= -1
  }, 100);

})
