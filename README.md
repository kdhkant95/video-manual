# video-manual

제품 화면(스크린샷·Figma·실행 중인 서비스)으로 **영상 매뉴얼**을 만드는 AI 에이전트이자 Claude 스킬입니다. 제품의 대상 연령·도메인·B2C/B2B에 맞는 문체와 모션으로 만들고, 사용자가 문구를 고치고 프레임마다 코멘트를 남기면 AI가 반영합니다.

*An AI agent workspace and Claude skill that turns product screens into short captioned walkthrough videos, with UX writing and motion matched to the product's audience, and a review loop where you comment on frames and the AI revises.*

![예시 영상](docs/demo.gif)

위 영상은 이 저장소의 [예시](examples/moa/)로 만든 결과입니다 ([MP4](examples/moa/new-task/out/manual.mp4)).

## 시작하기

Node.js 18 이상, Google Chrome, 그리고 AI 코딩 에이전트(Claude Code 등)가 필요합니다.

**1. 저장소를 내려받습니다.**

```bash
git clone https://github.com/kdhkant95/video-manual.git
```

**2. 그 폴더에서 렌더링 의존성을 설치합니다 (최초 1회).** ffmpeg가 함께 설치됩니다.

```bash
npm run setup
```

**3. 그 폴더에서 AI 에이전트를 실행합니다.**

```bash
claude
```

**4. 에이전트에게 말합니다.**

> 영상 매뉴얼 만들자. 스튜디오 열어 줘.

에이전트가 스튜디오를 띄우고 주소를 알려 줍니다. 이후에는 스튜디오에서 작업하고, ✦ 버튼으로 보낸 요청은 에이전트가 처리합니다.

✦ 요청은 **내 AI 에이전트**가 처리합니다. 스튜디오 오른쪽 위에 에이전트 연결 상태가 표시되고, "AI 연결 안 됨"인 채로 요청이 쌓이면 에이전트에게 이렇게 말하면 됩니다.

> 스튜디오 요청 처리해 줘

내 제품의 프로파일과 화면은 `video-manual/` 폴더에 쌓이며, 이 폴더의 내용은 `.gitignore`로 제외되어 있어 실수로 공개 저장소에 올라가지 않습니다.

저장소 루트의 [AGENTS.md](AGENTS.md)가 에이전트의 지침입니다. Claude Code는 [CLAUDE.md](CLAUDE.md)를 통해 같은 지침을 읽고, `AGENTS.md`를 지원하는 다른 에이전트도 그대로 쓸 수 있습니다.

## 스튜디오의 네 단계

| 단계 | 사용자가 하는 일 | AI가 하는 일 |
| --- | --- | --- |
| **1. 프로덕트 프로젝트** | 제품 이름·도메인·B2C/B2B·대상 연령을 정하고, 강조색·배경 템플릿·로고·브랜드 가이드를 넣습니다 | 그 정보로 문체 규칙을 만들고 모션을 조정합니다 |
| **2. 씬** | 화면 이미지를 올리거나 Figma 프레임 링크를 영상 순서대로 넣고, 초안을 요청합니다 | Figma 프레임을 가져와 화면을 확인하고 스토리보드 초안을 씁니다 |
| **3. 스토리보드 초안** | 받은 초안의 키 화면·순서·설명글을 고쳐 확정합니다 | 요청하면 초안을 다시 씁니다 |
| **4. 영상** | 영상을 보며 문구·순서를 고치고, 프레임에 코멘트를 남겨 수정을 요청합니다 | 커서·하이라이트·확대를 넣고, 프레임을 검수하고, 코멘트를 반영합니다 |

