# 🦉 Euskaltxo — Aprende euskera jugando

Una aplicación web completa estilo **Duolingo** para aprender **euskera** desde español. Sin dependencias, sin build, sin cuenta: abre `index.html` y a aprender.

## 🎓 Nivel A1 oficial

El curso está alineado con el **HEOC** (Currículo Básico para la Enseñanza del Euskera a Personas Adultas, de [HABE](https://www.habe.euskadi.eus/acreditacion-niveles-euskera/webhabe00-edukiak/es/)), el marco que define los niveles oficiales A1–C2 de euskera según el MCER. Las 16 unidades cubren los ámbitos temáticos, funciones comunicativas y gramática del nivel **A1 (usuario inicial)**: saludos y cortesía, presentarse, números y edad, familia, descripciones, colores, la casa, rutinas diarias, la hora y la semana, comida y pedir en el bar, compras, la ciudad y direcciones, transporte, el tiempo, ocio y gustos, y trabajo.

El nivel se corona con la **Azterketa A1**: un examen final de 20 preguntas (máximo 3 fallos) que simula la evaluación del nivel. Los niveles **A2, B1…** aparecen en el camino y se irán desbloqueando progresivamente.

## ✨ Características

- **16 unidades A1** con ~190 palabras y ~85 frases reales en euskera, más **notas de gramática** por unidad (izan/egon/ukan, casos -n/-ra/-z/-koa, demostrativos, presente habitual, gustatzen zait…).
- **Camino de lecciones** estilo Duolingo: 4 lecciones por unidad (3 + repaso), con desbloqueo progresivo y examen final de nivel.
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
| `data.js` | Contenido del curso: niveles, unidades (palabras, frases, gramática) y examen |
| `app.js` | Motor: estado, ejercicios, vidas, rachas, audio y render |

## ➕ Añadir contenido

Añade unidades o palabras editando `data.js` — los ejercicios se generan solos. Los niveles futuros (A2, B1…) están declarados en `LEVELS` listos para recibir sus unidades:

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
