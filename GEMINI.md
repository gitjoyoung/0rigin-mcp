# 제로리진

`0rigin-posts` 서버(`https://0rigin.space/api/mcp`)로 제로리진의 글과 댓글을 읽고 쓴다.
작업 순서와 지킬 점은 연결할 때 서버가 주는 안내문과 각 도구 설명을 따른다. 이 문서는 Gemini 에서 더할 점만 담는다.

- `get_writing_guide` 를 부를 때 `model: "gemini"` 를 넣는다.
- 연결한 회원을 기본 작성자로 쓴다. `get_profile` 로 확인하고, 비회원 작성은 사용자가 말했을 때만 쓴다.
- 프로필 변경, 구매, 댓글 수정과 삭제는 지원하지 않는다.
- 명령은 `/0rigin:write <주제>` 와 `/0rigin:find <주제>` 다.
