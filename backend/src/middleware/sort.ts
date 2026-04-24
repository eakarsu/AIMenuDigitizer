export interface SortParams {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

export function parseSort(query: any, allowedFields: string[]): SortParams {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : allowedFields[0];
  const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return { sortBy, sortOrder };
}
