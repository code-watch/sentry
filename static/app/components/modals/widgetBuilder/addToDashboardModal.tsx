import {Fragment, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, Query} from 'history';

import {
  fetchDashboard,
  fetchDashboards,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Select} from 'sentry/components/core/select';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString, PageFilters, SelectValue} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {IndexedEventsSelectionAlert} from 'sentry/views/dashboards/indexedEventsSelectionAlert';
import type {
  DashboardDetails,
  DashboardListItem,
  Widget,
} from 'sentry/views/dashboards/types';
import {
  DEFAULT_WIDGET_NAME,
  DisplayType,
  MAX_WIDGETS,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  getDashboardFiltersFromURL,
  getSavedFiltersAsPageFilters,
  getSavedPageFilters,
} from 'sentry/views/dashboards/utils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {
  type DataSet,
  NEW_DASHBOARD_ID,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

type WidgetAsQueryParams = Query<{
  defaultTableColumns: string[];
  defaultTitle: string;
  defaultWidgetQuery: string;
  displayType: DisplayType;
  environment: string[];
  project: number[];
  source: string;
  dataset?: DataSet;
  end?: DateString;
  start?: DateString;
  statsPeriod?: string | null;
}>;

type AddToDashboardModalActions =
  | 'add-and-open-dashboard'
  | 'add-and-stay-on-current-page'
  | 'open-in-widget-builder';

