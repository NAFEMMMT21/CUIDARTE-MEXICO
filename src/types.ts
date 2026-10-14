export type UserRole = "admin" | "client" | "nurse" | "ventas" | "atencion_clientes";

export interface Sucursal {
  id: string; // e.g. "pachuca", "cdmx", "monterrey"
  nombre: string; // e.g. "Cuidarte Pachuca"
  codigo: string; // e.g. "PAC", "CDMX", "MTY"
  ciudad: string; // e.g. "Pachuca de Soto"
  estado: string; // e.g. "Hidalgo"
  direccion?: string;
  telefono?: string;
  email?: string;
  administradorUx: string; // Username of the branch administrator (e.g. "admin_pachuca")
  administradorNombre: string; // Full name of the branch administrator
  administradorEmail?: string;
  administradorTelefono?: string;
  activa: boolean;
  fechaCreacion: string;
  notas?: string;
  colorBadge?: string; // e.g. "sky", "emerald", "indigo", "amber", "purple"
  logoUrl?: string; // Optional custom logo image URL or base64 for this branch
}

export interface UserSession {
  username: string;
  nombre?: string; // Full name (from Socios / Personal Activo or Admin table)
  loggedInAt: string;
  role: UserRole;
  clientId?: string; // e.g. "CLI-001"
  nurseId?: string; // e.g. "SOCP-001"
  isSuperAdmin?: boolean;
  isGeneralAdmin?: boolean; // True for general administrators of Cuidarte México (access to all branches)
  sucursalId?: string; // Branch assigned if branch administrator, or undefined if general admin
  sucursalNombre?: string; // Display name of assigned branch
}

export type AuditActionType =
  | "CREAR_CARATULA"
  | "MODIFICAR_CARATULA"
  | "CANCELAR_CARATULA"
  | "DUPLICAR_CARATULA"
  | "ELIMINAR_CARATULA"
  | "EXPORTAR_PDF_CARATULA"
  | "CREAR_COTIZACION"
  | "MODIFICAR_COTIZACION"
  | "CONVERTIR_COTIZACION"
  | "CANCELAR_COTIZACION"
  | "REGISTRAR_ABONO"
  | "CANCELAR_ABONO"
  | "CREAR_CLIENTE"
  | "MODIFICAR_CLIENTE"
  | "ELIMINAR_CLIENTE"
  | "SUBIR_DOCUMENTO_CLIENTE"
  | "ELIMINAR_DOCUMENTO_CLIENTE"
  | "VER_DOCUMENTO_CLIENTE"
  | "CREAR_PERSONAL"
  | "MODIFICAR_PERSONAL"
  | "ELIMINAR_PERSONAL"
  | "SUBIR_DOCUMENTO_PERSONAL"
  | "ELIMINAR_DOCUMENTO_PERSONAL"
  | "ACTUALIZAR_DATOS_BANCARIOS"
  | "REGISTRAR_GASTO"
  | "MODIFICAR_GASTO"
  | "CANCELAR_GASTO"
  | "LIQUIDAR_HONORARIOS"
  | "PAGO_HONORARIOS_PERSONAL"
  | "AGENDAR_TURNO"
  | "MODIFICAR_TURNO"
  | "ELIMINAR_TURNO"
  | "INICIO_TURNO_ENFERMERIA"
  | "FIN_TURNO_ENFERMERIA"
  | "RELEVO_GUARDIA"
  | "REGISTRAR_EXPEDIENTE"
  | "MODIFICAR_EXPEDIENTE"
  | "CANCELAR_EXPEDIENTE"
  | "ACTUALIZAR_KARDEX"
  | "ADMINISTRAR_MEDICAMENTO"
  | "REGISTRAR_NO_APLICACION_MED"
  | "ELIMINAR_MEDICAMENTO_KARDEX"
  | "MOVIMIENTO_INVENTARIO"
  | "CREAR_ITEM_INVENTARIO"
  | "MODIFICAR_ITEM_INVENTARIO"
  | "ELIMINAR_ITEM_INVENTARIO"
  | "CREAR_USUARIO"
  | "MODIFICAR_USUARIO"
  | "ELIMINAR_USUARIO"
  | "CAMBIAR_PASSWORD"
  | "REVOCAR_SESION"
  | "CORTE_DE_CAJA"
  | "RESPALDO_DATABASE"
  | "RESTAURAR_DATABASE"
  | "RESET_DATABASE"
  | "CREAR_INCIDENCIA"
  | "RESOLVER_INCIDENCIA"
  | "SOLICITUD_INCREMENTO_SERVICIO"
  | "IMPORTACION_MASIVA"
  | "EXPORTAR_REPORTE"
  | "CONSULTA_CLIENTE"
  | "CONSULTA_CARATULA"
  | "CONSULTA_RECEPTOR"
  | "CONSULTA_AGENDA"
  | "CONSULTA_KARDEX"
  | "CONSULTA_EXPEDIENTE"
  | "ACCESO_DENEGADO"
  | "LOGIN_EXITOSO"
  | "INGRESO_PORTAL"
  | "LOGIN_FALLIDO"
  | "LOGOUT"
  | "CREAR_SUCURSAL"
  | "MODIFICAR_SUCURSAL"
  | "ELIMINAR_SUCURSAL"
  | "ASIGNAR_ADMIN_SUCURSAL"
  | "CAMBIAR_SUCURSAL_ACTIVA"
  | "OTRA_ACCION";

