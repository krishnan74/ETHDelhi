import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// GraphQL query for fetching Morpho vaults (no filtering)
const LIST_CHAIN_ASSET_VAULTS_QUERY = `
query ListChainAssetVaults($skip: Int!, $first: Int!) {
  vaults(first: $first, skip: $skip) {
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
            loanAsset {
              id
              address
              decimals
              name
              symbol
              tags
              logoURI
              priceUsd
              oraclePriceUsd
              spotPriceEth
            }
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
        loanAsset: {
          id: string;
          address: string;
          decimals: string;
          name: string;
          symbol: string;
          tags: string[];
          logoURI: string;
          priceUsd: string;
          oraclePriceUsd: string;
          spotPriceEth: string;
        };
      };
    }[];
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
  }[];
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
    skip: number = 0,
    first: number = 1000,
    riskLevel?: "Low" | "Medium" | "High"
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
            first,
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

      let vaults = data.data.vaults.items;

      // Filter by risk level client-side based on APY
      if (riskLevel) {
        vaults = vaults.filter((vault) => {
          const apyValue = vault.state?.apy || "0";
          const apy = parseFloat(String(apyValue)) * 100; // Convert to percentage

          switch (riskLevel) {
            case "Low":
              return apy < 5; // 0-5% APY
            case "Medium":
              return apy >= 5 && apy <= 15; // 5-15% APY
            case "High":
              return apy > 15; // 15%+ APY
            default:
              return true;
          }
        });
      }

      return vaults;
    } catch (error) {
      console.error("Error fetching Morpho vaults:", error);
      throw new Error(
        `Failed to fetch vaults: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async fetchVaultsByRisk(
    riskLevel: "Low" | "Medium" | "High",
    limit: number = 20
  ): Promise<MorphoVault[]> {
    try {
      // Fetch more vaults to ensure we get enough after filtering
      const vaults = await this.fetchVaults(0, 200, riskLevel);
      const limitedVaults = vaults.slice(0, limit);
      console.log(
        `Found ${limitedVaults.length} ${riskLevel} risk vaults (from ${vaults.length} total)`
      );
      return limitedVaults;
    } catch (error) {
      console.error(`Error fetching ${riskLevel} risk vaults:`, error);
      throw error;
    }
  }

  async fetchVaultsPaginated(
    riskLevel: "Low" | "Medium" | "High",
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ vaults: MorphoVault[]; totalCount: number; hasMore: boolean }> {
    try {
      // Fetch all vaults for this risk level first
      const allVaults = await this.fetchVaults(0, 500, riskLevel);

      // Calculate pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const vaults = allVaults.slice(startIndex, endIndex);
      const hasMore = endIndex < allVaults.length;

      return {
        vaults,
        totalCount: allVaults.length,
        hasMore,
      };
    } catch (error) {
      console.error(
        `Error fetching paginated ${riskLevel} risk vaults:`,
        error
      );
      throw error;
    }
  }

  // Convert Morpho vault to our Vault interface
  convertToVault(morphoVault: MorphoVault): any {
    const apy = parseFloat(String(morphoVault.state.apy || "0"));
    const netApy = parseFloat(String(morphoVault.state.netApy || "0"));
    const apyPercent = apy * 100; // Convert to percentage

    // Determine risk level based on APY (since risk analysis is empty)
    let risk: "Low" | "Medium" | "High" = "Medium";
    if (apyPercent < 5) {
      risk = "Low";
    } else if (apyPercent > 15) {
      risk = "High";
    } else {
      risk = "Medium";
    }

    // Get the first allocation's loan asset for deposit info
    const firstAllocation = morphoVault.state.allocation?.[0];
    const underlyingAsset = firstAllocation?.market?.loanAsset;

    return {
      name: morphoVault.name,
      symbol: morphoVault.symbol,
      apy: apyPercent, // Convert to percentage for display
      protocol: "Morpho",
      risk,
      description:
        morphoVault.metadata?.description ||
        `Morpho vault for ${morphoVault.symbol}`,
      address: morphoVault.address,
      totalAssets: morphoVault.state.totalAssets,
      totalAssetsUsd: morphoVault.state.totalAssetsUsd,
      liquidity: morphoVault.liquidity,
      riskScore: risk === "Low" ? 8 : risk === "High" ? 3 : 5, // Assign risk scores based on APY
      warnings: morphoVault.warnings,
      curators: morphoVault.metadata?.curators || [],
      // Deposit-related fields
      underlyingAsset: underlyingAsset
        ? {
            address: underlyingAsset.address,
            symbol: underlyingAsset.symbol,
            name: underlyingAsset.name,
            decimals: parseInt(underlyingAsset.decimals),
          }
        : undefined,
      sharePrice: morphoVault.state.sharePrice,
      totalSupply: morphoVault.state.totalSupply,
    };
  }
}
