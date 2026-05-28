<script setup>
// D3 branch tree.
//
// Two modes (toggled via `showAlternatives`):
//   - inline (during gameplay): solid path of visited nodes only, compact, vertical.
//   - life-over: visited path plus dashed stubs for every choice the player did not pick.
//     The dashed stubs are first-level only — we don't know where those branches would
//     have led (the LLM never generated them). That's the design from the original work
//     too: ghosts of paths not taken, not full alternate timelines.
//
// Layout: hand-rolled vertical layout instead of d3.tree(). The tree is essentially a
// trunk with optional 1-step side branches, so d3.tree's full layout pass is overkill
// and makes the alternate stubs hard to position predictably.

import { ref, watch, onMounted, nextTick } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  history: { type: Array, required: true },
  current: { type: Object, default: null },
  showAlternatives: { type: Boolean, default: false }
})

const svgEl = ref(null)

const COL_X = 120        // x of trunk
const ROW_H = 70         // px per node
const STUB_DX = 130      // horizontal offset for unpicked branch labels
const NODE_R = 8

function render() {
  if (!svgEl.value) return
  const svg = d3.select(svgEl.value)
  svg.selectAll('*').remove()

  // Build node list: visited history + (optional) current node as the live tip
  const nodes = props.history.map((h, i) => ({
    i,
    type: 'visited',
    label: h.node,
    year: h.year,
    age: h.age,
    choice: h.choice,
    alternatives: h.alternatives || []
  }))
  if (props.current && !props.showAlternatives) {
    nodes.push({
      i: nodes.length,
      type: 'current',
      label: props.current.title,
      year: `民國${props.current.year}年`,
      age: String(props.current.age),
      choice: '',
      alternatives: []
    })
  }

  if (nodes.length === 0) return

  const totalH = nodes.length * ROW_H + 80
  const totalW = props.showAlternatives ? COL_X * 2 + STUB_DX + 200 : COL_X * 2 + 200
  svg.attr('viewBox', `0 0 ${totalW} ${totalH}`).attr('width', '100%').attr('height', totalH)

  // Trunk lines (visited path)
  for (let i = 0; i < nodes.length - 1; i++) {
    const y1 = 40 + i * ROW_H
    const y2 = 40 + (i + 1) * ROW_H
    svg.append('line')
      .attr('x1', COL_X).attr('y1', y1)
      .attr('x2', COL_X).attr('y2', y2)
      .attr('stroke', 'var(--line)')
      .attr('stroke-width', 1.2)
  }

  // Nodes + labels
  nodes.forEach((n, idx) => {
    const y = 40 + idx * ROW_H

    // Year on the left
    svg.append('text')
      .attr('x', COL_X - 28).attr('y', y + 4)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--dim)')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 11)
      .text(`${n.year} ${n.age}歲`)

    // Diamond for decision points, circle for terminal
    const isLast = idx === nodes.length - 1
    if (isLast && props.showAlternatives) {
      svg.append('circle')
        .attr('cx', COL_X).attr('cy', y).attr('r', NODE_R)
        .attr('fill', 'var(--bg)').attr('stroke', 'var(--fg)').attr('stroke-width', 1.5)
    } else {
      svg.append('rect')
        .attr('x', COL_X - NODE_R).attr('y', y - NODE_R)
        .attr('width', NODE_R * 2).attr('height', NODE_R * 2)
        .attr('transform', `rotate(45 ${COL_X} ${y})`)
        .attr('fill', n.type === 'current' ? 'var(--bg)' : 'var(--fg)')
        .attr('stroke', 'var(--fg)').attr('stroke-width', 1.5)
    }

    // Node title + chosen choice on the right
    svg.append('text')
      .attr('x', COL_X + 22).attr('y', y - 2)
      .attr('fill', 'var(--fg)')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 12)
      .text(n.label)

    if (n.choice) {
      svg.append('text')
        .attr('x', COL_X + 22).attr('y', y + 14)
        .attr('fill', 'var(--dim)')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-size', 11)
        .text(`→ ${n.choice}`)
    }

    // Dashed stubs for paths not taken (LIFE OVER mode)
    if (props.showAlternatives && n.alternatives.length > 1) {
      const notPicked = n.alternatives.filter(a => !a.picked)
      const stubBaseX = COL_X
      const stubY = y
      // Lay them out fanning to the right; trim to 4 to keep readable
      notPicked.slice(0, 4).forEach((alt, k) => {
        const angle = -0.4 + k * 0.25
        const dx = STUB_DX
        const dy = Math.sin(angle) * 28
        const x2 = stubBaseX + dx
        const y2 = stubY + dy
        svg.append('line')
          .attr('x1', stubBaseX).attr('y1', stubY)
          .attr('x2', x2).attr('y2', y2)
          .attr('stroke', 'var(--line-faded)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3 3')
        svg.append('circle')
          .attr('cx', x2).attr('cy', y2).attr('r', 3)
          .attr('fill', 'none')
          .attr('stroke', 'var(--line-faded)')
        svg.append('text')
          .attr('x', x2 + 8).attr('y', y2 + 3)
          .attr('fill', 'var(--line-faded)')
          .attr('font-family', 'var(--font-mono)')
          .attr('font-size', 10)
          .text(alt.label)
      })
    }
  })
}

watch(() => [props.history, props.current, props.showAlternatives], () => {
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
  overflow-x: auto;
  padding: 0.5rem 0;
}
.branch-tree {
  display: block;
  min-width: 480px;
}
</style>
