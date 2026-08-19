# Reconstrucción de la rutina — fiel a Nippard BTS + complementos

Brief para Claude Code. Objetivo: reemplazar el objeto `PROGRAM` dentro de
`index.html` por una versión **fiel a la rutina real de Jeff Nippard**
(Bodybuilding Transformation System, Intermediate-Advanced) más tres
complementos que el usuario pidió: antebrazo directo, cardio integrado y core.

**Contexto crítico:** la versión actual del `PROGRAM` en `index.html` contiene
modificaciones inventadas (ejercicios con 5 series, remos asimétricos 3+1, un
"salto vertical", volúmenes inflados) que NO corresponden a Nippard. Además, el
`CYCLE` actual (9 semanas con `setMod` y técnicas genéricas) también está
inventado y debe reemplazarse por la periodización REAL de Nippard (12 semanas,
detallada en la sección 2-BIS). Hay que reemplazar esos datos por los datos
literales de este documento. La infraestructura de la app (UI, gráficas,
selección de variantes, draft-autosave, toggle kg/lb) NO se toca — solo cambian
los datos de la rutina y la lógica de progresión semanal.

**LO MÁS IMPORTANTE DE ESTA REVISIÓN:** la rutina de Nippard NO es de series
fijas. Tiene una periodización de 12 semanas donde (a) las series de trabajo de
cada ejercicio suben de forma escalonada semana a semana, y (b) cada ejercicio
tiene una técnica de intensidad asignada para su última serie a partir de las
semanas de acumulación. Esto está en la sección 2-BIS y es obligatorio.

---

## 0. Regla de oro de Nippard

La estructura real es **uniforme: 2 series de trabajo por ejercicio**, casi sin
excepciones. El principio es "más ejercicios distintos, cada uno a 2 series
duras" en lugar de "pocos ejercicios con muchas series". Las ÚNICAS excepciones
a 1 serie de trabajo son dos ejercicios que en semanas posteriores usan técnica
de intensidad (Myo-reps): **Machine Preacher Curl** (Pull) y **Cable Triceps
Kickback** (Push). Todo lo demás es 2 series.

La progresión NO es por añadir series: la semana 1 es intro/deload (RPE ~7-9), y
de la semana 2 en adelante la última serie de cada ejercicio va al fallo. El
volumen de series se mantiene constante a lo largo del ciclo.

**No "mejorar" la rutina.** Copiarla fielmente. Las decisiones de diseño del
usuario ya están tomadas (ver sección 4).

---

## 1. Esquema de datos del `PROGRAM` (respetar EXACTAMENTE)

Cada día del `PROGRAM` tiene esta forma (tomada del `index.html` actual):

```js
const PROGRAM = {
  lun: { name:"Upper", sub:"Fuerza",
    warm:[ "texto de calentamiento", ... ],
    slots:[
      { id:"lun_press_inc",     // id único del slot: prefijo del día + nombre corto
        m:"Pecho",              // grupo muscular (para el conteo de volumen)
        setsByWeek:[2,3,3,3,3,2,3,3,3,3,4,4], // series de trabajo semana 1→12 (ver sección 2-BIS)
        tech:"failure",         // técnica de última serie: "failure" | "failure_llp" | "myoreps" | "static_stretch"
        lo:6, hi:8,             // rango de reps (lo=mínimo, hi=máximo)
        rest:"3-5 min",         // descanso literal de Nippard
        def:[0,1],              // índices de las variantes por defecto marcadas
        v:[                     // variantes: la 1ª es el ejercicio principal, las otras 2 son las substituciones reales de Nippard
          {id:"inc_bb", n:"Press inclinado con barra 45°", t:"bar", bar:"std", f:1.00, note:"nota técnica real de Nippard"},
          {id:"inc_db", n:"Press inclinado con mancuernas", t:"perSide", f:0.50, note:"..."},
          {id:"inc_mach", n:"Press inclinado en máquina", t:"load", f:1.15, note:"..."},
        ]
      },
      ...
    ]
  },
  mar: { ... },
  jue: { ... },
  vie: { ... },
  sab: { ... },
}
```

