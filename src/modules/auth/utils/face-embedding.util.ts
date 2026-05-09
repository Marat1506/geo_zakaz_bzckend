export const FACE_EMBEDDING_DIM = 128;

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function averageDescriptors(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('averageDescriptors: empty vectors');
  }
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      out[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    out[i] /= vectors.length;
  }
  return out;
}

export function isValidDescriptor(d: unknown): d is number[] {
  if (!Array.isArray(d) || d.length !== FACE_EMBEDDING_DIM) {
    return false;
  }
  return d.every((x) => typeof x === 'number' && Number.isFinite(x));
}

/** Parse JSON field from multipart registration (string or already parsed array). */
export function parseFaceDescriptorsJson(raw: unknown): number[][] | null {
  if (raw == null || raw === '') {
    return null;
  }
  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    parsed = raw;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }
  const out: number[][] = [];
  for (const row of parsed) {
    if (!Array.isArray(row)) {
      return null;
    }
    const nums = row.map((x) => Number(x));
    out.push(nums);
  }
  return out;
}
