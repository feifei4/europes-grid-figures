// One loop of the Olkiluoto 3 EPR as a sectioned bench model.
// Numbers from TVO's "Nuclear Power Plant Unit Olkiluoto 3" data sheet (AREVA data):
// 4,300 MWth, 155 bar, hot leg 328 °C, cold leg 296 °C, 28,330 m³/h per loop,
// RPV 4,885 mm ID × 250 mm wall, 12,708 mm tall; SG 23 m, 5,980 tubes;
// pressuriser 75 m³, 14.4 m, 108 heaters; RCP 9.3 m; main lines 780 mm ID;
// 241 assemblies, 89 rod clusters, active height 4.2 m, rod travel 4.1 m.
// World units: 1 m = 10 units.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const W = 900;
const H = 980;
const AZ = 38;
const EL = 26;
const UX = [Math.sin(AZ * DEG), -Math.cos(AZ * DEG)]; // screen-right along the floor
const TV = [Math.cos(AZ * DEG), Math.sin(AZ * DEG)]; // toward the viewer along the floor
const u2 = (p, dx, dy) => [p[0] + UX[0] * dx + TV[0] * dy, p[1] + UX[1] * dx + TV[1] * dy];
const polar2 = (c, r, deg) => [c[0] + r * Math.cos(deg * DEG), c[1] + r * Math.sin(deg * DEG)];
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
const degOf = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG);

// ---- truth -------------------------------------------------------------------------------
const MWTH = 4300;
const T_STANDBY = 303; // hot standby, both legs
const T_HOT = 328;
const T_COLD = 296;
const ROD_TRAVEL = 41; // 4,100 mm
const SWELL = 14.6; // units of pressuriser level between hot standby and full power (see caption)

// ---- plan ---------------------------------------------------------------------------------
const PLATE = { x: -205, y: -125, w: 345, d: 215, r: 10 };
const PLATE_H = 14;
const FOOT_H = 6;
const C_R = [-60, 10];
const HOT_DEG = -12;
const COLD_DEG = -57;
const C_S = polar2(C_R, 120, HOT_DEG);
const C_P = u2(C_S, 84, 0);
const C_Z = u2(C_R, 45, -120);
const NOZ_Z = 88.5;
const PIPE_R = 4.7; // 780 mm bore + 2 × 76 mm wall → 932 mm OD
const SURGE_R = 2.0; // 325.5 mm bore + 2 × 40.5 mm wall
const LINE_FLANGE = 1.12;

