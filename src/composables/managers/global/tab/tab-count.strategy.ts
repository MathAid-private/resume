import { markRaw } from "vue"

import { isNil } from "lodash"
import { v4 as uuidV4 } from "uuid";

import { TAB_COUNTER_CHANNEL, TAB_COUNTER_STORAGE_KEY, WORKER_ERROR, WORKER_PORT_ERROR } from "@/constants/global-state.manager.const"
import { TabCountTransactionType } from "./tab.types"

import type { FunctionLike } from "@/modules/util.dto"
import type {
  ITabCountError,
  ITabCountMetadata,
  ITabCountRequest,
  ITabCountResponse,
  ITabCountResponseData,
  TabOperative
} from "./tab.types"

import { stringToHash } from "@/libs/utils"
import { BasicError, PlatformErrorEvent } from "../../manager.dto"
import TabCountWorker from "./tab-count.worker?sharedworker"
import { useTabStore } from "./tab-store"

export type IWorkerStrategy = {
  worker?: InstanceType<typeof TabCountWorker>
}

export function useWorkerStrategy() {

  // ===================================================================
  // Lifecycle
  // ===================================================================
  ///////////////////////////// Init ////////////////////////////////
  function bootstrap(tab: TabOperative<IWorkerStrategy>) {
    // Set up message handler
    tab.store.metadata.worker = new TabCountWorker({
      name: TAB_COUNTER_CHANNEL
    })
    tab.store.metadata.worker.port.onmessage = event => captureResponse(event, tab)

    // Handle errors
    tab.store.metadata.worker.port.onmessageerror = (event) => {
      document.dispatchEvent(new PlatformErrorEvent(new BasicError({
        id: stringToHash(WORKER_PORT_ERROR),
        message: "[TAB_COUNT] A worker error occurred at port",
        cause: event.data,
      })))
    }

    tab.store.metadata.worker.onerror = (event) => {
      document.dispatchEvent(new PlatformErrorEvent(new BasicError({
        id: stringToHash(WORKER_ERROR),
        message: `[TAB_COUNT] Worker error:\n\nFile: ${event.filename}\nMessage: ${event.message}`,
        cause: event.error,
      })))
    }

    // Start the port
    tab.store.metadata.worker.port.start()

    return () => {
      const handles = Object.keys(tab.store.countCallbacks)
      for (const handle of handles) {
        delete tab.store.countCallbacks[handle]
      }
      tab.store.metadata.worker?.port.close()
      delete tab.store.metadata.worker
    }
  }
  function hide(tab: TabOperative) {
    return end(tab)
  }
  function show(tab: TabOperative) {
    return ping(tab)
  }
  /////////////////////////// Input capture /////////////////////////////
  function captureResponse(event: MessageEvent<ITabCountResponse | ITabCountError>, tab: TabOperative) {
    const { metadata, type, payload } = event.data

    processResponse(type, payload, tab, metadata)
  }
  ///////////////////////////// Process ////////////////////////////////
  function processResponse(
    type: TabCountTransactionType, payload: ITabCountResponseData | { error: unknown },
    tab: TabOperative,
    metadata?: ITabCountMetadata | undefined,
  ) {
    if (isNil(type)) {
      const msg = 'Type missing from response'
      if ('error' in payload) {
        throw payload.error
      }
      throw new Error(msg)
    } else if ('error' in payload) {
      if (isNil(metadata) || isNil(metadata.actionId)) throw payload.error
      const callback = tab.store.countCallbacks[`${metadata.actionId}-error`]
      if (callback) return callback(payload.error)
      throw payload.error
    }
    switch (type) {
      case TabCountTransactionType.DECR: {
        updateTabCount(payload as ITabCountResponseData, tab)
        break;
      }
      case TabCountTransactionType.INCR: {
        pong(payload as ITabCountResponseData, tab)
        break;
      }
      default:
        console.warn('[GlobalState] Unknown response type:', type)
    }
    if (!isNil(metadata) && !isNil(metadata.actionId)) {
      const callback = tab.store.countCallbacks[metadata.actionId]
      if (callback) return callback(payload)
    }
  }
  function updateTabCount(payload: ITabCountResponseData, tab: TabOperative) {
    tab.store.count = payload.count
  }
  function pong(payload: ITabCountResponseData, tab: TabOperative) {
    tab.store.count = payload.count
  }
  /////////////////////////// Actions & Interfaces ///////////////////////
  function postRequest(type: TabCountTransactionType, id: string, actionId: string, tab: TabOperative<IWorkerStrategy>) {
    tab.store.metadata.worker?.port.postMessage({
      payload: { id },
      type,
      metadata: { actionId }
    } as ITabCountRequest)
  }
  function ping(tab: TabOperative) {
    const actionId = uuidV4()
    const id = tab.getOrCreateTabId()
    const type = TabCountTransactionType.INCR
    return new Promise<ITabCountResponseData>((resolve, reject) => {
      registerTabIdentityPromise(actionId, tab, resolve, reject)

      postRequest(type, id, actionId, tab)
    })
  }
  function end(tab: TabOperative) {
    const actionId = uuidV4()
    const id = tab.getOrCreateTabId()
    const type = TabCountTransactionType.DECR
    return new Promise<ITabCountResponseData>((resolve, reject) => {
      registerTabIdentityPromise(actionId, tab, resolve, reject)

      postRequest(type, id, actionId, tab)
    })
  }
  // ===============================================================================
  // Setters
  // ===============================================================================
  function registerTabIdentityPromise(
    id: string,
    tab: TabOperative,
    resolve: (params: ITabCountResponseData) => unknown,
    reject: (params: unknown) => unknown,
  ) {
    tab.store.countCallbacks[id] =
      markRaw(((args) => {
        resolve(args as ITabCountResponseData)
        return unregisterTabIdentityPromise(id, tab)
      }) as FunctionLike<[unknown]>);
    tab.store.countCallbacks[`${id}-error`] =
      markRaw((args) => {
        reject(args)
        return unregisterTabIdentityPromise(id, tab)
      });
  }
  function unregisterTabIdentityPromise(id: string, tab: TabOperative) {
    delete tab.store.countCallbacks[`${id}-error`]
    delete tab.store.countCallbacks[id]
  }

  return {
    bootstrap,
    show,
    hide,
  }
}

