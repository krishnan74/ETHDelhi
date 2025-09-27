import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import axios from "axios";
import * as dotenv from "dotenv";
import { VAULT_DATA, calculateOptimizedSplit } from "./lib/vaultData";

// Load environment variables
dotenv.config();

const BOT_TOKEN =
  process.env.BOT_TOKEN || "8388344678:AAGNF_q8if_ZI_iTakTGISEXxu-EAN3tERo";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const bot = new Telegraf(BOT_TOKEN);

// API client helper
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Start command - create or get wallet
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const telegramName = ctx.from.username || ctx.from.first_name || "Unknown";

    // Call the API to create or get wallet
    const response = await apiClient.post("/api/wallet", {
      telegramId,
      telegramName,
    });

    if (response.data.success) {
      const { wallet, message } = response.data;

      if (wallet.privateKey) {
        // New wallet created
        ctx.reply(
          `🎉 ${message}\n\n` +
            `📍 Wallet Address: <code>${wallet.address}</code>\n` +
            `🔑 Private Key: <code>${wallet.privateKey}</code>\n\n` +
            `⚠️ <b>IMPORTANT</b>: Save your private key securely! It won't be shown again.`,
          { parse_mode: "HTML" }
        );
      } else {
        // Existing wallet
        ctx.reply(
          `👋 ${message}\n\n` +
            `📍 Wallet Address: <code>${wallet.address}</code>\n` +
            `📅 Created: ${new Date(wallet.createdAt).toLocaleDateString()}\n` +
            `🕒 Last Active: ${new Date(
              wallet.lastActive
            ).toLocaleDateString()}`,
          { parse_mode: "HTML" }
        );
      }
    }
  } catch (error) {
    console.error("Error in start command:", error);
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.error || "API request failed";
      ctx.reply(`❌ Error: ${errorMessage}`);
    } else {
      ctx.reply("❌ Sorry, there was an error processing your request.");
    }
  }
});

// Get wallet command
bot.command("wallet", async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    // Call the API to get wallet details
    const response = await apiClient.get(`/api/wallet/${telegramId}`);

    if (response.data.success) {
      const { wallet } = response.data;
      ctx.reply(
        `💼 Your Wallet Details:\n\n` +
          `📍 Address: \`${wallet.address}\`\n` +
          `👤 Name: ${wallet.telegramName}\n` +
          `📅 Created: ${new Date(wallet.createdAt).toLocaleDateString()}\n` +
          `🕒 Last Active: ${new Date(wallet.lastActive).toLocaleDateString()}`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("Error getting wallet:", error);
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      ctx.reply("❌ You don't have a wallet yet. Use /start to create one.");
    } else {
      ctx.reply("❌ Error retrieving wallet information.");
    }
  }
});

// Check wallet exists command
bot.command("exists", async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    // Call the API to check if wallet exists
    const response = await apiClient.get(`/api/wallet/${telegramId}/exists`);

    if (response.data.success) {
      const { exists } = response.data;
      if (exists) {
        ctx.reply("✅ You have a wallet! Use /wallet to see details.");
      } else {
        ctx.reply("❌ You don't have a wallet yet. Use /start to create one.");
      }
    }
  } catch (error) {
    console.error("Error checking wallet existence:", error);
    ctx.reply("❌ Error checking wallet status.");
  }
});

// Health check command
bot.command("health", async (ctx) => {
  try {
    const response = await apiClient.get("/health");
    if (response.data.status === "OK") {
      ctx.reply("✅ API server is running and healthy!");
    } else {
      ctx.reply("⚠️ API server responded with unexpected status.");
    }
  } catch (error) {
    console.error("Error checking health:", error);
    ctx.reply("❌ API server is not responding.");
  }
});

// List vaults command
bot.command("vaults", async (ctx) => {
  try {
    let message = "🏦 <b>Available USDC Vaults:</b>\n\n";

    // Sort by APY (highest first)
    const sortedVaults = [...VAULT_DATA].sort((a, b) => b.apy - a.apy);

    sortedVaults.forEach((vault, index) => {
      const riskEmoji =
        vault.risk === "Low" ? "🟢" : vault.risk === "Medium" ? "🟡" : "🔴";
      message += `${index + 1}. <b>${vault.name}</b> (${vault.symbol})\n`;
      message += `   📊 APY: <b>${vault.apy}%</b> ${riskEmoji} ${vault.risk} Risk\n`;
      message += `   🏛️ Protocol: ${vault.protocol}\n\n`;
    });

    message +=
      "💡 Use <code>/optimize [amount]</code> to get an optimized investment split!";

    ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error listing vaults:", error);
    ctx.reply("❌ Error retrieving vault information.");
  }
});

