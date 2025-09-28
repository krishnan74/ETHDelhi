import { ethers } from "ethers";
import { Wallet } from "./Wallet";
import { Vault } from "./vaultData";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Morpho Vault ABI (simplified for deposit function)
const METAMORPHO_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "deposit",
    outputs: [
      {
        internalType: "uint256",
        name: "shares",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ERC20 ABI for token approval
const ERC20_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export interface DepositResult {
  success: boolean;
  transactionHash?: string;
  shares?: string;
  message: string;
  error?: string;
}

export class MorphoDepositService {
  private rpcUrl: string;
  private walletService: Wallet;

  constructor() {
    this.rpcUrl = process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com";
    this.walletService = new Wallet();
  }

  /**
   * Convert human-readable amount to atomic units
   */
  private toAtomicAmount(amount: string, decimals: number): string {
    return ethers.parseUnits(amount, decimals).toString();
  }

  /**
   * Convert atomic units to human-readable amount
   */
  private fromAtomicAmount(amount: string, decimals: number): string {
    return ethers.formatUnits(amount, decimals);
  }

  /**
   * Check if user has sufficient token balance
   */
  private async checkBalance(
    wallet: ethers.Wallet,
    tokenAddress: string,
    requiredAmount: string
  ): Promise<{ sufficient: boolean; balance: string }> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        wallet
      );
      const balance = await tokenContract.balanceOf(wallet.address);

      return {
        sufficient: BigInt(balance) >= BigInt(requiredAmount),
        balance: balance.toString(),
      };
    } catch (error) {
      console.error("Error checking balance:", error);
      return { sufficient: false, balance: "0" };
    }
  }

  /**
   * Approve token spending for vault
   */
  private async approveToken(
    wallet: ethers.Wallet,
    tokenAddress: string,
    vaultAddress: string,
    amount: string
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        wallet
      );

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(
        wallet.address,
        vaultAddress
      );

      if (BigInt(currentAllowance) >= BigInt(amount)) {
        return { success: true }; // Already approved
      }

      // Approve the vault to spend tokens
      const tx = await tokenContract.approve(vaultAddress, amount);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt?.hash,
      };
    } catch (error) {
      console.error("Error approving token:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Deposit assets into a Morpho vault
   */
  async depositToVault(
    telegramId: string,
    vault: Vault,
    amount: string,
    receiver?: string
  ): Promise<DepositResult> {
    try {
      // Validate inputs
      if (!vault.address || !vault.underlyingAsset) {
        return {
          success: false,
          message: "Vault address or underlying asset information is missing",
          error: "Invalid vault data",
        };
      }

      if (parseFloat(amount) <= 0) {
        return {
          success: false,
          message: "Amount must be greater than 0",
          error: "Invalid amount",
        };
      }

      // Get user's wallet
      const wallet = await this.walletService.getWallet(telegramId);
      const ethersWallet = new ethers.Wallet(wallet.privateKey);

      // Convert amount to atomic units
      const atomicAmount = this.toAtomicAmount(
        amount,
        vault.underlyingAsset.decimals
      );
      const vaultAddress = vault.address;
      const tokenAddress = vault.underlyingAsset.address;
      const depositReceiver = receiver || wallet.address;

      // Check balance
      const balanceCheck = await this.checkBalance(
        ethersWallet,
        tokenAddress,
        atomicAmount
      );
      if (!balanceCheck.sufficient) {
        const balanceFormatted = this.fromAtomicAmount(
          balanceCheck.balance,
          vault.underlyingAsset.decimals
        );
        return {
          success: false,
          message: `Insufficient balance. Required: ${amount} ${vault.underlyingAsset.symbol}, Available: ${balanceFormatted} ${vault.underlyingAsset.symbol}`,
          error: "Insufficient balance",
        };
      }

      // Approve token spending
      const approvalResult = await this.approveToken(
        ethersWallet,
        tokenAddress,
        vaultAddress,
        atomicAmount
      );
      if (!approvalResult.success) {
        return {
          success: false,
          message: `Failed to approve token spending: ${approvalResult.error}`,
          error: approvalResult.error,
        };
      }

      // Execute deposit
      const vaultContract = new ethers.Contract(
        vaultAddress,
        METAMORPHO_ABI,
        ethersWallet
      );
      const depositTx = await vaultContract.deposit(
        atomicAmount,
        depositReceiver
      );
      const depositReceipt = await depositTx.wait();

      if (!depositReceipt) {
        return {
          success: false,
          message: "Deposit transaction failed",
          error: "Transaction failed",
        };
      }

      // Get shares from transaction logs (simplified)
      const shares = "0"; // Would need to parse from transaction logs

      return {
        success: true,
        transactionHash: depositReceipt.hash,
        shares,
        message: `Successfully deposited ${amount} ${vault.underlyingAsset.symbol} to ${vault.name}. Transaction: ${depositReceipt.hash}`,
      };
    } catch (error) {
      console.error("Error depositing to vault:", error);
      return {
        success: false,
        message: `Deposit failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get vault deposit information
   */
  getVaultDepositInfo(vault: Vault): string {
    if (!vault.underlyingAsset) {
      return "Deposit information not available for this vault";
    }

    return (
      `🏦 <b>${vault.name}</b>\n` +
      `📍 Vault Address: <code>${vault.address}</code>\n` +
      `🪙 Underlying Asset: ${vault.underlyingAsset.symbol} (${vault.underlyingAsset.name})\n` +
      `📍 Token Address: <code>${vault.underlyingAsset.address}</code>\n` +
      `📊 APY: ${vault.apy.toFixed(2)}%\n` +
      `💰 TVL: $${
        vault.totalAssetsUsd
          ? parseFloat(vault.totalAssetsUsd).toLocaleString()
          : "N/A"
      }\n` +
      `⚠️ Risk: ${vault.risk}`
    );
  }
}