export interface AuditLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  city?: string;
  state?: string;
  country?: string;
  ip?: string;
  mapsUrl?: string;
  source?: "gps" | "ip" | "browser" | "manual";
  rawAddress?: string;
  timestamp?: string;
}

export interface AuditDeviceInfo {
  userAgent?: string;
  platform?: string;
  isMobile?: boolean;
  language?: string;
  screenResolution?: string;
}

export interface AuditLog {
  id: string; // e.g. "AUDIT-20260817-1001"
  tipoAccion: AuditActionType;
  descripcion: string;
  usuarioUx: string;
  usuarioNombre: string;
  rol: UserRole;
  fechaHoraIso: string;
  fechaHoraFormateada: string;
  detalles?: Record<string, any>;
  folioReferencia?: string;
  clienteIdReferencia?: string;
  ubicacion?: AuditLocation;
  dispositivo?: AuditDeviceInfo;
  sucursalId?: string;
  sucursalNombre?: string;
  timestamp: string;
}

export interface CalendarEvent {
  id: string; // e.g. "GACP26A2108" or "EVT-001"
  folioGuardia?: string; // Control folio único de guardia agendada: "GACP26A2108"
  clientId: string; // e.g. "CLI-001"
  clientNombre?: string;
  caratulaFolio?: string; // e.g. "CPSEA000"
  titulo: string; // e.g. "Guardia Nocturna 12 hrs"
  fechaInicio: string; // "YYYY-MM-DDTHH:mm"
  fechaFin: string; // "YYYY-MM-DDTHH:mm"
  personalAsignado?: string; // e.g. "LIC. JUAN CARLOS PÉREZ LÓPEZ"
  staffId?: string; // e.g. "SOC-25001"
  staffNoSocio?: string; // e.g. "25001"
  staffFoto?: string;
  tipoServicio?: string; // e.g. "Enfermería General", "Cuidado Holístico"
  costoHonorarios?: number; // Costo / Honorarios configurables de forma individual para esta guardia
  honorarioPagado?: boolean; // Formally paid
  pagoHonorarioId?: string; // ID del egreso de pago asociado
  fechaPagoHonorario?: string; // Fecha en que se liquidó
  montoPagadoHonorario?: number; // Monto efectivamente liquidado
  estado?: 'Programado' | 'En Proceso' | 'Completado' | 'Cancelado';
  guardiaShiftId?: string; // Linked GuardiaShiftRecord ID
  turnoAbierto?: boolean; // True when nurse clocked in / shift active
  turnoFinalizado?: boolean; // True when nurse clocked out / shift closed
  horaApertura?: string; // e.g. "12/08/2026 08:00 AM" or ISO
  horaCierre?: string; // e.g. "12/08/2026 08:00 PM" or ISO
  duracionMinutos?: number;
  ubicacionEntrada?: string;
  novedadesEntrega?: string;
  notasInicio?: string;
  notasFin?: string;
  notas?: string;
  registradoPor?: string;
  timestamp?: string;
  sucursalId?: string;
  sucursalNombre?: string;
}

export type ExpedienteType =
  | 'novedad'
  | 'signos'
  | 'balance_liquidos'
  | 'curacion_heridas'
  | 'alimentacion_dieta'
  | 'cuidados_generales'
  | 'reporte';

export interface VitalsData {
  presionArterial?: string; // e.g. "120/80"
  frecuenciaCardiaca?: number; // bpm e.g. 75
  temperatura?: number; // °C e.g. 36.6
  saturacionOxigeno?: number; // % e.g. 98
  glucosa?: number; // mg/dL e.g. 100
  frecuenciaRespiratoria?: number; // rpm e.g. 18
  dolorEscalaEva?: number; // 0 - 10 (Escala Visual Análoga de Dolor)
  pesoKg?: number; // kg
  tallaCm?: number; // cm
  llenadoCapilar?: string; // e.g. "< 2 seg"
  escalaGlasgow?: number; // 3 - 15
}

export interface LiquidBalanceData {
  // Entradas / Ingresos (ml)
  entradasOralMl?: number; // Vía Oral (Agua, caldos, jugos, gelatinas)
  entradasIVMl?: number; // Soluciones Intravenosas / Parenteral (Hartmann, Fisiológica, Glucosada, etc.)
  entradasSondaMl?: number; // Sonda Enteral / Gastrostomía / Bolos de agua
  entradasMedicamentosMl?: number; // Medicamentos en infusión / Dilución
  entradasOtrasMl?: number; // Transfusiones / Otros
  entradasDetalle?: string; // Notas de soluciones (ej. Sol. Fisiológica 0.9% 500ml a 21 gtt/min)
  
  // Salidas / Egresos (ml)
  salidasOrinaMl?: number; // Diuresis / Orina
  salidasOrinaAspecto?: string; // Clara, Ámbar, Colúrica, Turbia, Hematúrica, Sedimento, Con Sonda Foley
  huboEvacuacion?: boolean; // Checkbox para registrar evacuación en turno/periodo
  salidasEvacuacionesRealizada?: boolean; // Indicador de evacuación realizada
  numeroEvacuaciones?: number; // Conteo / Número de evacuaciones (ej. 1, 2, 3...)
  salidasEvacuacionesAspecto?: string; // Consistencia / Escala Bristol 1-7, Formada, Blanda, Líquida, Dura, Melena
  salidasEvacuacionesMl?: number; // Opcional legacy (no se mide en gr/ml, se mide en conteo)
  salidasVomitoMl?: number; // Emesis / Vómito
  salidasVomitoAspecto?: string; // Alimenticio, Biliar, Porráceo, Hemático
  salidasDrenajesMl?: number; // Drenajes quirúrgicos o sondas
  salidasDrenajesTipo?: string; // Jackson Pratt, Penrose, Drenovac, Sonda Pleural, Sonda Levin
  salidasOtrasPerdidasMl?: number; // Pérdidas insensibles, Diaforesis profusa, Sangrado
  salidasDetalle?: string; // Notas de egresos
  
