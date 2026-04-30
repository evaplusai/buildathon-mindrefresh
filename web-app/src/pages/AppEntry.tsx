import { Link } from 'react-router-dom';

export default function AppEntry() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-surface-900 text-slate-100">
      <section className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight">
          MindRefreshStudio
        </h1>

        <p className="text-lg md:text-xl text-slate-300">
          A wellness companion that lives in your space.
        </p>

        <p className="text-sm md:text-base text-slate-400 leading-relaxed border-l-2 border-accent-cyan pl-4 text-left">
          Raw biometric signals never leave your device. Only state events
          sync, to enable the morning check across devices.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/dashboard"
            className="px-5 py-2.5 rounded-full border border-accent-cyan/50 text-accent-cyan hover:bg-accent-cyan/10 text-sm tracking-wide transition-colors"
          >
            Open dashboard
          </Link>
          <Link
            to="/dashboard?source=recorded"
            className="px-5 py-2.5 rounded-full border border-slate-700 text-slate-300 hover:border-slate-500 text-sm tracking-wide transition-colors"
          >
            Try recorded session
          </Link>
        </div>
      </section>
    </main>
  );
}
