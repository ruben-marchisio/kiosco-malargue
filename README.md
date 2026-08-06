# 🏪 Kiosco Digital — Malargüe

> **PWA + E-Commerce Híbrido con cierre por WhatsApp**  
> Colonia Hípica · Malargüe, Mendoza, Argentina

[![Deploy](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-orange?logo=cloudflare)](https://kiosco-malargue.rubenmarchisio-4e3.workers.dev)
[![GitHub](https://img.shields.io/badge/Repo-GitHub-181717?logo=github)](https://github.com/ruben-marchisio/kiosco-malargue)
[![Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E?logo=supabase)](https://supabase.com)

---

## 📖 ¿Qué es este proyecto?

Kiosco Digital transforma un **kiosco tradicional de barrio** en un punto de distribución digital (_Dark Store_), permitiendo a los clientes navegar el catálogo desde el celular y confirmar pedidos directamente por **WhatsApp**, sin descargar ninguna app y sin registrarse.

### El problema que resuelve

Plataformas como **Rappi o PedidosYa no operan en Malargüe** por su baja densidad poblacional y las altas comisiones. Este proyecto crea una solución propia, de **costo operativo cero**, adaptada a la realidad local donde WhatsApp es el canal de comunicación principal.

### El concepto clave

No es solo un kiosco digital. La plataforma funciona como un **Marketplace hiperlocal**:

- El kiosco vende sus propios productos
- Integra **productores vecinos** (panadería, verdulería, comida casera) bajo un modelo de consignación con **10% de comisión**
- Todo llega en **un solo envío**, coordinado por WhatsApp

---

## 🎯 Filosofía de diseño: "WhatsApp-First"

| Principio               | Implementación                                                 |
| ----------------------- | -------------------------------------------------------------- |
| **Cero registro**       | El cliente navega y compra sin crear cuenta                    |
| **Cero fricción**       | Sin descargas, sin formularios                                 |
| **Carrito persistente** | Guardado en `localStorage` (sobrevive desconexiones)           |
| **Cierre automático**   | Botón genera mensaje estructurado y abre WhatsApp directamente |
| **Cero costo fijo**     | Hosting gratuito en Cloudflare, DB gratuita en Supabase        |

---

## 🛠️ Stack Tecnológico

| Capa                     | Tecnología                                       | Justificación                                              |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------- |
| **Frontend / PWA**       | HTML5 + CSS Vanilla + JS ES2022                  | Carga < 1s, ultra liviano, instalable en el cel            |
| **Estilos**              | CSS Custom Properties + Google Fonts (Inter)     | Sin dependencias, diseño moderno y responsive              |
| **Backend / DB**         | [Supabase](https://supabase.com) (PostgreSQL)    | API REST instantánea, Auth, Storage, RLS — plan gratuito   |
| **Hosting / CDN**        | [Cloudflare Pages](https://pages.cloudflare.com) | Edge global, deploy automático con `git push`, 100% gratis |
| **Control de versiones** | Git + GitHub                                     | CI/CD automático via Cloudflare Pages                      |
| **Arquitectura**         | Jamstack Serverless                              | Sin servidores propios, sin cold starts                    |

### Herramientas de desarrollo

| Herramienta      | Versión | Uso                               |
| ---------------- | ------- | --------------------------------- |
| **Prettier**     | ^3.x    | Formateo automático de código     |
| **ESLint**       | ^10.x   | Linting y detección de errores JS |
| **EditorConfig** | —       | Consistencia entre editores       |

---

## 📁 Estructura del Proyecto

```
kiosco-malargue/
│
├── 📄 index.html              # Catálogo PWA (página principal del cliente)
├── 📄 manifest.json           # Config PWA — hace la app instalable en el cel
├── 📄 sw.js                   # Service Worker — soporte offline
│
├── 📁 css/
│   └── style.css              # Estilos del catálogo (variables, grid, carrito, animaciones)
│
├── 📁 js/
│   ├── config.js              # ⚙️ Credenciales: Supabase URL, ANON key, WhatsApp, precio envío
│   └── app.js                 # Lógica principal: carga productos, carrito, WhatsApp checkout
│
├── 📁 admin/
│   ├── index.html             # Panel de administración (protegido por login)
│   ├── 📁 css/
│   │   └── admin.css          # Estilos del panel admin
│   └── 📁 js/
│       └── admin.js           # Lógica admin: auth, stock, pedidos, config
│
├── 📄 .gitignore              # Excluye: node_modules/, documentacion/
├── 📄 .prettierrc             # Reglas de formato (100 chars, single quotes, ES5 trailing comma)
├── 📄 .prettierignore         # Excluye de Prettier: node_modules/, PDFs
├── 📄 .editorconfig           # Consistencia de tabs/espacios entre editores
├── 📄 eslint.config.js        # Reglas ESLint para JS moderno (ES2022 modules)
├── 📄 package.json            # Scripts npm y dependencias de desarrollo
└── 📄 supabase_schema.sql     # Schema SQL completo para correr en Supabase
```

> ⚠️ La carpeta `documentacion/` con credenciales está en `.gitignore` y **nunca se sube a GitHub**.

---

## 🗄️ Modelo de Datos (Supabase)

### Tabla `productos`

```sql
id              UUID        -- ID único
nombre          TEXT        -- "Coca Cola 500ml"
descripcion     TEXT        -- Descripción corta
categoria       TEXT        -- 'bebidas' | 'snacks' | 'comidas' | 'panaderia' | 'verduleria' | 'limpieza' | 'otros'
precio          NUMERIC     -- Precio en pesos argentinos
imagen_url      TEXT        -- URL pública en Supabase Storage (formato .webp)
disponible      BOOLEAN     -- true = visible en catálogo / false = "Sin stock"
es_tercero      BOOLEAN     -- true = producto de vecino (cobra 10% comisión)
proveedor_nombre TEXT       -- Nombre del vecino si es_tercero = true
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ -- Se actualiza automáticamente via trigger
```

### Tabla `pedidos_log`

```sql
id              UUID
detalle         JSONB       -- Items del pedido
monto_total     NUMERIC     -- Total cobrado al cliente
monto_envio     NUMERIC     -- Tarifa de delivery (a liquidar al repartidor)
monto_comision  NUMERIC     -- 10% sobre productos de terceros
es_delivery     BOOLEAN
estado          TEXT        -- 'pendiente' | 'en_camino' | 'entregado' | 'cancelado'
notas           TEXT
created_at      TIMESTAMPTZ
```

### Tabla `config_negocio`

```sql
id               INT  -- Siempre = 1 (fila única)
nombre_negocio   TEXT
whatsapp_numero  TEXT -- Formato: 5492604XXXXXX (cod. país + número)
precio_envio     NUMERIC
abierto          BOOLEAN -- Controla el badge "Abierto/Cerrado" en la tienda
```

### Seguridad (RLS — Row Level Security)

| Tabla            | Lectura       | Escritura                 |
| ---------------- | ------------- | ------------------------- |
| `productos`      | 🌐 Pública    | 🔒 Solo admin autenticado |
| `pedidos_log`    | 🔒 Solo admin | 🔒 Solo admin             |
| `config_negocio` | 🌐 Pública    | 🔒 Solo admin             |

---

## 🚀 Flujo de Compra del Cliente

```
1. 📱 Escanea QR o accede a la URL
        ↓
2. 🛍️ Navega el catálogo sin registro
   (filtra por categoría: Bebidas, Snacks, Comidas...)
        ↓
3. ➕ Agrega productos al carrito
   (carrito guardado en localStorage)
        ↓
4. 🛒 Abre el carrito → ve subtotal + envío + total
        ↓
5. 💬 Toca "Confirmar por WhatsApp"
   → Se genera un mensaje estructurado automáticamente
   → Se abre WhatsApp con el mensaje listo
        ↓
6. 📍 El cliente agrega su dirección y envía
        ↓
7. 🏪 El kiosco confirma y coordina el delivery
```

---

## ⚙️ Panel de Administración (`/admin`)

Acceso: `[URL-del-sitio]/admin`  
Login: email + contraseña configurados en Supabase Authentication.

### Funcionalidades

| Sección       | Qué permite hacer                                                     |
| ------------- | --------------------------------------------------------------------- |
| **Dashboard** | Ver estadísticas del día: venta total, envíos, comisiones, pedidos    |
| **Stock**     | Activar/desactivar productos con un toggle (sin conteo de inventario) |
| **Stock**     | Agregar, editar o eliminar productos                                  |
| **Pedidos**   | Registrar pedidos confirmados vía WhatsApp                            |
| **Pedidos**   | Ver historial del día con desglose de montos                          |
| **Config**    | Cambiar número de WhatsApp, precio de envío, estado abierto/cerrado   |

### Lógica del stock (interruptor infinito)

Los productos **no tienen un contador de unidades**. Solo tienen un estado `disponible: true/false`. Con un toque desde el celular se activa o desactiva la visibilidad en tiempo real.

---

## 💻 Comandos de Desarrollo

```bash
# Instalar dependencias de desarrollo
npm install

# Levantar servidor local en http://localhost:3000
npm run dev

# Formatear TODOS los archivos con Prettier
npm run format

# Verificar formato sin modificar archivos
npm run check

# Revisar errores de JS con ESLint
npm run lint

# Deploy: commit automático + push a GitHub (Cloudflare actualiza solo)
npm run deploy
```

---

## 🌐 Deploy y CI/CD

```
Código local
    │
    │  git push  (o npm run deploy)
    ▼
GitHub (ruben-marchisio/kiosco-malargue)
    │
    │  Webhook automático
    ▼
Cloudflare Pages (build ~30 segundos)
    │
    ▼
🌍 https://kiosco-malargue.rubenmarchisio-4e3.workers.dev
```

**Cada `git push` = nuevo deploy automático.** No hay pasos manuales.

---

## 🔧 Configuración inicial (para clonar el proyecto)

### 1. Clonar el repo

```bash
git clone https://github.com/ruben-marchisio/kiosco-malargue.git
cd kiosco-malargue
npm install
```

### 2. Configurar Supabase

Editar `js/config.js`:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON = 'TU_ANON_PUBLIC_KEY';
const WHATSAPP_NUM = '549XXXXXXXXXX'; // Código país (54) + 9 + número
const PRECIO_ENVIO = 500; // Precio en pesos
```

### 3. Crear las tablas en Supabase

- Ir a **SQL Editor** en Supabase
- Copiar y ejecutar el contenido de `supabase_schema.sql`

### 4. Crear usuario admin

- En Supabase → **Authentication → Users → Add user**

### 5. Conectar Cloudflare Pages

- Workers & Pages → Create → Pages → Connect to Git
- Seleccionar el repo, framework: `None`, build: vacío, output: `/`

---

## 📊 Modelo de Negocio

| Ingreso              | Detalle                                                          |
| -------------------- | ---------------------------------------------------------------- |
| **Venta directa**    | Productos propios del kiosco                                     |
| **Comisión vecinos** | 10% sobre productos de productores locales integrados            |
| **Tarifa de envío**  | $4.000 por delivery (se liquida al repartidor al cierre del día) |

---

## 🗺️ Roadmap

- [x] **Fase 1** — Setup: GitHub + Cloudflare + Supabase
- [x] **Fase 2** — Catálogo PWA + carrito + checkout WhatsApp
- [x] **Fase 3** — Panel Admin con auth, stock toggle y caja diaria
- [ ] **Fase 4** — Imágenes reales de productos en Supabase Storage
- [ ] **Fase 5** — Distribución con códigos QR en Colonia Hípica y Barrio Procrear
- [ ] **Fase 6** — Notificaciones de nuevo pedido (WhatsApp Business API)
- [ ] **Fase 7** — Historial de ventas semanal/mensual en el dashboard

---

## 👤 Autor

**Ruben Marchisio**  
📧 rubenmarchisio@gmail.com  
🌍 Malargüe, Mendoza, Argentina

---

## 📄 Licencia

ISC © 2026 Ruben Marchisio
