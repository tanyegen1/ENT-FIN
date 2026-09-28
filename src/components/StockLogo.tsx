import type { ComponentType } from "react";
import {
  SiApple,
  SiTesla,
  SiNvidia,
  SiCoinbase,
  SiBitcoin,
  SiMeta,
  SiGoogle,
  SiNetflix,
  SiAmd,
  SiVisa,
  SiBoeing,
  SiPalantir,
  SiChase,
} from "@icons-pack/react-simple-icons";
import { FaAmazon, FaMicrosoft } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { initials } from "../lib/format";

interface BrandIconProps {
  size?: string | number;
  color?: string;
  title?: string;
}

// simple-icons ships each brand's own official color and renders it with
// color="default" — the preferred source for every mark it still carries.
const BRAND_ICONS: Record<string, ComponentType<BrandIconProps>> = {
  AAPL: SiApple,
  TSLA: SiTesla,
  NVDA: SiNvidia,
  COIN: SiCoinbase,
  BTC: SiBitcoin,
  META: SiMeta,
  GOOGL: SiGoogle,
  NFLX: SiNetflix,
  AMD: SiAmd,
  V: SiVisa,
  BA: SiBoeing,
  PLTR: SiPalantir,
  // JPM's ticker is JPMorgan Chase & Co.; Chase is its own retail brand and
  // the far more recognizable mark, and simple-icons has no separate
  // "JPMorgan" logo — this is the same company, not a substitution.
  JPM: SiChase,
};

// simple-icons dropped Amazon and Microsoft's marks over trademark takedown
// requests; Font Awesome's brand set still carries both. It has no official
// per-brand color like simple-icons does, so these render in the stock's
// own brand color (Stock.color) via currentColor instead of color="default".
const FA_BRAND_ICONS: Record<string, IconType> = {
  AMZN: FaAmazon,
  MSFT: FaMicrosoft,
};

// No freely-licensed vector mark exists for these in simple-icons, Font
// Awesome, or Iconify's 2,200-icon "logos" set at the time this was
// checked — Disney over trademark enforcement, SoFi/Rivian as smaller or
// newer public companies not yet covered, and SPY/QQQ because they're fund
// tickers (State Street/SPDR, Invesco) rather than a single brand mark.
// They fall back to the initials badge below like any future symbol would.

interface StockLogoProps {
  symbol: string;
  name: string;
  fallbackColor: string;
  size?: number;
}

export function StockLogo({ symbol, name, fallbackColor, size = 40 }: StockLogoProps) {
  const Icon = BRAND_ICONS[symbol];
  const FaIcon = FA_BRAND_ICONS[symbol];

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

  if (FaIcon) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-white"
        style={{ width: size, height: size, color: fallbackColor }}
      >
        <FaIcon size={Math.round(size * 0.56)} title={name} />
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