### Significado de los campos de cada variante
- `t` (tipo de carga): `"bar"` (barra, usa `bar:` para cuál), `"load"` (peso
  directo tipo máquina/polea), `"perSide"` (peso por mancuerna/lado), `"bw"`
  (peso corporal), `"assist"` (máquina asistida, el peso es la ayuda).
- `f`: factor de carga efectiva relativo (mantener los que ya usa la app para
  variantes equivalentes; para ejercicios nuevos, estimar razonablemente:
  1.00 = referencia, máquinas ~1.10-1.15, mancuerna por lado ~0.50).
- `bar`: sólo si `t:"bar"`. Valores: `"std"` (20kg), `"ez"` (10kg), `"smith"` (15kg).
- `note`: la nota técnica **real** de Nippard (traducida al español, tono directo).

### IDs
Mantener el patrón `dia_nombrecorto` para slots (p.ej. `jue_row_cs`), y un id
corto para cada variante (p.ej. `row_tbar`). Deben ser únicos.

### Cambio de `sets` → `setsByWeek`
El código actual usa `sets:N` (fijo) y funciones como `setsOf(slot)` que
devuelven ese número, más un `setMod` del CYCLE que lo ajustaba. Eso se
reemplaza: ahora la cantidad de series sale de `slot.setsByWeek[cycleWeek()-1]`.
Hay que actualizar toda función que lea `slot.sets` para que lea la de la semana
activa. Eliminar la lógica de `setMod` del CYCLE (ya no aplica: la progresión de
series vive en `setsByWeek`).

---

## 2. LA RUTINA LITERAL DE NIPPARD (datos a implementar)

Todos los ejercicios son **2 series** salvo donde diga explícitamente 1 serie.
Formato de cada línea: **Ejercicio principal** · reps · descanso · [Sub 1] ·
[Sub 2] · nota técnica.

### LUNES — Upper (Fuerza) — `lun`
1. **45° Incline Barbell Press** · 6-8 · 3-5 min · [45° Incline DB Press] · [45° Incline Machine Press] · "Pausa 1s abajo manteniendo tensión en el pecho."
2. **Cable Crossover Ladder** · 8-10 · 1-2 min · [Pec Deck] · [Bottom-Half DB Flye] · "Una serie con polea baja, una con polea media, una con polea alta. Si sólo tienes 2 series, elige las 2 posiciones que prefieras."
3. **Wide-Grip Pull-Up** · 8-10 · 2-3 min · [Wide-Grip Lat Pulldown] · [Dual-Handle Lat Pulldown] · "Agarre 1.5x hombros. Negativo lento 2-3s. Siente los dorsales separándose al bajar."
4. **High-Cable Lateral Raise** · 8-10 · 1-2 min · [High-Cable Cuffed Lateral Raise] · [Lean-In DB Lateral Raise] · "Enfócate en apretar el deltoide lateral para mover el peso."
5. **Pendlay Deficit Row** · 6-8 · 2-3 min · [Smith Machine Row] · [Single-Arm DB Row] · "Párate sobre un disco. Busca un gran estiramiento y toca el abdomen/pecho en cada rep."
6. **Overhead Cable Triceps Extension (Bar)** · 8-10 · 1-2 min · [Overhead Cable Triceps Extension (Rope)] · [DB Skull Crusher] · "Opcional: pausa 0.5-1s en el estiramiento de cada rep."
7. **Bayesian Cable Curl** · 8-10 · 1-2 min · [Seated Super-Bayesian High Cable Curl] · [Incline DB Stretch Curl] · "Si tienes desbalance izq/der, hazlas a 1 brazo empezando por el débil, y luego iguala reps con el otro."

