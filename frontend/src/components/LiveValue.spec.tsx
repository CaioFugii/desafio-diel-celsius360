import { act, render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';
import { LiveValue } from './LiveValue';

type Props = ComponentProps<typeof LiveValue>;

function setup(props: Props) {
  const view = render(<LiveValue {...props} />);
  const update = (next: Partial<Props>) => {
    view.rerender(<LiveValue {...props} {...next} />);
    act(() => jest.advanceTimersByTime(1_000));
  };
  return { ...view, update };
}

const flash = (container: HTMLElement) => container.querySelector('.live-value__flash');
const changeTag = () => screen.queryByTitle('Variação em relação à leitura anterior');

describe('LiveValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders the value without highlight or change at first', () => {
    const { container } = setup({ value: 21.3, kind: 'temperature' });

    expect(container).toHaveTextContent('21,3 °C');
    expect(flash(container)).toBeNull();
    expect(changeTag()).toBeNull();
  });

  it('highlights a new value and shows how much it moved', () => {
    const { container, update } = setup({ value: 21.3, kind: 'temperature' });

    update({ value: 21.8 });

    expect(container.querySelector('.live-value__number')).toHaveTextContent('21,8 °C');
    expect(flash(container)).not.toBeNull();
    expect(changeTag()).toHaveTextContent('▲aumentou 0,5 °C');
    expect(changeTag()).toHaveClass('live-value__change--neutral');
  });

  it('restarts the highlight on every change', () => {
    const { container, update } = setup({ value: 90, kind: 'percent', better: 'up' });
    update({ value: 91 });
    const first = flash(container);

    update({ value: 89.5 });

    expect(flash(container)).not.toBe(first);
    expect(changeTag()).toHaveTextContent('▼diminuiu 1,5 p.p.');
    expect(changeTag()).toHaveClass('live-value__change--bad');
  });

  it('colors good news according to the better direction', () => {
    const { update } = setup({ value: 3, kind: 'count', better: 'down' });

    update({ value: 1 });

    expect(changeTag()).toHaveTextContent('2');
    expect(changeTag()).toHaveClass('live-value__change--good');
  });

  it('ignores changes that do not show at display precision', () => {
    const { container, update } = setup({ value: 21.31, kind: 'temperature' });

    update({ value: 21.34 });

    expect(flash(container)).toBeNull();
    expect(changeTag()).toBeNull();
  });

  it('treats a new scope as a new baseline', () => {
    const { container, update } = setup({ value: 90, kind: 'percent', scope: '7d' });
    update({ value: 92 });
    const highlight = flash(container);

    update({ value: 80, scope: '30d' });

    expect(container.querySelector('.live-value__number')).toHaveTextContent('80%');
    expect(changeTag()).toBeNull();
    expect(flash(container)).toBe(highlight);
  });

  it('drops the change when the value disappears, and highlights it when it comes back', () => {
    const { container, update } = setup({ value: 21, kind: 'temperature' });
    update({ value: 22 });
    update({ value: null });
    expect(container).toHaveTextContent('—');
    expect(changeTag()).toBeNull();
    const highlight = flash(container);

    update({ value: 23 });

    expect(flash(container)).not.toBe(highlight);
    expect(changeTag()).toBeNull();
  });

  it('renders the suffix between the value and the change', () => {
    const { container, update } = setup({ value: 2, kind: 'count', suffix: <small>/3</small> });

    update({ value: 3 });

    expect(container).toHaveTextContent('3/3▲aumentou 1');
  });
});
