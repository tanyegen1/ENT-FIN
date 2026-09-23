import { motion } from "motion/react";
import { Check } from "lucide-react";

export function SuccessBurst({ size = 64 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {[0, 0.15].map((delay) => (
        <motion.span
          key={delay}
          className="absolute inset-0 rounded-full bg-up-soft"
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay }}
        />
      ))}
      <motion.div
        className="relative flex items-center justify-center rounded-full bg-up-soft"
        style={{ width: size, height: size }}
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
      >
        <Check size={size * 0.5} className="text-up" strokeWidth={2.5} />
      </motion.div>
    </div>
  );
}
