import {useTheme} from '@emotion/react';

import type {Organization} from 'sentry/types/organization';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';
import {BACKEND_COLUMN_TITLES} from 'sentry/views/performance/landing/data';
import {
  DoubleChartRow,
  TripleChartRow,
} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import Table from 'sentry/views/performance/table';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

import type {BasePerformanceViewProps} from './types';

function getAllowedChartsSmall(
  props: BasePerformanceViewProps,
  mepSetting: MetricsEnhancedSettingContext,
  organization: Organization
) {
  let charts = [
    PerformanceWidgetSetting.APDEX_AREA,
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.FAILURE_RATE_AREA,
    PerformanceWidgetSetting.USER_MISERY_AREA,
    PerformanceWidgetSetting.P50_DURATION_AREA,
    PerformanceWidgetSetting.P75_DURATION_AREA,
    PerformanceWidgetSetting.P95_DURATION_AREA,
    PerformanceWidgetSetting.P99_DURATION_AREA,
    PerformanceWidgetSetting.DURATION_HISTOGRAM,
  ];

  const hasTransactionSummaryCleanupFlag = organization.features.includes(
    'performance-transaction-summary-cleanup'
  );

  // user misery and apdex charts will be discontinued as me move to a span-centric architecture
  if (hasTransactionSummaryCleanupFlag) {
    charts = [
      PerformanceWidgetSetting.TPM_AREA,
      PerformanceWidgetSetting.FAILURE_RATE_AREA,
      PerformanceWidgetSetting.P50_DURATION_AREA,
      PerformanceWidgetSetting.P75_DURATION_AREA,
      PerformanceWidgetSetting.P95_DURATION_AREA,
      PerformanceWidgetSetting.P99_DURATION_AREA,
      PerformanceWidgetSetting.DURATION_HISTOGRAM,
    ];
  }

  return filterAllowedChartsMetrics(props.organization, charts, mepSetting);
}

export function BackendView(props: BasePerformanceViewProps) {
  const mepSetting = useMEPSettingContext();
  const {setPageError} = usePageAlert();
  const theme = useTheme();
  const organization = useOrganization();

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_DB_OPS,
  ];

  if (canUseMetricsData(props.organization)) {
    if (props.organization.features.includes('performance-new-trends')) {
      doubleChartRowCharts.push(PerformanceWidgetSetting.MOST_CHANGED);
    }

    if (props.organization.features.includes('insights-initial-modules')) {
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS);
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES);

      doubleChartRowCharts.unshift(
        PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
      );
    }
  } else {
    doubleChartRowCharts.push(
      ...[PerformanceWidgetSetting.MOST_REGRESSED, PerformanceWidgetSetting.MOST_IMPROVED]
    );
  }
  return (
    <PerformanceDisplayProvider value={{performanceType: ProjectPerformanceType.ANY}}>
      <div>
        <DoubleChartRow {...props} allowedCharts={doubleChartRowCharts} />
        <TripleChartRow
          {...props}
          allowedCharts={getAllowedChartsSmall(props, mepSetting, organization)}
        />
        <Table
          {...props}
          columnTitles={BACKEND_COLUMN_TITLES}
          setError={setPageError}
          theme={theme}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
