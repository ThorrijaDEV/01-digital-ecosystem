(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SYM = root.SYM || {};
    root.SYM.Ecosystem = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var Neural = (typeof module !== 'undefined' && module.exports)
    ? require('./neural.js')
    : (root.SYM.Neural);

  var EYE_ANGLES = [-2.1, -1.05, 0, 1.05, 2.1];
  var CONE_HALF = 0.6;
  var TICK_ENERGY = 8;
  var CELL = 160;
  var GRAVITY_TRAILS = 10;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wrap(x, w) {
    x = x % w;
    return x < 0 ? x + w : x;
  }

  function wrapDelta(a, b, w) {
    var d = a - b;
    if (d > w / 2) d -= w;
    else if (d < -w / 2) d += w;
    return d;
  }

  function Creature(eco, genome, x, y, heading, generation) {
    this.eco = eco;
    this.genome = genome;
    this.brain = new Neural.Brain(genome);
    this.p = Neural.phenotypeOf(genome);
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.energy = this.p.maxEnergy * (0.75 + eco.rng() * 0.25);
    this.age = 0;
    this.generation = generation || 0;
    this.offspring = 0;
    this.alive = true;
    this.gene = 0;
    this.deadBy = '';
    this.trail = null;
  }

  Creature.prototype.dist2 = function (x, y) {
    var dx = wrapDelta(this.x, x, this.eco.W);
    var dy = wrapDelta(this.y, y, this.eco.H);
    return dx * dx + dy * dy;
  };

  Creature.prototype.overlaps = function (other) {
    var r = this.p.radius + other.p.radius;
    return this.dist2(other.x, other.y) <= r * r;
  };

  // Devuelve [foodProx, creatureProx] para un ojo apuntando a un ángulo.
  Creature.prototype.senseEye = function (eco, ang) {
    var angle = this.heading + ang;
    var dirx = Math.cos(angle), diry = Math.sin(angle);
    var range = this.p.eyeRange;
    var maxF = 0, maxC = 0;
    var cells = eco.cellsAround(this.x, this.y, range);
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var foods = eco.foodCells.get(cell);
      if (foods) {
        for (var k = 0; k < foods.length; k++) {
          var f = eco.food[foods[k]];
          var dx = wrapDelta(f.x, this.x, eco.W);
          var dy = wrapDelta(f.y, this.y, eco.H);
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > range || d <= 0) continue;
          var ca = Math.atan2(dy, dx) - this.heading;
          ca = ((ca + Math.PI) % (2 * Math.PI)) - Math.PI;
          if (Math.abs(ca - ang) > CONE_HALF) continue;
          var t = 1 - d / range;
          if (t > maxF) maxF = t;
        }
      }
      var crs = eco.creatureCells.get(cell);
      if (crs) {
        for (var k = 0; k < crs.length; k++) {
          var c = eco.creatures[crs[k]];
          if (c === this || !c.alive) continue;
          var dx2 = wrapDelta(c.x, this.x, eco.W);
          var dy2 = wrapDelta(c.y, this.y, eco.H);
          var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 > range || d2 <= 0) continue;
          var ca2 = Math.atan2(dy2, dx2) - this.heading;
          ca2 = ((ca2 + Math.PI) % (2 * Math.PI)) - Math.PI;
          if (Math.abs(ca2 - ang) > CONE_HALF) continue;
          var t2 = 1 - d2 / range;
          if (t2 > maxC) maxC = t2;
        }
      }
    }
    return [maxF, maxC];
  };

  Creature.prototype.makeInputs = function (eco) {
    var inp = [];
    for (var i = 0; i < EYE_ANGLES.length; i++) {
      var e = this.senseEye(eco, EYE_ANGLES[i]);
      inp.push(e[0], e[1]);
    }
    var energyNorm = this.energy / this.p.maxEnergy;
    inp.push(energyNorm);          // 11 nivel de energía
    inp.push(1 - energyNorm);      // 12 hambre
    inp.push(Math.min(1, this.age / this.p.maxAge)); // 13 edad
    return inp;
  };

  Creature.prototype.reproduce = function (eco) {
    var rate = eco.globalMut !== undefined ? eco.globalMut : undefined;
    var genome = Neural.mutateGenome(this.genome, eco.rng, rate);
    var off = new Creature(eco, genome, this.x, this.y, this.heading, this.generation + 1);
    // Tasa de mutación heredada: puede bajar la fidelidad de copia.
    off.energy = this.energy * 0.5;
    this.energy = this.energy * 0.5;
    this.offspring += 1;
    off.x = wrap(this.x + (ecoTrick(eco.rng) - 0.5) * 10, eco.W);
    off.y = wrap(this.y + (ecoTrick(eco.rng) - 0.5) * 10, eco.H);
    return off;
  };

  function ecoTrick(rng) {
    return rng();
  }

  Creature.prototype.update = function (eco, dt) {
    var inputs = this.makeInputs(eco);
    var out = this.brain.step(inputs, this.p);
    var throttle = out[0], steer = out[1], bite = out[2];
    var p = this.p;

    // Movimiento.
    var turn = steer * p.maxTurn * 2.2 * dt;
    this.heading += turn;
    if (this.heading > Math.PI) this.heading -= 6.283185307;
    if (this.heading < -Math.PI) this.heading += 6.283185307;
    var vx = Math.cos(this.heading);
    var vy = Math.sin(this.heading);
    var spd = throttle * p.maxSpeed * dt;
    this.x = wrap(this.x + vx * spd, eco.W);
    this.y = wrap(this.y + vy * spd, eco.H);

    // Metabolismo (mantenimiento + movimiento).
    var cost = 0.012 * p.size * p.metabolism * dt;
    cost += (throttle * 0.008 + Math.abs(steer) * 0.002) * p.metabolism * dt;

    // Zonas tóxicas.
    for (var i = 0; i < eco.toxins.length; i++) {
      var t = eco.toxins[i];
      var dx = wrapDelta(this.x, t.x, eco.W);
      var dy = wrapDelta(this.y, t.y, eco.H);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < t.r) {
        cost += t.power * (1 - d / t.r) * dt;
      }
    }
    this.energy -= cost;

    // Pastoreo continuo: cada alimento solapado transfiere energía.
    this.gene = 0;
    var foot = eco.foodAround(this.x, this.y, p.radius * 3.2, this);
    for (var k2 = 0; k2 < foot.length; k2++) {
      var pair = foot[k2];
      var fi = pair[1];
      var f = eco.food[fi];
      if (f.energy <= 0) continue;
      if (this.dist2(f.x, f.y) <= (p.radius * 1.4 + f.r) * (p.radius * 1.4 + f.r)) {
        var gain = Math.min(0.5, f.energy);
        this.energy += gain;
        f.energy -= gain;
        if (this.energy > this.p.maxEnergy * 2) this.energy = this.p.maxEnergy * 2;
        this.gene = 1;
      }
    }

    // Depredación: morder a otro ser solapado.
    if (bite > 0.5) {
      var near = eco.creaturesAround(this.x, this.y, p.radius * 4, this);
      for (var j = 0; j < near.length; j++) {
        var other = near[j];
        if (other === this || !other.alive) continue;
        if (this.overlaps(other)) {
          var drain = 3.2 * p.bite * (p.size / other.p.size);
          var gained = Math.min(drain, other.energy);
          other.energy -= gained;
          this.energy += gained * 0.7;
          if (gained > 0) this.gene = 1;
        }
      }
    }

    this.age += dt;
    this._lastInputs = inputs;
    this._lastOut = out;

    var died = false;
    if (this.energy <= 0) { died = true; this.deadBy = 'hambre'; }
    else if (this.age >= p.maxAge) { died = true; this.deadBy = 'vejez'; }
    return { inputs: inputs, out: out, died: died, foodReached: this.gene };
  };

  function Ecosystem(opts) {
    opts = opts || {};
    this.W = opts.W || 1280;
    this.H = opts.H || 800;
    this.rng = mulberry32(opts.seed || 1337);
    this.creatures = [];
    this.food = [];
    this.toxins = [];
    this.popCap = opts.popCap || 5000;
    this.targetFood = opts.targetFood || Math.round(this.W * this.H / 1400);
    this.time = 0;
    this.statsHistory = [];
    this.trailEnabled = false;
    this.deadCount = 0;
    this.birthCount = 0;
    this.sumOffspringOnDeath = 0;
    this.countOffspringDeaths = 0;
    this.lineageBits = 24;
    this.foodCells = new Map();
    this.creatureCells = new Map();
    this.resize = false;
  }

  function cellKey(cx, cy, eco) {
    var wc = Math.ceil(eco.W / CELL), hc = Math.ceil(eco.H / CELL);
    cx = ((cx % wc) + wc) % wc;
    cy = ((cy % hc) + hc) % hc;
    return cx + ':' + cy;
  }

  Ecosystem.prototype.rebuildCells = function () {
    this.foodCells = new Map();
    for (var i = 0; i < this.food.length; i++) {
      var f = this.food[i];
      if (f.dead || f.energy <= 0) continue;
      var cx = Math.floor(f.x / CELL), cy = Math.floor(f.y / CELL);
      var k = cellKey(cx, cy, this);
      if (!this.foodCells.has(k)) this.foodCells.set(k, []);
      this.foodCells.get(k).push(i);
    }
    this.creatureCells = new Map();
    for (var i2 = 0; i2 < this.creatures.length; i2++) {
      var c = this.creatures[i2];
      if (!c.alive) continue;
      var cx2 = Math.floor(c.x / CELL), cy2 = Math.floor(c.y / CELL);
      var k2 = cellKey(cx2, cy2, this);
      if (!this.creatureCells.has(k2)) this.creatureCells.set(k2, []);
      this.creatureCells.get(k2).push(i2);
    }
  };

  Ecosystem.prototype.cellsAround = function (x, y, range) {
    var out = [];
    var r = Math.ceil(range / CELL);
    var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (var dx = -r; dx <= r; dx++) {
      for (var dy = -r; dy <= r; dy++) {
        out.push(cellKey(cx + dx, cy + dy, this));
      }
    }
    return out;
  };

  Ecosystem.prototype.foodAround = function (x, y, range, self) {
    var out = [];
    var cells = this.cellsAround(x, y, range);
    for (var i = 0; i < cells.length; i++) {
      var arr = this.foodCells.get(cells[i]);
      if (!arr) continue;
      for (var j = 0; j < arr.length; j++) {
        var fi = arr[j];
        var f = this.food[fi];
        if (f.dead) continue;
        var dx = wrapDelta(f.x, x, this.W);
        var dy = wrapDelta(f.y, y, this.H);
        var d2 = dx * dx + dy * dy;
        if (d2 <= range * range) out.push([f, fi]);
      }
    }
    return out;
  };

  Ecosystem.prototype.creaturesAround = function (x, y, range, self) {
    var out = [];
    var cells = this.cellsAround(x, y, range);
    for (var i = 0; i < cells.length; i++) {
      var arr = this.creatureCells.get(cells[i]);
      if (!arr) continue;
      for (var j = 0; j < arr.length; j++) {
        var c = this.creatures[arr[j]];
        if (c === self || !c.alive) continue;
        var dx = wrapDelta(c.x, x, this.W);
        var dy = wrapDelta(c.y, y, this.H);
        var d2 = dx * dx + dy * dy;
        if (d2 <= range * range) out.push(c);
      }
    }
    return out;
  };

  Ecosystem.prototype.spawnFoodPatch = function () {
    var cx = this.rng() * this.W;
    var cy = this.rng() * this.H;
    var n = 4 + Math.floor(this.rng() * 8);
    for (var i = 0; i < n; i++) {
      var f = {
        x: wrap(cx + (this.rng() - 0.5) * 160, this.W),
        y: wrap(cy + (this.rng() - 0.5) * 160, this.H),
        energy: 40,
        maxEnergy: 40,
        r: 2.2,
        dead: false
      };
      this.food.push(f);
    }
  };

  Ecosystem.prototype.spawnToxin = function (x, y, r, power) {
    this.toxins.push({ x: x, y: y, r: r, power: power });
  };

  Ecosystem.prototype.randomToxins = function (n) {
    var base = Math.min(this.W, this.H);
    for (var i = 0; i < n; i++) {
      this.spawnToxin(
        this.rng() * this.W,
        this.rng() * this.H,
        base * (0.07 + this.rng() * 0.08),
        0.25 + this.rng() * 0.45
      );
    }
  };

  Ecosystem.prototype.seedWorld = function (nCreatures, nFoodPatches) {
    this.creatures = [];
    this.food = [];
    for (var i = 0; i < nFoodPatches; i++) this.spawnFoodPatch();
    for (var i2 = 0; i2 < nCreatures; i2++) {
      var genome = Neural.randomGenome(this.rng);
      // Población fundadora: reflejo de forrajeo heredado (evolucionable).
      genome[Neural.N_PHENO - 1] = 0.55 + this.rng() * 0.4;
      var c = new Creature(
        this,
        genome,
        this.rng() * this.W,
        this.rng() * this.H,
        this.rng() * 2 * Math.PI,
        0
      );
      this.creatures.push(c);
    }
    if (this.toxins.length === 0) this.randomToxins(5);
    this.rebuildCells();
  };

  Ecosystem.prototype.tick = function () {
    var dt = 1;
    this.rebuildCells();

    var deadThisStep = [];
    var born = 0;

    for (var i = 0; i < this.creatures.length; i++) {
      var c = this.creatures[i];
      if (!c.alive) continue;
      var res = c.update(this, dt);
      if (res.died) {
        c.alive = false;
        c.deadBy = c.deadBy || 'desconocido';
        deadThisStep.push(c);
        continue;
      }
      // Reproducción asexual por energía acumulada.
      var threshold = c.p.maxEnergy * c.p.repFactor;
      if (this.creatures.length + 1 <= this.popCap &&
          c.energy > threshold &&
          c.age > 80) {
        var off = c.reproduce(this);
        this.creatures.push(off);
        born++;
      }
    }

    // Recuperación de alimentos pastoreados y agotamiento de parches.
    for (var g = 0; g < this.food.length; g++) {
      var fd = this.food[g];
      if (fd.energy <= 0) {
        fd.dead = true;
      } else if (fd.energy < fd.maxEnergy) {
        fd.energy += 0.2;
        if (fd.energy > fd.maxEnergy) fd.energy = fd.maxEnergy;
      }
    }

    // Recolección de comida muerta (compactación ligera).
    if (this.food.length > this.targetFood * 2.5) {
      this.food = this.food.filter(function (f) { return !f.dead; });
    } else {
      // Marcar muerta es suficiente a corto plazo; compactar ocasionalmente.
      for (var f2 = 0; f2 < this.food.length; f2++) {
        if (this.food[f2].dead) this.food[f2] = null;
      }
      var live = [];
      for (var f3 = 0; f3 < this.food.length; f3++) {
        if (this.food[f3]) live.push(this.food[f3]);
      }
      this.food = live;
    }

    // Regeneración de comida para mantener objetivo.
    var aliveFood = this.food.length;
    if (aliveFood < this.targetFood) {
      var spawns = 1 + Math.floor((this.targetFood - aliveFood) / 40);
      for (var s = 0; s < spawns; s++) {
        if (this.rng() < 0.7) this.spawnFoodPatch();
      }
    }

    // Purga de criaturas muertas.
    for (var d = 0; d < deadThisStep.length; d++) {
      var dead = deadThisStep[d];
      this.sumOffspringOnDeath += dead.offspring;
      this.countOffspringDeaths++;
    }
    this.creatures = this.creatures.filter(function (c) { return c.alive; });
    this.deadCount += deadThisStep.length;
    this.birthCount += born;
    this.time += dt;

    // Trazas opcionales.
    if (this.trailEnabled) {
      for (var t = 0; t < this.creatures.length; t++) {
        var cr = this.creatures[t];
        if (!cr.trail) cr.trail = [];
        cr.trail.unshift([cr.x, cr.y]);
        if (cr.trail.length > GRAVITY_TRAILS) cr.trail.pop();
      }
    } else {
      for (var t2 = 0; t2 < this.creatures.length; t2++) {
        if (this.creatures[t2].trail) this.creatures[t2].trail = null;
      }
    }

    return this.snapshot();
  };

  Ecosystem.prototype.lineageInfo = function () {
    var buckets = new Array(this.lineageBits).fill(0);
    for (var i = 0; i < this.creatures.length; i++) {
      var hue = this.creatures[i].p.hue;
      var b = Math.floor(hue / (360 / this.lineageBits));
      if (b >= this.lineageBits) b = this.lineageBits - 1;
      buckets[b]++;
    }
    var species = 0;
    for (var k = 0; k < buckets.length; k++) if (buckets[k] > 0) species++;
    return { buckets: buckets, species: species };
  };

  Ecosystem.prototype.snapshot = function () {
    var pop = this.creatures.length;
    var sumSize = 0, sumSpeed = 0, sumAge = 0;
    for (var i = 0; i < pop; i++) {
      var c = this.creatures[i];
      sumSize += c.p.size;
      sumSpeed += c.p.speed;
      sumAge += c.age;
    }
    var s = {
      time: this.time,
      pop: pop,
      dead: this.deadCount,
      born: this.birthCount,
      food: this.food.length,
      avgSize: pop ? sumSize / pop : 0,
      avgSpeed: pop ? sumSpeed / pop : 0,
      avgAge: pop ? sumAge / pop : 0,
      lineages: this.lineageInfo(),
      avgOffspring: this.countOffspringDeaths
        ? this.sumOffspringOnDeath / this.countOffspringDeaths
        : 0
    };
    if (this.statsHistory.length >= 500) this.statsHistory.shift();
    this.statsHistory.push(s);
    return s;
  };

  Ecosystem.prototype.nearestCreature = function (x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < this.creatures.length; i++) {
      var c = this.creatures[i];
      var d = c.dist2(x, y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return bestD < 64 * 64 ? best : null;
  };

  return {
    Ecosystem: Ecosystem,
    Creature: Creature,
    mulberry32: mulberry32,
    wrapDelta: wrapDelta,
    EYE_ANGLES: EYE_ANGLES
  };
}));