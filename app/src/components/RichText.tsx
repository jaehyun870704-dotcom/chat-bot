import { Fragment } from 'react';

// 본문에 쓰이는 표기는 두 가지뿐이다: **강조** 와 '- ' 목록.
// 마크다운 라이브러리를 들이지 않고 이 둘만 처리한다.
// 입력은 우리 코드가 만들었거나 sanitizeBody() 를 거친 문자열이고,
// 여기서는 React 가 이스케이프하므로 HTML 이 주입될 경로가 없다.

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-on-surface">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*-\s+/.test(l));

        if (isList) {
          return (
            <ul key={bi} className="flex flex-col gap-1.5 pl-0.5">
              {lines.map((line, li) => (
                <li key={li} className="flex gap-2 break-keep-ko">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-outline-variant" />
                  <span>{renderInline(line.replace(/^\s*-\s+/, ''), `${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi} className="break-keep-ko whitespace-pre-wrap">
            {renderInline(block, String(bi))}
          </p>
        );
      })}
    </div>
  );
}
