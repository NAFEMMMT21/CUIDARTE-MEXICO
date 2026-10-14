import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security & Embedding Headers Middleware (Configured to allow embedding in external iframes)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // X-Frame-Options and restrictive frame-ancestors CSP are removed to allow embedding in external iframes
  res.removeHeader("X-Frame-Options");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(express.json({ limit: "2mb" }));

// Server-side encryption key / salt for hashing credentials
const AUTH_SALT = process.env.AUTH_SECRET || "cuidarte_pachuca_secure_salt_key_2026";

// In-memory rate limiter for brute-force protection
interface LoginAttemptRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}
const loginRateLimitMap = new Map<string, LoginAttemptRecord>();
const MAX_FAILED_ATTEMPTS = 15; // Aumentado a 15 intentos permitidos antes de bloqueo
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // Bloqueo reducido a solo 2 minutos

function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginRateLimitMap.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Reset if lockout period expired and no recent failed attempts within 10 minutes
  if (now - record.lastAttempt > 10 * 60 * 1000) {
    loginRateLimitMap.delete(key);
  }

  return { allowed: true };
}

function recordFailedLogin(key: string): { attempts: number; remaining: number; isLocked: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginRateLimitMap.get(key) || { attempts: 0, lastAttempt: now, lockedUntil: 0 };
  record.attempts += 1;
  record.lastAttempt = now;

  let isLocked = false;
  let waitSeconds = 0;

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    isLocked = true;
    waitSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    console.warn(`[SECURITY] Rate limit triggered: ${key} locked for 2 minutes after ${record.attempts} failed attempts.`);
  }

  loginRateLimitMap.set(key, record);
  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
  return { attempts: record.attempts, remaining, isLocked, waitSeconds };
}

function clearRateLimit(key: string) {
  loginRateLimitMap.delete(key);
}

const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1HCftkjZUgYL7fosvgnJusj2QB0KbuOiVinwZeR649Uc/gviz/tq?tqx=out:csv";

/**
 * Creates a secure cryptographic SHA-256 hash for a password using salt.
 */
function hashPassword(password: string): string {
  return crypto
    .createHmac("sha256", AUTH_SALT)
    .update(password.trim())
    .digest("hex");
}

interface UserRecord {
  ux: string;
  uxLower: string;
  cxHash: string;
  cxRaw?: string;
  role: "admin" | "client" | "nurse";
  nombre?: string;
  clientId?: string;
  nurseId?: string;
}

interface SocioItem {
  id: string;
  ux: string;
  nombre: string;
}

/**
 * In-memory server-side cache for user records and active socios list.
 */
let userRecordsMap: Record<string, UserRecord> = {};
let sociosListCache: SocioItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Robust CSV parser that handles quoted strings and comma delimiters.
 */
function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let curLine: string[] = [];
  let curField = "";
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    if (inQuotes) {
      if (c === '"' && csvText[i + 1] === '"') {
        curField += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        curField += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        curLine.push(curField.trim());
        curField = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && csvText[i + 1] === "\n") i++;
        curLine.push(curField.trim());
        lines.push(curLine);
        curLine = [];
        curField = "";
      } else {
        curField += c;
      }
    }
  }
  if (curField || curLine.length > 0) {
    curLine.push(curField.trim());
    lines.push(curLine);
  }
  return lines;
}

/**
 * Synchronizes user data from 3 tables in Google Sheet server-side.
 * Table 1: Administrativos (cols 0: UX, 1: CX)
 * Table 2: Clientes (cols 3: UX, 4: CX)
 * Table 3: Socios (cols 6: NOMBRE, 7: UX, 8: CX) - Personal Activo
 */
async function syncUsersDatabase() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && Object.keys(userRecordsMap).length > 0) {
    return { userRecordsMap, sociosListCache };
  }

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL, { cache: "no-store" });
    if (response.ok) {
      const csvText = await response.text();
      const rows = parseCSV(csvText);
      const newMap: Record<string, UserRecord> = {};
      const newSocios: SocioItem[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // 1. Table Administrativo (cols 0: UX, 1: CX)
        const adminUx = row[0];
        const adminCx = row[1];
        if (adminUx && adminCx && adminUx.toUpperCase() !== "UX") {
          newMap[adminUx.toLowerCase()] = {
            ux: adminUx,
            uxLower: adminUx.toLowerCase(),
            cxHash: hashPassword(adminCx),
            role: "admin",
            nombre: adminUx,
          };
        }

        // 2. Table Clientes (cols 3: UX, 4: CX)
        const clientUx = row[3]?.trim();
        const clientCx = row[4]?.trim();
        if (clientUx && clientCx && clientUx.toUpperCase() !== "UX") {
          const clientRec: UserRecord = {
            ux: clientUx,
            uxLower: clientUx.toLowerCase(),
            cxHash: hashPassword(clientCx),
            cxRaw: clientCx,
            role: "client",
            clientId: clientUx,
            nombre: `Cliente ${clientUx}`,
          };
          newMap[clientUx.toLowerCase()] = clientRec;
          newMap[clientUx.replace(/\s+/g, "").toLowerCase()] = clientRec;
          if (clientUx.toUpperCase().startsWith("CLI-")) {
            const stripped = clientUx.replace(/^CLI-0*/i, "CLI-");
            newMap[stripped.toLowerCase()] = clientRec;
          }
        }

        // 3. Table Socios (cols 6: NOMBRE, 7: UX, 8: CX) - Personal Activo
        const socioNombre = row[6];
        const socioUx = row[7];
        const socioCx = row[8];
        if (socioUx && socioCx && socioUx.toUpperCase() !== "UX") {
          const finalNombre = socioNombre || socioUx;
          newMap[socioUx.toLowerCase()] = {
            ux: socioUx,
            uxLower: socioUx.toLowerCase(),
            cxHash: hashPassword(socioCx),
            role: "nurse",
            nurseId: socioUx,
            nombre: finalNombre,
          };

          newSocios.push({
            id: socioUx,
            ux: socioUx,
            nombre: finalNombre,
          });
        }
      }

      userRecordsMap = newMap;
      sociosListCache = newSocios;
      lastFetchTime = now;
      console.log(
        `[AUTH] Synced ${Object.keys(newMap).length} user records across 3 tables (Administrativo, Clientes, Socios). ${newSocios.length} active socios/staff registered.`
      );
    }
  } catch (err) {
    console.error("[AUTH] Error fetching sheet server-side:", err);
  }

  return { userRecordsMap, sociosListCache };
}

