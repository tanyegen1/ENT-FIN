export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2 L22 12 L12 22 L2 12 Z"
        fill="var(--color-up)"
      />
      <path d="M12 7 L17 12 L12 17 L7 12 Z" fill="black" fillOpacity="0.85" />
    </svg>
  );
}
