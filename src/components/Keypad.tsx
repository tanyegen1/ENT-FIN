import { Delete } from "lucide-react";

interface KeypadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

export function Keypad({ onDigit, onDecimal, onBackspace }: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {KEYS.map((key) => (
        <button
          key={key}
          onClick={() => {
            if (key === "back") onBackspace();
            else if (key === ".") onDecimal();
            else onDigit(key);
          }}
          className="flex h-14 items-center justify-center rounded-xl text-2xl font-medium text-ink transition-colors hover:bg-surface-2 active:bg-surface-3 cursor-pointer"
        >
          {key === "back" ? <Delete size={24} /> : key}
        </button>
      ))}
    </div>
  );
}
