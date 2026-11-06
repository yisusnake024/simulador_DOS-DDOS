# Simulador de Predicción de Umbrales DoS/DDoS

## Diseño y registro de trabajo

### Propósito

Aplicación académica interactiva para explicar cómo se estima el umbral de llegada de una cola M/M/1 en que la latencia supera un timeout. Está dirigida también a personas que recién se acercan a métodos numéricos: cada variable, resultado y método tendrá una explicación breve en español.

### Objetivos

- Resolver `f(λ) = 1 / (μ − λ) − T` con Newton-Raphson y secante.
- Comparar convergencia, evaluaciones, error y estimación de rendimiento.
- Mostrar la raíz analítica únicamente como referencia para el error real y el umbral de ataque.
- Permitir exploración manual y avance paso a paso, incluyendo un modo de mediciones ruidosas.
- Ofrecer escenarios predefinidos para explorar situaciones representativas sin tener que conocer los parámetros de antemano.
- Guiar a principiantes con explicaciones por iteración, glosario contextual, reto opcional y conclusiones en lenguaje sencillo.
- Comparar dos configuraciones y observar cómo cambia el umbral ante variaciones de capacidad o timeout.
- Repetir mediciones ruidosas de forma reproducible mediante una semilla configurable.
- Facilitar el uso con teclado y tecnologías de asistencia, y respetar la preferencia del sistema por movimiento reducido.
- Mantener una interfaz oscura, adaptable a móvil y escritorio, sin agregar funciones fuera del alcance acordado.

### Fuera de alcance

Autenticación, backend, almacenamiento persistente, modo claro, simulación de tráfico real o herramientas de ataque. El modelo es una demostración matemática, no una prueba de carga.

### Restricciones

- React 18, Vite, TypeScript estricto, Recharts y Vitest.
- No agregar dependencias distintas de las solicitadas.
- Fórmulas y solvers puros en `src/lib/`; componentes en `src/components/`.
- Los solvers nunca dividen por cero ni aceptan iterados `λ ≥ μ`.
- Cada iteración registra `k`, `x`, `fx`, error absoluto y error real, junto con motivo de parada.
- Los valores visibles deben provenir de entradas y resultados calculados; la raíz cerrada se usa solo como referencia explícita.

### Enfoques considerados

1. **Aplicación ejecutable mínima (elegido):** añadir los archivos imprescindibles de entrada y configuración de Vite/TypeScript, el manifiesto con scripts y dependencias solicitadas, y mantener la aplicación en `src/`. Permite ejecutar build, pruebas y servidor de desarrollo.
2. **Solo `src/` y documentación:** no requiere archivos de arranque, pero no puede ejecutarse ni cumplir los criterios de build/dev. Se descartó porque el repositorio estaba vacío.

### Arquitectura propuesta

- `src/lib/mm1.ts`: latencia, función objetivo, derivada y referencia analítica con validación del dominio.
- `src/lib/solvers.ts`: Newton-Raphson y secante; opciones tipadas para tolerancia, límite, ruido y diferencias finitas; resultado con historial, motivo y contadores de evaluaciones.
- `src/lib/solvers.test.ts`: casos principales y de dominio/ruido con Vitest.
- `src/components/Controls.tsx`: parámetros, validación, modo logs/ruido, sigma y controles de reproducción.
- `src/components/Controls.tsx`: parámetros A/B, escenarios, sensibilidad, validación, ruido/semilla y controles de reproducción/reto.
- `src/components/LatencyChart.tsx`: curvas de configuraciones comparadas, timeout, raíces y puntos iterados.
- `src/components/ConvergenceChart.tsx`: errores por iteración con eje logarítmico y sensibilidad calculada con los solvers.
- `src/components/IterationTable.tsx`: historial legible de cada método.
- `src/components/ComparisonPanel.tsx`: contadores, tiempos medidos, orden estimado, tasa de ataque, comparación de hipótesis y conclusión sencilla.
- `src/App.tsx` y estilos: composición, estado compartido, laboratorio guiado, reto, accesibilidad y diseño responsive.
- Archivos raíz mínimos de Vite/TypeScript y `package.json`: arranque y comandos requeridos.

