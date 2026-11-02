"""Génère les mots du copilote avec Kokoro. Voir public/audio/copilot/CREDITS.md pour l'installation.

Usage : python scripts/generate-copilot-words.py kokoro-v1.0.int8.onnx voices-v1.0.bin public/audio/copilot [vitesse]

Un nouveau mot s'ajoute ici et dans `PACE_WORDS` (src/audio/paceNoteWords.ts).
"""
import sys
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

# Nom du fichier -> texte dit. Le point final garde une intonation posée.
WORDS = {
    "gauche": "Gauche.",
    "droite": "Droite.",
    "un": "Un.",
    "deux": "Deux.",
    "trois": "Trois.",
    "quatre": "Quatre.",
    "cinq": "Cinq.",
    "six": "Six.",
    "longue": "Longue.",
    "se-resserre": "Se resserre.",
    "crete": "Crête.",
    "bosse": "Bosse.",
    "attention": "Attention.",
    "puis": "Puis.",
    "enfilade": "Enfilade.",
}
VOICE = "ff_siwis"
TRIM_DB = -35
ACTIVE_DB = -20
TARGET_RMS_DB = -16
MAX_PEAK = 0.89
FRAME_S = 0.005
FADE_S = 0.004


def frames_rms(audio, size):
    n = len(audio) // size
    return np.sqrt(np.mean(audio[: n * size].reshape(n, size) ** 2, axis=1))


def trim(audio, rate):
    size = int(FRAME_S * rate)
    rms = frames_rms(audio, size)
    keep = np.nonzero(rms > rms.max() * 10 ** (TRIM_DB / 20))[0]
    cut = audio[max(0, (keep[0] - 1) * size) : min(len(audio), (keep[-1] + 2) * size)].copy()
    fade = int(FADE_S * rate)
    ramp = np.linspace(0, 1, fade)
    cut[:fade] *= ramp
    cut[-fade:] *= ramp[::-1]
    return cut


def active_rms(audio, rate):
    rms = frames_rms(audio, int(FRAME_S * rate))
    active = rms[rms > rms.max() * 10 ** (ACTIVE_DB / 20)]
    return float(np.sqrt(np.mean(active**2)))


def main():
    kokoro = Kokoro(sys.argv[1], sys.argv[2])
    out = Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    clips = {}
    for name, text in WORDS.items():
        audio, rate = kokoro.create(text, voice=VOICE, speed=speed, lang="fr-fr")
        clips[name] = trim(np.asarray(audio, np.float32), rate)
    gains = {n: 10 ** (TARGET_RMS_DB / 20) / active_rms(c, rate) for n, c in clips.items()}
    # Un seul plafond pour tous : le niveau reste le même d'un mot à l'autre.
    top = max(np.abs(c).max() * gains[n] for n, c in clips.items())
    scale = min(1.0, MAX_PEAK / top)
    durations = []
    for name, clip in clips.items():
        pcm = np.round(np.clip(clip * gains[name] * scale, -1, 1) * 32767).astype("<i2")
        with wave.open(str(out / f"{name}.wav"), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(rate)
            handle.writeframes(pcm.tobytes())
        durations.append(len(pcm) / rate)
        print(f"{name:12} {len(pcm) / rate * 1000:5.0f} ms")
    print(f"moyenne {np.mean(durations) * 1000:.0f} ms, min {min(durations) * 1000:.0f}, max {max(durations) * 1000:.0f}")


main()
