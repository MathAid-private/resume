import type { ZodType } from "zod"

export type JSType = 'boolean' | 'number' | 'string' | 'symbol' | 'bigint' | 'object' | 'function' | 'undefined'

export type JSTuple<T, U> = [T, U]

/**
 * Safely extracts the element type from a given array or tuple type.
 *
 * @typeParam TArray - The array type to extract elements from. Falls back to `unknown` if a non-array is passed.
 * @typeParam TExpected - An optional constraint defining what the items should extend.
 *
 * @public
 */
export type ArrayType<TArray, TExpected = unknown> = TArray extends TExpected[]
  ? TArray[number]
  : unknown;

/**
 * Extracts all nullable properties in `T` into a separate type
 *
 * @template T the type of object from which the nullable properties will be extracted
 */
export type NullableEntries<T extends object> = NullablePart<T>;
/** The same as {@linkcode NullableEntries} but for `undefined` instead of `null` */
export type UndefinedEntries<T extends object> = UndefinedPart<T>;
/**
 * Extracts all nullable or undefined properties in `T` into a separate type
 *
 * @template T the type of object from which the undefined properties will be extracted
 */
export type NilEntries<T extends object> = NullishPart<T>;

/**
 * @summary Creates a type with only the nullable properties (key + value pair preserved).
 *
 * Maps an object type `T` to a new type containing **only** the properties where `null` is assignable to the value type
 * (i.e. the property can be `null` — either `null` itself or part of a union that includes `null`).
 * Returns `never` if `T` is not an object type.
 *
 * This extract a subset of an object type containing only fields that are allowed to be `null`, keeping both keys and their original value types.
 *
 * ### Capabilities
 *   - Preserves the original value types (including unions)
 *   - Works with interfaces, types, classes, records
 *   - Returns an empty object (`{}`) when no properties match (instead of `never`)
 *   - Returns `never` only when input is not an object-like type
 *
 * ### Application
 *   - API response filtering / transformation
 *   - Safe null-handling utilities
 *   - Creating partial types focused on nullable fields
 * @example
 * ```ts
 * interface User {
 *   id: number;
 *   name: string | null;
 *   email: null;
 *   age?: number;           // number | undefined — not nullable
 *   avatarUrl: string | null | undefined;
 * }
 *
 * type NullablePart = NullablePart<User>;
 * //   ↑↑↑ type NullablePart = {
 * //         name: string | null;
 * //         email: null;
 * //         avatarUrl: string | null | undefined;
 * //       }
 *
 * // Non-object input
 * type NotObj = NullablePart<string>;   // never
 * ```
 * @template T The object type to extract nullable properties from
 */
export type NullablePart<T> = T extends object
  ? { [K in keyof T as null extends T[K] ? K : never]: T[K] }
  : never;
/**
 * The same as {@linkcode NullablePart} but for `undefined` instead of `null`,
 * i.e it is to `undefined` what `NullablePart` is to `null`
 *
 * @template T The object type to extract undefined properties from
 */
export type UndefinedPart<T> = T extends object
  ? { [K in keyof T as undefined extends T[K] ? K : never]: T[K] }
  : never;

/**
 * Maps an object type `T` to a new type containing **only** the properties where `undefined` is assignable to the value type
 * (i.e. optional properties or properties explicitly typed with `undefined` in the union).
 * Returns `never` if `T` is not an object type.
 *
 * @summary Creates a type with only the undefinable/optional-like properties (key + value pair preserved).
 * @purpose Extract a subset containing only fields that are allowed to be `undefined`.
 * @example
 * ```ts
 * interface Config {
 *   theme: string;
 *   fontSize?: number;           // number | undefined
 *   debug: boolean | undefined;
 *   logger: undefined;
 * }
 *
 * type UndefinablePart = UndefinablePart<Config>;
 * //   ↑↑↑ type UndefinablePart = {
 * //         fontSize?: number;
 * //         debug: boolean | undefined;
 * //         logger: undefined;
 * //       }
 * ```
 * @typeparam T The object type to extract undefinable properties from
 */
export type UndefinablePart<T> = T extends object
  ? { [K in keyof T as undefined extends T[K] ? K : never]: T[K] }
  : never;

/**
 * Combines both nullable and undefinable properties into a single mapped type.
 * Contains **all properties** that accept **either** `null` **or** `undefined` (or both).
 *
 * @summary Union (in terms of properties) of nullable and undefinable fields, keeping original value types.
 * @example
 * ```ts
 * interface Data {
 *   id: number;
 *   value: number | null | undefined;
 *   status?: string;               // string | undefined
 *   error: Error | null;
 *   fallback: undefined;
 * }
 *
 * type NullishPart = NullishPart<Data>;
 * //   ↑↑↑ type NullishPart = {
 * //         value: number | null | undefined;
 * //         status?: string;
 * //         error: Error | null;
 * //         fallback: undefined;
 * //       }
 * ```
 * @typeparam T The object type to extract nullish (null or undefined) properties from
 */
