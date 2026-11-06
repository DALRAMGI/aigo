import { Directory, File, Paths } from 'expo-file-system';

export type SceneLocation = { lat: number; lng: number };
export type ScenePhoto = { id: string; uri: string; takenAt: string; location: SceneLocation | null };

// 목록에는 파일 이름만 저장한다. iOS는 앱 경로가 바뀔 수 있어 uri는 읽을 때 만든다.
type Entry = { id: string; name: string; takenAt: string; location: SceneLocation | null };

const dir = () => new Directory(Paths.document, 'scene');
const indexFile = () => new File(dir(), 'photos.json');
const insurerFile = () => new File(dir(), 'insurer.txt');

function readEntries(): Entry[] {
  try {
    const f = indexFile();
    if (!f.exists) return [];
    const data = JSON.parse(f.textSync());
    // 깨진 목록은 빈 목록으로 본다. 앱이 죽는 것보다 낫다.
    return Array.isArray(data) ? data.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: Entry[]) {
  dir().create({ idempotent: true, intermediates: true });
  indexFile().write(JSON.stringify(entries));
}

const toPhoto = (e: Entry): ScenePhoto => ({
  id: e.id,
  uri: new File(dir(), e.name).uri,
  takenAt: e.takenAt,
  location: e.location ?? null,
});

export async function addScenePhoto(uri: string, takenAt: string, location: SceneLocation | null): Promise<ScenePhoto> {
  dir().create({ idempotent: true, intermediates: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: Entry = { id, name: `${id}.jpg`, takenAt, location };
  new File(uri).copy(new File(dir(), entry.name));
  writeEntries([...readEntries(), entry]);
  return toPhoto(entry);
}

export async function listScenePhotos(): Promise<ScenePhoto[]> {
  return readEntries()
    .sort((a, b) => (a.takenAt < b.takenAt ? 1 : a.takenAt > b.takenAt ? -1 : 0))
    .map(toPhoto);
}

export async function deleteScenePhoto(id: string): Promise<void> {
  const entries = readEntries();
  const target = entries.find((e) => e.id === id);
  if (!target) return;
  const f = new File(dir(), target.name);
  if (f.exists) f.delete();
  writeEntries(entries.filter((e) => e.id !== id));
}

export async function getInsurerPhone(): Promise<string | null> {
  try {
    const f = insurerFile();
    return f.exists ? f.textSync().trim() || null : null;
  } catch {
    return null;
  }
}

export async function setInsurerPhone(phone: string): Promise<void> {
  const p = phone.trim();
  if (!p) throw new Error('보험사 번호를 입력해 주세요.');
  dir().create({ idempotent: true, intermediates: true });
  insurerFile().write(p);
}
