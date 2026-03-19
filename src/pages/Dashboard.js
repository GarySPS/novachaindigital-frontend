//src>pages>Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/card";
import NewsTicker from "../components/newsticker";
import { MAIN_API_BASE } from "../config";

/* ---------- helpers ---------- */
function formatBigNum(number) {
  if (!number || isNaN(number)) return "--";
  if (number >= 1e12) return "$" + (number / 1e12).toFixed(2) + "T";
  if (number >= 1e9) return "$" + (number / 1e9).toFixed(2) + "B";
  if (number >= 1e6) return "$" + (number / 1e6).toFixed(2) + "M";
  if (number >= 1e3) return "$" + (number / 1e3).toFixed(2) + "K";
  return "$" + Number(number).toLocaleString();
}
const pctClass = (v) =>
  v > 0
    ? "text-emerald-600 bg-emerald-50 ring-1 ring-emerald-200"
    : v < 0
    ? "text-rose-600 bg-rose-50 ring-1 ring-rose-200"
    : "text-slate-600 bg-slate-50 ring-1 ring-slate-200";

export default function Dashboard() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newsHeadlines, setNewsHeadlines] = useState([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("mcap"); // mcap | volume | change | price | name
  const [showPromotion, setShowPromotion] = useState(false);

  /* ---------- prices (fetch >= 100) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nc_coins");
      if (raw) setCoins(JSON.parse(raw));
    } catch {}

    const fetchPrices = async () => {
      try {
        // ask backend for lots (most CoinMarketCap-style proxies accept limit)
        const urls = [
          `${MAIN_API_BASE}/prices?limit=200`,
          `${MAIN_API_BASE}/prices?limit=150`,
          `${MAIN_API_BASE}/prices?limit=100`,
          `${MAIN_API_BASE}/prices`, // final fallback
        ];
        let freshCoins = [];
        for (const u of urls) {
          try {
            const r = await fetch(u);
            const j = await r.json();
            const arr = j?.data || [];
            if (arr.length > freshCoins.length) freshCoins = arr;
            if (freshCoins.length >= 100) break;
          } catch {}
        }

        if (freshCoins.length) {
          setCoins(() => {
            try {
              localStorage.setItem("nc_coins", JSON.stringify(freshCoins));
            } catch {}
            return freshCoins;
          });
        }
      } catch {
        /* keep last cache */
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 12000);
    return () => clearInterval(interval);
  }, []);

  /* ---------- news ---------- */
  useEffect(() => {
    async function fetchHeadlines() {
      try {
        const rssUrl = "https://cointelegraph.com/rss";
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
          rssUrl
        )}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        setNewsHeadlines(
          (data.items || [])
            .slice(0, 10)
            .map((item) =>
              item.title.replace(/&#(\d+);/g, (m, code) =>
                String.fromCharCode(code)
              )
            )
        );
      } catch {
        setNewsHeadlines([]);
      }
    }
    fetchHeadlines();
  }, []);

  /* ---------- promotion modal ---------- */
  useEffect(() => {
    // Check session storage to see if user already closed it
    const hasClosed = sessionStorage.getItem("novaPromotionClosed");
    if (!hasClosed) {
      setShowPromotion(true);
    }
  }, []);

  const handleClosePromotion = () => {
    sessionStorage.setItem("novaPromotionClosed", "true");
    setShowPromotion(false);
  };

  /* ---------- computed ---------- */
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = coins.slice();
    if (q) {
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.symbol?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const au = a.quote?.USD || {};
      const bu = b.quote?.USD || {};
      switch (sortBy) {
        case "price":
          return (bu.price || 0) - (au.price || 0);
        case "change":
          return (
            (bu.percent_change_24h || 0) - (au.percent_change_24h || 0)
          );
        case "volume":
          return (bu.volume_24h || 0) - (au.volume_24h || 0);
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        default:
          // mcap
          return (bu.market_cap || 0) - (au.market_cap || 0);
      }
    });
    return list;
  }, [coins, query, sortBy]);

  // Always show up to 100 in the table
  const display = useMemo(
    () => filteredSorted.slice(0, 100),
    [filteredSorted]
  );

  const totalMcap = useMemo(
    () =>
      display.reduce(
        (sum, c) => sum + (c.quote?.USD?.market_cap || 0),
        0
      ),
    [display]
  );
  const totalVol = useMemo(
    () =>
      display.reduce(
        (sum, c) => sum + (c.quote?.USD?.volume_24h || 0),
        0
      ),
    [display]
  );

  /* ---------- skeleton ---------- */
  const SkeletonRow = ({ i }) => (
    <tr key={`sk-${i}`} className="animate-pulse border-b border-slate-100">
      <td className="py-4 px-3">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
      </td>
      <td className="py-4 px-3">
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </td>
      <td className="py-4 px-3">
        <div className="h-4 w-14 bg-slate-200 rounded" />
      </td>
      <td className="py-4 px-3 text-right">
        <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
      </td>
      <td className="py-4 px-3">
        <div className="h-6 w-20 bg-slate-200 rounded" />
      </td>
      <td className="py-4 px-3 text-right">
        <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
      </td>
      <td className="py-4 px-3 text-right">
        <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
      </td>
    </tr>
  );

