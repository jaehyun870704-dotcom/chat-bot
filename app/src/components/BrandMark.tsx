// 좋은인재연구소 심볼.
//
// 원본 로고는 '세 사람 위로 뻗는 상승 화살표' 형태다. 형태를 바꾸지 않고 그대로 옮겼다.
// 래스터 이미지를 쓰면 작은 크기에서 뭉개지고 색을 바꿀 수 없어 벡터로 다시 그렸다.
//
// 색은 currentColor 를 따른다. 노란 배경 위 검정, 검정 배경 위 흰색 모두 부모가 정한다.
// 원본 벡터 파일(AI/SVG)을 받으면 아래 <svg> 안쪽만 교체하면 되고 호출부는 그대로 둔다.

// 사람 세 명의 가로 위치. 가운데를 기준으로 좌우 대칭이다.
const PEOPLE = [
  { cx: 9.5, headR: 2.5, bodyW: 7.4 },
  { cx: 20, headR: 2.7, bodyW: 8.0 },
  { cx: 30.5, headR: 2.5, bodyW: 7.4 },
];

const BASE_Y = 37; // 사람들이 서 있는 바닥선
const HEAD_Y = 25.5;

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
      viewBox="0 0 40 40"
      fill="none"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* 상승 화살표 — 사람들 위로 오른쪽 위를 향해 뻗는다. */}
        <path d="M4 20.5 L12.5 13.5 L19.5 17 L31 5.5" />
        {/* 화살촉 */}
        <path d="M24.6 5.5 L31.5 5 L31 11.9" />
      </g>

      {/* 사람 셋 — 머리(원)와 어깨(아치). */}
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" fill="none">
        {PEOPLE.map((p, i) => {
          const half = p.bodyW / 2;
          const shoulderY = BASE_Y - 4.6;
          return (
            <g key={i}>
              <circle cx={p.cx} cy={HEAD_Y} r={p.headR} />
              <path
                d={`M${p.cx - half} ${BASE_Y} V${shoulderY} A${half} ${half} 0 0 1 ${p.cx + half} ${shoulderY} V${BASE_Y}`}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** 심볼 + 워드마크. 헤더·사이드바처럼 이름이 함께 나와야 하는 자리에 쓴다. */
export function BrandLockup({
  size = 32,
  className = '',
  subtitle,
}: {
  size?: number;
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <BrandMark size={size} className="text-on-surface" title="좋은인재연구소" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-label-md font-bold tracking-tight text-on-surface">
          좋은인재연구소
        </span>
        {subtitle && (
          <span className="truncate text-caption text-on-surface-variant">{subtitle}</span>
        )}
      </span>
    </span>
  );
}

/** 대화 말풍선 옆 아바타. 카카오톡처럼 노란 원 위에 검은 심볼을 올린다. */
export function BrandAvatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <BrandMark size={Math.round(size * 0.7)} />
    </span>
  );
}
