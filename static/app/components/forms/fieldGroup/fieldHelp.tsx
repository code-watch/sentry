import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import type {FieldGroupProps} from './types';

interface FieldHelpProps extends Pick<FieldGroupProps, 'inline' | 'stacked'> {}

export const FieldHelp = styled('div')<FieldHelpProps>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(0.5))};
  line-height: 1.4;
`;
