import React, { useState, useMemo } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { StaffMember, PersonalType, GuardiaShiftRecord, Client, Caratula, CalendarEvent, SystemUser, MembresiaEstatus, Sucursal, UserSession } from "../types";
import { getCurrentTimestamp } from "../utils/formatters";
import { getStaffVerificationCode } from "../utils/staffVerification";
import { deduplicateClients } from "../utils/dataIntegrity";
import { StaffCredentialCard } from "./StaffCredentialCard";
import { ImageCropperModal } from "./ImageCropperModal";
import { CaratulaVerificationPortal } from "./CaratulaVerificationPortal";
import { DocumentUploadModal } from "./DocumentUploadModal";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Camera,
  ShieldCheck,
  X,
  Check,
  Filter,
  Eye,
  Crop,
  UserCheck,
  UserX,
  Briefcase,
  KeyRound,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  FolderOpen,
  ShieldAlert,
  Lock,
  Unlock,
  FileSignature,
  FileCheck2,
  AlertTriangle,
  UserPlus,
  Ban,
  RotateCcw,
  LogOut,
  PowerOff,
  Activity,
  Radio,
  Layers,
  CreditCard,
  Building2,
  Copy,
  Sparkles,
  DollarSign,
  Award,
  Star,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import {
  terminateStaffActiveShiftInFirestore,
  terminateGuardiaShiftByIdInFirestore,
  revokeUserSessionInFirestore,
} from "../services/firestoreSync";

interface StaffCredentialManagerProps {
  staffMembers: StaffMember[];
  systemUsers?: SystemUser[];
  clients?: Client[];
  caratulas?: Caratula[];
  calendarEvents?: CalendarEvent[];
  guardiaRecords?: GuardiaShiftRecord[];
  sucursales?: Sucursal[];
  userSession?: UserSession | null;
  onSaveStaffMember: (staff: StaffMember) => void;
  onDeleteStaffMember: (id: string) => void;
  onSaveClient?: (client: Client) => Promise<void> | void;
  onBatchSaveClients?: (clients: Client[]) => Promise<void> | void;
  onSaveGuardia?: (guardia: GuardiaShiftRecord) => Promise<void> | void;
  onSaveCalendarEvent?: (event: CalendarEvent) => Promise<void> | void;
}

const PERSONAL_TYPES: PersonalType[] = [
  "Lic. en Enfermería",
  "Enfermero/a Técnico",
  "Auxiliar de Enfermería",
  "Cuidador / Cuidadora",
  "Médico General",
  "Especialista",
  "Administrativo Operativo",
  "Ventas / Asesor Comercial",
  "Atención a Clientes",
  "Otro",
];

