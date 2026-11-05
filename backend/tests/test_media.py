import subprocess

import numpy as np
import pytest

from app.pipeline.media import audio_envelope, extract_frames, normalize, probe
from app.pipeline.run import PipelineError
from tests.fixtures import make_clips as mk


def _stream(path, entries):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", f"stream={entries}",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True).stdout.strip()
    return out.split(",")


def _norm(src, tmp_path, max_seconds=120):
    a, p = tmp_path / "a.mp4", tmp_path / "p.mp4"
    return normalize(src, a, p, max_seconds), a, p


def test_fake_mp4_raises_invalid_video(tmp_path):
    fake = tmp_path / "x.mp4"
    fake.write_text("not a video")
    with pytest.raises(PipelineError) as e:
        _norm(fake, tmp_path)
    assert e.value.code == "INVALID_VIDEO"


def test_over_limit_raises_video_too_long(tmp_path):
    src = mk.testsrc(tmp_path / "s.mp4", seconds=3)
    with pytest.raises(PipelineError) as e:
        _norm(src, tmp_path, max_seconds=1)
    assert e.value.code == "VIDEO_TOO_LONG"


def test_no_audio_is_supported(tmp_path):
    src = mk.testsrc(tmp_path / "s.mp4", audio=False)
    info, a, _ = _norm(src, tmp_path)
    assert info.has_audio is False
    assert audio_envelope(a) is None


def test_audio_envelope(tmp_path):
    info, a, _ = _norm(mk.testsrc(tmp_path / "s.mp4"), tmp_path)
    env = audio_envelope(a)
    assert info.has_audio and len(env) >= 15 and env[5][1] > 0.05


def test_vfr_becomes_30fps(tmp_path):
    _, a, _ = _norm(mk.vfr(tmp_path / "v.mp4"), tmp_path)
    assert _stream(a, "r_frame_rate,avg_frame_rate") == ["30/1", "30/1"]


def test_rotation_is_applied(tmp_path):
    info, a, _ = _norm(mk.rotated(tmp_path / "r.mp4"), tmp_path)
    assert (info.width, info.height) == (180, 320)
    assert _stream(a, "width,height")[:2] == ["180", "320"]


def test_portrait_keeps_aspect(tmp_path):
    src = mk.testsrc(tmp_path / "p.mp4", size="360x640", audio=False)
    info, _, p = _norm(src, tmp_path)
    assert (info.width, info.height) == (360, 640)
    assert _stream(p, "width,height")[:2] == ["360", "640"]


def test_playback_is_h264_720p_or_less(tmp_path):
    src = mk.testsrc(tmp_path / "4k.mp4", seconds=1, size="3840x2160", audio=False)
    info, a, p = _norm(src, tmp_path)
    assert (info.width, info.height) == (3840, 2160)  # 분석용은 원본 해상도
    codec, w, h = _stream(p, "codec_name,width,height")
    assert (codec, w, h) == ("h264", "1280", "720")


def test_frame_timestamps_are_exact(tmp_path):
    _, a, _ = _norm(mk.counter(tmp_path / "c.mp4"), tmp_path)
    for fps, start, end in [(30, 0, None), (5, 0, None), (15, 0.5, 1.5)]:
        out = tmp_path / f"f{fps}_{start}"
        frames = extract_frames(a, fps, out, start=start, end=end)
        assert frames
        for k, f in enumerate(frames):
            assert f.t == pytest.approx(start + k / fps, abs=1e-6)
            import cv2
            gray = cv2.imread(str(f.path), cv2.IMREAD_GRAYSCALE).mean()
            assert round((gray - 8) / 4) == round(f.t * 30), (fps, k, gray)
