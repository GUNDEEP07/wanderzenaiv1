'use strict';

/**
 * Operational counters as CloudWatch metrics, written as one log line in Embedded Metric
 * Format (EMF): CloudWatch turns the line into a metric with no API call, no SDK and no extra
 * IAM. Alarms on these (infra/template.yaml, "Ops alerts") email the operator.
 *
 * Namespace WanderZenAI, dimension Stage. Names in use:
 *   TripFailed       a trip could not be generated (refunded + customer emailed)
 *   DayAdjustFailed  an "adjust a day" rewrite failed
 *   PdfFailed        a PDF could not be built         EmailFailed  the trip email didn't send
 *   AsyncCrash       a generation-chain Lambda crashed (timeout, out of memory, start-up error)
 *   StuckTrip        a trip sat unfinished for 20+ minutes (watchdog)
 *
 * Never throws: metrics are best-effort and must not break the work they describe.
 * @param {string} name
 * @param {Record<string, string|number|boolean|null>} [context] logged with the metric (not dimensions)
 */
function countMetric(name, context = {}) {
  try {
    const stage = process.env.STAGE || 'dev';
    console.log(JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{ Namespace: 'WanderZenAI', Dimensions: [['Stage']], Metrics: [{ Name: name, Unit: 'Count' }] }],
      },
      Stage: stage,
      [name]: 1,
      level: 'METRIC',
      msg: name,
      ...context,
    }));
  } catch { /* never fail the caller */ }
}

module.exports = { countMetric };
