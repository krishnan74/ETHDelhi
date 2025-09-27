// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/PythUtils.sol";

contract MultiPriceFeed {
    IPyth public pyth;
    bytes32[] public priceIds;

    // Event to emit prices for verification
    event PricesUpdated(bytes32[] priceIds, uint[] prices);

    constructor(address _pyth, bytes32[] memory _priceIds) {
        pyth = IPyth(_pyth);
        priceIds = _priceIds; // e.g., ETH/USD, BTC/USD, USDC/USD, etc.
    }

    /// @notice Update multiple price feeds at once, emit, and return their prices
    /// @param _priceIds The price IDs to fetch prices for
    /// @param priceUpdates The Pyth price update messages (from Hermes or similar)
    /// @return prices The latest prices for each ID in 18 decimals
    function getLatestPrices(
        bytes32[] calldata _priceIds,
        bytes[] calldata priceUpdates
    ) public payable returns (uint[] memory prices) {
        // Pay the update fee once for all feeds
        uint updateFee = pyth.getUpdateFee(priceUpdates);
        pyth.updatePriceFeeds{value: updateFee}(priceUpdates);

        // Fetch latest prices after updating
        prices = new uint[](_priceIds.length);
        for (uint i = 0; i < _priceIds.length; i++) {
            PythStructs.Price memory price = pyth.getPriceNoOlderThan(
                _priceIds[i],
                60
            );

            // Use PythUtils.convertToUint for consistent decimal handling
            uint price18Decimals = PythUtils.convertToUint(
                price.price,
                price.expo,
                18
            );

            prices[i] = price18Decimals;
        }

        // Emit event with all prices for easy verification
        emit PricesUpdated(_priceIds, prices);

        return prices;
    }

    /// @notice Store initial price IDs on deployment or later
    function addPriceId(bytes32 newPriceId) external {
        priceIds.push(newPriceId);
    }

    /// @notice Get the list of all price IDs
    function getPriceIds() public view returns (bytes32[] memory) {
        return priceIds;
    }
}
