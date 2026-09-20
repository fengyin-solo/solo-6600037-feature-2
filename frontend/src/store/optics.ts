import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ExperimentId = 'double' | 'single' | 'newton'
export type CriterionId = 'first-minimum' | '5percent' | 'fwhm' | 'custom'

export interface Criterion {
  id: CriterionId
  label: string
  /** 判定阈值：相对中央峰值的光强比 */
  threshold: number
}

/** 判定条件。first-minimum 与 fwhm 为理论定义；custom 为用户给定相对阈值 */
export const CRITERIA: Criterion[] = [
  { id: 'first-minimum', label: '第一暗纹（光强 ≈ 0）', threshold: 0 },
  { id: '5percent', label: '相对光强 5% 边界', threshold: 0.05 },
  { id: 'fwhm', label: '半高全宽 FWHM (50%)', threshold: 0.5 },
  { id: 'custom', label: '自定义相对光强', threshold: 0.1 },
]

export interface ParamSnapshot {
  wavelength: number
  slitWidth: number
  screenDistance: number
}

export interface CentralWidthRecord {
  id: string
  name: string
  /** 测量判定条件 */
  criterionId: CriterionId
  threshold: number
  /** 用户标记的有效边界（屏幕坐标 mm，相对中央） */
  leftX: number
  rightX: number
  /** 由边界得到的中央亮纹宽 mm */
  measuredWidth: number
  /** 该判定条件下的理论中央宽 mm */
  theoreticalWidth: number
  /** 与理论值的相对偏差 % */
  deviation: number
  params: ParamSnapshot
  createdAt: number
}

interface SingleMeasurementState {
  /** 中央亮区有效边界标记（屏幕坐标 mm，相对中央），至多 2 个 */
  boundaryPoints: number[]
  /** 打标记时的参数快照，用于保证标记与参数对得上 */
  markedParams: ParamSnapshot | null
  records: CentralWidthRecord[]
  /** 叠加显示在图上的记录 id */
  selectedRecordIds: string[]
}

interface ActionResult {
  ok: boolean
  message: string
}

/** 两次边界点视为重复的最小间隔（屏幕 mm） */
export const DUPLICATE_POINT_TOL = 0.1
/** 中央宽可测下限（mm），小于该值视为未达到可测阈值 */
export const MIN_MEASURABLE_WIDTH = 0.5

