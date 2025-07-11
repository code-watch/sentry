import {useRef} from 'react';
import styled from '@emotion/styled';

import {
  deleteMonitorEnvironment,
  setEnvironmentIsMuted,
  updateMonitor,
} from 'sentry/actionCreators/monitors';
import {DateNavigator} from 'sentry/components/checkInTimeline/dateNavigator';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useDateNavigation} from 'sentry/components/checkInTimeline/hooks/useDateNavigation';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import Panel from 'sentry/components/panels/panel';
import {Sticky} from 'sentry/components/sticky';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {CronServiceIncidents} from 'sentry/views/insights/crons/components/serviceIncidents';
import type {Monitor} from 'sentry/views/insights/crons/types';
import {makeMonitorListQueryKey} from 'sentry/views/insights/crons/utils';

import {OverviewRow} from './overviewRow';
import {SortSelector} from './sortSelector';

interface Props {
  monitorList: Monitor[];
}

export function OverviewTimeline({monitorList}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const location = useLocation();

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);

  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const dateNavigation = useDateNavigation();

  const handleDeleteEnvironment = async (monitor: Monitor, env: string) => {
    const success = await deleteMonitorEnvironment(api, organization.slug, monitor, env);
    if (!success) {
      return;
    }

    const queryKey = makeMonitorListQueryKey(organization, location.query);
    setApiQueryData<Monitor[]>(queryClient, queryKey, oldMonitorList => {
      if (!oldMonitorList) {
        return undefined;
      }
      const oldMonitorIdx = oldMonitorList.findIndex(m => m.slug === monitor.slug);
      if (oldMonitorIdx < 0) {
        return oldMonitorList;
      }

      const oldMonitor = oldMonitorList[oldMonitorIdx]!;
      const newEnvList = oldMonitor.environments.filter(e => e.name !== env);
      const updatedMonitor = {
        ...oldMonitor,
        environments: newEnvList,
      };

      const left = oldMonitorList.slice(0, oldMonitorIdx);
      const right = oldMonitorList.slice(oldMonitorIdx + 1);

      if (newEnvList.length === 0) {
        return [...left, ...right];
      }

      return [...left, updatedMonitor, ...right];
    });
  };

  const handleToggleMuteEnvironment = async (
    monitor: Monitor,
    env: string,
    isMuted: boolean
  ) => {
    const resp = await setEnvironmentIsMuted(
      api,
      organization.slug,
      monitor,
      env,
      isMuted
    );

    if (resp === null) {
      return;
    }

    const queryKey = makeMonitorListQueryKey(organization, location.query);
    setApiQueryData<Monitor[]>(queryClient, queryKey, oldMonitorList => {
      return oldMonitorList
        ? // TODO(davidenwang): in future only change the specifically modified environment for optimistic updates
          oldMonitorList.map(m => (m.slug === monitor.slug ? resp : m))
        : undefined;
    });
  };

  const handleToggleStatus = async (monitor: Monitor) => {
    const status = monitor.status === 'active' ? 'disabled' : 'active';
    const resp = await updateMonitor(api, organization.slug, monitor, {status});

    if (resp === null) {
      return;
    }

    const queryKey = makeMonitorListQueryKey(organization, location.query);
    setApiQueryData<Monitor[]>(queryClient, queryKey, oldMonitorList => {
      return oldMonitorList
        ? oldMonitorList.map(m =>
            m.slug === monitor.slug ? {...m, status: resp.status} : m
          )
        : undefined;
    });
  };

  return (
    <MonitorListPanel role="region">
      <TimelineWidthTracker ref={elementRef} />
      <Header>
        <HeaderControlsLeft>
          <SortSelector size="xs" />
          <DateNavigator
            dateNavigation={dateNavigation}
            direction="back"
            size="xs"
            borderless
          />
        </HeaderControlsLeft>
        <AlignedGridLineLabels timeWindowConfig={timeWindowConfig} />
        <HeaderControlsRight>
          <DateNavigator
            dateNavigation={dateNavigation}
            direction="forward"
            size="xs"
            borderless
          />
        </HeaderControlsRight>
      </Header>
      <AlignedGridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        cursorOffsets={{right: 40}}
        additionalUi={<CronServiceIncidents timeWindowConfig={timeWindowConfig} />}
        timeWindowConfig={timeWindowConfig}
        cursorOverlayAnchor="top"
        cursorOverlayAnchorOffset={10}
      />

      <MonitorRows>
        {monitorList.map(monitor => (
          <OverviewRow
            key={monitor.id}
            monitor={monitor}
            timeWindowConfig={timeWindowConfig}
            onDeleteEnvironment={env => handleDeleteEnvironment(monitor, env)}
            onToggleMuteEnvironment={(env, isMuted) =>
              handleToggleMuteEnvironment(monitor, env, isMuted)
            }
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </MonitorRows>
    </MonitorListPanel>
  );
}

const Header = styled(Sticky)`
  display: grid;
  grid-column: 1/-1;
  grid-template-columns: subgrid;

  z-index: 1;
  background: ${p => p.theme.background};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 1px ${p => p.theme.translucentBorder};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    margin: 0 -1px;
  }
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 3/-1;
`;
const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-row: 1;
  grid-column: 3/-1;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  box-shadow: -1px 0 0 0 ${p => p.theme.translucentInnerBorder};
  grid-row: 1;
  grid-column: 3/-1;
`;

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 135px 1fr max-content;
`;

const MonitorRows = styled('ul')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const HeaderControlsLeft = styled('div')`
  grid-column: 1/3;
  display: flex;
  justify-content: space-between;
  gap: ${space(0.5)};
  padding: ${space(1.5)} ${space(2)};
`;

const HeaderControlsRight = styled('div')`
  grid-row: 1;
  grid-column: -1;
  padding: ${space(1.5)} ${space(2)};
`;
