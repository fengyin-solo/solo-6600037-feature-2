import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type Criterion = 'first-minimum' | 'half-max' | 'threshold-5'

export interface BoundaryMark { id: number; position: number }

export interface CentralWidthRecord {
  name: string
  wavelength: number
  slitWidth: number
  screenDistance: number
  criterion: Criterion
  criterionLabel: string
  measuredWidth: number
  theoreticalWidth: number
  deviation: number
  createdAt: number
}

export const CRITERION_LABELS: Record<Criterion, string> = {
  'first-minimum': '一级暗纹 (2λL/a)',
  'half-max': '半高宽 FWHM',
  'threshold-5': '5% 强度阈值',
}

// 边界标记去重容差 / 可测阈值 / 标记上限（mm）
export const MARK_TOLERANCE_MM = 0.05
export const MIN_MEASURABLE_WIDTH_MM = 0.2
export const MAX_MARKS = 2

export type MarkFailure = 'not-single' | 'limit' | 'duplicate'
export type MarkResult = { ok: true } | { ok: false; reason: MarkFailure }
export type RecordFailure = 'not-single' | 'need-two-marks' | 'duplicate-boundary' | 'below-threshold' | 'name-conflict'
export type RecordResult = { ok: true; record: CentralWidthRecord } | { ok: false; reason: RecordFailure }

// 数值求解 (sinβ/β)^2 = level 的 β（二分法，第一暗纹前单调递减）
function solveBeta(level: number): number {
  let lo = 1e-6, hi = Math.PI - 1e-6
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if ((Math.sin(mid) / mid) ** 2 > level) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

const BETA_HALF = solveBeta(0.5)
const BETA_5PCT = solveBeta(0.05)

// 各判定条件下的理论中央宽（mm），与现有理论结果同源，不改写 compute()
function theoreticalWidthMm(criterion: Criterion, wavelengthNm: number, slitWidthUm: number, screenDistanceMm: number): number {
  const lambda = wavelengthNm * 1e-9
  const a = slitWidthUm * 1e-6
  const L = screenDistanceMm * 1e-3
  const base = lambda * L / a * 1e3 // λL/a，单位 mm
  if (criterion === 'first-minimum') return 2 * base
  if (criterion === 'half-max') return 2 * BETA_HALF / Math.PI * base
  return 2 * BETA_5PCT / Math.PI * base
}

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref('double')
  const params = ref({ wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000 })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})

  // 中央亮纹测量辅助：标记按「实验 + 相关参数」签名归档，
  // 在不同实验/参数间来回切换后，标记仍与对应参数一一对应
  const markMap = ref<Record<string, BoundaryMark[]>>({})
  const records = ref<CentralWidthRecord[]>([])
  let markId = 0

  const markKey = computed(() => {
    const p = params.value
    if (currentExperiment.value === 'single')
      return `single|${p.wavelength}|${p.slitWidth}|${p.screenDistance}`
    if (currentExperiment.value === 'double')
      return `double|${p.wavelength}|${p.slitWidth}|${p.slitSeparation}|${p.screenDistance}`
    return `newton|${p.wavelength}`
  })

  const marks = computed<BoundaryMark[]>(() => markMap.value[markKey.value] ?? [])

  function addMark(position: number): MarkResult {
    if (currentExperiment.value !== 'single') return { ok: false, reason: 'not-single' }
    const pos = Math.round(position * 100) / 100
    const list = markMap.value[markKey.value] ?? []
    if (list.length >= MAX_MARKS) return { ok: false, reason: 'limit' }
    if (list.some(m => Math.abs(m.position - pos) < MARK_TOLERANCE_MM)) return { ok: false, reason: 'duplicate' }
    const next = [...list, { id: ++markId, position: pos }].sort((a, b) => a.position - b.position)
    markMap.value = { ...markMap.value, [markKey.value]: next }
    return { ok: true }
  }

  function removeMark(id: number) {
    const list = markMap.value[markKey.value]
    if (!list) return
    markMap.value = { ...markMap.value, [markKey.value]: list.filter(m => m.id !== id) }
  }

  function generateRecord(rawName: string, criterion: Criterion): RecordResult {
    if (currentExperiment.value !== 'single') return { ok: false, reason: 'not-single' }
    const list = marks.value
    if (list.length < MAX_MARKS) return { ok: false, reason: 'need-two-marks' }
    const left = list[0].position
    const right = list[1].position
    if (Math.abs(right - left) < MARK_TOLERANCE_MM) return { ok: false, reason: 'duplicate-boundary' }
    const width = Math.round(Math.abs(right - left) * 100) / 100
    if (width < MIN_MEASURABLE_WIDTH_MM) return { ok: false, reason: 'below-threshold' }
    let name = rawName.trim()
    if (!name) {
      let i = records.value.length + 1
      name = `记录 ${i}`
      while (records.value.some(r => r.name === name)) name = `记录 ${++i}`
    }
    // 命名冲突：拒绝生成，不覆盖已有记录
    if (records.value.some(r => r.name === name)) return { ok: false, reason: 'name-conflict' }
    const p = params.value
    const theory = Math.round(theoreticalWidthMm(criterion, p.wavelength, p.slitWidth, p.screenDistance) * 100) / 100
    const record: CentralWidthRecord = {
      name,
      wavelength: p.wavelength,
      slitWidth: p.slitWidth,
      screenDistance: p.screenDistance,
      criterion,
      criterionLabel: CRITERION_LABELS[criterion],
      measuredWidth: width,
      theoreticalWidth: theory,
      deviation: theory === 0 ? 0 : Math.round((width - theory) / theory * 10000) / 100,
      createdAt: Date.now(),
    }
    records.value = [...records.value, record]
    return { ok: true, record }
  }

  function removeRecord(name: string) {
    records.value = records.value.filter(r => r.name !== name)
  }

  function setExperiment(id: string) { currentExperiment.value = id; compute() }

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

  return {
    currentExperiment, params, intensityData, result, setExperiment, compute,
    marks, records, addMark, removeMark, generateRecord, removeRecord,
  }
})
