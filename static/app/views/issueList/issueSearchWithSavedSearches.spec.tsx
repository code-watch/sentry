import {SearchFixture} from 'sentry-fixture/search';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';

describe('IssueSearchWithSavedSearches', () => {
  const defaultProps = {
    query: 'is:unresolved',
    onSearch: jest.fn(),
  };

  const savedSearch = SearchFixture({
    id: '789',
    query: 'is:unresolved TypeError',
    sort: 'date',
    name: 'Unresolved TypeErrors',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('displays "Custom Search" label when no saved searches are selected', async () => {
    render(<IssueSearchWithSavedSearches {...defaultProps} />, {
      deprecatedRouterMocks: true,
    });

    expect(
      await screen.findByRole('button', {name: 'Custom Search'})
    ).toBeInTheDocument();
  });

  it('displays salected saved search label when one is selected', async () => {
    render(<IssueSearchWithSavedSearches {...defaultProps} />, {
      router: {
        params: {
          searchId: '789',
        },
      },

      deprecatedRouterMocks: true,
    });

    expect(
      await screen.findByRole('button', {name: savedSearch.name})
    ).toBeInTheDocument();
  });
});
