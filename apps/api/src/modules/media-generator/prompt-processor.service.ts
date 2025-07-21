import { Injectable, Logger } from '@nestjs/common';
import { batchTranslateText } from '@refly/utils';

interface LanguageDetectionResult {
  language: string;
  isEnglish: boolean;
  confidence: number;
}

interface PromptProcessingResult {
  translatedPrompt: string;
  originalPrompt: string;
  detectedLanguage: string;
  isTranslated: boolean;
}

@Injectable()
export class PromptProcessorService {
  private readonly logger = new Logger(PromptProcessorService.name);

  /**
   * Detect the language of the given prompt
   * @param prompt The input prompt to analyze
   * @returns Language detection result
   */
  async detectLanguage(prompt: string): Promise<LanguageDetectionResult> {
    if (!prompt?.trim()) {
      return {
        language: 'en',
        isEnglish: true,
        confidence: 1.0,
      };
    }

    // Simple Chinese character detection
    const chineseRegex = /[\u4e00-\u9fff]/g;
    const chineseMatches = prompt.match(chineseRegex);
    const chineseCharCount = chineseMatches?.length || 0;
    const totalCharCount = prompt.length;
    const chineseRatio = chineseCharCount / totalCharCount;

    // Japanese character detection (Hiragana, Katakana, Kanji)
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g;
    const japaneseMatches = prompt.match(japaneseRegex);
    const japaneseCharCount = japaneseMatches?.length || 0;
    const japaneseRatio = japaneseCharCount / totalCharCount;

    // Korean character detection
    const koreanRegex = /[\uac00-\ud7af]/g;
    const koreanMatches = prompt.match(koreanRegex);
    const koreanCharCount = koreanMatches?.length || 0;
    const koreanRatio = koreanCharCount / totalCharCount;

    // English detection (basic Latin characters)
    const englishRegex = /[a-zA-Z]/g;
    const englishMatches = prompt.match(englishRegex);
    const englishCharCount = englishMatches?.length || 0;
    const englishRatio = englishCharCount / totalCharCount;

    // Determine language based on character ratios
    const threshold = 0.1; // 10% threshold for language detection

    if (chineseRatio > threshold) {
      return {
        language: 'zh-CN',
        isEnglish: false,
        confidence: Math.min(chineseRatio * 2, 1.0),
      };
    }

    if (japaneseRatio > threshold) {
      return {
        language: 'ja',
        isEnglish: false,
        confidence: Math.min(japaneseRatio * 2, 1.0),
      };
    }

    if (koreanRatio > threshold) {
      return {
        language: 'ko',
        isEnglish: false,
        confidence: Math.min(koreanRatio * 2, 1.0),
      };
    }

    // Default to English if no other language is detected with sufficient confidence
    return {
      language: 'en',
      isEnglish: true,
      confidence: Math.min(englishRatio * 2, 1.0),
    };
  }

  /**
   * Translate prompt to English if needed
   * @param prompt The original prompt
   * @param sourceLanguage The detected source language
   * @returns Translation result
   */
  async translateToEnglish(
    prompt: string,
    sourceLanguage: string,
  ): Promise<{
    translatedPrompt: string;
    originalPrompt: string;
    translationSucceeded: boolean;
  }> {
    if (!prompt?.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    try {
      // Use batchTranslateText from utils to translate to English
      const translatedTexts = await batchTranslateText([prompt], 'en', sourceLanguage);

      if (!translatedTexts || translatedTexts.length === 0) {
        this.logger.warn('Translation failed, using original prompt');
        return {
          translatedPrompt: prompt,
          originalPrompt: prompt,
          translationSucceeded: false,
        };
      }

      const translatedText = translatedTexts[0] || prompt;
      const translationSucceeded = translatedText !== prompt;

      if (!translationSucceeded) {
        this.logger.warn('Translation returned original text, likely due to network issues');
      }

      return {
        translatedPrompt: translatedText,
        originalPrompt: prompt,
        translationSucceeded,
      };
    } catch (error) {
      this.logger.error(`Translation failed: ${error?.message}`, error?.stack);
      // Fallback to original prompt if translation fails
      return {
        translatedPrompt: prompt,
        originalPrompt: prompt,
        translationSucceeded: false,
      };
    }
  }

  /**
   * Process prompt: detect language and translate to English if needed
   * @param originalPrompt The user's original prompt
   * @returns Complete processing result
   */
  async processPrompt(originalPrompt: string): Promise<PromptProcessingResult> {
    try {
      this.logger.log(`Processing prompt: "${originalPrompt.substring(0, 100)}..."`);

      // Step 1: Detect language
      const detection = await this.detectLanguage(originalPrompt);
      this.logger.log(
        `Detected language: ${detection.language}, isEnglish: ${detection.isEnglish}, confidence: ${detection.confidence}`,
      );

      // Step 2: If already English, return as-is
      if (detection.isEnglish) {
        return {
          translatedPrompt: originalPrompt,
          originalPrompt,
          detectedLanguage: detection.language,
          isTranslated: false,
        };
      }

      // Step 3: Translate to English
      this.logger.log(`Translating from ${detection.language} to English...`);
      const translation = await this.translateToEnglish(originalPrompt, detection.language);

      this.logger.log(
        `Translation completed. Original: "${originalPrompt}", Translated: "${translation.translatedPrompt}", Success: ${translation.translationSucceeded}`,
      );

      return {
        translatedPrompt: translation.translatedPrompt,
        originalPrompt: translation.originalPrompt,
        detectedLanguage: detection.language,
        isTranslated: translation.translationSucceeded,
      };
    } catch (error) {
      this.logger.error(`Prompt processing failed: ${error?.message}`, error?.stack);

      // Fallback: return original prompt if processing fails
      return {
        translatedPrompt: originalPrompt,
        originalPrompt,
        detectedLanguage: 'unknown',
        isTranslated: false,
      };
    }
  }
}
