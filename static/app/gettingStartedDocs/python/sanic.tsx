import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {
  agentMonitoringOnboarding,
  crashReportOnboardingPython,
  featureFlagOnboarding,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  getPythonAiocontextvarsConfig,
  getPythonInstallConfig,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `from sanic import Sanic
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Sanic integration adds support for the [link:Sanic Web Framework].', {
      link: <ExternalLink href="https://github.com/sanic-org/sanic" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [code:sanic] extra:',
        {
          code: <code />,
        }
      ),
      configurations: [
        ...getPythonInstallConfig({packageName: 'sentry-sdk[sanic]'}),
        ...getPythonAiocontextvarsConfig(),
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'If you have the [codeSanic:sanic] package in your dependencies, the Sanic integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          codeSanic: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `${getSdkSetupSnippet(params)}
app = Sanic(__name__)
`,
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      ),
      configurations: [
        {
          language: 'python',

          code: `from sanic.response import text
${getSdkSetupSnippet(params)}
app = Sanic(__name__)

@app.get("/")
async def hello_world(request):
    1 / 0  # raises an error
    return text("Hello, world.")
        `,
        },
      ],
      additionalInfo: tct(
        'When you point your browser to [link:http://localhost:8000/] an error will be sent to Sentry.',
        {
          link: <ExternalLink href="http://localhost:8000/" />,
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
  profilingOnboarding: getPythonProfilingOnboarding({basePackage: 'sentry-sdk[sanic]'}),
  agentMonitoringOnboarding,
};

export default docs;
