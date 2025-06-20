import {useEffect} from 'react';

import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

interface Props {
  feedbackId: string;
}

export default function useFetchFeedbackData({feedbackId}: Props) {
  const organization = useOrganization();
  const {getItemQueryKeys} = useFeedbackQueryKeys();
  const {issueQueryKey, eventQueryKey} = getItemQueryKeys(feedbackId);

  const {data: issueData, ...issueResult} = useApiQuery<FeedbackIssue>(
    issueQueryKey ?? [''],
    {
      staleTime: 0,
      enabled: Boolean(issueQueryKey),
    }
  );

  const {data: eventData, ...eventResult} = useApiQuery<FeedbackEvent>(
    eventQueryKey ?? [''],
    {
      staleTime: 0,
      enabled: Boolean(eventQueryKey),
    }
  );

  const {markAsRead} = useMutateFeedback({
    feedbackIds: [feedbackId],
    organization,
    projectIds: issueData?.project ? [issueData.project.id] : [],
  });

  const project = useProjectFromId({project_id: issueData?.project?.id});

  // TODO: it would be excellent if `PUT /issues/` could return the same data
  // as `GET /issues/` when query params are set. IE: it should expand inbox & owners.
  // Then we could avoid firing off 2-3 requests whenever a feedback is selected.
  // Until that is fixed, we're going to run `markAsRead` after the issue is
  // initially fetched in order to speedup initial fetch and avoid race conditions.
  useEffect(() => {
    if (project?.isMember && issueResult.isFetched && issueData && !issueData.hasSeen) {
      markAsRead(true);
    }
  }, [project?.isMember, issueData, issueResult.isFetched, markAsRead]);

  return {
    eventData,
    eventResult,
    issueData,
    issueResult,
  };
}
