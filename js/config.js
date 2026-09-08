/* =============================================
   Kiosco Digital — Supabase Config
   ⚠️ NO compartir el service_role en el frontend
   ============================================= */

const SUPABASE_URL = 'https://nlnfkdrdssaaynlrnfpj.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbmZrZHJkc3NhYXlubHJuZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjMyNTQsImV4cCI6MjEwMTUzOTI1NH0.YFZHdP6L0oxihoVsqqCDASK85hFM7RmdqOlP9xKD-GU';
const WHATSAPP_NUM = '5492604055198'; // El Pechito — Malargüe
const ENVIO_CONFIG = {
  base: 1500, // Precio para la distancia mínima
  distanciaBase: 1.5, // Hasta 1.5 km se cobra la base
  extraPorKm: 200, // Costo extra por cada km adicional
  maximo: 4000, // Tope máximo del envío
};
const ADMIN_EMAIL = 'rubenmarchisio@gmail.com'; // Admin principal

// ── Cadetería: local propio ───────────────────────────────────
// El servicio de Pago de Factura calcula la distancia desde
// estas coordenadas (la ubicación real del local) hasta el cliente.
// Si el local se mueve, actualizar coords_lat y coords_lng aquí.
const CADETERIA_LOCAL_ID = 'f3796263-b059-4cfa-9f7e-cb79918a7196'; // El Pechito
const CADETERIA_LOCAL_COORDS = { lat: -35.5069891, lng: -69.5826686 }; // El Pechito
