import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {NAV_GROUP_LABELS} from 'sentry/views/nav/constants';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

type DashboardsNavigationProps = {
  children: React.ReactNode;
};

function DashboardsSecondaryNav({children}: DashboardsNavigationProps) {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;

  const starredDashboards = useApiQuery<DashboardListItem[]>(
    [
      `/organizations/${organization.slug}/dashboards/`,
      {
        query: {
          filter: 'onlyFavorites',
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.DASHBOARDS}>
        <SecondaryNav.Header>
          {NAV_GROUP_LABELS[PrimaryNavGroup.DASHBOARDS]}
        </SecondaryNav.Header>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="dashboards_all">
              {t('All')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          <SecondaryNav.Section title={t('Starred Dashboards')}>
            {starredDashboards.data?.map(dashboard => (
              <SecondaryNav.Item
                key={dashboard.id}
                to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
                analyticsItemName="dashboard_starred_item"
              >
                {dashboard.title}
              </SecondaryNav.Item>
            )) ?? null}
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}

export default function DashboardsNavigation({children}: DashboardsNavigationProps) {
  const prefersStackedNav = usePrefersStackedNav();

  if (!prefersStackedNav) {
    return children;
  }

  return <DashboardsSecondaryNav>{children}</DashboardsSecondaryNav>;
}
