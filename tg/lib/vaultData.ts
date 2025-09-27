export interface Vault {
  name: string;
  symbol: string;
  apy: number;
  protocol: string;
  risk: "Low" | "Medium" | "High";
  description: string;
}

export const VAULT_DATA: Vault[] = [
  {
    name: "Pyth USDC",
    symbol: "pythUSDC",
    apy: 12.79,
    protocol: "Morpho",
    risk: "Medium",
    description: "USDC vault with Pyth oracle integration",
  },
  {
    name: "Universal USDC",
    symbol: "uUSDC",
    apy: 10.36,
    protocol: "Morpho",
    risk: "Low",
    description: "Universal USDC lending vault",
  },
  {
    name: "Seamless USDC Vault",
    symbol: "smUSDC",
    apy: 11.43,
    protocol: "Morpho",
    risk: "Medium",
    description: "Seamless protocol USDC vault",
  },
  {
    name: "Steakhouse USDC",
    symbol: "steakUSDC",
    apy: 8.09,
    protocol: "Morpho",
    risk: "Low",
    description: "Steakhouse USDC staking vault",
  },
  {
    name: "Gauntlet USDC Core",
    symbol: "gtUSDCc",
    apy: 7.54,
    protocol: "Morpho",
    risk: "Low",
    description: "Gauntlet core USDC vault",
  },
  {
    name: "Ionic Ecosystem USDC",
    symbol: "ionicUSDC",
    apy: 7.53,
    protocol: "Morpho",
    risk: "Medium",
    description: "Ionic ecosystem USDC vault",
  },
  {
    name: "Re7 USDC",
    symbol: "Re7USDC",
    apy: 7.43,
    protocol: "Morpho",
    risk: "Medium",
    description: "Re7 protocol USDC vault",
  },
  {
    name: "Gauntlet USDC Prime",
    symbol: "gtUSDCp",
    apy: 7.37,
    protocol: "Morpho",
    risk: "Low",
    description: "Gauntlet prime USDC vault",
  },
  {
    name: "Moonwell Flagship USDC",
    symbol: "mwUSDC",
    apy: 7.37,
    protocol: "Morpho",
    risk: "Medium",
    description: "Moonwell flagship USDC vault",
  },
  {
    name: "Spark USDC Vault",
    symbol: "sparkUSDC",
    apy: 6.32,
    protocol: "Spark.fi",
    risk: "Low",
    description: "Spark protocol USDC vault",
  },
  {
    name: "Degen USDC",
    symbol: "degenUSDC",
    apy: 5.27,
    protocol: "Morpho",
    risk: "High",
    description: "High-risk degen USDC vault",
  },
];

export interface OptimizedSplit {
  vault: Vault;
  percentage: number;
  amount: number;
  expectedYield: number;
}

export function calculateOptimizedSplit(
  totalAmount: number,
  numVaults: number = 3
): OptimizedSplit[] {
  // Sort vaults by APY (highest first)
  const sortedVaults = [...VAULT_DATA].sort((a, b) => b.apy - a.apy);

  // Take top vaults with different risk levels for diversification
  const selectedVaults: Vault[] = [];

  // Always include the highest APY vault
  selectedVaults.push(sortedVaults[0]);

  // Add one low-risk vault
  const lowRiskVault = sortedVaults.find(
    (v) => v.risk === "Low" && !selectedVaults.includes(v)
  );
  if (lowRiskVault) selectedVaults.push(lowRiskVault);

  // Add one more vault (preferably medium risk)
  const mediumRiskVault = sortedVaults.find(
    (v) => v.risk === "Medium" && !selectedVaults.includes(v)
  );
  if (mediumRiskVault) selectedVaults.push(mediumRiskVault);

  // If we need more vaults, add the next highest APY
  while (
    selectedVaults.length < numVaults &&
    selectedVaults.length < sortedVaults.length
  ) {
    const nextVault = sortedVaults.find((v) => !selectedVaults.includes(v));
    if (nextVault) selectedVaults.push(nextVault);
  }

  // Calculate percentages (weighted by APY but with some diversification)
  const totalWeight = selectedVaults.reduce((sum, vault) => sum + vault.apy, 0);
  const splits: OptimizedSplit[] = [];

  selectedVaults.forEach((vault, index) => {
    // Give higher percentage to higher APY, but not too extreme
    let percentage: number;
    if (index === 0) {
      // Highest APY gets 50%
      percentage = 50;
    } else if (index === 1) {
      // Second vault gets 30%
      percentage = 30;
    } else {
      // Remaining vaults split the rest
      percentage = 20;
    }

    const amount = (totalAmount * percentage) / 100;
    const expectedYield = (amount * vault.apy) / 100;

    splits.push({
      vault,
      percentage,
      amount,
      expectedYield,
    });
  });

  return splits;
}
