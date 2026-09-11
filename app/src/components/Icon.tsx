type Props = {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
};

/** Material Symbols 글리프. 아이콘은 의미가 아니라 장식이므로 스크린리더에서 숨긴다. */
export function Icon({ name, className = '', filled = false, size }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size ? `${size}px` : undefined,
        fontVariationSettings: filled ? "'FILL' 1" : undefined,
      }}
    >
      {name}
    </span>
  );
}