// reactor vessel, s from the bottom apex at z = RPV_APEX
const RPV_APEX = 12;
const RPV = { rIn: 24.4, rOut: 26.9, headH: 18, shell: [18, 98], flange: [98, 110], flangeR: 30, domeH: 17, domeR: 27, win: [20, 96], half: 32 * DEG };
const RPVF = G.frameOf([C_R[0], C_R[1], RPV_APEX], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const rz = (s) => RPV_APEX + s;
// steam generator, s from the channel head apex
const SG_APEX = 62.5;
const SG = { R: 22.5, rIn: 21.5, ring: [22.5, 29.5], ts: [29.5, 35.5], lower: [35.5, 137.5], cone: [137.5, 151.5], rUp: 26, rUpIn: 25, upper: [151.5, 219.5], topH: 20, win: [35.5, 127.5], half: 32 * DEG };
const SGF = G.frameOf([C_S[0], C_S[1], SG_APEX], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const sz = (s) => SG_APEX + s;
// pressuriser, s from the bottom apex
const PZ_APEX = 160;
const PZ = { r: 15, rIn: 13.6, headH: 15, shell: [15, 129], top: [129, 144], win: [20, 124], half: 32 * DEG };
const PZF = G.frameOf([C_Z[0], C_Z[1], PZ_APEX], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const pz = (s) => PZ_APEX + s;
// pump, s from the casing bottom
const PUMP_Z = 76.5;
const PF = G.frameOf([C_P[0], C_P[1], PUMP_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const DISCHARGE_DEG = degOf(C_P, polar2(C_R, 60, COLD_DEG));

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [C_S[0] - SG.rUp, C_S[1], sz(239.5) + 22],
    [C_S[0] + SG.rUp, C_S[1], sz(239.5) + 22],
    [C_Z[0] - PZ.r, C_Z[1], pz(144) + 16],
    [C_Z[0] + PZ.r, C_Z[1], pz(144) + 16],
    [C_P[0], C_P[1], PUMP_Z + 100],
    [C_R[0], C_R[1], rz(127) + 46],
  ],
  W,
  H,
  { pad: 30, azimuth: AZ, elevation: EL },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const FADE = [0.04, 0.42];
const poly = (points) => `M${points.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;

// ---- recorder and helpers -------------------------------------------------------------------
const R = A.recorder(P);
const { items, nameFor } = R;
const record = R.solid;
function put(piece, ref, svg, { bias = 0, shapes = [], name } = {}) {
  R.put({ piece, at: ref, bias, svg, shapes, name: name ?? nameFor(`${piece}.item`) });
}
function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, maxLength = 26, spacing, owner, touch, bundle, limp = false, gaps = [], breaks = [], caps = true, rims, ends } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, rims, ends, piece });
  tubePieces(route, r, P, { maxLength, spacing, breaks, gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}
function turned(piece, F, profile, style = {}, { extra = "", inner = "", bias = 0, rims, bevel = 0, steps, name, owner, smooth = profile.some((point) => point[2]), className, shape: given } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, smooth, ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name ?? `${piece}.turned${Math.round(profile[0][0])}`);
  const shape = record(given ? given(id) : A.solid(F, profile, { name: id, owner, radius: smooth && smooth.radius ? smooth.radius : undefined, curve: smooth && !smooth.slope ? profile : undefined }));
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "", className }) + extra, { bias, name: id, shapes: [shape] });
  return { shape, paths };
}
const band = (piece, F, s0, s1, r, style = {}, options = {}) => turned(piece, F, [[s0, r], [s1, r]], style, options);
function flangeAt(piece, centre, axis, r, thick, { bolts = 8, tone = "hi", bias = 0, boltR, name, owner } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name ?? `${piece}.flange`);
  const paths = G.disc(-thick / 2, thick / 2, r, F, P);
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, boltR ?? r * 0.74, bolts, P, { all: true }), { size: 0.42, tone: "mid" }) : "";
  put(piece, centre, S(paths, { tone }) + face, { bias, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
}
function pipe(piece, control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = LINE_FLANGE, bolts = 0, bands = [], bias = 0, maxLength = 26, spacing, name, touch, breaks = [], gaps: extra = [] } = {}) {
  const flangeRs = [flangeR].flat().length > 1 ? [flangeR].flat() : [flangeR, flangeR].flat();
  const line = control.length > 2 ? G.fillet(control, Math.max(r * bend, 3), r > 3 ? 24 : 12, { P, tube: r }) : control.map((p) => [...p]);
  const total = G.pathLength(line);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign], index) => {
    if (!flanges[index]) return;
    const thick = Math.max(0.9, r * 0.55);
    const tangent = G.tangentAlong(line, along);
    collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeRs[index], thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
  });
  const ring = (along, radius, thick, kind) => collars.push({ kind, centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius, thick, gap: [along - thick / 2, along + thick / 2] });
  for (const share of bands) ring(total * share, r * 1.14, Math.max(0.8, r * 0.5), "band");
  const gaps = [...collars.map(({ gap }) => gap), ...extra];
  const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, bias, maxLength, spacing: spacing ?? Math.max(0.8, Math.min(2.4, r * 0.18)), touch, gaps, breaks, rims: flanges.map((flanged, index) => (flanged ? r * flangeRs[index] : r)) });
  for (const { kind, centre, tangent, radius, thick } of collars) flangeAt(piece, centre, tangent, radius, thick, { bolts: kind === "flange" ? bolts : 0, tone: kind === "flange" ? tone : "mid", bias, name: `${owner}.${kind}`, owner });
  line.owner = owner;
  return line;
}
function boxAt(piece, plan, z, h, style = {}, { extra = "", bias = 0, bevel = 0.5, steps = 3, name, owner, seated, cut } = {}) {
  const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  const id = nameFor(name ?? `${piece}.box`);
  put(piece, centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style }) + extra, { bias, name: id, shapes: [record(A.slab(plan, z, h, { name: id, owner, seated, cut }, steps))] });
  return centre;
}
// A ball; `flat: [normal, d]` records it cut by the plane n·(p − c) ≤ d, so a ball seated on a face
// (rim on sphere) is recorded without the part hidden inside the face.
function ballAt(piece, centre, r, { tone = "mid", bias = 0, name, owner, flat } = {}) {
  const id = nameFor(name ?? `${piece}.ball`);
  const meta = { name: id, owner, ...(flat ? { flats: [[...G.unit3(flat[0]), flat[1]]] } : {}) };
  put(piece, centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone }), { bias, name: id, shapes: [record(A.ball(centre, r, meta))] });
}
function padOn(piece, host, point, outward, a, h, { name, tone = "hi", bias = 0.1, owner, ring = false } = {}) {
  const hosts = [host].flat();
  const inside = (p) => hosts.some((shape) => A.sdf(shape, p) < 0);
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * TAU)));
  const id = nameFor(name ?? `${piece}.pad`);
  const face = ring && G.dot3(axis, V) > 0.15 ? Ln(G.circleOf(F, h, a * 0.55, P, 16), { tone: "faint" }) : "";
  put(piece, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone }) + face, { bias, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] });
  return G.add3(point, G.mul3(axis, h));
}
function boss(piece, centre, outward, r, length, { tone = "hi", bias = 0.1, name, host, ring = true, owner } = {}) {
  if (host) return padOn(piece, host, centre, outward, r, length, { tone, bias, name: name ?? `${piece}.boss`, ring, owner });
  const F = G.frameAlong(centre, outward);
  const id = nameFor(name ?? `${piece}.boss`);
  put(piece, G.add3(centre, G.mul3(F.a, length / 2)), S(G.disc(0, length, r, F, P), { tone }) + (ring && G.dot3(F.a, V) > 0.15 ? Ln(G.circleOf(F, length, r * 0.55, P, 16), { tone: "faint" }) : ""), { bias, name: id, shapes: [record(A.disc(F, 0, length, r, { name: id, owner }))] });
  return G.add3(centre, G.mul3(F.a, length));
}
// A nozzle forging: a saddle pad on the host, then a tapered safe end. Returns the face centre.
function nozzle(piece, host, point, outward, { r = 8.5, pad = 3.5, r2 = 7, reach = 9, name } = {}) {
  const axis = G.unit3(outward);
  const id = nameFor(name ?? `${piece}.nozzle`);
  const padFace = padOn(piece, host, point, axis, r, pad, { name: `${id}.pad` });
  const F = G.frameAlong(padFace, axis);
  const profile = [[0, r], [1.6, r2, 1], [reach - pad, r2]];
  put(piece, G.add3(padFace, G.mul3(axis, (reach - pad) / 2)), S(G.solidOf(profile, F, P, { smooth: false }), { tone: "hi" }), { bias: 0.15, name: `${id}.end`, shapes: [record(A.solid(F, profile, { name: `${id}.end` }))] });
  return G.add3(padFace, G.mul3(axis, reach - pad));
}
const elbowBall = (face, normal, faceR, ball) => G.add3(face, G.mul3(G.unit3(normal), Math.sqrt(ball ** 2 - faceR ** 2)));
const onBall = (centre, toward, ball, rim) => G.add3(centre, G.mul3(G.unit3(G.sub3(toward, centre)), Math.sqrt(ball ** 2 - rim ** 2)));

// elliptical heads: apex at s = 0 (bottom) or s = h (top), r = R at the equator
function headProfile(R, h, { top = false, knots = 26 } = {}) {
  const out = [];
  for (let index = 0; index <= knots; index++) {
    const phi = (index / knots) * (Math.PI / 2);
    const s = top ? h * Math.sin(phi) : h * (1 - Math.cos(phi));
    const r = top ? R * Math.cos(phi) : R * Math.sin(phi);
    out.push([Number(s.toFixed(3)), Number(r.toFixed(3)), index && index < knots ? 1 : 0]);
  }
  return out;
}
const headRadius = (R, h, top) => (s) => {
  const x = top ? s / h : (s - h) / h;
  return R * Math.sqrt(Math.max(0, 1 - x * x));
};
const headSlope = (R, h, top) => (s) => {
  const x = top ? s / h : (s - h) / h;
  const root = Math.sqrt(Math.max(1e-4, 1 - x * x));
  return (-R * x) / (h * root);
};
// `recordFrom`: record only the part of a bottom head above that s (what shows above a skirt or ring),
// closed by a flat at that level, so a ring round the dome's hidden foot can't interlock with it.
function head(piece, F, R, h, s0, { top = false, name, extra = "", inner = "", recordFrom = null } = {}) {
  const profile = headProfile(R, h, { top }).map(([s, r, smooth]) => [s + s0, r, smooth]);
  const radius = (s) => headRadius(R, h, top)(s - s0);
  const slope = (s) => headSlope(R, h, top)(s - s0);
  const shape = recordFrom === null ? undefined : (id) => {
    const kept = A.traced(profile, { radius }).filter(([s]) => s >= s0 + recordFrom);
    return A.body(F, [[s0 + recordFrom, 0], [s0 + recordFrom, radius(s0 + recordFrom)], ...kept.filter(([, r]) => r > 0), [s0 + h, 0]], { name: id });
  };
  return turned(piece, F, profile, {}, { smooth: { slope, radius, rows: 6 }, name, extra, inner, shape });
}

// ---- windows cut into a wall ---------------------------------------------------------------
const BIG = 600;
const halfSpaceBox = (C, z0, z1, sign) => A.orientedBox([C[0] + (TV[0] * sign * BIG) / 2, C[1] + (TV[1] * sign * BIG) / 2, (z0 + z1) / 2], [[TV[0], TV[1], 0], [UX[0], UX[1], 0], [0, 0, 1]], [BIG / 2, BIG, (z1 - z0) / 2 + 2], { name: "cut.half" });
function windowBox(C, rIn, rOut, z0, z1, half) {
  const near = rIn * Math.cos(half) - 0.3;
  const far = rOut + 1.5;
  return A.orientedBox([C[0] + (TV[0] * (near + far)) / 2, C[1] + (TV[1] * (near + far)) / 2, (z0 + z1) / 2], [[TV[0], TV[1], 0], [UX[0], UX[1], 0], [0, 0, 1]], [(far - near) / 2, rOut * Math.sin(half), (z1 - z0) / 2], { name: "cut.window" });
}
// Screen clips and the cut faces of a rectangular opening in a vertical cylindrical wall,
// centred on the direction toward the viewer. Returns clip markup, the reveals (cut faces) and edge strokes.
function windowOf(C, rIn, rOut, z0, z1, half, id, { steps = 28, edge = "mid" } = {}) {
  const a0 = AZ * DEG - half;
  const a1 = AZ * DEG + half;
  const arc = (r, z, from, to) => Array.from({ length: steps + 1 }, (_, index) => {
    const a = from + ((to - from) * index) / steps;
    return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a), z];
  });
  const outer = poly([...arc(rOut, z0, a0, a1), ...arc(rOut, z1, a1, a0)]);
  const inner = poly([...arc(rIn, z0, a0, a1), ...arc(rIn, z1, a1, a0)]);
  const bottom = poly([...arc(rIn, z0, a0, a1), ...arc(rOut, z0, a1, a0)]);
  const sideAt = (a, n) => {
    const quad = [[C[0] + rIn * Math.cos(a), C[1] + rIn * Math.sin(a), z0], [C[0] + rOut * Math.cos(a), C[1] + rOut * Math.sin(a), z0], [C[0] + rOut * Math.cos(a), C[1] + rOut * Math.sin(a), z1], [C[0] + rIn * Math.cos(a), C[1] + rIn * Math.sin(a), z1]];
    const shade = G.toneOf([n[0], n[1], 0], P);
    return `<path class="iso-shade" data-shade="${shade}" d="${poly(quad)}"/>`;
  };
  const reveals = `<path class="iso-top" d="${bottom}"/>` + sideAt(a0, [-Math.sin(a0), Math.cos(a0)]) + sideAt(a1, [Math.sin(a1), -Math.cos(a1)]);
  const clipIn = `<clipPath id="${id}-in"><path d="${inner}"/></clipPath>`;
  const clipOut = `<clipPath id="${id}-out"><path clip-rule="evenodd" d="M0 0H${W}V${H}H0Z${outer}"/></clipPath>`;
  const edges = Ln(inner, { tone: "faint" }) + Ln(outer, { tone: edge });
  return { clipIn, clipOut, reveals, edges, inner, outer };
}

// ---- base plate (unsorted back layer) ---------------------------------------------------
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
const FEET = [...k.corners(PLATE, 24), [PLATE.x + PLATE.w / 2, PLATE.y + 24], [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d - 24]].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of FEET) {
  back.push(S(k.cylinder(x, y, 9, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
const STAND = { owner: "stand.frame" };
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true, ...STAND }));
const GROOVE = k.insetPlan(PLATE, 7);
back.push(Ln(k.planOutline(GROOVE, 0, P), { tone: "lo" }));
const PLATE_SCREWS = k.corners(PLATE, 14);
back.push(Ln(PLATE_SCREWS.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 18)).join(""), { tone: "lo" }));
back.push(Dots(PLATE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
// floor grid, 1 m, inside the groove
for (let x = Math.ceil(GROOVE.x / 10) * 10; x < GROOVE.x + GROOVE.w; x += 10) back.push(Ln(k.lineOnTop([x, GROOVE.y], [x, GROOVE.y + GROOVE.d], 0, P), { tone: "faint" }));
for (let y = Math.ceil(GROOVE.y / 10) * 10; y < GROOVE.y + GROOVE.d; y += 10) back.push(Ln(k.lineOnTop([GROOVE.x, y], [GROOVE.x + GROOVE.w, y], 0, P), { tone: "faint" }));
// ruler strip along the front edge: one tick per metre, a major every five
const STRIP = { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 17, w: PLATE.w - 32, d: 7, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 5, STRIP.x + STRIP.w - 5, 10, 5, STRIP.y + 1, 0.8, [2, 4], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2.4, STRIP.y + 3.5, 0.8]), at([STRIP.x + STRIP.w - 2.4, STRIP.y + 3.5, 0.8])], { size: 0.45 }));
// label plate, front right
const LABEL = { x: PLATE.x + PLATE.w - 24, y: PLATE.y + PLATE.d - 92, w: 12, d: 62, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 7.4, LABEL.y + LABEL.d - 6], 1, P, "y"), "OL3 · LOOP 1", { size: 4.2, tone: "lo" }));
back.push(Ln([0, 1].map((row) => k.onTop([[LABEL.x + 3 + row * 2.2, LABEL.y + 5], [LABEL.x + 3 + row * 2.2, LABEL.y + (row ? 15 : 22)]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w / 2, LABEL.y + 2.6, 1]), at([LABEL.x + LABEL.w / 2, LABEL.y + LABEL.d - 2.6, 1])], { size: 0.45 }));

// a square column from the plate up to z, as a sorted item
function column(piece, cx, cy, half, z1, { name, bevel = 0.4 } = {}) {
  const plan = { x: cx - half, y: cy - half, w: half * 2, d: half * 2, r: 0.8 };
  const id = nameFor(name ?? `${piece}.column`);
  const foot = k.insetPlan(plan, -2.2);
  put(piece, [cx, cy, 1.5], S(k.slabOf(foot, 0, 3, P, 3, 0.3), { tone: "mid" }) + Dots(k.corners(foot, 1.4).map(([x, y]) => at([x, y, 3])), { size: 0.4 }), { name: `${id}.foot`, shapes: [record(A.slab(foot, 0, 3, { name: `${id}.foot` }, 3))] });
  put(piece, [cx, cy, (z1 + 3) / 2], S(k.slabOf(plan, 3, z1 - 3, P, 3, bevel), { tone: "mid" }), { name: id, shapes: [record(A.slab(plan, 3, z1 - 3, { name: id }, 3))] });
  return plan;
}

// ---- reactor vessel ----------------------------------------------------------------------
{
  const piece = "rpv";
  // support skirt, cut by the bottom head
  const skirtH = 18;
  // the head is recorded from the skirt's top up: the foot of the dome is inside the skirt
  const HEAD = head(piece, RPVF, RPV.rOut, RPV.headH, 0, { name: "rpv.bottom-head", recordFrom: skirtH - RPV_APEX });
  put(piece, [C_R[0] + TV[0] * 20, C_R[1] + TV[1] * 20, skirtH / 2], S(k.cylinder(C_R[0], C_R[1], 20, 0, skirtH, P, 72), { tone: "lo" }) + Ln(k.sideArc(C_R[0], C_R[1], 20, 4, P, 36), { tone: "faint" }), { name: "rpv.skirt", shapes: [record(A.ring(G.frameOf([C_R[0], C_R[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, skirtH, 17, 20, { name: "rpv.skirt" }))] });
  for (const deg of [AZ - 60, AZ + 60, AZ + 180]) {
    const p = polar2(C_R, 23.8, deg);
    const plan = { x: p[0] - 3, y: p[1] - 3, w: 6, d: 6, r: 0.6 };
    put(piece, [p[0], p[1], 1.5], S(k.slabOf(plan, 0, 3, P, 2, 0.3), { tone: "mid" }), { bias: 0.2, name: "rpv.skirt-pad", shapes: [record(A.slab(plan, 0, 3, { name: "rpv.skirt-pad" }, 2))] });
  }
  // shell with a window: drawn twice, back half then front half
  const [w0, w1] = RPV.win;
  const z0 = rz(w0);
  const z1 = rz(w1);
  const shell = G.solidOf([[RPV.shell[0], RPV.rOut], [RPV.shell[1], RPV.rOut]], RPVF, P, { smooth: false, steps: 96 });
  const seams = [34, 66].map((s) => G.arcOf(RPVF, s, RPV.rOut, P)).join("");
  const backShape = record(A.ring(RPVF, RPV.shell[0], RPV.shell[1], RPV.rIn, RPV.rOut, { name: "rpv.shell-back", cut: [halfSpaceBox(C_R, rz(RPV.shell[0]), rz(RPV.shell[1]), 1)] }));
  const frontShape = record(A.ring(RPVF, RPV.shell[0], RPV.shell[1], RPV.rIn, RPV.rOut, { name: "rpv.shell-front", cut: [halfSpaceBox(C_R, rz(RPV.shell[0]), rz(RPV.shell[1]), -1), windowBox(C_R, RPV.rIn, RPV.rOut, z0, z1, RPV.half)] }));
  put(piece, [C_R[0] - TV[0] * RPV.rOut, C_R[1] - TV[1] * RPV.rOut, rz(58)], S(shell, { tone: "hi", inner: Ln(seams, { tone: "faint" }) }), { name: "rpv.shell-back", shapes: [backShape] });
  const WIN = windowOf(C_R, RPV.rIn, RPV.rOut, z0, z1, RPV.half, "rpv-win");
  // the core barrel, itself cut
  const BARREL = { rIn: 22.6, rOut: 23.6 };
  const BWIN = windowOf(C_R, BARREL.rIn, BARREL.rOut, z0 + 2, z1 - 2, 30 * DEG, "rpv-barrel", { edge: "lo" });
  const barrelShape = record(A.ring(RPVF, 20, 96, BARREL.rIn, BARREL.rOut, { name: "rpv.barrel", cut: [windowBox(C_R, BARREL.rIn, BARREL.rOut, z0 + 2, z1 - 2, 30 * DEG)] }));
  record(A.ring(RPVF, 94, 98, BARREL.rOut, RPV.rIn, { name: "rpv.barrel-flange" }));
  const interior = [];
  const shapes = [barrelShape];
  interior.push(S(k.cylinder(C_R[0], C_R[1], RPV.rIn, z0 - 4, z1 - z0 + 12, P, 96), { tone: "mid", crease: "none" })); // inside of the vessel wall
  interior.push(S(k.cylinder(C_R[0], C_R[1], BARREL.rOut, z0 - 4, z1 - z0 + 12, P, 96), { tone: "hi", crease: "none" })); // the barrel's outside
  const core = [];
  core.push(S(k.cylinder(C_R[0], C_R[1], BARREL.rIn, z0 - 4, z1 - z0 + 12, P, 96), { tone: "mid", crease: "none" })); // inside of the barrel
  // lower internals and core plate
  const LOWER = [[rz(20), rz(24)], [rz(24), rz(28)]];
  core.push(S(k.cylinder(C_R[0], C_R[1], BARREL.rIn, LOWER[0][0], 4, P, 96), { tone: "hi" }));
  shapes.push(record(A.cylinder(C_R[0], C_R[1], BARREL.rIn, LOWER[0][0], 4, { name: "rpv.lower-support" })));
  core.push(S(k.cylinder(C_R[0], C_R[1], BARREL.rIn, LOWER[1][0], 4, P, 96), { tone: "hi" }));
  shapes.push(record(A.cylinder(C_R[0], C_R[1], BARREL.rIn, LOWER[1][0], 4, { name: "rpv.core-plate" })));
  // fuel assemblies: 17 × 17 lattice, 241 inside the core circle; the ones toward the viewer
  const PITCH = 2.15;
  const FA_H = 48;
  const FA_Z = rz(28);
  const FA_TOP = FA_Z + FA_H;
  const lattice = [];
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) if (Math.hypot(i, j) * PITCH <= 19.2) lattice.push([i, j]);
  const fas = lattice.map(([i, j]) => ({ i, j, x: C_R[0] + i * PITCH, y: C_R[1] + j * PITCH })).map((f) => ({ ...f, depth: (f.x - C_R[0]) * TV[0] + (f.y - C_R[1]) * TV[1], rod: (f.i + f.j) % 2 === 0 }));
  const shown = fas.filter((f) => f.depth >= -1).sort((a, b) => a.depth - b.depth);
  const front = (f) => f.depth >= 10.5;
  const rodGroups = [];
  const guideTubes = [];
  const assemblies = [];
  for (const f of shown) {
    const plan = { x: f.x - 1, y: f.y - 1, w: 2, d: 2, r: 0.15 };
    const grids = front(f) ? Array.from({ length: 10 }, (_, index) => k.sideSeam(plan, FA_Z + 2.6 + index * 4.7, P, 2)).join("") : "";
    assemblies.push(S(k.slabOf(plan, FA_Z, FA_H, P, 2, 0.25), { tone: "hi", crease: "lo", inner: grids ? Ln(grids, { tone: "faint" }) : "" }));
    shapes.push(record(A.slab(plan, FA_Z, FA_H, { name: `rpv.fa${f.i}.${f.j}` }, 2)));
    if (f.rod && front(f)) rodGroups.push(f);
    else if (f.rod && f.depth >= 3) guideTubes.push(f);
  }
  // upper core plate (60 mm) and the guide tubes of the clusters behind the sectioned ones
  const above = [];
  above.push(S(k.cylinder(C_R[0], C_R[1], BARREL.rIn, FA_TOP, 0.6, P, 96), { tone: "hi", crease: "none" }));
  shapes.push(record(A.cylinder(C_R[0], C_R[1], BARREL.rIn, FA_TOP, 0.6, { name: "rpv.upper-core-plate" })));
  const GUIDE_H = z1 - FA_TOP - 0.6;
  for (const f of guideTubes) {
    const plan = { x: f.x - 1.1, y: f.y - 1.1, w: 2.2, d: 2.2, r: 0.2 };
    above.push(S(k.slabOf(plan, FA_TOP + 0.6, GUIDE_H, P, 2, 0.2), { tone: "mid", crease: "none" }));
    shapes.push(record(A.slab(plan, FA_TOP + 0.6, GUIDE_H, { name: `rpv.guide${f.i}.${f.j}` }, 2)));
  }
  // the lit rod bank, drawn withdrawn (full power); the page moves it. It is painted before the
  // assemblies, so an inserted cluster disappears into its assembly the way the real one does.
  const rods = [];
  for (const f of rodGroups) {
    const top = FA_TOP + ROD_TRAVEL;
    const fingers = [-0.72, -0.36, 0, 0.36, 0.72].map((dx) => k.segment([f.x + dx * UX[0], f.y + dx * UX[1], top - 42], [f.x + dx * UX[0], f.y + dx * UX[1], top - 0.6], P)).join("");
    rods.push(Ln(fingers, { tone: "lit" }));
    rods.push(S(k.cylinder(f.x, f.y, 0.95, top - 0.6, 0.6, P, 12), { tone: "hi", lit: true, crease: "none" }));
    rods.push(S(k.cylinder(f.x, f.y, 0.45, top, 60, P, 10), { tone: "hi", lit: true, crease: "none" }));
    shapes.push(record(A.cylinder(f.x, f.y, 1.0, FA_TOP + 0.6, z1 - FA_TOP - 0.6, { name: `rpv.rods${f.i}.${f.j}` })));
  }
  const svg =
    `<defs>${WIN.clipIn}${WIN.clipOut}${BWIN.clipIn}${BWIN.clipOut}</defs>` +
    `<g class="cav" clip-path="url(#rpv-win-in)">${interior.join("")}` +
    `<g clip-path="url(#rpv-barrel-in)">${core.join("")}<g data-part="rods">${rods.join("")}</g>${assemblies.join("")}${above.join("")}</g>${BWIN.reveals}${BWIN.edges}</g>` +
    WIN.reveals +
    WIN.edges;
  put(piece, [C_R[0] + TV[0] * BARREL.rIn * 0.5, C_R[1] + TV[1] * BARREL.rIn * 0.5, (z0 + z1) / 2], svg, { name: "rpv.window", shapes });
  put(piece, [C_R[0] + TV[0] * RPV.rOut, C_R[1] + TV[1] * RPV.rOut, rz(58)], `<g clip-path="url(#rpv-win-out)">${S(shell, { tone: "hi", inner: Ln(seams, { tone: "faint" }) })}</g>`, { name: "rpv.shell-front", shapes: [frontShape] });
  console.log(`core: ${lattice.length} positions, ${shown.length} drawn, ${rodGroups.length} lit clusters, ${guideTubes.length} guide tubes`);
  // nozzles
  const NOZ_S = NOZ_Z - RPV_APEX;
  const hosts = [backShape, frontShape];
  const outlet = nozzle(piece, hosts, G.pointOf(RPVF, NOZ_S, RPV.rOut - 0.1, HOT_DEG * DEG), dir(HOT_DEG), { name: "rpv.outlet" });
  const inlet = nozzle(piece, hosts, G.pointOf(RPVF, NOZ_S, RPV.rOut - 0.1, COLD_DEG * DEG), dir(COLD_DEG), { name: "rpv.inlet" });
  // flange, head flange with studs, dome
  turned(piece, RPVF, [[RPV.flange[0], RPV.flangeR], [104, RPV.flangeR]], {}, { name: "rpv.flange", bevel: 0.4, shape: (id) => A.ring(RPVF, RPV.flange[0], 104, RPV.rIn, RPV.flangeR, { name: id }) });
  turned(piece, RPVF, [[104, RPV.flangeR], [RPV.flange[1], RPV.flangeR]], {}, { name: "rpv.head-flange", bevel: 0.6, extra: Dots(G.dotsOf(RPVF, RPV.flange[1], 28.4, 52, P, { all: true }), { size: 0.5, tone: "mid" }), shape: (id) => A.ring(RPVF, 104, RPV.flange[1], RPV.rIn, RPV.flangeR, { name: id }) });
  const DOME = head(piece, RPVF, RPV.domeR, RPV.domeH, RPV.flange[1], { top: true, name: "rpv.head" });
  // control rod drive mechanisms on the head, one per cluster, and the instrumentation lances
  const domeZ = (rho) => rz(RPV.flange[1]) + RPV.domeH * Math.sqrt(Math.max(0, 1 - (rho / RPV.domeR) ** 2));
  const crdm = [];
  const lances = [];
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const rho = Math.hypot(i, j) * PITCH;
    if ((i + j) % 2 === 0 && Math.hypot(i, j) * PITCH <= 19.2 && (Math.hypot(i, j) * PITCH <= 16.3)) crdm.push([C_R[0] + i * PITCH, C_R[1] + j * PITCH, rho]);
    else if (i !== 0 && i % 2 === 0 && Math.abs(j) % 2 === 1 && Math.hypot(i, j) > 3.26 && Math.hypot(i, j) <= 6.05) lances.push([C_R[0] + i * PITCH, C_R[1] + j * PITCH, rho]);
  }
  console.log(`head: ${crdm.length} drive mechanisms, ${lances.length} lances`);
  const CRDM_H = 44;
  for (const [x, y, rho] of crdm) {
    const base = domeZ(rho) - 0.15;
    const id = nameFor("rpv.crdm");
    put(piece, [x, y, base + CRDM_H / 2], S(k.cylinder(x, y, 1.02, base, 2.4, P, 12), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 0.82, base + 2.4, CRDM_H - 5.4, P, 12), { tone: "hi", crease: "none" }) + S(k.cylinder(x, y, 0.95, base + CRDM_H - 3, 3, P, 12), { tone: "mid", crease: "none" }), {
      name: id,
      bias: 0.2,
      shapes: [record(A.cylinder(x, y, 1.02, base, 2.4, { name: `${id}.adapter`, seated: true, cut: [DOME.shape] })), record(A.cylinder(x, y, 0.82, base + 2.4, CRDM_H - 5.4, { name: id })), record(A.cylinder(x, y, 0.95, base + CRDM_H - 3, 3, { name: `${id}.cap` }))],
    });
  }
  for (const [x, y, rho] of lances) {
    const base = domeZ(rho) - 0.15;
    const id = nameFor("rpv.lance");
    put(piece, [x, y, base + 25], S(k.cylinder(x, y, 0.5, base, 50, P, 10), { tone: "mid", crease: "none" }), { name: id, bias: 0.2, shapes: [record(A.cylinder(x, y, 0.5, base, 50, { name: id, seated: true, cut: [DOME.shape] }))] });
  }
  // head lifting lugs
  for (const deg of [AZ + 90, AZ + 210, AZ + 330]) {
    const p = polar2(C_R, 22, deg);
    const plan = { x: p[0] - 1.6, y: p[1] - 1.6, w: 3.2, d: 3.2, r: 0.4 };
    const base = domeZ(22) - 0.3;
    put(piece, [p[0], p[1], base + 3], S(k.slabOf(plan, base, 6, P, 2, 0.3), { tone: "mid" }), { bias: 0.2, name: "rpv.lug", shapes: [record(A.slab(plan, base, 6, { name: "rpv.lug", seated: true, cut: [DOME.shape] }, 2))] });
  }
  Object.assign(globalThis, { RPV_OUTLET: outlet, RPV_INLET: inlet });
}

// ---- steam generator -------------------------------------------------------------------
{
  const piece = "sg";
  const HEAD = head(piece, SGF, SG.R, SG.R, 0, { name: "sg.channel-head", extra: "" });
  // four saddle columns under the channel head
  for (const deg of [AZ + 30, AZ + 120, AZ + 210, AZ + 300]) {
    const p = polar2(C_S, 10, deg);
    const topZ = SG_APEX + SG.R - Math.sqrt(SG.R ** 2 - 10 ** 2) + 3;
    const plan = { x: p[0] - 3.2, y: p[1] - 3.2, w: 6.4, d: 6.4, r: 0.8 };
    const id = nameFor("sg.column");
    const foot = k.insetPlan(plan, -2.2);
    put(piece, [p[0], p[1], 1.5], S(k.slabOf(foot, 0, 3, P, 3, 0.3), { tone: "mid" }) + Dots(k.corners(foot, 1.4).map(([x, y]) => at([x, y, 3])), { size: 0.4 }), { name: `${id}.foot`, shapes: [record(A.slab(foot, 0, 3, { name: `${id}.foot` }, 3))] });
    put(piece, [p[0], p[1], (topZ + 3) / 2], S(k.slabOf(plan, 3, topZ - 3, P, 3, 0.4), { tone: "mid" }), { name: id, shapes: [record(A.slab(plan, 3, topZ - 3, { name: id, seated: true, cut: [HEAD.shape] }, 3))] });
  }
  // manways on the channel head
  for (const deg of [AZ - 40, AZ + 60]) {
    const s = 11;
    const rho = headRadius(SG.R, SG.R, false)(s);
    const point = G.pointOf(SGF, s, rho - 0.1, deg * DEG);
    const normal = G.unit3(G.sub3(G.radialOf(SGF, deg * DEG), G.mul3(SGF.a, headSlope(SG.R, SG.R, false)(s))));
    const face = boss(piece, point, normal, 4.2, 2.2, { host: HEAD.shape, ring: false, name: "sg.manway-pad" });
    const F = G.frameAlong(face, normal);
    put(piece, G.add3(face, G.mul3(normal, 0.8)), S(G.disc(0, 1.6, 4.6, F, P, { bevel: 0.3 }), { tone: "hi" }) + Dots(G.dotsOf(F, 1.6, 3.6, 16, P, { all: true }), { size: 0.36, tone: "mid" }), { bias: 0.2, name: "sg.manway", shapes: [record(A.disc(F, 0, 1.6, 4.6, { name: "sg.manway" }))] });
  }
  const RING = band(piece, SGF, SG.ring[0], SG.ring[1], SG.R, {}, { name: "sg.head-ring" });
  const TS = band(piece, SGF, SG.ts[0], SG.ts[1], SG.R, {}, { name: "sg.tubesheet", inner: G.arcOf(SGF, SG.ts[0] + 0.01, SG.R, P) });
  // nozzles: inlet toward the reactor, outlet along the screen to the right and 30° down
  const NOZ_S = NOZ_Z - SG_APEX;
  const inletDeg = degOf(C_S, C_R);
  const inlet = nozzle(piece, [HEAD.shape, RING.shape, TS.shape], G.pointOf(SGF, NOZ_S, SG.R - 0.1, inletDeg * DEG), dir(inletDeg), { name: "sg.inlet" });
  const outDeg = AZ - 90;
  const outNormal = G.unit3([UX[0] * Math.cos(30 * DEG), UX[1] * Math.cos(30 * DEG), -Math.sin(30 * DEG)]);
  const outPoint = G.add3([C_S[0], C_S[1], SG_APEX + SG.R], G.mul3(outNormal, SG.R - 0.1));
  const outlet = nozzle(piece, [HEAD.shape, RING.shape], outPoint, outNormal, { name: "sg.outlet" });
  // lower shell with the tube bundle window
  const [w0, w1] = SG.win;
  const z0 = sz(w0);
  const z1 = sz(w1);
  const lower = G.solidOf([[SG.lower[0], SG.R], [SG.lower[1], SG.R]], SGF, P, { smooth: false, steps: 96 });
  const seams = [60, 100].map((s) => G.arcOf(SGF, s, SG.R, P)).join("");
  const backShape = record(A.ring(SGF, SG.lower[0], SG.lower[1], SG.rIn, SG.R, { name: "sg.lower-back", cut: [halfSpaceBox(C_S, sz(SG.lower[0]), sz(SG.lower[1]), 1)] }));
  const frontShape = record(A.ring(SGF, SG.lower[0], SG.lower[1], SG.rIn, SG.R, { name: "sg.lower-front", cut: [halfSpaceBox(C_S, sz(SG.lower[0]), sz(SG.lower[1]), -1), windowBox(C_S, SG.rIn, SG.R, z0, z1, SG.half)] }));
  put(piece, [C_S[0] - TV[0] * SG.R, C_S[1] - TV[1] * SG.R, sz(86)], S(lower, { tone: "hi", inner: Ln(seams, { tone: "faint" }) }), { name: "sg.lower-back", shapes: [backShape] });
  const WIN = windowOf(C_S, SG.rIn, SG.R, z0, z1, SG.half, "sg-win");
  const WRAP = { rIn: 20.0, rOut: 20.8 };
  const WWIN = windowOf(C_S, WRAP.rIn, WRAP.rOut, z0 + 1.5, z1 - 1.5, 30 * DEG, "sg-wrap", { edge: "lo" });
  const shapes = [record(A.ring(SGF, SG.lower[0] + 2, SG.lower[1] - 20, WRAP.rIn, WRAP.rOut, { name: "sg.wrapper", cut: [windowBox(C_S, WRAP.rIn, WRAP.rOut, z0 + 1.5, z1 - 1.5, 30 * DEG)] }))];
  record(A.ring(SGF, SG.lower[1] - 22, SG.lower[1] - 20, WRAP.rOut, SG.rIn, { name: "sg.wrapper-ring" }));
  const interior = [];
  interior.push(S(k.cylinder(C_S[0], C_S[1], SG.rIn, z0 - 4, z1 - z0 + 12, P, 96), { tone: "mid", crease: "none" }));
  interior.push(S(k.cylinder(C_S[0], C_S[1], WRAP.rOut, z0 - 4, z1 - z0 + 12, P, 96), { tone: "hi", crease: "none" }));
  const bundle = [];
  bundle.push(S(k.cylinder(C_S[0], C_S[1], WRAP.rIn, z0 - 4, z1 - z0 + 12, P, 96), { tone: "mid", crease: "none" }));
  // the tubesheet's top face inside the wrapper, with its tube holes
  const TS_TOP = sz(SG.ts[1]);
  bundle.push(S(k.cylinder(C_S[0], C_S[1], WRAP.rIn, TS_TOP - 3, 3, P, 96), { tone: "hi" }));
  const holes = [];
  const pitch = 2.75;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * pitch;
    const y = j * pitch * 0.866;
    if (Math.hypot(x, y) <= WRAP.rIn - 1.6 && Math.abs(y) > 1.2) holes.push(at(G.add3([C_S[0], C_S[1], TS_TOP], [UX[0] * x + TV[0] * y, UX[1] * x + TV[1] * y, 0])));
  }
  bundle.push(Dots(holes, { size: 0.3, tone: "lo" }));
  // U-tubes in three planes facing the viewer, and the support plates they pass through
  const STRAIGHT_TOP = sz(SG.lower[1] - 40);
  const tubeRows = { back: [], mid: [], front: [] };
  const rowOffsets = { back: -7, mid: 0, front: 7 };
  for (const [row, b] of Object.entries(rowOffsets)) {
    for (const a of [3, 6, 9, 12, 15, 18]) {
      if (Math.hypot(a, b) > WRAP.rIn - 1.6) continue;
      const pts = [];
      const leg = (sign) => G.add3([C_S[0], C_S[1], 0], [UX[0] * sign * a + TV[0] * b, UX[1] * sign * a + TV[1] * b, 0]);
      pts.push([...leg(-1).slice(0, 2), TS_TOP], [...leg(-1).slice(0, 2), STRAIGHT_TOP]);
      for (let index = 1; index < 16; index++) {
        const theta = Math.PI - (Math.PI * index) / 16;
        pts.push([C_S[0] + UX[0] * a * Math.cos(theta) + TV[0] * b, C_S[1] + UX[1] * a * Math.cos(theta) + TV[1] * b, STRAIGHT_TOP + a * Math.sin(theta)]);
      }
      pts.push([...leg(1).slice(0, 2), STRAIGHT_TOP], [...leg(1).slice(0, 2), TS_TOP]);
      tubeRows[row].push(`M${pts.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L")}`);
      tubeRows[row].push(...[leg(-1), leg(1)].map((p) => at([p[0], p[1], TS_TOP])));
    }
  }
  const rowSvg = (row) => Ln(tubeRows[row].filter((d) => typeof d === "string").join(""), { tone: row === "front" ? "hi" : "mid" }) + Dots(tubeRows[row].filter((d) => typeof d !== "string"), { size: 0.42, tone: "hi" });
  bundle.push(rowSvg("back"), rowSvg("mid"));
  for (let plateZ = TS_TOP + 14; plateZ < STRAIGHT_TOP - 2; plateZ += 12) {
    bundle.push(S(k.cylinder(C_S[0], C_S[1], WRAP.rIn - 0.1, plateZ, 1.2, P, 96), { tone: "hi", crease: "none" }));
    shapes.push(record(A.cylinder(C_S[0], C_S[1], WRAP.rIn - 0.1, plateZ, 1.2, { name: "sg.support-plate" })));
  }
  bundle.push(rowSvg("front"));
  const svg =
    `<defs>${WIN.clipIn}${WIN.clipOut}${WWIN.clipIn}${WWIN.clipOut}</defs>` +
    `<g class="cav" clip-path="url(#sg-win-in)">${interior.join("")}<g clip-path="url(#sg-wrap-in)">${bundle.join("")}</g>${WWIN.reveals}${WWIN.edges}</g>` +
    WIN.reveals +
    WIN.edges;
  put(piece, [C_S[0] + TV[0] * WRAP.rIn * 0.5, C_S[1] + TV[1] * WRAP.rIn * 0.5, (z0 + z1) / 2], svg, { name: "sg.window", shapes });
  put(piece, [C_S[0] + TV[0] * SG.R, C_S[1] + TV[1] * SG.R, sz(86)], `<g clip-path="url(#sg-win-out)">${S(lower, { tone: "hi", inner: Ln(seams, { tone: "faint" }) })}</g>`, { name: "sg.lower-front", shapes: [frontShape] });
  // cone, upper shell, top head
  const cone = (s) => SG.R + ((SG.rUp - SG.R) * (s - SG.cone[0])) / (SG.cone[1] - SG.cone[0]);
  turned(piece, SGF, [[SG.cone[0], SG.R], [SG.cone[1], SG.rUp]], {}, { name: "sg.cone", smooth: false, inner: G.arcOf(SGF, SG.cone[0] + 0.02, SG.R, P) });
  const UPPER = band(piece, SGF, SG.upper[0], SG.upper[1], SG.rUp, {}, { name: "sg.upper", inner: [168, 200].map((s) => G.arcOf(SGF, s, SG.rUp, P)).join("") });
  const TOP = head(piece, SGF, SG.rUp, SG.topH, SG.upper[1], { top: true, name: "sg.top-head" });
  // upper manway, feedwater nozzle, steam outlet with its flow restrictor flange
  {
    const deg = AZ + 20;
    const face = boss(piece, G.pointOf(SGF, 200, SG.rUp - 0.1, deg * DEG), dir(deg), 4.2, 2.2, { host: UPPER.shape, ring: false, name: "sg.upper-manway-pad" });
    const F = G.frameAlong(face, dir(deg));
    put(piece, G.add3(face, G.mul3(dir(deg), 0.8)), S(G.disc(0, 1.6, 4.6, F, P, { bevel: 0.3 }), { tone: "hi" }) + Dots(G.dotsOf(F, 1.6, 3.6, 16, P, { all: true }), { size: 0.36, tone: "mid" }), { bias: 0.2, name: "sg.upper-manway", shapes: [record(A.disc(F, 0, 1.6, 4.6, { name: "sg.upper-manway" }))] });
  }
  {
    const deg = AZ - 65;
    const point = G.pointOf(SGF, 186, SG.rUp - 0.1, deg * DEG);
    const face = padOn(piece, UPPER.shape, point, dir(deg), 3.4, 3, { name: "sg.feed-pad" });
    const F = G.frameAlong(face, dir(deg));
    put(piece, G.add3(face, G.mul3(dir(deg), 4)), S(G.disc(0, 8, 3.3, F, P), { tone: "hi" }), { bias: 0.15, name: "sg.feed-end", shapes: [record(A.disc(F, 0, 8, 3.3, { name: "sg.feed-end" }))] });
    const end = G.add3(face, G.mul3(dir(deg), 8));
    pipe(piece, [end, G.add3(end, G.mul3(dir(deg), 14))], 2.4, { name: "sg.feedwater", flangeR: 1.35, bolts: 8 });
    const blindAt = G.add3(end, G.mul3(dir(deg), 14));
    const BF = G.frameAlong(blindAt, dir(deg));
    put(piece, G.add3(blindAt, G.mul3(dir(deg), 1.1)), S(G.disc(0, 2.2, 3.3, BF, P, { bevel: 0.3 }), { tone: "hi" }), { bias: 0.3, name: "sg.feed-blind", shapes: [record(A.disc(BF, 0, 2.2, 3.3, { name: "sg.feed-blind" }))] });
  }
  {
    const apex = [C_S[0], C_S[1], sz(SG.upper[1] + SG.topH)];
    const F = G.frameAlong(apex, [0, 0, 1]);
    const padFace = padOn(piece, TOP.shape, G.add3(apex, [0, 0, -0.1]), [0, 0, 1], 5.2, 4, { name: "sg.steam-pad" });
    put(piece, G.add3(padFace, [0, 0, 3]), S(G.disc(0, 6, 5.2, G.frameAlong(padFace, [0, 0, 1]), P), { tone: "hi" }), { bias: 0.15, name: "sg.steam-end", shapes: [record(A.disc(G.frameAlong(padFace, [0, 0, 1]), 0, 6, 5.2, { name: "sg.steam-end" }))] });
    const end = G.add3(padFace, [0, 0, 6]);
    pipe(piece, [end, G.add3(end, [0, 0, 12])], 3.8, { name: "sg.main-steam", flangeR: 1.35, bolts: 12 });
    const blindAt = G.add3(end, [0, 0, 12]);
    const BF = G.frameAlong(blindAt, [0, 0, 1]);
    put(piece, G.add3(blindAt, [0, 0, 1.3]), S(G.disc(0, 2.6, 5.2, BF, P, { bevel: 0.4 }), { tone: "hi" }) + Ln(G.circleOf(BF, 2.6, 2.4, P, 24), { tone: "faint" }), { bias: 0.3, name: "sg.steam-blind", shapes: [record(A.disc(BF, 0, 2.6, 5.2, { name: "sg.steam-blind" }))] });
    void F;
  }
  Object.assign(globalThis, { SG_INLET: inlet, SG_OUTLET: outlet, SG_OUT_NORMAL: outNormal });
}

// ---- reactor coolant pump ----------------------------------------------------------------
{
  const piece = "rcp";
  const CASING = [[0, 0], [0, 10], [2.5, 12.6], [21.5, 12.6], [24, 10], [24, 0]];
  const casing = turned(piece, PF, CASING, {}, { name: "rcp.casing", smooth: false, inner: [8, 16].map((s) => G.arcOf(PF, s, 12.6, P)).join(""), extra: Dots(G.dotsOf(PF, 21.5, 12.6, 24, P, { fade: FADE }), { size: 0.4, tone: "mid" }) });
  // suction from below, discharge toward the cold leg
  const suction = [C_P[0], C_P[1], PUMP_Z];
  put(piece, [C_P[0], C_P[1], PUMP_Z - 3.5], S(G.disc(-7, 0, 6.2, PF, P), { tone: "hi" }), { bias: 0.1, name: "rcp.suction", shapes: [record(A.disc(PF, -7, 0, 6.2, { name: "rcp.suction" }))] });
  const discharge = nozzle(piece, casing.shape, G.pointOf(PF, 12, 12.5, DISCHARGE_DEG * DEG), dir(DISCHARGE_DEG), { r: 8.5, pad: 3, reach: 9, name: "rcp.discharge" });
  // three lugs on the casing and the columns under them
  const LUG_H = 4;
  for (const deg of [DISCHARGE_DEG + 90, DISCHARGE_DEG + 180, DISCHARGE_DEG + 270]) {
    const d = dir(deg);
    const side = [-d[1], d[0], 0];
    const centre = G.add3([C_P[0], C_P[1], PUMP_Z + 12], G.mul3(d, 14.6));
    const ring = [-1, 1].flatMap((a) => [-1, 1].map((b) => [centre[0] + d[0] * a * 2.6 + side[0] * b * 2.6, centre[1] + d[1] * a * 2.6 + side[1] * b * 2.6]));
    const hull = [ring[0], ring[1], ring[3], ring[2]];
    const id = nameFor("rcp.lug");
    put(piece, [centre[0], centre[1], PUMP_Z + 12 - LUG_H / 2 + 2], S(k.extrude(hull, PUMP_Z + 10, LUG_H, P, { bevel: 0.3 }), { tone: "mid" }), { bias: 0.2, name: id, shapes: [record(A.orientedBox([centre[0], centre[1], PUMP_Z + 12], [d, side, [0, 0, 1]], [2.6, 2.6, LUG_H / 2], { name: id, seated: true, cut: [casing.shape] }))] });
    const foot = G.add3([C_P[0], C_P[1], 0], G.mul3(d, 15.6));
    column(piece, foot[0], foot[1], 2.6, PUMP_Z + 10);
  }
  // seal housing, motor stand, motor, flywheel housing
  turned(piece, PF, [[24, 10.4], [27, 10.4]], {}, { name: "rcp.seal-flange", bevel: 0.4, extra: Dots(G.dotsOf(PF, 27, 9, 16, P, { all: true }), { size: 0.4, tone: "mid" }) });
  turned(piece, PF, [[27, 7.6], [38, 7.6]], {}, { name: "rcp.seal-housing", inner: [30, 33, 36].map((s) => G.arcOf(PF, s, 7.6, P)).join("") });
  // coupling access slots in the stand: closed outlines on its face, drawn with the stand
  const slots = [AZ - 40, AZ + 40].map((deg) => {
    const o = G.pointOf(PF, 46, 10.05, deg * DEG);
    const rect = [[-2.2, -3.6], [2.2, -3.6], [2.2, 3.6], [-2.2, 3.6]].map(([a, b]) => G.add3(G.add3(o, G.mul3([0, 0, 1], a)), G.mul3(G.tangentOf(PF, deg * DEG), b)));
    return poly(rect);
  }).join("");
  turned(piece, PF, [[38, 10.6], [40, 10.6], [40, 10], [52, 10], [52, 10.6], [54, 10.6]], {}, { name: "rcp.stand", extra: Ln(slots, { tone: "lo" }) });
  // the motor in three bands, so the cooling fins run from one band end to the other
  const MOTOR = turned(piece, PF, [[54, 9.6], [68, 9.6]], {}, { name: "rcp.motor", inner: G.arcOf(PF, 62, 9.6, P) });
  turned(piece, PF, [[68, 9.6], [82, 9.6]], {}, { name: "rcp.motor-fins", extra: Faded(G.ribsOf(PF, 68, 82, 9.6, 26, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
  turned(piece, PF, [[82, 9.6], [84, 9.6]], {}, { name: "rcp.motor-top" });
  turned(piece, PF, [[84, 11], [90, 11]], {}, { name: "rcp.flywheel", bevel: 0.6, extra: Dots(G.dotsOf(PF, 90, 9.4, 12, P, { all: true }), { size: 0.4, tone: "mid" }) });
  turned(piece, PF, [[90, 5], [96, 5], [96, 2.6], [97.5, 2.6]], {}, { name: "rcp.bearing-cap" });
  // terminal box and oil cooler on the motor
  {
    const deg = AZ - 20;
    const point = G.pointOf(PF, 60, 9.6, deg * DEG);
    const F = G.frameOf(point, dir(deg), [0, 0, 1], G.tangentOf(PF, deg * DEG));
    const face = padOn(piece, MOTOR.shape, point, dir(deg), 2.8, 1.2, { name: "rcp.box-pad", tone: "mid" });
    put(piece, G.add3(face, G.mul3(dir(deg), 2)), S(G.prismOf(G.frameOf(face, dir(deg), [0, 0, 1], G.tangentOf(PF, deg * DEG)), [[-3, -2.4], [3, -2.4], [3, 2.4], [-3, 2.4]], 0, 4, P), { tone: "mid" }), { bias: 0.3, name: "rcp.terminal-box", shapes: [record(A.prism(G.frameOf(face, dir(deg), [0, 0, 1], G.tangentOf(PF, deg * DEG)), [[-3, -2.4], [3, -2.4], [3, 2.4], [-3, 2.4]], 0, 4, { name: "rcp.terminal-box" }))] });
    void F;
  }
  {
    const deg = AZ + 75;
    const point = G.pointOf(PF, 72, 9.6, deg * DEG);
    const F = G.frameOf(point, dir(deg), [0, 0, 1], G.tangentOf(PF, deg * DEG));
    const face = padOn(piece, MOTOR.shape, point, dir(deg), 3.2, 1.2, { name: "rcp.cooler-pad", tone: "mid" });
    const CF = G.frameOf(face, dir(deg), [0, 0, 1], G.tangentOf(PF, deg * DEG));
    // cooling fins on the outer face, each running from the bottom edge to the top edge
    const outer = G.add3(face, G.mul3(dir(deg), 5));
    const tangent = G.tangentOf(PF, deg * DEG);
    const fins = [-1.8, -0.9, 0, 0.9, 1.8].map((v) => k.segment(G.add3(G.add3(outer, G.mul3(tangent, v)), [0, 0, -7]), G.add3(G.add3(outer, G.mul3(tangent, v)), [0, 0, 7]), P)).join("");
    put(piece, G.add3(face, G.mul3(dir(deg), 2.5)), S(G.prismOf(CF, [[-7, -2.6], [7, -2.6], [7, 2.6], [-7, 2.6]], 0, 5, P), { tone: "mid" }) + Ln(fins, { tone: "lo" }), { bias: 0.3, name: "rcp.oil-cooler", shapes: [record(A.prism(CF, [[-7, -2.6], [7, -2.6], [7, 2.6], [-7, 2.6]], 0, 5, { name: "rcp.oil-cooler" }))] });
    void F;
  }
  Object.assign(globalThis, { RCP_SUCTION: G.add3(suction, [0, 0, -7]), RCP_DISCHARGE: discharge });
}

// ---- pressuriser --------------------------------------------------------------------------
{
  const piece = "pzr";
  // the maintenance platform on four columns, with a railing; four saddle legs carry the vessel
  const PLAT_Z = 124;
  for (const deg of [AZ + 45, AZ + 135, AZ + 225, AZ + 315]) {
    const p = polar2(C_Z, 17, deg);
    column(piece, p[0], p[1], 3, PLAT_Z);
  }
  const PLAT = { x: C_Z[0] - 22, y: C_Z[1] - 22, w: 44, d: 44, r: 2 };
  boxAt(piece, PLAT, PLAT_Z, 4, { tone: "mid" }, { name: "pzr.platform", bevel: 0.8, extra: Ln(k.planOutline(k.insetPlan(PLAT, 2.5), PLAT_Z + 4, P, 3), { tone: "faint" }) + Dots(k.corners(PLAT, 4).map(([x, y]) => at([x, y, PLAT_Z + 4])), { size: 0.5 }) });
  const RAIL_Z = PLAT_Z + 4;
  const RAIL_H = 8;
  for (const [x, y] of [...k.corners(PLAT, 2), [PLAT.x + PLAT.w / 2, PLAT.y + 2], [PLAT.x + PLAT.w / 2, PLAT.y + PLAT.d - 2], [PLAT.x + 2, PLAT.y + PLAT.d / 2], [PLAT.x + PLAT.w - 2, PLAT.y + PLAT.d / 2]]) {
    put(piece, [x, y, RAIL_Z + RAIL_H / 2], S(k.cylinder(x, y, 0.45, RAIL_Z, RAIL_H, P, 10), { tone: "mid", crease: "none" }), { bias: 0.2, name: "pzr.post", shapes: [record(A.cylinder(x, y, 0.45, RAIL_Z, RAIL_H, { name: "pzr.post" }))] });
  }
  const railPlan = k.insetPlan(PLAT, 2);
  const railRing = k.ringOf(railPlan, 3).map(([x, y]) => [x, y, RAIL_Z + RAIL_H]);
  tubeItems(piece, [...railRing, railRing[0]], 0.45, { name: "pzr.rail", tone: "mid", maxLength: 12, spacing: 1, touch: ["pzr.post*"], closed: true, ends: [false, false] });
  const HEAD = head(piece, PZF, PZ.r, PZ.headH, 0, { name: "pzr.bottom-head", extra: Dots(G.dotsOf(PZF, 2.2, 7.2, 24, P, { all: true, fade: FADE }), { size: 0.34, tone: "mid" }) });
  for (const deg of [AZ + 45, AZ + 135, AZ + 225, AZ + 315]) {
    const p = polar2(C_Z, 9.5, deg);
    const topZ = PZ_APEX + PZ.headH * (1 - Math.sqrt(1 - (9.5 / PZ.r) ** 2)) + 2.2;
    const id = nameFor("pzr.leg");
    put(piece, [p[0], p[1], RAIL_Z + 1], S(k.cylinder(p[0], p[1], 3.4, RAIL_Z, 2, P, 24), { tone: "mid" }), { name: `${id}.base`, shapes: [record(A.cylinder(p[0], p[1], 3.4, RAIL_Z, 2, { name: `${id}.base` }))] });
    put(piece, [p[0], p[1], (RAIL_Z + 2 + topZ) / 2], S(k.cylinder(p[0], p[1], 2.4, RAIL_Z + 2, topZ - RAIL_Z - 2, P, 20), { tone: "mid", crease: "none" }), { name: id, shapes: [record(A.cylinder(p[0], p[1], 2.4, RAIL_Z + 2, topZ - RAIL_Z - 2, { name: id, seated: true, cut: [HEAD.shape] }))] });
  }
  // surge nozzle under the apex
  const surgeFace = [C_Z[0], C_Z[1], PZ_APEX - 6];
  put(piece, [C_Z[0], C_Z[1], PZ_APEX - 3], S(G.disc(-6, 0.2, 3.6, PZF, P), { tone: "hi" }), { bias: 0.2, name: "pzr.surge-nozzle", shapes: [record(A.disc(PZF, -6, 0.2, 3.6, { name: "pzr.surge-nozzle", owner: "loop.surge-fittings" }))] });
  // shell with the level window
  const [w0, w1] = PZ.win;
  const z0 = pz(w0);
  const z1 = pz(w1);
  const shell = G.solidOf([[PZ.shell[0], PZ.r], [PZ.shell[1], PZ.r]], PZF, P, { smooth: false, steps: 72 });
  const seams = [50, 90].map((s) => G.arcOf(PZF, s, PZ.r, P)).join("");
  const backShape = record(A.ring(PZF, PZ.shell[0], PZ.shell[1], PZ.rIn, PZ.r, { name: "pzr.shell-back", cut: [halfSpaceBox(C_Z, pz(PZ.shell[0]), pz(PZ.shell[1]), 1)] }));
  const frontShape = record(A.ring(PZF, PZ.shell[0], PZ.shell[1], PZ.rIn, PZ.r, { name: "pzr.shell-front", cut: [halfSpaceBox(C_Z, pz(PZ.shell[0]), pz(PZ.shell[1]), -1), windowBox(C_Z, PZ.rIn, PZ.r, z0, z1, PZ.half)] }));
  put(piece, [C_Z[0] - TV[0] * PZ.r, C_Z[1] - TV[1] * PZ.r, pz(72)], S(shell, { tone: "hi", inner: Ln(seams, { tone: "faint" }) }), { name: "pzr.shell-back", shapes: [backShape] });
  const WIN = windowOf(C_Z, PZ.rIn, PZ.r, z0, z1, PZ.half, "pzr-win");
  const interior = [];
  const shapes = [];
  interior.push(S(k.cylinder(C_Z[0], C_Z[1], PZ.rIn, z0 - 4, z1 - z0 + 12, P, 72), { tone: "mid", crease: "none" }));
  // heater elements standing up from the bottom head
  const heaters = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const x = i * 2.4 + (j % 2 ? 1.2 : 0);
    const y = j * 2.1;
    const rho = Math.hypot(x, y);
    if (rho > 8.2 || y < -0.5) continue;
    heaters.push([C_Z[0] + UX[0] * x + TV[0] * y, C_Z[1] + UX[1] * x + TV[1] * y, rho]);
  }
  heaters.sort((a, b) => k.depthOf(a, P) - k.depthOf(b, P));
  for (const [x, y, rho] of heaters) {
    const zb = PZ_APEX + PZ.headH * (1 - Math.sqrt(Math.max(0, 1 - (rho / PZ.r) ** 2))) - 0.2;
    interior.push(S(k.cylinder(x, y, 0.42, zb, pz(46) - zb, P, 10), { tone: "hi", crease: "none" }));
    // the part seen through the window belongs to the window item; the hidden stub below it only holds it up
    shapes.push(record(A.cylinder(x, y, 0.42, z0, pz(46) - z0, { name: "pzr.heater" })));
    record(A.cylinder(x, y, 0.42, zb, z0 - zb, { name: "pzr.heater-stub", piece, seated: true, cut: [HEAD.shape] }));
  }
  // the spray head hanging from the top head into the steam space
  {
    const SPRAY_TOP = pz(PZ.top[0] + PZ.headH) + 0.1;
    const bottom = z1 - 17;
    interior.push(S(k.cylinder(C_Z[0], C_Z[1], 1.1, bottom + 1.6, SPRAY_TOP - bottom - 1.6, P, 14), { tone: "hi", crease: "none" }));
    interior.push(S(k.cylinder(C_Z[0], C_Z[1], 2.2, bottom, 1.6, P, 20), { tone: "hi" }) + Dots(G.dotsOf(G.frameOf([C_Z[0], C_Z[1], bottom], [0, 0, -1], [1, 0, 0], [0, -1, 0]), 0, 1.4, 8, P, { all: true }), { size: 0.3, tone: "mid" }));
    shapes.push(record(A.cylinder(C_Z[0], C_Z[1], 1.1, bottom + 1.6, z1 - bottom - 1.6, { name: "pzr.spray-pipe" })));
    shapes.push(record(A.cylinder(C_Z[0], C_Z[1], 2.2, bottom, 1.6, { name: "pzr.spray-head" })));
    record(A.cylinder(C_Z[0], C_Z[1], 1.1, z1, pz(PZ.top[0]) - z1, { name: "pzr.spray-pipe-stub", piece }));
  }
  const LEVEL0 = z0 + 0.4 * (z1 - z0);
  const water = `<g data-part="water" class="water">${S(k.cylinder(C_Z[0], C_Z[1], PZ.rIn, z0 - 4, LEVEL0 + SWELL - (z0 - 4), P, 72), { tone: "hi", crease: "none" })}${Ln(k.ring(C_Z[0], C_Z[1], PZ.rIn, LEVEL0 + SWELL, P, 72), { tone: "mid" })}</g>`;
  interior.push(water);
  const svg = `<defs>${WIN.clipIn}${WIN.clipOut}</defs><g class="cav" clip-path="url(#pzr-win-in)">${interior.join("")}</g>${WIN.reveals}${WIN.edges}`;
  put(piece, [C_Z[0] + TV[0] * PZ.rIn * 0.5, C_Z[1] + TV[1] * PZ.rIn * 0.5, (z0 + z1) / 2], svg, { name: "pzr.window", shapes });
  put(piece, [C_Z[0] + TV[0] * PZ.r, C_Z[1] + TV[1] * PZ.r, pz(72)], `<g clip-path="url(#pzr-win-out)">${S(shell, { tone: "hi", inner: Ln(seams, { tone: "faint" }) })}</g>`, { name: "pzr.shell-front", shapes: [frontShape] });
  // level taps outside the window, each with a forged elbow, joined by a sense line down the shell
  const TAP_DEG = AZ + 62;
  const TAP_S = [26, 118];
  const SHELL_HOSTS = [backShape, frontShape];
  const tapBalls = TAP_S.map((s) => {
    const face = boss(piece, G.pointOf(PZF, s, PZ.r - 0.1, TAP_DEG * DEG), dir(TAP_DEG), 1.3, 2.4, { host: SHELL_HOSTS, name: "pzr.tap", ring: false, owner: "pzr.tap" });
    const centre = elbowBall(face, dir(TAP_DEG), 1.3, 1.5);
    ballAt(piece, centre, 1.5, { tone: "hi", name: "pzr.tap-elbow", owner: "pzr.tap", flat: [G.mul3(dir(TAP_DEG), -1), Math.sqrt(1.5 ** 2 - 1.3 ** 2)] });
    return centre;
  });
  const TOP = head(piece, PZF, PZ.r, PZ.headH, PZ.top[0], { top: true, name: "pzr.top-head" });
  // top: manway, spray nozzle with its valve and blind flange, three safety valves on a header
  {
    const apex = [C_Z[0], C_Z[1], pz(144)];
    const mwFace = padOn(piece, TOP.shape, G.add3(apex, [0, 0, -0.1]), [0, 0, 1], 4.2, 2.4, { name: "pzr.manway-pad" });
    const F = G.frameAlong(mwFace, [0, 0, 1]);
    put(piece, G.add3(mwFace, [0, 0, 0.9]), S(G.disc(0, 1.8, 4.6, F, P, { bevel: 0.3 }), { tone: "hi" }) + Dots(G.dotsOf(F, 1.8, 3.6, 16, P, { all: true }), { size: 0.36, tone: "mid" }), { bias: 0.2, name: "pzr.manway", shapes: [record(A.disc(F, 0, 1.8, 4.6, { name: "pzr.manway" }))] });
  }
  const topAt = (deg, rho) => {
    const sTop = PZ.headH * Math.sqrt(Math.max(0, 1 - (rho / PZ.r) ** 2));
    const s = PZ.top[0] + sTop;
    const slope = headSlope(PZ.r, PZ.headH, true)(sTop);
    const point = G.pointOf(PZF, s - 0.05, rho, deg * DEG);
    const normal = G.unit3(G.sub3(G.radialOf(PZF, deg * DEG), G.mul3(PZF.a, slope)));
    return { point, normal };
  };
  {
    const { point, normal } = topAt(AZ + 120, 8.5);
    const face = padOn(piece, TOP.shape, point, normal, 2.4, 2.6, { name: "pzr.spray-pad" });
    const F = G.frameAlong(face, normal);
    const end = G.add3(face, G.mul3(normal, 8));
    put(piece, G.add3(face, G.mul3(normal, 4)), S(G.disc(0, 8, 1.7, F, P), { tone: "hi" }), { bias: 0.15, name: "pzr.spray-stub", shapes: [record(A.disc(F, 0, 8, 1.7, { name: "pzr.spray-stub" }))] });
    const far = G.add3(end, G.mul3(normal, 16));
    const line = pipe(piece, [end, far], 1.2, { name: "pzr.spray", flangeR: 1.45, bolts: 6 });
    void line;
    const BF = G.frameAlong(far, normal);
    put(piece, G.add3(far, G.mul3(normal, 0.8)), S(G.disc(0, 1.6, 1.9, BF, P, { bevel: 0.2 }), { tone: "hi" }), { bias: 0.3, name: "pzr.spray-blind", shapes: [record(A.disc(BF, 0, 1.6, 1.9, { name: "pzr.spray-blind" }))] });
  }
  const valveOutlets = [];
  for (const deg of [AZ + 60, AZ + 180, AZ + 300]) {
    const { point, normal } = topAt(deg, 7.4);
    const face = padOn(piece, TOP.shape, point, normal, 2.2, 1.6, { name: "pzr.valve-pad" });
    const F = G.frameAlong(face, normal);
    // an elliptical bulge on a 1.5 neck, analytic so the shading has no scallops
    const bulge = (s) => 1.5 + 1.1 * Math.sqrt(Math.max(0, 1 - ((s - 4.2) / 3.4) ** 2));
    const bulgeSlope = (s) => {
      const t = Math.max(-0.995, Math.min(0.995, (s - 4.2) / 3.4));
      return (-1.1 * t) / (3.4 * Math.sqrt(1 - t * t));
    };
    const body = [[0, 0], [0, 1.5], ...Array.from({ length: 17 }, (_, index) => {
      const s = 4.2 + 3.4 * Math.sin(((index - 8) / 8) * (Math.PI / 2));
      return [Number(s.toFixed(3)), Number(bulge(s).toFixed(3)), index && index < 16 ? 1 : 0];
    }), [8.4, 1.5], [8.4, 0]];
    const id = nameFor("pzr.safety-valve");
    put(piece, G.add3(face, G.mul3(normal, 4.2)), S(G.lathe(body, F, P, { steps: 28, smooth: { slope: bulgeSlope, rows: 3 } })) + Dots(G.dotsOf(F, 8.4, 1.1, 6, P, { all: true }), { size: 0.3, tone: "mid" }), { bias: 0.2, name: id, shapes: [record(A.body(F, body, { name: id }))] });
    valveOutlets.push({ face, normal, deg });
  }
  void valveOutlets;
  // sense line between the two tap elbows, clamped to the shell, with a branch from a tee to the
  // level transmitter on the platform
  {
    const d = dir(TAP_DEG);
    const SENSE_R = 0.55;
    const LANE_RHO = Math.hypot(tapBalls[0][0] - C_Z[0], tapBalls[0][1] - C_Z[1]);
    const lane = (s) => G.pointOf(PZF, s, LANE_RHO, TAP_DEG * DEG);
    const drop = Math.sqrt(1.5 ** 2 - SENSE_R ** 2);
    const start = G.add3(tapBalls[1], [0, 0, -drop]);
    const end = G.add3(tapBalls[0], [0, 0, drop]);
    const TEE_S = 60;
    const tee = lane(TEE_S);
    const TEE_R = 1.15;
    const total = start[2] - end[2];
    const teeAt = start[2] - tee[2];
    const teeGap = Math.sqrt(TEE_R ** 2 - SENSE_R ** 2);
    const clampS = [40, 82, 104];
    const CLAMP_HALF = 0.9;
    const gaps = [[teeAt - teeGap, teeAt + teeGap], ...clampS.map((s) => [start[2] - pz(s) - CLAMP_HALF - 0.05, start[2] - pz(s) + CLAMP_HALF + 0.05])];
    void total;
    tubeItems(piece, [start, end], SENSE_R, { name: "pzr.sense", tone: "mid", maxLength: 14, spacing: 1, touch: ["pzr.clamp*"], bundle: "pzr-sense", gaps });
    ballAt(piece, tee, TEE_R, { tone: "mid", name: "pzr.sense-tee", owner: "pzr.sense" });
    for (const s of clampS) {
      const centre = lane(s);
      const F = G.frameAlong(centre, [0, 0, 1]);
      put(piece, centre, S(G.disc(-CLAMP_HALF, CLAMP_HALF, 1.2, F, P), { tone: "mid" }), { bias: 0.3, name: "pzr.clamp", shapes: [record(A.disc(F, -CLAMP_HALF, CLAMP_HALF, 1.2, { name: "pzr.clamp", anchor: false, fitting: true, bundle: "pzr-sense" }))] });
      const stud = G.pointOf(PZF, s, PZ.r - 0.1, TAP_DEG * DEG);
      boss(piece, stud, d, 0.6, LANE_RHO - 1.2 - (PZ.r - 0.1), { host: SHELL_HOSTS, ring: false, name: "pzr.clamp-stud", tone: "mid" });
    }
    // the branch leaves the tee sideways, runs down beside the lane and ends on the transmitter box on the platform
    const BR_DEG = TAP_DEG + 11;
    const boxCentre = polar2(C_Z, 17.3, BR_DEG);
    const box = { x: boxCentre[0] - 2.6, y: boxCentre[1] - 2, w: 5.2, d: 4, r: 0.6 };
    boxAt(piece, box, PLAT_Z + 4, 5, { tone: "mid" }, { name: "pzr.transmitter", bevel: 0.3, extra: Ln(k.planOutline(k.insetPlan(box, 0.7), PLAT_Z + 9, P, 2), { tone: "faint" }) + Dots([at([box.x + 0.9, box.y + 0.9, PLAT_Z + 9]), at([box.x + box.w - 0.9, box.y + box.d - 0.9, PLAT_Z + 9])], { size: 0.38 }) });
    const port = [...polar2(C_Z, LANE_RHO, BR_DEG), PLAT_Z + 9];
    const p1 = G.pointOf(PZF, TEE_S - 4, LANE_RHO, BR_DEG * DEG);
    const branchStart = onBall(tee, p1, TEE_R, SENSE_R);
    tubeItems(piece, G.fillet([branchStart, p1, port], 2.2, 10, { P, tube: SENSE_R }), SENSE_R, { name: "pzr.sense-branch", tone: "mid", maxLength: 14, spacing: 1, bundle: "pzr-sense" });
    put(piece, port, Dots([at(port)], { size: 0.5, tone: "hi" }), { bias: 0.4, name: "pzr.sense-dot", shapes: [A.ball(port, 0.5 / KS)] });
  }
  Object.assign(globalThis, { PZR_SURGE_FACE: surgeFace });
}

// ---- main coolant lines ------------------------------------------------------------------
{
  const piece = "loop";
  const hot = pipe(piece, [RPV_OUTLET, SG_INLET], PIPE_R, { name: "loop.hot-leg", bands: [0.5], maxLength: 14 });
  const cold = pipe(piece, [RPV_INLET, [...polar2(C_R, 60, COLD_DEG), NOZ_Z], RCP_DISCHARGE], PIPE_R, { name: "loop.cold-leg", bands: [0.3, 0.72], maxLength: 14 });
  const n = SG_OUT_NORMAL;
  const p1 = G.add3(SG_OUTLET, G.mul3(n, 16));
  const bottom = 40;
  const p2 = [p1[0], p1[1], bottom];
  const p3 = [C_P[0], C_P[1], bottom];
  const cross = pipe(piece, [SG_OUTLET, p1, p2, p3, RCP_SUCTION], PIPE_R, { name: "loop.crossover", bands: [0.5], maxLength: 14 });
  void cold;
  void cross;
  // surge line: a pad on top of the hot leg, a forged elbow, one sloping run to an elbow under the pressuriser
  const hotRuns = R.tubes.filter((tube) => tube.owner === hot.owner);
  const teeAt = G.pointAlong(hot, G.pathLength(hot) * 0.32);
  const padFace = padOn(piece, hotRuns, [teeAt[0], teeAt[1], teeAt[2] + PIPE_R - 0.1], [0, 0, 1], 3.2, 4.4, { name: "loop.surge-pad", owner: "loop.surge-fittings" });
  const BALL = 3.8;
  const lowBall = elbowBall(padFace, [0, 0, 1], 3.2, BALL);
  const highBall = elbowBall(PZR_SURGE_FACE, [0, 0, -1], 3.6, BALL);
  ballAt(piece, lowBall, BALL, { tone: "hi", name: "loop.surge-elbow", owner: "loop.surge-fittings", flat: [[0, 0, -1], Math.sqrt(BALL ** 2 - 3.2 ** 2)] });
  ballAt(piece, highBall, BALL, { tone: "hi", name: "loop.surge-elbow", owner: "loop.surge-fittings", flat: [[0, 0, 1], Math.sqrt(BALL ** 2 - 3.6 ** 2)] });
  pipe(piece, [onBall(lowBall, highBall, BALL, SURGE_R), onBall(highBall, lowBall, BALL, SURGE_R)], SURGE_R, { name: "loop.surge-line", flanges: [false, false], bands: [0.3, 0.62], maxLength: 16 });
}

// ---- assemble the page -------------------------------------------------------------------
// a cut box belongs to the piece of the shape it cuts
for (const shape of R.solids) if (shape.cut) for (const cut of [shape.cut].flat()) if (cut.piece === undefined) cut.piece = shape.piece;
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-i="${index}">${item.svg}</g>`);

const LABEL_TEXT =
  "A sectioned bench model of one loop of the Olkiluoto 3 EPR on a base plate with a metre ruler: the reactor vessel with its head of 89 control rod drives, cut open to show the fuel assemblies and the rod clusters above them; the hot leg to a 23 m steam generator cut open to show its tubesheet and U-tubes; the crossover leg looping down into the reactor coolant pump under its motor; the cold leg back to the vessel; and the pressuriser on its platform, cut open to show its water level and heaters, hung on the hot leg by its surge line.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, ...groups] });

const WATER = { cx: C_Z[0], cy: C_Z[1], r: PZ.rIn, z0: pz(PZ.win[0]) - 4, base: pz(PZ.win[0]) + 0.4 * (PZ.win[1] - PZ.win[0]), swell: SWELL };
const DATA = { P, WATER, ROD_TRAVEL, MWTH, T_STANDBY, T_HOT, T_COLD };

const LIVE = `
const DATA = __DATA__;
const { P, WATER, ROD_TRAVEL, MWTH, T_STANDBY, T_HOT, T_COLD } = DATA;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const rods = svg.querySelector('[data-part="rods"]');
const water = svg.querySelector('[data-part="water"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let power = 1, target = 1, shown = -1;
let frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
const TOUR = [[0, 1], [3, 1], [9, 0], [12, 0], [18, 1]];
const tourAt = (t) => {
  const span = TOUR[TOUR.length - 1][0];
  const x = t % span;
  for (let i = 1; i < TOUR.length; i++) {
    const [t0, v0] = TOUR[i - 1], [t1, v1] = TOUR[i];
    if (x <= t1) { const f = (x - t0) / (t1 - t0); const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; return v0 + (v1 - v0) * e; }
  }
  return TOUR[TOUR.length - 1][1];
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");
function draw() {
  if (Math.abs(power - shown) < 0.0005) return;
  shown = power;
  const lift = (power - 1) * ROD_TRAVEL;
  if (lift === 0) rods.removeAttribute("transform"); else rods.setAttribute("transform", translateAlong(P, [0, 0, lift]));
  const level = WATER.base + WATER.swell * power;
  water.innerHTML = solidSvg(cylinder(WATER.cx, WATER.cy, WATER.r, WATER.z0, level - WATER.z0, P, 72), { tone: "hi", crease: "none" }) + lineSvg(ring(WATER.cx, WATER.cy, WATER.r, level, P, 72), { tone: "mid" });
  const hot = T_STANDBY + (T_HOT - T_STANDBY) * power;
  const cold = T_STANDBY + (T_COLD - T_STANDBY) * power;
  const pct = Math.round(power * 100);
  const text = pct === 0 ? "hot standby · 0 MWth · " + hot.toFixed(0) + " °C both legs" : pct + " % · " + fmt(MWTH * power) + " MWth · hot " + hot.toFixed(0) + " °C · cold " + cold.toFixed(0) + " °C";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(pct));
  stage.setAttribute("aria-valuetext", pct === 0 ? "Hot standby, rods in, " + hot.toFixed(0) + " degrees in both legs" : pct + " percent power, hot leg " + hot.toFixed(0) + " degrees, cold leg " + cold.toFixed(0) + " degrees");
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = tourAt(clock); }
  power = calm ? target : power + (target - power) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(target - power) < 0.0008) power = target;
  draw();
  const settled = !touring && power === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, 0, 1); clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 3; run(); }, 3600); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(clamp(((event.clientX - box.left) / box.width - 0.18) / 0.64, 0, 1));
});
stage.addEventListener("pointerleave", () => steer(target));
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 0.25 : 0.05;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (to === null) return;
  event.preventDefault();
  steer(Math.round(to * 100) / 100);
});
draw();
`.replace("__DATA__", JSON.stringify(DATA));

const CSS = `
.pl .cav { --anatomy-paper: #e4e4e0; --anatomy-face: #ebebe7; --anatomy-top: #ecece8; --anatomy-shade-0: #c6c6c2; --anatomy-shade-1: #cfcfcb; --anatomy-shade-2: #d7d7d3; --anatomy-shade-3: #dededa; --anatomy-hi: #3a3a3e; --anatomy-mid: #85858a; --anatomy-lo: #a6a6aa; --anatomy-faint: #bdbdc0; }
.iso[data-theme="dark"] .pl .cav { --anatomy-paper: #0a0a0a; --anatomy-face: #101010; --anatomy-top: #111111; --anatomy-shade-0: #070707; --anatomy-shade-1: #0a0a0a; --anatomy-shade-2: #0d0d0d; --anatomy-shade-3: #0f0f0f; --anatomy-hi: #bdbdbd; --anatomy-mid: #5a5a5a; --anatomy-lo: #343434; --anatomy-faint: #222222; }
.pl .water { --anatomy-paper: #cfd8df; --anatomy-face: #d9e1e7; --anatomy-top: #e3eaef; --anatomy-shade-0: #aeb9c2; --anatomy-shade-1: #b8c3cb; --anatomy-shade-2: #c2ccd4; --anatomy-shade-3: #c9d3da; --anatomy-mid: #6f7f8c; mix-blend-mode: multiply; }
.iso[data-theme="dark"] .pl .water { --anatomy-paper: #16232e; --anatomy-face: #1a2a37; --anatomy-top: #1f3242; --anatomy-shade-0: #101a22; --anatomy-shade-1: #131f29; --anatomy-shade-2: #162430; --anatomy-shade-3: #192936; --anatomy-mid: #4e6b80; mix-blend-mode: normal; }
.pl .iso-stage { outline: none; touch-action: pan-y; cursor: ew-resize; }
.pl .iso-stage:focus-visible { outline: 1px solid var(--anatomy-muted); outline-offset: 6px; }
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "EPR · one loop",
  hint: "Hover to move the control rods",
  readout: `100 % · ${MWTH.toLocaleString("en-US")} MWth · hot ${T_HOT} °C · cold ${T_COLD} °C`,
  keys: [
    { mark: "lit", label: "Control rod bank: the drive rods and absorber clusters that set the power" },
    { mark: "raised", label: "Primary circuit at 155 bar: vessel, hot leg, steam generator, crossover leg, pump, cold leg, pressuriser" },
    { mark: "dim", label: "Windows cut into the vessel, the steam generator and the pressuriser" },
  ],
  caption:
    "One of the four loops of the Olkiluoto 3 EPR, from TVO's data sheet. Water at 155 bar leaves the core at 328 °C, crosses the hot leg into a 23 m steam generator, gives its heat to 5,980 tubes that boil the secondary water at 78 bar, and comes back through the pump at 296 °C, 28,330 m³ an hour per loop. The pressuriser, hung on the hot leg by its surge line, holds the pressure with 108 heaters and a spray fed from the cold legs, so the primary water never boils. Hover to move the rods: 89 clusters with a travel of 4.1 m set the power, the temperature rise across the 4.2 m core follows it, and the water that swells as the loop warms rises in the pressuriser.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="One EPR loop. Move the pointer across the figure or use the arrow keys to set the reactor power from hot standby to full power; Home and End jump to the ends." aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">${svg}</div>`,
});

const page = k.pageHtml({ title: "EPR · one loop", theme: THEME, body: `<style>${CSS}</style><div class="pl">${body}</div>`, script: kitScript() + LIVE, width: 980 });
const name = THEME === "light" ? "pwr-loop-light.html" : "pwr-loop.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`);

A.auditOrExit(R, P);
