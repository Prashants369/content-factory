"""
CaptionAgent — Professional automated subtitling and overlay.
Generates SSA/ASS subtitle files with premium styling and burns them into videos.
"""
import os
import uuid
import subprocess
import pysubs2
from pathlib import Path
from typing import List, Dict, Optional
import imageio_ffmpeg

class CaptionAgent:
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent.parent / "public" / "outputs" / "captions"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    def generate_srt(self, segments: List[Dict], output_path: str):
        """Generates a standard SRT file from segments {start, end, text}."""
        subs = pysubs2.SSAFile()
        for seg in segments:
            event = pysubs2.SSAEvent(start=int(seg["start"] * 1000), end=int(seg["end"] * 1000), text=seg["text"])
            subs.append(event)
        subs.save(output_path)

    def generate_styled_ass(self, segments: List[Dict], output_path: str, font_size: int = 18, primary_color: str = "&H00FFFFFF", shadow_color: str = "&H00000000"):
        """
        Generates a premium SSA/ASS file with custom styling (Glow, Shadow, Font).
        ASS format allows much better "human-like" styling than plain SRT.
        """
        subs = pysubs2.SSAFile()
        
        # Define a high-end style
        style = pysubs2.SSAStyle(
            fontname="Arial", fontsize=font_size, 
            primarycolor=pysubs2.Color(255, 255, 255), # White
            outlinecolor=pysubs2.Color(0, 0, 0),       # Black outline
            backcolor=pysubs2.Color(0, 0, 0, 128),     # Semi-transparent shadow
            bold=True, alignment=pysubs2.Alignment.BOTTOM_CENTER,
            outline=1.5, shadow=2.0
        )
        subs.styles["Default"] = style
        
        for seg in segments:
            # Word-by-word or phrase-by-phrase sync
            event = pysubs2.SSAEvent(
                start=int(seg["start"] * 1000), 
                end=int(seg["end"] * 1000), 
                text=seg["text"]
            )
            subs.append(event)
        
        subs.save(output_path)

    def burn_captions(self, video_path: str, subtitle_path: str, output_path: str) -> bool:
        """
        Uses FFmpeg to burn (hardcode) subtitles into the video.
        This is the most reliable way to get 'perfect captions' across all platforms.
        """
        # Escape path for FFmpeg filter (Windows paths need special care)
        # We use the 'subtitles' filter which supports ASS styling
        sub_path_escaped = str(subtitle_path).replace("\\", "/").replace(":", "\\:")
        
        cmd = [
            self.ffmpeg_exe, "-y",
            "-i", str(video_path),
            "-vf", f"subtitles='{sub_path_escaped}'",
            "-c:a", "copy", # Keep audio as is
            "-preset", "veryfast",
            str(output_path)
        ]
        
        try:
            print(f"[CaptionAgent] Burning captions: {subtitle_path} -> {video_path}")
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"[CaptionAgent] FFmpeg Error: {e.stderr.decode()}")
            return False

    async def process_video_with_captions(self, video_path: str, script_text: str) -> Optional[str]:
        """
        Full Pipeline: 
        1. Estimates timing from script (or would use Whisper if available).
        2. Generates styled ASS.
        3. Burns into video.
        """
        # Basic heuristic timing (0.35s per word)
        words = script_text.split()
        segments = []
        current_time = 0.0
        words_per_seg = 3
        
        for i in range(0, len(words), words_per_seg):
            chunk = " ".join(words[i:i+words_per_seg])
            duration = len(chunk.split()) * 0.4 # slightly slower for readability
            segments.append({
                "start": current_time,
                "end": current_time + duration,
                "text": chunk.upper() # Trendy uppercase captions
            })
            current_time += duration

        ass_filename = f"captions_{uuid.uuid4().hex[:8]}.ass"
        ass_path = self.output_dir / ass_filename
        self.generate_styled_ass(segments, str(ass_path))
        
        video_out_name = f"captioned_{uuid.uuid4().hex[:8]}.mp4"
        video_out_path = Path(video_path).parent / video_out_name
        
        success = self.burn_captions(video_path, str(ass_path), str(video_out_path))
        
        if success:
            # Return relative path for UI
            return f"/outputs/videos/{video_out_name}"
        return None
