export const metadata = { title: "Sign in · CP Training" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <form method="post" action="/api/login" className="w-full max-w-sm space-y-4 card card-pad">
        <h1 className="text-xl font-semibold">CP Training</h1>
        <input type="hidden" name="next" value={next ?? "/"} />
        <label className="block space-y-1">
          <span className="text-sm text-mute">Username</span>
          <input name="username" autoComplete="username" required autoFocus className="w-full rounded-md border border-line bg-panel2 px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-mute">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="w-full rounded-md border border-line bg-panel2 px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red">Wrong username or password.</p>}
        <button type="submit" className="btn w-full !bg-orange !text-black">Sign in</button>
      </form>
    </div>
  );
}