### MARTES — Lower (Fuerza) — `mar`
1. **Lying Leg Curl** · 8-10 · 1-2 min · [Seated Leg Curl] · [Nordic Ham Curl] · "Ajusta la máquina para el mayor estiramiento posible abajo. Evita que el glúteo se despegue."
2. **Smith Machine Squat** · 6-8 · 3-5 min · [DB Bulgarian Split Squat] · [High-Bar Back Squat] · "Pies ~3-6 pulgadas adelante para una sentadilla más vertical con más tensión en cuádriceps."
3. **Barbell RDL** · 6-8 · 2-3 min · [DB RDL] · [Snatch-Grip RDL] · "Para mantener tensión en isquios, detente al 75% del lockout (quédate en los 3/4 bajos del ROM)."
4. **Leg Extension** · 8-10 · 1-2 min · [Reverse Nordic] · [Sissy Squat] · "Respaldo lo más atrás posible. Agarra fuerte los mangos. Negativo 2-3s."
5. **Standing Calf Raise** · 8-10 · 1-2 min · [Seated Calf Raise] · [Leg Press Calf Press] · "Pausa 1-2s abajo. Rueda el tobillo sobre la punta del pie."
6. **Cable Crunch** · 8-10 · 1-2 min · [Decline Weighted Crunch] · [Machine Crunch] · "Redondea la zona lumbar al encoger. Conexión mente-músculo con el abdomen."

### JUEVES — Pull (Hipertrofia) — `jue`
1. **Neutral-Grip Lat Pulldown** · 8-10 · 2-3 min · [Neutral-Grip Pull-Up] · [Dual-Handle Lat Pulldown] · "Mango más al frente, como un cruce entre pullover y jalón. Siente los dorsales más que el peso."
2. **Chest-Supported Machine Row** · 8-10 · 2-3 min · [Chest-Supported T-Bar Row] · [Incline Chest-Supported DB Row] · "Codos ~45°, aprieta fuerte las escápulas arriba en cada rep."
3. **Neutral-Grip Seated Cable Row** · 10-12 · 2-3 min · [Helms Row] · [Meadows Row] · "Aprieta las escápulas, lleva los codos abajo y atrás." (NOTA: el usuario confirmó mantener los DOS remos distintos a 2 series cada uno.)
4. **1-Arm 45° Cable Rear Delt Flye** · 10-12 · 1-2 min · [Rope Face Pull] · [Reverse Pec Deck] · "Pausa 1-2s en la contracción. ¡Aprieta fuerte el deltoide posterior!" (2 series — NO 5.)
5. **Machine Shrug** · 10-12 · 1-2 min · [Cable Paused Shrug-In] · [DB Shrug] · "Breve pausa arriba. Piensa en subir los hombros hacia las orejas."
6. **EZ-Bar Curl** · 10-12 · 1-2 min · [Cable EZ-Bar Curl] · [DB Curl] · "Tensión constante en el bíceps. Reps lentas y controladas."
7. **Machine Preacher Curl** · 12-15 · 1-2 min · **1 SERIE (Myo-reps en semanas ≥2)** · [EZ-Bar Preacher Curl] · [DB Preacher Curl] · "Reps suaves y controladas. Conexión mente-músculo."

### VIERNES — Push (Hipertrofia) — `vie`
1. **Barbell Bench Press** · 8-10 · 3-5 min · [Machine Chest Press] · [DB Bench Press] · "Arco cómodo, pausa breve en el pecho y explota hacia arriba."
2. **Machine Shoulder Press** · 8-10 · 2-3 min · [Cable Shoulder Press] · [Seated DB Shoulder Press] · "Rompe al menos 90° con los codos. Conexión mente-músculo con los deltoides."
3. **Bottom-Half DB Flye** · 10-12 · 1-2 min · [Bottom-Half Seated Cable Flye] · [Low-to-High Cable Crossover] · "Todas las reps en la mitad baja del ROM. Busca un estiramiento profundo del pectoral."
4. **High-Cable Lateral Raise** · 10-12 · 1-2 min · [High-Cable Cuffed Lateral Raise] · [Lean-In DB Lateral Raise] · "Aprieta el deltoide lateral para mover el peso."
5. **Overhead Cable Triceps Extension (Bar)** · 10-12 · 1-2 min · [Overhead Cable Triceps Extension (Rope)] · [DB Skull Crusher] · "Opcional: pausa 0.5-1s en el estiramiento."
6. **Cable Triceps Kickback** · 12-15 · 1-2 min · **1 SERIE (Myo-reps en semanas ≥2)** · [DB Triceps Kickback] · [Bench Dip] · "En la contracción completa, el hombro debe quedar detrás del torso."
7. **Roman Chair Leg Raise** · 10-20 · 1-2 min · [Hanging Leg Raise] · [Modified Candlestick] · "Deja que la lumbar se redondee al subir las piernas. El rango 10-20 es amplio a propósito: ve hasta el RPE indicado con forma controlada."

