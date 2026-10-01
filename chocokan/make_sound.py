"""Generate the 15s soundtrack for チョコ鑑: BGM + SFX + narration, synced to chocokan/index.html."""
import sys
import numpy as np
import pyopenjtalk
from scipy.io import wavfile
from scipy.signal import resample_poly

SR = 48000
DUR = 15.0
N = int(SR * DUR)
BPM = 128
BEAT = 60 / BPM            # 32 beats == 15s
EIGHTH = BEAT / 2
BAR = BEAT * 4


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig)] += sig * gain


def env(n, a=0.004, d=0.5):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def musicbox(m, length=1.2, d=0.45):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = (np.sin(2 * np.pi * f * t)
         + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.15)
         + 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.08))
    return s * env(n, 0.002, d)


def epiano(m, length, d=0.9):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3))
    e = env(n, 0.01, d)
    rel = int(0.08 * SR)
    e[-rel:] *= np.linspace(1, 0, rel)
    return s * e


def bass(m, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t)
    e = env(n, 0.006, 0.35)
    rel = int(0.05 * SR)
    e[-rel:] *= np.linspace(1, 0, rel)
    return s * e


rng = np.random.default_rng(7)


def shaker(length=0.06):
    n = int(length * SR)
    s = rng.standard_normal(n)
    s = np.diff(s, prepend=0)          # crude high-pass
    return s * env(n, 0.001, 0.018)


def kick():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t / 0.04) + 45
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.09)


def clap():
    n = int(0.2 * SR)
    s = np.diff(rng.standard_normal(n), prepend=0)
    e = env(n, 0.001, 0.05)
    for k in (0.0, 0.011, 0.022):     # little flam
        e += 0.6 * np.roll(env(n, 0.001, 0.008), int(k * SR))
    return s * e * 0.5


# ---------- SFX ----------
def pop(f0=900):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 1.2 * np.exp(-t / 0.015))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.035)


def boing():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 260 + 140 * np.exp(-t / 0.06) * np.cos(2 * np.pi * 9 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.14)


def whoosh(length=0.5, up=True):
    n = int(length * SR)
    s = rng.standard_normal(n)
    # sweep a one-pole low-pass
    out = np.zeros(n)
    y = 0.0
    for i in range(n):
        a = 0.02 + 0.25 * (i / n if up else 1 - i / n)
        y += a * (s[i] - y)
        out[i] = y
    w = np.sin(np.linspace(0, np.pi, n))
    return out * w


def chime(notes, gap=0.07, d=0.9):
    out = np.zeros(int((gap * len(notes) + 1.6) * SR))
    for k, m in enumerate(notes):
        place(out, musicbox(m, 1.5, d), k * gap, 0.6)
    return out


def tap():
    return pop(1400) * 0.8


# ---------- score ----------
chords = [  # (bass, chord tones) per bar: F Dm Bb C | F Dm Bb C->F
    (41, [57, 60, 65]), (38, [57, 62, 65]), (46, [58, 62, 65]), (48, [55, 60, 64]),
    (41, [57, 60, 65]), (38, [57, 62, 65]), (46, [58, 62, 65]), (41, [57, 60, 65]),
]
melody = [
    [72, None, 69, None, 72, 74, 72, None],
    [74, None, 69, None, 77, 76, 74, None],
    [74, None, 70, None, 74, 77, 76, 74],
    [72, None, None, None, 67, 69, 70, 72],
    [77, None, 72, None, 69, 72, 77, None],
    [76, None, 74, None, 69, 74, 76, 77],
    [77, None, 74, None, 70, 74, 77, 79],
    [81, None, None, None, None, None, None, None],
]

