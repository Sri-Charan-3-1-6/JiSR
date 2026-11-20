'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { fmtDateTime } from '@/components/ui';
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
  const [residentId, setResidentId] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const [contact, setContact] = useState<Contact | null>(null);
  const [eligible, setEligible] = useState(false);
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<SentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/residents/${id}/trusted-contact`);
    const d = await r.json();
    setConsent(Boolean(d.consent));
    setContact(d.contact ?? null);
    setEligible(Boolean(d.eligibleTask));
    setEvents(d.events ?? []);
    if (d.contact) {
      setLabel(d.contact.contact_label);
      setPhone(d.contact.contact_phone);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    setResidentId(id);
    if (!id) {
      setLoading(false);
      return;
    }
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
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('intro')}</p>
        <p className="mt-3 rounded-btn border border-primary/25 bg-primary/10 p-3 text-xs font-semibold text-primary-strong">
          {t('neverNote')}
        </p>
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

          <section className="card p-6">
            <h2 className="font-bold">{contact ? t('current') : t('save')}</h2>
            <div className="mt-4 grid gap-4">
              <label className="block text-sm">
                <span className="font-medium">{t('label')}</span>
                <input
                  type="text"
                  value={label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                  className="input mt-1 w-full"
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
                  className="input mt-1 w-full"
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

          {contact && (
            <section className="card p-6">
              {eligible ? (
                <>
                  <h2 className="font-bold">{t('eligibleTitle')}</h2>
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
                  className="mt-4 rounded-btn border border-border bg-surface-2/50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">{t('simulatedBadge')}</Badge>
                    <span className="text-xs font-semibold text-muted">{t('messagePreview')}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{sent?.message ?? lastSent?.message}</p>
                  {sent?.waLink && (
                    <a
                      href={sent.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
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

          <section className="card p-6">
            <h2 className="font-bold">{t('eventsTitle')}</h2>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('eventsEmpty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={e.kind === 'contact_made' ? 'success' : 'warning'}>
                      {e.kind === 'contact_made' ? t('made') : t('sent')}
                    </Badge>
                    <span className="text-xs text-muted">{fmtDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="card p-6">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}