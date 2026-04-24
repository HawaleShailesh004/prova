// ─────────────────────────────────────────────
//  Prova — app.js
// ─────────────────────────────────────────────

const CONTRACT_ADDRESS = "0x0884935880bc36f8efb5f8813f9568815c1c91e4";
const DEPLOY_BLOCK     = 34953743;

const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "docHash", "type": "bytes32" },
      { "internalType": "string",  "name": "docName", "type": "string"  }
    ],
    "name": "stampDocument",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "docHash", "type": "bytes32" }],
    "name": "verify",
    "outputs": [
      { "internalType": "bool",    "name": "exists",    "type": "bool"    },
      { "internalType": "address", "name": "owner",     "type": "address" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "internalType": "string",  "name": "docName",   "type": "string"  }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "docHash",   "type": "bytes32" },
      { "indexed": true,  "internalType": "address", "name": "owner",     "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "string",  "name": "docName",   "type": "string"  }
    ],
    "name": "DocumentStamped",
    "type": "event"
  }
];

// ── STATE ──
let provider      = null;
let signer        = null;
let contract      = null;
let walletAddress = null;
let currentHash   = null;

// ─────────────────────────────────────────────
//  INIT — load ethers + auto-reconnect
// ─────────────────────────────────────────────
window.addEventListener('load', async () => {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js");

  // Auto-reconnect if wallet was previously connected
  if (window.ethereum) {
    try {
      // eth_accounts doesn't prompt — just checks if already authorized
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        await initWallet(false); // silent = no toast
      }
    } catch (e) {
      // not connected, that's fine
    }

    // Listen for account/network changes
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        initWallet(true);
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
});

// ─────────────────────────────────────────────
//  WALLET
// ─────────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    toast("MetaMask not found. Please install it.", "err");
    return;
  }
  try {
    showLoading("Connecting wallet", "Approve in MetaMask");
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await initWallet(true);
    hideLoading();
  } catch (err) {
    hideLoading();
    if (err.code === 4001) toast("Connection rejected", "err");
    else toast("Failed to connect", "err");
  }
}

async function initWallet(showToastMsg) {
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    // Check we're on Polygon Amoy (chainId 80002)
    if (network.chainId !== 80002n) {
      await switchToAmoy();
      return;
    }

    signer        = await provider.getSigner();
    walletAddress = await signer.getAddress();
    contract      = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Update header button
    const short = walletAddress.slice(0,6) + '...' + walletAddress.slice(-4);
    document.getElementById('connectText').textContent = short;
    document.getElementById('connectBtn').classList.add('connected');

    // Update history wallet card
    document.getElementById('wcAddress').textContent = short;
    document.getElementById('wcAvatar').innerHTML = makeAvatar(walletAddress);

    if (showToastMsg) toast("Wallet connected", "ok");

    // Start block ticker
    startBlockTicker();

    // Load history in background
    loadOnChainHistory();

  } catch (err) {
    toast("Wallet error: " + (err?.message || "Unknown error"), "err");
  }
}

function disconnectWallet() {
  provider = signer = contract = walletAddress = null;
  document.getElementById('connectText').textContent = 'Connect Wallet';
  document.getElementById('connectBtn').classList.remove('connected');
  document.getElementById('wcAddress').textContent = 'Not connected';
}

async function switchToAmoy() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x13882' }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x13882',
          chainName: 'Polygon Amoy Testnet',
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: ['https://rpc-amoy.polygon.technology'],
          blockExplorerUrls: ['https://amoy.polygonscan.com'],
        }]
      });
    } else {
      toast("Please switch to Polygon Amoy testnet", "err");
    }
  }
}

// Generates a simple colored avatar from wallet address
function makeAvatar(address) {
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  return `<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="9" fill="hsl(${hue},30%,25%)"/><text x="9" y="13" text-anchor="middle" fill="hsl(${hue},60%,70%)" font-size="9" font-family="DM Mono,monospace">${address.slice(2,4).toUpperCase()}</text></svg>`;
}

// ─────────────────────────────────────────────
//  BLOCK TICKER
// ─────────────────────────────────────────────
let lastBlock = null;

async function startBlockTicker() {
  if (!provider) return;

  async function fetchBlock() {
    try {
      const num = await provider.getBlockNumber();
      const el = document.getElementById('blockTicker');
      if (!el) return;
      if (lastBlock !== null && num !== lastBlock) {
        el.classList.remove('tick');
        void el.offsetWidth;
        el.classList.add('tick');
      }
      el.textContent = num.toLocaleString();
      lastBlock = num;
    } catch (e) { /* silent */ }
  }

  await fetchBlock();
  setInterval(fetchBlock, 3000);
}

