const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}

function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

export function BudgetClarificationBox({ budgetEstimateUSD, currency = 'USD' }) {
  if (!budgetEstimateUSD) return null;

  const flightsLow = toUserCurrency(budgetEstimateUSD.flightsLow, currency);
  const flightsHigh = toUserCurrency(budgetEstimateUSD.flightsHigh, currency);
  const accommodationLow = toUserCurrency(budgetEstimateUSD.accommodationLow, currency);
  const accommodationHigh = toUserCurrency(budgetEstimateUSD.accommodationHigh, currency);
  const activityLow = toUserCurrency(budgetEstimateUSD.activityLow, currency);
  const activityHigh = toUserCurrency(budgetEstimateUSD.activityHigh, currency);

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,217,61,0.07), rgba(251,191,36,0.03))', border: '1px solid rgba(255,217,61,0.2)', borderRadius: 16, padding: 18, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ fontSize: 12, fontWeight: 800, color: '#ffd93d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        💡 Budget Breakdown
      </div>

      {/* Message */}
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 14 }}>
        Budget shown includes estimated flights + accommodation + activities for your entire trip. Actual costs may vary.
      </div>

      {/* Breakdown */}
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, fontWeight: 600 }}>
        ✈️ {fmt(flightsLow, currency)}–{fmt(flightsHigh, currency)} · 🏡 {fmt(accommodationLow, currency)}–{fmt(accommodationHigh, currency)}/night · 🎯 {fmt(activityLow, currency)}–{fmt(activityHigh, currency)}/day
      </div>
    </div>
  );
}
