import pytest

from app.pipeline.media import extract_frames, normalize
from app.pipeline.scan import scan
from tests.fixtures import make_clips as mk


@pytest.mark.model  # 실제 YOLO 모델을 로드한다(첫 실행 시 가중치 다운로드).
def test_scan_returns_empty_tracks_for_blank_video(tmp_path):
    src = tmp_path / "b.mp4"
    mk._ff("-f", "lavfi", "-i", "color=c=gray:size=320x240:rate=30:duration=2", "-pix_fmt", "yuv420p", str(src))
    normalize(src, tmp_path / "a.mp4", tmp_path / "p.mp4", 120)
    frames = extract_frames(tmp_path / "a.mp4", 5, tmp_path / "f")
    result = scan(frames)
    assert result.tracks == {}
    assert len(result.motion) == len(frames) - 1
    assert all(m == 0 for _, m in result.motion)
