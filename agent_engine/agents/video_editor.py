"""
VideoEditorAgent — The "Human-Like" AI Video Editor.
Uses MoviePy to polish raw AI-generated clips, apply "Dopamine-Curve" pacing,
and handle transitions/B-roll insertion.
"""
import os
import uuid
import random
from pathlib import Path
from moviepy import VideoFileClip, concatenate_videoclips, CompositeVideoClip, ColorClip, AudioFileClip
import moviepy.video.fx as vfx
from typing import List, Dict, Any, Optional, Dict

class VideoEditorAgent:
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent.parent / "public" / "outputs" / "videos"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.assets_dir = Path(__file__).parent.parent.parent / "data" / "assets"
        self.assets_dir.mkdir(parents=True, exist_ok=True)

    def apply_dopamine_pacing(self, video_path: str, pacing_data: Dict) -> str:
        """
        Polishes a video by applying dynamic zooms and cuts based on the 
        calculated Dopamine Retention Curve.
        """
        clip = VideoFileClip(video_path)
        duration = clip.duration
        stimuli = pacing_data.get("stimuli_timeline", [])
        
        processed_clips = []
        last_time = 0.0
        
        for event in stimuli:
            timestamp = event["timestamp"]
            if timestamp >= duration: break
            
            # Slice before the event
            chunk = clip.subclipped(last_time, timestamp)
            processed_clips.append(chunk)
            
            # Apply effect at the timestamp (e.g., slight zoom or flash)
            effect_duration = 0.5
            event_end = min(timestamp + effect_duration, duration)
            event_chunk = clip.subclipped(timestamp, event_end)
            
            action = event.get("effect", "Camera Zoom")
            if "Zoom" in action:
                # Zoom in effect - simplify to fixed 1.1x for smoke test reliability
                event_chunk = event_chunk.resized(1.1)
            elif "B-Roll" in action:
                # Placeholder for B-roll insertion (could be a colored flash for now)
                flash = ColorClip(size=clip.size, color=(255, 255, 255), duration=0.1).with_opacity(0.3)
                event_chunk = CompositeVideoClip([event_chunk, flash.with_start(0)])
            
            processed_clips.append(event_chunk)
            last_time = event_end
            
        # Append remaining
        if last_time < duration:
            processed_clips.append(clip.subclipped(last_time, duration))
            
        final_clip = concatenate_videoclips(processed_clips)
        
        output_name = f"polished_{uuid.uuid4().hex[:8]}.mp4"
        output_path = self.output_dir / output_name
        
        # Write file (using fast presets for the agent loop)
        final_clip.write_videofile(str(output_path), codec="libx264", audio_codec="aac", fps=24, preset="ultrafast", logger=None)
        
        return f"/outputs/videos/{output_name}"

    def assemble_final_cut(self, clips: List[str], music_path: Optional[str] = None) -> str:
        """
        Assembles multiple generated clips into a cohesive final video.
        """
        video_clips = [VideoFileClip(c) for c in clips]
        final_video = concatenate_videoclips(video_clips, method="compose")
        
        if music_path and os.path.exists(music_path):
            audio = AudioFileClip(music_path).subclipped(0, final_video.duration)
            final_video = final_video.with_audio(audio)
            
        output_name = f"final_cut_{uuid.uuid4().hex[:8]}.mp4"
        output_path = self.output_dir / output_name
        
        final_video.write_videofile(str(output_path), codec="libx264", audio_codec="aac", fps=24, preset="medium", logger=None)
        
        return f"/outputs/videos/{output_name}"

    def produce_industry_video(self, source_clips: List[str], production_script: Dict[str, Any]) -> str:
        """
        MASTER PRODUCTION: Assembles a video based on an AI-generated 'Pacing Script'.
        The script defines clip order, text overlays, and 'Dopamine' effects.
        """
        logger_name = f"production_{uuid.uuid4().hex[:4]}"
        
        scenes = []
        for idx, step in enumerate(production_script.get("scenes", [])):
            clip_idx = step.get("source_clip_index", 0)
            if clip_idx >= len(source_clips): continue
            
            raw_clip = VideoFileClip(source_clips[clip_idx])
            start = step.get("start", 0)
            end = step.get("end", raw_clip.duration)
            scene = raw_clip.subclipped(start, end)
            
            # Apply dynamic effects
            effect = step.get("effect", "none")
            if effect == "zoom_in":
                scene = scene.resized(lambda t: 1 + 0.05 * t) # smooth slow zoom
            elif effect == "mirror":
                scene = scene.fx(vfx.mirror_x)
            
            scenes.append(scene)

        if not scenes:
            return ""

        final_video = concatenate_videoclips(scenes, method="compose")
        
        # Audio Layering
        bg_music = production_script.get("audio", {}).get("background_music")
        if bg_music and os.path.exists(bg_music):
            music = AudioFileClip(bg_music).with_effects([vfx.audio_fadein(2), vfx.audio_fadeout(2)])
            final_video = final_video.with_audio(music.subclipped(0, final_video.duration))

        output_name = f"industry_v_{uuid.uuid4().hex[:8]}.mp4"
        output_path = self.output_dir / output_name
        
        final_video.write_videofile(
            str(output_path), 
            codec="libx264", 
            audio_codec="aac", 
            fps=30, 
            preset="medium",
            logger=None
        )
        
        return f"/outputs/videos/{output_name}"