  // Totales Calculados
  totalEntradasMl: number; // Total acumulado de ingresos
  totalSalidasMl: number; // Total acumulado de egresos
  balanceNetoMl: number; // totalEntradasMl - totalSalidasMl (+ Positivo, - Negativo, 0 Neutro)
}

export interface WoundCareData {
  tipoLesion?: string; // Herida Quirúrgica, Úlcera por Presión (UPP), Lesión por Fricción, Quemadura, Retiro de Puntos, Pie Diabético
  localizacion?: string; // Sacro, Talón, Trocánter, Abdomen, Extremidad, etc.
  estadioUPP?: string; // Grado I, II, III, IV, No clasificable
  aspectoLecho?: string; // Granulación, Esfacelo, Necrótico, Eritematoso, Limpio, Bordes Afrontados
  exudado?: string; // Nulo, Escaso, Moderado, Abundante / Seroso, Purulento, Serohemático
  materialesUtilizados?: string; // Antiséptico (Microdacyn, Clorhexidina), Gasas estériles, Apósito hidrocoloide, Alginato, etc.
}

export interface NutritionDietData {
  tipoDieta?: string; // Normal, Blanda, Líquida, Papilla, Hiposódica, Diabética, Astringente, Nutrición Enteral por Sonda
  viaAlimentacion?: string; // Vía Oral independiente, Vía Oral asistida, SNG, PEG / Gastrostomía
  porcentajeAceptacion?: number; // 100% (Total), 75% (Aceptable), 50% (Regular), 25% (Mínima), 0% (Rechazo)
  tolerancia?: string; // Buena tolerancia, Náusea, Pirosis, Regurgitación, Distensión abdominal
}

export interface GeneralCareData {
  higiene?: string; // Baño de esponja en cama, Baño en regadera asistido, Aseo bucal, Cambio de pañal, Lavado de cabello
  movilizacion?: string; // Cambios posturales c/2h, Sedestación en sillón, Deambulación asistida, Reposo absoluto
  dispositivos?: string; // Cambio de fijación sonda Foley / catéter periférico / CVC, Aspiración de secreciones, Nebulización / Terapia respiratoria, Ejercicios pasivos
}

export interface ExpedienteEntry {
  id: string; // e.g. "EXPED-001"
  clientId: string; // e.g. "CLI-001"
  clientNombre?: string;
  caratulaFolio?: string; // e.g. "CPSEA000"
  tipo: ExpedienteType;
  titulo: string; // e.g. "Toma de Signos Turno Matutino", "Balance Hídrico Turno", "Curación de UPP Sacra"
  descripcion: string;
  vitals?: VitalsData;
  balanceLiquidos?: LiquidBalanceData;
  woundCare?: WoundCareData;
  nutritionDiet?: NutritionDietData;
  generalCare?: GeneralCareData;
  registradoPor: string; // Staff/Admin who logged it
  fechaHora: string; // ISO or formatted e.g. "2026-08-07 10:30"
  adjuntoUrl?: string;
  eventId?: string; // Optional linked CalendarEvent ID
  eventTitle?: string; // Optional linked CalendarEvent Title
  estado?: 'Activo' | 'Cancelado';
  fechaCancelacion?: string;
  canceladoPor?: string;
  sucursalId?: string;
  sucursalNombre?: string;
  timestamp: string;
}

export interface KardexAdministrationLog {
  id: string;
  fechaHora: string; // Custom or auto timestamp e.g. "2026-08-08 08:00"
  administradoPor: string;
  dosisAplicada?: string;
  notas?: string;
  horarioProgramado?: string; // e.g. "08:00", "16:00", "00:00"
  tomaSlotId?: string;
  fueraDeMiGuardia?: boolean; // Dose marked as administered outside current active shift
  estadoAplicacion?: 'aplicado' | 'sin_aplicacion'; // 'aplicado' (default) or 'sin_aplicacion' (no ministrado)
  motivoSinAplicacion?: string; // Reason when not administered (e.g. "No ministrado por familiar", "Rechazo del paciente", "Ayuno médico", "Paciente dormido", "Falta de insumo", "Otro")
  administradoPorTipo?: 'enfermeria' | 'familiar' | 'medico' | 'otro'; // Type of person who administered it
  verificadoEnGuardia?: boolean;
}

