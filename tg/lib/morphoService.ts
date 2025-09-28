import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// GraphQL query for fetching Morpho vaults
const LIST_CHAIN_ASSET_VAULTS_QUERY = `
query ListChainAssetVaults($skip: Int!, $chainId: Int!, $assetAddress: String!) {
  vaults(first: 1000, skip: $skip, where: {chainId_in: [$chainId], assetAddress_in: [$assetAddress]}) {
    items {
      id
      name
      address
      symbol
      creationBlockNumber
      creationTimestamp
      creatorAddress
      whitelisted
      state {
        id
        totalAssets
        totalAssetsUsd
        lastTotalAssets
        totalSupply
        fee
        apy
        netApyWithoutRewards
        netApy
        curator
        feeRecipient
        guardian
        pendingGuardian
        pendingGuardianValidAt
        owner
        pendingOwner
        skimRecipient
        timelock
        pendingTimelock
        pendingTimelockValidAt
        timestamp
        allocation {
          id
          supplyAssets
          supplyAssetsUsd
          supplyShares
          supplyCap
          supplyCapUsd
          pendingSupplyCap
          pendingSupplyCapValidAt
          pendingSupplyCapUsd
          supplyQueueIndex
          withdrawQueueIndex
          enabled
          removableAt
          market {
            id
          }
        }
        rewards {
          yearlySupplyTokens
          supplyApr
          amountPerSuppliedToken
          asset {
            id
            address
            decimals
            name
            symbol
            tags
            logoURI
            totalSupply
            priceUsd
            oraclePriceUsd
            spotPriceEth
          }
        }
        sharePrice
        sharePriceUsd
        dailyApy
        dailyNetApy
        weeklyApy
        weeklyNetApy
        monthlyApy
        monthlyNetApy
        quarterlyApy
        quarterlyNetApy
        yearlyApy
        yearlyNetApy
        allTimeApy
        allTimeNetApy
      }
      liquidity {
        underlying
        usd
      }
      riskAnalysis {
        provider
        score
        isUnderReview
        timestamp
      }
      warnings {
        type
        level
      }
      metadata {
        description
        image
        forumLink
        curators {
          name
          image
          url
          verified
        }
      }
    }
    pageInfo {
      countTotal
      count
      limit
      skip
    }
  }
}
`;

// Interface for the GraphQL response
export interface MorphoVault {
  id: string;
  name: string;
  address: string;
  symbol: string;
  creationBlockNumber: number;
  creationTimestamp: number;
  creatorAddress: string;
  whitelisted: boolean;
  state: {
    id: string;
    totalAssets: string;
    totalAssetsUsd: string;
    lastTotalAssets: string;
    totalSupply: string;
    fee: string;
    apy: string;
    netApyWithoutRewards: string;
    netApy: string;
    curator: string;
    feeRecipient: string;
    guardian: string;
    pendingGuardian: string;
    pendingGuardianValidAt: string;
    owner: string;
    pendingOwner: string;
    skimRecipient: string;
    timelock: string;
    pendingTimelock: string;
    pendingTimelockValidAt: string;
    timestamp: string;
    allocation: {
      id: string;
      supplyAssets: string;
      supplyAssetsUsd: string;
      supplyShares: string;
      supplyCap: string;
      supplyCapUsd: string;
      pendingSupplyCap: string;
      pendingSupplyCapValidAt: string;
      pendingSupplyCapUsd: string;
      supplyQueueIndex: string;
      withdrawQueueIndex: string;
      enabled: boolean;
      removableAt: string;
      market: {
        id: string;
      };
    };
    rewards: {
      yearlySupplyTokens: string;
      supplyApr: string;
      amountPerSuppliedToken: string;
      asset: {
        id: string;
        address: string;
        decimals: number;
        name: string;
        symbol: string;
        tags: string[];
        logoURI: string;
        totalSupply: string;
        priceUsd: string;
        oraclePriceUsd: string;
        spotPriceEth: string;
      };
    };
    sharePrice: string;
    sharePriceUsd: string;
    dailyApy: string;
    dailyNetApy: string;
    weeklyApy: string;
    weeklyNetApy: string;
    monthlyApy: string;
    monthlyNetApy: string;
    quarterlyApy: string;
    quarterlyNetApy: string;
    yearlyApy: string;
    yearlyNetApy: string;
    allTimeApy: string;
    allTimeNetApy: string;
  };
  liquidity: {
    underlying: string;
    usd: string;
  };
  riskAnalysis: {
    provider: string;
    score: number;
    isUnderReview: boolean;
    timestamp: string;
  };
  warnings: {
    type: string;
    level: string;
  }[];
  metadata: {
    description: string;
    image: string;
    forumLink: string;
    curators: {
      name: string;
      image: string;
      url: string;
      verified: boolean;
    }[];
  };
}

