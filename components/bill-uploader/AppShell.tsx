import type { ReactNode } from "react";

import { COLORS } from "@/lib/bill-uploader/constants";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="flex min-h-screen w-full justify-center"
      style={{ background: COLORS.pageBg }}
    >
      <div
        className="relative flex min-h-screen w-full max-w-[480px] flex-col"
        style={{ background: COLORS.shellBg }}
      >
        {children}
      </div>
    </div>
  );
}