- **제품당 한 번**: 1단계 결과는 `product-profile.json`에 저장되어 그 제품의 모든 매뉴얼이 함께 씁니다.
- **프레임 코멘트**: 영상을 멈추고 위치를 찍어 코멘트를 남기면, AI가 그 프레임을 직접 뽑아 보고 고친 뒤 코멘트마다 답을 답니다. 화면은 자동으로 갱신됩니다.
- **AI 없이도**: 프로파일 저장, 이미지 첨부, 문구·순서 수정, MP4 내보내기는 스튜디오만으로 됩니다.
- **Figma 프레임 링크**: 2단계에는 프레임마다 링크를 한 줄씩, 영상에 나오는 순서대로 넣습니다. Figma에서 프레임을 고르고 "선택 항목 링크 복사"로 복사하면 되고, 여러 줄을 한 번에 붙여 넣어도 됩니다. 팝업·메뉴·알림처럼 따로 그려진 프레임은 "앞 화면 위에 뜸"으로 표시하면 AI가 앞 화면 위에 올려 한 장으로 만듭니다. 페이지 전체 링크 하나만 넣을 수도 있지만, AI가 쓸 화면을 찾느라 훨씬 오래 걸립니다.
- **Figma 연결**: 스튜디오는 링크를 요청으로 넘길 뿐이고, 실제로 Figma를 여는 것은 각자의 AI 에이전트입니다. 그래서 쓰는 사람의 AI 클라이언트에 Figma가 연결(MCP 서버나 커넥터)되어 있고, 그 계정이 해당 파일을 볼 수 있어야 합니다. 이 저장소에는 Figma 인증 정보가 들어 있지 않습니다. 연결이 없으면 프레임을 PNG로 내보내 이미지로 올리면 됩니다.

에이전트 없이 스튜디오만 열어 보려면:

```bash
npm run example
```

## 문체는 어떻게 정해지나요

같은 "버튼을 눌러 작업을 만든다"는 단계도 대상에 따라 다르게 씁니다.

| 대상 | 자막 예시 |
| --- | --- |
| 60대 이상, 금융 B2C | 화면 오른쪽 위의 파란색 '새 작업' 버튼을 눌러 주세요. |
| 20–40대, 협업 도구 B2B | 보드 오른쪽 위의 '+ 새 작업'을 누르세요. |
| 10대, 학습 앱 B2C | '+ 새 작업'을 눌러 봐요! |
| 개발자 도구 B2B | '+ 새 작업'을 클릭해 작업을 생성합니다. |

프로파일의 `voice` 규칙(끝맺음, 최대 길이, 금지어)은 모든 자막에 자동으로 검사되어 스튜디오에 "확인할 점"으로 표시됩니다. 기준은 [voice-guide.md](skills/video-manual/references/voice-guide.md)에 있습니다.

## 영상에 넣을 수 있는 것

- **커서 동작**: 이동, 클릭(파동), 글자 입력
- **시선 유도**: 하이라이트(주변 어둡게), 확대·축소
- **텍스트 애니메이션**: 자막, 단계 중간에 바뀌는 자막, 화면 위 말풍선, 가운데 배너, `**강조**` 표시
- **텍스트 등장 방식**: `fade`, `fade-up`, `slide-in`, `pop`, `blur-in`, `typewriter`
- **배경 템플릿**: 단색, 그라데이션, 글로우, 격자, 도트, 스포트라이트 (어두운 톤·밝은 톤)
- **로고**: 타이틀·아웃트로 카드, 화면 왼쪽 아래, 또는 둘 다

## 모션 프리셋

| 프리셋 | 느낌 | 어울리는 제품 |
| --- | --- | --- |
| `calm-professional` | 차분하고 정확함. 단어가 아래에서 떠오르고 화면은 부드럽게 전환 | B2B SaaS, 금융, 헬스케어, 관리자 도구 |
| `friendly-playful` | 따뜻하고 통통 튐. 텍스트가 튀어나오고 클릭 파동이 큼 | 소비자 앱, 교육, 커뮤니티 |
| `sharp-technical` | 빠르고 군더더기 없음. 고정폭 자막이 타자 치듯 나오고 화면은 컷 전환 | 개발자 도구, 데이터, 인프라 |
| `premium-minimal` | 느리고 여백이 많음. 텍스트가 흐림에서 또렷해지고 카메라가 미끄러지듯 이동 | 디자인 도구, 브랜드 중심 제품 |

프리셋에서 출발해 강조색·배경·속도 등을 제품과 대상 연령에 맞게 덮어씁니다. 자세한 기준은 [motion-profiles.md](skills/video-manual/references/motion-profiles.md)에 있습니다.

## 다른 프로젝트에서 스킬로 쓰기

