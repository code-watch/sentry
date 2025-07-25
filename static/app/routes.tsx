import {Fragment} from 'react';
import memoize from 'lodash/memoize';

import {EXPERIMENTAL_SPA, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {HookName} from 'sentry/types/hooks';
import errorHandler from 'sentry/utils/errorHandler';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';
import App from 'sentry/views/app';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import AuthLayout from 'sentry/views/auth/layout';
import {authV2Routes} from 'sentry/views/authV2/routes';
import {automationRoutes} from 'sentry/views/automations/routes';
import {detectorRoutes} from 'sentry/views/detectors/routes';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {getModuleView} from 'sentry/views/insights/pages/utils';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {GroupEventDetailsLoading} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsLoading';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {OverviewWrapper} from 'sentry/views/issueList/overviewWrapper';
import {IssueTaxonomy} from 'sentry/views/issueList/taxonomies';
import OrganizationContainer from 'sentry/views/organizationContainer';
import OrganizationLayout from 'sentry/views/organizationLayout';
import {OrganizationStatsWrapper} from 'sentry/views/organizationStats/organizationStatsWrapper';
import ProjectEventRedirect from 'sentry/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'sentry/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'sentry/views/routeNotFound';
import SettingsWrapper from 'sentry/views/settings/components/settingsWrapper';

import {Redirect, Route, type SentryRouteObject} from './components/route';
import {makeLazyloadComponent as make} from './makeLazyloadComponent';

const routeHook = (name: HookName): SentryRouteObject =>
  HookStore.get(name)?.[0]?.() ?? {};

function buildRoutes() {
  // Read this to understand where to add new routes, how / why the routing
  // tree is structured the way it is, and how the lazy-loading /
  // code-splitting works for pages.
  //
  // ## Formatting
  //
  // NOTE that there are intentionally NO blank lines within route tree blocks.
  // This helps make it easier to navigate within the file by using your
  // editors shortcuts to jump between 'paragraphs' of code.
  //
  // [!!] Do NOT add blank lines within route blocks to preserve this behavior!
  //
  //
  // ## Lazy loading
  //
  // * The `SafeLazyLoad` component
  //
  //   Most routes are rendered as LazyLoad components (SafeLazyLoad is the
  //   errorHandler wrapped version). This means the rendered component for the
  //   route will only be loaded when the route is loaded. This helps us
  //   "code-split" the app.
  //
  // ## Hooks
  //
  // There are a number of `hook()` routes placed within the routing tree to
  // allow for additional routes to be augmented into the application via the
  // hookStore mechanism.
  //
  //
  // ## The structure
  //
  // * `experimentalSpaRoutes`
  //
  //   These routes are specifically for the experimental single-page-app mode,
  //   where Sentry is run separate from Django. These are NOT part of the root
  //   <App /> component.
  //
  //   Right now these are mainly used for authentication pages. In the future
  //   they would be used for other pages like registration.
  //
  // * `rootRoutes`
  //
  //   These routes live directly under the <App /> container, and generally
  //   are not specific to an organization.
  //
  // * `settingsRoutes`
  //
  //   This is the route tree for all of `/settings/`. This route tree is
  //   composed of a few different sub-trees.
  //
  //   - `accountSettingsRoutes`    User specific settings
  //   - `orgSettingsRoutes`        Specific to a organization
  //   - `projectSettingsRoutes`    Specific to a project
  //   - `legacySettingsRedirects`  Routes that used to exist in settings
  //
  // * `organizationRoutes`
  //
  //   This is where a majority of the app routes live. This is wrapped with
  //   the <OrganizationLayout /> component, which renders the sidebar and
  //   loads the organiztion into context (though in some cases, there may be
  //   no organiztion)
  //
  //   When adding new top-level organization routes, be sure the top level
  //   route includes withOrgPath to support installs that are not using
  //   customer domains.
  //
  //   Within these routes are a variety of subroutes. They are not all
  //   listed here as the subroutes will be added and removed, and most are
  //   self explanatory.
  //
  // * `legacyRedirectRoutes`
  //
  //   This route tree contains <Redirect /> routes for many old legacy paths.
  //
  //   You may also find <Redirect />'s collocated next to the feature routes
  //   they have redirects for. A good rule here is to place 'helper' redirects
  //   next to the routes they redirect to, and place 'legacy route' redirects
  //   for routes that have completely changed in this tree.

  const experimentalSpaChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/auth/login')),
    },
    {
      path: ':orgId/',
      component: make(() => import('sentry/views/auth/login')),
    },
  ];

  const experimentalSpaRoutes = EXPERIMENTAL_SPA ? (
    <Route
      path="/auth/login/"
      component={errorHandler(AuthLayout)}
      newStyleChildren={experimentalSpaChildRoutes}
    />
  ) : null;

  const traceViewRouteObject: SentryRouteObject = {
    path: 'trace/:traceSlug/',
    component: make(() => import('sentry/views/performance/traceDetails')),
  };

  const rootChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/app/root')),
    },
    routeHook('routes:root'),
    {
      path: '/accept/:orgId/:memberId/:token/',
      component: make(() => import('sentry/views/acceptOrganizationInvite')),
    },
    {
      path: '/accept/:memberId/:token/',
      component: make(() => import('sentry/views/acceptOrganizationInvite')),
    },
    {
      path: '/accept-transfer/',
      component: make(() => import('sentry/views/acceptProjectTransfer')),
    },
    {
      component: errorHandler(OrganizationContainer),
      children: [
        {
          path: '/extensions/external-install/:integrationSlug/:installationId',
          component: make(() => import('sentry/views/integrationOrganizationLink')),
        },
        {
          path: '/extensions/:integrationSlug/link/',
          component: make(() => import('sentry/views/integrationOrganizationLink')),
        },
      ],
    },
    {
      path: '/sentry-apps/:sentryAppSlug/external-install/',
      component: make(() => import('sentry/views/sentryAppExternalInstallation')),
    },
    {
      path: '/account/',
      redirectTo: '/settings/account/details/',
    },
    {
      path: '/share/group/:shareId/',
      redirectTo: '/share/issue/:shareId/',
    },
    // Add redirect from old user feedback to new feedback
    {
      path: '/user-feedback/',
      redirectTo: '/feedback/',
    },
    // TODO: remove share/issue orgless url
    {
      path: '/share/issue/:shareId/',
      component: make(() => import('sentry/views/sharedGroupDetails')),
    },
    {
      path: '/organizations/:orgId/share/issue/:shareId/',
      component: make(() => import('sentry/views/sharedGroupDetails')),
    },
    {
      path: '/unsubscribe/project/:id/',
      component: make(() => import('sentry/views/unsubscribe/project')),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/unsubscribe/:orgId/project/:id/',
      component: make(() => import('sentry/views/unsubscribe/project')),
    },
    {
      path: '/unsubscribe/issue/:id/',
      component: make(() => import('sentry/views/unsubscribe/issue')),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/unsubscribe/:orgId/issue/:id/',
      component: make(() => import('sentry/views/unsubscribe/issue')),
    },
    {
      path: '/organizations/new/',
      component: make(() => import('sentry/views/organizationCreate')),
    },
    {
      path: '/data-export/:dataExportId',
      component: make(() => import('sentry/views/dataExport/dataDownload')),
      withOrgPath: true,
    },
    {
      component: errorHandler(OrganizationContainer),
      children: [
        {
          path: '/disabled-member/',
          component: make(() => import('sentry/views/disabledMember')),
          withOrgPath: true,
        },
      ],
    },
    {
      path: '/restore/',
      component: make(() => import('sentry/views/organizationRestore')),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/organizations/:orgId/restore/',
      component: make(() => import('sentry/views/organizationRestore')),
    },
    {
      path: '/join-request/',
      component: withDomainRequired(
        make(() => import('sentry/views/organizationJoinRequest'))
      ),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/join-request/:orgId/',
      component: withDomainRedirect(
        make(() => import('sentry/views/organizationJoinRequest'))
      ),
    },
    {
      path: '/relocation/',
      component: make(() => import('sentry/views/relocation')),
      children: [
        {
          index: true,
          redirectTo: 'get-started/',
        },
        {
          path: ':step/',
          component: make(() => import('sentry/views/relocation')),
        },
      ],
    },
    {
      path: '/onboarding/',
      redirectTo: '/onboarding/welcome/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/onboarding/:step/',
      component: errorHandler(withDomainRequired(OrganizationContainer)),
      customerDomainOnlyRoute: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/onboarding')),
        },
      ],
    },
    {
      path: '/onboarding/:orgId/',
      redirectTo: '/onboarding/:orgId/welcome/',
    },
    {
      path: '/onboarding/:orgId/:step/',
      component: withDomainRedirect(errorHandler(OrganizationContainer)),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/onboarding')),
        },
      ],
    },
    {
      path: '/stories/:storyType?/:storySlug?/',
      component: make(() => import('sentry/stories/view/index')),
      withOrgPath: true,
    },
  ];

  const rootRoutes = (
    <Route component={errorHandler(AppBodyContent)} newStyleChildren={rootChildRoutes} />
  );

  const accountSettingsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: 'details/',
    },
    {
      path: 'details/',
      name: t('Details'),
      component: make(() => import('sentry/views/settings/account/accountDetails')),
    },
    {
      path: 'notifications/',
      name: t('Notifications'),
      children: [
        {
          index: true,
          component: make(
            () =>
              import(
                'sentry/views/settings/account/notifications/notificationSettingsController'
              )
          ),
        },
        {
          path: ':fineTuneType/',
          name: t('Fine Tune Alerts'),
          component: make(
            () =>
              import(
                'sentry/views/settings/account/accountNotificationFineTuningController'
              )
          ),
        },
      ],
    },
    {
      path: 'emails/',
      name: t('Emails'),
      component: make(() => import('sentry/views/settings/account/accountEmails')),
    },
    {
      path: 'authorizations/',
      component: make(
        () => import('sentry/views/settings/account/accountAuthorizations')
      ),
    },
    {
      path: 'security/',
      name: t('Security'),
      children: [
        {
          component: make(
            () =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityWrapper'
              )
          ),
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/account/accountSecurity')
              ),
            },
            {
              path: 'session-history/',
              name: t('Session History'),
              component: make(
                () =>
                  import('sentry/views/settings/account/accountSecurity/sessionHistory')
              ),
            },
            {
              path: 'mfa/:authId/',
              name: t('Details'),
              component: make(
                () =>
                  import(
                    'sentry/views/settings/account/accountSecurity/accountSecurityDetails'
                  )
              ),
            },
          ],
        },
        {
          path: 'mfa/:authId/enroll/',
          name: t('Enroll'),
          component: make(
            () =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityEnroll'
              )
          ),
        },
      ],
    },
    {
      path: 'subscriptions/',
      name: t('Subscriptions'),
      component: make(() => import('sentry/views/settings/account/accountSubscriptions')),
    },
    {
      path: 'identities/',
      name: t('Identities'),
      component: make(() => import('sentry/views/settings/account/accountIdentities')),
    },
    {
      path: 'api/',
      name: t('API'),
      children: [
        {
          index: true,
          redirectTo: 'auth-tokens/',
        },
        {
          path: 'auth-tokens/',
          name: t('Personal Tokens'),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/settings/account/apiTokens')),
            },
            {
              path: 'new-token/',
              name: t('Create Personal Token'),
              component: make(() => import('sentry/views/settings/account/apiNewToken')),
            },
            {
              path: ':tokenId/',
              name: t('Edit Personal Token'),
              component: make(
                () => import('sentry/views/settings/account/apiTokenDetails')
              ),
            },
          ],
        },
        {
          path: 'applications/',
          name: t('Applications'),
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/account/apiApplications')
              ),
            },
            {
              path: ':appId/',
              name: t('Details'),
              component: make(
                () => import('sentry/views/settings/account/apiApplications/details')
              ),
            },
          ],
        },
      ],
    },
    {
      path: 'close-account/',
      name: t('Close Account'),
      component: make(() => import('sentry/views/settings/account/accountClose')),
    },
  ];

  const accountSettingsRoutes: SentryRouteObject = {
    path: 'account/',
    name: t('Account'),
    component: make(() => import('sentry/views/settings/account/accountSettingsLayout')),
    children: accountSettingsChildRoutes,
  };

  const projectSettingsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      name: t('General'),
      component: make(() => import('sentry/views/settings/projectGeneralSettings')),
    },
    {
      path: 'install/',
      redirectTo: '/projects/:projectId/getting-started/',
    },
    {
      path: 'teams/',
      name: t('Teams'),
      component: make(() => import('sentry/views/settings/project/projectTeams')),
    },
    {
      path: 'alerts/',
      name: t('Alerts'),
      component: make(() => import('sentry/views/settings/projectAlerts')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectAlerts/settings')),
        },
        {
          path: 'new/',
          redirectTo: '/organizations/:orgId/alerts/:projectId/new/',
        },
        {
          path: 'rules/',
          redirectTo: '/organizations/:orgId/alerts/rules/',
        },
        {
          path: 'rules/new/',
          redirectTo: '/organizations/:orgId/alerts/:projectId/new/',
        },
        {
          path: 'metric-rules/new/',
          redirectTo: '/organizations/:orgId/alerts/:projectId/new/',
        },
        {
          path: 'rules/:ruleId/',
          redirectTo: '/organizations/:orgId/alerts/rules/:projectId/:ruleId/',
        },
        {
          path: 'metric-rules/:ruleId/',
          redirectTo: '/organizations/:orgId/alerts/metric-rules/:projectId/:ruleId/',
        },
      ],
    },
    {
      path: 'environments/',
      name: t('Environments'),
      component: make(() => import('sentry/views/settings/project/projectEnvironments')),
      children: [
        {
          index: true,
        },
        {
          path: 'hidden/',
        },
      ],
    },
    {
      path: 'tags/',
      name: t('Tags & Context'),
      component: make(() => import('sentry/views/settings/projectTags')),
    },
    {
      path: 'issue-tracking/',
      redirectTo: '/settings/:orgId/:projectId/plugins/',
    },
    {
      path: 'release-tracking/',
      name: t('Release Tracking'),
      component: make(
        () => import('sentry/views/settings/project/projectReleaseTracking')
      ),
    },
    {
      path: 'ownership/',
      name: t('Ownership Rules'),
      component: make(() => import('sentry/views/settings/project/projectOwnership')),
    },
    {
      path: 'data-forwarding/',
      name: t('Data Forwarding'),
      component: make(() => import('sentry/views/settings/projectDataForwarding')),
    },
    {
      path: 'seer/',
      name: t('Seer'),
      component: make(() => import('sentry/views/settings/projectSeer/index')),
    },
    {
      path: 'user-feedback/',
      name: t('User Feedback'),
      component: make(() => import('sentry/views/settings/projectUserFeedback')),
    },
    {
      path: 'security-and-privacy/',
      name: t('Security & Privacy'),
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          ),
        },
        {
          path: 'advanced-data-scrubbing/:scrubbingId/',
          component: make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          ),
        },
      ],
    },
    {
      path: 'debug-symbols/',
      name: t('Debug Information Files'),
      component: make(() => import('sentry/views/settings/projectDebugFiles')),
    },
    {
      path: 'proguard/',
      name: t('ProGuard Mappings'),
      component: make(() => import('sentry/views/settings/projectProguard')),
    },
    {
      path: 'performance/',
      name: t('Performance'),
      component: make(() => import('sentry/views/settings/projectPerformance')),
    },
    {
      path: 'playstation/',
      name: t('PlayStation'),
      component: make(() => import('sentry/views/settings/project/tempest')),
    },
    {
      path: 'replays/',
      name: t('Replays'),
      component: make(() => import('sentry/views/settings/project/projectReplays')),
    },
    {
      path: 'toolbar/',
      name: t('Developer Toolbar'),
      component: make(() => import('sentry/views/settings/project/projectToolbar')),
    },
    {
      path: 'source-maps/',
      name: t('Source Maps'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectSourceMaps')),
        },
        {
          path: ':bundleId/',
          name: t('Source Map Uploads'),
          component: make(() => import('sentry/views/settings/projectSourceMaps')),
        },
        {
          path: 'source-maps/artifact-bundles/',
          redirectTo: 'source-maps/',
        },
        {
          path: 'source-maps/release-bundles/',
          redirectTo: 'source-maps/',
        },
      ],
    },
    {
      path: 'filters/',
      name: t('Inbound Filters'),
      component: make(() => import('sentry/views/settings/project/projectFilters')),
      children: [
        {
          index: true,
          redirectTo: 'data-filters/',
        },
        {
          path: ':filterType/',
        },
      ],
    },
    {
      path: 'dynamic-sampling/',
      redirectTo: 'performance/',
    },
    {
      path: 'issue-grouping/',
      name: t('Issue Grouping'),
      component: make(() => import('sentry/views/settings/projectIssueGrouping')),
    },
    {
      path: 'hooks/',
      name: t('Service Hooks'),
      component: make(() => import('sentry/views/settings/project/projectServiceHooks')),
    },
    {
      path: 'hooks/new/',
      name: t('Create Service Hook'),
      component: make(
        () => import('sentry/views/settings/project/projectCreateServiceHook')
      ),
    },
    {
      path: 'hooks/:hookId/',
      name: t('Service Hook Details'),
      component: make(
        () => import('sentry/views/settings/project/projectServiceHookDetails')
      ),
    },
    {
      path: 'keys/',
      name: t('Client Keys'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/project/projectKeys/list')),
        },
        {
          path: ':keyId/',
          name: t('Details'),
          component: make(
            () => import('sentry/views/settings/project/projectKeys/details')
          ),
        },
      ],
    },
    {
      path: 'loader-script/',
      name: t('Loader Script'),
      component: make(() => import('sentry/views/settings/project/loaderScript')),
    },
    {
      path: 'csp/',
      redirectTo: '/settings/:orgId/projects/:projectId/security-headers/csp/',
    },
    {
      path: 'security-headers/',
      name: t('Security Headers'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectSecurityHeaders')),
        },
        {
          path: 'csp/',
          name: t('Content Security Policy'),
          component: make(
            () => import('sentry/views/settings/projectSecurityHeaders/csp')
          ),
        },
        {
          path: 'expect-ct/',
          name: t('Certificate Transparency'),
          component: make(
            () => import('sentry/views/settings/projectSecurityHeaders/expectCt')
          ),
        },
        {
          path: 'hpkp/',
          name: t('HPKP'),
          component: make(
            () => import('sentry/views/settings/projectSecurityHeaders/hpkp')
          ),
        },
      ],
    },
    {
      path: 'plugins/',
      name: t('Legacy Integrations'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectPlugins')),
        },
        {
          path: ':pluginId/',
          name: t('Integration Details'),
          component: make(() => import('sentry/views/settings/projectPlugins/details')),
        },
      ],
    },
  ];

  const projectSettingsRoutes: SentryRouteObject = {
    path: 'projects/:projectId/',
    name: t('Project'),
    component: make(() => import('sentry/views/settings/project/projectSettingsLayout')),
    children: projectSettingsChildRoutes,
  };

  const statsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/organizationStats')),
    },
    {
      component: make(() => import('sentry/views/organizationStats/teamInsights')),
      children: [
        {
          path: 'issues/',
          component: make(
            () => import('sentry/views/organizationStats/teamInsights/issues')
          ),
        },
        {
          path: 'health/',
          component: make(
            () => import('sentry/views/organizationStats/teamInsights/health')
          ),
        },
      ],
    },
  ];
  const statsRoutes = (
    <Fragment>
      <Route
        path="/stats/"
        withOrgPath
        component={OrganizationStatsWrapper}
        newStyleChildren={statsChildRoutes}
      />
      <Redirect
        from="/organizations/:orgId/stats/team/"
        to="/organizations/:orgId/stats/issues/"
      />
    </Fragment>
  );

  const orgSettingsChildRoutes: SentryRouteObject[] = [
    routeHook('routes:settings'),
    {
      index: true,
      name: t('General'),
      component: make(() => import('sentry/views/settings/organizationGeneralSettings')),
    },
    {
      path: 'organization/',
      name: t('General'),
      component: make(() => import('sentry/views/settings/organizationGeneralSettings')),
    },
    {
      path: 'projects/',
      name: t('Projects'),
      component: make(() => import('sentry/views/settings/organizationProjects')),
    },
    {
      path: 'api-keys/',
      name: t('API Key'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/organizationApiKeys')),
        },
        {
          path: ':apiKey/',
          name: t('Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails'
              )
          ),
        },
      ],
    },
    {
      path: 'audit-log/',
      name: t('Audit Log'),
      component: make(() => import('sentry/views/settings/organizationAuditLog')),
    },
    {
      path: 'auth/',
      name: t('Auth Providers'),
      component: make(() => import('sentry/views/settings/organizationAuth')),
    },
    {
      path: 'members/requests',
      redirectTo: '../members/',
    },
    {
      path: 'members/',
      name: t('Members'),
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/settings/organizationMembers/organizationMembersList')
          ),
        },
        {
          path: ':memberId/',
          name: t('Details'),
          component: make(
            () =>
              import('sentry/views/settings/organizationMembers/organizationMemberDetail')
          ),
        },
      ],
    },
    {
      path: 'rate-limits/',
      name: t('Rate Limits'),
      component: make(() => import('sentry/views/settings/organizationRateLimits')),
    },
    {
      path: 'relay/',
      name: t('Relay'),
      component: make(() => import('sentry/views/settings/organizationRelay')),
    },
    {
      path: 'repos/',
      name: t('Repositories'),
      component: make(() => import('sentry/views/settings/organizationRepositories')),
    },
    {
      path: 'settings/',
      component: make(() => import('sentry/views/settings/organizationGeneralSettings')),
    },
    {
      path: 'security-and-privacy/',
      name: t('Security & Privacy'),
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/settings/organizationSecurityAndPrivacy')
          ),
        },
        {
          path: 'advanced-data-scrubbing/:scrubbingId/',
          component: make(
            () => import('sentry/views/settings/organizationSecurityAndPrivacy')
          ),
        },
      ],
    },
    {
      path: 'teams/',
      name: t('Teams'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/organizationTeams')),
        },
        {
          path: ':teamId/',
          name: t('Team'),
          component: make(
            () => import('sentry/views/settings/organizationTeams/teamDetails')
          ),
          children: [
            {
              index: true,
              redirectTo: 'members/',
            },
            {
              path: 'members/',
              name: t('Members'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamMembers')
              ),
            },
            {
              path: 'notifications/',
              name: t('Notifications'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamNotifications')
              ),
            },
            {
              path: 'projects/',
              name: t('Projects'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamProjects')
              ),
            },
            {
              path: 'settings/',
              name: t('Settings'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamSettings')
              ),
            },
          ],
        },
      ],
    },
    {
      path: 'plugins/',
      redirectTo: 'integrations/',
    },
    {
      path: 'plugins/',
      name: t('Integrations'),
      children: [
        {
          path: ':integrationSlug/',
          name: t('Integration Details'),
          component: make(
            () =>
              import('sentry/views/settings/organizationIntegrations/pluginDetailedView')
          ),
        },
      ],
    },
    {
      path: 'sentry-apps/',
      redirectTo: 'integrations/',
    },
    {
      path: 'sentry-apps/',
      name: t('Integrations'),
      children: [
        {
          path: ':integrationSlug',
          name: t('Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/sentryAppDetailedView'
              )
          ),
        },
      ],
    },
    {
      path: 'document-integrations/',
      redirectTo: 'integrations/',
    },
    {
      path: 'document-integrations/',
      name: t('Integrations'),
      children: [
        {
          path: ':integrationSlug',
          name: t('Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/docIntegrationDetailedView'
              )
          ),
        },
      ],
    },
    {
      path: 'integrations/',
      name: t('Integrations'),
      children: [
        {
          index: true,
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/integrationListDirectory'
              )
          ),
        },
        {
          path: ':integrationSlug',
          name: t('Integration Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/integrationDetailedView'
              )
          ),
        },
        {
          path: ':providerKey/:integrationId/',
          name: t('Configure Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/configureIntegration'
              )
          ),
        },
      ],
    },
    {
      path: 'developer-settings/',
      name: t('Custom Integrations'),
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/settings/organizationDeveloperSettings')
          ),
        },
        {
          path: 'new-public/',
          name: t('Create Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          ),
        },
        {
          path: 'new-internal/',
          name: t('Create Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          ),
        },
        {
          path: ':appSlug/',
          name: t('Edit Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          ),
        },
        {
          path: ':appSlug/dashboard/',
          name: t('Integration Dashboard'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
              )
          ),
        },
      ],
    },
    {
      path: 'auth-tokens/',
      name: t('Organization Tokens'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/organizationAuthTokens')),
        },
        {
          path: 'new-token/',
          name: t('Create New Organization Token'),
          component: make(
            () => import('sentry/views/settings/organizationAuthTokens/newAuthToken')
          ),
        },
        {
          path: ':tokenId/',
          name: t('Edit Organization Token'),
          component: make(
            () => import('sentry/views/settings/organizationAuthTokens/authTokenDetails')
          ),
        },
      ],
    },
    {
      path: 'early-features/',
      name: t('Early Features'),
      component: make(() => import('sentry/views/settings/earlyFeatures')),
    },
    {
      path: 'dynamic-sampling/',
      name: t('Dynamic Sampling'),
      component: make(() => import('sentry/views/settings/dynamicSampling')),
    },
    {
      path: 'feature-flags/',
      name: t('Feature Flags'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/featureFlags')),
        },
        {
          path: 'change-tracking/',
          name: t('Change Tracking'),
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/featureFlags/changeTracking')
              ),
            },
            {
              path: 'new-provider/',
              name: t('Add New Provider'),
              component: make(
                () =>
                  import(
                    'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsNewSecret'
                  )
              ),
            },
          ],
        },
      ],
    },
    {
      path: 'seer/',
      name: t('Seer Automation'),
      children: [
        {
          index: true,
          component: make(() => import('getsentry/views/seerAutomation')),
        },
        {
          path: 'onboarding/',
          name: t('Configure Seer for All Projects'),
          component: make(() => import('getsentry/views/seerAutomation/onboarding')),
        },
      ],
    },
    {
      path: 'stats/',
      name: t('Stats'),
      children: statsChildRoutes,
    },
  ];

  const orgSettingsRoutes: SentryRouteObject = {
    component: make(
      () => import('sentry/views/settings/organization/organizationSettingsLayout')
    ),
    children: orgSettingsChildRoutes,
  };

  const legacySettingsRedirects: SentryRouteObject = {
    children: [
      {
        path: ':projectId/',
        redirectTo: 'projects/:projectId/',
      },
      {
        path: ':projectId/alerts/',
        redirectTo: 'projects/:projectId/alerts/',
      },
      {
        path: ':projectId/alerts/rules/',
        redirectTo: 'projects/:projectId/alerts/rules/',
      },
      {
        path: ':projectId/alerts/rules/:ruleId/',
        redirectTo: 'projects/:projectId/alerts/rules/:ruleId/',
      },
    ],
  };

  const settingsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/settings/settingsIndex')),
    },
    accountSettingsRoutes,
    {
      name: t('Organization'),
      component: withDomainRequired(NoOp),
      customerDomainOnlyRoute: true,
      children: [orgSettingsRoutes, projectSettingsRoutes],
    },
    {
      path: ':orgId/',
      name: t('Organization'),
      component: withDomainRedirect(NoOp),
      children: [orgSettingsRoutes, projectSettingsRoutes, legacySettingsRedirects],
    },
  ];

  const settingsRoutes = (
    <Route
      path="/settings/"
      name={t('Settings')}
      component={SettingsWrapper}
      newStyleChildren={settingsChildRoutes}
    />
  );

  const projectsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/projectsDashboard')),
    },
    {
      path: 'new/',
      component: make(() => import('sentry/views/projectInstall/newProject')),
    },
    {
      path: ':projectId/',
      component: make(() => import('sentry/views/projectDetail')),
    },
    {
      path: ':projectId/events/:eventId/',
      component: errorHandler(ProjectEventRedirect),
    },
    {
      path: ':projectId/getting-started/',
      component: make(() => import('sentry/views/projectInstall/gettingStarted')),
    },
  ];
  const projectsRoutes = (
    <Route
      path="/projects/"
      component={make(() => import('sentry/views/projects/'))}
      withOrgPath
      newStyleChildren={projectsChildRoutes}
    />
  );

  const dashboardChildRoutes: SentryRouteObject[] = [
    {
      path: '/dashboards/',
      component: withDomainRequired(make(() => import('sentry/views/dashboards'))),
      customerDomainOnlyRoute: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/dashboards/manage')),
        },
        traceViewRouteObject,
      ],
    },
    {
      path: '/organizations/:orgId/dashboards/',
      component: withDomainRedirect(make(() => import('sentry/views/dashboards'))),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/dashboards/manage')),
        },
      ],
    },
    {
      path: '/dashboards/new/',
      component: make(() => import('sentry/views/dashboards/create')),
      withOrgPath: true,
      children: [
        // new widget builder routes
        {
          path: 'widget-builder/widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/view')),
        },
        {
          path: 'widget-builder/widget/new/',
          component: make(() => import('sentry/views/dashboards/view')),
        },
        // old widget builder routes
        {
          path: 'widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
        },
        {
          path: 'widget/new/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
        },
      ],
    },
    {
      path: '/dashboards/new/:templateId',
      component: make(() => import('sentry/views/dashboards/create')),
      withOrgPath: true,
      children: [
        {
          path: 'widget/:widgetId/',
          component: make(() => import('sentry/views/dashboards/create')),
        },
      ],
    },
    {
      path: '/organizations/:orgId/dashboards/:dashboardId/',
      redirectTo: '/organizations/:orgId/dashboard/:dashboardId/',
    },
    {
      path: '/dashboards/:dashboardId/',
      redirectTo: '/dashboard/:dashboardId/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/dashboard/:dashboardId/',
      component: make(() => import('sentry/views/dashboards/view')),
      withOrgPath: true,
      children: [
        {
          path: 'widget-builder/widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/view')),
        },
        {
          path: 'widget-builder/widget/new/',
          component: make(() => import('sentry/views/dashboards/view')),
        },
        {
          path: 'widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
        },
        {
          path: 'widget/new/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
        },
        {
          path: 'widget/:widgetId/',
          component: make(() => import('sentry/views/dashboards/view')),
        },
      ],
    },
  ];

  const dashboardRoutes = <Route newStyleChildren={dashboardChildRoutes} />;

  const alertChildRoutes = (forCustomerDomain: boolean): SentryRouteObject[] => [
    {
      index: true,
      component: make(() => import('sentry/views/alerts/list/incidents')),
    },
    {
      path: 'rules/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/alerts/list/rules/alertRulesList')),
        },
        {
          path: 'details/:ruleId/',
          component: make(() => import('sentry/views/alerts/rules/metric/details')),
        },
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          children: [
            {
              index: true,
              redirectTo: forCustomerDomain
                ? '/alerts/rules/'
                : '/organizations/:orgId/alerts/rules/',
            },
            {
              path: ':ruleId/',
              component: make(() => import('sentry/views/alerts/edit')),
            },
          ],
        },
        {
          path: ':projectId/:ruleId/details/',
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/alerts/rules/issue/details/ruleDetails')
              ),
            },
          ],
        },
        {
          path: 'uptime/',
          component: make(() => import('sentry/views/alerts/rules/uptime')),
          children: [
            {
              path: ':projectId/:uptimeRuleId/details/',
              component: make(() => import('sentry/views/alerts/rules/uptime/details')),
            },
            {
              path: 'existing-or-create/',
              component: make(
                () => import('sentry/views/alerts/rules/uptime/existingOrCreate')
              ),
            },
          ],
        },
        {
          path: 'crons/',
          component: make(() => import('sentry/views/alerts/rules/crons')),
          children: [
            {
              path: ':projectId/:monitorSlug/details/',
              component: make(() => import('sentry/views/alerts/rules/crons/details')),
            },
          ],
        },
      ],
    },
    {
      path: 'metric-rules/',
      children: [
        {
          index: true,
          redirectTo: forCustomerDomain
            ? '/alerts/rules/'
            : '/organizations/:orgId/alerts/rules/',
        },
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          children: [
            {
              index: true,
              redirectTo: forCustomerDomain
                ? '/alerts/rules/'
                : '/organizations/:orgId/alerts/rules/',
            },
            {
              path: ':ruleId/',
              component: make(() => import('sentry/views/alerts/edit')),
            },
          ],
        },
      ],
    },
    {
      path: 'uptime-rules/',
      children: [
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          children: [
            {
              path: ':ruleId/',
              component: make(() => import('sentry/views/alerts/edit')),
            },
          ],
        },
      ],
    },
    {
      path: 'crons-rules/',
      children: [
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          children: [
            {
              path: ':monitorSlug/',
              component: make(() => import('sentry/views/alerts/edit')),
            },
          ],
        },
      ],
    },
    {
      path: 'wizard/',
      component: make(() => import('sentry/views/alerts/builder/projectProvider')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/alerts/wizard')),
        },
      ],
    },
    {
      path: 'new/',
      component: make(() => import('sentry/views/alerts/builder/projectProvider')),
      children: [
        {
          index: true,
          redirectTo: forCustomerDomain
            ? '/alerts/wizard/'
            : '/organizations/:orgId/alerts/wizard/',
        },
        {
          path: ':alertType/',
          component: make(() => import('sentry/views/alerts/create')),
        },
      ],
    },
    {
      path: ':alertId/',
      component: make(() => import('sentry/views/alerts/incidentRedirect')),
    },
    {
      path: ':projectId/',
      component: make(() => import('sentry/views/alerts/builder/projectProvider')),
      children: [
        {
          path: 'new/',
          component: make(() => import('sentry/views/alerts/create')),
        },
        {
          path: 'wizard/',
          component: make(() => import('sentry/views/alerts/wizard')),
        },
      ],
    },
  ];

  const alertRoutes = (
    <Fragment>
      {USING_CUSTOMER_DOMAIN && (
        <Route
          path="/alerts/"
          component={withDomainRequired(make(() => import('sentry/views/alerts')))}
          key="orgless-alerts-route"
          newStyleChildren={alertChildRoutes(true)}
        />
      )}
      <Route
        path="/organizations/:orgId/alerts/"
        component={withDomainRedirect(make(() => import('sentry/views/alerts')))}
        key="org-alerts"
        newStyleChildren={alertChildRoutes(false)}
      />
    </Fragment>
  );

  const replayChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/replays/list')),
    },
    {
      path: 'selectors/',
      component: make(
        () => import('sentry/views/replays/deadRageClick/deadRageClickList')
      ),
    },
    {
      path: ':replaySlug/',
      component: make(() => import('sentry/views/replays/details')),
    },
  ];
  const replayRoutes = (
    <Route
      path="/replays/"
      component={make(() => import('sentry/views/replays/index'))}
      withOrgPath
      newStyleChildren={replayChildRoutes}
    />
  );

  const releasesChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/releases/list')),
    },
    {
      path: ':release/',
      component: make(() => import('sentry/views/releases/detail')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/releases/detail/overview')),
        },
        {
          path: 'commits/',
          component: make(
            () => import('sentry/views/releases/detail/commitsAndFiles/commits')
          ),
        },
        {
          path: 'files-changed/',
          component: make(
            () => import('sentry/views/releases/detail/commitsAndFiles/filesChanged')
          ),
        },
      ],
    },
  ];
  const releasesRoutes = (
    <Fragment>
      <Route
        path="/releases/"
        component={make(() => import('sentry/views/releases/index'))}
        withOrgPath
        newStyleChildren={releasesChildRoutes}
      />
      <Redirect
        from="/releases/new-events/"
        to="/organizations/:orgId/releases/:release/"
      />
      <Redirect
        from="/releases/all-events/"
        to="/organizations/:orgId/releases/:release/"
      />
    </Fragment>
  );

  const discoverChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: 'queries/',
    },
    {
      path: 'homepage/',
      component: make(() => import('sentry/views/discover/homepage')),
    },
    traceViewRouteObject,
    {
      path: 'queries/',
      component: make(() => import('sentry/views/discover/landing')),
    },
    {
      path: 'results/',
      component: make(() => import('sentry/views/discover/results')),
    },
    {
      path: ':eventSlug/',
      component: make(() => import('sentry/views/discover/eventDetails')),
    },
  ];
  const discoverRoutes = (
    <Route
      path="/discover/"
      component={make(() => import('sentry/views/discover'))}
      withOrgPath
      newStyleChildren={discoverChildRoutes}
    />
  );

  const llmMonitoringRedirects = USING_CUSTOMER_DOMAIN ? (
    <Redirect
      from="/llm-monitoring/"
      to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
    />
  ) : (
    <Redirect
      from="/organizations/:orgId/llm-monitoring/"
      to={`/organizations/:orgId/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
    />
  );

  const moduleUrlToModule: Record<string, ModuleName> = Object.fromEntries(
    Object.values(ModuleName).map(name => [MODULE_BASE_URLS[name], name])
  );

  const insightsRedirectObjects: SentryRouteObject[] = Object.values(MODULE_BASE_URLS)
    .map(moduleBaseURL =>
      moduleBaseURL
        ? {
            path: `${moduleBaseURL}/*`,
            redirectTo: `/${DOMAIN_VIEW_BASE_URL}/${getModuleView(moduleUrlToModule[moduleBaseURL]!)}${moduleBaseURL}/:splat`,
          }
        : null
    )
    .filter(route => route !== null);

  const transactionSummaryChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionOverview')
      ),
    },
    traceViewRouteObject,
    {
      path: 'replays/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionReplays')
      ),
    },
    {
      path: 'vitals/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionVitals')
      ),
    },
    {
      path: 'tags/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionTags')
      ),
    },
    {
      path: 'events/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionEvents')
      ),
    },
    {
      path: 'profiles/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionProfiles')
      ),
    },
    {
      path: 'spans/',
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/performance/transactionSummary/transactionSpans')
          ),
        },
        {
          path: ':spanSlug/',
          component: make(
            () =>
              import(
                'sentry/views/performance/transactionSummary/transactionSpans/spanDetails'
              )
          ),
        },
      ],
    },
  ];

  const moduleRoutes: SentryRouteObject[] = [
    {
      path: `${MODULE_BASE_URLS[ModuleName.HTTP]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/http/views/httpLandingPage')
          ),
        },
        {
          path: 'domains/',
          component: make(
            () => import('sentry/views/insights/http/views/httpDomainSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.VITAL]}/`,
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/insights/browser/webVitals/views/webVitalsLandingPage')
          ),
        },
        {
          path: 'overview/',
          component: make(
            () => import('sentry/views/insights/browser/webVitals/views/pageOverview')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`,
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/insights/browser/resources/views/resourcesLandingPage')
          ),
        },
        {
          path: 'spans/span/:groupId/',
          component: make(
            () =>
              import('sentry/views/insights/browser/resources/views/resourceSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.DB]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/database/views/databaseLandingPage')
          ),
        },
        {
          path: 'spans/span/:groupId/',
          component: make(
            () => import('sentry/views/insights/database/views/databaseSpanSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.CACHE]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/cache/views/cacheLandingPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.QUEUE]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/queues/views/queuesLandingPage')
          ),
        },
        {
          path: 'destination/',
          component: make(
            () => import('sentry/views/insights/queues/views/destinationSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.MOBILE_VITALS]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/mobile/screens/views/screensLandingPage')
          ),
        },
        {
          path: 'details/',
          component: make(
            () => import('sentry/views/insights/mobile/screens/views/screenDetailsPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.AI]}/`,
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/insights/llmMonitoring/views/llmMonitoringLandingPage')
          ),
        },
        {
          path: 'pipeline-type/:groupId/',
          component: make(
            () =>
              import('sentry/views/insights/llmMonitoring/views/llmMonitoringDetailsPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.SESSIONS]}/`,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/sessions/views/overview')),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.AGENTS]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/agentMonitoring/views/agentsOverviewPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.MCP]}/`,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/mcp/views/overview')),
        },
      ],
    },
  ];

  const domainViewChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/insights/index')),
    },
    {
      path: 'summary/',
      children: transactionSummaryChildRoutes,
    },
    {
      path: `${FRONTEND_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/pages/frontend/frontendOverviewPage')
          ),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/pages/backend/backendOverviewPage')
          ),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: `${MOBILE_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/pages/mobile/mobileOverviewPage')
          ),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: `${AI_LANDING_SUB_PATH}/`,
      children: [traceViewRouteObject, ...moduleRoutes],
    },
    {
      path: `${AGENTS_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/pages/agents/redirect')),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: 'projects/',
      component: make(() => import('sentry/views/projects/')),
      children: projectsChildRoutes,
    },
    {
      path: `${FRONTEND_LANDING_SUB_PATH}/uptime/`,
      redirectTo: '/insights/uptime/',
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/uptime/`,
      redirectTo: '/insights/uptime/',
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/crons/`,
      redirectTo: '/insights/crons/',
    },
    {
      path: 'uptime/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/uptime/views/overview')),
        },
      ],
    },
    {
      path: 'crons/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/crons/views/overview')),
        },
      ],
    },
  ];

  const domainViewRoutes = (
    <Route
      path={`/${DOMAIN_VIEW_BASE_URL}/`}
      withOrgPath
      newStyleChildren={domainViewChildRoutes}
    />
  );

  const performanceChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: '/insights/frontend/',
    },
    {
      path: 'summary/',
      children: transactionSummaryChildRoutes,
    },
    {
      path: 'vitaldetail/',
      component: make(() => import('sentry/views/performance/vitalDetail')),
    },
    traceViewRouteObject,
    ...insightsRedirectObjects,
    {
      path: 'browser/resources',
      redirectTo: `/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`,
    },
    {
      path: 'browser/assets',
      redirectTo: `/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`,
    },
    {
      path: 'browser/pageloads',
      redirectTo: `/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.VITAL]}/`,
    },
    {
      path: ':eventSlug/',
      component: make(() => import('sentry/views/performance/transactionDetails')),
    },
  ];

  const performanceRoutes = (
    <Route
      path="/performance/"
      component={make(() => import('sentry/views/performance'))}
      withOrgPath
      newStyleChildren={performanceChildRoutes}
    />
  );

  const tracesChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/traces/content')),
    },
    traceViewRouteObject,
    {
      path: 'compare/',
      component: make(() => import('sentry/views/explore/multiQueryMode')),
    },
  ];

  const logsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/logs/content')),
    },
    traceViewRouteObject,
  ];

  const tracesRoutes = (
    <Route
      path="/traces/"
      component={make(() => import('sentry/views/traces'))}
      withOrgPath
      newStyleChildren={tracesChildRoutes}
    />
  );

  const profilingChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/profiling/content')),
    },
    {
      path: 'summary/:projectId/',
      component: make(() => import('sentry/views/profiling/profileSummary')),
    },
    {
      path: 'profile/:projectId/differential-flamegraph/',
      component: make(() => import('sentry/views/profiling/differentialFlamegraph')),
    },
    traceViewRouteObject,
    {
      path: 'profile/:projectId/',
      component: make(() => import('sentry/views/profiling/continuousProfileProvider')),
      children: [
        {
          path: 'flamegraph/',
          component: make(
            () => import('sentry/views/profiling/continuousProfileFlamegraph')
          ),
        },
      ],
    },
    {
      path: 'profile/:projectId/:eventId/',
      component: make(() => import('sentry/views/profiling/transactionProfileProvider')),
      children: [
        {
          path: 'flamegraph/',
          component: make(() => import('sentry/views/profiling/profileFlamechart')),
        },
      ],
    },
  ];

  const exploreChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/indexRedirect')),
    },
    {
      path: 'profiling/',
      component: make(() => import('sentry/views/profiling')),
      children: profilingChildRoutes,
    },
    {
      path: 'traces/',
      component: make(() => import('sentry/views/traces')),
      children: tracesChildRoutes,
    },
    {
      path: 'replays/',
      component: make(() => import('sentry/views/replays/index')),
      children: replayChildRoutes,
    },
    {
      path: 'discover/',
      component: make(() => import('sentry/views/discover')),
      children: discoverChildRoutes,
    },
    {
      path: 'releases/',
      component: make(() => import('sentry/views/releases/index')),
      children: releasesChildRoutes,
    },
    {
      path: 'logs/',
      component: make(() => import('sentry/views/explore/logs')),
      children: logsChildRoutes,
    },
    {
      path: 'saved-queries/',
      component: make(() => import('sentry/views/explore/savedQueries')),
    },
  ];

  const exploreRoutes = (
    <Route path="/explore/" withOrgPath newStyleChildren={exploreChildRoutes} />
  );

  // This is a layout route that will render a header for a commit
  const codecovCommitRoutes: SentryRouteObject = {
    path: 'commits/:sha/',
    component: make(() => import('sentry/views/codecov/coverage/commits/commitWrapper')),
    children: [
      {
        index: true,
        component: make(
          () => import('sentry/views/codecov/coverage/commits/commitDetail')
        ),
      },
      {
        path: 'history/',
        component: make(
          () => import('sentry/views/codecov/coverage/commits/commitHistory')
        ),
      },
      {
        path: 'yaml/',
        component: make(() => import('sentry/views/codecov/coverage/commits/commitYaml')),
      },
    ],
  };

  // This is a layout route that will render a header for a pull request
  const codecovPRRoutes: SentryRouteObject = {
    path: 'pulls/:pullId/',
    component: make(() => import('sentry/views/codecov/coverage/pulls/pullWrapper')),
    children: [
      {
        index: true,
        component: make(() => import('sentry/views/codecov/coverage/pulls/pullDetail')),
      },
    ],
  };

  const codecovChildrenRoutes: SentryRouteObject[] = [
    {
      path: 'coverage/',
      children: [
        // This is a layout route that will render a header for coverage
        {
          component: make(() => import('sentry/views/codecov/coverage/coverageWrapper')),
          children: [
            {
              path: 'file-explorer/',
              component: make(() => import('sentry/views/codecov/coverage/coverage')),
            },
            {
              path: 'commits/',
              component: make(() => import('sentry/views/codecov/coverage/commits')),
            },
            {
              path: 'pulls/',
              component: make(() => import('sentry/views/codecov/coverage/pulls')),
            },
            {
              path: 'coverage-trend/',
              component: make(
                () => import('sentry/views/codecov/coverage/coverageTrend')
              ),
            },
          ],
        },
        // Render coverage onboarding without any layout wrapping
        {
          path: 'new/',
          component: make(() => import('sentry/views/codecov/coverage/onboarding')),
        },
        codecovCommitRoutes,
        codecovPRRoutes,
      ],
    },
    {
      path: 'tests/',
      children: [
        // Render tests page with layout wrapper
        {
          component: make(() => import('sentry/views/codecov/tests/testsWrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/tests/tests')),
            },
          ],
        },
        // Render tests onboarding with layout wrapper
        {
          path: 'new/',
          component: make(() => import('sentry/views/codecov/tests/testsWrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/tests/onboarding')),
            },
          ],
        },
      ],
    },
    {
      path: 'tokens/',
      children: [
        {
          component: make(() => import('sentry/views/codecov/tokens/tokensWrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/tokens/tokens')),
            },
          ],
        },
      ],
    },
  ];

  const codecovRoutes = (
    <Route
      path="/codecov/"
      withOrgPath
      component={make(() => import('sentry/views/codecov/index'))}
      newStyleChildren={codecovChildrenRoutes}
    />
  );

  const preprodChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/preprod/buildDetails')),
    },
  ];

  const preprodRoutes = (
    <Route
      path="/preprod/:projectId/:artifactId/"
      component={make(() => import('sentry/views/preprod/index'))}
      withOrgPath
      newStyleChildren={preprodChildRoutes}
    />
  );

  const feedbackV2ChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/feedback/feedbackListPage')),
    },
    traceViewRouteObject,
  ];
  const feedbackv2Routes = (
    <Route
      path="/feedback/"
      component={make(() => import('sentry/views/feedback/index'))}
      withOrgPath
      newStyleChildren={feedbackV2ChildRoutes}
    />
  );

  const issueTabsObject: SentryRouteObject[] = [
    {
      index: true,
      component: make(
        () => import('sentry/views/issueDetails/groupEventDetails/groupEventDetails'),
        <GroupEventDetailsLoading />
      ),
    },
    {
      path: TabPaths[Tab.REPLAYS],
      component: make(() => import('sentry/views/issueDetails/groupReplays')),
    },
    {
      path: TabPaths[Tab.ACTIVITY],
      component: make(() => import('sentry/views/issueDetails/groupActivity')),
    },
    {
      path: TabPaths[Tab.EVENTS],
      component: make(() => import('sentry/views/issueDetails/groupEvents')),
    },
    {
      path: TabPaths[Tab.OPEN_PERIODS],
      component: make(() => import('sentry/views/issueDetails/groupOpenPeriods')),
    },
    {
      path: TabPaths[Tab.UPTIME_CHECKS],
      component: make(() => import('sentry/views/issueDetails/groupUptimeChecks')),
    },
    {
      path: TabPaths[Tab.CHECK_INS],
      component: make(() => import('sentry/views/issueDetails/groupCheckIns')),
    },
    {
      path: TabPaths[Tab.DISTRIBUTIONS],
      component: make(() => import('sentry/views/issueDetails/groupTags/groupTagsTab')),
    },
    {
      path: `${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`,
      component: make(() => import('sentry/views/issueDetails/groupTags/groupTagValues')),
    },
    {
      path: TabPaths[Tab.USER_FEEDBACK],
      component: make(() => import('sentry/views/issueDetails/groupUserFeedback')),
    },
    {
      path: TabPaths[Tab.ATTACHMENTS],
      component: make(() => import('sentry/views/issueDetails/groupEventAttachments')),
    },
    {
      path: TabPaths[Tab.SIMILAR_ISSUES],
      component: make(
        () => import('sentry/views/issueDetails/groupSimilarIssues/groupSimilarIssuesTab')
      ),
    },
    {
      path: TabPaths[Tab.MERGED],
      component: make(
        () => import('sentry/views/issueDetails/groupMerged/groupMergedTab')
      ),
    },
  ];

  const issueChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: errorHandler(OverviewWrapper),
    },
    {
      path: `${IssueTaxonomy.ERRORS_AND_OUTAGES}/`,
      component: make(() => import('sentry/views/issueList/pages/errorsOutages')),
    },
    {
      path: `${IssueTaxonomy.BREACHED_METRICS}/`,
      component: make(() => import('sentry/views/issueList/pages/breachedMetrics')),
    },
    {
      path: `${IssueTaxonomy.WARNINGS}/`,
      component: make(() => import('sentry/views/issueList/pages/warnings')),
    },
    {
      path: 'views/',
      component: make(
        () => import('sentry/views/issueList/issueViews/issueViewsList/issueViewsList')
      ),
    },
    {
      path: 'views/:viewId/',
      component: errorHandler(OverviewWrapper),
    },
    {
      path: 'searches/:searchId/',
      component: errorHandler(OverviewWrapper),
    },
    // Redirects for legacy tags route.
    {
      path: ':groupId/tags/',
      redirectTo: `/issues/:groupId/${TabPaths[Tab.DISTRIBUTIONS]}`,
    },
    {
      path: ':groupId/tags/:tagKey/',
      redirectTo: `/issues/:groupId/${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`,
    },
    {
      path: `:groupId/${TabPaths[Tab.EVENTS]}:eventId/tags/`,
      redirectTo: `/issues/:groupId/${TabPaths[Tab.EVENTS]}:eventId/${TabPaths[Tab.DISTRIBUTIONS]}`,
    },
    {
      path: `:groupId/${TabPaths[Tab.EVENTS]}:eventId/tags/:tagKey/`,
      redirectTo: `/issues/:groupId/${TabPaths[Tab.EVENTS]}:eventId/${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`,
    },
    {
      path: ':groupId/',
      component: make(() => import('sentry/views/issueDetails/groupDetails')),
      children: [
        ...issueTabsObject,
        {
          path: `${TabPaths[Tab.EVENTS]}:eventId/`,
          children: issueTabsObject,
        },
      ],
    },
    {
      path: 'feedback/',
      component: make(() => import('sentry/views/feedback/index')),
      children: feedbackV2ChildRoutes,
    },
    {
      path: 'alerts/',
      component: make(() => import('sentry/views/alerts')),
      children: alertChildRoutes(true),
    },
    traceViewRouteObject,
    automationRoutes,
    detectorRoutes,
  ];

  const issueRoutes = (
    <Route path="/issues/" withOrgPath newStyleChildren={issueChildRoutes} />
  );

  // These are the "manage" pages. For sentry.io, these are _different_ from
  // the SaaS admin routes in getsentry.
  const adminManageRoutes = (
    <Route
      path="/manage/"
      component={make(() => import('sentry/views/admin/adminLayout'))}
      newStyleChildren={[
        {
          index: true,
          component: make(() => import('sentry/views/admin/adminOverview')),
        },
        {
          path: 'buffer/',
          component: make(() => import('sentry/views/admin/adminBuffer')),
        },
        {
          path: 'relays/',
          component: make(() => import('sentry/views/admin/adminRelays')),
        },
        {
          path: 'organizations/',
          component: make(() => import('sentry/views/admin/adminOrganizations')),
        },
        {
          path: 'projects/',
          component: make(() => import('sentry/views/admin/adminProjects')),
        },
        {
          path: 'queue/',
          component: make(() => import('sentry/views/admin/adminQueue')),
        },
        {
          path: 'quotas/',
          component: make(() => import('sentry/views/admin/adminQuotas')),
        },
        {
          path: 'settings/',
          component: make(() => import('sentry/views/admin/adminSettings')),
        },
        {
          path: 'users/',
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/admin/adminUsers')),
            },
            {
              path: ':id',
              component: make(() => import('sentry/views/admin/adminUserEdit')),
            },
          ],
        },
        {
          path: 'status/mail/',
          component: make(() => import('sentry/views/admin/adminMail')),
        },
        {
          path: 'status/environment/',
          component: make(() => import('sentry/views/admin/adminEnvironment')),
        },
        {
          path: 'status/packages/',
          component: make(() => import('sentry/views/admin/adminPackages')),
        },
        {
          path: 'status/warnings/',
          component: make(() => import('sentry/views/admin/adminWarnings')),
        },
      ]}
    />
  );

  const legacyOrganizationRootChildRoutes: SentryRouteObject[] = [
    {
      path: '/organizations/:orgId/teams/new/',
      redirectTo: '/settings/:orgId/teams/',
    },
    {
      path: '/organizations/:orgId/',
      children: [
        routeHook('routes:legacy-organization-redirects'),
        {
          index: true,
          redirectTo: 'issues/',
        },
        {
          path: 'teams/',
          redirectTo: '/settings/:orgId/teams/',
        },
        {
          path: 'teams/your-teams/',
          redirectTo: '/settings/:orgId/teams/',
        },
        {
          path: 'teams/all-teams/',
          redirectTo: '/settings/:orgId/teams/',
        },
        {
          path: 'teams/:teamId/',
          redirectTo: '/settings/:orgId/teams/:teamId/',
        },
        {
          path: 'teams/:teamId/members/',
          redirectTo: '/settings/:orgId/teams/:teamId/members/',
        },
        {
          path: 'teams/:teamId/projects/',
          redirectTo: '/settings/:orgId/teams/:teamId/projects/',
        },
        {
          path: 'teams/:teamId/settings/',
          redirectTo: '/settings/:orgId/teams/:teamId/settings/',
        },
        {
          path: 'settings/',
          redirectTo: '/settings/:orgId/',
        },
        {
          path: 'api-keys/',
          redirectTo: '/settings/:orgId/api-keys/',
        },
        {
          path: 'api-keys/:apiKey/',
          redirectTo: '/settings/:orgId/api-keys/:apiKey/',
        },
        {
          path: 'members/',
          redirectTo: '/settings/:orgId/members/',
        },
        {
          path: 'members/:memberId/',
          redirectTo: '/settings/:orgId/members/:memberId/',
        },
        {
          path: 'rate-limits/',
          redirectTo: '/settings/:orgId/rate-limits/',
        },
        {
          path: 'repos/',
          redirectTo: '/settings/:orgId/repos/',
        },
        {
          path: 'user-feedback/',
          redirectTo: '/organizations/:orgId/feedback/',
        },
      ],
    },
  ];

  const legacyOrganizationRootRoutes = (
    <Route newStyleChildren={legacyOrganizationRootChildRoutes} />
  );

  const gettingStartedChildRoutes: SentryRouteObject[] = [
    {
      path: '/getting-started/:projectId/',
      redirectTo: '/projects/:projectId/getting-started/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/getting-started/:projectId/:platform/',
      redirectTo: '/projects/:projectId/getting-started/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/:orgId/:projectId/getting-started/',
      redirectTo: '/organizations/:orgId/projects/:projectId/getting-started/',
    },
    {
      path: '/:orgId/:projectId/getting-started/:platform/',
      redirectTo: '/organizations/:orgId/projects/:projectId/getting-started/',
    },
  ];

  const gettingStartedRoutes = <Route newStyleChildren={gettingStartedChildRoutes} />;

  const profilingRoutes = (
    <Route
      path="/profiling/"
      component={make(() => import('sentry/views/profiling'))}
      withOrgPath
      newStyleChildren={profilingChildRoutes}
    />
  );

  // Support for deprecated URLs (pre-Sentry 10). We just redirect users to new
  // canonical URLs.
  //
  // XXX(epurkhiser): Can these be moved over to the legacyOrgRedirects routes,
  // or do these need to be nested into the OrganizationLayout tree?
  const legacyOrgRedirectChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
        )
      ),
    },
    {
      path: 'issues/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
        )
      ),
    },
    {
      path: 'dashboard/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) =>
            `/organizations/${orgId}/dashboards/?project=${projectId}`
        )
      ),
    },
    {
      path: 'user-feedback/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/feedback/?project=${projectId}`
        )
      ),
    },
    {
      path: 'releases/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/releases/?project=${projectId}`
        )
      ),
    },
    {
      path: 'releases/:version/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/?project=${projectId}`
        )
      ),
    },
    {
      path: 'releases/:version/new-events/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/new-events/?project=${projectId}`
        )
      ),
    },
    {
      path: 'releases/:version/all-events/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/all-events/?project=${projectId}`
        )
      ),
    },
    {
      path: 'releases/:version/commits/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/commits/?project=${projectId}`
        )
      ),
    },
  ];

  const legacyOrgRedirects = (
    <Route path="/:orgId/:projectId/" newStyleChildren={legacyOrgRedirectChildRoutes} />
  );

  const organizationRoutes = (
    <Route component={errorHandler(OrganizationLayout)}>
      {settingsRoutes}
      {projectsRoutes}
      {dashboardRoutes}
      {feedbackv2Routes}
      {issueRoutes}
      {alertRoutes}
      {codecovRoutes}
      {preprodRoutes}
      {replayRoutes}
      {releasesRoutes}
      {statsRoutes}
      {discoverRoutes}
      {performanceRoutes}
      {domainViewRoutes}
      {tracesRoutes}
      {exploreRoutes}
      {llmMonitoringRedirects}
      {profilingRoutes}
      {gettingStartedRoutes}
      {adminManageRoutes}
      {legacyOrganizationRootRoutes}
      {legacyOrgRedirects}
    </Route>
  );

  const legacyRedirectRoutes: SentryRouteObject[] = [
    {
      path: '/:orgId/',
      children: [
        {
          index: true,
          redirectTo: '/organizations/:orgId/',
        },
        {
          path: ':projectId/settings/',
          children: [
            {
              path: 'teams/',
              redirectTo: '/settings/:orgId/projects/:projectId/teams/',
            },
            {
              path: 'alerts/',
              redirectTo: '/settings/:orgId/projects/:projectId/alerts/',
            },
            {
              path: 'alerts/rules/',
              redirectTo: '/settings/:orgId/projects/:projectId/alerts/rules/',
            },
            {
              path: 'alerts/rules/new/',
              redirectTo: '/settings/:orgId/projects/:projectId/alerts/rules/new/',
            },
            {
              path: 'alerts/rules/:ruleId/',
              redirectTo: '/settings/:orgId/projects/:projectId/alerts/rules/:ruleId/',
            },
            {
              path: 'environments/',
              redirectTo: '/settings/:orgId/projects/:projectId/environments/',
            },
            {
              path: 'environments/hidden/',
              redirectTo: '/settings/:orgId/projects/:projectId/environments/hidden/',
            },
            {
              path: 'tags/',
              redirectTo: '/settings/projects/:orgId/projects/:projectId/tags/',
            },
            {
              path: 'issue-tracking/',
              redirectTo: '/settings/:orgId/projects/:projectId/issue-tracking/',
            },
            {
              path: 'release-tracking/',
              redirectTo: '/settings/:orgId/projects/:projectId/release-tracking/',
            },
            {
              path: 'ownership/',
              redirectTo: '/settings/:orgId/projects/:projectId/ownership/',
            },
            {
              path: 'data-forwarding/',
              redirectTo: '/settings/:orgId/projects/:projectId/data-forwarding/',
            },
            {
              path: 'debug-symbols/',
              redirectTo: '/settings/:orgId/projects/:projectId/debug-symbols/',
            },
            {
              path: 'filters/',
              redirectTo: '/settings/:orgId/projects/:projectId/filters/',
            },
            {
              path: 'hooks/',
              redirectTo: '/settings/:orgId/projects/:projectId/hooks/',
            },
            {
              path: 'keys/',
              redirectTo: '/settings/:orgId/projects/:projectId/keys/',
            },
            {
              path: 'keys/:keyId/',
              redirectTo: '/settings/:orgId/projects/:projectId/keys/:keyId/',
            },
            {
              path: 'user-feedback/',
              redirectTo: '/settings/:orgId/projects/:projectId/user-feedback/',
            },
            {
              path: 'security-headers/',
              redirectTo: '/settings/:orgId/projects/:projectId/security-headers/',
            },
            {
              path: 'security-headers/csp/',
              redirectTo: '/settings/:orgId/projects/:projectId/security-headers/csp/',
            },
            {
              path: 'security-headers/expect-ct/',
              redirectTo:
                '/settings/:orgId/projects/:projectId/security-headers/expect-ct/',
            },
            {
              path: 'security-headers/hpkp/',
              redirectTo: '/settings/:orgId/projects/:projectId/security-headers/hpkp/',
            },
            {
              path: 'plugins/',
              redirectTo: '/settings/:orgId/projects/:projectId/plugins/',
            },
            {
              path: 'plugins/:pluginId/',
              redirectTo: '/settings/:orgId/projects/:projectId/plugins/:pluginId/',
            },
            {
              path: 'integrations/:providerKey/',
              redirectTo:
                '/settings/:orgId/projects/:projectId/integrations/:providerKey/',
            },
          ],
        },
        {
          path: ':projectId/group/:groupId/',
          redirectTo: 'issues/:groupId/',
        },
        {
          path: ':projectId/issues/:groupId/',
          redirectTo: '/organizations/:orgId/issues/:groupId/',
        },
        {
          path: ':projectId/issues/:groupId/events/',
          redirectTo: '/organizations/:orgId/issues/:groupId/events/',
        },
        {
          path: ':projectId/issues/:groupId/events/:eventId/',
          redirectTo: '/organizations/:orgId/issues/:groupId/events/:eventId/',
        },
        {
          path: ':projectId/issues/:groupId/tags/',
          redirectTo: '/organizations/:orgId/issues/:groupId/tags/',
        },
        {
          path: ':projectId/issues/:groupId/tags/:tagKey/',
          redirectTo: '/organizations/:orgId/issues/:groupId/tags/:tagKey/',
        },
        {
          path: ':projectId/issues/:groupId/feedback/',
          redirectTo: '/organizations/:orgId/issues/:groupId/feedback/',
        },
        {
          path: ':projectId/issues/:groupId/similar/',
          redirectTo: '/organizations/:orgId/issues/:groupId/similar/',
        },
        {
          path: ':projectId/issues/:groupId/merged/',
          redirectTo: '/organizations/:orgId/issues/:groupId/merged/',
        },
        {
          path: ':projectId/events/:eventId/',
          component: errorHandler(ProjectEventRedirect),
        },
      ],
    },
  ];

  const appRoutes = (
    <Route component={ProvideAriaRouter}>
      {experimentalSpaRoutes}
      <Route path="/" component={errorHandler(App)}>
        {rootRoutes}
        {authV2Routes}
        {organizationRoutes}
        <Route newStyleChildren={legacyRedirectRoutes} />
        <Route path="*" component={errorHandler(RouteNotFound)} />
      </Route>
    </Route>
  );

  return appRoutes;
}

// We load routes both when initializing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
export const routes = memoize(buildRoutes);

// Exported for use in tests.
export {buildRoutes};

function NoOp({children}: {children: React.JSX.Element}) {
  return children;
}