export type IBroadcastStrategy = ISequentialStrategy & {
  channel?: BroadcastChannel;
}
export function useBroadcastStrategy() {
  // ===================================================================
  // Lifecycle
  // ===================================================================
  ///////////////////////////// Init ////////////////////////////////
  function bootstrap(tab: TabOperative<IBroadcastStrategy>) {
    tab.store.metadata.channel = new BroadcastChannel(TAB_COUNTER_CHANNEL)
    tab.store.metadata.channel.onmessageerror = (event) => {
      document.dispatchEvent(new PlatformErrorEvent(new BasicError({
        id: stringToHash(WORKER_PORT_ERROR),
        message: "[TAB_COUNT] A channel error occurred at port",
        cause: event.data,
      })))
    }
    tab.store.metadata.channel.onmessage =
      (event: MessageEvent<ITabCountResponse | ITabCountError>) => captureResponse(event, tab)
    tab.store.metadata.tabs = {}
    tab.store.metadata.danglingIndex = []
    tab.store.metadata.nextIndex = 0
    return () => {
      const handles = Object.keys(tab.store.countCallbacks)
      for (const handle of handles) {
        delete tab.store.countCallbacks[handle]
      }
      tab.store.metadata.channel?.close()
      delete tab.store.metadata.channel
      delete tab.store.metadata.tabs
      delete tab.store.metadata.danglingIndex
    }
  }
  function hide(tab: TabOperative<IBroadcastStrategy>) {
    return end(tab)
  }
  function show(tab: TabOperative<IBroadcastStrategy>) {
    return ping(tab)
  }
  /////////////////////////// Input capture /////////////////////////////
  function captureResponse(event: MessageEvent<ITabCountResponse | ITabCountError>, tab: TabOperative) {
    const { metadata, type, payload } = event.data

    processResponse(type, payload, tab, metadata)
  }
  ///////////////////////////// Process ////////////////////////////////
  function processResponse(
    type: TabCountTransactionType, payload: ITabCountResponseData | { error: unknown },
    tab: TabOperative,
    metadata?: ITabCountMetadata | undefined,
  ) {
    if (isNil(type)) {
      const msg = 'Type missing from response'
      if ('error' in payload) {
        throw payload.error
      }
      throw new Error(msg)
    } else if ('error' in payload) {
      if (isNil(metadata) || isNil(metadata.actionId)) throw payload.error
      const callback = tab.store.countCallbacks[`${metadata.actionId}-error`]
      if (callback) return callback(payload.error)
      throw payload.error
    }
    switch (type) {
      case TabCountTransactionType.DECR: {
        updateTabCount(payload as ITabCountResponseData, tab)
        break;
      }
      case TabCountTransactionType.INCR: {
        pong(payload as ITabCountResponseData, tab)
        break;
      }
      default:
        console.warn('[GlobalState] Unknown response type:', type)
    }
    if (!isNil(metadata) && !isNil(metadata.actionId)) {
      const callback = tab.store.countCallbacks[metadata.actionId]
      if (callback) return callback(payload)
    }
  }
  function updateTabCount(payload: ITabCountResponseData, tab: TabOperative) {
    tab.store.count = payload.count
  }
  function pong(payload: ITabCountResponseData, tab: TabOperative) {
    tab.store.count = payload.count
  }
  /////////////////////////// Actions & Interfaces ///////////////////////
  function postRequest(type: TabCountTransactionType, id: string, actionId: string, tab: TabOperative<IBroadcastStrategy>) {

    const request: ITabCountRequest = {
      payload: { id },
      type,
      metadata: { actionId }
    }

    switch(type) {
      case TabCountTransactionType.INCR:
        increment(request, tab)
        break
      case TabCountTransactionType.DECR:
        decrement(request, tab)
        break
    }

    // tab.store.metadata.worker?.port.postMessage( as ITabCountRequest)
  }
  function decrement(request: ITabCountRequest, tab: TabOperative<IBroadcastStrategy>) {
    const index = tab.store.metadata.tabs?.[request.payload.id]
    if(!isNil(index)) {
      delete tab.store.metadata.tabs?.[request.payload.id]
      tab.store.metadata.danglingIndex?.push(index)
      const response: ITabCountResponse = {
        payload: {
          count: Object.keys(tab.store.metadata.tabs||[]).length,
          index,
          id: request.payload.id
        },
        type: request.type,
        metadata: request.metadata
      }
      tab.store.metadata.channel?.postMessage(response)
    }
  }
  function increment(request: ITabCountRequest, tab: TabOperative<IBroadcastStrategy>) {
    let index = tab.store.metadata.tabs?.[request.payload.id]
    if(isNil(index)) {
      index = tab.store.metadata.danglingIndex?.shift() || tab.store.metadata.nextIndex!++
      tab.store.metadata![request.payload.id] = index
    }
    const response: ITabCountResponse = {
      payload: {
        count: Object.keys(tab.store.metadata.tabs||[]).length,
        index,
        id: request.payload.id
      },
      type: request.type,
      metadata: request.metadata
    }
    tab.store.metadata.channel?.postMessage(response)
  }
  function ping(tab: TabOperative) {
    const actionId = uuidV4()
    const id = tab.getOrCreateTabId()
    const type = TabCountTransactionType.INCR
    return new Promise<ITabCountResponseData>((resolve, reject) => {
      registerTabIdentityPromise(actionId, tab, resolve, reject)

      postRequest(type, id, actionId, tab)
    })
  }
  function end(tab: TabOperative) {
    const actionId = uuidV4()
    const id = tab.getOrCreateTabId()
    const type = TabCountTransactionType.DECR
    return new Promise<ITabCountResponseData>((resolve, reject) => {
      registerTabIdentityPromise(actionId, tab, resolve, reject)

      postRequest(type, id, actionId, tab)
    })
  }
  // ===============================================================================
  // Setters
  // ===============================================================================
  function registerTabIdentityPromise(
    id: string,
    tab: TabOperative,
    resolve: (params: ITabCountResponseData) => unknown,
    reject: (params: unknown) => unknown,
  ) {
    tab.store.countCallbacks[id] =
      markRaw(((args) => {
        resolve(args as ITabCountResponseData)
        return unregisterTabIdentityPromise(id, tab)
      }) as FunctionLike<[unknown]>);
    tab.store.countCallbacks[`${id}-error`] =
      markRaw((args) => {
        reject(args)
        return unregisterTabIdentityPromise(id, tab)
      });
  }
  function unregisterTabIdentityPromise(id: string, tab: TabOperative) {
    delete tab.store.countCallbacks[`${id}-error`]
    delete tab.store.countCallbacks[id]
  }

  return {
    bootstrap,
    hide,
    show
  }
}

