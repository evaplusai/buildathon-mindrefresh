import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface-900 text-slate-100 px-6">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-medium">404</h1>
        <p className="text-slate-400">This route is not part of MindRefreshStudio.</p>
        <Link to="/" className="text-accent-cyan underline">Back to landing</Link>
      </div>
    </main>
  );
}
