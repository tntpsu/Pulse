/**
 * Card registry — order here determines swipe order on glasses.
 *
 * To add a card: copy _template.ts, rename, implement, then import + append here.
 * To remove: delete the file and remove from the array.
 * To reorder: rearrange the array.
 */

import { calendarCard } from './calendar'
import { duckOpsApprovalsCard } from './duckops-approvals'
import { duckOpsInsightsCard } from './duckops-insights'
import { duckOpsPackQueueCard } from './duckops-pack-queue'
import { duckOpsSalesCard } from './duckops-sales'
import { duckOpsStuckCard } from './duckops-stuck'
import { duckOpsTopTasksCard } from './duckops-top-tasks'
import { duckOpsTrendsCard } from './duckops-trends'
import { githubCiCard } from './github-ci'
import { githubPrsCard } from './github-prs'
import { gmailCard } from './gmail'
import { nowPlayingCard } from './now-playing'
import { sportsCard } from './sports'
import { tasksCard } from './tasks'
import { todayCard } from './today'
import type { CardDefinition } from './_types'

export type { ActionResult, CardDefinition, PickerOption } from './_types'

export const CARDS: CardDefinition[] = [
  todayCard,
  sportsCard,
  duckOpsSalesCard,
  duckOpsPackQueueCard,
  duckOpsApprovalsCard,
  duckOpsStuckCard,
  duckOpsTopTasksCard,
  duckOpsTrendsCard,
  duckOpsInsightsCard,
  tasksCard,
  githubPrsCard,
  githubCiCard,
  gmailCard,
  nowPlayingCard,
  calendarCard,
]
