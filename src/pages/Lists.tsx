import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ListPlus } from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { useLists } from "../context/ListsContext";
import { getStock } from "../data/stocks";
import { StockRow } from "../components/StockRow";
import { CreateListSheet } from "../components/CreateListSheet";

export function Lists() {
  const { watchlist } = usePortfolio();
  const { lists } = useLists();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  return (
    <div className="pb-8">
      <div className="px-4 pt-5 lg:px-6">
        <h1 className="text-2xl font-semibold text-ink">{t("lists.title")}</h1>
        <p className="mt-1 text-sm text-ink-faint">{t("lists.subtitle")}</p>
      </div>

      <section className="mt-4">
        <div className="flex items-center justify-between px-4 pb-1 lg:px-6">
          <h2 className="text-[15px] font-semibold text-ink">{t("lists.yourListsHeading")}</h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
          >
            <ListPlus size={15} /> {t("lists.newList")}
          </button>
        </div>
        {lists.length === 0 ? (
          <p className="px-4 py-2 text-[13px] text-ink-faint lg:px-6">{t("lists.yourListsEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2 px-4 lg:px-6">
            {lists.map((list) => (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-3 hover:bg-surface-3"
              >
                <div className="text-[14px] font-medium text-ink">{list.name}</div>
                <div className="text-[12px] text-ink-faint">
                  {list.symbols.length === 1
                    ? t("lists.itemCountOne", { count: list.symbols.length })
                    : t("lists.itemCountOther", { count: list.symbols.length })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="px-4 pb-1 text-[15px] font-semibold text-ink lg:px-6">{t("lists.watchlistHeading")}</h2>
        <div className="mt-1 px-2 lg:px-4">
          {watchlist.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-faint">
              {t("lists.emptyText")}{" "}
              <Link to="/search" className="font-medium text-up">
                {t("lists.emptyCta")}
              </Link>
              .
            </div>
          )}
          {watchlist.map((symbol) => {
            const stock = getStock(symbol);
            if (!stock) return null;
            return <StockRow key={symbol} stock={stock} subtitle={stock.name} />;
          })}
        </div>
      </section>

      <AnimatePresence>
        {creating && (
          <CreateListSheet onClose={() => setCreating(false)} onCreated={(id) => navigate(`/lists/${id}`)} />
        )}
      </AnimatePresence>
    </div>
  );
}
