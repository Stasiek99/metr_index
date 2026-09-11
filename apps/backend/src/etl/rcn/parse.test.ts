import { describe, expect, it } from 'vitest';
import { parseRcnFeaturePage } from './parse.js';

function wrapMembers(membersXml: string): string {
  return `<?xml version='1.0' encoding="UTF-8" ?>
<wfs:FeatureCollection
   xmlns:ms="http://mapserver.gis.umn.edu/mapserver"
   xmlns:wfs="http://www.opengis.net/wfs/2.0"
   numberMatched="unknown" numberReturned="2">${membersXml}
</wfs:FeatureCollection>`;
}

// Shape mirrors a real feature captured live from the endpoint (2026-09-10).
const COMPLETE_FEATURE = `
  <wfs:member>
    <ms:lokale gml:id="lokale.23301074">
      <ms:teryt>1465</ms:teryt>
      <ms:tran_rodzaj_rynku>wtorny</ms:tran_rodzaj_rynku>
      <ms:dok_data>2026-02-16 01:00:00+01</ms:dok_data>
      <ms:lok_pow_uzyt>30.29</ms:lok_pow_uzyt>
      <ms:lok_cena_brutto>192700</ms:lok_cena_brutto>
      <ms:lok_adres>MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15</ms:lok_adres>
      <ms:lok_liczba_izb>2</ms:lok_liczba_izb>
      <ms:lok_nr_kond>3</ms:lok_nr_kond>
    </ms:lokale>
  </wfs:member>`;

// Real, live-observed case (lokale.23699566, 2026-09-10): every other field populated,
// but lok_cena_brutto is an empty element — only tran_cena_brutto (whole-transaction
// price) was recorded.
const INCOMPLETE_FEATURE = `
  <wfs:member>
    <ms:lokale gml:id="lokale.23699566">
      <ms:teryt>1465</ms:teryt>
      <ms:tran_rodzaj_rynku>wtorny</ms:tran_rodzaj_rynku>
      <ms:tran_cena_brutto>17256330</ms:tran_cena_brutto>
      <ms:dok_data>2026-02-16 01:00:00+01</ms:dok_data>
      <ms:lok_pow_uzyt>4825.3</ms:lok_pow_uzyt>
      <ms:lok_cena_brutto></ms:lok_cena_brutto>
      <ms:lok_adres></ms:lok_adres>
    </ms:lokale>
  </wfs:member>`;

describe('parseRcnFeaturePage', () => {
  it('parses a complete feature into a raw record', () => {
    const { features, skippedIncomplete } = parseRcnFeaturePage(wrapMembers(COMPLETE_FEATURE));

    expect(skippedIncomplete).toBe(0);
    expect(features).toEqual([
      {
        id: 'lokale.23301074',
        teryt: '1465',
        market: 'wtorny',
        transactionDate: '2026-02-16 01:00:00+01',
        areaM2: 30.29,
        priceGross: 192700,
        address: 'MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15',
        rooms: 2,
        floor: 3,
      },
    ]);
  });

  it('drops a feature with an empty lok_cena_brutto and counts it as skipped', () => {
    const { features, skippedIncomplete } = parseRcnFeaturePage(wrapMembers(INCOMPLETE_FEATURE));

    expect(features).toHaveLength(0);
    expect(skippedIncomplete).toBe(1);
  });

  it('keeps complete features and drops incomplete ones from the same page', () => {
    const { features, skippedIncomplete } = parseRcnFeaturePage(
      wrapMembers(COMPLETE_FEATURE + INCOMPLETE_FEATURE),
    );

    expect(features).toHaveLength(1);
    expect(features[0]?.id).toBe('lokale.23301074');
    expect(skippedIncomplete).toBe(1);
  });

  it('handles a single-member page without treating it as a scalar', () => {
    const { features } = parseRcnFeaturePage(wrapMembers(COMPLETE_FEATURE));

    expect(features).toHaveLength(1);
  });

  it('handles a page with zero members', () => {
    const { features, skippedIncomplete } = parseRcnFeaturePage(wrapMembers(''));

    expect(features).toHaveLength(0);
    expect(skippedIncomplete).toBe(0);
  });

  it('treats an empty lok_adres as null rather than an empty string', () => {
    const { features } = parseRcnFeaturePage(wrapMembers(COMPLETE_FEATURE + INCOMPLETE_FEATURE));

    expect(features[0]?.address).toBe('MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15');
  });

  it('treats a missing lok_liczba_izb/lok_nr_kond as null rather than throwing', () => {
    const featureWithoutRoomsOrFloor = `
      <wfs:member>
        <ms:lokale gml:id="lokale.1">
          <ms:teryt>1465</ms:teryt>
          <ms:tran_rodzaj_rynku>wtorny</ms:tran_rodzaj_rynku>
          <ms:dok_data>2026-02-16 01:00:00+01</ms:dok_data>
          <ms:lok_pow_uzyt>30.29</ms:lok_pow_uzyt>
          <ms:lok_cena_brutto>192700</ms:lok_cena_brutto>
        </ms:lokale>
      </wfs:member>`;

    const { features } = parseRcnFeaturePage(wrapMembers(featureWithoutRoomsOrFloor));

    expect(features[0]?.rooms).toBeNull();
    expect(features[0]?.floor).toBeNull();
  });

  it('preserves a leading zero in teryt (real bug: "0264" parsed as number 264 by fast-xml-parser)', () => {
    const wroclawFeature = `
      <wfs:member>
        <ms:lokale gml:id="lokale.1">
          <ms:teryt>0264</ms:teryt>
          <ms:tran_rodzaj_rynku>wtorny</ms:tran_rodzaj_rynku>
          <ms:dok_data>2026-02-16 01:00:00+01</ms:dok_data>
          <ms:lok_pow_uzyt>30.29</ms:lok_pow_uzyt>
          <ms:lok_cena_brutto>192700</ms:lok_cena_brutto>
        </ms:lokale>
      </wfs:member>`;

    const { features } = parseRcnFeaturePage(wrapMembers(wroclawFeature));

    expect(features[0]?.teryt).toBe('0264');
  });
});
