import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  leadingIcon?: ReactNode;
};

export function Button({
  className = "",
  variant = "secondary",
  leadingIcon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="ui-button__icon">{leadingIcon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`ui-icon-button ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
