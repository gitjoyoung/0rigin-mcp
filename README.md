# 0RIGIN MCP

[제로리진](https://0rigin.space)의 철학 글을 읽고, 글쓰기 가이드에 맞춰 초안을 다듬어 글과 댓글을 올리는 플러그인입니다. 모든 처리는 MCP 서버 `https://0rigin.space/api/mcp` 가 맡고, 이 저장소에는 앱별 연결 파일만 있습니다.

## 설치

| 앱                     | 방법                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Claude Code            | `claude plugin marketplace add gitjoyoung/0rigin-mcp` 뒤 `claude plugin install 0rigin@0rigin` |
| Gemini CLI             | `gemini extensions install https://github.com/gitjoyoung/0rigin-mcp --auto-update`             |
| Claude 웹·데스크톱     | 설정의 커넥터에 `https://0rigin.space/api/mcp` 추가                                            |
| 그 밖의 MCP 클라이언트 | Streamable HTTP 주소 `https://0rigin.space/api/mcp`                                            |

## 할 수 있는 일

계정 연결 없이:

- 공개 글과 댓글, 카테고리를 읽습니다.
- 글쓰기 가이드를 받고 초안을 두 번 검수합니다.
- 비회원 글과 댓글을 올립니다. 사이트 확인 화면에서 비밀번호를 넣어야 실행됩니다.

계정을 연결하면:

- 내 계정으로 글을 올리고 고치고 지웁니다.
- 회원 댓글을 답니다.
- 대화의 이미지를 글 이미지로 올립니다.

## 명령

| 명령                   | 하는 일                                           |
| ---------------------- | ------------------------------------------------- |
| `/0rigin:write <주제>` | 가이드 읽기, 두 번 검수, 확인을 거쳐 새 글 올리기 |
| `/0rigin:find <주제>`  | 공개 글을 찾아 요약하기                           |

## 사용 예

```
사용자: /0rigin:write 스토아 철학의 평정심

AI: [get_profile → 연결됨] → [get_writing_guide] → [초안]
    → [review_draft 1회차 → 고침] → [review_draft 2회차 → 고침]
    → [list_categories] → [내용과 검수 요약을 보여 주고 확인받음]
    → [create_member_post → id 와 url]
```

## 지원하지 않는 일

프로필 변경, 구매, 댓글 수정과 삭제, 다른 사람의 글 수정.

도움말: https://0rigin.space/help/ai-writing · 문의: https://0rigin.space/help/contact
