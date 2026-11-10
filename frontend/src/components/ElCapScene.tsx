import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ELCAP } from './elcapTerrain'

/** Anything with a `.get()` that returns scroll progress from 0 to 1 (a Motion value fits). */
interface Progress {
  get: () => number
}

const SIZE = 36 // world units across the block; 1 unit = 100 m
const GRID = 64 // low-poly resolution (the source grid is finer)
const HEIGHT = (ELCAP.maxM - ELCAP.minM) / 100 * 1.12 // slight vertical exaggeration
const BASE_DEPTH = 2.4

// Deterministic pseudo-random numbers so the scene looks the same on every visit.
function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const smooth = (lo: number, hi: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/** A stylised Merced River: real one is too narrow to read at this scale, so it gets a hand-drawn path. */
const RIVER: [number, number][] = [[-19, 13.6], [-11, 12.3], [-4, 13.9], [3, 12.5], [10, 14.3], [19, 13.1]]
function riverDistance(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1]
    const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)))
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))))
  }
  return best
}

function decodeHeights(): Uint16Array {
  const bin = atob(ELCAP.data)
  const out = new Uint16Array(bin.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)
  return out
}

const WATER_Y = 0.2

function buildTerrain() {
  const raw = decodeHeights()
  const n = ELCAP.n
  const rawAt = (i: number, j: number) => (raw[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] / 65535) * HEIGHT

  // Vertex grid: positions (with a little jitter so facets aren't a perfect checkerboard) and heights.
  const px = new Float32Array(GRID * GRID), py = new Float32Array(GRID * GRID), pz = new Float32Array(GRID * GRID)
  const cell = SIZE / (GRID - 1)
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const k = j * GRID + i
      const edge = i === 0 || j === 0 || i === GRID - 1 || j === GRID - 1
      const jx = edge ? 0 : (hash(i, j) - 0.5) * cell * 0.5
      const jz = edge ? 0 : (hash(j, i + 7) - 0.5) * cell * 0.5
      const x = (i / (GRID - 1) - 0.5) * SIZE + jx
      const z = (j / (GRID - 1) - 0.5) * SIZE + jz
      const gi = ((x / SIZE + 0.5) * (n - 1)), gj = ((z / SIZE + 0.5) * (n - 1))
      let y = rawAt(Math.round(gi), Math.round(gj))
      // Flatten the far south edge (the start of the opposite valley wall) so it doesn't block the view.
      const front = smooth(10.5, 15, z)
      y = y * (1 - front) + Math.min(y, 0.45 + noise(x * 0.4, z * 0.4) * 0.25) * front
      // Let the high ground roll down to the rim on the other three sides. A straight cut through the
      // plateau leaves a tall bare wall of "soil" behind El Cap; this makes the back a forested hillside.
      const rim = smooth(-18, -5, z) * smooth(-18, -10.5, x) * (1 - smooth(10.5, 18, x))
      const foot = 0.5 + noise(x * 0.3 + 9, z * 0.3) * 0.5
      y = foot + Math.max(0, y - foot) * rim
      // Carve the river bed.
      const d = riverDistance(x, z)
      if (d < 1.15) y = Math.min(y, WATER_Y - 0.22 * (1 - d / 1.15) + 0.05)
      else y = Math.max(y, WATER_Y + 0.12)
      px[k] = x; py[k] = y; pz[k] = z
    }
  }

  const heightAt = (x: number, z: number): number => {
    const fi = Math.min(GRID - 1.001, Math.max(0, (x / SIZE + 0.5) * (GRID - 1)))
    const fj = Math.min(GRID - 1.001, Math.max(0, (z / SIZE + 0.5) * (GRID - 1)))
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j
    const k = j * GRID + i
    return (py[k] * (1 - u) + py[k + 1] * u) * (1 - v) + (py[k + GRID] * (1 - u) + py[k + GRID + 1] * u) * v
  }
  const slopeAt = (x: number, z: number): number => {
    const e = cell * 0.6
    const dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e)
    return (2 * e) / Math.hypot(dx, dz, 2 * e) // 1 = flat, 0 = vertical
  }

  // Non-indexed triangles: every face owns its vertices, which gives the flat, faceted look.
  const positions: number[] = [], colors: number[] = []
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3()
  const col = new THREE.Color(), tmp = new THREE.Color()
  const face = (k1: number, k2: number, k3: number) => {
    a.set(px[k1], py[k1], pz[k1]); b.set(px[k2], py[k2], pz[k2]); c.set(px[k3], py[k3], pz[k3])
    nrm.copy(b).sub(a).cross(tmp3.copy(c).sub(a)).normalize()
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3
    const h = cy / HEIGHT
    const r = hash(k1 * 0.37 + k3, k2 * 0.11)
    if (nrm.y < 0.66) {
      // Granite: cool grey low down, warming to alpenglow gold toward the rim, with darker water streaks.
      col.set('#8f949e').lerp(tmp.set('#cfc7ba'), 0.25 + 0.6 * r)
      col.lerp(tmp.set('#f2c184'), smooth(0.38, 0.95, h) * 0.7)
      if (hash(Math.floor(cx * 2.2), 3) > 0.7) col.multiplyScalar(0.86)
    } else if (cy < WATER_Y + 0.1) {
      col.set('#6d6a55') // river bed
    } else if (h < 0.075) {
      // Valley floor: meadow green with autumn-gold patches.
      const m = noise(cx * 0.35, cz * 0.35)
      col.set('#5f8f3e').lerp(tmp.set('#a8b84c'), r * 0.6)
      if (m > 0.58) col.lerp(tmp.set('#d2a640'), 0.55)
    } else if (h < 0.6) {
      col.set('#2c5536').lerp(tmp.set('#47743f'), r) // forested talus
    } else {
      // Summit plateau: slabs with patches of forest.
      if (noise(cx * 0.5, cz * 0.5) > 0.52) col.set('#3d6641').lerp(tmp.set('#557a45'), r)
      else col.set('#a5a79c').lerp(tmp.set('#c9c3b4'), r)
    }
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    for (let v = 0; v < 3; v++) colors.push(col.r, col.g, col.b)
  }
  const tmp3 = new THREE.Vector3()
  for (let j = 0; j < GRID - 1; j++) {
    for (let i = 0; i < GRID - 1; i++) {
      const k = j * GRID + i
      if ((i + j) % 2 === 0) { face(k, k + GRID, k + 1); face(k + 1, k + GRID, k + GRID + 1) }
      else { face(k, k + GRID, k + GRID + 1); face(k, k + GRID + 1, k + 1) }
    }
  }

  // Skirt: the cut sides of the diorama block, banded like layers of stone and tapering to a rocky underside.
  const BANDS = ['#8d8a86', '#a39d94', '#7f7c7a', '#b3aa9c', '#96918b']
  const LEVELS: number[] = []
  for (let y = -0.9; y < HEIGHT + 1.4; y += 1.4) LEVELS.push(y)
  const under = (x: number, z: number): [number, number, number] => [x * 0.86, -BASE_DEPTH - hash(x, z) * 0.8, z * 0.86]
  const push = (pts: number[][], shade: string) => {
    col.set(shade)
    for (const pt of pts) {
      positions.push(pt[0], pt[1], pt[2])
      colors.push(col.r, col.g, col.b)
    }
  }
  const side = (k1: number, k2: number) => {
    const x1 = px[k1], z1 = pz[k1], x2 = px[k2], z2 = pz[k2]
    for (let n = 0; n < LEVELS.length - 1; n++) {
      const lo1 = Math.min(py[k1], LEVELS[n]), lo2 = Math.min(py[k2], LEVELS[n])
      const hi1 = Math.min(py[k1], LEVELS[n + 1]), hi2 = Math.min(py[k2], LEVELS[n + 1])
      if (hi1 - lo1 < 1e-4 && hi2 - lo2 < 1e-4) break // above the surface on both ends
      // the top sliver of each column is soil, the rest is banded stone
      const shade = hi1 >= py[k1] - 1e-4 && hi2 >= py[k2] - 1e-4 && LEVELS[n] > 0 ? '#5d4a3a' : BANDS[n % BANDS.length]
      push([[x1, hi1, z1], [x1, lo1, z1], [x2, lo2, z2], [x1, hi1, z1], [x2, lo2, z2], [x2, hi2, z2]], shade)
    }
    const m1 = [x1, Math.min(py[k1], -0.9), z1], m2 = [x2, Math.min(py[k2], -0.9), z2]
    const b1 = under(x1, z1), b2 = under(x2, z2)
    push([m1, b1, b2, m1, b2, m2], '#5b5755')
    push([b1, [0, -BASE_DEPTH - 3.2, 0], b2], '#3b3837') // underside: fan to a point below the centre
  }
  for (let i = 0; i < GRID - 1; i++) {
    side(i + 1, i) // north edge
    side((GRID - 1) * GRID + i, (GRID - 1) * GRID + i + 1) // south
    side(i * GRID, (i + 1) * GRID) // west
    side((i + 1) * GRID + GRID - 1, i * GRID + GRID - 1) // east
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return { geometry, heightAt, slopeAt }
}

