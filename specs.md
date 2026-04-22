# Campeonato MundIAl 4Match  
Juego de cartas virtual

---

## 1. Visión general

Campeonato MundIAl 4Match es un juego de cartas coleccionables de fútbol en formato digital, diseñado para ser jugado en el evento Connect de Grupo CEDI. Los participantes compiten en un torneo eliminatorio inspirado en el campeonato del mundo, enfrentándose uno a uno hasta coronar a un único campeón.

El juego es una adaptación digital del clásico juego de cartas de comparación de atributos (estilo Top Trumps / Supertrump / 4Match). Cada jugador recibe un mazo de 15 cartas de futbolistas; en cada ronda un jugador elige un atributo de forma estratégica, con el objetivo de tener una valoración más alta que su rival en ese atributo, ya que el atributo más alto gana la carta del rival. Gana la partida quien acumule todas las cartas, o quien tenga más al vencer el tiempo límite.

### Objetivo del producto

- Generar entretenimiento e interacción entre asistentes de un evento tecnológico.
- Crear un campeonato con final indiscutible: cuadro eliminatorio potencias de 2 (2: Final, 4: Semifinal, 8: Cuartos de Final, 16: Octavos de Final, etc.).
- Ser accesible desde el celular: sin instalación, vía QR o link directo.
- Escalar de forma automática desde 50 hasta 300 jugadores simultáneos.

---

## 2. Usuarios y contexto de uso

**Usuarios**  
Asistentes a un evento tecnológico corporativo. No necesariamente gamers; rango etario amplio.

**Dispositivo**  
Smartphone propio (iOS / Android). Experiencia 100% desde el navegador, sin apps.

**Contexto**  
Salon de eventos. Conexión WiFi provista por el organizador, o red 4G de los propios dispositivos. Partidas de 2 minutos.

**Organizador**  
El equipo del evento configura el torneo antes de que lleguen los asistentes.

---

## 3. Flujo de experiencia

### Para el jugador

- Escanea el QR o ingresa el link desde su celular.
- Ingresa su nombre y nombre de empresa y se une al torneo (mientras está abierta la inscripción).
- Puede explorar las 15 cartas de su mazo y ver los atributos de cada jugador.
- Cuando empieza su partida, recibe notificación en pantalla.
- Juega 1 ronda a la vez: ve su carta, si le toca elige un atributo, si la valoración es más alta que su rival, gana la carta del rival, de lo contrario entrega la suya. El resultado de la ronda se ve en pantalla.
- Gana si le roba todas las cartas al rival, o si luego de 2 minutos tiene más cartas que su rival.
- Si gana: pasa a la siguiente ronda y espera al próximo rival.
- Si pierde: queda eliminado. Ve el cuadro con los resultados en tiempo real.

### Para el organizador

- Accede al panel de administración con link privado.
- Configura el torneo: nombre del evento, cupo máximo, cartas por jugador, tiempo por partida.
- Abre la inscripción y muestra el QR en pantalla grande.
- Inicia el torneo manualmente cuando lo decide.
- El sistema arma el cuadro eliminatorio automáticamente y gestiona los bots.
- Ve el avance del torneo en tiempo real en una vista de presentación (proyectable).

---

## 4. Estructura del torneo

El cuadro eliminatorio siempre es una potencia de 2. Si los jugadores inscriptos no completan el cupo exacto, se asignan bots automáticos: los jugadores que reciben un bot, juegan contra este, al cual se le deberían asignar cartas “mediocres” para que los bots tengan más chances de quedar eliminados.

Ejemplo con 247 jugadores: el sistema usa un cuadro eliminatorio de 256. Los 9 lugares vacíos se asignan aleatoriamente como bots. Al recibir cartas “mediocres” (los bots) se garantiza que la final siempre enfrenta a exactamente 2 jugadores humanos.

| Ronda            | Jugadores | Partidos       | Clasifican  | Duración |
|------------------|----------|----------------|-------------|----------|
| Ronda 1          | 256      | 128 partidos   | 128 pasan   | ~2 min   |
| Ronda 2          | 128      | 64 partidos    | 64 pasan    | ~2 min   |
| Ronda 3          | 64       | 32 partidos    | 32 pasan    | ~2 min   |
| Dieciseisavos    | 32       | 16 partidos    | 16 pasan    | ~2 min   |
| Octavos          | 16       | 8 partidos     | 8 pasan     | ~2 min   |
| Cuartos final    | 8        | 4 partidos     | 4 pasan     | ~2 min   |
| Semifinal        | 4        | 2 partidos     | 2 pasan     | ~2 min   |
| Final            | 2        | 1 partido      | 1 campeón 🏆 | ~3 min   |

