import { ethers, run } from "hardhat";

async function main() {
  // Deploy Fund Tokens
  const FundToken = await ethers.getContractFactory("FundToken");
  const usdcToken = await FundToken.deploy("USDC Token", "USDC", 6, "Stablecoin Fund");
  const realEstateToken = await FundToken.deploy("Real Estate Token", "REAL", 18, "Real Estate Fund");
  const privateEquityToken = await FundToken.deploy("Private Equity Token", "PEQU", 18, "Private Equity Fund");

  // Deploy Model Portfolio Manager
  const ModelPortfolioManager = await ethers.getContractFactory("ModelPortfolioManager");
  const modelPortfolioManager = await ModelPortfolioManager.deploy();

  // Deploy Investor Portfolio Manager
  const InvestorPortfolioManager = await ethers.getContractFactory("InvestorPortfolioManager");
  const investorPortfolioManager = await InvestorPortfolioManager.deploy(await modelPortfolioManager.getAddress());

  // Wait for deployments to complete
  await usdcToken.waitForDeployment();
  await realEstateToken.waitForDeployment();
  await privateEquityToken.waitForDeployment();
  await modelPortfolioManager.waitForDeployment();
  await investorPortfolioManager.waitForDeployment();

  // Log contract addresses
  console.log("USDC Token deployed to:", await usdcToken.getAddress());
  console.log("Real Estate Token deployed to:", await realEstateToken.getAddress());
  console.log("Private Equity Token deployed to:", await privateEquityToken.getAddress());
  console.log("Model Portfolio Manager deployed to:", await modelPortfolioManager.getAddress());
  console.log("Investor Portfolio Manager deployed to:", await investorPortfolioManager.getAddress());

  // Optional: Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verifying contracts...");
    await verify(await usdcToken.getAddress(), ["USDC Token", "USDC", 6, "Stablecoin Fund"]);
    await verify(await realEstateToken.getAddress(), ["Real Estate Token", "REAL", 18, "Real Estate Fund"]);
    await verify(await privateEquityToken.getAddress(), ["Private Equity Token", "PEQU", 18, "Private Equity Fund"]);
    await verify(await modelPortfolioManager.getAddress(), []);
    await verify(await investorPortfolioManager.getAddress(), [await modelPortfolioManager.getAddress()]);
  }

  // Transfer ownership of fund tokens to InvestorPortfolioManager
  await usdcToken.transferOwnership(await investorPortfolioManager.getAddress());
  await realEstateToken.transferOwnership(await investorPortfolioManager.getAddress());
  await privateEquityToken.transferOwnership(await investorPortfolioManager.getAddress());
}

async function verify(contractAddress: string, args: any[]) {
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 