이 저장소를 통째로 쓰지 않고, 자기 프로젝트의 Claude Code에 스킬만 설치할 수도 있습니다.

```
/plugin marketplace add kdhkant95/video-manual
/plugin install video-manual@video-manual-skills
```

또는 `skills/video-manual` 폴더를 `~/.claude/skills/`(모든 프로젝트)나 프로젝트의 `.claude/skills/`에 복사합니다. 그 뒤 스킬 폴더의 `scripts`에서 `npm install`을 한 번 실행합니다.

스킬이 따르는 전체 지침은 [SKILL.md](skills/video-manual/SKILL.md)에 있고, 한국어로 읽으려면 [SKILL.ko.md](skills/video-manual/SKILL.ko.md)를 보세요.

## 저장소 구조

```
AGENTS.md                    # 에이전트 지침 (이 폴더에서 에이전트를 실행하면 읽음)
CLAUDE.md                    # Claude Code용: AGENTS.md를 불러옴
package.json                 # npm run setup / studio / example
video-manual/                # 작업 공간: 내 제품의 프로파일과 매뉴얼이 쌓이는 곳
├── product-profile.json     #   대상·문체·모션·배경 (모든 매뉴얼이 공유)
├── brand/                   #   브랜드 가이드, 로고
└── <매뉴얼-이름>/
    ├── screens/             #   화면 이미지
    ├── storyboard.json      #   스토리보드
    ├── comments.json        #   프레임 코멘트
    └── out/                 #   manual.html, manual.mp4
skills/video-manual/         # 스킬 본체
├── SKILL.md                 #   작업 순서 (AI가 읽는 원본)
├── SKILL.ko.md              #   한국어판 (사람이 읽는 번역본)
├── references/              #   필요할 때만 읽는 상세 문서
│   ├── studio.md            #     스튜디오와 AI의 요청 규약
│   ├── voice-guide.md       #     대상 연령·도메인·B2C/B2B → 문체 기준
│   ├── motion-profiles.md   #     제품 성격 → 모션 기준, 배경, 로고
│   ├── manual-script.md     #     스토리보드 초안·자막 작성법
│   └── storyboard-schema.md #     스토리보드 형식
├── assets/
│   ├── profiles/            #   모션 프리셋 4종
│   ├── player/              #   영상을 그리는 렌더러와 단독 미리보기
│   └── studio/              #   4단계 스튜디오 화면
└── scripts/
    ├── studio.mjs           #   스튜디오 서버, 요청 대기·완료 명령
    ├── build.mjs            #   스토리보드 검증 + 문체 검사 + HTML 생성
    ├── render.mjs           #   검수용 프레임 추출, MP4 렌더링
    └── lib.mjs              #   공용 로직
examples/moa/                # 가상의 제품으로 만든 전체 예시
.claude-plugin/              # Claude Code 플러그인·마켓플레이스 설정
.claude/launch.json          # Claude 데스크톱 앱에서 스튜디오를 미리보기로 띄우는 설정
```

## 스크립트를 직접 쓰기

스튜디오와 에이전트 없이 명령만으로도 만들 수 있습니다.

```bash
node skills/video-manual/scripts/build.mjs examples/moa/new-task/storyboard.json
```

```bash
node skills/video-manual/scripts/render.mjs examples/moa/new-task/out/manual.html --out examples/moa/new-task/out/manual.mp4
```

`build.mjs`가 만드는 `manual.html`은 다른 파일 없이 열리는 미리보기라서 그대로 공유할 수 있습니다.

## 제약

- 화면은 정지 이미지입니다. 스크롤, 호버, 앱 내부 애니메이션은 재현하지 않으며 상태별 스크린샷으로 표현합니다.
- 음성 해설과 배경 음악은 없습니다. 설명은 자막과 화면 텍스트가 담당합니다.
- 스튜디오에서는 문구와 순서를 직접 고칩니다. 클릭 위치나 하이라이트 대상은 코멘트로 AI에게 요청합니다.
- 스튜디오는 이 컴퓨터에서만 접속되는 로컬 서버입니다. 여러 사람이 함께 쓰는 서비스가 아닙니다.
- 글꼴은 렌더링하는 컴퓨터에 설치된 것을 씁니다.

## 라이선스

MIT