// ─────────────────────────────────────────────
//  COPY TX HASH
// ─────────────────────────────────────────────
let currentTxHash = null;

function copyTxHash() {
  if (!currentTxHash) return;
  navigator.clipboard.writeText(currentTxHash).then(() => {
    const lbl = document.getElementById('txCopyLabel');
    const btn = document.getElementById('txCopyBtn');
    if (lbl) { lbl.textContent = 'Copied'; btn.classList.add('copied'); }
    setTimeout(() => { if (lbl) { lbl.textContent = 'Copy'; btn.classList.remove('copied'); } }, 2000);
  });
}

// ─────────────────────────────────────────────
//  FILE HANDLING
// ─────────────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

async function processFile(file) {
  // Update step tracker
  setStep(1);

  // Show file loaded state
  document.getElementById('dropIdle').style.display = 'none';
  document.getElementById('dropLoaded').style.display = 'block';
  document.getElementById('dropZone').classList.add('drag-over');
  setTimeout(() => document.getElementById('dropZone').classList.remove('drag-over'), 300);
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileMeta').textContent = formatSize(file.size) + (file.type ? ' · ' + file.type : '');

  // Hash it
  const hash = await sha256File(file);
  currentHash = hash;

  // Reveal hash card with animated scramble
  const hashCard = document.getElementById('hashCard');
  hashCard.style.display = 'block';
  hashCard.style.animation = 'none';
  void hashCard.offsetWidth;
  hashCard.style.animation = 'fadeUp 0.35s ease both';
  await animateHash(hash);

  // Reveal stamp card
  setStep(2);
  const stampCard = document.getElementById('stampCard');
  stampCard.style.display = 'block';
  stampCard.style.animation = 'none';
  void stampCard.offsetWidth;
  stampCard.style.animation = 'fadeUp 0.35s 0.05s ease both';
}

function resetFile() {
  currentHash = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('dropIdle').style.display = 'block';
  document.getElementById('dropLoaded').style.display = 'none';
  document.getElementById('hashCard').style.display = 'none';
  document.getElementById('stampCard').style.display = 'none';
  setStep(0);
}

async function animateHash(finalHash) {
  const el = document.getElementById('hashValue');
  const chars = '0123456789abcdef';
  const len = finalHash.length;
  let current = Array(len).fill('·');

  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < len; i++) {
      if (current[i] !== finalHash[i]) {
        current[i] = chars[Math.floor(Math.random() * chars.length)];
      }
    }
    el.textContent = current.join('');
    await sleep(35);
  }
  el.textContent = finalHash;
}

// ─────────────────────────────────────────────
//  STAMP
// ─────────────────────────────────────────────
async function stampDocument() {
  if (!contract) { toast("Connect your wallet first", "err"); return; }
  if (!currentHash || currentHash.length !== 64 || !/^[0-9a-f]+$/i.test(currentHash)) {
    toast("Please upload a document first", "err");
    return;
  }

  const docNameEl = document.getElementById('docName');
  const docName = docNameEl ? docNameEl.value.trim() : '';

  try {
    showLoading("Waiting for signature", "Confirm in MetaMask");
    const hashBytes = "0x" + currentHash;
    const tx = await contract.stampDocument(hashBytes, docName);

    showLoading("Transaction submitted", "Waiting for block confirmation");
    const receipt = await tx.wait();

    hideLoading();
    showResult(receipt);
    setStep(3);

    // Refresh history after 4s
    setTimeout(() => loadOnChainHistory(), 4000);

  } catch (err) {
    hideLoading();
    if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
      toast("Transaction rejected", "err");
    } else if (err.message?.includes("Already stamped")) {
      toast("This document was already stamped", "err");
    } else {
      toast(err.shortMessage || "Transaction failed", "err");
    }
  }
}

function showResult(receipt) {
  if (!receipt?.hash) return;
  const uploadCard = document.getElementById('uploadCard');
  const hashCard = document.getElementById('hashCard');
  const stampCard = document.getElementById('stampCard');
  const card = document.getElementById('resultCard');
  if (uploadCard) uploadCard.style.display = 'none';
  if (hashCard) hashCard.style.display = 'none';
  if (stampCard) stampCard.style.display = 'none';
  if (!card) return;
  card.style.display = 'block';
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'fadeUp 0.4s ease both';

  currentTxHash = receipt.hash;
  const txHashEl = document.getElementById('txHash');
  const blockNumEl = document.getElementById('blockNum');
  const stampTimeEl = document.getElementById('stampTime');
  const explorerLink = document.getElementById('explorerLink');
  if (txHashEl) txHashEl.textContent = receipt.hash;
  if (blockNumEl) blockNumEl.textContent = '#' + (receipt.blockNumber ?? 0).toString();
  if (stampTimeEl) stampTimeEl.textContent = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  if (explorerLink) explorerLink.href = `https://amoy.polygonscan.com/tx/${receipt.hash}`;

  toast("Document stamped", "ok");
}

