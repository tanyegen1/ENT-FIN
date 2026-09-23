import type { ComponentType } from "react";
import { SiApple, SiTesla, SiNvidia, SiCoinbase, SiBitcoin } from "@icons-pack/react-simple-icons";
import { initials } from "../lib/format";

interface BrandIconProps {
  size?: string | number;
  color?: string;
  title?: string;
}

// Real brand marks are only wired up for our five most-held tickers —
// simple-icons dropped Amazon/Microsoft over trademark takedowns, so
// every other symbol still falls back to the initials badge below.
const BRAND_ICONS: Record<string, ComponentType<BrandIconProps>> = {
  AAPL: SiApple,
  TSLA: SiTesla,
  NVDA: SiNvidia,
  COIN: SiCoinbase,
  BTC: SiBitcoin,
};

interface StockLogoProps {
  symbol: string;
  name: string;
  fallbackColor: string;
  size?: number;
}

export function StockLogo({ symbol, name, fallbackColor, size = 40 }: StockLogoProps) {
  const Icon = BRAND_ICONS[symbol];

  if (Icon) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-white"
        style={{ width: size, height: size }}
      >
        <Icon size={Math.round(size * 0.56)} color="default" title={name} />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ width: size, height: size, backgroundColor: fallbackColor }}
    >
      {initials(symbol)}
    </div>
  );
}
