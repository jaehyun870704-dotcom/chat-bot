'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { ConversationList, type Conversation } from './ConversationList';

// 데스크톱은 고정 사이드바, 모바일은 목업의 상단 앱바 + 서랍(drawer).

export function ChatShell({
  conversations,
  email,
  usageLabel,
  modeLabel,
  createConversation,
  signOut,
  children,
}: {
  conversations: Conversation[];
  email: string;
  usageLabel: string;
  modeLabel: string;
  createConversation: () => Promise<void>;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 대화를 고르면 서랍을 닫는다.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // 바깥을 누르면 메뉴를 닫는다.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const sidebar = (
    <>
      <div className="flex items-center gap-space-sm border-b border-outline-variant/40 px-space-lg py-space-md">
        <BrandMark size={30} className="text-primary" title="좋은인재연구소" />
        <div className="flex min-w-0 flex-col">
          <Link
            href="/"
            className="truncate text-label-md font-semibold tracking-tight text-on-surface"
          >
            좋은인재연구소
          </Link>
          <span className="truncate text-caption text-on-surface-variant">인사 실무 자료 검색</span>
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
        <div className="mt-1 flex items-center gap-1">
          <Link
            href="/account"
            className="flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-caption text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="account_circle" size={16} />
            마이페이지
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-caption text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <Icon name="logout" size={16} />
              로그아웃
            </button>
          </form>
        </div>
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
        {/* 모바일 앱바 — 목업 구조 그대로 */}
        <header className="pt-safe z-40 shrink-0 bg-surface/85 shadow-header backdrop-blur-xl md:hidden">
          <div className="flex h-16 items-center justify-between gap-space-sm px-margin">
            <div className="flex min-w-0 items-center gap-space-xs">
              <button
                aria-label="대화 목록"
                onClick={() => setDrawerOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container"
              >
                <Icon name="menu" />
              </button>

              <BrandMark size={30} className="text-primary" title="좋은인재연구소" />

              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="truncate text-headline-sm tracking-tight text-on-surface">좋은인재연구소</span>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <p className="truncate text-caption text-on-surface-variant">인사 실무 자료 검색</p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-container-high px-1.5 py-0.5 text-caption font-medium text-on-primary-fixed">
                    <Icon name="bolt" size={12} />
                    {modeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-space-xs" ref={menuRef}>
              <button
                aria-label="더보기"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <Icon name="more_vert" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 z-50 flex w-44 flex-col overflow-hidden rounded-xl bg-surface-container-lowest py-1 shadow-md">
                  <form action={createConversation}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label-md text-on-surface transition-colors hover:bg-surface-container"
                    >
                      <Icon name="add_comment" size={18} className="text-on-surface-variant" />새
                      대화
                    </button>
                  </form>
                  <Link
                    href="/account"
                    className="flex items-center gap-2 px-3 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <Icon name="account_circle" size={18} className="text-on-surface-variant" />
                    마이페이지
                  </Link>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label-md text-on-surface transition-colors hover:bg-surface-container"
                    >
                      <Icon name="logout" size={18} className="text-on-surface-variant" />
                      로그아웃
                    </button>
                  </form>
                </div>
              )}

              <Link
                href="/account"
                aria-label="마이페이지"
                className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-90"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-label-sm font-semibold text-on-primary-fixed">
                  {email.slice(0, 1).toUpperCase() || '?'}
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
