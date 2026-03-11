'use strict';

/**
 * 이미지 소싱 모듈
 * Unsplash와 Pexels API를 사용하여 키워드 기반 이미지를 가져옵니다.
 * 
 * 사용법:
 *   const imageSourcing = require('./image-sourcing');
 *   const images = await imageSourcing.searchImages('fashion', { count: 5 });
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 설정 파일 로드
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 환경 변수에서 API 키 가져오기
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

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
 * @returns {Promise<object>} 응답 데이터
 */
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Instagram-Card-News-Generator/1.0',
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
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
 * @param {string} source - 이미지 소스 (unsplash/pexels)
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
 * @returns {object|null} 캐시된 데이터 또는 null
 */
function getFromCache(key) {
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  
  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const now = Date.now();
    
    // 캐시 만료 확인
    if (cached.timestamp && (now - cached.timestamp) < CACHE_DURATION_MS) {
      console.log(`[캐시] 캐시에서 데이터 로드: ${key}`);
      return cached.data;
    }
    
    // 만료된 캐시 삭제
    fs.unlinkSync(cacheFile);
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 캐시에 데이터를 저장합니다.
 * @param {string} key - 캐시 키
 * @param {object} data - 저장할 데이터
 */
function saveToCache(key, data) {
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({
      timestamp: Date.now(),
      data: data
    }, null, 2));
    console.log(`[캐시] 데이터 저장 완료: ${key}`);
  } catch (e) {
    console.warn(`[캐시] 저장 실패: ${e.message}`);
  }
}

/**
 * Unsplash API로 이미지를 검색합니다.
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {Promise<Array>} 이미지 배열
 */
