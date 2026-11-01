// Image de la vue capot calculée par lancer de rayons, avec les faces vues à l'envers en magenta.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import {
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { buildCarGeometry } from "../src/render/car/buildCarGeometry";
import { defaultLivery } from "../src/render/car/livery";

const [out, yArg, zArg, fovArg] = process.argv.slice(2);
const WIDTH = 380;
const HEIGHT = 200;
const cam = new Vector3(0, Number(yArg ?? 0.58), Number(zArg ?? -0.55));
const fov = (Number(fovArg ?? 76) * Math.PI) / 180;

const car = buildCarGeometry(defaultLivery);
const color = car.body.getAttribute("color");
const front = new Mesh(car.body, new MeshBasicMaterial({ side: FrontSide }));
const both = new Mesh(car.body, new MeshBasicMaterial({ side: DoubleSide }));
const ray = new Raycaster();
ray.near = 0.1; // comme la caméra du jeu
const light = new Vector3(0.3, 0.9, 0.3).normalize();

const pixels = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
let culled = 0;
let bodyPixels = 0;
const culledFaces = new Map<
  number,
  { count: number; y: number; z: number; nx: number; ny: number; nz: number }
>();
for (let py = 0; py < HEIGHT; py++) {
  const rowAt = py * (WIDTH * 3 + 1);
  for (let px = 0; px < WIDTH; px++) {
    const ndcY = 1 - (py + 0.5) * (2 / HEIGHT);
    const ndcX = (px + 0.5) * (2 / WIDTH) - 1;
    const tan = Math.tan(fov / 2);
    const dir = new Vector3(
      ndcX * tan * (WIDTH / HEIGHT),
      ndcY * tan,
      -1,
    ).normalize();
    ray.set(cam, dir);
    const hitBoth = ray.intersectObject(both)[0];
    const hitFront = ray.intersectObject(front)[0];
    let rgb = ndcY > -0.1 ? [233, 203, 160] : [85, 86, 91];
    if (hitBoth?.face) {
      bodyPixels++;
      const visibleWrong =
        !hitFront || hitBoth.distance < hitFront.distance - 1e-4;
      if (visibleWrong) {
        culled++;
        rgb = [255, 0, 255];
        const id = hitBoth.faceIndex ?? -1;
        const entry = culledFaces.get(id) ?? {
          count: 0,
          y: hitBoth.point.y,
          z: hitBoth.point.z,
          nx: hitBoth.face.normal.x,
          ny: hitBoth.face.normal.y,
          nz: hitBoth.face.normal.z,
        };
        entry.count++;
        culledFaces.set(id, entry);
      } else if (hitFront?.face) {
        const a = hitFront.face.a;
        const shade =
          0.45 + 0.55 * Math.max(0, hitFront.face.normal.dot(light));
        rgb = [color.getX(a), color.getY(a), color.getZ(a)].map((v) =>
          Math.round(255 * Math.pow(v, 1 / 2.2) * shade),
        );
      }
    }
    pixels.set(rgb, rowAt + 1 + px * 3);
  }
}
console.log(`pixels caisse ${bodyPixels}, vus à l'envers ${culled}`);
console.log(
  [...culledFaces.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(
      ([id, f]) =>
        `face ${id}: ${f.count} px y=${f.y.toFixed(2)} z=${f.z.toFixed(2)} n=(${f.nx.toFixed(2)},${f.ny.toFixed(2)},${f.nz.toFixed(2)})`,
    )
    .join("\n"),
);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b: Buffer): number => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(WIDTH, 0);
header.writeUInt32BE(HEIGHT, 4);
header[8] = 8;
header[9] = 2;
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
