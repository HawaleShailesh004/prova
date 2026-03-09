import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL ?? "";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

export default defineConfig({
  solidity: {
    version: "0.8.28",
  },
  networks: {
    ...(RPC_URL && PRIVATE_KEY ? {
      amoy: {
        type: "http",
        url: RPC_URL,
        accounts: [PRIVATE_KEY],
      }
    } : {}),
  },
});