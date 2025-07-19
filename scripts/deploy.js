import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to load contract artifacts from Hardhat compilation
function loadContractArtifact(contractName, artifactsBasePath = null) {
  // Default to standard Hardhat artifacts path
  const basePath =
    artifactsBasePath || path.join(__dirname, "../artifacts/contracts");

  // Try different possible paths for the contract
  const possiblePaths = [
    path.join(basePath, `${contractName}.sol`, `${contractName}.json`),
    path.join(basePath, `${contractName}`, `${contractName}.json`),
    path.join(basePath, `${contractName}.json`),
  ];

  for (const artifactPath of possiblePaths) {
    try {
      if (fs.existsSync(artifactPath)) {
        console.log(`📋 Loading ${contractName} from: ${artifactPath}`);
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

        if (!artifact.abi || !artifact.bytecode) {
          throw new Error(`Invalid artifact format for ${contractName}`);
        }

        return {
          abi: artifact.abi,
          bytecode: artifact.bytecode,
        };
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not load ${contractName} from ${artifactPath}:`,
        error.message
      );
    }
  }

  throw new Error(
    `Could not find artifact for ${contractName}. Make sure you've compiled with: npx hardhat compile`
  );
}

async function main() {
  // Configuration from environment variables
  const RPC_URL = process.env.BUILD_BEAR_RPC_URL;
  const DEPLOYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
  const PORTFOLIO_MANAGER_KEY = process.env.PORTFOLIO_MANAGER_KEY;

  console.log("🔧 Configuration: " + " Rpc: " + RPC_URL + ", " + "Deployer: " + DEPLOYER_PRIVATE_KEY + ", " + "Portfolio Manager: " + PORTFOLIO_MANAGER_KEY);
  

  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("Deployer private key not set in environment variables");
  }

  if (!PORTFOLIO_MANAGER_KEY) {
    throw new Error("Portfolio manager key not set in environment variables");
  }

  // Create provider and signers
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const portfolioManager = new ethers.Wallet(PORTFOLIO_MANAGER_KEY, provider);

  console.log("Deploying contracts with:");
  console.log("- RPC URL:", RPC_URL);
  console.log("- Deployer:", deployer.address);
  console.log("- Portfolio Manager:", portfolioManager.address);

  // Check deployer balance
  const deployerBalance = await provider.getBalance(deployer.address);
  console.log(
    "- Deployer Balance:",
    ethers.formatEther(deployerBalance),
    "ETH"
  );

  if (deployerBalance === 0n) {
    throw new Error("Deployer account has no ETH balance");
  }

  // Load contract artifacts
  console.log("\n📋 Loading contract artifacts...");
  const fundTokenArtifact = loadContractArtifact("FundToken");
  const modelPortfolioManagerArtifact = loadContractArtifact(
    "ModelPortfolioManager"
  );
  const investorPortfolioManagerArtifact = loadContractArtifact(
    "InvestorPortfolioManager"
  );

  // Deploy Fund Tokens
  console.log("\n📦 Deploying Fund Tokens...");

  // Deploy Cash Token
  const cashTokenFactory = new ethers.ContractFactory(
    fundTokenArtifact.abi,
    fundTokenArtifact.bytecode,
    deployer
  );

  console.log("Deploying Cash Token...");
  const cashToken = await cashTokenFactory.deploy("Cash Token", "CASH");
  await cashToken.waitForDeployment();
  const cashTokenAddress = await cashToken.getAddress();
  console.log("✅ Cash Token deployed to:", cashTokenAddress);

  // Deploy Real Estate Token
  console.log("Deploying Real Estate Token...");
  const realEstateToken = await cashTokenFactory.deploy(
    "Real Estate Token",
    "REAL"
  );
  await realEstateToken.waitForDeployment();
  const realEstateTokenAddress = await realEstateToken.getAddress();
  console.log("✅ Real Estate Token deployed to:", realEstateTokenAddress);

  // Deploy Private Equity Token
  console.log("Deploying Private Equity Token...");
  const privateEquityToken = await cashTokenFactory.deploy(
    "Private Equity Token",
    "PEQU"
  );
  await privateEquityToken.waitForDeployment();
  const privateEquityTokenAddress = await privateEquityToken.getAddress();
  console.log(
    "✅ Private Equity Token deployed to:",
    privateEquityTokenAddress
  );

  // Deploy Model Portfolio Manager
  console.log("\n📦 Deploying Model Portfolio Manager...");
  const modelPortfolioManagerFactory = new ethers.ContractFactory(
    modelPortfolioManagerArtifact.abi,
    modelPortfolioManagerArtifact.bytecode,
    deployer
  );
  const modelPortfolioManager = await modelPortfolioManagerFactory.deploy(
    cashTokenAddress
  );
  await modelPortfolioManager.waitForDeployment();
  const modelPortfolioManagerAddress = await modelPortfolioManager.getAddress();
  console.log(
    "✅ Model Portfolio Manager deployed to:",
    modelPortfolioManagerAddress
  );

  // Deploy Investor Portfolio Manager
  console.log("\n📦 Deploying Investor Portfolio Manager...");
  const investorPortfolioManagerFactory = new ethers.ContractFactory(
    investorPortfolioManagerArtifact.abi,
    investorPortfolioManagerArtifact.bytecode,
    deployer
  );
  const investorPortfolioManager = await investorPortfolioManagerFactory.deploy(
    modelPortfolioManagerAddress
  );
  await investorPortfolioManager.waitForDeployment();
  const investorPortfolioManagerAddress =
    await investorPortfolioManager.getAddress();
  console.log(
    "✅ Investor Portfolio Manager deployed to:",
    investorPortfolioManagerAddress
  );

  // Transfer ownership to Portfolio Manager
  console.log("\n🔄 Transferring ownership...");

  console.log("Transferring ModelPortfolioManager ownership...");
  const tx1 = await modelPortfolioManager.transferOwnership(
    portfolioManager.address
  );
  await tx1.wait();

  console.log("Transferring InvestorPortfolioManager ownership...");
  const tx2 = await investorPortfolioManager.transferOwnership(
    portfolioManager.address
  );
  await tx2.wait();

  console.log("✅ Contract ownership transferred");

  // Update ModelPortfolioManager with IPM address
  console.log("\n🔄 Updating ModelPortfolioManager...");
  try {
    const modelPortfolioManagerAsManager =
      modelPortfolioManager.connect(portfolioManager);
    const tx3 =
      await modelPortfolioManagerAsManager.updateInvestorPortfolioManager(
        investorPortfolioManagerAddress
      );
    await tx3.wait();
    console.log("✅ ModelPortfolioManager updated");
  } catch (error) {
    console.log(
      "⚠️ Portfolio manager needs to update ModelPortfolioManager manually"
    );
    console.log("Error:", error.message);
  }

  // Transfer token ownership to IPM
  console.log("\n🔄 Transferring token ownership...");

  console.log("Transferring Cash Token ownership...");
  const tx4 = await cashToken.transferOwnership(
    investorPortfolioManagerAddress
  );
  await tx4.wait();

  console.log("Transferring Real Estate Token ownership...");
  const tx5 = await realEstateToken.transferOwnership(
    investorPortfolioManagerAddress
  );
  await tx5.wait();

  console.log("Transferring Private Equity Token ownership...");
  const tx6 = await privateEquityToken.transferOwnership(
    investorPortfolioManagerAddress
  );
  await tx6.wait();

  console.log("✅ Fund Token ownership transferred");

  // Save deployment info
  const networkName = process.env.NETWORK_NAME || "custom";
  const deploymentInfo = {
    network: networkName,
    rpcUrl: RPC_URL,
    addresses: {
      cashToken: cashTokenAddress,
      realEstateToken: realEstateTokenAddress,
      privateEquityToken: privateEquityTokenAddress,
      modelPortfolioManager: modelPortfolioManagerAddress,
      investorPortfolioManager: investorPortfolioManagerAddress,
    },
    accounts: {
      deployer: deployer.address,
      manager: portfolioManager.address,
    },
    timestamp: new Date().toISOString(),
    blockNumber: await provider.getBlockNumber(),
    gasPrice: (await provider.getFeeData()).gasPrice?.toString(),
  };

  // Save deployment info locally
  console.log("\n💾 Saving deployment info...");
  const localPath = path.join(__dirname, `../deployment-${networkName}.json`);
  fs.writeFileSync(localPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Saved locally to:", localPath);

  // Save to backend if path exists
  const backendPath = path.join(
    __dirname,
    "../../sma-backend/src/contracts/deployment.json"
  );
  try {
    const backendDir = path.dirname(backendPath);
    if (!fs.existsSync(backendDir)) {
      fs.mkdirSync(backendDir, { recursive: true });
    }
    fs.writeFileSync(backendPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to backend");
  } catch (error) {
    console.log("⚠️ Could not save to backend path:", error.message);
  }

  // Copy ABIs to backend
  console.log("\n📋 Copying ABIs to backend...");
  try {
    const abiPath = path.join(__dirname, "../../sma-backend/src/abi");
    if (!fs.existsSync(abiPath)) {
      fs.mkdirSync(abiPath, { recursive: true });
    }

    const contracts = [
      "FundToken",
      "ModelPortfolioManager",
      "InvestorPortfolioManager",
    ];
    const artifacts = [
      fundTokenArtifact,
      modelPortfolioManagerArtifact,
      investorPortfolioManagerArtifact,
    ];

    for (let i = 0; i < contracts.length; i++) {
      const contractName = contracts[i];
      const artifact = artifacts[i];

      // Save the full artifact (includes ABI, bytecode, etc.)
      const abiFilePath = path.join(abiPath, `${contractName}.json`);
      fs.writeFileSync(
        abiFilePath,
        JSON.stringify(
          {
            contractName,
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // You can add more metadata if needed
            deployedAddress:
              deploymentInfo.addresses[
                contractName.charAt(0).toLowerCase() +
                  contractName
                    .slice(1)
                    .replace(/([A-Z])/g, (m) => m.toLowerCase())
              ] ||
              deploymentInfo.addresses[
                contractName.toLowerCase().replace("token", "Token")
              ] ||
              deploymentInfo.addresses[
                Object.keys(deploymentInfo.addresses).find((key) =>
                  key
                    .toLowerCase()
                    .includes(
                      contractName
                        .toLowerCase()
                        .replace("manager", "")
                        .replace("portfolio", "")
                    )
                )
              ],
          },
          null,
          2
        )
      );

      console.log(`✅ Copied ${contractName} artifact to backend`);
    }
  } catch (error) {
    console.log("⚠️ Could not copy ABIs:", error.message);
  }

  console.log("\n✅ Deployment complete! Contract addresses:");
  console.log(JSON.stringify(deploymentInfo.addresses, null, 2));

  // Optional: Verify contracts are working
  console.log("\n🔍 Verifying deployments...");
  try {
    const cashTokenOwner = await cashToken.owner();
    const mpmOwner = await modelPortfolioManager.owner();
    const ipmOwner = await investorPortfolioManager.owner();

    console.log("Final ownership verification:");
    console.log("- Cash Token Owner:", cashTokenOwner);
    console.log("- Model Portfolio Manager Owner:", mpmOwner);
    console.log("- Investor Portfolio Manager Owner:", ipmOwner);

    // Verify ownership transfer was successful
    if (
      mpmOwner === portfolioManager.address &&
      ipmOwner === portfolioManager.address
    ) {
      console.log("✅ All ownership transfers successful");
    } else {
      console.log("⚠️ Some ownership transfers may have failed");
    }
  } catch (error) {
    console.log("⚠️ Could not verify ownership:", error.message);
  }

  return deploymentInfo;
}

// Alternative function to specify custom artifacts path
async function deployWithCustomArtifactsPath(customArtifactsPath) {
  // Temporarily override the loadContractArtifact function
  const originalLoadFunction = loadContractArtifact;

  function customLoadContractArtifact(contractName) {
    return originalLoadFunction(contractName, customArtifactsPath);
  }

  // Replace the function temporarily
  global.loadContractArtifact = customLoadContractArtifact;

  try {
    return await main();
  } finally {
    // Restore original function
    global.loadContractArtifact = originalLoadFunction;
  }
}

// Error handling and execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🚀 Starting pure ethers.js deployment...");
  console.log(
    "📝 Make sure you've compiled contracts with: npx hardhat compile\n"
  );

  main()
    .then((deploymentInfo) => {
      console.log("\n🎉 Deployment completed successfully!");
      console.log("📄 Deployment info saved to deployment files");
      console.log("🔗 Contract addresses:", deploymentInfo.addresses);
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Deployment failed:");
      console.error(error);

      // Provide helpful error messages
      if (error.message.includes("Could not find artifact")) {
        console.error(
          "\n💡 Hint: Run 'npx hardhat compile' first to generate contract artifacts"
        );
      } else if (error.message.includes("insufficient funds")) {
        console.error(
          "\n💡 Hint: Make sure your deployer account has sufficient ETH"
        );
      } else if (error.message.includes("nonce")) {
        console.error(
          "\n💡 Hint: There might be a pending transaction. Wait a moment and try again"
        );
      }

      process.exit(1);
    });
}

export { main, deployWithCustomArtifactsPath };