### SÁBADO — Legs (Hipertrofia) — `sab`
1. **Leg Press** · 8-10 · 2-3 min · [Smith Machine Static Lunge] · [DB Walking Lunge] · "Pies más abajo en la plataforma = más cuádriceps. Baja profundo sin redondear la espalda."
2. **Seated Leg Curl** · 10-12 · 1-2 min · [Lying Leg Curl] · [Nordic Ham Curl] · "Inclínate hacia adelante sobre la máquina para máximo estiramiento de isquios."
3. **DB Bulgarian Split Squat** · 8-10 · 2-3 min · [DB Step-Up] · [Goblet Squat] · "Baja hasta que el muslo delantero quede paralelo al piso. Empuja con el talón delantero."
4. **Leg Extension** · 10-12 · 1-2 min · [Reverse Nordic] · [Sissy Squat] · "Respaldo lo más atrás posible. Negativo 2-3s."
5. **Machine Hip Adduction** · 10-12 · 1-2 min · [Cable Hip Adduction] · [Copenhagen Hip Adduction] · "Conexión mente-músculo con los aductores. Excelentes para masa de muslo frontal."
6. **Machine Hip Abduction** · 10-12 · 1-2 min · [Cable Hip Abduction] · [Lateral Band Walk] · "Si puedes, usa pads para más ROM. Inclínate al frente y agárrate para estirar más el glúteo."
7. **Standing Calf Raise** · 10-12 · 1-2 min · [Seated Calf Raise] · [Leg Press Calf Press] · "Pausa 1-2s abajo. Rueda el tobillo sobre la punta del pie."

**Grupos musculares (`m:`) sugeridos por ejercicio** para el conteo de volumen:
Pecho, Espalda, Hombro, Cuádriceps, Isquios, Glúteo, Gemelo, Bíceps, Tríceps,
Core, Antebrazo. Asignar el que corresponda a cada movimiento.

---

## 2-BIS. PERIODIZACIÓN DE 12 SEMANAS (el corazón de Nippard — OBLIGATORIO)

Esta es la capa que faltaba. El programa son **12 semanas en dos bloques de 6**.
Cada bloque abre con una **semana intro/suave** (semanas 1 y 6) y sigue con
semanas de acumulación donde la última serie va al fallo con una técnica de
intensidad.

### Estructura de semanas

| Semana | Tipo | RPE última serie | ¿Fallo? | ¿Técnicas? |
|--------|------|------------------|---------|------------|
| 1 | Intro bloque 1 | ~7-8 | No (deja 2-3 reps) | No |
| 2 | Acumulación | 10 (fallo) | Sí | Sí |
| 3 | Acumulación | 10 | Sí | Sí |
| 4 | Acumulación | 10 | Sí | Sí |
| 5 | Acumulación | 10 | Sí | Sí |
| 6 | Intro bloque 2 | ~7-8 | No | No |
| 7 | Acumulación | 10 | Sí | Sí |
| 8 | Acumulación | 10 | Sí | Sí |
| 9 | Acumulación | 10 | Sí | Sí |
| 10 | Acumulación | 10 | Sí | Sí |
| 11 | Pico | 10 | Sí | Sí |
| 12 | Pico | 10 | Sí | Sí |

**Nota:** las semanas intro (1 y 6) son las "suaves/deload" del sistema — NO hay
una semana de descarga al final; el bloque 2 termina en pico (semanas 11-12 con
el volumen más alto). Las técnicas de intensidad aparecen SOLO en semanas de
acumulación/pico (todas menos la 1 y la 6).

### Progresión de series por ejercicio (matriz completa)

**Cada ejercicio tiene su propia curva de series** — NO es uniforme. La cadena
de 12 dígitos es el número de series de trabajo en las semanas 1→12. Esta matriz
sale directo del Excel y debe implementarse tal cual.

