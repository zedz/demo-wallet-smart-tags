
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Shield, Wallet, Tag, Lock, ArrowRight, ExternalLink } from "lucide-react";

/**
 * Demo Wallet with Smart Signing Tags (Vercel-friendly)
 * - Minimal deps, Tailwind for styles
 * - Works with MetaMask if present; otherwise runs in mock mode
 */

const toSelector = (data?: string) => (data && data.startsWith("0x") ? data.slice(0, 10).toLowerCase() : "");
const isZeroish = (v?: string) => !v || v === "0x" || /^0x0+$/.test(v);

const SELECTORS: Record<string, string> = {
  "0xa9059cbb": "ERC20_TRANSFER",
  "0x095ea7b3": "ERC20_APPROVE",
  "0x23b872dd": "ERC20_TRANSFER_FROM",
  "0xd505accf": "ERC20_PERMIT",
  "0x39509351": "ERC20_INCREASE_ALLOWANCE",
  "0xa457c2d7": "ERC20_DECREASE_ALLOWANCE",
  "0x38ed1739": "DEX_SWAP",
  "0xa694fc3a": "STAKE_GENERIC",
  "0xb6b55f25": "DEPOSIT_GENERIC",
};

const TYPE_TO_CATEGORY: Record<string, { tag: string; tone: "warn" | "safe" | "info" }> = {
  ERC20_TRANSFER: { tag: "PAYMENT", tone: "info" },
  ERC20_TRANSFER_FROM: { tag: "PAYMENT", tone: "info" },
  ERC20_APPROVE: { tag: "APPROVAL", tone: "warn" },
  ERC20_INCREASE_ALLOWANCE: { tag: "APPROVAL", tone: "warn" },
  ERC20_DECREASE_ALLOWANCE: { tag: "APPROVAL", tone: "warn" },
  ERC20_PERMIT: { tag: "PERMIT", tone: "warn" },
  DEX_SWAP: { tag: "SWAP", tone: "info" },
  STAKE_GENERIC: { tag: "STAKE", tone: "info" },
  DEPOSIT_GENERIC: { tag: "DEPOSIT", tone: "info" },
  UNKNOWN: { tag: "CONTRACT CALL", tone: "info" },
};

const toneToClasses = (tone: "warn" | "safe" | "info") => {
  switch (tone) {
    case "warn":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "safe":
      return "bg-green-100 text-green-800 border-green-300";
    default:
      return "bg-blue-100 text-blue-800 border-blue-300";
  }
};

interface EthRequest {
  kind: "TX" | "SIWE" | "PERSONAL_SIGN";
  to?: string;
  data?: string;
  value?: string;
  isApprovalInfinite?: boolean;
}

interface Classified {
  category: { tag: string; tone: "warn" | "safe" | "info" };
  detail?: string;
}

