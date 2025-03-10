import {useMemo} from 'react';

import {decodeList} from 'sentry/utils/queryString';

export function usePageParams(location: any) {
  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  return {
    queries,
  };
}
