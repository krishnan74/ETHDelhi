import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import axios from "axios";
import * as dotenv from "dotenv";
import { VAULT_DATA, calculateOptimizedSplit } from "./lib/vaultData";
import { OneInchService } from "./lib/oneInchService";
import { OrderStatus } from "@1inch/fusion-sdk";
import { getUniversalLink } from "@selfxyz/core";
import { SelfAppBuilder } from "@selfxyz/qrcode";
import { ethers } from "ethers";
import { VaultOptimizationAgent } from "./lib/vaultAgent";

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

// Initialize 1inch service
const oneInchService = new OneInchService();

// Initialize vault optimization agent
const vaultAgent = new VaultOptimizationAgent();

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

// Optimize investment command with LangChain agent
bot.command("optimize", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");
    const amount = parseFloat(args[1]) || 100; // Default to $100
    const riskPreference = args[2] || "Balanced"; // Default to Balanced

    if (amount <= 0) {
      ctx.reply("❌ Please enter a valid amount greater than 0.");
      return;
    }

    // Validate risk preference
    const validRiskPreferences = ["Conservative", "Balanced", "Aggressive"];
    const normalizedRiskPreference = validRiskPreferences.includes(
      riskPreference
    )
      ? riskPreference
      : "Balanced";

    // Send initial message
    ctx.reply(
      "🤖 <b>AI Analysis in Progress...</b>\n\nAnalyzing vault data and optimizing portfolio allocation...",
      {
        parse_mode: "HTML",
      }
    );

    // Use LangChain agent for optimization
    const recommendation = await vaultAgent.getVaultRecommendations(
      amount,
      normalizedRiskPreference === "Conservative"
        ? "Low"
        : normalizedRiskPreference === "Aggressive"
        ? "High"
        : "Medium"
    );

    // Send the AI-generated recommendation
    ctx.reply(recommendation, { parse_mode: "HTML" });

    // Also send a follow-up with poll suggestion
    const pollMessage =
      `🗳️ <b>Ready to Invest?</b>\n\n` +
      `Use <code>/poll ${amount} ${normalizedRiskPreference}</code> to create a group poll for investment confirmation!`;

    ctx.reply(pollMessage, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error optimizing investment:", error);

    // Fallback to original algorithm if AI fails
    try {
      const messageText = ctx.message.text;
      const amount = parseFloat(messageText.split(" ")[1]) || 100;

      ctx.reply("⚠️ AI analysis failed, using fallback algorithm...", {
        parse_mode: "HTML",
      });

      const optimizedSplit = calculateOptimizedSplit(amount, 3);
      const totalExpectedYield = optimizedSplit.reduce(
        (sum, split) => sum + split.expectedYield,
        0
      );
      const overallAPY = (totalExpectedYield / amount) * 100;

      let message = `💰 <b>Fallback Investment Split ($${amount}):</b>\n\n`;

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
        message += `   🎯 Expected Yield: $${split.expectedYield.toFixed(
          2
        )}\n\n`;
      });

      message += `📈 <b>Total Expected Annual Yield: $${totalExpectedYield.toFixed(
        2
      )}</b>\n`;
      message += `📊 <b>Overall APY: ${overallAPY.toFixed(2)}%</b>\n\n`;
      message +=
        "🗳️ Use <code>/poll</code> to create a group poll for investment confirmation!";

      ctx.reply(message, { parse_mode: "HTML" });
    } catch (fallbackError) {
      console.error("Fallback algorithm also failed:", fallbackError);
      ctx.reply(
        "❌ Error calculating optimized split. Please try again later."
      );
    }
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

