import {useMemo} from 'react';
import styled from '@emotion/styled';
import {flattie} from 'flattie';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import EditableText from 'sentry/components/editableText';
import FormField from 'sentry/components/forms/formField';
import FormModel from 'sentry/components/forms/model';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AutomationBuilderContext,
  initialAutomationBuilderState,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import AutomationForm from 'sentry/views/automations/components/automationForm';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return (
    <SentryDocumentTitle
      title={title ? t('%s - New Automation', title) : t('New Automation')}
    />
  );
}

function AutomationBreadcrumbs() {
  const title = useFormField('name');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Automation'), to: makeAutomationBasePathname(organization.slug)},
        {label: title ? title : t('New Automation')},
      ]}
    />
  );
}

function EditableAutomationName() {
  return (
    <FormField name="name" inline={false} flexibleControlStateSize stacked>
      {({onChange, value}) => (
        <EditableText
          isDisabled={false}
          value={value || ''}
          onChange={newValue => {
            onChange(newValue, {
              target: {
                value: newValue,
              },
            });
          }}
          errorMessage={t('Please set a name for your automation.')}
          placeholder={t('New Automation')}
        />
      )}
    </FormField>
  );
}

const initialData = {...flattie(initialAutomationBuilderState), frequency: '1440'};

export default function AutomationNewSettings() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer();

  return (
    <FullHeightForm hideFooter initialData={initialData}>
      <AutomationDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <AutomationBreadcrumbs />
            <Layout.Title>
              <EditableAutomationName />
            </Layout.Title>
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <AutomationBuilderContext.Provider value={{state, actions}}>
              <AutomationForm model={model} />
            </AutomationBuilderContext.Provider>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={`${makeAutomationBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <Button priority="primary">{t('Create Automation')}</Button>
        </Flex>
      </StickyFooter>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