### Decisiones de comportamiento propuestas

- `λ* = μ − 1/T` se calcula como referencia para `errorReal` y `λ_ataque = λ* − λ_legítimo`; la UI señalará si el ataque estimado es no positivo.
- En ejecución ordinaria se usa la función determinista y la derivada analítica. En modo ruido, la medición será `W(λ) × (1 + ruido gaussiano)` y `f` se formará restando `T`; Newton aproximará la derivada mediante diferencias finitas y la secante reutilizará evaluaciones de `f`.
- Un resultado puede terminar por residuo, cambio entre iterados, límite, divergencia o dominio inválido. Los estados y contadores se mostrarán en español.
- El modo paso a paso revelará los historiales calculados cada ~600 ms; pausa y reinicio controlarán la reproducción sin cambiar las fórmulas.
- El benchmark se calculará con `performance.now()` sobre 10 000 ejecuciones y se etiquetará como medición local orientativa.
- Los gráficos y tablas distinguirán series de ambos métodos y sus unidades. El contenido educativo explicará brevemente qué significan μ, λ, T, tolerancia y el punto de quiebre.
- La lectura guiada explicará cada iteración usando los resultados calculados; no mostrará cálculos ficticios.
- Al elegir un escenario, se actualizarán los parámetros y se volverán a ejecutar ambos solvers; luego se podrá ajustar cualquier control manualmente.
- Se podrá guardar una configuración A en memoria y compararla con otra B; ambas podrán editarse o restablecerse sin persistencia.
- El análisis de sensibilidad variará μ o T alrededor de su valor actual y ejecutará los solvers en cada punto; no derivará resultados con la raíz analítica.
- El generador de ruido será seudoaleatorio y determinista para la misma semilla; ambos métodos recibirán la misma secuencia de muestras por orden de evaluación.
- El reto permitirá escribir una estimación antes de revelar el resultado; la diferencia se calculará respecto al resultado convergido del solver elegido.
- El glosario será accesible por teclado; los estados no dependerán solo del color y la animación respetará `prefers-reduced-motion`.

#### Escenarios predefinidos incluidos en esta versión

Los perfiles cargan μ, T y λ_legítimo como valores iniciales editables y explican qué hipótesis ilustran. Los valores de salida, gráficas, errores y conclusiones se calculan con los solvers a partir de esos parámetros.

| Escenario | μ (req/s) | T (s) | λ_legítimo (req/s) | Idea que ilustra |
|---|---:|---:|---:|---|
| Carga ligera | 1000 | 0.5 | 100 | La carga legítima está lejos del umbral de latencia. |
| Cerca del umbral | 1000 | 0.5 | 950 | Hay menos margen entre la carga legítima y el umbral calculado. |
| Timeout exigente | 1000 | 0.05 | 300 | Un timeout menor cambia la tasa total compatible con el objetivo de latencia. |

El estado inicial de la aplicación conserva los valores pedidos originalmente (μ = 1000, T = 0.5, λ_legítimo = 300). Seleccionar un perfil actualiza los controles y el cálculo; después se puede iniciar o repetir el avance paso a paso.

### Mejoras incorporadas a esta versión

1. **Laboratorio guiado:** pasos para preparar el escenario, observar la iteración y traducir el resultado.
2. **Escenarios:** carga ligera, cerca del umbral y timeout exigente, editables tras seleccionarlos.
3. **Glosario y conclusión sencilla:** definiciones contextuales y explicación derivada de resultados actuales.
4. **Comparación A/B:** comparar dos configuraciones en memoria, gráficas y resumen.
5. **Ruido reproducible:** sigma y semilla configurables.
6. **Reto didáctico:** ingresar una estimación y compararla con el resultado del solver al revelar.
7. **Sensibilidad:** barrer μ o T y calcular cada punto mediante los solvers.
8. **Accesibilidad:** teclado, etiquetas semánticas, estados distinguibles sin color y movimiento reducido.

