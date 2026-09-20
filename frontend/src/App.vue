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
          <h3 class="text-sm font-bold text-slate-400 mb-3">光强分布曲线</h3>
          <canvas ref="intensityRef" class="w-full rounded" style="height: 200px; background: #0f172a;"
            :style="{ cursor: store.currentExperiment === 'single' ? 'crosshair' : 'default' }"
            @click="onIntensityClick"></canvas>
          <p v-if="store.currentExperiment === 'single'" class="text-xs text-slate-500 mt-2">点击曲线标记中央亮区左右边界（最多 2 点）</p>
        </div>
        <div v-if="store.currentExperiment === 'single'" class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
          <h3 class="text-sm font-bold text-slate-400">中央亮纹测量辅助</h3>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-slate-500">当前标记：</span>
            <span v-if="!store.marks.length" class="text-slate-600">暂无（在上方光强曲线上点击添加）</span>
            <span v-for="(m, i) in store.marks" :key="m.id"
              class="inline-flex items-center gap-1 bg-slate-900 border border-yellow-500/40 text-yellow-300 rounded px-2 py-0.5">
              边界{{ i + 1 }}: {{ m.position.toFixed(2) }} mm
              <button @click="store.removeMark(m.id)" class="text-slate-500 hover:text-red-400">✕</button>
            </span>
            <span v-if="store.marks.length === 2" class="text-cyan-300">
              标记宽度 = {{ (store.marks[1].position - store.marks[0].position).toFixed(2) }} mm
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select v-model="criterion" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300">
              <option v-for="opt in criterionOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
            </select>
            <input v-model="recordName" placeholder="记录名称（留空自动命名）"
              class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 w-44" />
            <button @click="onGenerateRecord"
              class="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded px-3 py-1 transition-colors">
              生成中央宽记录
            </button>
          </div>
          <div v-if="measureMsg"
            :class="['text-xs rounded px-2 py-1 border', measureMsg.ok ? 'bg-green-900/40 text-green-300 border-green-700' : 'bg-red-900/40 text-red-300 border-red-700']">
            {{ measureMsg.text }}
          </div>
          <div v-if="store.records.length" class="overflow-x-auto">
            <table class="w-full text-xs text-slate-300">
              <thead>
                <tr class="text-slate-500 border-b border-slate-700">
                  <th class="text-left py-1 pr-2">名称</th>
                  <th class="px-1">λ (nm)</th>
                  <th class="px-1">a (μm)</th>
                  <th class="px-1">L (mm)</th>
                  <th class="px-1">判定条件</th>
                  <th class="px-1">测量宽 (mm)</th>
                  <th class="px-1">理论宽 (mm)</th>
                  <th class="px-1">偏差 (%)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rec in store.records" :key="rec.name" class="border-b border-slate-800 text-center">
                  <td class="text-left py-1 pr-2 text-cyan-300">{{ rec.name }}</td>
                  <td>{{ rec.wavelength }}</td>
                  <td>{{ rec.slitWidth }}</td>
                  <td>{{ rec.screenDistance }}</td>
                  <td>{{ rec.criterionLabel }}</td>
                  <td class="text-yellow-300">{{ rec.measuredWidth.toFixed(2) }}</td>
                  <td>{{ rec.theoreticalWidth.toFixed(2) }}</td>
                  <td :class="Math.abs(rec.deviation) <= 5 ? 'text-green-400' : 'text-orange-400'">{{ rec.deviation.toFixed(2) }}</td>
                  <td><button @click="store.removeRecord(rec.name)" class="text-slate-500 hover:text-red-400">删除</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">2D 热力图</h3>
          <canvas ref="heatmapRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  useOpticsStore, CRITERION_LABELS, MIN_MEASURABLE_WIDTH_MM,
  type Criterion, type MarkFailure, type RecordFailure,
} from './store/optics'

const store = useOpticsStore()
const patternRef = ref<HTMLCanvasElement | null>(null)
const intensityRef = ref<HTMLCanvasElement | null>(null)
const heatmapRef = ref<HTMLCanvasElement | null>(null)

const criterion = ref<Criterion>('first-minimum')
const recordName = ref('')
const measureMsg = ref<{ ok: boolean; text: string } | null>(null)

const criterionOptions = (Object.keys(CRITERION_LABELS) as Criterion[]).map(id => ({ id, name: CRITERION_LABELS[id] }))

const MARK_ERROR_TEXT: Record<MarkFailure, string> = {
  'not-single': '仅单缝衍射实验支持边界标记',
  'limit': '最多标记 2 个边界点，请先删除已有标记',
  'duplicate': '边界点重复：该位置附近已有标记，未覆盖原标记',
}
const RECORD_ERROR_TEXT: Record<RecordFailure, string> = {
  'not-single': '仅单缝衍射实验支持生成中央宽记录',
  'need-two-marks': '需要先在光强曲线上标记左右两个边界点',
  'duplicate-boundary': '两个边界点重复，无法构成有效宽度',
  'below-threshold': `边界间距未达到可测阈值（≥ ${MIN_MEASURABLE_WIDTH_MM} mm），未生成记录`,
  'name-conflict': '记录名称已存在，未覆盖已有记录，请更换名称',
}

function onIntensityClick(e: MouseEvent) {
  if (store.currentExperiment !== 'single') return
  const canvas = intensityRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const pos = ((e.clientX - rect.left) / rect.width - 0.5) * 40 // 横轴 ±20 mm
  const res = store.addMark(pos)
  measureMsg.value = res.ok
    ? { ok: true, text: `已标记边界点：${(Math.round(pos * 100) / 100).toFixed(2)} mm` }
    : { ok: false, text: MARK_ERROR_TEXT[res.reason] }
}

function onGenerateRecord() {
  const res = store.generateRecord(recordName.value, criterion.value)
  if (res.ok) {
    measureMsg.value = { ok: true, text: `已生成「${res.record.name}」：测量宽 ${res.record.measuredWidth.toFixed(2)} mm，理论宽 ${res.record.theoreticalWidth.toFixed(2)} mm` }
    recordName.value = ''
  } else {
    measureMsg.value = { ok: false, text: RECORD_ERROR_TEXT[res.reason] }
  }
}

const experiments = [
  { id: 'double', name: '双缝干涉 (Young实验)' },
  { id: 'single', name: '单缝衍射 (Fraunhofer)' },
  { id: 'newton', name: '牛顿环干涉' },
]

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
  // 中央亮区边界标记（仅单缝衍射）
  if (store.currentExperiment === 'single') {
    const ms = store.marks
    if (ms.length === 2) {
      const x1 = (ms[0].position / 40 + 0.5) * W
      const x2 = (ms[1].position / 40 + 0.5) * W
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)'
      ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), H)
    }
    ms.forEach((m, i) => {
      const x = (m.position / 40 + 0.5) * W
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#facc15'; ctx.font = '11px monospace'
      ctx.textAlign = x > W / 2 ? 'right' : 'left'
      ctx.fillText(`边界${i + 1} ${m.position.toFixed(2)}mm`, x + (x > W / 2 ? -4 : 4), 14 + i * 13)
    })
    ctx.textAlign = 'center'
  }
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

onMounted(() => { store.compute(); setTimeout(renderAll, 100) })
watch(() => store.intensityData, () => renderAll(), { deep: true })
watch(() => store.marks, () => drawIntensity(), { deep: true })
</script>
