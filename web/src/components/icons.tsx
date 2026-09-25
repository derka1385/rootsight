import type { ReactNode } from "react";
// One stroke icon set (24px grid, 1.8 stroke) so every screen speaks the same visual language.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const svg = (d: ReactNode) => () => <svg viewBox="0 0 24 24" aria-hidden="true" {...P}>{d}</svg>;

export const HomeIcon = svg(<><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>);
export const ScanIcon = svg(<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M12 16.5c-2.5-1-3.5-3-3.2-6 2.6.1 4.3 1.3 4.9 3.4M12 16.5c2.2-.8 3.4-2.6 3.4-5.2-1.7.2-2.9 1-3.6 2.3" /></>);
export const UserIcon = svg(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>);
export const BackIcon = svg(<path d="M15 5l-7 7 7 7" />);
export const DropIcon = svg(<path d="M12 3.5c3 3.8 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6.2 5.5-10Z" />);
export const SunIcon = svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>);
export const CloudIcon = svg(<path d="M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 9.5 4.3 4.3 0 0 0 7 18Z" />);
export const ThermoIcon = svg(<><path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" /><path d="M12 11v6" /></>);
export const SoilIcon = svg(<><path d="M5 10h14l-1.6 9.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8Z" /><path d="M12 10V6M12 7c-1.6-1.7-3.3-2-4.5-1.6.3 1.6 2 2.6 4.5 2.6ZM12 6c1.2-1.4 2.6-1.8 3.8-1.4-.3 1.4-1.6 2.2-3.8 2.2Z" /></>);
export const CameraIcon = svg(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" /><circle cx="12" cy="12.5" r="3.5" /></>);
export const ImageIcon = svg(<><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4.5 3 3 2-2L19 17" /></>);
export const PlusIcon = svg(<path d="M12 5v14M5 12h14" />);
export const CheckIcon = svg(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const SparkIcon = svg(<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2Z" />);
export const TrashIcon = svg(<><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></>);
export const DownloadIcon = svg(<><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></>);
export const BellIcon = svg(<><path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2H5Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>);
export const LockIcon = svg(<><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>);
export const LeafIcon = svg(<path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14Zm0 0 7-7" />);
