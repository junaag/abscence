// Minimal interface -> engine bridge for the core gameplay vertical slice.
// Presentation code can start a session, dispatch a command, and render the
// returned snapshot without importing lower-level simulation modules.
export {
  createVerticalSliceState,
  dispatchVerticalSlice,
  getVerticalSliceSnapshot,
} from '../engine/vertical-slice';

export type {
  DestructibleKind,
  LocalPoint,
  VerticalSliceCommand,
  VerticalSliceEvent,
  VerticalSliceResult,
  VerticalSliceSnapshot,
  VerticalSliceState,
  VerticalSliceTransition,
} from '../engine/vertical-slice';
