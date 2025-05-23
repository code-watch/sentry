import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import * as globalActions from 'sentry/actionCreators/pageFilters';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import localStorage from 'sentry/utils/localStorage';

const changeQuery = (router: any, query: any) => ({
  ...router,
  location: {
    ...router.location,
    query,
  },
});

function renderComponent(component: any, router: any, organization: any) {
  return render(component, {
    router,
    organization,
    deprecatedRouterMocks: true,
  });
}

describe('PageFiltersContainer', function () {
  const {organization, projects, router} = initializeOrg({
    organization: {features: ['global-views']},
    projects: [
      {
        id: '1',
        slug: 'project-1',
      },
      {
        id: '2',
        slug: 'project-2',
      },
      {
        id: '3',
        slug: 'project-3',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {pathname: '/test', query: {}},
      params: {orgId: 'org-slug'},
    },
  });

  beforeAll(function () {
    jest.spyOn(globalActions, 'updateDateTime');
    jest.spyOn(globalActions, 'updateEnvironments');
    jest.spyOn(globalActions, 'updateProjects');
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData(projects);
    OrganizationStore.onUpdate(organization);
    OrganizationsStore.addOrReplace(organization);

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
    PageFiltersStore.reset();
  });

  it('does not update router if org in URL params is different than org in context/props', function () {
    renderComponent(
      <PageFiltersContainer />,
      {
        router: {...router, params: {orgId: 'diff-org'}},
      },
      organization
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not replace URL with values from store when mounted with no query params', function () {
    renderComponent(<PageFiltersContainer />, router, organization);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only updates GlobalSelection store when mounted with query params', async function () {
    renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {statsPeriod: '7d'}),
      organization
    );

    expect(router.push).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(PageFiltersStore.getState().selection).toEqual({
        datetime: {
          period: '7d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      })
    );
  });

  it('updates GlobalSelection store with default period', async function () {
    renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {
        environment: 'prod',
      }),
      organization
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(),
        shouldPersist: true,
        selection: {
          datetime: {
            period: '14d',
            utc: null,
            start: null,
            end: null,
          },
          environments: ['prod'],
          projects: [],
        },
      })
    );

    // Not called because of the default date
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('updates GlobalSelection store with empty dates in URL', async function () {
    renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {
        statsPeriod: null,
      }),
      organization
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(),
        shouldPersist: true,
        selection: {
          datetime: {
            period: '14d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        },
      })
    );
  });

  it('resets start&end if showAbsolute prop is false', async function () {
    renderComponent(
      <PageFiltersContainer showAbsolute={false} />,
      changeQuery(router, {
        start: '2020-05-05T07:26:53.000',
        end: '2020-05-05T09:19:12.000',
      }),
      organization
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual({
        isReady: true,
        desyncedFilters: new Set(),
        pinnedFilters: new Set(),
        shouldPersist: true,
        selection: {
          datetime: {
            period: '14d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        },
      })
    );
  });

  /**
   * I don't think this test is really applicable anymore
   */
  it('does not update store if url params have not changed', async function () {
    const {rerender} = renderComponent(
      <PageFiltersContainer />,
      changeQuery(router, {statsPeriod: '7d'}),
      organization
    );

    jest.mocked(globalActions.updateDateTime).mockClear();
    jest.mocked(globalActions.updateProjects).mockClear();
    jest.mocked(globalActions.updateEnvironments).mockClear();

    rerender(<PageFiltersContainer />);

    await waitFor(() => {
      expect(globalActions.updateDateTime).not.toHaveBeenCalled();
    });
    expect(globalActions.updateProjects).not.toHaveBeenCalled();
    expect(globalActions.updateEnvironments).not.toHaveBeenCalled();

    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '7d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('loads from local storage when no URL parameters and filters are pinned', function () {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [3],
        environments: ['staging'],
        pinnedFilters: ['projects', 'environments'],
      })
    );
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    expect(PageFiltersStore.getState().selection.projects).toEqual([3]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: {
          environment: ['staging'],
          project: ['3'],
        },
      })
    );
  });

  it('does not load from local storage when there are URL params', function () {
    jest
      .spyOn(localStorage, 'getItem')
      .mockImplementation(() =>
        JSON.stringify({projects: [3], environments: ['staging']})
      );

    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {project: ['1', '2']}},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store when there are query params in URL', function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {project: ['1', '2']}},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);

    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with default values when there are no query params in URL', function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      projects: [ProjectFixture({id: '1'}), ProjectFixture({id: '2'})],
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {}},
      },
    });

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    // Router does not update because params have not changed
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with desynced values when url params do not match local storage', async function () {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [1],
        pinnedFilters: ['projects'],
      })
    );

    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {
          query: {project: ['2']},
        },
      },
    });

    OrganizationStore.onUpdate(initializationObj.organization);

    renderComponent(
      <PageFiltersContainer />,
      initializationObj.router,
      initializationObj.organization
    );

    // reflux tick
    expect(PageFiltersStore.getState().selection.projects).toEqual([2]);

    // Wait for desynced filters to update
    await waitFor(() =>
      expect(PageFiltersStore.getState().desyncedFilters).toEqual(new Set(['projects']))
    );
  });

  it('does not update local storage when disablePersistence is true', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        // we need this to be set to make sure org in context is same as
        // current org in URL
        params: {orgId: 'org-slug'},
        location: {pathname: '/test', query: {project: []}},
      },
    });

    const spy = jest.spyOn(Storage.prototype, 'setItem');

    renderComponent(
      <PageFiltersContainer disablePersistence />,
      initializationObj.router,
      initializationObj.organization
    );

    await act(async () => {
      globalActions.updateProjects([1], initializationObj.router, {save: true});

      // page filter values are asynchronously persisted to local storage after a tick,
      // so we need to wait before checking for commits to local storage
      await tick();
    });

    // Store value was updated
    expect(PageFiltersStore.getState().selection.projects).toEqual([1]);

    // But local storage wasn't updated
    expect(spy).not.toHaveBeenCalled();
  });

  /**
   * GSH: (no global-views)
   * - mounts with no state from router
   *   - params org id === org.slug
   *
   * - updateProjects should not be called (enforceSingleProject should not be
   *   called)
   *
   * - componentDidUpdate with loadingProjects === true, and pass in list of
   *   projects (via projects store)
   *
   * - enforceProject should be called and updateProjects() called with the new
   *   project
   *   - variation:
   *     - params.orgId !== org.slug (e.g. just switched orgs)
   *
   * When switching orgs when not in Issues view, the issues view gets rendered
   * with params.orgId !== org.slug
   *
   * Global selection header gets unmounted and mounted, and in this case
   * nothing should be done until it gets updated and params.orgId === org.slug
   *
   * Separate issue:
   *
   * IssuesList ("child view") renders before a single project is enforced,
   * will require refactoring views so that they depend on GSH enforcing a
   * single project first IF they don't have required feature (and no project id
   * in URL).
   */
  describe('Single project selection mode', function () {
    it('does not do anything while organization is switching in single project', function () {
      const initialData = initializeOrg({
        organization: {slug: 'old-org-slug'},
        router: {
          // we need this to be set to make sure org in context is same as
          // current org in URL
          params: {orgId: 'org-slug'},
          location: {pathname: '/test', query: {project: ['1']}},
        },
      });

      MockApiClient.addMockResponse({
        url: '/organizations/old-org-slug/projects/',
        body: [],
      });

      ProjectsStore.reset();

      // This can happen when you switch organization so params.orgId !== the
      // current org in context In this case params.orgId = 'org-slug'
      const {rerender} = renderComponent(
        <PageFiltersContainer />,
        initialData.router,
        initialData.organization
      );

      expect(globalActions.updateProjects).not.toHaveBeenCalled();

      const updatedOrganization = {
        ...organization,
        slug: 'org-slug',
        features: [],
        projects: [ProjectFixture({id: '123', slug: 'org-slug-project1'})],
      };

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: updatedOrganization,
      });

      // Eventually OrganizationContext will fetch org details for `org-slug`
      // and update `organization` prop emulate fetchOrganizationDetails
      act(() => OrganizationStore.onUpdate(updatedOrganization));

      initialData.router.location.query = {};
      rerender(<PageFiltersContainer />);

      act(() => ProjectsStore.loadInitialData(updatedOrganization.projects));

      expect(initialData.router.replace).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['123']},
        })
      );
    });

    it('selects first project if more than one is requested', function () {
      const initializationObj = initializeOrg({
        router: {
          // we need this to be set to make sure org in context is same as
          // current org in URL
          params: {orgId: 'org-slug'},
          location: {pathname: '/test', query: {project: ['1', '2']}},
        },
      });

      renderComponent(
        <PageFiltersContainer />,
        initializationObj.router,
        initializationObj.organization
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['1']},
        })
      );
    });

    it('selects a project if user is superuser and belongs to no projects', function () {
      ConfigStore.init();
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: true}),
        })
      );
      const project = ProjectFixture({id: '3', isMember: false});
      const org = OrganizationFixture();

      ProjectsStore.loadInitialData([project]);

      const initializationObj = initializeOrg({
        organization: org,
        router: {
          params: {orgId: 'org-slug'},
          location: {pathname: '/test', query: {}},
        },
      });

      renderComponent(
        <PageFiltersContainer />,
        initializationObj.router,
        initializationObj.organization
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['3']},
        })
      );
    });

    it('selects first project if none (i.e. all) is requested', function () {
      const project = ProjectFixture({id: '3'});
      const org = OrganizationFixture();

      ProjectsStore.loadInitialData([project]);

      const initializationObj = initializeOrg({
        organization: org,
        router: {
          params: {orgId: 'org-slug'},
          location: {pathname: '/test', query: {}},
        },
      });

      renderComponent(
        <PageFiltersContainer />,
        initializationObj.router,
        initializationObj.organization
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['3']},
        })
      );
    });
  });

  describe('forceProject selection mode', function () {
    const initialData = initializeOrg({
      organization: {features: ['global-views']},
      projects: [
        {id: '1', slug: 'staging-project', environments: ['staging']},
        {id: '2', slug: 'prod-project', environments: ['prod']},
      ],
      router: {
        location: {pathname: '/test', query: {}},
      },
    });

    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });

      ProjectsStore.loadInitialData(initialData.projects);
    });

    it('replaces URL with project', function () {
      renderComponent(
        <PageFiltersContainer
          shouldForceProject
          forceProject={initialData.projects[0]}
        />,
        initialData.router,
        initialData.organization
      );

      expect(initialData.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: ['1']},
        })
      );
    });
  });

  describe('maxPickableDays param', function () {
    it('applies maxPickableDays if the query parms exceed it', async function () {
      renderComponent(
        <PageFiltersContainer maxPickableDays={7} />,
        changeQuery(router, {statsPeriod: '14d'}),
        organization
      );

      expect(router.push).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection).toEqual({
          datetime: {
            period: '7d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        })
      );

      expect(router.push).not.toHaveBeenCalled();
    });

    it('does not use maxPickableDays if the query parms do not exceed it', async function () {
      renderComponent(
        <PageFiltersContainer maxPickableDays={7} />,
        changeQuery(router, {statsPeriod: '3d'}),
        organization
      );

      expect(router.push).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection).toEqual({
          datetime: {
            period: '3d',
            utc: null,
            start: null,
            end: null,
          },
          environments: [],
          projects: [],
        })
      );

      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('skipInitializeUrlParams', function () {
    const initialData = initializeOrg({
      organization,
      projects: [{id: '1', slug: 'staging-project', environments: ['staging']}],
      router: {
        location: {pathname: '/test', query: {}},
      },
    });

    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      ProjectsStore.loadInitialData(initialData.projects);
    });

    it('does not add forced project to URL', async function () {
      renderComponent(
        <PageFiltersContainer
          skipInitializeUrlParams
          shouldForceProject
          forceProject={initialData.projects[0]}
        />,
        initialData.router,
        initialData.organization
      );

      // Needed to make sure things update
      await act(tick);

      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe('without global-views (multi-project feature)', function () {
    describe('without existing URL params', function () {
      const initialData = initializeOrg({
        projects: [
          {id: '0', slug: 'random project', isMember: true},
          {id: '1', slug: 'staging-project', environments: ['staging']},
          {id: '2', slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {pathname: '/test', query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      function getComponentForNonGlobalView(props: any) {
        return (
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            {...props}
          />
        );
      }

      function renderForNonGlobalView(props = {}) {
        const result = renderComponent(
          getComponentForNonGlobalView(props),
          initialData.router,
          initialData.organization
        );

        const rerender = (newProps: any) =>
          result.rerender(getComponentForNonGlobalView({...props, ...newProps}));

        return {...result, rerender};
      }

      beforeEach(function () {
        ProjectsStore.loadInitialData(initialData.projects);

        jest.mocked(initialData.router.push).mockClear();
        jest.mocked(initialData.router.replace).mockClear();
      });

      it('uses first project in org projects when mounting', function () {
        renderForNonGlobalView();

        // Projects are returned in sorted slug order, so `prod-project` would
        // be the first project
        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {cursor: undefined, environment: [], project: ['2']},
        });
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', function () {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        const {rerender} = renderForNonGlobalView({shouldForceProject: true});

        rerender({forceProject: initialData.projects[1]});

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {environment: [], project: ['1']},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', async function () {
        // forceProject generally starts undefined
        const {rerender} = renderForNonGlobalView({shouldForceProject: true});

        initialData.router.location.query = {project: '321'};
        rerender({forceProject: initialData.projects[1]});

        await act(tick);
        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when mounted with `forceProject`', function () {
        // forceProject generally starts undefined
        renderForNonGlobalView({
          shouldForceProject: true,
          forceProject: initialData.projects[1],
        });

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {environment: [], project: ['1']},
        });
      });
    });

    describe('with existing URL params', function () {
      const initialData = initializeOrg({
        projects: [
          {id: '0', slug: 'random project', isMember: true},
          {id: '1', slug: 'staging-project', environments: ['staging']},
          {id: '2', slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {pathname: '/test', query: {statsPeriod: '90d'}},
          params: {orgId: 'org-slug'},
        },
      });

      beforeEach(function () {
        ProjectsStore.loadInitialData(initialData.projects);
        jest.mocked(initialData.router.push).mockClear();
        jest.mocked(initialData.router.replace).mockClear();
      });

      it('appends projectId to URL when mounted with `forceProject`', function () {
        // forceProject generally starts undefined
        renderComponent(
          <PageFiltersContainer
            shouldForceProject
            forceProject={initialData.projects[1]}
          />,
          initialData.router,
          initialData.organization
        );

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {environment: [], project: ['1'], statsPeriod: '90d'},
        });
      });
    });
  });

  describe('with global-views (multi-project feature)', function () {
    describe('without existing URL params', function () {
      const initialData = initializeOrg({
        organization: {features: ['global-views']},
        projects: [
          {id: '0', slug: 'random project', isMember: true},
          {id: '1', slug: 'staging-project', environments: ['staging']},
          {id: '2', slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {pathname: '/test', query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      function getComponentForGlobalView(props: any) {
        return (
          <PageFiltersContainer
            params={{orgId: initialData.organization.slug}}
            {...props}
          />
        );
      }

      function renderForGlobalView(props = {}, ctx = {}) {
        const result = renderComponent(
          getComponentForGlobalView(props),
          {
            ...initialData.router,
            ...ctx,
          },
          initialData.organization
        );

        const rerender = (newProps: any) =>
          result.rerender(getComponentForGlobalView({...props, ...newProps}));

        return {...result, rerender};
      }

      beforeEach(function () {
        ProjectsStore.loadInitialData(initialData.projects);

        jest.mocked(initialData.router.push).mockClear();
        jest.mocked(initialData.router.replace).mockClear();
      });

      it('does not use first project in org projects when mounting (and without localStorage data)', function () {
        renderForGlobalView();
        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('does not append projectId to URL when `loadingProjects` changes and finishes loading', function () {
        ProjectsStore.reset();

        const {rerender} = renderForGlobalView();

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        rerender({forceProject: initialData.projects[1]});

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', function () {
        ProjectsStore.reset();

        // forceProject generally starts undefined
        const {rerender} = renderForGlobalView({shouldForceProject: true});

        rerender({forceProject: initialData.projects[1]});

        // load the projects
        act(() => ProjectsStore.loadInitialData(initialData.projects));

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: '/test',
          query: {environment: [], project: ['1']},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', function () {
        // forceProject generally starts undefined
        const {rerender} = renderForGlobalView(
          {shouldForceProject: true},
          changeQuery(initialData.router, {project: 2})
        );

        rerender({forceProject: initialData.projects[1]});

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });
    });
  });
});
