# Voix du copilote

Mots générés une fois pour toutes par synthèse, puis coupés et normalisés.

- Modèle : [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0, poids sous licence Apache 2.0, via `kokoro-onnx` (`kokoro-v1.0.int8.onnx`).
- Voix : `ff_siwis`, vitesse 1.0, langue `fr-fr`.
- Données d'entraînement de cette voix : [SIWIS French Speech Synthesis Database](https://datashare.ed.ac.uk/handle/10283/2353), sous licence CC BY.
- Traitement : silence coupé à -35 dB, fondu de 4 ms, niveau RMS actif ramené à -16 dB, WAV PCM mono 16 bits à 24 kHz.

## Régénérer les mots

Le script est `scripts/generate-copilot-words.py`. Le modèle n'est pas dans le dépôt (115 Mo) :

```bash
python -m venv .venv-voice
.venv-voice/Scripts/python -m pip install kokoro-onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
.venv-voice/Scripts/python -X utf8 scripts/generate-copilot-words.py kokoro-v1.0.int8.onnx voices-v1.0.bin public/audio/copilot
```

Un mot ajouté doit aussi l'être à `PACE_WORDS` dans `src/audio/paceNoteWords.ts`.