```
UPPER (lun)
  45° Incline Barbell Press ............ 2 3 3 3 3 2 3 3 3 3 4 4   · Failure
  Cable Crossover Ladder ............... 2 2 2 2 2 2 3 3 3 3 3 3   · Failure
  Wide-Grip Pull-Up .................... 2 3 3 3 3 2 3 3 3 3 3 3   · Failure
  High-Cable Lateral Raise ............. 2 2 2 2 2 2 2 2 2 2 3 3   · Failure
  Pendlay Deficit Row .................. 2 2 2 2 2 2 3 3 3 3 3 3   · Failure + LLPs
  Overhead Cable Triceps Ext (Bar) ..... 2 2 2 2 2 2 2 2 3 3 3 3   · Failure
  Bayesian Cable Curl .................. 2 2 2 2 2 2 2 2 3 3 3 3   · Failure

LOWER (mar)
  Lying Leg Curl ....................... 2 2 2 2 2 2 2 2 3 3 3 3   · Failure + LLPs
  Smith Machine Squat .................. 2 2 3 3 3 2 3 3 3 3 3 3   · Failure
  Barbell RDL .......................... 2 2 3 3 3 2 3 3 3 3 4 4   · Failure
  Leg Extension ........................ 2 2 2 2 2 2 3 3 3 3 3 3   · Failure
  Standing Calf Raise .................. 2 2 2 2 2 2 3 3 3 3 4 4   · Static Stretch 30s
  Cable Crunch ......................... 2 2 2 2 2 2 2 2 3 3 3 3   · Failure

PULL (jue)
  Neutral-Grip Lat Pulldown ............ 2 2 2 2 2 2 3 3 3 3 3 3   · Failure
  Chest-Supported Machine Row .......... 2 3 3 3 3 2 3 3 3 3 4 4   · Failure
  Neutral-Grip Seated Cable Row ........ 2 2 2 2 2 2 2 2 3 3 3 3   · Failure + LLPs
  1-Arm 45° Cable Rear Delt Flye ....... 2 2 2 2 2 2 3 3 3 3 3 3   · Myo-reps
  Machine Shrug ........................ 2 2 2 2 2 2 2 2 3 3 3 3   · Failure
  EZ-Bar Curl .......................... 2 2 2 2 2 2 3 3 3 3 3 3   · Failure
  Machine Preacher Curl ................ 1 1 1 1 1 1 2 2 2 2 3 3   · Myo-reps

PUSH (vie)
  Barbell Bench Press .................. 2 3 3 3 3 2 3 3 3 3 4 4   · Failure
  Machine Shoulder Press ............... 2 2 2 2 2 2 3 3 3 3 3 3   · Failure
  Bottom-Half DB Flye .................. 2 2 2 2 2 2 2 2 3 3 3 3   · Failure
  High-Cable Lateral Raise ............. 2 2 2 2 2 2 2 2 3 3 3 3   · Myo-reps
  Overhead Cable Triceps Ext (Bar) ..... 2 2 2 2 2 2 3 3 3 3 3 3   · Failure
  Cable Triceps Kickback ............... 1 1 1 1 1 1 2 2 2 2 3 3   · Myo-reps
  Roman Chair Leg Raise ................ 2 2 2 2 2 2 2 2 3 3 3 3   · Failure

LEGS (sab)
  Leg Press ............................ 2 3 3 3 3 2 3 3 3 3 4 4   · Failure
  Seated Leg Curl ...................... 2 2 2 2 2 2 3 3 3 3 4 4   · Failure + LLPs
  DB Bulgarian Split Squat ............. 2 2 2 2 2 2 2 2 2 2 2 2   · Failure
  Leg Extension ........................ 2 2 2 2 2 2 2 2 3 3 3 3   · Myo-reps
  Machine Hip Adduction ................ 2 2 2 2 2 2 2 2 3 3 3 3   · Failure
  Machine Hip Abduction ................ 2 2 2 2 2 2 2 2 3 3 3 3   · Failure
  Standing Calf Raise .................. 2 2 2 2 2 2 2 2 3 3 3 3   · Static Stretch 30s
```

