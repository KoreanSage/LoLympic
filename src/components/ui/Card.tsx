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
          bg-background-surface border border-border rounded-2xl shadow-soft transition-all duration-200
          ${!noPadding ? "p-4" : ""}
          ${hoverable ? "hover:border-border-hover hover:shadow-soft-lg hover:-translate-y-0.5" : "hover:border-border-hover"}
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
