// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./FundToken.sol";

interface IInvestorPortfolioManager {
    function rebalancePortfolio(address investor) external;
}

contract ModelPortfolioManager is Ownable {
    struct FundAllocation {
        address tokenAddress;
        uint256 targetWeight;
    }

    mapping(uint256 => FundAllocation[]) private _modelPortfolios;
    uint256 private _portfolioIdCounter = 1;
    
    // Track which investors are using each model portfolio
    mapping(uint256 => address[]) private _portfolioInvestors;
    
    // Reference to InvestorPortfolioManager
    address public investorPortfolioManager;

    event ModelPortfolioCreated(uint256 indexed portfolioId);
    event ModelPortfolioUpdated(uint256 indexed portfolioId);
    event InvestorAssigned(address indexed investor, uint256 indexed portfolioId);

    constructor(address _investorPortfolioManager) Ownable(msg.sender) {
        investorPortfolioManager = _investorPortfolioManager;
    }

    function createModelPortfolio(
        address[] memory fundAddresses,
        uint256[] memory weights
    ) public onlyOwner returns (uint256 portfolioId) {
        require(fundAddresses.length == weights.length, "Arrays length mismatch");
        
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

        require(totalWeight == 10000, "Total weights must equal 10000 basis points");

        portfolioId = _portfolioIdCounter++;
        emit ModelPortfolioCreated(portfolioId);
        return portfolioId;
    }

    function updateModelPortfolio(
        uint256 portfolioId,
        address[] calldata fundAddresses,
        uint256[] calldata weights
    ) external onlyOwner {
        require(fundAddresses.length == weights.length, "Arrays length mismatch");
        
        uint256 totalWeight;
        delete _modelPortfolios[portfolioId];
        
        for (uint i = 0; i < fundAddresses.length; i++) {
            totalWeight += weights[i];
            _modelPortfolios[portfolioId].push(
                FundAllocation({
                    tokenAddress: fundAddresses[i],
                    targetWeight: weights[i]
                })
            );
        }
        
        require(totalWeight == 10000, "Total weights must equal 10000 basis points");

        // Trigger rebalancing for all affected investors
        address[] storage investors = _portfolioInvestors[portfolioId];
        for (uint i = 0; i < investors.length; i++) {
            IInvestorPortfolioManager(investorPortfolioManager).rebalancePortfolio(investors[i]);
        }
        
        emit ModelPortfolioUpdated(portfolioId);
    }

    function updateInvestorPortfolioManager(address _investorPortfolioManager) external onlyOwner {
        require(_investorPortfolioManager != address(0), "Invalid address");
        investorPortfolioManager = _investorPortfolioManager;
    }

    function assignInvestor(address investor, uint256 portfolioId) external {
        require(msg.sender == investorPortfolioManager, "Unauthorized");
        _portfolioInvestors[portfolioId].push(investor);
        emit InvestorAssigned(investor, portfolioId);
    }

    function getModelPortfolio(uint256 portfolioId) 
        public view returns (FundAllocation[] memory) 
    {
        return _modelPortfolios[portfolioId];
    }
}
