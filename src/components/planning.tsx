"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Loader2, MailCheck, MapPin, Plus } from "lucide-react";
import { Modal } from "./client";
import { Thumb } from "./thumb";
import { Alert, Badge, Button, Select, cx } from "./ui";
import { frLong, frRange } from "@/lib/dates";
import {
  bookAction,
  cancelAction,
  moveAction,
  moveOptionsAction,
  resendAction,
  type ActionResult,
} from "@/app/actions";
import { adminCancelAction, adminCreateAction, adminMoveAction } from "@/app/admin/actions";

export type GridPeriod = {
  id: string;
  label: string;
  position: number;
  schoolYear: string;
  startDate: string;
  endDate: string;
  state: "past" | "current" | "upcoming";
};
export type GridItem = { id: string; name: string; description: string; contents: string; active: boolean; color: string; photoUrl: string | null };
export type GridSlot = { reservationId: string; status: "pending" | "confirmed"; mine: boolean; schoolName?: string; schoolId?: string };

type Props = {
  mode: "school" | "admin";
  periods: GridPeriod[];
  items: GridItem[];
  slots: Record<string, GridSlot>;
  today: string;
  school?: { name: string; address: string };
  schools?: { id: string; name: string; email: string }[];
};

type Dialog =
  | { kind: "book"; item: GridItem; period: GridPeriod }
  | { kind: "manage"; item: GridItem; period: GridPeriod; slot: GridSlot }
  | null;

/* ------------------------------------------------------------------ */
/* Calcul de la frise                                                  */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const t = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const days = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

type Segment = { kind: "period"; period: GridPeriod; days: number } | { kind: "holiday"; name: string; days: number };

function holidayName(label: string) {
  const to = label.split("→")[1]?.trim();
  return to ? `Vacances ${/^[aeiouéèh]/i.test(to) ? "d'" : "de "}${to}` : "Vacances";
}

