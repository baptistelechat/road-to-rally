"""Génère les notes du copilote avec Kokoro, une par note entière. Voir public/audio/copilot/CREDITS.md pour l'installation.

Usage : python -X utf8 scripts/generate-copilot-words.py kokoro-v1.0.int8.onnx voices-v1.0.bin public/audio/copilot

Même liste que `PACE_CLIPS` (src/audio/paceNoteWords.ts) : une note ajoutée l'est aux deux endroits.
"""
import sys
import unicodedata
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

GRADES = ["un", "deux", "trois", "quatre", "cinq", "six"]
NOTES = [
    " ".join([side, grade] + (["long"] if long else []) + (["se resserre"] if tightens else []))
    for side in ["gauche", "droite"]
    for grade in GRADES
    for long in [False, True]
    for tightens in [False, True]
] + ["attention crête", "attention bosse", "chicane gauche", "chicane droite", "arrivée"]
CLIPS = NOTES + [f"puis {note}" for note in NOTES] + ["enfilade"]
# Dossier -> vecteurs de style mélangés. Kokoro n'a qu'une voix française, féminine : un mélange avec une voix d'homme latine
# garde l'accent et donne un timbre masculin.
VOICES = {"siwis": {"ff_siwis": 1.0}, "siwis-nicola": {"ff_siwis": 0.5, "im_nicola": 0.5}}
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


def file_name(clip):
    plain = unicodedata.normalize("NFD", clip)
    return "".join(c for c in plain if unicodedata.category(c) != "Mn").replace(" ", "-")


def generate(kokoro, folder, blend):
    style = sum(kokoro.get_voice_style(name) * weight for name, weight in blend.items())
    folder.mkdir(parents=True, exist_ok=True)
    clips = {}
    for text in CLIPS:
        # Kokoro ignore la ponctuation : la phrase seule, sans point.
        audio, rate = kokoro.create(text, voice=style, speed=1.0, lang="fr-fr")
        clips[text] = trim(np.asarray(audio, np.float32), rate)
    gains = {n: 10 ** (TARGET_RMS_DB / 20) / active_rms(c, rate) for n, c in clips.items()}
    # Un seul plafond pour tous : le niveau reste le même d'une note à l'autre.
    top = max(np.abs(c).max() * gains[n] for n, c in clips.items())
    scale = min(1.0, MAX_PEAK / top)
    durations = []
    for text, clip in clips.items():
        pcm = np.round(np.clip(clip * gains[text] * scale, -1, 1) * 32767).astype("<i2")
        with wave.open(str(folder / f"{file_name(text)}.wav"), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(rate)
            handle.writeframes(pcm.tobytes())
        durations.append(len(pcm) / rate)
    print(f"{folder.name}: {len(durations)} fichiers, moyenne {np.mean(durations) * 1000:.0f} ms, max {max(durations) * 1000:.0f}")


def main():
    kokoro = Kokoro(sys.argv[1], sys.argv[2])
    out = Path(sys.argv[3])
    for folder, blend in VOICES.items():
        generate(kokoro, out / folder, blend)


main()
