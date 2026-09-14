(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SYM = root.SYM || {};
    root.SYM.Neural = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INPUTS = 13;
  var HIDDEN = 16;
  var OUTPUTS = 3;

  // Genotipo: genes fenotípicos + pesos de la red.
  var PHENO = [
    ['size', 0.6, 2.2],            // radio base
    ['speed', 0.4, 1.8],           // velocidad máxima
    ['eyeRange', 40, 150],         // alcance visual
    ['metabolism', 0.5, 2.0],      // coste metabólico (menor = eficiente)
    ['bite', 0.0, 1.6],            // poder de depredación
    ['repFactor', 0.8, 1.2],       // umbral de reproducción
    ['hue', 0, 360],               // color (linaje)
    ['mutationRate', 0.005, 0.05], // tasa de mutación
    ['reflex', 0, 1]               // fuerza del reflejo innato de forrajeo
  ];

  var N_PHENO = PHENO.length;
  var W1 = INPUTS * HIDDEN;
  var B1 = HIDDEN;
  var W2 = HIDDEN * OUTPUTS;
  var B2 = OUTPUTS;
  var GENOME_LENGTH = N_PHENO + W1 + B1 + W2 + B2;

  function randomGenome(rng) {
    var g = new Float64Array(GENOME_LENGTH);
    for (var i = 0; i < GENOME_LENGTH; i++) g[i] = rng();
    return g;
  }

  // Posición de inicio de cada segmento del genoma.
  function offsets() {
    var o = [0];
    o.push(N_PHENO);
    o.push(N_PHENO + W1);
    o.push(N_PHENO + W1 + B1);
    o.push(N_PHENO + W1 + B1 + W2);
    return o;
  }
  var O = offsets();

  // gauss: media 0, desviación ~0.5
  function gauss(rng) {
    var u = 0;
    for (var i = 0; i < 3; i++) u += rng();
    return (u - 1.5) / 0.5;
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  function phenotypeOf(genome) {
    var p = {};
    for (var i = 0; i < N_PHENO; i++) {
      var gene = PHENO[i];
      var t = clamp01(genome[i]);
      p[gene[0]] = gene[1] + (gene[2] - gene[1]) * t;
    }
    p.radius = 3.0 * p.size;
    p.maxEnergy = 100 * p.size;
    p.maxSpeed = 1.7 * p.speed;
    p.maxTurn = 0.075;
    p.maxAge = Math.round(3600 / p.metabolism);
    return p;
  }

  function mutateGenome(genome, rng, rateOverride) {
    var out = new Float64Array(genome);
    var rate = (rateOverride !== undefined ? rateOverride : (genome[7] + rng() * 0.01));
    for (var i = 0; i < out.length; i++) {
      if (rng() < rate) {
        var v = out[i] + gauss(rng) * 0.18;
        out[i] = clamp01(v);
      }
    }
    // Ocasionalmente una mutación estructural: copia o borrado de un gen.
    if (rng() < 0.01) {
      var j = N_PHENO + Math.floor(rng() * (GENOME_LENGTH - N_PHENO));
      out[j] = clamp01(out[j] + (rng() < 0.5 ? 0.25 : -0.25));
    }
    return out;
  }

  function Brain(genome) {
    // Extrae pesos del vector genoma.
    this.w1 = genome.subarray(O[1], O[1] + W1);
    this.b1 = genome.subarray(O[2], O[2] + B1);
    this.w2 = genome.subarray(O[3], O[3] + W2);
    this.b2 = genome.subarray(O[4], O[4] + B2);
  }

  Brain.prototype.step = function (inputs, p) {
    var h = new Float64Array(HIDDEN);
    for (var j = 0; j < HIDDEN; j++) {
      var s = this.b1[j];
      var row = j * INPUTS;
      for (var i = 0; i < INPUTS; i++) s += this.w1[row + i] * inputs[i];
      h[j] = Math.tanh(s);
    }
    var out = new Float64Array(OUTPUTS);
    for (var j = 0; j < OUTPUTS; j++) {
      var s2 = this.b2[j];
      var row2 = j * HIDDEN;
      for (var i = 0; i < HIDDEN; i++) s2 += this.w2[row2 + i] * h[i];
      if (j === 1) {
        out[j] = Math.tanh(s2);            // steer
      } else {
        out[j] = 1 / (1 + Math.exp(-s2));  // throttle / bite
      }
    }
    // Reflejo innato de forrajeo: punto de partida evolucionable.
    if (p && p.reflex > 0.001) {
      var hunger = inputs[11];
      var centerFood = inputs[4];
      var leftFood = inputs[2];
      var rightFood = inputs[6];
      var rf = p.reflex * hunger * 1.3;
      out[0] += rf * centerFood;
      out[1] += rf * (rightFood - leftFood);
      if (out[0] > 1) out[0] = 1;
      else if (out[0] < 0) out[0] = 0;
      if (out[1] > 1) out[1] = 1;
      else if (out[1] < -1) out[1] = -1;
    }
    return out;
  };

  return {
    INPUTS: INPUTS,
    HIDDEN: HIDDEN,
    OUTPUTS: OUTPUTS,
    PHENO: PHENO,
    N_PHENO: N_PHENO,
    GENOME_LENGTH: GENOME_LENGTH,
    randomGenome: randomGenome,
    phenotypeOf: phenotypeOf,
    mutateGenome: mutateGenome,
    Brain: Brain,
    clamp01: clamp01
  };
}));