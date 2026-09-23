import arvoIcon from "../assets/arvo-icon.png";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <img
      src={arvoIcon}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