**Cómo implementarlo:** en vez de un `sets:N` fijo por slot, cada slot debe
llevar un arreglo de 12 posiciones, p.ej. `setsByWeek:[2,3,3,3,3,2,3,3,3,3,4,4]`.
La app, según la semana activa del ciclo, lee `setsByWeek[semana-1]` y renderiza
esa cantidad de series. La técnica va en un campo `tech:"failure"` (o el que
corresponda) en el slot.

### Las técnicas de intensidad (con explicación para mostrar en la app)

El usuario pidió que la app muestre la técnica exacta cada semana CON
explicación. Definir un diccionario de técnicas y, en semanas de acumulación,
mostrar la del ejercicio en su última serie. En semanas intro (1 y 6) NO se
muestra técnica (solo "deja 2-3 reps en reserva, RPE 7-8").

- **Failure (Fallo):** "Lleva la última serie al fallo muscular: hasta que no
  puedas completar otra repetición con buena forma."
- **Failure + LLPs (Extend set / Fallo + parciales de rango largo):** "Al llegar
  al fallo con reps completas, sigue haciendo repeticiones parciales en el rango
  largo (la parte estirada del movimiento) hasta que ya no puedas más."
- **Myo-reps:** "Haz una serie de activación al fallo (o RPE 9-10). Descansa
  solo 15-20 segundos (3-5 respiraciones), haz 3-5 reps más, y repite ese
  mini-ciclo 3-4 veces. Acumulas muchas reps efectivas en poco tiempo."
- **Static Stretch (30s / Estiramiento cargado):** "Tras la última serie,
  mantén una posición de estiramiento cargado del músculo durante 30 segundos
  (p.ej. en el gemelo, aguanta abajo con el peso). Estímulo de crecimiento por
  tensión en estiramiento."

### RPE por semana

- **Semanas 1 y 6 (intro):** todas las series a RPE ~7-8, dejando 2-3 reps en el
  tanque. Sin fallo, sin técnicas. Es preparación/readaptación.
- **Resto de semanas (acumulación/pico):** series tempranas (early sets) a RPE
  ~8-9, y la **última serie al fallo** (RPE 10) aplicando la técnica asignada.

### El nuevo objeto CYCLE

Reemplazar el `CYCLE` actual (9 semanas inventado) por uno de 12 entradas que
codifique lo anterior. Estructura sugerida por entrada:

```js
{ n:1, tipo:"Intro",       rpe:"7-8", failure:false, tech:null,
  note:"Semana de entrada. Deja 2-3 reps en reserva en todas las series. Sin fallo. Prepara el bloque." }
{ n:2, tipo:"Acumulación", rpe:"8-9", failure:true,  tech:"asignada",
  note:"Última serie al fallo con la técnica de cada ejercicio." }
// ... 3,4,5 = Acumulación (igual que 2)
// 6 = Intro (igual que 1, abre el bloque 2)
// 7,8,9,10 = Acumulación
// 11,12 = Pico (mismo RPE, máximo volumen según la matriz)
```

La cantidad de series NO va en el CYCLE (va por ejercicio en `setsByWeek`). El
CYCLE solo define el carácter de la semana (intro vs acumulación/pico), el RPE,
si hay fallo, y si se muestran técnicas. La técnica concreta se lee del slot del
ejercicio, no del CYCLE (porque varía por ejercicio).

---

## 3. Los tres complementos del usuario

### 3.1 Antebrazo (falta en Nippard puro)
Elegido para desarrollo completo del antebrazo (flexores + extensores + grip).
Agregar como slots nuevos, **2 series cada uno**, en los días de tirón donde el
antebrazo ya está caliente: **Lunes (Upper)** y **Jueves (Pull)**. Distribuir así:

- **Jueves (Pull) — Wrist Curl (flexores)** · 12-15 · 1 min · variantes:
  [Curl de muñeca con barra] · [Curl de muñeca con mancuernas tras la espalda] ·
  "Apoya los antebrazos en el banco, deja que la barra ruede hasta los dedos y
  cierra fuerte. Rango completo."
- **Jueves (Pull) — Reverse Wrist Curl / Curl inverso (extensores)** · 15-20 ·
  1 min · variantes: [Curl inverso con barra EZ] · [Extensión de muñeca en polea] ·
  "Trabaja los extensores, clave para equilibrio articular. Peso ligero, control total."
