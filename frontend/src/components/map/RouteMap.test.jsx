import { render, screen, waitFor } from '@testing-library/react';
import RouteMap from './RouteMap';
import { markerGroups } from './routeMapUtils';
import * as engine from './routeMapEngine';

jest.mock('./routeMapEngine', () => ({
  canRender: jest.fn(() => true),
  createRouteMap: jest.fn(() => ({ update: jest.fn(), destroy: jest.fn() })),
}));

const hanoi = { name: 'Hanoi', lat: 21.03, lng: 105.85 };
const sapa = { name: 'Sapa', lat: 22.34, lng: 103.84 };

beforeEach(() => { jest.clearAllMocks(); engine.canRender.mockReturnValue(true); });

test('markerGroups: one marker per town, repeat visits share it', () => {
  const g = markerGroups([hanoi, sapa, { ...hanoi }]);
  expect(g.map(x => [x.name, x.numbers])).toEqual([['Hanoi', [1, 3]], ['Sapa', [2]]]);
});

test('renders nothing without coordinates', () => {
  const { container } = render(<RouteMap stops={[{ name: 'Somewhere', lat: null, lng: null }]} />);
  expect(container).toBeEmptyDOMElement();
  expect(engine.createRouteMap).not.toHaveBeenCalled();
});

test('draws only located stops, with an accessible label', async () => {
  render(<RouteMap stops={[hanoi, { name: 'Nowhere', lat: null, lng: 5 }, sapa]} />);
  expect(screen.getByRole('region', { name: 'Map of your route: Hanoi → Sapa' })).toBeInTheDocument();
  await waitFor(() => expect(engine.createRouteMap).toHaveBeenCalledTimes(1));
  expect(engine.createRouteMap.mock.calls[0][1].stops.map(s => s.name)).toEqual(['Hanoi', 'Sapa']);
});

test('new stops update the same map; unmount destroys it', async () => {
  const { rerender, unmount } = render(<RouteMap stops={[hanoi]} />);
  await waitFor(() => expect(engine.createRouteMap).toHaveBeenCalledTimes(1));
  const handle = engine.createRouteMap.mock.results[0].value;
  rerender(<RouteMap stops={[hanoi, sapa]} />);
  await waitFor(() => expect(handle.update).toHaveBeenCalled());
  expect(engine.createRouteMap).toHaveBeenCalledTimes(1);
  unmount();
  expect(handle.destroy).toHaveBeenCalled();
});

test('hides itself when the browser cannot draw maps', async () => {
  engine.canRender.mockReturnValue(false);
  const { container } = render(<RouteMap stops={[hanoi, sapa]} />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

test('hides itself when the map fails to load', async () => {
  engine.createRouteMap.mockImplementationOnce((el, { onError }) => { onError(new Error('tiles blocked')); return { update: jest.fn(), destroy: jest.fn() }; });
  const { container } = render(<RouteMap stops={[hanoi, sapa]} />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
