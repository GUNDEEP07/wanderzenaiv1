import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContinuePlan, { draftTitle } from './ContinuePlan';
import { fetchPlanDraft, deletePlanDraft } from '../../api/itinerary';

jest.mock('../../api/itinerary', () => ({ fetchPlanDraft: jest.fn(), deletePlanDraft: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const draft = { form: { destinations: [{ name: 'Peru' }], days: 10 }, step: 2, updatedAt: new Date().toISOString() };
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); });

test('draftTitle', () => {
  expect(draftTitle(draft.form)).toBe('Peru · 10 days');
  expect(draftTitle({ destinations: [], days: 1 })).toBe('Your trip · 1 day');
});

test('shows the saved plan and resumes it at its step', async () => {
  fetchPlanDraft.mockResolvedValue(draft);
  render(<ContinuePlan />);
  expect(await screen.findByText('Peru · 10 days')).toBeInTheDocument();
  expect(screen.getByText(/Step 3 of 6: Your route · saved today/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Continue →'));
  expect(JSON.parse(sessionStorage.getItem('wz_plan_form_v2')).destinations[0].name).toBe('Peru');
  expect(sessionStorage.getItem('wz_plan_step_v2')).toBe('2');
  expect(mockNavigate).toHaveBeenCalledWith('/plan');
});

test('discard removes it', async () => {
  fetchPlanDraft.mockResolvedValue(draft);
  render(<ContinuePlan />);
  fireEvent.click(await screen.findByText('Discard'));
  expect(deletePlanDraft).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByTestId('continue-plan')).toBeNull());
});

test('nothing saved (or a plan without a destination) → no card', async () => {
  fetchPlanDraft.mockResolvedValue({ form: { destinations: [] }, step: 0 });
  const { container } = render(<ContinuePlan />);
  await waitFor(() => expect(fetchPlanDraft).toHaveBeenCalled());
  expect(container.innerHTML).toBe('');
});
