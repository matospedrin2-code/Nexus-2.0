import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus, ChevronLeft, HeartPulse, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAppointment,
  createMetric,
  deleteAppointment,
  deleteMetric,
  fetchAppointments,
  fetchMetrics,
} from "@/lib/nexus";

/**
 * Dados REAIS do Senhor. O NEXUS só menciona o que está cadastrado aqui —
 * nada é inventado; sem registros, ele declara a ausência com honestidade.
 */
export default function Data() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");

  const appointmentsQuery = useQuery({
    queryKey: ["appointments"],
    queryFn: fetchAppointments,
    retry: false,
  });
  const metricsQuery = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["metrics"] });
    queryClient.invalidateQueries({ queryKey: ["latest-briefing"] });
  };

  const addAppointment = useMutation({
    mutationFn: () => createAppointment({ title: title.trim(), time: time.trim(), notes: notes.trim() }),
    onSuccess: () => {
      setTitle("");
      setTime("");
      setNotes("");
      invalidate();
      toast.success("Compromisso registrado.");
    },
    onError: () => toast.error("Não foi possível registrar o compromisso."),
  });

  const removeAppointment = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: invalidate,
  });

  const addMetric = useMutation({
    mutationFn: () => createMetric({ label: label.trim(), value: value.trim(), unit: unit.trim() }),
    onSuccess: () => {
      setLabel("");
      setValue("");
      setUnit("");
      invalidate();
      toast.success("Indicador registrado.");
    },
    onError: () => toast.error("Não foi possível registrar o indicador."),
  });

  const removeMetric = useMutation({
    mutationFn: (id: string) => deleteMetric(id),
    onSuccess: invalidate,
  });

  const appointments = appointmentsQuery.data ?? [];
  const metrics = metricsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="hud-glow font-heading text-2xl font-black uppercase tracking-tighter text-cyan-300">
            Meus Dados
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-400/70">
            Somente informação verídica entra no briefing
          </p>
        </div>
        <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="nexus-data-back-link">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
      </header>

      <main className="space-y-8" data-testid="nexus-data-panel">
        <section className="hud-brackets rounded-lg border border-cyan-500/25 bg-slate-950/70 p-5 backdrop-blur-xl">
          <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Agenda real
          </h2>
          <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="appt-time" className="text-xs text-slate-400">Horário</Label>
              <Input
                id="appt-time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                placeholder="09:30"
                data-testid="nexus-appointment-time-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-title" className="text-xs text-slate-400">Compromisso</Label>
              <Input
                id="appt-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && title.trim() && addAppointment.mutate()}
                placeholder="Consulta médica"
                data-testid="nexus-appointment-title-input"
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="appt-notes" className="text-xs text-slate-400">Observação (opcional)</Label>
            <Input
              id="appt-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Levar exames"
              data-testid="nexus-appointment-notes-input"
            />
          </div>
          <Button
            className="mt-4"
            onClick={() => addAppointment.mutate()}
            disabled={!title.trim() || addAppointment.isPending}
            data-testid="nexus-appointment-add-btn"
          >
            Registrar compromisso
          </Button>

          <ul className="mt-5 space-y-2" data-testid="nexus-appointment-list">
            {appointments.length === 0 && (
              <li className="text-sm text-slate-500" data-testid="nexus-appointment-empty">
                Nenhum compromisso cadastrado — o NEXUS informará que sua agenda está livre.
              </li>
            )}
            {appointments.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border border-cyan-500/15 bg-slate-950/60 px-3 py-2"
                data-testid="nexus-appointment-item"
              >
                <span className="text-sm text-slate-300">
                  <span className="font-mono text-cyan-300">{item.time || "—"}</span> · {item.title}
                  {item.notes ? <span className="text-slate-500"> — {item.notes}</span> : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeAppointment.mutate(item.id)}
                  aria-label={`Remover ${item.title}`}
                  data-testid="nexus-appointment-delete-btn"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="hud-brackets rounded-lg border border-cyan-500/25 bg-slate-950/70 p-5 backdrop-blur-xl">
          <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80">
            <HeartPulse className="size-4" aria-hidden="true" />
            Indicadores de saúde
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="metric-label" className="text-xs text-slate-400">Indicador</Label>
              <Input
                id="metric-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Peso"
                data-testid="nexus-metric-label-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metric-value" className="text-xs text-slate-400">Valor</Label>
              <Input
                id="metric-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && label.trim() && value.trim() && addMetric.mutate()}
                placeholder="78"
                data-testid="nexus-metric-value-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metric-unit" className="text-xs text-slate-400">Unidade</Label>
              <Input
                id="metric-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="kg"
                data-testid="nexus-metric-unit-input"
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => addMetric.mutate()}
            disabled={!label.trim() || !value.trim() || addMetric.isPending}
            data-testid="nexus-metric-add-btn"
          >
            Registrar indicador
          </Button>

          <ul className="mt-5 space-y-2" data-testid="nexus-metric-list">
            {metrics.length === 0 && (
              <li className="text-sm text-slate-500" data-testid="nexus-metric-empty">
                Nenhum indicador registrado — o NEXUS não citará métricas corporais.
              </li>
            )}
            {metrics.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border border-cyan-500/15 bg-slate-950/60 px-3 py-2"
                data-testid="nexus-metric-item"
              >
                <span className="text-sm text-slate-300">
                  {item.label}: <span className="font-mono text-cyan-300">{item.value}{item.unit ? ` ${item.unit}` : ""}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeMetric.mutate(item.id)}
                  aria-label={`Remover ${item.label}`}
                  data-testid="nexus-metric-delete-btn"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs leading-relaxed text-slate-500">
          Clima, cotações e notícias são coletados de fontes reais automaticamente. Caixa de e-mails
          não possui integração conectada — o NEXUS declara isso abertamente em vez de supor conteúdo.
        </p>
      </main>
    </div>
  );
}