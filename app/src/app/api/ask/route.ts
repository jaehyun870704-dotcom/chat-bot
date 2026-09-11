import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runPipeline } from '@/lib/answer/pipeline';

// @huggingface/transformers 는 Node 런타임에서만 동작한다(PRD §4: Edge 불가).
export const runtime = 'nodejs';

// 벡터 인덱스가 없어 검색만 평균 17.7초다. 기본 타임아웃으로는 끊긴다.
export const maxDuration = 120;

const MAX_QUESTION_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let payload: {
    conversationId?: unknown;
    question?: unknown;
    replaceMessageId?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : '';
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  const replaceMessageId =
    typeof payload.replaceMessageId === 'string' ? payload.replaceMessageId : null;

  if (!conversationId || !question) {
    return NextResponse.json({ error: '질문을 입력해 주세요.' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 }
    );
  }

  // 소유권 확인은 사용자 세션 클라이언트로 한다. RLS 가 남의 대화를 걸러낸다.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: '대화를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 다시 생성: 기존 답변을 지우고 같은 질문을 재실행한다.
  // 삭제도 사용자 세션으로 수행하므로 RLS 가 소유권을 강제한다 —
  // 남의 메시지 id 를 보내도 지워지지 않는다.
  if (replaceMessageId) {
    const { data: removed } = await supabase
      .from('messages')
      .delete()
      .eq('id', replaceMessageId)
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .select('id');

    if (!removed || removed.length === 0) {
      return NextResponse.json({ error: '다시 생성할 답변을 찾을 수 없습니다.' }, { status: 404 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline({
          userId: user.id,
          conversationId,
          question,
          skipUserMessage: Boolean(replaceMessageId),
        })) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (err) {
        // 내부 오류 내용을 사용자에게 노출하지 않는다(PRD §9.2).
        console.error('[api/ask]', err);
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: 'error', message: '답변을 생성하지 못했습니다.' })}\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
