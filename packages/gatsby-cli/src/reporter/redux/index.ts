import {
  createStore,
  combineReducers,
  AnyAction,
  Dispatch,
  CombinedState,
  Store,
} from "redux"
import { reducer, IState } from "./reducer"

import { ActivityTypes, Actions } from "../constants"

let store = createStore(
  combineReducers({
    logs: reducer,
  }),
  {}
)

type store = Store<CombinedState<{ logs: IState }>, AnyAction>

type storeListener = (store: store) => void

const storeSwapListeners: storeListener[] = []
const onLogActionListeners = new Set<Dispatch<AnyAction>>()

const isInternalAction = (action): boolean => {
  if (
    [
      Actions.PendingActivity,
      Actions.CancelActivity,
      Actions.ActivityErrored,
    ].includes(action.type)
  ) {
    return true
  }

  if ([Actions.StartActivity, Actions.EndActivity].includes(action.type)) {
    return action.payload.type === ActivityTypes.Hidden
  }

  return false
}

interface IIface {
  dispatch(dispatch: any)
  getStore: () => store
  onStoreSwap: (fn: storeListener) => void
  onLogAction: (fn: Dispatch<AnyAction>) => () => void
  setStore: (s: store) => void
}

export const iface: IIface = {
  getStore: () => store,
  dispatch: action => {
    if (!action) {
      return
    }

    if (Array.isArray(action)) {
      action.forEach(item => iface.dispatch(item))
      return
    } else if (typeof action === `function`) {
      action(iface.dispatch)
      return
    }

    action = {
      ...action,
      timestamp: new Date().toJSON(),
    }

    store.dispatch(action)

    if (isInternalAction(action)) {
      // consumers (ipc, yurnalist, json logger) shouldn't have to
      // deal with actions needed just for internal tracking of status
      return
    }
    for (const fn of onLogActionListeners) {
      fn(action)
    }
  },
  onStoreSwap: fn => {
    storeSwapListeners.push(fn)
  },
  onLogAction: fn => {
    onLogActionListeners.add(fn)
    return (): void => {
      onLogActionListeners.delete(fn)
    }
  },
  setStore: s => {
    s.dispatch({
      type: Actions.SetLogs,
      payload: store.getState().logs,
    })
    store = s
    storeSwapListeners.forEach(fn => fn(store))
  },
}
