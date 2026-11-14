/** Sends the browser to a URL (a file download, say). Its own module so tests can stub it. */
export function openUrl(url) {
  window.location.assign(url);
}
