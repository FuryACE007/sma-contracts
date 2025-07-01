import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts to Sepolia with:");
  console.log("- Deployer:", deployer.address);

  // Get portfolio manager address from env
  const portfolioManagerKey = process.env.PORTFOLIO_MANAGER_KEY || "";
  if (!portfolioManagerKey) {
    throw new Error("Portfolio manager key not set in environment variables");
  }
  const portfolioManager = new ethers.Wallet(
    portfolioManagerKey,
    ethers.provider
  );
  console.log("- Portfolio Manager:", portfolioManager.address);

  // Deploy Fund Tokens
  const FundToken = await ethers.getContractFactory("FundToken");

  const cashToken = await FundToken.deploy("Cash Token", "CASH");
  await cashToken.waitForDeployment();
  console.log("✅ Cash Token deployed to:", await cashToken.getAddress());

  const realEstateToken = await FundToken.deploy("Real Estate Token", "REAL");
  await realEstateToken.waitForDeployment();
  console.log(
    "✅ Real Estate Token deployed to:",
    await realEstateToken.getAddress()
  );

  const privateEquityToken = await FundToken.deploy(
    "Private Equity Token",
    "PEQU"
  );
  await privateEquityToken.waitForDeployment();
  console.log(
    "✅ Private Equity Token deployed to:",
    await privateEquityToken.getAddress()
  );

  // Deploy Model Portfolio Manager
  const ModelPortfolioManager = await ethers.getContractFactory(
    "ModelPortfolioManager"
  );

  const modelPortfolioManager = await ModelPortfolioManager.deploy(
    await cashToken.getAddress()
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
    await modelPortfolioManager.getAddress()
  );
  await investorPortfolioManager.waitForDeployment();
  console.log(
    "✅ Investor Portfolio Manager deployed to:",
    await investorPortfolioManager.getAddress()
  );

  // Transfer ownership to Portfolio Manager
  await modelPortfolioManager.transferOwnership(portfolioManager.address);
  await investorPortfolioManager.transferOwnership(portfolioManager.address);
  console.log("✅ Contract ownership transferred");

  // Update ModelPortfolioManager with IPM address
  // Note: This will fail if the deployer and portfolio manager are different
  // In that case, the portfolio manager will need to call this function separately
  try {
    await modelPortfolioManager
      .connect(portfolioManager)
      .updateInvestorPortfolioManager(
        await investorPortfolioManager.getAddress()
      );
    console.log("✅ ModelPortfolioManager updated");
  } catch (error) {
    console.log(
      "⚠️ Portfolio manager needs to update ModelPortfolioManager manually"
    );
  }

  // Transfer token ownership to IPM
  const ipmAddress = await investorPortfolioManager.getAddress();
  await cashToken.transferOwnership(ipmAddress);
  await realEstateToken.transferOwnership(ipmAddress);
  await privateEquityToken.transferOwnership(ipmAddress);
  console.log("✅ Fund Token ownership transferred");

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    addresses: {
      cashToken: await cashToken.getAddress(),
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

  // Save locally for reference
  const localPath = path.join(__dirname, "../deployment-sepolia.json");
  fs.writeFileSync(localPath, JSON.stringify(deploymentInfo, null, 2));

  // Save to backend and copy ABIs
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

  console.log("\n✅ Deployment complete! Contract addresses:");
  console.log(JSON.stringify(deploymentInfo.addresses, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
