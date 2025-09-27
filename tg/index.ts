import express from "express";
import cors from "cors";
import { Wallet } from "./lib/Wallet";
import { SelfBackendVerifier, AllIds, DefaultConfigStore } from "@selfxyz/core";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize wallet service
const walletService = new Wallet();

// Initialize Self Protocol backend verifier
const selfBackendVerifier = new SelfBackendVerifier(
  "telegram-wallet-bot",
  process.env.SELF_URL || "http://localhost:3000" + "/api/verify",
  false, // mockPassport: false = mainnet, true = staging/testnet
  AllIds,
  new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: ["IRN", "PRK", "RUS", "SYR"],
    ofac: true,
  }),
  "uuid" // userIdentifierType
);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Wallet service is running" });
});

// Create or get wallet endpoint
app.post("/api/wallet", async (req, res) => {
  try {
    const { telegramId, telegramName } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: "telegramId is required" });
    }

    // Check if wallet already exists
    const exists = await walletService.walletExists(telegramId);

    if (exists) {
      // Get existing wallet
      const walletData = await walletService.getWallet(telegramId);
      res.json({
        success: true,
        message: "Welcome back!",
        wallet: {
          address: walletData.address,
          createdAt: walletData.createdAt,
          lastActive: walletData.lastActive,
        },
      });
    } else {
      // Create new wallet
      const walletData = await walletService.createWallet(
        telegramId,
        telegramName || "Unknown"
      );
      res.json({
        success: true,
        message: "New wallet created successfully!",
        wallet: {
          address: walletData.address,
          privateKey: walletData.privateKey, // Only returned on creation
        },
      });
    }
  } catch (error) {
    console.error("Error in wallet endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process wallet request",
    });
  }
});

// Get wallet details endpoint
app.get("/api/wallet/:telegramId", async (req, res) => {
  try {
    const { telegramId } = req.params;

    const walletData = await walletService.getWallet(telegramId);
    res.json({
      success: true,
      wallet: {
        address: walletData.address,
        telegramName: walletData.telegramName,
        createdAt: walletData.createdAt,
        lastActive: walletData.lastActive,
      },
    });
  } catch (error) {
    console.error("Error getting wallet:", error);
    res.status(404).json({
      success: false,
      error: "Wallet not found for this Telegram ID",
    });
  }
});

// Check if wallet exists endpoint
app.get("/api/wallet/:telegramId/exists", async (req, res) => {
  try {
    const { telegramId } = req.params;

    const exists = await walletService.walletExists(telegramId);
    res.json({
      success: true,
      exists,
    });
  } catch (error) {
    console.error("Error checking wallet existence:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check wallet existence",
    });
  }
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

// Self Protocol verification endpoint
app.post("/api/verify", async (req, res) => {
  try {
    // Extract data from the request
    const { attestationId, proof, publicSignals, userContextData } = req.body;

    // Verify all required fields are present
    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return res.status(400).json({
        success: false,
        error:
          "Proof, publicSignals, attestationId and userContextData are required",
      });
    }

    // Verify the proof
    const result = await selfBackendVerifier.verify(
      attestationId, // Document type (1 = passport, 2 = EU ID card, 3 = Aadhaar)
      proof, // The zero-knowledge proof
      publicSignals, // Public signals array
      userContextData // User context data (hex string)
    );

    // Check if verification was successful
    if (result.isValidDetails.isValid) {
      // Verification successful - process the result
      res.json({
        success: true,
        status: "verified",
        result: true,
        credentialSubject: result.discloseOutput,
        details: result.isValidDetails,
      });
    } else {
      // Verification failed
      res.status(400).json({
        success: false,
        status: "verification_failed",
        result: false,
        reason: "Verification failed",
        error_code: "VERIFICATION_FAILED",
        details: result.isValidDetails,
      });
    }
  } catch (error) {
    console.error("Error in verification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during verification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Wallet service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/wallet - Create or get wallet`);
  console.log(`  GET /api/wallet/:telegramId - Get wallet details`);
  console.log(`  GET /api/wallet/:telegramId/exists - Check if wallet exists`);
  console.log(`  POST /api/verify - Self Protocol verification`);
});

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("Shutting down server...");
  process.exit(0);
});

process.once("SIGTERM", () => {
  console.log("Shutting down server...");
  process.exit(0);
});
