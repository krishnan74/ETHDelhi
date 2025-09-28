import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import axios from "axios";
import * as dotenv from "dotenv";
import {
  getVaultDataByRisk,
  getVaultDataPaginated,
  calculateOptimizedSplit,
} from "./lib/vaultData";
import { MorphoDepositService } from "./lib/morphoDepositService";
import { IntermediaryService } from "./lib/intermediaryService";

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

// Initialize vault optimization agent
const vaultAgent = new VaultOptimizationAgent();

// Initialize deposit service
const depositService = new MorphoDepositService();

// Initialize intermediary service
const intermediaryService = new IntermediaryService();

// Helper function to create investment plan and poll
async function createInvestmentPlanAndPoll(
  ctx: any,
  amount: number,
  riskPreference: string
) {
  try {
    // Get optimized split
    const riskLevel =
      riskPreference === "Conservative"
        ? "Low"
        : riskPreference === "Aggressive"
        ? "High"
        : "Medium";
    const vaultData = await getVaultDataByRisk(riskLevel);
    const optimizedSplit = calculateOptimizedSplit(amount, 3, vaultData);

    // Get group members (simplified - in real implementation, get from group)
    const groupMembers = [ctx.from.id.toString()]; // For now, just the current user

    // Create investment plan
    const planResult = await intermediaryService.createInvestmentPlan(
      optimizedSplit,
      groupMembers,
      amount,
      ctx.from.id.toString()
    );

    if (!planResult.success) {
      ctx.reply(`❌ Failed to create investment plan: ${planResult.message}`);
      return;
    }

    // Create poll with investment details
    const totalExpectedYield = optimizedSplit.reduce(
      (sum, split) => sum + split.expectedYield,
      0
    );
    const overallAPY = (totalExpectedYield / amount) * 100;
    const memberContribution = amount / groupMembers.length;

    const question =
      `🗳️ Investment Proposal: $${amount} Split Strategy\n\n` +
      `📊 Overall APY: ${overallAPY.toFixed(2)}%\n` +
      `💰 Expected Annual Yield: $${totalExpectedYield.toFixed(2)}\n` +
      `👥 Member Contribution: $${memberContribution.toFixed(2)} each\n\n` +
      `Should we proceed with this investment strategy?`;

    const options = [
      "✅ Yes, invest now",
      "❌ No, cancel investment",
      "⏰ Maybe later",
    ];

    // Send poll
    const poll = await ctx.replyWithPoll(question, options, {
      is_anonymous: false,
      allows_multiple_answers: false,
      explanation: `Investment Plan ID: ${planResult.planId}\n\nThis poll will automatically execute the investment if approved by majority.`,
      explanation_parse_mode: "HTML",
    });

    // Store poll and plan info for later processing
    // In a real implementation, store this in a database
    console.log(`Created poll ${poll.poll.id} for plan ${planResult.planId}`);
  } catch (error) {
    console.error("Error creating investment plan and poll:", error);
    ctx.reply("❌ Error creating investment plan. Please try again.");
  }
}

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