export const StaffCredentialManager: React.FC<StaffCredentialManagerProps> = ({
  staffMembers = [],
  systemUsers = [],
  clients = [],
  caratulas = [],
  calendarEvents = [],
  guardiaRecords = [],
  sucursales = [],
  userSession,
  onSaveStaffMember,
  onDeleteStaffMember,
  onSaveClient,
  onBatchSaveClients,
  onSaveGuardia,
  onSaveCalendarEvent,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"directorio" | "checadas">("directorio");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [vincFilter, setVincFilter] = useState<string>("ALL");
  const [shiftEstatusFilter, setShiftEstatusFilter] = useState<string>("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStaffForCredential, setSelectedStaffForCredential] = useState<StaffMember | null>(null);
  const [selectedStaffForDocuments, setSelectedStaffForDocuments] = useState<StaffMember | null>(null);
  const [selectedStaffForAccessModal, setSelectedStaffForAccessModal] = useState<StaffMember | null>(null);
  const [accessModalSearch, setAccessModalSearch] = useState("");

  // Client Assignment Modal State
  const [selectedStaffForClientAssignment, setSelectedStaffForClientAssignment] = useState<StaffMember | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentFilterTab, setAssignmentFilterTab] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");

  const uniqueClients = useMemo(() => deduplicateClients(clients), [clients]);
  const [assignmentRoleTarget, setAssignmentRoleTarget] = useState<"auto" | "ventas" | "atencion" | "ambos">("auto");
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

  // Image Cropper Modal State
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);

  // Lock background body scroll when any modal in StaffCredentialManager is open
  useLockBodyScroll(Boolean(
    isFormOpen ||
    selectedStaffForCredential ||
    selectedStaffForDocuments ||
    selectedStaffForAccessModal ||
    selectedStaffForClientAssignment ||
    staffToDelete ||
    isCropperOpen ||
    isVerifierOpen
  ));

  // Form State
  const [formState, setFormState] = useState<Partial<StaffMember>>({
    id: "",
    noSocio: "",
    nombre: "",
    apellidos: "",
    gradoTitulo: "LICENCIADO EN ENFERMERÍA",
    puestoTipoPersonal: "Lic. en Enfermería",
    tipoCredencial: "atencion",
    isAdministrativo: false,
    esSocioOperativo: true,
    tipoPersonalClasificacion: "socio",
    areaAdscripcion: "DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO",
    fotoUrl: "",
    folioUrgencias: "",
    fechaExpiracion: "21/08/2030",
    badgePrincipal: "PERSONAL DE ATENCIÓN A URGENCIAS",
    badgesSecundarios: ["DIR GRAL NAL", "R HGO PS"],
    telefono: "",
    correo: "",
    tipoContrato: "Socio Operativo",
    estatus: "Activo",
    notas: "",
    // Membresía Cuidarte Pachuca
    membresiaActiva: true,
    membresiaEstatus: "Activa",
    membresiaCostoPorServicio: 50,
    membresiaFolio: "",
    membresiaFechaInicio: "01/01/2026",
    membresiaNotas: "",
    ofertasGuardiasHabilitadas: true,
    banco: "",
    cuentaBancaria: "",
    clabeInterbancaria: "",
    titularCuenta: "",
    rfcFacturacion: "",
    tipoPagoPreferencia: "Transferencia",
    bloquearAccesoReceptores: false,
    receptoresRevocadosIds: [],
    motivoBloqueoAcceso: "",
    documentos: [],
  });

  // Calculate assigned clients for a specific staff member
  const getAssignedClientsForStaff = (staff: StaffMember) => {
    if (!staff) return [];
    const staffNameFull = `${staff.nombre || ""} ${staff.apellidos || ""}`.trim().toLowerCase();
    const staffFirstName = (staff.nombre || "").trim().toLowerCase();
    const staffNoSocio = (staff.noSocio || "").trim().toLowerCase();
    const staffId = (staff.id || "").trim().toLowerCase();

    return (clients || []).filter((c) => {
      if (!c) return false;
      const asigA = (c.asignadoA || "").trim().toLowerCase();
      const asigAtenc = (c.asignadoAtencionA || "").trim().toLowerCase();

      const matchesAsigA =
        asigA &&
        (asigA === staffNameFull ||
          asigA === staffFirstName ||
          asigA === staffNoSocio ||
          asigA === staffId ||
          (staffNameFull && staffNameFull.includes(asigA)) ||
          (staffFirstName && asigA.includes(staffFirstName)));

      const matchesAsigAtenc =
        asigAtenc &&
        (asigAtenc === staffNameFull ||
          asigAtenc === staffFirstName ||
          asigAtenc === staffNoSocio ||
          asigAtenc === staffId ||
          (staffNameFull && staffNameFull.includes(asigAtenc)) ||
          (staffFirstName && asigAtenc.includes(staffFirstName)));

      const matchesExplicitList = staff.clientesAsignadosIds?.includes(c.id);

      return Boolean(matchesAsigA || matchesAsigAtenc || matchesExplicitList);
    });
  };

  const handlePuestoChange = (newPuesto: string) => {
    let updatedBadge = formState.badgePrincipal;
    let updatedGrado = formState.gradoTitulo;
    let updatedTipoContrato = formState.tipoContrato;
    const isPuestoAdmin =
      newPuesto === "Ventas / Asesor Comercial" ||
      newPuesto === "Atención a Clientes" ||
      newPuesto === "Administrativo Operativo";

    if (newPuesto === "Ventas / Asesor Comercial") {
      if (!updatedBadge || updatedBadge === "PERSONAL DE ATENCIÓN A URGENCIAS") {
        updatedBadge = "PERSONAL ADMINISTRATIVO - VENTAS";
      }
      if (!updatedGrado || updatedGrado === "LICENCIADO EN ENFERMERÍA") {
        updatedGrado = "ASESOR COMERCIAL / VENTAS";
      }
      updatedTipoContrato = "Empleado Contratado";
    } else if (newPuesto === "Atención a Clientes") {
      if (!updatedBadge || updatedBadge === "PERSONAL DE ATENCIÓN A URGENCIAS") {
        updatedBadge = "PERSONAL ADMINISTRATIVO - ATENCIÓN A CLIENTES";
      }
      if (!updatedGrado || updatedGrado === "LICENCIADO EN ENFERMERÍA") {
        updatedGrado = "COORDINADOR DE ATENCIÓN A CLIENTES";
      }
      updatedTipoContrato = "Empleado Contratado";
    } else if (newPuesto === "Administrativo Operativo") {
      if (!updatedBadge || updatedBadge === "PERSONAL DE ATENCIÓN A URGENCIAS") {
        updatedBadge = "PERSONAL ADMINISTRATIVO";
      }
      if (!updatedGrado || updatedGrado === "LICENCIADO EN ENFERMERÍA") {
        updatedGrado = "LIC. EN ADMINISTRACIÓN";
      }
      updatedTipoContrato = "Empleado Contratado";
    }

    setFormState((prev) => ({
      ...prev,
      puestoTipoPersonal: newPuesto,
      tipoCredencial: isPuestoAdmin ? "administrativo" : (prev.tipoCredencial || "atencion"),
      isAdministrativo: isPuestoAdmin,
      badgePrincipal: updatedBadge,
      gradoTitulo: updatedGrado,
      tipoContrato: updatedTipoContrato,
    }));
  };

  // Toggle single client assignment
  const handleToggleClientAssignment = async (
    client: Client,
    staff: StaffMember,
    effectiveRole: "ventas" | "atencion" | "ambos"
  ) => {
    if (!staff || !client) return;
    const staffIdentifier = `${staff.nombre || ""} ${staff.apellidos || ""}`.trim();
    const assignedList = getAssignedClientsForStaff(staff);
    const isCurrentlyAssigned = assignedList.some((c) => c.id === client.id);

    let updatedClient: Client = { ...client };

    if (isCurrentlyAssigned) {
      // Unassign
      if (effectiveRole === "ventas" || effectiveRole === "ambos") {
        if (
          (client.asignadoA || "").toLowerCase().includes((staff.nombre || "").toLowerCase()) ||
          (client.asignadoA || "").toLowerCase().includes((staff.noSocio || "").toLowerCase())
        ) {
          updatedClient.asignadoA = "";
        }
      }
      if (effectiveRole === "atencion" || effectiveRole === "ambos") {
        if (
          (client.asignadoAtencionA || "").toLowerCase().includes((staff.nombre || "").toLowerCase()) ||
          (client.asignadoAtencionA || "").toLowerCase().includes((staff.noSocio || "").toLowerCase())
        ) {
          updatedClient.asignadoAtencionA = "";
        }
      }
    } else {
      // Assign
      if (effectiveRole === "ventas" || effectiveRole === "ambos") {
        updatedClient.asignadoA = staffIdentifier;
      }
      if (effectiveRole === "atencion" || effectiveRole === "ambos") {
        updatedClient.asignadoAtencionA = staffIdentifier;
      }
    }

    if (onSaveClient) {
      await onSaveClient(updatedClient);
    }
  };

  // Bulk assign all filtered clients
  const handleBatchAssignFiltered = async (
    staff: StaffMember,
    clientsToAssign: Client[],
    effectiveRole: "ventas" | "atencion" | "ambos"
  ) => {
    if (!staff) return;
    const staffIdentifier = `${staff.nombre || ""} ${staff.apellidos || ""}`.trim();
    setIsSavingAssignments(true);
    try {
      const updatedList: Client[] = (clientsToAssign || []).map((client) => {
        const copy = { ...client };
        if (effectiveRole === "ventas" || effectiveRole === "ambos") {
          copy.asignadoA = staffIdentifier;
        }
        if (effectiveRole === "atencion" || effectiveRole === "ambos") {
          copy.asignadoAtencionA = staffIdentifier;
        }
        return copy;
      });

      if (onBatchSaveClients) {
        await onBatchSaveClients(updatedList);
      } else if (onSaveClient) {
        for (const c of updatedList) {
          await onSaveClient(c);
        }
      }
    } finally {
      setIsSavingAssignments(false);
    }
  };

  // Bulk unassign all clients from this staff member
  const handleBatchUnassignAll = async (
    staff: StaffMember,
    effectiveRole: "ventas" | "atencion" | "ambos"
  ) => {
    if (!staff) return;
    const assignedList = getAssignedClientsForStaff(staff);
    if (assignedList.length === 0) return;

    setIsSavingAssignments(true);
    try {
      const updatedList: Client[] = assignedList.map((client) => {
        const copy = { ...client };
        if (effectiveRole === "ventas" || effectiveRole === "ambos") {
          if (
            (client.asignadoA || "").toLowerCase().includes((staff.nombre || "").toLowerCase()) ||
            (client.asignadoA || "").toLowerCase().includes((staff.noSocio || "").toLowerCase())
          ) {
            copy.asignadoA = "";
          }
        }
        if (effectiveRole === "atencion" || effectiveRole === "ambos") {
          if (
            (client.asignadoAtencionA || "").toLowerCase().includes((staff.nombre || "").toLowerCase()) ||
            (client.asignadoAtencionA || "").toLowerCase().includes((staff.noSocio || "").toLowerCase())
          ) {
            copy.asignadoAtencionA = "";
          }
        }
        return copy;
      });

      if (onBatchSaveClients) {
        await onBatchSaveClients(updatedList);
      } else if (onSaveClient) {
        for (const c of updatedList) {
          await onSaveClient(c);
        }
      }
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const handleOpenNew = () => {
    // Generate next noSocio ID
    const maxNo = staffMembers.reduce((max, s) => {
      const num = parseInt(s.noSocio.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 25000);

    const nextNo = (maxNo + 1).toString();

    setFormState({
      id: `SOC-${nextNo}`,
      noSocio: nextNo,
      nombre: "",
      apellidos: "",
      gradoTitulo: "LICENCIADO EN ENFERMERÍA",
      puestoTipoPersonal: "Lic. en Enfermería",
      tipoCredencial: "atencion",
      isAdministrativo: false,
      esSocioOperativo: true,
      tipoPersonalClasificacion: "socio",
      areaAdscripcion: "DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO",
      fotoUrl: "",
      folioUrgencias: `01${nextNo}`,
      fechaExpiracion: "21/08/2030",
      badgePrincipal: "PERSONAL DE ATENCIÓN A URGENCIAS",
      badgesSecundarios: ["DIR GRAL NAL", "R HGO PS"],
      telefono: "",
      correo: "",
      tipoContrato: "Socio Operativo",
      estatus: "Activo",
      notas: "",
      // Membresía Cuidarte Pachuca
      membresiaActiva: true,
      membresiaEstatus: "Activa",
      membresiaCostoPorServicio: 50,
      membresiaFolio: `MEMB-CP-${nextNo}`,
      membresiaFechaInicio: new Date().toLocaleDateString("es-MX"),
      membresiaNotas: "",
      ofertasGuardiasHabilitadas: true,
      banco: "",
      cuentaBancaria: "",
      clabeInterbancaria: "",
      titularCuenta: "",
      rfcFacturacion: "",
      tipoPagoPreferencia: "Transferencia",
      bloquearAccesoReceptores: false,
      receptoresRevocadosIds: [],
      motivoBloqueoAcceso: "",
      documentos: [],
      sucursalId: userSession?.sucursalId || (sucursales[0]?.id || "pachuca"),
      sucursalNombre: userSession?.sucursalNombre || (sucursales[0]?.nombre || "Cuidarte Pachuca"),
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    const selectedCredencial =
      staff.tipoCredencial === "ambos"
        ? "ambos"
        : staff.tipoCredencial === "administrativo" ||
          (staff.tipoCredencial !== "atencion" && !!staff.isAdministrativo)
        ? "administrativo"
        : "atencion";

    const isEmp = staff.tipoPersonalClasificacion === "empleado" ||
      staff.tipoContrato?.toLowerCase().includes("empleado");

    const isMembresiaActivaVal = staff.membresiaActiva !== false &&
      (staff.membresiaEstatus === "Activa" || !staff.membresiaEstatus);

    setFormState({
      ...staff,
      tipoPersonalClasificacion: isEmp ? "empleado" : "socio",
      tipoCredencial: selectedCredencial,
      isAdministrativo: selectedCredencial === "administrativo",
      esSocioOperativo: staff.esSocioOperativo !== undefined ? !!staff.esSocioOperativo : !isEmp,
      tipoContrato: isEmp ? "Empleado Contratado" : "Socio Operativo",
      membresiaActiva: isMembresiaActivaVal,
      membresiaEstatus: staff.membresiaEstatus || (isMembresiaActivaVal ? "Activa" : "Inactiva"),
      membresiaCostoPorServicio: staff.membresiaCostoPorServicio ?? 50,
      membresiaFolio: staff.membresiaFolio || `MEMB-CP-${staff.noSocio || "25001"}`,
      membresiaFechaInicio: staff.membresiaFechaInicio || "01/01/2026",
      membresiaNotas: staff.membresiaNotas || "",
      ofertasGuardiasHabilitadas: staff.ofertasGuardiasHabilitadas !== false,
      banco: staff.banco || "",
      cuentaBancaria: staff.cuentaBancaria || "",
      clabeInterbancaria: staff.clabeInterbancaria || "",
      titularCuenta: staff.titularCuenta || "",
      rfcFacturacion: staff.rfcFacturacion || "",
      tipoPagoPreferencia: staff.tipoPagoPreferencia || "Transferencia",
      bloquearAccesoReceptores: !!staff.bloquearAccesoReceptores,
      receptoresRevocadosIds: staff.receptoresRevocadosIds || [],
      motivoBloqueoAcceso: staff.motivoBloqueoAcceso || "",
      sucursalId: staff.sucursalId || userSession?.sucursalId || (sucursales[0]?.id || "pachuca"),
      sucursalNombre: staff.sucursalNombre || userSession?.sucursalNombre || (sucursales[0]?.nombre || "Cuidarte Pachuca"),
    });
    setIsFormOpen(true);
  };

  // Quick 1-click Toggle for Membresía Cuidarte Pachuca (Activar / Desactivar)
  const handleToggleMembresia = (staff: StaffMember) => {
    const isActiva = staff.membresiaActiva !== false &&
      (staff.membresiaEstatus === "Activa" || !staff.membresiaEstatus);
    const newActiva = !isActiva;
    const newEstatus: MembresiaEstatus = newActiva ? "Activa" : "Inactiva";
    const staffName = `${staff.nombre || ""} ${staff.apellidos || ""}`.trim();

    const updatedStaff: StaffMember = {
      ...staff,
      membresiaActiva: newActiva,
      membresiaEstatus: newEstatus,
      ofertasGuardiasHabilitadas: newActiva,
      timestamp: getCurrentTimestamp(),
    };

    onSaveStaffMember(updatedStaff);
  };

  // Toggle global access block
  const handleToggleAccess = (staff: StaffMember) => {
    const isCurrentlyBlocked = !!staff.bloquearAccesoReceptores;
    const newBlockedState = !isCurrentlyBlocked;

    let motivo = staff.motivoBloqueoAcceso || "";
    if (newBlockedState) {
      const input = prompt(
        `¿Desea ingresar un motivo para bloquear el acceso total a datos de clientes a ${staff.nombre} ${staff.apellidos}? (Opcional):`
      );
      if (input === null) return; // User cancelled prompt
      motivo = input || "Restricción administrativa de acceso a datos de pacientes";
    }

    const updatedStaff: StaffMember = {
      ...staff,
      bloquearAccesoReceptores: newBlockedState,
      motivoBloqueoAcceso: newBlockedState ? motivo : undefined,
      fechaBloqueoAcceso: newBlockedState ? getCurrentTimestamp() : undefined,
    };

    if (selectedStaffForAccessModal?.id === staff.id) {
      setSelectedStaffForAccessModal(updatedStaff);
    }

    onSaveStaffMember(updatedStaff);
  };

  // Granular Receptor Access Toggle
  const handleToggleReceptorAccess = (staff: StaffMember, clientId: string) => {
    const normalizedClientId = (clientId || "").toUpperCase();
    const currentRevoked = staff.receptoresRevocadosIds || [];
    const isRevoked = currentRevoked.some((id) => (id || "").toUpperCase() === normalizedClientId);

    let nextRevoked: string[];
    if (isRevoked) {
      // Re-enable access
      nextRevoked = currentRevoked.filter((id) => (id || "").toUpperCase() !== normalizedClientId);
    } else {
      // Revoke access
      nextRevoked = [...currentRevoked, clientId];
    }

    const updatedStaff: StaffMember = {
      ...staff,
      receptoresRevocadosIds: nextRevoked,
      fechaBloqueoAcceso: getCurrentTimestamp(),
    };

    if (selectedStaffForAccessModal?.id === staff.id) {
      setSelectedStaffForAccessModal(updatedStaff);
    }

    onSaveStaffMember(updatedStaff);
  };

  const handleRevokeAllReceptors = (staff: StaffMember) => {
    const allClientIds = clients.map((c) => c.id).filter(Boolean);
    const updatedStaff: StaffMember = {
      ...staff,
      receptoresRevocadosIds: allClientIds,
      fechaBloqueoAcceso: getCurrentTimestamp(),
    };
    if (selectedStaffForAccessModal?.id === staff.id) {
      setSelectedStaffForAccessModal(updatedStaff);
    }
    onSaveStaffMember(updatedStaff);
  };

  const handleAllowAllReceptors = (staff: StaffMember) => {
    const updatedStaff: StaffMember = {
      ...staff,
      bloquearAccesoReceptores: false,
      receptoresRevocadosIds: [],
      fechaBloqueoAcceso: getCurrentTimestamp(),
    };
    if (selectedStaffForAccessModal?.id === staff.id) {
      setSelectedStaffForAccessModal(updatedStaff);
    }
    onSaveStaffMember(updatedStaff);
  };

  const handleCropComplete = (croppedBase64: string) => {
    setFormState((prev) => ({ ...prev, fotoUrl: croppedBase64 }));
    setIsCropperOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.nombre?.trim() || !formState.apellidos?.trim()) {
      alert("Por favor ingrese el nombre y apellidos.");
      return;
    }

    const noSocioToUse = formState.noSocio?.trim() || Date.now().toString().slice(-5);
    const targetId = formState.id || `SOC-${noSocioToUse}`;

    // Duplicate check for staff folio and id
    const existsDuplicate = staffMembers.some(
      (s) =>
        (s.id?.toLowerCase() === targetId.toLowerCase() ||
         s.noSocio?.trim().toLowerCase() === noSocioToUse.toLowerCase()) &&
        s.id !== formState.id
    );
    if (existsDuplicate) {
      alert(`⚠️ El número de socio / folio "${noSocioToUse}" ya pertenece a otro registro de personal en el sistema.`);
      return;
    }

    const isSocio = formState.tipoPersonalClasificacion === "socio" || formState.tipoContrato === "Socio Operativo";
    const selectedTipoCredencial = formState.tipoCredencial || "atencion";
    const isStaffAdmin = selectedTipoCredencial === "administrativo";

    const memberToSave: StaffMember = {
      id: targetId,
      noSocio: noSocioToUse,
      nombre: formState.nombre.trim().toUpperCase(),
      apellidos: formState.apellidos.trim().toUpperCase(),
      gradoTitulo: (formState.gradoTitulo || "LICENCIADO EN ENFERMERÍA").trim().toUpperCase(),
      puestoTipoPersonal: formState.puestoTipoPersonal || "Lic. en Enfermería",
      tipoCredencial: selectedTipoCredencial,
      isAdministrativo: isStaffAdmin,
      tipoPersonalClasificacion: isSocio ? "socio" : "empleado",
      areaAdscripcion: (
        formState.areaAdscripcion || "DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO"
      ).trim().toUpperCase(),
      fotoUrl: formState.fotoUrl || "",
      folioUrgencias: formState.folioUrgencias || `01${noSocioToUse}`,
      fechaExpiracion: formState.fechaExpiracion || "21/08/2030",
      badgePrincipal:
        formState.badgePrincipal ||
        (isStaffAdmin ? "PERSONAL ADMINISTRATIVO" : "PERSONAL DE ATENCIÓN A URGENCIAS"),
      badgesSecundarios: formState.badgesSecundarios || ["DIR GRAL NAL", "R HGO PS"],
      telefono: formState.telefono?.trim() || "",
      correo: formState.correo?.trim() || "",
      tipoContrato: isSocio ? "Socio Operativo" : "Empleado Contratado",
      esSocioOperativo: formState.esSocioOperativo !== undefined ? !!formState.esSocioOperativo : isSocio,
      estatus: formState.estatus || "Activo",
      notas: formState.notas?.trim() || "",
      documentos: formState.documentos || [],
      // Membresía Cuidarte Pachuca (Socios)
      membresiaActiva: isSocio ? (formState.membresiaEstatus === "Activa" || !!formState.membresiaActiva) : false,
      membresiaEstatus: isSocio ? (formState.membresiaEstatus || (formState.membresiaActiva !== false ? "Activa" : "Inactiva")) : "Inactiva",
      membresiaCostoPorServicio: isSocio ? (Number(formState.membresiaCostoPorServicio) || 50) : 0,
      membresiaFolio: isSocio ? (formState.membresiaFolio?.trim() || `MEMB-CP-${noSocioToUse}`) : undefined,
      membresiaFechaInicio: isSocio ? (formState.membresiaFechaInicio || new Date().toLocaleDateString("es-MX")) : undefined,
      membresiaNotas: isSocio ? formState.membresiaNotas?.trim() : undefined,
      ofertasGuardiasHabilitadas: isSocio ? (formState.ofertasGuardiasHabilitadas !== false) : false,
      // Datos Bancarios para Pagos
      banco: formState.banco?.trim() || "",
      cuentaBancaria: formState.cuentaBancaria?.trim() || "",
      clabeInterbancaria: formState.clabeInterbancaria?.trim() || "",
      titularCuenta: formState.titularCuenta?.trim().toUpperCase() || "",
      rfcFacturacion: formState.rfcFacturacion?.trim().toUpperCase() || "",
      tipoPagoPreferencia: formState.tipoPagoPreferencia || "Transferencia",
      bloquearAccesoReceptores: !!formState.bloquearAccesoReceptores,
      receptoresRevocadosIds: formState.receptoresRevocadosIds || [],
      motivoBloqueoAcceso: formState.bloquearAccesoReceptores ? (formState.motivoBloqueoAcceso || "Restricción administrativa") : undefined,
      fechaBloqueoAcceso: formState.bloquearAccesoReceptores ? (formState.fechaBloqueoAcceso || getCurrentTimestamp()) : undefined,
      timestamp: getCurrentTimestamp(),
    };

    onSaveStaffMember(memberToSave);
    setIsFormOpen(false);
  };

  // Helper for accent and case normalization
  const normalizeText = (str?: string) =>
    (str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  // Comprehensive matcher to correlate records with a staff member
  const isStaffMatchingRecord = (
    staff: StaffMember,
    recStaffId?: string,
    recNoSocio?: string,
    recNombre?: string,
    recUserId?: string
  ) => {
    if (!staff) return false;
    const staffId = (staff.id || "").trim().toLowerCase();
    const noSocio = (staff.noSocio || "").trim().toLowerCase();
    const firstName = (staff.nombre || "").trim().toLowerCase();
    const lastName = (staff.apellidos || "").trim().toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    const fullNameNorm = normalizeText(fullName);
    const firstNameNorm = normalizeText(firstName);
    const lastNameNorm = normalizeText(lastName);

    const digitsFromNoSocio = (noSocio || "").replace(/\D/g, "");
    const digitsFromStaffId = (staffId || "").replace(/\D/g, "");
    const cleanNoSocio = noSocio.replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");

    const rId = (recStaffId || "").trim().toLowerCase();
    const rNo = (recNoSocio || "").trim().toLowerCase().replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");
    const rNom = (recNombre || "").trim().toLowerCase();
    const rNomNorm = normalizeText(recNombre);
    const rUser = (recUserId || "").trim().toLowerCase();
    const rDigits = `${rId} ${rNo} ${rUser}`.replace(/\D/g, "");

    if (staffId && (rId === staffId || rUser === staffId || rId.includes(staffId) || staffId.includes(rId))) return true;
    if (cleanNoSocio && (rNo === cleanNoSocio || rId.includes(cleanNoSocio) || rUser.includes(cleanNoSocio))) return true;
    if (digitsFromNoSocio && digitsFromNoSocio.length >= 3 && (rDigits === digitsFromNoSocio || rDigits.includes(digitsFromNoSocio) || digitsFromNoSocio.includes(rDigits))) return true;
    if (digitsFromStaffId && digitsFromStaffId.length >= 3 && (rDigits === digitsFromStaffId || rDigits.includes(digitsFromStaffId) || digitsFromStaffId.includes(rDigits))) return true;
    if (fullNameNorm && rNomNorm && (rNomNorm.includes(fullNameNorm) || fullNameNorm.includes(rNomNorm))) return true;
    if (firstNameNorm && lastNameNorm && rNomNorm.includes(firstNameNorm) && rNomNorm.includes(lastNameNorm)) return true;
    if (firstNameNorm && firstNameNorm.length >= 3 && rNomNorm.includes(firstNameNorm)) return true;

    return false;
  };

  const handleTerminateStaffShift = async (staff: StaffMember) => {
    if (
      !window.confirm(
        `¿Confirmas que deseas terminar el turno activo en curso de ${staff.nombre} ${staff.apellidos}? Esta acción marcará su salida inmediatamente y sincronizará la base de datos.`
      )
    ) {
      return;
    }
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const nowFormatted = now.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const nowTimeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs";

      // 1. Immediately update any active guardia in memory/state
      const activeGuardias = (guardiaRecords || []).filter(
        (g) => g.estatus === "En Curso" && isStaffMatchingRecord(staff, g.staffId, g.staffNoSocio, g.staffNombre, (g as any).userId)
      );
      for (const g of activeGuardias) {
        const startObj = g.fechaInicioIso ? new Date(g.fechaInicioIso) : null;
        const durMinutes = startObj ? Math.max(1, Math.round((now.getTime() - startObj.getTime()) / (1000 * 60))) : undefined;
        const updatedG: GuardiaShiftRecord = {
          ...g,
          estatus: "Finalizada",
          fechaFinIso: nowIso,
          fechaFinFormateada: nowFormatted,
          horaFin: nowTimeStr,
          duracionMinutos: durMinutes,
          notasFin: "Turno cerrado por Administración Cuidarte",
          novedadesEntrega: (g.novedadesEntrega ? g.novedadesEntrega + " | " : "") + "Turno finalizado por Administración",
        };
        if (onSaveGuardia) {
          await onSaveGuardia(updatedG);
        }
      }

      // 2. Immediately update any open calendar event in memory/state
      const activeEvents = (calendarEvents || []).filter(
        (ev) => (ev.turnoAbierto || ev.estado === "En Proceso") && isStaffMatchingRecord(staff, ev.staffId, (ev as any).staffNoSocio, ev.personalAsignado)
      );
      for (const ev of activeEvents) {
        const updatedEv: CalendarEvent = {
          ...ev,
          turnoAbierto: false,
          turnoFinalizado: true,
          estado: "Completado",
          horaSalidaReal: nowTimeStr,
          notasFin: "Turno cerrado por Administración",
        };
        if (onSaveCalendarEvent) {
          await onSaveCalendarEvent(updatedEv);
        }
      }

      // 3. Update Firestore directly
      const res = await terminateStaffActiveShiftInFirestore(staff, "Administración Cuidarte");
      if (res.success || activeGuardias.length > 0 || activeEvents.length > 0) {
        alert(`✓ Turno de ${staff.nombre} ${staff.apellidos} finalizado exitosamente.`);
      } else {
        alert(res.message || "No se encontró un turno activo pendiente para este colaborador.");
      }
    } catch (err: any) {
      console.error("Error al terminar turno:", err);
      alert(`Error al terminar turno: ${err?.message || "Error desconocido"}`);
    }
  };

  const handleTerminateDirectGuardia = async (guardia: GuardiaShiftRecord) => {
    if (
      !window.confirm(
        `¿Confirmas que deseas forzar la finalización de esta guardia de ${guardia.staffNombre || "Personal"} (${guardia.clientNombre || "Servicio"})?`
      )
    ) {
      return;
    }
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const nowFormatted = now.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const nowTimeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs";
      const startObj = guardia.fechaInicioIso ? new Date(guardia.fechaInicioIso) : null;
      const durMinutes = startObj ? Math.max(1, Math.round((now.getTime() - startObj.getTime()) / (1000 * 60))) : undefined;

      const updatedG: GuardiaShiftRecord = {
        ...guardia,
        estatus: "Finalizada",
        fechaFinIso: nowIso,
        fechaFinFormateada: nowFormatted,
        horaFin: nowTimeStr,
        duracionMinutos: durMinutes,
        notasFin: "Turno finalizado administrativamente",
        novedadesEntrega: (guardia.novedadesEntrega ? guardia.novedadesEntrega + " | " : "") + "Turno finalizado por Administración",
      };

      if (onSaveGuardia) {
        await onSaveGuardia(updatedG);
      }

      const res = await terminateGuardiaShiftByIdInFirestore(guardia.id, "Administración Cuidarte");
      if (res.success) {
        alert("✓ Guardia finalizada con éxito.");
      } else {
        alert(res.message || "Guardia finalizada localmente.");
      }
    } catch (err: any) {
      console.error("Error al terminar guardia directa:", err);
      alert(`Error: ${err?.message || "Error desconocido"}`);
    }
  };

  const handleRevokeStaffSession = async (staff: StaffMember) => {
    if (
      !window.confirm(
        `¿Confirmas que deseas forzar el cierre de sesión de ${staff.nombre} ${staff.apellidos}? El usuario será desconectado inmediatamente en sus dispositivos.`
      )
    ) {
      return;
    }
    try {
      const res = await revokeUserSessionInFirestore(staff.id, staff.noSocio);
      // Also update local state for staff if onSaveStaffMember is available
      if (onSaveStaffMember) {
        onSaveStaffMember({
          ...staff,
          sesionActiva: false,
          isOnline: false,
          ultimaConexion: `Sesión cerrada por admin (${new Date().toLocaleTimeString("es-MX")})`,
        });
      }
      if (res.success) {
        alert(`✓ Sesión de ${staff.nombre} ${staff.apellidos} revocada y cerrada remotamente.`);
      } else {
        alert(res.message || "No se pudo revocar la sesión.");
      }
    } catch (err: any) {
      console.error("Error al revocar sesión:", err);
      alert(`Error al revocar sesión: ${err?.message || "Error desconocido"}`);
    }
  };

  const handleDelete = (staff: StaffMember) => {
    setStaffToDelete(staff);
  };

  const handleConfirmDeleteStaff = () => {
    if (staffToDelete) {
      onDeleteStaffMember(staffToDelete.id);
      setStaffToDelete(null);
    }
  };

  // Filter staff list
  const filteredStaff = staffMembers.filter((s) => {
    const fullName = `${s.nombre} ${s.apellidos} ${s.noSocio} ${s.puestoTipoPersonal}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "ALL" || s.puestoTipoPersonal === typeFilter;

    const isEmp = s.tipoContrato?.toLowerCase().includes("empleado");
    const hasActiveShift = (guardiaRecords || []).some(
      (g) =>
        g.estatus === "En Curso" &&
        isStaffMatchingRecord(s, g.staffId, g.staffNoSocio, g.staffNombre, (g as any).userId)
    );

    const matchingUser = (systemUsers || []).find((u) => isStaffMatchingRecord(s, u.id, u.nurseId, u.nombre, u.ux));
    const isOnlineNow = Boolean(
      s.sesionActiva ||
      s.isOnline ||
      (s.ultimaConexionTimestamp && Date.now() - s.ultimaConexionTimestamp < 3 * 60 * 1000) ||
      (matchingUser && (matchingUser.isOnline || (matchingUser.ultimaConexionTimestamp && Date.now() - matchingUser.ultimaConexionTimestamp < 3 * 60 * 1000)))
    );

    const isMembActiva = !isEmp && (s.membresiaActiva !== false && (s.membresiaEstatus === "Activa" || !s.membresiaEstatus));
    const isMembInactiva = !isEmp && !isMembActiva;

    const matchesVinc =
      vincFilter === "ALL" ||
      (vincFilter === "MEMB_ACTIVA" && isMembActiva) ||
      (vincFilter === "MEMB_INACTIVA" && isMembInactiva) ||
      (vincFilter === "SOCIO" && !isEmp) ||
      (vincFilter === "EMPLEADO" && isEmp) ||
      ((vincFilter === "OPERATIVOS_URGENCIAS" || vincFilter === "OPERATIVOS_EMERGENCIAS") && !!s.esSocioOperativo) ||
      (vincFilter === "SESION_ACTIVA" && isOnlineNow) ||
      (vincFilter === "TURNO_ACTIVO" && hasActiveShift);

    return matchesSearch && matchesType && matchesVinc;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            ADMINISTRACIÓN DE PERSONAL Y CREDENCIALES OFICIALES
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Directorio de Socios Operativos y Empleados Cuidarte
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Registro de perfiles, membresías de socios, fotografía oficial con ajuste/recorte y emisión de Credenciales Digitales e Impresas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsVerifierOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Portal de Verificación Oficial</span>
          </button>

          <button
            onClick={handleOpenNew}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nuevo Socio / Empleado</span>
          </button>
        </div>
      </div>

      {/* SubTab Switcher Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab("directorio")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === "directorio"
              ? "bg-sky-600 text-white shadow-md shadow-sky-950/40"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4 text-sky-300" />
          <span>Directorio y Credenciales ({staffMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("checadas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === "checadas"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40 font-black"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-300" />
          <span>Control de Entradas y Salidas ({guardiaRecords.length})</span>
          {guardiaRecords.some((g) => g.estatus === "En Curso") && (
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>
      </div>

      {activeSubTab === "directorio" ? (
        <>
          {/* Filter and Search Bar for Staff Directory */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, no. id, puesto..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={vincFilter}
                  onChange={(e) => setVincFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">Todos los Vínculos y Estatus</option>
                  <option value="MEMB_ACTIVA">⭐ Socios con Membresía Activa</option>
                  <option value="MEMB_INACTIVA">⚠️ Socios con Membresía Inactiva / Pausada</option>
                  <option value="SOCIO">Solo Socios Cuidarte</option>
                  <option value="EMPLEADO">Solo Empleados Contratados</option>
                  <option value="OPERATIVOS_URGENCIAS">🚨 Solo Socios Operativos (Urgencias)</option>
                  <option value="SESION_ACTIVA">🟢 Solo con Sesión Activa (En Línea)</option>
                  <option value="TURNO_ACTIVO">⚡ Solo con Turno en Curso</option>
                </select>
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">Todas las Especialidades</option>
                {PERSONAL_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        /* CHECADAS BITÁCORA VIEW FOR ADMIN */
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Checadas Registradas</span>
              <div className="text-2xl font-black text-white mt-1 font-mono">{guardiaRecords.length}</div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-emerald-800/80 bg-emerald-950/20">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Servicios en Curso (Activos)</span>
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                {guardiaRecords.filter((g) => g.estatus === "En Curso").length}
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Servicios Concluidos</span>
              <div className="text-2xl font-black text-sky-400 mt-1 font-mono">
                {guardiaRecords.filter((g) => g.estatus === "Finalizada").length}
              </div>
            </div>
          </div>

          {/* Filter Bar for Checadas */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por personal, cliente o folio..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={shiftEstatusFilter}
                onChange={(e) => setShiftEstatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todos los Estatus</option>
                <option value="En Curso">Solo En Curso (Activos)</option>
                <option value="Finalizada">Solo Finalizados</option>
              </select>
            </div>
          </div>

          {/* Checadas List / Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Bitácora de Entradas y Salidas de Servicios</span>
              </h3>
            </div>

            {guardiaRecords.length === 0 ? (
              <p className="p-10 text-center text-xs text-slate-500">No hay registros de entradas y salidas de personal aún.</p>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {(guardiaRecords || [])
                  .filter((g) => {
                    const st = searchTerm.toLowerCase();
                    const matchesSearch =
                      !st ||
                      (g.staffNombre || "").toLowerCase().includes(st) ||
                      (g.clientNombre || "").toLowerCase().includes(st) ||
                      (g.caratulaFolio && g.caratulaFolio.toLowerCase().includes(st));
                    const matchesEstatus =
                      shiftEstatusFilter === "ALL" || g.estatus === shiftEstatusFilter;
                    return matchesSearch && matchesEstatus;
                  })
                  .map((g) => (
                    <div key={g.id} className="p-4 hover:bg-slate-800/50 transition-colors space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            g.estatus === "En Curso"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-500/50 animate-pulse"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}>
                            {g.estatus === "En Curso" ? "⚡ Servicio En Curso (Entrada)" : "✓ Servicio Finalizado (Salida)"}
                          </span>
                          {g.caratulaFolio && (
                            <span className="font-mono text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                              Folio: {g.caratulaFolio}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-slate-400">
                          ID: {g.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">PERSONAL / SOCIO</span>
                          <span className="font-bold text-white block">{g.staffNombre}</span>
                          <span className="text-[10px] font-mono text-slate-400">{g.staffId}</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">CLIENTE / PACIENTE</span>
                          <span className="font-bold text-sky-300 block">{g.clientNombre}</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">ENTRADA (INICIO)</span>
                          <span className="font-mono font-bold text-emerald-400 block">{g.fechaInicioFormateada}</span>
                          {g.notasInicio && (
                            <span className="text-[10px] text-slate-400 block italic mt-0.5">"{g.notasInicio}"</span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">SALIDA (CIERRE)</span>
                          {g.fechaFinFormateada ? (
                            <>
                              <span className="font-mono font-bold text-slate-200 block">{g.fechaFinFormateada}</span>
                              {g.duracionMinutos && (
                                <span className="text-[10px] text-sky-400 font-mono font-bold block mt-0.5">
                                  Duración: {Math.floor(g.duracionMinutos / 60)}h {g.duracionMinutos % 60}m
                                </span>
                              )}
                              {g.novedadesEntrega && (
                                <span className="text-[10px] text-amber-300 block italic mt-0.5">Novedades: "{g.novedadesEntrega}"</span>
                              )}
                            </>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-amber-400 font-bold block italic animate-pulse text-[11px]">
                                Pendiente de marcar salida (Turno activo)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleTerminateDirectGuardia(g)}
                                className="px-2 py-1 rounded-md text-[10px] font-black bg-amber-600/30 hover:bg-amber-600/60 text-amber-200 border border-amber-500/80 flex items-center gap-1 transition"
                                title="Forzar finalización de este turno y registrar salida inmediatamente"
                              >
                                <PowerOff className="w-3 h-3 text-amber-400" />
                                <span>Forzar Cierre de Turno</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.length === 0 ? (
          <div className="col-span-full bg-slate-900/50 border border-slate-800 p-12 text-center rounded-2xl text-slate-400 space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-600" />
            <p className="text-sm font-bold">No se encontraron registros de personal</p>
            <p className="text-xs text-slate-500">Haga clic en "Registrar Nuevo Socio / Empleado" para agregar integrantes.</p>
          </div>
        ) : (
          filteredStaff.map((staff) => {
            const isEmp = staff.tipoContrato?.toLowerCase().includes("empleado");
            const assignedClients = getAssignedClientsForStaff(staff);
            const isVentasStaff =
              (staff.puestoTipoPersonal || "").toLowerCase().includes("ventas") ||
              (staff.gradoTitulo || "").toLowerCase().includes("ventas") ||
              (staff.badgePrincipal || "").toLowerCase().includes("ventas");
            const isAtencionStaff =
              (staff.puestoTipoPersonal || "").toLowerCase().includes("atenci") ||
              (staff.gradoTitulo || "").toLowerCase().includes("atenci") ||
              (staff.badgePrincipal || "").toLowerCase().includes("atenci");

            const hasActiveShift =
              (guardiaRecords || []).some(
                (g) =>
                  g.estatus === "En Curso" &&
                  isStaffMatchingRecord(staff, g.staffId, g.staffNoSocio, g.staffNombre, (g as any).userId)
              ) ||
              (calendarEvents || []).some(
                (ev) =>
                  (ev.turnoAbierto || ev.estado === "En Proceso") &&
                  !ev.turnoFinalizado &&
                  isStaffMatchingRecord(staff, ev.staffId, (ev as any).staffNoSocio, ev.personalAsignado)
              );

            const matchingUser = (systemUsers || []).find(
              (u) =>
                isStaffMatchingRecord(staff, u.id, u.nurseId, u.nombre, u.ux) ||
                Boolean(u.nurseId && staff.noSocio && u.nurseId.replace(/\D/g, "") === staff.noSocio.replace(/\D/g, "")) ||
                Boolean(u.ux && staff.noSocio && u.ux.replace(/\D/g, "") === staff.noSocio.replace(/\D/g, ""))
            );

            const isSessionOnline = Boolean(
              staff.sesionActiva ||
              staff.isOnline ||
              (staff.ultimaConexionTimestamp && Date.now() - staff.ultimaConexionTimestamp < 3 * 60 * 1000) ||
              (matchingUser && (matchingUser.isOnline || (matchingUser.ultimaConexionTimestamp && Date.now() - matchingUser.ultimaConexionTimestamp < 3 * 60 * 1000)))
            );

            return (
              <div
                key={staff.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition shadow-sm space-y-4"
              >
                <div className="flex items-start gap-3">
                  {/* Photo Thumbnail - HIDE IF BAJA, BLUR IF INACTIVO */}
                  <div className="w-16 h-20 bg-slate-950 rounded-xl border border-slate-700 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {staff.estatus === "Baja" ? (
                      <div className="w-full h-full bg-rose-950/80 flex flex-col items-center justify-center p-1 text-center border border-rose-600/40">
                        <X className="w-6 h-6 text-rose-400 mb-0.5" />
                        <span className="text-[7px] font-black text-rose-200 uppercase leading-none">BAJA</span>
                      </div>
                    ) : staff.fotoUrl ? (
                      <img
                        src={staff.fotoUrl}
                        alt={staff.nombre}
                        className={`w-full h-full object-cover ${staff.estatus === "Inactivo" ? "filter blur-sm opacity-50 select-none" : ""}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
                        {isEmp ? `EMP-${staff.noSocio}` : `SOCP-${staff.noSocio}`}
                      </span>
                      <div className="flex items-center gap-1">
                        {isSessionOnline ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/60 flex items-center gap-1" title="El usuario tiene una sesión abierta y activa">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>En Línea</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 border border-slate-800 flex items-center gap-1" title="Sin sesión activa en este momento">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-600"></span>
                            <span>Desconectado</span>
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            staff.estatus === "Activo"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {staff.estatus}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-white leading-snug truncate">
                      {staff.nombre} {staff.apellidos}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1">
                      <span className="bg-slate-800 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-700">
                        {staff.puestoTipoPersonal}
                      </span>
                      {staff.esSocioOperativo ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-rose-950 text-rose-300 border-rose-600 flex items-center gap-1 shadow-xs">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                          <span>Socio Operativo (Urgencias)</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            isEmp
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {isEmp ? "Empleado" : "Socio"}
                        </span>
                      )}

                      {/* Modalidad de Credencial Oficial Badge */}
                      {staff.tipoCredencial === "ambos" ? (
                        <span
                          className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/50 flex items-center gap-1 shadow-xs"
                          title="Acreditado con doble perfil oficial: Atención y Corporativo"
                        >
                          <Layers className="w-2.5 h-2.5 text-purple-400" />
                          <span>Doble Perfil (Dual)</span>
                        </span>
                      ) : staff.tipoCredencial === "administrativo" || staff.isAdministrativo ? (
                        <span
                          className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-500/50 flex items-center gap-1 shadow-xs"
                          title="Perfil acreditado: Corporativo / Administrativo"
                        >
                          <Briefcase className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Perfil Corporativo</span>
                        </span>
                      ) : (
                        <span
                          className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-300 border border-sky-500/50 flex items-center gap-1 shadow-xs"
                          title="Perfil acreditado: Atención Operativa y Urgencias"
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />
                          <span>Perfil Atención</span>
                        </span>
                      )}

                      {hasActiveShift && (
                        <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/60 flex items-center gap-1 shadow-xs">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          <span>⚡ Turno Activo</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 truncate mt-1">
                      {staff.gradoTitulo}
                    </p>

                    {/* Access, Contract & Assigned Clients Badges */}
                    <div className="pt-2 flex flex-wrap items-center gap-1.5">
                      {/* Assigned Clients Badge */}
                      <span
                        className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 cursor-pointer transition ${
                          assignedClients.length > 0
                            ? "bg-indigo-950/90 text-indigo-300 border-indigo-600/60 hover:bg-indigo-900"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                        onClick={() => {
                          setSelectedStaffForClientAssignment(staff);
                          setAssignmentSearch("");
                          setAssignmentFilterTab("ALL");
                          setAssignmentRoleTarget(
                            isVentasStaff ? "ventas" : isAtencionStaff ? "atencion" : "ambos"
                          );
                        }}
                        title="Clic para gestionar la cartera de clientes asignados"
                      >
                        <Users className="w-2.5 h-2.5 text-indigo-400" />
                        <span>{assignedClients.length} Cliente(s) Asignado(s)</span>
                      </span>

                      {/* Access Status Badge */}
                      {staff.bloquearAccesoReceptores ? (
                        <span
                          className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-600/50 flex items-center gap-1"
                          title={`Acceso a datos de todos los pacientes revocado${staff.motivoBloqueoAcceso ? `: ${staff.motivoBloqueoAcceso}` : ""}`}
                        >
                          <Lock className="w-2.5 h-2.5 text-rose-400" />
                          <span>Acceso Total Revocado</span>
                        </span>
                      ) : (staff.receptoresRevocadosIds && staff.receptoresRevocadosIds.length > 0) ? (
                        <span
                          className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/50 flex items-center gap-1"
                          title={`${staff.receptoresRevocadosIds.length} receptor(es) con acceso revocado para este colaborador`}
                        >
                          <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                          <span>{staff.receptoresRevocadosIds.length} Receptor(es) Revocado(s)</span>
                        </span>
                      ) : (
                        <span
                          className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/40 flex items-center gap-1"
                          title="Tiene acceso a ver información de todos los pacientes/receptores asignados"
                        >
                          <Unlock className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Acceso a Pacientes Activo</span>
                        </span>
                      )}

                      {/* Contract Badge */}
                      {staff.documentos?.some((d) => d.tipo === "Contrato") ? (
                        <span
                          className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-300 border border-sky-600/40 flex items-center gap-1"
                          title="Contrato de prestación de servicios / laboral cargado"
                        >
                          <FileSignature className="w-2.5 h-2.5 text-sky-400" />
                          <span>Contrato Subido</span>
                        </span>
                      ) : (
                        <span
                          className="text-[9.5px] font-medium px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-400 border border-amber-600/30 flex items-center gap-1"
                          title="Sin contrato digital cargado por administración"
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          <span>Sin Contrato</span>
                        </span>
                      )}
                    </div>

                    {/* MEMBRESÍA CUIDARTE PACHUCA PARA SOCIOS */}
                    {!isEmp ? (
                      <div className="mt-2 p-2.5 rounded-xl border transition-all text-[11px] space-y-1.5 bg-slate-950/90 border-slate-800">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-extrabold text-white text-[11px]">
                              Membresía Cuidarte Pachuca
                            </span>
                          </div>
                          {staff.membresiaActiva !== false && (staff.membresiaEstatus === "Activa" || !staff.membresiaEstatus) ? (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              <span>Activa</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/50 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5 text-rose-400" />
                              <span>{staff.membresiaEstatus || "Inactiva"}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-300 flex flex-wrap items-center justify-between gap-1">
                          <span className="text-slate-400">
                            Cuota: <strong className="text-amber-300 font-mono font-bold">${staff.membresiaCostoPorServicio ?? 50} MXN</strong> / servicio
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-400">
                            Folio de Socio: <strong className="text-sky-300">No. {staff.noSocio}</strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                          <span className="text-[9.5px] text-slate-400">
                            {staff.ofertasGuardiasHabilitadas !== false ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                                Ofertas de guardias habilitadas
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                                Ofertas pausadas
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleMembresia(staff)}
                            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border transition ${
                              staff.membresiaActiva !== false && (staff.membresiaEstatus === "Activa" || !staff.membresiaEstatus)
                                ? "bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-600/50"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm"
                            }`}
                            title="Alternar activación de la membresía del socio"
                          >
                            {staff.membresiaActiva !== false && (staff.membresiaEstatus === "Activa" || !staff.membresiaEstatus)
                              ? "Pausar"
                              : "Activar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                          <Briefcase className="w-3 h-3 text-emerald-400" />
                          <span>Personal Empleado en Nómina</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">Sin cuota de membresía</span>
                      </div>
                    )}

                    {/* Bank Details Strip */}
                    <div className="mt-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between gap-1 text-slate-300">
                        <div className="flex items-center gap-1 font-bold text-sky-400">
                          <Building2 className="w-3 h-3" />
                          <span>{staff.banco || "Banco no registrado"}</span>
                        </div>
                        {staff.clabeInterbancaria && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(staff.clabeInterbancaria || "");
                              alert(`CLABE copiada: ${staff.clabeInterbancaria}`);
                            }}
                            className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 transition"
                            title="Copiar CLABE interbancaria"
                          >
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copiar CLABE</span>
                          </button>
                        )}
                      </div>
                      {staff.clabeInterbancaria ? (
                        <div className="font-mono text-slate-300 text-[10px] tracking-wider mt-0.5 truncate">
                          CLABE: <span className="text-emerald-400 font-bold">{staff.clabeInterbancaria}</span>
                        </div>
                      ) : staff.cuentaBancaria ? (
                        <div className="font-mono text-slate-300 text-[10px] mt-0.5 truncate">
                          Cta: <span className="text-emerald-400 font-bold">{staff.cuentaBancaria}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                          Sin cuenta bancaria capturada para dispersión
                        </div>
                      )}
                      {staff.titularCuenta && (
                        <div className="text-[9.5px] text-slate-400 truncate mt-0.5">
                          Titular: {staff.titularCuenta}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  {/* Remote Administrative Controls: Terminate Shift & Remote Logout */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400">
                      <span>Vigente: {staff.fechaExpiracion || "2030"}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Terminate Shift Button */}
                      <button
                        type="button"
                        onClick={() => handleTerminateStaffShift(staff)}
                        className={`px-2 py-1 rounded-lg text-[10.5px] font-black transition flex items-center gap-1 border shadow-xs ${
                          hasActiveShift
                            ? "bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border-amber-500 animate-pulse"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                        }`}
                        title="Terminar turno de servicio activo para este personal"
                      >
                        <PowerOff className="w-3 h-3 text-amber-400" />
                        <span>Terminar Turno</span>
                      </button>

                      {/* Remote Logout Button */}
                      <button
                        type="button"
                        onClick={() => handleRevokeStaffSession(staff)}
                        className={`px-2 py-1 rounded-lg text-[10.5px] font-black transition flex items-center gap-1 border shadow-xs ${
                          isSessionOnline
                            ? "bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border-rose-500"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                        }`}
                        title="Cerrar y revocar sesión activa en todos los dispositivos"
                      >
                        <LogOut className="w-3 h-3 text-rose-400" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-0.5">
                    {/* Granular Receptor Access Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStaffForAccessModal(staff);
                        setAccessModalSearch("");
                      }}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10.5px] font-black transition flex items-center gap-1.5 shadow-sm"
                      title="Gestionar revocación y permisos de acceso por receptor de servicio"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Accesos a Receptores</span>
                    </button>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* Asignar Clientes Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffForClientAssignment(staff);
                          setAssignmentSearch("");
                          setAssignmentFilterTab("ALL");
                          setAssignmentRoleTarget(
                            isVentasStaff ? "ventas" : isAtencionStaff ? "atencion" : "ambos"
                          );
                        }}
                        className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        title="Asignar y gestionar cartera de clientes para este colaborador"
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Asignar ({assignedClients.length})</span>
                      </button>

                      <button
                        onClick={() => setSelectedStaffForDocuments(staff)}
                        className="px-2 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        title="Expediente Digital y Contrato (Solo visible por Admin y Personal)"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Expediente ({staff.documentos?.length || 0})</span>
                      </button>

                      <button
                        onClick={() => setSelectedStaffForCredential(staff)}
                        className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        title="Ver / Imprimir Credencial"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Credencial</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(staff)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                        title="Editar Integrante y Permisos"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(staff)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                        title="Eliminar Integrante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Registration / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Users className="w-5 h-5" />
                <span>
                  {formState.id && staffMembers.some((s) => s.id === formState.id)
                    ? "Editar Datos de Personal / Socio"
                    : "Registrar Nuevo Integrante"}
                </span>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Photo Upload & Crop Button Trigger */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-28 bg-slate-900 rounded-xl border-2 border-slate-700 overflow-hidden flex items-center justify-center shrink-0 relative">
                  {formState.fotoUrl ? (
                    <img
                      src={formState.fotoUrl}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-500">
                      <Camera className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                      <span className="text-[10px]">Sin Foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-slate-300">
                  <label className="block font-bold text-slate-200">
                    Fotografía Oficial para Credencial:
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Utilice la herramienta de ajuste y recorte para encuadrar perfectamente la imagen al tamaño 3:4 de la credencial.
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => setIsCropperOpen(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl transition flex items-center gap-2 text-xs shadow-sm"
                  >
                    <Crop className="w-4 h-4" />
                    <span>{formState.fotoUrl ? "Ajustar / Cambiar Foto" : "Cargar y Recortar Foto"}</span>
                  </button>
                </div>
              </div>

              {/* VÍNCULO / TIPO DE INTEGRANTE (Socio vs Empleado Choice) */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-slate-200 font-extrabold text-xs">
                  Tipo de Vínculo de Integrante: *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormState({
                        ...formState,
                        tipoContrato: "Socio Operativo",
                        tipoPersonalClasificacion: "socio",
                        membresiaActiva: formState.membresiaActiva !== false,
                        membresiaEstatus: formState.membresiaEstatus || "Activa",
                        ofertasGuardiasHabilitadas: formState.ofertasGuardiasHabilitadas !== false,
                        membresiaCostoPorServicio: formState.membresiaCostoPorServicio ?? 50,
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      formState.tipoContrato === "Socio Operativo"
                        ? "bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/40"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <UserCheck className={`w-5 h-5 shrink-0 mt-0.5 ${formState.tipoContrato === "Socio Operativo" ? "text-amber-400" : "text-slate-500"}`} />
                    <div>
                      <span className="font-extrabold text-xs block text-amber-300">Socio Operativo</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Adquiere Membresía Cuidarte Pachuca</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormState({
                        ...formState,
                        tipoContrato: "Empleado Contratado",
                        tipoPersonalClasificacion: "empleado",
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      formState.tipoContrato === "Empleado Contratado"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-sm ring-1 ring-emerald-500/40"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Briefcase className={`w-5 h-5 shrink-0 mt-0.5 ${formState.tipoContrato === "Empleado Contratado" ? "text-emerald-400" : "text-slate-500"}`} />
                    <div>
                      <span className="font-extrabold text-xs block text-emerald-300">Empleado Contratado</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Personal en Nómina Cuidarte</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* APARTADO: MEMBRESÍA CUIDARTE PACHUCA ACTIVA (SOLO PARA SOCIOS) */}
              {formState.tipoContrato === "Socio Operativo" && (
                <div className="bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border border-amber-500/40 space-y-3.5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                          <span>Membresía Cuidarte Pachuca Activa</span>
                          <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.2 rounded-full border border-amber-500/30">
                            Socio Cuidarte
                          </span>
                        </h4>
                        <p className="text-[10.5px] text-slate-300">
                          La membresía institucional da acceso a asignaciones de guardias y turnos según su perfil profesional.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-300 cursor-pointer flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                        <span>Estatus:</span>
                        <select
                          value={formState.membresiaEstatus || (formState.membresiaActiva !== false ? "Activa" : "Inactiva")}
                          onChange={(e) => {
                            const val = e.target.value as MembresiaEstatus;
                            setFormState({
                              ...formState,
                              membresiaEstatus: val,
                              membresiaActiva: val === "Activa",
                            });
                          }}
                          className="bg-slate-950 border border-slate-700 rounded text-xs font-bold text-amber-300 px-2 py-0.5 focus:outline-none focus:border-amber-400"
                        >
                          <option value="Activa">🟢 Activa</option>
                          <option value="Inactiva">🔴 Inactiva (Pausada)</option>
                          <option value="Suspendida">⛔ Suspendida</option>
                          <option value="Pendiente de Pago">🟡 Pendiente de Pago</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* Campos de configuración de membresía */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 text-[11px]">
                        Costo de Cuota por Servicio Asignado ($ MXN): *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-500 font-bold text-xs">$</span>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={formState.membresiaCostoPorServicio ?? 50}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              membresiaCostoPorServicio: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="50"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <span className="text-[9.5px] text-slate-400 block mt-1">
                        Se cubre después de cada servicio asignado.
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1 text-[11px]">
                        Folio de Socio (Credencial Oficial):
                      </label>
                      <input
                        type="text"
                        value={formState.noSocio ? `No. ${formState.noSocio}` : (formState.membresiaFolio || "")}
                        readOnly
                        disabled
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-1.5 text-sky-300 font-mono font-bold text-xs cursor-not-allowed opacity-90"
                      />
                      <span className="text-[9.5px] text-slate-400 block mt-1">
                        Folio asignado directamente en su credencial oficial.
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1 text-[11px]">
                        Fecha de Adquisición / Activación:
                      </label>
                      <input
                        type="text"
                        value={formState.membresiaFechaInicio || new Date().toISOString().split("T")[0]}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            membresiaFechaInicio: e.target.value,
                          })
                        }
                        placeholder="YYYY-MM-DD"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[9.5px] text-slate-400 block mt-1">
                        Fecha en que inició su membresía activa.
                      </span>
                    </div>
                  </div>

                  {/* Toggle para Ofertas de Guardias según perfil */}
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formState.ofertasGuardiasHabilitadas !== false}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            ofertasGuardiasHabilitadas: e.target.checked,
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-amber-500 rounded bg-slate-950 border-amber-500 focus:ring-amber-400"
                      />
                      <div className="space-y-0.5">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Habilitar recepción de ofertas para cubrir guardias según perfil</span>
                        </span>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Al estar habilitado, el socio recibirá convocatorias y ofertas directas para cubrir turnos y guardias acorde a su especialidad (<strong>{formState.puestoTipoPersonal}</strong>).
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Notas u observaciones de membresía */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 text-[11px]">
                      Observaciones / Términos de Membresía:
                    </label>
                    <input
                      type="text"
                      value={formState.membresiaNotas || ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          membresiaNotas: e.target.value,
                        })
                      }
                      placeholder="Ej. Membresía al corriente. Cuota por servicio liquidada tras cada turno."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* TIPO / MODALIDAD DE CREDENCIAL */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-200 font-extrabold text-xs">
                    Modalidad de Credencial Oficial: *
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {formState.tipoCredencial === "ambos"
                      ? "Doble Perfil Habilitado"
                      : formState.tipoCredencial === "administrativo" || formState.isAdministrativo
                      ? "Credencial Corporativa"
                      : "Credencial de Atención Operativa"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Opción 1: Personal de Atención */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormState({
                        ...formState,
                        tipoCredencial: "atencion",
                        isAdministrativo: false,
                        badgePrincipal:
                          formState.badgePrincipal?.includes("ADMINISTRATIVO") || !formState.badgePrincipal
                            ? "PERSONAL DE ATENCIÓN A URGENCIAS"
                            : formState.badgePrincipal,
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      formState.tipoCredencial === "atencion" ||
                      (!formState.tipoCredencial && !formState.isAdministrativo)
                        ? "bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm ring-1 ring-sky-500/40"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={`w-4 h-4 shrink-0 ${
                          formState.tipoCredencial === "atencion" ||
                          (!formState.tipoCredencial && !formState.isAdministrativo)
                            ? "text-sky-400"
                            : "text-slate-500"
                        }`}
                      />
                      <span className="font-extrabold text-xs text-sky-300">
                        Atención Operativa
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Credencial clínica y de urgencias con folio y leyenda vial/sanitaria.
                    </span>
                  </button>

                  {/* Opción 2: Administrativo / Corporativo */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormState({
                        ...formState,
                        tipoCredencial: "administrativo",
                        isAdministrativo: true,
                        badgePrincipal:
                          !formState.badgePrincipal ||
                          formState.badgePrincipal === "PERSONAL DE ATENCIÓN A URGENCIAS"
                            ? "PERSONAL ADMINISTRATIVO"
                            : formState.badgePrincipal,
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      formState.tipoCredencial === "administrativo" ||
                      (formState.tipoCredencial !== "atencion" &&
                        formState.tipoCredencial !== "ambos" &&
                        formState.isAdministrativo)
                        ? "bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-sm ring-1 ring-indigo-500/40"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase
                        className={`w-4 h-4 shrink-0 ${
                          formState.tipoCredencial === "administrativo" ||
                          (formState.tipoCredencial !== "atencion" &&
                            formState.tipoCredencial !== "ambos" &&
                            formState.isAdministrativo)
                            ? "text-indigo-400"
                            : "text-slate-500"
                        }`}
                      />
                      <span className="font-extrabold text-xs text-indigo-300">
                        Corporativo / Admin
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Credencial corporativa institucional para ventas, atención a clientes y oficina.
                    </span>
                  </button>

                  {/* Opción 3: Ambos Perfiles (Dual) */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormState({
                        ...formState,
                        tipoCredencial: "ambos",
                        isAdministrativo: false,
                        badgePrincipal:
                          formState.badgePrincipal || "PERSONAL DE ATENCIÓN A URGENCIAS",
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      formState.tipoCredencial === "ambos"
                        ? "bg-purple-950/70 border-purple-500 text-purple-200 shadow-sm ring-1 ring-purple-500/40"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers
                        className={`w-4 h-4 shrink-0 ${
                          formState.tipoCredencial === "ambos"
                            ? "text-purple-400"
                            : "text-slate-500"
                        }`}
                      />
                      <span className="font-extrabold text-xs text-purple-300">
                        Ambos Perfiles (Dual)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Acredita ambos perfiles para que el colaborador pueda alternar ambas credenciales en su portal.
                    </span>
                  </button>
                </div>
              </div>

              {/* Basic Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    No. de Identificador / Folio: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.noSocio || ""}
                    onChange={(e) => setFormState({ ...formState, noSocio: e.target.value })}
                    placeholder="Ej. 25001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    Sucursal Asignada: *
                  </label>
                  <select
                    value={formState.sucursalId || ""}
                    onChange={(e) => {
                      const branchId = e.target.value;
                      const branchObj = sucursales.find((s) => s.id === branchId);
                      setFormState({
                        ...formState,
                        sucursalId: branchId,
                        sucursalNombre: branchObj?.nombre || "Cuidarte Pachuca",
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:border-sky-500"
                  >
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.codigo || s.ciudad})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">
                    Especialidad / Clasificación: *
                  </label>
                  <select
                    value={formState.puestoTipoPersonal || "Lic. en Enfermería"}
                    onChange={(e) => handlePuestoChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:border-sky-500"
                  >
                    {PERSONAL_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    Nombre(s): *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.nombre || ""}
                    onChange={(e) => setFormState({ ...formState, nombre: e.target.value })}
                    placeholder="Ej. JUAN CARLOS"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    Apellidos: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.apellidos || ""}
                    onChange={(e) => setFormState({ ...formState, apellidos: e.target.value })}
                    placeholder="Ej. PÉREZ LÓPEZ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    Grado Académico / Título para Credencial:
                  </label>
                  <input
                    type="text"
                    value={formState.gradoTitulo || ""}
                    onChange={(e) => setFormState({ ...formState, gradoTitulo: e.target.value })}
                    placeholder="Ej. LICENCIADO EN ENFERMERÍA / CUIDADOR"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    Área de Adscripción:
                  </label>
                  <input
                    type="text"
                    value={formState.areaAdscripcion || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, areaAdscripcion: e.target.value })
                    }
                    placeholder="Ej. DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Teléfono:</label>
                  <input
                    type="text"
                    value={formState.telefono || ""}
                    onChange={(e) => setFormState({ ...formState, telefono: e.target.value })}
                    placeholder="771XXXXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Correo Electrónico:</label>
                  <input
                    type="email"
                    value={formState.correo || ""}
                    onChange={(e) => setFormState({ ...formState, correo: e.target.value })}
                    placeholder="personal@cuidartemexico.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Vigencia / Expiración Credencial:</label>
                  <input
                    type="text"
                    value={formState.fechaExpiracion || "21/08/2030"}
                    onChange={(e) =>
                      setFormState({ ...formState, fechaExpiracion: e.target.value })
                    }
                    placeholder="21/08/2030"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Estatus:</label>
                  <select
                    value={formState.estatus || "Activo"}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        estatus: e.target.value as "Activo" | "Inactivo" | "Baja",
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:border-sky-500"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>

              {/* OPCIÓN: MARCAR COMO SOCIO OPERATIVO (ATENCIÓN A URGENCIAS) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/60 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!formState.esSocioOperativo}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        esSocioOperativo: e.target.checked,
                      })
                    }
                    className="mt-0.5 w-4 h-4 text-rose-600 rounded bg-slate-900 border-rose-500 focus:ring-rose-500"
                  />
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Habilitar como Socio Operativo (Atención de Urgencias)</span>
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      El personal que atiende urgencias puede marcarse como <strong>Socio Operativo</strong>. Aparecerá identificado en los filtros administrativos, directorios y con cintillo oficial en su credencial digital.
                    </p>
                  </div>
                </label>
              </div>

              {/* CONTROL DE PRIVACIDAD Y ACCESO A PACIENTES / RECEPTORES */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Seguridad de Privacidad y Acceso a Pacientes</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800">
                    {(formState.receptoresRevocadosIds?.length || 0)} receptor(es) revocados
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Controle si este colaborador tiene autorización para visualizar los datos sensibles, contactos, direcciones, expedientes y documentos de los receptores de servicio asignados.
                </p>

                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  {/* Global Lock Toggle */}
                  <label className="flex items-start gap-3 cursor-pointer select-none bg-slate-900/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={!!formState.bloquearAccesoReceptores}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          bloquearAccesoReceptores: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 text-rose-600 rounded bg-slate-950 border-slate-700 focus:ring-rose-500"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white text-xs block flex items-center gap-1.5">
                        {formState.bloquearAccesoReceptores ? (
                          <span className="text-rose-400 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            Acceso Global a Pacientes: REVOCADO / BLOQUEADO TOTALMENTE
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Unlock className="w-3.5 h-3.5" />
                            Acceso Global: HABILITADO (Permite restricciones individuales abajo)
                          </span>
                        )}
                      </span>
                      <p className="text-[10.5px] text-slate-400">
                        {formState.bloquearAccesoReceptores
                          ? "El personal NO podrá ver detalles privados ni expedientes de NINGÚN paciente en su portal."
                          : "El personal podrá ver información médica de los receptores asignados excepto los revocados específicamente."}
                      </p>
                    </div>
                  </label>

                  {formState.bloquearAccesoReceptores && (
                    <div className="animate-fadeIn">
                      <label className="block text-slate-400 font-bold mb-1 text-[11px]">
                        Motivo de Revocación Global / Restricción:
                      </label>
                      <input
                        type="text"
                        value={formState.motivoBloqueoAcceso || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            motivoBloqueoAcceso: e.target.value,
                          })
                        }
                        placeholder="Ej. Cambio de asignación / Restricción de confidencialidad"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  )}

                  {/* Granular Per-Receptor Selector in Form */}
                  {!formState.bloquearAccesoReceptores && clients.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300">
                          Revocación Individual por Receptor de Servicio:
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Marque los receptores a los que DESEA QUITAR ACCESO
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-900/50">
                        {uniqueClients.map((client, idx) => {
                          const normalizedId = (client.id || "").toUpperCase();
                          const isRevoked = (formState.receptoresRevocadosIds || []).some(
                            (id) => (id || "").toUpperCase() === normalizedId
                          );

                          return (
                            <label
                              key={`staff-cred-rev-${client.id || idx}-${idx}`}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                                isRevoked
                                  ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
                                  : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isRevoked}
                                  onChange={(e) => {
                                    const current = formState.receptoresRevocadosIds || [];
                                    if (e.target.checked) {
                                      setFormState({
                                        ...formState,
                                        receptoresRevocadosIds: [...current, client.id],
                                      });
                                    } else {
                                      setFormState({
                                        ...formState,
                                        receptoresRevocadosIds: current.filter(
                                          (id) => (id || "").toUpperCase() !== normalizedId
                                        ),
                                      });
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-rose-600 rounded bg-slate-950 border-slate-700 focus:ring-rose-500"
                                />
                                <div>
                                  <span className="font-bold text-white block">
                                    {client.nombreCompletoRS || client.nombreCompletoCliente}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {client.id} {client.diagnostico ? `• ${client.diagnostico}` : ""}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isRevoked
                                    ? "bg-rose-900/60 text-rose-300 border-rose-700/60"
                                    : "bg-emerald-900/40 text-emerald-400 border-emerald-700/40"
                                }`}
                              >
                                {isRevoked ? "Acceso Revocado" : "Acceso Permitido"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DATOS DE CUENTA BANCARIA PARA PAGO DE HONORARIOS Y DISPERSIÓN */}
              <div className="bg-slate-950 p-4 rounded-xl border border-sky-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-400 font-extrabold text-xs">
                    <Building2 className="w-4 h-4" />
                    <span>Datos de Cuenta Bancaria para Pago de Honorarios</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800/60">
                    Dispersión y Finanzas
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Información bancaria requerida para la dispersión de pagos y vinculación automática en el módulo de <strong>Honorarios por Carátula</strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-xs">
                      Institución Bancaria / Receptor:
                    </label>
                    <select
                      value={formState.banco || ""}
                      onChange={(e) => setFormState({ ...formState, banco: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-semibold"
                    >
                      <option value="">-- Seleccionar Banco --</option>
                      <option value="BBVA">BBVA México</option>
                      <option value="Banorte">Banorte</option>
                      <option value="Santander">Santander</option>
                      <option value="Citibanamex">Citibanamex</option>
                      <option value="HSBC">HSBC México</option>
                      <option value="Scotiabank">Scotiabank</option>
                      <option value="Nu México">Nu México (Cuenta Nu)</option>
                      <option value="Mercado Pago">Mercado Pago Wallet</option>
                      <option value="Banco Azteca">Banco Azteca</option>
                      <option value="Spin by OXXO">Spin by OXXO</option>
                      <option value="BanCoppel">BanCoppel</option>
                      <option value="Hey Banco">Hey Banco</option>
                      <option value="Inbursa">Inbursa</option>
                      <option value="BanBajío">BanBajío</option>
                      <option value="Afirme">Afirme</option>
                      <option value="Klar">Klar</option>
                      <option value="Albo">Albo</option>
                      <option value="Plata Card">Plata Card</option>
                      <option value="Banjército">Banjército</option>
                      <option value="Otro">Otro Banco / Fintech</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-xs">
                      Preferencia de Pago:
                    </label>
                    <select
                      value={formState.tipoPagoPreferencia || "Transferencia"}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          tipoPagoPreferencia: e.target.value as "Transferencia" | "Efectivo" | "Cheque",
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-semibold"
                    >
                      <option value="Transferencia">Transferencia Electrónica (SPEI)</option>
                      <option value="Efectivo">Efectivo en Caja</option>
                      <option value="Cheque">Cheque Nominativo</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-400 font-bold text-xs">
                        CLABE Interbancaria (18 dígitos):
                      </label>
                      <span className={`text-[10px] font-mono font-bold ${
                        (formState.clabeInterbancaria || "").replace(/\s/g, "").length === 18
                          ? "text-emerald-400"
                          : (formState.clabeInterbancaria || "").length > 0
                          ? "text-amber-400"
                          : "text-slate-500"
                      }`}>
                        {(formState.clabeInterbancaria || "").replace(/\s/g, "").length}/18 dígitos
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={18}
                      value={formState.clabeInterbancaria || ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          clabeInterbancaria: e.target.value.replace(/\D/g, "").slice(0, 18),
                        })
                      }
                      placeholder="012345678901234567"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-xs">
                      Número de Cuenta / Tarjeta de Débito:
                    </label>
                    <input
                      type="text"
                      value={formState.cuentaBancaria || ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          cuentaBancaria: e.target.value.trim(),
                        })
                      }
                      placeholder="Ej. 0123456789 o 16 dígitos"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-xs">
                      Nombre del Titular de la Cuenta:
                    </label>
                    <input
                      type="text"
                      value={formState.titularCuenta || ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          titularCuenta: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Ej. NOMBRE COMPLETO SEGÚN ESTADO DE CUENTA"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-xs">
                      RFC para Facturación / Retenciones:
                    </label>
                    <input
                      type="text"
                      maxLength={13}
                      value={formState.rfcFacturacion || ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          rfcFacturacion: e.target.value.toUpperCase().slice(0, 13),
                        })
                      }
                      placeholder="Ej. PERL900101XXX"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 uppercase font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-sky-900/30"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar e Imprimir Credencial</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {isCropperOpen && (
        <ImageCropperModal
          initialImage={formState.fotoUrl}
          onCropComplete={handleCropComplete}
          onClose={() => setIsCropperOpen(false)}
        />
      )}

      {/* Credential Modal Preview */}
      {selectedStaffForCredential && (
        <div
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedStaffForCredential(null);
            }
          }}
        >
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-5 relative space-y-4">
            {/* Header with prominent close button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <h3 className="font-extrabold text-base text-white">
                  Credencial Oficial: {selectedStaffForCredential.nombre}{" "}
                  {selectedStaffForCredential.apellidos}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffForCredential(null)}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                title="Cerrar ventana de credencial"
              >
                <X className="w-4 h-4" />
                <span>Cerrar</span>
              </button>
            </div>

            <StaffCredentialCard
              staff={selectedStaffForCredential}
              showActions={true}
              canPrint={true}
              onClose={() => setSelectedStaffForCredential(null)}
            />

            {/* Bottom Footer Close Button for ease of use */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStaffForCredential(null)}
                className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Cerrar Ventana</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Verification Modal */}
      {isVerifierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Verificador de Código (5 Caracteres)</h3>
              </div>
              <button
                onClick={() => setIsVerifierOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CaratulaVerificationPortal
              caratulas={[]}
              staffMembers={staffMembers}
              abonos={[]}
              isAdminView={true}
            />
          </div>
        </div>
      )}

      {/* Staff Documents Expediente Modal */}
      {selectedStaffForDocuments && (
        <DocumentUploadModal
          title="Expediente Digital del Personal"
          subtitle={`No. Socio: ${selectedStaffForDocuments.noSocio} | Puesto: ${selectedStaffForDocuments.puestoTipoPersonal}`}
          ownerName={`${selectedStaffForDocuments.nombre} ${selectedStaffForDocuments.apellidos}`.trim()}
          ownerId={selectedStaffForDocuments.id}
          category="staff"
          documents={selectedStaffForDocuments.documentos || []}
          onSaveDocuments={(updatedDocs) => {
            const updatedStaff: StaffMember = {
              ...selectedStaffForDocuments,
              documentos: updatedDocs,
            };
            setSelectedStaffForDocuments(updatedStaff);
            onSaveStaffMember(updatedStaff);
          }}
          onClose={() => setSelectedStaffForDocuments(null)}
        />
      )}

      {/* GRANULAR RECEPTOR ACCESS MANAGEMENT MODAL */}
      {selectedStaffForAccessModal && (() => {
        const activeAccessStaff = staffMembers.find((s) => s.id === selectedStaffForAccessModal.id) || selectedStaffForAccessModal;
        const isGloballyBlocked = !!activeAccessStaff.bloquearAccesoReceptores;
        const currentRevokedIds = (activeAccessStaff.receptoresRevocadosIds || []).map((id) => (id || "").toUpperCase());

        return (
        <div
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedStaffForAccessModal(null);
            }
          }}
        >
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                    <span>Control Granular de Acceso por Receptor</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
                      SOCP-{activeAccessStaff.noSocio}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Colaborador: <strong className="text-slate-200">{activeAccessStaff.nombre} {activeAccessStaff.apellidos}</strong> • {activeAccessStaff.puestoTipoPersonal}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStaffForAccessModal(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Informative Guidance Banner */}
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-3.5 text-amber-200 text-xs flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-300 block">Privacidad y Protección de Expedientes Clínicos</span>
                  <p className="text-amber-200/90 leading-relaxed text-[11.5px]">
                    El personal de enfermería puede tener múltiples receptores asignados. Al revocar el acceso a un receptor específico, el colaborador <strong>NO podrá ver el expediente, bitácora de notas, medicamentos, kárdex ni documentos clínicos</strong> de dicho paciente en su portal.
                  </p>
                </div>
              </div>

              {/* Global Lock Switch */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    {isGloballyBlocked ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <Lock className="w-4 h-4" /> Bloqueo Global: TODOS los Receptores Revocados
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Unlock className="w-4 h-4" /> Bloqueo Global: Desactivado (Control Individual Habilitado)
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {isGloballyBlocked
                      ? "El colaborador tiene denegado el acceso a cualquier paciente del sistema."
                      : "Puede revocar o permitir el acceso a cada receptor de servicio de forma individual."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAccess(activeAccessStaff)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      isGloballyBlocked
                        ? "bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-700"
                        : "bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-800"
                    }`}
                  >
                    {isGloballyBlocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Desactivar Bloqueo Global</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Bloquear a Todos</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Granular Table Controls */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={accessModalSearch}
                      onChange={(e) => setAccessModalSearch(e.target.value)}
                      placeholder="Buscar receptor por nombre o folio..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAllowAllReceptors(activeAccessStaff)}
                      className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Restablecer y autorizar acceso a todos los receptores"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Autorizar a Todos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRevokeAllReceptors(activeAccessStaff)}
                      className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Revocar acceso a todos los receptores"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Revocar Todos</span>
                    </button>
                  </div>
                </div>

                {/* Receptor Cards List */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {uniqueClients.length === 0 ? (
                    <p className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
                      No hay clientes ni receptores registrados en el sistema.
                    </p>
                  ) : (
                    uniqueClients
                      .filter((c) => {
                        const term = accessModalSearch.toLowerCase();
                        return (
                          !term ||
                          (c.nombreCompletoRS || "").toLowerCase().includes(term) ||
                          (c.nombreCompletoCliente || "").toLowerCase().includes(term) ||
                          (c.id || "").toLowerCase().includes(term) ||
                          (c.diagnostico || "").toLowerCase().includes(term)
                        );
                      })
                      .map((client, idx) => {
                        const normalizedClientId = (client.id || "").toUpperCase();
                        const isIndividuallyRevoked = currentRevokedIds.includes(normalizedClientId);
                        const isRevoked = isGloballyBlocked || isIndividuallyRevoked;

                        // Check if assigned in calendar events
                        const staffNoSocioLower = (activeAccessStaff.noSocio || "").toLowerCase();
                        const isAssignedInCalendar = Boolean(
                          staffNoSocioLower &&
                          calendarEvents.some(
                            (ev) =>
                              (ev.clientId || "").toUpperCase() === normalizedClientId &&
                              `${ev.staffId || ""} ${ev.staffNombre || ""}`
                                .toLowerCase()
                                .includes(staffNoSocioLower)
                          )
                        );

                        return (
                          <div
                            key={`staff-cred-cli-${client.id || idx}-${idx}`}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isRevoked
                                ? "bg-rose-950/20 border-rose-900/50"
                                : "bg-slate-950/80 border-slate-800/80 hover:border-slate-700"
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-700 rounded-md">
                                  {client.id}
                                </span>
                                <h4 className="font-black text-white text-xs sm:text-sm truncate">
                                  {client.nombreCompletoRS || client.nombreCompletoCliente}
                                </h4>
                                {isAssignedInCalendar && (
                                  <span className="text-[9px] font-bold px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 rounded-full">
                                    Turno Asignado
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                <span>Titular: <strong className="text-slate-300">{client.nombreCompletoCliente}</strong></span>
                                {client.diagnostico && (
                                  <span className="text-slate-400 truncate max-w-xs">
                                    • Diag: {client.diagnostico}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-black px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                                  isRevoked
                                    ? "bg-rose-950 text-rose-300 border-rose-700"
                                    : "bg-emerald-950 text-emerald-300 border-emerald-700"
                                }`}
                              >
                                {isRevoked ? (
                                  <>
                                    <Lock className="w-3 h-3 text-rose-400" />
                                    <span>Acceso Revocado</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3 h-3 text-emerald-400" />
                                    <span>Acceso Autorizado</span>
                                  </>
                                )}
                              </span>

                              <button
                                type="button"
                                disabled={isGloballyBlocked}
                                onClick={() => handleToggleReceptorAccess(activeAccessStaff, client.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 border shadow-sm ${
                                  isGloballyBlocked
                                    ? "opacity-40 cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700"
                                    : isIndividuallyRevoked
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-950"
                                    : "bg-rose-950/80 hover:bg-rose-900 text-rose-200 border-rose-800"
                                }`}
                                title={
                                  isGloballyBlocked
                                    ? "Desactive el bloqueo global primero"
                                    : isIndividuallyRevoked
                                    ? "Autorizar a este colaborador el acceso al expediente y datos de este paciente"
                                    : "Revocar el acceso a este paciente específico"
                                }
                              >
                                {isIndividuallyRevoked ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>Permitir Acceso</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Revocar Acceso</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Los cambios se guardan y sincronizan automáticamente con la plataforma.
              </span>
              <button
                type="button"
                onClick={() => setSelectedStaffForAccessModal(null)}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-sky-950"
              >
                <Check className="w-4 h-4" />
                <span>Listo / Finalizar</span>
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL DE ASIGNACIÓN DE CLIENTES EN PORTAL DE SOCIOS/PERSONAL */}
      {/* ======================================================== */}
      {selectedStaffForClientAssignment && (() => {
        const staff = selectedStaffForClientAssignment;
        const isEmp = staff.tipoContrato?.toLowerCase().includes("empleado");
        const assignedClients = getAssignedClientsForStaff(staff);
        const assignedIds = new Set(assignedClients.map((c) => c.id));

        const isVentasStaff =
          (staff.puestoTipoPersonal || "").toLowerCase().includes("ventas") ||
          (staff.gradoTitulo || "").toLowerCase().includes("ventas") ||
          (staff.badgePrincipal || "").toLowerCase().includes("ventas");
        const isAtencionStaff =
          (staff.puestoTipoPersonal || "").toLowerCase().includes("atenci") ||
          (staff.gradoTitulo || "").toLowerCase().includes("atenci") ||
          (staff.badgePrincipal || "").toLowerCase().includes("atenci");

        // Determine active role target
        const effectiveRole: "ventas" | "atencion" | "ambos" =
          assignmentRoleTarget === "auto"
            ? isVentasStaff
              ? "ventas"
              : isAtencionStaff
              ? "atencion"
              : "ambos"
            : assignmentRoleTarget;

        const filteredClients = uniqueClients.filter((c) => {
          // Tab filter
          const isAssigned = assignedIds.has(c.id);
          if (assignmentFilterTab === "ASSIGNED" && !isAssigned) return false;
          if (assignmentFilterTab === "UNASSIGNED" && isAssigned) return false;

          // Search filter
          if (!assignmentSearch) return true;
          const term = assignmentSearch.toLowerCase();
          const matchId = (c.id || "").toLowerCase().includes(term);
          const matchClient = (c.nombreCompletoCliente || "").toLowerCase().includes(term);
          const matchRS = (c.nombreCompletoRS || "").toLowerCase().includes(term);
          const matchAsig = (c.asignadoA || "").toLowerCase().includes(term);
          const matchAtenc = (c.asignadoAtencionA || "").toLowerCase().includes(term);
          const matchDiag = (c.diagnostico || "").toLowerCase().includes(term);

          return matchId || matchClient || matchRS || matchAsig || matchAtenc || matchDiag;
        });

        const unassignedCount = uniqueClients.filter((c) => !c.asignadoA && !c.asignadoAtencionA).length;

        return (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
              
              {/* Top Header */}
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-5 border-b border-indigo-900/60 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-14 bg-slate-900 rounded-2xl border-2 border-indigo-500/50 overflow-hidden shrink-0 relative flex items-center justify-center shadow-md">
                    {staff.fotoUrl ? (
                      <img src={staff.fotoUrl} alt={staff.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-indigo-300" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-black px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-700/80 rounded-md">
                        {isEmp ? `EMP-${staff.noSocio}` : `SOCP-${staff.noSocio}`}
                      </span>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700/70 rounded-full">
                        {staff.puestoTipoPersonal}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white truncate mt-0.5">
                      Asignar Cartera de Clientes a {staff.nombre} {staff.apellidos}
                    </h3>
                    <p className="text-xs text-indigo-200/80">
                      Asigne o desasigne clientes directamente desde el portal de Socios y Personal Cuidarte.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStaffForClientAssignment(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl transition border border-slate-700 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Assignment Role Target & Control Bar */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Role Target Selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Tipo de Asignación:
                    </span>
                    <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setAssignmentRoleTarget("ventas")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          effectiveRole === "ventas"
                            ? "bg-amber-500 text-slate-950 shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Asesor de Ventas (Comercial)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentRoleTarget("atencion")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          effectiveRole === "atencion"
                            ? "bg-sky-500 text-slate-950 shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Atención a Clientes (Soporte)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentRoleTarget("ambos")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          effectiveRole === "ambos"
                            ? "bg-indigo-500 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Ambos Roles
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric */}
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-indigo-950/80 border border-indigo-800 text-indigo-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{assignedClients.length} Clientes Asignados Actualmente</span>
                    </div>
                  </div>
                </div>

                {/* Filter Tabs & Search */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center pt-1">
                  {/* Search bar */}
                  <div className="md:col-span-6 relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={assignmentSearch}
                      onChange={(e) => setAssignmentSearch(e.target.value)}
                      placeholder="Buscar por cliente, paciente, ID, diagnóstico..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
                    />
                  </div>

                  {/* Filter tabs */}
                  <div className="md:col-span-6 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setAssignmentFilterTab("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                        assignmentFilterTab === "ALL"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      Todos ({uniqueClients.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentFilterTab("ASSIGNED")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                        assignmentFilterTab === "ASSIGNED"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      Asignados a {staff.nombre} ({assignedClients.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentFilterTab("UNASSIGNED")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                        assignmentFilterTab === "UNASSIGNED"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      Sin Asignar ({unassignedCount})
                    </button>
                  </div>
                </div>

                {/* Bulk Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-400">
                    Mostrando <strong>{filteredClients.length}</strong> clientes con los filtros actuales.
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingAssignments || filteredClients.length === 0}
                      onClick={() => handleBatchAssignFiltered(staff, filteredClients, effectiveRole)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-indigo-950"
                      title="Asignar todos los clientes mostrados en esta lista a este colaborador"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Asignar {filteredClients.length} Filtrados</span>
                    </button>

                    {assignedClients.length > 0 && (
                      <button
                        type="button"
                        disabled={isSavingAssignments}
                        onClick={() => {
                          if (confirm(`¿Desea desasignar todos los ${assignedClients.length} clientes asignados a ${staff.nombre}?`)) {
                            handleBatchUnassignAll(staff, effectiveRole);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 disabled:opacity-40 text-rose-300 border border-rose-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        title="Quitar todos los clientes asignados a este colaborador"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Desasignar Todos ({assignedClients.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Clients List Scrollable */}
              <div className="p-4 flex-1 overflow-y-auto space-y-2.5 bg-slate-900/50">
                {filteredClients.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                    <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No se encontraron clientes con los filtros seleccionados.</p>
                    <p className="text-[11px] text-slate-500">Pruebe con otro término de búsqueda o cambie a la pestaña "Todos".</p>
                  </div>
                ) : (
                  filteredClients.map((client, clientIdx) => {
                    const isAssigned = assignedIds.has(client.id);
                    const staffNombreLower = (staff.nombre || "").toLowerCase();
                    const staffNoSocioLower = (staff.noSocio || "").toLowerCase();
                    const isAssignedToThisVentas = Boolean(
                      (staffNombreLower && (client.asignadoA || "").toLowerCase().includes(staffNombreLower)) ||
                      (staffNoSocioLower && (client.asignadoA || "").toLowerCase().includes(staffNoSocioLower))
                    );
                    const isAssignedToThisAtencion = Boolean(
                      (staffNombreLower && (client.asignadoAtencionA || "").toLowerCase().includes(staffNombreLower)) ||
                      (staffNoSocioLower && (client.asignadoAtencionA || "").toLowerCase().includes(staffNoSocioLower))
                    );

                    return (
                      <div
                        key={`staff-cred-assign-${client.id || clientIdx}-${clientIdx}`}
                        onClick={() => handleToggleClientAssignment(client, staff, effectiveRole)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isAssigned
                            ? "bg-indigo-950/30 border-indigo-500/60 shadow-md shadow-indigo-950/20 hover:border-indigo-400"
                            : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {/* Left Info */}
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Checkbox Icon */}
                          <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition ${
                            isAssigned
                              ? "bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-600/50"
                              : "bg-slate-900 border-slate-700 text-transparent"
                          }`}>
                            <Check className="w-4 h-4" />
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-700 rounded-md">
                                {client.id}
                              </span>
                              <h4 className="font-black text-white text-xs sm:text-sm truncate">
                                {client.nombreCompletoCliente}
                              </h4>
                              {client.estatus && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                  client.estatus === "Activo"
                                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                    : "bg-slate-800 text-slate-300 border-slate-700"
                                }`}>
                                  {client.estatus}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 space-y-0.5">
                              {client.nombreCompletoRS && (
                                <div className="text-slate-300">
                                  Paciente / Receptor: <strong className="text-white">{client.nombreCompletoRS}</strong>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                                {client.telefono && (
                                  <span>Tel: <strong className="text-slate-300 font-mono">{client.telefono}</strong></span>
                                )}
                                {client.diagnostico && (
                                  <span className="text-slate-400 truncate max-w-xs">
                                    • Diag: {client.diagnostico}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Assignment Details & Action */}
                        <div className="flex flex-col sm:items-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                          {/* Assignment Status Badges */}
                          <div className="flex flex-wrap items-center gap-1">
                            {client.asignadoA ? (
                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                                isAssignedToThisVentas
                                  ? "bg-amber-950 text-amber-300 border-amber-600"
                                  : "bg-slate-900 text-slate-400 border-slate-800"
                              }`}>
                                Ventas: {client.asignadoA}
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-medium px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 border border-slate-800">
                                Sin Asesor de Ventas
                              </span>
                            )}

                            {client.asignadoAtencionA ? (
                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                                isAssignedToThisAtencion
                                  ? "bg-sky-950 text-sky-300 border-sky-600"
                                  : "bg-slate-900 text-slate-400 border-slate-800"
                              }`}>
                                Atención: {client.asignadoAtencionA}
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-medium px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 border border-slate-800">
                                Sin Asesor de Atención
                              </span>
                            )}
                          </div>

                          {/* Toggle Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleClientAssignment(client, staff, effectiveRole);
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-black transition flex items-center gap-1.5 border shadow-sm ${
                              isAssigned
                                ? "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-800"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-indigo-950"
                            }`}
                          >
                            {isAssigned ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Desasignar</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Asignar a este Colaborador</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Las asignaciones se sincronizan de inmediato con el Portal de Ventas, Portal de Atención a Clientes y Módulos de Administración.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStaffForClientAssignment(null)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-950 w-full sm:w-auto justify-center"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar y Cerrar</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Delete Staff Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-500/30 w-full max-w-md rounded-2xl shadow-2xl p-6 relative space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base text-white">¿Eliminar Colaborador?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  ¿Está seguro de eliminar a <strong className="text-white">{staffToDelete.nombre} {staffToDelete.apellidos}</strong> ({staffToDelete.puestoTipoPersonal})?
                </p>
              </div>
              <button
                onClick={() => setStaffToDelete(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar Colaborador</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
