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
        uint256 cashBalance;
    }
    
    struct ModelPortfolio {
        address[] tokens;
        uint256[] weights;
    }
    
    mapping(address => Portfolio) private portfolios;
    mapping(uint256 => ModelPortfolio) private modelPortfolios;
    
    uint256 private constant BASIS_POINTS = 10000;

    event PortfolioRebalanced(address indexed investor);
    event CashBalanceUpdated(address indexed investor, uint256 amount, bool isIncrease);

    ModelPortfolioManager public immutable modelPortfolioManager;

    constructor(address _modelPortfolioManager) Ownable(msg.sender) {
        modelPortfolioManager = ModelPortfolioManager(_modelPortfolioManager);
    }

    function _rebalancePortfolio(address investor) internal {
        Portfolio storage portfolio = portfolios[investor];
        
        // Get latest model portfolio from MPM
        ModelPortfolioManager.FundAllocation[] memory modelPortfolio = 
            modelPortfolioManager.getModelPortfolio(portfolio.modelId);
        
        uint256 totalValue = getPortfolioValue(investor);
    
        // Find cash allocation from model portfolio
        uint256 cashWeight = 0;
        for (uint i = 0; i < modelPortfolio.length; i++) {
            if (modelPortfolio[i].tokenAddress == address(0)) {
                cashWeight = modelPortfolio[i].targetWeight;
                uint256 targetCashAmount = (totalValue * cashWeight) / BASIS_POINTS;
                
                if (portfolio.cashBalance != targetCashAmount) {
                    emit CashBalanceUpdated(
                        investor,
                        portfolio.cashBalance > targetCashAmount ? 
                        portfolio.cashBalance - targetCashAmount : 
                        targetCashAmount - portfolio.cashBalance,
                        portfolio.cashBalance < targetCashAmount
                    );
                    portfolio.cashBalance = targetCashAmount;
                }
                break;
            }
        }
    
        // Add any new tokens to portfolio's token list
        for (uint i = 0; i < modelPortfolio.length; i++) {
            address token = modelPortfolio[i].tokenAddress;
            if (token == address(0)) continue; // Skip cash allocation
            
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
            if (token == address(0)) continue; // Skip cash allocation
            
            uint256 targetAmount = (totalValue * modelPortfolio[i].targetWeight) / BASIS_POINTS;
            uint256 currentAmount = portfolio.tokenBalances[token];
    
            if (currentAmount < targetAmount) {
                uint256 mintAmount = targetAmount - currentAmount;
                FundToken(token).mint(investor, mintAmount);
                portfolio.tokenBalances[token] += mintAmount;
            } else if (currentAmount > targetAmount) {
                uint256 burnAmount = currentAmount - targetAmount;
                FundToken(token).burn(investor, burnAmount);
                portfolio.tokenBalances[token] -= burnAmount;
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
        uint256 totalValue = portfolio.cashBalance; // Include cash in total value
        
        for (uint i = 0; i < portfolio.tokens.length; i++) {
            address token = portfolio.tokens[i];
            totalValue += portfolio.tokenBalances[token]; // 1:1 price with USD
        }
        
        return totalValue;
    }

    function assignModelPortfolio(
        address investor,
        uint256 portfolioId
    ) external onlyOwner {
        Portfolio storage portfolio = portfolios[investor];
        portfolio.modelId = portfolioId;
    }

    function getInvestorPortfolio(address investor) public view returns (uint256) {
        return portfolios[investor].modelId;
    }
    
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // Get investor's portfolio
        Portfolio storage portfolio = portfolios[msg.sender];
        require(portfolio.modelId > 0, "No portfolio assigned");
        
        // Get model portfolio allocations
        ModelPortfolioManager.FundAllocation[] memory allocations = 
            modelPortfolioManager.getModelPortfolio(portfolio.modelId);
        
        // Find cash allocation from model portfolio
        uint256 cashWeight = 0;
        for (uint i = 0; i < allocations.length; i++) {
            if (allocations[i].tokenAddress == address(0)) {
                cashWeight = allocations[i].targetWeight;
                break;
            }
        }
        
        // Calculate and update cash balance
        uint256 cashAmount = (amount * cashWeight) / BASIS_POINTS;
        portfolio.cashBalance += cashAmount;
        
        // Emit event for backend to update cash balance
        emit CashBalanceUpdated(msg.sender, cashAmount, true);
        
        // Allocate remaining amount to fund tokens
        uint256 remainingAmount = amount - cashAmount;
        for (uint i = 0; i < allocations.length; i++) {
            if (allocations[i].tokenAddress != address(0)) {
                address token = allocations[i].tokenAddress;
                uint256 allocation = (remainingAmount * allocations[i].targetWeight) / 
                    (BASIS_POINTS - cashWeight);
                
                FundToken(token).mint(msg.sender, allocation);
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
    }

    function withdraw(uint256 amount) external {
        _rebalancePortfolio(msg.sender);

        Portfolio storage portfolio = portfolios[msg.sender];
        uint256 totalValue = getPortfolioValue(msg.sender);
        require(amount <= totalValue, "Insufficient balance");

        // Calculate cash proportion
        uint256 cashAmount = (amount * portfolio.cashBalance) / totalValue;
        portfolio.cashBalance -= cashAmount;
        
        // Emit event for backend to update cash balance
        emit CashBalanceUpdated(msg.sender, cashAmount, false);

        // Withdraw proportionally from each token
        uint256 remainingAmount = amount - cashAmount;
        uint256 remainingValue = totalValue - portfolio.cashBalance;
        
        for (uint i = 0; i < portfolio.tokens.length; i++) {
            address token = portfolio.tokens[i];
            uint256 tokenAmount = (portfolio.tokenBalances[token] * remainingAmount) / remainingValue;
            
            FundToken(token).burn(msg.sender, tokenAmount);
            portfolio.tokenBalances[token] -= tokenAmount;
        }
    }
}
