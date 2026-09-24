import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Scale, Plus, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { AddToListSheet } from "../components/AddToListSheet";
import { ComparePickerSheet } from "../components/ComparePickerSheet";
import { StockLogo } from "../components/StockLogo";
import { useLocale } from "../context/LocaleContext";
import { useLists } from "../context/ListsContext";
import { getStock } from "../data/stocks";

export function ListDetailPage() {
  const { id = "" } = useParams();
  const { lists, deleteList, removeSymbol, setNote } = useLists();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const list = lists.find((l) => l.id === id);
  if (!list) return <Navigate to="/lists" replace />;

  return (
    <div className="pb-10">
      <PageHeader
        title={list.name}
        back
        right={
          list.symbols.length >= 2 ? (
            <button
              onClick={() => setComparing(true)}
              className="flex items-center gap-1 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
            >
              <Scale size={15} /> {t("lists.compare")}
            </button>
          ) : undefined
        }
      />

      <div className="mt-2 flex flex-col divide-y divide-border-soft px-4 lg:px-6">
        {list.symbols.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-ink-faint">{t("lists.listEmpty")}</p>
        )}
        {list.symbols.map((symbol) => (
          <ListItemRow
            key={symbol}
            symbol={symbol}
            note={list.notes[symbol] ?? ""}
            onRemove={() => removeSymbol(list.id, symbol)}
            onNoteChange={(note) => setNote(list.id, symbol, note)}
          />
        ))}
      </div>

      <div className="mt-4 px-4 lg:px-6">
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border py-2.5 text-[13px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
        >
          <Plus size={15} /> {t("lists.addInvestment")}
        </button>
      </div>

      <div className="mt-6 px-4 lg:px-6">
        <button
          onClick={() => setDeleting(true)}
          className="w-full rounded-full py-3 text-[13px] font-semibold text-down hover:bg-down-soft cursor-pointer"
        >
          {t("lists.deleteList")}
        </button>
      </div>

      <AnimatePresence>{adding && <AddToListSheet list={list} onClose={() => setAdding(false)} />}</AnimatePresence>
      <AnimatePresence>
        {comparing && <ComparePickerSheet list={list} onClose={() => setComparing(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {deleting && (
          <ConfirmSheet
            title={t("lists.deleteListConfirmTitle")}
            description={t("lists.deleteListConfirmDesc", { name: list.name })}
            confirmLabel={t("lists.deleteListConfirmBtn")}
            danger
            onConfirm={() => {
              deleteList(list.id);
              navigate("/lists");
            }}
            onClose={() => setDeleting(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface ListItemRowProps {
  symbol: string;
  note: string;
  onRemove: () => void;
  onNoteChange: (note: string) => void;
}

function ListItemRow({ symbol, note, onRemove, onNoteChange }: ListItemRowProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(note);
  const stock = getStock(symbol);
  if (!stock) return null;

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <Link to={`/stock/${symbol}`} className="flex min-w-0 flex-1 items-center gap-3">
          <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={36} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium text-ink">{stock.symbol}</div>
            <div className="truncate text-[12px] text-ink-faint">{stock.name}</div>
          </div>
        </Link>
        <button
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-down cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onNoteChange(draft)}
        placeholder={t("lists.notePlaceholder")}
        maxLength={140}
        className="w-full rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />
    </div>
  );
}
