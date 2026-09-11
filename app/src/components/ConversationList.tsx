'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { deleteConversation, renameConversation } from '@/app/chat/actions';
import { Icon } from './Icon';

export type Conversation = { id: string; title: string; updated_at: string };

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const params = useParams<{ id?: string }>();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-space-lg text-center">
        <Icon name="forum" size={28} className="text-outline-variant" />
        <p className="text-caption leading-relaxed text-on-surface-variant">
          아직 대화가 없습니다.
          <br />새 대화를 시작해 보세요.
        </p>
      </div>
    );
  }

  return (
    <nav className="no-scrollbar flex-1 overflow-y-auto px-space-sm">
      <ul className="flex flex-col gap-0.5 pb-2">
        {conversations.map((c) => {
          const active = params?.id === c.id;

          if (editingId === c.id) {
            return (
              <li key={c.id} className="px-1 py-1">
                <form
                  action={async (formData) => {
                    await renameConversation(formData);
                    setEditingId(null);
                  }}
                >
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="title"
                    defaultValue={c.title}
                    autoFocus
                    maxLength={60}
                    onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                    className="w-full rounded-lg border border-primary bg-surface-container-lowest px-2.5 py-1.5 text-label-md outline-none"
                  />
                </form>
              </li>
            );
          }

          return (
            <li key={c.id} className="group/item relative">
              <div
                className={`flex items-center gap-1 rounded-lg pl-3 pr-1 transition-colors ${
                  active
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Link
                  href={`/chat/${c.id}`}
                  className="min-w-0 flex-1 truncate py-2.5 text-label-md"
                >
                  {c.title}
                </Link>

                <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100">
                  <button
                    type="button"
                    onClick={() => setEditingId(c.id)}
                    aria-label={`${c.title} 이름 변경`}
                    className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <form action={deleteConversation}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      aria-label={`${c.title} 삭제`}
                      className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                    >
                      <Icon name="delete" size={15} />
                    </button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