Nota: con 200–300 jugadores el cuadro eliminatorio de 256 cubre todos los casos posibles. Se alcanzan 4–5 rondas eliminatorias antes de llegar a cuartos.

---

## 5. Mecánica del juego

### La partida

**Duración**  
2 minutos por partida (configurable). Si se acaba el tiempo, gana quien tiene más cartas.

**Cartas iniciales**  
15 cartas por jugador (configurable), repartidas aleatoriamente al inicio de cada partida.

**Turno**  
El jugador que abre la ronda elige qué atributo comparar. El ganador elige en la próxima.

**Ganar ronda**  
El jugador con el valor más alto en el atributo elegido gana la carta del rival.

**Empate**  
Se da al poseer las mismas cartas al finalizar los 2 minutos. Se juegan 3 rondas adicionales, y gana el mejor de 3.

**Fin**  
Gana quien tiene todas las cartas, o quien tiene más al vencer el tiempo.

### Atributos de las cartas

Todos los jugadores de fútbol tienen exactamente los mismos 8 atributos. Esto asegura que cualquier carta puede ganarle a cualquier otra dependiendo del atributo elegido.

Algunos ejemplos (no necesariamente atributos finales):

| Atributo  | Descripción                     | Rango  | Ejemplo     |
|----------|---------------------------------|--------|------------|
| Velocidad | Capacidad de desplazamiento     | 1 – 99 | Mbappé 97  |
| Tiro      | Potencia y precisión de remate  | 1 – 99 | Haaland 97 |
| Dribbling | Habilidad con el balón          | 1 – 99 | Vinicius 93|
| Pase      | Visión y distribución           | 1 – 99 | Rodri 92   |
| Físico    | Fuerza, salto, resistencia      | 1 – 99 | Haaland 93 |

Los valores son fijos y balanceados por posición: los delanteros tienen mayor tiro y velocidad; los defensores, mayor físico; los mediocampistas, mayor pase.

---

## 6. Cartas de jugadores

### Criterios de selección

- Aproximadamente 90–100 cartas únicas en el pool total.
- Representatividad de selecciones: al menos 16 países distintos.
- Mix de posiciones: ~30% delanteros, ~30% mediocampistas, ~25% defensores, ~15% arqueros.
- Los arqueros tienen atributo especial: Reflejos (compite con Tiro).
- Rating global de referencia (1–99) inspirado en FIFA/EA FC, sin ser copia oficial.

### Distribución del mazo

- Cada jugador recibe 15 cartas (configurable por el Admin) al inicio de su partida.
- La distribución es aleatoria pero balanceada: no hay mazos con solo estrellas ni solo cartas débiles.
- Las cartas no se repiten entre jugadores de la misma partida.
- Las cartas se 'roban' durante la partida: el que gana una ronda incorpora la carta del rival a su mazo.

---

## 7. Pantallas clave

### Pantalla de inicio / lobby

- Nombre del torneo y branding del evento.
- Campo de ingreso de nombre (el jugador elige cómo aparecer en el cuadro eliminatorio).
- Contador de jugadores inscriptos y cupo disponible.
- Estado del torneo: Inscripción abierta / En curso / Finalizado.

### Pantalla de partida

- Vista de la carta propia con los 8 atributos visibles y seleccionables.
- Vista de la carta del rival oculta (solo diseño del revés de la carta visible).
- Timer visible con cuenta regresiva.
- Indicador de cartas en el mazo propio vs. mazo del rival.
- Resultado de cada ronda con animación breve (ganaste / perdiste / empate).

### Pantalla del cuadro eliminatorio

- Cuadro eliminatorio estilo campeonato, actualizado en tiempo real.
- El partido propio del usuario resaltado.
- Vista de estado de todos los partidos activos.
- Proyectable en pantalla grande para el salón del evento.

### Panel de administración

- Configuración del torneo (nombre, cupo, tiempo, cartas).
- Control: abrir inscripción / iniciar torneo / pausar.
- Vista en tiempo real del avance del cuadro eliminatorio.
- Vista en tiempo real de una partida en vivo (modo espectador).
- Botón de reinicio para pruebas.

---

## 8. Requisitos técnicos

**Plataforma**  
Web app responsiva. Sin instalación. Compatible con Chrome y Safari móvil.

**Acceso**  
Link único por evento + QR. Sin registro de cuenta; solo nombre de jugador.

**Tiempo real**  
WebSockets para sincronización de partidas y actualización del cuadro eliminatorio.

**Concurrencia**  
Soporte para +300 usuarios simultáneos jugando en paralelo.

**Backend**  
Python o Node.js o equivalente. Base de datos liviana (Redis o similar para estado en tiempo real). Considerar PostgreSQL para consolidación.

