'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { ConversationList, type Conversation } from './ConversationList';

// 데스크톱은 고정 사이드바, 모바일은 상단 앱바 + 서랍(drawer).
// 목업이 모바일 기준이라 좁은 화면에서 그 형태가 그대로 나오게 했다.

export function ChatShell({
  conversations,
  email,
  usageLabel,
  createConversation,
  children,
}: {
  conversations: Conversation[];
  email: string;
  usageLabel: string;
  createConversation: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // 대화를 고르면 서랍을 닫는다.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const sidebar = (
    <>
      <div className="flex items-center gap-space-sm border-b border-outline-variant/40 px-space-lg py-space-md">
        <BrandMark size={32} />
        <div className="flex min-w-0 flex-col">
          <Link href="/" className="truncate text-label-md font-semibold text-on-surface">
            좋은인재연구소
          </Link>
          <span className="truncate text-caption text-on-surface-variant">노동법·HR 자료 검색</span>
        </div>
      </div>

      <div className="p-space-md">
        <form action={createConversation}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-space-lg py-2.5 text-label-md font-medium text-on-primary shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
          >
            <Icon name="add" size={18} />
            새 대화
          </button>
        </form>
      </div>

      <ConversationList conversations={conversations} />

      <div className="flex flex-col gap-1.5 border-t border-outline-variant/40 p-space-md">
        <p className="truncate text-label-sm text-on-surface">{email}</p>
        <p className="text-caption text-on-surface-variant">{usageLabel}</p>
        <Link
          href="/account"
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-caption text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Icon name="account_circle" size={16} />
          마이페이지
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-outline-variant/40 bg-surface-container-low md:flex">
        {sidebar}
      </aside>

      {/* 모바일 서랍 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="메뉴 닫기"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
          />
          <aside className="pt-safe absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-surface-container-low shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 모바일 앱바 */}
        <header className="pt-safe z-40 shrink-0 border-b border-outline-variant/40 bg-surface/85 backdrop-blur-xl md:hidden">
          <div className="flex h-14 items-center justify-between gap-space-sm px-space-sm">
            <button
              aria-label="대화 목록"
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="menu" />
            </button>

            <div className="flex min-w-0 items-center gap-1.5">
              <BrandMark size={24} />
              <span className="truncate text-label-md font-semibold text-on-surface">
                좋은인재연구소
              </span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            </div>

            <Link
              href="/account"
              aria-label="마이페이지"
              className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <Icon name="account_circle" />
            </Link>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
