import type { ICleanUp } from "../../manager.dto";
import type { useTabCount } from "./tab-count";
import type { useTabStore } from "./tab-store";

export enum TabCountTransactionType {
  INCR,
  DECR
}
export type TabStore<M extends object = Record<string, unknown>> = ReturnType<typeof useTabStore> & {
  metadata: M
};
export type TabCountOperative = ReturnType<typeof useTabCount>;
export type TabOperative<M extends object = Record<string, unknown>> = {
  store: TabStore<M>;
  getOrCreateTabId(): string;
};
export interface ITabCountStrategy<M extends object = Record<string, unknown>> {
  hide(tab: TabOperative<M>): Promise<unknown>;
  show(tab: TabOperative<M>): Promise<unknown>;
  bootstrap(tab: TabOperative<M>): ICleanUp;
}
export interface ITabCountTransaction<T>  {
    type: TabCountTransactionType;
    metadata?: ITabCountMetadata;
    payload: T;
}
export type ITabCountRequestParam = {
  /** The tab id for used for requesting a new tab */
  id: string;
}
export type ITabCountRequest = ITabCountTransaction<ITabCountRequestParam>
export interface ITabCountResponseData extends ITabCountRequestParam {
  /** The current number of open tabs */
  count: number;
  /** This is the index of the tab that was discontinued or pinged */
  index: number;
}
export interface ITabCountMetadata {
    /** Used for tracking this action for resolution of promise based requests/response */
    actionId?: string;
}
export type ITabCountResponse = ITabCountTransaction<ITabCountResponseData>
export type ITabCountError = ITabCountTransaction<{error: unknown}>
