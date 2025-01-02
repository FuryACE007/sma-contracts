import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer, portfolioManager] = await ethers.getSigners();
  console.log("Starting local node with:");
  console.log("- Deployer:", deployer.address); // Account #0
  console.log("- Portfolio Manager:", portfolioManager.address); // Account #1

  // Deploy Fund Tokens with initial supply
  const initialSupply = ethers.parseUnits("1000000", 6); // 1M tokens
  const FundToken = await ethers.getContractFactory("FundToken");

  const usdcToken = await FundToken.deploy("USDC Token", "USDC", initialSupply);
  await usdcToken.waitForDeployment();
  console.log("✅ USDC Token deployed to:", await usdcToken.getAddress());

  const realEstateToken = await FundToken.deploy(
    "Real Estate Token",
    "REAL",
    initialSupply
  );
  await realEstateToken.waitForDeployment();
  console.log(
    "✅ Real Estate Token deployed to:",
    await realEstateToken.getAddress()
  );

  const privateEquityToken = await FundToken.deploy(
    "Private Equity Token",
    "PEQU",
    initialSupply
  );
  await privateEquityToken.waitForDeployment();
  console.log(
    "✅ Private Equity Token deployed to:",
    await privateEquityToken.getAddress()
  );

  // Deploy Model Portfolio Manager with placeholder
  const ModelPortfolioManager = await ethers.getContractFactory(
    "ModelPortfolioManager"
  );
  const modelPortfolioManager = await ModelPortfolioManager.deploy(
    ethers.ZeroAddress
  );
  await modelPortfolioManager.waitForDeployment();
  console.log(
    "✅ Model Portfolio Manager deployed to:",
    await modelPortfolioManager.getAddress()
  );

  // Deploy Investor Portfolio Manager
  const InvestorPortfolioManager = await ethers.getContractFactory(
    "InvestorPortfolioManager"
  );
  const investorPortfolioManager = await InvestorPortfolioManager.deploy(
    await usdcToken.getAddress(),
    await modelPortfolioManager.getAddress()
  );
  await investorPortfolioManager.waitForDeployment();
  console.log(
    "✅ Investor Portfolio Manager deployed to:",
    await investorPortfolioManager.getAddress()
  );

  // Transfer ownership to Portfolio Manager (Account #1)
  console.log(
    "\nTransferring ownership to Portfolio Manager:",
    portfolioManager.address
  );
  await modelPortfolioManager.transferOwnership(portfolioManager.address);
  await investorPortfolioManager.transferOwnership(portfolioManager.address);
  console.log("✅ Contract ownership transferred");

  // Update ModelPortfolioManager with IPM address
  console.log("\nUpdating ModelPortfolioManager with IPM address...");
  await modelPortfolioManager
    .connect(portfolioManager)
    .updateInvestorPortfolioManager(
      await investorPortfolioManager.getAddress()
    );
  console.log("✅ ModelPortfolioManager updated");

  // Transfer token ownership
  console.log("\nTransferring token ownership to InvestorPortfolioManager...");
  await usdcToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  await realEstateToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  await privateEquityToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  console.log("✅ Token ownership transferred");

  // Transfer initial USDC to investor for testing
  const investor = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Account #2
  const initialInvestorBalance = ethers.parseUnits("10000", 6); // 10,000 USDC

  console.log("\nTransferring initial USDC to investor...");
  await usdcToken.transfer(investor, initialInvestorBalance);
  console.log(
    `✅ Transferred ${ethers.formatUnits(
      initialInvestorBalance,
      6
    )} USDC to investor`
  );

  // Log balances
  const investorBalance = await usdcToken.balanceOf(investor);
  console.log(
    `Investor USDC balance: ${ethers.formatUnits(investorBalance, 6)}`
  );

  // Save deployment info
  const deploymentInfo = {
    addresses: {
      usdcToken: await usdcToken.getAddress(),
      realEstateToken: await realEstateToken.getAddress(),
      privateEquityToken: await privateEquityToken.getAddress(),
      modelPortfolioManager: await modelPortfolioManager.getAddress(),
      investorPortfolioManager: await investorPortfolioManager.getAddress(),
    },
    accounts: {
      deployer: deployer.address,
      manager: portfolioManager.address,
    },
  };

  // Save to backend
  const backendPath = path.join(
    __dirname,
    "../../sma-backend/src/contracts/deployment.json"
  );
  fs.writeFileSync(backendPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved");

  // Copy ABIs to backend
  console.log("Copying ABIs to backend...");
  const abiPath = path.join(__dirname, "../../sma-backend/src/abi");
  if (!fs.existsSync(abiPath)) {
    fs.mkdirSync(abiPath, { recursive: true });
  }

  const contracts = [
    "FundToken",
    "ModelPortfolioManager",
    "InvestorPortfolioManager",
  ];

  for (const contract of contracts) {
    const sourcePath = path.join(
      __dirname,
      `../artifacts/contracts/${contract}.sol/${contract}.json`
    );
    const destPath = path.join(abiPath, `${contract}.json`);

    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${contract} ABI`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
