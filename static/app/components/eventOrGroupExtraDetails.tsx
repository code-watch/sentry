import styled from '@emotion/styled';

import EventAnnotation from 'sentry/components/events/eventAnnotation';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import InboxShortId from 'sentry/components/group/inboxBadges/shortId';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import IssueReplayCount from 'sentry/components/group/issueReplayCount';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconChat} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  data: Event | Group;
  organization: Organization;
  showAssignee?: boolean;
  showLifetime?: boolean;
};

function Lifetime({
  firstSeen,
  lastSeen,
  lifetime,
}: {
  firstSeen: string;
  lastSeen: string;
  lifetime?: Group['lifetime'];
}) {
  if (!lifetime && !firstSeen && !lastSeen) {
    return <Placeholder height="12px" width="100px" />;
  }

  return (
    <TimesTag
      lastSeen={lifetime?.lastSeen || lastSeen}
      firstSeen={lifetime?.firstSeen || firstSeen}
    />
  );
}

function EventOrGroupExtraDetails({
  data,
  showAssignee,
  organization,
  showLifetime = true,
}: Props) {
  const {
    id,
    lastSeen,
    firstSeen,
    subscriptionDetails,
    numComments,
    logger,
    assignedTo,
    annotations,
    shortId,
    project,
    lifetime,
    isUnhandled,
  } = data as Group;

  const issuesPath = `/organizations/${organization.slug}/issues/`;

  const showReplayCount =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(organization, project);

  return (
    <GroupExtra>
      {shortId && (
        <InboxShortId
          shortId={shortId}
          avatar={
            project && (
              <ShadowlessProjectBadge project={project} avatarSize={12} hideName />
            )
          }
        />
      )}
      {isUnhandled && <UnhandledTag />}
      {showLifetime ? (
        <Lifetime firstSeen={firstSeen} lastSeen={lastSeen} lifetime={lifetime} />
      ) : null}
      {/* Always display comment count on inbox */}
      {numComments > 0 && (
        <CommentsLink to={`${issuesPath}${id}/activity/`} className="comments">
          <IconChat
            size="xs"
            color={
              subscriptionDetails?.reason === 'mentioned' ? 'successText' : undefined
            }
          />
          <span>{numComments}</span>
        </CommentsLink>
      )}
      {showReplayCount && <IssueReplayCount group={data as Group} />}
      {logger && (
        <LoggerAnnotation>
          <GlobalSelectionLink
            to={{
              pathname: issuesPath,
              query: {
                query: `logger:${logger}`,
              },
            }}
          >
            {logger}
          </GlobalSelectionLink>
        </LoggerAnnotation>
      )}
      {annotations?.map((annotation, key) => (
        <AnnotationNoMargin key={key}>
          <ExternalLink href={annotation.url}>{annotation.displayName}</ExternalLink>
        </AnnotationNoMargin>
      ))}

      {showAssignee && assignedTo && (
        <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>
      )}
    </GroupExtra>
  );
}

const GroupExtra = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(1.5)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  position: relative;
  min-width: 500px;
  white-space: nowrap;
  line-height: 1.2;

  a {
    color: inherit;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    line-height: 1;
  }
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  * > img {
    box-shadow: none;
  }
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  gap: ${space(0.5)};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.textColor};
`;

const AnnotationNoMargin = styled(EventAnnotation)`
  margin-left: 0;
  padding-left: 0;
  border-left: none;
  & > a {
    color: ${p => p.theme.textColor};
  }
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.textColor};
`;

export default withOrganization(EventOrGroupExtraDetails);
