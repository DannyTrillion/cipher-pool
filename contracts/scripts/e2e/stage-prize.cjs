/* Stage a claimable prize before the video: run one draw when due (no claims), then report A and B's claimable pots.
   Run: CONTRACTS=... FRONTEND=... node scripts/e2e/stage-prize.cjs */
const path = require("path");
const { JsonRpcProvider, Contract, Wallet } = require(path.join(process.env.CONTRACTS, "node_modules/ethers"));
const sdk = require(path.join(process.env.FRONTEND, "node_modules/@zama-fhe/relayer-sdk/node"));
const d = require(path.join(process.env.CONTRACTS, "deployments/sepolia.json"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const A = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider), B = new Wallet(process.env.DEMO_WALLET_2_KEY, provider);
  const C = d.contracts; const of = (name, w) => new Contract(C[name].address, C[name].abi, w);
  const gas = async (label, txp) => { const tx = await txp; const r = await tx.wait(); console.log(`${label}: gas ${r.gasUsed} ${tx.hash}`); return r; };
  const inst = await sdk.createInstance({ ...sdk.SepoliaConfig, network: process.env.SEPOLIA_RPC_URL });
  const userDecrypt = async (w, handles) => {
    const kp = inst.generateKeypair(); const start = Math.floor(Date.now() / 1000), days = 1; const c = C.ConfidentialPrizePool.address, t = C.ConfidentialUSD.address;
    const e = inst.createEIP712(kp.publicKey, [c, t], start, days);
    const sig = await w.signTypedData(e.domain, { UserDecryptRequestVerification: e.types.UserDecryptRequestVerification }, e.message);
    return inst.userDecrypt(handles, kp.privateKey, kp.publicKey, sig.replace("0x", ""), [c, t], w.address, start, days);
  };
  const pool = of("ConfidentialPrizePool", A);
  const report = async () => { for (const [n, w] of [["A", A], ["B", B]]) { const cl = await pool.claimableOf(w.address); const r = await userDecrypt(w, [{ handle: cl, contractAddress: pool.target }]); console.log(`${n} claimable now: ${r[cl]}`); } };
  console.log("before:"); await report();
  while (true) { const due = Number(await pool.nextDrawAt()), now = Math.floor(Date.now() / 1000); if (now >= due) break; console.log(`waiting ${due - now}s`); await sleep(Math.min(60, due - now) * 1000 + 2000); }
  if (Number(await pool.phase()) === 0) await gas("startDraw", pool.startDraw());
  for (let i = 0; i < 30; i++) { const ph = Number(await pool.phase()); if (ph === 0) break; await gas(`advanceDraw(5) phase ${ph}`, pool.advanceDraw(5)); }
  console.log("after draw", String(await pool.epoch()), ":"); await report();
})().catch((e) => { console.error(e); process.exit(1); });