// List vaults command with risk filtering and pagination
bot.command("vaults", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");
    const riskLevel = args[1] || "Medium"; // Default to Medium risk
    const page = parseInt(args[2]) || 1; // Default to page 1

    // Validate risk level
    const validRiskLevels = ["Low", "Medium", "High"];
    const normalizedRiskLevel = validRiskLevels.includes(riskLevel)
      ? riskLevel
      : "Medium";

    // Send loading message
    ctx.reply(`🔄 <b>Fetching ${normalizedRiskLevel} risk vaults...</b>`, {
      parse_mode: "HTML",
    });

    // Fetch paginated vault data
    const result = await getVaultDataPaginated(
      normalizedRiskLevel as "Low" | "Medium" | "High",
      page,
      10
    );

    let message = `🏦 <b>${normalizedRiskLevel} Risk Vaults (Page ${page}):</b>\n\n`;

    if (result.vaults.length === 0) {
      message += "No vaults found for this risk level.\n\n";
    } else {
      result.vaults.forEach((vault, index) => {
        const riskEmoji =
          vault.risk === "Low" ? "🟢" : vault.risk === "Medium" ? "🟡" : "🔴";
        const globalIndex = (page - 1) * 10 + index + 1;

        message += `${globalIndex}. <b>${vault.name}</b> (${vault.symbol})\n`;
        message += `   📊 APY: <b>${vault.apy.toFixed(2)}%</b> ${riskEmoji} ${
          vault.risk
        } Risk\n`;
        message += `   🏛️ Protocol: ${vault.protocol}\n`;
        if (vault.totalAssetsUsd) {
          message += `   💰 TVL: $${parseFloat(
            vault.totalAssetsUsd
          ).toLocaleString()}\n`;
        }
        message += `\n`;
      });
    }

    // Add pagination info
    if (result.hasMore) {
      message += `📄 <b>Page ${page}</b> | Use <code>/vaults ${normalizedRiskLevel} ${
        page + 1
      }</code> for next page\n\n`;
    } else if (page > 1) {
      message += `📄 <b>Page ${page}</b> | Use <code>/vaults ${normalizedRiskLevel} ${
        page - 1
      }</code> for previous page\n\n`;
    }

    message += `💡 <b>Usage:</b>\n`;
    message += `• <code>/vaults [Low|Medium|High] [page]</code>\n`;
    message += `• <code>/optimize [amount] [risk]</code> for AI optimization`;

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

    // Automatically create investment plan and poll
    await createInvestmentPlanAndPoll(ctx, amount, normalizedRiskPreference);
  } catch (error) {
    console.error("Error optimizing investment:", error);

    // Fallback to original algorithm if AI fails
    try {
      const messageText = ctx.message.text;
      const amount = parseFloat(messageText.split(" ")[1]) || 100;

      ctx.reply("⚠️ AI analysis failed, using fallback algorithm...", {
        parse_mode: "HTML",
      });

      const riskLevel = "Medium"; // Default to Medium for fallback
      const vaultData = await getVaultDataByRisk(riskLevel);
      const optimizedSplit = calculateOptimizedSplit(amount, 3, vaultData);
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

    const riskLevel = "Medium"; // Default to Medium for poll command
    const vaultData = await getVaultDataByRisk(riskLevel);
    const optimizedSplit = calculateOptimizedSplit(amount, 3, vaultData);
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

// Deposit command
bot.command("deposit", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");

    if (args.length < 3) {
      ctx.reply(
        "❌ <b>Usage:</b> <code>/deposit [vault_name] [amount]</code>\n\n" +
          "Example: <code>/deposit dForce USDC 100</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    const vaultName = args.slice(1, -1).join(" "); // Everything except last arg
    const amount = args[args.length - 1]; // Last arg is amount

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      ctx.reply("❌ Please enter a valid amount greater than 0.");
      return;
    }

    const telegramId = ctx.from.id.toString();

    // Send loading message
    ctx.reply("🔄 <b>Finding vault and preparing deposit...</b>", {
      parse_mode: "HTML",
    });

    // Get vault data to find the vault
    const vaultData = await getVaultDataByRisk("Medium"); // Search in medium risk first
    const vault = vaultData.find(
      (v) =>
        v.name.toLowerCase().includes(vaultName.toLowerCase()) ||
        v.symbol.toLowerCase().includes(vaultName.toLowerCase())
    );

    if (!vault) {
      ctx.reply(
        `❌ Vault "${vaultName}" not found.\n\n` +
          "💡 Use <code>/vaults</code> to see available vaults.",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (!vault.underlyingAsset) {
      ctx.reply("❌ Deposit information not available for this vault.");
      return;
    }

    // Show vault info and confirm
    const vaultInfo = depositService.getVaultDepositInfo(vault);
    const confirmMessage =
      `📋 <b>Deposit Confirmation</b>\n\n` +
      `${vaultInfo}\n\n` +
      `💰 <b>Amount to Deposit:</b> ${amount} ${vault.underlyingAsset.symbol}\n\n` +
      `⚠️ <b>This will execute a real transaction on the blockchain.</b>\n\n` +
      `Type <code>/confirm_deposit ${vault.name} ${amount}</code> to proceed.`;

    ctx.reply(confirmMessage, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error in deposit command:", error);
    ctx.reply("❌ Error processing deposit request. Please try again.");
  }
});

// Confirm deposit command
bot.command("confirm_deposit", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");

    if (args.length < 3) {
      ctx.reply("❌ Invalid confirmation format.");
      return;
    }

    const vaultName = args.slice(1, -1).join(" ");
    const amount = args[args.length - 1];
    const telegramId = ctx.from.id.toString();

    // Send processing message
    ctx.reply("🔄 <b>Processing deposit transaction...</b>", {
      parse_mode: "HTML",
    });

    // Get vault data
    const vaultData = await getVaultDataByRisk("Medium");
    const vault = vaultData.find(
      (v) =>
        v.name.toLowerCase().includes(vaultName.toLowerCase()) ||
        v.symbol.toLowerCase().includes(vaultName.toLowerCase())
    );

    if (!vault) {
      ctx.reply("❌ Vault not found.");
      return;
    }

    // Execute deposit
    const result = await depositService.depositToVault(
      telegramId,
      vault,
      amount
    );

    if (result.success) {
      const successMessage =
        `✅ <b>Deposit Successful!</b>\n\n` +
        `🏦 Vault: ${vault.name}\n` +
        `💰 Amount: ${amount} ${vault.underlyingAsset?.symbol}\n` +
        `📊 APY: ${vault.apy.toFixed(2)}%\n` +
        `🔗 Transaction: <code>${result.transactionHash}</code>\n\n` +
        `💡 Your deposit is now earning ${vault.apy.toFixed(2)}% APY!`;

      ctx.reply(successMessage, { parse_mode: "HTML" });
    } else {
      const errorMessage =
        `❌ <b>Deposit Failed</b>\n\n` +
        `Error: ${result.message}\n\n` +
        `Please check your balance and try again.`;

      ctx.reply(errorMessage, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Error in confirm_deposit command:", error);
    ctx.reply("❌ Error executing deposit. Please try again.");
  }
});

// Execute investment command (for poll results)
bot.command("execute_investment", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");

    if (args.length < 2) {
      ctx.reply("❌ Usage: /execute_investment [plan_id]");
      return;
    }

    const planId = parseInt(args[1]);
    if (isNaN(planId)) {
      ctx.reply("❌ Invalid plan ID");
      return;
    }

    // Check if plan can be executed
    const canExecute = await intermediaryService.canExecutePlan(planId);
    if (!canExecute) {
      ctx.reply(
        "❌ Investment plan cannot be executed yet. Not all members have contributed."
      );
      return;
    }

    // Send processing message
    ctx.reply("🔄 <b>Executing investment plan...</b>", { parse_mode: "HTML" });

    // Execute the investment plan
    const result = await intermediaryService.executeInvestmentPlan(
      planId,
      ctx.from.id.toString()
    );

    if (result.success) {
      const successMessage =
        `✅ <b>Investment Executed Successfully!</b>\n\n` +
        `📋 Plan ID: ${planId}\n` +
        `💰 Funds have been distributed to the selected vaults\n` +
        `📊 Your investment is now earning yield!\n\n` +
        `💡 Check your vault positions to monitor performance.`;

      ctx.reply(successMessage, { parse_mode: "HTML" });
    } else {
      const errorMessage =
        `❌ <b>Investment Execution Failed</b>\n\n` +
        `Error: ${result.message}\n\n` +
        `Please try again or contact support.`;

      ctx.reply(errorMessage, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Error executing investment:", error);
    ctx.reply("❌ Error executing investment. Please try again.");
  }
});

// Contribute to investment plan command
bot.command("contribute", async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(" ");

    if (args.length < 3) {
      ctx.reply("❌ Usage: /contribute [plan_id] [amount]");
      return;
    }

    const planId = parseInt(args[1]);
    const amount = args[2];

    if (isNaN(planId) || isNaN(parseFloat(amount))) {
      ctx.reply("❌ Invalid plan ID or amount");
      return;
    }

    const telegramId = ctx.from.id.toString();

    // Get plan details
    const planDetails = await intermediaryService.getPlanDetails(planId);
    if (!planDetails) {
      ctx.reply("❌ Investment plan not found");
      return;
    }

    // For simplicity, assume USDC token (6 decimals)
    const tokenAddress = "0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C"; // USDC address
    const decimals = 6;

    // Send processing message
    ctx.reply("🔄 <b>Processing contribution...</b>", { parse_mode: "HTML" });

    // Contribute to the plan
    const result = await intermediaryService.contributeToPlan(
      telegramId,
      planId,
      tokenAddress,
      amount,
      decimals
    );

    if (result.success) {
      const successMessage =
        `✅ <b>Contribution Successful!</b>\n\n` +
        `📋 Plan ID: ${planId}\n` +
        `💰 Amount: ${amount} USDC\n` +
        `🔗 Transaction: <code>${result.transactionHash}</code>\n\n` +
        `💡 Your contribution has been recorded. The investment will execute once all members contribute.`;

      ctx.reply(successMessage, { parse_mode: "HTML" });
    } else {
      const errorMessage =
        `❌ <b>Contribution Failed</b>\n\n` +
        `Error: ${result.message}\n\n` +
        `Please check your balance and try again.`;

      ctx.reply(errorMessage, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Error contributing to plan:", error);
    ctx.reply("❌ Error processing contribution. Please try again.");
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
      "📊 /vaults [risk] [page] - List vaults by risk level with pagination\n" +
      "💰 /optimize [amount] [risk] - AI-powered optimized investment split (auto-creates poll)\n" +
      "🗳️ /poll [amount] - Create group poll for investment confirmation\n" +
      "💳 /deposit [vault_name] [amount] - Deposit to a specific vault\n" +
      "✅ /confirm_deposit [vault_name] [amount] - Confirm deposit transaction\n" +
      "💵 /contribute [plan_id] [amount] - Contribute to an investment plan\n" +
      "🚀 /execute_investment [plan_id] - Execute investment plan after all contributions\n\n" +
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
