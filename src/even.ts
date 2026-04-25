import {
  CreateStartUpPageContainer,
  EventSourceType,
  LAUNCH_SOURCE_APP_MENU,
  LAUNCH_SOURCE_GLASSES_MENU,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'

const LEFT_ID = 1
const LEFT_NAME = 'left'
const RIGHT_ID = 2
const RIGHT_NAME = 'right'
const BRIDGE_TIMEOUT_MS = 4000

// Two-column layout on the 576x288 canvas:
//   LEFT:  x=0,   w=240  — clock/date/weather (stays in both dashboard & detail modes)
//   RIGHT: x=240, w=336  — active card summary or detail
const LEFT_WIDTH = 240
const RIGHT_X = 240
const RIGHT_WIDTH = 576 - RIGHT_X
const HEIGHT = 288

export type SwipeDirection = 'up' | 'down'
export type InputSource = 'glasses' | 'ring' | 'unknown'

// Subset of the SDK's DeviceStatus that we surface to main.ts. Numbers can be
// undefined when the firmware hasn't reported a value yet.
export interface DeviceStatusSnapshot {
  batteryLevel?: number
  isCharging?: boolean
  isWearing?: boolean
}

export type LaunchSourceKind = 'app-menu' | 'glasses-menu' | 'unknown'

export interface UserInfoSnapshot {
  name?: string
  avatar?: string
  country?: string
}

export interface EvenRuntime {
  render: (left: string, right: string) => Promise<void>
  renderDetail: (text: string) => Promise<void>
  onTap: (handler: (source: InputSource) => void) => void
  onSwipe: (handler: (dir: SwipeDirection, source: InputSource) => void) => void
  onDoubleTap: (handler: (source: InputSource) => void) => void
  onForeground: (handler: () => void) => void
  onDeviceStatus: (handler: (status: DeviceStatusSnapshot) => void) => void
  onLaunchSource: (handler: (kind: LaunchSourceKind) => void) => void
  // Modal picker — rebuilds the page to a full-screen list container and
  // resolves with the selected index (or null if the user double-taps to
  // cancel). After resolving, the original two-column layout is restored
  // with the content it had when the modal opened.
  openPicker: (header: string, options: string[]) => Promise<number | null>
  exitApp: () => Promise<void>
  // Native companion-app key/value storage. Survives WebView-kill cycles
  // more reliably than browser localStorage on iOS.
  getStorage: (key: string) => Promise<string>
  setStorage: (key: string, value: string) => Promise<boolean>
  getUserInfo: () => Promise<UserInfoSnapshot>
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Timed out waiting for the Even bridge')),
      timeoutMs,
    )
    promise.then(
      v => {
        window.clearTimeout(timer)
        resolve(v)
      },
      e => {
        window.clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export async function connectEvenRuntime(
  initialLeft: string,
  initialRight: string,
): Promise<EvenRuntime | null> {
  let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>
  try {
    bridge = await withTimeout(waitForEvenAppBridge(), BRIDGE_TIMEOUT_MS)
  } catch {
    return null
  }

  // Per glasses-ui skill: exactly one container must have isEventCapture: 1.
  // We put it on the RIGHT container since that's where swipes carry meaning
  // (changing cards or paging items).
  const leftText = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: LEFT_WIDTH,
    height: HEIGHT,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 6,
    containerID: LEFT_ID,
    containerName: LEFT_NAME,
    content: initialLeft,
    isEventCapture: 0,
  })
  const rightText = new TextContainerProperty({
    xPosition: RIGHT_X,
    yPosition: 0,
    width: RIGHT_WIDTH,
    height: HEIGHT,
    borderWidth: 1,
    borderColor: 8,
    borderRadius: 4,
    paddingLength: 6,
    containerID: RIGHT_ID,
    containerName: RIGHT_NAME,
    content: initialRight,
    isEventCapture: 1,
  })

  let dualOk = true
  const created = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [leftText, rightText],
    }),
  )
  if (created !== 0) {
    // Dual container failed. Fall back to a single full-screen container
    // and emulate two columns with stacked text. App keeps working either way.
    dualOk = false
    const combined = `${initialLeft}\n\n— — — — — — — — — — —\n\n${initialRight}`
    const single = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: HEIGHT,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 6,
      containerID: RIGHT_ID,
      containerName: RIGHT_NAME,
      content: combined,
      isEventCapture: 1,
    })
    const fallback = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [single],
      }),
    )
    if (fallback !== 0) return null
  }

  let lastLeftSent = initialLeft
  let lastLeftLen = initialLeft.length
  let lastRightSent = initialRight
  let lastRightLen = initialRight.length
  let lastCombinedSent = `${initialLeft}\n\n— — — — — — — — — — —\n\n${initialRight}`
  let lastCombinedLen = lastCombinedSent.length

  let busy = Promise.resolve()
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    // Serialize BLE writes — concurrent writes crash the connection.
    const next = busy.then(work, work)
    busy = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  async function writeLeft(text: string): Promise<void> {
    if (text === lastLeftSent) return
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: LEFT_ID,
        containerName: LEFT_NAME,
        contentOffset: 0,
        contentLength: Math.max(lastLeftLen, text.length),
        content: text,
      }),
    )
    lastLeftSent = text
    lastLeftLen = text.length
  }

  async function writeRight(text: string): Promise<void> {
    if (text === lastRightSent) return
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: RIGHT_ID,
        containerName: RIGHT_NAME,
        contentOffset: 0,
        contentLength: Math.max(lastRightLen, text.length),
        content: text,
      }),
    )
    lastRightSent = text
    lastRightLen = text.length
  }

  let tapHandler: ((source: InputSource) => void) | null = null
  let swipeHandler: ((dir: SwipeDirection, source: InputSource) => void) | null = null
  let doubleTapHandler: ((source: InputSource) => void) | null = null
  let foregroundHandler: (() => void) | null = null
  let deviceStatusHandler: ((status: DeviceStatusSnapshot) => void) | null = null
  let launchSourceHandler: ((kind: LaunchSourceKind) => void) | null = null
  // When non-null, a modal picker is open. All input events route through it
  // (list-tap = select, double-tap = cancel) instead of the normal handlers.
  let modalResolver: ((value: number | null) => void) | null = null

  bridge.onDeviceStatusChanged(status => {
    deviceStatusHandler?.({
      batteryLevel: status.batteryLevel,
      isCharging: status.isCharging,
      isWearing: status.isWearing,
    })
  })

  bridge.onLaunchSource(source => {
    let kind: LaunchSourceKind = 'unknown'
    if (source === LAUNCH_SOURCE_GLASSES_MENU) kind = 'glasses-menu'
    else if (source === LAUNCH_SOURCE_APP_MENU) kind = 'app-menu'
    launchSourceHandler?.(kind)
  })

  function classifySource(src: number | undefined): InputSource {
    if (src === EventSourceType.TOUCH_EVENT_FROM_RING) return 'ring'
    if (
      src === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L ||
      src === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R
    ) {
      return 'glasses'
    }
    return 'unknown'
  }

  bridge.onEvenHubEvent(event => {
    // Modal-open: list-tap = pick; double-tap = cancel. Everything else ignored.
    if (modalResolver) {
      if (event.listEvent) {
        const idx = event.listEvent.currentSelectItemIndex ?? 0
        const resolve = modalResolver
        modalResolver = null
        resolve(idx)
        return
      }
      if (event.sysEvent) {
        const t = event.sysEvent.eventType ?? 0
        if (t === OsEventTypeList.DOUBLE_CLICK_EVENT) {
          const resolve = modalResolver
          modalResolver = null
          resolve(null)
          return
        }
        if (t === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
          foregroundHandler?.()
          return
        }
      }
      return
    }
    if (event.textEvent) {
      const t = event.textEvent.eventType ?? 0
      if (t === OsEventTypeList.SCROLL_TOP_EVENT) swipeHandler?.('up', 'unknown')
      else if (t === OsEventTypeList.SCROLL_BOTTOM_EVENT) swipeHandler?.('down', 'unknown')
      return
    }
    if (event.sysEvent) {
      const t = event.sysEvent.eventType ?? 0
      const src = classifySource(event.sysEvent.eventSource)
      if (t === 0) {
        tapHandler?.(src)
        return
      }
      if (t === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        doubleTapHandler?.(src)
        return
      }
      if (t === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
        foregroundHandler?.()
        return
      }
    }
  })

  const HEADER_ID = 20
  const HEADER_NAME = 'pick_hdr'
  const LIST_ID = 21
  const LIST_NAME = 'pick_list'

  async function rebuildToNormal(): Promise<void> {
    if (dualOk) {
      const left = new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: LEFT_WIDTH, height: HEIGHT,
        borderWidth: 0, borderColor: 5, paddingLength: 6,
        containerID: LEFT_ID, containerName: LEFT_NAME,
        content: lastLeftSent, isEventCapture: 0,
      })
      const right = new TextContainerProperty({
        xPosition: RIGHT_X, yPosition: 0, width: RIGHT_WIDTH, height: HEIGHT,
        borderWidth: 1, borderColor: 8, borderRadius: 4, paddingLength: 6,
        containerID: RIGHT_ID, containerName: RIGHT_NAME,
        content: lastRightSent, isEventCapture: 1,
      })
      await bridge.rebuildPageContainer(new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [left, right],
      }))
      return
    }
    const single = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: 576, height: HEIGHT,
      borderWidth: 0, borderColor: 5, paddingLength: 6,
      containerID: RIGHT_ID, containerName: RIGHT_NAME,
      content: lastCombinedSent, isEventCapture: 1,
    })
    await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: 1,
      textObject: [single],
    }))
  }

  async function openPicker(header: string, options: string[]): Promise<number | null> {
    if (modalResolver) {
      // Already a modal up — reject new open to keep state sane.
      return null
    }
    const HEADER_H = 64
    const LIST_H = HEIGHT - HEADER_H
    const headerText = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: 576, height: HEADER_H,
      borderWidth: 0, borderColor: 5, paddingLength: 6,
      containerID: HEADER_ID, containerName: HEADER_NAME,
      content: header, isEventCapture: 0,
    })
    const listContainer = new ListContainerProperty({
      xPosition: 0, yPosition: HEADER_H, width: 576, height: LIST_H,
      borderWidth: 1, borderColor: 8, borderRadius: 4, paddingLength: 4,
      containerID: LIST_ID, containerName: LIST_NAME,
      itemContainer: new ListItemContainerProperty({
        itemCount: options.length,
        itemWidth: 0,
        isItemSelectBorderEn: 1,
        itemName: options,
      }),
      isEventCapture: 1,
    })
    return enqueue(async () => {
      await bridge.rebuildPageContainer(new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [headerText],
        listObject: [listContainer],
      }))
      try {
        return await new Promise<number | null>(resolve => {
          modalResolver = resolve
        })
      } finally {
        modalResolver = null
        await rebuildToNormal()
      }
    })
  }

  async function writeCombined(text: string): Promise<void> {
    if (text === lastCombinedSent) return
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: RIGHT_ID,
        containerName: RIGHT_NAME,
        contentOffset: 0,
        contentLength: Math.max(lastCombinedLen, text.length),
        content: text,
      }),
    )
    lastCombinedSent = text
    lastCombinedLen = text.length
  }

  return {
    render(left, right) {
      if (dualOk) {
        return enqueue(async () => {
          await writeLeft(left)
          await writeRight(right)
        })
      }
      // Single-container fallback: combine with divider.
      return enqueue(() => writeCombined(`${left}\n\n— — — — — — — — — — —\n\n${right}`))
    },
    renderDetail(text) {
      if (dualOk) return enqueue(() => writeRight(text))
      return enqueue(() => writeCombined(text))
    },
    onTap(handler) {
      tapHandler = handler
    },
    onSwipe(handler) {
      swipeHandler = handler
    },
    onDoubleTap(handler) {
      doubleTapHandler = handler
    },
    onForeground(handler) {
      foregroundHandler = handler
    },
    onDeviceStatus(handler) {
      deviceStatusHandler = handler
    },
    onLaunchSource(handler) {
      launchSourceHandler = handler
    },
    openPicker,
    async exitApp() {
      await bridge.shutDownPageContainer(1)
    },
    async getStorage(key) {
      try {
        return await bridge.getLocalStorage(key)
      } catch {
        return ''
      }
    },
    async setStorage(key, value) {
      try {
        return await bridge.setLocalStorage(key, value)
      } catch {
        return false
      }
    },
    async getUserInfo() {
      try {
        const u = await bridge.getUserInfo()
        return { name: u.name, avatar: u.avatar, country: u.country }
      } catch {
        return {}
      }
    },
  }
}
