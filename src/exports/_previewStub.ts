// Preview-only stub. In the hosted preview (SINGLEFILE build) the heavy export
// libraries (jspdf / html2canvas / exceljs) are replaced by this module, because
// (a) they embed binary strings the artifact host rejects, and (b) file downloads
// are blocked inside the preview sandbox anyway. Calling any export surfaces a
// friendly message; run the app locally to produce real PDF/Excel files.
const message =
  'הפקת קבצים (PDF/Excel) אינה זמינה בתצוגה המקדימה המתארחת. הרץ את המערכת מקומית כדי לייצא.';

function fail(): never {
  throw new Error(message);
}

const handler: ProxyHandler<() => void> = {
  get: () => fail,
  apply: () => fail(),
  construct: () => fail(),
};

export default new Proxy(function () {}, handler);
