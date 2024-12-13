// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ModelPortfolioManager.sol";
import "./FundToken.sol";

contract InvestorPortfolioManager is Ownable {
    struct InvestorPortfolio {
        uint256 modelPortfolioId;
        mapping(address => uint256) fundBalances;
        address primaryStablecoin; // e.g., USDC
    }

    // Mapping of investor address to their portfolio
    mapping(address => InvestorPortfolio) private _investorPortfolios;

    // Reference to ModelPortfolioManager contract
    ModelPortfolioManager public modelPortfolioManager;

    event PortfolioAssigned(address indexed investor, uint256 modelPortfolioId);
    event FundsDeposited(address indexed investor, uint256 amount);
    event PortfolioRebalanced(address indexed investor);

    constructor(address _modelPortfolioManagerAddress) Ownable(msg.sender) {
        modelPortfolioManager = ModelPortfolioManager(
            _modelPortfolioManagerAddress
        );
    }

    function assignModelPortfolio(
        address investor,
        uint256 modelPortfolioId,
        address primaryStablecoin
    ) public onlyOwner {
        InvestorPortfolio storage portfolio = _investorPortfolios[investor];
        portfolio.modelPortfolioId = modelPortfolioId;
        portfolio.primaryStablecoin = primaryStablecoin;

        emit PortfolioAssigned(investor, modelPortfolioId);
    }

    function deposit(uint256 amount) public {
        InvestorPortfolio storage portfolio = _investorPortfolios[msg.sender];
        require(portfolio.modelPortfolioId != 0, "No portfolio assigned");

        // Transfer stablecoin from investor to contract
        IERC20(portfolio.primaryStablecoin).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Rebalance portfolio
        _rebalancePortfolio(msg.sender);

        emit FundsDeposited(msg.sender, amount);
    }
    
    function _rebalancePortfolio(address investor) internal {
        InvestorPortfolio storage portfolio = _investorPortfolios[investor];

        // Retrieve model portfolio allocations
        ModelPortfolioManager.FundAllocation[]
            memory allocations = modelPortfolioManager.getModelPortfolio(
                portfolio.modelPortfolioId
            );

        // Total portfolio value calculation
        uint256 totalPortfolioValue = IERC20(portfolio.primaryStablecoin)
            .balanceOf(address(this));

        // Perform rebalancing
        for (uint i = 0; i < allocations.length; i++) {
            address fundTokenAddress = allocations[i].tokenAddress;
            uint256 targetWeight = allocations[i].targetWeight;

            // Calculate target amount based on weight
            uint256 targetAmount = (totalPortfolioValue * targetWeight) / 10000;

            // Current fund balance
            uint256 currentBalance = FundToken(fundTokenAddress).balanceOf(
                address(this)
            );

            if (currentBalance < targetAmount) {
                // Mint additional tokens
                FundToken(fundTokenAddress).mint(
                    address(this),
                    targetAmount - currentBalance
                );
            } else if (currentBalance > targetAmount) {
                // Burn excess tokens
                FundToken(fundTokenAddress).burn(
                    address(this),
                    currentBalance - targetAmount
                );
            }
        }

        emit PortfolioRebalanced(investor);
    }

    /**
     * @dev Allow investor to withdraw funds
     * @param fundTokenAddress Address of the fund token to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address fundTokenAddress, uint256 amount) public {
        InvestorPortfolio storage portfolio = _investorPortfolios[msg.sender];
        require(portfolio.modelPortfolioId != 0, "No portfolio assigned");

        // Perform withdrawal and rebalance
        FundToken(fundTokenAddress).transfer(msg.sender, amount);
        _rebalancePortfolio(msg.sender);
    }
}
