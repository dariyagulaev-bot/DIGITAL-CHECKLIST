// Intentionally empty. VERO runs as a self-contained offline web app inside the
// bundled Chromium; it needs no privileged bridge to Node/OS. Keeping this file
// empty (with contextIsolation + sandbox on, nodeIntegration off) means the page
// has NO access to Node, the filesystem, or the network beyond the browser's own
// sandbox — which is what makes the package safe and transparent to review.