// Optimize investment command
bot.command("optimize", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const amount = parseFloat(messageText.split(" ")[1]) || 100; // Default to $100

    if (amount <= 0) {
      ctx.reply("❌ Please enter a valid amount greater than 0.");
      return;
    }

    const optimizedSplit = calculateOptimizedSplit(amount, 3);
    const totalExpectedYield = optimizedSplit.reduce(
      (sum, split) => sum + split.expectedYield,
      0
    );
    const overallAPY = (totalExpectedYield / amount) * 100;

    let message = `💰 <b>Optimized Investment Split ($${amount}):</b>\n\n`;

    optimizedSplit.forEach((split, index) => {
      const riskEmoji =
        split.vault.risk === "Low"
          ? "🟢"
          : split.vault.risk === "Medium"
          ? "🟡"
          : "🔴";
      message += `${index + 1}. <b>${split.vault.name}</b>\n`;
      message += `   💵 Amount: $${split.amount.toFixed(2)} (${
        split.percentage
      }%)\n`;
      message += `   📊 APY: ${split.vault.apy}% ${riskEmoji}\n`;
      message += `   🎯 Expected Yield: $${split.expectedYield.toFixed(2)}\n\n`;
    });

    message += `📈 <b>Total Expected Annual Yield: $${totalExpectedYield.toFixed(
      2
    )}</b>\n`;
    message += `📊 <b>Overall APY: ${overallAPY.toFixed(2)}%</b>\n\n`;
    message +=
      "🗳️ Use <code>/poll</code> to create a group poll for investment confirmation!";

    ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error optimizing investment:", error);
    ctx.reply("❌ Error calculating optimized split.");
  }
});

// Create investment poll command
bot.command("poll", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const amount = parseFloat(messageText.split(" ")[1]) || 100;

    const optimizedSplit = calculateOptimizedSplit(amount, 3);
    const totalExpectedYield = optimizedSplit.reduce(
      (sum, split) => sum + split.expectedYield,
      0
    );
    const overallAPY = (totalExpectedYield / amount) * 100;

    const question =
      `🗳️ Investment Proposal: $${amount} Split Strategy\n\n` +
      `📊 Overall APY: ${overallAPY.toFixed(2)}%\n` +
      `💰 Expected Annual Yield: $${totalExpectedYield.toFixed(2)}\n\n` +
      `Should we proceed with this investment strategy?`;

    const options = [
      "✅ Yes, invest now",
      "❌ No, don't invest",
      "🤔 Need more discussion",
      "📊 Show detailed breakdown",
    ];

    // Create poll
    await ctx.replyWithPoll(question, options, {
      is_anonymous: false,
      allows_multiple_answers: false,
      explanation:
        "This poll will help the group decide on the proposed investment strategy.",
    });

    // Also send the detailed breakdown
    let breakdown = `📋 <b>Detailed Investment Breakdown:</b>\n\n`;
    optimizedSplit.forEach((split, index) => {
      const riskEmoji =
        split.vault.risk === "Low"
          ? "🟢"
          : split.vault.risk === "Medium"
          ? "🟡"
          : "🔴";
      breakdown += `${index + 1}. <b>${split.vault.name}</b>\n`;
      breakdown += `   💵 $${split.amount.toFixed(2)} (${split.percentage}%)\n`;
      breakdown += `   📊 ${split.vault.apy}% APY ${riskEmoji}\n\n`;
    });

    ctx.reply(breakdown, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error creating poll:", error);
    ctx.reply("❌ Error creating investment poll.");
  }
});

// Help command
bot.help((ctx) =>
  ctx.reply(
    "🤖 <b>Wallet Bot Commands:</b>\n\n" +
      "🚀 /start - Create or access your wallet\n" +
      "💼 /wallet - View your wallet details\n" +
      "❓ /exists - Check if you have a wallet\n" +
      "🏥 /health - Check API server status\n\n" +
      "🏦 <b>Investment Commands:</b>\n" +
      "📊 /vaults - List all available USDC vaults with APY\n" +
      "💰 /optimize [amount] - Get optimized investment split (default: $100)\n" +
      "🗳️ /poll [amount] - Create group poll for investment confirmation\n\n" +
      "❓ /help - Show this help message\n\n" +
      "The bot connects to the wallet API server to manage your Ethereum wallet securely.",
    { parse_mode: "HTML" }
  )
);

// Handle stickers and other messages
bot.on(message("sticker"), (ctx) => ctx.reply("👍"));
bot.hears("hi", (ctx) =>
  ctx.reply("Hey there! 👋 Use /start to create your wallet.")
);

// Error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ An unexpected error occurred. Please try again.");
});

// Launch bot
bot.launch();

console.log(
  "🤖 Telegram bot is running and connected to API server at:",
  API_BASE_URL
);

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
