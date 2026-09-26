import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".6" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  'chev-r': <path d="M9 6l6 6-6 6" />,
  'chev-l': <path d="M15 6l-6 6 6 6" />,
  in: <path d="M12 19V5M6 11l6-6 6 6" />,
  out: <path d="M12 5v14M6 13l6 6 6-6" />,
  vault: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6.5 19v1.5M17.5 19v1.5" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  del: <><path d="M9 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5-6z" /><path d="M11.5 10l4 4M15.5 10l-4 4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 11v5M13.5 11v5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
  chart: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  tag: <><path d="M4 4h7l9 9-7 7-9-9z" /><circle cx="8.5" cy="8.5" r="1" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M16 13.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  // categories
  cart: <><path d="M3.5 4.5h2l2 11h10l2-7.5H7" /><circle cx="9.5" cy="19" r="1" /><circle cx="16.5" cy="19" r="1" /></>,
  cup: <><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M9 3.5v2.5M12.5 3.5v2.5" /></>,
  car: <><path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5" /><path d="M4 16.5h16M5 12h14M6.5 16.5V19M17.5 16.5V19M8 14.3h.01M16 14.3h.01" /></>,
  bag: <><path d="M5.5 8h13l-1 12h-11z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  ticket: <><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" /><path d="M14 7v10" strokeDasharray="2 2" /></>,
  health: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" /></>,
  house: <><path d="M4 11 12 4.5l8 6.5" /><path d="M6 9.5V20h12V9.5M10 20v-5h4v5" /></>,
  paw: <><ellipse cx="12" cy="15.5" rx="4.2" ry="3.6" /><circle cx="6.5" cy="10.5" r="1.6" /><circle cx="9.8" cy="7" r="1.6" /><circle cx="14.2" cy="7" r="1.6" /><circle cx="17.5" cy="10.5" r="1.6" /></>,
  care: <><circle cx="7" cy="17" r="2.5" /><circle cx="17" cy="17" r="2.5" /><path d="M8.8 15.2 17 4M15.2 15.2 7 4" /></>,
  dots: <><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" /></>,
  users: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M16 14a4.5 4.5 0 0 1 4.5 4.5" /></>,
  refund: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" /></>,
  building: <><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M10.5 20.5v-4h3v4" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  drop: <path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  flame: <path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5-1.5 2-2 3.5-2.5 5-1-1-1.5-2-1.5-3.5C8 10 6 12.5 6 15a6 6 0 0 0 6 6z" />,
  wifi: <path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.5 7.5 0 0 1 11 0M9.5 16a3 3 0 0 1 5 0M12 19h.01" />,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></>,
  shield: <path d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z" />,
  repeat: <><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></>,
  bank: <path d="M4 9.5 12 5l8 4.5M5 20h14M6.5 11v6.5M10.5 11v6.5M13.5 11v6.5M17.5 11v6.5M4 9.5h16" />
};

export function Icon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      className={'i' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {P[name] ?? P.dots}
    </svg>
  );
}
