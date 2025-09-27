import CryptoJS from "crypto-js";

// Encryption key - in production, this should be stored securely (e.g., environment variables)
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here!";

/**
 * Encrypts a private key using AES encryption
 * @param privateKey - The private key to encrypt
 * @returns Encrypted private key as a string
 */
export function encryptPrivateKey(privateKey: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(
      privateKey,
      ENCRYPTION_KEY
    ).toString();
    return encrypted;
  } catch (error) {
    console.error("Error encrypting private key:", error);
    throw new Error("Failed to encrypt private key");
  }
}

/**
 * Decrypts a private key using AES decryption
 * @param encryptedPrivateKey - The encrypted private key
 * @returns Decrypted private key as a string
 */
export function decryptPrivateKey(encryptedPrivateKey: string): string {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedPrivateKey, ENCRYPTION_KEY);
    const privateKey = decrypted.toString(CryptoJS.enc.Utf8);

    if (!privateKey) {
      throw new Error("Failed to decrypt private key - invalid encrypted data");
    }

    return privateKey;
  } catch (error) {
    console.error("Error decrypting private key:", error);
    throw new Error("Failed to decrypt private key");
  }
}

/**
 * Generates a secure encryption key (for setup purposes)
 * @returns A secure 32-character encryption key
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}