mus = np.zeros(N)
perc = np.zeros(N)
for b in range(8):
    t0 = b * BAR
    bn, ch = chords[b]
    last = b == 7
    # soft chord stabs on beats 1 and 3 (2 and 4 offbeat bounce from bar 3)
    for beat in (0, 2):
        for m in ch:
            place(mus, epiano(m, BEAT * (4 if last else 1.6), 1.6 if last else 0.5), t0 + beat * BEAT, 0.16)
    if b >= 2 and not last:
        for beat in (1.5, 3.5):
            for m in ch:
                place(mus, epiano(m + 12, BEAT * 0.4, 0.12), t0 + beat * BEAT, 0.07)
    # bass from bar 3
    if b >= 2:
        if last:
            place(mus, bass(bn, BAR), t0, 0.5)
        else:
            for beat, off in ((0, 0), (1.5, 0), (2, 7), (3, 12)):
                place(mus, bass(bn + off, BEAT * 0.9), t0 + beat * BEAT, 0.42)
    # melody
    for k, m in enumerate(melody[b]):
        if m is not None:
            place(mus, musicbox(m, 2.5 if last else 1.2, 1.4 if last else 0.4), t0 + k * EIGHTH, 0.30)
    # light percussion from bar 3 (scene 2), fuller from bar 5
    if 2 <= b <= 6:
        for k in range(8):
            place(perc, shaker(), t0 + k * EIGHTH, 0.10 if k % 2 else 0.05)
        place(perc, kick(), t0, 0.55)
        place(perc, kick(), t0 + 2.5 * BEAT, 0.4)
        if b >= 4:
            place(perc, clap(), t0 + BEAT, 0.35)
            place(perc, clap(), t0 + 3 * BEAT, 0.35)

sfx = np.zeros(N)
for t in (0.75, 1.8, 2.85):              # thought bubbles pop
    place(sfx, pop(), t, 0.35)
place(sfx, whoosh(0.5, up=False), 4.2, 0.10)   # bubbles float away
place(sfx, whoosh(0.6), 5.75, 0.08)            # chocolate falls
place(sfx, boing(), 6.25, 0.35)                # lands
place(sfx, pop(1200), 6.8, 0.3)                # ちょこっ
place(sfx, whoosh(0.4), 8.0, 0.07)             # cards slide
place(sfx, tap(), 9.1, 0.35)
place(sfx, tap(), 10.15, 0.35)
place(sfx, boing(), 13.15, 0.25)               # logo chocolate lands
place(sfx, chime([77, 81, 84, 89]), 13.45, 0.5)  # チョコ鑑。

# ---------- narration ----------
lines = [  # (start sec, text read aloud, speed)
    (0.80, "これって、脈あり？", 1.15),
    (2.85, "仕事、このままでいいのかな。", 1.2),
    (4.95, "そんなとき、占いは、もっと気軽でいい。", 1.25),
    (7.80, "人に聞く。エーアイに聞く。", 1.22),
    (9.55, "今の気分で、選べる。", 1.15),
    (11.30, "ちょこっと聞きたい。ちょこっと占いたい。", 1.3),
    (13.50, "だから、チョコカン。", 1.1),
]
vo = np.zeros(N)
report = []
for t, text, speed in lines:
    x, sr = pyopenjtalk.tts(text, speed=speed, half_tone=1.5)
    x = x.astype(np.float64) / 32768.0
    if sr != SR:
        x = resample_poly(x, SR, sr)
    # trim leading/trailing silence
    nz = np.nonzero(np.abs(x) > 0.01)[0]
    x = x[nz[0]:nz[-1] + int(0.05 * SR)]
    place(vo, x, t, 1.0)
    report.append((t, round(t + len(x) / SR, 2), text))

for r in report:
    print(r)

# ---------- mix ----------
music = mus + perc
music /= np.max(np.abs(music)) + 1e-9
# duck the music under the voice
venv = np.abs(vo)
k = int(0.15 * SR)
venv = np.convolve(venv, np.ones(k) / k, mode="same")
duck = 1 - 0.45 * np.clip(venv / (venv.max() * 0.3), 0, 1)
mix = music * 0.42 * duck + sfx + vo * 0.95 / (np.max(np.abs(vo)) + 1e-9)
# fade out tail
fo = int(0.6 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)
mix /= np.max(np.abs(mix)) / 0.89
stereo = np.stack([mix, mix], axis=1)
wavfile.write(sys.argv[1], SR, (stereo * 32767).astype(np.int16))
