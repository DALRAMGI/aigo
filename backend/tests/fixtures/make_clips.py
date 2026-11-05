"""FFmpeg lavfi로 테스트 영상을 만든다. 사고 영상은 저장소에 넣지 않는다."""
import subprocess
from pathlib import Path

FFMPEG = "ffmpeg"


def _ff(*args: str) -> None:
    subprocess.run([FFMPEG, "-v", "error", "-y", *args], check=True, timeout=120)


def testsrc(out: Path, *, seconds=2, size="320x180", rate=25, audio=True, extra_vf=None, extra=()) -> Path:
    cmd = ["-f", "lavfi", "-i", f"testsrc2=size={size}:rate={rate}:duration={seconds}"]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-c:a", "aac", "-shortest"]
    if extra_vf:
        cmd += ["-vf", extra_vf]
    _ff(*cmd, "-c:v", "libx264", "-pix_fmt", "yuv420p", *extra, str(out))
    return out


def vfr(out: Path) -> Path:
    # 25fps 원본에서 프레임을 건너뛰어 가변 프레임률로 만든다.
    return testsrc(out, seconds=3, audio=False, extra_vf="select='not(mod(n,3))'", extra=("-fps_mode", "vfr"))


def rotated(out: Path) -> Path:
    """320x180 영상에 90도 회전 메타데이터를 붙인다. 재생 크기는 180x320이어야 한다."""
    base = testsrc(out.with_name("rot_base.mp4"), audio=False)
    _ff("-display_rotation", "90", "-i", str(base), "-c", "copy", str(out))
    return out


def counter(out: Path, *, frames=60, rate=30) -> Path:
    """프레임 n의 밝기를 4n+8로 칠한다(손실 압축에도 구분되는 간격). 60프레임까지."""
    _ff("-f", "lavfi", "-i", f"color=c=black:size=64x64:rate={rate},format=gray",
        "-vf", "geq=lum='4*N+8'", "-frames:v", str(frames),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-qp", "0", str(out))
    return out