function resetStamp() {
  currentHash = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('docName').value = '';
  document.getElementById('dropIdle').style.display = 'block';
  document.getElementById('dropLoaded').style.display = 'none';
  document.getElementById('hashCard').style.display = 'none';
  document.getElementById('stampCard').style.display = 'none';
  document.getElementById('resultCard').style.display = 'none';
  document.getElementById('uploadCard').style.display = 'block';
  setStep(0);
}

// ─────────────────────────────────────────────
//  VERIFY
// ─────────────────────────────────────────────
function switchVerify(mode) {
  const byFile = mode === 'file';
  document.getElementById('verifyByFile').style.display = byFile ? 'block' : 'none';
  document.getElementById('verifyByHash').style.display = byFile ? 'none' : 'block';
  document.getElementById('vByFileBtn').classList.toggle('active', byFile);
  document.getElementById('vByHashBtn').classList.toggle('active', !byFile);
  document.getElementById('verifyResultCard').style.display = 'none';
}

function handleVerifyDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) verifyFile(file);
}
function handleVerifyFile(e) {
  const file = e.target.files[0];
  if (file) verifyFile(file);
}

async function verifyFile(file) {
  const hash = await sha256File(file);
  await verifyHash(hash);
}

async function verifyByHashInput() {
  const hash = document.getElementById('verifyHashInput').value.trim();
  if (hash.length !== 64) { toast("Enter a valid 64-character SHA-256 hash", "err"); return; }
  await verifyHash(hash);
}

async function verifyHash(hashHex) {
  if (!contract) { toast("Connect your wallet first", "err"); return; }

  try {
    showLoading("Querying blockchain", "Reading contract state");
    const result = await contract.verify("0x" + hashHex);
    hideLoading();

    const [exists, owner, timestamp, docName] = result;
    const card = document.getElementById('verifyResultCard');
    card.style.display = 'block';
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'fadeUp 0.35s ease both';

    if (exists) {
      const date = new Date(Number(timestamp) * 1000);
      const ownerShort = owner.slice(0,8) + '...' + owner.slice(-6);

      document.getElementById('verifyStatus').innerHTML = `
        <div class="verify-found">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M5 8l2.5 2.5 4.5-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Document verified on blockchain
        </div>`;

      document.getElementById('verifyResultTable').innerHTML = `
        <div class="record-row"><span class="rr-key">Status</span><span class="rr-val" style="color:#7ab897">Exists on-chain</span></div>
        <div class="record-row"><span class="rr-key">Label</span><span class="rr-val">${escapeHtml(docName) || '—'}</span></div>
        <div class="record-row"><span class="rr-key">Stamped on</span><span class="rr-val">${date.toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })}</span></div>
        <div class="record-row"><span class="rr-key">Owner</span><span class="rr-val mono-sm">${ownerShort}</span></div>
        <div class="record-row"><span class="rr-key">Hash</span><span class="rr-val mono-sm">${hashHex.slice(0,20)}...${hashHex.slice(-8)}</span></div>
      `;

      document.getElementById('verifyActions').innerHTML = `
        <a class="outline-btn" href="https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}" target="_blank">View contract ↗</a>`;

    } else {
      document.getElementById('verifyStatus').innerHTML = `
        <div class="verify-not-found">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Not found on blockchain
        </div>`;

      document.getElementById('verifyResultTable').innerHTML = `
        <div class="record-row"><span class="rr-key">Status</span><span class="rr-val" style="color:#c47a7a">Not stamped</span></div>
        <div class="record-row"><span class="rr-key">Hash checked</span><span class="rr-val mono-sm">${hashHex.slice(0,24)}...</span></div>
      `;
      document.getElementById('verifyActions').innerHTML = '';
    }

  } catch (err) {
    hideLoading();
    toast("Verification failed", "err");
  }
}

