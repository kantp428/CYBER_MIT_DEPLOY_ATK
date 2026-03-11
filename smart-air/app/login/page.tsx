"use client";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";


export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "");
    const password = String(formData.get("password") || "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("Username หรือ Password ไม่ถูกต้อง");
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      const token = String(data?.token || "");

      router.push("/");
    } catch {
      setError("Login ไม่สำเร็จ กรุณาลองใหม่");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">AI SMART AIR</p>
            <h1 className="text-2xl font-semibold">Login</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="username">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="yourname"
                pattern="^[A-Za-z]+$"
                title="Username must use English letters only (no spaces, quotes, or numbers)."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                pattern="^[A-Za-z0-9]+$"
                title="Password must be 1-20 characters and use letters and numbers only."
                maxLength={20}
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Checking..." : "Login"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <span>Back to </span>
            <Link className="text-primary hover:underline" href="/">
              home
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
