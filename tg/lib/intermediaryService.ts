import { ethers } from "ethers";
import { Wallet } from "./Wallet";
import { Vault, OptimizedSplit } from "./vaultData";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Intermediary Contract ABI (simplified)
const INTERMEDIARY_ABI = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "_vaults",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "_amounts",
        type: "uint256[]",
      },
      {
        internalType: "address[]",
        name: "_tokens",
        type: "address[]",
      },
      {
        internalType: "address[]",
        name: "_members",
        type: "address[]",
      },
      {
        internalType: "uint256",
        name: "_totalAmount",
        type: "uint256",
      },
    ],
    name: "createInvestmentPlan",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_planId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_token",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "contributeToPlan",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_planId",
        type: "uint256",
      },
    ],
    name: "executeInvestmentPlan",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_planId",
        type: "uint256",
      },
    ],
    name: "canExecutePlan",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_planId",
        type: "uint256",
      },
    ],
    name: "getPlanDetails",
    outputs: [
      {
        internalType: "address[]",
        name: "vaults",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
      {
        internalType: "address[]",
        name: "tokens",
        type: "address[]",
      },
      {
        internalType: "uint256",
        name: "totalAmount",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "executed",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_planId",
        type: "uint256",
      },
    ],
    name: "getPlanContributions",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "member",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "contributed",
            type: "bool",
          },
        ],
        internalType: "struct IntermediaryContract.MemberContribution[]",
        name: "",
        type: "tuple[]",
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

export interface InvestmentPlan {
  planId: number;
  vaults: string[];
  amounts: string[];
  tokens: string[];
  totalAmount: string;
  executed: boolean;
  deadline: number;
}

export interface MemberContribution {
  member: string;
  amount: string;
  contributed: boolean;
}

export interface ContributionResult {
  success: boolean;
  transactionHash?: string;
  message: string;
  error?: string;
}

