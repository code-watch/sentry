import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import * as Storybook from 'sentry/stories';
import {decodeInteger} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export default Storybook.story('GuidedSteps', story => {
  story('Default', () => (
    <Fragment>
      <p>
        To create a GuideStep component, you should use{' '}
        <Storybook.JSXNode name="GuidedSteps" /> as the container and{' '}
        <Storybook.JSXNode name="GuidedSteps.Step" /> as direct children.
      </p>
      <p>
        You have complete control over what to render in the step titles and step content.
        You may use <Storybook.JSXNode name="GuidedSteps.StepButtons" /> to render the
        default back/next buttons, but can also render your own.
      </p>
      <Storybook.SizingWindow display="block">
        <GuidedSteps>
          <GuidedSteps.Step title="Step 1 Title" stepKey="step-1">
            This is the first step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
          <GuidedSteps.Step title="Step 2 Title" stepKey="step-2">
            This is the second step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
          <GuidedSteps.Step title="Step 3 Title" stepKey="step-3" optional>
            This is the third step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
        </GuidedSteps>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Custom button behavior', () => {
    function SkipToLastButton() {
      const {setCurrentStep, totalSteps} = useGuidedStepsContext();
      return (
        <GuidedSteps.ButtonWrapper>
          <Button size="sm" onClick={() => setCurrentStep(totalSteps)}>
            Skip to Last Step
          </Button>
        </GuidedSteps.ButtonWrapper>
      );
    }

    return (
      <Fragment>
        <p>
          A hook is provided to access and control the step state:{' '}
          <code>useGuidedStepsContext()</code>. This can be used to create step buttons
          with custom behavior.
        </p>
        <Storybook.SizingWindow display="block">
          <GuidedSteps>
            <GuidedSteps.Step title="Step 1 Title" stepKey="step-1">
              This is the first step.
              <SkipToLastButton />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 2 Title" stepKey="step-2">
              This is the second step.
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 3 Title" stepKey="step-3">
              This is the third step.
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
          </GuidedSteps>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Controlling completed state', () => {
    return (
      <Fragment>
        <p>
          By default, previous steps are considered completed. However, if the completed
          state is known it can be controlled using the <code>isCompleted</code> property
          on <Storybook.JSXNode name="GuidedSteps.Step" />. The GuidedStep component will
          begin on the first incomplete step.
        </p>
        <Storybook.SizingWindow display="block">
          <GuidedSteps>
            <GuidedSteps.Step title="Step 1 Title" stepKey="step-1" isCompleted>
              Congrats, you finished the first step!
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 2 Title" stepKey="step-2" isCompleted={false}>
              You haven't completed the second step yet, here's how you do it.
              <GuidedSteps.ButtonWrapper>
                <GuidedSteps.BackButton />
              </GuidedSteps.ButtonWrapper>
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 3 Title" stepKey="step-3" isCompleted={false}>
              You haven't completed the third step yet, here's how you do it.
              <GuidedSteps.ButtonWrapper>
                <GuidedSteps.BackButton />
              </GuidedSteps.ButtonWrapper>
            </GuidedSteps.Step>
          </GuidedSteps>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Show initial step based on url parameter', () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
      <Fragment>
        <p>
          When the page loads, the component will display the current step based on the
          URL parameter—if one is present. This is especially useful for scenarios like
          onboarding flows with empty states, where preserving the step state across
          refreshes helps improve the user experience. This is accomplished by passing a
          value to the <code>initialStep</code> prop and updating the URL param by using
          the <code>onStepChange</code> prop.
        </p>
        <GuidedSteps
          initialStep={decodeInteger(location.query.guidedStep)}
          onStepChange={step => {
            navigate({
              pathname: location.pathname,
              query: {
                ...location.query,
                guidedStep: step,
              },
            });
          }}
        >
          <GuidedSteps.Step title="Step 1 Title" stepKey="step-1">
            This is the first step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
          <GuidedSteps.Step title="Step 2 Title" stepKey="step-2">
            This is the second step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
          <GuidedSteps.Step title="Step 3 Title" stepKey="step-3">
            This is the third step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
        </GuidedSteps>
      </Fragment>
    );
  });
});
