import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";

// Convert YYYY-MM-DD to DD/MM/YYYY for display
function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD internally
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, className, placeholder = "Selecione uma data" }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert YYYY-MM-DD to JS Date for the calendar
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [value]);

  // Convert JS Date back to YYYY-MM-DD
  const formatDateValue = (date: Date | undefined): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full min-w-0 justify-start overflow-hidden text-left font-normal border-border bg-card hover:bg-accent",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="min-w-0 flex-1 truncate">
            {value ? formatDateBR(value) : placeholder}
          </span>
          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              onChange(formatDateValue(date));
            }
            setOpen(false);
          }}
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            caption_label: "font-medium text-sm",
            dropdown: "text-sm",
            weekday: "text-muted-foreground rounded-md font-normal text-[0.8rem]",
            head_row: "flex",
            row: "flex w-full mt-2",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
