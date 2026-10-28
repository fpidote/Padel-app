# Ayudantes de torneo — diseño

Fecha: 2026-10-28 · Estado: borrador para aprobación del dueño del producto

## Intención

En los torneos que organiza un club hay varios profes u organizadores, pero hoy todo recae en una sola
persona: solo la cuenta de Google que creó el torneo puede cargar resultados. Los demás profes no pueden
ayudar aunque estén en la pista. Se quiere que el creador de un torneo pueda dar acceso a alguien de su
confianza para que cargue resultados desde su propio móvil, con su propia cuenta de Google.

Lo que más importa al dueño del producto, dicho en sus palabras: que no la caguemos con la app. Esa
preocupación es una regla de diseño, no un detalle: ningún torneo existente puede dejar de funcionar, y
nadie ajeno puede obtener permisos.

## Qué se decidió (palabras del dueño)

- El **creador** del torneo da acceso a alguien de su confianza.
- La persona entra **como administradora, con su cuenta de Google**. Hoy solo existe el inicio de sesión
  de Google, y se reutiliza: no hay un tipo de cuenta nuevo.
- La persona llega **por el mismo enlace o código del torneo** que usan los espectadores e inicia sesión
  ahí. No hace falta una lista "Mis torneos" para ayudantes en esta primera etapa.
- El **ayudante puede**: cargar y corregir resultados, pasar a la siguiente ronda y finalizar el torneo.
- Queda **solo para el dueño**: preparar el torneo (parejas, configuración), "Revisar y lanzar", editar el
  torneo, borrarlo, y dar o quitar ayudantes. El ayudante empieza a actuar cuando el torneo ya está en marcha.
- Los espectadores no cambian.

## Decisiones tomadas por mí (a confirmar por el dueño)

- **Identificar al ayudante por su correo de Google**: el dueño escribe el correo y, cuando esa persona inicia
  sesión con esa cuenta, tiene permiso en ese torneo. (Alternativa descartada: enlace de invitación, porque
  se puede reenviar a otra persona.)
- **Fases intermedias** ("Iniciar fase final" en Liga y Torneo por grupos): las trato como pasar de ronda,
  así que el ayudante puede hacerlas. "Volver a la fase de liga" lo dejo también al ayudante mientras no se
  haya jugado nada de la eliminatoria, igual que hoy lo puede el dueño. *Mi suposición; el dueño no lo dijo.*
- **Máximo de ayudantes por torneo**: 5. *Mi suposición, para acotar abuso.*