function buildTrees(heightAt: (x: number, z: number) => number, slopeAt: (x: number, z: number) => number) {
  const pines: THREE.Matrix4[] = [], pineColors: THREE.Color[] = []
  const leafy: THREE.Matrix4[] = [], leafyColors: THREE.Color[] = []
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const PINE = ['#1f4a33', '#275a3a', '#2f6a3f', '#1b3f2e']
  const AUTUMN = ['#e08a2c', '#f0b23a', '#c9642a', '#8fae3f', '#e9c04a']
  for (let t = 0; t < 5200; t++) {
    const x = (hash(t, 1) - 0.5) * (SIZE - 1.2), z = (hash(t, 2) - 0.5) * (SIZE - 1.2)
    const y = heightAt(x, z)
    if (y < WATER_Y + 0.16 || slopeAt(x, z) < 0.8) continue
    const h = y / HEIGHT
    const clump = noise(x * 0.45 + 40, z * 0.45)
    const river = riverDistance(x, z)
    if (h < 0.075) {
      // Valley floor: leave meadows open, line the river and the foot of the wall with trees.
      const keep = clump > 0.5 || river < 2.4
      if (!keep) continue
      q.setFromAxisAngle(up, hash(t, 5) * 6.28)
      if (hash(t, 3) < 0.42) {
        const k = 0.75 + hash(t, 4) * 0.7
        m.compose(p.set(x, y, z), q, s.set(k, k * (0.85 + hash(t, 6) * 0.5), k))
        leafy.push(m.clone()); leafyColors.push(new THREE.Color(AUTUMN[Math.floor(hash(t, 7) * AUTUMN.length)]))
        continue
      }
    } else if (h > 0.6 && clump < 0.5) continue
    else if (hash(t, 8) < 0.25) continue
    q.setFromAxisAngle(up, hash(t, 5) * 6.28)
    const k = 0.7 + hash(t, 4) * 0.9
    m.compose(p.set(x, y, z), q, s.set(k, k * (0.9 + hash(t, 6) * 0.6), k))
    pines.push(m.clone()); pineColors.push(new THREE.Color(PINE[Math.floor(hash(t, 7) * PINE.length)]))
  }
  const material = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 })
  const make = (geo: THREE.BufferGeometry, mats: THREE.Matrix4[], cols: THREE.Color[]) => {
    const mesh = new THREE.InstancedMesh(geo, material, mats.length)
    mats.forEach((mat, i) => { mesh.setMatrixAt(i, mat); mesh.setColorAt(i, cols[i]) })
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  const pineGeo = new THREE.ConeGeometry(0.2, 0.95, 5).translate(0, 0.47, 0)
  const leafGeo = new THREE.IcosahedronGeometry(0.27, 0).translate(0, 0.3, 0)
  return [make(pineGeo, pines, pineColors), make(leafGeo, leafy, leafyColors)]
}

