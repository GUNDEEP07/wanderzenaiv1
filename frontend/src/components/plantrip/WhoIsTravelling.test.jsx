import { render, screen, fireEvent } from '@testing-library/react';
import { WhoIsTravelling, CountryChips, DEFAULT_TRIP_PREFS, CURATED_COUNTRIES } from './WhoIsTravelling';

test('country chips pick a whole country', () => {
  const onPick = jest.fn();
  render(<CountryChips selectedName="Japan" onPick={onPick} />);
  expect(CURATED_COUNTRIES).toHaveLength(10);
  fireEvent.click(screen.getByText('Vietnam'));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vietnam', country: 'Vietnam', isCountry: true }));
});

test('adults stepper stays within 1–12', () => {
  const onChange = jest.fn();
  render(<WhoIsTravelling value={{ ...DEFAULT_TRIP_PREFS, adults: 1 }} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('One adult fewer'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ adults: 1 }));
  fireEvent.click(screen.getByLabelText('One adult more'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ adults: 2 }));
});

test('add, age and remove a child', () => {
  const onChange = jest.fn();
  const { rerender } = render(<WhoIsTravelling value={DEFAULT_TRIP_PREFS} onChange={onChange} />);
  fireEvent.click(screen.getByText('+ Add a child'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kids: [6] }));
  rerender(<WhoIsTravelling value={{ ...DEFAULT_TRIP_PREFS, kids: [6] }} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Age of child 1'), { target: { value: '3' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kids: [3] }));
  fireEvent.click(screen.getByLabelText('Remove child 1'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kids: [] }));
});

test('overnight journeys are disabled with an under-6', () => {
  render(<WhoIsTravelling value={{ ...DEFAULT_TRIP_PREFS, kids: [4], overnightOk: true }} onChange={jest.fn()} />);
  const box = screen.getByRole('checkbox');
  expect(box).toBeDisabled();
  expect(box).not.toBeChecked();
  expect(screen.getByText(/not suggested with under-6s/)).toBeInTheDocument();
});

test('travel-time comfort buttons', () => {
  const onChange = jest.fn();
  render(<WhoIsTravelling value={DEFAULT_TRIP_PREFS} onChange={onChange} />);
  fireEvent.click(screen.getByText('Short hops'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ transferComfort: 'short' }));
});
