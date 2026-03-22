"use client";

import { useState, useRef, useCallback } from "react";

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
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab);
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = tabs[nextIndex];
      setActiveTab(nextTab.id);
      onChange?.(nextTab.id);
      tabRefs.current.get(nextTab.id)?.focus();
    },
    [tabs, activeTab, onChange]
  );

  return (
    <div
      className={`flex border-b border-border gap-0 ${className}`}
      role="tablist"
      aria-orientation="horizontal"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={handleKeyDown}
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
