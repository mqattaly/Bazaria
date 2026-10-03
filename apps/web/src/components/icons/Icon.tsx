import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'dashboard'
  | 'sales'
  | 'box'
  | 'users'
  | 'warehouse'
  | 'chart'
  | 'settings'
  | 'menu'
  | 'close'
  | 'search'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'plus'
  | 'trend-up'
  | 'trend-down'
  | 'refresh'
  | 'check'
  | 'alert'
  | 'info'
  | 'wallet'
  | 'receipt'
  | 'home'
  | 'sparkles'
  | 'arrow-up-right';

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  sales: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 1 4 16.5z" /><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8m-8 3h5" /></>,
  box: <><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9z" /><path d="m3.8 7.7 8.2 4.5 8.2-4.5M12 12.2V21M7.7 5.3l8.5 4.6" /></>,
  users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M17 4.5a3.5 3.5 0 0 1 0 6.8M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></>,
  warehouse: <><path d="m3 9 9-5 9 5v11H3z" /><path d="M7 20v-7h10v7M9.5 13v7m5-7v7M3 9h18" /></>,
  chart: <><path d="M4 19.5h16M6.5 16V10m5.5 6V5m5.5 11v-4" /><path d="m5 7 6-3 5 4 4-2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" transform="translate(1 1) scale(.92)" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /></>,
  'chevron-down': <><path d="m6 9 6 6 6-6" /></>,
  'chevron-left': <><path d="m15 18-6-6 6-6" /></>,
  'chevron-right': <><path d="m9 18 6-6-6-6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  'trend-up': <><path d="m4 16 6-6 4 4 6-7" /><path d="M14 7h6v6" /></>,
  'trend-down': <><path d="m4 8 6 6 4-4 6 7" /><path d="M14 17h6v-6" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
  check: <><path d="m5 12 4.5 4.5L19 7" /></>,
  alert: <><path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2" /><path d="M6 5V3h12v2" /></>,
  receipt: <><path d="M6 3.5 8 5l2-1.5L12 5l2-1.5L16 5l2-1.5v17l-2-1.5-2 1.5-2-1.5-2 1.5L8 19l-2 1.5z" /><path d="M9 9h6m-6 4h6m-6 4h3" /></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></>,
  sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z" /></>,
  'arrow-up-right': <><path d="M7 17 17 7M8 7h9v9" /></>,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={props['aria-label'] ? undefined : true}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
