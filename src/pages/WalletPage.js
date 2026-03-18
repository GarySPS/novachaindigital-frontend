//src>pages>WalletPage.js
import { MAIN_API_BASE, ADMIN_API_BASE } from '../config';
import { jwtDecode } from "jwt-decode";
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import axios from "axios";
import Card from "../components/card";
import Field from "../components/field";
import Modal from "../components/modal";
import Icon from "../components/icon";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createClient } from '@supabase/supabase-js';

const STAKING_PLANS = [
  { days: 7, rate: 1.3 },   // 1.3% Daily
  { days: 14, rate: 1.6 },  // 1.6% Daily
  { days: 30, rate: 2.1 },  // 2.1% Daily
  { days: 90, rate: 2.6 },  // 2.6% Daily
];

const SUPABASE_URL = "https://zgnefojwdijycgcqngke.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbmVmb2p3ZGlqeWNnY3FuZ2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNTc3MjcsImV4cCI6MjA2NTczMzcyN30.RWPMuioeBKt_enKio-Z-XIr6-bryh3AEGSxmyc7UW7k";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------------- helpers (UI only) ---------------- */
const coinSymbols = ["USDT", "BTC", "ETH", "SOL", "XRP", "TON"];
const depositNetworks = { USDT: "TRC20", BTC: "BTC", ETH: "ERC20", SOL: "SOL", XRP: "XRP", TON: "TON" };
const fmtUSD = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------------- uploads ---------------- */
async function uploadDepositScreenshot(file, userId) {
  if (!file) return null;
  const filePath = `${userId}-${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('deposit').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return filePath;
}
async function getSignedUrl(path, bucket) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const filename = path.split('/').pop();
  const res = await axios.get(`${MAIN_API_BASE}/upload/${bucket}/signed-url/${filename}`);
  return res.data.url;
}

export default function WalletPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const token = localStorage.getItem("token");

  const [userId, setUserId] = useState(null);
  const [prices, setPrices] = useState({});
  // preload last known prices so page never starts at $0
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nc_prices");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setPrices(parsed);
      }
    } catch {}
  }, []);

  const [balances, setBalances] = useState([]);
  const [depositHistory, setDepositHistory] = useState([]);
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [modal, setModal] = useState({ open: false, type: "", coin: "" });
  const [toast, setToast] = useState("");
  const [selectedDepositCoin, setSelectedDepositCoin] = useState("USDT");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositScreenshot, setDepositScreenshot] = useState(null);
  const fileInputRef = useRef();
  const [selectedWithdrawCoin, setSelectedWithdrawCoin] = useState("USDT");
  const [withdrawForm, setWithdrawForm] = useState({ address: "", amount: "" });
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [fromCoin, setFromCoin] = useState("USDT");
  const [toCoin, setToCoin] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [walletAddresses, setWalletAddresses] = useState({});
  const [walletQRCodes, setWalletQRCodes] = useState({});
  const [fileLocked, setFileLocked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [historyScreenshots, setHistoryScreenshots] = useState({});
  const [totalUsd, setTotalUsd] = useState(0);
  
  // lock + inline toasts
  const [depositBusy, setDepositBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [depositToast, setDepositToast] = useState("");
  const [withdrawToast, setWithdrawToast] = useState("");

  // ===== NEW: DeFi Staking State & Logic =====
  const [stakedAssets, setStakedAssets] = useState([]); // Assets currently locked
  const [totalStakedUsd, setTotalStakedUsd] = useState(0);

  // Modal State
  const [stakeModal, setStakeModal] = useState({ open: false, coin: "USDT", amount: "" });
  const [selectedPlan, setSelectedPlan] = useState(null); // { days: 7, rate: 1.3 }
  const [stakeBusy, setStakeBusy] = useState(false);
  const [stakeToast, setStakeToast] = useState(null);

  // 1. Calculate Total Staked Value in USD
  useEffect(() => {
    if (!stakedAssets.length || !Object.keys(prices).length) {
      setTotalStakedUsd(0);
      return;
    }
    let sum = 0;
    stakedAssets.forEach(({ coin, amount }) => {
      const coinPrice = prices[coin] || (coin === "USDT" ? 1 : 0);
      sum += Number(amount) * coinPrice;
    });
    setTotalStakedUsd(sum);
  }, [stakedAssets, prices]);

  // 2. Fetch Staked Assets
  function fetchStakedAssets() {
    if (!token || !userId) return;
    axios.get(`${MAIN_API_BASE}/earn/stakes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStakedAssets(res.data || []))
      .catch(() => setStakedAssets([]));
  }

  // 3. Add fetchStakedAssets to the main load sequence
  useEffect(() => {
    if (token && userId) {
      fetchStakedAssets();
    }
  }, [token, userId]);

  /* ---------------- history merge (unchanged logic) ---------------- */
  const userDepositHistory = depositHistory.filter(d => userId && Number(d.user_id) === Number(userId));
  const userWithdrawHistory = withdrawHistory.filter(w => userId && Number(w.user_id) === Number(userId));
  const allHistory = [
    ...userDepositHistory.map(d => ({ ...d, type: "Deposit" })),
    ...userWithdrawHistory.map(w => ({ ...w, type: "Withdraw" })),
  ].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

  useEffect(() => {
    if (!balances.length) { setTotalUsd(0); return; }
    if (!Object.keys(prices).length) { return; }
    let sum = 0;
    balances.forEach(({ symbol, balance }) => {
      const coinPrice = prices[symbol] || (symbol === "USDT" ? 1 : 0);
      sum += Number(balance) * coinPrice;
    });
    setTotalUsd(sum);
  }, [balances, prices]);

  useEffect(() => {
    async function fetchHistoryScreenshots() {
      let shots = {};
      for (let row of allHistory) {
        if (row.screenshot) {
          if (!row.screenshot.includes("/")) {
            shots[row.id] = `https://zgnefojwdijycgcqngke.supabase.co/storage/v1/object/public/deposit/${encodeURIComponent(row.screenshot)}`;
          } else if (row.screenshot.startsWith("/uploads/")) {
            shots[row.id] = `${MAIN_API_BASE}${row.screenshot}`;
          } else if (row.screenshot.startsWith("http")) {
            shots[row.id] = row.screenshot;
          }
        }
      }
      setHistoryScreenshots(shots);
    }
    fetchHistoryScreenshots();
  }, [JSON.stringify(allHistory)]);

  /* ---------------- auth / redirects (unchanged) ---------------- */
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.id);
      } catch {
        setUserId(null);
      }
    } else {
      setUserId(null);
    }
    setAuthChecked(true);
  }, [token]);

  useEffect(() => {
    if (!authChecked) return;
    if (!token || token === "undefined" || !userId || userId === "undefined") {
      setIsGuest(true);
    }
  }, [authChecked, token, userId]);

  useEffect(() => {
    if (!authChecked) return;
    if (isGuest) {
      navigate("/login", { replace: true });
    }
  }, [authChecked, isGuest, navigate]);

  /* ---------------- live prices (unchanged) ---------------- */
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await axios.get(`${MAIN_API_BASE}/prices`);
        if (stopped) return;
        let map = res.data?.prices;
        if (!map || !Object.keys(map).length) {
          map = {};
          (res.data?.data || []).forEach(c => {
            if (c?.symbol) map[c.symbol] = c?.quote?.USD?.price;
          });
        }
        if (map && Object.keys(map).length) {
          setPrices(prev => {
            const next = { ...prev, ...map };
            try { localStorage.setItem("nc_prices", JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { stopped = true; clearInterval(id); };
  }, [MAIN_API_BASE]);

  useEffect(() => {
    let canceled = false;
    const refreshPair = async () => {
      try {
        const [a, b] = await Promise.all([
          axios.get(`${MAIN_API_BASE}/prices/${fromCoin}`),
          axios.get(`${MAIN_API_BASE}/prices/${toCoin}`)
        ]);
        if (canceled) return;
        const pa = Number(a.data?.price);
        const pb = Number(b.data?.price);
        setPrices(prev => {
          const next = { ...prev };
          if (Number.isFinite(pa) && pa > 0) next[fromCoin] = pa;
          if (Number.isFinite(pb) && pb > 0) next[toCoin] = pb;
          try { localStorage.setItem("nc_prices", JSON.stringify(next)); } catch {}
          return next;
        });
      } catch {}
    };
    refreshPair();
    const id = setInterval(refreshPair, 10_000);
    return () => { canceled = true; clearInterval(id); };
  }, [fromCoin, toCoin, MAIN_API_BASE]);

  /* ---------------- wallet & histories (unchanged) ---------------- */
  useEffect(() => {
    axios.get(`${MAIN_API_BASE}/deposit-addresses`)
      .then(res => {
        const addresses = {};
        const qrcodes = {};
        res.data.forEach(row => {
          addresses[row.coin] = row.address;
          if (row.qr_url && row.qr_url.startsWith("/uploads")) {
            qrcodes[row.coin] = `${ADMIN_API_BASE}${row.qr_url}`;
          } else if (row.qr_url) {
            qrcodes[row.coin] = row.qr_url;
          } else {
            qrcodes[row.coin] = null;
          }
        });
        setWalletAddresses(addresses);
        setWalletQRCodes(qrcodes);
      })
      .catch(() => {
        setWalletAddresses({});
        setWalletQRCodes({});
      });
  }, []);

  // ===== DATA FETCHING =====
  useEffect(() => {
    if (!token || !userId) return;
    fetchBalances();
    axios.get(`${MAIN_API_BASE}/deposits`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setDepositHistory(res.data)).catch(() => setDepositHistory([]));
    axios.get(`${MAIN_API_BASE}/withdrawals`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setWithdrawHistory(res.data)).catch(() => setWithdrawHistory([]));
  }, [token, userId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    const coin = params.get("coin");
    if (action === "deposit" && coin) { setSelectedDepositCoin(coin); openModal("deposit", coin); }
    if (action === "withdraw" && coin) openModal("withdraw", coin);
    if (action === "convert") {
      const el = document.getElementById("convert-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [location]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(""), 1200); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    if (!amount || isNaN(amount)) { setResult(""); return; }
    if (fromCoin === toCoin) { setResult(""); return; }
    
    // SAFE CHECK: Default USDT to 1 if it hasn't loaded in state yet
    const pFrom = prices[fromCoin] || (fromCoin === "USDT" ? 1 : 0);
    const pTo = prices[toCoin] || (toCoin === "USDT" ? 1 : 0);

    if (!pFrom || !pTo) { setResult(""); return; }

    const usdValue = parseFloat(amount) * pFrom;
    const receive = usdValue / pTo;
    setResult(receive.toFixed(toCoin === "BTC" ? 6 : toCoin === "ETH" ? 4 : 3));
  }, [fromCoin, toCoin, amount, prices]);

  function fetchBalances() {
    if (!token || !userId) return;
    // This endpoint should return the *main* wallet (e.g., "spot" wallet)
    axios.get(`${MAIN_API_BASE}/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBalances(res.data.assets || []))
      .catch(() => setBalances([]));
  }

  const openModal = (type, coin) => setModal({ open: true, type, coin });
  const closeModal = () => setModal({ open: false, type: "", coin: "" });

  // 4. Modal Handlers
  const openStakeModal = () => setStakeModal({ open: true, coin: "USDT", amount: "" });
  const closeStakeModal = () => {
    setStakeModal({ open: false, coin: "USDT", amount: "" });
    setSelectedPlan(null);
    setStakeToast(null);
  };

  // 5. Submit Staking Request
  const handleStakeSubmit = async (e) => {
    e.preventDefault();
    if (stakeBusy) return;
    
    if (!selectedPlan) {
      setStakeToast({ type: "error", message: t("please_select_plan") || "Please select a plan" });
      return;
    }

    setStakeBusy(true);
    setStakeToast(null);

    // Prepare payload
    const payload = { 
      coin: stakeModal.coin, 
      amount: parseFloat(stakeModal.amount),
      duration_days: selectedPlan.days, // e.g. 7
      daily_rate: selectedPlan.rate     // e.g. 1.3
    };
    
    let wasSuccess = false;

    try {
      const res = await axios.post(`${MAIN_API_BASE}/earn/stake`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data && res.data.success) {
        wasSuccess = true;
        setStakeToast({
          type: "success",
          message: t("stake_success") || "Staking Successful!"
        });
        fetchBalances();      // Update main wallet (balance goes down)
        fetchStakedAssets();  // Update stake list (stake appears)
      } else {
        setStakeToast({
          type: "error",
          message: res.data.error || t("operation_failed")
        });
      }
    } catch (err) {
      setStakeToast({
        type: "error",
        message: err.response?.data?.error || t("operation_failed")
      });
    } finally {
      setStakeBusy(false);
      if (wasSuccess) {
        setTimeout(() => closeStakeModal(), 1500);
      }
    }
  };

  const handleRedeem = async (stakeId) => {
    if(stakeBusy) return;
    setStakeBusy(true);
    try {
      const res = await axios.post(`${MAIN_API_BASE}/earn/redeem`, { stakeId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(res.data.success) {
        setStakeToast({ type: "success", message: res.data.message });
        fetchBalances();     // Update main balance
        fetchStakedAssets(); // Remove from list (or update status)
      } else {
        setStakeToast({ type: "error", message: res.data.error });
      }
    } catch(err) {
      setStakeToast({ type: "error", message: err.response?.data?.error || "Failed" });
    } finally {
      setStakeBusy(false);
    }
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (depositBusy) return;
    setDepositBusy(true);
    try {
      let screenshotUrl = null;
      if (depositScreenshot) {
        screenshotUrl = await uploadDepositScreenshot(depositScreenshot, userId);
      }
      await axios.post(`${MAIN_API_BASE}/deposit`, {
        coin: selectedDepositCoin,
        amount: depositAmount,
        address: walletAddresses[selectedDepositCoin],
        screenshot: screenshotUrl,
      }, { headers: { Authorization: `Bearer ${token}` } });

      setDepositToast(t("Deposit Submitted") || "Deposit Submitted");
      setDepositAmount("");
      setDepositScreenshot(null);
      setFileLocked(false);

      // refresh list
      axios.get(`${MAIN_API_BASE}/deposits`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setDepositHistory(res.data));

      // close after short delay
      setTimeout(() => { setDepositToast(""); closeModal(); }, 1400);
    } catch (err) {
      setDepositToast(t("deposit_failed"));
      console.error(err);
      setTimeout(() => setDepositToast(""), 1400);
    } finally {
      setDepositBusy(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (withdrawBusy) return;
    setWithdrawBusy(true);
    try {
      const res = await axios.post(`${MAIN_API_BASE}/withdraw`, {
        user_id: userId,
        coin: selectedWithdrawCoin,
        amount: withdrawForm.amount,
        address: withdrawForm.address,
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data && res.data.success) {
        setWithdrawToast(t("Withdraw Submitted") || "Withdraw Submitted");
        axios.get(`${MAIN_API_BASE}/withdrawals`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => setWithdrawHistory(r.data));
        fetchBalances();
      } else {
        setWithdrawToast(t("withdraw_failed"));
      }
    } catch (err) {
      setWithdrawToast(err.response?.data?.error || t("withdraw_failed"));
      console.error(err);
    } finally {
      setTimeout(() => { setWithdrawForm({ address: "", amount: "" }); setWithdrawToast(""); closeModal(); }, 1400);
      setWithdrawBusy(false);
    }
  };

  const swap = () => { setFromCoin(toCoin); setToCoin(fromCoin); setAmount(""); setResult(""); };

  const handleConvert = async e => {
    e.preventDefault();
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0 || fromCoin === toCoin) return;
    try {
      const res = await axios.post(`${MAIN_API_BASE}/convert`, {
        from_coin: fromCoin, to_coin: toCoin, amount: parseFloat(amount)
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data && res.data.success) {
        setSuccessMsg(t("Convert Successful", {
          amount: amount, fromCoin,
          received: Number(res.data.received).toLocaleString(undefined, { maximumFractionDigits: 6 }),
          toCoin,
        }));
        fetchBalances();
      } else {
        setSuccessMsg(t("Convert Failed"));
      }
    } catch (err) {
      setSuccessMsg(err.response?.data?.error || t("convert_failed"));
    }
    setTimeout(() => setSuccessMsg(""), 1800);
    setAmount(""); setResult("");
  };

  // --- MAIN RENDER ---
  if (!authChecked) return null;
  if (isGuest) return null;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-3 pt-6 pb-14"
      style={{
        background: 'url("/novachain.jpg") no-repeat center center fixed',
        backgroundSize: "cover",
      }}
    >
      {/* overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: "linear-gradient(120deg, #0b1020f0 0%, #0d1220d8 60%, #0a101dd1 100%)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }} className="w-full max-w-7xl">
        {/* ===== Top row: balance + assets ===== */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(320px,380px),1fr] gap-6 md:gap-8 items-stretch">

          <Card className="rounded-3xl shadow-xl border border-slate-100 p-0 overflow-hidden h-full">
            <div className="w-full h-full min-h-[180px] md:min-h-[220px] flex items-center justify-center
                      px-4 sm:px-6 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
              <div className="flex flex-col items-center gap-1 w-full">
                <div className="text-center text-slate-500 text-xs sm:text-sm font-semibold">
                  {t("total_balance")}
                </div>

                {/* key: clamp + break-all + leading + full width */}
                <div
                  className="
                    w-full max-w-full px-1 text-center font-extrabold text-slate-900 tabular-nums
                    leading-[1.1] tracking-tight break-all
                    text-[clamp(1.5rem,5.2vw,2.75rem)]
                  "
                >
                  {fmtUSD(totalUsd)}
                </div>
              </div>
            </div>
          </Card>

          {/* Assets table */}
          <Card className="rounded-3xl shadow-xl border border-slate-100 p-0 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <div className="text-slate-700 font-semibold">{t("my_assets")}</div>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm md:text-base">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-left text-slate-600 border-y border-slate-100">
                    <th className="py-3 pl-4 pr-2 whitespace-nowrap">{t("type")}</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">{t("amount")}</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">{t("frozen", "Frozen")}</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">{t("usd_value", "USD Value")}</th>
                    <th className="py-3 pl-2 pr-4 text-right whitespace-nowrap">{t("Transfer")}</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {balances.map(({ symbol, icon, balance, frozen }) => (
                    <tr
                      key={symbol}
                      className="group border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                      style={{ height: 64 }}
                    >
                      {/* Type */}
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2">
                          <Icon name={symbol?.toLowerCase() || "coin"} className="w-6 h-6" />
                          <span className="font-semibold text-slate-900">{symbol}</span>
                        </div>
                      </td>
                      {/* Amount */}
                      <td className="py-3 px-2 text-right tabular-nums font-medium text-slate-800">
                        {Number(balance).toLocaleString(undefined, {
                          minimumFractionDigits: symbol === "BTC" ? 6 : 2,
                          maximumFractionDigits: symbol === "BTC" ? 8 : 6,
                        })}
                      </td>
                      {/* Frozen */}
                      <td className="py-3 px-2 text-right tabular-nums font-medium text-amber-600">
                        {Number(frozen || 0).toLocaleString(undefined, {
                          minimumFractionDigits: symbol === "BTC" ? 6 : 2,
                          maximumFractionDigits: symbol === "BTC" ? 8 : 6,
                        })}
                      </td>
                      {/* USD Value */}
                      <td className="py-3 px-2 text-right tabular-nums font-semibold text-slate-900">
                        {(() => {
                          const p = prices[symbol] ?? (symbol === "USDT" ? 1 : undefined);
                          return p !== undefined ? fmtUSD(Number(balance) * p) : "--";
                        })()}
                      </td>
                      {/* Transfer */}
                      <td className="py-3 pl-2 pr-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:scale-[1.02] transition whitespace-nowrap"
                            onClick={() => { setSelectedDepositCoin(symbol); openModal("deposit", symbol); }}
                          >
                            <span className="inline-flex items-center gap-1"><Icon name="download" />{t("deposit")}</span>
                          </button>
                          <button
                            className="h-10 px-4 rounded-xl bg-white ring-1 ring-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
                            onClick={() => openModal("withdraw", symbol)}
                          >
                            <span className="inline-flex items-center gap-1"><Icon name="upload" />{t("withdraw")}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ===== NEW: DeFi Staking Section ===== */}
        <Card id="earn-section" className="mt-8 rounded-3xl shadow-xl border border-slate-100 p-0 overflow-hidden">
          {/* Header with Darker/DeFi Vibe */}
          <div className="bg-slate-900 px-6 py-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Icon name="activity" className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-xl md:text-2xl font-extrabold mb-1">
                <div className="bg-indigo-500 p-2 rounded-lg">
                  <Icon name="layers" className="w-6 h-6 text-white" />
                </div>
                <span>Novachain AI DeFi Staking</span>
              </div>
              <p className="text-slate-400 text-sm font-medium ml-1">
                {t("easy_access_defi", "Easy Access to DeFi Opportunities")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Left: Total Staked Info */}
            <div className="p-6 md:p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{t("total_value_locked", "Total Value Locked")}</div>
              <div className="text-4xl font-extrabold text-slate-900 tabular-nums mb-6">
                {fmtUSD(totalStakedUsd)}
              </div>
              <button
                onClick={openStakeModal}
                className="w-full md:max-w-xs h-14 rounded-2xl bg-indigo-600 text-white text-lg font-bold shadow-lg shadow-indigo-200 hover:scale-[1.02] hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <span>{t("start_staking", "Start Staking")}</span>
                <Icon name="arrow-right" className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Active Stakes List (Mini View) */}
            <div className="p-0 bg-slate-50/50">
              <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-700">
                {t("your_active_stakes", "Your Active Stakes")}
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                {stakedAssets.length > 0 ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {stakedAssets.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-white transition">
                          <td className="py-3 px-6 font-bold text-slate-700">{row.coin}</td>
                          <td className="py-3 px-2 text-right">
                            <div className="font-medium text-slate-900">{Number(row.amount).toFixed(4)}</div>
                            <div className="text-xs text-indigo-600 font-bold">
                              +{row.daily_rate}% / day
                            </div>
                          </td>
                          <td className="py-3 px-6 text-right text-xs">
                            {row.can_redeem ? (
                              <button
                                onClick={() => handleRedeem(row.id)}
                                className="bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-emerald-600 transition"
                              >
                                Redeem
                              </button>
                            ) : (
                              <span className="text-slate-500">{row.days_left} days left</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {t("no_active_stakes", "No active stakes running.")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
        {/* =================================== */}


        {/* ===== Convert section ===== */}
        <Card id="convert-section" className="mt-8 rounded-3xl shadow-xl border border-slate-100 p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-fuchsia-50 via-sky-50 to-emerald-50 px-5 py-5 md:px-6 md:py-6">
            <div className="flex items-center gap-2 text-slate-800 text-xl md:text-2xl font-extrabold">
              <Icon name="swap" className="w-7 h-7" /> {t("convert_crypto")}
            </div>
          </div>
          <div className="px-6 py-6">
            <form onSubmit={handleConvert} className="flex flex-col gap-5">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-slate-600 font-medium mb-2 block">{t("from")}</label>
                  <select
                    value={fromCoin}
                    onChange={e => {
                      setFromCoin(e.target.value);
                      if (e.target.value === "USDT") setToCoin("BTC"); else setToCoin("USDT");
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-200 outline-none"
                  >
                    {coinSymbols.map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>

                <button type="button" onClick={swap} className="self-end md:self-auto h-12 mt-2 md:mt-7 rounded-xl bg-slate-900 text-white px-4 hover:scale-[1.02] transition">
                  <Icon name="swap" />
                </button>

                <div className="flex-1">
                  <label className="text-slate-600 font-medium mb-2 block">{t("to")}</label>
                  <select
                    value={toCoin}
                    onChange={e => setToCoin(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-200 outline-none"
                  >
                    {fromCoin === "USDT"
                      ? coinSymbols.filter(c => c !== "USDT").map(c => <option key={c} value={c}>{c}</option>)
                      : <option value="USDT">USDT</option>}
                  </select>
                </div>
              </div>

              <Field
                label={t("amount_with_coin", { coin: fromCoin })}
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={t("enter_amount_with_coin", { coin: fromCoin })}
                icon="dollar-sign"
              />

              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-slate-700 font-medium">
                {t("you_will_receive")}:&nbsp;
                <span className="font-extrabold text-slate-900">
                  {result ? `${result} ${toCoin}` : "--"}
                </span>
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-slate-900 text-white text-lg font-extrabold hover:scale-[1.02] transition"
                disabled={!amount || isNaN(amount) || fromCoin === toCoin || parseFloat(amount) <= 0}
              >
                {t("convert")}
              </button>

              {successMsg && (
                <div className="mt-2 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 rounded-lg px-4 py-3 text-center text-base font-semibold">
                  {successMsg}
                </div>
              )}
            </form>
          </div>
        </Card>

        {/* ===== History ===== */}
        <Card className="mt-8 rounded-3xl shadow-xl border border-slate-100 p-0 overflow-hidden">
          <div className="px-5 py-4 md:px-6 md:py-5 bg-white/80">
            <div className="flex items-center gap-2 text-slate-800 text-xl font-extrabold">
              <Icon name="clock" className="w-6 h-6" /> {t("deposit_withdraw_history")}
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm md:text-base">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="text-left text-slate-600 border-y border-slate-100">
                  <th className="py-3.5 px-4">{t("type")}</th>
                  <th className="py-3.5 px-4 text-right">{t("amount")}</th>
                  <th className="py-3.5 px-4">{t("coin")}</th>
                  <th className="py-3.5 px-4">{t("date")}</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {(Array.isArray(allHistory) ? allHistory : []).map((row, idx) => (
                  <tr
                    key={row.type === "Deposit" ? `deposit-${row.id || idx}` : row.type === "Withdraw" ? `withdraw-${row.id || idx}` : idx}
                    className="group border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    style={{ height: 60 }}
                  >
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ring-1 ${row.type === "Deposit"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200"
                        }`}>
                        <Icon name={row.type === "Deposit" ? "download" : "upload"} className="w-4 h-4" />
                        {t(row.type.toLowerCase())}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium">
                      {row.amount}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <Icon name={row.coin?.toLowerCase() || "coin"} className="w-5 h-5" />
                        {row.coin}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : (row.date || "--")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ===== Modals ===== */}
      <Modal visible={modal.open && modal.type === "deposit"} onClose={closeModal}>
        <form onSubmit={handleDepositSubmit} className="space-y-5 p-2">
          <div className="text-2xl font-bold mb-3 flex items-center gap-2 text-slate-900">
            <Icon name="download" className="w-7 h-7" /> {t("deposit")}
          </div>

          <select
            className="w-full px-4 py-3 rounded-xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-200 outline-none"
            value={selectedDepositCoin}
            onChange={e => setSelectedDepositCoin(e.target.value)}
          >
            {coinSymbols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex flex-col items-center justify-center">
            <div className="relative w-full max-w-[160px] aspect-square mb-3 rounded-xl bg-white ring-1 ring-slate-200 flex items-center justify-center overflow-hidden">
              {walletQRCodes[selectedDepositCoin] ? (
                <img
                  src={walletQRCodes[selectedDepositCoin].startsWith("/uploads")
                    ? `${ADMIN_API_BASE}${walletQRCodes[selectedDepositCoin]}`
                    : walletQRCodes[selectedDepositCoin]}
                  alt={t("deposit_qr")}
                  className="max-w-full max-h-full object-contain p-2"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : null}
              {!walletQRCodes[selectedDepositCoin] && (
                <QRCodeCanvas value={walletAddresses[selectedDepositCoin] || ""} size={140} bgColor="#ffffff" fgColor="#000000" />
              )}
            </div>
          </div>

          <div className="text-slate-600 font-medium">{t("network")}: <span className="font-semibold text-slate-900">{depositNetworks[selectedDepositCoin]}</span></div>

          <div className="flex items-center gap-2 justify-center">
            <span className="font-mono bg-slate-50 ring-1 ring-slate-200 px-2 py-1 rounded text-sm max-w-[260px] overflow-x-auto">
              {walletAddresses[selectedDepositCoin]}
            </span>
            <button
              type="button"
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-sm font-semibold"
              onClick={() => { navigator.clipboard.writeText(walletAddresses[selectedDepositCoin]); setDepositToast(t("copied")); }}
            >
              <span className="inline-flex items-center gap-1"><Icon name="copy" />{t("copy")}</span>
            </button>
          </div>

          <Field
            label={t("deposit_amount_with_coin", { coin: selectedDepositCoin })}
            type="number"
            min={0}
            step="any"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            required
            icon="dollar-sign"
          />

          <div>
            <label className="block text-slate-600 font-medium mb-1">{t("upload_screenshot")}</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={e => { setDepositScreenshot(e.target.files[0]); setFileLocked(true); }}
                required
                className="absolute inset-0 opacity-0 z-50 cursor-pointer"
                disabled={fileLocked}
              />
              <div className={`truncate w-full text-sm text-white font-semibold text-center px-4 py-2 rounded-xl ${fileLocked ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:opacity-95 cursor-pointer"}`}>
                {fileLocked ? t("screenshot_uploaded") : t("choose_file")}
              </div>
            </div>
          </div>

          <div className="text-sm text-slate-600 bg-slate-50 ring-1 ring-slate-200 rounded px-3 py-2">
            {t("for_your_safety_submit_screenshot")}
            <span className="block text-amber-600">{t("proof_ensures_support")}</span>
          </div>

          <div className="relative">
            <button
              type="submit"
              disabled={depositBusy || !depositAmount || !depositScreenshot}
              className={`w-full h-12 rounded-xl text-white text-lg font-extrabold transition
      ${depositBusy ? "bg-slate-500 cursor-not-allowed" : "bg-slate-900 hover:scale-[1.02]"}`}
            >
              {depositBusy ? (t("submitting") || "Submitting...") : t("submit")}
            </button>

            {depositToast && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[70]">
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-2xl
              bg-slate-900/95 backdrop-blur text-white font-semibold ring-1 ring-white/15">
                  <Icon name="check" className="w-5 h-5" />
                  <span>{depositToast}</span>
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal visible={modal.open && modal.type === "withdraw"} onClose={closeModal}>
        <form onSubmit={handleWithdraw} className="space-y-5 p-2">
          <div className="text-2xl font-bold mb-3 flex items-center gap-2 text-slate-900">
            <Icon name="upload" className="w-7 h-7" /> {t("withdraw")}
          </div>
          <select
            className="w-full px-4 py-3 rounded-xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-200 outline-none"
            value={selectedWithdrawCoin}
            onChange={e => setSelectedWithdrawCoin(e.target.value)}
          >
            {coinSymbols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="text-slate-600 font-medium">{t("network")}: <span className="font-semibold text-slate-900">{depositNetworks[selectedWithdrawCoin]}</span></div>

          <Field
            label={t("withdraw_to_address")}
            type="text"
            required
            placeholder={t("paste_recipient_address", { coin: selectedWithdrawCoin })}
            value={withdrawForm.address}
            onChange={e => setWithdrawForm(f => ({ ...f, address: e.target.value }))}
            icon="send"
          />
          <Field
            label={t("amount_with_coin", { coin: selectedWithdrawCoin })}
            type="number"
            min={0.0001}
            step="any"
            required
            placeholder={t("enter_amount_with_coin", { coin: selectedWithdrawCoin })}
            value={withdrawForm.amount}
            onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
            icon="dollar-sign"
          />

          <div className="text-sm text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-3 py-2">{t("double_check_withdraw")}</div>

          <div className="relative">
            <button
              type="submit"
              disabled={withdrawBusy || !withdrawForm.address || !withdrawForm.amount}
              className={`w-full h-12 rounded-xl text-white text-lg font-extrabold transition
      ${withdrawBusy ? "bg-slate-500 cursor-not-allowed" : "bg-slate-900 hover:scale-[1.02]"}`}
            >
              {withdrawBusy ? (t("submitting") || "Submitting...") : t("submit_withdraw")}
            </button>

            {withdrawToast && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[70]">
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-2xl
              bg-slate-900/95 backdrop-blur text-white font-semibold ring-1 ring-white/15">
                  <Icon name="check" className="w-5 h-5" />
                  <span>{withdrawToast}</span>
                </div>
              </div>
            )}
          </div>

          {withdrawMsg && (
            <div className="mt-2 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 rounded-lg px-4 py-2 text-center text-base font-semibold">
              {withdrawMsg}
            </div>
          )}
        </form>
      </Modal>

      {/* ===== NEW: DeFi Staking Modal ===== */}
      <Modal visible={stakeModal.open} onClose={closeStakeModal}>
        <div className="p-1">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><Icon name="layers" /></span>
              Novachain AI DeFi Staking
            </h2>
            <p className="text-slate-500 text-sm mt-1">Earn daily rewards by locking assets.</p>
          </div>

          <form onSubmit={handleStakeSubmit} className="space-y-6">

            {/* 1. Select Coin */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
                <span className="bg-slate-900 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                {t("select_coin", "Select coin to stake")}
              </label>
              <div className="relative">
                <select
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                  value={stakeModal.coin}
                  onChange={e => setStakeModal(m => ({ ...m, coin: e.target.value }))}
                >
                  {coinSymbols.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Icon name={stakeModal.coin.toLowerCase()} className="w-6 h-6" />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Icon name="chevron-down" className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* 2. Amount */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
                <span className="bg-slate-900 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                {t("enter_amount", "Enter Amount")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full h-14 pl-4 pr-20 rounded-xl bg-slate-900 text-white text-xl font-bold placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.00"
                  value={stakeModal.amount}
                  onChange={e => setStakeModal(m => ({ ...m, amount: e.target.value }))}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Find balance of selected coin
                      const asset = balances.find(b => b.symbol === stakeModal.coin);
                      if (asset) setStakeModal(m => ({ ...m, amount: asset.balance }));
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-2 py-1"
                  >
                  </button>
                  <span className="text-slate-400 font-bold text-sm px-2">{stakeModal.coin}</span>
                </div>
              </div>
              <div className="text-right mt-1 text-xs text-slate-500">
                Available: {balances.find(b => b.symbol === stakeModal.coin)?.balance || "0"} {stakeModal.coin}
              </div>
            </div>

            {/* 3. Select Plan (Grid Layout) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
                <span className="bg-slate-900 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                {t("select_plan", "Select a staking plan")}
              </label>

              <div className="grid grid-cols-1 gap-3">
                {STAKING_PLANS.map((plan) => {
                  const isSelected = selectedPlan?.days === plan.days;
                  return (
                    <div
                      key={plan.days}
                      onClick={() => setSelectedPlan(plan)}
                      className={`
                        cursor-pointer relative p-4 rounded-xl border-2 transition-all duration-200 flex justify-between items-center
                        ${isSelected
                          ? "border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.01]"
                          : "border-slate-200 bg-white hover:border-indigo-300"
                        }
                      `}
                    >
                      <div>
                        <div className={`text-lg font-extrabold ${isSelected ? "text-indigo-900" : "text-slate-700"}`}>
                          {plan.days} Days
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Duration Lock</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-emerald-600">
                          {plan.rate}%
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Per day</div>
                      </div>
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                          <Icon name="check" className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Estimate Calculation Display */}
            {stakeModal.amount && selectedPlan && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-medium text-sm">Estimated Profit:</span>
                <span className="text-emerald-600 font-extrabold text-lg">
                  + {(parseFloat(stakeModal.amount) * (selectedPlan.rate / 100) * selectedPlan.days).toFixed(4)} {stakeModal.coin}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={stakeBusy || !stakeModal.amount || !selectedPlan}
                className={`w-full h-14 rounded-xl text-white text-lg font-extrabold shadow-lg transition
                  ${stakeBusy || !stakeModal.amount || !selectedPlan
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] shadow-indigo-200"
                  }`}
              >
                {stakeBusy ? t("processing", "Processing...") : t("stake_now", "Stake Now")}
              </button>
            </div>

            {/* Toast Message */}
            {stakeToast && (
              <div className={`mt-4 p-3 rounded-lg text-center font-bold text-sm ring-1 
                ${stakeToast.type === 'success' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-rose-100 text-rose-700 ring-rose-200'}`}>
                {stakeToast.message}
              </div>
            )}

          </form>
        </div>
      </Modal>
      {/* ============================= */}
    </div>
  );
}