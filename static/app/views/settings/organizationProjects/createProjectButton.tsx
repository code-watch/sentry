import {LinkButton} from 'sentry/components/core/button';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import useOrganization from 'sentry/utils/useOrganization';

export default function CreateProjectButton() {
  const organization = useOrganization();
  const canUserCreateProject = useCanCreateProject();

  return (
    <LinkButton
      priority="primary"
      size="sm"
      disabled={!canUserCreateProject}
      title={
        canUserCreateProject
          ? undefined
          : t('You do not have permission to create projects')
      }
      to={`/organizations/${organization.slug}/projects/new/`}
      icon={<IconAdd isCircled />}
    >
      {t('Create Project')}
    </LinkButton>
  );
}
