/** @type {import('next').NextConfig} */
const nextConfig = {
  // @huggingface/transformers 는 Node 런타임에서만 동작한다(Edge 불가).
  // 서버 번들에서 외부 모듈로 두어 webpack 이 ONNX 바이너리를 끌어안지 않게 한다.
  serverExternalPackages: ['@huggingface/transformers'],

  // 서버리스 함수 용량 줄이기.
  //
  // onnxruntime-node 는 세 플랫폼 바이너리를 모두 담고 있다(실측: win32 124MB,
  // darwin 35MB, linux 53MB). Vercel 은 리눅스에서 돌고 함수당 250MB 제한이 있으므로,
  // 쓰지 않는 두 플랫폼 159MB 를 배포 번들에서 제외한다.
  //
  // 로컬 개발·실행에는 영향이 없다. 이 설정은 배포 번들을 추릴 때만 쓰인다.
  outputFileTracingExcludes: {
    '**': [
      'node_modules/onnxruntime-node/bin/napi-v6/win32/**',
      'node_modules/onnxruntime-node/bin/napi-v6/darwin/**',
      'node_modules/@huggingface/transformers/dist/*.mjs.map',
    ],
  },
};

export default nextConfig;
