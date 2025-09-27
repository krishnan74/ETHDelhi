import { ethers } from "ethers";
import { supabase } from "../supabaseClient";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto";

export class Wallet {
  // Create a new wallet for a user
  public async createWallet(telegramId: string, telegramName: string) {
    try {
      // Generate a new wallet
      const wallet = ethers.Wallet.createRandom();

      // Encrypt the private key before storing
      const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);

      // Prepare user data for database
      const userData = {
        wallet: wallet.address,
        telegram_id: telegramId.toString(),
        telegram_name: telegramName,
        private_key: encryptedPrivateKey, // Store encrypted private key
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      };

      // Insert user into database
      const { data, error } = await supabase
        .from("users")
        .insert([userData])
        .select();

      if (error) {
        console.error("Database error:", error);
        throw new Error("Failed to save user to database");
      }

      console.log("Wallet created and user saved:", wallet.address);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  }

  // Get wallet by Telegram ID
  public async getWallet(telegramId: string) {
    try {
      // Query database for user with the given telegram ID
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId.toString())
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Wallet not found for this Telegram ID");
        }
        console.error("Database error:", error);
        throw new Error("Failed to retrieve wallet from database");
      }

      if (!data) {
        throw new Error("Wallet not found for this Telegram ID");
      }

      // Decrypt the private key
      const decryptedPrivateKey = decryptPrivateKey(data.private_key);

      // Create ethers wallet instance from the decrypted private key
      const wallet = new ethers.Wallet(decryptedPrivateKey);

      // Update last_active timestamp
      await supabase
        .from("users")
        .update({ last_active: new Date().toISOString() })
        .eq("telegram_id", telegramId.toString());

      console.log("Wallet retrieved successfully:", wallet.address);
      return {
        address: wallet.address,
        privateKey: decryptedPrivateKey,
        wallet: wallet, // Return the ethers wallet instance
        telegramName: data.telegram_name,
        createdAt: data.created_at,
        lastActive: data.last_active,
      };
    } catch (error) {
      console.error("Error retrieving wallet:", error);
      throw error;
    }
  }

  // Check if wallet exists for a Telegram ID
  public async walletExists(telegramId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", telegramId.toString())
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Database error:", error);
        throw new Error("Failed to check wallet existence");
      }

      return !!data;
    } catch (error) {
      console.error("Error checking wallet existence:", error);
      throw error;
    }
  }
}
