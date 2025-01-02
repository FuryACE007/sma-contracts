// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FundToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10**18; // 1M tokens
    uint256 public constant TOKEN_PRICE = 1 * 10**6; // 1 USD (in USDC decimals)

    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function getTokenPrice() public pure returns (uint256) {
        return TOKEN_PRICE;
    }
}