// Get swap quote command
bot.command("quote", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");

    if (args.length < 4) {
      ctx.reply(
        "❌ Usage: /quote <from_token> <to_token> <amount>\n\n" +
          "Example: /quote USDC BNB 10\n" +
          "Available tokens: USDC, BNB, USDT, WBNB"
      );
      return;
    }

    const fromToken = args[1].toUpperCase();
    const toToken = args[2].toUpperCase();
    const amount = parseFloat(args[3]);

    if (isNaN(amount) || amount <= 0) {
      ctx.reply("❌ Please enter a valid amount greater than 0.");
      return;
    }

    // Token address mapping
    const tokenAddresses: Record<string, string> = {
      USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      BNB: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      USDT: "0x55d398326f99059ff775485246999027b3197955",
      WBNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    };

    const fromTokenAddress = tokenAddresses[fromToken];
    const toTokenAddress = tokenAddresses[toToken];

    if (!fromTokenAddress || !toTokenAddress) {
      ctx.reply("❌ Invalid token. Available tokens: USDC, BNB, USDT, WBNB");
      return;
    }

    // Get user's wallet
    const telegramId = ctx.from.id.toString();
    const response = await apiClient.get(`/api/wallet/${telegramId}`);

    if (!response.data.success) {
      ctx.reply(
        "❌ You don't have a wallet yet. Use /start to create one first."
      );
      return;
    }

    const walletAddress = response.data.wallet.address;
    const parsedAmount = oneInchService.parseAmount(
      amount.toString(),
      fromTokenAddress
    );

    const quote = await oneInchService.getQuote({
      fromTokenAddress,
      toTokenAddress,
      amount: parsedAmount,
      walletAddress,
      source: "telegram-bot",
    });

    const fromTokenInfo = oneInchService.getTokenInfo(fromTokenAddress);
    const toTokenInfo = oneInchService.getTokenInfo(toTokenAddress);

    const message =
      `💱 <b>Swap Quote</b>\n\n` +
      `🔄 <b>Swap:</b> ${amount} ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}\n\n` +
      `📊 <b>Expected Output:</b>\n` +
      `• Minimum: ${oneInchService.formatAmount(
        quote.auctionEndAmount,
        toTokenAddress
      )} ${toTokenInfo.symbol}\n` +
      `• Maximum: ${oneInchService.formatAmount(
        quote.auctionStartAmount,
        toTokenAddress
      )} ${toTokenInfo.symbol}\n\n` +
      `💡 Use <code>/swap ${fromToken} ${toToken} ${amount}</code> to execute this swap.`;

    ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error getting quote:", error);
    ctx.reply("❌ Error getting swap quote. Please try again.");
  }
});

// Execute swap command
bot.command("swap", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");

    if (args.length < 4) {
      ctx.reply(
        "❌ Usage: /swap <from_token> <to_token> <amount>\n\n" +
          "Example: /swap USDC BNB 10\n" +
          "Available tokens: USDC, BNB, USDT, WBNB"
      );
      return;
    }

    const fromToken = args[1].toUpperCase();
    const toToken = args[2].toUpperCase();
    const amount = parseFloat(args[3]);

    if (isNaN(amount) || amount <= 0) {
      ctx.reply("❌ Please enter a valid amount greater than 0.");
      return;
    }

    // Token address mapping
    const tokenAddresses: Record<string, string> = {
      USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      BNB: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      USDT: "0x55d398326f99059ff775485246999027b3197955",
      WBNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    };

    const fromTokenAddress = tokenAddresses[fromToken];
    const toTokenAddress = tokenAddresses[toToken];

    if (!fromTokenAddress || !toTokenAddress) {
      ctx.reply("❌ Invalid token. Available tokens: USDC, BNB, USDT, WBNB");
      return;
    }

    // Get user's wallet
    const telegramId = ctx.from.id.toString();
    const response = await apiClient.get(`/api/wallet/${telegramId}`);

    if (!response.data.success) {
      ctx.reply(
        "❌ You don't have a wallet yet. Use /start to create one first."
      );
      return;
    }

    const walletData = response.data.wallet;
    const walletAddress = walletData.address;
    const parsedAmount = oneInchService.parseAmount(
      amount.toString(),
      fromTokenAddress
    );

    // Send initial message
    const processingMsg = await ctx.reply(
      "⏳ Processing swap... This may take a few minutes."
    );

    const result = await oneInchService.executeSwap(
      {
        fromTokenAddress,
        toTokenAddress,
        amount: parsedAmount,
        walletAddress,
        source: "telegram-bot",
      },
      walletData.privateKey || "" // This should be handled securely in production
    );

    const fromTokenInfo = oneInchService.getTokenInfo(fromTokenAddress);
    const toTokenInfo = oneInchService.getTokenInfo(toTokenAddress);

    let message =
      `💱 <b>Swap Result</b>\n\n` +
      `🔄 <b>Swap:</b> ${amount} ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}\n` +
      `📋 <b>Order Hash:</b> <code>${result.orderHash}</code>\n\n`;

    if (result.status === OrderStatus.Filled) {
      message += `✅ <b>Status:</b> Successfully filled\n`;
      if (result.fills && result.fills.length > 0) {
        message += `💰 <b>Received:</b> ${oneInchService.formatAmount(
          result.fills[0].amount,
          toTokenAddress
        )} ${toTokenInfo.symbol}\n`;
      }
    } else if (result.status === OrderStatus.Expired) {
      message += `⏰ <b>Status:</b> Order expired\n`;
    } else if (result.status === OrderStatus.Cancelled) {
      message += `❌ <b>Status:</b> Order cancelled\n`;
    }

    if (result.error) {
      message += `\n❌ <b>Error:</b> ${result.error}`;
    }

    // Edit the processing message
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      undefined,
      message,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    console.error("Error executing swap:", error);
    ctx.reply("❌ Error executing swap. Please try again.");
  }
});

