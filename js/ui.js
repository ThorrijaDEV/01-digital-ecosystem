(function () {
  'use strict';

  var fmt = function (n, d) {
    return (n === undefined || n === null || isNaN(n)) ? '—' : (+n).toFixed(d === undefined ? 1 : d);
  };

  function initUI(eco, renderer) {
    var $ = function (id) { return document.getElementById(id); };

    var elPop = $('stat-pop'), elBorn = $('stat-born'), elDead = $('stat-dead'),
      elFood = $('stat-food'), elSize = $('stat-size'), elSpeed = $('stat-speed'),
      elAge = $('stat-age'), elGen = $('stat-gen'), elOff = $('stat-off'),
      elTime = $('stat-time'), elSpeedLimit = $('stat-sim-rate'),
      chartPop = $('chart-pop'), chartLine = $('chart-line'), chartRef = $('chart-ref');

    var frame = 0;

    function updateStats(s) {
      elPop.textContent = s.pop;
      elBorn.textContent = s.born;
      elDead.textContent = s.dead;
      elFood.textContent = s.food;
      elSize.textContent = fmt(s.avgSize, 2);
      elSpeed.textContent = fmt(s.avgSpeed, 2);
      elAge.textContent = fmt(s.avgAge);
      elGen.textContent = s.lineages.species;
      elOff.textContent = fmt(s.avgOffspring, 2);
      elTime.textContent = Math.floor(s.time);
      elSpeedLimit.textContent = eco._busy ? 'limitado' : 'x' + uiSpeed;
    }

    function drawChart(canvas, series, color, maxY) {
      var ctx = canvas.getContext('2d');
      var w = canvas.clientWidth, h = canvas.clientHeight;
      var dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0d131c';
      ctx.fillRect(0, 0, w, h);
      var data = eco.statsHistory;
      if (data.length < 2) return;
      ctx.strokeStyle = 'rgba(120,160,220,0.15)';
      ctx.lineWidth = 1;
      for (var i = 1; i < 4; i++) {
        var y = Math.floor(h * i / 4);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var max = maxY || 1;
      for (var j = 0; j < data.length; j++) {
        var v = series(data[j]);
        if (v > max) max = v;
      }
      if (max <= 0) max = 1;
      for (var j2 = 0; j2 < data.length; j2++) {
        var v2 = series(data[j2]);
        var x = j2 / (data.length - 1) * w;
        var y2 = h - (v2 / max) * h;
        if (j2 === 0) ctx.moveTo(x, y2);
        else ctx.lineTo(x, y2);
      }
      ctx.stroke();
    }

    function drawCharts() {
      drawChart(chartPop, eco.statsHistory, function (s) { return s.pop; }, '#4cc9f0');
      drawChart(chartLine, eco.statsHistory, function (s) { return s.lineages.species; }, '#f4a261');
      drawChart(chartRef, eco.statsHistory, function (s) { return s.avgOffspring; }, '#95d5b2');
    }

    // --- Panel de criatura seleccionada ---
    var selPanel = $('sel-panel');
    var selTitle = $('sel-title');
    var selMeta = $('sel-meta');
    var selGenes = $('sel-genes');
    var nnCanvas = $('nn-canvas');
    var nnCtx = nnCanvas.getContext('2d');
    var nnStat = $('nn-stat');

    var geneNames = {
      size: 'Tamaño', speed: 'Velocidad', eyeRange: 'Rango visual',
      metabolism: 'Metabolismo', bite: 'Depredación', repFactor: 'Umbral de cría',
      hue: 'Color', mutationRate: 'Tasa de mutación'
    };

    function nnDraw(c, inputs, out) {
      var w = nnCanvas.clientWidth, h = nnCanvas.clientHeight;
      var dpr = window.devicePixelRatio || 1;
      if (nnCanvas.width !== w * dpr || nnCanvas.height !== h * dpr) {
        nnCanvas.width = w * dpr;
        nnCanvas.height = h * dpr;
      }
      nnCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nnCtx.fillStyle = '#0d131c';
      nnCtx.fillRect(0, 0, w, h);

      var cols = [{ n: 13, data: inputs }, { n: 16, data: null }, { n: 3, data: out }];
      var xOff = [20, w / 2 - 6, w - 30];
      // Añadimos activaciones ocultas si las calculamos: por ahora no.
      // Dibujamos nodos por columna.
      for (var col = 0; col < cols.length; col++) {
        var n = cols[col].n;
        var x = xOff[col];
        var gap = 20;
        var startY = (h - (n - 1) * gap) / 2;
        for (var i = 0; i < n; i++) {
          var y = startY + i * gap;
          var base;
          if (col === 0) base = cols[col].data[i];
          else if (col === 2) base = cols[col].data[i];
          else base = 0.5;
          var mag = Math.abs(base);
          var sign = base >= 0 ? 'pos' : 'neg';
          if (col === 0) {
            nnCtx.fillStyle = 'rgba(0,190,255,' + Math.min(1, mag * 2) + ')';
          } else if (col === 2) {
            nnCtx.fillStyle = sign === 'pos' ? 'rgba(80,230,120,' + Math.min(1, mag * 2) + ')'
              : 'rgba(255,80,80,' + Math.min(1, mag * 2) + ')';
          } else {
            nnCtx.fillStyle = 'rgba(180,180,190,0.25)';
          }
          var r = col === 1 ? 5 : 4;
          nnCtx.beginPath();
          nnCtx.arc(x, y, r, 0, 6.2832);
          nnCtx.fill();
        }
      }
    }

    function showSelection(c) {
      if (!c) {
        selPanel.style.display = 'none';
        return;
      }
      selPanel.style.display = 'block';
      selTitle.textContent = 'Criatura ' + (c === renderer.selected ? 'seleccionada' : '');
      selTitle.textContent = 'Organismo vivo';
      selMeta.innerHTML = 'Generación <b>' + c.generation + '</b> · Edad <b>' + Math.floor(c.age) +
        '</b> · Energía <b>' + fmt(c.energy) + ' / ' + fmt(c.p.maxEnergy) + '</b> · Crías <b>' +
        c.offspring + '</b>';
      var rows = '';
      for (var k = 0; k < window.SYM.Neural.PHENO.length; k++) {
        var key = window.SYM.Neural.PHENO[k][0];
        rows += '<div class="gene"><span>' + geneNames[key] + '</span><b>' + fmt(c.p[key], 2) + '</b></div>';
      }
      selGenes.innerHTML = rows;
      nnStat.textContent = 'Últimas señales de entrada · activación de salida';
      nnDraw(c, c._lastInputs || [], c._lastOut || []);
    }

    // --- Controles ---
    var btnRun = $('btn-run'), btnPause = $('btn-pause'), btnReset = $('btn-reset'),
      btnKind = $('btn-kind'), btnTrails = $('btn-trails'), btnToxins = $('btn-toxins'),
      btnSensors = $('btn-sensors'),
      optFood = $('opt-food'), optMut = $('opt-mut'), optSpeed = $('opt-speed'),
      inpSeed = $('inp-seed');

    var uiSpeed = 2;

    function resetWorld() {
      eco.seed = (parseInt(inpSeed.value, 10) || 1337) >>> 0;
      eco.rng = window.SYM.Ecosystem.mulberry32(eco.seed);
      eco.toxins = [];
      eco.creatures = [];
      eco.food = [];
      eco.time = 0;
      eco.deadCount = 0;
      eco.birthCount = 0;
      eco.sumOffspringOnDeath = 0;
      eco.countOffspringDeaths = 0;
      eco.statsHistory = [];
      eco.targetFood = Math.round(eco.W * eco.H / 1400 * ((+optFood.value) / 10));
      eco.seedWorld(140, 120);
      renderer.showToxins = true;
      renderer._fit();
    }

    btnReset.addEventListener('click', resetWorld);
    btnRun.addEventListener('click', function () { running = true; });
    btnPause.addEventListener('click', function () { running = false; });
    btnKind.addEventListener('click', function () {
      if (eco.rng) {
        // Mutación masiva: ruido global (inyecta variabilidad al instante).
        for (var i = 0; i < eco.creatures.length; i++) {
          eco.creatures[i].genome = window.SYM.Neural.mutateGenome(eco.creatures[i].genome, eco.rng);
          eco.creatures[i].brain = new window.SYM.Neural.Brain(eco.creatures[i].genome);
          eco.creatures[i].p = window.SYM.Neural.phenotypeOf(eco.creatures[i].genome);
        }
      }
    });
    btnTrails.addEventListener('click', function () {
      eco.trailEnabled = !eco.trailEnabled;
      renderer.showTrails = eco.trailEnabled;
    });
    btnToxins.addEventListener('click', function () { renderer.showToxins = !renderer.showToxins; });
    btnSensors.addEventListener('click', function () { renderer.showSensors = !renderer.showSensors; });

    optFood.addEventListener('input', function () {
      var factor = (+optFood.value) / 10;
      eco.targetFood = Math.round(eco.W * eco.H / 1400 * factor);
    });
    optSpeed.addEventListener('input', function () {
      uiSpeed = +optSpeed.value;
    });
    optMut.addEventListener('input', function () {
      eco.globalMut = +optMut.value;
    });

    // Velocidad de simulación en ticks por frame real.
    var running = true;
    var acc = 0;

    function setSpeed(v) {
      uiSpeed = v;
      optSpeed.value = v;
    }

    return {
      get running() { return running; },
      get speed() { return uiSpeed; },
      setRunning: function (r) { running = r; },
      setSpeed: setSpeed,
      onFrame: function (s) {
        frame++;
        if (frame % 8 === 0) updateStats(s);
        drawCharts();
        if (renderer.selected && renderer.selected.alive === false) {
          renderer.selected = null;
          showSelection(null);
        } else if (renderer.selected) {
          showSelection(renderer.selected);
        }
      },
      showSelection: showSelection,
      resetWorld: resetWorld
    };
  }

  window.SYM.UI = { initUI: initUI };
})();