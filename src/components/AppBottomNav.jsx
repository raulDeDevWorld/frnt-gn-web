"use client";

import { MessageCircle, Newspaper, Settings2 } from "lucide-react";

const NAV_ITEMS = [
  { key: "posts", label: "Posts", icon: Newspaper },
  { key: "chats", label: "Chats", icon: MessageCircle },
  { key: "config", label: "Config", icon: Settings2 },
];

export function AppBottomNav({ activeSection, onSectionChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1a2a33] bg-[#0f151a]/95 backdrop-blur px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md grid grid-cols-3 gap-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              className={`h-12 rounded-2xl border border-transparent relative transition-all duration-200 active:scale-95 inline-flex flex-col items-center justify-center gap-0.5 ${
                isActive
                  ? "bg-[#16372f] text-[#6cf1cd] shadow-[inset_0_0_0_1px_rgba(108,241,205,0.15)]"
                  : "bg-transparent text-slate-300/85 hover:text-slate-100 hover:bg-[#162028]"
              }`}
            >
              <Icon className="w-[17px] h-[17px]" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isActive ? <span className="absolute -bottom-[1px] h-[2px] w-8 rounded-full bg-[#6cf1cd]" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