export interface KardexMedication {
  id: string; // e.g. "MED-001"
  nombreMedicamento: string;
  dosis: string;
  presentacion?: string; // e.g. "Tableta", "Cápsula", "Ampolleta", "Frasco", "Crema", "Gotas", "Parche", "Pieza", "ml", "mg", "Sobre"
  unidadMedida?: string; // Unified measurement unit
  tipoFrecuencia?: 'HorarioFijo' | 'ADemanda'; // Fixed schedule (e.g. c/8h) vs PRN / A Demanda (según sea necesario)
  indicacionesUsoADemanda?: string; // Reason or condition for PRN (e.g. "En caso de dolor", "En caso de fiebre > 38°C")
  dosisPorToma?: number; // Base variable 1: Número de dosis por toma (ej. 2 tabletas, 1 ampolleta, 10 ml)
  vecesAlDia?: number; // Base variable 2: Frecuencia diaria / cuántas veces al día (ej. 6 veces al día c/4h, or undefined for A Demanda)
  duracionDias?: number; // Base variable 3: Duración del tratamiento en días (ej. 5, 7, 10, 14 días)
  totalMedicamentoRequerido?: number; // Total calculado: (dosisPorToma) * (vecesAlDia) * (duracionDias)
  via: string;
  horario: string;
  frecuencia: string;
  indicaciones?: string;
  tipoTratamiento?: 'FinDefinido' | 'Indefinido' | 'ADemanda'; // 'FinDefinido' | 'Indefinido' | 'ADemanda'
  fechaInicioTratamiento?: string; // e.g. "2026-08-10"
  fechaFinTratamiento?: string; // e.g. "2026-08-20"
  dosisTotalesRequeridas?: number; // Calculated total doses for treatment duration
  diasAlertaResurtido?: number; // Configurable days before shortage to alert nurse (default: 5 or 7 days)
  estado: 'Activo' | 'Suspendido' | 'Completado';
  ultimaAdministracion?: string;
  administradoPor?: string;
  historialAdministracion?: KardexAdministrationLog[];
}

export interface KardexRecord {
  id: string; // e.g. "CLI-001" or "KARDEX-CLI-001"
  clientId: string;
  clientNombre: string;
  receptorNombre?: string;
  diagnostico?: string;
  alergias?: string;
  medicamentos: KardexMedication[];
  ultimaModificacion: string;
  modificadoPor: string;
  notasGenerales?: string;
}

export interface ClientDocument {
  id: string;
  ownerId?: string;
  clienteId?: string;
  nombre: string; // e.g. "Contrato Oficial de Servicio", "Receta Médica", "Identificación INE", "Póliza de Seguro"
  tipo: "Contrato" | "Receta_Medica" | "INE" | "Poliza_Seguro" | "Estudio_Laboratorio" | "Historia_Clinica" | "Comprobante_Pago" | "Otro" | string;
  url: string; // Base64 or URL
  archivoUrl?: string; // Fallback / alias for url
  tamano?: string; // e.g. "1.5 MB"
  tamanoBytes?: number;
  nombreArchivoOriginal?: string;
  fechaSubida: string;
  subidoPor?: string;
  notas?: string;
}

export interface Client {
  id: string; // e.g., "CLI-001"
  timestamp: string; // ISO date string or formatted date
  nombreCompletoCliente: string;
  numeroContacto: string;
  numeroContacto2?: string;
  numeroContacto3?: string;
  correo: string;
  direccionServicio: string;
  nombreCompletoRS: string; // Receptor del servicio
  edad: string;
  diagnostico: string;
  especificaciones: string;
  documentos?: ClientDocument[];
  contratoUrl?: string; // Contrato digital del cliente (PDF / Imagen)
  contratoNombre?: string;
  contratoFecha?: string;
  contratoNotas?: string;
  contratoLink?: string;
  asignadoA?: string; // Username of sales rep (e.g. "ventas1" or "admin")
  asignadoAtencionA?: string; // Username of Atención a Clientes agent
  creadoPor?: string; // Username who created the client
  modificadoPor?: string; // Username who last modified the client
  // Manual balance overrides
  saldoAFavorManual?: number | null; // Override manual de saldo a favor del cliente
  saldoPendienteManual?: number | null; // Override manual de saldo pendiente del cliente
  saldoAjusteNotas?: string; // Motivo o justificación del ajuste manual
  saldoAjusteFecha?: string; // Fecha en que se realizó el ajuste
  saldoAjustePor?: string; // Usuario que realizó el ajuste
  // Sucursal de Cuidarte México
  sucursalId?: string; // e.g. "pachuca" (todos los clientes actuales pertenecen a "pachuca")
  sucursalNombre?: string; // e.g. "Cuidarte Pachuca"
}

export interface ServiceCategory {
  id: string; // e.g., "CAT-001" or "cat-enfermeria"
  nombre: string;
  descripcion?: string;
  timestamp?: string;
}

export interface ServiceItem {
  id: string; // e.g., "SRV-001"
  timestamp: string;
  nombreServicio: string;
  categoria: string;
  descripcion: string;
  precio: number; // Unit selling price
  costo: number;  // Unit cost / investment
}

export type Service = ServiceItem;

export interface CaratulaServiceLine {
  servicio: string;
  cantidad: number;
  precioU: number;
  precioTot: number;
  costoU?: number; // Cost at time of sale for financial calculations
}

export type ShiftPresetType =
  | '12h_dia'
  | '12h_noche'
  | '24h'
  | '8h_mat'
  | '8h_vesp'
  | '8h_noc'
  | 'custom';

