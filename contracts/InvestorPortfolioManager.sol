// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ModelPortfolioManager.sol";
import "./FundToken.sol";

contract InvestorPortfolioManager is Ownable {
    struct Portfolio {
        mapping(address => uint256) tokenBalances;
        address[] tokens;
        uint256 modelId;
    }
    
    struct ModelPortfolio {
        address[] tokens;
        uint256[] weights;
    }
    
    mapping(address => Portfolio) private portfolios;
    mapping(uint256 => ModelPortfolio) private modelPortfolios;
    
    IERC20 public immutable USDC;
    uint256 private constant BASIS_POINTS = 10000;

    event PortfolioRebalanced(address indexed investor);

    ModelPortfolioManager public immutable modelPortfolioManager;

    constructor(address _usdc, address _modelPortfolioManager) Ownable(msg.sender) {
        USDC = IERC20(_usdc);
        modelPortfolioManager = ModelPortfolioManager(_modelPortfolioManager);
    }

    function deposit(uint256 usdcAmount) external {
        require(usdcAmount > 0, "Amount must be greater than 0");
        
        // Transfer USDC from investor
        USDC.transferFrom(msg.sender, address(this), usdcAmount);
        
        // Get investor's portfolio
        Portfolio storage portfolio = portfolios[msg.sender];
        require(portfolio.modelId > 0, "No portfolio assigned");
        
        // Get model portfolio from ModelPortfolioManager
        ModelPortfolioManager.FundAllocation[] memory allocations = 
            modelPortfolioManager.getModelPortfolio(portfolio.modelId);
        
        // Allocate according to model weights
        for (uint i = 0; i < allocations.length; i++) {
            address token = allocations[i].tokenAddress;
            uint256 allocation = (usdcAmount * allocations[i].targetWeight) / BASIS_POINTS;
            
            // Transfer fund tokens to investor
            IERC20(token).transfer(msg.sender, allocation);
            portfolio.tokenBalances[token] += allocation;
            
            // Add token to portfolio's tokens array if not already present
            bool tokenExists = false;
            for (uint j = 0; j < portfolio.tokens.length; j++) {
                if (portfolio.tokens[j] == token) {
                    tokenExists = true;
                    break;
                }
            }
            if (!tokenExists) {
                portfolio.tokens.push(token);
            }
        }
    }

    function withdraw(uint256 usdcAmount) external {
        // First rebalance to ensure proper proportions
        _rebalancePortfolio(msg.sender);

        Portfolio storage portfolio = portfolios[msg.sender];
        uint256 totalValue = getPortfolioValue(msg.sender);
        require(usdcAmount <= totalValue, "Insufficient balance");

        // Calculate proportion to withdraw
        uint256 proportion = (usdcAmount * BASIS_POINTS) / totalValue;
        
        // Withdraw proportionally from each token
        for (uint i = 0; i < portfolio.tokens.length; i++) {
            address token = portfolio.tokens[i];
            uint256 amount = (portfolio.tokenBalances[token] * proportion) / BASIS_POINTS;
            
            // Transfer tokens from investor to contract
            IERC20(token).transferFrom(msg.sender, address(this), amount);
            portfolio.tokenBalances[token] -= amount;
        }

        // Return USDC to investor
        USDC.transfer(msg.sender, usdcAmount);
    }

    function _rebalancePortfolio(address investor) internal {
        Portfolio storage portfolio = portfolios[investor];
        
        // Get latest model portfolio from MPM
        ModelPortfolioManager.FundAllocation[] memory modelPortfolio = 
            modelPortfolioManager.getModelPortfolio(portfolio.modelId);
        
        uint256 totalValue = getPortfolioValue(investor);

        // Add any new tokens to portfolio's token list
        for (uint i = 0; i < modelPortfolio.length; i++) {
            address token = modelPortfolio[i].tokenAddress;
            bool exists = false;
            for (uint j = 0; j < portfolio.tokens.length; j++) {
                if (portfolio.tokens[j] == token) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                portfolio.tokens.push(token);
            }
        }

        // Rebalance each token according to new weights
        for (uint i = 0; i < modelPortfolio.length; i++) {
            address token = modelPortfolio[i].tokenAddress;
            uint256 targetAmount = (totalValue * modelPortfolio[i].targetWeight) / BASIS_POINTS;
            uint256 currentAmount = portfolio.tokenBalances[token];

            if (currentAmount < targetAmount) {
                uint256 buyAmount = targetAmount - currentAmount;
                IERC20(token).transfer(investor, buyAmount);
                portfolio.tokenBalances[token] += buyAmount;
            } else if (currentAmount > targetAmount) {
                uint256 sellAmount = currentAmount - targetAmount;
                IERC20(token).transferFrom(investor, address(this), sellAmount);
                portfolio.tokenBalances[token] -= sellAmount;
            }
        }
        
        emit PortfolioRebalanced(investor);
    }

    function rebalancePortfolio(address investor) external {
        require(
            msg.sender == address(modelPortfolioManager) || msg.sender == owner(),
            "Unauthorized"
        );
        _rebalancePortfolio(investor);
    }

    function getPortfolioValue(address investor) public view returns (uint256) {
        Portfolio storage portfolio = portfolios[investor];
        uint256 totalValue = 0;
        
        for (uint i = 0; i < portfolio.tokens.length; i++) {
            address token = portfolio.tokens[i];
            totalValue += portfolio.tokenBalances[token]; // 1:1 price with USD
        }
        
        return totalValue;
    }

    function assignModelPortfolio(
        address investor,
        uint256 portfolioId,
        address stablecoin
    ) external onlyOwner {
        Portfolio storage portfolio = portfolios[investor];
        portfolio.modelId = portfolioId;
        portfolio.tokens.push(stablecoin);
    }

    function getInvestorPortfolio(address investor) public view returns (uint256) {
        return portfolios[investor].modelId;
    }
}
