"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Loader2, MailCheck, MapPin, Plus } from "lucide-react";
import { Modal } from "./client";
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

export type GridPeriod = { id: string; label: string; schoolYear: string; startDate: string; endDate: string; state: "past" | "current" | "upcoming" };
export type GridItem = { id: string; name: string; description: string; contents: string; active: boolean };
export type GridSlot = { reservationId: string; status: "pending" | "confirmed"; mine: boolean; schoolName?: string; schoolId?: string };

type Props = {
  mode: "school" | "admin";
  periods: GridPeriod[];
  items: GridItem[];
  slots: Record<string, GridSlot>;
  school?: { name: string; address: string };
  schools?: { id: string; name: string; email: string }[];
};

type Dialog =
  | { kind: "book"; item: GridItem; period: GridPeriod }
  | { kind: "manage"; item: GridItem; period: GridPeriod; slot: GridSlot }
  | null;

export function Planning(props: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const { periods, items, slots, mode } = props;

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
      {/* Grand écran : tableau */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-card md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-64 min-w-56 border-b border-line bg-surface px-5 py-4 text-left align-bottom text-xs font-medium uppercase tracking-wide text-muted">
                Valise
              </th>
              {periods.map((p) => (
                <th key={p.id} className={cx("min-w-36 border-b border-line px-2 py-4 text-left align-bottom font-normal", p.state === "past" && "opacity-50")}>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    {p.state === "current" && <span className="size-1.5 rounded-full bg-accent" aria-label="En cours" />}
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{frRange(p.startDate, p.endDate)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <th
                  scope="row"
                  className={cx("sticky left-0 z-10 bg-surface px-5 py-3 text-left align-middle font-normal", i < items.length - 1 && "border-b border-line")}
                >
                  <div className="font-medium text-ink">
                    {item.name} {!item.active && <Badge className="ml-1">inactive</Badge>}
                  </div>
                  {item.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{item.description}</div>}
                </th>
                {periods.map((p) => (
                  <td key={p.id} className={cx("px-1.5 py-2", i < items.length - 1 && "border-b border-line")}>
                    <Cell mode={mode} period={p} slot={slots[`${item.id}:${p.id}`]} onClick={() => open(item, p)} label={`${item.name}, ${p.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : cartes par valise */}
      <div className="space-y-4 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="font-medium">{item.name}</div>
            {item.description && <div className="mt-0.5 text-[13px] text-muted">{item.description}</div>}
            <ul className="mt-3 divide-y divide-line">
              {periods.map((p) => (
                <li key={p.id} className={cx("flex items-center justify-between gap-3 py-2.5", p.state === "past" && "opacity-50")}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs text-muted">{frRange(p.startDate, p.endDate)}</div>
                  </div>
                  <div className="w-36 shrink-0">
                    <Cell mode={mode} period={p} slot={slots[`${item.id}:${p.id}`]} onClick={() => open(item, p)} label={`${item.name}, ${p.label}`} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Legend mode={mode} />

      <Modal open={dialog?.kind === "book"} onClose={() => setDialog(null)} title={dialog?.kind === "book" ? `Réserver « ${dialog.item.name} »` : ""}>
        {dialog?.kind === "book" &&
          (mode === "school" ? (
            <BookDialog item={dialog.item} period={dialog.period} school={props.school!} onDone={() => setDialog(null)} />
          ) : (
            <AdminCreateDialog item={dialog.item} period={dialog.period} schools={props.schools ?? []} onDone={() => setDialog(null)} />
          ))}
      </Modal>
      <Modal open={dialog?.kind === "manage"} onClose={() => setDialog(null)} title={dialog?.kind === "manage" ? dialog.item.name : ""} size="lg">
        {dialog?.kind === "manage" && (
          <ManageDialog mode={mode} item={dialog.item} period={dialog.period} slot={dialog.slot} items={items} onDone={() => setDialog(null)} />
        )}
      </Modal>
    </>
  );
}

function Cell({ mode, period, slot, onClick, label }: { mode: Props["mode"]; period: GridPeriod; slot?: GridSlot; onClick: () => void; label: string }) {
  const base = "flex h-11 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-medium transition";
  if (slot) {
    const clickable = mode === "admin" || slot.mine;
    const pending = slot.status === "pending";
    const content =
      mode === "admin" ? (
        <span className="truncate">{slot.schoolName}</span>
      ) : slot.mine ? (
        pending ? (
          <>
            <Clock className="size-3.5 shrink-0" /> À confirmer
          </>
        ) : (
          <>
            <Check className="size-3.5 shrink-0" /> Votre réservation
          </>
        )
      ) : (
        <span>Réservée</span>
      );
    const tone =
      mode === "admin"
        ? pending
          ? "border border-dashed border-warn/50 bg-warn-soft text-warn"
          : "bg-accent-soft text-accent border border-accent-line"
        : slot.mine
          ? pending
            ? "border border-dashed border-warn/50 bg-warn-soft text-warn"
            : "bg-accent text-accent-ink"
          : "hatch bg-surface-2 text-muted";
    return clickable ? (
      <button type="button" onClick={onClick} className={cx(base, tone, "hover:brightness-95")} aria-label={`${label} : gérer`} title={slot.schoolName}>
        {content}
      </button>
    ) : (
      <div className={cx(base, tone)} aria-label={`${label} : réservée`}>
        {content}
      </div>
    );
  }
  if (period.state === "past") return <div className={cx(base, "text-muted")}>—</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} : libre, réserver`}
      className={cx(base, "group border border-line text-muted hover:border-accent hover:bg-accent-soft hover:text-accent")}
    >
      <span className="group-hover:hidden">Libre</span>
      <span className="hidden items-center gap-1 group-hover:inline-flex">
        <Plus className="size-3.5" /> {mode === "admin" ? "Attribuer" : "Réserver"}
      </span>
    </button>
  );
}

function Legend({ mode }: { mode: Props["mode"] }) {
  const sw = "inline-block h-3 w-5 rounded";
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-line-strong")} /> Libre</span>
      {mode === "school" ? (
        <>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "bg-accent")} /> Votre réservation</span>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-dashed border-warn/50 bg-warn-soft")} /> En attente de confirmation</span>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "hatch bg-surface-2")} /> Réservée par une autre école</span>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-accent-line bg-accent-soft")} /> Confirmée</span>
          <span className="inline-flex items-center gap-2"><span className={cx(sw, "border border-dashed border-warn/50 bg-warn-soft")} /> En attente de confirmation</span>
        </>
      )}
      <span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" /> Période en cours</span>
    </div>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line rounded-xl bg-surface-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-4 px-4 py-2.5">
          <dt className="w-28 shrink-0 text-muted">{k}</dt>
          <dd className="min-w-0 font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function periodRows(p: GridPeriod): [string, React.ReactNode][] {
  return [
    ["Période", `${p.label} (${p.schoolYear})`],
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
        <p className="font-semibold">Plus qu&apos;une étape : confirmez par e-mail</p>
        <p className="mt-2 text-sm text-muted">
          Un lien de confirmation a été envoyé à <span className="font-medium text-ink">{result.message}</span>. La valise vous est réservée en attendant.
        </p>
        {result.link && (
          <Alert tone="warn" className="mt-4 text-left">
            <strong>Mode test</strong> —{" "}
            <a className="font-medium underline" href={result.link}>
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
      {item.contents && <p className="text-sm text-muted">{item.contents}</p>}
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
          {pending && <Loader2 className="size-4 animate-spin" />} Réserver cette valise
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
        <label htmlFor="school" className="text-sm font-medium">École</label>
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
          <Alert tone="warn"><strong>Mode test</strong> — <a className="font-medium underline" href={result.link}>ouvrir le lien de confirmation</a></Alert>
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
          Choisissez la nouvelle période. Votre réservation actuelle ({period.label}) reste valable tant que le décalage n&apos;est pas validé.
        </p>
        {mode === "admin" && (
          <div className="space-y-1.5">
            <label htmlFor="titem" className="text-sm font-medium">Valise</label>
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
                <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{y}</legend>
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
                          <span className="block font-medium">{p.label}</span>
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
              if (confirm("Annuler cette réservation ? La valise sera remise à disposition des autres écoles."))
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