function buildTimeline(periods: GridPeriod[], today: string) {
  const segments: Segment[] = [];
  periods.forEach((p, i) => {
    segments.push({ kind: "period", period: p, days: days(p.startDate, p.endDate) + 1 });
    const next = periods[i + 1];
    if (next) {
      const gap = days(p.endDate, next.startDate) - 1;
      if (gap > 0) segments.push({ kind: "holiday", name: holidayName(p.label).replace("Vacances de ", "").replace("Vacances d'", ""), days: gap });
    }
  });
  const start = periods[0]?.startDate;
  const end = periods.at(-1)?.endDate;
  if (!start || !end) return { segments, months: [], todayPct: null as number | null };
  const total = days(start, end) + 1;
  const months: { label: string; pct: number }[] = [];
  const d = new Date(t(start));
  d.setUTCDate(1);
  while (d.getTime() <= t(end)) {
    const iso = d.toISOString().slice(0, 10);
    const pct = Math.max(0, days(start, iso)) / total;
    if (pct < 0.985) months.push({ label: monthFmt.format(d).replace(".", ""), pct });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  const todayPct = today >= start && today <= end ? (days(start, today) + 0.5) / total : null;
  return { segments, months, todayPct };
}

const LABEL_W = "17rem";

export function Planning(props: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const { periods, items, slots, mode } = props;
  const { segments, months, todayPct } = useMemo(() => buildTimeline(periods, props.today), [periods, props.today]);
  const columns = `${LABEL_W} ${segments.map((s) => `minmax(0, ${s.days}fr)`).join(" ")}`;

  const open = (item: GridItem, period: GridPeriod) => {
    const slot = slots[`${item.id}:${period.id}`];
    if (slot) {
      if (mode === "admin" || slot.mine) setDialog({ kind: "manage", item, period, slot });
      return;
    }
    if (period.state === "past") return;
    setDialog({ kind: "book", item, period });
  };

  return (
    <>
      {/* Grand écran : frise de l'année scolaire */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line-strong bg-surface shadow-card md:block">
        <div className="relative min-w-[60rem]">
          {/* Mois */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `${LABEL_W} 1fr` }}>
            <div />
            <div className="relative h-8">
              {months.map((m) => (
                <span
                  key={m.pct}
                  className="absolute top-0 flex h-full items-center border-l border-line pl-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"
                  style={{ left: `${m.pct * 100}%` }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* En-tête des périodes */}
            <div className="grid" style={{ gridTemplateColumns: columns }}>
              <div className="flex items-end border-b border-line-strong px-5 pb-3 pt-4 text-xs font-bold uppercase tracking-wider text-muted">Mallettes</div>
              {segments.map((s, i) =>
                s.kind === "holiday" ? (
                  <div key={i} className="hatch flex items-end justify-center border-b border-line-strong pb-2 opacity-70">
                    <span className="max-h-24 truncate text-[10px] font-bold uppercase tracking-wider text-muted [writing-mode:vertical-rl] rotate-180" title={`Vacances : ${s.name}`}>
                      {s.name}
                    </span>
                  </div>
                ) : (
                  <div
                    key={i}
                    title={s.period.label}
                    className={cx(
                      "relative z-[1] flex min-w-0 flex-col justify-end border-b px-2.5 pb-3 pt-3",
                      s.period.state === "current" ? "border-b-2 border-accent bg-accent-soft/60" : "border-line-strong",
                      s.period.state === "past" && "opacity-45",
                    )}
                  >
                    {s.period.state === "current" && <span className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-accent">en cours</span>}
                    <span className="truncate text-[15px] font-extrabold text-ink">Période {s.period.position}</span>
                    <div className="truncate text-xs font-semibold text-muted">{frRange(s.period.startDate, s.period.endDate)}</div>
                  </div>
                ),
              )}
            </div>

            {/* Lignes des mallettes */}
            {items.map((item, r) => (
              <div key={item.id} className="crayon grid" style={{ gridTemplateColumns: columns, ["--c" as string]: item.color }}>
                <div className={cx("relative flex min-w-0 items-center gap-3 py-2 pl-5 pr-3", r < items.length - 1 && "border-b border-line")}>
                  <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--c)]" />
                  <Thumb src={item.photoUrl} color={item.color} alt="" className="size-12" />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold text-ink">
                      {item.name} {!item.active && <Badge className="ml-1">masquée</Badge>}
                    </div>
                    {item.description && <div className="truncate text-xs font-semibold text-muted">{item.description}</div>}
                  </div>
                </div>
                {segments.map((s, i) =>
                  s.kind === "holiday" ? (
                    <div key={i} className="hatch opacity-50" />
                  ) : (
                    <div key={i} className={cx("relative z-[1] min-w-0 p-1.5", r < items.length - 1 && "border-b border-line")}>
                      <Cell mode={mode} period={s.period} slot={slots[`${item.id}:${s.period.id}`]} onClick={() => open(item, s.period)} label={`${item.name}, période ${s.period.position}`} />
                    </div>
                  ),
                )}
              </div>
            ))}

            {/* Aujourd'hui */}
            {todayPct !== null && (
              <div
                aria-hidden
                title="Aujourd'hui"
                className="pointer-events-none absolute bottom-0 top-0 z-0 w-0.5 bg-margin/70"
                style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${todayPct})` }}
              >
                <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-margin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile : une fiche par mallette */}
      <div className="space-y-4 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="crayon overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-card" style={{ ["--c" as string]: item.color }}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Thumb src={item.photoUrl} color={item.color} alt="" className="size-14" />
              <div className="min-w-0">
                <div className="font-extrabold">{item.name}</div>
                {item.description && <div className="text-[13px] font-semibold text-muted">{item.description}</div>}
              </div>
            </div>
            <ul className="divide-y divide-line px-4">
              {periods.map((p) => (
                <li key={p.id} className={cx("flex items-center justify-between gap-3 py-2.5", p.state === "past" && "opacity-45")}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-extrabold">
                      Période {p.position}
                      {p.state === "current" && <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-ink">en cours</span>}
                    </div>
                    <div className="text-xs font-semibold text-muted">{frRange(p.startDate, p.endDate)}</div>
                  </div>
                  <div className="w-40 shrink-0">
                    <Cell mode={mode} period={p} slot={slots[`${item.id}:${p.id}`]} onClick={() => open(item, p)} label={`${item.name}, période ${p.position}`} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Legend mode={mode} />

      <Modal
        open={dialog?.kind === "book"}
        onClose={() => setDialog(null)}
        color={dialog?.item.color}
        title={dialog?.kind === "book" ? (mode === "admin" ? `Attribuer « ${dialog.item.name} »` : `Réserver « ${dialog.item.name} »`) : ""}
      >
        {dialog?.kind === "book" &&
          (mode === "school" ? (
            <BookDialog item={dialog.item} period={dialog.period} school={props.school!} onDone={() => setDialog(null)} />
          ) : (
            <AdminCreateDialog item={dialog.item} period={dialog.period} schools={props.schools ?? []} onDone={() => setDialog(null)} />
          ))}
      </Modal>
      <Modal open={dialog?.kind === "manage"} onClose={() => setDialog(null)} color={dialog?.item.color} title={dialog?.kind === "manage" ? dialog.item.name : ""} size="lg">
        {dialog?.kind === "manage" && (
          <ManageDialog mode={mode} item={dialog.item} period={dialog.period} slot={dialog.slot} items={items} onDone={() => setDialog(null)} />
        )}
      </Modal>
    </>
  );
}

function Cell({ mode, period, slot, onClick, label }: { mode: Props["mode"]; period: GridPeriod; slot?: GridSlot; onClick: () => void; label: string }) {
  const base = "flex h-12 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[13px] font-bold transition-transform";
  if (slot) {
    const clickable = mode === "admin" || slot.mine;
    const pending = slot.status === "pending";
    let tone: string;
    let content: React.ReactNode;
    if (mode === "school" && !slot.mine) {
      tone = "hatch justify-center bg-surface-2 text-muted";
      content = <span className="truncate">Réservée</span>;
    } else if (pending) {
      tone = "border border-dashed border-[var(--c)] bg-[var(--c-soft)] text-[var(--c-ink)]";
      content = (
        <>
          <Clock className="size-3.5 shrink-0" />
          <span className="truncate">{mode === "admin" ? slot.schoolName : "À confirmer"}</span>
        </>
      );
    } else if (mode === "admin") {
      tone = "!justify-start border-l-4 border-[var(--c)] bg-[var(--c-soft)] text-[var(--c-ink)]";
      content = <span className="truncate">{slot.schoolName}</span>;
    } else {
      tone = "border border-[var(--c)] bg-[var(--c-mid)] text-[var(--c-ink)]";
      content = (
        <>
          <Check className="size-4 shrink-0" strokeWidth={3} />
          <span className="truncate">À vous</span>
        </>
      );
    }
    return clickable ? (
      <button type="button" onClick={onClick} className={cx(base, tone, "hover:brightness-[0.96]")} aria-label={`${label} : gérer`} title={slot.schoolName}>
        {content}
      </button>
    ) : (
      <div className={cx(base, tone)} aria-label={`${label} : réservée`}>
        {content}
      </div>
    );
  }
  if (period.state === "past") return <div className={cx(base, "justify-center text-line-strong")}>·</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} : libre, ${mode === "admin" ? "attribuer" : "réserver"}`}
      className={cx(
        base,
        "group justify-center border border-dashed border-line-strong text-muted/80 hover:border-solid hover:border-[var(--c)] hover:bg-[var(--c-soft)] hover:text-[var(--c-ink)]",
      )}
    >
      <span className="truncate group-hover:hidden">Libre</span>
      <span className="hidden items-center gap-1 truncate group-hover:inline-flex">
        <Plus className="size-4 shrink-0" strokeWidth={3} /> {mode === "admin" ? "Attribuer" : "Réserver"}
      </span>
    </button>
  );
}

function Legend({ mode }: { mode: Props["mode"] }) {
  const sw = "inline-block h-3.5 w-6 rounded-md";
  const c = { ["--c" as string]: "var(--accent)" };
  return (
    <div className="crayon mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-muted" style={c}>
      <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-dashed border-line-strong")} /> Libre</span>
      {mode === "school" ? (
        <>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-[var(--c)] bg-[var(--c-mid)]")} /> Réservée par vous</span>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-dashed border-[var(--c)] bg-[var(--c-soft)]")} /> À confirmer par e-mail</span>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "hatch bg-surface-2")} /> Réservée par une autre école</span>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border-l-4 border-[var(--c)] bg-[var(--c-soft)]")} /> Confirmée</span>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-dashed border-[var(--c)] bg-[var(--c-soft)]")} /> En attente de confirmation</span>
        </>
      )}
      <span className="inline-flex items-center gap-2"><span className="relative h-3.5 w-0.5 rounded bg-margin"><span className="absolute -left-[3px] -top-1 size-2 rounded-full bg-margin" /></span> Aujourd&apos;hui</span>
      <span className="inline-flex items-center gap-2"><span className={cx(sw, "hatch")} /> Vacances</span>
    </div>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-dashed divide-line-strong rounded-xl border-2 border-line bg-surface-2/60 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-4 px-4 py-2.5">
          <dt className="w-24 shrink-0 font-semibold text-muted">{k}</dt>
          <dd className="min-w-0 font-bold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function periodRows(p: GridPeriod): [string, React.ReactNode][] {
  return [
    ["Période", `Période ${p.position} · ${p.label}`],
    ["Dates", `du ${frLong(p.startDate)} au ${frLong(p.endDate)}`],
  ];
}

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      router.refresh();
    });
  return { pending, result, run, setResult };
}

