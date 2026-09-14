# Ecosistema digital

Simulador autónomo de criaturas con redes neuronales que evolucionan en un mundo 2D con selección natural, depredación, pastoreo y presión tóxica.

## Qué es

Un laboratorio vivo en tu navegador. Organismos digitales nacen, buscan comida, comen, reproducen y mueren. Su comportamiento esgobernado por pequeñas redes neuronales cuyos pesos se heredan y mutan. Con el tiempo, la selección natural optimiza eficiencia metabólica, tamaño y estrategias de pastoreo — sin intervención humana.

## Por qué existe

Para observar evolución en tiempo real. El color de cada criatura indica su linaje: ver cómo una variedad inicial de colores converge en pocas dominantes es la forma más directa de presenciar selección natural. Y se puede interactuar: hacer zoom, clicar para ver el cerebro de un organismo, inyectar mutación masiva, ajustar la densidad de comida.

## Características

- **Redes neuronales**: 13 sensores de visión (5 ojos, cada uno detecta comida y criaturas cercanas), 16 neuronas ocultas, 3 salidas (acelerar, girar, morder).
- **Reflejo evolucionable**: un gen `reflex` controla la fuerza de un instinto innato de pastoreo; las mutaciones pueden eliminarlo o amplificarlo.
- **Pastoreo continuo**: la comida se comporta como hierba que se regenera, permitiendo territorios y estabilidad ecológica.
- **Depredación**: si una criatura tiene la salida `bite` activa y solapa a otra, le roba energía (la selección natural decide si conviene la depredación o el pastoreo).
- **Toxinas**: parches morados del mundo drenan energía, creando presión de selección espacial.
- **Zoom, pan e inspección**: rueda del ratón, arrastrar, clicar para ver fenotipo, cerebral y detalles.
- **Gráficas en vivo**: población, diversidad de linajes, fitness promedio al morir.
- **Cero dependencias**: un solo HTML + JavaScript vanilla; funciona desde `file://`.

## Instalación

```bash
# Clonar
cd /ruta/al/proyecto
git init

# Abrir en navegador
xdg-open index.html    # Linux
# o
open index.html         # macOS
```

## Uso

```bash
# Ejecutar tests del núcleo (Node.js)
node tests/core.test.js

# Abrir el simulador en el navegador
xdg-open index.html
```

### Controles del navegador

| Acción | Cómo |
|---|---|
| Zoom | Rueda del ratón |
| Mover cámara | Arrastrar con el ratón |
| Inspeccionar criatura | Clic sobre ella |
| Pausar/Reanudar | Botones `▶ Ejecutar` / `⏸ Pausar` |
| Reiniciar con nueva semilla | Escribir semilla + botón `↺ Reiniciar` |
| Inyectar variabilidad genética | Botón `Mutación masiva` |
| Ver trazas | Botón `Trazas` |
| Ver zonas tóxicas | Botón `Toxinas` |

### Panel de inspección (criatura)

Al clicar una criatura se muestra:

- **Generación**, edad, energía actual, número de crías.
- **Genoma fenotípico**: tamaño, velocidad, rango visual, metabolismo, depredación, umbral de cría, tasa de mutación, reflex.
- **Cerebro**: representación visual de la red neuronal (13 sensores → 16 ocultas → 3 salidas) con activaciones en vivo.

## Arquitectura

```
index.html              ← interfaz
js/
  core/
    neural.js           ← genoma + red neuronal (testable en Node)
    ecosystem.js        ← motor: criaturas, comida, toxinas, celdas espaciales (testable en Node)
  render.js             ← canvas 2D, zoom/pan, selección
  ui.js                 ← paneles de control, gráficas, inspector
  main.js               ← bucle principal y arranque
tests/
  core.test.js          ← suite Node (determinismo, evolución, tórico, depredación)
```

El núcleo (`neural.js` + `ecosystem.js`) es puro: sin DOM, sin canvas, testeable en Node. Los archivos de interfaz solo se ejecutan en navegador.

## Ejemplo de lo que verás

1. Al reiniciar, 140 criaturas con colores variados (linajes distintos) pastan en el mundo.
2. Tras ~2000 ticks, los linajes menos eficientes desaparecen; dominan 5-10 colores.
3. Clicar una criatura muestra su cerebro trabajando en vivo: los sensores de comida se encienden al mirar un parche.
4. La comida se oscurece donde el pastoreo la consume y se regenera donde no la tocan: la distribución de nutrientes es dinámica.
5. Si activas toxinas, las criaturas las evolucionan: aprender a esquivarlas con el tiempo.
6. Pulsar "Mutación masiva" provoca un choque genético: aparecen nuevos comportamientos, linajes emergen.

## Estado

- Núcleo funcional y testeado (7 pruebas).
- Evolución observable (metabolismo, tamaño, fitness cambian a lo largo del tiempo).
- Población estable en equilibrio dinámico (oscila alrededor de la capacidad de carga del alimento).
- Interfaz funcional con zoom, pan, inspección, gráficas y controles.
- Pendiente: futuras mejoras (reproducción sexual, especiación formal, almacenamiento de historial a disco).

## Licencia

MIT