import { ethers, run } from "hardhat";

async function main() {
  // Deploy Fund Tokens
  const FundToken = await ethers.getContractFactory("FundToken");
  const usdcToken = await FundToken.deploy("USDC Token", "USDC");
  const realEstateToken = await FundToken.deploy("Real Estate Token", "REAL");
  const privateEquityToken = await FundToken.deploy(
    "Private Equity Token",
    "PEQU"
  );

  // Deploy Model Portfolio Manager first with placeholder address
  const ModelPortfolioManager = await ethers.getContractFactory(
    "ModelPortfolioManager"
  );
  const modelPortfolioManager = await ModelPortfolioManager.deploy(
    ethers.ZeroAddress // Temporary address, will update after IPM deployment
  );

  // Deploy Investor Portfolio Manager
  const InvestorPortfolioManager = await ethers.getContractFactory(
    "InvestorPortfolioManager"
  );
  const investorPortfolioManager = await InvestorPortfolioManager.deploy(
    await usdcToken.getAddress(),
    await modelPortfolioManager.getAddress()
  );

  // Update ModelPortfolioManager with correct IPM address
  await modelPortfolioManager.transferOwnership(
    await investorPortfolioManager.getAddress()
  );

  // Wait for deployments to complete
  await Promise.all([
    usdcToken.waitForDeployment(),
    realEstateToken.waitForDeployment(),
    privateEquityToken.waitForDeployment(),
    modelPortfolioManager.waitForDeployment(),
    investorPortfolioManager.waitForDeployment(),
  ]);

  // Transfer ownership of fund tokens to InvestorPortfolioManager
  await usdcToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  await realEstateToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );
  await privateEquityToken.transferOwnership(
    await investorPortfolioManager.getAddress()
  );

  // Verify contracts if on a supported network
  if (process.env.ETHERSCAN_API_KEY) {
    await verify(await usdcToken.getAddress(), ["USDC Token", "USDC"]);
    await verify(await realEstateToken.getAddress(), [
      "Real Estate Token",
      "REAL",
    ]);
    await verify(await privateEquityToken.getAddress(), [
      "Private Equity Token",
      "PEQU",
    ]);
    await verify(await modelPortfolioManager.getAddress(), [
      await investorPortfolioManager.getAddress(),
    ]);
    await verify(await investorPortfolioManager.getAddress(), [
      await usdcToken.getAddress(),
      await modelPortfolioManager.getAddress(),
    ]);
  }
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
