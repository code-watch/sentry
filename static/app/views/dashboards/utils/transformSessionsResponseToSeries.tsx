import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DERIVED_STATUS_METRICS_PATTERN} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {
  derivedMetricsToField,
  resolveDerivedStatusFields,
} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

function getSeriesName(
  field: string,
  group: SessionApiResponse['groups'][number],
  queryAlias?: string
) {
  const groupName = Object.entries(group.by)
    .map(([_, value]) => `${value}`)
    .join(', ');
  const seriesName = groupName
    ? `${groupName} : ${derivedMetricsToField(field)}`
    : derivedMetricsToField(field);
  return `${queryAlias ? `${queryAlias} > ` : ''}${seriesName}`;
}

export function transformSessionsResponseToSeries(
  data: SessionApiResponse,
  widgetQuery: WidgetQuery
) {
  if (data === null) {
    return [];
  }

  const queryAlias = widgetQuery.name;

  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {derivedStatusFields: requestedStatusMetrics, injectedFields} =
    resolveDerivedStatusFields(
      widgetQuery.aggregates,
      widgetQuery.orderby,
      useSessionAPI
    );

  const results: Series[] = [];

  if (!data.groups.length) {
    return [
      {
        seriesName: `(${t('no results')})`,
        data: data.intervals.map(interval => ({
          name: interval,
          value: 0,
        })),
      },
    ];
  }

  data.groups.forEach(group => {
    Object.keys(group.series).forEach(field => {
      // if `sum(session)` or `count_unique(user)` are not
      // requested as a part of the payload for
      // derived status metrics through the Sessions API,
      // they are injected into the payload and need to be
      // stripped.
      if (!injectedFields.includes(derivedMetricsToField(field))) {
        results.push({
          seriesName: getSeriesName(field, group, queryAlias),
          data: data.intervals.map((interval, index) => ({
            name: interval,
            value: group.series[field]?.[index] ?? 0,
          })),
        });
      }
    });
    // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`
    if (requestedStatusMetrics.length && defined(group.by['session.status'])) {
      requestedStatusMetrics.forEach(status => {
        const result = status.match(DERIVED_STATUS_METRICS_PATTERN);
        if (result) {
          let metricField: string | undefined = undefined;
          if (group.by['session.status'] === result[1]) {
            if (result[2] === 'session') {
              metricField = 'sum(session)';
            } else if (result[2] === 'user') {
              metricField = 'count_unique(user)';
            }
          }
          results.push({
            seriesName: getSeriesName(status, group, queryAlias),
            data: data.intervals.map((interval, index) => ({
              name: interval,
              value: metricField ? (group.series[metricField]?.[index] ?? 0) : 0,
            })),
          });
        }
      });
    }
  });

  return results;
}
