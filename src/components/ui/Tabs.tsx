"use client";

import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export default function Tabs({
  tabs,
  defaultTab,
  onChange,
  className = "",
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div
      className={`flex border-b border-border gap-0 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabClick(tab.id)}
            className={`
              relative px-4 py-2.5 text-sm font-medium transition-colors duration-150
              ${
                isActive
                  ? "text-foreground"
                  : "text-foreground-subtle hover:text-foreground-muted"
              }
            `}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`text-xs ${
                    isActive ? "text-[#c9a84c]" : "text-foreground-subtle"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c9a84c]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
