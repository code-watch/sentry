import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';

function Component(props: Partial<React.HTMLAttributes<HTMLInputElement>>) {
  const {wrapTrigger} = useHoverOverlay({skipWrapper: true});

  return wrapTrigger(<input {...props} />);
}

describe('useHoverOverlay', () => {
  it('skipWrapper=true composes handlers', async () => {
    const componentProps = {
      onPointerEnter: jest.fn(),
      onPointerLeave: jest.fn(),
      onFocus: jest.fn(),
      onBlur: jest.fn(),
    };

    render(<Component {...componentProps} />);

    const input = screen.getByRole('textbox');

    await userEvent.hover(input);
    expect(componentProps.onPointerEnter).toHaveBeenCalled();

    await userEvent.unhover(input);
    expect(componentProps.onPointerLeave).toHaveBeenCalled();

    await userEvent.click(input);
    expect(componentProps.onFocus).toHaveBeenCalled();

    await userEvent.tab();
    expect(componentProps.onBlur).toHaveBeenCalled();
  });

  it('skipWrapper=true does not swallow refs', () => {
    function InnerComponent(
      props: Partial<React.HTMLAttributes<HTMLDivElement>> &
        React.RefAttributes<HTMLDivElement>
    ) {
      return <div {...props} />;
    }

    const ref = jest.fn();

    const WrappedComponent = () => {
      const {wrapTrigger} = useHoverOverlay({skipWrapper: true});
      return wrapTrigger(<InnerComponent ref={ref} />);
    };

    render(<WrappedComponent />);
    expect(ref).toHaveBeenCalled();
  });
});
