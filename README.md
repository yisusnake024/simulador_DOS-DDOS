# Simulador de Predicción de Umbrales DoS/DDoS

> Aplicación académica interactiva para el modelado de colas **M/M/1** y la predicción de umbrales de saturación y latencia crítica frente a ataques de denegación de servicio (DoS/DDoS), comparando los métodos numéricos de **Newton-Raphson** y de la **Secante**.

---

## 🎯 Propósito y Contexto

En sistemas distribuidos y servidores web, el tiempo de respuesta promedio bajo una cola $M/M/1$ viene dado por:

$$W(\lambda) = \frac{1}{\mu - \lambda}$$

Donde:
- $\mu$: Capacidad o tasa máxima de atención del servidor (solicitudes/segundo).
- $\lambda$: Tasa total de llegada de solicitudes ($\lambda = \lambda_{\text{legítimo}} + \lambda_{\text{ataque}}$).
- $T$: Límite de espera de los clientes o balanceadores (*Timeout*).

A medida que el tráfico $\lambda \to \mu$, la latencia tiende asintóticamente a infinito. Un atacante DoS/DDoS busca inyectar tráfico malicioso hasta que la latencia supere el timeout $T$, provocando errores masivos de conexión (`504 Gateway Timeout`).

La condición crítica se modela con la función objetivo:

$$f(\lambda) = W(\lambda) - T = \frac{1}{\mu - \lambda} - T = 0$$

Cuya solución analítica exacta es:

$$\lambda^* = \mu - \frac{1}{T}$$

Y el tráfico de ataque mínimo requerido es:

$$\lambda_{\text{ataque}} = \max(0, \lambda^* - \lambda_{\text{legítimo}})$$

---

## 🔬 Métodos Numéricos Comparados

| Característica | Newton-Raphson (Caja Blanca) | Método de la Secante (Caja Negra / Telemetría) |
|---|---|---|
| **Derivada** | Analítica $f'(\lambda) = \frac{1}{(\mu - \lambda)^2}$ | No requiere derivada (interpolación finita) |
| **Orden de convergencia** | Cuadrático ($p \approx 2.0$) | Superlineal ($p \approx 1.618$, proporción áurea $\phi$) |
| **Evaluaciones por paso** | 2 ($f$ y $f'$) | 1 ($f$, reutiliza la previa) |
| **Puntos iniciales** | 1 punto ($x_0$) | 2 puntos ($x_0$, $x_1$) |
| **Analogía de Seguridad** | Defensa activa con modelo exacto del servidor | Análisis de métricas y logs de latencia empírica |

---

## 🚀 Características del Simulador

1. **Simulador y Visualización:**
   - Controles interactivos con perfiles predeterminados (*Carga Ligera*, *Cerca del Umbral*, *Timeout Exigente*).
   - Curva de latencia $W(\lambda)$ con timeout $T$, punto analítico $\lambda^*$ y zonas de seguridad/peligro.
   - Gráfico de convergencia del error en escala semilogarítmica ($\log_{10}|f(\lambda)|$).
   - Tablas detalladas del historial de iteraciones para ambos métodos.
2. **Reproductor Paso a Paso:**
   - Inspección iteración por iteración con explicación pedagógica en lenguaje natural de cada cálculo y decisión del algoritmo.
3. **Módulo de Benchmark (10,000 ejecuciones):**
   - Comparación de velocidad en microsegundos ($\mu\text{s}$), conteo de evaluaciones y orden de convergencia medido.
4. **Fundamento Teórico:**
   - Explicación matemática interactiva de la cola $M/M/1$, deducciones analíticas y criterios de ciberseguridad.
5. **Reto Interactivo:**
   - Gamificación pedagógica para predecir el umbral $\lambda^*$ antes de calcularlo.
6. **Comparador A/B:**
   - Análisis comparativo de infraestructuras para evaluar cuánta resiliencia añade duplicar la capacidad o ajustar timeouts.
7. **Modo Ruido de Telemetría:**
   - Simulación con fluctuación gaussiana reproducible mediante semilla seudoaleatoria fija.
8. **Glosario Contextual:**
   - Definición rápida y accesible de todas las variables ($\mu, \lambda, T, W, \rho$, residuo, tolerancias).

---

## 🛠️ Tecnologías Utilizadas

- **React 18** + **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Recharts**
- **Vitest** (suite de pruebas unitarias)
- **Lucide React** (iconografía)

---

## 💻 Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   cd TU_REPOSITORIO
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

4. **Ejecutar pruebas unitarias:**
   ```bash
   npm test
   ```

5. **Compilar para producción:**
   ```bash
   npm run build
   ```
