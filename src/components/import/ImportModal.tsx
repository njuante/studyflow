import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardCopy,
  FileText,
  Inbox as InboxIcon,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import { useTags } from "../../hooks/useTags";
import { useTapEffect } from "../../hooks/useTapEffect";
import { useMotionPresets } from "../../lib/motion";
import { bulkCreateEvents } from "../../lib/api";
import {
  JSON_TEMPLATE,
  NARRATIVE_TEMPLATE,
  countNarrativeDays,
  detectFormat,
  parseInput,
  scheduleBlocks,
  type AutoplanOptions,
  type AutoplanResult,
  type ParsedBlock,
  type ParsedFormat,
  type ScheduledBlock,
} from "../../lib/parser";
import { toIsoDate } from "../../lib/dates";
import type { StudyEvent } from "../../types";
import styles from "./ImportModal.module.css";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

type WizardStep = "detect" | "configure" | "preview";

const PREFS_STORAGE_KEY = "studyflow.import.preferences";

interface PersistedPreferences {
  skipWeekends: boolean;
  splitIntoPomodoros: boolean;
  avoidSameTagInRow: boolean;
  defaultTagId: string | null;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  maxHoursPerDay: number;
  placement: "random" | "sequential";
}

const DEFAULT_PREFS: PersistedPreferences = {
  skipWeekends: true,
  splitIntoPomodoros: false,
  avoidSameTagInRow: true,
  defaultTagId: null,
  morningStart: "09:00",
  morningEnd: "14:00",
  afternoonStart: "16:00",
  afternoonEnd: "19:00",
  maxHoursPerDay: 8,
  placement: "sequential",
};

