import { useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, Check, ChevronRight, Landmark, Percent, Wallet } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { Button, Notice, SectionTitle, Segmented, Sheet, cn } from '../../components/ui';
import { formatKobo, formatNaira } from '../../lib/format';

export function Loans() {
  const { identity } = useApp();
  const { pushToast } = useToast();
  const [amount, setAmount] = useState(250_000);
  const [term, setTerm] = useState<'3' | '6' | '12'>('6');
  const [accepted, setAccepted] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const months = Number(term);
  const monthlyRate = 0.035;
  const interest = amount * monthlyRate * (months / 6);
  const total = amount + interest;
  const monthly = total / months;
  const eligible = 500_000;

  const schedule = useMemo(
    () =>
      Array.from({ length: months }, (_, i) => ({
        n: i + 1,
        date: new Date(Date.now() + (i + 1) * 30 * 86_400_000).toLocaleDateString('en-NG', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        amount: Math.round(total / months),
      })),
    [months, total],
  );

  return (
    <div className="space-y-5">
      <div className="animate-rise">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] sm:text-[29px]">Loans</h1>
        <p className="mt-1 text-[12px] text-text-2">Offers and calculator · demo banking only.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
        <section className="card animate-rise">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-brand/25 bg-brand/10 text-brand">
              <Landmark className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-semibold">Loan calculator</h2>
              <p className="mt-0.5 text-[11px] text-text-2">Estimate a demo offer before you apply.</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="label">Amount</p>
                <p className="num mt-1 text-[30px] font-semibold">{formatNaira(amount)}</p>
              </div>
              <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-brand">
                Pre-approved
              </span>
            </div>
            <input
              type="range"
              min={50_000}
              max={eligible}
              step={10_000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(48,209,88)]"
            />
            <div className="mt-2 flex justify-between text-[9.5px] text-text-3">
              <span>₦50,000</span>
              <span>{formatNaira(eligible)}</span>
            </div>
          </div>

          <div className="mt-6">
            <p className="label mb-2">Repayment term</p>
            <Segmented
              options={[
                { value: '3', label: '3 months' },
                { value: '6', label: '6 months' },
                { value: '12', label: '12 months' },
              ]}
              value={term}
              onChange={setTerm}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-raised px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-3">Monthly</p>
              <p className="num mt-1 text-[18px] font-semibold text-brand">{formatNaira(Math.round(monthly))}</p>
            </div>
            <div className="rounded-2xl border border-line bg-raised px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-3">Total repayment</p>
              <p className="num mt-1 text-[18px] font-semibold">{formatNaira(Math.round(total))}</p>
            </div>
            <div className="rounded-2xl border border-line bg-raised px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-3">Interest</p>
              <p className="num mt-1 text-[18px] font-semibold text-rift">{formatNaira(Math.round(interest))}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                setAccepted(true);
                pushToast('Demo loan offer accepted — no real credit was issued.');
              }}
            >
              {accepted ? (
                <>
                  <Check className="h-4 w-4" /> Offer accepted
                </>
              ) : (
                <>
                  Accept offer <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setScheduleOpen(true)}>
              <CalendarDays className="h-4 w-4" /> Schedule
            </Button>
          </div>
          <Notice tone="info" className="mt-4">
            This calculator is a mock. Devions Bank does not issue real credit in this hackathon build.
          </Notice>
        </section>

        <div className="space-y-5">
          <section className="card animate-rise">
            <SectionTitle title="Your offer" />
            <div className="mt-4 rounded-2xl border border-brand/20 bg-[linear-gradient(135deg,rgb(22_52_36),rgb(15_32_24))] p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                <BadgeCheck className="h-4 w-4" /> Eligible
              </div>
              <p className="num mt-2 text-[28px] font-semibold">{formatNaira(eligible)}</p>
              <p className="mt-1 text-[10.5px] text-text-2">Based on 6 months of demo account activity.</p>
            </div>
            <div className="mt-4 space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between"><span className="text-text-2">Monthly rate</span><span className="num">3.5%</span></div>
              <div className="flex items-center justify-between"><span className="text-text-2">Offer expires</span><span className="num">30 Nov</span></div>
              <div className="flex items-center justify-between"><span className="text-text-2">Decision</span><span className="text-brand">Instant (simulated)</span></div>
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle title="Why this offer?" />
            <div className="mt-4 space-y-3">
              {[
                { icon: Wallet, title: 'Salary pattern', text: 'Regular inflows detected in demo data.' },
                { icon: Percent, title: 'Low utilisation', text: 'RIFT allocations settle on time.' },
                { icon: BadgeCheck, title: 'Tier 2 profile', text: 'BVN linked and device verified.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-raised text-text-2">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-text-2">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-[10px] text-text-3">
            Borrower: <span className="text-text-2">{identity?.displayName ?? 'Treasure B. Okafor'}</span> · Demo profile
          </div>
        </div>
      </div>

      <Sheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Repayment schedule"
        subtitle={`${term} monthly instalments · demo`}
        size="sm"
      >
        <div className="divide-y divide-line">
          {schedule.map((row) => (
            <div key={row.n} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-raised text-[10px] font-semibold text-text-2">
                  {row.n}
                </span>
                <div>
                  <p className="text-[11.5px] font-semibold">Instalment {row.n}</p>
                  <p className="text-[9.5px] text-text-2">{row.date}</p>
                </div>
              </div>
              <span className="num text-[11.5px] font-semibold">{formatNaira(row.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-raised px-4 py-3">
          <span className="text-[11px] text-text-2">Total</span>
          <span className="num text-[14px] font-semibold">{formatNaira(Math.round(total))}</span>
        </div>
      </Sheet>
    </div>
  );
}
