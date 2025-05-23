import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {flattie} from 'flattie';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import type FormModel from 'sentry/components/forms/model';
import useDrawer from 'sentry/components/globalDrawer';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DebugForm} from 'sentry/components/workflowEngine/form/debug';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import {
  AutomationBuilderContext,
  initialAutomationBuilderState,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {EditConnectedMonitorsDrawer} from 'sentry/views/automations/components/editConnectedMonitorsDrawer';
import {NEW_AUTOMATION_CONNECTED_IDS_KEY} from 'sentry/views/automations/hooks/utils';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

const FREQUENCY_OPTIONS = [
  {value: '5', label: t('5 minutes')},
  {value: '10', label: t('10 minutes')},
  {value: '30', label: t('30 minutes')},
  {value: '60', label: t('60 minutes')},
  {value: '180', label: t('3 hours')},
  {value: '720', label: t('12 hours')},
  {value: '1440', label: t('24 hours')},
  {value: '10080', label: t('1 week')},
  {value: '43200', label: t('30 days')},
];

export default function AutomationForm({model}: {model: FormModel}) {
  const organization = useOrganization();
  const title = useDocumentTitle();
  const {state, actions} = useAutomationBuilderReducer();

  useEffect(() => {
    model.setValue('name', title);
  }, [title, model]);

  const {data: monitors = []} = useDetectorsQuery();
  const storageKey = NEW_AUTOMATION_CONNECTED_IDS_KEY; // TODO: use automation id for storage key when editing an existing automation
  const [connectedIds, setConnectedIds] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
  );
  const connectedMonitors = monitors.filter(monitor => connectedIds.has(monitor.id));

  const {openDrawer, isDrawerOpen, closeDrawer} = useDrawer();

  const showEditMonitorsDrawer = () => {
    if (!isDrawerOpen) {
      openDrawer(
        () => (
          <EditConnectedMonitorsDrawer
            initialIds={connectedIds}
            onSave={ids => {
              setConnectedIds(ids);
              localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
              closeDrawer();
            }}
          />
        ),
        {
          ariaLabel: 'Edit Monitors Drawer',
          drawerKey: 'edit-monitors-drawer',
        }
      );
    }
  };

  const [environment, setEnvironment] = useState<string>('');

  return (
    <Form
      hideFooter
      model={model}
      initialData={{...flattie(initialAutomationBuilderState), frequency: '1440'}}
    >
      <AutomationBuilderContext.Provider value={{state, actions}}>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <Card>
            <Heading>{t('Connect Monitors')}</Heading>
            <ConnectedMonitorsList
              monitors={connectedMonitors}
              connectedIds={connectedIds}
              setConnectedIds={setConnectedIds}
            />
            <ButtonWrapper justify="space-between">
              <LinkButton
                icon={<IconAdd />}
                to={`${makeMonitorBasePathname(organization.slug)}new/`}
              >
                {t('Create New Monitor')}
              </LinkButton>
              <Button icon={<IconEdit />} onClick={showEditMonitorsDrawer}>
                {t('Edit Monitors')}
              </Button>
            </ButtonWrapper>
          </Card>
          <Card>
            <Flex column gap={space(0.5)}>
              <Heading>{t('Choose Environment')}</Heading>
              <Description>
                {t(
                  'If you select environments different than your monitors then the automation will not fire.'
                )}
              </Description>
            </Flex>
            <EnvironmentSelector value={environment} onChange={setEnvironment} />
          </Card>
          <Card>
            <Heading>{t('Automation Builder')}</Heading>
            <AutomationBuilder />
          </Card>
          <Card>
            <Heading>{t('Action Interval')}</Heading>
            <EmbeddedSelectField
              name="frequency"
              inline={false}
              clearable={false}
              options={FREQUENCY_OPTIONS}
            />
          </Card>
          <DebugForm />
        </Flex>
      </AutomationBuilderContext.Provider>
    </Form>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;

const Description = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  margin: 0;
  padding: 0;
`;

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin: -${space(2)};
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;
