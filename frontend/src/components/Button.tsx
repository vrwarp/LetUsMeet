import React from "react";
import { buttonClasses, type ButtonVariant, type ButtonSize } from "./buttonStyles";

export type { ButtonVariant, ButtonSize } from "./buttonStyles";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", type, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={buttonClasses(variant, size, className)}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
