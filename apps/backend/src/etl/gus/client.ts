export const BDL_API_URL = 'https://bdl.stat.gov.pl/api/v1';

// Every major city is tracked as its own powiat-level unit in GUS's Bank Danych Lokalnych
// ("Powiat m. <city>"), found via `/units/search?name=<city>` and confirmed live
// (2026-09-11): `/data/by-unit/<id>?var-id=...` returns a real, non-empty series for both
// variables below, for every city here. Matches NBP's own "7 miast" grouping (ROADMAP.md
// sekcja 6: Warszawa + Gdańsk/Gdynia/Kraków/Łódź/Poznań/Wrocław), so all three data sources
// (NBP, RCN, GUS) cover the identical city set for Faza 6's comparison view.
export const WARSAW_UNIT_ID = '071412865000';

export const CITY_UNIT_IDS: Record<string, string> = {
  Warszawa: WARSAW_UNIT_ID,
  Kraków: '011212161000',
  Łódź: '051011661000',
  Wrocław: '030210564000',
  Poznań: '023016264000',
  Gdańsk: '042214361000',
  Gdynia: '042214362000',
};

// Subject P3787: "Mediana cen za 1 m2 lokali mieszkalnych sprzedanych w ramach transakcji
// rynkowych" — a genuine, government-computed median (not an average), confirmed via
// `/subjects/P3787` and cross-checked against `/variables?subject-id=P3787`. Only the
// "ogółem" (any size) breakdown per market is used — the subject also splits by floor-area
// bracket, which we don't need. There's also a combined-market ("ogółem"/"ogółem", id
// 633677) variable, unused here since our schema always ties a price to one `market`.
export const PRIMARY_MARKET_VARIABLE_ID = 633682;
export const SECONDARY_MARKET_VARIABLE_ID = 633687;

// attrId meanings from `/attributes`: 1 = "wartość" (a normal, confirmed value). Anything
// else (missing/confidential/preliminary-estimate/methodology-change flags) is excluded
// rather than trusted at face value — see fetchMedianPriceByYear.
const CONFIRMED_VALUE_ATTR_ID = 1;

interface BdlYearValue {
  year: string;
  val: number;
  attrId: number;
}

interface BdlDataResponse {
  results: { id: number; values: BdlYearValue[] }[];
}

export interface AnnualMedianByYear {
  values: Map<string, number>;
  skippedUnconfirmed: number;
}

/**
 * Fetches one GUS BDL variable's full yearly time series for a single unit (Warsaw by
 * default). The API has no pagination for a single unit/variable pair — one request
 * returns every available year at once.
 */
export async function fetchMedianPriceByYear(
  variableId: number,
  unitId: string = WARSAW_UNIT_ID,
): Promise<AnnualMedianByYear> {
  const url = `${BDL_API_URL}/data/by-unit/${unitId}?var-id=${variableId}&format=json&lang=pl`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GUS BDL request failed: HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as BdlDataResponse;
  const series = data.results[0];

  const values = new Map<string, number>();
  let skippedUnconfirmed = 0;

  for (const { year, val, attrId } of series?.values ?? []) {
    if (attrId !== CONFIRMED_VALUE_ATTR_ID) {
      skippedUnconfirmed++;
      continue;
    }
    values.set(year, val);
  }

  return { values, skippedUnconfirmed };
}
