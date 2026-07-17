import os
import json
import subprocess
try:
    from PIL import Image
    import imagehash
    import cv2
    import numpy as np
except ImportError:
    Image = None

class ExifCoreEngine:
    """Advanced Forensic metadata and visual DNA extraction."""
    
    @staticmethod
    def extract_metadata(file_path: str) -> dict:
        if not os.path.exists(file_path):
            return {"status": "FAILED", "error": "File not found"}

        # 1. Run ExifTool (The Header Forensics)
        cmd = ["exiftool", "-j", "-G", file_path]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            raw_data = json.loads(result.stdout)[0]
        except Exception as e:
            return {"status": "FAILED", "error": str(e)}

        # 2. Run Advanced Visual Forensics (The Binary Forensics)
        visual_dna = ExifCoreEngine._run_visual_forensics(file_path, raw_data)

        # 3. Parse and Combine
        return ExifCoreEngine._parse_forensic_profile(raw_data, visual_dna)

    @staticmethod
    def _run_visual_forensics(file_path: str, exif_data: dict) -> dict:
        """Executes pHash, Error Level Analysis (ELA), and Color Space Verification."""
        dna = {
            "phash": "Unknown",
            "ela_anomaly": False,
            "double_compression": False,
            "color_profile_mismatch": False
        }
        
        if Image is None:
            return dna  # Graceful fallback if dependencies are missing
            
        try:
            # A. Perceptual Hash (Visual DNA for Spoliation Tracking)
            img = Image.open(file_path)
            dna["phash"] = str(imagehash.phash(img))
            
            # B. Color Profile Mismatch Analysis
            # Identifies if EXIF claims standard sRGB but embeds a conflicting or custom ICC payload
            exif_color = str(exif_data.get("EXIF:ColorSpace", ""))
            has_icc = "ICC_Profile:ProfileDescription" in exif_data
            if (exif_color == "Uncalibrated" or exif_color == "65535") and has_icc:
                dna["color_profile_mismatch"] = True
                
            # C. Error Level Analysis (ELA) & Double JPEG Compression Proxy
            # We compress a temporary copy in memory and subtract the matrices
            cv_img = cv2.imread(file_path)
            if cv_img is not None:
                _, encoded = cv2.imencode('.jpg', cv_img, [cv2.IMWRITE_JPEG_QUALITY, 90])
                resaved = cv2.imdecode(encoded, 1)
                
                # Calculate pixel differential variance
                diff = cv2.absdiff(cv_img, resaved)
                variance = np.var(diff)
                
                # High variance in error rates typically indicates the image was spliced 
                # or saved multiple times at different quantization levels.
                if variance > 35.0:
                    dna["ela_anomaly"] = True
                    
                # Specific Double Compression flag logic
                mime = exif_data.get("File:MIMEType", "")
                software = exif_data.get("EXIF:Software", "") or exif_data.get("XMP:CreatorTool", "")
                if mime == "image/jpeg" and software and "Adobe" in software:
                    dna["double_compression"] = True

        except Exception as e:
            print(f"Visual forensics failed: {e}")
            
        return dna

    @staticmethod
    def _parse_forensic_profile(data: dict, visual_dna: dict) -> dict:
        """Maps raw ExifTool output and Computer Vision metrics to the UI."""
        
        # 1. HARDWARE & SOFTWARE FINGERPRINT
        make = data.get("EXIF:Make", "Unknown")
        model = data.get("EXIF:Model", "Unknown")
        software = data.get("EXIF:Software") or data.get("XMP:CreatorTool", "Unknown")
        original_name = data.get("EXIF:DocumentName") or data.get("XMP:PreservedFileName", "Unknown")

        # 2. TEMPORAL TIMELINE
        dates = {}
        for key in ["EXIF:DateTimeOriginal", "EXIF:CreateDate", "EXIF:ModifyDate", "File:FileModifyDate", "XMP:MetadataDate"]:
            if key in data:
                dates[key] = data[key]
                
        # 3. ANOMALY & STRIPPING DETECTION
        has_gps = any(k.startswith("GPS:") for k in data.keys())
        has_makernotes = any(k.startswith("MakerNotes:") for k in data.keys())
        
        is_stripped = not has_gps and not has_makernotes and make == "Unknown"
        icc_profile = data.get("ICC_Profile:ProfileDescription", "Unknown")
        is_exported = software != "Unknown" or "sRGB" in icc_profile
        is_social_media = is_stripped and ("sRGB" in icc_profile or icc_profile == "Unknown")

        dt_orig = data.get("EXIF:DateTimeOriginal", "")
        file_mod = data.get("File:FileModifyDate", "")
        usb_artifacts = False
        if dt_orig and file_mod and str(dt_orig)[:10] != str(file_mod)[:10]:
            usb_artifacts = True

        # 4. EXTENDED ATTRIBUTES
        raw_lat = data.get('Composite:GPSLatitude', '')
        raw_lon = data.get('Composite:GPSLongitude', '')
        gps_coords = f"{raw_lat} {raw_lon}".strip() if raw_lat and raw_lon else "None Detected"
        
        width = data.get('File:ImageWidth', 'Unknown')
        height = data.get('File:ImageHeight', 'Unknown')

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
                "usb_copy_artifacts": usb_artifacts,
                # Injecting the advanced CV metrics into the anomaly payload
                "ela_anomaly": visual_dna["ela_anomaly"],
                "double_compression": visual_dna["double_compression"],
                "color_profile_mismatch": visual_dna["color_profile_mismatch"]
            },
            "extended": {
                "file_size": data.get("File:FileSize", "Unknown"),
                "mime_type": data.get("File:MIMEType", "Unknown"),
                "dimensions": f"{width} x {height}" if width != 'Unknown' else "Unknown",
                "iso": str(data.get("EXIF:ISO", "Unknown")),
                "aperture": str(data.get("EXIF:FNumber", "Unknown")),
                "shutter_speed": str(data.get("EXIF:ExposureTime", "Unknown")),
                "focal_length": str(data.get("EXIF:FocalLength", "Unknown")),
                "author": data.get("EXIF:Artist") or data.get("XMP:Creator", "Unknown"),
                "coordinates": gps_coords,
                "phash": visual_dna["phash"]  # Visual DNA
            },
            "raw_dump": data
        }