### Propuesta para hacerla más innovadora y funcional

La recomendación es convertir el dashboard en un **laboratorio guiado de diagnóstico**, además de comparador numérico. La innovación principal debe estar en hacer visible el razonamiento de los métodos para que una persona principiante entienda qué ocurre y pueda probar hipótesis.

#### Experiencia recomendada dentro del alcance ya definido

- **Lectura guiada de cada paso:** durante la animación, explicar con una frase qué valor se está calculando, por qué el método se mueve en esa dirección y cuál condición de parada falta cumplir. La frase utiliza los resultados reales de esa iteración.
- **Vista de la decisión sobre la curva:** destacar el iterado actual y los anteriores en la curva de latencia, junto a una leyenda breve que explique el timeout y la zona inválida `λ ≥ μ`.
- **Doble narrativa de diagnóstico:** presentar Newton como ajuste de defensa activa por su derivada y secante como investigación basada en mediciones de logs; el modo ruidoso explica claramente por qué Newton cambia a derivada numérica.
- **Conclusión entendible:** traducir `λ*`, `λ_legítimo` y `λ_ataque` a una frase derivada de los valores actuales, y decir si la carga legítima ya alcanzó el umbral.
- **Estado de confianza de la medición:** distinguir resultado determinista de resultado obtenido con ruido, avisando que el umbral observado puede fluctuar y mostrando sigma junto a la conclusión.
- **Controles explicados en contexto:** junto a cada control, incluir unidad, significado corto y qué cambia al moverlo; mantener accesibilidad por teclado y etiquetas claras.

Estas propuestas reutilizan controles, gráficas, tablas, animación y panel de comparación ya pedidos. Añaden explicaciones derivadas de datos sin sumar dependencias ni cambiar el modelo.

Estas mejoras se implementarán sin servicios externos ni nuevas dependencias. Los resultados, comparaciones y puntos de sensibilidad provendrán de ejecuciones de los solvers; los únicos números predefinidos serán parámetros editables de escenario.

### Supuestos para revisar

- Si `λ_legítimo ≥ λ*`, el umbral de ataque mostrado será cero como máximo físicamente posible y se explicará que el servidor ya excede el umbral con carga legítima.
- En modo ruido, el error real se medirá frente a la raíz analítica, pero el solver puede detenerse por fluctuación de una medición; la UI lo identificará como modo de medición ruidosa.
- El orden de convergencia estimado se mostrará como estimación basada en los últimos errores válidos, o como no disponible si no hay suficientes iteraciones.

### Registro de trabajo

| Fecha | Cambio |
|---|---|
| 2026-11-05 | Reorganizado el resultado principal en lenguaje directo sobre límite y margen; explicaciones de los métodos a la vista y gráficos/tablas/métricas detrás de “Ver paso a paso, gráficas y cálculos”. |
| 2026-11-05 | Añadida comparación determinista de Newton y secante para los tres escenarios, con pasos, evaluaciones, residuo, error y estado de parada bajo los mismos controles numéricos. |
| 2026-11-05 | Añadido resumen de incertidumbre con 200 repeticiones por método, percentiles P5–P95, tasa de convergencia y error mediano frente a la referencia analítica. |
| 2026-11-01 | Exploración inicial: repositorio sin archivos versionados ni manifiesto. |
| 2026-11-01 | Autorizada la ampliación para crear archivos mínimos de arranque/configuración en la raíz. |
| 2026-11-01 | Preparado este diseño, arquitectura propuesta y lista de mejoras para revisión. |
| 2026-11-01 | Añadida propuesta de laboratorio guiado con explicaciones por iteración y opciones de ampliación. |
| 2026-11-01 | El usuario pidió incluir escenarios predefinidos en esta versión; se añadieron tres perfiles editables al diseño. |
| 2026-11-01 | El usuario pidió incluir las mejoras sugeridas y el laboratorio guiado en producción; se amplió el alcance con comparación A/B, ruido con semilla, reto, sensibilidad y accesibilidad. |

