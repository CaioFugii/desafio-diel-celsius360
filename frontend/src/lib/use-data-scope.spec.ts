import { renderHook } from '@testing-library/react';
import { useDataScope } from './use-data-scope';

describe('useDataScope', () => {
  it('keeps the previous scope while placeholder data is on screen', () => {
    const { result, rerender } = renderHook(
      ({ requested, placeholder }) => useDataScope(requested, placeholder),
      { initialProps: { requested: '7d', placeholder: false } },
    );
    expect(result.current).toBe('7d');

    rerender({ requested: '30d', placeholder: true });
    expect(result.current).toBe('7d');

    rerender({ requested: '30d', placeholder: false });
    expect(result.current).toBe('30d');

    rerender({ requested: '1d', placeholder: true });
    expect(result.current).toBe('30d');
  });
});
