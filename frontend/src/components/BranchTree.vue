<script setup>
// Top-down decision tree with orthogonal (elbow) connectors, modelled on the
// Mori Art Museum reference photo.
//
// Every history entry is a diamond. Two edges descend from each one:
//   - picked edge — solid: straight down, 90° turn toward child, straight
//     down to the next diamond. Label sits on the horizontal segment.
//   - unpicked edge — dashed: straight down, 90° turn outward, ending in a
//     hollow stub circle. Label sits on the horizontal segment. In LIFE OVER
//     mode (showAlternatives + onPickAlternative) the label is clickable.
//
// All segments are vertical or horizontal — no diagonals. Sizes are FIXED in
// pixels (not auto-fit by viewBox). When the tree is wider than the
// container the wrap scrolls horizontally — fonts stay readable.

import { ref, watch, onMounted, nextTick } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  history: { type: Array, required: true },
  current: { type: Object, default: null },
  showAlternatives: { type: Boolean, default: false },
  onPickAlternative: { type: Function, default: null }
})

const svgEl = ref(null)

const ROW_H = 170
const SHIFT = 220
const STUB_REACH = 200       // horizontal reach of a dashed stub
const STUB_DROP = 95         // vertical drop before the stub turns horizontal
const PICKED_TURN_AT = 0.55  // 0..1 — where the picked edge turns horizontal (% of ROW_H)
const D_SIZE = 11
const STUB_R = 7
const LABEL_H = 28
const LABEL_FONT = 13
const YEAR_FONT = 11
const PAD = 80
const MAX_LABEL_W = 180

function labelWidth(text) {
  let w = 0
  for (const ch of text) w += /[一-鿿　-〿]/.test(ch) ? 15 : 8
  return Math.max(70, Math.min(MAX_LABEL_W, w + 22))
}

function truncate(text, max) {
  if (!text) return ''
  let count = 0
  let out = ''
  for (const ch of text) {
    const isCjk = /[一-鿿　-〿]/.test(ch)
    const cost = isCjk ? 1 : 0.55
    if (count + cost > max) return out + '…'
    out += ch
    count += cost
  }
  return out
}

// Build an orthogonal path: vertical, horizontal, vertical (or horizontal).
//   pickedTurn(px, py, cx, cy, turnT) → "M px py V turnY H cx V cy"
//   stubElbow (px, py, ex, ey)        → "M px py V ey H ex"
function pickedPath(px, py, cx, cy, turnT) {
  const turnY = py + (cy - py) * turnT
  return `M ${px} ${py} V ${turnY} H ${cx} V ${cy}`
}
function stubPath(px, py, ex, ey) {
  return `M ${px} ${py} V ${ey} H ${ex}`
}

