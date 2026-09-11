import 'server-only';

import path from 'node:path';
import { existsSync } from 'node:fs';

// PRD C-02: 질의 임베딩은 문서 임베딩과 반드시 같은 모델·차원·설정이어야 한다.
//
// 문서 적재(vector-pipeline)는 vectra 의 TransformersEmbeddings 를 썼고, 그 내부는
//   pipeline('feature-extraction', MODEL, { device: 'cpu', dtype: 'q8' })
//   extractor(inputs, { pooling: 'mean', normalize: true })
// 이다. 여기서는 vectra 를 의존하지 않고 같은 호출을 직접 재현한다.

export const MODEL = 'Xenova/multilingual-e5-small';
export const DIMENSIONS = 384;

// 문서는 'passage: ' 로 임베딩되어 있다(labor_chunks.embedding 컬럼 코멘트,
// vector-pipeline/src/embeddingClient.js:26). e5 계열은 프리픽스에 민감하므로
// 질의에는 반드시 'query: ' 를 붙인다. 이 한 줄이 검색 품질 전체를 좌우한다.
const QUERY_PREFIX = 'query: ';

type Extractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ dims: number[]; data: ArrayLike<number> }>;

let extractorPromise: Promise<Extractor> | null = null;

// 모델 캐시. 서버리스 콜드스타트마다 130MB 를 새로 받지 않도록 경로를 고정한다(PRD §4).
function resolveCacheDir(): string {
  if (process.env.MODEL_CACHE_DIR) return path.resolve(process.env.MODEL_CACHE_DIR);

  const repoRoot = path.resolve(process.cwd(), '..');
  const pipelineCache = path.join(
    repoRoot, 'vector-pipeline', 'node_modules', '@huggingface', 'transformers', '.cache'
  );
  if (existsSync(path.join(pipelineCache, 'Xenova', 'multilingual-e5-small'))) {
    return pipelineCache;
  }
  return path.join(repoRoot, '.model-cache');
}

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const transformers = await import('@huggingface/transformers');
      transformers.env.cacheDir = resolveCacheDir();

      const pipe = await transformers.pipeline('feature-extraction', MODEL, {
        device: 'cpu',
        dtype: 'q8',
      });
      return pipe as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

export async function embedQuery(text: string): Promise<number[]> {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) throw new Error('embedQuery: 비어 있지 않은 문자열이 필요합니다.');

  const extractor = await getExtractor();
  const output = await extractor([QUERY_PREFIX + trimmed], {
    pooling: 'mean',
    normalize: true,
  });

  const [batch, dim] = output.dims;
  if (batch !== 1 || dim !== DIMENSIONS) {
    throw new Error(`embedQuery: 차원 불일치 — 기대 [1, ${DIMENSIONS}], 실제 [${batch}, ${dim}]`);
  }

  return Array.from(output.data).slice(0, DIMENSIONS);
}

/** 콜드스타트 비용을 요청 경로 밖으로 빼고 싶을 때 미리 호출한다. */
export async function warmUpEmbedding(): Promise<void> {
  await getExtractor();
}
