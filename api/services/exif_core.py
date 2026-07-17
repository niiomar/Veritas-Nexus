import os
import json
import subprocess

class ExifCoreEngine:
    """Forensic metadata extraction using Phil Harvey's ExifTool."""
    
    @staticmethod
    def extract_metadata(file_path: str) -> dict:
        if not os.path.exists(file_path):
            return {"status": "FAILED", "error": "File not found"}

        # Execute exiftool and output as JSON
        cmd = ["exiftool", "-j", "-G", file_path]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            raw_data = json.loads(result.stdout)[0]
        except Exception as e:
            return {"status": "FAILED", "error": str(e)}

        return ExifCoreEngine._parse_forensic_profile(raw_data)

    @staticmethod
    def _parse_forensic_profile(data: dict) -> dict:
        """Maps raw ExifTool output to the Veritas Nexus UI requirements."""
        
        # 1. HARDWARE & SOFTWARE FINGERPRINT
        make = data.get("EXIF:Make", "Unknown")
        model = data.get("EXIF:Model", "Unknown")
        software = data.get("EXIF:Software") or data.get("XMP:CreatorTool", "None Detected")
        original_name = data.get("EXIF:DocumentName") or data.get("XMP:PreservedFileName", "Unknown")

        # 2. TEMPORAL TIMELINE
        dates = {}
        for key in ["EXIF:DateTimeOriginal", "EXIF:CreateDate", "EXIF:ModifyDate", "File:FileModifyDate", "XMP:MetadataDate"]:
            if key in data:
                dates[key] = data[key]
                
        # 3. ANOMALY & STRIPPING DETECTION
        has_gps = any(k.startswith("GPS:") for k in data.keys())
        has_makernotes = any(k.startswith("MakerNotes:") for k in data.keys())
        
        # Determine if metadata was aggressively stripped (e.g., social media scrub)
        is_stripped = not has_gps and not has_makernotes and make == "Unknown"

        # Export signatures (Resolution/Color Profile changes indicative of export)
        icc_profile = data.get("ICC_Profile:ProfileDescription", "Unknown")
        is_exported = software != "None Detected" or "sRGB" in icc_profile

        # CTF Specific: Social Media Origin
        # Social networks strip EXIF but often leave an optimized color profile or specific JFIF markers
        is_social_media = is_stripped and ("sRGB" in icc_profile or icc_profile == "Unknown")

        # CTF Specific: USB Copy Artifacts
        # When copied to a FAT32/exFAT USB, the filesystem modify date changes, 
        # but the internal EXIF creation dates remain untouched.
        dt_orig = data.get("EXIF:DateTimeOriginal", "")
        file_mod = data.get("File:FileModifyDate", "")
        usb_artifacts = False
        if dt_orig and file_mod:
            # If the filesystem date differs wildly from the internal EXIF date, it was moved/copied
            if str(dt_orig)[:10] != str(file_mod)[:10]:
                usb_artifacts = True

        return {
            "status": "COMPLETED",
            "fingerprint": {
                "make": make,
                "model": model,
                "software": software,
                "original_filename": original_name
            },
            "timeline": dates,
            "anomalies": {
                "gps_present": has_gps,
                "makernotes_present": has_makernotes,
                "likely_stripped": is_stripped,
                "likely_exported": is_exported,
                "social_media_origin": is_social_media,
                "usb_copy_artifacts": usb_artifacts
            },
            "raw_dump": data
        }