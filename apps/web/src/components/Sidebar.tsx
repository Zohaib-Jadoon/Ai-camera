import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-8">Madad Vision AI</h1>
      <nav className="flex-1">
        <ul className="space-y-4">
          <li>
            <Link href="/" className="hover:text-blue-400">Dashboard</Link>
          </li>
          <li>
            <Link href="/live" className="hover:text-blue-400">Live Monitoring</Link>
          </li>
          <li>
            <Link href="/cameras" className="hover:text-blue-400">Camera Management</Link>
          </li>
          <li>
            <Link href="/events" className="hover:text-blue-400">Event History</Link>
          </li>
          <li>
            <Link href="/faces" className="hover:text-blue-400">Face Management</Link>
          </li>
        </ul>
      </nav>
      <div className="mt-auto">
        <p className="text-sm text-gray-500">v0.1.0-alpha</p>
      </div>
    </div>
  );
}
