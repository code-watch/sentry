import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {space} from 'sentry/styles/space';

interface SegmentedLoadingBarProps {
  /**
   * The index of the segment that is currently active. The active segment is
   * highlighted by a pulsing animation.
   */
  phase: number;

  /**
   * The number of segments to display.
   */
  segments: number;

  /**
   * A callback to get a tooltip text for a given phase.
   *
   * The callback takes a phase index that corresponds to the index of the
   * segment being rendered.
   */
  getTooltipText?: (phase: number) => React.ReactNode | undefined;
}

export function SegmentedLoadingBar({
  segments = 3,
  phase = 0,
  getTooltipText,
}: SegmentedLoadingBarProps) {
  return (
    <LoadingBarContainer>
      {Array.from({length: segments}).map((_, index) => (
        <Tooltip key={index} title={getTooltipText?.(index)} skipWrapper>
          <LoadingBarSegment
            key={index}
            isActive={index === phase}
            isCompleted={index < phase}
          />
        </Tooltip>
      ))}
    </LoadingBarContainer>
  );
}

const LoadingBarContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: ${space(0.5)};
  width: 100%;
`;

const LoadingBarSegment = styled('div')<{isActive?: boolean; isCompleted?: boolean}>`
  flex: 1;
  height: 6px;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  ${p =>
    p.isActive &&
    css`
      background-color: ${p.theme.gray200};
      animation: pulse 500ms ease-in-out infinite alternate-reverse;
    `}
  ${p =>
    p.isCompleted &&
    css`
      background-color: ${p.theme.gray200};
    `}

  @keyframes pulse {
    0% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;
