'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { deleteConversation, renameConversation } from '@/app/chat/actions';

type Conversation = { id: string; title: string; updated_at: string };

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const params = useParams<{ id?: string }>();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <p className="flex-1 px-3 py-2 text-xs text-neutral-500">
        아직 대화가 없습니다. 새 대화를 시작해 보세요.
      </p>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2">
      <ul className="space-y-0.5">
        {conversations.map((c) => {
          const active = params?.id === c.id;
          return (
            <li key={c.id} className="group relative">
              {editingId === c.id ? (
                <form
                  action={async (formData) => {
                    await renameConversation(formData);
                    setEditingId(null);
                  }}
                  className="px-1 py-1"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="title"
                    defaultValue={c.title}
                    autoFocus
                    maxLength={60}
                    onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                    className="w-full rounded border border-brand-accent px-2 py-1 text-sm outline-none"
                  />
                </form>
              ) : (
                <div
                  className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                    active ? 'bg-neutral-200' : 'hover:bg-neutral-100'
                  }`}
                >
                  <Link href={`/chat/${c.id}`} className="min-w-0 flex-1 truncate">
                    {c.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditingId(c.id)}
                    aria-label={`${c.title} 이름 변경`}
                    className="hidden text-xs text-neutral-500 hover:text-brand group-hover:block"
                  >
                    수정
                  </button>
                  <form action={deleteConversation} className="hidden group-hover:block">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      aria-label={`${c.title} 삭제`}
                      className="text-xs text-neutral-500 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
