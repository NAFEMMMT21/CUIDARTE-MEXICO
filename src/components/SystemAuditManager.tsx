import React, { useState, useMemo } from "react";
import {
  BookOpen,
  FileCode,
  Code2,
  CheckCircle2,
  Copy,
  Download,
  Search,
  Database,
  ShieldCheck,
  Layers,
  Cpu,
  Workflow,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Activity,
  Terminal,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Stethoscope,
  Pill,
  Receipt,
  Scale,
  Lock,
  Globe,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  Caratula,
  Client,
  ServiceItem,
  Expense,
  AbonoTicket,
  CalendarEvent,
  GuardiaShiftRecord,
  StaffMember,
  SystemUser,
  InventoryItem,
  ExpedienteEntry,
  KardexRecord,
} from "../types";

interface SystemAuditManagerProps {
  caratulas: Caratula[];
  clients: Client[];
  services: ServiceItem[];
  expenses: Expense[];
  abonos: AbonoTicket[];
  calendarEvents: CalendarEvent[];
  guardiaRecords: GuardiaShiftRecord[];
  staffMembers: StaffMember[];
  systemUsers: SystemUser[];
  inventoryItems: InventoryItem[];
  expedienteEntries: ExpedienteEntry[];
  kardexRecords: KardexRecord[];
  isOnline: boolean;
  isQuotaExhausted?: boolean;
}

