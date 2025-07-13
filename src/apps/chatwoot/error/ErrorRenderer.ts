import { ApiError } from '@figuro/chatwoot-sdk/dist/core/ApiError';
import { AxiosError } from 'axios';

/**
 * Class responsible for rendering error information based on error type
 */
export class ErrorRenderer {
  /**
   * Renders error information based on error type
   * @param error The error to render
   * @returns Formatted error text
   */
  public renderError(error: any): string {
    // Handle Axios errors
    if (error.isAxiosError) {
      return this.renderAxiosError(error as AxiosError);
    }

    // Handle Chatwoot SDK ApiError
    if (error instanceof ApiError) {
      return this.renderApiError(error);
    }

    // For all other errors
    return this.renderGenericError(error);
  }

  /**
   * Renders Axios error information
   * @param error The Axios error to render
   * @returns Formatted error text
   */
  private renderAxiosError(error: AxiosError): string {
    let errorText = `Axios Error: ${error.message}`;
    if (!error.response?.data) {
      return errorText;
    }

    // Add response data if it exists and is JSON
    try {
      const data = error.response.data as any;
      let json: undefined;
      if (Buffer.isBuffer(data)) {
        json = JSON.parse(data.toString());
      } else if (typeof data === 'object') {
        json = data;
      } else {
        json = JSON.parse(data as any);
      }
      errorText += `\nData: ${JSON.stringify(json, null, 2)}`;
    } catch (e) {
      errorText += 'Data: <unparsable>';
    }

    return errorText;
  }

  /**
   * Renders Chatwoot SDK ApiError information
   * @param error The ApiError to render
   * @returns Formatted error text
   */
  private renderApiError(error: ApiError): string {
    let errorText = `API Error: ${error.message}`;
    errorText += `\nStatus: ${error.status}`;

    // Add body if it exists
    if (error.body) {
      try {
        const body =
          typeof error.body === 'object' ? error.body : JSON.parse(error.body);
        errorText += `\nBody: ${JSON.stringify(body, null, 2)}`;
      } catch (e) {
        errorText += `\nBody: ${error.body}`;
      }
    }

    return errorText;
  }

  /**
   * Renders generic error information
   * @param error The error to render
   * @returns Formatted error text
   */
  private renderGenericError(error: any): string {
    return error.toString();
  }
}
