<template>
  <div class="min-h-screen bg-slate-900 text-slate-200">
    <header class="border-b border-slate-700 px-6 py-4">
      <h1 class="text-2xl font-bold text-cyan-400">光学干涉衍射仿真实验台</h1>
      <p class="text-sm text-slate-500 mt-1">双缝干涉 · 单缝衍射 · 牛顿环 · 波长调节 · 光强热力图</p>
    </header>
    <div class="flex flex-col lg:flex-row gap-4 p-4">
      <div class="lg:w-1/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">实验类型</h3>
          <div class="space-y-1">
            <button v-for="exp in experiments" :key="exp.id" @click="store.setExperiment(exp.id)"
              :class="['w-full text-left p-2 rounded border text-sm transition-all', store.currentExperiment === exp.id ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 text-slate-300 hover:border-slate-500']">
              {{ exp.name }}
            </button>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h3 class="text-sm font-bold text-slate-400">参数调节</h3>
          <div>
            <label class="text-xs text-slate-500">波长 λ = {{ store.params.wavelength }} nm</label>
            <input type="range" min="380" max="780" step="5" v-model.number="store.params.wavelength" @input="store.compute" class="w-full accent-cyan-500" />
            <div class="flex justify-between text-xs mt-0.5">
              <span style="color:#8b5cf6">380</span><span style="color:#06b6d4">500</span><span style="color:#22c55e">550</span><span style="color:#eab308">600</span><span style="color:#dc2626">780</span>
            </div>
          </div>
          <div v-if="store.currentExperiment !== 'newton'">
            <label class="text-xs text-slate-500">缝宽/间距 d = {{ store.params.slitWidth }} μm</label>
            <input type="range" min="10" max="200" step="5" v-model.number="store.params.slitWidth" @input="store.compute" class="w-full accent-purple-500" />
          </div>
          <div v-if="store.currentExperiment === 'double'">
            <label class="text-xs text-slate-500">缝间距 D = {{ store.params.slitSeparation }} μm</label>
            <input type="range" min="50" max="500" step="10" v-model.number="store.params.slitSeparation" @input="store.compute" class="w-full accent-green-500" />
          </div>
          <div>
            <label class="text-xs text-slate-500">屏幕距离 L = {{ store.params.screenDistance }} mm</label>
            <input type="range" min="100" max="2000" step="50" v-model.number="store.params.screenDistance" @input="store.compute" class="w-full accent-orange-500" />
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 text-sm">
          <h3 class="text-sm font-bold text-slate-400 mb-3">理论公式</h3>
          <div class="space-y-2 text-xs text-slate-400">
            <div v-if="store.currentExperiment === 'double'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">双缝干涉</div>
              <div>亮纹: y = kλL/d (k=0,±1,±2...)</div>
              <div>条纹间距: Δy = λL/d</div>
              <div class="text-yellow-400 mt-1">Δy = {{ store.result.fringe?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'single'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">单缝衍射</div>
              <div>暗纹: a·sinθ = kλ</div>
              <div>中央亮纹宽: 2λL/a</div>
              <div class="text-yellow-400 mt-1">中央宽 = {{ store.result.centralWidth?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'newton'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">牛顿环</div>
              <div>暗环半径: r = √(nλR)</div>
              <div>R: 曲率半径</div>
            </div>
          </div>
        </div>
      </div>
      <div class="lg:w-3/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">干涉/衍射图样</h3>
          <canvas ref="patternRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">
            光强分布曲线
            <span v-if="store.currentExperiment === 'single'" class="ml-2 text-xs font-normal text-cyan-400">
              点击曲线标记中央亮区有效边界（左/右各一个）
            </span>
          </h3>
          <canvas ref="intensityRef"
            :class="['w-full rounded', { 'cursor-crosshair': store.currentExperiment === 'single' }]"
            style="height: 200px; background: #0f172a;"
            @click="onIntensityClick"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">2D 热力图</h3>
          <canvas ref="heatmapRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>

        <!-- 单缝衍射：中央亮纹测量辅助 -->
        <div v-if="store.currentExperiment === 'single'"
          class="bg-slate-800 rounded-lg p-4 border border-cyan-800/60 space-y-4">
          <div>
            <h3 class="text-sm font-bold text-cyan-400">中央亮纹测量辅助</h3>
            <p class="text-xs text-slate-500 mt-1">
              在上方光强曲线上点击，标记中央亮区的两个有效边界（分居中央两侧）；再选择判定条件并生成中央宽记录，可勾选多组结果对照。
            </p>
          </div>

          <!-- 边界状态 -->
          <div class="bg-slate-900 rounded p-3 text-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">已标记边界（{{ store.boundaryPoints.length }}/2）</span>
              <button @click="onClearMarks" :disabled="!store.boundaryPoints.length"
                class="px-2 py-0.5 rounded border border-slate-600 text-slate-300 disabled:opacity-40 hover:border-slate-400">
                清除标记
              </button>
            </div>
            <div v-if="!store.boundaryPoints.length" class="text-slate-500">尚未标记。请在曲线上点击左、右两个有效边界。</div>
            <ul v-else class="space-y-1 font-mono text-cyan-300">
              <li v-for="(x, i) in [...store.boundaryPoints].sort((a, b) => a - b)" :key="i">
                · {{ x < 0 ? '左边界' : '右边界' }}：x = {{ x.toFixed(2) }} mm
              </li>
            </ul>
            <div v-if="store.boundaryPoints.length === 2" class="text-slate-300 font-mono">
              标记间距：{{ measuredSpan.toFixed(2) }} mm
              <span v-if="measuredSpan < MIN_MEASURABLE_WIDTH" class="text-red-400">（低于可测阈值 {{ MIN_MEASURABLE_WIDTH }} mm）</span>
            </div>
            <div v-if="store.markedParams && !store.marksMatchParams" class="text-red-400">
              ⚠ 当前波长/缝宽/屏距与标记边界时（λ={{ store.markedParams.wavelength }}nm，
              a={{ store.markedParams.slitWidth }}μm，L={{ store.markedParams.screenDistance }}mm）不一致，
              请清除后按当前参数重新标记。
            </div>
          </div>

          <!-- 判定条件 -->
          <div class="bg-slate-900 rounded p-3 text-xs space-y-2">
            <div class="text-slate-400">判定条件（决定理论中央宽）</div>
            <select v-model="criterionSelect" @change="onCriterionChange"
              class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200">
              <option v-for="c in criteria" :key="c.id" :value="c.id">{{ c.label }}</option>
            </select>
            <div v-if="criterionSelect === 'custom'" class="space-y-1">
              <label class="text-slate-500">自定义相对光强阈值：{{ (customThresholdInput * 100).toFixed(0) }}%</label>
              <input type="range" min="1" max="90" step="1" v-model.number="customThresholdInput"
                @input="onCustomThresholdInput" class="w-full accent-cyan-500" />
            </div>
            <div class="text-yellow-400 font-mono">
              该条件理论中央宽 ≈ {{ store.predictedWidth().toFixed(2) }} mm
            </div>
          </div>

          <!-- 保存记录 -->
          <div class="bg-slate-900 rounded p-3 space-y-2">
            <div class="flex gap-2">
              <input v-model="recordName" type="text" placeholder="记录名称，如 中央宽1"
                class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200" />
              <button @click="recordName = store.defaultRecordName()"
                class="px-2 py-1 rounded border border-slate-600 text-xs text-slate-300 hover:border-slate-400 whitespace-nowrap">
                默认名称
              </button>
            </div>
            <button @click="onSave" :disabled="!canSave"
              class="w-full py-1.5 rounded bg-cyan-600 text-white text-sm font-bold disabled:opacity-40 hover:bg-cyan-500">
              生成中央宽记录
            </button>
            <p v-if="!canSave" class="text-[11px] text-slate-500">
              需满足：两个有效边界分居中央两侧 · 间距 ≥ 0.5 mm · 参数与标记时一致 · 名称不与已有记录冲突。
            </p>
          </div>

          <p v-if="message.text" :class="['text-xs', message.ok ? 'text-green-400' : 'text-red-400']">
            {{ message.text }}
          </p>

          <!-- 多组结果对照 -->
          <div v-if="store.records.length" class="bg-slate-900 rounded p-3 space-y-2">
            <div class="text-slate-400 text-xs">多组结果对照（勾选行叠加到曲线图）</div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-slate-300">
                <thead>
                  <tr class="text-slate-500 text-left">
                    <th class="py-1 pr-2">对照</th>
                    <th class="py-1 pr-2">名称</th>
                    <th class="py-1 pr-2">判定</th>
                    <th class="py-1 pr-2 text-right">实测/mm</th>
                    <th class="py-1 pr-2 text-right">理论/mm</th>
                    <th class="py-1 pr-2 text-right">偏差</th>
                    <th class="py-1 pr-2">参数 λ/a/L</th>
                    <th class="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rec in store.records" :key="rec.id"
                    :class="['border-t border-slate-800', store.selectedRecordIds.includes(rec.id) ? 'bg-cyan-900/20' : '']">
                    <td class="py-1 pr-2">
                      <input type="checkbox" :checked="store.selectedRecordIds.includes(rec.id)"
                        @change="store.toggleRecordOverlay(rec.id)" class="accent-cyan-500" />
                    </td>
                    <td class="py-1 pr-2 font-bold text-cyan-300">{{ rec.name }}</td>
                    <td class="py-1 pr-2 text-slate-400">{{ criterionLabel(rec.criterionId) }}<span v-if="rec.criterionId === 'custom'">{{ Math.round(rec.threshold * 100) }}%</span></td>
                    <td class="py-1 pr-2 text-right font-mono">{{ rec.measuredWidth.toFixed(2) }}</td>
                    <td class="py-1 pr-2 text-right font-mono text-slate-400">{{ rec.theoreticalWidth.toFixed(2) }}</td>
                    <td class="py-1 pr-2 text-right font-mono" :class="Math.abs(rec.deviation) <= 5 ? 'text-green-400' : 'text-yellow-400'">
                      {{ rec.deviation > 0 ? '+' : '' }}{{ rec.deviation.toFixed(1) }}%
                    </td>
                    <td class="py-1 pr-2 text-slate-500 font-mono text-[11px]">
                      {{ rec.params.wavelength }}/{{ rec.params.slitWidth }}/{{ rec.params.screenDistance }}
                    </td>
                    <td class="py-1 text-right">
                      <button @click="onDelete(rec.id)" class="text-red-400 hover:text-red-300 text-[11px]">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useOpticsStore, CRITERIA, type CriterionId, type ExperimentId, type CentralWidthRecord, MIN_MEASURABLE_WIDTH } from './store/optics'

const store = useOpticsStore()
const patternRef = ref<HTMLCanvasElement | null>(null)
const intensityRef = ref<HTMLCanvasElement | null>(null)
const heatmapRef = ref<HTMLCanvasElement | null>(null)

const experiments: { id: ExperimentId; name: string }[] = [
  { id: 'double', name: '双缝干涉 (Young实验)' },
  { id: 'single', name: '单缝衍射 (Fraunhofer)' },
  { id: 'newton', name: '牛顿环干涉' },
]

// 中央亮纹测量辅助的本地界面状态
const criteria = CRITERIA
const criterionSelect = ref<CriterionId>(store.criterionId)
const customThresholdInput = ref(Math.round(store.customThreshold * 100))
const recordName = ref('')
const message = ref<{ ok: boolean; text: string }>({ ok: false, text: '' })

/** 光强曲线 x 轴范围（与 store.compute 的 xMax 一致），单位 mm */
const X_MAX_MM = 20

/** 屏幕坐标 mm（相对中央）→ 曲线 canvas 像素 x */
function xMmToCanvas(xMm: number, W: number) {
  return (xMm / (2 * X_MAX_MM) + 0.5) * W
}
/** 曲线 canvas 像素 x → 屏幕坐标 mm（相对中央） */
function canvasToXMm(px: number, W: number) {
  return (px / W - 0.5) * 2 * X_MAX_MM
}

const sortedMarks = computed(() => [...store.boundaryPoints].sort((a, b) => a - b))
const measuredSpan = computed(() =>
  sortedMarks.value.length === 2 ? sortedMarks.value[1] - sortedMarks.value[0] : 0)

const canSave = computed(() => {
  if (store.currentExperiment !== 'single') return false
  if (store.boundaryPoints.length !== 2 || !store.marksMatchParams) return false
  if (measuredSpan.value < MIN_MEASURABLE_WIDTH) return false
  if (!(sortedMarks.value[0] < 0 && sortedMarks.value[1] > 0)) return false
  return recordName.value.trim().length > 0
})

function criterionLabel(id: CriterionId) {
  return criteria.find((c) => c.id === id)?.label ?? id
}

function flash(ok: boolean, text: string) {
  message.value = { ok, text }
}

function onCriterionChange() {
  store.setCriterion(criterionSelect.value)
  renderAll()
}

function onCustomThresholdInput() {
  store.setCustomThreshold(customThresholdInput.value / 100)
  renderAll()
}

function onIntensityClick(e: MouseEvent) {
  if (store.currentExperiment !== 'single') return
  const canvas = intensityRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const px = e.clientX - rect.left
  const xMm = Math.round(canvasToXMm(px, canvas.clientWidth) * 100) / 100
  const res = store.addBoundaryPoint(xMm)
  flash(res.ok, res.message)
  renderAll()
}

function onClearMarks() {
  const res = store.clearBoundaryPoints()
  flash(res.ok, res.message)
  renderAll()
}

function onSave() {
  const res = store.saveCentralRecord(recordName.value)
  flash(res.ok, res.message)
  if (res.ok) {
    recordName.value = store.defaultRecordName()
  }
  renderAll()
}

function onDelete(id: string) {
  const res = store.deleteRecord(id)
  flash(res.ok, res.message)
  renderAll()
}

/** 在曲线上绘制一条带标签的竖线（边界标记/记录对照） */
function drawVerticalMarker(
  ctx: CanvasRenderingContext2D,
  xPx: number,
  H: number,
  color: string,
  label: string,
  dashed: boolean,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.setLineDash(dashed ? [5, 4] : [])
  ctx.beginPath(); ctx.moveTo(xPx, 0); ctx.lineTo(xPx, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = color
  ctx.font = '10px monospace'
  ctx.textAlign = xPx > ctx.canvas.width - 70 ? 'right' : 'left'
  ctx.fillText(label, xPx + (xPx > ctx.canvas.width - 70 ? -3 : 3), 12)
  ctx.restore()
}

/** 单缝模式下叠加：草稿边界 + 当前判定理论边界 + 已勾选的对照记录 */
function drawSingleOverlays(ctx: CanvasRenderingContext2D, W: number, H: number) {
  if (store.currentExperiment !== 'single') return

  // 对照记录（虚线，琥珀色）；参数与当前不一致的用灰色提示
  store.records.forEach((rec: CentralWidthRecord) => {
    if (!store.selectedRecordIds.includes(rec.id)) return
    const sameAsCurrent =
      rec.params.wavelength === store.params.wavelength &&
      rec.params.slitWidth === store.params.slitWidth &&
      rec.params.screenDistance === store.params.screenDistance
    const color = sameAsCurrent ? '#f59e0b' : '#64748b'
    drawVerticalMarker(ctx, xMmToCanvas(rec.leftX, W), H, color, `${rec.name}L`, true)
    drawVerticalMarker(ctx, xMmToCanvas(rec.rightX, W), H, color, `${rec.name}R`, true)
  })

  // 当前判定条件下的理论边界（黄色点线）
  const half = store.predictedWidth() / 2
  drawVerticalMarker(ctx, xMmToCanvas(-half, W), H, '#eab308', '理L', true)
  drawVerticalMarker(ctx, xMmToCanvas(half, W), H, '#eab308', '理R', true)

  // 草稿边界（青色实线 + 曲线上的圆点）
  const data = store.intensityData
  store.boundaryPoints.forEach((xMm) => {
    const xPx = xMmToCanvas(xMm, W)
    drawVerticalMarker(ctx, xPx, H, '#22d3ee', `${xMm.toFixed(1)}`, false)
    const idx = Math.round(((xMm / (2 * X_MAX_MM)) + 0.5) * (data.length - 1))
    const v = data[Math.min(data.length - 1, Math.max(0, idx))] ?? 0
    const y = H - v * (H - 10) - 5
    ctx.beginPath()
    ctx.fillStyle = '#22d3ee'
    ctx.arc(xPx, y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0e7490'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })
}

function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1.0 }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1.0 }
  else if (nm >= 490 && nm < 510) { g = 1.0; b = -(nm - 510) / 20 }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1.0 }
  else if (nm >= 580 && nm < 645) { r = 1.0; g = -(nm - 645) / 65 }
  else if (nm >= 645 && nm <= 780) { r = 1.0 }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function drawPattern() {
  const canvas = patternRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = data[idx] || 0
    const alpha = Math.min(1, intensity)
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(x, 0, 1, H)
  }
}

function drawIntensity() {
  const canvas = intensityRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, H)
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  ctx.beginPath()
  ctx.strokeStyle = `rgb(${r},${g},${b})`
  ctx.lineWidth = 2
  data.forEach((v, i) => {
    const x = i / (data.length - 1) * W
    const y = H - v * (H - 10) - 5
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  // Fill
  ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()
  // Axes
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText('0', W / 2, H - 2); ctx.fillText('光强 I', 30, 12); ctx.fillText('位置 x', W - 20, H - 2)

  // 单缝衍射：在不改变原曲线的前提下叠加测量标记
  drawSingleOverlays(ctx, W, H)
}

function drawHeatmap() {
  const canvas = heatmapRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  const imgData = ctx.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = Math.min(1, data[idx] || 0)
    for (let y = 0; y < H; y++) {
      const dist = Math.abs(y - H / 2) / (H / 2)
      const alpha = intensity * (1 - dist * 0.8) * 255
      const pos = (y * W + x) * 4
      imgData.data[pos] = r; imgData.data[pos + 1] = g; imgData.data[pos + 2] = b; imgData.data[pos + 3] = alpha
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

function renderAll() { drawPattern(); drawIntensity(); drawHeatmap() }

onMounted(() => {
  store.compute()
  recordName.value = store.defaultRecordName()
  setTimeout(renderAll, 100)
})
watch(() => store.intensityData, () => renderAll(), { deep: true })
// 标记/对照记录/判定条件变化时刷新曲线叠加；切换实验后各实验的标记仍按其参数恢复
watch(
  () => [store.boundaryPoints, store.records, store.selectedRecordIds] as const,
  () => renderAll(),
  { deep: true },
)
watch(() => store.currentExperiment, () => {
  criterionSelect.value = store.criterionId
  customThresholdInput.value = Math.round(store.customThreshold * 100)
  message.value = { ok: false, text: '' }
  if (!recordName.value.trim()) recordName.value = store.defaultRecordName()
})
</script>
