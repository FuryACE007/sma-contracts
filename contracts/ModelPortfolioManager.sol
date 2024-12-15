// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./FundToken.sol";

interface IInvestorPortfolioManager {
    function rebalancePortfolio(address investor) external;
}

/**
 * @title ModelPortfolioManager
 * @dev Manages model portfolios with predefined fund allocations
 */
contract ModelPortfolioManager is Ownable {
    // Struct to represent a fund in the portfolio
    struct FundAllocation {
        address tokenAddress;
        uint256 targetWeight; // Percentage represented in basis points (0-10000)
    }

    // Mapping of model portfolio ID to its fund allocations
    mapping(uint256 => FundAllocation[]) private _modelPortfolios;

    // Counter for creating unique model portfolio IDs
    uint256 private _portfolioIdCounter = 1;

    event ModelPortfolioCreated(uint256 indexed portfolioId);
    event ModelPortfolioUpdated(uint256 indexed portfolioId);

    // Add mapping to track linked investor managers
    mapping(address => bool) public linkedManagers;

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new model portfolio
     * @param fundAddresses Array of fund token contract addresses
     * @param weights Corresponding weights for each fund (in basis points)
     * @return portfolioId Unique identifier for the created model portfolio
     */
    function createModelPortfolio(
        address[] memory fundAddresses,
        uint256[] memory weights
    ) public onlyOwner returns (uint256 portfolioId) {
        // Validate input
        require(
            fundAddresses.length == weights.length,
            "Funds and weights must match"
        );

        uint256 totalWeight;
        for (uint i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
            _modelPortfolios[_portfolioIdCounter].push(
                FundAllocation({
                    tokenAddress: fundAddresses[i],
                    targetWeight: weights[i]
                })
            );
        }

        // Ensure total weight is exactly 100% (10000 basis points)
        require(
            totalWeight == 10000,
            "Total weights must equal 10000 basis points"
        );

        portfolioId = _portfolioIdCounter;
        emit ModelPortfolioCreated(portfolioId);

        _portfolioIdCounter++;
        return portfolioId;
    }

    /**
     * @dev Update an existing model portfolio
     * @param portfolioId ID of the portfolio to update
     * @param fundAddresses New fund token contract addresses
     * @param weights New corresponding weights for each fund
     */
    function updateModelPortfolio(
        uint256 portfolioId,
        address[] memory fundAddresses,
        uint256[] memory weights
    ) public onlyOwner {
        // Clear existing allocations
        delete _modelPortfolios[portfolioId];

        uint256 totalWeight;
        for (uint i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
            _modelPortfolios[portfolioId].push(
                FundAllocation({
                    tokenAddress: fundAddresses[i],
                    targetWeight: weights[i]
                })
            );
        }

        // Ensure total weight is exactly 100% (10000 basis points)
        require(
            totalWeight == 10000,
            "Total weights must equal 10000 basis points"
        );

        emit ModelPortfolioUpdated(portfolioId);

        // Trigger rebalancing for the linked manager
        if (linkedManagers[msg.sender]) {
            IInvestorPortfolioManager(msg.sender).rebalancePortfolio(msg.sender);
        }
    }

    /**
     * @dev Retrieve fund allocations for a specific model portfolio
     * @param portfolioId ID of the portfolio
     * @return Array of fund allocations
     */
    function getModelPortfolio(
        uint256 portfolioId
    ) public view returns (FundAllocation[] memory) {
        return _modelPortfolios[portfolioId];
    }

    // Add function to link investor manager
    function linkInvestorManager(address managerAddress) public onlyOwner {
        linkedManagers[managerAddress] = true;
    }
}
