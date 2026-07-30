import { secFetchJson, secFetchText, cikToPadded } from './secClient.js';

interface SubmissionsRecent {
  form: string[];
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  primaryDocument: string[];
}
interface SubmissionsResponse {
  name: string;
  filings: { recent: SubmissionsRecent };
}

export interface FilingRef {
  accessionNumber: string;
  accessionNoDash: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}

export async function listFilings(cikPadded: string, form: string, limit: number): Promise<FilingRef[]> {
  const data = await secFetchJson<SubmissionsResponse>(
    `https://data.sec.gov/submissions/CIK${cikPadded}.json`,
    10 * 60_000,
  );
  const r = data.filings.recent;
  const refs: FilingRef[] = [];
  for (let i = 0; i < r.form.length && refs.length < limit; i++) {
    if (r.form[i] !== form) continue;
    refs.push({
      accessionNumber: r.accessionNumber[i],
      accessionNoDash: r.accessionNumber[i].replace(/-/g, ''),
      filingDate: r.filingDate[i],
      reportDate: r.reportDate[i],
      primaryDocument: r.primaryDocument[i],
    });
  }
  return refs;
}

export function primaryDocBasename(primaryDocument: string): string {
  return primaryDocument.split('/').pop()!;
}

export function filingDocUrl(cik: string, accessionNoDash: string, filename: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNoDash}/${filename}`;
}

export async function fetchFilingDocXml(
  cik: string,
  accessionNoDash: string,
  filename: string,
): Promise<string> {
  return secFetchText(filingDocUrl(cik, accessionNoDash, filename), 60 * 60_000);
}

interface DirectoryListing {
  directory: { item: { name: string; type?: string }[] };
}

/**
 * 13F information tables aren't named consistently, so we list the filing's own directory and
 * pick the XML file that isn't the cover-page primary_doc.xml.
 */
export async function findInformationTableFile(cik: string, accessionNoDash: string): Promise<string | null> {
  const listing = await secFetchJson<DirectoryListing>(
    `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNoDash}/index.json`,
    60 * 60_000,
  );
  const xmlFiles = listing.directory.item
    .map((i) => i.name)
    .filter((name) => name.toLowerCase().endsWith('.xml') && name.toLowerCase() !== 'primary_doc.xml');
  return xmlFiles[0] ?? null;
}

export { cikToPadded };