- **Lunes (Upper) — Farmer Hold (grip)** · 30-45s de agarre · 90s · variantes:
  [Farmer hold con mancuernas] · [Dead hang de barra] · "Agarra lo más pesado
  que puedas sostener 30-45s. Trabaja el grip isométrico, base para todos los tirones."

(Colócalos al final de cada día para no interferir con los ejercicios pesados.
Ajusta `m:"Antebrazo"`. El usuario delegó la elección exacta a Claude; estas
son las recomendaciones — implementarlas salvo mejor criterio.)

### 3.2 Cardio integrado (de la hoja "🏃 Cardio Plan" del Excel)
NO son ejercicios de peso. Implementar como un **bloque informativo al final de
cada día** que muestre qué cardio toca, su intensidad y duración. Datos exactos
de la hoja de cardio del usuario:

| Día | Cardio | Intensidad | Duración |
|-----|--------|-----------|----------|
| Lunes (Upper) | HIIT (bici/elíptica) | 85-95% FC máx | 10 min (10 rondas 30s/30s) |
| Martes (Lower) | **SIN cardio** | — | — |
| Jueves (Pull) | Zona 2 / LISS | 60-70% FC máx | 15 min |
| Viernes (Push) | Tempo / Umbral | 75-85% FC máx | 12 min |
| Sábado (Legs) | **SIN cardio** | — | — |

Principios (mostrar como nota): cardio SIEMPRE al final del entreno de fuerza;
sin cardio en día de pierna (Lower/Legs) por el efecto de interferencia; la
mayoría es Zona 2 (conversacional), sólo 1 día HIIT y 1 día Tempo.

Sugerencia de implementación: un campo opcional `cardio:{tipo,intensidad,dur,nota}`
en cada día del `PROGRAM`, renderizado en un bloque discreto (mismo lenguaje
visual, acento naranja) al final de la lista de ejercicios. Los días sin cardio
muestran "Sin cardio — la pierna pesada ya es cardio. Recuperación."

### 3.3 Core
Nippard ya lo incluye: **Cable Crunch** (Martes) y **Roman Chair Leg Raise**
(Viernes). NO agregar core adicional salvo que se pida. Ya está cubierto.

---

## 4. Decisiones de diseño ya tomadas por el usuario

1. **Fidelidad:** fiel a Nippard + los 3 complementos integrados (NO 100%
   literal desnudo, pero SIN inventar volumen). Los 2 remos del Pull se
   mantienen distintos a 2 series cada uno (confirmado).
2. **Días faltados → por FECHA.** La app sigue el calendario: si es lunes toca
   Upper, haya ido o no el día anterior. NO implementar lógica de "recuperar"
   sesiones perdidas ni de avanzar por sesión completada. Es un calendario
   semanal fijo. (Verificar que la lógica actual de selección de día por fecha
   se mantenga.)
3. **Progresión → sólo historial.** Mostrar claramente qué hizo el usuario la
   última vez en cada ejercicio (peso × reps de la sesión previa), para que él
   decida cuánto subir. NO implementar cálculo automático de "+X kg" ni
   sugerencias de doble progresión. El usuario decide.

---

## 5. El bug del estado que se borra (INVESTIGAR antes de dar por cerrado)

Reporte del usuario: "estaba en el viernes, intenté mirar algo del lunes y salía
vacío". Esto NO es el mismo bug del draft-autosave (que protege la sesión en
curso y ya fue arreglado). Es un problema distinto: al navegar entre días, los
datos guardados de un día no aparecen.

**Tarea:** investigar en `index.html` cómo se leen y renderizan los días
guardados (`DB.log[fecha]`) según el día activo que se está viendo. Buscar la
función de render de la sesión y cómo resuelve qué fecha mostrar. Hipótesis a
verificar:
- ¿La app está buscando el log por la fecha de HOY en lugar de la fecha del día
  seleccionado que se está viendo?
- ¿El mapeo entre "día de la semana seleccionado" y "fecha ISO concreta" está
  bien resuelto cuando el día visto no es hoy?

Diagnosticar la causa raíz y proponer el fix. Si el usuario ya está migrando a
Worker + D1 (backend en curso), confirmar si el bug persiste con datos
remotos o si es puramente de la capa de lectura local.