async function searchUnsplash(keyword, options = {}) {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error('UNSPLASH_ACCESS_KEY 환경 변수가 설정되지 않았습니다.');
  }

  const count = options.count || 10;
  const page = options.page || 1;
  const orientation = options.orientation || 'portrait';

  // Unsplash orientation 파라미터 변환
  const unsplashOrientation = orientation === 'portrait' ? 'portrait' : 
                              orientation === 'landscape' ? 'landscape' : 'squarish';

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${count}&page=${page}&orientation=${unsplashOrientation}`;

  console.log(`[Unsplash] 검색 요청: "${keyword}" (방향: ${unsplashOrientation}, 개수: ${count})`);

  try {
    const response = await httpGet(url, {
      'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      'Accept-Version': 'v1'
    });

    if (!response.results || response.results.length === 0) {
      console.log(`[Unsplash] 검색 결과 없음: "${keyword}"`);
      return [];
    }

    const images = response.results.map(img => ({
      id: img.id,
      source: 'unsplash',
      url: img.urls.regular,        // 1080px 너비
      url_full: img.urls.full,       // 원본
      url_small: img.urls.small,     // 400px 너비
      width: img.width,
      height: img.height,
      aspect_ratio: img.width / img.height,
      description: img.description || img.alt_description || '',
      photographer: {
        name: img.user.name,
        username: img.user.username,
        profile: img.user.links.html
      },
      credit: `Photo by ${img.user.name} on Unsplash`,
      download_url: img.links.download,
      color: img.color               // 평균 색상
    }));

    console.log(`[Unsplash] ${images.length}개 이미지 발견`);
    return images;
  } catch (error) {
    console.error(`[Unsplash] API 오류: ${error.message}`);
    throw error;
  }
}

/**
 * Pexels API로 이미지를 검색합니다.
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @returns {Promise<Array>} 이미지 배열
 */
async function searchPexels(keyword, options = {}) {
  if (!PEXELS_API_KEY) {
    throw new Error('PEXELS_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  const count = options.count || 10;
  const page = options.page || 1;
  const orientation = options.orientation || 'portrait';

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=${count}&page=${page}&orientation=${orientation}`;

  console.log(`[Pexels] 검색 요청: "${keyword}" (방향: ${orientation}, 개수: ${count})`);

  try {
    const response = await httpGet(url, {
      'Authorization': PEXELS_API_KEY
    });

    if (!response.photos || response.photos.length === 0) {
      console.log(`[Pexels] 검색 결과 없음: "${keyword}"`);
      return [];
    }

    const images = response.photos.map(img => ({
      id: img.id.toString(),
      source: 'pexels',
      url: img.src.large,            // ~940px
      url_full: img.src.original,    // 원본
      url_small: img.src.medium,     // ~500px
      width: img.width,
      height: img.height,
      aspect_ratio: img.width / img.height,
      description: img.alt || img.url || '',
      photographer: {
        name: img.photographer,
        username: img.photographer,
        profile: img.photographer_url
      },
      credit: `Photo by ${img.photographer} on Pexels`,
      color: img.avg_color           // 평균 색상
    }));

    console.log(`[Pexels] ${images.length}개 이미지 발견`);
    return images;
  } catch (error) {
    console.error(`[Pexels] API 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 키워드로 이미지를 검색합니다. (메인 함수)
 * Unsplash를 먼저 시도하고, 실패 시 Pexels로 폴백합니다.
 * 
 * @param {string} keyword - 검색 키워드
 * @param {object} options - 검색 옵션
 * @param {number} options.count - 가져올 이미지 수 (기본값: 10)
 * @param {string} options.orientation - 이미지 방향 (portrait/landscape/square)
 * @param {boolean} options.useCache - 캐시 사용 여부 (기본값: true)
 * @param {string} options.source - 소스 강제 지정 (unsplash/pexels/auto)
 * @returns {Promise<Array>} 이미지 배열
 */
async function searchImages(keyword, options = {}) {
  const opts = {
    count: options.count || 10,
    orientation: options.orientation || config.image_sourcing?.orientation || 'portrait',
    useCache: options.useCache !== false,
    source: options.source || config.image_sourcing?.primary_source || 'auto'
  };

  // 캐시 확인
  if (opts.useCache) {
    const cacheKey = generateCacheKey('combined', keyword, opts);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let images = [];
  let errors = [];

  // 소스 결정
  const primarySource = opts.source === 'pexels' ? 'pexels' : 'unsplash';
  const fallbackSource = opts.source === 'pexels' ? 'unsplash' : 'pexels';

  // 1순위 소스 시도
  try {
    if (primarySource === 'unsplash') {
      images = await searchUnsplash(keyword, opts);
    } else {
      images = await searchPexels(keyword, opts);
    }
  } catch (error) {
    errors.push({ source: primarySource, error: error.message });
    console.log(`[${primarySource}] 실패, 폴백 시도...`);
  }

  // 1순위에서 결과가 없거나 실패한 경우 2순위 소스 시도
  if (images.length === 0 && opts.source === 'auto') {
    try {
      if (fallbackSource === 'unsplash') {
        images = await searchUnsplash(keyword, opts);
      } else {
        images = await searchPexels(keyword, opts);
      }
    } catch (error) {
      errors.push({ source: fallbackSource, error: error.message });
    }
  }

  // 세로형 이미지 우선 정렬
  if (opts.orientation === 'portrait') {
    images.sort((a, b) => {
      // 세로 비율이 클수록 우선
      const ratioA = a.aspect_ratio;
      const ratioB = b.aspect_ratio;
      // 3:4 비율(0.75)에 가까울수록 우선
      const idealRatio = 0.8; // Instagram 세로형 비율 (1080x1350 = 0.8)
      return Math.abs(ratioA - idealRatio) - Math.abs(ratioB - idealRatio);
    });
  }

  // 결과 저장 및 반환
  const result = {
    keyword,
    total: images.length,
    images: images.slice(0, opts.count),
    errors: errors.length > 0 ? errors : undefined
  };

  // 캐시에 저장
  if (opts.useCache && images.length > 0) {
    const cacheKey = generateCacheKey('combined', keyword, opts);
    saveToCache(cacheKey, result);
  }

  return result;
}

/**
 * 슬라이드 데이터에 이미지를 자동으로 할당합니다.
 * 
 * @param {Array} slides - 슬라이드 배열
 * @param {object} options - 옵션
 * @param {string} options.keyword - 기본 검색 키워드
 * @param {string} options.orientation - 이미지 방향
 * @returns {Promise<Array>} 이미지가 할당된 슬라이드 배열
 */
async function assignImagesToSlides(slides, options = {}) {
  const keyword = options.keyword || '';
  const orientation = options.orientation || 'portrait';

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
        
        console.log(`[이미지] 슬라이드 ${slide.slide || '?'}에 이미지 할당: ${selectedImage.source}`);
      }
    } catch (error) {
      console.warn(`[이미지] 슬라이드 ${slide.slide || '?'} 이미지 검색 실패: ${error.message}`);
    }
  }

  return slides;
}

/**
 * API 연결 상태를 확인합니다.
 * @returns {Promise<object>} API 상태 정보
 */
async function checkApiStatus() {
  const status = {
    unsplash: { available: false, error: null },
    pexels: { available: false, error: null }
  };

  // Unsplash 확인
  if (UNSPLASH_ACCESS_KEY) {
    try {
      await searchUnsplash('test', { count: 1 });
      status.unsplash.available = true;
      status.unsplash.error = null;
    } catch (error) {
      status.unsplash.error = error.message;
    }
  } else {
    status.unsplash.error = 'API 키 미설정';
  }

  // Pexels 확인
  if (PEXELS_API_KEY) {
    try {
      await searchPexels('test', { count: 1 });
      status.pexels.available = true;
      status.pexels.error = null;
    } catch (error) {
      status.pexels.error = error.message;
    }
  } else {
    status.pexels.error = 'API 키 미설정';
  }

  return status;
}

/**
 * 캐시를 모두 삭제합니다.
 */
function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(file => {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    });
    console.log(`[캐시] ${files.length}개 캐시 파일 삭제 완료`);
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const keyword = args[0];

  if (!keyword) {
    console.log(`
이미지 소싱 도구
================

사용법:
  node image-sourcing.js <키워드> [개수] [방향]

예시:
  node image-sourcing.js fashion 5 portrait
  node image-sourcing.js "coffee shop" 10

환경 변수:
  UNSPLASH_ACCESS_KEY - Unsplash API 액세스 키
  PEXELS_API_KEY - Pexels API 키
    `);
    process.exit(0);
  }

  const count = parseInt(args[1]) || 10;
  const orientation = args[2] || 'portrait';

  console.log(`\n🔍 "${keyword}" 검색 (개수: ${count}, 방향: ${orientation})\n`);

  searchImages(keyword, { count, orientation })
    .then(result => {
      console.log(`\n✅ 총 ${result.total}개 이미지 발견\n`);
      
      result.images.forEach((img, i) => {
        console.log(`${i + 1}. [${img.source}] ${img.description?.substring(0, 50) || '설명 없음'}`);
        console.log(`   URL: ${img.url}`);
        console.log(`   크레딧: ${img.credit}`);
        console.log(`   비율: ${img.width}x${img.height} (${img.aspect_ratio.toFixed(2)})`);
        console.log('');
      });

      if (result.errors) {
        console.log('⚠️ 오류 발생:');
        result.errors.forEach(e => {
          console.log(`   - ${e.source}: ${e.error}`);
        });
      }
    })
    .catch(error => {
      console.error('❌ 오류:', error.message);
      process.exit(1);
    });
}

// 모듈 내보내기
module.exports = {
  searchImages,
  searchUnsplash,
  searchPexels,
  assignImagesToSlides,
  checkApiStatus,
  clearCache
};
