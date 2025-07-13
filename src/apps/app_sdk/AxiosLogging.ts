import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { ILogger } from './ILogger';

export class AxiosLogging {
  constructor(private readonly logger: ILogger) {}

  applyTo(instance: AxiosInstance) {
    instance.interceptors.request.use(this.onRequest.bind(this));
    instance.interceptors.response.use(
      this.onResponse.bind(this),
      this.onError.bind(this),
    );
  }

  private onRequest(config: AxiosRequestConfig) {
    const method = config.method?.toUpperCase() ?? 'GET';
    const url = config.url ?? '';
    const query = config.params
      ? `?${new URLSearchParams(config.params).toString()}`
      : '';
    const body = config.data ? JSON.stringify(config.data) : '';

    this.logger.info(`${method} ${url}${query} ${body}`);
    return config;
  }

  private onResponse(response: AxiosResponse) {
    const { method, url } = response.config;
    const status = response.status;
    const methodStr = method?.toUpperCase() ?? 'GET';
    const responseData = JSON.stringify(response.data);

    if (status >= 200 && status < 400) {
      this.logger.info(`${methodStr} ${status}:OK ${url}`);
      this.logger.debug(`${methodStr} ${status}:OK ${url} ${responseData}`);
    } else {
      this.logger.warn(`${methodStr} ${status} ${url} ${responseData}`);
    }

    return response;
  }

  private onError(error: any) {
    if (error.response) {
      const { method, url } = error.config;
      const status = error.response.status;
      const message = `${
        method?.toUpperCase() ?? 'GET'
      } ${status} ${url} ${JSON.stringify(error.response.data)}`;
      this.logger.error(message);
    } else {
      this.logger.error(`Axios error: ${error.message}`);
    }

    return Promise.reject(error);
  }
}