function loadPreferences(): PersistedPreferences {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePreferences(prefs: PersistedPreferences) {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function tomorrowIso(): string {
  const today = new Date();
  today.setDate(today.getDate() + 1);
  return toIsoDate(today);
}

function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildOptions(
  prefs: PersistedPreferences,
  startIso: string,
): AutoplanOptions {
  return {
    startDate: isoToDate(startIso),
    skipWeekends: prefs.skipWeekends,
    workSlots: [
      { start: prefs.morningStart, end: prefs.morningEnd },
      { start: prefs.afternoonStart, end: prefs.afternoonEnd },
    ],
    maxHoursPerDay: prefs.maxHoursPerDay,
    splitIntoPomodoros: prefs.splitIntoPomodoros,
    avoidSameTagInRow: prefs.avoidSameTagInRow,
    placement: prefs.placement,
    defaultTagId: prefs.defaultTagId,
  };
}

function blockToEvent(block: ScheduledBlock): StudyEvent {
  const now = new Date().toISOString();
  return {
    id: block.id,
    title: block.title,
    description: block.description,
    date: block.date,
    startTime: block.startTime,
    durationMinutes: block.durationMinutes,
    tagId: block.tagId,
    type: block.type,
    priority: block.priority,
    createdAt: now,
    updatedAt: now,
    scheduled: block.scheduled,
    completed: false,
    completedAt: null,
    lockDuringFocus: false,
  };
}

export function ImportModal({
  onClose,
  onImportComplete,
  open,
}: ImportModalProps) {
  const { tags, getTagById } = useTags();
  const { springs, fades } = useMotionPresets();
  const tapProps = useTapEffect();
  const [step, setStep] = useState<WizardStep>("detect");
  const [rawInput, setRawInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedBlocks, setParsedBlocks] = useState<ParsedBlock[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<ParsedFormat>("unknown");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<PersistedPreferences>(DEFAULT_PREFS);
  const [startDateIso, setStartDateIso] = useState(tomorrowIso());
  const [autoplanResult, setAutoplanResult] = useState<AutoplanResult | null>(
    null,
  );

  const [blockEdits, setBlockEdits] = useState<Map<string, BlockEdit>>(
    new Map(),
  );
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tauriAvailable = isTauri();

  useEffect(() => {
    if (!open) return;
    setPrefs(loadPreferences());
    setStartDateIso(tomorrowIso());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep("detect");
      setRawInput("");
      setFileName(null);
      setParsedBlocks([]);
      setDetectedFormat("unknown");
      setParseError(null);
      setParseWarnings([]);
      setShowTemplates(false);
      setCopyMessage(null);
      setAutoplanResult(null);
      setBlockEdits(new Map());
      setExcludedIds(new Set());
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setDetectedFormat("unknown");
      setParsedBlocks([]);
      setParseError(null);
      setParseWarnings([]);
      return;
    }

    const handle = window.setTimeout(() => {
      const format = detectFormat(trimmed);
      const result = parseInput(trimmed);
      setDetectedFormat(result.format ?? format);
      if (result.ok && result.blocks) {
        setParsedBlocks(result.blocks);
        setParseError(null);
        setParseWarnings(result.warnings ?? []);
      } else {
        setParsedBlocks([]);
        setParseError(result.error ?? "Formato no reconocido");
        setParseWarnings([]);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [open, rawInput]);

  const continueDisabled =
    parsedBlocks.length === 0 || parseError !== null;

  const goNextFromDetect = useCallback(() => {
    if (continueDisabled) return;
    const isNarrative = detectedFormat === "narrative";
    if (isNarrative) {
      setStep("configure");
    } else {
      const editable = toScheduledFromAlreadyDated(parsedBlocks, prefs);
      setAutoplanResult({
        scheduledBlocks: editable,
        inboxBlocks: [],
        warnings: parseWarnings,
      });
      setStep("preview");
    }
  }, [continueDisabled, detectedFormat, parsedBlocks, prefs, parseWarnings]);

  const goNextFromConfigure = useCallback(() => {
    const options = buildOptions(prefs, startDateIso);
    const result = scheduleBlocks(parsedBlocks, options);
    setAutoplanResult(result);
    savePreferences(prefs);
    setStep("preview");
  }, [parsedBlocks, prefs, startDateIso]);

  const goBack = useCallback(() => {
    if (step === "preview") {
      const isNarrative = detectedFormat === "narrative";
      setStep(isNarrative ? "configure" : "detect");
    } else if (step === "configure") {
      setStep("detect");
    } else {
      onClose();
    }
  }, [detectedFormat, onClose, step]);

  useEffect(() => {
    if (!open) return;
    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        goBack();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [open, goBack]);

  function handleCopyTemplate(content: string, label: string) {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopyMessage(`${label} copiado`);
        window.setTimeout(() => setCopyMessage(null), 1800);
      })
      .catch(() => {
        setCopyMessage("No se pudo copiar al portapapeles");
        window.setTimeout(() => setCopyMessage(null), 1800);
      });
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setRawInput(content);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  const stepNumber = step === "detect" ? 1 : step === "configure" ? 2 : 3;
  const stepLabel = step === "detect" ? "Detección" : step === "configure" ? "Configurar autoplan" : "Vista previa";

  return (
    <AnimatePresence>
      {open ? (
    <motion.div
      className={styles.overlay}
      onClick={onClose}
      role="presentation"
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={fades.default}
    >
      <motion.div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={springs.appear}
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <Sparkles size={18} strokeWidth={1.75} />
            <span>Importar planning</span>
            <span className={styles.stepIndicator}>
              {stepNumber}/3 · {stepLabel}
            </span>
          </div>
          <button
            aria-label="Cerrar"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>

        {!tauriAvailable ? (
          <div className={styles.devBanner}>
            <AlertTriangle size={14} strokeWidth={1.75} />
            <span>
              Modo navegador (npm run dev): la previsualización funciona, pero
              la importación final necesita la app Tauri.
            </span>
          </div>
        ) : null}

        {submitError ? (
          <div className={styles.errorBanner}>
            <AlertTriangle size={14} strokeWidth={1.75} />
            <span>{submitError}</span>
          </div>
        ) : null}

        {step === "detect" ? (
          <DetectStep
            copyMessage={copyMessage}
            detectedFormat={detectedFormat}
            fileName={fileName}
            fileInputRef={fileInputRef}
            onCopyJson={() => handleCopyTemplate(JSON_TEMPLATE, "Template JSON")}
            onCopyNarrative={() =>
              handleCopyTemplate(NARRATIVE_TEMPLATE, "Template narrativo")
            }
            onFileSelect={readFile}
            onShowTemplates={() => setShowTemplates(true)}
            onTextChange={setRawInput}
            parseError={parseError}
            parsedBlockCount={parsedBlocks.length}
            rawInput={rawInput}
            showTemplates={showTemplates}
          />
        ) : null}

        {step === "configure" ? (
          <ConfigureStep
            prefs={prefs}
            startDateIso={startDateIso}
            tags={tags}
            onPrefsChange={setPrefs}
            onStartDateChange={setStartDateIso}
            blockCount={parsedBlocks.length}
          />
        ) : null}

        {step === "preview" && autoplanResult ? (
          <PreviewStep
            autoplanResult={autoplanResult}
            blockEdits={blockEdits}
            excludedIds={excludedIds}
            getTagById={getTagById}
            onToggleExclude={(id) =>
              setExcludedIds((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onUpdateBlock={(id, patch) =>
              setBlockEdits((current) => {
                const next = new Map(current);
                next.set(id, { ...(next.get(id) ?? {}), ...patch });
                return next;
              })
            }
            tags={tags}
          />
        ) : null}

        <footer className={styles.footer}>
          {step === "detect" ? (
            <>
              <button
                className={styles.cancelButton}
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
              <motion.button
                {...tapProps}
                className={styles.primaryButton}
                disabled={continueDisabled}
                onClick={goNextFromDetect}
                type="button"
              >
                Continuar
                <ChevronRight size={14} strokeWidth={2} />
              </motion.button>
            </>
          ) : null}

          {step === "configure" ? (
            <>
              <button
                className={styles.secondaryButton}
                onClick={goBack}
                type="button"
              >
                <ArrowLeft size={14} strokeWidth={2} />
                Volver
              </button>
              <motion.button
                {...tapProps}
                className={styles.primaryButton}
                onClick={goNextFromConfigure}
                type="button"
              >
                Vista previa
                <ChevronRight size={14} strokeWidth={2} />
              </motion.button>
            </>
          ) : null}

          {step === "preview" && autoplanResult ? (
            <PreviewActions
              autoplanResult={autoplanResult}
              blockEdits={blockEdits}
              excludedIds={excludedIds}
              isSubmitting={isSubmitting}
              onBack={goBack}
              onConfirm={async () => {
                if (isSubmitting) return;
                setSubmitError(null);

                if (!tauriAvailable) {
                  setSubmitError(
                    "La importación necesita la app Tauri (npm run tauri). En modo navegador (npm run dev) la persistencia no está disponible.",
                  );
                  return;
                }

                setIsSubmitting(true);
                try {
                  const finalBlocks = applyEditsAndExcludes(
                    autoplanResult,
                    blockEdits,
                    excludedIds,
                  );
                  const events = finalBlocks.map(blockToEvent);
                  if (events.length > 0) {
                    await bulkCreateEvents(events);
                  }
                  onImportComplete(events.length);
                  onClose();
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  setSubmitError(`No se pudo importar: ${message}`);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            />
          ) : null}
        </footer>
      </motion.div>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface BlockEdit {
  tagId?: string | null;
  type?: ParsedBlock["type"];
  startTime?: string;
}

function applyEditsAndExcludes(
  result: AutoplanResult,
  edits: Map<string, BlockEdit>,
  excluded: Set<string>,
): ScheduledBlock[] {
  const merged = [...result.scheduledBlocks, ...result.inboxBlocks];
  return merged
    .filter((block) => !excluded.has(block.id))
    .map((block) => {
      const edit = edits.get(block.id);
      if (!edit) return block;
      return {
        ...block,
        tagId: edit.tagId !== undefined ? edit.tagId : block.tagId,
        type: edit.type ?? block.type,
        startTime: edit.startTime ?? block.startTime,
      };
    });
}

function toScheduledFromAlreadyDated(
  blocks: ParsedBlock[],
  prefs: PersistedPreferences,
): ScheduledBlock[] {
  return blocks.map((block) => ({
    ...block,
    scheduled: true,
    date: block.date ?? toIsoDate(new Date()),
    startTime: block.startTime ?? "09:00",
    tagId: block.tagId ?? prefs.defaultTagId,
  }));
}

interface DetectStepProps {
  copyMessage: string | null;
  detectedFormat: ParsedFormat;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  fileName: string | null;
  onCopyJson: () => void;
  onCopyNarrative: () => void;
  onFileSelect: (file: File) => void;
  onShowTemplates: () => void;
  onTextChange: (value: string) => void;
  parseError: string | null;
  parsedBlockCount: number;
  rawInput: string;
  showTemplates: boolean;
}

function DetectStep({
  copyMessage,
  detectedFormat,
  fileInputRef,
  fileName,
  onCopyJson,
  onCopyNarrative,
  onFileSelect,
  onShowTemplates,
  onTextChange,
  parseError,
  parsedBlockCount,
  rawInput,
  showTemplates,
}: DetectStepProps) {
  const isEmpty = rawInput.trim().length === 0;
  const days = useMemo(() => countNarrativeDays(rawInput), [rawInput]);

  return (
    <div className={styles.body}>
      <div className={styles.fileBar}>
        <button
          className={styles.fileButton}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Upload size={14} strokeWidth={1.75} />
          {fileName ? fileName : "Subir archivo (.json, .md, .txt)"}
        </button>
        <input
          accept=".json,.md,.txt"
          className={styles.hiddenInput}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelect(file);
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      <textarea
        autoFocus
        className={styles.textarea}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Pega tu planning aquí. Acepta: narrativo (Bloque/Día), JSON o Markdown."
        value={rawInput}
      />

      {isEmpty ? (
        <div className={styles.infoPanel}>
          <FileText size={16} strokeWidth={1.75} />
          <div className={styles.infoBody}>
            <strong>¿No tienes un planning?</strong>
            <span>
              Copia uno de estos prompts y pídeselo a tu IA. Lo pegas aquí y
              listo.
            </span>
            <div className={styles.templateButtons}>
              <button
                className={styles.templateButton}
                onClick={onCopyNarrative}
                type="button"
              >
                <ClipboardCopy size={13} strokeWidth={1.75} />
                Copiar template narrativo
              </button>
              <button
                className={styles.templateButton}
                onClick={onCopyJson}
                type="button"
              >
                <ClipboardCopy size={13} strokeWidth={1.75} />
                Copiar template JSON
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`${styles.detectPanel} ${formatToClass(detectedFormat, parseError !== null)}`}
        >
          {parseError ? (
            <>
              <X size={16} strokeWidth={2} />
              <div className={styles.detectBody}>
                <strong>Formato no reconocido</strong>
                <span>{parseError}</span>
              </div>
              <button
                className={styles.detectAction}
                onClick={onShowTemplates}
                type="button"
              >
                Ver templates
              </button>
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={2} />
              <div className={styles.detectBody}>
                <strong>{formatToLabel(detectedFormat)}</strong>
                <span>
                  {detectedFormat === "narrative"
                    ? `${days} días detectados · ${parsedBlockCount} bloques`
                    : `${parsedBlockCount} bloques`}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {showTemplates ? (
        <div className={styles.templatesPanel}>
          <div className={styles.templatesPanelHeader}>
            <strong>Templates disponibles</strong>
          </div>
          <div className={styles.templateButtons}>
            <button
              className={styles.templateButton}
              onClick={onCopyNarrative}
              type="button"
            >
              <ClipboardCopy size={13} strokeWidth={1.75} />
              Template narrativo
            </button>
            <button
              className={styles.templateButton}
              onClick={onCopyJson}
              type="button"
            >
              <ClipboardCopy size={13} strokeWidth={1.75} />
              Template JSON
            </button>
          </div>
        </div>
      ) : null}

      {copyMessage ? (
        <div className={styles.toast}>
          <Check size={13} strokeWidth={2} />
          {copyMessage}
        </div>
      ) : null}
    </div>
  );
}

function formatToLabel(format: ParsedFormat): string {
  switch (format) {
    case "narrative":
      return "Formato detectado: Narrativo";
    case "json":
      return "Formato detectado: JSON estructurado";
    case "markdown":
      return "Formato detectado: Markdown";
    default:
      return "Formato no reconocido";
  }
}

function formatToClass(format: ParsedFormat, hasError: boolean): string {
  if (hasError || format === "unknown") return styles.detectError;
  if (format === "narrative") return styles.detectSuccess;
  return styles.detectInfo;
}

interface ConfigureStepProps {
  blockCount: number;
  prefs: PersistedPreferences;
  startDateIso: string;
  tags: { id: string; name: string; color: string }[];
  onPrefsChange: (next: PersistedPreferences) => void;
  onStartDateChange: (iso: string) => void;
}

function ConfigureStep({
  blockCount,
  onPrefsChange,
  onStartDateChange,
  prefs,
  startDateIso,
  tags,
}: ConfigureStepProps) {
  function update<K extends keyof PersistedPreferences>(
    key: K,
    value: PersistedPreferences[K],
  ) {
    onPrefsChange({ ...prefs, [key]: value });
  }

  return (
    <div className={styles.body}>
      <p className={styles.subtle}>
        {blockCount} bloques detectados. Ajusta cómo quieres distribuirlos.
      </p>

      <div className={styles.formGrid}>
        <label className={styles.formField}>
          <span>Fecha de inicio (Día 1)</span>
          <input
            onChange={(event) => onStartDateChange(event.target.value)}
            type="date"
            value={startDateIso}
          />
        </label>

        <label className={styles.formField}>
          <span>Asignar todos a</span>
          <select
            onChange={(event) =>
              update("defaultTagId", event.target.value || null)
            }
            value={prefs.defaultTagId ?? ""}
          >
            <option value="">Sin etiqueta</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.formField}>
          <span>Máximo horas/día: {prefs.maxHoursPerDay}h</span>
          <input
            max={12}
            min={4}
            onChange={(event) =>
              update("maxHoursPerDay", Number(event.target.value))
            }
            step={1}
            type="range"
            value={prefs.maxHoursPerDay}
          />
        </label>

        <label className={styles.formField}>
          <span>Colocación</span>
          <select
            onChange={(event) =>
              update(
                "placement",
                event.target.value as "random" | "sequential",
              )
            }
            value={prefs.placement}
          >
            <option value="sequential">Secuencial (al primer hueco)</option>
            <option value="random">Aleatoria dentro de las franjas</option>
          </select>
        </label>
      </div>

      <div className={styles.slotsRow}>
        <div className={styles.slotBox}>
          <strong>Mañana</strong>
          <div className={styles.slotInputs}>
            <input
              onChange={(event) => update("morningStart", event.target.value)}
              type="time"
              value={prefs.morningStart}
            />
            <span>—</span>
            <input
              onChange={(event) => update("morningEnd", event.target.value)}
              type="time"
              value={prefs.morningEnd}
            />
          </div>
        </div>
        <div className={styles.slotBox}>
          <strong>Tarde</strong>
          <div className={styles.slotInputs}>
            <input
              onChange={(event) => update("afternoonStart", event.target.value)}
              type="time"
              value={prefs.afternoonStart}
            />
            <span>—</span>
            <input
              onChange={(event) => update("afternoonEnd", event.target.value)}
              type="time"
              value={prefs.afternoonEnd}
            />
          </div>
        </div>
      </div>

      <div className={styles.toggleList}>
        <Toggle
          checked={prefs.skipWeekends}
          label="Saltar fines de semana"
          onChange={(value) => update("skipWeekends", value)}
        />
        <Toggle
          checked={prefs.splitIntoPomodoros}
          label="Partir bloques largos en pomodoros (50min + 10min descanso)"
          onChange={(value) => update("splitIntoPomodoros", value)}
        />
        <Toggle
          checked={prefs.avoidSameTagInRow}
          label="Evitar el mismo proyecto en bloques consecutivos"
          onChange={(value) => update("avoidSameTagInRow", value)}
        />
      </div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}

function Toggle({ checked, label, onChange }: ToggleProps) {
  return (
    <label className={styles.toggle}>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className={styles.toggleSwitch} aria-hidden="true">
        <span className={styles.toggleThumb} />
      </span>
      <span>{label}</span>
    </label>
  );
}

interface PreviewStepProps {
  autoplanResult: AutoplanResult;
  blockEdits: Map<string, BlockEdit>;
  excludedIds: Set<string>;
  getTagById: (id: string | null | undefined) => { color: string; name: string } | null;
  onToggleExclude: (id: string) => void;
  onUpdateBlock: (id: string, patch: BlockEdit) => void;
  tags: { id: string; name: string; color: string }[];
}

function PreviewStep({
  autoplanResult,
  blockEdits,
  excludedIds,
  getTagById,
  onToggleExclude,
  onUpdateBlock,
  tags,
}: PreviewStepProps) {
  const allBlocks = useMemo(
    () => [
      ...autoplanResult.scheduledBlocks,
      ...autoplanResult.inboxBlocks,
    ],
    [autoplanResult],
  );

  const visibleScheduled = autoplanResult.scheduledBlocks.filter(
    (block) => !excludedIds.has(block.id),
  );

  const dateRange = useMemo(() => {
    if (visibleScheduled.length === 0) return [];
    const sortedDates = visibleScheduled
      .map((block) => block.date)
      .sort((a, b) => a.localeCompare(b));
    const first = sortedDates[0];
    const last = sortedDates[sortedDates.length - 1];
    const start = isoToDate(first);
    const end = isoToDate(last);
    const days: string[] = [];
    const cursor = new Date(start);
    const horizon = Math.min(
      14,
      Math.max(
        7,
        Math.round(
          (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
        ) + 1,
      ),
    );
    for (let i = 0; i < horizon; i += 1) {
      days.push(toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [visibleScheduled]);

  const blocksByDate = useMemo(() => {
    const map = new Map<string, ScheduledBlock[]>();
    for (const block of visibleScheduled) {
      const list = map.get(block.date) ?? [];
      list.push(block);
      map.set(block.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [visibleScheduled]);

  return (
    <div className={styles.body}>
      {autoplanResult.warnings.length > 0 ? (
        <div className={styles.warningPanel}>
          <strong>{autoplanResult.warnings.length} avisos</strong>
          <ul>
            {autoplanResult.warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            {autoplanResult.warnings.length > 4 ? (
              <li>… y {autoplanResult.warnings.length - 4} más</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {autoplanResult.inboxBlocks.length > 0 ? (
        <div className={styles.inboxNotice}>
          <InboxIcon size={14} strokeWidth={1.75} />
          {autoplanResult.inboxBlocks.length} bloques irán al Inbox para que los
          organices manualmente
        </div>
      ) : null}

      {dateRange.length > 0 ? (
        <div className={styles.miniCalendar}>
          {dateRange.map((iso) => {
            const dayDate = isoToDate(iso);
            const dayBlocks = blocksByDate.get(iso) ?? [];
            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
            return (
              <div
                className={`${styles.miniDay} ${isWeekend ? styles.miniDayWeekend : ""}`}
                key={iso}
              >
                <header className={styles.miniDayHeader}>
                  <span className={styles.miniDayName}>
                    {dayDate
                      .toLocaleDateString("es-ES", { weekday: "short" })
                      .replace(".", "")}
                  </span>
                  <span className={styles.miniDayNumber}>
                    {dayDate.getDate()}
                  </span>
                </header>
                <div className={styles.miniDayBlocks}>
                  {dayBlocks.map((block) => {
                    const tag = getTagById(block.tagId);
                    const color = tag?.color ?? "#8e8e93";
                    return (
                      <span
                        className={styles.miniBlock}
                        key={block.id}
                        style={
                          {
                            backgroundColor: `${color}28`,
                            color,
                            borderLeft: `3px solid ${color}`,
                          } as CSSProperties
                        }
                        title={`${block.startTime} · ${block.title}`}
                      >
                        {block.startTime} · {block.title}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className={styles.previewList}>
        {allBlocks.map((block) => {
          const edit = blockEdits.get(block.id);
          const isExcluded = excludedIds.has(block.id);
          const tagId = edit?.tagId !== undefined ? edit.tagId : block.tagId;
          const type = edit?.type ?? block.type;
          const startTime = edit?.startTime ?? block.startTime;
          const tag = getTagById(tagId);
          const color = tag?.color ?? "#8e8e93";

          return (
            <div
              className={`${styles.previewRow} ${isExcluded ? styles.previewRowExcluded : ""}`}
              key={block.id}
              style={
                {
                  borderLeft: `3px solid ${color}`,
                } as CSSProperties
              }
            >
              <input
                checked={!isExcluded}
                onChange={() => onToggleExclude(block.id)}
                type="checkbox"
              />
              <div className={styles.previewMain}>
                <span className={styles.previewTitle}>{block.title}</span>
                {block.blockGroup ? (
                  <span className={styles.previewBadge}>
                    {block.blockGroup}
                  </span>
                ) : null}
              </div>
              <select
                className={styles.previewSelect}
                onChange={(event) =>
                  onUpdateBlock(block.id, {
                    tagId: event.target.value || null,
                  })
                }
                value={tagId ?? ""}
              >
                <option value="">Sin etiqueta</option>
                {tags.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <select
                className={styles.previewSelect}
                onChange={(event) =>
                  onUpdateBlock(block.id, {
                    type: event.target.value as ParsedBlock["type"],
                  })
                }
                value={type}
              >
                <option value="theory">Teoría</option>
                <option value="practice">Práctica</option>
                <option value="review">Repaso</option>
                <option value="exam">Examen</option>
              </select>
              {block.scheduled ? (
                <input
                  className={styles.previewTime}
                  onChange={(event) =>
                    onUpdateBlock(block.id, { startTime: event.target.value })
                  }
                  type="time"
                  value={startTime}
                />
              ) : (
                <span className={styles.inboxBadge}>→ Inbox</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PreviewActionsProps {
  autoplanResult: AutoplanResult;
  blockEdits: Map<string, BlockEdit>;
  excludedIds: Set<string>;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

function PreviewActions({
  autoplanResult,
  blockEdits,
  excludedIds,
  isSubmitting,
  onBack,
  onConfirm,
}: PreviewActionsProps) {
  const finalBlocks = applyEditsAndExcludes(
    autoplanResult,
    blockEdits,
    excludedIds,
  );
  const scheduledCount = finalBlocks.filter((b) => b.scheduled).length;
  const inboxCount = finalBlocks.filter((b) => !b.scheduled).length;
  const tapProps = useTapEffect();

  return (
    <>
      <button className={styles.secondaryButton} onClick={onBack} type="button">
        <ArrowLeft size={14} strokeWidth={2} />
        Volver
      </button>
      <motion.button
        {...tapProps}
        className={styles.primaryButton}
        disabled={isSubmitting || finalBlocks.length === 0}
        onClick={onConfirm}
        type="button"
      >
        {isSubmitting
          ? "Importando..."
          : inboxCount > 0
            ? `Importar ${scheduledCount} al calendario + ${inboxCount} al Inbox`
            : `Importar ${scheduledCount} bloques al calendario`}
      </motion.button>
    </>
  );
}
