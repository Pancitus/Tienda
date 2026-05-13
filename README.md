# 🏠 J.A.K Home & Tech — Agente IA en WhatsApp + Tienda Web

> Sistema de atención al cliente 24/7 con inteligencia artificial integrado en WhatsApp, conectado a una tienda web con catálogo en tiempo real.

**Autor:** Byron Adrián Chico Choéz — *Instituto Superior Tecnológico Speedwriting, Guayaquil, Ecuador — 2025*

---

## 📋 Tabla de Contenidos

- [Resumen](#-resumen)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Infraestructura y Despliegue](#-infraestructura-y-despliegue)
- [Base de Datos — Supabase](#-base-de-datos--supabase)
- [Inventario — Google Sheets](#-inventario--google-sheets)
- [Flujo n8n — Agente IA](#-flujo-n8n--agente-ia-ia_kj)
- [Sistema de Prompts](#-sistema-de-prompts-del-agente)
- [Tienda Web — Frontend](#-tienda-web--frontend)
- [APIs e Integraciones](#-apis-e-integraciones-externas)
- [Seguridad](#-seguridad-y-autenticación)
- [Costos](#-costos-del-sistema)
- [Mantenimiento](#-guía-de-mantenimiento)
- [Glosario](#-glosario-técnico)
- [Stack Tecnológico](#-stack-tecnológico)

---

## 🚀 Resumen

Este proyecto implementa dos componentes interconectados para la microempresa **J.A.K Home & Tech**, ubicada en el cantón Durán, Guayaquil, Ecuador:

- **Agente IA (IA_KJ):** integrado en WhatsApp, construido sobre la plataforma de automatización **n8n**. Atiende clientes (como asesor comercial) y administradores (gestión de inventario).
- **Tienda web estática:** alojada en Cloudflare Pages, con catálogo de productos en tiempo real desde Google Sheets.

### ✅ Beneficios principales

- Tiempo de respuesta reducido de horas a **segundos**
- Atención **24/7** sin intervención humana
- Gestión de inventario automatizada por WhatsApp (texto, audio o imagen)
- Tienda web siempre actualizada sin edición manual
- Costo operativo total: **~$17 USD/mes**

---

## 🏗️ Arquitectura del Sistema

El sistema está compuesto por **8 módulos funcionales** interconectados mediante APIs REST y webhooks:

| Módulo | Tecnología | Función Principal |
|--------|-----------|------------------|
| M1 — Orquestación | n8n (self-hosted) | Coordina todos los flujos automatizados |
| M2 — Mensajería | Evolution API + WhatsApp | Recibe y envía mensajes vía webhook |
| M3 — Persistencia | Supabase (PostgreSQL) | Almacena historial de chats y configuración |
| M4 — Inventario | Google Sheets | Fuente de verdad del catálogo de productos |
| M5 — Web Frontend | HTML/CSS/JS + Cloudflare | Tienda pública con catálogo en tiempo real |
| M6 — Multimedia | GitHub + Cloudflare CDN | Almacenamiento permanente de imágenes |
| M7 — IA Conversacional | Groq (LLM) / Gemini | Procesamiento de lenguaje natural y visión |
| M8 — Infraestructura | Hostinger VPS + EasyPanel | Servidor de ejecución de n8n y Evolution API |

### Flujo de datos

```
Usuario WhatsApp
      │
      ▼
Evolution API  ──webhook──►  n8n (38 nodos)
                                  │
              ┌───────────────────┼────────────────────┐
              ▼                   ▼                    ▼
         Supabase           Google Sheets          Groq / Gemini
      (historial chat)       (inventario)        (LLM / Whisper / Vision)
              │                   │                    │
              └───────────────────┼────────────────────┘
                                  ▼
                          Respuesta WhatsApp
                        + Actualización web (si aplica)
```

---

## 🖥️ Infraestructura y Despliegue

### VPS — Hostinger

| Parámetro | Valor |
|-----------|-------|
| Proveedor | Hostinger |
| Tipo | VPS KVM1 |
| IP pública | 72.62.165.107 |
| Sistema operativo | Ubuntu 24 LTS |
| Panel de control | EasyPanel v2.24 |
| Costo mensual | ~$17 USD/mes |
| Caducidad contrato | 2026-03-03 |

### Servicios en EasyPanel (Docker)

- `n8n` — Motor de automatización (HTTPS vía subdominio)
- `postgres` (n8n) — Base de datos interna de n8n
- `redis` (n8n) — Caché y cola de trabajos
- `evolution-api` — Puente n8n ↔ WhatsApp (Baileys)
- `postgres` (evolution-api) — Sesiones de WhatsApp
- `redis` (evolution-api) — Caché de Evolution API

### Evolution API

La instancia activa **IA_KJ** se conecta al número `+593 963 426 407` mediante escaneo de QR.

```
URL Webhook:     https://n8n-n8n.oi2bf4.easypanel.host/webhook/IA_KJ
Webhook Base64:  activado (para audios e imágenes)
```

### Tienda Web — Cloudflare Pages + GitHub

1. Los archivos HTML/CSS/JS se suben al repositorio de GitHub
2. Cloudflare Pages detecta el commit y despliega automáticamente
3. Las imágenes se sirven vía CDN de GitHub (`raw.githubusercontent.com`)
4. La URL pública de cada imagen se guarda en el Google Sheet (`link_imagen`)

---

## 🗄️ Base de Datos — Supabase

Supabase (PostgreSQL) almacena el historial de conversaciones y la configuración del bot, con **Row Level Security (RLS)** habilitado.

### Tabla: `whatsapp_chat_history`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int8 (PK) | Identificador único del mensaje |
| `session_id` | varchar | Número de teléfono del usuario |
| `content` | text | Contenido textual (o transcripción de audio) |
| `message_timestamp` | timestamptz | Fecha y hora de recepción |
| `was_audio` | bool | True si el mensaje original era audio |
| `user_name` | varchar | Nombre de perfil en WhatsApp |

### Tabla: `bot_config`

| key | Valor actual | Descripción |
|-----|-------------|-------------|
| `context_window` | 10 | Mensajes del historial enviados al LLM |
| `timezone` | `America/Guayaquil` | Zona horaria para saludos y fechas |
| `retention_days` | 30 | Días de retención antes de limpieza |

### Consultas útiles

```sql
-- Ver últimos 20 mensajes
SELECT user_name, LEFT(content, 50) AS mensaje,
  CASE WHEN was_audio THEN 'audio' ELSE 'texto' END AS tipo,
  TO_CHAR(message_timestamp, 'DD/MM HH24:MI') AS fecha
FROM whatsapp_chat_history
ORDER BY message_timestamp DESC LIMIT 20;

-- Mensajes por usuario
SELECT user_name, COUNT(*) AS total,
  SUM(CASE WHEN was_audio THEN 1 ELSE 0 END) AS audios
FROM whatsapp_chat_history
GROUP BY user_name ORDER BY total DESC;

-- Limpiar mensajes con más de 30 días
DELETE FROM whatsapp_chat_history
WHERE message_timestamp < NOW() - INTERVAL '30 days';
```

---

## 📊 Inventario — Google Sheets

Google Sheets actúa como la **fuente de verdad** del catálogo. Tanto el agente como la web leen de esta hoja.

**ID del sheet:** `1ApjOy0d0sTGOwFQNPif-bgbyzJVVidPAPtDYhp4tYuw`

### Estructura de columnas

| Col | Campo | Descripción |
|-----|-------|-------------|
| A | `id` | Identificador único (ej. `ID_001`). Generado automáticamente por el agente. |
| B | `nombre` | Nombre del producto |
| C | `categoria` | `ropa`, `accesorios`, `muebles`, `electronicos`, `maquillaje`, `cuidado personal` |
| D | `cantidad` | Stock disponible en unidades |
| E | `precio_unitario` | Precio sin símbolo de moneda (ej. `18.75`) |
| F | `descripcion_del_producto` | Descripción. Si contiene "oferta", la web muestra un badge especial. |
| G | `link_imagen` | URL principal (GitHub CDN). Puede ser fórmula `=IMAGE()`. |
| H+ | imágenes adicionales | URLs para el carrusel del modal en la web |

### Exportación CSV para la web

```
https://docs.google.com/spreadsheets/d/1ApjOy0d0sTGOwFQNPif-bgbyzJVVidPAPtDYhp4tYuw/
  export?format=csv&gid=625925071
```

La web hace **polling cada 5 segundos** para detectar cambios en tiempo real.

---

## 🤖 Flujo n8n — Agente IA (IA_KJ)

El flujo tiene **38 nodos** organizados en ramas lógicas.

### Entrada y enrutamiento

| Nodo | Tipo | Función |
|------|------|---------|
| Webhook | `webhook` | Punto de entrada — Evolution API envía cada mensaje aquí |
| Extraer Datos | `set` | Normaliza: número, tipo de mensaje, contenido, nombre |
| Switch - Tipo de Mensaje | `switch` | Bifurca: texto → principal / audio → transcripción / imagen → visión |

### Identificación y contexto

| Nodo | Función |
|------|---------|
| 🔍 Identificar Usuario | Compara número/nombre contra whitelist de admins. Devuelve: `isAdmin`, `adminName`, `userRole` |
| ⚡ Verificar Admin | Si `isAdmin=true`, habilita rama de comandos de inventario |
| 📖 Leer Historial | Consulta últimos N mensajes del usuario en Supabase |
| 📊 Leer Inventario | Lee todas las filas del Google Sheet |
| 🔍 Filtrar Inventario Inteligente | Filtra y normaliza para reducir tokens enviados al LLM |

### Rama de audio

| Nodo | Función |
|------|---------|
| 🎵 Preparar Audio | Decodifica el audio base64 recibido de Evolution API |
| Transcribir Audio (Groq) | Llama a Groq Whisper (speech-to-text). El resultado se trata como texto. |

### Rama de imágenes (visión IA)

| Nodo | Función |
|------|---------|
| Convertir imagen | Convierte imagen base64 al formato de Groq Vision |
| 🤖 Groq Vision API | Envía imagen a `llama-4-scout` para análisis visual |
| Groq Chat Model | LLM principal para respuestas (`llama-3.1 / llama-4`) |
| Google Gemini Chat Model | Modelo alternativo de respaldo |
| OpenRouter Chat Model | Tercer modelo disponible vía OpenRouter |

### Motor central del agente

| Nodo | Función |
|------|---------|
| 🔧 Preparar Contexto | Construye el contexto: fecha/hora, saludo, nombre, rol, historial, inventario |
| 📄 Unificar Contenido | Combina mensaje con transcripción de audio o análisis de imagen |
| 💾 Guardar Historial | Guarda el mensaje del usuario en Supabase |
| 🤖 AI Agent | Nodo principal LangChain — recibe contexto, llama al LLM, produce respuesta |
| 📄 Procesar Respuesta Groq | Detecta si es texto libre o un comando de actualización |

### Rama de actualización de inventario (solo admins)

| Nodo | Función |
|------|---------|
| SEPARADOR DE IMÁGENES | Detecta si el admin envió imagen. Separa: actualización de texto vs. imagen |
| 📦 Preparar Datos | Parsea el comando y extrae campos a modificar |
| ✏️ PROCESAR ACTUALIZACIÓN | Busca producto por nombre (búsqueda fuzzy) y prepara la fila actualizada |
| 📝 VALIDAR ACTUALIZACIÓN | Valida datos antes de escribir (tipos, rangos, campos requeridos) |
| 📊 ACTUALIZAR EN SHEET | Escribe los campos actualizados en Google Sheets |
| 🔢 GENERAR ID INCREMENTAL | Genera ID único para productos nuevos (`ID_001`, `ID_002`...) |
| Append row in sheet | Agrega fila nueva cuando el admin crea un producto inexistente |

### Rama de imágenes de productos

| Nodo | Función |
|------|---------|
| 🖼️ VERIFICAR Y ACTUALIZAR IMAGEN | Valida formato y prepara payload para subir a GitHub |
| Create a file | Sube la imagen al repositorio (carpeta `imagenes/`) vía GitHub API |
| 🔗 Obtener Link Público | Construye la URL CDN de GitHub para la imagen subida |
| 📝 ACTUALIZAR IMAGEN EN SHEET | Escribe el `link_imagen` en la columna G del producto |
| 📤 Enviar Confirmación Imagen | Envía confirmación al admin con el link guardado |

---

## 💬 Sistema de Prompts del Agente

### Variables de contexto inyectadas en tiempo de ejecución

| Variable | Contenido |
|----------|-----------|
| `{{ $json.currentDate }}` | Fecha en español (ej. "miércoles, 21 de enero de 2026") |
| `{{ $json.currentTime }}` | Hora en formato HH:MM (zona America/Guayaquil) |
| `{{ $json.greeting }}` | "Buenos días", "Buenas tardes" o "Buenas noches" |
| `{{ $json.userName }}` | Nombre de perfil WhatsApp del remitente |
| `{{ $json.userRole }}` | `admin` o `cliente` |
| `{{ $json.historialFormateado }}` | Últimos N mensajes de la conversación |
| `{{ $json.inventoryData }}` | Array JSON del inventario de Google Sheets |
| `{{ $json.userMessage }}` | Mensaje actual (texto o transcripción de audio) |
| `{{ $json.hasImage }}` | `"true"` si el mensaje incluye imagen |

### Comportamiento por rol

**Con clientes:**
- Lenguaje coloquial ecuatoriano: "loco", "pana", "ñaño", "brother"
- Adapta tono si el cliente usa lenguaje formal
- Solo informa sobre inventario, precio y disponibilidad
- No revela funciones ni comandos administrativos

**Con administradores (Don Adrián / Doña Karina):**
- Trato formal con "usted" ("Don Adrián", "Doña Karina")
- Habilita todos los comandos de gestión de inventario
- Confirma cada actualización con resumen de cambios
- Procesa mensajes de audio para comandos de inventario

### Comandos de actualización de inventario

El agente detecta la intención y responde **solo con el comando**, sin texto adicional:

| Comando | Descripción |
|---------|-------------|
| `ACTUALIZAR_PRECIO│nombre│valor` | Cambia el precio unitario |
| `ACTUALIZAR_CANTIDAD│nombre│numero` | Cambia el stock disponible |
| `ACTUALIZAR_DESCRIPCION│nombre│texto` | Cambia la descripción |
| `ACTUALIZAR_NOMBRE│nombre_actual│nuevo_nombre` | Renombra el producto |
| `ACTUALIZAR_CATEGORIA│nombre│categoria` | Cambia la categoría |
| `ACTUALIZAR_MULTIPLE│nombre│campo1:v1│campo2:v2│...` | Actualiza múltiples campos |

**Ejemplo:**
```
Admin: "Cambia el precio del micrófono a 200 y cantidad a 20"
IA_KJ: ACTUALIZAR_MULTIPLE|Micrófono|precio:200|cantidad:20
```

---

## 🌐 Tienda Web — Frontend

SPA estática construida con **HTML5, CSS3 vanilla y JavaScript puro** (sin frameworks), servida desde Cloudflare Pages.

### Estructura de archivos

```
/
├── index.html          # Estructura: header, hero, filtros, grid, contacto, footer
├── css/
│   └── styles.css      # Diseño dark purple, responsive, animaciones, modal, autocomplete
├── js/
│   └── script.js       # Carga CSV, filtrado, búsqueda, modal, carrusel, autocomplete
└── imagenes/           # Logo y fotos de productos (servidas vía GitHub CDN)
```

### Variables CSS del sistema de diseño

| Variable | Valor | Uso |
|----------|-------|-----|
| `--color-primary` | `#8A2BE2` (violeta) | Color principal, encabezados, botones |
| `--color-secondary` | `#6a1bb2` | Variante oscura del violeta |
| `--color-accent` | `#00d4ff` (cian) | Precios, destacados, links |
| `--color-bg` | `#0a0a0a` | Fondo de página (casi negro) |
| `--color-card` | `#1a1a1a` | Fondo de tarjetas de producto |

### Módulos JavaScript

**`fetchCsv()`** — Descarga y parsea el CSV de Google Sheets. Parser robusto que maneja celdas con saltos de línea.

**`syncCards()`** — Sincroniza el DOM sin recargar la página: crea tarjetas nuevas, actualiza existentes y elimina con animación las que desaparecen.

**Motor de búsqueda** — Sistema multi-campo con pesos de relevancia:
- Nombre: ×3 | Categoría: ×2 | Descripción: ×1 | Precio: ×1
- Coincidencia exacta: ×4 | Empieza por: ×2 | Contiene: ×1
- Algoritmo de **Levenshtein** para sugerencias de corrección tipográfica

**Autocomplete** — Sugerencias en tiempo real + historial de búsquedas en `localStorage` (máx. 6 entradas).

**Modal de producto** — Carrusel de imágenes, detalles completos y botón de consulta por WhatsApp con conversación prellenada.

### Categorías de filtrado

| Categoría | Emoji | Descripción |
|-----------|-------|-------------|
| Todos | 🔄 | Sin filtro |
| ropa | 👗 | Prendas de vestir |
| accesorios | 👔 | Complementos de moda |
| cuidado personal | 🧴 | Belleza e higiene |
| muebles | 🏠 | Artículos para el hogar |
| maquillaje | 💄 | Cosméticos |
| electronicos | 📱 | Dispositivos tecnológicos |
| ofertas | 🔥 | Productos con "oferta" en descripción o categoría |

---

## 🔌 APIs e Integraciones Externas

| Servicio | Uso | Autenticación | Endpoint principal |
|---------|-----|---------------|--------------------|
| Evolution API | Enviar/recibir mensajes WhatsApp | API Key propia | `http://[ip]/message/sendText/{instance}` |
| Groq (LLM) | Respuestas conversacionales | Bearer Token | `https://api.groq.com/openai/v1/chat/completions` |
| Groq Whisper | Transcripción de voz | Bearer Token | `https://api.groq.com/openai/v1/audio/transcriptions` |
| Google Gemini | LLM alternativo | API Key Google Cloud | vía SDK LangChain n8n |
| OpenRouter | Acceso a múltiples LLMs (fallback) | Bearer Token | `https://openrouter.ai/api/v1` |
| Google Sheets API | Lectura/escritura de inventario | OAuth2 (cuenta de servicio) | vía nodo nativo n8n |
| Supabase | Historial de chat y configuración | URL + anon key | vía nodo Postgres n8n |
| GitHub API | Subida de imágenes | Personal Access Token | `https://api.github.com/repos/{owner}/{repo}/contents/{path}` |

---

## 🔐 Seguridad y Autenticación

### Identificación de administradores

El nodo **"Identificar Usuario"** compara el remitente contra una whitelist usando:
- **Número de teléfono** (`session_id`): comparación exacta
- **Nombre de perfil** (`user_name`): comparación case-insensitive

Un usuario fuera de la whitelist **nunca** podrá ejecutar comandos de inventario — el nodo "Verificar Admin" bloquea el flujo antes de llegar a los nodos de escritura.

### Protección de credenciales

- Todas las API Keys (Groq, GitHub, Supabase, Evolution API) se almacenan en el **gestor de credenciales cifrado de n8n**
- Google Sheets usa **OAuth2 de cuenta de servicio** (renovación automática)
- VPS protegido con **SSH + HTTPS/TLS** vía Let's Encrypt (gestionado por EasyPanel)
- Supabase usa **Row Level Security (RLS)** a nivel de fila
- El webhook de n8n tiene **URL única no adivinable** como secreto implícito

---

## 💰 Costos del Sistema

| Componente | Costo | Periodicidad |
|-----------|-------|-------------|
| VPS Hostinger KVM1 | $17 USD | Mensual |
| Groq API (LLM + Whisper) | $0 | Free tier |
| Supabase | $0 | Free tier |
| Google Sheets | $0 | Incluido en cuenta Google |
| GitHub | $0 | Free tier |
| Cloudflare Pages | $0 | Free tier |
| Evolution API | $0 | Open source, self-hosted |
| n8n | $0 | Open source, self-hosted |
| **TOTAL** | **~$17 USD/mes** | Mensual |

---

## 🔧 Guía de Mantenimiento

### Tareas periódicas

| Tarea | Frecuencia | Descripción |
|-------|-----------|-------------|
| Actualizar prompt del agente | Mensual | Reflejar nuevos productos, promociones o políticas |
| Revisar historial de conversaciones | Semanal | Detectar preguntas sin respuesta correcta y mejorar prompt |
| Backup de Supabase | Diaria | Exportar `whatsapp_chat_history` a CSV |
| Limpiar mensajes antiguos | Mensual | Ejecutar `DELETE FROM ... WHERE message_timestamp < NOW() - INTERVAL '30 days'` |
| Renovar token de GitHub | Anual | El Personal Access Token puede expirar |
| Verificar conexión Evolution API | Semanal | Confirmar que la instancia IA_KJ esté "Conectada" |
| Capacitación de admins | Bimestral | Repasar comandos de actualización y manejo del Google Sheet |

### Solución de problemas frecuentes

**El bot no responde mensajes:**
1. Verificar que la instancia IA_KJ en Evolution API dice "Conectado"
2. Si está desconectado, escanear el QR nuevamente desde el panel
3. Revisar que el flujo de n8n esté activo (toggle verde)

**Los productos no aparecen en la web:**
1. Verificar que el Google Sheet tenga el formato correcto (columnas A–G)
2. Confirmar que la hoja sea pública o accesible con el link CSV
3. Abrir la URL del CSV directamente en el navegador para verificar

**Las imágenes no se guardan desde WhatsApp:**
1. Verificar que el Personal Access Token de GitHub siga vigente
2. Confirmar que la carpeta `imagenes/` exista en el repositorio
3. Revisar los logs del nodo "Create a file" en n8n

---

## 📖 Glosario Técnico

| Término | Definición |
|---------|-----------|
| **n8n** | Plataforma de automatización de flujos open source (low-code). Conecta servicios mediante drag-and-drop. |
| **Evolution API** | API open source que actúa como puente entre aplicaciones y WhatsApp usando la librería Baileys. |
| **Supabase** | Plataforma de base de datos PostgreSQL como servicio (BaaS), similar a Firebase pero open source. |
| **Groq** | Proveedor de inferencia de LLMs de alta velocidad. Usa hardware LPU propio para latencias muy bajas. |
| **LLM** | Large Language Model. Modelo de IA entrenado en texto para generar respuestas conversacionales. |
| **Webhook** | Endpoint HTTP que recibe notificaciones automáticas de un servicio cuando ocurre un evento. |
| **VPS** | Virtual Private Server. Servidor virtual con recursos dedicados. |
| **EasyPanel** | Panel visual para gestionar contenedores Docker en un VPS sin línea de comandos. |
| **Cloudflare Pages** | Servicio de hosting estático gratuito con CDN global y despliegue automático desde Git. |
| **OAuth2** | Protocolo de autorización delegada. Permite a n8n acceder a Google Sheets sin contraseña directa. |
| **Levenshtein** | Algoritmo que mide la distancia de edición entre dos cadenas. Usado para correcciones tipográficas. |
| **CSV** | Comma-Separated Values. Formato de texto plano para tablas, exportable desde Google Sheets. |
| **CDN** | Content Delivery Network. Red de servidores que sirven archivos desde el nodo más cercano al usuario. |
| **Base64** | Codificación que convierte datos binarios (audio/imagen) a texto ASCII para transporte por APIs. |

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Plan | Rol |
|------|-----------|------|-----|
| Automatización | n8n | latest (self-hosted) | Motor principal — 38 nodos |
| Mensajería | Evolution API | latest (self-hosted) | Conector WhatsApp |
| IA conversacional | Groq (LLaMA 3/4) | Free tier | LLM para respuestas |
| Transcripción voz | Groq Whisper | Free tier | Speech-to-text |
| Visión IA | Groq Vision (LLaMA Scout) | Free tier | Análisis de imágenes |
| Base de datos | Supabase (PostgreSQL) | Free tier | Historial de chats |
| Inventario | Google Sheets | Google Workspace | Catálogo en tiempo real |
| Web hosting | Cloudflare Pages | Free tier | Hosting de la tienda |
| Imágenes CDN | GitHub + CDN | Free tier | Almacenamiento de fotos |
| Infraestructura | Hostinger VPS KVM1 | $17/mes | Servidor principal |
| Panel control | EasyPanel | Open source | Gestión de contenedores |
| Frontend | HTML5 / CSS3 / JS ES6 | Vanilla | Tienda web pública |
| Backend scripts | JavaScript (Node.js en n8n) | ES2022 | Lógica de procesamiento |

---

*Documentación generada a partir de la documentación técnica completa del proyecto — J.A.K Home & Tech, 2025*