function BookDialog({ item, period, school, onDone }: { item: GridItem; period: GridPeriod; school: { name: string; address: string }; onDone: () => void }) {
  const { pending, result, run } = useAction();
  if (result?.ok)
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-6" />
        </div>
        <p className="font-extrabold">Confirmez votre réservation par e-mail</p>
        <p className="mt-2 text-sm text-muted">
          Un lien de confirmation a été envoyé à <span className="font-semibold text-ink">{result.message}</span>. La mallette vous est réservée en attendant.
        </p>
        {result.link && (
          <Alert tone="warn" className="mt-4 text-left">
            <strong>Mode test</strong> —{" "}
            <a className="font-semibold underline" href={result.link}>
              ouvrir le lien de confirmation
            </a>
          </Alert>
        )}
        <Button className="mt-6 w-full" variant="secondary" onClick={onDone}>
          Fermer
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <Thumb src={item.photoUrl} color={item.color} alt={item.name} className="size-24" />
        <div className="min-w-0">
          {item.description && <p className="font-bold text-ink">{item.description}</p>}
          {item.contents && <p className="mt-1 text-sm text-muted">{item.contents}</p>}
        </div>
      </div>
      <Facts
        rows={[
          ...periodRows(period),
          [
            "Livraison",
            <span key="l" className="inline-flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" />
              <span>
                {school.name}
                <br />
                <span className="font-normal text-muted">{school.address}</span>
              </span>
            </span>,
          ],
        ]}
      />
      {result && !result.ok && <Alert tone="danger">{result.message}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={pending} onClick={() => run(() => bookAction(item.id, period.id))}>
          {pending && <Loader2 className="size-4 animate-spin" />} Réserver cette mallette
        </Button>
      </div>
      <p className="text-center text-xs text-muted">Vous recevrez un e-mail pour confirmer la réservation.</p>
    </div>
  );
}

