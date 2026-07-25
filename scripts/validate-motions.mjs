import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const expected = new Map([
  ["public/motions/01-observe.vrma", "d1bcd9bb782398a8959cc9a7c70e147c0fb17ecfa995650082e24c091224471e"],
  ["public/motions/02-accuse.vrma", "c3f3a709a632131a378f693f6c6eacafeba14ac2bd348c6d32b229e5f86c2a53"],
  ["public/motions/03-deny.vrma", "0dc103d21cd67df3ca5fe9e62b5bd8b33c220a437638b98d05351fa6b168ca72"],
  ["public/motions/04-victory.vrma", "8eeff69c92f5731a8d3076cd09648b3db2cec92322b05f0ab65abc11178710d8"],
  ["public/motions/05-idle-breathe.vrma", "faaa9c6c71f2e31b160be15cf2c81e3455e927572a08683b9a6b7da8adfc01be"],
  ["public/motions/06-idle-listen.vrma", "455a591d94b5c0c353f87ce3861989e37245f1237dce415387e58ce1b0a5cf44"],
  ["public/motions/07-idle-suspicion.vrma", "1334ed468ead8a6810326ebab340005e1d250492e63147b6979afab7f7b7d05e"],
  ["public/motions/08-talk-calm.vrma", "29e37e3cabcc378aa711d898325e43559380b8968bf35fd6980ecdbd25de51a3"],
  ["public/motions/09-talk-whisper.vrma", "1aec6433aa462a74a6dca39149f42d204a3ec5d44c91459cf5d4995d3963b308"],
  ["public/motions/10-talk-press.vrma", "e2796501f1590060c4e595efb75744532f266edba8b9047f2cd17bd01c00af14"],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer, file) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  assert(view.getUint32(0, true) === 0x46546c67, `${file}: invalid GLB magic`);
  assert(view.getUint32(4, true) === 2, `${file}: expected GLB 2.0`);
  assert(view.getUint32(8, true) === buffer.byteLength, `${file}: length mismatch`);
  const jsonLength = view.getUint32(12, true);
  assert(view.getUint32(16, true) === 0x4e4f534a, `${file}: missing JSON chunk`);
  return JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)).trim());
}

for (const [path, expectedHash] of expected) {
  const bytes = await readFile(resolve(path));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const gltf = parseGlb(bytes, path);
  const extension = gltf.extensions?.VRMC_vrm_animation;
  const animation = gltf.animations?.[0];

  assert(hash === expectedHash, `${path}: differs from the corrected Yonagi Noa source`);
  assert(extension?.specVersion === "1.0", `${path}: expected VRMA 1.0`);
  assert(extension.humanoid?.humanBones?.hips, `${path}: hips mapping missing`);
  assert(Object.keys(extension.humanoid.humanBones).length >= 20, `${path}: incomplete humanoid map`);
  assert(animation?.channels?.length > 0, `${path}: animation has no channels`);
  console.log(`OK ${basename(path)}: ${animation.channels.length} channels, source hash verified`);
}