export const SystemAuditManager: React.FC<SystemAuditManagerProps> = ({
  caratulas,
  clients,
  services,
  expenses,
  abonos,
  calendarEvents,
  guardiaRecords,
  staffMembers,
  systemUsers,
  inventoryItems,
  expedienteEntries,
  kardexRecords,
  isOnline,
  isQuotaExhausted,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    "resumen" | "modulos" | "reglas" | "datos" | "prompt_ai" | "auditoria_viva"
  >("resumen");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSpecs, setCopiedSpecs] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>("caratulas");

  // Live calculated statistics for the audit view
  const stats = useMemo(() => {
    const totalCaratulas = caratulas.length;
    const cotizaciones = caratulas.filter(
      (c) => c.tipoDocumento === "Cotización" || (c.folio || "").startsWith("CPCOT")
    ).length;
    const caratulasActivas = caratulas.filter(
      (c) => c.estado === "Activo" && c.tipoDocumento !== "Cotización" && !(c.folio || "").startsWith("CPCOT")
    ).length;
    const caratulasCanceladas = caratulas.filter((c) => c.estado === "Cancelado").length;

    const totalFacturado = caratulas
      .filter((c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización")
      .reduce((sum, c) => sum + (c.total || 0), 0);

    const totalAbonado = abonos
      .filter((a) => a.estado !== "Cancelado")
      .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

    const saldoPendiente = Math.max(0, totalFacturado - totalAbonado);

    const totalGastos = expenses.reduce((sum, e) => sum + (e.monto || 0), 0);

    return {
      totalCaratulas,
      caratulasActivas,
      cotizaciones,
      caratulasCanceladas,
      totalClientes: clients.length,
      totalPersonal: staffMembers.length,
      totalUsuarios: systemUsers.length,
      totalServicios: services.length,
      totalEventosAgenda: calendarEvents.length,
      totalGuardiasTurnos: guardiaRecords.length,
      totalInsumos: inventoryItems.length,
      totalExpedientes: expedienteEntries.length,
      totalKardex: kardexRecords.length,
      totalAbonosRegistrados: abonos.length,
      totalFacturado,
      totalAbonado,
      saldoPendiente,
      totalGastos,
    };
  }, [
    caratulas,
    clients,
    staffMembers,
    systemUsers,
    services,
    calendarEvents,
    guardiaRecords,
    inventoryItems,
    expedienteEntries,
    kardexRecords,
    abonos,
    expenses,
  ]);

  // Master Prompt for replicating the application with AI or developer
  const masterPromptForAI = useMemo(() => {
    return `# PROMPT MAESTRO DE REPLICACIÓN DE SOFTWARE: SICCUM - CUIDARTE MÉXICO
# (Sistema de Control de Cuidarte México)

Eres un Arquitecto de Software y Desarrollador Full-Stack Senior especializado en aplicaciones clínicas, administrativas y financieras para soluciones de asistencia, gestión y bienestar familiar.

Tu misión es crear, desde cero, una réplica completa, funcional, robusta y con calidad de producción del sistema "SICCUM - Sistema de Control de Cuidarte México".

A continuación tienes la especificación técnica completa (PRD), modelos de datos, reglas de negocio y diseño:

---

## 1. VISIÓN GENERAL Y PROPÓSITO DEL SISTEMA
El sistema es una plataforma integral de Soluciones de asistencia y gestión para el bienestar familiar (domiciliaria y hospitalaria). Resuelve 5 grandes pilares:
1. **Comercial / Administrativo:** Generación y control de Carátulas de Servicio y Cotizaciones oficiales en formato estándar CPSEA (Cuidarte Asistencia, Gestión y Acompañamiento).
2. **Financiero y Cobranza:** Directorio de clientes con reconciliación de saldos por "Bolsa Común de Abonos" (FIFO), emisión de recibos de pago con código QR, control de gastos y cálculo de rentabilidad.
3. **Operativo y Recursos Humanos:** Padrón de Socios/Enfermeros, credencialización digital con código QR de verificación frente/vuelta, agenda interactiva de turnos de 12h y 24h, control de relevos de guardia y dispersión de honorarios a enfermeros.
4. **Clínico y Asistencial:** Expedientes clínicos digitales de pacientes (signos vitales, notas de enfermería, escalas médicas), kárdex digital de administración de medicamentos con firma del enfermero y control de inventario de insumos en el domicilio del paciente.
5. **Multi-Portal con Control de Acceso:** 
   - Panel de Administrador (Super Admin y Admin con acceso total a 14 módulos).
   - Portal del Cliente (Acceso para familiares de pacientes: consulta de carátulas, saldos, notas médicas y credenciales de los enfermeros asignados).
   - Portal de Enfermería / Socios (Acceso para enfermeros: registro de entrada/salida de guardias con geolocalización, llenado de kárdex y notas clínicas).
   - Portal de Ventas y Atención al Cliente (Cotizador rápido y atención de prospectos).

---

## 2. STACK TECNOLÓGICO Y ARQUITECTURA
- **Frontend:** React 19, TypeScript (~5.8), Vite 6, Tailwind CSS v4 (@import "tailwindcss";).
- **Backend / Proxy:** Node.js con Express 4 y TypeScript (tsx). El servidor Express atiende en el puerto 3000 (o process.env.PORT) y monta vite.middlewares en modo desarrollo, mientras sirve la carpeta dist/ en modo producción.
- **Base de Datos & Tiempo Real:**
  - Persistencia principal en la nube: Google Firebase Firestore (Colecciones: caratulas, clients, services, expenses, abonos, calendar_events, guardia_records, staff_members, system_users, inventory_items, expediente_entries, kardex_records, audit_logs).
  - Persistencia secundaria / redundante: LocalStorage en el navegador para cada colección. Si se agota la cuota gratuita diaria de lectura de Firestore (error RESOURCE_EXHAUSTED / 429), la app conmuta automáticamente a modo local sin interrumpir la operación.
- **Seguridad y Autenticación:**
  - Endpoint \`/api/login\` en el servidor Express con rate limiting in-memory (máximo 15 intentos fallidos antes de bloqueo de 2 minutos).
  - Hashing de contraseñas con HMAC-SHA256 usando salt secreto de servidor (AUTH_SALT).
  - Sincronización automática de credenciales con Google Sheets vía CSV para 3 tablas: Administrativos (cols 0-1), Clientes (cols 3-4) y Socios/Enfermeros (cols 6-8).
  - Bypass de Super Administrador con verificación por tiempo constante (\`crypto.timingSafeEqual\`).
  - Tokens de sesión criptográficos generados en el servidor y validados en cliente.
- **Generación de Documentos y PDF:**
  - jsPDF y html2canvas para generación client-side de carátulas CPSEA en PDF y recibos de abono.
  - qrcode.react para generación de códigos QR de validación embebida.

---

## 3. ESQUEMA DE DATOS PRINCIPALES (TYPESCRIPT)

\`\`\`typescript
export interface Caratula {
  folio: string; // Ej: "CP-2026-001" o "CPCOT-2026-001"
  tipoDocumento?: "Carátula" | "Cotización";
  timestamp: string;
  nombreCompletoCliente: string;
  numeroContacto: string;
  numeroContacto2?: string;
  numeroContacto3?: string;
  correo: string;
  direccionServicio: string;
  nombreCompletoRS: string; // Receptor del servicio (paciente)
  edad?: string;
  diagnostico?: string;
  especificaciones?: string;
  servicios: Array<{
    servicio: string;
    cantidad: number;
    precioU: number;
    precioTot: number;
    costoU?: number; // Costo interno pagado a la enfermera
  }>;
  subtotal: number;
  descuento: number;
  total: number;
  pagado: number;
  pendiente: number;
  inicio: string;
  fin: string;
  contratoLink: string;
  tycLink: string;
  estado: "Activo" | "Finalizado" | "Cancelado";
  guardiasProgramadas?: Array<{
    id: string;
    folioGuardia?: string;
    caratulaFolio: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    preset?: string;
    tipoServicio: string;
    personalAsignado: string;
    staffId?: string;
    costoHonorarios?: number;
    honorarioPagado?: boolean;
  }>;
}

export interface Client {
  id: string; // Ej: "CLI-001"
  nombreCompletoCliente: string;
  numeroContacto: string;
  direccionServicio: string;
  nombreCompletoRS?: string; // Paciente
  edad?: string;
  diagnostico?: string;
  especificaciones?: string;
}

export interface AbonoRecord {
  id: string; // Ej: "ABN-1719283749"
  caratulaFolio: string; // Folio de carátula o "GENERAL" si es a la cuenta del cliente
  clientId?: string;
  clientNombre?: string;
  monto: number;
  metodoPago: "Transferencia" | "Efectivo" | "Tarjeta" | "Depósito";
  fechaPago: string;
  concepto?: string;
  cancelado?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  fechaInicio: string; // ISO
  fechaFin: string; // ISO
  clientId?: string;
  caratulaFolio?: string;
  personalAsignado?: string;
  staffId?: string;
  costoHonorarios?: number;
  estado: "Programada" | "En Proceso" | "Completado" | "Cancelado";
  guardiaShiftId?: string;
}
\`\`\`

---

## 4. REGLAS DE NEGOCIO CRÍTICAS

1. **Unicidad y Formato de Folios:**
   - Carátula de Servicio Activo: \`CP-YYYY-XXX\` (Ej. \`CP-2026-001\`).
   - Cotización Comercial: \`CPCOT-YYYY-XXX\` (Ej. \`CPCOT-2026-001\`).
   - Los números se incrementan por año de manera estrictamente ascendente.

2. **Algoritmo de Bolsa Común de Abonos (allocateClientPoolToCaratulas):**
   - Los abonos registrados se pueden asociar a un folio específico o a la cuenta global del cliente.
   - El sistema calcula el total abonado por el cliente y distribuye los abonos entre todas sus carátulas de forma cronológica (FIFO), actualizando dinámicamente los campos \`pagado\` y \`pendiente\` de cada carátula sin generar incongruencias matemáticas.

3. **Sincronización Bidireccional de Guardias (Agenda ↔ Carátula ↔ Honorarios):**
   - Cuando se asigna o edita un turno en la Agenda de Turnos, se actualiza el array \`guardiasProgramadas\` dentro de la carátula vinculada y se recalculan los costos de honorarios.
   - Si una carátula se cancela, todas sus guardias en agenda se marcan como "Cancelado" liberando a los enfermeros.

4. **Integridad de Eliminación y Mecanismo Anti-Resurrección (Tombstoning):**
   - Al eliminar una carátula, se deben eliminar o desvincular sus turnos en la agenda y sus recibos de abono.
   - El folio eliminado se registra en una lista de bajas permanentes (\`deletedFolios\` / \`tombstones\`) para evitar que funciones de integridad que reconstruyen referencias huérfanas vuelvan a resucitar carátulas borradas al recargar el navegador.

5. **Tolerancia a Fallos en Firestore:**
   - Al recibir errores con código \`resource-exhausted\` de Firebase Firestore, la aplicación conmuta silenciosamente a almacenamiento en LocalStorage, emite un evento personalizado \`firestore-quota-exhausted\` y muestra un banner amigable explicando que los datos se guardan con total seguridad de forma local.

---

## 5. INSTRUCCIONES PARA EL DESARROLLADOR O AGENTE DE IA
- Implementar primero los tipos TypeScript en \`src/types.ts\`.
- Configurar el backend en \`server.ts\` con soporte para sincronización de credenciales y rate limiting en el login.
- Crear los módulos de almacenamiento local en \`src/utils/storage.ts\` y sincronización Firestore en \`src/services/firestoreSync.ts\`.
- Diseñar la interfaz con Tailwind CSS garantizando diseño responsivo (móvil, tablet y escritorio), barra superior con buscador global de paciente, reloj en vivo y monitor de sincronización.
`;
  }, []);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(masterPromptForAI);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([masterPromptForAI], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ESPECIFICACION_SISTEMA_CUIDARTE_PACHUCA_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedSpecs(true);
    setTimeout(() => setCopiedSpecs(false), 3000);
  };

  // Modules list for the modules tab
  const modulesList = [
    {
      id: "caratulas",
      title: "1. Generador de Carátulas y Cotizaciones (CPSEA)",
      tag: "Comercial / Operativo",
      color: "sky",
      description:
        "Núcleo de contratación de servicios. Genera el documento oficial contractual de Cuidarte Pachuca con cálculo automático de turnos, precios unitarios, costos de personal y formatos oficiales.",
      features: [
        "Formato oficial CPSEA idéntico a especificación impresa.",
        "Selector de clientes con autocompletado y carga instantánea de receptores de servicio.",
        "Generador de turnos y guardias con plantillas rápidas (12h día, 12h noche, 24h, procedimientos).",
        "Diferenciación automática entre Carátula en Firme (CP-YYYY-XXX) y Cotización previa (CPCOT-YYYY-XXX).",
        "Cálculo matemático de Subtotal, Descuentos, IVA (16%), Retenciones y Total.",
        "Exportación a PDF de alta resolución con códigos QR de autenticidad verificable.",
      ],
    },
    {
      id: "historial",
      title: "2. Consulta y Gestión de Carátulas",
      tag: "Auditoría / Control",
      color: "emerald",
      description:
        "Bandeja central de control de todos los servicios contratados y cotizaciones emitidas a lo largo del tiempo.",
      features: [
        "Búsqueda por folio, nombre de cliente, paciente (RS), teléfono o estatus.",
        "Filtros rápidos por año, estado (Activo, Finalizado, Cancelado) o tipo de documento.",
        "Edición completa de carátulas activas con propagación de cambios a agenda y saldos.",
        "Duplicación en 1 click para renovación automática de servicios periódicos/quincenales.",
        "Cancelación con liberación inmediata de turnos del personal en la agenda.",
        "Eliminación definitiva con registro de bajas (Tombstoning) que previene resurrecciones.",
      ],
    },
    {
      id: "servicios",
      title: "3. Catálogo de Servicios y Tarifas",
      tag: "Precios y Costos",
      color: "amber",
      description:
        "Tarifario maestro de servicios ofrecidos, precios al público y costo unitario pactado con enfermeros.",
      features: [
        "Organización por categorías clínicas: Enfermería General, Cuidados Paliativos, Cuidadoras, Especializada, etc.",
        "Precio unitario de venta al cliente y costo unitario asignado al socio/enfermero.",
        "Cálculo de margen bruto proyectado por servicio.",
        "Importación y exportación masiva en lote para actualización rápida de tarifas.",
      ],
    },
    {
      id: "clientes",
      title: "4. Directorio de Clientes y Pacientes",
      tag: "CRM Clínico",
      color: "indigo",
      description:
        "Expediente administrativo de los contratantes y los receptores de servicio (pacientes a cuidar).",
      features: [
        "Asignación de identificador único correlativo (CLI-001, CLI-002, etc.).",
        "Manejo diferenciado de Contratante / Responsable Legal y Receptor del Servicio (Paciente).",
        "Múltiples teléfonos de contacto de emergencia, correo electrónico y dirección física detallada.",
        "Historial clínico resumido: edad, diagnóstico médico, especificaciones de cuidado y requerimientos especiales.",
        "Bóveda documental: subida y consulta de identificaciones, contratos y recetas en PDF/imágenes.",
      ],
    },
    {
      id: "saldos",
      title: "5. Saldos, Abonos y Recibos Oficiales",
      tag: "Finanzas / Cobranza",
      color: "emerald",
      description:
        "Módulo de conciliación financiera de cuentas por cobrar con emisión de recibos digitales.",
      features: [
        "Matriz de saldos por cliente: Facturado total, Abonado y Saldo restante pendiente de pago.",
        "Registro de abonos parciales o liquidaciones totales mediante múltiples métodos (Transferencia, Efectivo, Tarjeta, etc.).",
        "Motor de 'Bolsa Común de Abonos' que prorratea pagos no asignados cronológicamente.",
        "Generador de Recibos Oficiales de Abono en PDF con código QR y desglose de saldo.",
        "Cancelación y reactivación de recibos con auditoría de usuario y fecha.",
      ],
    },
    {
      id: "personal",
      title: "6. Padrón de Socios y Credenciales Digitales",
      tag: "Recursos Humanos",
      color: "sky",
      description:
        "Administración del equipo de enfermería y generación de identificaciones oficiales para servicio en domicilio.",
      features: [
        "Registro de enfermeros con identificador de socio (SOCP-001, SOCP-002, etc.).",
        "Generación interactiva de credenciales oficiales digitales (frente y vuelta) con foto y cédula profesional.",
        "Código QR en credencial que dirige a la validación pública de identidad laboral.",
        "Historial de turnos cubiertos por el enfermero y evaluación de desempeño.",
        "Control de datos bancarios (banco, CLABE, cuenta) para dispersión transparente de honorarios.",
      ],
    },
    {
      id: "usuarios",
      title: "7. Control de Acceso y Sesiones Activas en Vivo",
      tag: "Seguridad / Auditoría",
      color: "amber",
      description:
        "Monitor en tiempo real de usuarios conectados y control estricto de credenciales y roles.",
      features: [
        "Monitoreo en vivo de sesiones activas con geolocalización por IP o GPS (ciudad, estado, mapa).",
        "Detección de dispositivo y navegador de conexión.",
        "Botón de 'Revocación Forzada de Sesión' para cerrar accesos no autorizados inmediatamente.",
        "Gestión de roles: Administrador, Cliente, Enfermero/Socio, Ventas, Atención a Clientes.",
      ],
    },
    {
      id: "agenda",
      title: "8. Agenda y Calendario de Turnos",
      tag: "Operación de Campo",
      color: "sky",
      description:
        "Control visual e interactivo de asignación de turnos, guardias diurnas, nocturnas y relevos.",
      features: [
        "Vistas por Mes, Semana y Día con filtros por cliente o por enfermero.",
        "Sincronización en tiempo real con las guardias de las carátulas activas.",
        "Marcación de entrada (Check-in) y salida (Check-out) con captura de coordenadas GPS.",
        "Registro de novedades y observaciones clínicas en la entrega de turno.",
      ],
    },
    {
      id: "expedientes",
      title: "9. Expedientes Clínicos Digitales",
      tag: "Atención Médica",
      color: "emerald",
      description:
        "Bitácora y expediente de enfermería digital por cada paciente atendido por la agencia.",
      features: [
        "Registro de signos vitales (Presión arterial, FC, FR, Temperatura, SaO2, Glucemia capilar).",
        "Escalas de valoración geriátrica y médica (Escala de Norton para úlceras, EVA de dolor, Glasgow).",
        "Control de ingresos y egresos (Balance hídrico).",
        "Notas de evolución y procedimientos realizados por la enfermera en turno.",
      ],
    },
    {
      id: "inventario",
      title: "10. Insumos y Kárdex de Medicamentos",
      tag: "Farmacia y Stock",
      color: "emerald",
      description:
        "Control de medicamentos prescritos al paciente y stock de insumos médicos en su domicilio.",
      features: [
        "Kárdex de medicamentos con horarios de administración y dosis indicada.",
        "Registro en tiempo real de aplicación de medicamento con firma del enfermero responsable.",
        "Registro de motivos en caso de no aplicación (ej. paciente dormido, rechazo, desabasto).",
        "Control de stock de insumos (jeringas, gasas, soluciones, pañales) con alertas de reabastecimiento.",
      ],
    },
    {
      id: "financiero",
      title: "11. Ingresos y Dashboard Financiero",
      tag: "Dirección General",
      color: "violet",
      description:
        "Panel ejecutivo con indicadores clave de rendimiento (KPIs), ventas, cobranza y rentabilidad.",
      features: [
        "Métricas consolidadas de facturación bruta, cobrado real y cuentas por cobrar.",
        "Utilidad bruta calculada deduciendo el costo interno de enfermería.",
        "Gráficas y desgloses por mes y por cliente con exportación de reportes.",
      ],
    },
    {
      id: "gastos",
      title: "12. Control de Gastos Operativos",
      tag: "Finanzas",
      color: "rose",
      description:
        "Bitácora de egresos generales clasificados por tipo de gasto y centro de costos.",
      features: [
        "Categorías de gasto: Nóminas, Insumos médicos, Traslados, Servicios de oficina, Software, etc.",
        "Adjunto de comprobantes de pago o facturas.",
        "Cálculo de la utilidad neta real de la empresa al contrastar ingresos vs gastos.",
      ],
    },
    {
      id: "honorarios",
      title: "13. Honorarios y Dispersión de Nómina",
      tag: "Finanzas / RH",
      color: "rose",
      description:
        "Panel para auditar turnos cumplidos por cada enfermero y liquidar sus pagos puntualmente.",
      features: [
        "Cálculo automático de honorarios devengados por cada enfermero según los turnos realizados.",
        "Liquidación en lote o individual con registro automático en el módulo de Gastos.",
        "Historial de pagos con fecha, monto, folio de carátula y comprobante.",
      ],
    },
    {
      id: "respaldo",
      title: "14. Respaldo, Auditoría y Restauración",
      tag: "Seguridad y Datos",
      color: "emerald",
      description:
        "Garantía de integridad de datos, copias de seguridad descargables y bitácora completa de eventos.",
      features: [
        "Descarga de respaldo integral en formato JSON con 1 click de todas las 12 colecciones.",
        "Restauración selectiva o completa a partir de archivos JSON previos.",
        "Bitácora de auditoría detallada (AuditLog) que registra cada alta, baja, modificación y descarga.",
        "Función de reinicio seguro de base de datos con doble confirmación.",
      ],
    },
    {
      id: "portales",
      title: "15. Portales Externos Especializados (Clientes, Enfermeros y Ventas)",
      tag: "Multi-Rol",
      color: "sky",
      description:
        "Accesos adaptados y restringidos para los diferentes perfiles que interactúan con la agencia.",
      features: [
        "Portal del Cliente: Consulta segura de carátulas activas, saldos pendientes, expediente clínico y credenciales de enfermeros asignados a su ser querido.",
        "Portal de Enfermería / Socios: Vista optimizada para móvil donde el enfermero registra entrada/salida de guardia, llena kárdex y notas médicas a pie de cama.",
        "Portal de Ventas y Atención: Cotizador ágil, seguimiento de solicitudes de incremento de servicio y canalización de prospectos.",
      ],
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-sky-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                Auditoría Técnica & Arquitectura
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-medium">
                Listo para Replicar con AI o Programador
              </span>
              {isQuotaExhausted && (
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-medium">
                  Caché Local Activo
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-sky-400" />
              Documentación del Sistema & Guía de Replicación
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Expediente técnico completo de <strong>Cuidarte Pachuca - SICSF</strong>.
              Describe la arquitectura tecnológica, todos los módulos operativos, reglas de negocio, esquemas de datos y el <strong>Prompt Maestro</strong> para clonar o reconstruir esta aplicación con cualquier modelo de Inteligencia Artificial o equipo de desarrollo.
            </p>
          </div>

          {/* Action Buttons: Copy Prompt & Download Markdown */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={handleCopyPrompt}
              className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                copiedPrompt
                  ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                  : "bg-sky-600 hover:bg-sky-500 text-white hover:shadow-sky-500/25"
              }`}
              title="Copia el prompt estructurado listo para pegar en Claude, GPT-4, Gemini o entregar a un programador"
            >
              {copiedPrompt ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>¡Prompt Copiado con Éxito!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Prompt Maestro (AI)</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                copiedSpecs
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
              title="Descargar toda la especificación técnica en formato Markdown (.md)"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>Descargar .MD</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveSubTab("resumen")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === "resumen"
                ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>1. Arquitectura & Stack</span>
          </button>

          <button
            onClick={() => setActiveSubTab("modulos")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === "modulos"
                ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Módulos & Apartados ({modulesList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("reglas")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === "reglas"
                ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>3. Reglas de Negocio & Algoritmos</span>
          </button>

          <button
            onClick={() => setActiveSubTab("datos")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === "datos"
                ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>4. Modelos de Datos (BD)</span>
          </button>

          <button
            onClick={() => setActiveSubTab("prompt_ai")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === "prompt_ai"
                ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>5. Prompt Maestro (AI / Dev)</span>
          </button>

          <button
            onClick={() => setActiveSubTab("auditoria_viva")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === "auditoria_viva"
                ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>6. Auditoría de Estado en Vivo</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: RESUMEN Y ARQUITECTURA */}
      {activeSubTab === "resumen" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Propósito del Sistema</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Sistema de gestión integral de <strong>Soluciones de asistencia y gestión para el bienestar familiar</strong> de <strong>Cuidarte México</strong>. Conecta en tiempo real la captación del receptor de servicio, presupuestación (CPSEA), agenda de turnos, expediente de atención, pagos de clientes y honorarios de personal.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Versión: <strong>2.4 Oficial</strong></span>
                <span className="text-emerald-600 font-bold">Producción</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Stack Tecnológico</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Frontend en <strong>React 19 + TypeScript + Vite 6 + Tailwind CSS v4</strong>. Backend proxy en <strong>Node.js / Express</strong> para autenticación criptográfica segura, limitador de tasa contra ataques de fuerza bruta y sincronización en tiempo real con Google Sheets.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Arquitectura: <strong>Full-Stack SPA</strong></span>
                <span className="text-indigo-600 font-bold">Node 22 / React 19</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Persistencia Híbrida</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Base de datos en la nube con <strong>Google Firebase Firestore</strong> con listener en tiempo real. Cuenta con un mecanismo transparente de <strong>fallback a LocalStorage</strong> para operar al 100% incluso sin internet o si se agota la cuota gratuita de lectura de Firestore.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Redundancia: <strong>Cloud + Local</strong></span>
                <span className="text-emerald-600 font-bold">Zero-Downtime</span>
              </div>
            </div>
          </div>

          {/* Architecture diagram cards */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-600" />
              Capas y Flujo de Datos de la Aplicación
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
                  Capa 1: Cliente
                </span>
                <h4 className="font-bold text-sm text-slate-800">SPA React + Tailwind</h4>
                <p className="text-xs text-slate-600">
                  Interfaz reactiva con navegación por pestañas y portales dedicados. Renderizado dinámico de PDF oficial mediante jsPDF y visualización de credenciales.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Capa 2: Servidor Proxy
                </span>
                <h4 className="font-bold text-sm text-slate-800">Express + Rate Limiter</h4>
                <p className="text-xs text-slate-600">
                  Valida inicios de sesión en \`/api/login\` con hashing HMAC-SHA256, limita intentos fallidos (15 máx) y consulta personal activo en \`/api/socios\`.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Capa 3: Nube & Base de Datos
                </span>
                <h4 className="font-bold text-sm text-slate-800">Firebase Firestore</h4>
                <p className="text-xs text-slate-600">
                  Almacena en tiempo real 12 colecciones estructuradas. Mantiene sincronización entre todos los dispositivos del equipo sin recargar la página.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  Capa 4: Google Sheets Sync
                </span>
                <h4 className="font-bold text-sm text-slate-800">Hojas de Cálculo</h4>
                <p className="text-xs text-slate-600">
                  Sincroniza en background el listado de colaboradores activos, administradores y contraseñas maestras desde la hoja central en la nube.
                </p>
              </div>
            </div>
          </div>

          {/* Security & Authentication specifics */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Mecanismos de Seguridad Implementados
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-700">
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
                <strong className="text-amber-950 font-bold block">Protección Brute-Force</strong>
                <span>El servidor bloquea la IP/usuario por 2 minutos tras 15 intentos fallidos consecutivos en el login.</span>
              </div>
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
                <strong className="text-amber-950 font-bold block">Criptografía HMAC-SHA256</strong>
                <span>Las contraseñas no viajan ni se almacenan en texto plano; se cotejan mediante hashes criptográficos con salt secreto.</span>
              </div>
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
                <strong className="text-amber-950 font-bold block">Revocación Remota de Sesión</strong>
                <span>El Administrador puede invalidar de inmediato la sesión activa de cualquier usuario o enfermero en tiempo real.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: MODULOS Y APARTADOS */}
      {activeSubTab === "modulos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Catálogo Detallado de Módulos del Sistema
              </h2>
              <p className="text-xs text-slate-500">
                Haz clic en cualquier módulo para ver sus funciones, campos y reglas asociadas.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar módulo o función..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {modulesList
              .filter(
                (m) =>
                  !searchTerm ||
                  m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.features.some((f) => f.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((mod) => {
                const isExpanded = expandedModule === mod.id;
                return (
                  <div
                    key={mod.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all"
                  >
                    <button
                      onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                      className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-sky-50 text-sky-600 font-bold text-xs">
                          {mod.id.toUpperCase().slice(0, 3)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900">{mod.title}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {mod.tag}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {mod.description}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-3 bg-slate-50/30">
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {mod.description}
                        </p>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                            Funcionalidades y Capacidades Específicas:
                          </h4>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {mod.features.map((feat, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/70"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: REGLAS DE NEGOCIO Y ALGORITMOS */}
      {activeSubTab === "reglas" && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Workflow className="w-5 h-5 text-indigo-600" />
              Reglas de Negocio Críticas y Algoritmos Centrales
            </h3>
            <p className="text-xs text-slate-600">
              Estas reglas constituyen el núcleo lógico que cualquier desarrollador o IA debe replicar con exactitud matemática.
            </p>

            <div className="space-y-4 pt-2">
              {/* Regla 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Formato y Concurrencia de Folios
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Los folios identifican unívocamente contratos y cotizaciones:
                  <br />• <strong>Carátulas Activas:</strong> \`CP-YYYY-XXX\` (ej. \`CP-2026-001\`).
                  <br />• <strong>Cotizaciones Previas:</strong> \`CPCOT-YYYY-XXX\` (ej. \`CPCOT-2026-001\`).
                  <br />El sistema analiza todos los folios existentes para extraer el número secuencial más alto y asignar \`+1\` al nuevo registro, evitando colisiones incluso tras reinicios o filtros.
                </p>
              </div>

              {/* Regla 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Algoritmo de Bolsa Común de Abonos (allocateClientPoolToCaratulas)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Cuando un cliente realiza un pago, puede abonar a una carátula específica o a su cuenta general. Para mantener integridad financiera, el algoritmo calcula el total abonado por el cliente y distribuye los fondos cronológicamente (FIFO) entre todas sus carátulas activas:
                  <br />1. Cubre primero las carátulas más antiguas hasta completar su total.
                  <br />2. El excedente pasa automáticamente a la carátula siguiente.
                  <br />3. Si el saldo restante es 0, la carátula se marca como "Pagada".
                </p>
              </div>

              {/* Regla 3 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Sincronización Bidireccional de Guardias (Agenda ↔ Carátula ↔ Honorarios)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  No existen registros aislados:
                  <br />• Cada turno programado en la Agenda tiene un \`caratulaFolio\` y se refleja en el arreglo \`guardiasProgramadas\` de la carátula.
                  <br />• Cuando un enfermero inicia turno en el Portal de Enfermería, el evento de la agenda pasa a "En Proceso" y se guardan sus coordenadas GPS.
                  <br />• Al terminar la guardia, se calcula el honorario correspondiente para pago en el módulo de Honorarios.
                </p>
              </div>

              {/* Regla 4 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center">
                    4
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Mecanismo Anti-Resurrección de Bajas (Tombstoning)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Para evitar que carátulas eliminadas vuelvan a aparecer al recargar la página (por existir referencias en eventos de agenda o recibos antiguos), el sistema almacena el folio en una lista persistente de bajas (\`deletedCaratulaFolios\`). Al reconstruir el estado, cualquier documento con dicho folio es permanentemente descartado.
                </p>
              </div>

              {/* Regla 5 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center">
                    5
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Tolerancia a Cuotas de Firestore y Caché Local Redundante
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  Si la base de datos Firestore devuelve un error \`resource-exhausted\` (límite diario de 50,000 lecturas gratuitas alcanzado), la aplicación conmuta inmediatamente a almacenamiento local sin interrumpir la operación del personal ni mostrar pantallas de error bloqueantes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: MODELOS DE DATOS */}
      {activeSubTab === "datos" && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-600" />
                  Estructura de Base de Datos y Colecciones Firestore
                </h3>
                <p className="text-xs text-slate-500">
                  Definición formal de los 12 tipos de documentos principales que componen el estado global del sistema.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                <div className="text-sky-400 font-bold mb-2">// Colección: caratulas</div>
                <div>interface Caratula &#123;</div>
                <div className="pl-4">folio: string; // "CP-2026-001"</div>
                <div className="pl-4">tipoDocumento?: "Carátula" | "Cotización";</div>
                <div className="pl-4">nombreCompletoCliente: string;</div>
                <div className="pl-4">nombreCompletoRS: string; // Paciente</div>
                <div className="pl-4">servicios: Array&lt;ServiceRow&gt;;</div>
                <div className="pl-4">total: number;</div>
                <div className="pl-4">pagado: number;</div>
                <div className="pl-4">pendiente: number;</div>
                <div className="pl-4">guardiasProgramadas?: GuardiaItem[];</div>
                <div className="pl-4">estado: "Activo" | "Finalizado" | "Cancelado";</div>
                <div>&#125;</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                <div className="text-emerald-400 font-bold mb-2">// Colección: clients</div>
                <div>interface Client &#123;</div>
                <div className="pl-4">id: string; // "CLI-001"</div>
                <div className="pl-4">nombreCompletoCliente: string;</div>
                <div className="pl-4">nombreCompletoRS?: string;</div>
                <div className="pl-4">numeroContacto: string;</div>
                <div className="pl-4">direccionServicio: string;</div>
                <div className="pl-4">diagnostico?: string;</div>
                <div className="pl-4">documentos?: ClientDocument[];</div>
                <div>&#125;</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                <div className="text-amber-400 font-bold mb-2">// Colección: abonos</div>
                <div>interface AbonoRecord &#123;</div>
                <div className="pl-4">id: string; // "ABN-1719283749"</div>
                <div className="pl-4">caratulaFolio: string;</div>
                <div className="pl-4">clientId?: string;</div>
                <div className="pl-4">monto: number;</div>
                <div className="pl-4">metodoPago: string;</div>
                <div className="pl-4">fechaPago: string;</div>
                <div className="pl-4">cancelado?: boolean;</div>
                <div>&#125;</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                <div className="text-indigo-400 font-bold mb-2">// Colección: calendar_events</div>
                <div>interface CalendarEvent &#123;</div>
                <div className="pl-4">id: string;</div>
                <div className="pl-4">title: string;</div>
                <div className="pl-4">fechaInicio: string; // ISO</div>
                <div className="pl-4">fechaFin: string; // ISO</div>
                <div className="pl-4">clientId?: string;</div>
                <div className="pl-4">staffId?: string;</div>
                <div className="pl-4">costoHonorarios?: number;</div>
                <div className="pl-4">estado: "Programada" | "En Proceso" | "Completado";</div>
                <div>&#125;</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: PROMPT MAESTRO PARA IA O PROGRAMADOR */}
      {activeSubTab === "prompt_ai" && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-sky-600" />
                  Prompt Maestro para Replicación (Copy & Paste)
                </h3>
                <p className="text-xs text-slate-500">
                  Copia y pega este texto directamente en Claude, ChatGPT, Gemini, Cursor o entrégalo a una agencia de software para clonar la plataforma exactamente.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPrompt}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    copiedPrompt
                      ? "bg-emerald-600 text-white"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  }`}
                >
                  {copiedPrompt ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Texto Completo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed border border-slate-800 selection:bg-sky-600">
                {masterPromptForAI}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: AUDITORIA DE ESTADO EN VIVO */}
      {activeSubTab === "auditoria_viva" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Métricas de Datos Registrados en Tiempo Real
                </h3>
                <p className="text-xs text-slate-500">
                  Conteo en vivo de los registros almacenados en el sistema en esta sesión.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    isOnline
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {isOnline ? "Conectado a Firebase" : "Modo Local Offline"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Carátulas Totales
                </span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                  {stats.totalCaratulas}
                </span>
                <span className="text-[11px] text-slate-500">
                  {stats.caratulasActivas} activas · {stats.cotizaciones} cotizaciones
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Directorio Clientes
                </span>
                <span className="text-xl font-extrabold text-indigo-700 mt-1 block">
                  {stats.totalClientes}
                </span>
                <span className="text-[11px] text-slate-500">Pacientes registrados</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Personal / Socios
                </span>
                <span className="text-xl font-extrabold text-sky-700 mt-1 block">
                  {stats.totalPersonal}
                </span>
                <span className="text-[11px] text-slate-500">Enfermeros con credencial</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Turnos en Agenda
                </span>
                <span className="text-xl font-extrabold text-amber-700 mt-1 block">
                  {stats.totalEventosAgenda}
                </span>
                <span className="text-[11px] text-slate-500">Guardias calendarizadas</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Facturación Total
                </span>
                <span className="text-xl font-extrabold text-emerald-700 mt-1 block">
                  ${stats.totalFacturado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500">Monto total carátulas</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Cobrado
                </span>
                <span className="text-xl font-extrabold text-emerald-800 mt-1 block">
                  ${stats.totalAbonado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500">{stats.totalAbonosRegistrados} abonos válidos</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Saldo por Cobrar
                </span>
                <span className="text-xl font-extrabold text-rose-700 mt-1 block">
                  ${stats.saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500">Cuentas pendientes</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Insumos & Kárdex
                </span>
                <span className="text-xl font-extrabold text-violet-700 mt-1 block">
                  {stats.totalInsumos} / {stats.totalKardex}
                </span>
                <span className="text-[11px] text-slate-500">Stock / Medicamentos</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