export type NullishPart<T> = T extends object ? NullablePart<T> & UndefinablePart<T> : never;
/**
 * Determines if a type can be null or undefined.
 *
 * @template T - The type to check for nullability
 * @returns {boolean} false if T extends null | undefined | never, true otherwise
 *
 * @example
 * type A = IsNullable<string>;        // true
 * type B = IsNullable<string | null>; // true
 * type C = IsNullable<never>;         // false
 *
 * @internal Used internally for type-safe filter generation
 */
export type IsNullable<T> = null extends T ? true : false;
/** Alias for {@linkcode IsNullable} */
export type IsNull<T> = IsNullable<T>;
/**
 * The same as {@linkcode IsNullable} but for 1undefined` instead of `null`
 *
 * @template T the type to check for `undefined`
 */
export type IsUndefined<T> = undefined extends T ? true : false;
/**
 * Determines if T is type undefined or nullable (disjunction)
 *
 * @template T the type to check
 */
export type IsNil<T> = true extends IsNull<T> | IsUndefined<T> ? true : false;
/**
 * Determines if T is type undefined and null (conjunction)
 *
 * @template T the type to check
 */
export type EveryNil<T> = [IsNull<T>, IsUndefined<T>] extends [true, true] ? true : false;
/**
 * @summary Checks if a specific key exists within a given type.
 *
 * Determines if `Key` is one of the valid properties of `T`. This works for
 * Interfaces, Type Aliases, and Records.
 *
 * - Validates against both required and optional properties.
 * - Supports string, number, and symbol keys.
 * - Returns `true` if the key exists, otherwise `false`.
 *
 * Useful for conditional type logic where behavior depends on the presence
 * of specific fields (e.g., API response mapping).
 *
 * @example
 * type User = { id: number; name: string; age?: number };
 * type HasName = HasKey<User, "name">; // true
 * type HasEmail = HasKey<User, "email">; // false
 *
 * @template T - The type to inspect.
 * @template Prop - The property name to look for.
 */
export type HasProp<T, Prop extends string | number | symbol> = Prop extends keyof T ? true : false;

export type IsBoolean<T> = boolean extends T ? true : false;
export type IsSymbol<T> = symbol extends T ? true : false;
export type IsNumber<T> = number extends T ? true : false;
export type IsBigInt<T> = bigint extends T ? true : false;
export type IsString<T> = string extends T ? true : false;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type IsFunction<T> = Function extends T ? true : false;
/**
 * Core utility to check if a type structurally behaves as a generic array.
 *
 * @typeParam T - The subject type under validation.
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IsArray<T> = Array<any> extends T ? true : false;
export type IsObject<T> = object extends T ? true : false;
/**
 * Validates whether a specific type is both an array and closely matches a targeted element type structure.
 *
 * @typeParam TArray - The subject array type under evaluation.
 * @typeParam TTarget - The structural target type to match against the extracted array element.
 *
 * @remarks
 * This conditional evaluation wraps checks into a single-element tuple `[ ... ]`
 * to bypass default TypeScript distributive conditional behavior on union types.
 *
 * @see {@link IsArray} for the structural array validator dependency.
 * @public
 */
export type IsArrayType<TArray, TTarget> = [IsArray<TTarget>, ArrayType<TArray, TTarget>] extends [true, TTarget]
  ? true
  : false;

/**
 * Checks if a boolean type can be null or undefined.
 *
 * Determines whether a boolean field is optional (nullable) in the database schema.
 * Used to select between nullable and non-nullable filter types.
 *
 * @template T - A boolean type, potentially union with null/undefined
 * @returns {boolean} true if T includes null or undefined, false for strict boolean
 *
 * @example
 * type A = IsNullableBoolean<boolean>;        // false
 * type B = IsNullableBoolean<boolean | null>; // true
 * type C = IsNullableBoolean<boolean | undefined>; // true
 *
 * @see {@linkcode BoolFilter} - Used when false
 * @see {@linkcode BoolNullableFilter} - Used when true
 */
export type IsNullableBoolean<T> = boolean extends T
  ? IsNullable<T> extends true
    ? true
    : false
  : false;

/**
 * Checks if an integer type can be null or undefined.
 *
 * Determines whether a numeric field is optional (nullable) in the database schema.
 * Used to select between nullable and non-nullable filter types.
 *
 * @template T - A number type, potentially union with null/undefined
 * @returns {boolean} true if T includes null or undefined, false for strict number
 *
 * @example
 * type A = IsNullableInt<number>;        // false
 * type B = IsNullableInt<number | null>; // true
 * type C = IsNullableInt<number | undefined>; // true
 *
 * @see {@linkcode IntFilter} - Used when false
 * @see {@linkcode IntNullableFilter} - Used when true
 */
export type IsNullableInt<T> = number extends T
  ? IsNullable<T> extends true
    ? true
    : false
  : false;

