
## App Interna de Jardinería — Plan de Implementación

### Usuarios y Roles
- **4 roles diferenciados**: Dueño y Admin (mismo acceso total), Encargado (gestión intermedia) y Jardinero (acceso operativo)
- Sistema de login con email/contraseña para los 5 trabajadores
- Cada usuario ve únicamente lo relevante a su rol

---

### Pantallas para Jardineros
**Vista principal**
- Lista de jardines asignados al jardinero
- Estado actual de cada jardín (en jornada / sin actividad)

**Check-in / Check-out**
- Botón de entrada al pulsar en un jardín → registra hora y fecha automáticamente
- Botón de salida → cierra la jornada y calcula tiempo trabajado
- Historial de jornadas del jardinero

**Incidencias**
- Formulario para abrir una incidencia en un jardín: descripción de texto, nivel de urgencia (alta/media/baja), foto adjunta desde móvil
- Ver el estado de sus incidencias (abierta, en proceso, resuelta)

---

### Pantallas para Encargado
- **Resumen del día**: qué jardineros están activos, en qué jardín y desde cuándo
- **Gestión de incidencias**: ver todas las incidencias, cambiar estado, asignar prioridad
- **Historial**: registros de check-in/out por jardín o por trabajador con filtros

---

### Pantallas para Dueño / Admin (acceso total)
- **Dashboard general**: resumen de actividad del día (jardines activos, jornadas abiertas, incidencias pendientes)
- **Gestión de jardines**: ver jardines, jardineros asignados, historial completo
- **Gestión de trabajadores**: listado de los 5 trabajadores, sus roles y actividad reciente
- **Incidencias**: vista completa con filtros por jardín, urgencia y estado
- **Importación inicial desde Google Sheets**: subida de datos de jardines y trabajadores para arrancar la app

---

### Diseño
- Interfaz **mobile-first** (los jardineros usan el móvil en campo)
- Estilo limpio y funcional, colores verdes naturales acordes con la temática de jardinería
- Navegación simple con barra inferior en móvil

---

### Base de datos
- Autenticación segura con roles en tabla separada
- Tablas: jardines, asignaciones, registros de jornada (check-in/out), incidencias con fotos
- Almacenamiento de imágenes para las fotos de incidencias
