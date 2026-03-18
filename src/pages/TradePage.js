// src/pages/TradePage.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import NovaChainLogo from "../components/NovaChainLogo.svg";
import { MAIN_API_BASE } from "../config";
import Card from "../components/card";
import Icon from "../components/icon";
import OrderBTC from "../components/orderbtc";
import { useTranslation } from "react-i18next";

// Import our new components
import TradeModal from "../components/TradeModal";
import TradeResult from "../components/TradeResult";
import ActiveTradeTimer from "../components/ActiveTradeTimer";

/* ---------------- Coins (unchanged logics) ---------------- */
const COINS = [
  { symbol: "BTC", name: "Bitcoin", tv: "BINANCE:BTCUSDT", api: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", tv: "BINANCE:ETHUSDT", api: "ethereum" },
  { symbol: "SOL", name: "Solana", tv: "BINANCE:SOLUSDT", api: "solana" },
  { symbol: "XRP", name: "Ripple", tv: "BINANCE:XRPUSDT", api: "ripple" },
  { symbol: "TON", name: "Toncoin", tv: "BINANCE:TONUSDT", api: "toncoin" },
];
const profitMap = { 30: 0.3, 60: 0.5, 90: 0.7, 120: 1.0 };

// Helper function to format the percentage
const formatPercent = (n) => {
  const num = Number(n || 0);
  const prefix = num > 0 ? "+" : "";
  // Use Tailwind's text color classes
  const colorClass = num >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-bold ${colorClass}`}>
      {prefix}{num.toFixed(2)}%
    </span>
  );
};

// Helper function to format large currency numbers for volume
const formatVolume = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000_000) {
    return "$" + (num / 1_000_000_000).toFixed(2) + "B";
  }
  if (num >= 1_000_000) {
    return "$" + (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return "$" + (num / 1_000).toFixed(2) + "K";
  }
  return "$" + num.toFixed(2);
};

/* ---------------- Local storage helpers (unchanged) ---------------- */
function persistTradeState(tradeState) {
  if (tradeState) localStorage.setItem("activeTrade", JSON.stringify(tradeState));
  else localStorage.removeItem("activeTrade");
}
function loadTradeState() {
  try {
    return JSON.parse(localStorage.getItem("activeTrade") || "null");
  } catch {
    return null;
  }
}
function createTradeState(trade_id, user_id, duration) {
  const endAt = Date.now() + duration * 1000;
  return { trade_id, user_id, duration, endAt };
}

export default function TradePage() {
  const { t } = useTranslation();

  /* ---------------- State (unchanged) ---------------- */
  const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
  const [coinPrice, setCoinPrice] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [coinStats, setCoinStats] = useState(null);

  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(30);
  const [direction, setDirection] = useState("BUY");

  const [timerActive, setTimerActive] = useState(false);
  const [tradeState, setTradeState] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [waitingResult, setWaitingResult] = useState(false);

  const [tradeResult, setTradeResult] = useState(null);
  const [tradeDetail, setTradeDetail] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- pretty toast ---
  const [toast, setToast] = useState(null); // { text, type, id }
  const showToast = (text, type = "error") => {
    const id = Math.random();
    setToast({ text, type, id });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2000);
  };

  /* ---------------- Restore active trade (unchanged) ---------------- */
  useEffect(() => {
    const saved = loadTradeState();
    if (saved && saved.endAt > Date.now()) {
      const remaining = Math.ceil((saved.endAt - Date.now()) / 1000);
      const adjustedTradeState = { ...saved, duration: remaining };
      setTradeState(adjustedTradeState);
      setTimerActive(true);
      setTradeDetail(null);
      setTradeResult(null);
      setTimerKey(Math.random());
    }
  }, []);

  /* ---------------- Price polling (REAL-TIME WEBSOCKET) ---------------- */
  useEffect(() => {
    let ws;

    // 1. Quick initial fetch so the UI doesn't look empty while connecting
    const fetchInitialData = async () => {
      try {
        const res = await axios.get(`${MAIN_API_BASE}/prices/${selectedCoin.api}`);
        // Only use fallback if WS hasn't taken over yet
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          setCoinPrice(Number(res.data?.price));
          setCoinStats({
            high: res.data?.high_24h || 0,
            low: res.data?.low_24h || 0,
            vol: res.data?.volume_24h || 0,
            change: res.data?.percent_change_24h || 0,
          });
        }
        setFetchError(false);
      } catch {
        setFetchError(true);
      }
    };
    fetchInitialData();

    // 2. Connect to Binance Real-Time Stream
    const symbolStream = `${selectedCoin.symbol.toLowerCase()}usdt@ticker`;
    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbolStream}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // c = current price, h = high, l = low, q = quote volume (USDT), P = price change %
      if (data.c) {
        setCoinPrice(Number(data.c));
        setCoinStats({
          high: Number(data.h),
          low: Number(data.l),
          vol: Number(data.q), 
          change: Number(data.P),
        });
        setFetchError(false);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setFetchError(true);
    };

    // 3. Cleanup on unmount or when changing coins
    return () => {
      if (ws) ws.close();
    };
  }, [selectedCoin]);

  /* ---------------- TradingView loader (Fixed) ---------------- */
  useEffect(() => {
    setLoadingChart(true);

    // This function creates the widget
    const createWidget = () => {
      // Make sure the container is ready and empty
      const container = document.getElementById("tradingview_chart_container");
      if (!container) {
        console.error("TradingView container not found");
        return;
      }
      container.innerHTML = ""; // Clear container before creating new widget

      // Check if TradingView library is loaded
      if (window.TradingView) {
        new window.TradingView.widget({
          container_id: "tradingview_chart_container",
          width: "100%",
          height: 420,
          symbol: selectedCoin.tv,
          interval: "15",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0f0f16",
          backgroundColor: "#101726",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: true,
          withdateranges: true,
          details: false,
          studies: [],
          overrides: {},
          loading_screen: { backgroundColor: "#101726", foregroundColor: "#ffd700" },
        });
        setTimeout(() => setLoadingChart(false), 1400);
      } else {
        console.error("TradingView library not loaded");
      }
    };

    // Check if script is already on the page
    if (document.getElementById("tradingview-widget-script")) {
      // If script is already loaded, just create the widget
      createWidget();
    } else {
      // If script is not loaded, create and load it
      const script = document.createElement("script");
      script.id = "tradingview-widget-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = () => createWidget(); // Create widget *after* script loads
      document.body.appendChild(script);
    }

    // The new cleanup function
    return () => {
      const container = document.getElementById("tradingview_chart_container");
      if (container) {
        container.innerHTML = ""; // Just empty the container
      }
    };
  }, [selectedCoin]); // This still re-runs correctly when selectedCoin changes

  /* ---------------- Result polling (unchanged) ---------------- */
  async function pollResult(trade_id, user_id) {
    let tries = 0,
      trade = null;
    const token = localStorage.getItem("token");
    while (tries < 6 && (!trade || trade.result === "PENDING")) {
      try {
        const his = await axios.get(`${MAIN_API_BASE}/trade/history/${user_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        trade = his.data.find((t) => t.id === trade_id);
        if (trade && trade.result !== "PENDING") break;
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
      tries++;
    }
    setTimerActive(false);
    setTradeState(null);
    persistTradeState(null);
    if (trade && trade.result !== "PENDING") {
      setTradeResult(trade.result === "WIN" ? trade.profit : -Math.abs(trade.profit));
      setTradeDetail(trade);
    } else {
      setTradeResult(null);
      setTradeDetail(null);
      showToast(t("trade_result_not_ready", "Trade result not ready, please check history!"), "info");
    }
  }

  const onTimerComplete = async () => {
    setWaitingResult(true);
    if (!tradeState) return;
    await pollResult(tradeState.trade_id, tradeState.user_id);
    setTradeState(null);
    setTimerActive(false);
    setWaitingResult(false);
    setTimerKey(Math.random());
    return { shouldRepeat: false, delay: 0 };
  };

  /* ---------------- Execute trade (unchanged) ---------------- */
  const executeTrade = async () => {
    if (!coinPrice || timerActive) return;
    setTimerActive(true);
    setTradeResult(null);
    setTradeDetail(null);

    const token = localStorage.getItem("token");
    if (!token) {
      showToast(t("please_login", "Please log in to trade."), "warning");
      setTimerActive(false);
      return;
    }

    function parseJwt(token) {
      try {
        return JSON.parse(atob(token.split(".")[1]));
      } catch {
        return {};
      }
    }

    const payload = parseJwt(token);
    const user_id = payload.id;

    const endAt = Date.now() + duration * 1000;
    const temp = { trade_id: "temp", user_id, duration, endAt };

    setTradeState(temp);
    setTimerKey(Math.random());

    try {
      const res = await axios.post(
        `${MAIN_API_BASE}/trade`,
        {
          user_id,
          direction: direction.toUpperCase(),
          amount: Number(amount),
          duration: Number(duration),
          symbol: selectedCoin.symbol,
          client_price: Number(coinPrice) || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.data.trade_id) throw new Error("Failed to start trade");
      const { trade_id } = res.data;

      setTradeState((prev) => (prev ? { ...prev, trade_id } : createTradeState(trade_id, user_id, duration)));
      persistTradeState({ trade_id, user_id, duration, endAt });
    } catch (err) {
      setTimerActive(false);
      setTradeResult(null);
      setTradeDetail(null);
      persistTradeState(null);
      showToast(`${t("trade_failed", "Trade failed")}: ${err.response?.data?.error || err.message}`, "error");
    }
  };

  const openTradeModal = (dir) => {
    if (timerActive) return;
    setDirection(dir);
    setIsModalOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-full px-3 pt-5 overflow-x-hidden"
    >
      {/* soft overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: "linear-gradient(120deg, #0b1020f0 0%, #0d1220d8 60%, #0a101dd1 100%)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }} className="w-full">
        <div className="w-full max-w-[1300px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-7 lg:gap-8">
          {/* ---------------- Left: Chart & selectors ---------------- */}
          {/* This outer div should remain */}
          <div className="w-full">
            {/* The coin selector div inside was correctly removed */}

            {/* chart box - THIS is what needs to be here */}
            <div className="relative w-full rounded-2xl shadow-2xl bg-gradient-to-br from-[#141a2b] via-[#0f1424] to-[#0b1020] border border-[#1a2343] overflow-hidden">
              <div id="tradingview_chart_container" className="w-full h-[420px]" />
              {loadingChart && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0c1323e6] backdrop-blur-sm">
                  <svg className="animate-spin mb-4" width="54" height="54" viewBox="0 0 54 54" fill="none">
                    <circle cx="27" cy="27" r="24" stroke="#2474ff44" strokeWidth="5" />
                    <path d="M51 27a24 24 0 1 1-48 0" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                  <div className="text-lg font-bold text-sky-100">{t("refreshing_price", "Refreshing Price...")}</div>
                </div>
              )}

              {/* floating price pill */}
              <div className="absolute right-[88px] top-[46px] md:right-3 md:top-3 z-10">
                <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm ring-1 ring-white/10 text-white font-medium shadow-sm">
                  <div className="text-[9px] uppercase tracking-wide text-white/60 leading-none">
                    {selectedCoin.symbol}/USDT
                  </div>
                  <div className="text-sm tabular-nums font-bold leading-tight">
                    {typeof coinPrice === "number" && !isNaN(coinPrice)
                      ? "$" + coinPrice.toLocaleString(undefined, { maximumFractionDigits: 3 })
                      : fetchError
                      ? t("api_error", "API Error")
                      : t("loading", "Loading...")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- Right: Trade panel ---------------- */}
          {/* This is now much cleaner! */}
          <div className="w-full">
            {/* --- 🎨 NEW POLISHED CARD --- */}
            <Card className="w-full px-5 py-6 rounded-2xl shadow-2xl bg-gradient-to-br from-[#141a2b] via-[#0f1424] to-[#0b1020] border border-[#1a2343]">
              {/* header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-400">{t("pair", "Pair")}</span>
                  <span
                    className="font-extrabold text-[1.6rem] tracking-wide"
                    style={{
                      background: "linear-gradient(92deg, #1e2fff 0%, #00eaff 60%, #ffd700 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {selectedCoin.symbol}/USDT
                  </span>
                </div>
                <img src={NovaChainLogo} alt="NovaChain" className="h-9 w-auto ml-4" />
              </div>

              {/* NEW Price Stats & Selector */}
              <div className="mb-5 border-b border-white/10 pb-5">
                
                {/* --- NEW Polished Price/Stats Layout --- */}
                <div className="flex justify-between items-start mb-4">
                    {/* Left: Price & % Change */}
                    <div>
                        <div className="text-3xl font-bold text-white tabular-nums">
                        {typeof coinPrice === "number" && !isNaN(coinPrice)
                            ? "$" + coinPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : "Loading..."}
                        </div>
                        {coinStats && (
                        <div className="text-lg mt-1">
                            {formatPercent(coinStats.change)}
                        </div>
                        )}
                    </div>

                    {/* Right: Stats Stack (like your example) */}
                    <div className="flex flex-col text-right text-sm pt-1">
                        <div className="flex justify-end gap-2">
                            <span className="text-gray-400">24h High:</span>
                            <span className="font-semibold text-white tabular-nums">
                            {coinStats ? "$" + coinStats.high.toLocaleString() : "..."}
                            </span>
                        </div>
                        <div className="flex justify-end gap-2">
                            <span className="text-gray-400">24h Low:</span>
                            <span className="font-semibold text-white tabular-nums">
                            {coinStats ? "$" + coinStats.low.toLocaleString() : "..."}
                            </span>
                        </div>

                        <div className="flex justify-end gap-2">
                            <span className="text-gray-400">24h Vol:</span>
                            <span className="font-semibold text-white tabular-nums">
                            {/* Use the new formatter */}
                            {coinStats ? formatVolume(coinStats.vol) : "..."}
                            </span>
                        </div>
                    </div>
                </div>
                {/* --- End of Polished Layout --- */}


                {/* Polished Coin Selector */}
                <div className="mt-4">
                  <select
                    value={selectedCoin.symbol}
                    disabled={timerActive}
                    onChange={(e) => {
                      const newCoin = COINS.find(c => c.symbol === e.target.value);
                      if (newCoin) setSelectedCoin(newCoin);
                    }}
                    className="w-full h-11 px-3 rounded-lg bg-[#2c3040] border border-gray-700 text-white font-bold text-base focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {COINS.map(coin => (
                      <option key={coin.symbol} value={coin.symbol}>
                        {coin.symbol}/USDT
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buy/Sell Buttons (Unchanged) */}
              <AnimatePresence>
                {!timerActive && !waitingResult && !tradeDetail && (
                  <motion.div
                    key="trade-buttons"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="grid grid-cols-2 gap-4 mt-5"
                  >
                    <button
                      onClick={() => openTradeModal("BUY")}
                      className="w-full h-12 rounded-lg bg-green-500 text-white text-lg font-bold shadow-lg transition hover:bg-green-600 flex items-center justify-center gap-2"
                    >
                      <Icon name="arrow-up" />
                      {t("buy_long", "Buy Long")}
                    </button>
                    <button
                      onClick={() => openTradeModal("SELL")}
                      className="w-full h-12 rounded-lg bg-red-500 text-white text-lg font-bold shadow-lg transition hover:bg-red-600 flex items-center justify-center gap-2"
                    >
                      <Icon name="arrow-down" />
                      {t("sell_short", "Sell Short")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* --- Polished Timer/Waiting --- */}
              <div className="mt-5 text-center"> {/* Add margin top and center alignment */}
                <AnimatePresence>
                  {/* Keep AnimatePresence */}
                  {(timerActive || waitingResult) && (
                    // Apply styles within the animated div
                    <motion.div
                      key="timer-waiting"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                         // WITH THIS (around line 534):
                        className="text-3xl font-extrabold text-yellow-300 py-4 tabular-nums tracking-tight"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }} // Add subtle shadow for visibility
                    >
                      <ActiveTradeTimer
                        timerActive={timerActive}
                        waitingResult={waitingResult}
                        tradeState={tradeState}
                        timerKey={timerKey}
                        onTimerComplete={onTimerComplete}
                        t={t}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* --- End Polished Timer/Waiting --- */}

              {/* --- Polished Result Box with Close Button --- */}
              <AnimatePresence>
                {tradeDetail && ( // Only show wrapper if tradeDetail exists
                  <motion.div
                    key="result-card-wrapper"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="relative mt-5" // Add margin top
                  >
                    {/* Close Button (Top Right corner of the card) */}
                    <button
                      onClick={() => {
                         setTradeDetail(null); // Clear the result object
                         setTradeResult(null); // Clear the numeric result value too
                      }}
                      className="absolute top-3 right-3 z-20 h-7 w-7 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors flex items-center justify-center backdrop-blur-sm"
                      aria-label="Close Result"
                    >
                      {/* Simple 'X' icon using SVG */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>

                    {/* Render the actual result card */}
                    <TradeResult
                      tradeDetail={tradeDetail}
                      t={t}
                      // Pass the onClose function if TradeResult needs it internally (optional)
                      // onClose={() => { setTradeDetail(null); setTradeResult(null); }}
                     />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* --- End Polished Result Box --- */}
            </Card>
          </div>

          {/* Orders strip beneath on small screens */}
          <div className="lg:col-span-2 mt-2">
            <div className="w-full flex justify-center">
              <div className="max-w-5xl w-full px-1 md:px-2">
                <OrderBTC />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW Trade Modal (Rendered at root level) */}
      <TradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        direction={direction}
        duration={duration}
        setDuration={setDuration}
        amount={amount}
        setAmount={setAmount}
        profitMap={profitMap}
        onSubmit={executeTrade}
        t={t}
      />

      {/* toast – always global */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none"
            role="status"
            aria-live="polite"
          >
      <div
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl ring-1 ring-white/15 text-white backdrop-blur pointer-events-auto
      ${
        toast.type === "error"
          ? "bg-rose-600/90"
          : toast.type === "warning"
          ? "bg-amber-600/90"
          : "bg-slate-900/90"
      }`}
  >
    <Icon
      name={
        toast.type === "error" ? "alert-circle" : toast.type === "warning" ? "alert-triangle" : "check-circle"
      }
      className="w-6 h-6"
    />
    <span className="text-base font-semibold">{toast.text}</span>
  </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}