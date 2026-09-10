import { XMLParser } from 'fast-xml-parser';

export const RCN_WFS_URL = 'https://mapy.geoportal.gov.pl/wss/service/rcn';
export const WARSAW_TERYT = '1465';

// Verified empirically (2026-09-10, curl) against the live endpoint before writing this:
// `CQL_FILTER` (the GeoServer-style vendor param assumed during the spike) is silently
// ignored by this MapServer WFS — it always returns the same first page regardless of the
// filter. The standards-compliant `FILTER` param (OGC Filter Encoding 2.0 XML) IS honoured,
// but `PropertyIsEqualTo` on `teryt` specifically makes the PostGIS backend error out
// (`FLTApplyFilterToLayer() failed` / `Query error`) even though the same field filters fine
// via other operators, and `PropertyIsEqualTo` on other fields (e.g. `tran_rodzaj_rynku`)
// works. `PropertyIsLike` with no wildcard characters in the literal — an exact match in
// effect — filters `teryt` correctly and was confirmed to return only teryt=1465 rows.
function buildTerytFilter(teryt: string): string {
  return (
    '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">' +
    '<fes:PropertyIsLike wildCard="*" singleChar="." escapeChar="!">' +
    '<fes:ValueReference>teryt</fes:ValueReference>' +
    `<fes:Literal>${teryt}</fes:Literal>` +
    '</fes:PropertyIsLike>' +
    '</fes:Filter>'
  );
}

export function buildRcnFeatureUrl(options: { teryt?: string; count?: number } = {}): string {
  const { teryt = WARSAW_TERYT, count = 1000 } = options;
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'ms:lokale',
    count: String(count),
    FILTER: buildTerytFilter(teryt),
  });
  return `${RCN_WFS_URL}?${params.toString()}`;
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

interface RcnFeaturePage {
  xml: string;
  numberReturned: number;
  nextUrl: string | null;
}

async function fetchRcnFeaturePage(url: string): Promise<RcnFeaturePage> {
  const response = await fetch(url, {
    headers: {
      // Plain fetch works today, but a realistic UA keeps this resilient — same reasoning
      // as the NBP downloader (see etl/nbp/download.ts).
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`RCN WFS request failed: HTTP ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();

  // The server's Content-Type header is unreliable here (it reports text/html even on
  // success — verified via curl -I), so error detection has to look at the body instead of
  // trusting response headers.
  if (xml.includes('ExceptionReport')) {
    throw new Error(`RCN WFS returned an exception report: ${xml.slice(0, 500)}`);
  }

  const parsed: unknown = xmlParser.parse(xml);
  const featureCollection = (parsed as Record<string, unknown>)?.['wfs:FeatureCollection'] as
    Record<string, unknown> | undefined;

  if (!featureCollection) {
    throw new Error(
      `RCN WFS response did not contain a wfs:FeatureCollection root: ${xml.slice(0, 500)}`,
    );
  }

  const numberReturned = Number(featureCollection['@_numberReturned'] ?? 0);
  const nextUrl = (featureCollection['@_next'] as string | undefined) ?? null;

  return { xml, numberReturned, nextUrl };
}

/**
 * Fetches every page of `ms:lokale` features for the given TERYT code, following the
 * `next` link the server embeds in each `wfs:FeatureCollection` response instead of
 * computing STARTINDEX ourselves — the server is the source of truth for how to reach the
 * next page.
 */
export async function* fetchAllRcnFeaturePages(
  options: { teryt?: string; pageSize?: number } = {},
): AsyncGenerator<string> {
  const { teryt = WARSAW_TERYT, pageSize = 1000 } = options;

  let url: string | null = buildRcnFeatureUrl({ teryt, count: pageSize });

  while (url) {
    const page: RcnFeaturePage = await fetchRcnFeaturePage(url);
    yield page.xml;
    url = page.nextUrl;
  }
}
