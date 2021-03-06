import {mountWithTheme} from 'sentry-test/enzyme';

import QueryCount from 'app/components/queryCount';

describe('QueryCount', function () {
  it('displays count when no max', function () {
    const wrapper = mountWithTheme(<QueryCount count={5} />);
    expect(wrapper).toSnapshot();
  });
  it('displays count when count < max', function () {
    const wrapper = mountWithTheme(<QueryCount count={5} max={500} />);
    expect(wrapper).toSnapshot();
  });

  it('does not render if count is 0', function () {
    const wrapper = mountWithTheme(<QueryCount count={0} />);
    expect(wrapper).toSnapshot();
  });

  it('can render when count is 0 when `hideIfEmpty` is false', function () {
    const wrapper = mountWithTheme(<QueryCount count={0} hideIfEmpty={false} />);
    expect(wrapper).toSnapshot();
  });

  it('displays max count if count >= max', function () {
    const wrapper = mountWithTheme(<QueryCount count={500} max={500} />);
    expect(wrapper).toSnapshot();
  });
});
