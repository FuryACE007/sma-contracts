import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  // Deploy contracts
  const FundToken = await ethers.getContractFactory("FundToken");
  const usdcToken = await FundToken.deploy(
    "USDC Token",
    "USDC",
    6,
    "Stablecoin Fund"
  );
  const realEstateToken = await FundToken.deploy(
    "Real Estate Token",
    "REAL",
    18,
    "Real Estate Fund"
  );
  const privateEquityToken = await FundToken.deploy(
    "Private Equity Token",
    "PEQU",
    18,
    "Private Equity Fund"
  );

  const ModelPortfolioManager = await ethers.getContractFactory(
    "ModelPortfolioManager"
  );
  const modelPortfolioManager = await ModelPortfolioManager.deploy();

  const InvestorPortfolioManager = await ethers.getContractFactory(
    "InvestorPortfolioManager"
  );
  const investorPortfolioManager = await InvestorPortfolioManager.deploy(
    await modelPortfolioManager.getAddress()
  );

  // Wait for deployments
  await Promise.all([
    usdcToken.waitForDeployment(),
    realEstateToken.waitForDeployment(),
    privateEquityToken.waitForDeployment(),
    modelPortfolioManager.waitForDeployment(),
    investorPortfolioManager.waitForDeployment(),
  ]);

  // Link the managers
  await modelPortfolioManager.linkInvestorManager(
    await investorPortfolioManager.getAddress()
  );

  // Transfer ownerships
  await usdcToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  await realEstateToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  await privateEquityToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );

  // Save contract addresses
  const deploymentInfo = {
    addresses: {
      usdcToken: await usdcToken.getAddress(),
      realEstateToken: await realEstateToken.getAddress(),
      privateEquityToken: await privateEquityToken.getAddress(),
      modelPortfolioManager: await modelPortfolioManager.getAddress(),
      investorPortfolioManager: await investorPortfolioManager.getAddress(),
    },
  };

  // Create deployment info file
  const deploymentPath = path.join(
    __dirname,
    "../../sma-backend/src/contracts/deployment.json"
  );
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  // Copy ABIs to backend
  const abiPath = path.join(__dirname, "../../sma-backend/src/abi");
  if (!fs.existsSync(abiPath)) {
    fs.mkdirSync(abiPath, { recursive: true });
  }

  // Copy each ABI
  fs.copyFileSync(
    path.join(__dirname, "../artifacts/contracts/FundToken.sol/FundToken.json"),
    path.join(abiPath, "FundToken.json")
  );
  fs.copyFileSync(
    path.join(__dirname, "../artifacts/contracts/ModelPortfolioManager.sol/ModelPortfolioManager.json"),
    path.join(abiPath, "ModelPortfolioManager.json")
  );
  fs.copyFileSync(
    path.join(__dirname, "../artifacts/contracts/InvestorPortfolioManager.sol/InvestorPortfolioManager.json"),
    path.join(abiPath, "InvestorPortfolioManager.json")
  );

  console.log("Local node started with deployed contracts:");
  console.log(deploymentInfo.addresses);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