export interface GraphQLResponse {
  data: {
    vaults: {
      items: MorphoVault[];
      pageInfo: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
}

export class MorphoService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = "https://blue-api.morpho.org/graphql";
  }

  async fetchVaults(
    chainId: number = 1, // Ethereum mainnet
    assetAddress: string = "0xA0b86a33E6441b8c4C8C0C4C0C4C0C4C0C4C0C4C", // USDC address (placeholder)
    skip: number = 0
  ): Promise<MorphoVault[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: LIST_CHAIN_ASSET_VAULTS_QUERY,
          variables: {
            skip,
            chainId,
            assetAddress,
          },
        }),
      });

      console.log("Response:", response);

      if (!response.ok) {
        throw new Error(
          `GraphQL request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as GraphQLResponse;

      if (!data.data || !data.data.vaults || !data.data.vaults.items) {
        throw new Error("Invalid GraphQL response structure");
      }

      return data.data.vaults.items;
    } catch (error) {
      console.error("Error fetching Morpho vaults:", error);
      throw new Error(
        `Failed to fetch vaults: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async fetchAllVaults(chainId: number = 1): Promise<MorphoVault[]> {
    try {
      const allVaults: MorphoVault[] = [];
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const vaults = await this.fetchVaults(chainId, "", skip);

        if (vaults.length === 0) {
          hasMore = false;
        } else {
          allVaults.push(...vaults);
          skip += 1000; // Assuming 1000 is the limit per request
        }
      }

      console.log("All vaults:", allVaults);    

      return allVaults;
    } catch (error) {
      console.error("Error fetching all vaults:", error);
      throw error;
    }
  }

  // Convert Morpho vault to our Vault interface
  convertToVault(morphoVault: MorphoVault): any {
    const apy = parseFloat(morphoVault.state.apy) || 0;
    const netApy = parseFloat(morphoVault.state.netApy) || 0;

    // Determine risk level based on APY and risk analysis
    let risk: "Low" | "Medium" | "High" = "Medium";
    if (morphoVault.riskAnalysis && morphoVault.riskAnalysis.score) {
      if (morphoVault.riskAnalysis.score >= 8) {
        risk = "Low";
      } else if (morphoVault.riskAnalysis.score <= 4) {
        risk = "High";
      }
    } else {
      // Fallback risk assessment based on APY
      if (apy < 5) {
        risk = "Low";
      } else if (apy > 15) {
        risk = "High";
      }
    }

    return {
      name: morphoVault.name,
      symbol: morphoVault.symbol,
      apy: netApy || apy, // Use net APY if available, otherwise use gross APY
      protocol: "Morpho",
      risk,
      description:
        morphoVault.metadata?.description ||
        `Morpho vault for ${morphoVault.symbol}`,
      address: morphoVault.address,
      totalAssets: morphoVault.state.totalAssets,
      totalAssetsUsd: morphoVault.state.totalAssetsUsd,
      liquidity: morphoVault.liquidity,
      riskScore: morphoVault.riskAnalysis?.score || 5,
      warnings: morphoVault.warnings,
      curators: morphoVault.metadata?.curators || [],
    };
  }
}
