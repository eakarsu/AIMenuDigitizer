export interface SearchParams {
  search: string;
  filters: Record<string, string>;
}

export function parseSearch(query: any): SearchParams {
  const search = (query.search || '').trim();
  const filters: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('filter_') && typeof value === 'string') {
      filters[key.replace('filter_', '')] = value;
    }
  }

  return { search, filters };
}
