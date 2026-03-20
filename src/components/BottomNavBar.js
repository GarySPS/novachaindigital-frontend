// src/components/BottomNavBar.js

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './icon'; // Using your existing Icon component

// --- Visual Constants ---
const BAR_HEIGHT = 58;
const NOTCH_RADIUS = 28;
const CHIP_DIAMETER = 48;
const BAR_CORNER_RADIUS = 20;

const NAV_ITEMS = [
  { label: 'dashboard', to: '/', icon: 'home', match: (p) => p === '/' },
  { label: 'trade', to: '/trade', icon: 'chart', match: (p) => p === '/trade' }, // Crypto trade
  //{ label: 'Forex', to: '/forex', icon: 'chart-bar', match: (p) => p === '/forex' },
  { label: 'history', to: '/trade-history', icon: 'history', match: (p) => p.startsWith('/trade-history') },
  { label: 'wallet', to: '/wallet', icon: 'wallet', match: (p) => p.startsWith('/wallet') },
  { label: 'profile', to: '/profile', icon: 'user', match: (p) => p.startsWith('/profile') }, // Now 6 items
];

export default function BottomNavBar() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const activeIndex = Math.max(0, NAV_ITEMS.findIndex((item) => item.match(pathname)));

  const navRef = useRef(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(() => setWidth(el.clientWidth || 360));
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const notchCenterX = useMemo(() => {
    const segmentWidth = width / NAV_ITEMS.length;
    return segmentWidth * activeIndex + segmentWidth / 2;
  }, [width, activeIndex]);

  const activeItem = NAV_ITEMS[activeIndex];

  return (
    <nav
      ref={navRef}
      className="md:hidden fixed left-1/2 z-40 -translate-x-1/2 w-[94%] max-w-md"
      style={{ bottom: `env(safe-area-inset-bottom, 0px)` }}
    >
      <div className="relative select-none">
        {/* SVG for the morphing bar shape */}
        <svg
          width="100%"
          height={BAR_HEIGHT + NOTCH_RADIUS}
          viewBox={`0 0 ${width} ${BAR_HEIGHT + NOTCH_RADIUS}`}
          className="drop-shadow-2xl"
        >
          <defs>
            <mask id="notch-mask">
              <rect x="0" y={NOTCH_RADIUS} width={width} height={BAR_HEIGHT} rx={BAR_CORNER_RADIUS} ry={BAR_CORNER_RADIUS} fill="white" />
              <g style={{ transition: "transform 280ms ease-in-out" }} transform={`translate(${notchCenterX}, 0)`}>
                <circle cx="0" cy={NOTCH_RADIUS + 6} r={NOTCH_RADIUS} fill="black" />
              </g>
            </mask>
          </defs>

          {/* The visible bar element with a SOLID fill color */}
          <rect
            x="0"
            y={NOTCH_RADIUS}
            width={width}
            height={BAR_HEIGHT}
            rx={BAR_CORNER_RADIUS}
            ry={BAR_CORNER_RADIUS}
            // Replace #1A1A2E with your theme's background color (e.g., the color for 'bg-theme-on-surface-1')
            fill="#1A1A2E"
            mask="url(#notch-mask)"
          />
        </svg>

        {/* Active Item Chip is a functional <Link> */}
        <Link
          to={activeItem?.to || '/'}
          aria-label={t(activeItem?.label || '')}
          className="absolute will-change-transform"
          style={{
            left: notchCenterX - CHIP_DIAMETER / 2,
            top: NOTCH_RADIUS + 6 - CHIP_DIAMETER / 2,
            width: CHIP_DIAMETER,
            height: CHIP_DIAMETER,
            transition: "left 280ms ease-in-out",
          }}
        >
          <div className="w-full h-full rounded-full flex items-center justify-center bg-theme-brand shadow-lg">
            <ActiveIconComponent index={activeIndex} />
          </div>
        </Link>

        {/* Row of Inactive Icons */}
        <div className="absolute inset-x-0" style={{ top: NOTCH_RADIUS, height: BAR_HEIGHT }}>
          <div className="flex h-full">
            {NAV_ITEMS.map(({ to, label }, i) => {
              const isActive = i === activeIndex;
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label={t(label)}
                  className="relative flex-1 flex items-center justify-center h-full"
                >
                  <Icon
                    name={NAV_ITEMS[i].icon}
                    className={`h-6 w-6 transition-opacity duration-200 ${
                      isActive ? "opacity-0" : "opacity-100 fill-theme-secondary hover:fill-theme-primary"
                    }`}
                  />
                  <span className="sr-only">{t(label)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

// Helper component to render the correct icon inside the active chip
function ActiveIconComponent({ index }) {
  const activeIconName = NAV_ITEMS[index]?.icon || 'home';
  return <Icon name={activeIconName} className="h-6 w-6 text-white fill-white" />;
}