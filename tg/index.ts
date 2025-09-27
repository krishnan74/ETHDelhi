import express from "express";
import cors from "cors";
import { Wallet } from "./lib/Wallet";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize wallet service
const walletService = new Wallet();

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
