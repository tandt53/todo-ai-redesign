// lucide-react-native shim for the screenshot harness.
// Same icon geometry as the real package (path data copied verbatim from
// lucide-react-native v1.31.0), rendered as DOM SVG so nothing pulls
// react-native's Flow-typed internals into the browser bundle.
import { createElement } from 'react'

const ICONS: Record<string, any[]> = {
  Undo2: [
  ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
  ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
],
  Check: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]],
  Plus: [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }]
],
  Mic: [
  ["path", { d: "M12 19v3", key: "npa21l" }],
  ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2", key: "1vc78b" }],
  ["rect", { x: "9", y: "2", width: "6", height: "13", rx: "3", key: "s6n7sd" }]
],
  MicOff: [
  ["path", { d: "M12 19v3", key: "npa21l" }],
  ["path", { d: "M15 9.34V5a3 3 0 0 0-5.68-1.33", key: "1gzdoj" }],
  ["path", { d: "M16.95 16.95A7 7 0 0 1 5 12v-2", key: "cqa7eg" }],
  ["path", { d: "M18.89 13.23A7 7 0 0 0 19 12v-2", key: "16hl24" }],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }],
  ["path", { d: "M9 9v3a3 3 0 0 0 5.12 2.12", key: "r2i35w" }]
],
  ArrowUp: [
  ["path", { d: "m5 12 7-7 7 7", key: "hav0vg" }],
  ["path", { d: "M12 19V5", key: "x0mq9r" }]
],
  Menu: [
  ["path", { d: "M4 5h16", key: "1tepv9" }],
  ["path", { d: "M4 12h16", key: "1lakjw" }],
  ["path", { d: "M4 19h16", key: "1djgab" }]
],
  WifiOff: [
  ["path", { d: "M12 20h.01", key: "zekei9" }],
  ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0", key: "1bycff" }],
  ["path", { d: "M5 12.859a10 10 0 0 1 5.17-2.69", key: "1dl1wf" }],
  ["path", { d: "M19 12.859a10 10 0 0 0-2.007-1.523", key: "4k23kn" }],
  ["path", { d: "M2 8.82a15 15 0 0 1 4.177-2.643", key: "1grhjp" }],
  ["path", { d: "M22 8.82a15 15 0 0 0-11.288-3.764", key: "z3jwby" }],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }]
],
}

const make = (name: string) => {
  const nodes = ICONS[name] ?? []
  const C = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...rest }: any) =>
    createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width: size, height: size,
      viewBox: '0 0 24 24', fill: 'none', stroke: color,
      strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { display: 'block' }, ...rest,
    }, ...nodes.map(([tag, attrs]: any, i: number) =>
      createElement(tag, { key: attrs.key ?? i, ...Object.fromEntries(
        Object.entries(attrs).filter(([k]) => k !== 'key'))})))
  C.displayName = name
  return C
}

export const Undo2 = make('Undo2')
export const Check = make('Check')
export const Plus = make('Plus')
export const Mic = make('Mic')
export const MicOff = make('MicOff')
export const ArrowUp = make('ArrowUp')
export const Menu = make('Menu')
export const WifiOff = make('WifiOff')
