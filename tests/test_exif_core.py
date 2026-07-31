"""Tests for the Pillow/imagehash/OpenCV/numpy-dependent visual forensics
path in api/services/exif_core.py.

This exists specifically because api/routers/evidence.py's own ingest flow
runs exiftool first and short-circuits to a FAILED result before ever
reaching this code if the exiftool binary is missing (as it is in this test
environment) - so the API integration tests never actually exercise
_run_visual_forensics, and neither would a naive "does it import" check.
That made the opencv-python-headless/Pillow/imagehash/numpy version bump
otherwise unverified.
"""
import base64
import tempfile
from pathlib import Path

from api.services.exif_core import ExifCoreEngine

_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def test_run_visual_forensics_produces_expected_shape():
    with tempfile.TemporaryDirectory() as tmp:
        file_path = Path(tmp) / "test.png"
        file_path.write_bytes(_TINY_PNG)

        dna = ExifCoreEngine._run_visual_forensics(str(file_path), exif_data={})

        assert isinstance(dna["phash"], str)
        assert dna["phash"] != "Unknown"  # PIL + imagehash actually ran
        assert isinstance(dna["ela_anomaly"], bool)
        assert isinstance(dna["double_compression"], bool)
        assert isinstance(dna["color_profile_mismatch"], bool)


def test_run_visual_forensics_degrades_gracefully_on_a_non_image_file():
    with tempfile.TemporaryDirectory() as tmp:
        file_path = Path(tmp) / "not_an_image.txt"
        file_path.write_bytes(b"this is not image data")

        dna = ExifCoreEngine._run_visual_forensics(str(file_path), exif_data={})

        # Must not raise - the real ingest path has no other fallback if this throws.
        assert dna["phash"] == "Unknown"
        assert dna["ela_anomaly"] is False
