import { BaseAudioGenerator, AudioGenerationRequest, AudioGenerationResponse } from './base';

export class FalAudioGenerator extends BaseAudioGenerator {
  /**
   * 使用异步轮询机制生成音频
   * @param request 音频生成请求
   * @returns 音频生成响应
   */
  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResponse> {
    const url = `https://queue.fal.run/${request.model}`;

    const headers = {
      Authorization: `Key ${request.apiKey}`,
      'Content-Type': 'application/json',
    };

    const data = {
      prompt: request.prompt,
    };

    try {
      // 提交请求到队列
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fal API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const requestId = result.request_id;
      let status = result.status;

      console.log(`Initial audio request status: ${status}, id: ${requestId}`);

      if (!requestId) {
        console.log('Full Fal response:', result);
        throw new Error('Fal API returned no request id');
      }

      const statusUrl = `https://queue.fal.run/${request.model}/requests/${requestId}/status`;
      let output = null;

      // 轮询直到完成
      while (status !== 'COMPLETED' && status !== 'FAILED') {
        console.log(`Polling audio request ${requestId}, current status: ${status} ...`);

        await new Promise((resolve) => setTimeout(resolve, 3000));

        const pollResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            Authorization: `Key ${request.apiKey}`,
          },
        });

        if (!pollResponse.ok) {
          const errorText = await pollResponse.text();
          throw new Error(
            `Fal polling error: ${pollResponse.status} ${pollResponse.statusText} - ${errorText}`,
          );
        }

        const pollResult = await pollResponse.json();
        status = pollResult.status;

        if (status === 'COMPLETED') {
          // 获取最终结果
          const responseUrl = `https://queue.fal.run/${request.model}/requests/${requestId}`;
          const finalResponse = await fetch(responseUrl, {
            method: 'GET',
            headers: {
              Authorization: `Key ${request.apiKey}`,
            },
          });

          if (!finalResponse.ok) {
            const errorText = await finalResponse.text();
            throw new Error(
              `Fal result error: ${finalResponse.status} ${finalResponse.statusText} - ${errorText}`,
            );
          }

          const finalResult = await finalResponse.json();
          output = finalResult.audio_url || finalResult.output;
        }
      }

      // 检查生成结果
      if (status !== 'COMPLETED' || !output) {
        throw new Error(`Fal audio generation failed with status: ${status}`);
      }

      console.log('Audio request succeeded, output:', output);

      return {
        output: Array.isArray(output) ? output[0].url || output[0] : output,
      };
    } catch (error) {
      console.error('Error generating audio with fal:', error);
      throw error;
    }
  }
}