export interface ScheduledShiftItem {
  id: string;
  folioGuardia?: string; // Control folio único numerado en serie: ej. "GACP26A2108"
  caratulaFolio?: string; // Folio de la carátula asignada (ej. "CPSEA000")
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // "08:00"
  horaFin: string; // "20:00"
  fechaFinCalculada: string; // YYYY-MM-DD
  preset: ShiftPresetType;
  tipoServicio: string;
  personalAsignado: string;
  staffId?: string;
  staffNoSocio?: string;
  staffFoto?: string;
  notasTurno?: string;
  costoHonorarios?: number; // Costo / Honorarios configurables de forma individual para esta guardia
  honorarioPagado?: boolean; // Formally paid
  pagoHonorarioId?: string; // ID del egreso de pago asociado
  fechaPagoHonorario?: string; // Fecha en que se liquidó
  montoPagadoHonorario?: number; // Monto efectivamente liquidado
  estado?: 'Programado' | 'En Curso' | 'Realizado' | 'Cancelado';
  motivoCancelacion?: string;
}

export interface Caratula {
  folio: string; // e.g., "CPSEA000", "CPSEA001"
  id: string; // Client ID
  timestamp: string; // Date created
  tipoDocumento?: 'Caratula' | 'Cotización';
  validezCotizacion?: string; // Expiration date string e.g. "2026-08-15"
  
  // Client Data
  nombreCompletoCliente: string;
  numeroContacto: string;
  numeroContacto2?: string;
  numeroContacto3?: string;
  correo: string;
  direccionServicio: string;
  
  // Receptor Data
  nombreCompletoRS: string;
  edad: string;
  diagnostico: string;
  especificaciones: string;
  
  // Services breakdown (up to 4 items)
  servicios: CaratulaServiceLine[];
  
  // Financial Totals
  subtotal: number;
  descuento: number;
  total: number;
  pagado: number;
  pendiente: number;
  
  // Service Period & Validity (Vigencia de Uso)
  inicio: string; // e.g., "2026-08-10 08:00"
  fin: string;    // e.g., "2026-08-20 20:00"
  
  // Modalidad de Vigencia de Guardias Contratadas (horarios no definidos / uso flexible)
  modalidadVigencia?: boolean; // True si opera con vigencia para consumo de guardias
  tipoProgramacion?: 'fechas_fijas' | 'abiertas_vigencia' | 'mixto'; // Modalidad de programación
  fechaVigenciaInicio?: string; // e.g., "2026-08-23"
  fechaVigenciaFin?: string; // e.g., "2026-09-23"
  diasVigencia?: number; // e.g., 30 (días naturales de vigencia)
  guardiasTotalContratadas?: number; // Total de guardias contratadas
  guardiasAgendadas?: number; // Guardias con fecha/hora fija en calendario (0, algunas o todas)
  guardiasPendientesPorAgendar?: number; // Guardias disponibles con vigencia
  guardiasProgramadas?: ScheduledShiftItem[]; // Lista detallada de guardias agendadas con fechas y horarios
  notasVigencia?: string; // Observaciones de la vigencia y condiciones de agendamiento
  
  // Contract & T&C references
  contratoLink?: string;
  tycLink?: string;
  
  // Free text for Quote / Cotización details & Service details
  detallesCotizacionText?: string;
  detallesServicio?: string;
  
  // Verification Token for public authenticity link
  verificationToken?: string;

  // Sales & Attribution
  creadoPor?: string; // Username of sales rep or admin
  vendedorUx?: string; // Sales rep username (for strict filter)
  vendedorNombre?: string; // Sales rep display name
  
  // Notes / Status & Cancellation details
  estado?: 'Activo' | 'Completado' | 'Cancelado' | 'Cotización';
  motivoCancelacion?: string;
  fechaCancelacion?: string;
  canceladoPor?: string;

  // Custom Honorarios Budget & Settlement Control
  honorarioPersonalPersonalizado?: number; // Override of total budgeted honorarios for this service
  honorariosLiquidados?: boolean; // Formally marked as fully settled / paid
  fechaLiquidacionHonorarios?: string; // Timestamp when marked as settled
  liquidadoHonorariosPor?: string; // User who marked honorarios as settled
  notasHonorarios?: string; // Administrative notes regarding staff fees
  // Sucursal Cuidarte México
  sucursalId?: string; // e.g. "pachuca"
  sucursalNombre?: string;
  modificadoPor?: string;
  ultimaModificacion?: string;
}

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de Débito (TD)'
  | 'Tarjeta de Crédito (TC)'
  | 'Transferencia Bancaria'
  | 'Tarjeta de Débito/Crédito'
  | 'Cheque'
  | 'Saldo a Favor'
  | 'Otro';

export interface AbonoTicket {
  id: string; // e.g., "TKT-CPSEA000-01" or "TKT-2026-001"
  caratulaFolio: string; // e.g., "CPSEA000"
  clienteNombre: string;
  receptorNombre?: string;
  montoAbonado: number; // Monto abonado en este ticket
  totalCaratula: number; // Monto total de la caratula
  pagadoAnterior: number; // Pagado acumulado antes de este abono
  pagadoNuevoTotal: number; // Pagado acumulado con este abono
  pendienteRestante: number; // Pendiente restante tras este abono
  metodoPago: PaymentMethod;
  referencia?: string; // Clave rastreo / No. Recibo / Comprobante
  fecha: string; // Formatted date string
  atendidoPor?: string; // User/Admin who processed payment
  notas?: string;
  saldoAFavorAplicado?: number; // Saldo a favor previo del cliente aplicado a este ticket
  saldoAFavorGenerado?: number; // Excedente pagado de más en este ticket
  saldoAFavorRestanteCliente?: number; // Saldo a favor total disponible para siguientes carátulas
  saldoPendienteAnteriorOtrosFolios?: number; // Deuda pendiente en otras carátulas anteriores
  saldoTotalClientePostPago?: number; // Saldo pendiente neto acumulado del cliente tras este abono
  estado?: 'Activo' | 'Cancelado';
  motivoCancelacion?: string;
  fechaCancelacion?: string;
  canceladoPor?: string;
  registradoPor?: string;
  sucursalId?: string;
  sucursalNombre?: string;
}

