import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export interface RcnRawFeature {
  id: string;
  teryt: string;
  market: string;
  transactionDate: string;
  areaM2: number | null;
  priceGross: number;
  address: string | null;
  rooms: number | null;
  floor: number | null;
}

export interface ParsedRcnPage {
  features: RcnRawFeature[];
  skippedIncomplete: number;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Parses one WFS GetFeature response page and drops incomplete records — confirmed on
 * live data (2026-09-10, e.g. lokale.23699566) that some ms:lokale features have every
 * other field populated but an empty lok_cena_brutto, apparently because the price was
 * only recorded at the whole-transaction level (tran_cena_brutto) rather than allocated
 * per unit. Without a usable price these can't contribute to price_per_m2, so they're
 * filtered out here instead of failing later during normalization.
 *
 * How common this is varies enormously by city/powiat, not just the odd stray record:
 * confirmed live (2026-09-11) that Lublin (teryt 0663) and Szczecin (teryt 3262) each
 * have ~99.9% of their ms:lokale rows missing lok_cena_brutto (999/1000 in a real,
 * reproducible sample for both — not a fluke of one page), vs. ~0.3% for Warszawa. Some
 * local offices apparently record almost none of their transactions at the per-unit price
 * level. Real, verified per-city gap in the source — not a bug here.
 */
export function parseRcnFeaturePage(xml: string): ParsedRcnPage {
  const parsed: unknown = xmlParser.parse(xml);
  const featureCollection = (parsed as Record<string, unknown>)['wfs:FeatureCollection'] as
    Record<string, unknown> | undefined;

  const members = toArray(featureCollection?.['wfs:member'] as unknown | unknown[]);

  const features: RcnRawFeature[] = [];
  let skippedIncomplete = 0;

  for (const member of members) {
    const lokale = (member as Record<string, unknown>)['ms:lokale'] as
      Record<string, unknown> | undefined;
    if (!lokale) continue;

    const priceGross = toNullableNumber(lokale['ms:lok_cena_brutto']);
    if (priceGross === null) {
      skippedIncomplete++;
      continue;
    }

    features.push({
      id: String(lokale['@_gml:id']),
      // fast-xml-parser's default numeric coercion turns "<ms:teryt>0264</ms:teryt>" (a
      // real value — Wrocław) into the number 264, silently dropping the leading zero.
      // Every real teryt here is exactly 4 digits, so padStart is a safe, targeted fix
      // without disabling number parsing globally (other fields, e.g. lok_cena_brutto,
      // rely on it). Found for real (2026-09-11): a full Wrocław pull mislabeled all
      // ~22.7k of its rows as city "264" instead of "Wrocław" before this fix.
      teryt: String(lokale['ms:teryt']).padStart(4, '0'),
      market: String(lokale['ms:tran_rodzaj_rynku']),
      transactionDate: String(lokale['ms:dok_data']),
      areaM2: toNullableNumber(lokale['ms:lok_pow_uzyt']),
      priceGross,
      address: toNullableString(lokale['ms:lok_adres']),
      rooms: toNullableNumber(lokale['ms:lok_liczba_izb']),
      floor: toNullableNumber(lokale['ms:lok_nr_kond']),
    });
  }

  return { features, skippedIncomplete };
}
