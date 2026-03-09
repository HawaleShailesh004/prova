# Prova - On-Chain Document Timestamping

> Prove your document existed. On-chain. Without a notary.

Prova is a decentralized document notarization tool built on the Polygon blockchain. Upload any file, compute its SHA-256 hash locally in the browser, and record that fingerprint permanently on-chain. The file never leaves your device. The proof lives forever.

---

## What It Does

Traditional notarization costs ₹500–₹2000, requires physical presence, and produces a paper record that can be lost. Prova replaces this with a cryptographic timestamp on a public blockchain  - costing ~$0.001, available instantly, and verifiable by anyone forever.

**Core flow:**

1. Drop any file → SHA-256 hash computed locally in browser
2. Hash + label sent to a Solidity smart contract on Polygon
3. Contract records `hash → owner wallet + timestamp` permanently
4. Anyone can verify by re-hashing the original file and querying the contract

---

## Tech Stack

| Layer          | Technology                            |
| -------------- | ------------------------------------- |
| Smart Contract | Solidity 0.8.28                       |
| Blockchain     | Polygon Amoy Testnet                  |
| Dev Framework  | Hardhat v3                            |
| Web3 Library   | Ethers.js v6                          |
| Frontend       | Plain HTML + CSS + Vanilla JS         |
| Hashing        | Browser-native `crypto.subtle.digest` |
| Wallet         | MetaMask                              |
| Hosting        | Vercel                                |

---

## Project Structure

```
prova/
├── contracts/
│   └── DocumentTimestamp.sol     # Core smart contract
├── scripts/
│   └── deploy.ts                 # Deployment script
├── frontend/
│   ├── index.html                # App UI
│   ├── style.css                 # Styling
│   └── app.js                   # Web3 logic + hashing
├── hardhat.config.ts             # Hardhat + network config
├── .env                          # RPC_URL + PRIVATE_KEY (never commit)
├── .gitignore
└── package.json
```

---

## Smart Contract

**Deployed on Polygon Amoy:**
`0x0884935880bc36f8efb5f8813f9568815c1c91e4`

[View on PolygonScan ↗](https://amoy.polygonscan.com/address/0x0884935880bc36f8efb5f8813f9568815c1c91e4)

```solidity
// Store a document hash on-chain
function stampDocument(bytes32 docHash, string memory docName) external

// Verify if a hash exists and return its record
function verify(bytes32 docHash) external view returns (
    bool exists,
    address owner,
    uint256 timestamp,
    string memory docName
)
```

**Design decisions:**

- `require(timestamp == 0)`  - prevents overwriting an existing stamp. First stamp wins, forever.
- `msg.sender` stored as owner  - wallet address is identity, no accounts system needed
- `block.timestamp` set by network  - tamper-proof, not user-controlled
- Events indexed by `docHash` and `owner`  - enables efficient on-chain history queries per wallet

---

## How the Hashing Works

```javascript
// Runs entirely in the browser  - file never sent anywhere
const buffer = await file.arrayBuffer();
const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
const hash = Array.from(new Uint8Array(hashBuffer))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
// Returns 64-character hex string
```

SHA-256 produces a unique 256-bit fingerprint for any file. Collision probability is 2⁻¹²⁸  - computationally impossible to find two files with the same hash. This is why the hash alone is sufficient proof.

---

## On-Chain History

History is not stored in any database. It is queried live from blockchain events:

```javascript
// Filter DocumentStamped events by wallet owner
const filter = contract.filters.DocumentStamped(null, walletAddress);
const events = await contract.queryFilter(filter, DEPLOY_BLOCK, "latest");
```

This returns every document ever stamped by a wallet  - from any device, any session, across all time. The blockchain is the database.

---

## Local Setup

**Prerequisites:** Node.js 18+, MetaMask browser extension

```bash
# Clone and install
git clone https://github.com/yourusername/prova
cd prova
npm install

# Set up environment
cp .env.example .env
# Fill in RPC_URL and PRIVATE_KEY in .env

# Compile contract
npx hardhat compile

# Deploy to Amoy testnet
npx hardhat run scripts/deploy.ts --network amoy

# Open frontend
cd frontend
# Just open index.html in browser  - no build step needed
```

**Get test MATIC:** [faucet.polygon.technology](https://faucet.polygon.technology) → select Amoy → paste wallet address

---

## Deploying the Frontend

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from frontend folder
cd frontend
vercel

# Future updates
vercel --prod
```

---

## Deploying to Polygon Mainnet

1. Buy ~$2 worth of MATIC (CoinDCX, Binance)
2. Get a free RPC key from [Alchemy](https://alchemy.com) → Polygon Mainnet
3. Update `.env` with mainnet RPC URL
4. Add `polygon` network to `hardhat.config.ts`
5. Run `npx hardhat run scripts/deploy.ts --network polygon`
6. Update `CONTRACT_ADDRESS` and `DEPLOY_BLOCK` in `frontend/app.js`
7. Update PolygonScan links  - remove `amoy.` prefix

---

## Environment Variables

```env
RPC_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=0xyour_private_key_here
```

⚠️ Never commit `.env`. Never share your private key. The `.gitignore` already excludes it.

---

## Security Notes

- **File privacy**  - SHA-256 hashing runs in-browser via `crypto.subtle`. The file bytes never leave the user's device.
- **No overwrite**  - Once a hash is stamped, it cannot be overwritten. The contract enforces this at the EVM level.
- **Trustless**  - No backend, no database, no admin keys. The contract has no owner or upgrade mechanism.
- **Private key**  - Only used during contract deployment via Hardhat. Never used in or exposed by the frontend.

---

## Why Polygon

|                     | Ethereum | Polygon |
| ------------------- | -------- | ------- |
| Gas per stamp       | ~$5–50   | ~$0.001 |
| Confirmation time   | ~12s     | ~2s     |
| Solidity compatible | ✅       | ✅      |
| Same Ethers.js API  | ✅       | ✅      |

Same code, 1000x cheaper. For a notarization tool targeting freelancers, cost per action matters.

---

## Use Cases

- **Freelancers**  - Timestamp proposals and contracts before sending to clients
- **Designers**  - Prove creative work existed before sharing for feedback
- **Students**  - Timestamp research drafts before submission
- **Startups**  - Document IP before filing provisional patents
- **Lawyers**  - Supplement physical notarization with a tamper-proof digital record

---

## License

MIT

---

Built with Hardhat · Ethers.js · Polygon · plain HTML
