import styled from '@emotion/styled';

import ConfirmDelete from 'sentry/components/confirmDelete';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconDelete, IconStats, IconUpgrade} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

type Props = {
  app: SentryApp;
  onDelete: (app: SentryApp) => void;

  org: Organization;
  showDelete: boolean;
  showPublish: boolean;
  disableDeleteReason?: string;
  // If you want to disable the publish or delete buttons, pass in a reason to display to the user in a tooltip
  disablePublishReason?: string;
  onPublish?: () => void;
};

function ActionButtons({
  org,
  app,
  showPublish,
  showDelete,
  onPublish,
  onDelete,
  disablePublishReason,
  disableDeleteReason,
}: Props) {
  const appDashboardButton = (
    <StyledLinkButton
      size="xs"
      icon={<IconStats />}
      to={`/settings/${org.slug}/developer-settings/${app.slug}/dashboard/`}
    >
      {t('Dashboard')}
    </StyledLinkButton>
  );

  const publishRequestButton = showPublish ? (
    <StyledButton
      disabled={!!disablePublishReason}
      title={disablePublishReason}
      icon={<IconUpgrade />}
      size="xs"
      onClick={onPublish}
    >
      {t('Publish')}
    </StyledButton>
  ) : null;

  const deleteConfirmMessage = t(
    `Deleting %s will also delete any and all of its installations. This is a permanent action. Do you wish to continue?`,
    app.slug
  );
  const deleteButton = showDelete ? (
    disableDeleteReason ? (
      <StyledButton
        disabled
        title={disableDeleteReason}
        size="xs"
        icon={<IconDelete />}
        aria-label={t('Delete')}
      />
    ) : (
      onDelete && (
        <ConfirmDelete
          message={deleteConfirmMessage}
          confirmInput={app.slug}
          priority="danger"
          onConfirm={() => onDelete(app)}
        >
          <StyledButton size="xs" icon={<IconDelete />} aria-label={t('Delete')} />
        </ConfirmDelete>
      )
    )
  ) : null;

  return (
    <ButtonHolder>
      {appDashboardButton}
      {publishRequestButton}
      {deleteButton}
    </ButtonHolder>
  );
}

const ButtonHolder = styled('div')`
  flex-direction: row;
  display: flex;
  & > * {
    margin-left: ${space(0.5)};
  }
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const StyledLinkButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
`;

export default ActionButtons;
