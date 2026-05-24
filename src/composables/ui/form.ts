import type { ZodType } from "zod";

export interface IFormFieldConfig {
  /**
   * The parser/formatter. It is expected that the zod type transform the value passing through it
   */
  parser: ZodType
  type?: 'error' | 'info' | 'warn' | 'success';
  runIf: 'submit' | 'blur-focus' | 'input'
}
export interface IFormField<V = string, F = V> {
  format?: F;
  value?: V;
}

export type IFormDataSchema<T extends Record<string, unknown>> = Record<keyof T, IFormField>;

export interface IFormOperative<T extends Record<string, unknown>> {
  errors: Partial<Record<keyof T, string>>;
  formObject: {
    [K in keyof T]: IFormField<T[K], string>;
  }
  schema: Record<keyof T, IFormFieldConfig>;
}