### Estado

Diseño ampliado aprobado por el usuario el 2026-11-01. El plan de implementación sigue a continuación.

## Plan de implementación

### Archivos y responsabilidades

- Raíz: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json` para ejecutar React 18 + Vite + TypeScript + Vitest con los scripts solicitados.
- `src/main.tsx`: montar la aplicación React.
- `src/index.css`: tema oscuro, estilos responsive, foco visible, movimiento reducido y estructura visual.
- `src/App.tsx`: estado de parámetros/resultados, selección de escenarios, ejecución automática, animación, pausa/reinicio y laboratorio guiado.
- `src/lib/mm1.ts`: fórmulas M/M/1 y validaciones del dominio.
- `src/lib/solvers.ts`: tipos y algoritmos Newton/secante, muestreo ruidoso reproducible, contadores y causas de parada.
- `src/lib/solvers.test.ts`: pruebas unitarias solicitadas y casos límite de los solvers.
- `src/components/Controls.tsx`: formularios accesibles, escenarios, configuración A/B, sigma/semilla, reto y sensibilidad.
- `src/components/LatencyChart.tsx`: curvas comparadas, timeout y puntos de iteración.
- `src/components/ConvergenceChart.tsx`: convergencia y barrido de sensibilidad.
- `src/components/IterationTable.tsx`: historiales por método y estado de avance.
- `src/components/ComparisonPanel.tsx`: resumen de resultados, rendimiento y lectura sencilla.

### Tareas

#### Tarea 1: Arranque mínimo del proyecto

Crear el manifiesto con `dev`, `build` y `test`, configuración estricta React/TypeScript/Vite y entrada HTML. Declarar únicamente React 18, Vite, TypeScript, Recharts y Vitest en sus roles correspondientes. Crear `src/main.tsx` y estilos base que permitan renderizar la app.

Verificación: instalar las dependencias declaradas con npm y ejecutar `npm run build` en cuanto exista la entrada mínima.

#### Tarea 2: Modelo M/M/1 y pruebas de fórmulas

Implementar funciones tipadas para `W(λ)`, `f(λ)`, `f′(λ)` y raíz de referencia en `src/lib/mm1.ts`. Validar parámetros finitos/positivos y dominio `λ < μ`; nunca evaluar denominador cero.

Escribir pruebas para valores por defecto, raíces y entradas inválidas; confirmar que las fórmulas corresponden al modelo.

#### Tarea 3: Solvers puros y cobertura de requisitos

Definir entradas/resultados explícitos, incluidas iteraciones `{ k, x, fx, errorAbs, errorReal }`, motivo de parada y contadores de evaluaciones de `f`/`f′`. Implementar Newton con derivada analítica o diferencias finitas en modo ruido y secante sin derivada analítica. Ambos deben detenerse por residuo, paso menor a tolerancia, límite, divergencia o dominio inválido.

Escribir primero pruebas de convergencia por defecto para ambos métodos, `x0 ≥ μ`, no división por cero, secante con denominador nulo, divergencia/límite, ruido con semilla repetible y modo ruido sin fallo. Ejecutar Vitest para ver fallar antes de implementar cada grupo y volver a correr al quedar verde.

#### Tarea 4: Controles y escenarios del laboratorio

Construir parámetros, unidades, validación y ayuda contextual; mantener valores originales por defecto. Agregar tres presets aprobados, comparación A/B en memoria, sigma/semilla, controles de avance/pausa/reinicio, configuración de sensibilidad y reto para ingresar un umbral estimado.

Cada cambio de parámetros recalcula ambos métodos con los solvers. Ningún resultado ilustrativo se codifica como salida fija.

#### Tarea 5: Gráficas, tablas y análisis comparativo

Construir las curvas de latencia con timeout, referencia y puntos iterados, los errores por iteración con escala log, y tablas separadas. Implementar el barrido configurable de μ o T llamando ambos solvers por cada punto. En el panel, calcular iteraciones/evaluaciones/tiempo promedio de 10 000 repeticiones/orden estimado/tasa de ataque y generar una explicación sencilla con los resultados actuales.

#### Tarea 6: Guía, animación, accesibilidad y ajuste visual

Integrar narrativa de defensa activa vs logs, explicación que cambia en cada paso, etapas de laboratorio, revelado del reto, estados distinguibles sin color, semántica/etiquetas de controles, foco por teclado y `prefers-reduced-motion`. Ajustar disposición a 375 px y 1440 px.

#### Tarea 7: Verificación final y registro

Ejecutar `npm run build` y `npm run test`, registrar salida real. Levantar `npm run dev` y comprobar en navegador que las cinco secciones se montan con parámetros iniciales. Corregir fallos dentro del alcance y registrar fecha, archivos finales y supuestos en este documento.

### Criterios de revisión

- Los solvers siguen siendo puros y el ruido no introduce valores inválidos ni hace que una misma semilla deje de ser reproducible.
- Cada superficie de resultados deriva de los iterados y contadores devueltos por los solvers; solo los parámetros por defecto y presets son constantes de entrada.
- El modo paso a paso tiene pausa, reinicio y respeta reducción de movimiento.
- A/B, sensibilidad y reto se entienden sin ocultar que la aplicación modela M/M/1 en estado estable y no tráfico real.
- No se instala una dependencia adicional a las aprobadas.

### Aprobación técnica pendiente

React para navegador requiere `react-dom` para montar la aplicación y `@types/react` + `@types/react-dom` para compilar JSX con TypeScript estricto. No están nombrados explícitamente en el stack, así que no se instalarán hasta tener aprobación. Se evitará `@vitejs/plugin-react` para no sumar otra dependencia; Vite transforma TSX con la configuración TypeScript apropiada.

### Dirección visual de implementación

- **Paleta:** azul petróleo `#142633` como superficie principal, pizarra clara `#dce7e8` para texto, verde agua `#68d6c4` para Newton, ámbar `#f0b763` para secante, coral `#ff7f72` para timeout/alerta y fondo profundo `#0b151d`.
- **Tipografía:** sistema sans legible para explicaciones y controles; números tabulares para lectura de medidas, sin descargar fuentes.
- **Disposición:** cabecera con umbral y estado del laboratorio; columna de trabajo con escenario/controles/guía; zona amplia con curva y convergencia; abajo historiales y comparación. En móvil se apila en orden de aprendizaje, manteniendo el gráfico principal temprano.
- **Motivo visual:** una curva de saturación que se acerca a una línea de timeout, con los iterados como marcas de dos colores. Cada iteración animada revela el siguiente punto para explicar una acción concreta.
- **Wireframe:**

