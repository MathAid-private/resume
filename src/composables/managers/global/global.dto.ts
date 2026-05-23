import type { GLOBAL_ERROR_EVENT } from "@/constants/global-state.manager.const"
import type { PlatformErrorEvent } from "../manager.dto"

export type IGlobalEventMap = DocumentEventMap & {
  [GLOBAL_ERROR_EVENT]: PlatformErrorEvent
}
