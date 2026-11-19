import Link from 'next/link';
import { EMERGENCY_CONFIG } from '@/config/emergency';
import { SyntheticBadge } from '@/components/header';

// Full-screen emergency page — fixed rules, never AI (hard rule 3).
export default function EmergencyPage() {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-red-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-red-800">You are not alone — help is available now</h1>
        </div>
        <div className="mt-2"><SyntheticBadge /></div>

        <div className="card mt-5 border-red-200 p-5">
          <ul className="space-y-3 text-sm leading-relaxed">
            {EMERGENCY_CONFIG.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        <div className="card mt-4 border-red-200 p-5">
          <h2 className="font-semibold text-red-800">Emergency contacts</h2>
          <p className="mt-1 rounded bg-amber-100 p-2 text-xs font-semibold text-amber-900">
            {EMERGENCY_CONFIG.verificationNotice}
          </p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-medium">{EMERGENCY_CONFIG.ambulance.label}</dt>
              <dd className="text-muted">{EMERGENCY_CONFIG.ambulance.number}</dd>
            </div>
            <div>
              <dt className="font-medium">{EMERGENCY_CONFIG.mentalHealthLine.label}</dt>
              <dd className="text-muted">{EMERGENCY_CONFIG.mentalHealthLine.number}</dd>
            </div>
            <div>
              <dt className="font-medium">{EMERGENCY_CONFIG.emergencyDepartment.label}</dt>
              <dd className="text-muted">{EMERGENCY_CONFIG.emergencyDepartment.number}</dd>
            </div>
          </dl>
        </div>

        <a href="#human" className="btn btn-danger mt-5 w-full text-lg">
          {EMERGENCY_CONFIG.talkToHumanLabel}
        </a>

        <div id="human" className="card mt-4 border-red-200 p-5 text-sm">
          <h2 className="font-semibold">A human has been alerted</h2>
          <p className="mt-2 text-muted">
            A CRITICAL case has been created in the navigator queue with an immediate
            response deadline. In this prototype the navigator console shows the alert;
            in a live deployment this would page the on-call human navigator.
          </p>
          <Link href="/navigator" className="btn btn-outline mt-3 w-full">
            Open navigator console (demo)
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          This is a screening, not a diagnosis. Fixed safety rules triggered this page — no AI decision was involved.
        </p>
      </div>
    </div>
  );
}