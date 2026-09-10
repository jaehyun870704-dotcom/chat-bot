'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LAB_ROOT = path.resolve(__dirname, '..');

// .env 탐색 순서: search-lab/.env → vector-pipeline/.env
// 파이프라인이 이미 쓰던 자격 증명을 그대로 재사용해 키를 다시 붙여넣지 않아도 되게 한다.
const ENV_CANDIDATES = [
  path.join(LAB_ROOT, '.env'),
  path.join(REPO_ROOT, 'vector-pipeline', '.env'),
];

function loadEnv() {
  const loaded = [];
  for (const file of ENV_CANDIDATES) {
    if (fs.existsSync(file)) {
      require('dotenv').config({ path: file });
      loaded.push(file);
    }
  }
  return loaded;
}

// 모델 캐시: 이미 내려받은 vector-pipeline 캐시를 우선 재사용한다(약 600MB 재다운로드 방지).
function resolveModelCacheDir() {
  if (process.env.MODEL_CACHE_DIR) return path.resolve(process.env.MODEL_CACHE_DIR);

  const pipelineCache = path.join(
    REPO_ROOT, 'vector-pipeline', 'node_modules', '@huggingface', 'transformers', '.cache'
  );
  if (fs.existsSync(path.join(pipelineCache, 'Xenova', 'multilingual-e5-small'))) {
    return pipelineCache;
  }
  return path.join(REPO_ROOT, '.model-cache');
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `환경변수 ${name} 가 없습니다. search-lab/.env 또는 vector-pipeline/.env 를 확인하세요.`
    );
  }
  return value.trim();
}

module.exports = { REPO_ROOT, LAB_ROOT, loadEnv, resolveModelCacheDir, requireEnv };
