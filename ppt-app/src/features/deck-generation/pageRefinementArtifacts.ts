export function normalizeResearchQueryKey(query: string): string {
  return query.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
