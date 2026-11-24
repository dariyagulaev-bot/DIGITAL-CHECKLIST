import numpy as np, wave, struct, os, sys

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)

def write_wav(path, L, R):
    L = np.clip(L, -1, 1); R = np.clip(R, -1, 1)
    inter = np.empty(L.size + R.size, dtype=np.float32)
    inter[0::2] = L; inter[1::2] = R
    data = (inter * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)

def note(freq, dur, kind='sine', detune=0.0):
    t = np.linspace(0, dur, int(SR*dur), endpoint=False)
    f = freq * (2 ** (detune/1200))
    if kind == 'sine':
        y = np.sin(2*np.pi*f*t)
    elif kind == 'pad':
        y = (np.sin(2*np.pi*f*t) + 0.5*np.sin(2*np.pi*2*f*t) + 0.28*np.sin(2*np.pi*3*f*t)
             + 0.14*np.sin(2*np.pi*4*f*t))
    elif kind == 'bell':
        y = (np.sin(2*np.pi*f*t) + 0.6*np.sin(2*np.pi*2.01*f*t) + 0.35*np.sin(2*np.pi*3.01*f*t)
             + 0.2*np.sin(2*np.pi*4.7*f*t))
    else:
        y = np.sin(2*np.pi*f*t)
    return t, y

def hann_env(n, atk, rel):
    env = np.ones(n)
    a = int(atk*SR); r = int(rel*SR)
    if a > 0: env[:a] = 0.5 - 0.5*np.cos(np.linspace(0, np.pi, a))
    if r > 0: env[-r:] = 0.5 + 0.5*np.cos(np.linspace(0, np.pi, r))
    return env

def nm(name, octave=4):
    base = {'C':-9,'C#':-8,'D':-7,'D#':-6,'E':-5,'F':-4,'F#':-3,'G':-2,'G#':-1,'A':0,'A#':1,'B':2}
    semis = base[name] + (octave-4)*12
    return 440.0 * 2 ** (semis/12)

LEN = 119.0
N = int(SR*LEN)

# Progression: Dmaj9 - Bm7 - Gmaj7 - A(add9)  (hopeful, clean)
prog = [
    [nm('D',3), nm('A',3), nm('D',4), nm('F#',4), nm('E',5)],
    [nm('B',2), nm('F#',3), nm('D',4), nm('A',4), nm('C#',5)],
    [nm('G',2), nm('D',3), nm('B',3), nm('F#',4), nm('A',4)],
    [nm('A',2), nm('E',3), nm('C#',4), nm('G',4), nm('B',4)],
]
CHORD = 6.8  # seconds per chord

def build(pad_amp, bell_amp, pulse_amp, bell_every, bright):
    L = np.zeros(N); R = np.zeros(N)
    # pads
    pos = 0.0; ci = 0
    while pos < LEN:
        dur = min(CHORD, LEN-pos)
        chord = prog[ci % 4]
        s = int(pos*SR); e = s+int(dur*SR)
        env = hann_env(e-s, 1.6, 1.8)
        for k, fr in enumerate(chord):
            amp = pad_amp * (0.85 if k < 2 else 0.5) * (1.0 + (0.1 if bright else 0))
            _, yl = note(fr, dur, 'pad', detune=-6)
            _, yr = note(fr, dur, 'pad', detune=+6)
            m = min(len(yl), e-s)
            L[s:s+m] += amp*env[:m]*yl[:m]
            R[s:s+m] += amp*env[:m]*yr[:m]
        ci += 1; pos += CHORD
    # bell arpeggio
    if bell_amp > 0:
        pos = 2.0; ci = 0; step = bell_every
        while pos < LEN-1:
            chord = prog[int(pos//CHORD) % 4]
            tone = chord[2 + (ci % 3)] * (2 if bright else 1)
            d = 1.6
            _, y = note(tone, d, 'bell')
            env = np.exp(-np.linspace(0, 6, len(y)))
            s = int(pos*SR); m = min(len(y), N-s)
            pan = 0.5 + 0.35*np.sin(ci*1.3)
            L[s:s+m] += bell_amp*(1-pan)*env[:m]*y[:m]
            R[s:s+m] += bell_amp*pan*env[:m]*y[:m]
            ci += 1; pos += step
    # soft pulse
    if pulse_amp > 0:
        beat = 60/70*2
        pos = 0.0
        while pos < LEN:
            fr = nm('D', 2)
            d = 0.5
            _, y = note(fr, d, 'sine')
            env = np.exp(-np.linspace(0, 9, len(y)))
            s = int(pos*SR); m = min(len(y), N-s)
            L[s:s+m] += pulse_amp*env[:m]*y[:m]; R[s:s+m] += pulse_amp*env[:m]*y[:m]
            pos += beat
    # airy noise shimmer
    nse = np.random.randn(N)*0.0
    # master fade + normalize
    fade = hann_env(N, 2.0, 3.0)
    L *= fade; R *= fade
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-6)
    g = 0.72/peak
    return L*g, R*g

opts = {
    'music_A': dict(pad_amp=0.5, bell_amp=0.22, pulse_amp=0.0, bell_every=3.4, bright=False),   # warm corporate
    'music_B': dict(pad_amp=0.42, bell_amp=0.26, pulse_amp=0.05, bell_every=1.7, bright=True),  # techy
    'music_C': dict(pad_amp=0.55, bell_amp=0.12, pulse_amp=0.0, bell_every=6.8, bright=False),  # minimal elegant
}
for name, p in opts.items():
    np.random.seed(7)
    L, R = build(**p)
    write_wav(os.path.join(OUT, name+'.wav'), L, R)
    print('wrote', name)

# ---- SFX ----
def sfx(path, L, R):
    write_wav(path, L, R)

# power-on: rising shimmer
d = 0.6; t = np.linspace(0, d, int(SR*d))
sweep = np.sin(2*np.pi*(300 + 900*t/d)*t) + 0.4*np.sin(2*np.pi*2*(300+900*t/d)*t)
env = np.concatenate([np.linspace(0,1,int(SR*0.05)), np.ones(len(t)-int(SR*0.05))])
env = env[:len(t)]*np.exp(-np.linspace(0,3,len(t)))
p = sweep*env*0.5; sfx(os.path.join(OUT,'sfx_power.wav'), p, p); print('wrote sfx_power')

# click: short tick
d = 0.08; t = np.linspace(0, d, int(SR*d))
c = (np.sin(2*np.pi*1800*t))*np.exp(-np.linspace(0,30,len(t)))*0.5
sfx(os.path.join(OUT,'sfx_click.wav'), c, c); print('wrote sfx_click')

# approve: pleasant two-note chime (E then B)
seg = []
for fr in [nm('E',5), nm('B',5)]:
    d=0.5; t=np.linspace(0,d,int(SR*d))
    y=(np.sin(2*np.pi*fr*t)+0.4*np.sin(2*np.pi*2*fr*t))*np.exp(-np.linspace(0,5,len(t)))
    seg.append(y)
a = np.concatenate([seg[0]*0.0+seg[0], seg[1]])
a = a*0.5
sfx(os.path.join(OUT,'sfx_approve.wav'), a, a); print('wrote sfx_approve')
print('done')