function classifyRequest(req: Partial<EthRequest>): Classified {
  if (req.kind === "SIWE") {
    return { category: { tag: "LOGIN", tone: "safe" }, detail: "Sign-In With Ethereum message" };
  }
  if (req.kind === "PERSONAL_SIGN") {
    return { category: { tag: "DATA", tone: "info" }, detail: "Personal message signature" };
  }
  const sel = toSelector(req.data);
  const low = SELECTORS[sel] || "UNKNOWN";
  let category = TYPE_TO_CATEGORY[low] || TYPE_TO_CATEGORY.UNKNOWN;

  if (isZeroish(req.data) && (req.value && req.value !== "0x0")) {
    category = { tag: "PAYMENT", tone: "info" };
  }
  if (req.isApprovalInfinite) {
    category = { tag: "INFINITE APPROVAL", tone: "warn" };
  }
  return { category, detail: low.replace(/_/g, " ") };
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState<null | (EthRequest & Classified)>(null);
  const [logs, setLogs] = useState<string>("");

  const hasMM = typeof (globalThis as any).ethereum !== "undefined";

  const connect = async () => {
    if (!hasMM) {
      addLog("MetaMask not detected. Running in mock mode.");
      return;
    }
    const eth = (globalThis as any).ethereum;
    const [acc] = await eth.request({ method: "eth_requestAccounts" });
    setAccount(acc);
    addLog(`Connected ${acc}`);
  };

  const addLog = (line: string) => setLogs((l) => [new Date().toLocaleTimeString(), line].join("  ") + "\n" + l);

  const requestSignature = async (req: EthRequest) => {
    const cls = classifyRequest(req);
    const enriched = Object.assign({}, req, cls) as EthRequest & Classified;
    setPending(enriched);
    setModalOpen(true);
  };

  const onConfirm = async () => {
    if (!pending) return;
    setModalOpen(false);
    try {
      if (pending.kind === "SIWE") {
        const message = sampleSiweMessage(account || "0x0000...");
        if (hasMM) {
          const sig = await (globalThis as any).ethereum.request({ method: "personal_sign", params: [message, account] });
          addLog(`SIWE signed. Sig: ${sig.slice(0, 20)}...`);
        } else {
          addLog("[mock] SIWE signed.");
        }
      } else if (pending.kind === "PERSONAL_SIGN") {
        const msg = "Demo personal sign message (no onchain effect).";
        if (hasMM) {
          const sig = await (globalThis as any).ethereum.request({ method: "personal_sign", params: [msg, account] });
          addLog(`personal_sign: ${sig.slice(0, 20)}...`);
        } else {
          addLog("[mock] personal_sign done.");
        }
      } else if (pending.kind === "TX") {
        if (hasMM) {
          const txHash = await (globalThis as any).ethereum.request({
            method: "eth_sendTransaction",
            params: [{ to: pending.to, value: pending.value || "0x0", data: pending.data || "0x" }],
          });
          addLog(`TX sent: ${txHash}`);
        } else {
          addLog("[mock] TX sent.");
        }
      }
    } catch (e: any) {
      console.error(e);
      addLog(`Error: ${e.message || e}`);
    } finally {
      setPending(null);
    }
  };

  const onReject = () => {
    addLog("User rejected.");
    setPending(null);
    setModalOpen(false);
  };

  const triggerEthPayment = () => requestSignature({ kind: "TX", to: "0x000000000000000000000000000000000000dead", value: "0x2386F26FC10000" });
  const triggerErc20Approve = () => requestSignature({ kind: "TX", to: "0xDeAdDeAdDeAdDeAdDeAdDeAdDeAdDeAdDeAd0001", data: "0x095ea7b3" + "0".repeat(64) + "f".repeat(64), isApprovalInfinite: true });
  const triggerSwap = () => requestSignature({ kind: "TX", to: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", data: "0x38ed1739" + "0".repeat(8) });
  const triggerSIWE = () => requestSignature({ kind: "SIWE" });
  const triggerPersonalSign = () => requestSignature({ kind: "PERSONAL_SIGN" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <header className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-white shadow"><Wallet className="w-6 h-6" /></div>
          <h1 className="text-2xl font-semibold">Demo Wallet · Smart Signing Tags</h1>
        </div>
        <button onClick={connect} className="px-4 py-2 rounded-xl shadow bg-black text-white hover:opacity-90">
          {account ? short(account) : "Connect MetaMask"}
        </button>
      </header>

      <main className="max-w-4xl mx-auto mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <Card title="Try common actions">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DemoBtn label="Pay 0.01 ETH" onClick={triggerEthPayment} icon={<ArrowRight className="w-4 h-4" />} />
              <DemoBtn label="Approve (∞)" onClick={triggerErc20Approve} icon={<Lock className="w-4 h-4" />} />
              <DemoBtn label="Swap (DEX)" onClick={triggerSwap} icon={<ArrowRight className="w-4 h-4" />} />
              <DemoBtn label="Login (SIWE)" onClick={triggerSIWE} icon={<Shield className="w-4 h-4" />} />
              <DemoBtn label="Data Sign" onClick={triggerPersonalSign} icon={<Tag className="w-4 h-4" />} />
            </div>
          </Card>

          <Card title="What this demo shows">
            <ul className="list-disc pl-5 space-y-2 text-slate-700">
              <li>Classify signing requests into <b>clear categories</b>: PAYMENT, APPROVAL, LOGIN, SWAP, STAKE, DATA.</li>
              <li>Warn on riskier patterns like <b>infinite approval</b>.</li>
              <li>Friendly confirmation modal before forwarding to the provider.</li>
              <li>Pattern works for extension, mobile wallet, or dapp-side guard.</li>
            </ul>
          </Card>
        </section>

        <section>
          <Card title="Event log">
            <pre className="text-xs whitespace-pre-wrap leading-5 text-slate-700 min-h-[200px]">{logs}</pre>
          </Card>

          <Card title="How to adapt">
            <ol className="list-decimal pl-5 space-y-2 text-slate-700">
              <li>Expand <code>SELECTORS</code> and <code>TYPE_TO_CATEGORY</code> for your contracts.</li>
              <li>Use an ABI decoder (viem/ethers) in production.</li>
              <li>Call <code>requestSignature</code> before provider requests.</li>
            </ol>
          </Card>
        </section>
      </main>

      {modalOpen && pending && (
        <ConfirmModal pending={pending} onConfirm={onConfirm} onReject={onReject} />
      )}

      <footer className="max-w-4xl mx-auto mt-10 text-sm text-slate-500 flex items-center gap-2">
        <ExternalLink className="w-4 h-4" />
        <span>Demo only · Use on testnets. No warranty.</span>
      </footer>
    </div>
  );
}

function ConfirmModal({ pending, onConfirm, onReject }: { pending: EthRequest & Classified; onConfirm: () => void; onReject: () => void; }) {
  const toneCls = toneToClasses(pending.category.tone);
  const isTx = pending.kind === "TX";
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center p-4 z-50">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className={`px-4 py-3 border-b ${toneCls} flex items-center gap-2`}>
          {pending.category.tone === "warn" ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          <span className="font-semibold tracking-wide">{pending.category.tag}</span>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-slate-700">
            <div className="text-sm uppercase tracking-wide text-slate-500">Action</div>
            <div className="text-lg font-medium">{labelAction(pending)}</div>
          </div>
          {isTx && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="To" value={pending.to || "(contract)"} />
              <Info label="Value (wei)" value={pending.value || "0x0"} />
              <div className="col-span-2"><Info label="Calldata" value={(pending.data || "0x").slice(0, 66) + ((pending.data && pending.data.length > 66) ? "…" : "")} /></div>
            </div>
          )}
          {pending.detail && <p className="text-xs text-slate-500">Detected: {pending.detail}</p>}
        </div>
        <div className="p-4 flex items-center justify-end gap-3 bg-slate-50 border-t">
          <button onClick={onReject} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white"><X className="w-4 h-4 inline mr-2" />Reject</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"><Check className="w-4 h-4 inline mr-2" />Confirm</button>
        </div>
      </motion.div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono text-[12px] break-all">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 border">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-4 h-4 text-slate-400" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DemoBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 rounded-2xl border bg-white hover:bg-slate-50 shadow-sm flex items-center justify-between">
      <span className="font-medium">{label}</span>
      {icon}
    </button>
  );
}

function short(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }

function labelAction(req: EthRequest & Classified) {
  switch (req.category.tag) {
    case "PAYMENT": return "Send tokens / native asset";
    case "APPROVAL": return "Grant spending permission";
    case "INFINITE APPROVAL": return "Grant unlimited token spending";
    case "SWAP": return "Swap on a DEX";
    case "STAKE": return "Stake tokens";
    case "DEPOSIT": return "Deposit into protocol";
    case "LOGIN": return "Sign in with Ethereum";
    case "DATA": return "Sign a data message";
    default: return "Contract interaction";
  }
}

function sampleSiweMessage(addr: string) {
  return `demo.example.xyz wants you to sign in with your Ethereum account:\n${addr}\n\nURI: https://demo.example.xyz\nVersion: 1\nChain ID: 1\nNonce: 0xDEMO\nIssued At: ${new Date().toISOString()}`;
}