// ─────────────────────────────────────────────
//  ON-CHAIN HISTORY
// ─────────────────────────────────────────────
async function loadOnChainHistory() {
  if (!contract || !walletAddress) {
    document.getElementById('historyList').innerHTML = `<div class="empty-state">Connect your wallet to load records</div>`;
    return;
  }

  document.getElementById('historyList').innerHTML = `
    <div class="history-loading">
      <div class="history-spinner"></div>
      Querying blockchain events…
    </div>`;

  try {
    const filter = contract.filters.DocumentStamped(null, walletAddress);
    const readProvider = contract.runner?.provider ?? provider;
    const latestBlock = await readProvider.getBlockNumber();
    const CHUNK_SIZE = 100000; // 100k blocks per chunk
    const MIN_CHUNK_SIZE = 2000;
    let events = [];
    let failedRanges = 0;

    for (let from = DEPLOY_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
      let rangeStart = from;
      let rangeEnd = Math.min(from + CHUNK_SIZE - 1, latestBlock);
      let currentChunkSize = CHUNK_SIZE;

      while (rangeStart <= rangeEnd) {
        const to = Math.min(rangeStart + currentChunkSize - 1, rangeEnd);
        try {
          const chunk = await contract.queryFilter(filter, rangeStart, to);
          events = events.concat(chunk);
          rangeStart = to + 1;
        } catch (e) {
          if (currentChunkSize <= MIN_CHUNK_SIZE) {
            failedRanges += 1;
            console.warn(`Chunk ${rangeStart}-${to} failed, skipping`, e);
            rangeStart = to + 1;
            continue;
          }
          currentChunkSize = Math.max(Math.floor(currentChunkSize / 2), MIN_CHUNK_SIZE);
        }
      }
    }

    if (events.length === 0 && failedRanges > 0) {
      document.getElementById('historyList').innerHTML = `<div class="empty-state" style="color:#c47a7a">History query failed on ${failedRanges} ranges. Try again in a few seconds.</div>`;
      return;
    }

    if (events.length === 0) {
      document.getElementById('wcTotal').textContent = '0';
      document.getElementById('wcFirst').textContent = '—';
      document.getElementById('historyList').innerHTML = `<div class="empty-state">No stamps found for this wallet</div>`;
      return;
    }

    // Sort newest first
    const sorted = [...events].sort((a, b) => Number(b.args.timestamp) - Number(a.args.timestamp));

    // Update wallet stats
    document.getElementById('wcTotal').textContent = events.length;
    const firstDate = new Date(Number(sorted[sorted.length - 1].args.timestamp) * 1000);
    document.getElementById('wcFirst').textContent = firstDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });

    document.getElementById('historyList').innerHTML = sorted.map((ev, i) => {
      const { docHash, docName, timestamp } = ev.args;
      const hashHex = docHash.slice(2);
      const label   = docName || 'Untitled document';
      const date    = new Date(Number(timestamp) * 1000);
      const txHash  = ev.transactionHash;

      return `
        <div class="history-record" style="animation-delay:${i * 0.04}s">
          <div class="hr-icon" aria-hidden="true"></div>
          <div class="hr-body">
            <p class="hr-name">${escapeHtml(label)}</p>
            <p class="hr-hash">${hashHex.slice(0,20)}…${hashHex.slice(-6)}</p>
            <span class="hr-block">Block #${ev.blockNumber}</span>
          </div>
          <div class="hr-right">
            <p class="hr-time">${timeAgo(date)}</p>
            <a class="hr-link" href="https://amoy.polygonscan.com/tx/${txHash}" target="_blank">PolygonScan ↗</a>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    const list = document.getElementById('historyList');
    if (list) list.innerHTML = `<div class="empty-state" style="color:#c47a7a">Failed to load: ${escapeHtml(String(err?.message || "Unknown error"))}</div>`;
  }
}

// ─────────────────────────────────────────────
//  STEP TRACKER
// ─────────────────────────────────────────────
function setStep(n) {
  // n: 0=none, 1=upload done, 2=hash done, 3=stamped
  const nodes = [document.getElementById('sn1'), document.getElementById('sn2'), document.getElementById('sn3')];
  const lines = [document.getElementById('sl1'), document.getElementById('sl2')];
  nodes.forEach((nd, i) => {
    nd.classList.remove('active', 'done');
    if (i < n) nd.classList.add('done');
    else if (i === n) nd.classList.add('active');
  });
  lines.forEach((ln, i) => {
    ln.classList.toggle('done', i < n);
  });
}

// ─────────────────────────────────────────────
//  TAB SWITCHING
// ─────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────
async function sha256File(file) {
  const buf   = await file.arrayBuffer();
  const hash  = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function copyHash() {
  if (!currentHash) return;
  navigator.clipboard.writeText(currentHash).then(() => {
    const btn = document.getElementById('copyLabel');
    if (btn) { btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy', 2000); }
  });
}

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── LOADING ──
function showLoading(text, sub) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingSub').textContent = sub || '';
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// ── TOAST ──
function toast(msg, type = '') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}