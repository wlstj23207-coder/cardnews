'use strict';

/**
 * Zai 엔진 웹 검색 + 이미지 생성 모듈
 * Zai 엔진으로 웹 검색하고 관련 이미지를 생성합니다.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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

// 환경 변수에서 Zai 엔진 API 키 가져오기
const ZAI_API_KEY = process.env.ZAI_API_KEY || '0e35a96e3bb648aeb4ea6d010e40c695';

/**
 * HTTP POST 요청을 수행합니다.
 * @param {string} url - 요청 URL
 * @param {object} data - 요청 데이터
 * @param {object} headers - 요청 헤더
 * @returns {Promise<object>} 응답 데이터
 */
function httpPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'User-Agent': 'Instagram-Card-News-Generator/1.0',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout (60s)'));
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Zai 엔진으로 웹 검색을 수행합니다.
 * @param {string} query - 검색 쿼리
 * @returns {Promise<Array>} 검색 결과
 */
async function zaiWebSearch(query, options = {}) {
  const searchUrl = 'https://api.zai.com/v1/web/search';

  try {
    const response = await httpPost(searchUrl, {
      query: query,
      limit: options.limit || 10
    });

    if (response.error) {
      throw new Error(`Zai 엔진 검색 오류: ${response.error}`);
    }

    return response.results || [];
  } catch (error) {
    throw new Error(`Zai 엔진 웹 검색 실패: ${error.message}`);
  }
}

/**
 * Zai 엔진으로 이미지를 생성합니다.
 * @param {string} prompt - 이미지 생성 프롬프트
 * @param {object} options - 옵션
 * @returns {Promise<object>} 생성된 이미지 정보
 */
async function generateZaiImage(prompt, options = {}) {
  const imageUrl = 'https://api.zai.com/v1/images/generations';

  try {
    const response = await httpPost(imageUrl, {
      prompt: prompt,
      n: 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard'
    });

    if (response.error) {
      throw new Error(`Zai 엔진 이미지 생성 오류: ${response.error}`);
    }

    const image = response.data && response.data[0];
    if (!image || !image.url) {
      throw new Error('이미지 URL을 가져올 수 없습니다.');
    }

    return {
      url: image.url,
      credit: 'Zai AI',
      color: '#888888'
    };
  } catch (error) {
    throw new Error(`Zai 엔진 이미지 생성 실패: ${error.message}`);
  }
}

/**
 * 이미지 프롬프트를 생성합니다.
 * @param {string} keyword - 검색 키워드
 * @param {Array} searchResults - 웹 검색 결과 (선택 사항)
 * @param {object} options - 옵션
 * @returns {string} 이미지 생성 프롬프트
 */
function generatePrompt(keyword, searchResults = [], options = {}) {
  const orientation = options.orientation || 'portrait';

  // 세로형 이미지용 프롬프트
  const orientationPrompt = orientation === 'portrait'
    ? 'vertical portrait orientation, 9:16 aspect ratio'
    : 'square, 1:1 aspect ratio';

  // 기본 프롬프트 템플릿
  const basePrompt = `Professional ${orientationPrompt}, high quality, clean background suitable for text overlay`;

  // 웹 검색 결과가 있으면 통합
  let searchContext = '';
  if (searchResults.length > 0) {
    const topResult = searchResults[0];
    searchContext = `, inspired by: ${topResult.title}`;
  }

  // 키워드 결합
  const prompt = `${basePrompt}, ${keyword}${searchContext}`;

  return prompt;
}

/**
 * 메인 검색 함수
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {Promise<object>} 검색 결과
 */
async function searchImages(keyword, options = {}) {
  const engine = options.engine || 'zai';
  const orientation = options.orientation || 'portrait';
  const count = options.count || 10;
  const useWebSearch = options.useWebSearch !== false;

  const cacheKey = `zai_${keyword}_${orientation}_${count}`;

  // 캐시 확인
  if (options.useCache !== false) {
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

    if (fs.existsSync(cacheFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const now = Date.now();

        if (now - data.timestamp > CACHE_DURATION_MS) {
          // 캐시 만료
          fs.unlinkSync(cacheFile);
        } else {
          console.log(`[캐시] 히트: ${cacheKey}`);
          return data;
        }
      } catch (e) {
        // 캐시 오류 시 계속 진행
      }
    }
  }

  let images = [];

  try {
    // Step 1: Zai 웹 검색
    let webResults = [];
    if (useWebSearch) {
      console.log(`[Zai 웹 검색] 키워드: "${keyword}"`);
      webResults = await zaiWebSearch(keyword, { limit: 5 });
      console.log(`[Zai 웹 검색] ${webResults.length}개 결과 발견`);
    }

    // Step 2: 이미지 생성
    const prompt = generatePrompt(keyword, webResults, options);

    console.log(`[Zai 이미지 생성] 프롬프트: ${prompt.substring(0, 100)}...`);
    const image = await generateZaiImage(prompt, options);

    images.push(image);
  } catch (error) {
    console.warn(`[Zai 엔진] 이미지 검색/생성 실패: ${error.message}`);
  }

  const result = {
    keyword,
    engine,
    orientation,
    images,
    total: images.length
  };

  // 캐시 저장
  if (options.useCache !== false) {
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    result.timestamp = Date.now();

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
      console.log(`[캐시] 데이터 저장 완료: ${cacheKey}`);
    } catch (e) {
      console.warn(`[캐시] 저장 실패: ${e.message}`);
    }
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
  const engine = options.engine || 'zai';

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
          useCache: true,
          useWebSearch: true
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
  generatePrompt,
  zaiWebSearch,
  generateZaiImage
};
