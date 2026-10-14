// Ground surface types. Map geometry tags every collision triangle / heightfield cell with one of these ids.
// class: how tyre compounds react ('paved' | 'loose' | 'grass'), see Tire.js COMPOUNDS[*].affinity.
export const SURFACES = [
  { id: 0, key: 'asphalt', class: 'paved', friction: 1.0, rolling: 1.0, rough: 0.0, skid: true, sound: 'asphalt' },
  { id: 1, key: 'concrete', class: 'paved', friction: 0.97, rolling: 1.05, rough: 0.004, skid: true, sound: 'asphalt' },
  { id: 2, key: 'paint', class: 'paved', friction: 0.9, rolling: 1.0, rough: 0.0, skid: true, sound: 'asphalt' },
  { id: 3, key: 'curb', class: 'paved', friction: 0.95, rolling: 1.1, rough: 0.018, skid: true, sound: 'curb', rumble: 1 },
  { id: 4, key: 'cobble', class: 'paved', friction: 0.88, rolling: 1.3, rough: 0.012, skid: true, sound: 'asphalt', rumble: 0.4 },
  { id: 5, key: 'dirt', class: 'loose', friction: 0.7, rolling: 2.4, rough: 0.02, dust: [0.55, 0.45, 0.33], sound: 'gravel' },
  { id: 6, key: 'gravel', class: 'loose', friction: 0.64, rolling: 3, rough: 0.03, dust: [0.6, 0.58, 0.52], sound: 'gravel' },
  { id: 7, key: 'grass', class: 'grass', friction: 0.56, rolling: 4, rough: 0.025, dust: [0.28, 0.36, 0.16], sound: 'grass' },
  { id: 8, key: 'sand', class: 'loose', friction: 0.48, rolling: 9, rough: 0.02, dust: [0.76, 0.68, 0.5], sound: 'gravel' },
  { id: 9, key: 'metal', class: 'paved', friction: 0.85, rolling: 1.0, rough: 0.006, skid: true, sound: 'metal' },
  { id: 10, key: 'wood', class: 'paved', friction: 0.8, rolling: 1.2, rough: 0.01, skid: true, sound: 'asphalt' },
  { id: 11, key: 'puddle', class: 'paved', friction: 0.62, rolling: 1.6, rough: 0.0, skid: false, sound: 'water', splash: true },
];
export const SURFACE = Object.fromEntries(SURFACES.map((s) => [s.key, s.id]));
export const surfaceById = (id) => SURFACES[id] || SURFACES[0];
export function surfaceId(keyOrId) {
  if (typeof keyOrId === 'number') return SURFACES[keyOrId] ? keyOrId : 0;
  return SURFACE[keyOrId] ?? 0;
}
