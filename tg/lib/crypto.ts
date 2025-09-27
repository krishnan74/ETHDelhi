import CryptoJS from "crypto-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Encryption key - in production, this should be stored securely (e.g., environment variables)
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "SOME PASSWORD WITH ENCRYPT";

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
    // Check if the encrypted data looks valid
    if (!encryptedPrivateKey || encryptedPrivateKey.length < 10) {
      throw new Error("Invalid encrypted data format");
    }

    const decrypted = CryptoJS.AES.decrypt(encryptedPrivateKey, ENCRYPTION_KEY);
    const privateKey = decrypted.toString(CryptoJS.enc.Utf8);

    if (!privateKey || privateKey.length === 0) {
      throw new Error(
        "Failed to decrypt private key - invalid encryption key or corrupted data"
      );
    }

    // Validate that it looks like a private key (should start with 0x and be 66 characters)
    if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
      throw new Error(
        "Decrypted data does not appear to be a valid private key"
      );
    }

    return privateKey;
  } catch (error) {
    console.error("Error decrypting private key:", error);
    console.error(
      "Encryption key being used:",
      ENCRYPTION_KEY.substring(0, 10) + "..."
    );
    throw new Error(
      `Failed to decrypt private key: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Generates a secure encryption key (for setup purposes)
 * @returns A secure 32-character encryption key
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}

/**
 * Attempts to decrypt with multiple keys (for migration purposes)
 * @param encryptedPrivateKey - The encrypted private key
 * @param keys - Array of potential encryption keys to try
 * @returns Decrypted private key or null if none work
 */
export function decryptWithMultipleKeys(
  encryptedPrivateKey: string,
  keys: string[]
): string | null {
  for (const key of keys) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedPrivateKey, key);
      const privateKey = decrypted.toString(CryptoJS.enc.Utf8);

      if (
        privateKey &&
        privateKey.startsWith("0x") &&
        privateKey.length === 66
      ) {
        return privateKey;
      }
    } catch (error) {
      // Continue to next key
      continue;
    }
  }
  return null;
}
