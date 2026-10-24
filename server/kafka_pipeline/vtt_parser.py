import re
from typing import List, Dict, Tuple, Set

def parse_vtt_timestamp(timestamp_str: str) -> int:
    """
    Parses a WebVTT/SRT timestamp string like '00:01:23.456' or '01:23.456'
    and returns the starting duration in seconds (integer).
    """
    timestamp_str = timestamp_str.strip().replace(',', '.')
    parts = timestamp_str.split(':')
    try:
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return int(hours * 3600 + minutes * 60 + seconds)
        elif len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return int(minutes * 60 + seconds)
        elif len(parts) == 1:
            return int(float(parts[0]))
    except Exception:
        return 0
    return 0

def parse_webvtt(vtt_content: str) -> Tuple[List[Dict[str, any]], List[str], int, int]:
    """
    Parses WebVTT content returned from Zoom, Google Meet, or Microsoft Teams.
    Returns:
        - entries: List[{"start_duration": int, "text": str, "speaker": Optional[str]}]
        - speakers: List of unique speaker names
        - total_duration: Duration in seconds
        - word_count: Total word count
    """
    entries: List[Dict[str, any]] = []
    speakers_set: Set[str] = set()
    total_words = 0
    max_duration = 0

    lines = vtt_content.splitlines()
    i = 0
    timestamp_pattern = re.compile(
        r'(\d{1,2}:(?:\d{2}:)?\d{2}(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:(?:\d{2}:)?\d{2}(?:[.,]\d{1,3})?)'
    )

    while i < len(lines):
        line = lines[i].strip()
        match = timestamp_pattern.search(line)
        if match:
            start_str, end_str = match.groups()
            start_sec = parse_vtt_timestamp(start_str)
            end_sec = parse_vtt_timestamp(end_str)
            if end_sec > max_duration:
                max_duration = end_sec

            # The following lines until an empty line contain the cue text
            text_lines = []
            i += 1
            while i < len(lines) and lines[i].strip():
                cue_line = lines[i].strip()
                # Remove VTT formatting tags like <v SpeakerName> or <b>...</b>
                cue_line = re.sub(r'<v\s+([^>]+)>', r'\1: ', cue_line)
                cue_line = re.sub(r'</?v[^>]*>', '', cue_line)
                cue_line = re.sub(r'<[^>]+>', '', cue_line)
                text_lines.append(cue_line)
                i += 1

            full_text = " ".join(text_lines).strip()
            if full_text:
                # Check for speaker prefix e.g. "John Doe: Hello"
                speaker = None
                if ":" in full_text:
                    possible_speaker, remaining_text = full_text.split(":", 1)
                    if len(possible_speaker.split()) <= 4 and remaining_text.strip():
                        speaker = possible_speaker.strip()
                        speakers_set.add(speaker)
                
                word_count = len(full_text.split())
                total_words += word_count

                entries.append({
                    "start_duration": start_sec,
                    "text": full_text,
                    "speaker": speaker
                })
        else:
            i += 1

    # Fallback if no timestamps were matched (e.g., plain transcript text)
    if not entries and vtt_content.strip():
        paragraphs = [p.strip() for p in vtt_content.split('\n\n') if p.strip()]
        cur_sec = 0
        for p in paragraphs:
            wc = len(p.split())
            total_words += wc
            entries.append({
                "start_duration": cur_sec,
                "text": p,
                "speaker": None
            })
            cur_sec += max(15, wc // 2)
        max_duration = cur_sec

    return entries, sorted(list(speakers_set)), max_duration, total_words
