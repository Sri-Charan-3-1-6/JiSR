'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { fmtDateTime, useResidentId } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface Contact {
  id: string;
  contact_label: string;
  contact_phone: string;
}
interface ContactEvent {
  id: number;
  kind: 'simulated_sent' | 'contact_made';
  message: string | null;
  created_at: string;
}
interface SentResult {
  message: string;
  waLink: string;
}

export default function TrustedContactPage() {
  const t = useTranslations('contact');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const toast = useToast();
  const residentId = useResidentId();
  const [consent, setConsent] = useState(true);
  const [contact, setContact] = useState<Contact | null>(null);
  const [eligible, setEligible] = useState(false);
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<SentResult | null>(null);
  const [fetching, setLoading] = useState(true);
  const loading = residentId === undefined || (residentId !== null && fetching);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((id: string) =>
    fetch(`/api/residents/${id}/trusted-contact`)
      .then((r) => r.json())
      .then((d) => {
        setConsent(Boolean(d.consent));
        setContact(d.contact ?? null);
        setEligible(Boolean(d.eligibleTask));
        setEvents(d.events ?? []);
        if (d.contact) {
          setLabel(d.contact.contact_label);
          setPhone(d.contact.contact_phone);
        }
      }), []);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    if (!id) return;
    load(id)
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function save() {
    if (!residentId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/residents/${residentId}/trusted-contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactLabel: label, contactPhone: phone }),
      });
      if (!r.ok) throw new Error();
      await load(residentId);
      toast(t('saved'));
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!residentId) return;
    setBusy(true);
    try {
      await fetch(`/api/residents/${residentId}/trusted-contact`, { method: 'DELETE' });
      setContact(null);
      setSent(null);
      setLabel('');
      setPhone('');
      await load(residentId);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!contact) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/trusted-contact/${contact.id}/send`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setSent({ message: d.message, waLink: d.waLink });
      await load(residentId!);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function reply() {
    if (!contact) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/trusted-contact/${contact.id}/reply`, { method: 'POST' });
      if (!r.ok) throw new Error();
      await load(residentId!);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const lastSent = events.find((e) => e.kind === 'simulated_sent');
  const madeAfterSent = lastSent && events.some(
    (e) => e.kind === 'contact_made' && e.created_at >= lastSent.created_at,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <section className="surface-hero grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:gap-10 lg:p-10">
        <div>
          <h1 className="page-heading">{t('title')}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">{t('intro')}</p>
        </div>
        <div className="rounded-card border border-primary/25 bg-card p-5 sm:p-6">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" className="mb-4 text-accent"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 14v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <p className="text-base font-medium leading-relaxed text-primary-strong">{t('neverNote')}</p>
        </div>
      </section>

      {!residentId && !loading ? (
        <section className="card p-6 text-sm text-muted">
          {t('noResident')}{' '}
          <Link href="/resident" className="font-semibold text-primary underline">{t('goScreening')}</Link>
        </section>
      ) : loading ? (
        <>
          <span className="sr-only">{t('loading')}</span>
          <SkeletonCard lines={4} />
        </>
      ) : !consent ? (
        <section className="card space-y-3 p-6 text-sm">
          <p className="text-muted">{t('consentRequired')}</p>
          <Link href="/resident/consent" className="btn btn-primary">{t('consentLink')}</Link>
        </section>
      ) : (
        <>
          {error && (
            <p role="alert" className="card border-danger/50 p-4 text-sm text-danger">{error}</p>
          )}

          <div className="resident-grid items-start gap-6">
          <section className="data-panel min-w-0 p-6 sm:p-7">
            <h2 className="section-heading">{contact ? t('current') : t('save')}</h2>
            <div className="mt-4 grid gap-4">
              <label className="block text-sm">
                <span className="font-medium">{t('label')}</span>
                <input
                  type="text"
                  value={label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                  className="input mt-2 w-full text-base"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('phone')}</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  maxLength={15}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="input mt-2 w-full text-base"
                />
                <span className="mt-1 block text-xs text-muted">{t('phoneHint')}</span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={save} disabled={busy || !label.trim() || phone.length < 7}>
                {busy ? tc('saving') : t('save')}
              </Button>
              {contact && (
                <Button onClick={remove} variant="ghost" disabled={busy}>{t('remove')}</Button>
              )}
            </div>
          </section>

          <div className="min-w-0 space-y-6">
          {contact && (
            <section className="data-panel p-6 sm:p-7">
              {eligible ? (
                <>
                  <h2 className="section-heading">{t('eligibleTitle')}</h2>
                  <p className="mt-2 text-sm text-muted">{t('eligibleBody')}</p>
                  {!sent && !madeAfterSent && (
                    <Button onClick={send} disabled={busy} className="mt-4">
                      {t('send')}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">{t('notEligible')}</p>
              )}

              {(sent || lastSent) && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-6 rounded-card border border-primary/20 bg-surface-2/60 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">{t('simulatedBadge')}</Badge>
                    <span className="text-xs font-semibold text-muted">{t('messagePreview')}</span>
                  </div>
                  <blockquote className="mt-4 border-s-2 border-accent ps-4 text-base leading-relaxed">{sent?.message ?? lastSent?.message}</blockquote>
                  {sent?.waLink && (
                    <a
                      href={sent.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {t('waLink')}
                    </a>
                  )}
                  {!madeAfterSent && (
                    <div className="mt-3">
                      <Button onClick={reply} variant="outline" disabled={busy} className="px-3 py-2 text-sm">
                        {t('reply')}
                      </Button>
                      <p className="mt-1 text-xs text-muted">{t('replyNote')}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </section>
          )}

          <section className="data-panel p-6 sm:p-7">
            <h2 className="section-heading">{t('eventsTitle')}</h2>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('eventsEmpty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="timeline-item flex flex-wrap items-center gap-2 p-4 text-sm">
                    <Badge tone={e.kind === 'contact_made' ? 'success' : 'warning'}>
                      {e.kind === 'contact_made' ? t('made') : t('sent')}
                    </Badge>
                    <span className="text-xs text-muted">{fmtDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
          </div>
        </>
      )}

      <section className="border-t border-border pt-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}