function sameParams(a: ParamSnapshot, b: ParamSnapshot) {
  return a.wavelength === b.wavelength && a.slitWidth === b.slitWidth && a.screenDistance === b.screenDistance
}

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref<ExperimentId>('double')
  const params = ref({ wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000 })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})

  /** 各实验独立保存的测量状态，来回切换后标记仍与对应参数对得上 */
  const singleMeasurements = ref<Record<string, SingleMeasurementState>>({})
  const criterionId = ref<CriterionId>('first-minimum')
  const customThreshold = ref(0.1)

  function emptyMeasurement(): SingleMeasurementState {
    return { boundaryPoints: [], markedParams: null, records: [], selectedRecordIds: [] }
  }

  const measurement = computed<SingleMeasurementState>(
    () => singleMeasurements.value[currentExperiment.value] ?? emptyMeasurement(),
  )

  const boundaryPoints = computed(() => measurement.value.boundaryPoints)
  const records = computed(() => measurement.value.records)
  const selectedRecordIds = computed(() => measurement.value.selectedRecordIds)
  const markedParams = computed(() => measurement.value.markedParams)

  /** 当前参数与打标记时参数是否一致 */
  const marksMatchParams = computed(() => {
    const snap = measurement.value.markedParams
    if (!snap) return true
    return sameParams(snap, currentParamsSnapshot())
  })

  const activeThreshold = computed(() => {
    if (criterionId.value === 'custom') return customThreshold.value
    return CRITERIA.find((c) => c.id === criterionId.value)!.threshold
  })

  function currentParamsSnapshot(): ParamSnapshot {
    return {
      wavelength: params.value.wavelength,
      slitWidth: params.value.slitWidth,
      screenDistance: params.value.screenDistance,
    }
  }

  function setExperiment(id: ExperimentId) { currentExperiment.value = id; compute() }

  function compute() {
    const { wavelength: lam, slitWidth: a, slitSeparation: d, screenDistance: L } = params.value
    const lambda = lam * 1e-9
    const aM = a * 1e-6
    const dM = d * 1e-6
    const LM = L * 1e-3
    const N = 800
    const data: number[] = []
    const xMax = 20e-3

    if (currentExperiment.value === 'double') {
      result.value.fringe = Math.round(lambda * LM / dM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const delta = Math.PI * dM * x / (lambda * LM)
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const single = Math.sin(beta) / beta
        const intensity = Math.cos(delta) ** 2 * single ** 2
        data.push(Math.max(0, intensity))
      }
    } else if (currentExperiment.value === 'single') {
      result.value.centralWidth = Math.round(2 * lambda * LM / aM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const intensity = (Math.sin(beta) / beta) ** 2
        data.push(Math.max(0, intensity))
      }
    } else { // newton
      const R = 1.0
      for (let i = 0; i < N; i++) {
        const r = (i / N) * 5e-3
        const path = r * r / (2 * R)
        const phi = 2 * Math.PI * path / lambda + Math.PI
        const intensity = 0.5 * (1 - Math.cos(phi))
        data.push(Math.max(0, intensity))
      }
    }

    intensityData.value = data
  }

  function ensureExperimentState(id: ExperimentId): SingleMeasurementState {
    if (!singleMeasurements.value[id]) {
      singleMeasurements.value[id] = emptyMeasurement()
    }
    return singleMeasurements.value[id]
  }

  /**
   * 在光强分布曲线上标记中央亮区边界（屏幕坐标 mm，相对中央）。
   * 至多 2 个有效边界；与已有边界点过近视为重复，不新增。
   */
  function addBoundaryPoint(xMm: number): ActionResult {
    const state = ensureExperimentState(currentExperiment.value)
    if (state.boundaryPoints.length >= 2) {
      return { ok: false, message: '已有两个有效边界，请先清除后再重新标记。' }
    }
    const duplicate = state.boundaryPoints.some((x) => Math.abs(x - xMm) < DUPLICATE_POINT_TOL)
    if (duplicate) {
      return { ok: false, message: `该位置与已有边界点几乎重合（容差 ${DUPLICATE_POINT_TOL} mm），请勿重复标记。` }
    }
    state.boundaryPoints.push(xMm)
    if (!state.markedParams) state.markedParams = currentParamsSnapshot()
    return { ok: true, message: `已标记边界 x = ${xMm.toFixed(2)} mm（${xMm < 0 ? '左' : '右'}）。` }
  }

  function clearBoundaryPoints(): ActionResult {
    const state = ensureExperimentState(currentExperiment.value)
    state.boundaryPoints = []
    state.markedParams = null
    return { ok: true, message: '已清除全部边界标记。' }
  }

  function setCriterion(id: CriterionId) { criterionId.value = id }
  function setCustomThreshold(v: number) { customThreshold.value = v }

  /**
   * 单缝衍射归一化光强 (sinβ/β)²，β = π a x / (λ L)，x 单位 mm。
   * 用于按判定阈值数值求解理论边界。
   */
  function singleIntensityAt(xMm: number, p: ParamSnapshot): number {
    const beta = (Math.PI * p.slitWidth * 1e-6 * xMm * 1e-3) / (p.wavelength * 1e-9 * p.screenDistance * 1e-3)
    if (Math.abs(beta) < 1e-12) return 1
    const s = Math.sin(beta) / beta
    return s * s
  }

  /** 在 [0, xMax] 内求 I(x)=t 的首个正根（相对中央的半宽，mm），二分法 */
  function solveHalfWidth(threshold: number, p: ParamSnapshot): number {
    // 中央峰内光强单调下降：threshold ∈ [0,1) 时根在第一暗纹 β=π 以内
    const xHalfDark = (p.wavelength * 1e-9 * p.screenDistance * 1e-3) / (p.slitWidth * 1e-6) * 1e3
    let lo = 0
    let hi = xHalfDark
    // threshold=0 时根即第一暗纹位置
    if (threshold <= 0) return xHalfDark
    // 数值兜底：若 hi 处光强仍高于阈值（理论上不会），向右扩
    for (let k = 0; k < 20 && singleIntensityAt(hi, p) > threshold; k++) hi *= 2
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2
      if (singleIntensityAt(mid, p) > threshold) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }

  /** 该判定条件下的理论中央宽 mm */
  function predictedWidth(p: ParamSnapshot = currentParamsSnapshot()): number {
    return 2 * solveHalfWidth(activeThreshold.value, p)
  }

  /** 依据当前两个边界 + 缝宽/波长/判定条件生成中央宽记录。任一条件不满足均不写入。 */
  function saveCentralRecord(name: string): ActionResult {
    const state = ensureExperimentState(currentExperiment.value)
    const trimmed = name.trim()

    if (state.boundaryPoints.length !== 2) {
      return { ok: false, message: '需要恰好两个有效边界点（左、右各一个）才能生成中央宽记录。' }
    }
    const sorted = [...state.boundaryPoints].sort((a, b) => a - b)
    const [x1, x2] = sorted
    if (!(x1 < 0 && x2 > 0)) {
      return { ok: false, message: '两个边界必须分居中央两侧（一正一负），请重新标记有效边界。' }
    }
    if (!state.markedParams || !sameParams(state.markedParams, currentParamsSnapshot())) {
      return { ok: false, message: '当前参数与标记边界时的参数不一致，标记已失效；请清除后按当前参数重新标记。' }
    }
    const width = x2 - x1
    if (width < MIN_MEASURABLE_WIDTH) {
      return { ok: false, message: `边界间距 ${width.toFixed(2)} mm 未达到可测阈值 ${MIN_MEASURABLE_WIDTH} mm，无法记录。` }
    }
    if (!trimmed) {
      return { ok: false, message: '记录名称不能为空。' }
    }
    if (state.records.some((r) => r.name === trimmed)) {
      // 命名冲突：不覆盖已有内容
      return { ok: false, message: `记录名称「${trimmed}」已存在，请换一个名称（不会覆盖已有记录）。` }
    }

    const snap = { ...state.markedParams }
    const threshold = activeThreshold.value
    const theoretical = 2 * solveHalfWidth(threshold, snap)
    const deviation = theoretical > 0 ? ((width - theoretical) / theoretical) * 100 : 0
    const record: CentralWidthRecord = {
      id: `rec-${Date.now()}-${Math.round(Math.abs(x1 * 1000))}-${Math.round(Math.abs(x2 * 1000))}`,
      name: trimmed,
      criterionId: criterionId.value,
      threshold,
      leftX: x1,
      rightX: x2,
      measuredWidth: Math.round(width * 100) / 100,
      theoreticalWidth: Math.round(theoretical * 100) / 100,
      deviation: Math.round(deviation * 10) / 10,
      params: snap,
      createdAt: Date.now(),
    }
    state.records.push(record)
    return { ok: true, message: `已保存「${trimmed}」：实测中央宽 ${record.measuredWidth.toFixed(2)} mm（理论 ${record.theoreticalWidth.toFixed(2)} mm）。` }
  }

  /** 删除记录；命名冲突式覆盖从未发生，这里仅按 id 删除 */
  function deleteRecord(id: string): ActionResult {
    const state = ensureExperimentState(currentExperiment.value)
    const before = state.records.length
    state.records = state.records.filter((r) => r.id !== id)
    state.selectedRecordIds = state.selectedRecordIds.filter((rid) => rid !== id)
    if (state.records.length === before) return { ok: false, message: '未找到该记录。' }
    return { ok: true, message: '已删除该记录。' }
  }

  function toggleRecordOverlay(id: string) {
    const state = ensureExperimentState(currentExperiment.value)
    const i = state.selectedRecordIds.indexOf(id)
    if (i >= 0) state.selectedRecordIds.splice(i, 1)
    else state.selectedRecordIds.push(id)
  }

  /** 默认记录名：中央宽N，且避开已有名称（不会覆盖已有内容） */
  function defaultRecordName(): string {
    const state = ensureExperimentState(currentExperiment.value)
    let n = state.records.length + 1
    let name = `中央宽${n}`
    while (state.records.some((r) => r.name === name)) {
      n += 1
      name = `中央宽${n}`
    }
    return name
  }

  return {
    currentExperiment,
    params,
    intensityData,
    result,
    // 中央亮纹测量辅助
    criterionId,
    customThreshold,
    boundaryPoints,
    records,
    selectedRecordIds,
    markedParams,
    marksMatchParams,
    activeThreshold,
    measurement,
    setExperiment,
    compute,
    addBoundaryPoint,
    clearBoundaryPoints,
    setCriterion,
    setCustomThreshold,
    predictedWidth,
    saveCentralRecord,
    deleteRecord,
    toggleRecordOverlay,
    defaultRecordName,
    currentParamsSnapshot,
  }
})
