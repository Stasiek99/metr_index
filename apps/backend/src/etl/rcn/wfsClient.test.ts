import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRcnFeatureUrl, fetchAllRcnFeaturePages, WARSAW_TERYT } from './wfsClient.js';

function featureCollectionXml(options: {
  numberReturned: number;
  next?: string;
  teryt?: string;
}): string {
  const { numberReturned, next, teryt = WARSAW_TERYT } = options;
  const members = Array.from(
    { length: numberReturned },
    (_, i) => `
    <wfs:member>
      <ms:lokale gml:id="lokale.${i}">
        <ms:teryt>${teryt}</ms:teryt>
        <ms:lok_cena_brutto>500000</ms:lok_cena_brutto>
      </ms:lokale>
    </wfs:member>`,
  ).join('');

  const nextAttr = next ? ` next="${next}"` : '';

  return `<?xml version='1.0' encoding="UTF-8" ?>
<wfs:FeatureCollection
   xmlns:ms="http://mapserver.gis.umn.edu/mapserver"
   xmlns:wfs="http://www.opengis.net/wfs/2.0"
   numberMatched="unknown" numberReturned="${numberReturned}"${nextAttr}>${members}
</wfs:FeatureCollection>`;
}

function mockFetchSequence(responses: { xml: string; ok?: boolean; status?: number }[]): void {
  const fetchMock = vi.fn();
  for (const { xml, ok = true, status = 200 } of responses) {
    fetchMock.mockImplementationOnce(async () => ({
      ok,
      status,
      statusText: 'status text',
      text: async () => xml,
    }));
  }
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildRcnFeatureUrl', () => {
  it('targets ms:lokale with a FILTER on teryt, defaulting to Warsaw', () => {
    const url = new URL(buildRcnFeatureUrl());

    expect(url.searchParams.get('service')).toBe('WFS');
    expect(url.searchParams.get('typeNames')).toBe('ms:lokale');
    expect(url.searchParams.get('FILTER')).toContain(
      '<fes:ValueReference>teryt</fes:ValueReference>',
    );
    expect(url.searchParams.get('FILTER')).toContain(`<fes:Literal>${WARSAW_TERYT}</fes:Literal>`);
  });

  it('allows overriding teryt and page size', () => {
    const url = new URL(buildRcnFeatureUrl({ teryt: '9999', count: 50 }));

    expect(url.searchParams.get('count')).toBe('50');
    expect(url.searchParams.get('FILTER')).toContain('<fes:Literal>9999</fes:Literal>');
  });
});

describe('fetchAllRcnFeaturePages', () => {
  it('follows the next link until a page omits it', async () => {
    const page1 = featureCollectionXml({
      numberReturned: 2,
      next: 'https://mapy.geoportal.gov.pl/wss/service/rcn?STARTINDEX=2',
    });
    const page2 = featureCollectionXml({ numberReturned: 1 });
    mockFetchSequence([{ xml: page1 }, { xml: page2 }]);

    const pages: string[] = [];
    for await (const xml of fetchAllRcnFeaturePages({ pageSize: 2 })) {
      pages.push(xml);
    }

    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain('lokale.0');
    expect(pages[1]).toContain('lokale.0');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      'https://mapy.geoportal.gov.pl/wss/service/rcn?STARTINDEX=2',
    );
  });

  it('stops immediately when the first page has no next link', async () => {
    mockFetchSequence([{ xml: featureCollectionXml({ numberReturned: 0 }) }]);

    const pages: string[] = [];
    for await (const xml of fetchAllRcnFeaturePages()) {
      pages.push(xml);
    }

    expect(pages).toHaveLength(1);
  });

  it('throws when the server responds with an OGC exception report', async () => {
    mockFetchSequence([
      {
        xml: '<ows:ExceptionReport><ows:Exception><ows:ExceptionText>bad filter</ows:ExceptionText></ows:Exception></ows:ExceptionReport>',
      },
    ]);

    const drain = async () => {
      for await (const xml of fetchAllRcnFeaturePages()) {
        void xml; // draining the generator should throw before yielding
      }
    };

    await expect(drain()).rejects.toThrow(/exception report/i);
  });

  it('throws on a non-ok HTTP response', async () => {
    mockFetchSequence([{ xml: '', ok: false, status: 403 }]);

    const drain = async () => {
      for await (const xml of fetchAllRcnFeaturePages()) {
        void xml; // draining the generator should throw before yielding
      }
    };

    await expect(drain()).rejects.toThrow(/HTTP 403/);
  });
});
