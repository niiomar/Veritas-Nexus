"""Unit tests for api/services/assessment_engine.py.

This is the highest-value test in the suite: it's the server-side port of
what used to be client-side, spoofable scoring logic (see git history around
the INVALID/BROKEN_SIGNATURE mismatch). These tests exist specifically so a
future refactor can't silently reintroduce that kind of drift.
"""
import pytest

from api.services.assessment_engine import evaluate_assessment, evaluate_audio_assessment


def make_ai_report(**overrides):
    base = {
        "deepfake_probability": None,
        "c2pa_data": None,
        "platform_status": "UNKNOWN",
    }
    base.update(overrides)
    return base


class TestRejectionShortCircuit:
    def test_rejected_status_bypasses_scoring_entirely(self):
        result = evaluate_assessment(make_ai_report(platform_status="REJECTED"), exif={"anything": True})
        assert result["verdict"] == "REJECTED"
        assert result["domains"] == []
        assert result["totalScore"] == 0


class TestProvenanceDomain:
    def test_valid_signature_scores_full_30(self):
        report = make_ai_report(c2pa_data={"is_signed": True, "status": "VALID"})
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][0]["score"] == 30

    def test_invalid_signature_scores_zero_and_is_flagged_critical(self):
        report = make_ai_report(c2pa_data={"is_signed": True, "status": "INVALID"})
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][0]["score"] == 0
        # This is the exact bug the port fixed: a tampered signature must
        # drive the verdict to CRITICAL, not just lose provenance points.
        assert result["verdict"] == "CRITICAL"

    def test_partial_signature_scores_15(self):
        report = make_ai_report(c2pa_data={"is_signed": True, "status": "PARTIAL"})
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][0]["score"] == 15

    def test_unsigned_scores_zero(self):
        report = make_ai_report(c2pa_data={"is_signed": False, "status": "UNSIGNED"})
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][0]["score"] == 0

    def test_missing_c2pa_data_treated_as_unsigned(self):
        report = make_ai_report(c2pa_data=None)
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][0]["score"] == 0


class TestAiAuthenticityDomain:
    @pytest.mark.parametrize(
        "prob,expected_score",
        [(0.05, 25), (0.20, 15), (0.50, 5), (0.90, 0)],
    )
    def test_probability_bands(self, prob, expected_score):
        report = make_ai_report(deepfake_probability=prob)
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][1]["score"] == expected_score

    def test_missing_probability_scores_zero_not_an_error(self):
        report = make_ai_report(deepfake_probability=None)
        result = evaluate_assessment(report, exif=None)
        assert result["domains"][1]["score"] == 0


class TestMetadataIntegrityDomain:
    def test_stripped_metadata_scores_zero(self):
        exif = {"anomalies": {"likely_stripped": True}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][2]["score"] == 0

    def test_present_metadata_with_gps_and_makernotes_scores_15(self):
        exif = {"anomalies": {"likely_stripped": False, "gps_present": True, "makernotes_present": True}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][2]["score"] == 15

    def test_no_exif_at_all_scores_zero(self):
        result = evaluate_assessment(make_ai_report(), exif=None)
        assert result["domains"][2]["score"] == 0

    def test_failed_extraction_scores_zero_not_present(self):
        """A failed extraction (exif_core.py returns {"status": "FAILED"})
        must score like no metadata at all, not like metadata is present."""
        exif = {"status": "FAILED", "error": "exiftool not found", "anomalies": {"likely_stripped": False}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][2]["score"] == 0


class TestStructuralConsistencyDomain:
    def test_clean_structural_signals_score_full_15(self):
        exif = {"anomalies": {"ela_anomaly": False, "double_compression": False, "color_profile_mismatch": False}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][3]["score"] == 15

    def test_all_anomalies_present_scores_zero(self):
        exif = {"anomalies": {"ela_anomaly": True, "double_compression": True, "color_profile_mismatch": True}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][3]["score"] == 0

    def test_no_anomalies_dict_scores_neutral_5(self):
        result = evaluate_assessment(make_ai_report(), exif={"status": "COMPLETED"})
        assert result["domains"][3]["score"] == 5


class TestChainOfCustodyDomain:
    def test_no_destructive_export_and_native_origin_scores_full_10(self):
        exif = {"anomalies": {"likely_exported": False, "social_media_origin": False}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][4]["score"] == 10

    def test_exported_and_social_media_origin_scores_zero(self):
        exif = {"anomalies": {"likely_exported": True, "social_media_origin": True}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][4]["score"] == 0


