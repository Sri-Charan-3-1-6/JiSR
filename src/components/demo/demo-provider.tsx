'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_STEPS, createDemoStore, handleDemoRequest, type DemoStore } from '@/lib/demo/story';

interface DemoContextValue {
  active: boolean;
  step: number;
  start: () => void;
  goto: (k: number) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider');
  return ctx;
}

// While the demo is active, every /api/ request is answered from the seeded
// story store — nothing reaches the live backend.
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const storeRef = useRef<DemoStore>(createDemoStore());
  const origFetchRef = useRef<typeof window.fetch | null>(null);
  const savedResidentRef = useRef<string | null>(null);

  const restore = useCallback(() => {
    if (!origFetchRef.current) return;
    window.fetch = origFetchRef.current;
    origFetchRef.current = null;
    if (savedResidentRef.current === null) localStorage.removeItem('jisr_resident_id');
    else localStorage.setItem('jisr_resident_id', savedResidentRef.current);
  }, []);

  useEffect(() => restore, [restore]);

  // Reserve scroll space so the fixed guide never covers page actions.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-demo', active);
    return () => document.documentElement.removeAttribute('data-demo');
  }, [active]);

  const scrollTo = useCallback((id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      } else if (tries++ < 30) {
        setTimeout(tick, 100);
      }
    };
    tick();
  }, []);

  const goto = useCallback(
    (k: number) => {
      const clamped = Math.max(0, Math.min(DEMO_STEPS.length - 1, k));
      const s = DEMO_STEPS[clamped];
      if (s.day) storeRef.current.day = Math.max(storeRef.current.day, s.day);
      setStep(clamped);
      router.push(s.route);
      if (s.scrollTo) scrollTo(s.scrollTo);
      else window.scrollTo({ top: 0 });
    },
    [router, scrollTo],
  );

  const start = useCallback(() => {
    restore();
    storeRef.current = createDemoStore();
    savedResidentRef.current = localStorage.getItem('jisr_resident_id');
    const orig = window.fetch.bind(window);
    origFetchRef.current = orig;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const path = url.startsWith('http') ? new URL(url).pathname : url;
      if (path.startsWith('/api/')) {
        let body = init?.body;
        if (typeof body !== 'string' && input instanceof Request) {
          body = await input.clone().text();
        }
        const res = handleDemoRequest(
          path,
          { method: init?.method ?? (input instanceof Request ? input.method : 'GET'), body: typeof body === 'string' ? body : null },
          storeRef.current,
        );
        return new Response(JSON.stringify(res.body), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return orig(input, init);
    };
    setActive(true);
    goto(0);
  }, [goto, restore]);

  const reset = useCallback(() => {
    restore();
    setActive(false);
    setStep(0);
    router.push('/');
  }, [restore, router]);

  const next = useCallback(() => {
    if (step >= DEMO_STEPS.length - 1) reset();
    else goto(step + 1);
  }, [step, goto, reset]);

  const back = useCallback(() => goto(step - 1), [step, goto]);

  return (
    <DemoContext.Provider value={{ active, step, start, goto, next, back, reset }}>
      {children}
    </DemoContext.Provider>
  );
}