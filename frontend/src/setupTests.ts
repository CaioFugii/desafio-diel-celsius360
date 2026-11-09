import '@testing-library/jest-dom';
import type { ReactElement } from 'react';

// jsdom has no layout, so ResponsiveContainer would measure 0×0 and render nothing.
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  const { cloneElement } = jest.requireActual('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }: { children: ReactElement; height: number }) =>
      cloneElement(children, { width: 800, height }),
  };
});
