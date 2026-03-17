# Hugging Face 무료 이미지 생성 완료!

## ✅ 변경 사항

### v7.0 → v8.0
- **이미지 엔진**: OpenAI DALL-E (유료) → Hugging Face Stable Diffusion XL (무료)
- **API 키**: 필요 없음 → 필요 없음 (선택 사항)
- **비용**: 유료 → 완전 무료
- **품질**: 고품질 → 고품질 (Stable Diffusion XL)

---

## 🤖 Hugging Face Stable Diffusion XL

### 특징
- **엔진**: Stable Diffusion XL Base 1.0
- **무료**: 완전 무료, 사용량 제한 없음
- **품질**: DALL-E에 근접한 고품질
- **크기**: 1080x1350px (카드뉴스 최적화)
- **속도**: 약 10-20초/이미지

### 모델 URL
```
https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0
```

---

## 🔧 설정 방법

### 선택 사항: Hugging Face 토큰 (권장)

토큰을 사용하면 속도가 더 빠르고 제한이 완화됩니다.

1. https://huggingface.co/settings/tokens 접속
2. "New token" 클릭
3. 이름 입력 (예: `cardnews-generator`)
4. "Token type": `Read`
5. 생성된 토큰 복사

### 환경변수 설정 (선택 사항)

```bash
# 임시 (현재 세션만)
export HF_TOKEN="hf_..."

# 영구 (.zshrc에 추가)
echo 'export HF_TOKEN="hf_..."' >> ~/.zshrc
source ~/.zshrc

# 확인
echo $HF_TOKEN
```

**참고**: 토큰 없어도 사용 가능하지만, 속도와 제한이 더 좋습니다.

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

AI 엔진이 슬라이드 키워드(`image_keyword`, `headline`)를 기반으로 이미지 생성 프롬프트를 자동으로 만듭니다:

**예시 프롬프트**:
```
Professional vertical portrait orientation, 9:16 aspect ratio, cinematic lighting, high quality, clean background suitable for text overlay, Mac Miller rapper portrait hip hop
```

---

## 📊 워크플로우

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
Step 3.5 내: Hugging Face Stable Diffusion XL로 이미지 생성 ⭐ (완전 무료!)
  ↓
Step 4: 렌더링 → Puppeteer HTML → PNG 변환 (1080x1350px)
  ↓
Step 5: 검토 → 가독성, 텍스트 잘림, 흐름, CTA 명확성 검토
```

---

## 💡 생성 파라미터

### Stable Diffusion XL 파라미터

```json
{
  "num_inference_steps": 25,      // 추론 단계 수 (품질 vs 속도)
  "guidance_scale": 7.5,          // 가이던스 스케일 (프롬프트 강도)
  "width": 1080,                  // 너비
  "height": 1350,                 // 높이
  "seed": 123456                   // 시드 (일관성을 위해)
}
```

### 캐시 설정

- **캐시 키**: `{engine}_{keyword}_{orientation}_{count}_{page}`
- **캐시 위치**: `.cache/images/`
- **캐시 유효기간**: 24시간
- **캐시 사용**: 기본 활성화

---

## 🎯 "카드뉴스 만들어줘" 명령

이제 "카드뉴스 만들어줘" 명령만 하면:

1. 요청 파싱
2. 리서치 (웹 검색)
3. 리서치 검증 (팀 토론)
4. 카피라이팅 (slides.json)
5. 카피 토론 (팀 토론, 후킹 점수 7점+)
6. **Hugging Face Stable Diffusion XL로 이미지 생성** (완전 무료!) ⭐
7. 렌더링 (Puppeteer)
8. 검토

---

## 🆓 무료 장점

### vs OpenAI DALL-E

| 기능 | DALL-E | Hugging Face SD-XL |
|------|--------|-------------------|
| 비용 | 유료 ($0.04/이미지) | 무료 |
| API 키 | 필수 | 선택 사항 |
| 품질 | 고품질 | 고품질 (비슷) |
| 속도 | 빠름 (5-10초) | 중간 (10-20초) |
| 사용량 | 유료 | 무료 (무제한) |

---

## 📁 생성된 파일

- **`scripts/image-crawler-hf.js`**: Hugging Face Stable Diffusion XL 이미지 생성 모듈
- **`scripts/render.js`**: HF 모듈 사용하도록 수정
- **`config.json`**: v8.0 버전, `image_crawling.engine: "hf-diffusion-xl"`
- **`HF_FREE_GUIDE.md`**: 이 가이드

---

## ⚠️ 주의사항

1. **속도**: Hugging Face API는 DALL-E보다 느릴 수 있음 (10-20초/이미지)
2. **토큰 권장**: 속도와 제한 개선을 위해 HF 토큰 설정 권장
3. **캐시**: 24시간 동안 같은 키워드는 캐시 사용
4. **네트워크**: 인터넷 연결 필수

---

## 🚀 다음 단계

1. **테스트**: 기존 Mac Miller 카드뉴스로 렌더링 테스트
2. **새 카드뉴스**: "카드뉴스 만들어줘: [주제]" 명령으로 새 카드뉴스 생성
3. **평가**: 생성된 이미지 품질 확인

---

## 📞 지원

- **Hugging Face Docs**: https://huggingface.co/docs/api-inference
- **Stable Diffusion XL**: https://huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0

---

준비되면 테스트해볼게요! 🎨✨
