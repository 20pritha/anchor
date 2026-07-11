// Inline Material-style outline icons (24×24, stroke = currentColor) so the app
// carries no icon-font/CDN dependency and icons inherit text color everywhere.

type IconProps = { className?: string };

function base(path: React.ReactNode, props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "h-6 w-6"}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const ChatIcon = (p: IconProps) =>
  base(<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />, p);

export const MemoryIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 6.7 9.6 10M16.4 10 17 6.9M9.6 14 7 17.3M14.4 14 17 17.3" />
    </>,
    p,
  );

export const ActivityIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </>,
    p,
  );

export const PeopleIcon = (p: IconProps) =>
  base(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>,
    p,
  );

export const InfoIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>,
    p,
  );

export const MenuIcon = (p: IconProps) =>
  base(<path d="M4 6h16M4 12h16M4 18h16" />, p);

export const CloseIcon = (p: IconProps) =>
  base(<path d="M18 6 6 18M6 6l12 12" />, p);

export const UploadIcon = (p: IconProps) =>
  base(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </>,
    p,
  );

export const SendIcon = (p: IconProps) =>
  base(<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />, p);

export const MicIcon = (p: IconProps) =>
  base(
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
    </>,
    p,
  );

export const CameraIcon = (p: IconProps) =>
  base(
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>,
    p,
  );