class TestContextualCorrelationDomain:
    def test_known_hardware_and_phash_scores_full_5(self):
        exif = {"fingerprint": {"make": "Canon"}, "extended": {"phash": "abc123"}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][5]["score"] == 5

    def test_unknown_hardware_and_no_phash_scores_zero(self):
        exif = {"fingerprint": {"make": "Unknown"}, "extended": {}}
        result = evaluate_assessment(make_ai_report(), exif)
        assert result["domains"][5]["score"] == 0


class TestVerdictLogic:
    def test_signed_valid_but_high_deepfake_probability_is_conflict(self):
        report = make_ai_report(deepfake_probability=0.95, c2pa_data={"is_signed": True, "status": "VALID"})
        result = evaluate_assessment(report, exif=None)
        assert result["verdict"] == "CONFLICT"

    def test_high_deepfake_probability_alone_is_critical(self):
        report = make_ai_report(deepfake_probability=0.95, c2pa_data=None)
        result = evaluate_assessment(report, exif=None)
        assert result["verdict"] == "CRITICAL"

    def test_full_marks_everywhere_is_verified(self):
        report = make_ai_report(deepfake_probability=0.05, c2pa_data={"is_signed": True, "status": "VALID"})
        exif = {
            "anomalies": {
                "likely_stripped": False, "gps_present": True, "makernotes_present": True,
                "ela_anomaly": False, "double_compression": False, "color_profile_mismatch": False,
                "likely_exported": False, "social_media_origin": False,
            },
            "fingerprint": {"make": "Canon"},
            "extended": {"phash": "abc123"},
        }
        result = evaluate_assessment(report, exif)
        assert result["totalScore"] == 100
        assert result["verdict"] == "VERIFIED"

    def test_no_signal_anywhere_is_inconclusive(self):
        result = evaluate_assessment(make_ai_report(), exif=None)
        assert result["verdict"] == "INCONCLUSIVE"
        assert result["totalScore"] < 40

    def test_conf_is_a_one_decimal_string(self):
        report = make_ai_report(deepfake_probability=0.05, c2pa_data={"is_signed": True, "status": "VALID"})
        result = evaluate_assessment(report, exif=None)
        assert result["conf"] == "60.0"


class TestAudioAssessment:
    """Regression coverage for a real bug: api/worker.py's audio path used
    to call evaluate_assessment (the visual scorer) on audio-shaped report
    data instead of this function. evaluate_assessment has no concept of
    audio_spoof_probability, so every audio file - genuine or a detected
    spoof - silently landed on the same "INCONCLUSIVE" verdict regardless
    of what the audio engine actually found. See tests/test_worker_audio.py
    for the worker-level dispatch test that would have caught this."""

    def test_rejected_short_circuits_like_the_visual_path(self):
        result = evaluate_audio_assessment({"platform_status": "REJECTED"})
        assert result["verdict"] == "REJECTED"
        assert result["totalScore"] == 0

    def test_missing_probability_is_unknown_not_a_crash(self):
        """Engine offline or bypassed by user preference - both leave
        audio_spoof_probability unset."""
        result = evaluate_audio_assessment({"platform_status": "UNKNOWN", "audio_spoof_probability": None})
        assert result["verdict"] == "UNKNOWN"
        assert result["totalScore"] == 0

    def test_low_spoof_probability_is_verified_with_high_confidence(self):
        result = evaluate_audio_assessment({"platform_status": "BONAFIDE_VERIFIED", "audio_spoof_probability": 0.05})
        assert result["verdict"] == "VERIFIED"
        assert result["conf"] == "95.0"

    def test_mid_spoof_probability_is_inconclusive(self):
        result = evaluate_audio_assessment({"platform_status": "REVIEW_REQUIRED", "audio_spoof_probability": 0.4})
        assert result["verdict"] == "INCONCLUSIVE"

    def test_high_spoof_probability_is_critical_with_low_confidence(self):
        """The exact case the bug got backwards: a detected spoof must
        score low, not fall through to the same result as a clean file."""
        result = evaluate_audio_assessment({"platform_status": "SPOOF_DETECTED", "audio_spoof_probability": 0.95})
        assert result["verdict"] == "CRITICAL"
        assert result["conf"] == "5.0"

    def test_clean_and_spoofed_audio_never_produce_the_same_verdict(self):
        clean = evaluate_audio_assessment({"platform_status": "BONAFIDE_VERIFIED", "audio_spoof_probability": 0.05})
        spoofed = evaluate_audio_assessment({"platform_status": "SPOOF_DETECTED", "audio_spoof_probability": 0.95})
        assert clean["verdict"] != spoofed["verdict"]
        assert clean["totalScore"] != spoofed["totalScore"]