export type ISequentialStrategy = {
  tabs?: Record<string, number>;
  nextIndex?: number;
  danglingIndex?: number[];
}

export function useSequentialStrategy() {
  function bootstrap(tab: TabOperative<ISequentialStrategy>) {
    tab.store.metadata.tabs = {}
    tab.store.metadata.nextIndex = 0
    tab.store.metadata.danglingIndex = []
    configureNotifications()
    console.log('bootstrapped')
    return () => {
      const tabHandles = Object.keys(tab.store.metadata.tabs!)
      for (const handle of tabHandles) {
        delete tab.store.metadata.tabs?.[handle]
      }
      delete tab.store.metadata.tabs
      tab.store.metadata.nextIndex = 0
      tab.store.metadata.danglingIndex?.splice(0, tab.store.metadata.danglingIndex.length)
      dismantleNotifications()
      console.log('cleaned-up')
    }
  }
  function hide(tab: TabOperative<ISequentialStrategy>) {
    return new Promise((resolve, reject) => {
      const req = JSON.parse(sessionStorage.getItem(TAB_COUNTER_STORAGE_KEY)!) as ITabCountResponse
      const id = req.payload.id
      const index = tab.store.metadata.tabs?.[id]
      if(isNil(index)) return reject(new Error(`[TabCount] Tab ${id} does not exist`))
      delete tab.store.metadata.tabs?.[id]
      tab.store.metadata.danglingIndex?.push(index)
      const response = {
        payload: {
          count: tab.store.count - 1,
          id,
          index,
        },
        type: TabCountTransactionType.DECR,
        metadata: {
          actionId: uuidV4()
        }
      }
      sessionStorage.setItem(TAB_COUNTER_STORAGE_KEY, JSON.stringify(response))
      registerTabIdentityPromise(response.metadata.actionId, tab, resolve, reject)
    console.log('hidden', resolve, reject)
    })
  }
  function show(tab: TabOperative<ISequentialStrategy>) {
    const id = tab.getOrCreateTabId()
    let index = tab.store.metadata.tabs?.[id]
    if(isNil(index)) {
      index = tab.store.metadata.danglingIndex?.shift() || tab.store.metadata.nextIndex!++
      tab.store.metadata![id] = index
    }
    return new Promise((resolve, reject) => {
      const response = {
        payload: {
          count: tab.store.count + (index ? 0 : 1),
          id,
          index,
        },
        type: TabCountTransactionType.INCR,
        metadata: {
          actionId: uuidV4()
        }
      }
      sessionStorage.setItem(TAB_COUNTER_STORAGE_KEY, JSON.stringify(response))
      registerTabIdentityPromise(response.metadata.actionId, tab, resolve, reject)
      console.log('show', resolve, reject)
    })
  }
  function configureNotifications() {
    window.addEventListener('storage', storageCallback)
  }
  function dismantleNotifications() {
    window.removeEventListener('storage', storageCallback)
  }
  function storageCallback(event: StorageEvent) {
    if(event.storageArea !== sessionStorage || event.key !== TAB_COUNTER_STORAGE_KEY) return
    const {
      oldValue, newValue
    } = event
    if(isNil(newValue)) return
    const [old, now]: [ITabCountResponse, ITabCountResponse] = [JSON.parse(oldValue || '{}'), JSON.parse(newValue)]

    const store = useTabStore() // Breaks best practice

    if ('error' in now.payload) {
      if (isNil(now.metadata) || isNil(now.metadata.actionId)) throw now.payload.error
      const callback = store.countCallbacks[`${now.metadata.actionId}-error`]
      if (callback) return callback(now.payload.error)
      throw now.payload.error
    } else if(old?.payload?.count !== now?.payload?.count) {
      store.count = now?.payload?.count || 0

      const cb = store.countCallbacks?.[now.metadata?.actionId || '']
      if(!isNil(cb)) {
        return cb(now.payload!)
      }
    }
  }
  // ===============================================================================
  // Setters
  // ===============================================================================
  function registerTabIdentityPromise(
    id: string,
    tab: TabOperative,
    resolve: (params: ITabCountResponseData) => unknown,
    reject: (params: unknown) => unknown,
  ) {
    tab.store.countCallbacks[id] =
      markRaw(((args) => {
        resolve(args as ITabCountResponseData)
        return unregisterTabIdentityPromise(id, tab)
      }) as FunctionLike<[unknown]>);
    tab.store.countCallbacks[`${id}-error`] =
      markRaw((args) => {
        reject(args)
        return unregisterTabIdentityPromise(id, tab)
      });
  }
  function unregisterTabIdentityPromise(id: string, tab: TabOperative) {
    delete tab.store.countCallbacks[`${id}-error`]
    delete tab.store.countCallbacks[id]
  }
  return {
    bootstrap,
    hide,
    show,
  }
}

