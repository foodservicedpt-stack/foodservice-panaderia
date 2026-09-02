'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ArrowRight } from 'lucide-react';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data?.error ?? 'Contraseña incorrecta');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[20px] border border-border bg-white p-5 shadow-lg max-w-sm mx-auto w-full"
    >
      <label htmlFor="password" className="mb-2 block text-sm font-semibold text-foreground">
        Contraseña del equipo
      </label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-13 w-full rounded-xl border border-border bg-[#FFFCF8] py-3.5 pl-11 pr-12 text-base tracking-[0.1em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Introduce la contraseña"
          aria-label="Contraseña del equipo"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive font-medium">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !password}
        className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Entrando...' : 'Entrar'}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </form>
  );
}