export type ExpenseCategory =
  | 'Honorarios Enfermería'
  | 'Materiales y Suministros'
  | 'Transporte'
  | 'Gastos Administrativos'
  | 'Otro';

export interface Expense {
  id: string; // e.g., "EXP-001"
  caratulaFolio: string; // Folio of the associated caratula/service
  timestamp: string; // Formatted date e.g. "2026-08-07 10:00"
  concepto: string; // Description e.g., "Pago de turno enfermera Karla"
  monto: number; // Expense payment amount
  categoria: ExpenseCategory;
  registradoPor?: string; // User who recorded the expense
  notas?: string;
  estado?: 'Activo' | 'Cancelado';
  motivoCancelacion?: string;
  fechaCancelacion?: string;
  canceladoPor?: string;
  // Link to specific guardia and socio:
  guardiaId?: string;
  folioGuardia?: string;
  staffId?: string;
  staffNoSocio?: string;
  staffNombre?: string;
  metodoPago?: string;
  referenciaPago?: string;
  modificadoPor?: string;
  sucursalId?: string;
  sucursalNombre?: string;
}

export interface SystemUser {
  id: string; // e.g. "usr-nestor-moedano"
  ux: string; // Username e.g. "Nestor Moedano"
  cx: string; // Password
  role: UserRole;
  nombre: string; // Display name / full name
  isSuperAdmin?: boolean; // True for Nestor Moedano
  isGeneralAdmin?: boolean; // True for general admins of Cuidarte México (all branches)
  sucursalId?: string; // ID de la sucursal asignada (e.g. "pachuca") si es admin local
  sucursalNombre?: string;
  clientId?: string; // e.g. "CLI-1001"
  nurseId?: string; // e.g. "SOCP-25001" or "25001"
  asignadoA?: string;
  estatus?: "Activo" | "Inactivo";
  isOnline?: boolean;
  ultimaConexionIso?: string;
  ultimaConexionTimestamp?: number;
  sesionRevocadaAt?: string;
  sesionActivaDispositivo?: string;
  tokenSesionActiva?: string;
  timestamp?: string;
}


export type PersonalType =
  | 'Lic. en Enfermería'
  | 'Enfermero/a Técnico'
  | 'Auxiliar de Enfermería'
  | 'Cuidador / Cuidadora'
  | 'Médico General'
  | 'Especialista'
  | 'Administrativo Operativo'
  | 'Ventas / Asesor Comercial'
  | 'Atención a Clientes'
  | 'Otro';

export interface DenominationBreakdown {
  b1000?: number;
  b500?: number;
  b200?: number;
  b100?: number;
  b50?: number;
  b20?: number;
  m20?: number;
  m10?: number;
  m5?: number;
  m2?: number;
  m1?: number;
  m050?: number;
}

export interface CorteDeCajaRecord {
  id: string; // e.g., "CORTE-20260811-1530"
  fechaIso: string; // ISO string
  fechaFormateada: string; // e.g. "2026-08-11 15:30"
  usuario: string; // Cashier / Admin name
  fondoInicial: number;

  // Income details
  ingresosEfectivo: number;
  ingresosTransferencia: number;
  ingresosTarjeta: number;
  ingresosOtros: number;
  totalIngresos: number;
  numAbonos: number;

  // Expenses details
  totalEgresos: number;
  numEgresos: number;

  // Cash expected vs counted
  efectivoEsperado: number;
  efectivoContado: number;
  diferenciaArqueo: number; // efectivoContado - efectivoEsperado (Sobrante > 0, Faltante < 0)
  denominaciones?: DenominationBreakdown;

  // Withdrawals and shift handoff
  retiroEfectivo: number; // Cash transferred to safe/bank
  fondoSiguienteTurno: number; // Cash remaining in drawer

  notas?: string;
  registradoPor?: string;
  sucursalId?: string;
  sucursalNombre?: string;
  timestamp: string;
}

export interface StaffDocument {
  id: string;
  nombre: string; // e.g. "INE Anverso", "Cédula Profesional", "Título", "Comprobante de Domicilio", "CV", "Certificado RCP", "Contrato"
  tipo: "INE" | "Cedula_Titulo" | "CV" | "Comprobante_Domicilio" | "Certificacion" | "Contrato" | "Otro" | string;
  url?: string; // Base64 or URL
  archivoUrl?: string; // Alias for url
  tamano?: string; // e.g. "1.2 MB"
  tamanoBytes?: number;
  nombreArchivoOriginal?: string;
  fechaSubida: string;
  subidoPor?: string;
  notas?: string;
}

export type StaffClasificacion = 'socio' | 'empleado';
export type MembresiaEstatus = 'Activa' | 'Inactiva' | 'Suspendida' | 'Pendiente';

