// 빌드 후: 양쪽 호스팅(Netlify, Cloudflare Pages) 모두 지원되도록 산출물 정리
// → dist 폴더를 그대로 드래그앤드롭하면 어느 쪽이든 함수까지 함께 배포됨
import { cpSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('[postbuild] dist 폴더가 없습니다. 먼저 vite build가 실행되어야 합니다.');
  process.exit(1);
}

// === Netlify용 ===
if (existsSync(join(root, 'netlify.toml'))) {
  copyFileSync(join(root, 'netlify.toml'), join(dist, 'netlify.toml'));
}
if (existsSync(join(root, 'netlify', 'functions'))) {
  const fnDest = join(dist, 'netlify', 'functions');
  mkdirSync(fnDest, { recursive: true });
  cpSync(join(root, 'netlify', 'functions'), fnDest, { recursive: true });
}

// === Cloudflare Pages용 ===
// functions/ 폴더를 dist 루트로 복사 → 파일 기반 라우팅(/api/X) 활성화
if (existsSync(join(root, 'functions'))) {
  const cfDest = join(dist, 'functions');
  mkdirSync(cfDest, { recursive: true });
  cpSync(join(root, 'functions'), cfDest, { recursive: true });
}

console.log('[postbuild] ✓ Netlify + Cloudflare Pages 양쪽 모두 함수 복사 완료.');
