/**
 * C.E.R.I.S System - Central Configuration
 *
 * This is the ONLY place you paste your Google Apps Script deployment URL.
 * Every time you redeploy the script and get a new /exec URL, update it
 * ONLY here — index.html, script.js, and every module HTML file all read
 * it from window.API automatically.
 */
window.API = "https://script.google.com/macros/s/AKfycbxlJWPE8ZPqK8bz_BZ2qxy1-h-R6pJwuCSHfd70CEUQmoJG1YV3PP5H33pl-QiCui1K/exec";

/**
 * Shared secret sent with every request so the Apps Script backend can
 * reject calls that didn't come from this app. This value MUST exactly
 * match APP_SECRET in your Apps Script (Code.gs) file.
 *
 * Generate a long random string (32+ characters) — do NOT keep the
 * placeholder below. A quick way: run this in any browser console:
 *   crypto.randomUUID() + crypto.randomUUID()
 *
 * Note: like the API URL above, this is still visible to anyone who
 * views your page source — it stops casual/automated probing of the
 * endpoint, but it is not a secret from a determined attacker. Treat it
 * as a lock on the door, not a vault.
 */
window.API_TOKEN = "fab3805f-73fa-43f4-a844-8c42ddc322a99050e3aa-e547-4e51-962f-dbd936dcb47d";