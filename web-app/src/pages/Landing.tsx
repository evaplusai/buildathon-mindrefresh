export default function Landing() {
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
      </section>
    </main>
  );
}
