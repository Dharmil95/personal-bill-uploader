"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { COLORS } from "@/lib/bill-uploader/constants";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Login failed");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{ background: COLORS.pageBg }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-[18px] border border-black/[0.07] bg-white p-6 shadow-sm"
      >
        <h1 className="text-[22px] font-medium" style={{ color: COLORS.text }}>
          Bill Uploader
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: COLORS.textMuted }}>
          Enter your app password to continue.
        </p>

        <label className="mt-5 block text-[12px] font-medium" style={{ color: COLORS.textMuted }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none focus:border-[#00695c]"
            style={{ borderColor: COLORS.border, color: COLORS.text }}
            required
          />
        </label>

        {error ? (
          <p className="mt-3 text-[13px]" style={{ color: COLORS.pdf }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-5 w-full rounded-[12px] px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
          style={{ background: COLORS.primary }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
