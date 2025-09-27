import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import * as dotenv from "dotenv";
import { Vault, VAULT_DATA } from "./vaultData";

// Load environment variables
dotenv.config();

// Simplified interfaces for the optimization result
export interface VaultAllocation {
  name: string;
  symbol: string;
  apy: number;
  risk: "Low" | "Medium" | "High";
  protocol: string;
  allocationPercentage: number;
  allocationAmount: number;
  expectedAnnualYield: number;
  riskAssessment: string;
}

export interface PortfolioMetrics {
  totalExpectedAPY: number;
  totalExpectedAnnualYield: number;
  riskScore: number;
  diversificationScore: number;
  liquidityScore: number;
  protocolDiversity: number;
}

export interface AlternativeStrategy {
  name: string;
  description: string;
  expectedAPY: number;
  riskLevel: string;
}

export interface VaultOptimizationResult {
  analysis: string;
  selectedVaults: VaultAllocation[];
  portfolioMetrics: PortfolioMetrics;
  recommendations: string[];
  alternativeStrategies: AlternativeStrategy[];
}

export class VaultOptimizationAgent {
  private llm: ChatOpenAI;

  constructor() {
    // Initialize the LLM
    this.llm = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async optimizeVaultAllocation(
    totalAmount: number,
    riskPreference: "Conservative" | "Balanced" | "Aggressive" = "Balanced",
    maxVaults: number = 3,
    timeHorizon: string = "1 year"
  ): Promise<VaultOptimizationResult> {
    // Prepare the vault data for the prompt
    const vaultDataString = VAULT_DATA.map(
      (vault) =>
        `- ${vault.name} (${vault.symbol}): ${vault.apy}% APY, ${vault.risk} risk, ${vault.protocol} protocol\n  Description: ${vault.description}`
    ).join("\n");

    // Create the prompt
    const prompt = `
You are an expert DeFi portfolio optimizer and yield farming specialist. Your task is to analyze the available vault data and provide an optimized fund allocation strategy.

AVAILABLE VAULT DATA:
${vaultDataString}

INVESTMENT PARAMETERS:
- Total Investment Amount: ${totalAmount} USD
- Risk Preference: ${riskPreference}
- Maximum Vaults: ${maxVaults}
- Investment Time Horizon: ${timeHorizon}

OPTIMIZATION CRITERIA:
1. Maximize risk-adjusted returns
2. Ensure proper diversification across protocols and risk levels
3. Consider liquidity and withdrawal conditions
4. Account for gas fees and transaction costs
5. Provide realistic yield projections

Please provide your analysis in the following JSON format:
{
  "analysis": "Detailed analysis of the vault selection and optimization strategy",
  "selectedVaults": [
    {
      "name": "Vault Name",
      "symbol": "Vault Symbol",
      "apy": 12.5,
      "risk": "Medium",
      "protocol": "Protocol Name",
      "allocationPercentage": 40,
      "allocationAmount": 400,
      "expectedAnnualYield": 50,
      "riskAssessment": "Risk assessment and mitigation strategy"
    }
  ],
  "portfolioMetrics": {
    "totalExpectedAPY": 10.5,
    "totalExpectedAnnualYield": 105,
    "riskScore": 6,
    "diversificationScore": 8,
    "liquidityScore": 7,
    "protocolDiversity": 3
  },
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "alternativeStrategies": [
    {
      "name": "Strategy Name",
      "description": "Strategy description",
      "expectedAPY": 9.5,
      "riskLevel": "Low"
    }
  ]
}

Please respond with ONLY the JSON object, no additional text.
`;

    try {
      // Get response from the LLM
      const response = await this.llm.invoke(prompt);

      // Parse the JSON response
      const result = JSON.parse(
        response.content as string
      ) as VaultOptimizationResult;

      return result;
    } catch (error) {
      console.error("Error in vault optimization:", error);
      throw new Error(
        `Failed to optimize vault allocation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getVaultRecommendations(
    amount: number,
    riskTolerance: "Low" | "Medium" | "High" = "Medium"
  ): Promise<string> {
    const optimization = await this.optimizeVaultAllocation(
      amount,
      riskTolerance === "Low"
        ? "Conservative"
        : riskTolerance === "High"
        ? "Aggressive"
        : "Balanced"
    );

    // Format the response for Telegram
    let response = `🎯 <b>AI-Powered Vault Optimization</b>\n\n`;
    response += `💰 <b>Investment Amount:</b> $${amount.toLocaleString()}\n`;
    response += `📊 <b>Portfolio APY:</b> ${optimization.portfolioMetrics.totalExpectedAPY.toFixed(
      2
    )}%\n`;
    response += `🎯 <b>Expected Annual Yield:</b> $${optimization.portfolioMetrics.totalExpectedAnnualYield.toFixed(
      2
    )}\n\n`;

    response += `📈 <b>Recommended Allocation:</b>\n`;
    optimization.selectedVaults.forEach((vault, index) => {
      response += `\n${index + 1}. <b>${vault.name}</b> (${vault.symbol})\n`;
      response += `   🏦 Protocol: ${vault.protocol}\n`;
      response += `   📊 APY: ${vault.apy}% | Risk: ${vault.risk}\n`;
      response += `   💵 Allocation: ${
        vault.allocationPercentage
      }% ($${vault.allocationAmount.toLocaleString()})\n`;
      response += `   🎯 Expected Annual Yield: $${vault.expectedAnnualYield.toFixed(
        2
      )}\n`;
      response += `   ⚠️ Risk Assessment: ${vault.riskAssessment}\n`;
    });

    response += `\n📊 <b>Portfolio Metrics:</b>\n`;
    response += `• Risk Score: ${optimization.portfolioMetrics.riskScore}/10\n`;
    response += `• Diversification: ${optimization.portfolioMetrics.diversificationScore}/10\n`;
    response += `• Liquidity Score: ${optimization.portfolioMetrics.liquidityScore}/10\n`;
    response += `• Protocol Diversity: ${optimization.portfolioMetrics.protocolDiversity} protocols\n\n`;

    response += `💡 <b>Recommendations:</b>\n`;
    optimization.recommendations.forEach((rec, index) => {
      response += `${index + 1}. ${rec}\n`;
    });

    if (optimization.alternativeStrategies.length > 0) {
      response += `\n🔄 <b>Alternative Strategies:</b>\n`;
      optimization.alternativeStrategies.forEach((strategy, index) => {
        response += `${index + 1}. <b>${strategy.name}</b> - ${
          strategy.description
        }\n`;
        response += `   Expected APY: ${strategy.expectedAPY}% | Risk: ${strategy.riskLevel}\n`;
      });
    }

    return response;
  }
}
