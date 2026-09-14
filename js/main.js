(function () {
  'use strict';

  var Engine = window.SYM;
  var canvas = document.getElementById('world');

  var eco = new Engine.Ecosystem.Ecosystem({
    W: 1280,
    H: 800,
    seed: 1337,
    popCap: 5000
  });

  var renderer = new Engine.Renderer(canvas, eco);
  var ui = Engine.UI.initUI(eco, renderer);
  renderer.onSelect = function (c) { ui.showSelection(c); };

  var last = performance.now();
  var acc = 0;

  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (ui.running) {
      acc += dt * ui.speed;
      var steps = Math.min(Math.floor(acc), 15);
      if (steps < Math.floor(acc)) {
        acc = Math.floor(acc) - steps;
      } else {
        acc = 0;
      }
      eco._busy = steps === 15;
      var t0 = performance.now();
      for (var i = 0; i < steps; i++) {
        var s = eco.tick();
        ui.onFrame(s);
      }
      var simTime = performance.now() - t0;
      if (simTime > 25 && ui.speed > 1) {
        ui.setSpeed(Math.max(1, Math.floor(ui.speed * 0.6)));
      }
    } else {
      renderer.draw();
    }
    renderer.draw();
    requestAnimationFrame(frame);
  }

  ui.resetWorld();
  requestAnimationFrame(frame);
})();