**Hosting**  
Nube (Azure / Vercel / Supabase). Deploy en menos de 1 hora.

**Offline**  
No requerido. Se asume WiFi estable en el evento, o accesible mediante red 4G móvil.

**Seguridad**  
Sin datos personales. Solo nombre de usuario efímero por sesión de torneo.

---

## 9. Edge cases y manejo de errores

Esta seccion documenta los escenarios anomalos previstos y como debe responder el sistema en cada caso.

| # | Caso | Descripcion | Resolucion del sistema |
|--|------|------------|------------------------|
| 1 | Desconexión del jugador | El jugador pierde conectividad durante una partida activa. | Timeout de 30 s para reconexión. Si no reconecta: derrota automática, el rival avanza. Aviso en pantalla del rival. |
| 2 | Inactividad en turno | El jugador no selecciona atributo dentro del tiempo definido (ej.: 10 s). | El sistema selecciona un atributo al azar y juega automáticamente. Se registra como acción valida. |
| 3 | Empate de atributos | Ambos jugadores presentan el mismo valor en el atributo elegido. | Sin ganador de la ronda. Cada jugador conserva su carta, y pasa la selección de atributo en la próxima ronda al jugador contrario. |
| 4 | Doble input o clicks múltiples | El jugador toca el atributo varias veces o envía múltiples eventos en un turno. | El backend acepta únicamente el primer evento valido del turno e ignora los siguientes. La UI se deshabilita hasta recibir confirmación del servidor. |
| 5 | Desincronización de estado | El estado del cliente no coincide con el del servidor (ej: tras lag o reconexión). | El servidor es la única fuente de verdad. Al reconectar, el cliente recibe el estado actual completo y re-renderiza desde cero. |
| 6 | Partida colgada | No hay actividad de ninguno de los dos jugadores por más de 15 s. | El sistema auto-finaliza la ronda. Se consideran reglas de empate de ronda. |
| 7 | Abandono voluntario | El jugador cierra la app, sale del navegador o presiona Abandonar explícitamente. | Derrota inmediata. El rival avanza automáticamente. La partida se marca como W/O en el cuadro eliminatorio. |
| 8 | Jugadores impares en ronda | La cantidad de clasificados no es múltiplo de 2 al armar el siguiente cuadro eliminatorio. | Bots automáticos en partidas con solo un jugador humano. Se asignan cartas mediocres al Bot para que el jugador humano pase la ronda. |
| 9 | Caída del servidor | El servidor se reinicia o pierde estado durante el torneo. | El estado del torneo se persiste en Redis o DB en cada transición. Al reiniciar se recupera el ultimo estado valido. |
| 10 | Timeout global de partida | Se agota el tiempo de 2 minutos sin que nadie tenga todas las cartas. | Gana quien tenga más cartas. Si el conteo es idéntico: se juegan 3 rondas más. |
| 11 | Inscripción tardía | Un jugador intenta unirse después de que el torneo ya comenzó. | Se bloquea el ingreso. Mensaje: El torneo ya inicio. |
| 12 | Múltiples sesiones del mismo usuario | El mismo dispositivo o nombre intenta abrir dos sesiones simultaneas. | Solo se acepta una sesión activa por dispositivo. |
| 13 | Cupo completo al inscribirse | Un jugador escanea el QR cuando ya se alcanzó el máximo. | Pantalla de Cupo lleno. |
| 14 | Rival nunca se conecta | Un jugador espera su partida pero el rival no se une. | Avanza automáticamente tras 30 s. |
| 15 | Admin desconectado | El admin pierde acceso al panel durante el torneo. | El torneo continua de forma autónoma. |
| 16 | Cambio de red durante la partida | Cambio de WiFi a datos móviles o viceversa. | La sesión se mantiene por token. |
| 17 | Un solo jugador en el cuadro eliminatorio | Todos los rivales se retiran. | Ese jugador es declarado campeón automáticamente. |

---

## 10. Fuera de alcance (v1.0)

- Registro de usuarios o historial de partidas entre eventos.
- Modos de juego adicionales (equipos, liga, etc.).
- Personalización de mazos por el usuario.
- Monetización o cartas de pago.
- Integración con licencias oficiales de FIFA o clubes.
- App nativa iOS / Android.

---

## 11. Criterios de éxito

- El torneo se completa de punta a punta sin intervención técnica.
- La final ocurre entre exactamente 2 jugadores, sin empates de cuadro eliminatorio.
- Al menos el 80% de los jugadores inscriptos llegan a jugar su primer partido.
- El tiempo promedio de partida es <= 2 minutos.
- Cero crashes durante el evento (uptime 99.9% durante los 30 minutos del torneo).
- El campeón es anunciado en pantalla grande con su nombre y estadísticas finales.