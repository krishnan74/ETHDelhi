import {
  FusionSDK,
  NetworkEnum,
  OrderStatus,
  PrivateKeyProviderConnector,
  Web3Like,
} from "@1inch/fusion-sdk";
import { computeAddress, formatUnits, JsonRpcProvider } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

export interface SwapParams {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  walletAddress: string;
  source?: string;
}

export interface SwapQuote {
  auctionStartAmount: string;
  auctionEndAmount: string;
  recommendedPreset: string;
  presets: any;
}

export interface SwapResult {
  orderHash: string;
  status: OrderStatus;
  fills?: any[];
  error?: string;
}

export class OneInchService {
  private sdk: FusionSDK;
  private network: NetworkEnum;
  private apiKey: string;
  private nodeUrl: string;

  constructor() {
    this.network = NetworkEnum.BINANCE; // Default to BSC
    this.apiKey =
      process.env.ONEINCH_API_KEY || "";
    this.nodeUrl =
      process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";

    this.sdk = this.initializeSDK();
  }

  private initializeSDK(): FusionSDK {
    const ethersRpcProvider = new JsonRpcProvider(this.nodeUrl);

    const ethersProviderConnector: Web3Like = {
      eth: {
        call(transactionConfig): Promise<string> {
          return ethersRpcProvider.call(transactionConfig);
        },
      },
      extend(): void {},
    };

    return new FusionSDK({
      url: "https://api.1inch.dev/fusion",
      network: this.network,
      blockchainProvider: ethersProviderConnector as any, // Type assertion for compatibility
      authKey: this.apiKey,
    });
  }

  /**
   * Get quote for a token swap
   */
  public async getQuote(params: SwapParams): Promise<SwapQuote> {
    try {
      console.log("Getting quote with params:", params);
      const quote = await this.sdk.getQuote(params);

      const preset = quote.presets[quote.recommendedPreset];
      return {
        auctionStartAmount: preset?.auctionStartAmount?.toString() || "0",
        auctionEndAmount: preset?.auctionEndAmount?.toString() || "0",
        recommendedPreset: quote.recommendedPreset,
        presets: quote.presets,
      };
    } catch (error: any) {
      console.error("Error getting quote:", error);

      // Handle specific error cases
      if (error.response?.status === 400) {
        throw new Error(
          "Invalid swap parameters. Please check token addresses and amounts."
        );
      } else if (error.response?.status === 401) {
        throw new Error(
          "Invalid API key. Please check your 1inch API configuration."
        );
      } else if (error.response?.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else {
        throw new Error(
          `Failed to get swap quote: ${error.message || "Unknown error"}`
        );
      }
    }
  }

  /**
   * Execute a token swap
   */
  public async executeSwap(
    params: SwapParams,
    privateKey: string
  ): Promise<SwapResult> {
    try {
      // Create connector with user's private key
      const ethersRpcProvider = new JsonRpcProvider(this.nodeUrl);
      const ethersProviderConnector: Web3Like = {
        eth: {
          call(transactionConfig): Promise<string> {
            return ethersRpcProvider.call(transactionConfig);
          },
        },
        extend(): void {},
      };

      const connector = new PrivateKeyProviderConnector(
        privateKey,
        ethersProviderConnector
      );

      const userSDK = new FusionSDK({
        url: "https://api.1inch.dev/fusion",
        network: this.network,
        blockchainProvider: connector,
        authKey: this.apiKey,
      });

      // Create and submit order
      const preparedOrder = await userSDK.createOrder(params);
      const info = await userSDK.submitOrder(
        preparedOrder.order,
        preparedOrder.quoteId
      );

      // Monitor order status
      const result = await this.monitorOrder(userSDK, info.orderHash);

      return {
        orderHash: info.orderHash,
        status: result.status,
        fills: result.fills,
      };
    } catch (error) {
      console.error("Error executing swap:", error);
      return {
        orderHash: "",
        status: OrderStatus.Cancelled,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Monitor order execution
   */
  private async monitorOrder(
    sdk: FusionSDK,
    orderHash: string,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<{ status: OrderStatus; fills?: any[] }> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const data = await sdk.getOrderStatus(orderHash);

        if (data.status === OrderStatus.Filled) {
          return { status: data.status, fills: data.fills };
        }

        if (data.status === OrderStatus.Expired) {
          return { status: data.status };
        }

        if (data.status === OrderStatus.Cancelled) {
          return { status: data.status };
        }

        // Wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error("Error monitoring order:", error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return { status: OrderStatus.Expired };
  }

  /**
   * Get token information
   */
  public getTokenInfo(tokenAddress: string): {
    name: string;
    symbol: string;
    decimals: number;
  } {
    const tokens: Record<
      string,
      { name: string; symbol: string; decimals: number }
    > = {
      "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 18,
      },
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": {
        name: "BNB",
        symbol: "BNB",
        decimals: 18,
      },
      "0x55d398326f99059ff775485246999027b3197955": {
        name: "Tether USD",
        symbol: "USDT",
        decimals: 18,
      },
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": {
        name: "Wrapped BNB",
        symbol: "WBNB",
        decimals: 18,
      },
    };

    return (
      tokens[tokenAddress.toLowerCase()] || {
        name: "Unknown",
        symbol: "UNK",
        decimals: 18,
      }
    );
  }

  /**
   * Format amount with token decimals
   */
  public formatAmount(amount: string, tokenAddress: string): string {
    const tokenInfo = this.getTokenInfo(tokenAddress);
    return formatUnits(amount, tokenInfo.decimals);
  }

  /**
   * Parse amount to wei
   */
  public parseAmount(amount: string, tokenAddress: string): string {
    const tokenInfo = this.getTokenInfo(tokenAddress);
    const multiplier = Math.pow(10, tokenInfo.decimals);
    return (parseFloat(amount) * multiplier).toString();
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testParams = {
        fromTokenAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
        toTokenAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // BNB
        amount: "1000000000000000000", // 1 USDC
        walletAddress: "0x0000000000000000000000000000000000000000", // Dummy address
        source: "test",
      };

      await this.sdk.getQuote(testParams);
      return true;
    } catch (error) {
      console.error("API connection test failed:", error);
      return false;
    }
  }
}