/**
 * Checks if a string type can be null or undefined.
 *
 * Determines whether a string field (including enums and IDs) is optional (nullable) in the database schema.
 * Used to select between nullable and non-nullable filter types.
 *
 * @template T - A string type, potentially union with null/undefined
 * @returns {boolean} true if T includes null or undefined, false for strict string
 *
 * @example
 * type A = IsNullableString<string>;        // false
 * type B = IsNullableString<string | null>; // true
 * type C = IsNullableString<string | undefined>; // true
 *
 * @see {@linkcode StringFilter} - Used when false
 * @see {@linkcode StringNullableFilter} - Used when true
 */
export type IsNullableString<T> = string extends T
  ? IsNullable<T> extends true
    ? true
    : false
  : false;

/**
 * Checks if a Date type can be null or undefined.
 *
 * Determines whether a DateTime field is optional (nullable) in the database schema.
 * Used to select between nullable and non-nullable filter types.
 *
 * @template T - A Date type, potentially union with null/undefined
 * @returns {boolean} true if T includes null or undefined, false for strict Date
 *
 * @example
 * type A = IsNullableDate<Date>;        // false
 * type B = IsNullableDate<Date | null>; // true
 * type C = IsNullableDate<Date | undefined>; // true
 *
 * @see {@linkcode DateTimeFilter} - Used when false
 * @see {@linkcode DateTimeNullableFilter} - Used when true
 */
export type IsNullableDate<T> = Date extends T
  ? IsNullable<T> extends true
    ? true
    : false
  : false;

/**
 * @summary Checks if an object contains a specific value type.
 *
 * This utility evaluates whether the provided object `T` has at least one property
 * whose value type matches (or is a subtype of) the target `Type`.
 *
 * - Checks across all object keys dynamically.
 * - Supports union types (e.g., checks if any property is `string | null`).
 * - Returns `true` if a match is found, otherwise `false`.
 *
 * Useful for conditional logic in complex types, such as determining if a
 * form state contains any "File" types or "Error" objects.
 *
 * @example
 * type User = { id: number; name: string; avatar: null };
 * type HasNull = ObjHasType<User, null>; // true
 * type HasBoolean = ObjHasType<User, boolean>; // false
 *
 * @template T - The source object to inspect. Must extend Record<string, any>.
 * @template Target - The value type to search for within the object's properties.
 */
export type ContainsType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string | number | symbol, any>,
  Target,
> = Target extends T[keyof T] ? true : false;

/**
 * @summary Checks if an object contains a property with an exact type match.
 *
 * Iterates through all properties of object `T` and performs a strict equality
 * check against `Target`. Unlike `extends`, this ensures that unions must
 * match perfectly (e.g., `string | null` will not match `string`).
 *
 * - Distinguishes between similar types (e.g., `any` vs `unknown`).
 * - Handles union types strictly.
 * - Prevents subtype matching (e.g., `true` is not equal to `boolean`).
 *
 * Used in strict type-guarding or when searching for specific wrapper types
 * that shouldn't be confused with their primitives.
 *
 * @example
 * type Data = { id: number; flag: true; };
 * type MatchTrue = ObjHasExactType<Data, true>;    // true
 * type MatchBool = ObjHasExactType<Data, boolean>; // false (because 'true' !== 'boolean')
 *
 * @template T - The object to scan.
 * @template Target - The exact type to look for.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContainsExactType<T extends Record<string, any>, Target> = true extends {
  [K in keyof T]: [Target, T[K]] extends [T[K], Target] ? true : false;
}[keyof T]
  ? true
  : false;

/**
 * Make a specific property required from a type (perhaps where it was previously optional), while keeping other properties as they are
 *
 * This is useful when you want to ensure that a certain property is always present in an object, while allowing other properties to remain optional.
 */
export type EnsureKey<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Alias for `EnsureKey` to make a specific property required from a type.
 */
export type RequireKeys<T, K extends keyof T> = EnsureKey<T, K>

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type Validator<T extends object> = Record<keyof T, ZodType>;

/**
 * Creates a type where if any of the `ConditionProps` are present on an object,
 * then all of the `RequiredProps` must also be present.
 *
 * @template T The base object type.
 * @template ConditionProps The conditional properties. If any of these exist, `RequiredProps` must also exist.
 * @template RequiredProps The properties that are required when a `ConditionProps` is present.
 *
 * @example
 * interface Fruit {
 *   color?: string;
 *   size?: number;
 *   name?: string;
 *   weight?: number;
 * }
 *
 * type ConditionalFruit = RequireWithDependency<Fruit, 'color' | 'size', 'name' | 'weight'>;
 *
 * const a: ConditionalFruit = { name: 'apple', weight: 150 }; // OK
 * const b: ConditionalFruit = { color: 'red', name: 'apple', weight: 150 }; // OK
 * const c: ConditionalFruit = { color: 'red' }; // Error: `name` and `weight` are missing
 */
export type RequireWithDependency<T, ConditionProps extends keyof T, RequiredProps extends keyof T> =
  | (Omit<T, ConditionProps> & { [P in ConditionProps]?: never })
  | (T & Required<Pick<T, RequiredProps>>);

export type FunctionLike<T extends unknown[] = never[], R = unknown> = (...args: T) => R
