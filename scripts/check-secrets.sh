#!/usr/bin/env bash
# 커밋에 비밀키가 섞여 들어가는 것을 막는다.
#
# .gitignore 만으로는 부족하다. `git add -f` 나 새로 만든 경로, 코드에 하드코딩한 값은
# 그대로 통과한다. 한 번 푸시되면 히스토리에서 지우기 어렵고 키를 폐기해야 한다.
#
# 수동 실행:   bash scripts/check-secrets.sh
# 훅으로 설치: git config core.hooksPath .githooks

set -uo pipefail

fail=0
note() { printf '  %s\n' "$1"; }

# 스테이징된 파일이 있으면 그것만, 없으면 추적 중인 전체를 본다.
staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)
if [ -n "$staged" ]; then
  files="$staged"
  scope="스테이징된 파일"
else
  files=$(git ls-files)
  scope="추적 중인 전체 파일"
fi

echo "비밀키 점검 대상: $scope"

# 1) .env 파일 자체가 추적되는지 (.example 은 허용)
env_tracked=$(printf '%s\n' "$files" | grep -E '(^|/)\.env($|\.)' | grep -v '\.example$' || true)
if [ -n "$env_tracked" ]; then
  echo "FAIL  .env 파일이 커밋 대상에 있습니다:"
  printf '%s\n' "$env_tracked" | while read -r f; do note "$f"; done
  fail=1
fi

# 2) 실제 키 형태가 파일 내용에 들어 있는지
#    - sb_secret_… : Supabase secret key (신형)
#    - sk-ant-      : Anthropic API key. 테스트 더미(sk-ant-test)는 제외한다.
#    - service_role JWT: role 클레임이 박힌 토큰
patterns=(
  'sb_secret_[A-Za-z0-9_-]{20,}'
  'sk-ant-(?!test)[A-Za-z0-9_-]{20,}'
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
)

for pattern in "${patterns[@]}"; do
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    case "$f" in
      *.example|*/check-secrets.sh|*DEPLOY.md) continue ;;
    esac
    if grep -qPI "$pattern" "$f" 2>/dev/null; then
      echo "FAIL  키로 보이는 문자열이 있습니다: $f"
      note "패턴: $pattern"
      fail=1
    fi
  done <<< "$files"
done

if [ "$fail" -eq 0 ]; then
  echo "PASS  비밀키 없음"
fi

exit "$fail"