function AdminCreateDialog({ item, period, schools, onDone }: { item: GridItem; period: GridPeriod; schools: { id: string; name: string; email: string }[]; onDone: () => void }) {
  const { pending, result, run } = useAction();
  const [schoolId, setSchoolId] = useState("");
  if (result?.ok)
    return (
      <div className="space-y-5">
        <Alert tone="ok">{result.message}</Alert>
        <Button className="w-full" variant="secondary" onClick={onDone}>Fermer</Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <Facts rows={periodRows(period)} />
      <div className="space-y-1.5">
        <label htmlFor="school" className="text-sm font-semibold">École</label>
        <Select id="school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">Choisir une école…</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name || s.email}</option>
          ))}
        </Select>
        {!schools.length && <p className="text-xs text-muted">Aucune école enregistrée : ajoutez-en depuis l&apos;onglet Écoles.</p>}
      </div>
      {result && !result.ok && <Alert tone="danger">{result.message}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>Annuler</Button>
        <Button disabled={pending || !schoolId} onClick={() => run(() => adminCreateAction(schoolId, item.id, period.id))}>
          {pending && <Loader2 className="size-4 animate-spin" />} Réserver (confirmée)
        </Button>
      </div>
    </div>
  );
}

type MoveOptions = Awaited<ReturnType<typeof moveOptionsAction>>;

