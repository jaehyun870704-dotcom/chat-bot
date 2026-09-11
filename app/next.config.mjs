/** @type {import('next').NextConfig} */
const nextConfig = {
  // @xenova/transformers 는 Node 런타임에서만 동작한다(Edge 불가).
  // 서버 번들에서 외부 모듈로 두어 webpack 이 ONNX 바이너리를 끌어안지 않게 한다.
  serverExternalPackages: ['@huggingface/transformers', 'vectra'],
};

export default nextConfig;
