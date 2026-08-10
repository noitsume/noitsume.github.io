#!/usr/bin/env python3
"""Kenangin Patch 6 development-time song analyzer.

Pure-Python PCM WAV analysis keeps the MVP tooling reproducible without adding a
runtime dependency. It computes the stable SHA-256 identity, duration, a beat
estimate, onset timestamps, normalized energy curve, and coarse song sections.
The generated beatmap is metadata for the deterministic Kenangin engine; it is
not a background render job.
"""

from __future__ import annotations

import argparse
from array import array
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
import wave

SCHEMA_VERSION = 1


@dataclass
class WavData:
    sample_rate: int
    samples: list[float]
    duration_sec: float


def read_pcm_wav(path: Path) -> WavData:
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        sample_rate = handle.getframerate()
        frame_count = handle.getnframes()
        raw = handle.readframes(frame_count)

    if sample_width != 2:
        raise ValueError(f"{path}: only 16-bit PCM WAV is supported by the zero-dependency MVP analyzer")

    pcm = array("h")
    pcm.frombytes(raw)
    if sys.byteorder != "little":
        pcm.byteswap()

    if channels == 1:
        mono = [sample / 32768.0 for sample in pcm]
    else:
        mono = []
        for index in range(0, len(pcm), channels):
            frame = pcm[index : index + channels]
            mono.append(sum(frame) / (len(frame) * 32768.0))

    return WavData(
        sample_rate=sample_rate,
        samples=mono,
        duration_sec=len(mono) / sample_rate,
    )


def rms_envelope(data: WavData, window: int = 2048, hop: int = 512) -> tuple[list[float], list[float]]:
    values: list[float] = []
    times: list[float] = []
    samples = data.samples
    for start in range(0, max(1, len(samples) - window + 1), hop):
        chunk = samples[start : start + window]
        if not chunk:
            break
        mean_square = sum(value * value for value in chunk) / len(chunk)
        values.append(math.sqrt(mean_square))
        times.append((start + len(chunk) / 2) / data.sample_rate)
    return values, times


def normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    low = min(values)
    high = max(values)
    if math.isclose(low, high):
        return [0.0 for _ in values]
    return [(value - low) / (high - low) for value in values]


def downsample(values: list[float], target: int = 64) -> list[float]:
    if len(values) <= target:
        return [round(value, 4) for value in normalize(values)]
    output: list[float] = []
    for index in range(target):
        start = round(index * len(values) / target)
        end = max(start + 1, round((index + 1) * len(values) / target))
        output.append(sum(values[start:end]) / max(1, end - start))
    return [round(value, 4) for value in normalize(output)]


def detect_onsets(envelope: list[float], times: list[float]) -> list[float]:
    if len(envelope) < 4:
        return []
    positive_diff = [0.0]
    for current, previous in zip(envelope[1:], envelope[:-1]):
        positive_diff.append(max(0.0, current - previous))

    mean = statistics.fmean(positive_diff)
    deviation = statistics.pstdev(positive_diff) if len(positive_diff) > 1 else 0.0
    threshold = mean + deviation * 1.15
    candidates: list[tuple[float, float]] = []
    for index in range(1, len(positive_diff) - 1):
        strength = positive_diff[index]
        if strength >= threshold and strength >= positive_diff[index - 1] and strength >= positive_diff[index + 1]:
            candidates.append((times[index], strength))

    filtered: list[tuple[float, float]] = []
    min_gap = 0.18
    for timestamp, strength in candidates:
        if filtered and timestamp - filtered[-1][0] < min_gap:
            if strength > filtered[-1][1]:
                filtered[-1] = (timestamp, strength)
            continue
        filtered.append((timestamp, strength))
    return [round(timestamp, 3) for timestamp, _ in filtered]


def estimate_bpm(onsets: list[float]) -> float:
    intervals = [b - a for a, b in zip(onsets, onsets[1:]) if 0.25 <= b - a <= 1.5]
    if not intervals:
        return 90.0
    median = statistics.median(intervals)
    bpm = 60.0 / median
    while bpm < 65:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return round(bpm, 2)


def make_beat_grid(duration: float, bpm: float, onsets: list[float]) -> list[float]:
    interval = 60.0 / bpm
    origin = onsets[0] if onsets and onsets[0] < interval else 0.0
    beats: list[float] = []
    time = origin
    while time <= duration + 1e-6:
        beats.append(round(time, 3))
        time += interval
    return beats


def make_sections(duration: float, energy: list[float]) -> dict[str, list[float]]:
    # The section boundaries are intentionally coarse. Patch 7 needs stable
    # structural vocabulary, not a music-production DAW timeline.
    intro_end = round(duration * 0.18, 3)
    build_end = round(duration * 0.52, 3)
    peak_end = round(duration * 0.82, 3)
    return {
        "intro": [0.0, intro_end],
        "build": [intro_end, build_end],
        "peak": [build_end, peak_end],
        "outro": [peak_end, round(duration, 3)],
    }


def load_tempo_hint(path: Path) -> float | None:
    hint_path = path.with_name("analysis-hints.json")
    if not hint_path.exists():
        return None
    payload = json.loads(hint_path.read_text(encoding="utf-8"))
    value = payload.get("bpm")
    if not isinstance(value, (int, float)) or value <= 0:
        raise ValueError(f"{hint_path}: bpm must be a positive number")
    return float(value)


def analyze_track(path: Path) -> dict[str, object]:
    wav = read_pcm_wav(path)
    envelope, times = rms_envelope(wav)
    onsets = detect_onsets(envelope, times)
    # Curated compositions may provide their authored tempo as a sidecar hint.
    # Unknown imported tracks still use the zero-dependency onset estimate.
    bpm = load_tempo_hint(path) or estimate_bpm(onsets)
    file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    energy_curve = downsample(envelope)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "hash": file_hash,
        "durationSec": round(wav.duration_sec, 3),
        "bpm": bpm,
        "beats": make_beat_grid(wav.duration_sec, bpm, onsets),
        "onsets": onsets,
        "energyCurve": energy_curve,
        "sections": make_sections(wav.duration_sec, energy_curve),
    }


def discover_tracks(root: Path) -> list[Path]:
    if root.is_file():
        return [root]
    return sorted(root.rglob("track.wav"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze curated Kenangin WAV tracks into beatmap.json metadata.")
    parser.add_argument("path", type=Path, help="Track WAV or directory containing songs/{hash}/track.wav")
    parser.add_argument("--verify-hash-folder", action="store_true", help="Fail if the song folder name differs from the track SHA-256 hash")
    args = parser.parse_args()

    tracks = discover_tracks(args.path)
    if not tracks:
        parser.error("No track.wav files found")

    failed = False
    for track in tracks:
        try:
            beatmap = analyze_track(track)
            digest = str(beatmap["hash"])
            if args.verify_hash_folder and track.parent.name != digest:
                raise ValueError(f"hash folder mismatch: folder={track.parent.name}, actual={digest}")
            output = track.with_name("beatmap.json")
            output.write_text(json.dumps(beatmap, indent=2) + "\n", encoding="utf-8")
            print(f"{track}: bpm={beatmap['bpm']} duration={beatmap['durationSec']}s -> {output}")
        except Exception as exc:  # dev CLI should continue and report every broken track
            failed = True
            print(f"ERROR {track}: {exc}", file=sys.stderr)

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