function render() {
  if (!svgEl.value) return
  const svg = d3.select(svgEl.value)
  svg.selectAll('*').remove()

  // Pass 1 — geometry.
  const decisions = []
  const edges = []
  const ghosts = []   // dimmed diamonds for abandoned RELIVE tails
  let x = 0
  let y = 0

  // Right-right-left-left zig-zag by depth — kept as a function so abandoned
  // branches can compute the same trunk direction at any depth.
  const trunkDir = (depth) => Math.floor(depth / 2) % 2 === 0 ? +1 : -1

  for (let i = 0; i < props.history.length; i++) {
    const h = props.history[i]
    decisions.push({ x, y, entry: h })
    const pickedDir = trunkDir(i)
    const nextX = x + pickedDir * SHIFT
    const nextY = y + ROW_H

    edges.push({
      kind: 'picked',
      px: x, py: y, cx: nextX, cy: nextY,
      // Label sits on the horizontal segment at turnY between x and nextX.
      labelX: (x + nextX) / 2,
      labelY: y + (nextY - y) * PICKED_TURN_AT,
      label: h.choice
    })

    // Render abandoned RELIVE tails as dimmed columns dropping off the
    // unpicked side. Each branch gets its own column so multiple relives at
    // the same fork stay visually distinct. When a branch exists, it replaces
    // the dashed clickable stub on that side (the player has already picked
    // that path — no point letting them re-relive into it).
    const branches = h.abandoned_branches || []
    let stubReplaced = false
    if (branches.length > 0) {
      const altDir = -pickedDir
      branches.forEach((branch, bIdx) => {
        const colX = x + altDir * (STUB_REACH + bIdx * SHIFT)
        // Elbow from fork down to column top.
        edges.push({
          kind: 'ghost-spine',
          px: x, py: y,
          cx: colX, cy: y + STUB_DROP,
          labelX: (x + colX) / 2,
          labelY: y + STUB_DROP,
          label: branch.from_choice_label || '原本走的路'
        })
        // Walk the tail entries straight down.
        for (let j = 0; j < branch.entries.length; j++) {
          const tailY = y + STUB_DROP + ROW_H * (j + 1)
          ghosts.push({ x: colX, y: tailY, label: branch.entries[j].choice })
          edges.push({
            kind: 'ghost-tail',
            px: colX, py: y + STUB_DROP + ROW_H * j,
            cx: colX, cy: tailY,
            labelX: colX,
            labelY: y + STUB_DROP + ROW_H * j + ROW_H * 0.55,
            label: branch.entries[j].choice
          })
        }
        // If the abandoned run ended in LIFE OVER, cap the column.
        if (branch.ending) {
          const tailLen = branch.entries.length
          ghosts.push({
            x: colX,
            y: y + STUB_DROP + ROW_H * tailLen + 8,
            kind: 'end-cap'
          })
        }
      })
      stubReplaced = true
    }

    if (!stubReplaced && props.showAlternatives && h.alternatives?.length >= 2) {
      const altDir = -pickedDir
      const stubEndX = x + altDir * STUB_REACH
      const stubEndY = y + STUB_DROP
      const altLabel = h.alternatives.find(a => !a.picked)?.label || '另一條路'
      edges.push({
        kind: 'unpicked',
        px: x, py: y, cx: stubEndX, cy: stubEndY,
        labelX: (x + stubEndX) / 2,
        labelY: stubEndY,
        label: altLabel,
        historyIndex: i,
        clickable: !!props.onPickAlternative
      })
    }

    x = nextX
    y = nextY
  }

  let tip = null
  if (props.current && !props.showAlternatives) {
    tip = { x, y, kind: 'current', node: props.current }
  } else if (props.showAlternatives && props.history.length > 0) {
    tip = { x, y, kind: 'end' }
  }

  // Pass 2 — bounding box (fixed pixels, no auto-shrink).
  const allXs = [
    ...decisions.map(p => p.x),
    ...edges.map(e => e.cx),
    ...ghosts.map(g => g.x),
    tip?.x ?? 0
  ]
  const allYs = [
    ...decisions.map(p => p.y),
    ...edges.map(e => e.cy),
    ...ghosts.map(g => g.y),
    tip?.y ?? 0
  ]
  if (allXs.length === 0) {
    svg.attr('width', 0).attr('height', 0)
    return
  }
  const minX = Math.min(...allXs) - MAX_LABEL_W / 2 - PAD
  const maxX = Math.max(...allXs) + MAX_LABEL_W / 2 + PAD
  const minY = Math.min(...allYs) - PAD
  const maxY = Math.max(...allYs) + PAD
  const W = Math.ceil(maxX - minX)
  const H = Math.ceil(maxY - minY)

  svg.attr('viewBox', `${minX} ${minY} ${W} ${H}`)
     .attr('width', W)
     .attr('height', H)
     .attr('preserveAspectRatio', 'xMinYMin meet')

  // Pass 3 — edges (drawn first so diamonds sit on top).
  for (const e of edges) {
    const isUnpicked = e.kind === 'unpicked'
    const isGhostSpine = e.kind === 'ghost-spine'
    const isGhostTail = e.kind === 'ghost-tail'
    const isGhost = isGhostSpine || isGhostTail
    const dimmed = isUnpicked || isGhost

    const d = isUnpicked || isGhostSpine
      ? stubPath(e.px, e.py, e.cx, e.cy)
      : isGhostTail
        ? `M ${e.px} ${e.py} V ${e.cy}`
        : pickedPath(e.px, e.py, e.cx, e.cy, PICKED_TURN_AT)

    svg.append('path')
      .attr('d', d)
      .attr('stroke', dimmed ? 'var(--line-faded)' : 'var(--fg)')
      .attr('stroke-width', dimmed ? 1.2 : 1.8)
      .attr('stroke-dasharray', dimmed ? '4 4' : null)
      .attr('stroke-linejoin', 'miter')
      .attr('fill', 'none')
      .attr('opacity', isGhost ? 0.7 : 1)

    if (isUnpicked) {
      svg.append('circle')
        .attr('cx', e.cx).attr('cy', e.cy).attr('r', STUB_R)
        .attr('fill', 'var(--bg)')
        .attr('stroke', 'var(--line-faded)')
        .attr('stroke-width', 1.2)
    }

    const text = truncate(e.label, dimmed ? 11 : 13)
    const w = labelWidth(text)

    const g = svg.append('g')
      .attr('transform', `translate(${e.labelX}, ${e.labelY})`)
      .attr('class', e.clickable ? 'edge-label clickable' : 'edge-label')
      .attr('opacity', isGhost ? 0.7 : 1)

    g.append('rect')
      .attr('x', -w / 2).attr('y', -LABEL_H / 2)
      .attr('width', w).attr('height', LABEL_H)
      .attr('fill', 'var(--bg)')
      .attr('stroke', dimmed ? 'var(--line-faded)' : 'var(--fg)')
      .attr('stroke-width', 1.2)

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', dimmed ? 'var(--dim)' : 'var(--fg)')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', LABEL_FONT)
      .text(text)

    if (e.clickable) {
      g.style('cursor', 'pointer')
      g.on('click', () => props.onPickAlternative(e.historyIndex))
    }
  }

  // Pass 3b — ghost diamonds (abandoned RELIVE tail decision points).
  for (const gh of ghosts) {
    if (gh.kind === 'end-cap') {
      svg.append('line')
        .attr('x1', gh.x - 14).attr('y1', gh.y)
        .attr('x2', gh.x + 14).attr('y2', gh.y)
        .attr('stroke', 'var(--line-faded)').attr('stroke-width', 1.5)
        .attr('opacity', 0.7)
      svg.append('text')
        .attr('x', gh.x).attr('y', gh.y + 18)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--dim)')
        .attr('font-family', 'var(--font-mono)').attr('font-size', YEAR_FONT)
        .attr('letter-spacing', 1.5)
        .attr('opacity', 0.7)
        .text('LIFE OVER')
      continue
    }
    svg.append('rect')
      .attr('x', gh.x - D_SIZE + 2).attr('y', gh.y - D_SIZE + 2)
      .attr('width', (D_SIZE - 2) * 2).attr('height', (D_SIZE - 2) * 2)
      .attr('transform', `rotate(45 ${gh.x} ${gh.y})`)
      .attr('fill', 'var(--bg)')
      .attr('stroke', 'var(--line-faded)')
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.7)
  }

  // Pass 4 — diamonds + year/age caption.
  for (const p of decisions) {
    svg.append('rect')
      .attr('x', p.x - D_SIZE).attr('y', p.y - D_SIZE)
      .attr('width', D_SIZE * 2).attr('height', D_SIZE * 2)
      .attr('transform', `rotate(45 ${p.x} ${p.y})`)
      .attr('fill', 'var(--fg)')
      .attr('stroke', 'var(--fg)')

    svg.append('text')
      .attr('x', p.x).attr('y', p.y - D_SIZE - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--dim)')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', YEAR_FONT)
      .text(`${p.entry.year} ・ ${p.entry.age}歲`)
  }

  // Pass 5 — tip.
  if (tip?.kind === 'current') {
    svg.append('rect')
      .attr('x', tip.x - D_SIZE).attr('y', tip.y - D_SIZE)
      .attr('width', D_SIZE * 2).attr('height', D_SIZE * 2)
      .attr('transform', `rotate(45 ${tip.x} ${tip.y})`)
      .attr('fill', 'var(--bg)').attr('stroke', 'var(--fg)').attr('stroke-width', 2)
    svg.append('text')
      .attr('x', tip.x).attr('y', tip.y + D_SIZE + 22)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--fg)')
      .attr('font-family', 'var(--font-mono)').attr('font-size', LABEL_FONT)
      .text(truncate(tip.node.title, 14))
  } else if (tip?.kind === 'end') {
    svg.append('line')
      .attr('x1', tip.x - 18).attr('y1', tip.y)
      .attr('x2', tip.x + 18).attr('y2', tip.y)
      .attr('stroke', 'var(--fg)').attr('stroke-width', 2.4)
    svg.append('text')
      .attr('x', tip.x).attr('y', tip.y + 26)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--dim)')
      .attr('font-family', 'var(--font-mono)').attr('font-size', YEAR_FONT)
      .attr('letter-spacing', 2)
      .text('LIFE OVER')
  }
}

watch(() => [props.history, props.current, props.showAlternatives, props.onPickAlternative], () => {
  nextTick(render)
}, { deep: true })

onMounted(() => render())
</script>

<template>
  <div class="branch-tree-wrap">
    <svg ref="svgEl" class="branch-tree" />
  </div>
</template>

<style scoped>
.branch-tree-wrap {
  width: 100%;
  overflow: auto;
  padding: 0.5rem 0;
}
.branch-tree {
  display: block;
}
.branch-tree :deep(.edge-label.clickable) rect {
  transition: stroke 0.15s, fill 0.15s;
}
.branch-tree :deep(.edge-label.clickable):hover rect {
  stroke: var(--fg);
  fill: var(--fg);
}
.branch-tree :deep(.edge-label.clickable):hover text {
  fill: var(--bg);
}
</style>
