/** Imperative browser helpers without loading the React components. */
export { openReport, closeReport, selectArea, defaultHotkeys, display as displayHotkey, type Hotkeys, type OpenReportOptions } from '../react/hotkeys';
export { indexedDbDraftStore, type DraftStore, type SavedDraft } from '../react/draft';
export { captureArea, canCaptureTab, canRecordArea, cropRect, tabCapture, CAPTURE_KEEP_ALIVE_MS, type TabCapture, type Rect as ShipcueRect } from '../react/capture';
export type { AgentPromptAuth } from '../react/agentPrompt';
