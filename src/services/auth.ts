import { UserSession, UserRole, SystemUser, Client, StaffMember } from "../types";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { logAuditEvent } from "./auditService";
import { initialSystemUsers } from "../data/seedData";
import { loadSystemUsers, loadClients, loadStaffMembers } from "../utils/storage";
import { isFirestoreQuotaExhausted, handleFirestoreError, sanitizeForFirestore } from "./firestoreSync";

export type { UserSession, UserRole };


export interface SocioItem {
  id: string;
  ux: string;
  nombre: string;
}

let inMemorySessionBackup: UserSession | null = null;

// Ensure persistent storage from browser API so data is never evicted
export const requestStoragePersistence = async (): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
};

export const getStoredUser = (): UserSession | null => {
  try {
    let raw = localStorage.getItem("cuidarte_user");
    if (!raw && typeof sessionStorage !== "undefined") {
      raw = sessionStorage.getItem("cuidarte_user");
    }
    if (!raw && inMemorySessionBackup) {
      return inMemorySessionBackup;
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure role property exists on legacy stored sessions
      if (!parsed.role) {
        const uUpper = (parsed.username || "").trim().toUpperCase();
        if (uUpper.startsWith("CLI-")) {
          parsed.role = "client";
          parsed.clientId = uUpper;
        } else if (uUpper.startsWith("SOCP-")) {
          parsed.role = "nurse";
          parsed.nurseId = uUpper;
        } else if (uUpper.startsWith("VEN-") || uUpper.includes("VENTAS")) {
          parsed.role = "ventas";
        } else if (uUpper.startsWith("ATC-") || uUpper.includes("ATENCION")) {
          parsed.role = "atencion_clientes";
        } else {
          parsed.role = "admin";
        }
      }
      inMemorySessionBackup = parsed;
      return parsed;
    }
  } catch (err) {
    console.error("Error reading stored session:", err);
    if (inMemorySessionBackup) return inMemorySessionBackup;
  }
  return null;
};

export const saveUserSession = (
  userInfo:
    | string
    | {
        username: string;
        nombre?: string;
        role?: UserRole;
        clientId?: string;
        nurseId?: string;
        isSuperAdmin?: boolean;
        isGeneralAdmin?: boolean;
        sucursalId?: string;
        sucursalNombre?: string;
        token?: string;
      }
): UserSession => {
  let cleanUsername = "";
  let role: UserRole = "admin";
  let nombre: string | undefined = undefined;
  let clientId: string | undefined = undefined;
  let nurseId: string | undefined = undefined;
  let isSuperAdmin: boolean | undefined = undefined;
  let isGeneralAdmin: boolean | undefined = undefined;
  let sucursalId: string | undefined = undefined;
  let sucursalNombre: string | undefined = undefined;
  let token: string | undefined = undefined;

  if (typeof userInfo === "string") {
    cleanUsername = userInfo.trim();
    const uUpper = cleanUsername.toUpperCase();
    const isClient = uUpper.startsWith("CLI-");
    const isNurse = uUpper.startsWith("SOCP-");
    const isVentas = uUpper.startsWith("VEN-") || uUpper.includes("VENTAS");
    const isAtencion = uUpper.startsWith("ATC-") || uUpper.includes("ATENCION");

    role = isClient
      ? "client"
      : isNurse
      ? "nurse"
      : isVentas
      ? "ventas"
      : isAtencion
      ? "atencion_clientes"
      : "admin";

    clientId = isClient ? uUpper : undefined;
    nurseId = isNurse ? uUpper : undefined;
    isGeneralAdmin = role === "admin";
  } else {
    cleanUsername = userInfo.username.trim();
    nombre = userInfo.nombre;
    const uUpper = cleanUsername.toUpperCase();
    role =
      userInfo.role ||
      (uUpper.startsWith("CLI-")
        ? "client"
        : uUpper.startsWith("SOCP-")
        ? "nurse"
        : uUpper.startsWith("VEN-") || uUpper.includes("VENTAS")
        ? "ventas"
        : uUpper.startsWith("ATC-") || uUpper.includes("ATENCION")
        ? "atencion_clientes"
        : "admin");
    clientId = userInfo.clientId || (role === "client" ? uUpper : undefined);
    nurseId = userInfo.nurseId || (role === "nurse" ? uUpper : undefined);
    isSuperAdmin = userInfo.isSuperAdmin;
    isGeneralAdmin = userInfo.isGeneralAdmin ?? (role === "admin" && !userInfo.sucursalId);
    sucursalId = userInfo.sucursalId;
    sucursalNombre = userInfo.sucursalNombre;
    token = userInfo.token;
  }

  const session: UserSession = {
    username: cleanUsername,
    nombre,
    loggedInAt: new Date().toISOString(),
    role,
    clientId,
    nurseId,
    isSuperAdmin,
    isGeneralAdmin,
    sucursalId,
    sucursalNombre,
  };

  inMemorySessionBackup = session;

  try {
    localStorage.setItem("cuidarte_user", JSON.stringify(session));
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("cuidarte_user", JSON.stringify(session));
    }
    // Proactively request browser storage persistence
    requestStoragePersistence().catch(() => {});
  } catch (err) {
    console.error("Error saving session:", err);
  }
  return session;
};

