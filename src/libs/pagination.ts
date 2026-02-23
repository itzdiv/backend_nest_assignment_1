/*
  Pagination helper.

  Provides a reusable function to build paginated responses
  across all list endpoints. Ensures consistent response shape.

  Usage in any service:
    return paginate(items, total, page, limit);
*/

/*
  PaginatedResult<T> — generic type for paginated API responses.

  data: array of items for the current page.
  meta: pagination metadata.
    total: total number of matching records in DB.
    page: current page number (1-indexed).
    limit: items per page.
    totalPages: calculated total pages.
*/
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/*
  paginate() — builds a PaginatedResult.

  @param data  — array of items for the current page.
  @param total — total matching records count from DB.
  @param page  — current page number.
  @param limit — page size.
  @returns PaginatedResult<T> with data and meta.
*/
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      /*
        Math.ceil ensures partial last page is counted.
        Example: 25 items / 10 per page = 3 pages.
      */
      totalPages: Math.ceil(total / limit),
    },
  };
}
