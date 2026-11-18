# Simulador de Predicción de Umbrales DoS/DDoS

> Aplicación web interactiva para modelar la latencia de servidores mediante **Teoría de Colas** ($M/M/1$, $M/G/1$ y $M/M/c$) y predecir el umbral crítico de saturación frente a ataques DoS/DDoS resolviendo $f(\lambda) = W(\lambda) - T = 0$ con los métodos numéricos de **Newton-Raphson** y de la **Secante**.

🌐 **Sitio desplegado en vivo:** [https://simulador-dos.vercel.app/](https://simulador-dos.vercel.app/)

---

## 🧠 ¿Cómo funciona el software? (Explicación sencilla)

Imagina que un servidor web es como un **supermercado con cajas de cobro**:

- **Capacidad del servidor ($\mu$):** Cuántos clientes (solicitudes HTTP) puede atender por segundo antes de colapsar.
- **Tráfico entrante ($\lambda$):** Cuántas solicitudes llegan por segundo ($\lambda = \lambda_{\text{legítimo}} + \lambda_{\text{ataque}}$).
- **Tiempo de espera o Timeout ($T$):** Lo máximo que espera un navegador o balanceador antes de cortar la conexión con error (`504 Gateway Timeout`).

Cuando llegan más solicitudes de las que el servidor alcanza a despachar cerca de su límite ($\lambda \to \mu$), la fila crece de golpe y la latencia $W(\lambda)$ se dispara hacia el infinito.

### El flujo completo dentro de la aplicación

1. **Configuras o mides un sistema real:**
   - Puedes ajustar los parámetros manualmente en **Parámetros del Sistema** ($\mu$, $T$, tráfico normal, puntos iniciales y ruido), **o** ir al **Predictor Web (URL)** para medir una página web real.
2. **Los métodos numéricos buscan el punto de quiebre ($\lambda^*$):**
   - El software resuelve paso a paso la ecuación $f(\lambda) = W(\lambda) - T = 0$, es decir, busca cuántas peticiones por segundo hacen que la latencia alcance exactamente el límite $T$.
   - Compara dos algoritmos clásicos: **Newton-Raphson** y el **Método de la Secante**.
3. **Exploras visualmente cómo converge cada algoritmo:**
   - El **Laboratorio Interactivo** te permite reproducir paso a paso cómo cada método se acerca al umbral crítico, moviendo un **punto rosa guía** sobre la curva de latencia y explicando cada decisión en lenguaje natural.
4. **Mides el rendimiento computacional:**
   - La pestaña **Rendimiento** ejecuta miles de simulaciones en milisegundos para comparar velocidad, número de evaluaciones y tasa de convergencia real.

---

## 🌐 Predictor Web (URL): ¿Cómo funciona por dentro?

La pestaña **Predictor Web (URL)** permite analizar cualquier URL pública (`https://...`) y estimar cuántas peticiones por segundo soportarían antes de degradar su tiempo de respuesta.

### Paso a paso técnico del Predictor Web

1. **Sondeo controlado compatible con Vercel (Plan Gratuito / Hobby):**
   - El navegador coordina una serie de sondas individuales enviando peticiones `POST /api/probe` espaciadas (por ejemplo, 10 muestras) en lugar de mantener una función bloqueada durante mucho tiempo, evitando así el límite de 10 segundos por ejecución de las funciones serverless gratuitas.
   - El backend (`/api/probe.ts` en Vercel o `server.ts` en desarrollo local) valida la URL contra ataques **SSRF** (bloqueando IPs privadas, loopback o metadatos internos mediante resolución DNS previa), mide el tiempo real de respuesta con `HEAD` (y respaldo automático con `GET` si el servidor rechaza `HEAD`).
2. **Cálculo de estadísticas empíricas y capacidad ($\mu$):**
   - A partir de las latencias obtenidas ($W_0$ media, mediana $p_{50}$, $p_{95}$, desviación estándar $\sigma$ y coeficiente de variación $CV = \sigma / W_0$), estima la capacidad base por trabajador ($\mu_1 = 1 / W_0$) y la capacidad agregada ($\mu_{\text{total}} = c \cdot \mu_1$) según la concurrencia configurada ($c$).
3. **Modelado con 3 modelos de colas:**
   - **$M/M/1$ Agregado:** Modelo clásico exponencial rápido para una estimación base.
   - **$M/G/1$ (Pollaczek-Khinchine):** Incorpora el **jitter real** medido ($CV^2$) cuando las respuestas reales tienen variabilidad alta.
   - **$M/M/c$ (Erlang C):** Modela múltiples trabajadores/instancias ($c$) trabajando en paralelo.
4. **Resolución del umbral $\lambda^*$ con Newton-Raphson y Secante:**
   - El usuario puede elegir el modelo de cola objetivo y el criterio SLA ($T$, ya sea automático como $3\times W_0$ o personalizado).
   - El sistema ejecuta **Newton-Raphson** (usando derivada centrada o analítica para avanzar con la tangente) y el **Método de la Secante** (usando dos estimaciones iniciales para avanzar sin derivadas) hasta encontrar $\lambda^*$ con tolerancia $\varepsilon$.
   - Permite alternar entre la gráfica de **Curvas $W(\lambda)$** y **Convergencia Newton vs Secante ($\log_{10}|f(\lambda)|$)**, inspeccionar la tabla de iteraciones y pulsar **"Enviar al Simulador"** para llevar la capacidad $\mu$ y timeout $T$ detectados al simulador principal y recorrerlos en el Laboratorio Paso a Paso.

---

## 🎯 Base Matemática del Simulador Principal ($M/M/1$)

Bajo una cola $M/M/1$, el tiempo de respuesta promedio es:

$$W(\lambda) = \frac{1}{\mu - \lambda}$$

La condición crítica de saturación ocurre cuando la latencia alcanza el timeout $T$:

$$f(\lambda) = W(\lambda) - T = \frac{1}{\mu - \lambda} - T = 0$$

Cuya solución analítica exacta es:

$$\lambda^* = \mu - \frac{1}{T}$$

Y el tráfico de ataque adicional necesario para saturar el servicio es:

$$\lambda_{\text{ataque}} = \max(0, \lambda^* - \lambda_{\text{legítimo}})$$

---

## 🔬 Métodos Numéricos Comparados

| Característica | Newton-Raphson (Caja Blanca) | Método de la Secante (Caja Negra / Telemetría) |
|---|---|---|
| **Derivada** | Analítica $f'(\lambda) = \frac{1}{(\mu - \lambda)^2}$ (o centrada en $M/G/1$, $M/M/c$) | No requiere derivada (pendiente entre los últimos 2 puntos) |
| **Orden de convergencia** | Cuadrático ($p \approx 2.0$) | Superlineal ($p \approx 1.618$, proporción áurea $\phi$) |
| **Evaluaciones por paso** | 2 ($f$ y $f'$) | 1 ($f$, reutiliza el punto anterior) |
| **Puntos iniciales** | 1 punto ($x_0$) | 2 puntos ($x_0$, $x_1$) |
| **Analogía de Seguridad** | Defensa/Auditoría con modelo conocido del servidor | Análisis externo basado en latencias empíricas |

---

## 🚀 Módulos de la Aplicación

1. **Simulador & Gráficas:**
   - **Parámetros del Sistema:** Deslizadores de capacidad ($\mu$), timeout ($T$), tráfico legítimo ($\lambda_{\text{legítimo}}$), escenarios preconfigurados (*Estándar Académico*, *Carga Ligera*, *Cerca del Umbral*, *Timeout Exigente*) y ajustes avanzados (puntos iniciales $x_0, x_1$, tolerancia y **ruido gaussiano reproducible** con semilla).
   - **Laboratorio Interactivo: Exploración Paso a Paso:** Controles de reproducción (`Reproducir`, `Pausar`, `Paso anterior`, `Siguiente paso`, barra deslizante y selector de velocidad `0.5x / 1.0x / 2.0x`). Se actualiza en tiempo real con los Parámetros del Sistema y mueve un **punto guía rosa** sobre la curva $W(\lambda)$ mientras muestra la explicación paso a paso de la iteración actual.
   - **Gráfica de Latencia & Umbral Crítico:** Muestra la curva $W(\lambda)$, el límite horizontal $T$, $\lambda_{\text{legítimo}}$, el umbral crítico $\lambda^*$ y el punto de la iteración activa.
   - **Gráfica de Convergencia:** Comparación en escala logarítmica ($\log_{10}|f(\lambda)|$) o lineal para visualizar el orden de convergencia.
   - **Tablas de Iteraciones:** Historial detallado por método; al hacer clic en cualquier fila se sincroniza con el Laboratorio Interactivo.
2. **Predictor Web (URL):**
   - Sondeo HTTP seguro de URLs reales, estimación de $\mu$ y $CV$, comparación $M/M/1$ vs $M/G/1$ vs $M/M/c$, cálculo de $\lambda^*$ con Newton-Raphson y Secante, gráficas interactivas y exportación directa al Simulador.
3. **Rendimiento:**
   - Benchmark de **10,000 ejecuciones** midiendo tiempo total en microsegundos ($\mu\text{s}$), evaluaciones de función y orden de convergencia empírico.
4. **Teoría & Glosario:**
   - Deducción paso a paso de la teoría de colas, interpretación de métricas y glosario modal accesible de todas las variables ($\mu, \lambda, T, W, \rho$, residuo y tolerancias).

---

## 🛠️ Tecnologías Utilizadas

- **React 19** + **TypeScript**
- **Vite** + **Tailwind CSS v4**
- **Recharts** (visualización interactiva de curvas y convergencia)
- **Express** (`server.ts` para entorno local) + **Vercel Serverless Functions** (`/api/probe.ts`, `/api/health.ts`)
- **Vitest** (pruebas unitarias de solvers y modelos de colas)
- **Lucide React** + **Vercel Analytics**

---

## 💻 Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/yisusnake024/simulador_DOS-DDOS.git
   cd simulador_DOS-DDOS
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo (frontend + API `/api/probe`):**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

4. **Ejecutar pruebas unitarias y verificación de tipos:**
   ```bash
   npm test -- --run
   npm run lint
   ```

5. **Compilar para producción:**
   ```bash
   npm run build
   ```