- **Cuando el control de versión rechaza un guardado** (decisión del dueño): se **descarta** el cambio de quien
  llegó tarde, se le muestra la versión nueva y un aviso claro ("Otro organizador guardó a la vez; se cargó la
  versión más reciente, repite tu cambio"), y vuelve a escribir su marcador. No se reaplica ni se fusiona
  automáticamente.
- **Mis decisiones al revisar el diseño** (el dueño no las dijo; a confirmar al leer el documento):
  - Dos pestañas o dispositivos del **mismo dueño** también reciben el aviso en lugar de pisarse en silencio,
    como pasa hoy. Un reintento que repite un guardado que sí había entrado no cuenta como conflicto: se
    reconoce con un identificador de escritura guardado dentro de `data` (no se añaden campos de primer nivel).
  - Para que el ayudante entre, la página del torneo muestra un enlace discreto **"Iniciar sesión"** a quien no
    la tiene iniciada. Iniciar sesión con Google reemplaza la sesión anónima del espectador; la comprobación de
    "¿soy ayudante?" se repite sola al iniciar sesión, sin recargar.
  - El permiso del ayudante se comprueba **una vez al iniciar sesión**. Si el dueño le quita el acceso con el
    torneo abierto, el siguiente guardado falla y se le avisa. No se crea un segundo listener (CLAUDE.md lo
    prohíbe fuera de `useTournament.js`).
  - Correos: **coincidencia exacta en minúsculas**, sin normalizar puntos ni alias, y la pantalla de ayudantes
    avisa de que debe ser el correo con el que esa persona inicia sesión.
  - El **máximo de 5 ayudantes** se aplica solo en la pantalla (las reglas no pueden contar documentos de forma
    barata).

## Objetivos

- Que un ayudante cargue resultados desde su móvil sin compartir la cuenta del dueño.
- Que el dueño pueda quitar el acceso en cualquier momento.
- Que los torneos ya creados sigan funcionando exactamente igual, sin migración.
- Que ningún correo de ayudante sea visible para los espectadores.

## No objetivos (en esta etapa)

- Que el servidor impida que un ayudante cambie algo distinto de resultados. El torneo se guarda como un solo
  bloque de datos (`data`, un JSON) y las reglas de Firestore no distinguen qué parte cambia. La restricción
  "solo resultados" se aplica en la pantalla y es de confianza. Se acepta porque es alguien de confianza.
- Lista "Mis torneos" para ayudantes.
- Varios dueños, transferir un torneo, invitaciones por correo electrónico o notificaciones.
- Más roles que dueño, ayudante y espectador.

## Anti-objetivos (fracaso aunque técnicamente funcione)

- Romper un torneo existente o su lectura por espectadores.
- Dar escritura a quien no es el dueño ni un ayudante de ese torneo.
- Exponer los correos de los ayudantes a quien tenga el código.
- Que dos personas cargando a la vez pierdan resultados sin aviso (ver el requisito previo).

## Requisito previo

**Control de versión al guardar.** Hoy dos clientes con el mismo estado escriben el mismo `ver` y gana el
último, sin aviso. Con ayudantes, cargar a la vez deja de ser raro. Antes de dar acceso a nadie hay que
guardar mediante una transacción que compruebe que nadie más cambió el torneo; si lo hizo, no se pisa nada:
el que llegó tarde recibe un aviso y ve la versión nueva. Esto toca `saveQueue.js` y `useTournament.js` y es
independiente de la función de ayudantes.

## Modelo de datos y permisos

**Los ayudantes viven en una subcolección**, no en el documento del torneo, para que el documento (de
lectura pública) no exponga correos:

- `torneos/{code}/helpers/{email}` con el correo en minúsculas como id del documento. Contenido mínimo:
  `{ addedAt }`.
- Reglas de la subcolección: **solo el dueño la lee, la crea o la borra; cada ayudante puede leer únicamente
  su propio documento** (para saber que tiene acceso). Nadie más.
- Reglas de actualización del torneo: puede actualizar **el dueño** (como hoy) **o un ayudante**, entendido
  como alguien con sesión, con el correo verificado, que no es anónimo y cuyo documento existe en
  `helpers` de ese torneo. En el caso del ayudante, solo puede cambiar el campo `data`: `ownerUid` y
  `createdAt` no cambian y no se añaden campos.
- Crear y borrar el torneo siguen siendo solo del dueño. La lectura (`get`) sigue siendo pública.
- Los torneos antiguos no tienen subcolección: nadie es ayudante y todo funciona como hoy.

## Cliente

- `isAdmin` se divide en **dueño** y **puede puntuar** (dueño o ayudante). El ayudante se detecta tras iniciar
  sesión leyendo su propio documento de `helpers` en ese torneo.
- Con "puede puntuar" se habilitan: cargar y corregir resultados, siguiente ronda y finalizar (y, según la
  decisión de arriba, iniciar fase final y volver a la fase de liga).
- Solo el dueño ve y usa: editar torneo, preparar y lanzar, borrar y la sección **"Ayudantes"** (añadir por
  correo, ver la lista, quitar). Antes de confirmar, se muestra el correo escrito para evitar errores.
- El ayudante ve un distintivo claro de su rol ("Ayudante"), y si no es ayudante ni dueño ve el torneo como
  espectador, sin mensajes de error.
- Correos: se guardan normalizados (minúsculas, sin espacios). Cómo tratar los puntos en cuentas de Gmail se
  deja al constructor, con la regla de que nunca debe dar acceso a otra persona.
- Si se quita el acceso a alguien con el torneo abierto, su siguiente guardado falla y se le avisa con un
  mensaje claro, sin perder la vista del torneo.

## Seguridad y despliegue

- Las reglas de Firestore se despliegan **a mano** (`firebase deploy --only firestore:rules`) y afectan a
  producción: los cambios van cubiertos por `firestore.rules.test.js` (`npm run test:rules`) antes de
  desplegar, incluyendo: dueño, ayudante, extraño, cuenta anónima, correo sin verificar, ayudante intentando
  cambiar `ownerUid`/`createdAt`/campos extra, ayudante intentando borrar o gestionar ayudantes, y lectura
  cruzada de `helpers`.
- Orden de despliegue: (1) control de versión al guardar; (2) reglas, que son compatibles hacia atrás porque
  la subcolección empieza vacía; (3) interfaz. Cada paso se puede publicar y verificar por separado.

## Cómo se comprueba

- Pruebas de reglas (arriba).
- e2e con dos contextos de navegador: dueño y ayudante cargando resultados a la vez; el ayudante no ve
  editar/borrar/lanzar; un usuario que no es ayudante sigue como espectador; quitar el acceso corta la
  escritura.
- Toda la suite existente debe seguir verde, como prueba de que nada se rompió.

## Lo que se deja al constructor

- Textos exactos, aspecto de la sección "Ayudantes" y del distintivo, y cómo mostrar los errores.
- Cómo dividir `isAdmin` en los componentes con el menor cambio posible.
- Tratamiento fino de los correos (ver arriba) y estructura exacta de las pruebas.
