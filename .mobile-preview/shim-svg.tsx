// react-native-svg shim for the screenshot harness.
// The real package's web build still reaches into react-native's Flow-typed
// internals, which esbuild cannot parse. VoiceSurface only needs five elements
// and they map 1:1 onto DOM SVG, so this renders them directly.
import { createElement } from 'react'
import type { ReactNode } from 'react'
const el = (tag: string) => ({ children, ...p }: any) =>
  createElement(tag, mapProps(tag, p), children as ReactNode)
function mapProps(tag: string, p: any) {
  // React already understands camelCase SVG attributes — pass them straight
  // through. Kebab-casing them is what produced "Invalid DOM property".
  const o: any = {}
  for (const [k, v] of Object.entries(p)) { if (v !== undefined) o[k] = v }
  if (tag === 'svg') { o['xmlns'] = 'http://www.w3.org/2000/svg'; if (o['width']) o['style'] = { ...(o['style']||{}), display:'block' } }
  return o
}
export const Svg = el('svg')
export const Defs = el('defs')
export const LinearGradient = el('linearGradient')
export const Rect = el('rect')
export const Stop = el('stop')
export const Path = el('path')
export const G = el('g')
export const Circle = el('circle')
export default Svg
