'use strict';

const assert = require('assert');
const path = require('path');
const Neural = require(path.join(__dirname, '..', 'js', 'core', 'neural.js'));
const EcosysModule = require(path.join(__dirname, '..', 'js', 'core', 'ecosystem.js'));
const { Ecosystem } = EcosysModule;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('FAIL  ' + name);
    console.error(e && e.stack || e);
    process.exitCode = 1;
  }
}

test('genoma: longitud correcta y fenotipo en rango', () => {
  const g = Neural.randomGenome(() => 0.5);
  assert.strictEqual(g.length, Neural.GENOME_LENGTH);
  const p = Neural.phenotypeOf(g);
  assert.ok(p.size >= 0.6 && p.size <= 2.2);
  assert.ok(p.eyeRange >= 40 && p.eyeRange <= 150);
  assert.ok(p.hue >= 0 && p.hue <= 360);
  assert.ok(Number.isFinite(p.radius) && p.radius > 0);
});

test('mutación: cambia genes y respeta rango [0,1]', () => {
  let rng = EcosysModule.mulberry32(42);
  const g = Neural.randomGenome(rng);
  const m = Neural.mutateGenome(g, rng);
  let diff = 0;
  for (let i = 0; i < g.length; i++) {
    assert.ok(m[i] >= 0 && m[i] <= 1, 'gen fuera de rango');
    if (g[i] !== m[i]) diff++;
  }
  assert.ok(diff > 0, 'la mutación no cambió ningún gen');
});

test('cerebro: forward pass produce 3 salidas finitas', () => {
  const g = Neural.randomGenome(EcosysModule.mulberry32(7));
  const brain = new Neural.Brain(g);
  const inputs = new Array(Neural.INPUTS).fill(0.5);
  const out = brain.step(inputs);
  assert.strictEqual(out.length, 3);
  for (const v of out) assert.ok(Number.isFinite(v));
  assert.ok(out[0] >= 0 && out[0] <= 1, 'throttle fuera de [0,1]');
  assert.ok(out[1] >= -1 && out[1] <= 1, 'steer fuera de [-1,1]');
  assert.ok(out[2] >= 0 && out[2] <= 1, 'bite fuera de [0,1]');
});

test('determinismo: mismas semillas producen misma evolución', () => {
  function run(seed) {
    const eco = new Ecosystem({ W: 400, H: 300, seed, popCap: 3000 });
    eco.targetFood = 200;
    eco.seedWorld(30, 20);
    let s;
    for (let t = 0; t < 500; t++) s = eco.tick();
    return { pop: s.pop, food: s.food, born: s.born, dead: s.dead, off: s.avgOffspring };
  }
  const a = run(99);
  const b = run(99);
  assert.deepStrictEqual(a, b);
});

test('evolución: la población sobrevive, se reproduce y no se extingue (6000 ticks)', () => {
  const eco = new Ecosystem({ W: 640, H: 400, seed: 2024, popCap: 4000 });
  eco.targetFood = 300;
  eco.seedWorld(40, 30);
  let final, peak = 0;
  for (let t = 0; t < 6000; t++) {
    final = eco.tick();
    if (final.pop > peak) peak = final.pop;
  }
  const allFinite = () => ['pop','born','dead','food','avgSize','avgSpeed','avgAge','avgOffspring']
    .every(k => Number.isFinite(final[k]));
  assert.ok(allFinite(), 'estadísticas con NaN');
  assert.ok(eco.birthCount > 50, 'se reprodujeron demasiado poco (' + eco.birthCount + ')');
  assert.ok(final.pop > 0, 'la población se extinguió');
  assert.ok(final.lineages.species >= 1, 'diversidad desapareció');
  assert.ok(peak >= 40, 'la población nunca creció');
  console.log('      población final:', final.pop, '· pico:', peak,
    '· nacimientos:', eco.birthCount, '· linajes:', final.lineages.species,
    '· fitness medio:', final.avgOffspring.toFixed(2));
});

test('depredación: existe con potencia de mordisco (no rompe el mundo)', () => {
  const eco = new Ecosystem({ W: 300, H: 300, seed: 555, popCap: 1000 });
  eco.targetFood = 120;
  eco.seedWorld(20, 10);
  for (let t = 0; t < 1000; t++) eco.tick();
  // Sólo saneza: no debe haber NaN y el tiempo debe avanzar.
  assert.ok(Number.isFinite(eco.time) && eco.time === 1000);
  assert.ok(eco.creatures.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
});

test('mundo tórico: las posiciones envuelven en ambos ejes', () => {
  const eco = new Ecosystem({ W: 300, H: 200, seed: 1, popCap: 500 });
  eco.seedWorld(5, 5);
  for (let t = 0; t < 200; t++) eco.tick();
  for (const c of eco.creatures) {
    assert.ok(c.x >= 0 && c.x <= 300, 'x fuera de rango');
    assert.ok(c.y >= 0 && c.y <= 200, 'y fuera de rango');
  }
});

console.log(`\n${passed} pruebas superadas.`);