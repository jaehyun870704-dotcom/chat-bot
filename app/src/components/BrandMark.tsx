// 좋은인재연구소 심볼.
//
// 전달받은 로고(연결된 점들로 이루어진 네트워크 형태)를 벡터로 다시 그렸다.
// 래스터 이미지를 쓰면 작은 크기에서 뭉개지고 색을 바꿀 수 없어서, 기하로 정의해
// 24px 파비콘부터 56px 히어로까지 같은 선명도를 유지하게 했다.
//
// 색은 currentColor 를 따른다. 흰 배경·컬러 배경 어디에 얹어도 부모가 정하면 된다.
// 실제 로고 파일(AI/SVG 원본)을 받으면 이 컴포넌트의 <svg> 내용만 교체하면 되고,
// 호출부는 바꿀 필요가 없다.

// 허브(가운데)와 다섯 갈래로 뻗은 노드. '사람과 사람이 이어지는' 형태를 단순화했다.
const HUB = { x: 12, y: 12 };
const NODES = [
  { x: 12, y: 3.4, r: 1.5 }, // 위
  { x: 4.4, y: 7.8, r: 1.3 }, // 좌상
  { x: 19.6, y: 7.8, r: 1.3 }, // 우상
  { x: 6.6, y: 19.2, r: 1.15 }, // 좌하
  { x: 17.4, y: 19.2, r: 1.15 }, // 우하
];

export function BrandMark({
  size = 32,
  className = '',
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* 연결선 — 허브에서 각 노드로. 선이 노드 원 안까지 들어가지 않도록 짧게 끊는다. */}
      <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.55">
        {NODES.map((n, i) => {
          const dx = n.x - HUB.x;
          const dy = n.y - HUB.y;
          const len = Math.hypot(dx, dy);
          const gapHub = 2.6; // 허브 원 반지름 + 여백
          const gapNode = n.r + 0.7;
          return (
            <line
              key={i}
              x1={HUB.x + (dx / len) * gapHub}
              y1={HUB.y + (dy / len) * gapHub}
              x2={n.x - (dx / len) * gapNode}
              y2={n.y - (dy / len) * gapNode}
            />
          );
        })}
      </g>

      {/* 바깥 노드 */}
      <g fill="currentColor">
        {NODES.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} />
        ))}
      </g>

      {/* 허브 — 링으로 비워 시선이 가운데 모이게 한다. */}
      <circle cx={HUB.x} cy={HUB.y} r="2.9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx={HUB.x} cy={HUB.y} r="0.95" fill="currentColor" />
    </svg>
  );
}

/** 심볼 + 워드마크. 헤더·사이드바처럼 이름이 함께 나와야 하는 자리에 쓴다. */
export function BrandLockup({
  size = 28,
  className = '',
  subtitle,
}: {
  size?: number;
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <BrandMark size={size} className="text-primary" title="좋은인재연구소" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-label-md font-semibold tracking-tight text-on-surface">
          좋은인재연구소
        </span>
        {subtitle && (
          <span className="truncate text-caption text-on-surface-variant">{subtitle}</span>
        )}
      </span>
    </span>
  );
}

/** 대화 말풍선 옆 아바타. 심볼을 원형 배경 위에 올린다. */
export function BrandAvatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-on-primary ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <BrandMark size={Math.round(size * 0.68)} />
    </span>
  );
}
