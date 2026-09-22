// Locally cached, credited EVE UI clips. Audio never changes simulation timing.
const KEY = 'eve-war-council-audio-v1';
let muted = false;
try { muted = localStorage.getItem(KEY) === 'muted'; } catch {}
const clips = new Map();
export function isMuted() { return muted; }
export function toggleAudio() {
  muted = !muted;
  try { localStorage.setItem(KEY, muted ? 'muted' : 'on'); } catch {}
  if (muted) for (const clip of clips.values()) clip.pause();
  return muted;
}
export function sound(name = 'interface') {
  if (muted || document.hidden) return;
  try {
    if (!clips.has(name)) {
      const clip = new Audio(new URL(`./assets/sounds/${name}.mp3`, import.meta.url));
      clip.volume = 0.18;
      clips.set(name, clip);
    }
    const clip = clips.get(name);
    clip.currentTime = 0;
    clip.play().catch(() => {});
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) for (const clip of clips.values()) clip.pause();
});
