from app.pipeline.estimate import estimate_collision
from app.pipeline.locate import Candidate


def c(t, motion=0.0, audio=0.0, decel=0.0, peaks=None):
    return Candidate(t, 0.5, {"box": 0.0, "motion": motion, "audio": audio, "decel": decel},
                     peaks or {"box": None, "motion": t if motion else None, "audio": t if audio else None,
                               "decel": t if decel else None})


def test_shake_and_sound_estimates():
    e = estimate_collision([c(5.0, motion=0.9, audio=0.8)])
    assert e and e.t == 5.0 and {f.text for f in e.facts} == {"화면이 크게 흔들림", "충돌음이 크게 남"}


def test_shake_required():
    assert estimate_collision([c(5.0, audio=0.9, decel=0.9)]) is None


def test_single_signal_not_enough():
    assert estimate_collision([c(5.0, motion=0.95)]) is None


def test_signals_far_apart_not_aligned():
    assert estimate_collision([c(5.0, motion=0.9, audio=0.9, peaks={"box": None, "motion": 5.0, "audio": 6.5, "decel": None})]) is None


def test_earliest_signal_time_is_collision_t():
    e = estimate_collision([c(5.0, motion=0.9, decel=0.9, peaks={"box": None, "motion": 5.2, "audio": None, "decel": 4.9})])
    assert e.t == 4.9 and [f.t for f in e.facts] == [4.9, 5.2]


def test_strongest_candidate_wins():
    e = estimate_collision([c(3.0, motion=0.7, audio=0.7), c(8.0, motion=0.95, audio=0.9)])
    assert e.t == 8.0


def test_manual_candidate_without_peaks_is_ignored():
    assert estimate_collision([Candidate(5.0, 0.0, {})]) is None
