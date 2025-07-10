import { BaseImageGenerator, ImageGenerationRequest, ImageGenerationResponse } from './base';

export class FalImageGenerator extends BaseImageGenerator {
  /**
   * use fal api to generate image
   * @param request fal api request
   * @returns
   */
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const url = `https://queue.fal.run/${request.model}`;

    const headers = {
      Authorization: `Key ${request.apiKey}`,
      'Content-Type': 'application/json',
    };

    const data = {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
    };

    try {
      // submit request to queue
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

      console.log(`Initial request status: ${status}, id: ${requestId}`);

      if (!requestId) {
        console.log('Full Fal response:', result);
        throw new Error('Fal API returned no request id');
      }

      const statusUrl = `https://queue.fal.run/${request.model}/requests/${requestId}/status`;
      let output = null;

      // poll until completed or failed
      while (status !== 'COMPLETED' && status !== 'FAILED') {
        console.log(`Polling request ${requestId}, current status: ${status} ...`);

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
          // get completed result
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
          output = finalResult.images || finalResult.output;
        }
      }

      // check generated image
      if (status !== 'COMPLETED' || !output) {
        throw new Error(`Fal image generation failed with status: ${status}`);
      }

      console.log('Request succeeded, output:', output);

      return {
        output: Array.isArray(output) ? output[0].url : output,
      };
    } catch (error) {
      console.error('Error generating image with fal:', error);
      throw error;
    }
  }
}
