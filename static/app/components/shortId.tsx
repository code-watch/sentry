import * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import AutoSelectText from 'app/components/autoSelectText';

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export default class ShortId extends React.Component<Props> {
  render() {
    const {shortId, avatar} = this.props;

    if (!shortId) {
      return null;
    }

    return (
      <StyledShortId {...this.props}>
        {avatar}
        <StyledAutoSelectText avatar={!!avatar}>{shortId}</StyledAutoSelectText>
      </StyledShortId>
    );
  }
}

const StyledShortId = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const StyledAutoSelectText = styled(AutoSelectText, {shouldForwardProp: isPropValid})<{
  avatar: boolean;
}>`
  margin-left: ${p => p.avatar && '0.5em'};
  min-width: 0;
`;
