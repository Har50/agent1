'use client';

import { motion } from 'framer-motion';

export function HeroVisual() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="rail-grid absolute inset-0" />
      <motion.div
        className="absolute -right-[10%] top-[8%] h-[70vh] w-[70vw] max-w-4xl animate-drift"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1 }}
      >
        <svg viewBox="0 0 800 600" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id="pipe" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0e9aa7" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#14c4d4" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#e8a54b" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <path
            d="M80 120 C220 80, 280 220, 400 200 S580 120, 720 180"
            stroke="url(#pipe)"
            strokeWidth="3"
            className="animate-rail-pulse"
          />
          <path
            d="M60 320 C200 280, 300 400, 420 360 S620 300, 760 340"
            stroke="url(#pipe)"
            strokeWidth="2"
            opacity="0.7"
          />
          <path
            d="M100 480 C240 440, 320 520, 460 500 S640 420, 740 470"
            stroke="url(#pipe)"
            strokeWidth="1.5"
            opacity="0.45"
          />
          {[
            [180, 140],
            [400, 200],
            [620, 170],
            [300, 360],
            [560, 340],
          ].map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="7"
              fill="#0e9aa7"
              fillOpacity="0.85"
            />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}
