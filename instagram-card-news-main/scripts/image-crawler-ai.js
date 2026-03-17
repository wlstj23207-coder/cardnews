'use strict';

/**
 * 이미지 크롤러 + AI 엔진 통합 모듈
 * 크롤링한 이미지를 참고하여 AI 엔진으로 새 이미지를 생성합니다.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 설정 파일 로드
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 캐시 설정
const CACHE_DIR = path.join(__dirname, '..', '.cache', 'images');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24시간

// 캐시 디렉토리 생성
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 환경 변수에서 AI 엔진 API 키 가져오기
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * HTTP GET 요청을 수행합니다.
 * @param {string} url - 요청 URL
 * @param {object} headers - 요청 헤더
 * @returns {Promise<string>} 응답 HTML
 */
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * OpenAI DALL-E로 이미지를 생성합니다.
 * @param {string} prompt - 이미지 생성 프롬프트
 * @param {object} options - 옵션
 * @returns {Promise<object>} 생성된 이미지 정보
 */
async function generateDALLE(prompt, options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const size = options.size || '1024x1024';
  const model = options.model || 'dall-e-3';
  const quality = options.quality || 'standard';

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality,
        response_format: 'url'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${data.error?.message || '알 수 없는 오류'}`);
    }

    const imageUrl = data.data[0]?.url;

    if (!imageUrl) {
      throw new Error('이미지 URL을 가져올 수 없습니다.');
    }

    return {
      url: imageUrl,
      credit: 'DALL-E',
      color: '#888888'
    };
  } catch (error) {
    throw new Error(`DALL-E 생성 실패: ${error.message}`);
  }
}

/**
 * Claude 이미지 모델로 이미지를 생성합니다.
 * @param {string} prompt - 이미지 생성 프롬프트
 * @param {object} options - 옵션
 * @returns {Promise<object>} 생성된 이미지 정보
 */
async function generateClaudeImage(prompt, options = {}) {
  // OpenClaude 내부 이미지 모델 사용
  // 이 부분은 OpenClaw의 내부 이미지 생성 기능을 활용할 수 있도록 구현

  try {
    // 현재는 외부 이미지 생성 모델을 사용하므로 폴백
    throw new Error('Claude 이미지 모델은 지원하지 않습니다. OpenAI DALL-E를 사용하세요.');
  } catch (error) {
    throw new Error(`Claude 이미지 생성 실패: ${error.message}`);
  }
}

/**
 * 이미지 프롬프트를 생성합니다.
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 옵션
 * @returns {string} 이미지 생성 프롬프트
 */
function generatePrompt(keyword, options = {}) {
  const orientation = options.orientation || 'portrait';

  // 세로형 이미지용 프롬프트
  const orientationPrompt = orientation === 'portrait'
    ? 'vertical portrait orientation, 9:16 aspect ratio'
    : 'square orientation, 1:1 aspect ratio';

  // 기본 프롬프트 템플릿
  const basePrompt = `Professional ${orientationPrompt} photography or illustration`;

  // 키워드 결합
  const prompt = `${basePrompt}, ${keyword}, high quality, clean background suitable for text overlay`;

  return prompt;
}

/**
 * 메인 이미지 생성 함수
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 옵션
 * @returns {Promise<object>} 생성된 이미지 정보
 */
async function generateImage(keyword, options = {}) {
  const engine = options.engine || 'dalle'; // dalle, claude

  const prompt = generatePrompt(keyword, options);

  console.log(`[AI 엔진] 이미지 생성 중... (엔진: ${engine})`);
  console.log(`[AI 엔진] 프롬프트: ${prompt}`);

  let image;

  if (engine === 'dalle') {
    image = await generateDALLE(prompt, options);
  } else if (engine === 'claude') {
    image = await generateClaudeImage(prompt, options);
  } else {
    throw new Error(`지원하지 않는 엔진: ${engine}`);
  }

  console.log(`[AI 엔진] 이미지 생성 완료`);

  return image;
}

/**
 * 캐시 키를 생성합니다.
 * @param {string} engine - 이미지 엔진 (dalle, claude)
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {string} 캐시 키
 */
function generateCacheKey(engine, keyword, options) {
  const opts = {
    orientation: options.orientation || 'portrait',
    count: options.count || 10,
    page: options.page || 1
  };
  return `${engine}_${keyword}_${opts.orientation}_${opts.count}_${opts.page}`.toLowerCase();
}

/**
 * 캐시에서 데이터를 가져옵니다.
 * @param {string} key - 캐시 키
 * @returns {object|null} 캐시된 데이터
 */
function getCache(key) {
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const now = Date.now();

    if (now - data.timestamp > CACHE_DURATION_MS) {
      // 캐시 만료
      fs.unlinkSync(cacheFile);
      return null;
    }

    return data;
  } catch (e) {
    console.warn(`[캐시] 읽기 실패: ${e.message}`);
    return null;
  }
}

/**
 * 캐시에 데이터를 저장합니다.
 * @param {string} key - 캐시 키
 * @param {object} data - 저장할 데이터
 */
function setCache(key, data) {
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  data.timestamp = Date.now();

  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    console.log(`[캐시] 데이터 저장 완료: ${key}`);
  } catch (e) {
    console.warn(`[캐시] 저장 실패: ${e.message}`);
  }
}

/**
 * 메인 검색 함수
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {Promise<object>} 검색 결과
 */
async function searchImages(keyword, options = {}) {
  const engine = options.engine || 'dalle';
  const orientation = options.orientation || 'portrait';
  const count = options.count || 10;
  const useCache = options.useCache !== false;

  const cacheKey = generateCacheKey(engine, keyword, options);

  // 캐시 확인
  if (useCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      console.log(`[캐시] 히트: ${cacheKey}`);
      return cached;
    }
  }

  let images = [];

  try {
    // AI 엔진으로 이미지 생성
    const image = await generateImage(keyword, options);

    images.push(image);
  } catch (error) {
    console.warn(`[AI 엔진] 이미지 생성 실패: ${error.message}`);
  }

  const result = {
    keyword,
    engine,
    orientation,
    images,
    total: images.length
  };

  // 캐시 저장
  if (useCache) {
    setCache(cacheKey, result);
  }

  return result;
}

/**
 * 슬라이드에 이미지를 할당합니다.
 * @param {Array} slides - 슬라이드 배열
 * @param {object} options - 옵션
 * @returns {Promise<Array>} 이미지가 할당된 슬라이드 배열
 */
async function assignImagesToSlides(slides, options = {}) {
  const keyword = options.keyword || '';
  const orientation = options.orientation || 'portrait';
  const engine = options.engine || 'dalle';

  // 이미지가 필요한 슬라이드 타입
  const imageTypes = ['content-image', 'content-fullimage', 'cover'];

  // 이미 키워드별로 캐시된 이미지들
  const imageCache = {};

  for (const slide of slides) {
    // 이미지가 필요한 슬라이드만 처리
    if (!imageTypes.includes(slide.type)) {
      continue;
    }

    // 이미 image_url이 있는 경우 건너뛰기
    if (slide.image_url && slide.image_url.trim() !== '') {
      continue;
    }

    // 슬라이드별 키워드 결정
    const slideKeyword = slide.image_keyword || slide.headline || keyword;

    if (!slideKeyword) {
      console.log(`[이미지] 슬라이드 ${slide.slide || '?'}에 키워드 없음, 건너뜀`);
      continue;
    }

    try {
      // 캐시 확인 또는 새로 검색
      if (!imageCache[slideKeyword]) {
        const result = await searchImages(slideKeyword, {
          engine: engine,
          count: 1,
          orientation: orientation,
          useCache: true
        });
        imageCache[slideKeyword] = result.images || [];
      }

      const images = imageCache[slideKeyword];
      if (images.length > 0) {
        // 첫 번째 사용 가능한 이미지 선택
        const selectedImage = images.shift();
        slide.image_url = selectedImage.url;
        slide.image_credit = selectedImage.credit;
        slide.image_color = selectedImage.color;

        console.log(`[이미지] 슬라이드 ${slide.slide || '?'}에 이미지 할당: ${engine}`);
      }
    } catch (error) {
      console.warn(`[이미지] 슬라이드 ${slide.slide || '?'} 이미지 검색 실패: ${error.message}`);
    }
  }

  return slides;
}

// 모듈 내보내기
module.exports = {
  searchImages,
  assignImagesToSlides,
  getCache,
  setCache,
  generateImage,
  generateDALLE,
  generateClaudeImage,
  generatePrompt
};
