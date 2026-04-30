/**
 * 공개 목록 스냅샷용 regionLabel.
 * - 광역시·특별시(및 세종): "서울 강남구", "부산 해운대구"처럼 구 단위까지.
 * - 그 외(도 단위): "충남 아산", "경기 수원"처럼 시·군 첫 구간까지만(구·읍면동·번지·전화 제외).
 */

const METRO_RULES: { re: RegExp; short: string }[] = [
  { re: /^서울(?:특별시|시)?/u, short: "서울" },
  { re: /^부산(?:광역시|시)?/u, short: "부산" },
  { re: /^대구(?:광역시|시)?/u, short: "대구" },
  { re: /^인천(?:광역시|시)?/u, short: "인천" },
  { re: /^광주(?:광역시|시)?/u, short: "광주" },
  { re: /^대전(?:광역시|시)?/u, short: "대전" },
  { re: /^울산(?:광역시|시)?/u, short: "울산" },
  { re: /^세종(?:특별자치시|시)?/u, short: "세종" },
];

const PROVINCE_HEAD: { re: RegExp; short: string }[] = [
  { re: /^경기(?:도)?/u, short: "경기" },
  { re: /^강원(?:특별자치도|도)?/u, short: "강원" },
  { re: /^충청북도|^충북/u, short: "충북" },
  { re: /^충청남도|^충남/u, short: "충남" },
  { re: /^전북특별자치도|^전라북도|^전북/u, short: "전북" },
  { re: /^전라남도|^전남/u, short: "전남" },
  { re: /^경상북도|^경북/u, short: "경북" },
  { re: /^경상남도|^경남/u, short: "경남" },
  { re: /^제주(?:특별자치도|도)?/u, short: "제주" },
];

function stripNoiseForRegionParsing(raw: string): string {
  let s = raw.replace(/\s+/gu, " ").trim();
  if (!s) return "";
  s = s.replace(/(?:\(|\[)?(?:전화|Tel|TEL|HP|휴대|핸드폰|연락처)[^)\]]*[)\]]?/giu, " ");
  s = s.replace(/\b\d{2,3}-\d{3,4}-\d{4}\b/gu, " ");
  s = s.replace(/\b0\d{1,2}-\d{3,4}-\d{4}\b/gu, " ");
  s = s.replace(/\s+/gu, " ").trim();
  return s;
}

function firstGuToken(rest: string): string | null {
  const m = /([가-힣]{2,8}구)/u.exec(rest);
  return m ? m[1]! : null;
}

function firstSiGunToken(rest: string): string | null {
  const m = /([가-힣]{2,8}(?:시|군))/u.exec(rest);
  return m ? m[1]! : null;
}

function stripAdminSuffix(name: string): string {
  return name.replace(/(?:시|군)$/u, "").trim();
}

/**
 * 주소 한 줄(또는 지역 한 줄)에서 목록용 regionLabel을 만든다.
 * 상세주소·읍면동·번지·전화는 사용하지 않는다.
 */
export function buildRegionLabelForSiteListSnapshot(addressOrLocationLine: string): string {
  const raw = stripNoiseForRegionParsing(addressOrLocationLine);
  if (!raw) return "";

  for (const { re, short } of METRO_RULES) {
    const m = re.exec(raw);
    if (!m) continue;
    const rest = raw.slice(m[0]!.length).trim();
    const gu = firstGuToken(rest);
    if (gu) return `${short} ${gu}`;
    return short;
  }

  for (const { re, short } of PROVINCE_HEAD) {
    const m = re.exec(raw);
    if (!m) continue;
    const rest = raw.slice(m[0]!.length).trim();
    const sig = firstSiGunToken(rest);
    if (sig) return `${short} ${stripAdminSuffix(sig)}`;
    return short;
  }

  return "";
}
