(function () {
  'use strict';

  function Renderer(canvas, eco) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.eco = eco;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.showSensors = false;
    this.showTrails = false;
    this.showToxins = true;
    this.selected = null;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this._fit();
    this._bind();
  }

  Renderer.prototype._fit = function () {
    var cw = this.canvas.clientWidth;
    var ch = this.canvas.clientHeight;
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(cw * dpr);
    this.canvas.height = Math.floor(ch * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min(cw / this.eco.W, ch / this.eco.H);
    this.ox = (cw - this.eco.W * this.scale) / 2;
    this.oy = (ch - this.eco.H * this.scale) / 2;
  };

  Renderer.prototype._bind = function () {
    var self = this;
    var c = this.canvas;
    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = c.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      self.zoomAt(mx, my, factor);
    }, { passive: false });
    c.addEventListener('mousedown', function (e) {
      self.dragging = true;
      self.lastX = e.clientX;
      self.lastY = e.clientY;
    });
    window.addEventListener('mousemove', function (e) {
      if (!self.dragging) return;
      self.ox += e.clientX - self.lastX;
      self.oy += e.clientY - self.lastY;
      self.lastX = e.clientX;
      self.lastY = e.clientY;
    });
    window.addEventListener('mouseup', function () { self.dragging = false; });
    c.addEventListener('click', function (e) {
      if (Math.abs(e.clientX - self.lastX) > 3 || Math.abs(e.clientY - self.lastY) > 3) return;
      var rect = c.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var p = self.screenToWorld(mx, my);
      self.selected = self.eco.nearestCreature(p.x, p.y);
      if (self.onSelect) self.onSelect(self.selected);
    });
    window.addEventListener('resize', function () { self._fit(); });
  };

  Renderer.prototype.zoomAt = function (mx, my, factor) {
    var wx = (mx - this.ox) / this.scale;
    var wy = (my - this.oy) / this.scale;
    this.scale *= factor;
    this.scale = Math.max(0.08, Math.min(8, this.scale));
    this.ox = mx - wx * this.scale;
    this.oy = my - wy * this.scale;
  };

  Renderer.prototype.screenToWorld = function (mx, my) {
    return { x: (mx - this.ox) / this.scale, y: (my - this.oy) / this.scale };
  };

  Renderer.prototype.draw = function () {
    var ctx = this.ctx, eco = this.eco;
    var cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    // Borde del mundo.
    ctx.strokeStyle = 'rgba(120,160,220,0.25)';
    ctx.lineWidth = 2 / this.scale;
    ctx.strokeRect(0, 0, eco.W, eco.H);

    // Parches tóxicos.
    if (this.showToxins) {
      for (var t = 0; t < eco.toxins.length; t++) {
        var to = eco.toxins[t];
        var g = ctx.createRadialGradient(to.x, to.y, 0, to.x, to.y, to.r);
        g.addColorStop(0, 'rgba(180,40,220,0.35)');
        g.addColorStop(1, 'rgba(180,40,220,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(to.x, to.y, to.r, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,80,255,0.5)';
        ctx.lineWidth = 1.5 / this.scale;
        ctx.stroke();
      }
    }

    // Comida: brillo según energía restante.
    for (var f = 0; f < eco.food.length; f++) {
      var fd = eco.food[f];
      var frac = fd.energy / fd.maxEnergy;
      var r2 = Math.floor(60 + frac * 40);
      var g2 = Math.floor(140 + frac * 110);
      var b2 = Math.floor(50 + frac * 70);
      ctx.fillStyle = 'rgba(' + r2 + ',' + g2 + ',' + b2 + ',0.85)';
      ctx.fillRect(fd.x - fd.r, fd.y - fd.r, fd.r * 2, fd.r * 2);
    }

    // Trazas.
    if (this.showTrails) {
      for (var c2 = 0; c2 < eco.creatures.length; c2++) {
        var cr = eco.creatures[c2];
        if (!cr.trail) continue;
        for (var k = 0; k < cr.trail.length; k++) {
          var alpha = 0.16 * (1 - k / cr.trail.length);
          ctx.fillStyle = 'hsla(' + cr.p.hue + ',70%,58%,' + alpha + ')';
          ctx.beginPath();
          ctx.arc(cr.trail[k][0], cr.trail[k][1], cr.p.radius * 0.7 * (1 - k / cr.trail.length), 0, 6.2832);
          ctx.fill();
        }
      }
    }

    // Criaturas.
    for (var ci = 0; ci < eco.creatures.length; ci++) {
      var c = eco.creatures[ci];
      var r = c.p.radius;
      var energyFrac = Math.max(0.15, Math.min(1, c.energy / c.p.maxEnergy));
      ctx.fillStyle = 'hsl(' + c.p.hue + ',70%,60%)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, 6.2832);
      ctx.fill();
      // Aro de energía.
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + energyFrac * 0.5) + ')';
      ctx.lineWidth = 1.2 / this.scale;
      ctx.stroke();
      // Segmento de dirección.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(c.heading) * r * 1.5, c.y + Math.sin(c.heading) * r * 1.5);
      ctx.stroke();

      if (this.selected === c) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / this.scale;
        ctx.setLineDash([6 / this.scale, 4 / this.scale]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 5 / this.scale, 0, 6.2832);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Sensores si están activados y es el seleccionado.
      if (this.showSensors && (this.selected === c || this.selected === null)) {
        ctx.strokeStyle = 'rgba(0,200,255,0.25)';
        ctx.lineWidth = 1 / this.scale;
        for (var e = 0; e < 5; e++) {
          var ang = c.heading + (-2.1 + e * 1.05);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.cos(ang) * c.p.eyeRange, c.y + Math.sin(ang) * c.p.eyeRange);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  };

  window.SYM = window.SYM || {};
  window.SYM.Renderer = Renderer;
})();