import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button, LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  useExploreFields,
  useExploreGroupBys,
  useExploreId,
  useExploreMode,
  useExploreQuery,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {generateExploreCompareRoute} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ToolbarSection} from 'sentry/views/explore/toolbar/styles';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

export function ToolbarSaveAs() {
  const {addToDashboard} = useAddToDashboard();
  const {updateQuery, saveQuery} = useSaveQuery();
  const location = useLocation();
  const organization = useOrganization();

  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const query = useExploreQuery();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();
  const fields = useExploreFields();
  const sortBys = useExploreSortBys();
  const mode = useExploreMode();
  const id = useExploreId();
  const visualizeYAxes = visualizes.flatMap(v => v.yAxes);

  const [interval] = useChartInterval();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  const alertsUrls = visualizeYAxes.map((yAxis, index) => {
    const func = parseFunction(yAxis);
    const label = func ? prettifyParsedFunction(func) : yAxis;
    return {
      key: `${yAxis}-${index}`,
      label,
      to: getAlertsUrl({
        project,
        query,
        pageFilters: pageFilters.selection,
        aggregate: yAxis,
        organization,
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        interval,
      }),
      onAction: () => {
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'alert',
          ui_source: 'toolbar',
          organization,
        });
      },
    };
  });

  const items: MenuItemProps[] = [];

  if (organization.features.includes('performance-saved-queries')) {
    if (defined(id)) {
      items.push({
        key: 'update-query',
        label: (
          <span>
            {t('Existing Query')}
            <FeatureBadge type="alpha" />
          </span>
        ),
        onAction: async () => {
          try {
            addLoadingMessage(t('Updating query...'));
            await updateQuery();
            addSuccessMessage(t('Query updated successfully'));
            trackAnalytics('trace_explorer.save_as', {
              save_type: 'update_query',
              ui_source: 'toolbar',
              organization,
            });
          } catch (error) {
            addErrorMessage(t('Failed to update query'));
            Sentry.captureException(error);
          }
        },
      });
    }
    items.push({
      key: 'save-query',
      label: (
        <span>
          {t('A New Query')}
          <FeatureBadge type="alpha" />
        </span>
      ),
      onAction: () => {
        openSaveQueryModal({
          organization,
          queries: [
            {
              query,
              groupBys: mode === Mode.AGGREGATE ? groupBys : [],
              visualizes,
            },
          ],
          saveQuery,
        });
      },
    });
  }

  if (organization.features.includes('alerts-eap')) {
    items.push({
      key: 'create-alert',
      label: t('An Alert for'),
      children: alertsUrls ?? [],
      disabled: !alertsUrls || alertsUrls.length === 0,
      isSubmenu: true,
    });
  }

  if (organization.features.includes('dashboards-eap')) {
    const disableAddToDashboard = !organization.features.includes('dashboards-edit');

    const chartOptions = visualizes.map((chart, index) => {
      const dedupedYAxes = dedupeArray(chart.yAxes);
      const formattedYAxes = dedupedYAxes.map(yaxis => {
        const func = parseFunction(yaxis);
        return func ? prettifyParsedFunction(func) : undefined;
      });

      return {
        key: chart.label,
        label: t('%s - %s', chart.label, formattedYAxes.filter(Boolean).join(', ')),
        onAction: () => {
          if (disableAddToDashboard) {
            return undefined;
          }

          trackAnalytics('trace_explorer.save_as', {
            save_type: 'dashboard',
            ui_source: 'toolbar',
            organization,
          });
          return addToDashboard(index);
        },
      };
    });
    items.push({
      key: 'add-to-dashboard',
      textValue: t('A Dashboard widget'),
      isSubmenu: chartOptions.length > 1 ? true : false,
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('A Dashboard widget')}</DisabledText>}
        >
          {t('A Dashboard widget')}
        </Feature>
      ),
      disabled: disableAddToDashboard,
      children: chartOptions.length > 1 ? chartOptions : undefined,
      onAction: () => {
        if (disableAddToDashboard || chartOptions.length > 1) {
          return undefined;
        }

        trackAnalytics('trace_explorer.save_as', {
          save_type: 'dashboard',
          ui_source: 'toolbar',
          organization,
        });
        return addToDashboard(0);
      },
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <ToolbarSection data-test-id="section-save-as">
      <ButtonBar gap={1}>
        <DropdownMenu
          items={items}
          trigger={triggerProps => (
            <SaveAsButton
              {...triggerProps}
              aria-label={t('Save as')}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();

                triggerProps.onClick?.(e);
              }}
            >
              {`${t('Save as')}\u2026`}
            </SaveAsButton>
          )}
        />
        {organization.features.includes('explore-multi-query') && (
          <LinkButton
            aria-label={t('Compare')}
            onClick={() =>
              trackAnalytics('trace_explorer.compare', {
                organization,
              })
            }
            to={generateExploreCompareRoute({
              organization,
              mode,
              location,
              query,
              yAxes: [visualizeYAxes[0]!],
              groupBys,
              fields,
              sortBys,
            })}
          >{`${t('Compare Queries')}`}</LinkButton>
        )}
      </ButtonBar>
    </ToolbarSection>
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;

const SaveAsButton = styled(Button)`
  width: 100%;
`;