export class IntermediaryService {
  private rpcUrl: string;
  private contractAddress: string;
  private walletService: Wallet;
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    this.rpcUrl = process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com";
    this.contractAddress =
      process.env.INTERMEDIARY_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000000";
    this.walletService = new Wallet();
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    // Only create contract if address is valid
    if (
      this.contractAddress &&
      this.contractAddress !== "0x0000000000000000000000000000000000000000"
    ) {
      this.contract = new ethers.Contract(
        this.contractAddress,
        INTERMEDIARY_ABI,
        this.provider
      ) as any; // Type assertion to bypass TypeScript ABI typing issues
    } else {
      // Create a dummy contract for development
      this.contract = null as any;
    }
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
   * Create an investment plan
   */
  async createInvestmentPlan(
    optimizedSplit: OptimizedSplit[],
    memberAddresses: string[],
    totalAmount: number,
    ownerTelegramId: string
  ): Promise<{
    success: boolean;
    planId?: number;
    message: string;
    error?: string;
  }> {
    try {
      if (
        !this.contract ||
        !this.contractAddress ||
        this.contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return {
          success: false,
          message:
            "Intermediary contract not deployed. Please set INTERMEDIARY_CONTRACT_ADDRESS environment variable.",
          error: "Contract not deployed",
        };
      }

      // Prepare plan data
      const vaults = optimizedSplit.map((split) => split.vault.address!);
      const amounts = optimizedSplit.map((split) =>
        this.toAtomicAmount(
          split.amount.toString(),
          split.vault.underlyingAsset!.decimals
        )
      );
      const tokens = optimizedSplit.map(
        (split) => split.vault.underlyingAsset!.address
      );
      const totalAmountAtomic = this.toAtomicAmount(totalAmount.toString(), 18); // Assuming USDC (6 decimals)

      // Get owner wallet for contract interaction
      const ownerWallet = await this.walletService.getWallet(ownerTelegramId);
      const ownerEthersWallet = new ethers.Wallet(
        ownerWallet.privateKey,
        this.provider
      );
      const contractWithSigner = this.contract.connect(ownerEthersWallet);

      // Create the investment plan
      const tx = await (contractWithSigner as any).createInvestmentPlan(
        vaults,
        amounts,
        tokens,
        memberAddresses,
        totalAmountAtomic
      );

      const receipt = await tx.wait();
      if (!receipt) {
        return {
          success: false,
          message: "Failed to create investment plan",
          error: "Transaction failed",
        };
      }

      // Extract plan ID from events (simplified)
      const planId = 0; // Would need to parse from events

      return {
        success: true,
        planId,
        message: `Investment plan created successfully. Plan ID: ${planId}`,
      };
    } catch (error) {
      console.error("Error creating investment plan:", error);
      return {
        success: false,
        message: `Failed to create investment plan: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Contribute to an investment plan
   */
  async contributeToPlan(
    telegramId: string,
    planId: number,
    tokenAddress: string,
    amount: string,
    decimals: number
  ): Promise<ContributionResult> {
    try {
      if (
        !this.contract ||
        !this.contractAddress ||
        this.contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return {
          success: false,
          message:
            "Intermediary contract not deployed. Please set INTERMEDIARY_CONTRACT_ADDRESS environment variable.",
          error: "Contract not deployed",
        };
      }

      // Get user's wallet
      const wallet = await this.walletService.getWallet(telegramId);
      const ethersWallet = new ethers.Wallet(wallet.privateKey, this.provider);

      // Convert amount to atomic units
      const atomicAmount = this.toAtomicAmount(amount, decimals);

      // Check balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        ethersWallet
      );
      const balance = await tokenContract.balanceOf(wallet.address);

      if (BigInt(balance) < BigInt(atomicAmount)) {
        const balanceFormatted = this.fromAtomicAmount(
          balance.toString(),
          decimals
        );
        return {
          success: false,
          message: `Insufficient balance. Required: ${amount}, Available: ${balanceFormatted}`,
          error: "Insufficient balance",
        };
      }

      // Approve intermediary contract to spend tokens
      const currentAllowance = await tokenContract.allowance(
        wallet.address,
        this.contractAddress
      );
      if (BigInt(currentAllowance) < BigInt(atomicAmount)) {
        const approveTx = await tokenContract.approve(
          this.contractAddress,
          atomicAmount
        );
        await approveTx.wait();
      }

      // Contribute to the plan
      const contractWithSigner = this.contract.connect(ethersWallet);
      const tx = await (contractWithSigner as any).contributeToPlan(
        planId,
        tokenAddress,
        atomicAmount
      );
      const receipt = await tx.wait();

      if (!receipt) {
        return {
          success: false,
          message: "Contribution transaction failed",
          error: "Transaction failed",
        };
      }

      return {
        success: true,
        transactionHash: receipt.hash,
        message: `Successfully contributed ${amount} to investment plan ${planId}`,
      };
    } catch (error) {
      console.error("Error contributing to plan:", error);
      return {
        success: false,
        message: `Contribution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute investment plan
   */
  async executeInvestmentPlan(
    planId: number,
    ownerTelegramId: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      if (
        !this.contract ||
        !this.contractAddress ||
        this.contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return {
          success: false,
          message:
            "Intermediary contract not deployed. Please set INTERMEDIARY_CONTRACT_ADDRESS environment variable.",
          error: "Contract not deployed",
        };
      }

      // Get owner wallet for contract interaction
      const ownerWallet = await this.walletService.getWallet(ownerTelegramId);
      const ownerEthersWallet = new ethers.Wallet(
        ownerWallet.privateKey,
        this.provider
      );
      const contractWithSigner = this.contract.connect(ownerEthersWallet);

      // Execute the plan
      const tx = await (contractWithSigner as any).executeInvestmentPlan(
        planId
      );
      const receipt = await tx.wait();

      if (!receipt) {
        return {
          success: false,
          message: "Failed to execute investment plan",
          error: "Transaction failed",
        };
      }

      return {
        success: true,
        message: `Investment plan ${planId} executed successfully`,
      };
    } catch (error) {
      console.error("Error executing investment plan:", error);
      return {
        success: false,
        message: `Failed to execute investment plan: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if plan can be executed
   */
  async canExecutePlan(planId: number): Promise<boolean> {
    try {
      if (
        !this.contract ||
        !this.contractAddress ||
        this.contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return false;
      }
      return await (this.contract as any).canExecutePlan(planId);
    } catch (error) {
      console.error("Error checking plan execution status:", error);
      return false;
    }
  }

  /**
   * Get plan details
   */
  async getPlanDetails(planId: number): Promise<InvestmentPlan | null> {
    try {
      if (
        !this.contract ||
        !this.contractAddress ||
        this.contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return null;
      }
      const details = await (this.contract as any).getPlanDetails(planId);
      return {
        planId,
        vaults: details.vaults,
        amounts: details.amounts,
        tokens: details.tokens,
        totalAmount: details.totalAmount,
        executed: details.executed,
        deadline: Number(details.deadline),
      };
    } catch (error) {
      console.error("Error getting plan details:", error);
      return null;
    }
  }

  /**
   * Get member contributions for a plan
   */
  async getPlanContributions(planId: number): Promise<MemberContribution[]> {
    try {
      if (
        !this.contract ||
        !this.contractAddress ||
        this.contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return [];
      }
      const contributions = await (this.contract as any).getPlanContributions(
        planId
      );
      return contributions.map((contrib: any) => ({
        member: contrib.member,
        amount: contrib.amount.toString(),
        contributed: contrib.contributed,
      }));
    } catch (error) {
      console.error("Error getting plan contributions:", error);
      return [];
    }
  }
}
