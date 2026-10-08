// Same paths as public/vatio-widget.js's svg() helper, as React components.
import type { ReactNode } from "react";

function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ChatIcon = () => (
  <Icon className="chat">
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
  </Icon>
);

export const CloseIcon = ({ className = "" }: { className?: string }) => (
  <Icon className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const FreshIcon = () => (
  <Icon className="fresh">
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const BackIcon = () => (
  <Icon className="back">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Icon>
);

export const DownIcon = () => (
  <Icon className="down">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Icon>
);

export const SendIcon = () => (
  <Icon className="arrow">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
);

export const StopIcon = () => (
  <Icon className="stop">
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </Icon>
);

export const CopyIcon = () => (
  <Icon className="copy">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon className="check">
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const PaperclipIcon = () => (
  <Icon className="clip">
    <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />
  </Icon>
);

export const FileIcon = () => (
  <Icon className="file">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);
