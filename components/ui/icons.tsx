import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 10.8 12 3l9 7.8v9.45a.75.75 0 0 1-.75.75H15v-6H9v6H3.75a.75.75 0 0 1-.75-.75V10.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 3v4M16.5 3v4M3 9.5h18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </IconBase>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
    </IconBase>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.6 5.5h14.8L21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l1.6-8.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M3.4 14H8l1.6 2h4.8l1.6-2h4.6" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    </IconBase>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.45 1.45M17.25 17.25l1.45 1.45M18.7 5.3l-1.45 1.45M6.75 17.25 5.3 18.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </IconBase>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.6 8.6 0 1 0 20.3 15.2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m7 9.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.8c.55 3.25 2.05 4.75 5.2 5.2-3.15.55-4.65 2.05-5.2 5.2-.55-3.15-2.05-4.65-5.2-5.2 3.15-.45 4.65-1.95 5.2-5.2ZM18.4 13.8c.3 1.8 1.15 2.65 2.8 2.95-1.65.3-2.5 1.15-2.8 2.9-.3-1.75-1.15-2.6-2.8-2.9 1.65-.3 2.5-1.15 2.8-2.95ZM5.2 14.4c.25 1.4.9 2.05 2.2 2.3-1.3.25-1.95.9-2.2 2.25-.25-1.35-.9-2-2.2-2.25 1.3-.25 1.95-.9 2.2-2.3Z" fill="currentColor" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m8 4 8 8M7 8l5-5 5 5-2.5 2.5 3 3-4 4-3-3L8 17l-1-1 2.5-2.5-3-3L7 8ZM6.2 17.8 3 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55" />
    </IconBase>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </IconBase>
  );
}