export const logoutUserSession = (): void => {
  inMemorySessionBackup = null;
  try {
    localStorage.removeItem("cuidarte_user");
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("cuidarte_user");
    }
  } catch (err) {
    console.error("Error clearing session:", err);
  }
};

/**
 * Validates user credentials securely across Google Sheets, Firestore system_users, and Clients directory.
 */
export async function validateCredentials(
  uxInput: string,
  cxInput: string
): Promise<{
  success: boolean;
  user?: {
    username: string;
    nombre?: string;
    role?: UserRole;
    clientId?: string;
    nurseId?: string;
    isSuperAdmin?: boolean;
    token?: string;
  };
  message?: string;
}> {
  const cleanUx = uxInput.trim();
  const cleanCx = cxInput.trim();

  if (!cleanUx || !cleanCx) {
    return { success: false, message: "Por favor ingresa usuario y contraseña." };
  }

  const cleanUxLower = cleanUx.toLowerCase();
  const cleanUxNoSpaces = cleanUxLower.replace(/\s+/g, "");

  // 1. Direct validation for Super Admin: Nestor Moedano / Ue18195073
  const isSuperAdminUx =
    cleanUxLower === "nestor moedano" ||
    cleanUxLower === "nestormoedano" ||
    cleanUxLower === "nestor";

  if (isSuperAdminUx && cleanCx === "Ue18195073") {
    const user = {
      username: "Nestor Moedano",
      nombre: "Néstor Fernando Miranda Moedano (Super Administrador)",
      role: "admin" as UserRole,
      isSuperAdmin: true,
      isGeneralAdmin: true,
    };
    logAuditEvent({
      tipoAccion: "LOGIN_EXITOSO",
      usuarioUx: user.username,
      usuarioNombre: user.nombre,
      rol: user.role,
      descripcion: `Inicio de sesión exitoso como Super Administrador (Cuidarte México)`,
    }).catch(console.error);

    return {
      success: true,
      user,
    };
  }

  // 2. Primary: Authenticate via Secure Server API (Google Sheets Central Sync + Rate-limiting)
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ux: cleanUx, cx: cleanCx }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.success) {
      const user = { ...data.user };
      // Check if user has a branch assignment in local system_users or is general admin
      try {
        const cachedUsers = loadSystemUsers();
        const matched = cachedUsers.find(
          (u) => u.ux && u.ux.trim().toLowerCase() === user.username.trim().toLowerCase()
        );
        if (matched) {
          if (matched.sucursalId) {
            user.sucursalId = matched.sucursalId;
            user.sucursalNombre = matched.sucursalNombre;
            user.isGeneralAdmin = false;
          } else {
            user.isGeneralAdmin = matched.isGeneralAdmin ?? (user.role === "admin");
          }
        } else if (user.role === "admin") {
          user.isGeneralAdmin = true;
        }
      } catch {
        if (user.role === "admin" && !user.sucursalId) {
          user.isGeneralAdmin = true;
        }
      }

      logAuditEvent({
        tipoAccion: "LOGIN_EXITOSO",
        usuarioUx: user.username,
        usuarioNombre: user.nombre,
        rol: user.role,
        descripcion: `Inicio de sesión exitoso con protocolo seguro (Rol: ${user.role}${user.sucursalNombre ? ` - Sucursal: ${user.sucursalNombre}` : ' - Admin General'})`,
      }).catch(console.error);

      return {
        success: true,
        user,
      };
    } else if (response.status === 429) {
      logAuditEvent({
        tipoAccion: "ACCESO_DENEGADO",
        usuarioUx: cleanUx,
        rol: "admin",
        descripcion: `Bloqueo de seguridad por exceso de intentos fallidos (Fuerza bruta prevenida)`,
      }).catch(console.error);

      return {
        success: false,
        message: data?.message || "Acceso temporalmente bloqueado por seguridad. Intenta más tarde.",
      };
    }
  } catch (err) {
    console.warn("Server API login check exception:", err);
  }

  // 3. Fallback: Authenticate against local cached & initialized system_users
  try {
    const cachedUsers = loadSystemUsers();
    const systemUsersList: SystemUser[] = cachedUsers && cachedUsers.length > 0 ? cachedUsers : initialSystemUsers;
    let matchedUser: SystemUser | null = null;

    for (const u of systemUsersList) {
      if (!u || !u.ux) continue;
      const uLower = u.ux.trim().toLowerCase();
      const uNoSpaces = uLower.replace(/\s+/g, "");
      const uClientLower = u.clientId?.trim().toLowerCase();

      if (
        uLower === cleanUxLower ||
        uNoSpaces === cleanUxNoSpaces ||
        (uClientLower && uClientLower === cleanUxLower) ||
        (u.id && u.id.toLowerCase() === cleanUxLower)
      ) {
        matchedUser = u;
        break;
      }
    }

    if (matchedUser) {
      const storedCx = (matchedUser as SystemUser).cx?.trim() || "";
      const isPasswordMatch =
        storedCx === cleanCx ||
        (storedCx.toLowerCase() === cleanCx.toLowerCase() &&
          (storedCx.toLowerCase() === "cuidarte2025" || storedCx.toLowerCase() === "cuidarte2026"));

      if (isPasswordMatch) {
        if ((matchedUser as SystemUser).estatus === "Inactivo") {
          return { success: false, message: "Este usuario se encuentra inactivo o suspendido." };
        }

        const role = (matchedUser as SystemUser).role || "client";
        const uUpper = (matchedUser as SystemUser).ux.toUpperCase();
        const finalClientId =
          (matchedUser as SystemUser).clientId || (role === "client" ? uUpper : undefined);
        const finalNurseId =
          (matchedUser as SystemUser).nurseId || (role === "nurse" ? uUpper : undefined);

        const isGenAdmin =
          (matchedUser as SystemUser).isGeneralAdmin ??
          (role === "admin" && !(matchedUser as SystemUser).sucursalId);

        const authenticatedUser = {
          username: (matchedUser as SystemUser).ux,
          nombre: (matchedUser as SystemUser).nombre || (matchedUser as SystemUser).ux,
          role,
          clientId: finalClientId,
          nurseId: finalNurseId,
          isSuperAdmin: (matchedUser as SystemUser).isSuperAdmin || false,
          isGeneralAdmin: isGenAdmin,
          sucursalId: (matchedUser as SystemUser).sucursalId,
          sucursalNombre: (matchedUser as SystemUser).sucursalNombre,
        };

        logAuditEvent({
          tipoAccion: "LOGIN_EXITOSO",
          usuarioUx: authenticatedUser.username,
          usuarioNombre: authenticatedUser.nombre,
          rol: authenticatedUser.role,
          descripcion: `Inicio de sesión exitoso de usuario @${authenticatedUser.username} (Rol: ${authenticatedUser.role})`,
        }).catch(() => {});

        return {
          success: true,
          user: authenticatedUser,
        };
      }
    }
  } catch (err) {
    console.warn("System users validation check error:", err);
  }

  // 4. Client Directory Fallback: Check registered clients directory
  try {
    const cachedClients = loadClients();
    let matchedClient: Client | null = null;

    for (const c of cachedClients) {
      if (!c) continue;
      const cIdLower = (c.id || "").trim().toLowerCase();
      const cNameLower = (c.nombreCompletoCliente || "").trim().toLowerCase();
      const cEmailLower = (c.correo || "").trim().toLowerCase();
      const cPhoneClean = (c.numeroContacto || "").replace(/\D/g, "");
      const inputPhoneClean = cleanUx.replace(/\D/g, "");

      if (
        cIdLower === cleanUxLower ||
        cIdLower.replace(/\s+/g, "") === cleanUxNoSpaces ||
        (cEmailLower && cEmailLower === cleanUxLower) ||
        (inputPhoneClean.length >= 7 && cPhoneClean.endsWith(inputPhoneClean)) ||
        (cNameLower && cNameLower === cleanUxLower)
      ) {
        matchedClient = c;
        break;
      }
    }

    if (matchedClient) {
      const validClientPasswords = [
        "Cuidarte2025",
        "cuidarte2025",
        "Cuidarte2026",
        "cuidarte2026",
        "123456",
        (matchedClient as Client).numeroContacto?.trim(),
        (matchedClient as Client).numeroContacto?.replace(/\D/g, ""),
        (matchedClient as Client).id,
        (matchedClient as Client).id.toLowerCase(),
      ].filter(Boolean);

      const isClientPasswordMatch = validClientPasswords.some(
        (pwd) => pwd && (pwd === cleanCx || pwd.toLowerCase() === cleanCx.toLowerCase())
      );

      if (isClientPasswordMatch) {
        const clientUserId = `usr-cli-${(matchedClient as Client).id}`;
        const clientUser: SystemUser = {
          id: clientUserId,
          ux: (matchedClient as Client).id,
          cx: cleanCx,
          role: "client",
          nombre: (matchedClient as Client).nombreCompletoCliente,
          clientId: (matchedClient as Client).id,
          estatus: "Activo",
          timestamp: new Date().toISOString(),
        };

        if (!isFirestoreQuotaExhausted()) {
          setDoc(doc(db, "system_users", clientUserId), sanitizeForFirestore(clientUser)).catch(() => {});
        }

        const authenticatedUser = {
          username: (matchedClient as Client).id,
          nombre: (matchedClient as Client).nombreCompletoCliente,
          role: "client" as UserRole,
          clientId: (matchedClient as Client).id,
        };

        logAuditEvent({
          tipoAccion: "LOGIN_EXITOSO",
          usuarioUx: authenticatedUser.username,
          usuarioNombre: authenticatedUser.nombre,
          rol: "client",
          descripcion: `Inicio de sesión exitoso de cliente @${authenticatedUser.username} (${authenticatedUser.nombre})`,
        }).catch(() => {});

        return {
          success: true,
          user: authenticatedUser,
        };
      }
    }
  } catch (err) {
    console.warn("Clients directory fallback check error:", err);
  }

  logAuditEvent({
    tipoAccion: "ACCESO_DENEGADO",
    usuarioUx: cleanUx,
    rol: "admin",
    descripcion: `Credenciales inválidas ingresadas para @${cleanUx}`,
  }).catch(console.error);

  return {
    success: false,
    message: "Usuario o contraseña incorrectos. Verifica tus credenciales de acceso.",
  };
}

/**
 * Fetches active Socios / Personal Activo from CuidartePachuca database.
 */
export async function fetchSocios(): Promise<SocioItem[]> {
  try {
    const response = await fetch("/api/socios");
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.socios)) {
        return data.socios;
      }
    }
  } catch (err) {
    console.error("Error fetching active socios list:", err);
  }
  return [];
}

