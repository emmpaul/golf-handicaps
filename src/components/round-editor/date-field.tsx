"use client";

import { CalendarIcon } from "lucide-react";
import {
  type ComponentProps,
  type ComponentType,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import { fr } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPlayedOn, isoToLocalDate, localDateToIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AI_CELL_CLASS, AI_DESCRIPTION, AiMark } from "./score-grid";

/** Premier mois proposé dans la liste des années du calendrier. */
const START_MONTH = new Date(2020, 0);

type DayButtonProps = ComponentProps<typeof CalendarDayButton>;

/** `CalendarDayButton` passe ses autres props, `ref` compris (React 19), au bouton. */
const RegistryDayButton = CalendarDayButton as ComponentType<
  DayButtonProps & { ref: Ref<HTMLButtonElement> }
>;

/**
 * Bouton du jour qui prend le focus quand le calendrier le désigne. Celui du registre ne
 * relie pas sa ref au bouton : sans ce relais, les flèches ne déplacent pas le focus.
 */
function DayButton({ modifiers, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  return <RegistryDayButton ref={ref} modifiers={modifiers} locale={fr} {...props} />;
}

/**
 * Date de jeu de l'écran de correction : un bouton qui affiche « 17 octobre 2026 » et ouvre
 * un calendrier. `value` et `onChange` restent en ISO `YYYY-MM-DD`.
 */
export function DateField({
  id,
  value,
  invalid,
  ai,
  onChange,
}: {
  id: string;
  value: string | null;
  invalid: boolean;
  ai: boolean;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const selected = value ? isoToLocalDate(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              aria-invalid={invalid || undefined}
              aria-description={ai ? AI_DESCRIPTION : undefined}
              className={cn("w-full justify-start font-normal", ai && AI_CELL_CLASS)}
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {value ? formatPlayedOn(value) : "Choisir une date"}
        </PopoverTrigger>
        {ai ? <AiMark /> : null}
      </div>
      {/* À l'ouverture, le focus va au jour choisi : les flèches partent de lui. */}
      <PopoverContent
        ref={popup}
        className="w-auto p-0"
        align="start"
        initialFocus={() =>
          popup.current?.querySelector<HTMLElement>('[aria-selected="true"] button') ?? true
        }
      >
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected}
          locale={fr}
          captionLayout="dropdown"
          startMonth={START_MONTH}
          endMonth={new Date(new Date().getFullYear(), 11)}
          className="[--cell-size:--spacing(11)]"
          components={{ DayButton }}
          onSelect={(date) => {
            onChange(localDateToIso(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
