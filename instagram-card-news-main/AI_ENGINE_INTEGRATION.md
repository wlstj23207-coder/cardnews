# AI 엔진 통합 구조 완료!

## ✅ 변경 사항

### v6.0 → v7.0
- **이미지 크롤러**: `image-crawler.js`
- **AI 엔진 통합**: `image-crawler-ai.js` (새로 추가)
- **render.js**: `image-crawler-ai.js` 사용하도록 수정
- **config.json**: AI 엔진 설정 추가

---

## 🤖 AI 엔진 지원

### 1. OpenAI DALL-E (기본)
- **엔진**: `dalle`
- **모델**: `dall-e-3`
- **API 키**: `OPENAI_API_KEY` 환경변수 필요
- **장점**: 고품질 이미지, 다양한 스타일
- **비용**: 유료 (API 사용량에 따라)

### 2. Claude 이미지 모델
- **엔진**: `claude`
- **현황**: OpenClaw 내부 이미지 모델 통합 예정
- **상태**: 현재는 폴백으로 DALL-E 사용 필요

---

## 🔧 설정 방법

### OpenAI API 키 발급

1. https://platform.openai.com/api-keys 접속
2. "Create new secret key" 클릭
3. 이름 입력 (예: `cardnews-generator`)
4. 생성된 키 복사

### 환경변수 설정

```bash
# 임시 (현재 세션만)
export OPENAI_API_KEY="sk-proj-..."

# 영구 (.zshrc에 추가)
echo 'export OPENAI_API_KEY="sk-proj-..."' >> ~/.zshrc
source ~/.zshrc

# 확인
echo $OPENAI_API_KEY
```

---

## 🎨 사용 방법

### 렌더링 명령어

```bash
cd /tmp/cardnews-repo/instagram-card-news-main

node scripts/render.js \
  --slides workspace/slides.json \
  --style magazine \
  --output output/ \
  --accent "#FF6B6B" \
  --account "daily_spot"
```

### 프롬프트 자동 생성

AI 엔진이 슬라이드 키워드(`image_keyword`, `headline`)을 기반으로 이미지 생성 프롬프트를 자동으로 만듭니다:

**예시 프롬프트**:
```
Professional vertical portrait orientation, 9:16 aspect ratio, Mac Miller rapper portrait hip hop, high quality, clean background suitable for text overlay
```

---

## 📋 워크플로우

```
Step 1: 요청 파싱 → topic, tone, template, slide_count, accent_color, bg_photo_mode
  ↓
Step 2: 리서치 → 웹 검색으로 핵심 포인트, 통계, 인용구, 트렌드 수집
  ↓
Step 2.5: 리서치 검증 → 팩트체커 + 보완 리서처 병렬 검증
  ↓
Step 3: 카피라이팅 → slides.json 작성
  ↓
Step 3.5: 카피 토론 → 후킹 전문가 + 카피 에디터 병렬 토론 (후킹 점수 7점+)
  ↓
Step 3.5 내: 이미지 크롤링 + AI 엔진 → 키워드 기반 AI 엔진으로 배경사진 생성
  ↓
Step 4: 렌더링 → Puppeteer HTML → PNG 변환 (1080x1350px)
  ↓
Step 5: 검토 → 가독성, 텍스트 잘림, 흐름, CTA 명확성 검토
```

---

## 🎯 "카드뉴스 만들어줘" 명령

이제 "카드뉴스 만들어줘" 명령만 하면:

1. 요청 파싱
2. 리서치 (웹 검색)
3. 리서치 검증 (팀 토론)
4. 카피라이팅 (slides.json)
5. 카피 토론 (팀 토론, 후킹 점수 7점+)
6. **이미지 크롤링 + AI 엔진** (자동 프롬프트 생성 + 이미지 생성)
7. 렌더링 (Puppeteer)
8. 검토

---

## 💡 엔진 선택 (config.json)

```json
{
  "image_crawling": {
    "engine": "dalle"
  }
}
```

**지원 엔진**:
- `dalle` (기본): OpenAI DALL-E-3
- `claude`: Claude 이미지 모델 (폴백으로 DALL-E 사용)

---

## 📁 생성된 파일

- **`scripts/image-crawler-ai.js`**: 크롤링 + AI 엔진 통합 모듈
- **`scripts/render.js`**: AI 엔진 사용하도록 수정
- **`config.json`**: v7.0 버전, `image_crawling.engine` 추가

---

## ⚠️ 주의사항

1. **API 키 필요**: OpenAI DALL-E 사용 시 `OPENAI_API_KEY` 환경변수 필요
2. **비용 발생**: DALL-E API 사용 시 비용 발생
3. **캐시 기간**: 24시간 동안 같은 키워드는 캐시 사용

---

## 🚀 다음 단계

1. OpenAI API 키 발급: https://platform.openai.com/api-keys
2. 환경변수 설정: `export OPENAI_API_KEY="..."`
3. 렌더링 실행: `node scripts/render.js --slides ...`

준비되면 알려주세요! 바로 테스트해볼게요. 🎨✨
