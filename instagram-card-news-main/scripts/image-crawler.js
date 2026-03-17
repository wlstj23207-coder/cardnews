'use strict';

/**
 * 이미지 크롤러 모듈
 * Google Images에서 키워드 기반 이미지를 크롤링합니다.
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
 * 캐시 키를 생성합니다.
 * @param {string} source - 이미지 소스 (google)
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {string} 캐시 키
 */
function generateCacheKey(source, keyword, options) {
  const opts = {
    orientation: options.orientation || 'portrait',
    count: options.count || 10,
    page: options.page || 1
  };
  return `${source}_${keyword}_${opts.orientation}_${opts.count}_${opts.page}`.toLowerCase();
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
 * Unsplash Source API를 사용하여 이미지 URL을 생성합니다.
 * Unsplash API 키 없이 이미지를 가져올 수 있습니다.
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 옵션
 * @returns {Promise<Array>} 이미지 URL 배열
 */
async function searchUnsplashSource(keyword, options = {}) {
  const count = options.count || 10;
  const orientation = options.orientation || 'portrait';
  const images = [];

  for (let i = 0; i < count; i++) {
    const random = Math.floor(Math.random() * 1000);
    const imageUrl = `https://source.unsplash.com/random/?${keyword}&sig=${random}&w=1080&h=1350&fit=crop`;

    images.push({
      url: imageUrl,
      credit: 'Unsplash',
      color: '#888888'
    });
  }

  return images;
}

/**
 * Unsplash 웹사이트 검색 결과에서 이미지 URL을 추출합니다.
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 옵션
 * @returns {Promise<Array>} 이미지 URL 배열
 */
async function searchUnsplashWeb(keyword, options = {}) {
  const count = options.count || 10;

  try {
    // Unsplash 웹사이트 검색 결과 페이지
    const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(keyword)}`;
    const html = await httpGet(searchUrl);

    // HTML에서 이미지 URL 추출 (정규식)
    const imageRegex = /https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9_-]+/g;
    const matches = html.match(imageRegex);

    if (!matches || matches.length === 0) {
      console.log(`[Unsplash 웹] 검색 결과 없음: "${keyword}"`);
      return [];
    }

    // 중복 제거
    const uniqueUrls = [...new Set(matches)];

    // URL에서 이미지 ID 추출
    const images = uniqueUrls.slice(0, count).map(url => {
      const idMatch = url.match(/photo-([a-zA-Z0-9_-]+)/);
      const id = idMatch ? idMatch[1] : 'unknown';

      return {
        url: `${url}?w=1080&h=1350&fit=crop`,
        credit: 'Unsplash',
        color: '#888888'
      };
    });

    console.log(`[Unsplash 웹] ${images.length}개 이미지 발견`);
    return images;

  } catch (error) {
    console.warn(`[Unsplash 웹] 검색 실패: ${error.message}`);
    return [];
  }
}

/**
 * 메인 검색 함수
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {Promise<object>} 검색 결과
 */
async function searchImages(keyword, options = {}) {
  const source = options.source || 'unsplash';
  const orientation = options.orientation || 'portrait';
  const count = options.count || 10;
  const useCache = options.useCache !== false;

  const cacheKey = generateCacheKey(source, keyword, options);

  // 캐시 확인
  if (useCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      console.log(`[캐시] 히트: ${cacheKey}`);
      return cached;
    }
  }

  let images = [];

  // 검색 소스별 로직
  if (source === 'unsplash-source') {
    images = await searchUnsplashSource(keyword, options);
  } else if (source === 'unsplash-web') {
    images = await searchUnsplashWeb(keyword, options);
  } else {
    // 기본: Unsplash Source API (가장 안정적)
    images = await searchUnsplashSource(keyword, options);
  }

  const result = {
    keyword,
    source,
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
  const source = options.source || 'unsplash-source';

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
          source: source,
          count: 3,
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

        console.log(`[이미지] 슬라이드 ${slide.slide || '?'}에 이미지 할당: ${source}`);
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
  searchUnsplashSource,
  searchUnsplashWeb
};
