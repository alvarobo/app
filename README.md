# 🦉 Euskaltxo — Aprende euskera jugando

Una aplicación web completa estilo **Duolingo** para aprender **euskera** desde español. Sin dependencias, sin build, sin cuenta: abre `index.html` y a aprender.

## ✨ Características

- **10 unidades** con +100 palabras y frases reales en euskera: saludos, personas, números, colores, familia, comida, animales, verbos, días y frases útiles.
- **Camino de lecciones** estilo Duolingo: 4 lecciones por unidad (3 + repaso), con desbloqueo progresivo.
- **6 tipos de ejercicio**, generados automáticamente:
  - Elección múltiple euskera → español
  - Elección múltiple español → euskera
  - Comprensión auditiva («¿Qué has oído?») con síntesis de voz
  - Unir parejas
  - Traducir frases con banco de palabras
  - Escribir la traducción
- **Vidas (❤️)**: pierdes una por fallo, se regeneran cada 30 min, se recuperan practicando o con gemas.
- **Racha diaria (🔥)**, **XP y niveles (⚡)** y **gemas (💎)** con bonus por lección perfecta y combos.
- **Modo práctica**: repasa todo lo aprendido sin gastar vidas y gana +1 ❤️.
- **Perfil** con estadísticas y progreso por unidad.
- **Audio**: pronunciación con la Web Speech API (usa voz en euskera si el navegador dispone de ella) y efectos de sonido.
- **Progreso guardado** automáticamente en el navegador (`localStorage`).
- Diseño responsive, pensado para móvil y escritorio.

## 🚀 Cómo ejecutarla

No necesita instalación ni servidor:

```bash
# opción 1: abrir directamente
open index.html

# opción 2: servir en local (recomendado)
python3 -m http.server 8000
# → http://localhost:8000
```

## 🗂️ Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Punto de entrada |
| `styles.css` | Estilos (look & feel tipo Duolingo) |
| `data.js` | Contenido del curso: unidades, palabras y frases |
| `app.js` | Motor: estado, ejercicios, vidas, rachas, audio y render |

## ➕ Añadir contenido

Añade unidades o palabras editando `data.js` — los ejercicios se generan solos:

```js
{
  id: "ropa",
  title: "Ropa",
  subtitle: "Vístete en euskera",
  icon: "👕",
  color: "#1cb0f6",
  words: [ { eu: "alkandora", es: "camisa" }, ... ],
  phrases: [ { eu: "Alkandora urdina da", es: "La camisa es azul" }, ... ],
}
```

Zorionak eta ekin! 🎉
