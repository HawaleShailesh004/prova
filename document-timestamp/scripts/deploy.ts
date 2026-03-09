import { artifacts } from "hardhat";
import { createWalletClient, createPublicClient, http } from "viem";
import { polygonAmoy } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;
  if (!privateKey) throw new Error("PRIVATE_KEY is not set in .env");
  if (!rpcUrl) throw new Error("RPC_URL is not set in .env");

  const artifact = await artifacts.readArtifact("DocumentTimestamp");

  const keyHex = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(keyHex);

  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt?.contractAddress) throw new Error("Deploy failed: no contract address in receipt");

  console.log("Contract:", receipt.contractAddress);
  console.log("Explorer: https://amoy.polygonscan.com/address/" + receipt.contractAddress);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});