---

## 6. Compatibilidad con datos existentes

El usuario tiene un respaldo (`bitacora-2026-07-15.json`) con la estructura
`DB.log[fecha]["slotId::variantId"] = {sets:[{w,r}]}`. Como los IDs de slots y
variantes CAMBIAN en esta reconstrucción (nuevos ejercicios de Nippard), las
claves viejas del respaldo pueden dejar de mapear a ejercicios existentes.

**Tarea:** al reconstruir, procurar:
- Mantener IDs de slot/variante estables donde el ejercicio sea el mismo (p.ej.
  si ya existía `mar_squat::squat_bb` y sigue existiendo, conservarlo).
- Para ejercicios que cambian, documentar el mapeo viejo→nuevo, o aceptar que
  esos registros históricos queden "huérfanos" (la app ya tolera claves
  desconocidas: las ignora al render sin romperse — verificar que siga así).
- NO perder datos: los registros huérfanos deben permanecer en `DB.log` aunque
  no se muestren, por si se recuperan después.

---

## 7. Criterios de aceptación

- [ ] El `PROGRAM` tiene exactamente los 5 días (lun/mar/jue/vie/sab) con los
      ejercicios literales de la sección 2.
- [ ] **Cada ejercicio tiene su `setsByWeek` de 12 posiciones exacto según la
      matriz de la sección 2-BIS.** (No series fijas.)
- [ ] **El `CYCLE` tiene 12 entradas** con las semanas 1 y 6 como intro (sin
      fallo, sin técnicas, RPE 7-8) y el resto como acumulación/pico (fallo +
      técnicas). Se eliminó el CYCLE de 9 semanas inventado y su `setMod`.
- [ ] **Cada ejercicio tiene su `tech` asignada** (failure / failure_llp /
      myoreps / static_stretch) y la app la muestra con explicación en semanas
      de acumulación, ocultándola en semanas intro.
- [ ] La app cambia automáticamente el número de series según la semana activa
      leyendo `setsByWeek`.
- [ ] Cada ejercicio tiene sus 2 substituciones reales de Nippard como variantes.
- [ ] Las notas técnicas reales están presentes (traducidas, tono directo).
- [ ] Rangos de reps y descansos coinciden con la sección 2.
- [ ] Bloque de antebrazo (2 ejercicios en Pull + 1 grip en Upper) implementado.
- [ ] Bloque de cardio informativo por día, con los datos de la sección 3.2.
- [ ] No quedan restos de la versión inventada (sin ejercicios de 5 series, sin
      "salto vertical", sin remos 3+1).
- [ ] La app abre sin errores de consola y renderiza los 5 días.
- [ ] El conteo de volumen semanal se recalcula solo con los nuevos datos.
- [ ] El bug del estado (sección 5) queda diagnosticado (y arreglado si es local).
- [ ] Datos históricos del respaldo no se pierden (sección 6).

---

## 8. Notas finales

- **No reescribir la app entera.** Cambiar el `PROGRAM` y agregar el render del
  bloque de cardio. Conservar UI, estilos, gráficas, draft-autosave, ciclo de
  semanas, toggle de unidades.
- **Preservar la identidad visual:** fondo oscuro, acento naranja, tipografía
  del sistema, tono directo en español.
- **Verificar duración:** el usuario tiene tope estricto de 2h. El volumen sube
  con la periodización: ~13 series/día en semana intro → ~22 series/día en
  semana pico (12). Estimación de duración:
  - Semanas intro/tempranas: 51-78 min por día.
  - Semana pico (12) caso normal: 63-94 min; peor caso con gym lleno: hasta
    ~108 min el día más largo (Lunes Upper).
  - **Todos los días quedan bajo 2h incluso en el peor caso**, pero el margen se
    reduce en semanas de pico. Si el usuario reporta que un día pico se pasa,
    la palanca es mover el cardio a otro momento (la hoja de cardio lo permite)
    o recortar el antebrazo esas semanas. No recortar series de Nippard.
- El archivo `index.html` a modificar está en el repo. El respaldo de datos y
  el Excel original de Nippard los tiene el usuario si se necesitan de referencia.
