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
    event FundsWithdrawn(address indexed investor, uint256 amount);

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
     * @dev Allow investor to withdraw funds in stablecoin
     * @param amount Amount of stablecoin to withdraw
     */
    function withdraw(uint256 amount) public {
        InvestorPortfolio storage portfolio = _investorPortfolios[msg.sender];
        require(portfolio.modelPortfolioId != 0, "No portfolio assigned");
        
        // Get total portfolio value in stablecoin
        uint256 totalValue = IERC20(portfolio.primaryStablecoin).balanceOf(address(this));
        require(amount <= totalValue, "Insufficient balance");

        // Get current allocations
        ModelPortfolioManager.FundAllocation[] memory allocations = 
            modelPortfolioManager.getModelPortfolio(portfolio.modelPortfolioId);

        // Burn proportional amount of fund tokens
        for (uint i = 0; i < allocations.length; i++) {
            address fundTokenAddress = allocations[i].tokenAddress;
            
            // Calculate amount of fund tokens to burn
            uint256 burnAmount = (FundToken(fundTokenAddress).balanceOf(address(this)) * amount) / totalValue;
            if (burnAmount > 0) {
                FundToken(fundTokenAddress).burn(address(this), burnAmount);
            }
        }

        // Transfer stablecoin to investor
        IERC20(portfolio.primaryStablecoin).transfer(msg.sender, amount);

        // Rebalance remaining portfolio
        _rebalancePortfolio(msg.sender);

        emit FundsWithdrawn(msg.sender, amount);
    }

    function getPortfolioValue(address investor) public view returns (uint256) {
        InvestorPortfolio storage portfolio = _investorPortfolios[investor];
        require(portfolio.modelPortfolioId != 0, "No portfolio assigned");
        return IERC20(portfolio.primaryStablecoin).balanceOf(address(this));
    }

    // Make rebalancing public but restricted to linked model managers
    function rebalancePortfolio(address investor) public {
        require(msg.sender == address(modelPortfolioManager), "Unauthorized");
        _rebalancePortfolio(investor);
    }
}
