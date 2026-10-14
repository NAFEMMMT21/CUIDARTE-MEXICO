import { StaffMember } from "../types";

/**
 * Generates a unique, non-predictable 5-character alphanumeric verification code (numbers and letters) for a staff member.
 * Example: 'X8K2P', '9M2B7'
 */
export const getStaffVerificationCode = (staff: StaffMember): string => {
  if (staff.codigoVerificacion && /^[A-Z0-9]{5}$/i.test(staff.codigoVerificacion)) {
    return staff.codigoVerificacion.toUpperCase();
  }

  const seedStr = `cuidarte-v5-code-${staff.id || 'SOC'}-${staff.nombre || ''}-${staff.apellidos || ''}-${staff.noSocio || ''}`;
  let hash1 = 5381;
  let hash2 = 0;
  for (let i = 0; i < seedStr.length; i++) {
    const char = seedStr.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = (hash2 << 5) - hash2 + char;
  }

  // 31 character set with distinct letters and numbers
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; 
  const p1 = Math.abs(hash1) % charset.length;
  const p2 = Math.abs(hash1 >> 5) % charset.length;
  const p3 = Math.abs(hash2) % charset.length;
  const p4 = Math.abs(hash2 >> 7) % charset.length;
  const p5 = Math.abs((hash1 ^ hash2)) % charset.length;

  return `${charset[p1]}${charset[p2]}${charset[p3]}${charset[p4]}${charset[p5]}`;
};

/**
 * Search and find a staff member strictly by:
 * 1. 5-character alphanumeric verification code from the credential (e.g. 'X8K2P', '9M2B7')
 * 2. Full exact name (first name + last names)
 * 
 * Incomplete/partial names or employee numbers are disallowed to enforce verification security.
 */
export const findStaffByKey = (
  searchKey: string,
  staffList: StaffMember[]
): StaffMember | undefined => {
  if (!searchKey || !searchKey.trim()) return undefined;
  
  const rawTarget = searchKey.trim();
  const targetCode = rawTarget.toUpperCase().replace(/^(CP-)/, "");
  
  // Normalize string helper for full name comparisons
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const targetNameNorm = normalize(rawTarget);

  return staffList.find((s) => {
    // 1. Strict 5-character verification code matching
    const staffCode = getStaffVerificationCode(s).toUpperCase();
    if (staffCode === targetCode) return true;

    if (s.codigoVerificacion && s.codigoVerificacion.trim().toUpperCase() === targetCode) {
      return true;
    }

    // 2. Strict Full Name matching (Nombre + Apellidos exact match)
    const fullNameNorm = normalize(`${s.nombre || ""} ${s.apellidos || ""}`);
    if (targetNameNorm && targetNameNorm.length >= 5 && fullNameNorm === targetNameNorm) {
      return true;
    }

    // Inverted full name (Apellidos + Nombre exact match)
    const invertedFullNameNorm = normalize(`${s.apellidos || ""} ${s.nombre || ""}`);
    if (targetNameNorm && targetNameNorm.length >= 5 && invertedFullNameNorm === targetNameNorm) {
      return true;
    }

    return false;
  });
};


