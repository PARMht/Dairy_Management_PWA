/**
 * Returns today's date in IST (UTC+05:30) as a 'YYYY-MM-DD' string.
 * Used across controllers to ensure all dates are in Indian Standard Time
 * regardless of server timezone.
 */
function getISTDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
module.exports = { getISTDateString };
