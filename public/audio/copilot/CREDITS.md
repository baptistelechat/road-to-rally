# Voix du copilote

Notes générées une fois pour toutes par synthèse, une par fichier (« gauche trois long », « puis chicane droite »…), puis coupées et normalisées.

- Modèle : [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0, poids sous licence Apache 2.0, via `kokoro-onnx` (`kokoro-v1.0.int8.onnx`).
- Voix : `siwis/` = `ff_siwis` ; `siwis-nicola/` = mélange 50/50 des vecteurs de style `ff_siwis` et `im_nicola`. Vitesse 1.0, langue `fr-fr`.
- Données d'entraînement de `ff_siwis` : [SIWIS French Speech Synthesis Database](https://datashare.ed.ac.uk/handle/10283/2353), sous licence CC BY.
- Traitement : silence coupé à -35 dB, fondu de 4 ms, niveau RMS actif ramené à -16 dB, WAV PCM mono 16 bits à 24 kHz.

## Régénérer les notes

Le script est `scripts/generate-copilot-words.py`. Le modèle n'est pas dans le dépôt (115 Mo) :

```bash
python -m venv .venv-voice
.venv-voice/Scripts/python -m pip install kokoro-onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
.venv-voice/Scripts/python -X utf8 scripts/generate-copilot-words.py kokoro-v1.0.int8.onnx voices-v1.0.bin public/audio/copilot
```

Une note ajoutée doit l'être aussi à `PACE_CLIPS` dans `src/audio/paceNoteWords.ts`.
