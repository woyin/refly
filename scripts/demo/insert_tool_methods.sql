-- ====================================================================================================
-- Tool Methods Seed Data
-- Insert tool methods for Fish Audio and HeyGen toolsets
-- ====================================================================================================
--
-- Prerequisites:
-- 1. Ensure toolset_inventory table contains entries for 'fish-audio' and 'heygen' toolsets
-- 2. Version ID should match the version you want to use (default: '1.0.0')
--
-- Usage:
-- psql -h localhost -U your_user -d your_database -f insert_tool_methods.sql
-- ====================================================================================================

-- ====================================================================================================
-- Fish Audio Tool Methods
-- ====================================================================================================
-- Note: toolset_inventory already has 'fish_audio' and 'heygen' entries

-- Fish Audio: Text to Speech
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  enabled
) VALUES (
  'fish_audio',
  '1.0.0',
  'text_to_speech',
  'Convert text to speech using Fish Audio''s voice cloning technology. Supports voice cloning with reference audio, multiple output formats (mp3, wav, opus, pcm), and emotional expression. Ideal for generating natural-sounding speech with custom voices.',
  'https://api.fish.audio/v1/tts',
  'POST',
  '{"type":"object","properties":{"text":{"type":"string","description":"The text content to convert to speech"},"referenceId":{"type":"string","description":"Voice model ID to use for generation, leave empty unless user assigned"},"referenceStorageKeys":{"type":"array","items":{"type":"string"},"description":"Storage keys of reference audio files for voice cloning"},"referenceTranscripts":{"type":"array","items":{"type":"string"},"description":"Transcripts for reference audio files (same order as referenceStorageKeys)"},"format":{"type":"string","enum":["mp3","wav","opus","pcm"],"default":"mp3","description":"Output audio format"},"chunkLength":{"type":"number","default":200,"description":"Characters per processing chunk (100-300)"},"prosody":{"type":"string","description":"Prosody settings in SSML format to adjust speech characteristics"},"temperature":{"type":"number","default":0.7,"minimum":0.0,"maximum":1.0,"description":"Generation randomness (0.0-1.0, default 0.7)"},"topP":{"type":"number","default":0.7,"minimum":0.0,"maximum":1.0,"description":"Token diversity control (0.0-1.0, default 0.7)"}},"required":["text"]}',
  '{"type":"object","properties":{"status":{"type":"string","enum":["success","error"]},"data":{"type":"object","properties":{"audioUrl":{"type":"string","description":"URL to access the generated audio file"},"storageKey":{"type":"string","description":"Storage key for the audio file"},"entityId":{"type":"string","description":"Entity ID of the generated audio"},"duration":{"type":"number","description":"Audio duration in seconds"},"format":{"type":"string","description":"Audio file format"},"size":{"type":"number","description":"File size in bytes"}}},"errors":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string"},"message":{"type":"string"}}}}}}',
  'http',
  true
) ON CONFLICT (inventory_key, version_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  endpoint = EXCLUDED.endpoint,
  http_method = EXCLUDED.http_method,
  request_schema = EXCLUDED.request_schema,
  response_schema = EXCLUDED.response_schema,
  adapter_type = EXCLUDED.adapter_type,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- Fish Audio: Speech to Text
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  enabled
) VALUES (
  'fish_audio',
  '1.0.0',
  'speech_to_text',
  'Transcribe audio files to text using Fish Audio''s speech recognition. Supports multiple languages with auto-detection, returns timestamped segments, and handles various audio formats (MP3, WAV, M4A, OGG, FLAC, AAC). Maximum file size: 100MB, duration: 60 minutes.',
  'https://api.fish.audio/v1/asr',
  'POST',
  '{"type":"object","properties":{"storageKey":{"type":"string","description":"Storage key of the audio file to transcribe"},"language":{"type":"string","description":"Language code (e.g., \"en\", \"zh\", \"es\"). Leave empty for auto-detection"},"ignoreTimestamps":{"type":"boolean","description":"Skip timestamp processing for faster results"}},"required":["storageKey"]}',
  '{"type":"object","properties":{"status":{"type":"string","enum":["success","error"]},"data":{"type":"object","properties":{"text":{"type":"string","description":"Transcribed text"},"duration":{"type":"number","description":"Audio duration in seconds"},"segments":{"type":"array","description":"Timestamped segments","items":{"type":"object","properties":{"start":{"type":"number"},"end":{"type":"number"},"text":{"type":"string"}}}}}},"errors":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string"},"message":{"type":"string"}}}}}}',
  'http',
  true
) ON CONFLICT (inventory_key, version_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  endpoint = EXCLUDED.endpoint,
  http_method = EXCLUDED.http_method,
  request_schema = EXCLUDED.request_schema,
  response_schema = EXCLUDED.response_schema,
  adapter_type = EXCLUDED.adapter_type,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- ====================================================================================================
-- HeyGen Tool Methods
-- ====================================================================================================

-- HeyGen: Generate Video
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  enabled
) VALUES (
  'heygen',
  '1.0.0',
  'generate_video',
  'Generate AI avatar videos using HeyGen''s video generation API. Supports multiple avatars, custom voices, text-to-speech, backgrounds, and scene composition. Returns a video ID that can be used to check generation status or download the completed video.',
  'https://api.heygen.com/v2/video/generate',
  'POST',
  '{"type":"object","properties":{"scenes":{"type":"array","minItems":1,"maxItems":50,"description":"Array of video scenes (1-50 items). Each scene represents a segment of the final video with its own character, voice, and background.","items":{"type":"object","properties":{"character":{"type":"object","description":"AI character/avatar configuration. Optional - if not provided, only background and voice will be used.","properties":{"avatarId":{"type":"string","description":"HeyGen avatar ID (e.g., \"josh_lite3_20230714\"). Optional - only provide if user explicitly specifies an avatar."},"type":{"type":"string","enum":["avatar","talking_photo"],"default":"avatar","description":"Character type: \"avatar\" for AI avatar, \"talking_photo\" for photo-based"},"avatarStyle":{"type":"string","enum":["normal","circle","closeUp"],"default":"normal","description":"Avatar display style"},"scale":{"type":"number","minimum":0,"maximum":5.0,"description":"Avatar scale (0-5.0)"},"offset":{"type":"object","properties":{"x":{"type":"number","description":"Horizontal offset in pixels"},"y":{"type":"number","description":"Vertical offset in pixels"}}}}},"voice":{"type":"object","required":["type"],"properties":{"type":{"type":"string","enum":["text","audio","silence"],"description":"Voice type"},"voiceId":{"type":"string","description":"Voice ID for text-to-speech (required when type is \"text\")"},"inputText":{"type":"string","description":"Text content to speak (required when type is \"text\")"},"audioUrl":{"type":"string","description":"Direct HTTP/HTTPS URL to audio file"},"storageKey":{"type":"string","description":"Storage key of the audio file (format: \"static/{uuid}\")"},"speed":{"type":"number","minimum":0.5,"maximum":1.5,"description":"Speech speed multiplier (0.5-1.5, default 1.0)"},"pitch":{"type":"number","minimum":-50,"maximum":50,"description":"Voice pitch adjustment (-50 to 50, default 0)"},"emotion":{"type":"string","description":"Voice emotion/tone"}}},"background":{"type":"object","properties":{"type":{"type":"string","enum":["color","image","video"],"description":"Background type"},"url":{"type":"string","description":"Direct HTTP/HTTPS URL to background image/video file"},"storageKey":{"type":"string","description":"Storage key of the background file"},"color":{"type":"string","description":"Background color in hex format (e.g., \"#f6f6fc\")"},"playStyle":{"type":"string","enum":["freeze","loop","fit_to_scene","once"],"default":"fit_to_scene","description":"Video playback mode"}}},"required":["voice"]}}},"dimension":{"type":"object","properties":{"width":{"type":"number","default":720,"description":"Video width in pixels"},"height":{"type":"number","default":480,"description":"Video height in pixels"}}},"aspectRatio":{"type":"string","description":"Video aspect ratio (e.g., \"16:9\", \"9:16\", \"1:1\")"},"test":{"type":"boolean","default":false,"description":"Test mode (adds watermark, faster generation)"},"title":{"type":"string","description":"Video title"},"caption":{"type":"boolean","default":false,"description":"Add captions to video"},"waitForCompletion":{"type":"boolean","default":false,"description":"Wait for video generation to complete (may take several minutes)"}},"required":["scenes"]}',
  '{"type":"object","properties":{"status":{"type":"string","enum":["success","error"]},"data":{"type":"object","properties":{"videoId":{"type":"string","description":"Generated video ID"},"status":{"type":"string","description":"Video generation status"},"videoUrl":{"type":"string","description":"URL to access the generated video"},"thumbnailUrl":{"type":"string","description":"URL to video thumbnail"},"duration":{"type":"number","description":"Video duration in seconds"}}},"errors":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string"},"message":{"type":"string"}}}}}}',
  'http',
  true
) ON CONFLICT (inventory_key, version_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  endpoint = EXCLUDED.endpoint,
  http_method = EXCLUDED.http_method,
  request_schema = EXCLUDED.request_schema,
  response_schema = EXCLUDED.response_schema,
  adapter_type = EXCLUDED.adapter_type,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- ====================================================================================================
-- Verification Queries
-- ====================================================================================================

-- Verify Fish Audio methods
SELECT
  inventory_key,
  version_id,
  name,
  http_method,
  enabled,
  created_at
FROM tool_methods
WHERE inventory_key = 'fish_audio'
ORDER BY name;

-- Verify HeyGen methods
SELECT
  inventory_key,
  version_id,
  name,
  http_method,
  enabled,
  created_at
FROM tool_methods
WHERE inventory_key = 'heygen'
ORDER BY name;

-- Count total tool methods
SELECT
  inventory_key,
  COUNT(*) as method_count
FROM tool_methods
WHERE inventory_key IN ('fish_audio', 'heygen')
  AND deleted_at IS NULL
GROUP BY inventory_key;