function ManageDialog({ mode, item, period, slot, items, onDone }: { mode: Props["mode"]; item: GridItem; period: GridPeriod; slot: GridSlot; items: GridItem[]; onDone: () => void }) {
  const { pending, result, run, setResult } = useAction();
  const [view, setView] = useState<"info" | "move">("info");
  const [opts, setOpts] = useState<MoveOptions | null>(null);
  const [target, setTarget] = useState("");
  const [targetItem, setTargetItem] = useState(item.id);
  const canChange = mode === "admin" || period.state === "upcoming";

  useEffect(() => {
    if (view === "move" && !opts) moveOptionsAction(slot.reservationId).then(setOpts);
  }, [view, opts, slot.reservationId]);

  if (result?.ok)
    return (
      <div className="space-y-5">
        <Alert tone="ok">{result.message}</Alert>
        {result.link && (
          <Alert tone="warn"><strong>Mode test</strong> — <a className="font-semibold underline" href={result.link}>ouvrir le lien de confirmation</a></Alert>
        )}
        <Button className="w-full" variant="secondary" onClick={onDone}>Fermer</Button>
      </div>
    );

  if (view === "move") {
    const occupied = new Set(opts?.occupied ?? []);
    const years = [...new Set(opts?.periods.map((p) => p.schoolYear) ?? [])];
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Choisissez la nouvelle période. Votre réservation actuelle (période {period.position}) reste valable tant que le décalage n&apos;est pas validé.
        </p>
        {mode === "admin" && (
          <div className="space-y-1.5">
            <label htmlFor="titem" className="text-sm font-semibold">Mallette</label>
            <Select id="titem" value={targetItem} onChange={(e) => { setTargetItem(e.target.value); setTarget(""); }}>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </div>
        )}
        {!opts ? (
          <div className="flex justify-center py-8 text-muted"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {years.map((y) => (
              <fieldset key={y}>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Année {y}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {opts.periods.filter((p) => p.schoolYear === y).map((p) => {
                    const isCurrent = p.id === period.id && targetItem === item.id;
                    const taken = occupied.has(`${targetItem}:${p.id}`);
                    const disabled = isCurrent || taken || (mode === "school" && p.state !== "upcoming");
                    return (
                      <label
                        key={p.id}
                        className={cx(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition",
                          target === p.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong",
                          disabled && "cursor-not-allowed opacity-50 hover:border-line",
                        )}
                      >
                        <input type="radio" name="target" className="mt-1 accent-[var(--accent)]" disabled={disabled} checked={target === p.id} onChange={() => setTarget(p.id)} />
                        <span>
                          <span className="block font-bold">Période {p.position} <span className="font-semibold text-muted">· {p.label}</span></span>
                          <span className="block text-xs text-muted">
                            {frRange(p.startDate, p.endDate)} · {isCurrent ? "actuelle" : taken ? "déjà réservée" : p.state === "current" ? "en cours" : "libre"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {!opts.periods.length && <p className="text-sm text-muted">Aucune autre période disponible.</p>}
          </div>
        )}
        {result && !result.ok && <Alert tone="danger">{result.message}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => { setView("info"); setResult(null); }}>Retour</Button>
          <Button
            disabled={pending || !target}
            onClick={() =>
              run(async () => {
                const r = mode === "admin" ? await adminMoveAction(slot.reservationId, target, targetItem) : await moveAction(slot.reservationId, target);
                if (!r?.ok) setOpts(await moveOptionsAction(slot.reservationId));
                return r;
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Valider le décalage <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        {slot.status === "pending" ? <Badge tone="warn"><Clock className="size-3" /> En attente de confirmation</Badge> : <Badge tone="ok"><Check className="size-3" /> Confirmée</Badge>}
      </div>
      <Facts rows={[...(mode === "admin" ? ([["École", slot.schoolName]] as [string, React.ReactNode][]) : []), ...periodRows(period)]} />
      {!canChange && <Alert>La période a commencé : pour toute modification, contactez le gestionnaire.</Alert>}
      {result && !result.ok && <Alert tone="danger">{result.message}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {canChange && (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirm("Annuler cette réservation ? La mallette sera remise à disposition des autres écoles."))
                run(() => (mode === "admin" ? adminCancelAction(slot.reservationId) : cancelAction(slot.reservationId)));
            }}
          >
            Annuler la réservation
          </Button>
        )}
        {mode === "school" && slot.status === "pending" && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => resendAction(slot.reservationId))}>
            Renvoyer l&apos;e-mail
          </Button>
        )}
        {canChange && (mode === "admin" || slot.status === "confirmed") && (
          <Button onClick={() => setView("move")}>
            Décaler <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