export interface StaffMember {
  id: string; // e.g., "SOC-25001"
  noSocio: string; // e.g., "25001"
  nombre: string; // e.g., "JUAN CARLOS" or "LIC. JUAN CARLOS"
  apellidos: string; // e.g., "PÉREZ LÓPEZ"
  gradoTitulo: string; // e.g., "LICENCIADO EN ENFERMERÍA", "CUIDADOR / ENFERMERÍA"
  puestoTipoPersonal: PersonalType | string; // Classification
  areaAdscripcion: string; // e.g., "DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO"
  fotoUrl: string; // Base64 image or URL
  folioUrgencias?: string; // e.g., "0125001"
  fechaExpiracion: string; // e.g., "21/08/2030"
  badgePrincipal?: string; // e.g., "PERSONAL DE ATENCIÓN A URGENCIAS"
  badgesSecundarios?: string[]; // e.g., ["DIR GRAL NAL", "R HGO PS"]
  telefono?: string;
  correo?: string;
  curp?: string;
  tipoPersonalClasificacion?: StaffClasificacion; // 'socio' | 'empleado'
  tipoContrato: string; // Default: "Contrato por Prestación de Servicios (Socio Operativo Independiente)"
  tipoCredencial?: 'atencion' | 'administrativo' | 'ambos'; // Distinction between personal de atención vs administrativo corporativo vs dual (ambos)
  isAdministrativo?: boolean;
  esSocioOperativo?: boolean; // Personal operativo que atiende urgencias
  
  // Membresía Cuidarte Pachuca (Socios Operativos)
  membresiaActiva?: boolean; // True si la membresía está activa
  membresiaEstatus?: MembresiaEstatus; // 'Activa' | 'Inactiva' | 'Suspendida' | 'Pendiente'
  membresiaCostoPorServicio?: number; // Costo/cuota por servicio asignado ($ MXN, ej. 50)
  membresiaFechaInicio?: string; // Fecha de inicio/activación de membresía
  membresiaFolio?: string; // Folio ej. "MEMB-CP-25001"
  membresiaNotas?: string;
  ofertasGuardiasHabilitadas?: boolean; // Habilita la recepción de ofertas para cubrir guardias según su perfil
  
  sesionActiva?: boolean;
  ultimaConexion?: string;
  ultimaConexionTimestamp?: number;
  estatus: 'Activo' | 'Inactivo' | 'Baja';
  codigoVerificacion?: string;
  notas?: string;
  documentos?: StaffDocument[];
  // Datos de Cuenta Bancaria para Pagos / Honorarios
  banco?: string; // e.g. "BBVA", "Santander", "Banorte", "Citibanamex", "HSBC", "Scotiabank", "Nu", "Mercado Pago", "Banco Azteca", "Spin by OXXO", "Hey Banco", "Otro"
  cuentaBancaria?: string; // Número de Cuenta Bancaria
  clabeInterbancaria?: string; // CLABE Interbancaria (18 dígitos)
  titularCuenta?: string; // Nombre del titular de la cuenta
  rfcFacturacion?: string; // RFC para comprobantes o facturación
  tipoPagoPreferencia?: 'Transferencia' | 'Efectivo' | 'Cheque';
  // Access Control to Client / Receptor Details (Controlled by Administrator)
  clientesAsignadosIds?: string[]; // List of client IDs assigned to this staff member
  bloquearAccesoReceptores?: boolean; // When true, access to ALL assigned client/receptor private data, expediente, and notes is blocked
  receptoresRevocadosIds?: string[]; // Granular list of Client IDs / Receptor IDs for which access is specifically revoked/blocked for this staff member
  motivoBloqueoAcceso?: string; // Reason for blocking/restricting access
  fechaBloqueoAcceso?: string;
  bloqueadoPor?: string;
  permisoVerExpediente?: boolean; // Defaults to true if not explicitly false
  permisoVerContacto?: boolean; // Defaults to true if not explicitly false
  timestamp: string;
  creadoPor?: string;
  modificadoPor?: string;
  sucursalId?: string; // "pachuca", etc. o vacío si es asignable a cualquier sucursal
  sucursalNombre?: string;
}

export interface GuardiaShiftRecord {
  id: string; // e.g., "GUA-20260812-1001"
  folioGuardia?: string;
  staffId: string; // e.g. "SOC-25001"
  staffNoSocio: string; // e.g. "25001"
  staffNombre: string; // e.g. "Enf. Juan Carlos Pérez"
  clientId?: string;
  clientNombre?: string;
  caratulaFolio?: string;
  fechaInicioIso: string; // e.g. "2026-08-12T08:00:00.000Z"
  fechaInicioFormateada: string; // e.g. "12/08/2026 08:00 AM"
  horaInicio?: string; // e.g. "08:00 hrs" or "08:00 AM"
  notasInicio?: string;
  ubicacionEntrada?: string;
  fechaFinIso?: string;
  fechaFinFormateada?: string;
  horaFin?: string; // e.g. "20:00 hrs" or "08:00 PM"
  notasFin?: string;
  novedadesEntrega?: string;
  duracionMinutos?: number;
  estatus: "En Curso" | "Finalizada";
  registradoPor: string;
  sucursalId?: string;
  sucursalNombre?: string;
  timestamp: string;
}

export type InventoryCategory =
  | 'Medicamento'
  | 'Material/Insumo'
  | 'Higiene Personal'
  | 'Aparato/Equipo'
  | 'Solicitud de Compra'
  | 'Otro';

