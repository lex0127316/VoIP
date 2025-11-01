// @ts-nocheck
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold">VoIP Platform</h1>
      <p className="mt-2 text-gray-600">Dashboard coming soon.</p>
      <div className="mt-6">
        <a href="/api/auth/session" className="text-blue-600 underline">Check session</a>
        <span className="mx-2">|</span>
        <a href="/api/auth/logout" className="text-blue-600 underline">Logout</a>
        <span className="mx-2">|</span>
        <a href="/login" className="text-blue-600 underline">Login</a>
      </div>
    </main>
  );
}


