/* Full cycle on Sepolia against Zama's official mocks: mint → approve → wrap → deposit → sponsor → draw → claim.
   Run: CONTRACTS=... FRONTEND=... node scripts/e2e/official-cycle.cjs (needs DEPLOYER_PRIVATE_KEY, DEMO_WALLET_2_KEY, SEPOLIA_RPC_URL) */
const path = require("path");
const { JsonRpcProvider, Contract, Wallet, formatEther, parseUnits, hexlify } = require(path.join(process.env.CONTRACTS, "node_modules/ethers"));
const sdk = require(path.join(process.env.FRONTEND, "node_modules/@zama-fhe/relayer-sdk/node"));
const d = require(path.join(process.env.CONTRACTS, "deployments/sepolia.json"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const A = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider), B = new Wallet(process.env.DEMO_WALLET_2_KEY, provider);
  const C = d.contracts;
  const of = (name, w) => new Contract(C[name].address, C[name].abi, w);
  const gas = async (label, txp) => { const tx = await txp; const r = await tx.wait(); console.log(`${label}: gas ${r.gasUsed} ${tx.hash}`); return r; };
  const inst = await sdk.createInstance({ ...sdk.SepoliaConfig, network: process.env.SEPOLIA_RPC_URL });
  const enc = async (w, amt) => { const e = await inst.createEncryptedInput(C.ConfidentialPrizePool.address, w.address).add64(parseUnits(amt, 6)).encrypt(); return [hexlify(e.handles[0]), hexlify(e.inputProof)]; };
  const userDecrypt = async (w, handles) => {
    const kp = inst.generateKeypair(); const start = Math.floor(Date.now() / 1000), days = 1; const c = C.ConfidentialPrizePool.address, t = C.ConfidentialUSD.address;
    const e = inst.createEIP712(kp.publicKey, [c, t], start, days);
    const sig = await w.signTypedData(e.domain, { UserDecryptRequestVerification: e.types.UserDecryptRequestVerification }, e.message);
    return inst.userDecrypt(handles, kp.privateKey, kp.publicKey, sig.replace("0x", ""), [c, t], w.address, start, days);
  };
  console.log("pool", C.ConfidentialPrizePool.address, "cUSDT", C.ConfidentialUSD.address, "USDT", C.MockUSD.address);
  for (const [name, w, dep] of [["A", A, "300"], ["B", B, "100"]]) {
    const usdt = of("MockUSD", w), cusdt = of("ConfidentialUSD", w), pool = of("ConfidentialPrizePool", w);
    await gas(`${name} official USDT mint 1000`, usdt.mint(w.address, parseUnits("1000", 6)));
    await gas(`${name} approve wrapper`, usdt.approve(cusdt.target, parseUnits("1000", 6)));
    await gas(`${name} wrap 1000 (official cUSDTMock)`, cusdt.wrap(w.address, parseUnits("1000", 6)));
    if (!(await cusdt.isOperator(w.address, pool.target))) await gas(`${name} setOperator`, cusdt.setOperator(pool.target, 2n ** 48n - 1n));
    const [h, p] = await enc(w, dep); await gas(`${name} deposit ${dep}`, pool.deposit(h, p));
  }
  { const [h, p] = await enc(A, "25"); await gas("A sponsor 25", of("ConfidentialPrizePool", A).donatePrize(h, p)); }
  const pool = of("ConfidentialPrizePool", A);
  while (true) { const due = Number(await pool.nextDrawAt()), now = Math.floor(Date.now() / 1000); if (now >= due) break; console.log(`waiting ${due - now}s`); await sleep(Math.min(60, due - now) * 1000 + 2000); }
  await gas("startDraw", pool.startDraw());
  for (let i = 0; i < 30; i++) { const ph = Number(await pool.phase()); if (ph === 0) break; await gas(`advanceDraw(5) phase ${ph}`, pool.advanceDraw(5)); }
  const epoch = await pool.epoch(); const rec = await pool.getDraw(epoch);
  await sleep(15000);
  try { const pub = await inst.publicDecrypt([rec.prize]); console.log(`draw ${epoch} prize (public):`, String(Object.values(pub.clearValues)[0])); } catch (e) { console.log("public decrypt not ready:", e.shortMessage || e.message); }
  for (const [name, w] of [["A", A], ["B", B]]) {
    const pool2 = of("ConfidentialPrizePool", w), cusdt = of("ConfidentialUSD", w);
    const cl = await pool2.claimableOf(w.address), bal = await pool2.balanceOf(w.address);
    const r1 = await userDecrypt(w, [{ handle: cl, contractAddress: pool2.target }, { handle: bal, contractAddress: pool2.target }]);
    console.log(`${name} claimable ${r1[cl]} · savings ${r1[bal]}`);
    await gas(`${name} claimPrize`, pool2.claimPrize());
    const wb = await cusdt.confidentialBalanceOf(w.address);
    const r2 = await userDecrypt(w, [{ handle: wb, contractAddress: cusdt.target }]);
    console.log(`${name} wallet cUSDT after claim ${r2[wb]}`);
  }
  console.log("A ETH left:", formatEther(await provider.getBalance(A.address)), "B:", formatEther(await provider.getBalance(B.address)));
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message || e); process.exit(1); });
