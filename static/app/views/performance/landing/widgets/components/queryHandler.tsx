import {Fragment, useEffect, useLayoutEffect} from 'react';

import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {
  getIsMetricsDataFromResults,
  useMEPDataContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import type {
  QueryDefinitionWithKey,
  QueryHandlerProps,
  WidgetDataConstraint,
} from 'sentry/views/performance/landing/widgets/types';
import type {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';

/**
 * Component to handle switching component-style queries over to state. This
 * should be temporary to make it easier to switch away from waterfall style
 * api components.
 */
export function QueryHandler<T extends WidgetDataConstraint>(
  props: QueryHandlerProps<T>
) {
  const children = props.children ?? <Fragment />;

  if (!props.queries.length) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Fragment>
      {props.queries
        .filter(q => (q.enabled ? q.enabled(props.widgetData) : true))
        .map(query => (
          <SingleQueryHandler key={query.queryKey} {...props} query={query} />
        ))}
    </Fragment>
  );
}

function genericQueryReferrer(setting: PerformanceWidgetSetting) {
  return `api.performance.generic-widget-chart.${setting.replace(/_/g, '-')}`;
}

function SingleQueryHandler<T extends WidgetDataConstraint>(
  props: QueryHandlerProps<T> & {query: QueryDefinitionWithKey<T>}
) {
  const query = props.query;
  const globalSelection = props.queryProps.eventView.getPageFilters();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : null;

  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : null;

  useEffect(
    () => () => {
      // Destroy previous data on unmount, in case enabled value changes and unmounts the query component.
      props.removeWidgetDataForKey(query.queryKey);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <query.component
      key={query.queryKey}
      fields={query.fields}
      yAxis={query.fields}
      start={start}
      end={end}
      period={globalSelection.datetime.period}
      project={globalSelection.projects}
      environment={globalSelection.environments}
      organization={props.queryProps.organization}
      orgSlug={props.queryProps.organization.slug}
      eventView={props.queryProps.eventView}
      query={props.queryProps.eventView.getQueryWithAdditionalConditions()}
      widgetData={props.widgetData}
      referrer={genericQueryReferrer(props.queryProps.chartSetting)}
    >
      {results => {
        return (
          <Fragment>
            <QueryResultSaver<T> results={results} {...props} query={query} />
          </Fragment>
        );
      }}
    </query.component>
  );
}

function QueryResultSaver<T extends WidgetDataConstraint>(
  props: {
    // TODO(k-fish): Fix this any.
    query: QueryDefinitionWithKey<T>;
    results: any;
  } & QueryHandlerProps<T>
) {
  const mepContext = useMEPDataContext();
  const {results, query} = props;

  const transformed = query.transform(props.queryProps, results, props.query);

  useLayoutEffect(() => {
    const isMetricsData = getIsMetricsDataFromResults(
      results,
      props.queryProps.fields[0]
    );
    mepContext.setIsMetricsData(isMetricsData);
    props.setWidgetDataForKey(query.queryKey, transformed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformed?.hasData, transformed?.isLoading, transformed?.isErrored]);
  return <Fragment />;
}
