"use client";

import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  noPadding?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, noPadding = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-background-surface border border-border rounded-2xl shadow-soft
          ${!noPadding ? "p-4" : ""}
          ${hoverable ? "hover:border-border-hover hover:shadow-soft-lg transition-all duration-300 ease-out" : ""}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export default Card;
