// 로고 자리. PRD §9.4 로고 파일(투명/흰배경/정사각 3종)을 받으면
// 이 컴포넌트의 내용만 <Image> 로 교체하면 된다. 호출부는 바꿀 필요가 없다.

export function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-on-primary ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="font-bold leading-none"
        style={{ fontSize: Math.round(size * 0.42) }}
      >
        노
      </span>
    </span>
  );
}
