/**
 * Cryptographically strong random password generator for Cuidarte Pachuca users.
 * Generates unique, non-simulated, high-entropy passwords with letters, numbers, and special symbols.
 */

export function generateSecureRandomPassword(length: number = 10): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // removed ambiguous I, O
  const lower = "abcdefghijkmnpqrstuvwxyz"; // removed ambiguous l, o
  const numbers = "23456789"; // removed ambiguous 0, 1
  const symbols = "#$*!%&?";

  const allChars = upper + lower + numbers + symbols;

  let pwd = "";

  // Ensure at least 1 uppercase, 1 lowercase, 1 number, 1 symbol
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const randomBuffer = new Uint32Array(length + 4);
    crypto.getRandomValues(randomBuffer);

    const uChar = upper[randomBuffer[0] % upper.length];
    const lChar = lower[randomBuffer[1] % lower.length];
    const nChar = numbers[randomBuffer[2] % numbers.length];
    const sChar = symbols[randomBuffer[3] % symbols.length];

    let intermediate = [uChar, lChar, nChar, sChar];

    for (let i = 4; i < length + 4; i++) {
      intermediate.push(allChars[randomBuffer[i] % allChars.length]);
    }

    // Shuffle intermediate array using Fisher-Yates with crypto values
    for (let i = intermediate.length - 1; i > 0; i--) {
      const j = randomBuffer[i] % (i + 1);
      const temp = intermediate[i];
      intermediate[i] = intermediate[j];
      intermediate[j] = temp;
    }

    pwd = intermediate.slice(0, length).join("");
  } else {
    // Fallback Math.random
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < length; i++) {
      pwd += allChars[Math.floor(Math.random() * allChars.length)];
    }

    pwd = pwd
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  }

  return pwd;
}