export type AddToDashboardModalProps = {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  widgetAsQueryParams: WidgetAsQueryParams;
  actions?: AddToDashboardModalActions[];
  allowCreateNewDashboard?: boolean;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

const DEFAULT_ACTIONS: AddToDashboardModalActions[] = [
  'add-and-stay-on-current-page',
  'open-in-widget-builder',
];

function getFallbackWidgetTitle(widget: Widget): string {
  // Metric widgets have their default title derived from the query
  return widget.title === '' && widget.widgetType === WidgetType.METRICS
    ? DEFAULT_WIDGET_NAME
    : widget.title;
}

function AddToDashboardModal({
  Header,
  Body,
  Footer,
  closeModal,
  location,
  organization,
  router,
  selection,
  widget,
  widgetAsQueryParams,
  actions = DEFAULT_ACTIONS,
  allowCreateNewDashboard = true,
}: Props) {
  const api = useApi();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardDetails | null>(
    null
  );
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [newWidgetTitle, setNewWidgetTitle] = useState<string>(
    getFallbackWidgetTitle(widget)
  );

  // Set custom title, or fallback to default title for widget
  const updateWidgetTitle = (newTitle: string) => {
    if (newTitle === '') {
      setNewWidgetTitle(getFallbackWidgetTitle(widget));
      return;
    }
    setNewWidgetTitle(newTitle);
  };

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    fetchDashboards(api, organization.slug).then(response => {
      // If component has unmounted, dont set state
      if (unmounted) {
        return;
      }

      setDashboards(response);
    });

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug]);

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    if (selectedDashboardId === NEW_DASHBOARD_ID || selectedDashboardId === null) {
      setSelectedDashboard(null);
    } else {
      fetchDashboard(api, organization.slug, selectedDashboardId).then(response => {
        // If component has unmounted, dont set state
        if (unmounted) {
          return;
        }

        setSelectedDashboard(response);
      });
    }

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug, selectedDashboardId]);

  function goToDashboard(page: 'builder' | 'preview') {
    const dashboardsPath =
      selectedDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${organization.slug}/dashboards/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/`;

    const builderSuffix = 'widget-builder/widget/new/';

    const pathname =
      page === 'builder' ? `${dashboardsPath}${builderSuffix}` : dashboardsPath;

    router.push(
      normalizeUrl({
        pathname,
        query: {
          ...widgetAsQueryParams,
          title: newWidgetTitle,
          ...(selectedDashboard ? getSavedPageFilters(selectedDashboard) : {}),
        },
      })
    );
    closeModal();
  }

  async function handleAddWidget() {
    if (selectedDashboard === null) {
      return;
    }

    let orderby = widget.queries[0]!.orderby;
    if (!(DisplayType.AREA && widget.queries[0]!.columns.length)) {
      orderby = ''; // Clear orderby if its not a top n visualization.
    }
    const query = widget.queries[0]!;

    const newWidget = {
      ...widget,
      title: newWidgetTitle,
      queries: [{...query, orderby}],
    };

    const newDashboard = {
      ...selectedDashboard,
      widgets: [...selectedDashboard.widgets, newWidget],
    };

    await updateDashboard(api, organization.slug, newDashboard);
  }

  async function handleAddAndStayOnCurrentPage() {
    await handleAddWidget();

    closeModal();
    addSuccessMessage(t('Successfully added widget to dashboard'));
  }

  async function handleAddAndOpenDashboard() {
    await handleAddWidget();

    goToDashboard('preview');
  }

  const canSubmit = selectedDashboardId !== null;

  const options = useMemo(() => {
    if (dashboards === null) {
      return null;
    }

    return [
      allowCreateNewDashboard && {
        label: t('+ Create New Dashboard'),
        value: 'new',
      },
      ...dashboards.map(({title, id, widgetDisplay}) => ({
        label: title,
        value: id,
        disabled: widgetDisplay.length >= MAX_WIDGETS,
        tooltip:
          widgetDisplay.length >= MAX_WIDGETS &&
          tct('Max widgets ([maxWidgets]) per dashboard reached.', {
            maxWidgets: MAX_WIDGETS,
          }),
        tooltipOptions: {position: 'right'},
      })),
    ].filter(Boolean) as Array<SelectValue<string>>;
  }, [allowCreateNewDashboard, dashboards]);

  const widgetLegendState = new WidgetLegendSelectionState({
    location,
    navigate,
    organization,
    dashboard: selectedDashboard,
  });

  const unselectedReleasesForCharts = {
    [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend('Releases', widget.id)]:
      false,
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <Select
            disabled={dashboards === null}
            menuPlacement="auto"
            name="dashboard"
            placeholder={t('Select Dashboard')}
            value={selectedDashboardId}
            options={options}
            onChange={(option: SelectValue<string>) => {
              if (option.disabled) {
                return;
              }
              setSelectedDashboardId(option.value);
            }}
          />
        </Wrapper>
        <Wrapper>
          <SectionHeader title={t('Widget Name')} optional />
          <Input
            type="text"
            aria-label={t('Optional Widget Name')}
            placeholder={t('Name')}
            onChange={e => updateWidgetTitle(e.target.value)}
          />
        </Wrapper>
        <Wrapper>
          {t(
            'Any conflicting filters from this query will be overridden by Dashboard filters. This is a preview of how the widget will appear in your dashboard.'
          )}
        </Wrapper>
        <MetricsCardinalityProvider organization={organization} location={location}>
          <MetricsDataSwitcher
            organization={organization}
            eventView={eventViewFromWidget(newWidgetTitle, widget.queries[0]!, selection)}
            location={location}
            hideLoadingIndicator
          >
            {metricsDataSide => (
              <DashboardsMEPProvider>
                <MEPSettingProvider
                  location={location}
                  forceTransactions={metricsDataSide.forceTransactionsOnly}
                >
                  <WidgetCard
                    organization={organization}
                    isEditingDashboard={false}
                    showContextMenu={false}
                    widgetLimitReached={false}
                    selection={
                      selectedDashboard
                        ? getSavedFiltersAsPageFilters(selectedDashboard)
                        : selection
                    }
                    dashboardFilters={
                      getDashboardFiltersFromURL(location) ?? selectedDashboard?.filters
                    }
                    widget={{...widget, title: newWidgetTitle}}
                    shouldResize={false}
                    widgetLegendState={widgetLegendState}
                    onLegendSelectChanged={() => {}}
                    legendOptions={
                      widgetLegendState.widgetRequiresLegendUnselection(widget)
                        ? {selected: unselectedReleasesForCharts}
                        : undefined
                    }
                    disableFullscreen
                  />

                  <IndexedEventsSelectionAlert widget={widget} />
                </MEPSettingProvider>
              </DashboardsMEPProvider>
            )}
          </MetricsDataSwitcher>
        </MetricsCardinalityProvider>
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          {actions.includes('add-and-stay-on-current-page') && (
            <Button
              onClick={handleAddAndStayOnCurrentPage}
              disabled={!canSubmit || selectedDashboardId === NEW_DASHBOARD_ID}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Add + Stay on this Page')}
            </Button>
          )}
          {actions.includes('add-and-open-dashboard') && (
            <Button
              onClick={handleAddAndOpenDashboard}
              disabled={!canSubmit}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Add + Open Dashboard')}
            </Button>
          )}
          {actions.includes('open-in-widget-builder') && (
            <Button
              priority="primary"
              onClick={() => goToDashboard('builder')}
              disabled={!canSubmit}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Open in Widget Builder')}
            </Button>
          )}
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export default AddToDashboardModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
`;