// List available tokens command
bot.command("tokens", async (ctx) => {
  const message =
    `🪙 <b>Available Tokens for Swapping</b>\n\n` +
    `• <b>USDC</b> - USD Coin\n` +
    `• <b>BNB</b> - Binance Coin\n` +
    `• <b>USDT</b> - Tether USD\n` +
    `• <b>WBNB</b> - Wrapped BNB\n\n` +
    `💡 <b>Usage:</b>\n` +
    `• <code>/quote USDC BNB 10</code> - Get quote\n` +
    `• <code>/swap USDC BNB 10</code> - Execute swap\n\n` +
    `⚠️ <b>Note:</b> Swaps are executed on BSC network.`;

  ctx.reply(message, { parse_mode: "HTML" });
});

// Test 1inch API connection
bot.command("test1inch", async (ctx) => {
  try {
    const testMsg = await ctx.reply("🔍 Testing 1inch API connection...");

    const isConnected = await oneInchService.testConnection();

    if (isConnected) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        testMsg.message_id,
        undefined,
        "✅ 1inch API connection successful!\n\nYou can now use swap commands.",
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        testMsg.message_id,
        undefined,
        "❌ 1inch API connection failed.\n\nPlease check:\n• API key configuration\n• Network connectivity\n• 1inch service status",
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("Error testing 1inch connection:", error);
    ctx.reply("❌ Error testing 1inch API connection.");
  }
});

// Self Protocol verification command
bot.command("verify", async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    // Create SelfApp configuration
    const selfApp = new SelfAppBuilder({
      version: 2,
      appName: "Telegram Wallet Bot",
      scope: "telegram-wallet-bot",
      endpoint: `${process.env.SELF_URL || "http://localhost:3000"}/api/verify`,
      logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
      userId: ethers.ZeroAddress,
      endpointType: "staging_https",
      userIdType: "hex",
      userDefinedData: JSON.stringify({
        telegramUserId: telegramId,
        timestamp: new Date().toISOString(),
        purpose: "Identity verification for DeFi access",
      }),
      disclosures: {
        minimumAge: 18,
        nationality: true,
        excludedCountries: ["IRN", "PRK", "RUS", "SYR"],
        ofac: true,
      },
    }).build();

    // Generate the deep link
    const deeplink = getUniversalLink(selfApp);

    const message =
      `🆔 <b>Identity Verification</b>\n\n` +
      `🔗 <b>Verification Link:</b>\n` +
      `<a href="${deeplink}" target="_blank">${deeplink}</a>\n\n` +
      `📋 <b>Instructions:</b>\n` +
      `1. Tap the link above to open Self app\n` +
      `2. Complete your identity verification\n` +
      `3. Your verification will be processed automatically\n\n` +
      `⚠️ <b>Note:</b> This verification is required for DeFi access and investment features.`;

    ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error generating verification link:", error);
    ctx.reply("❌ Error generating verification link. Please try again.");
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
      "💰 /optimize [amount] [risk] - AI-powered optimized investment split (default: $100, Balanced)\n" +
      "🗳️ /poll [amount] - Create group poll for investment confirmation\n\n" +
      "💱 <b>Swap Commands:</b>\n" +
      "🪙 /tokens - List available tokens for swapping\n" +
      "📊 /quote &lt;from&gt; &lt;to&gt; &lt;amount&gt; - Get swap quote\n" +
      "🔄 /swap &lt;from&gt; &lt;to&gt; &lt;amount&gt; - Execute token swap\n" +
      "🔍 /test1inch - Test 1inch API connection\n\n" +
      "🆔 <b>Identity Verification:</b>\n" +
      "🔐 /verify - Identity verification with deeplink\n\n" +
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
