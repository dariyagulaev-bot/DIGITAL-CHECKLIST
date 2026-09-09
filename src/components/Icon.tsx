import type { SVGProps } from 'react';

/**
 * One consistent icon set for the whole product — clean 24px stroke icons
 * (1.75 weight, round caps), drawn with currentColor. No emoji anywhere.
 */
export type IconName =
  | 'plus'
  | 'clipboard-check'
  | 'clock'
  | 'shield-check'
  | 'users'
  | 'history'
  | 'settings'
  | 'layers'
  | 'check'
  | 'x'
  | 'camera'
  | 'pen'
  | 'chevron-start'
  | 'arrow-start'
  | 'back'
  | 'search'
  | 'image'
  | 'alert'
  | 'logout'
  | 'download'
  | 'printer'
  | 'trash'
  | 'edit'
  | 'file'
  | 'lock'
  | 'eye'
  | 'database'
  | 'sparkle'
  | 'grip'
  | 'up'
  | 'down'
  | 'refresh';

const paths: Record<IconName, JSX.Element> = {
  plus: <path d="M12 5v14M5 12h14" />,
  'clipboard-check': (
    <>
      <rect x="8" y="4" width="8" height="4" rx="1.4" />
      <path d="M16 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
      <path d="m9.5 13.5 1.8 1.8 3.6-3.8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.7" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 3.5 5.5 6v5.2c0 4 2.8 6.9 6.5 8.3 3.7-1.4 6.5-4.3 6.5-8.3V6L12 3.5Z" />
      <path d="m9.3 12 1.9 1.9 3.6-3.9" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M20.5 19a5 5 0 0 0-3.2-4.6" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M5 3.5V8h4.5" />
      <path d="M12 8v4.3l3 1.7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l1.9-1.4-2-3.4-2.2.9a7 7 0 0 0-2-1.2L16.2 3H8l-.4 2.5a7 7 0 0 0-2 1.2l-2.2-.9-2 3.4 1.9 1.4A7 7 0 0 0 3.2 12c0 .4 0 .8.1 1.2l-1.9 1.4 2 3.4 2.2-.9a7 7 0 0 0 2 1.2L8 21h8l.4-2.5a7 7 0 0 0 2-1.2l2.2.9 2-3.4-1.9-1.4c.1-.4.1-.8.1-1.2Z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" />
      <path d="m3.5 12 8.5 4.5L20.5 12" />
      <path d="m3.5 16 8.5 4.5L20.5 16" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  camera: (
    <>
      <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20s3-1 4.5-2.5L19 7a2 2 0 0 0-3-3L5.5 14.5C4 16 4 20 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  'chevron-start': <path d="m14 6-6 6 6 6" />,
  'arrow-start': <path d="M20 12H4m6-6-6 6 6 6" />,
  // "Back" for an RTL UI points to the right (toward the start of the line).
  back: <path d="M4 12h16m-6-6 6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m4.5 17 4-4 3.5 3.5L16 12l4 4.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4M12 17.2v.2" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4M6 12h11" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
      <path d="M5 20h14" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14" width="10" height="6" rx="1.2" />
      <path d="M17 11.5h.01" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h8" />
      <path d="M15.5 4.5a2 2 0 0 1 3 3L8 18l-4 1 1-4 10.5-10.5Z" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M13 3v5h5M8.5 13h7M8.5 16.5h7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5ZM18 14c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.7-.3-1.8-1-2.4-2.7-2.7 1.7-.3 2.4-1 2.7-2.8Z" />
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1.1" />
      <circle cx="9" cy="12" r="1.1" />
      <circle cx="9" cy="18" r="1.1" />
      <circle cx="15" cy="6" r="1.1" />
      <circle cx="15" cy="12" r="1.1" />
      <circle cx="15" cy="18" r="1.1" />
    </>
  ),
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14 4.5L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
};

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, className, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
