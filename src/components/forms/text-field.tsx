"use client";

import { useId } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Labelled input bound to react-hook-form. Wires aria-invalid and aria-describedby so screen
 * readers announce the description and error (DESIGN.md §10).
 */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  ...inputProps
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "defaultValue" | "value">) {
  const id = useId();
  const descId = `${id}-desc`;
  const errId = `${id}-err`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            {...inputProps}
            {...field}
            value={field.value ?? ""}
            id={id}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={
              [description ? descId : null, fieldState.error ? errId : null].filter(Boolean).join(" ") || undefined
            }
          />
          {description && <FieldDescription id={descId}>{description}</FieldDescription>}
          <FieldError id={errId} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
