const record = type => (
  url,
  method = 'GET',
  time = new Date().toISOString(),
  clearHistory = true
) => ({
  type: `RECORD_${type}`,
  url,
  method,
  time,
  clearHistory
});

const recordRequest = record('REQUEST');

const recordSuccess = record('REQUEST');

const recordFailure = record('REQUEST');

export default {
  recordRequest,
  recordSuccess,
  recordFailure
};
