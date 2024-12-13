import { expect } from "chai";
import { ethers } from "hardhat";
import {
  FundToken,
  ModelPortfolioManager,
  InvestorPortfolioManager,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Portfolio Management System", function () {
  let owner: SignerWithAddress;
  let investor: SignerWithAddress;
  let usdcToken: FundToken;
  let realEstateToken: FundToken;
  let privateEquityToken: FundToken;
  let modelPortfolioManager: ModelPortfolioManager;
  let investorPortfolioManager: InvestorPortfolioManager;

  beforeEach(async function () {
    [owner, investor] = await ethers.getSigners();

    const FundToken = await ethers.getContractFactory("FundToken");
    usdcToken = await FundToken.deploy(
      "USDC Token",
      "USDC",
      6,
      "Stablecoin Fund"
    );
    realEstateToken = await FundToken.deploy(
      "Real Estate Token",
      "REAL",
      18,
      "Real Estate Fund"
    );
    privateEquityToken = await FundToken.deploy(
      "Private Equity Token",
      "PEQU",
      18,
      "Private Equity Fund"
    );

    const ModelPortfolioManager = await ethers.getContractFactory(
      "ModelPortfolioManager"
    );
    modelPortfolioManager = await ModelPortfolioManager.deploy();

    const InvestorPortfolioManager = await ethers.getContractFactory(
      "InvestorPortfolioManager"
    );
    investorPortfolioManager = await InvestorPortfolioManager.deploy(
      await modelPortfolioManager.getAddress()
    );

    await modelPortfolioManager.linkInvestorManager(
      await investorPortfolioManager.getAddress()
    );

    await usdcToken.transferOwnership(
      await investorPortfolioManager.getAddress()
    );
    await realEstateToken.transferOwnership(
      await investorPortfolioManager.getAddress()
    );
    await privateEquityToken.transferOwnership(
      await investorPortfolioManager.getAddress()
    );
  });

  describe("Portfolio Creation and Assignment", function () {
    it("Should create a model portfolio with correct weights", async function () {
      const weights = [3000n, 5000n, 2000n];
      const tokens = [
        await usdcToken.getAddress(),
        await realEstateToken.getAddress(),
        await privateEquityToken.getAddress(),
      ];

      const tx = await modelPortfolioManager.createModelPortfolio(
        tokens,
        weights
      );
      const receipt = await tx.wait();
      const event = receipt?.logs[0] as any;
      const portfolioId = event.args[0];

      const portfolio = await modelPortfolioManager.getModelPortfolio(
        portfolioId
      );
      expect(portfolio[0].targetWeight).to.equal(3000n);
    });

    it("Should assign portfolio to investor", async function () {
      const tokens = [
        await usdcToken.getAddress(),
        await realEstateToken.getAddress(),
      ];
      const weights = [5000n, 5000n];
      const tx = await modelPortfolioManager.createModelPortfolio(
        tokens,
        weights
      );
      const receipt = await tx.wait();
      const event = receipt?.logs[0] as any;
      const portfolioId = event.args[0];

      await investorPortfolioManager.assignModelPortfolio(
        investor.address,
        portfolioId,
        await usdcToken.getAddress()
      );

      const amount = ethers.parseUnits("100", 6);
      await usdcToken.mint(investor.address, amount);
      await usdcToken
        .connect(investor)
        .approve(await investorPortfolioManager.getAddress(), amount);
      await expect(investorPortfolioManager.connect(investor).deposit(amount))
        .to.not.be.reverted;
    });
  });

  describe("Investment Operations", function () {
    let portfolioId: bigint;

    beforeEach(async function () {
      const tokens = [
        await usdcToken.getAddress(),
        await realEstateToken.getAddress(),
        await privateEquityToken.getAddress(),
      ];
      const weights = [3000n, 5000n, 2000n];

      const tx = await modelPortfolioManager.createModelPortfolio(
        tokens,
        weights
      );
      const receipt = await tx.wait();
      const event = receipt?.logs[0] as any;
      portfolioId = event.args[0];

      await investorPortfolioManager.assignModelPortfolio(
        investor.address,
        portfolioId,
        await usdcToken.getAddress()
      );

      const amount = ethers.parseUnits("10000", 6);
      await usdcToken.mint(investor.address, amount);
      await usdcToken
        .connect(investor)
        .approve(investorPortfolioManager.getAddress(), amount);
    });

    it("Should handle deposit and rebalancing", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await investorPortfolioManager.connect(investor).deposit(depositAmount);

      const usdcBalance = await usdcToken.balanceOf(
        await investorPortfolioManager.getAddress()
      );
      const realEstateBalance = await realEstateToken.balanceOf(
        await investorPortfolioManager.getAddress()
      );
      const peBalance = await privateEquityToken.balanceOf(
        await investorPortfolioManager.getAddress()
      );

      const expectedUsdc = (depositAmount * 3000n) / 10000n;
      const expectedRealEstate = (depositAmount * 5000n) / 10000n;
      const expectedPE = (depositAmount * 2000n) / 10000n;

      expect(usdcBalance).to.equal(expectedUsdc);
      expect(realEstateBalance).to.equal(expectedRealEstate);
      expect(peBalance).to.equal(expectedPE);
    });

    it("Should handle withdrawals correctly", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await investorPortfolioManager.connect(investor).deposit(depositAmount);

      const initialBalance = await usdcToken.balanceOf(investor.address);
      const withdrawAmount = ethers.parseUnits("500", 6);

      await investorPortfolioManager.connect(investor).withdraw(withdrawAmount);

      const finalBalance = await usdcToken.balanceOf(investor.address);
      expect(finalBalance - initialBalance).to.equal(withdrawAmount);

      const remainingValue = await investorPortfolioManager.getPortfolioValue(
        investor.address
      );
      expect(remainingValue).to.equal(depositAmount - withdrawAmount);
    });
  });

  describe("Portfolio Rebalancing", function () {
    it("Should rebalance when model portfolio weights change", async function () {
      const tokens = [
        await usdcToken.getAddress(),
        await realEstateToken.getAddress(),
        await privateEquityToken.getAddress(),
      ];

      // Create portfolio and assign
      const tx = await modelPortfolioManager.createModelPortfolio(tokens, [
        3000n,
        5000n,
        2000n,
      ]);
      const receipt = await tx.wait();
      const event = receipt?.logs[0] as any;
      const portfolioId = event.args[0];

      await investorPortfolioManager.assignModelPortfolio(
        investor.address,
        portfolioId,
        await usdcToken.getAddress()
      );

      // Deposit
      const depositAmount = ethers.parseUnits("1000", 6);
      await usdcToken.mint(investor.address, depositAmount);
      await usdcToken
        .connect(investor)
        .approve(investorPortfolioManager.getAddress(), depositAmount);
      await investorPortfolioManager.connect(investor).deposit(depositAmount);

      // Update weights
      await modelPortfolioManager.updateModelPortfolio(portfolioId, tokens, [
        4000n,
        4000n,
        2000n,
      ]);

      const usdcBalance = await usdcToken.balanceOf(
        await investorPortfolioManager.getAddress()
      );
      expect(usdcBalance).to.equal((depositAmount * 4000n) / 10000n);
    });
  });
});