return (
    <div
      className="min-h-screen w-full flex flex-col items-center py-8 px-3"
      style={{
        background: 'url("/novachain.jpg") no-repeat center center fixed',
        backgroundSize: "cover",
        minHeight: "100vh", // Ensure it covers viewport height
        position: "relative",
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
      <div style={{ position: "relative", zIndex: 1 }} className="w-full max-w-7xl mx-auto space-y-6">

        {/* ---- ✨ Polished Top Stats Card ---- */}
        <Card className="p-0 overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-[#141a2b] via-[#0f1424] to-[#0b1020] border border-[#1a2343]">
          <div className="px-4 py-4 md:px-6 md:py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Market Cap */}
              <div>
                <div className="text-gray-400 text-sm">
                  Global Market Cap
                </div>
                <div className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
                  {formatBigNum(totalMcap)}
                </div>
              </div>
              {/* Volume */}
              <div>
                <div className="text-gray-400 text-sm">
                  24h Volume
                </div>
                <div className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
                  {formatBigNum(totalVol)}
                </div>
              </div>
              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Sort Select */}
                <select
                  className="w-full cursor-pointer appearance-none rounded-lg border border-gray-700 bg-[#2c3040] text-gray-200 bg-no-repeat px-4 py-2.5 outline-none transition-all focus:ring-2 focus:ring-sky-500"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5em 1.5em' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="mcap">Sort by Market Cap</option>
                  <option value="volume">Sort by 24h Volume</option>
                  <option value="change">Sort by 24h Change</option>
                  <option value="price">Sort by Price</option>
                  <option value="name">Sort by Name</option>
                </select>

                {/* Search Input */}
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-[#2c3040] text-gray-200 py-2.5 pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-sky-500 placeholder:text-gray-500"
                    placeholder="Search..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        {/* --- Table Section Starts Here --- */}

        {/* ---- ✨ Polished Table ---- */}
        <div className="w-full overflow-x-auto">
          {/* Use min-w-[768px] or similar if needed for smaller screens */}
          <table className="w-full min-w-[768px] text-sm md:text-base">
            {/* Colgroup remains same */}
            <colgroup><col className="w-24" /><col /><col className="w-28" /><col className="w-40" /><col className="w-28" /><col className="w-44" /><col className="w-44" /></colgroup>
            {/* Polished Head */}
            <thead className="sticky top-0 z-10 bg-[#0f1424]">
              <tr className="text-left text-gray-400 border-y border-white/10">
                <th className="py-3.5 px-3 text-center">#</th>
                <th className="py-3.5 px-3">Name</th>
                <th className="py-3.5 px-3">Symbol</th>
                <th className="py-3.5 px-3 text-right">Price</th>
                <th className="py-3.5 px-3 text-center">24h</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">
                  24h Volume
                </th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">
                  Market Cap
                </th>
              </tr>
            </thead>
            
            {/* Polished Body */}
            <tbody className="divide-y divide-white/10">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    /* ---------- ✨ Polished Skeleton ---------- */
                    <tr key={`sk-${i}`} className="animate-pulse border-b border-white/10">
                   
                                         {/* # and Icon */}
                      <td className="py-3 px-3">
                        <div className="flex items-center">
                          <span className="text-transparent text-xs font-medium w-8 tabular-nums text-right mr-2 bg-gray-700 rounded">00</span>
                          <div className="w-8 h-8 rounded-full bg-gray-700" />
                        </div>
                      </td>
                      {/* Name */}
                      <td className="py-4 px-3">
                        <div className="h-4 w-32 bg-gray-700 rounded" />
                      </td>
                      {/* Symbol */}
                      <td className="py-4 px-3">
                        <div className="h-6 w-20 bg-gray-700 rounded-md" />
                      </td>
                      {/* Price */}
                      <td className="py-4 px-3 text-right">
                        <div className="h-4 w-24 bg-gray-700 rounded ml-auto" />
                      </td>
                      {/* 24h Change */}
                      <td className="py-4 px-3 text-center">
                        <div className="h-6 w-[70px] bg-gray-700 rounded-lg mx-auto" />
                      </td>
                      {/* Volume */}
                      <td className="py-4 px-3 text-right">
                        <div className="h-6 w-24 bg-gray-700 rounded-md ml-auto" />
                      </td>
                      {/* Market Cap */}
                      <td className="py-4 px-3 text-right">
                        <div className="h-6 w-24 bg-gray-700 rounded-md ml-auto" />
                      </td>
                    </tr>
                  ))
                : display.map((coin, idx) => {
                    const u = coin.quote?.USD || {};
                    const change =
                      typeof u.percent_change_24h === "number"
                        ? u.percent_change_24h
                        : null;
                    return (
                      <tr
                        key={coin.id || coin.symbol || idx}
                        className="group hover:bg-white/5 transition-colors text-white" // White text for rows
                        style={{ height: 64 }}
                      >
                        {/* # and Icon */}
                        <td className="py-3 px-3">
                          <div className="flex items-center">
                            <span className="text-gray-500 text-xs font-medium w-8 tabular-nums text-right mr-2">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            {/* Darker icon bg */}
                            <div className="w-8 h-8 rounded-full bg-[#2c3040] overflow-hidden flex items-center justify-center border border-white/10">
                              <img
                                src={`https://assets.coincap.io/assets/icons/${coin.symbol?.toLowerCase()}@2x.png`}
                                onError={(e) => { e.currentTarget.style.opacity = "0"; e.currentTarget.parentElement.style.backgroundColor = 'transparent';}} // Hide broken image + bg
                                alt={coin.symbol}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </div>
                        </td>

                        {/* Name and Rank */}
                        <td className="py-3 px-3">
                           <div className="flex items-center gap-2">
                             <span className="font-semibold text-gray-100"> {/* Brighter text */}
                               {coin.name || "--"}
                             </span>
                             {/* Polished Rank Badge */}
                             <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-700 text-gray-300 ring-1 ring-gray-600">
                               #{coin.cmc_rank || idx + 1}
                             </span>
                           </div>
                         </td>

                        {/* Symbol */}
                        <td className="py-3 px-3">
                          {/* Polished Symbol Badge */}
                          <span className="font-mono text-gray-300 bg-[#2c3040] ring-1 ring-gray-700 px-2 py-1 rounded-md inline-block w-20 text-center">
                            {coin.symbol}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-3 text-right font-semibold tabular-nums text-gray-100"> {/* Brighter text */}
                           {typeof u.price === "number"
                             ? "$" +
                               u.price.toLocaleString(undefined, {
                                 maximumFractionDigits: u.price < 0.01 ? 6 : 2, // More digits for small prices
                                 minimumFractionDigits: 2,
                               })
                             : "--"}
                         </td>

                        {/* 24h Change */}
                        <td className="py-3 px-3 text-center"> {/* Centered */}
                           {change === null ? (
                             <span className="text-gray-500">--</span>
                           ) : (
                             // Polished % Badge (using updated pctClass logic)
                             <span
                               className={`inline-flex items-center justify-center min-w-[70px] px-2 py-1 rounded-lg text-sm font-semibold ${
                                 change > 0 ? 'bg-green-500/10 text-green-400 ring-green-500/20' // Darker theme colors
                                 : change < 0 ? 'bg-red-500/10 text-red-400 ring-red-500/20' // Darker theme colors
                                 : 'bg-gray-500/10 text-gray-400 ring-gray-500/20' // Darker theme colors
                               } ring-1`}
                             >
                               {change > 0 ? "+" : ""}
                               {change.toFixed(2)}%
                             </span>
                           )}
                         </td>

                        {/* Volume */}
                        <td className="py-3 px-3 text-right tabular-nums text-gray-300"> {/* Adjusted text color */}
                          {/* Polished Volume Badge */}
                          <span className="inline-block px-2 py-1 rounded-md bg-[#2c3040] ring-1 ring-gray-700">
                            {u.volume_24h ? formatBigNum(u.volume_24h) : "--"}
                          </span>
                        </td>

                        {/* Market Cap */}
                        <td className="py-3 px-3 text-right tabular-nums text-gray-300"> {/* Adjusted text color */}
                          {/* Polished Market Cap Badge */}
                          <span className="inline-block px-2 py-1 rounded-md bg-[#2c3040] ring-1 ring-gray-700">
                            {u.market_cap ? formatBigNum(u.market_cap) : "--"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        </Card> {/* This closes the main card that wraps stats and table */}

        {/* ---- ✨ Polished News Ticker ---- */}
        <Card className="p-0 rounded-2xl shadow-lg bg-gradient-to-br from-[#141a2b] via-[#0f1424] to-[#0b1020] border border-[#1a2343]">
          <div className="px-3 md:px-4 py-4">
            {/* Assuming NewsTicker component uses appropriate text colors or inherits */}
            <NewsTicker
              news={
                newsHeadlines.length
                  ? newsHeadlines
                  : ["Loading latest crypto headlines..."]
              }
            />
          </div>
        </Card>
      </div> {/* Closes z-index wrapper */}

      {/* ===== Promotion Video Card (Keep dark theme) ===== */}
     {showPromotion && (
       <div
         className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
         style={{
           background: "linear-gradient(120deg, #0b1020f0 0%, #0d1220d8 60%, #0a101dd1 100%)", // Dark gradient
         }}
       >
         <div className="relative">
           <button
             onClick={handleClosePromotion}
             className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors flex items-center justify-center"
             aria-label="Close promotion"
           >
             {/* Simple 'X' icon */}
             <svg
               xmlns="http://www.w3.org/2000/svg"
               width="18"
               height="18"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               strokeWidth="2.5"
               strokeLinecap="round"
               strokeLinejoin="round"
             >
               <line x1="18" y1="6" x2="6" y2="18"></line>
               <line x1="6" y1="6" x2="18" y2="18"></line>
             </svg>
           </button>
           <video
             src="/promotion.mp4"
             autoPlay
             loop
             muted
             playsInline // Important for mobile browsers
             className="w-full h-auto"
           />
         </div>
       </div>
     )}
    </div> // Closes main page div
  );
}
