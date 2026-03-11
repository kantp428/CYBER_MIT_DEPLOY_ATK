"use client"
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";


export default function LoginPage() {
  const router = useRouter()
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

          <form className="mt-6 space-y-4">
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
                pattern="^[A-Za-z0-9]{1,20}$"
                title="Password must be 1-20 characters and use letters and numbers only."
                maxLength={20}
                required
              />
            </div>

            <Button className="w-full" type="submit" onClick={() => router.push("/")}>
              Login
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