// API endpoint to fetch active Socios (Personal Activo que trabaja en CuidartePachuca)
app.get("/api/socios", async (req, res) => {
  const { sociosListCache } = await syncUsersDatabase();
  return res.json({
    success: true,
    socios: sociosListCache,
  });
});

// API endpoint for secure encrypted login validation
app.post("/api/login", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "anonymous";
  const { ux, cx } = req.body || {};

  if (!ux || !cx || typeof ux !== "string" || typeof cx !== "string") {
    return res.status(400).json({
      success: false,
      message: "Por favor ingresa usuario y contraseña válidos.",
    });
  }

  const cleanUx = ux.trim();
  const cleanCx = cx.trim();
  const cleanUxLower = cleanUx.toLowerCase();
  const rateLimitKey = `${ip}:${cleanUxLower}`;

  // 1. Check Rate Limiter (Brute force protection)
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: `Demasiados intentos fallidos. Por seguridad, el acceso está bloqueado temporalmente. Intenta de nuevo en ${rateCheck.waitSeconds || 60} segundos.`,
    });
  }

  // 2. Super Admin Check with constant-time verification
  const isSuperAdminUx =
    cleanUxLower === "nestor moedano" ||
    cleanUxLower === "nestormoedano" ||
    cleanUxLower === "nestor";

  if (isSuperAdminUx) {
    const inputHash = hashPassword(cleanCx);
    const expectedHash = hashPassword("Ue18195073");
    const bufInput = Buffer.from(inputHash);
    const bufExpected = Buffer.from(expectedHash);

    if (bufInput.length === bufExpected.length && crypto.timingSafeEqual(bufInput, bufExpected)) {
      clearRateLimit(rateLimitKey);
      const token = crypto
        .createHmac("sha256", AUTH_SALT)
        .update(`superadmin:${cleanUxLower}:${Date.now()}`)
        .digest("hex");

      return res.json({
        success: true,
        user: {
          username: "Nestor Moedano",
          nombre: "Néstor Fernando Miranda Moedano (Super Administrador)",
          role: "admin",
          isSuperAdmin: true,
          token,
        },
      });
    }
  }

  // 3. User Records check (from synchronized Google Sheet & verified records)
  const inputHash = hashPassword(cleanCx);
  const { userRecordsMap } = await syncUsersDatabase();
  
  // Look up by exact lower, trimmed, or stripped dashes/spaces
  const normalizedKey = cleanUxLower.replace(/\s+/g, "");
  const record = userRecordsMap[cleanUxLower] || userRecordsMap[normalizedKey];

  if (record) {
    const bufA = Buffer.from(record.cxHash);
    const bufB = Buffer.from(inputHash);

    // Also support direct match for default passwords if needed
    const isDirectMatch = record.cxRaw && (record.cxRaw.trim() === cleanCx || record.cxRaw.trim().toLowerCase() === cleanCx.toLowerCase());

    if ((bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) || isDirectMatch) {
      clearRateLimit(rateLimitKey);

      // Determine precise role
      let finalRole: "admin" | "client" | "nurse" | "ventas" | "atencion_clientes" = record.role;
      const uUpper = record.ux.toUpperCase();
      if (uUpper.startsWith("CLI-")) {
        finalRole = "client";
      } else if (uUpper.startsWith("SOCP-")) {
        finalRole = "nurse";
      } else if (uUpper.startsWith("VEN-") || uUpper.includes("VENTAS")) {
        finalRole = "ventas";
      } else if (uUpper.startsWith("ATC-") || uUpper.includes("ATENCION")) {
        finalRole = "atencion_clientes";
      }

      // Generate secure session token
      const token = crypto
        .createHmac("sha256", AUTH_SALT)
        .update(`${cleanUxLower}:${Date.now()}`)
        .digest("hex");

      return res.json({
        success: true,
        user: {
          username: record.ux,
          nombre: record.nombre || record.ux,
          role: finalRole,
          clientId: record.clientId || (finalRole === "client" ? record.ux : undefined),
          nurseId: record.nurseId || (finalRole === "nurse" ? record.ux : undefined),
          token,
        },
      });
    } else {
      const failInfo = recordFailedLogin(rateLimitKey);
      if (failInfo.isLocked) {
        return res.status(429).json({
          success: false,
          message: `Has alcanzado el límite de 15 intentos. Por seguridad, el acceso está bloqueado temporalmente por 2 minutos (${failInfo.waitSeconds || 120}s).`,
        });
      }
      return res.status(401).json({
        success: false,
        message: `Contraseña incorrecta. Te quedan ${failInfo.remaining} de 15 intentos antes de bloqueo temporal.`,
      });
    }
  }

  // If user was not found in Google Sheet, return notInSheet so client-side fallback can check Firestore database
  return res.status(404).json({
    success: false,
    notInSheet: true,
    message: "Usuario no encontrado en la base central de Google Sheets. Verificando base de datos local...",
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[SERVER] Fatal error starting server:", err);
});