/** Camera pose and model turn for a scroll position: start on the valley floor looking up at the wall,
 *  orbit once around (rising high over the back of the block), and land on a classic isometric view. */
function pose(p: number, portrait: boolean) {
  const e = p * p * (3 - 2 * p)
  const arc = Math.sin(Math.PI * p) // 0 → 1 → 0: peaks halfway round
  const far = portrait ? 1 + 0.45 * e : 1 // phones are narrow: back off further as the view widens
  return {
    turn: -0.5 + e * (Math.PI * 2 + 0.22),
    camY: 4.2 + e * 24 + arc * 20,
    camZ: (30 + e * 33 + arc * 6) * far,
    lookY: 6.6 - e * 3.8,
    shift: portrait ? 0 : 0.17 * (1 - smooth(0.1, 0.3, p)) + 0.1 * smooth(0.6, 0.85, p),
  }
}

export default function ElCapScene({ progress, className }: { progress: Progress; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return // no WebGL: the sky gradient behind still makes a fine backdrop
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = window.matchMedia('(max-width: 767px)').matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = !small
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400)

    // Cool skylight from above, warm low sun from the side: the alpenglow look.
    scene.add(new THREE.HemisphereLight('#a9c8ff', '#2a2f4a', 1.15))
    const sun = new THREE.DirectionalLight('#ffc27a', 3.4)
    sun.position.set(34, 20, 22)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.06
    scene.add(sun)
    const fill = new THREE.DirectionalLight('#7fa8ff', 0.5)
    fill.position.set(-20, 12, 10)
    scene.add(fill)

    // A soft studio environment, used only as reflections on the water and the glass shapes.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    const world = new THREE.Group() // everything that turns with the scroll
    scene.add(world)

    const { geometry, heightAt, slopeAt } = buildTerrain()
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 }))
    terrain.castShadow = true
    terrain.receiveShadow = true
    world.add(terrain)

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE - 0.02, SIZE - 0.02).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2f6f8f', roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.88, envMap, envMapIntensity: 0.6 }),
    )
    water.position.y = WATER_Y
    world.add(water)

    buildTrees(heightAt, slopeAt).forEach((t) => world.add(t))

    // The Nose: the prow where the two faces meet, drawn as a glowing route line.
    const nose: THREE.Vector3[] = []
    for (let s = 0; s <= 14; s++) {
      const z = 5.55 - (s / 14) * 1.95
      const x = 0.72 + Math.sin(s * 0.9) * 0.05
      nose.push(new THREE.Vector3(x, heightAt(x, z) + 0.12, z + 0.32))
    }
    const routeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nose), 80, 0.09, 6)
    const route = new THREE.Mesh(routeGeo, new THREE.MeshBasicMaterial({ color: '#ffe08a' }))
    world.add(route)
    const routeCount = routeGeo.index ? routeGeo.index.count : 0

    // Low-poly clouds drifting past the rim.
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.92 })
    const clouds: THREE.Group[] = []
    for (const [cx, cy, cz, k] of [[-13, 15.5, -4, 1.2], [12, 17, -9, 1.5], [3, 16.5, 12, 0.9]] as const) {
      const g = new THREE.Group()
      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + hash(i, cx) * 0.7, 0), cloudMat)
        puff.position.set((i - 1.5) * 1.1, hash(i, cz) * 0.4, hash(cx, i) * 0.8)
        puff.scale.y = 0.6
        g.add(puff)
      }
      g.position.set(cx, cy, cz)
      g.scale.setScalar(k)
      world.add(g)
      clouds.push(g)
    }

    // Abstract glass shapes floating in front of the camera (they don't turn with the block).
    const gems: THREE.Mesh[] = []
    const glass = (color: string) =>
      new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.04, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.62, flatShading: true, envMap, envMapIntensity: 1.6 })
    const gemDefs: [THREE.BufferGeometry, string, number, number, number][] = [
      [new THREE.IcosahedronGeometry(0.9, 0), '#ffc56e', -17, 15, 4],
      [new THREE.OctahedronGeometry(0.7, 0), '#7cc4ff', 19, 11, 6],
      [new THREE.TorusGeometry(0.7, 0.22, 6, 14), '#ff9a62', 15, 19, -4],
    ]
    for (const [geo, color, x, y, z] of gemDefs) {
      const gem = new THREE.Mesh(geo, glass(color))
      gem.position.set(x, y, z)
      gem.userData.home = gem.position.clone()
      scene.add(gem)
      gems.push(gem)
    }

    const anchors = [new THREE.Vector3(-0.9, heightAt(-0.9, 1.6) + 0.9, 1.6), nose[9].clone().add(new THREE.Vector3(0.3, 0, 0.3)), new THREE.Vector3(1.5, heightAt(1.5, 9.4) + 0.5, 9.4)]

    let width = 0, height = 0
    const resize = () => {
      width = host.clientWidth
      height = host.clientHeight
      renderer.setSize(width, height)
      camera.aspect = width / Math.max(1, height)
      camera.fov = width < height ? 46 : 36
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove)

    let visible = true
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(host)

    const clock = new THREE.Clock()
    const v = new THREE.Vector3()
    let p = progress.get()
    let frame = 0
    let last = -1
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!visible || width === 0) return
      const target = Math.min(1, Math.max(0, progress.get()))
      const dt = Math.min(0.1, clock.getDelta())
      p += (target - p) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 7)) // ease toward the scroll position
      const t = reduceMotion ? 0 : clock.elapsedTime
      if (reduceMotion && Math.abs(p - last) < 0.0005) return // nothing moved: skip the frame
      last = p
      pointer.x += (pointer.tx - pointer.x) * 0.05
      pointer.y += (pointer.ty - pointer.y) * 0.05

      const s = pose(p, width < height)
      world.rotation.y = s.turn + Math.sin(t * 0.25) * 0.035 + pointer.x * 0.06
      world.position.y = Math.sin(t * 0.6) * 0.18
      camera.position.set(pointer.x * 0.8, s.camY - pointer.y * 0.6, s.camZ)
      camera.lookAt(0, s.lookY, 0)
      if (s.shift > 0.001) camera.setViewOffset(width, height, -s.shift * width, 0, width, height)
      else camera.clearViewOffset()

      route.geometry.setDrawRange(0, Math.floor((routeCount * smooth(0.7, 0.92, p)) / 3) * 3)
      route.visible = p > 0.7
      clouds.forEach((c, i) => { c.position.x += Math.sin(t * 0.1 + i) * 0.002 })
      gems.forEach((g, i) => {
        const home = g.userData.home as THREE.Vector3
        g.position.set(home.x, home.y + Math.sin(t * 0.7 + i * 1.7) * 0.6 + p * (6 + i * 2), home.z)
        g.rotation.set(t * 0.2 + i, t * 0.27 + i * 2, 0)
      })

      renderer.render(scene, camera)

      // Pin the HTML labels to their spots on the model.
      const show = smooth(0.8, 0.92, p)
      anchors.forEach((anchor, i) => {
        const el = labelRefs.current[i]
        if (!el) return
        v.copy(anchor).applyMatrix4(world.matrixWorld).project(camera)
        el.style.opacity = String(v.z < 1 ? show : 0)
        el.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`
      })
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.dispose()
        }
      })
      envMap.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [progress])

  const labels = [
    { title: 'El Capitan', sub: '7,569 ft · 3,000 ft of granite' },
    { title: 'The Nose', sub: '31 pitches · 5.9 C2 or 5.14a free' },
    { title: 'El Cap Meadow', sub: 'Best seat in the Valley' },
  ]
  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      {labels.map((l, i) => (
        <div key={l.title} ref={(el) => { labelRefs.current[i] = el }} className="pointer-events-none absolute left-0 top-0 hidden opacity-0 will-change-transform sm:block">
          <div className="scene-label">
            <span className="scene-label-dot" />
            <div>
              <div className="font-semibold leading-tight text-white">{l.title}</div>
              <div className="text-[11px] leading-tight text-ink-200">{l.sub}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
