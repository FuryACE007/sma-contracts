// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FundToken is ERC20, Ownable {
    uint8 private immutable _decimals;
    string private _fundDescription;

    event FundTokenMinted(address indexed to, uint256 amount);
    event FundTokenBurned(address indexed from, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalPlaces,
        string memory fundDescription
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimalPlaces;
        _fundDescription = fundDescription;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function getFundDescription() public view returns (string memory) {
        return _fundDescription;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
        emit FundTokenMinted(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
        emit FundTokenBurned(from, amount);
    }
}