export type ControlType =
  | 'Con Control de Inventario'
  | 'Sin Control de Inventario'
  | 'Con Control Kardex/Conteo'
  | 'Sin Control (Marcado Manual)';

export interface InventoryMovement {
  id: string;
  tipo: 'Ingreso' | 'Descuento_Kardex' | 'Uso_Insumo' | 'Ajuste_Faltante' | 'Ajuste_Perdida' | 'Correccion_Admin' | 'Marca_StockBajo';
  cantidad: number; // Positive for addition, negative for deduction/adjustment
  stockAnterior: number;
  stockNuevo: number;
  fechaHora: string;
  registradoPor: string;
  notas?: string;
  referenciaKardexId?: string;
}

export interface InventoryItem {
  id: string; // e.g. "INV-001"
  clientId: string; // e.g. "CLI-001"
  clientNombre?: string;
  nombre: string; // e.g. "Losartán 50mg", "Gasas estériles", "Shampoo neutro"
  categoria: InventoryCategory;
  controlTipo: ControlType; // 'Con Control Kardex/Conteo' or 'Sin Control (Marcado Manual)'
  
  stockActual: number; // e.g. 21
  unidadMedida: string; // e.g. "Tabletas", "Cápsulas", "Piezas", "Cajas", "Frascos", "Ampolletas", "ml", "mg", "Parches", "Sobres", "Tubos/Cremas"
  presentacion?: string; // e.g. "Tableta", "Cápsula", "Ampolleta", "Frasco", "Crema", "Gotas", "Parche", "Pieza", "ml", "mg"
  
  // Link to Kardex Medication & Calculation variables (if applicable)
  kardexMedicationId?: string;
  dosisPorToma?: number; // Base variable 1: Número de dosis por toma (ej. 2 tabletas)
  vecesAlDia?: number; // Base variable 2: Frecuencia diaria / tomas por día (ej. 6 veces/día)
  tipoFrecuencia?: 'HorarioFijo' | 'ADemanda'; // 'HorarioFijo' vs 'ADemanda'
  indicacionesUsoADemanda?: string;
  frecuenciaKardex?: string; // e.g. "Cada 8 hrs", "1 vez al día", "A Demanda (PRN)"
  dosesPerDay?: number; // Calculated or manual doses per day
  tipoTratamiento?: 'FinDefinido' | 'Indefinido' | 'ADemanda'; // Fin definido vs Indefinido (1 mes) vs A Demanda
  fechaInicioTratamiento?: string; // e.g. "2026-08-01"
  fechaFinTratamiento?: string; // e.g. "2026-08-20"
  duracionDiasTratamiento?: number; // Base variable 3: Días de tratamiento
  totalMedicamentoRequerido?: number; // Total = (dosisPorToma) * (vecesAlDia) * (duracionDias)
  daysThresholdAlert?: number; // Days of treatment threshold to trigger low stock alert (e.g. 5, 7 days)
  customStockMinimo?: number; // Manual threshold override
  
  marcadoStockBajoManual?: boolean; // For "Sin Control" items manually flagged as needing purchase
  notas?: string;
  
  historialMovimientos?: InventoryMovement[];
  registradoPor: string;
  modificadoPor?: string;
  sucursalId?: string;
  sucursalNombre?: string;
  fechaCreacion: string;
  ultimaActualizacion: string;
}

export type IncidenciaEstado = 'Abierta' | 'En Proceso' | 'Resuelta' | 'Cancelada';
export type IncidenciaPrioridad = 'Baja' | 'Media' | 'Alta' | 'Urgente';
export type IncidenciaCategoria = 
  | 'Atención al Cliente'
  | 'Desempeño / Personal'
  | 'Horario / Turnos'
  | 'Insumos / Medicamentos'
  | 'Facturación / Pagos'
  | 'Médico / Salud'
  | 'Solicitud Especial'
  | 'Otro';

export interface IncidenciaTicket {
  id: string; // e.g. "INC-20260817-001"
  clientId: string; // e.g. "CLI-001"
  clientNombre: string;
  caratulaFolio?: string;
  categoria: IncidenciaCategoria;
  prioridad: IncidenciaPrioridad;
  estado: IncidenciaEstado;
  titulo: string;
  descripcion: string;
  reportadoPor: string; // Cliente, Familiar, Personal, etc.
  atendidoPor: string; // Ux or name of Atención a Clientes user
  resolucion?: string;
  fechaReporte: string; // ISO
  fechaResolucion?: string;
  sucursalId?: string;
  sucursalNombre?: string;
  timestamp: string;
}

export type SolicitudIncrementoEstado = 'Cotizado' | 'Agregado al Servicio' | 'Aprobado por Cliente' | 'Rechazado';

export interface SolicitudIncrementoServicio {
  id: string; // e.g. "INC-SERV-001"
  clientId: string;
  clientNombre: string;
  caratulaFolioReferencia?: string;
  titulo: string; // e.g. "Incremento de 4 Guardias Nocturnas Adicionales"
  serviciosSolicitados: CaratulaServiceLine[];
  subtotal: number;
  descuento: number;
  total: number;
  motivoIncremento: string;
  estado: SolicitudIncrementoEstado;
  solicitadoPor: string;
  registradoPorUx: string;
  fechaSolicitud: string;
  fechaAplicacion?: string;
  notas?: string;
  sucursalId?: string;
  sucursalNombre?: string;
  timestamp: string;
}