```text
┌ título + explicación corta + modo del laboratorio ┐
├ parámetros y escenarios ┬ resultado del umbral ────┤
│ guía / controles        │ curva de latencia         │
├ comparación A/B ────────┼ convergencia ─────────────┤
├ tablas de iteraciones ──┴ sensibilidad / reto ──────┤
└────────────────────────────────────────────────────┘
```

### Estado del plan

Plan aprobado y en ejecución nativa en esta sesión para mantener coordinación entre solvers, gráficos y estado compartido.

### Registro de implementación

- Tarea 1: manifiesto, entrada HTML y configuración TypeScript/Vite creados; instaladas dependencias autorizadas sin generar lockfile. Primer `npm install` del sandbox se detuvo sin salida; repetido con autorización de red y completado.
- Tarea 2/3: pruebas escritas antes de los módulos; primera corrida falló porque aún faltaban `mm1.ts` y `solvers.ts`. Después de implementar y corregir dos expectativas matemáticas en pruebas, `npm run test -- --reporter=dot` pasó (10/10, salida 2026-11-01).
- Ruling: se seleccionó una versión de Recharts marcada como obsoleta por npm al instalar — se cambiará a la rama 3.x aprobada para evitar entregar una dependencia que el registro advierte que no recibe mantenimiento — costo si falla: puede requerir ajustar props de gráficos durante integración.
