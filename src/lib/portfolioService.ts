import { supabase } from "./supabaseClient";
import type { Holding, OrderRecord, TransferRecord } from "../types";

export interface RemotePortfolioState {
  cash: number;
  holdings: Holding[];
  watchlist: string[];
  orders: OrderRecord[];
  transfers: TransferRecord[];
}

interface PortfolioRow {
  cash: number;
  holdings: Holding[] | null;
  watchlist: string[] | null;
  orders: OrderRecord[] | null;
  transfers: TransferRecord[] | null;
}

export async function fetchPortfolio(userId: string): Promise<RemotePortfolioState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("portfolios")
    .select("cash, holdings, watchlist, orders, transfers")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as PortfolioRow;
  return {
    cash: row.cash,
    holdings: row.holdings ?? [],
    watchlist: row.watchlist ?? [],
    orders: row.orders ?? [],
    transfers: row.transfers ?? [],
  };
}

export async function createPortfolio(userId: string, state: RemotePortfolioState): Promise<void> {
  if (!supabase) return;
  await supabase.from("portfolios").insert({ user_id: userId, ...state });
}

export async function savePortfolio(userId: string, state: RemotePortfolioState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("portfolios")
    .upsert({ user_id: userId, ...state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
